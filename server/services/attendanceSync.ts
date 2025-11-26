/**
 * Attendance Device Sync Service
 * Synchronizes biometric device logs with the database
 * Automatically determines attendance status based on grace period
 */

import { db } from "../db";
import { 
  attendanceDevices, 
  deviceLogs, 
  attendance, 
  hrSettings, 
  employees 
} from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { createDeviceAdapter, DeviceLog } from "./deviceAdapters";
import { toDateOnlyString } from "@shared/date-utils";

class AttendanceSyncService {
  private isSyncing: boolean = false;
  private syncEnabled: boolean = true;

  /**
   * Enable or disable device sync
   */
  setEnabled(enabled: boolean) {
    this.syncEnabled = enabled;
    console.log(`Attendance device sync ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Sync all active devices
   */
  async syncAllDevices(): Promise<void> {
    if (this.isSyncing) {
      console.log("Device sync already in progress, skipping...");
      return;
    }

    if (!this.syncEnabled) {
      return;
    }

    this.isSyncing = true;

    try {
      // Get all active devices
      const devices = await db
        .select()
        .from(attendanceDevices)
        .where(eq(attendanceDevices.isActive, true));

      if (devices.length === 0) {
        return;
      }

      console.log(`Starting device sync for ${devices.length} active device(s)`);

      let totalSynced = 0;
      let totalErrors = 0;

      // Process devices in parallel for better performance
      const syncPromises = devices.map(async (device) => {
        try {
          const synced = await Promise.race([
            this.syncDevice(device),
            new Promise<number>((_, reject) => 
              setTimeout(() => reject(new Error('Device sync timeout (60s)')), 60000)
            )
          ]);
          return { success: true, synced, deviceName: device.name };
        } catch (error: any) {
          console.error(`Error syncing device ${device.name}:`, error.message);
          
          // Update device with error (non-blocking)
          await db
            .update(attendanceDevices)
            .set({ 
              lastSyncError: error.message,
              lastSyncAt: new Date()
            })
            .where(eq(attendanceDevices.id, device.id));
          
          return { success: false, error: error.message, deviceName: device.name };
        }
      });

      const results = await Promise.allSettled(syncPromises);
      
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          if (result.value.success && result.value.synced !== undefined) {
            totalSynced += result.value.synced;
          } else {
            totalErrors++;
          }
        } else {
          totalErrors++;
        }
      });

      if (totalSynced > 0 || totalErrors > 0) {
        console.log(`Device sync complete: ${totalSynced} logs synced, ${totalErrors} errors`);
      }
    } catch (error: any) {
      console.error("Error in device sync:", error.message);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync a single device
   */
  private async syncDevice(device: any): Promise<number> {
    try {
      // Create appropriate device adapter
      const adapter = createDeviceAdapter(device.deviceType);
      
      // Connect to device
      const connected = await adapter.connect({
        id: device.id,
        name: device.name,
        ipAddress: device.ipAddress,
        port: device.port,
        apiKey: device.apiKey,
        apiUrl: device.apiUrl,
        ...(device.connectionParams || {}),
      });

      if (!connected) {
        throw new Error("Failed to connect to device");
      }

      // Fetch logs since last sync
      const lastSyncTime = device.lastSyncAt ? new Date(device.lastSyncAt) : undefined;
      const logs = await adapter.fetchLogs(lastSyncTime);

      // Disconnect
      await adapter.disconnect();

      if (logs.length === 0) {
        // Update last sync time even if no new logs
        await db
          .update(attendanceDevices)
          .set({ 
            lastSyncAt: new Date(),
            lastSyncError: null 
          })
          .where(eq(attendanceDevices.id, device.id));
        
        return 0;
      }

      // Process and store logs
      const storedCount = await this.processDeviceLogs(logs);

      // Update device sync status
      await db
        .update(attendanceDevices)
        .set({ 
          lastSyncAt: new Date(),
          lastSyncError: null 
        })
        .where(eq(attendanceDevices.id, device.id));

      console.log(`Synced ${storedCount} logs from device: ${device.name}`);
      return storedCount;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * Process and store device logs
   * Avoids duplicates and creates attendance records
   */
  private async processDeviceLogs(logs: DeviceLog[]): Promise<number> {
    let storedCount = 0;

    for (const log of logs) {
      try {
        // Check for duplicate log (same device, employee, and punch time within 1 minute)
        const oneMinuteBefore = new Date(log.punchTime.getTime() - 60000);
        const oneMinuteAfter = new Date(log.punchTime.getTime() + 60000);

        const [existing] = await db
          .select()
          .from(deviceLogs)
          .where(
            and(
              eq(deviceLogs.deviceId, log.deviceId),
              eq(deviceLogs.employeeId, log.employeeId),
              gte(deviceLogs.punchTime, oneMinuteBefore),
              sql`${deviceLogs.punchTime} <= ${oneMinuteAfter}`
            )
          )
          .limit(1);

        if (existing) {
          console.log(`Skipping duplicate log for employee ${log.employeeId} at ${log.punchTime.toISOString()}`);
          continue;
        }

        // Find employee by employeeId
        const [employee] = await db
          .select()
          .from(employees)
          .where(eq(employees.employeeId, log.employeeId))
          .limit(1);

        if (!employee) {
          console.warn(`Employee not found for employeeId: ${log.employeeId}`);
          continue;
        }

        // Store device log
        const [storedLog] = await db.insert(deviceLogs).values({
          deviceId: log.deviceId,
          employeeId: log.employeeId,
          punchTime: log.punchTime,
          punchType: log.type,
          rawData: log.raw || null,
        }).returning();

        // Process into attendance record
        await this.processAttendanceFromLog(employee, log);

        // Mark log as synced
        await db.update(deviceLogs)
          .set({ 
            synced: true,
            syncedAt: new Date()
          })
          .where(eq(deviceLogs.id, storedLog.id));

        storedCount++;
      } catch (error: any) {
        console.error(`Error processing device log:`, error.message);
      }
    }

    return storedCount;
  }

  /**
   * Create or update attendance record from device log
   * Implements grace period logic and auto-status detection
   */
  private async processAttendanceFromLog(employee: any, log: DeviceLog): Promise<void> {
    try {
      const punchDate = new Date(log.punchTime);
      const dateStr = toDateOnlyString(punchDate); // Timezone-safe YYYY-MM-DD

      // Get HR settings for grace period and office hours
      const [settings] = await db.select().from(hrSettings).limit(1);
      
      // Guard clause: If no HR settings exist, use defaults and create default settings
      if (!settings) {
        console.warn("No HR settings found, creating default settings");
        await db.insert(hrSettings).values({});
      }
      
      const gracePeriodMinutes = settings?.gracePeriodMinutes || 15;
      const officeStartTime = settings?.officeStartTime || "09:00";
      
      // Parse office start time
      const [startHour, startMinute] = officeStartTime.split(":").map(Number);
      const officeStart = new Date(punchDate);
      officeStart.setHours(startHour, startMinute, 0, 0);
      
      // Grace period end time
      const graceEnd = new Date(officeStart.getTime() + gracePeriodMinutes * 60000);

      // Find or create attendance record for this date
      const [existingAttendance] = await db
        .select()
        .from(attendance)
        .where(
          and(
            eq(attendance.userId, employee.userId!),
            sql`${attendance.date} = ${dateStr}`
          )
        )
        .limit(1);

      if (log.type === "check-in") {
        // Determine if on-time or late
        const isLate = punchDate > graceEnd;
        const status = isLate ? "late" : "present";

        if (existingAttendance) {
          // Update check-in time if this is earlier
          if (!existingAttendance.checkIn || new Date(existingAttendance.checkIn) > punchDate) {
            await db
              .update(attendance)
              .set({ 
                checkIn: log.punchTime,
                status: status
              })
              .where(eq(attendance.id, existingAttendance.id));
          }
        } else {
          // Create new attendance record
          await db.insert(attendance).values({
            userId: employee.userId!,
            date: dateStr,
            checkIn: log.punchTime,
            status: status,
          });
        }

        console.log(`Processed check-in for ${employee.fullName}: ${status} at ${log.punchTime.toISOString()}`);
      } else if (log.type === "check-out") {
        if (existingAttendance) {
          // Update check-out time if this is later
          if (!existingAttendance.checkOut || new Date(existingAttendance.checkOut) < punchDate) {
            await db
              .update(attendance)
              .set({ checkOut: log.punchTime })
              .where(eq(attendance.id, existingAttendance.id));
          }
        } else {
          // Create attendance with only check-out (unusual but possible)
          await db.insert(attendance).values({
            userId: employee.userId!,
            date: dateStr,
            checkOut: log.punchTime,
            status: "present", // Default to present
          });
        }

        console.log(`Processed check-out for ${employee.fullName} at ${log.punchTime.toISOString()}`);
      }
    } catch (error: any) {
      console.error(`Error processing attendance from log:`, error.message);
      throw error;
    }
  }

  /**
   * Manual sync trigger for a specific device
   */
  async syncDeviceById(deviceId: string): Promise<number> {
    const [device] = await db
      .select()
      .from(attendanceDevices)
      .where(eq(attendanceDevices.id, deviceId))
      .limit(1);

    if (!device) {
      throw new Error("Device not found");
    }

    if (!device.isActive) {
      throw new Error("Device is not active");
    }

    return this.syncDevice(device);
  }

  /**
   * Test connection to a specific device
   */
  async testDeviceConnection(deviceId: string): Promise<boolean> {
    const [device] = await db
      .select()
      .from(attendanceDevices)
      .where(eq(attendanceDevices.id, deviceId))
      .limit(1);

    if (!device) {
      throw new Error("Device not found");
    }

    const adapter = createDeviceAdapter(device.deviceType);
    
    const connected = await adapter.connect({
      id: device.id,
      name: device.name,
      ipAddress: device.ipAddress,
      port: device.port,
      apiKey: device.apiKey,
      apiUrl: device.apiUrl,
      ...(device.connectionParams || {}),
    });

    await adapter.disconnect();

    return connected;
  }
}

export const attendanceSyncService = new AttendanceSyncService();

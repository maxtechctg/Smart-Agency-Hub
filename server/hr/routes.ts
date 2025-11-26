/**
 * HR & Payroll Routes Module
 * Handles all HR, Payroll, Leave, Attendance Device, and Performance endpoints
 */

import { Express } from "express";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { AuthRequest } from "../middleware/auth";
import {
  departments,
  designations,
  employees,
  users,
  hrSettings,
  attendanceDevices,
  deviceLogs,
  leaveTypes,
  leaveRequests,
  leaveBalances,
  punchCorrections,
  salaryStructure,
  payroll,
  salarySlips,
  performanceScores,
  insertDepartmentSchema,
  insertDesignationSchema,
  insertEmployeeSchema,
  insertHrSettingsSchema,
  insertAttendanceDeviceSchema,
  insertDeviceLogSchema,
  insertLeaveTypeSchema,
  insertLeaveRequestSchema,
  insertLeaveBalanceSchema,
  insertPunchCorrectionSchema,
  insertSalaryStructureSchema,
  insertPayrollSchema,
  insertSalarySlipSchema,
  insertPerformanceScoreSchema,
} from "@shared/schema";

export function registerHrPayrollRoutes(
  app: Express,
  db: any,
  authenticateToken: any,
  auditMiddleware: any
) {
  // ==================== HR SETTINGS ====================

  app.get("/api/hr-settings", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const [settings] = await db.select().from(hrSettings).limit(1);
      if (!settings) {
        // Create default settings if none exist
        const [newSettings] = await db.insert(hrSettings).values({}).returning();
        return res.json(newSettings);
      }
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/hr-settings/:id", authenticateToken, auditMiddleware("update", "hr_settings"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Access denied. Admin only." });
      }
      
      // Convert numeric fields from number to string to match schema expectations
      const requestBody = { ...req.body };
      if (typeof requestBody.overtimeRateMultiplier === 'number') {
        requestBody.overtimeRateMultiplier = requestBody.overtimeRateMultiplier.toString();
      }
      if (typeof requestBody.halfDayHours === 'number') {
        requestBody.halfDayHours = requestBody.halfDayHours.toString();
      }
      if (typeof requestBody.fullDayHours === 'number') {
        requestBody.fullDayHours = requestBody.fullDayHours.toString();
      }
      if (typeof requestBody.minimumHoursForPresent === 'number') {
        requestBody.minimumHoursForPresent = requestBody.minimumHoursForPresent.toString();
      }
      
      const data = insertHrSettingsSchema.parse(requestBody);
      const [updated] = await db.update(hrSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(hrSettings.id, req.params.id))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ==================== DEPARTMENTS ====================

  app.get("/api/departments", authenticateToken, async (req, res) => {
    try {
      const allDepartments = await db.select().from(departments).orderBy(departments.name);
      res.json(allDepartments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/departments", authenticateToken, auditMiddleware("create", "department"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const data = insertDepartmentSchema.parse(req.body);
      const [department] = await db.insert(departments).values(data).returning();
      res.json(department);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/departments/:id", authenticateToken, auditMiddleware("update", "department"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const data = insertDepartmentSchema.partial().parse(req.body);
      const [updated] = await db.update(departments)
        .set(data)
        .where(eq(departments.id, req.params.id))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/departments/:id", authenticateToken, auditMiddleware("delete", "department"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Access denied. Admin only." });
      }
      
      await db.delete(departments).where(eq(departments.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ==================== DESIGNATIONS ====================

  app.get("/api/designations", authenticateToken, async (req, res) => {
    try {
      const allDesignations = await db.select().from(designations).orderBy(designations.title);
      res.json(allDesignations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/designations", authenticateToken, auditMiddleware("create", "designation"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const data = insertDesignationSchema.parse(req.body);
      const [designation] = await db.insert(designations).values(data).returning();
      res.json(designation);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/designations/:id", authenticateToken, auditMiddleware("update", "designation"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const data = insertDesignationSchema.partial().parse(req.body);
      const [updated] = await db.update(designations)
        .set(data)
        .where(eq(designations.id, req.params.id))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/designations/:id", authenticateToken, auditMiddleware("delete", "designation"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Access denied. Admin only." });
      }
      
      await db.delete(designations).where(eq(designations.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ==================== EMPLOYEES ====================

  app.get("/api/employees", authenticateToken, async (req, res) => {
    try {
      const allEmployees = await db.select({
        id: employees.id,
        userId: employees.userId,
        employeeId: employees.employeeId,
        departmentId: employees.departmentId,
        designationId: employees.designationId,
        joiningDate: employees.joiningDate,
        status: employees.status,
        createdAt: employees.createdAt,
        // Include user data via aggregation
        users: sql`COALESCE((
          SELECT json_agg(json_build_object(
            'id', ${users.id},
            'fullName', ${users.fullName},
            'email', ${users.email},
            'role', ${users.role}
          ))
          FROM ${users}
          WHERE ${users.id} = ${employees.userId}
        ), '[]'::json)`.as('users'),
        // Include department data
        department: sql`(
          SELECT json_build_object(
            'id', ${departments.id},
            'name', ${departments.name}
          )
          FROM ${departments}
          WHERE ${departments.id} = ${employees.departmentId}
        )`.as('department'),
      })
        .from(employees)
        .orderBy(employees.employeeId);
      
      res.json(allEmployees);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/employees", authenticateToken, auditMiddleware("create", "employee"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const data = insertEmployeeSchema.parse(req.body);
      const [employee] = await db.insert(employees).values(data).returning();
      res.json(employee);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/employees/:id", authenticateToken, auditMiddleware("update", "employee"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const data = insertEmployeeSchema.partial().parse(req.body);
      const [updated] = await db.update(employees)
        .set(data)
        .where(eq(employees.id, req.params.id))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ==================== ATTENDANCE DEVICES ====================

  app.get("/api/attendance-devices", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const devices = await db.select().from(attendanceDevices).orderBy(attendanceDevices.name);
      res.json(devices);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/attendance-devices", authenticateToken, auditMiddleware("create", "attendance_device"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Access denied. Admin only." });
      }
      
      const data = insertAttendanceDeviceSchema.parse(req.body);
      const [device] = await db.insert(attendanceDevices).values(data).returning();
      res.json(device);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/attendance-devices/:id", authenticateToken, auditMiddleware("update", "attendance_device"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Access denied. Admin only." });
      }
      
      const data = insertAttendanceDeviceSchema.partial().parse(req.body);
      const [updated] = await db.update(attendanceDevices)
        .set(data)
        .where(eq(attendanceDevices.id, req.params.id))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/attendance-devices/:id", authenticateToken, auditMiddleware("delete", "attendance_device"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Access denied. Admin only." });
      }
      
      await db.delete(attendanceDevices).where(eq(attendanceDevices.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Device Logs
  app.get("/api/device-logs", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const logs = await db.select().from(deviceLogs)
        .orderBy(desc(deviceLogs.punchTime))
        .limit(200);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Device Sync Operations
  app.post("/api/attendance-devices/:id/sync", authenticateToken, auditMiddleware("sync", "attendance_device"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { attendanceSyncService } = await import("../services/attendanceSync");
      const count = await attendanceSyncService.syncDeviceById(req.params.id);
      
      res.json({ success: true, logssynced: count });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/attendance-devices/:id/test", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { attendanceSyncService } = await import("../services/attendanceSync");
      const connected = await attendanceSyncService.testDeviceConnection(req.params.id);
      
      res.json({ success: connected, message: connected ? "Device connected successfully" : "Failed to connect to device" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/attendance-devices/sync-all", authenticateToken, auditMiddleware("sync_all", "attendance_device"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { attendanceSyncService } = await import("../services/attendanceSync");
      
      // Trigger async sync without waiting
      attendanceSyncService.syncAllDevices();
      
      res.json({ success: true, message: "Device sync initiated" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ==================== LEAVE TYPES ====================

  app.get("/api/leave-types", authenticateToken, async (req, res) => {
    try {
      const types = await db.select().from(leaveTypes).orderBy(leaveTypes.name);
      res.json(types);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/leave-types", authenticateToken, auditMiddleware("create", "leave_type"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const data = insertLeaveTypeSchema.parse(req.body);
      const [leaveType] = await db.insert(leaveTypes).values(data).returning();
      res.json(leaveType);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/leave-types/:id", authenticateToken, auditMiddleware("update", "leave_type"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const data = insertLeaveTypeSchema.partial().parse(req.body);
      const [updated] = await db.update(leaveTypes)
        .set(data)
        .where(eq(leaveTypes.id, req.params.id))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ==================== LEAVE REQUESTS ====================

  app.get("/api/leave-requests", authenticateToken, async (req: AuthRequest, res) => {
    try {
      let requests;
      if (req.userRole === "admin" || req.userRole === "operational_head") {
        requests = await db.select().from(leaveRequests)
          .orderBy(desc(leaveRequests.createdAt));
      } else {
        // Developers can only see their own leave requests
        const [employee] = await db.select().from(employees)
          .where(eq(employees.userId, req.userId!))
          .limit(1);
        
        if (!employee) {
          return res.status(404).json({ error: "Employee record not found" });
        }
        
        requests = await db.select().from(leaveRequests)
          .where(eq(leaveRequests.employeeId, employee.id))
          .orderBy(desc(leaveRequests.createdAt));
      }
      res.json(requests);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/leave-requests", authenticateToken, auditMiddleware("create", "leave_request"), async (req: AuthRequest, res) => {
    try {
      const data = insertLeaveRequestSchema.parse(req.body);
      const [request] = await db.insert(leaveRequests).values(data).returning();
      res.json(request);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/leave-requests/:id", authenticateToken, auditMiddleware("update", "leave_request"), async (req: AuthRequest, res) => {
    try {
      const data = insertLeaveRequestSchema.partial().parse(req.body);
      
      // Get existing leave request to prevent self-approval
      const [existing] = await db.select()
        .from(leaveRequests)
        .where(eq(leaveRequests.id, req.params.id))
        .limit(1);
      
      if (!existing) {
        return res.status(404).json({ error: "Leave request not found" });
      }
      
      // If approving/rejecting, enforce strict role and self-approval checks
      if (data.status === "approved" || data.status === "rejected") {
        if (req.userRole !== "admin" && req.userRole !== "operational_head") {
          return res.status(403).json({ error: "Only admins and operational heads can approve/reject leave requests" });
        }
        
        // Prevent self-approval
        if (existing.employeeId === req.userId) {
          return res.status(403).json({ error: "You cannot approve your own leave request" });
        }
        
        data.approvedBy = req.userId;
        data.approvedAt = new Date();
      }
      
      const [updated] = await db.update(leaveRequests)
        .set(data)
        .where(eq(leaveRequests.id, req.params.id))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Leave Balances
  app.get("/api/leave-balances", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const employeeId = req.query.employeeId as string;
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      
      let balances;
      if (employeeId) {
        balances = await db.select().from(leaveBalances)
          .where(and(
            eq(leaveBalances.employeeId, employeeId),
            eq(leaveBalances.year, year)
          ));
      } else {
        balances = await db.select().from(leaveBalances)
          .where(eq(leaveBalances.year, year));
      }
      
      res.json(balances);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== PUNCH CORRECTIONS ====================

  app.get("/api/punch-corrections", authenticateToken, async (req: AuthRequest, res) => {
    try {
      let corrections;
      if (req.userRole === "admin" || req.userRole === "operational_head") {
        corrections = await db.select().from(punchCorrections)
          .orderBy(desc(punchCorrections.createdAt));
      } else {
        const [employee] = await db.select().from(employees)
          .where(eq(employees.userId, req.userId!))
          .limit(1);
        
        if (!employee) {
          return res.status(404).json({ error: "Employee record not found" });
        }
        
        corrections = await db.select().from(punchCorrections)
          .where(eq(punchCorrections.employeeId, employee.id))
          .orderBy(desc(punchCorrections.createdAt));
      }
      res.json(corrections);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/punch-corrections", authenticateToken, auditMiddleware("create", "punch_correction"), async (req: AuthRequest, res) => {
    try {
      const data = insertPunchCorrectionSchema.parse(req.body);
      
      // Ensure status is set to pending for new requests
      const correctionData = {
        ...data,
        status: "pending" as const,
      };
      
      const [correction] = await db.insert(punchCorrections).values(correctionData).returning();
      res.json(correction);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/punch-corrections/:id", authenticateToken, auditMiddleware("update", "punch_correction"), async (req: AuthRequest, res) => {
    try {
      const data = insertPunchCorrectionSchema.partial().parse(req.body);
      
      // Get existing correction to prevent self-approval
      const [existing] = await db.select()
        .from(punchCorrections)
        .where(eq(punchCorrections.id, req.params.id))
        .limit(1);
      
      if (!existing) {
        return res.status(404).json({ error: "Punch correction not found" });
      }
      
      // If approving/rejecting, enforce strict role and self-approval checks
      if (data.status === "approved" || data.status === "rejected") {
        if (req.userRole !== "admin" && req.userRole !== "operational_head") {
          return res.status(403).json({ error: "Only admins and operational heads can approve/reject punch corrections" });
        }
        
        // Prevent self-approval
        if (existing.employeeId === req.userId) {
          return res.status(403).json({ error: "You cannot approve your own punch correction" });
        }
        
        data.approvedBy = req.userId;
        data.approvedAt = new Date();
      }
      
      const [updated] = await db.update(punchCorrections)
        .set(data)
        .where(eq(punchCorrections.id, req.params.id))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ==================== SALARY STRUCTURE ====================

  app.get("/api/salary-structure", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const allStructures = await db.select().from(salaryStructure);
      res.json(allStructures);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/salary-structure", authenticateToken, auditMiddleware("create", "salary_structure"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Access denied. Admin only." });
      }
      
      const data = insertSalaryStructureSchema.parse(req.body);
      const [structure] = await db.insert(salaryStructure).values(data).returning();
      res.json(structure);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/salary-structure/:id", authenticateToken, auditMiddleware("update", "salary_structure"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Access denied. Admin only." });
      }
      
      const data = insertSalaryStructureSchema.partial().parse(req.body);
      const [updated] = await db.update(salaryStructure)
        .set(data)
        .where(eq(salaryStructure.id, req.params.id))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ==================== PAYROLL ====================

  app.get("/api/payroll", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const month = req.query.month ? parseInt(req.query.month as string) : new Date().getMonth() + 1;
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      
      const payrollRecords = await db.select().from(payroll)
        .where(and(
          eq(payroll.month, month),
          eq(payroll.year, year)
        ))
        .orderBy(payroll.createdAt);
      
      res.json(payrollRecords);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/payroll", authenticateToken, auditMiddleware("create", "payroll"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Access denied. Admin only." });
      }
      
      const data = insertPayrollSchema.parse(req.body);
      const [payrollRecord] = await db.insert(payroll).values({
        ...data,
        generatedBy: req.userId,
      }).returning();
      
      res.json(payrollRecord);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/payroll/:id", authenticateToken, auditMiddleware("update", "payroll"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Access denied. Admin only." });
      }
      
      const data = insertPayrollSchema.partial().parse(req.body);
      const [updated] = await db.update(payroll)
        .set(data)
        .where(eq(payroll.id, req.params.id))
        .returning();
      
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ==================== SALARY SLIPS ====================

  app.get("/api/salary-slips", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const payrollId = req.query.payrollId as string;
      
      if (payrollId) {
        const [slip] = await db.select().from(salarySlips)
          .where(eq(salarySlips.payrollId, payrollId))
          .limit(1);
        return res.json(slip);
      }
      
      const slips = await db.select().from(salarySlips)
        .orderBy(desc(salarySlips.generatedAt));
      res.json(slips);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==================== PERFORMANCE SCORES ====================

  app.get("/api/performance-scores", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const month = req.query.month ? parseInt(req.query.month as string) : new Date().getMonth() + 1;
      const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();
      
      const scores = await db.select().from(performanceScores)
        .where(and(
          eq(performanceScores.month, month),
          eq(performanceScores.year, year)
        ));
      
      res.json(scores);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/performance-scores", authenticateToken, auditMiddleware("create", "performance_score"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const data = insertPerformanceScoreSchema.parse(req.body);
      const [score] = await db.insert(performanceScores).values(data).returning();
      res.json(score);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });
}

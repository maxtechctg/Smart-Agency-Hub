import { db } from "../db";
import { leads, invoices, users, clients } from "@shared/schema";
import { eq, and, lte, gte, sql } from "drizzle-orm";
import { attendanceSyncService } from "./attendanceSync";

class SchedulerService {
  private intervals: NodeJS.Timeout[] = [];
  private emailService: any;

  constructor(emailService: any) {
    this.emailService = emailService;
  }

  start() {
    // Check for lead follow-ups every hour
    const leadInterval = setInterval(() => {
      this.checkLeadFollowUps();
    }, 60 * 60 * 1000); // 1 hour

    // Check for overdue invoices every hour, but only at 9 AM
    const invoiceInterval = setInterval(() => {
      const now = new Date();
      if (now.getHours() === 9) {
        this.checkInvoiceReminders();
      }
    }, 60 * 60 * 1000); // 1 hour

    // Sync attendance devices every minute
    const deviceSyncInterval = setInterval(() => {
      attendanceSyncService.syncAllDevices();
    }, 60 * 1000); // 1 minute

    this.intervals.push(leadInterval, invoiceInterval, deviceSyncInterval);

    // Run lead follow-ups immediately on startup
    this.checkLeadFollowUps();
    
    // Only run invoice reminders if it's 9 AM
    const now = new Date();
    if (now.getHours() === 9) {
      this.checkInvoiceReminders();
    }

    // Run initial device sync on startup
    attendanceSyncService.syncAllDevices();

    console.log("Scheduler service started (leads, invoices, device sync)");
  }

  stop() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    console.log("Scheduler service stopped");
  }

  private async checkLeadFollowUps() {
    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get leads with follow-up date now or in the past, not reminded in last 24 hours
      // Skip leads without a followUpDate set
      const leadsToFollow = await db
        .select()
        .from(leads)
        .where(
          and(
            sql`${leads.followUpDate} IS NOT NULL`,
            lte(leads.followUpDate, now),
            sql`${leads.status} NOT IN ('converted', 'lost')`,
            sql`(${leads.lastFollowUpReminderAt} IS NULL OR ${leads.lastFollowUpReminderAt} < ${twentyFourHoursAgo})`
          )
        );

      let sentCount = 0;
      let skippedCount = 0;

      for (const lead of leadsToFollow) {
        if (!lead.assignedTo) {
          skippedCount++;
          console.log(`Skipped lead ${lead.name}: No assignee`);
          continue;
        }

        const [assignedUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, lead.assignedTo))
          .limit(1);

        if (!assignedUser) {
          skippedCount++;
          console.log(`Skipped lead ${lead.name}: Assignee not found`);
          continue;
        }

        const emailSent = await this.emailService.sendLeadFollowUp({ ...lead, assignedUser });
        
        if (emailSent) {
          // Update last reminder timestamp
          await db
            .update(leads)
            .set({ lastFollowUpReminderAt: now })
            .where(eq(leads.id, lead.id));
          
          sentCount++;
          console.log(`Follow-up email sent for lead: ${lead.name}`);
        } else {
          skippedCount++;
          console.log(`Failed to send email for lead: ${lead.name}`);
        }
      }

      if (sentCount > 0 || skippedCount > 0) {
        console.log(`Lead follow-ups: ${sentCount} sent, ${skippedCount} skipped`);
      }
    } catch (error) {
      console.error("Error checking lead follow-ups:", error);
    }
  }

  private async checkInvoiceReminders() {
    try {
      const now = new Date();
      const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Get invoices that are:
      // 1. Overdue (dueDate < now) OR Due soon (dueDate within 3 days)
      // 2. Status is 'sent' or 'overdue' (not paid/draft)
      // 3. Not reminded in last 24 hours (prevent daily spam)
      const invoicesToRemind = await db
        .select()
        .from(invoices)
        .where(
          and(
            lte(invoices.dueDate, threeDaysFromNow),
            sql`${invoices.status} IN ('sent', 'overdue')`,
            sql`(${invoices.lastReminderSentAt} IS NULL OR ${invoices.lastReminderSentAt} < ${yesterday})`
          )
        );

      let sentCount = 0;
      let skippedCount = 0;
      let updatedToOverdue = 0;

      for (const invoice of invoicesToRemind) {
        const [client] = await db
          .select()
          .from(clients)
          .where(eq(clients.id, invoice.clientId))
          .limit(1);

        if (!client) {
          skippedCount++;
          console.log(`Skipped invoice ${invoice.invoiceNumber}: Client not found`);
          continue;
        }

        const emailSent = await this.emailService.sendInvoiceReminder({ ...invoice, client });
        
        if (emailSent) {
          // Update last reminder timestamp
          const updates: any = { lastReminderSentAt: now };
          
          // Update status to overdue if past due date
          if (new Date(invoice.dueDate) < now && invoice.status !== "overdue") {
            updates.status = "overdue";
            updatedToOverdue++;
          }
          
          await db
            .update(invoices)
            .set(updates)
            .where(eq(invoices.id, invoice.id));
          
          sentCount++;
          console.log(`Invoice reminder sent: ${invoice.invoiceNumber}`);
        } else {
          skippedCount++;
          console.log(`Failed to send email for invoice: ${invoice.invoiceNumber}`);
        }
      }

      if (sentCount > 0 || skippedCount > 0) {
        console.log(`Invoice reminders: ${sentCount} sent, ${skippedCount} skipped, ${updatedToOverdue} marked overdue`);
      }
    } catch (error) {
      console.error("Error checking invoice reminders:", error);
    }
  }
}

export function createSchedulerService(emailService: any) {
  return new SchedulerService(emailService);
}

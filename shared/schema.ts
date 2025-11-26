import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, decimal, jsonb, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { DATE_ONLY_REGEX, parseOptionalDate, parseRequiredDate } from "./date-utils";

// Lead source options
export const LEAD_SOURCES = [
  "Facebook",
  "LinkedIn",
  "Fiverr",
  "Upwork",
  "Freelancer.com",
  "People per Hour",
  "Reference",
  "Local Market",
  "Legit",
  "Smart Lead Finder",
] as const;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("developer"),
  clientId: varchar("client_id").references(() => clients.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leads = pgTable("leads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  category: text("category"),
  status: text("status").notNull().default("new"),
  source: text("source"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  followUpDate: timestamp("follow_up_date"),
  lastFollowUpReminderAt: timestamp("last_follow_up_reminder_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const LEAD_EMAIL_TEMPLATES = [
  "service_introduction",
  "company_profile",
  "pricing_brochure",
  "follow_up_reminder",
] as const;

export const leadEmails = pgTable("lead_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leadId: varchar("lead_id").references(() => leads.id).notNull(),
  templateName: text("template_name").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("pending"),
  sentBy: varchar("sent_by").references(() => users.id).notNull(),
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  whatsapp: text("whatsapp"),
  address: text("address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("planning"),
  budget: decimal("budget", { precision: 10, scale: 2 }),
  deadline: timestamp("deadline"),
  progress: integer("progress").default(0),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  status: text("status").notNull().default("todo"),
  priority: text("priority").notNull().default("medium"),
  deadline: timestamp("deadline"),
  checklist: jsonb("checklist").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  content: text("content"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileType: text("file_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const files = pgTable("files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").references(() => projects.id),
  uploadedBy: varchar("uploaded_by").references(() => users.id).notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size"),
  fileType: text("file_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const attendance = pgTable("attendance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  date: date("date", { mode: "string" }).notNull(),
  checkIn: timestamp("check_in"),
  checkOut: timestamp("check_out"),
  status: text("status").notNull().default("pending"),
  lateDuration: integer("late_duration").default(0),
  notes: text("notes"),
}, (table) => ({
  userDateUnique: sql`UNIQUE (${table.userId}, ${table.date})`,
}));

export const income = pgTable("income", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  source: text("source").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  date: timestamp("date").defaultNow().notNull(),
  description: text("description"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull(),
  date: timestamp("date").defaultNow().notNull(),
  description: text("description"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id).notNull(),
  projectId: varchar("project_id").references(() => projects.id),
  invoiceNumber: text("invoice_number").notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status").notNull().default("draft"),
  sentDate: timestamp("sent_date"),
  lastReminderSentAt: timestamp("last_reminder_sent_at"),
  items: jsonb("items").default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => invoices.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  paymentDate: timestamp("payment_date").defaultNow().notNull(),
  paymentMethod: text("payment_method").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expenseCategories = pgTable("expense_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  type: text("type").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: varchar("resource_id"),
  details: jsonb("details"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(),
  message: text("message").notNull(),
  projectId: varchar("project_id").references(() => projects.id),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// HR & Payroll Tables
export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const designations = pgTable("designations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull().unique(),
  departmentId: varchar("department_id").references(() => departments.id),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  employeeId: text("employee_id").notNull().unique(),
  departmentId: varchar("department_id").references(() => departments.id),
  designationId: varchar("designation_id").references(() => designations.id),
  joiningDate: timestamp("joining_date").notNull(),
  dateOfBirth: timestamp("date_of_birth"),
  gender: text("gender"),
  phone: text("phone"),
  emergencyContact: text("emergency_contact"),
  address: text("address"),
  photo: text("photo"),
  documents: jsonb("documents").default([]),
  bankAccountNumber: text("bank_account_number"),
  bankName: text("bank_name"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const hrSettings = pgTable("hr_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gracePeriodMinutes: integer("grace_period_minutes").default(10),
  officeStartTime: text("office_start_time").default("09:00"),
  officeEndTime: text("office_end_time").default("18:00"),
  workingDaysPerWeek: integer("working_days_per_week").default(5),
  lateDeductionRule: integer("late_deduction_rule").default(3),
  overtimeEnabled: boolean("overtime_enabled").default(false),
  overtimeRateMultiplier: decimal("overtime_rate_multiplier", { precision: 4, scale: 2 }).default("1.50"),
  overtimeRatePerHour: decimal("overtime_rate_per_hour", { precision: 10, scale: 2 }).default("0"),
  halfDayHours: decimal("half_day_hours", { precision: 4, scale: 2 }).default("4.00"),
  halfDayCutoffTime: text("half_day_cutoff_time").default("14:00"),
  fullDayHours: decimal("full_day_hours", { precision: 4, scale: 2 }).default("8.00"),
  minimumHoursForPresent: decimal("minimum_hours_for_present", { precision: 4, scale: 2 }).default("6.00"),
  weeklyOffDays: jsonb("weekly_off_days").default(["Friday"]),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const attendanceDevices = pgTable("attendance_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  deviceType: text("device_type").notNull(),
  ipAddress: text("ip_address").notNull(),
  port: integer("port").default(80),
  apiEndpoint: text("api_endpoint"),
  apiKey: text("api_key"),
  apiUrl: text("api_url"),
  status: text("status").notNull().default("active"),
  isActive: boolean("is_active").notNull().default(true),
  lastSyncAt: timestamp("last_sync_at"),
  lastSyncError: text("last_sync_error"),
  connectionParams: jsonb("connection_params"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const deviceLogs = pgTable("device_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").references(() => attendanceDevices.id).notNull(),
  employeeId: text("employee_id").notNull(),
  punchTime: timestamp("punch_time").notNull(),
  punchType: text("punch_type").notNull(),
  deviceUserId: text("device_user_id"),
  rawData: jsonb("raw_data"),
  synced: boolean("synced").notNull().default(false),
  syncedAt: timestamp("synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leaveTypes = pgTable("leave_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  daysPerYear: integer("days_per_year").notNull(),
  carryForward: text("carry_forward").notNull().default("no"),
  requiresApproval: text("requires_approval").notNull().default("yes"),
  isPaid: text("is_paid").notNull().default("yes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leaveRequests = pgTable("leave_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").references(() => employees.id).notNull(),
  leaveTypeId: varchar("leave_type_id").references(() => leaveTypes.id).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  totalDays: decimal("total_days", { precision: 4, scale: 1 }).notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leaveBalances = pgTable("leave_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").references(() => employees.id).notNull(),
  leaveTypeId: varchar("leave_type_id").references(() => leaveTypes.id).notNull(),
  year: integer("year").notNull(),
  totalDays: decimal("total_days", { precision: 4, scale: 1 }).notNull(),
  usedDays: decimal("used_days", { precision: 4, scale: 1 }).default("0"),
  remainingDays: decimal("remaining_days", { precision: 4, scale: 1 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const punchCorrections = pgTable("punch_corrections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  attendanceId: varchar("attendance_id").references(() => attendance.id).notNull(),
  employeeId: varchar("employee_id").references(() => employees.id).notNull(),
  requestedCheckIn: timestamp("requested_check_in"),
  requestedCheckOut: timestamp("requested_check_out"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  approvedBy: varchar("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const salaryStructure = pgTable("salary_structure", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").references(() => employees.id).notNull().unique(),
  basicSalary: decimal("basic_salary", { precision: 10, scale: 2 }).notNull(),
  houseAllowance: decimal("house_allowance", { precision: 10, scale: 2 }).default("0"),
  foodAllowance: decimal("food_allowance", { precision: 10, scale: 2 }).default("0"),
  travelAllowance: decimal("travel_allowance", { precision: 10, scale: 2 }).default("0"),
  medicalAllowance: decimal("medical_allowance", { precision: 10, scale: 2 }).default("0"),
  otherAllowances: decimal("other_allowances", { precision: 10, scale: 2 }).default("0"),
  effectiveFrom: timestamp("effective_from").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const payroll = pgTable("payroll", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").references(() => employees.id).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  basicSalary: decimal("basic_salary", { precision: 10, scale: 2 }).notNull(),
  totalAllowances: decimal("total_allowances", { precision: 10, scale: 2 }).default("0"),
  overtimeAmount: decimal("overtime_amount", { precision: 10, scale: 2 }).default("0"),
  loanDeduction: decimal("loan_deduction", { precision: 10, scale: 2 }).default("0"),
  lateDeduction: decimal("late_deduction", { precision: 10, scale: 2 }).default("0"),
  otherDeductions: decimal("other_deductions", { precision: 10, scale: 2 }).default("0"),
  grossSalary: decimal("gross_salary", { precision: 10, scale: 2 }).notNull(),
  netSalary: decimal("net_salary", { precision: 10, scale: 2 }).notNull(),
  totalLateDays: integer("total_late_days").default(0),
  totalAbsentDays: integer("total_absent_days").default(0),
  totalPresentDays: integer("total_present_days").default(0),
  totalHalfDays: integer("total_half_days").default(0),
  totalOvertimeHours: decimal("total_overtime_hours", { precision: 5, scale: 2 }).default("0"),
  workingDays: integer("working_days").notNull(),
  status: text("status").notNull().default("draft"),
  generatedBy: varchar("generated_by").references(() => users.id),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const salarySlips = pgTable("salary_slips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  payrollId: varchar("payroll_id").references(() => payroll.id).notNull().unique(),
  pdfUrl: text("pdf_url"),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  emailedAt: timestamp("emailed_at"),
});

export const salaryAdjustments = pgTable("salary_adjustments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  payrollId: varchar("payroll_id").references(() => payroll.id).notNull(),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const performanceScores = pgTable("performance_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeId: varchar("employee_id").references(() => employees.id).notNull(),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  attendanceScore: decimal("attendance_score", { precision: 5, scale: 2 }).default("0"),
  taskCompletionScore: decimal("task_completion_score", { precision: 5, scale: 2 }).default("0"),
  qualityScore: decimal("quality_score", { precision: 5, scale: 2 }).default("0"),
  punctualityScore: decimal("punctuality_score", { precision: 5, scale: 2 }).default("0"),
  overallScore: decimal("overall_score", { precision: 5, scale: 2 }).default("0"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  role: true, // Role cannot be set during public registration - defaults to developer
  clientId: true, // ClientId cannot be set during public registration
});

export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
}).extend({
  followUpDate: z.preprocess(
    (val) => val === "" ? undefined : val,
    z.union([
      z.string().regex(DATE_ONLY_REGEX, "Invalid date format, use YYYY-MM-DD"),
      z.date()
    ]).optional().transform(parseOptionalDate)
  ),
  source: z.preprocess(
    (val) => val === "" ? undefined : val,
    z.enum(LEAD_SOURCES).optional()
  ),
});

export const insertLeadEmailSchema = createInsertSchema(leadEmails).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  errorMessage: true,
  status: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
}).required({
  name: true,
  email: true,
  phone: true,
  company: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
}).extend({
  deadline: z.preprocess(
    (val) => val === "" ? undefined : val,
    z.union([
      z.string().regex(DATE_ONLY_REGEX, "Invalid date format, use YYYY-MM-DD"),
      z.date()
    ]).optional().transform(parseOptionalDate)
  ),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
}).extend({
  deadline: z.preprocess(
    (val) => val === "" ? undefined : val,
    z.union([
      z.string().regex(DATE_ONLY_REGEX, "Invalid date format, use YYYY-MM-DD"),
      z.date()
    ]).optional().transform(parseOptionalDate)
  ),
  assignedTo: z.preprocess(
    (val) => val === "" ? undefined : val,
    z.string().optional()
  ),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  userId: true, // userId comes from authenticated token, not request body
  createdAt: true,
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  createdAt: true,
});

export const insertAttendanceSchema = createInsertSchema(attendance).omit({
  id: true,
});

export const insertIncomeSchema = createInsertSchema(income).omit({
  id: true,
  createdAt: true,
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
});

export const insertExpenseCategorySchema = createInsertSchema(expenseCategories).omit({
  id: true,
  createdAt: true,
});

// Invoice Item Schema - for itemized invoices
export const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().positive("Quantity must be positive"),
  rate: z.coerce.number().positive("Rate must be positive"),
  amount: z.coerce.number().positive("Amount must be positive"),
});

export type InvoiceItem = z.infer<typeof invoiceItemSchema>;

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
}).extend({
  dueDate: z.preprocess(
    (val) => val === "" ? undefined : val,
    z.union([
      z.string().regex(DATE_ONLY_REGEX, "Invalid date format, use YYYY-MM-DD").min(1, "Due date is required"),
      z.date()
    ]).transform(parseRequiredDate)
  ),
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
}).extend({
  amount: z.coerce.string().refine(val => !isNaN(Number(val)) && Number(val) > 0, {
    message: "Amount must be a positive number"
  }),
  paymentDate: z.coerce.date(),
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  isRead: true,
});

// HR & Payroll Insert Schemas
export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
});

export const insertDesignationSchema = createInsertSchema(designations).omit({
  id: true,
  createdAt: true,
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  createdAt: true,
}).extend({
  joiningDate: z.preprocess(
    (val) => val === "" ? undefined : val,
    z.union([
      z.string().regex(DATE_ONLY_REGEX, "Invalid date format, use YYYY-MM-DD"),
      z.date()
    ]).transform(parseRequiredDate)
  ),
  dateOfBirth: z.preprocess(
    (val) => val === "" ? undefined : val,
    z.union([
      z.string().regex(DATE_ONLY_REGEX, "Invalid date format, use YYYY-MM-DD"),
      z.date()
    ]).optional().transform(parseOptionalDate)
  ),
});

export const insertHrSettingsSchema = createInsertSchema(hrSettings).omit({
  id: true,
});

export const insertAttendanceDeviceSchema = createInsertSchema(attendanceDevices).omit({
  id: true,
  createdAt: true,
});

export const insertDeviceLogSchema = createInsertSchema(deviceLogs).omit({
  id: true,
  createdAt: true,
});

export const insertLeaveTypeSchema = createInsertSchema(leaveTypes).omit({
  id: true,
  createdAt: true,
});

export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({
  id: true,
  createdAt: true,
}).extend({
  startDate: z.preprocess(
    (val) => val === "" ? undefined : val,
    z.union([
      z.string().regex(DATE_ONLY_REGEX, "Invalid date format, use YYYY-MM-DD"),
      z.date()
    ]).transform(parseRequiredDate)
  ),
  endDate: z.preprocess(
    (val) => val === "" ? undefined : val,
    z.union([
      z.string().regex(DATE_ONLY_REGEX, "Invalid date format, use YYYY-MM-DD"),
      z.date()
    ]).transform(parseRequiredDate)
  ),
});

export const insertLeaveBalanceSchema = createInsertSchema(leaveBalances).omit({
  id: true,
  createdAt: true,
});

export const insertPunchCorrectionSchema = createInsertSchema(punchCorrections).omit({
  id: true,
  createdAt: true,
});

export const insertSalaryStructureSchema = createInsertSchema(salaryStructure).omit({
  id: true,
  createdAt: true,
}).extend({
  effectiveFrom: z.preprocess(
    (val) => val === "" ? undefined : val,
    z.union([
      z.string().regex(DATE_ONLY_REGEX, "Invalid date format, use YYYY-MM-DD"),
      z.date()
    ]).transform(parseRequiredDate)
  ),
});

export const insertPayrollSchema = createInsertSchema(payroll).omit({
  id: true,
  createdAt: true,
});

export const insertSalarySlipSchema = createInsertSchema(salarySlips).omit({
  id: true,
});

export const insertSalaryAdjustmentSchema = createInsertSchema(salaryAdjustments).omit({
  id: true,
  createdAt: true,
});

export const insertPerformanceScoreSchema = createInsertSchema(performanceScores).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertLead = z.infer<typeof insertLeadSchema>;
export type Lead = typeof leads.$inferSelect;

export type InsertLeadEmail = z.infer<typeof insertLeadEmailSchema>;
export type LeadEmail = typeof leadEmails.$inferSelect;

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;

export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendance.$inferSelect;

export type InsertIncome = z.infer<typeof insertIncomeSchema>;
export type Income = typeof income.$inferSelect;

export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

export type InsertExpenseCategory = z.infer<typeof insertExpenseCategorySchema>;
export type ExpenseCategory = typeof expenseCategories.$inferSelect;

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

export type InsertDesignation = z.infer<typeof insertDesignationSchema>;
export type Designation = typeof designations.$inferSelect;

export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

export type InsertHrSettings = z.infer<typeof insertHrSettingsSchema>;
export type HrSettings = typeof hrSettings.$inferSelect;

export type InsertAttendanceDevice = z.infer<typeof insertAttendanceDeviceSchema>;
export type AttendanceDevice = typeof attendanceDevices.$inferSelect;

export type InsertDeviceLog = z.infer<typeof insertDeviceLogSchema>;
export type DeviceLog = typeof deviceLogs.$inferSelect;

export type InsertLeaveType = z.infer<typeof insertLeaveTypeSchema>;
export type LeaveType = typeof leaveTypes.$inferSelect;

export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type LeaveRequest = typeof leaveRequests.$inferSelect;

export type InsertLeaveBalance = z.infer<typeof insertLeaveBalanceSchema>;
export type LeaveBalance = typeof leaveBalances.$inferSelect;

export type InsertPunchCorrection = z.infer<typeof insertPunchCorrectionSchema>;
export type PunchCorrection = typeof punchCorrections.$inferSelect;

export type InsertSalaryStructure = z.infer<typeof insertSalaryStructureSchema>;
export type SalaryStructure = typeof salaryStructure.$inferSelect;

export type InsertPayroll = z.infer<typeof insertPayrollSchema>;
export type Payroll = typeof payroll.$inferSelect;

export type InsertSalarySlip = z.infer<typeof insertSalarySlipSchema>;
export type SalarySlip = typeof salarySlips.$inferSelect;

export type InsertSalaryAdjustment = z.infer<typeof insertSalaryAdjustmentSchema>;
export type SalaryAdjustment = typeof salaryAdjustments.$inferSelect;

export type InsertPerformanceScore = z.infer<typeof insertPerformanceScoreSchema>;
export type PerformanceScore = typeof performanceScores.$inferSelect;

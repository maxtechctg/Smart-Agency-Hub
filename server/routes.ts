import type { Express } from "express";
import { createServer, type Server } from "http";
import express from "express";
import bcrypt from "bcrypt";
import { eq, desc, asc, sql, inArray, and, gte, lte, ne, isNotNull } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  leads,
  leadEmails,
  leadCategories,
  leadMessageHistory,
  clients,
  projects,
  tasks,
  messages,
  files,
  attendance,
  income,
  expenses,
  expenseCategories,
  invoices,
  payments,
  payroll,
  salaryAdjustments,
  auditLogs,
  notifications,
  employees,
  departments,
  designations,
  salaryStructure,
  deviceLogs,
  hrSettings,
  projectCredentials,
  leaveTypes,
  leaveBalances,
  leaveRequests,
  punchCorrections,
  performanceScores,
  salarySlips,
  insertUserSchema,
  insertLeadSchema,
  insertLeadEmailSchema,
  insertLeadCategorySchema,
  bulkEmailSchema,
  insertClientSchema,
  insertProjectSchema,
  insertTaskSchema,
  insertMessageSchema,
  insertFileSchema,
  insertAttendanceSchema,
  insertIncomeSchema,
  insertExpenseSchema,
  insertExpenseCategorySchema,
  insertInvoiceSchema,
  insertPaymentSchema,
  insertNotificationSchema,
  insertProjectCredentialsSchema,
  LEAD_EMAIL_TEMPLATES,
  DEFAULT_LEAD_CATEGORIES,
  HOSTING_PLATFORMS,
  leadFolders,

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
    id: true,
    createdAt: true,
    createdBy: true,
  }).extend({
    attachments: z.array(z.object({
      name: z.string(),
      url: z.string(),
      type: z.string().optional()
    })).optional().default([]),
  });
} from "@shared/schema";
import { authenticateToken, generateToken, type AuthRequest } from "./middleware/auth";
import { auditLog, auditMiddleware } from "./middleware/audit";
import { serpApiService } from "./services/serpapi";
import { wsService } from "./websocket";
import { notificationService } from "./services/notification";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import PDFDocument from "pdfkit";
import { formatCurrency, calculateLineTotal, sumAmounts } from "@shared/currency";

// Configure storage for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads");
    try {
      await fs.access(uploadDir);
    } catch {
      await fs.mkdir(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});

const upload = multer({ storage: storage });
import type { InvoiceItem } from "@shared/schema";
import {
  addReportHeader,
  addReportFooter,
  createTableHeader,
  createTableRow,
  addSummarySection,
  BRAND_COLORS,
  COMPANY_INFO
} from "./utils/reportTemplate";
import ExcelJS from "exceljs";
import { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle, ShadingType, Packer } from "docx";
import Decimal from "decimal.js-light";
import { format } from "date-fns";
import { EmailService } from "./services/email";
import {
  roles,
  insertLeadFolderSchema,
  insertEmailTemplateSchema,
} from "@shared/schema";

export const RESOURCES = [
  { id: 'leads', name: 'Leads', paths: ['/api/leads', '/api/lead-folders', '/api/lead-categories'] },
  { id: 'clients', name: 'Clients', paths: ['/api/clients'] },
  { id: 'projects', name: 'Projects & Tasks', paths: ['/api/projects', '/api/tasks', '/api/files', '/api/dashboard'] },
  { id: 'finance', name: 'Finance', paths: ['/api/income', '/api/expenses', '/api/invoices', '/api/payments'] },
  { id: 'hr', name: 'HR & Payroll', paths: ['/api/employees', '/api/attendance', '/api/departments', '/api/designations', '/api/payroll', '/api/leave', '/api/salary', '/api/performance'] },
  { id: 'templates', name: 'Email Templates', paths: ['/api/email-templates'] },
  { id: 'users', name: 'User Management', paths: ['/api/users', '/api/roles'] },
];

async function checkPermission(userRole: string, path: string): Promise<boolean> {
  // 1. System Roles
  if (userRole === 'admin') return true;
  if (userRole === 'client') {
    // Clients have limited access, handled by specific route logic usually
    return path.startsWith('/api/dashboard') || path.startsWith('/api/projects'); // Basic assumption
  }
  if (userRole === 'developer') {
    return path.startsWith('/api/dashboard') || path.startsWith('/api/tasks') || path.startsWith('/api/projects') || path.startsWith('/api/files') || path.startsWith('/api/users');
  }
  if (userRole === 'operational_head') {
    // Legacy Operational Head access
    return !path.startsWith('/api/users') || path === '/api/users'; // Can view users but maybe not full management?
    // Actually operational_head had broad access in legacy code:
    // leads, clients, projects, income, expenses, attendance (HR), templates
    // Basically generic "Manager"
    return true;
  }

  // 2. Dynamic Roles
  // Check if role exists in DB
  // optimization: we assume userRole is the role NAME or ID. 
  // The user schema stores 'role' as text. 
  // If it's not a reserved system role, we look it up.

  const [role] = await db.select().from(roles).where(eq(roles.name, userRole)).limit(1);
  if (!role) return false;

  const permissions = role.permissions as string[]; // Array of allowed resource IDs or paths
  if (!permissions) return false;

  // Check if current path matches any allowed path
  // We matched permissions to RESOURCE IDs in the frontend selection, 
  // so 'permissions' array likely contains ['leads', 'projects'].
  // or it could contain raw paths. 
  // Let's assume it contains Resource IDs for simplicity in management.

  // Find which resource this path belongs to
  const resource = RESOURCES.find(r => r.paths.some(p => path.startsWith(p)));
  if (!resource) return true; // Public or unlisted resource? Default allow or deny? 
  // If we don't track it, maybe strictly deny? 
  // For safety, let's say if it's NOT in RESOURCES, it's either public or specialized.
  // But authenticatedToken blocks mostly.

  return permissions.includes(resource.id);
}

const upload = multer({ dest: "uploads/" });

export async function registerRoutes(app: Express, emailService: any): Promise<Server> {
  app.use(express.json());

  // Auth routes - NO PUBLIC REGISTRATION
  // All user accounts (including clients) must be created by admin via Team page

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      console.log(`[LOGIN ATTEMPT] Email: ${email}, Password provided: ${password ? "YES" : "NO"}`);

      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user) {
        console.log(`[LOGIN FAILED] User not found for email: ${email}`);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      console.log(`[LOGIN USER FOUND] User ID: ${user.id}, Role: ${user.role}, Hash starts: ${user.password.substring(0, 5)}`);

      const validPassword = await bcrypt.compare(password, user.password);
      console.log(`[LOGIN PASSWORD CHECK] Valid: ${validPassword}`);

      if (!validPassword) {
        console.log(`[LOGIN FAILED] Invalid password for user: ${email}`);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: "Account is deactivated. Please contact administrator." });
      }

      await auditLog(user.id, "login", "user", user.id);

      const token = generateToken(user.id, user.role);
      res.json({ user: { ...user, password: undefined }, token });
    } catch (error: any) {
      console.error(`[LOGIN ERROR]`, error);
      res.status(400).json({ error: error.message });
    }
  });

  // Dashboard stats
  // Dynamic Role Management
  app.get("/api/resources", authenticateToken, (req, res) => {
    res.json(RESOURCES);
  });

  app.get("/api/roles", authenticateToken, async (req, res) => {
    try {
      const allRoles = await db.select().from(roles);
      res.json(allRoles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/roles", authenticateToken, auditMiddleware("create", "role"), async (req: AuthRequest, res) => {
    try {
      // Only admin defaults can create roles? Or any "User Manager"?
      // For now restrict to admin
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Access denied" });
      }

      const { name, permissions, description } = req.body;
      // Basic validation
      if (!name) return res.status(400).json({ error: "Role name is required" });

      const [role] = await db.insert(roles).values({
        name,
        permissions: permissions || [],
        description,
      }).returning();

      res.json(role);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/roles/:id", authenticateToken, auditMiddleware("delete", "role"), async (req: AuthRequest, res) => {
    try {
      if (req.userRole !== "admin") return res.status(403).json({ error: "Access denied" });

      await db.delete(roles).where(eq(roles.id, req.params.id));
      res.json({ message: "Role deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Middleware helper for dynamic permission check could be applied globally or per route.
  // customizing specific routes below...

  app.get("/api/dashboard/stats", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const hasPermission = await checkPermission(req.userRole!, req.path);
      if (!hasPermission) return res.status(403).json({ error: "Access denied by role permission" });

      if (req.userRole === "client") {
        // Client-specific stats
        const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
        if (!user?.clientId) {
          return res.status(403).json({ error: "No client associated with this account" });
        }

        const clientProjects = await db.select().from(projects).where(eq(projects.clientId, user.clientId));
        const activeProjects = clientProjects.filter(p => p.status === "active");
        const completedProjects = clientProjects.filter(p => p.status === "completed");

        const clientInvoices = await db.select().from(invoices).where(eq(invoices.clientId, user.clientId));
        const totalSpent = clientInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
        const paidInvoices = clientInvoices.filter(inv => inv.status === "paid");
        const pendingAmount = clientInvoices
          .filter(inv => inv.status !== "paid")
          .reduce((sum, inv) => sum + Number(inv.amount), 0);

        return res.json({
          totalProjects: clientProjects.length,
          activeProjects: activeProjects.length,
          completedProjects: completedProjects.length,
          totalInvoices: clientInvoices.length,
          totalSpent,
          pendingAmount,
          paidInvoices: paidInvoices.length,
        });
      }

      if (req.userRole === "developer") {
        // Developer-specific stats (only allowed resources)
        const allProjects = await db.select().from(projects);
        const activeProjects = allProjects.filter(p => p.status === "active");
        const allTasks = await db.select().from(tasks);
        const myTasks = allTasks.filter(t => t.assignedTo === req.userId);
        const myAttendance = await db.select().from(attendance).where(eq(attendance.userId, req.userId!));
        const allFiles = await db.select().from(files);

        const attendanceRate = myAttendance.length > 0
          ? (myAttendance.filter(a => a.status !== "absent").length / myAttendance.length) * 100
          : 0;

        return res.json({
          totalProjects: allProjects.length,
          activeProjects: activeProjects.length,
          totalTasks: allTasks.length,
          myTasks: myTasks.length,
          completedTasks: myTasks.filter(t => t.status === "done").length,
          totalFiles: allFiles.length,
          attendanceRate: Math.round(attendanceRate),
        });
      }

      // Admin/Operational Head dashboard stats
      const allLeads = await db.select().from(leads);
      const allClients = await db.select().from(clients);
      const allProjects = await db.select().from(projects).where(eq(projects.status, "active"));
      const allIncome = await db.select().from(income);
      const allExpenses = await db.select().from(expenses);
      const allAttendance = await db.select().from(attendance);

      const monthlyRevenue = allIncome.reduce((sum, i) => sum + Number(i.amount), 0);
      const monthlyExpenses = allExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const attendanceRate = allAttendance.length > 0
        ? (allAttendance.filter(a => a.status !== "absent").length / allAttendance.length) * 100
        : 0;

      res.json({
        totalLeads: allLeads.length,
        totalClients: allClients.length,
        activeProjects: allProjects.length,
        monthlyRevenue,
        monthlyExpenses,
        attendanceRate: Math.round(attendanceRate),
        leadsGrowth: 0,
        revenueGrowth: 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Dashboard Recent Activity
  app.get("/api/dashboard/recent-activity", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (req.userRole === "developer") {
        // Developer: recent tasks, files
        const recentTasks = await db.select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          createdAt: tasks.createdAt,
        })
          .from(tasks)
          .where(eq(tasks.assignedTo, req.userId!))
          .orderBy(desc(tasks.createdAt))
          .limit(5);

        const recentFiles = await db.select({
          id: files.id,
          name: files.fileName,
          createdAt: files.createdAt,
        })
          .from(files)
          .where(eq(files.uploadedBy, req.userId!))
          .orderBy(desc(files.createdAt))
          .limit(5);

        return res.json({
          tasks: recentTasks,
          files: recentFiles,
        });
      }

      // Admin/Operational Head: recent leads, projects, invoices
      const recentLeads = await db.select({
        id: leads.id,
        name: leads.name,
        createdAt: leads.createdAt,
      })
        .from(leads)
        .orderBy(desc(leads.createdAt))
        .limit(3);

      const recentProjects = await db.select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        createdAt: projects.createdAt,
      })
        .from(projects)
        .orderBy(desc(projects.createdAt))
        .limit(3);

      const recentInvoices = await db.select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        amount: invoices.amount,
        createdAt: invoices.createdAt,
      })
        .from(invoices)
        .orderBy(desc(invoices.createdAt))
        .limit(3);

      res.json({
        leads: recentLeads,
        projects: recentProjects,
        invoices: recentInvoices,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Dashboard Upcoming Deadlines
  app.get("/api/dashboard/upcoming-deadlines", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const now = new Date();

      if (req.userRole === "developer") {
        // Developer: upcoming tasks assigned to them
        const upcomingTasks = await db.select({
          id: tasks.id,
          title: tasks.title,
          dueDate: tasks.deadline,
          priority: tasks.priority,
          status: tasks.status,
        })
          .from(tasks)
          .where(
            and(
              eq(tasks.assignedTo, req.userId!),
              sql`${tasks.deadline} IS NOT NULL`,
              sql`${tasks.deadline} >= ${now.toISOString()}`,
              ne(tasks.status, "done")
            )
          )
          .orderBy(asc(tasks.deadline))
          .limit(5);

        return res.json({ tasks: upcomingTasks });
      }

      // Admin/Operational Head: upcoming project and task deadlines
      const upcomingProjects = await db.select({
        id: projects.id,
        name: projects.name,
        endDate: projects.deadline,
        status: projects.status,
      })
        .from(projects)
        .where(
          and(
            sql`${projects.deadline} IS NOT NULL`,
            sql`${projects.deadline} >= ${now.toISOString()}`,
            ne(projects.status, "completed")
          )
        )
        .orderBy(asc(projects.deadline))
        .limit(5);

      const upcomingTasks = await db.select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.deadline,
        priority: tasks.priority,
        status: tasks.status,
      })
        .from(tasks)
        .where(
          and(
            sql`${tasks.deadline} IS NOT NULL`,
            sql`${tasks.deadline} >= ${now.toISOString()}`,
            ne(tasks.status, "done")
          )
        )
        .orderBy(asc(tasks.deadline))
        .limit(5);

      res.json({
        projects: upcomingProjects,
        tasks: upcomingTasks,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Users
  app.get("/api/users", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Client and developer role users can only see their own record
      const hasPermission = await checkPermission(req.userRole!, req.path);
      if (!hasPermission) return res.status(403).json({ error: "Access denied" });

      if (req.userRole === "client" || req.userRole === "developer") {
        const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
        if (!user) {
          return res.status(404).json({ error: "User not found" });
        }
        return res.json([{ ...user, password: undefined }]);
      }

      // Only admin and operational_head can see all users
      // Check permission for "users" resource is already done above. 
      // If we are here, we have permission.
      const allUsers = await db.select().from(users);
      res.json(allUsers.map(u => ({ ...u, password: undefined })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin-only: Create any user with specified role
  app.post("/api/users", authenticateToken, auditMiddleware("create", "user"), async (req: AuthRequest, res) => {
    try {
      // Only admins can create users
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { fullName, email, password, role, clientId } = req.body;

      if (!fullName || !email || !password || !role) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Validate role
      const systemRoles = ["admin", "operational_head", "developer", "client"];
      if (!systemRoles.includes(role)) {
        // Check if it's a valid custom role
        const [customRole] = await db.select().from(roles).where(eq(roles.name, role)).limit(1);
        if (!customRole) {
          return res.status(400).json({ error: "Invalid role" });
        }
      }

      // If role is client, clientId is required
      if (role === "client" && !clientId) {
        return res.status(400).json({ error: "clientId is required for client role" });
      }

      // Check if email already exists
      const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingUser.length > 0) {
        return res.status(400).json({ error: "Email already registered" });
      }

      // If clientId provided, verify client exists
      if (clientId) {
        const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
        if (!client) {
          return res.status(400).json({ error: "Client not found" });
        }
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [user] = await db.insert(users).values({
        fullName,
        email,
        password: hashedPassword,
        role,
        clientId: role === "client" ? clientId : null,
      }).returning();

      res.json({ ...user, password: undefined });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Legacy: Admin-only create client user endpoint (kept for backward compatibility)
  app.post("/api/users/client", authenticateToken, auditMiddleware("create", "client_user"), async (req: AuthRequest, res) => {
    try {
      // Only admins can create client users
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { fullName, email, password, clientId } = req.body;

      if (!fullName || !email || !password || !clientId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Check if email already exists
      const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingUser.length > 0) {
        return res.status(400).json({ error: "Email already registered" });
      }

      // Verify client exists
      const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
      if (!client) {
        return res.status(400).json({ error: "Client not found" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const [user] = await db.insert(users).values({
        fullName,
        email,
        password: hashedPassword,
        role: "client",
        clientId,
      }).returning();

      res.json({ ...user, password: undefined });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Update user
  app.patch("/api/users/:id", authenticateToken, auditMiddleware("update", "user"), async (req: AuthRequest, res) => {
    try {
      // Only admin can update users
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      const { fullName, email, role, clientId, password } = req.body;
      const updateData: any = {};

      if (fullName !== undefined) updateData.fullName = fullName;
      if (email !== undefined) updateData.email = email;
      if (role !== undefined) updateData.role = role;
      if (clientId !== undefined) updateData.clientId = clientId;
      if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive;
      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      const [user] = await db.update(users)
        .set(updateData)
        .where(eq(users.id, req.params.id))
        .returning();

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ ...user, password: undefined });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Delete user
  app.delete("/api/users/:id", authenticateToken, auditMiddleware("delete", "user"), async (req: AuthRequest, res) => {
    try {
      // Only admin can delete users
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Admin access required" });
      }

      // Prevent deleting yourself
      if (req.params.id === req.userId) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      // Manually handle FK constraints by setting references to null
      // 1. Audit Logs
      await db.update(auditLogs).set({ userId: null }).where(eq(auditLogs.userId, req.params.id));

      // 2. Tasks (assigned to)
      await db.update(tasks).set({ assignedTo: null }).where(eq(tasks.assignedTo, req.params.id));

      // 3. Leads (assigned to)
      await db.update(leads).set({ assignedTo: null }).where(eq(leads.assignedTo, req.params.id));

      // 4. Projects (created by)
      await db.update(projects).set({ createdBy: null }).where(eq(projects.createdBy, req.params.id));

      // 5. Email Templates (created by) - if we want to keep templates
      await db.update(emailTemplates).set({ createdBy: null }).where(eq(emailTemplates.createdBy, req.params.id));

      // 6. Delete strictly related records (Cascading Delete)
      await db.delete(attendance).where(eq(attendance.userId, req.params.id));
      await db.delete(notifications).where(eq(notifications.userId, req.params.id));

      // Delete messages and files (User is owner)
      await db.delete(messages).where(eq(messages.userId, req.params.id));
      await db.delete(files).where(eq(files.uploadedBy, req.params.id));

      // Handle Employee Record Deletion (if exists)
      const [employee] = await db.select().from(employees).where(eq(employees.userId, req.params.id)).limit(1);

      if (employee) {
        // Delete employee related records first to avoid param violations
        await db.delete(leaveRequests).where(eq(leaveRequests.employeeId, employee.id));
        await db.delete(leaveBalances).where(eq(leaveBalances.employeeId, employee.id));
        await db.delete(punchCorrections).where(eq(punchCorrections.employeeId, employee.id));
        await db.delete(performanceScores).where(eq(performanceScores.employeeId, employee.id));

        // Handle Payroll and Salary Structure
        const payrollRecords = await db.select().from(payroll).where(eq(payroll.employeeId, employee.id));
        for (const p of payrollRecords) {
          await db.delete(salarySlips).where(eq(salarySlips.payrollId, p.id));
          await db.delete(salaryAdjustments).where(eq(salaryAdjustments.payrollId, p.id));
        }
        await db.delete(payroll).where(eq(payroll.employeeId, employee.id));

        await db.delete(salaryStructure).where(eq(salaryStructure.employeeId, employee.id));
        // Note: deviceLogs employeeId is text, not FK, but good to clean up if matched
        await db.delete(deviceLogs).where(eq(deviceLogs.employeeId, employee.employeeId));

        // Finally delete employee
        await db.delete(employees).where(eq(employees.id, employee.id));
      }

      const [user] = await db.delete(users)
        .where(eq(users.id, req.params.id))
        .returning();

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ message: "User deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Leads
  app.get("/api/leads", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can access leads
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { search, status, source, category } = req.query;

      // Build dynamic where conditions
      const conditions = [];

      if (search && typeof search === "string") {
        conditions.push(sql`LOWER(${leads.name}) LIKE LOWER(${'%' + search + '%'})`);
      }

      if (status && typeof status === "string") {
        conditions.push(eq(leads.status, status));
      }

      if (source && typeof source === "string") {
        conditions.push(eq(leads.source, source));
      }

      if (category && typeof category === "string") {
        conditions.push(eq(leads.category, category));
      }

      const userId = req.userId;
      const { folderId } = req.query;

      if (folderId && typeof folderId === "string") {
        if (folderId === "uncategorized") {
          conditions.push(sql`${leads.folderId} IS NULL`);
        } else {
          conditions.push(eq(leads.folderId, folderId));
        }
      }

      // Apply filters if any, otherwise get all leads
      const allLeads = conditions.length > 0
        ? await db.select().from(leads).where(and(...conditions)).orderBy(desc(leads.createdAt))
        : await db.select().from(leads).orderBy(desc(leads.createdAt));

      res.json(allLeads);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Email templates
  app.get("/api/email-templates", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can access templates
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const templates = await db.select().from(emailTemplates).orderBy(desc(emailTemplates.createdAt));
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/email-templates", authenticateToken, auditMiddleware("create", "email_template"), async (req: AuthRequest, res) => {
    try {
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const data = insertEmailTemplateSchema.parse(req.body);
      const [template] = await db.insert(emailTemplates).values({
        ...data,
        createdBy: req.userId,
      }).returning();

      res.json(template);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/email-templates/:id", authenticateToken, auditMiddleware("update", "email_template"), async (req: AuthRequest, res) => {
    try {
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { name, subject, message } = req.body;
      const updateData: any = {};
      if (name) updateData.name = name;
      if (subject) updateData.subject = subject;
      if (message) updateData.message = message;

      const [template] = await db.update(emailTemplates)
        .set(updateData)
        .where(eq(emailTemplates.id, req.params.id))
        .returning();

      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      res.json(template);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/email-templates/:id", authenticateToken, auditMiddleware("delete", "email_template"), async (req: AuthRequest, res) => {
    try {
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const [template] = await db.delete(emailTemplates)
        .where(eq(emailTemplates.id, req.params.id))
        .returning();

      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      res.json({ message: "Template deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/leads", authenticateToken, auditMiddleware("create", "lead"), async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can create leads
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const data = insertLeadSchema.parse(req.body);

      // Check for duplicate email
      if (data.email) {
        const existingByEmail = await db.select().from(leads).where(eq(leads.email, data.email)).limit(1);
        if (existingByEmail.length > 0) {
          return res.status(400).json({ error: `Lead with email "${data.email}" already exists` });
        }
      }

      // Check for duplicate phone
      if (data.phone) {
        const existingByPhone = await db.select().from(leads).where(eq(leads.phone, data.phone)).limit(1);
        if (existingByPhone.length > 0) {
          return res.status(400).json({ error: `Lead with phone number "${data.phone}" already exists` });
        }
      }

      const [lead] = await db.insert(leads).values(data).returning();
      res.json(lead);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Bulk upload leads from CSV/Excel
  app.post("/api/leads/bulk-upload", authenticateToken, upload.single("file"), async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can bulk upload leads
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const filePath = req.file.path;
      const originalName = req.file.originalname.toLowerCase();

      let parsedRows: any[] = [];

      // Parse based on file type
      if (originalName.endsWith(".csv")) {
        // CSV parsing
        const { parse } = await import("csv-parse/sync");
        const fs = await import("fs");
        const fileContent = fs.readFileSync(filePath, "utf-8");
        parsedRows = parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
      } else if (originalName.endsWith(".xlsx") || originalName.endsWith(".xls")) {
        // Excel parsing
        const ExcelJS = await import("exceljs");
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
          return res.status(400).json({ error: "No worksheet found in Excel file" });
        }

        const headers: string[] = [];
        worksheet.getRow(1).eachCell((cell, colNumber) => {
          headers[colNumber - 1] = String(cell.value || "").trim().toLowerCase();
        });

        worksheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // Skip header
          const rowData: any = {};
          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber - 1];
            if (header) {
              let value = cell.value;
              // Handle date objects
              if (value instanceof Date) {
                value = value.toISOString().split("T")[0];
              }
              rowData[header] = value;
            }
          });
          if (Object.keys(rowData).length > 0) {
            parsedRows.push(rowData);
          }
        });
      } else {
        // Clean up uploaded file
        const fs = await import("fs");
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: "Unsupported file format. Please upload CSV or Excel (.xlsx) file" });
      }

      // Clean up uploaded file
      const fs = await import("fs");
      fs.unlinkSync(filePath);

      if (parsedRows.length === 0) {
        return res.status(400).json({ error: "No data found in file" });
      }

      // Valid statuses and sources
      const validStatuses = ["new", "contacted", "qualified", "converted"];
      const validSources = ["Facebook", "LinkedIn", "Fiverr", "Upwork", "Freelancer.com", "People per Hour", "Reference", "Local Market", "Legit"];

      const results = {
        success: 0,
        failed: 0,
        errors: [] as { row: number; name: string; error: string }[],
      };

      // Process each row
      for (let i = 0; i < parsedRows.length; i++) {
        const row = parsedRows[i];
        const rowNum = i + 2; // +2 because of 0-index and header row

        try {
          // Normalize column names (case-insensitive)
          const normalizedRow: any = {};
          for (const key of Object.keys(row)) {
            normalizedRow[key.toLowerCase().trim()] = row[key];
          }

          // Extract and validate fields
          const name = String(normalizedRow.name || "").trim();
          const email = String(normalizedRow.email || "").trim();
          const phone = String(normalizedRow.phone || "").trim();
          const status = String(normalizedRow.status || "new").trim().toLowerCase();
          const source = String(normalizedRow.source || "").trim();
          const notes = String(normalizedRow.notes || "").trim();
          let followUpDate = normalizedRow.followupdate || normalizedRow["follow_up_date"] || normalizedRow["followup_date"] || normalizedRow.follow_up_date || "";

          // Convert followUpDate to string if it's an object
          if (followUpDate && typeof followUpDate === "object" && followUpDate instanceof Date) {
            followUpDate = followUpDate.toISOString().split("T")[0];
          } else if (followUpDate) {
            followUpDate = String(followUpDate).trim();
          }

          // Validation
          if (!name) {
            results.failed++;
            results.errors.push({ row: rowNum, name: name || "(empty)", error: "Name is required" });
            continue;
          }
          if (!email) {
            results.failed++;
            results.errors.push({ row: rowNum, name, error: "Email is required" });
            continue;
          }
          // Basic email validation
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            results.failed++;
            results.errors.push({ row: rowNum, name, error: "Invalid email format" });
            continue;
          }
          if (!validStatuses.includes(status)) {
            results.failed++;
            results.errors.push({ row: rowNum, name, error: `Invalid status "${status}". Valid: ${validStatuses.join(", ")}` });
            continue;
          }
          if (source && !validSources.some(s => s.toLowerCase() === source.toLowerCase())) {
            results.failed++;
            results.errors.push({ row: rowNum, name, error: `Invalid source "${source}". Valid: ${validSources.join(", ")}` });
            continue;
          }

          // Check for duplicate email
          const existingByEmail = await db.select().from(leads).where(eq(leads.email, email)).limit(1);
          if (existingByEmail.length > 0) {
            results.failed++;
            results.errors.push({ row: rowNum, name, error: `Lead with email "${email}" already exists` });
            continue;
          }

          // Check for duplicate phone (if provided)
          if (phone) {
            const existingByPhone = await db.select().from(leads).where(eq(leads.phone, phone)).limit(1);
            if (existingByPhone.length > 0) {
              results.failed++;
              results.errors.push({ row: rowNum, name, error: `Lead with phone "${phone}" already exists` });
              continue;
            }
          }

          // Find matching source (case-insensitive)
          const matchedSource = validSources.find(s => s.toLowerCase() === source.toLowerCase()) || null;

          // Prepare lead data
          const leadData: any = {
            name,
            email,
            phone: phone || null,
            status,
            source: matchedSource,
            notes: notes || null,
          };

          // Handle follow-up date
          if (followUpDate) {
            // Parse date in YYYY-MM-DD format
            const dateMatch = String(followUpDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (dateMatch) {
              leadData.followUpDate = new Date(followUpDate);
            }
          }

          // Insert lead
          await db.insert(leads).values(leadData);
          results.success++;
        } catch (err: any) {
          results.failed++;
          results.errors.push({ row: rowNum, name: row.name || "(unknown)", error: err.message || "Unknown error" });
        }
      }

      res.json({
        message: `Imported ${results.success} lead(s) successfully${results.failed > 0 ? `, ${results.failed} failed` : ""}`,
        success: results.success,
        failed: results.failed,
        errors: results.errors,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to process file" });
    }
  });

  // Smart Lead Finder - Search for businesses using SerpAPI
  app.post("/api/leads/smart-finder/search", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can use smart lead finder
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { keyword, location, page = 1, perPage = 40, previousTotal = 0 } = req.body;

      if (!keyword || typeof keyword !== "string" || keyword.trim().length < 2) {
        return res.status(400).json({ error: "Please provide a valid search keyword (at least 2 characters)" });
      }

      if (!serpApiService.isConfigured()) {
        return res.status(500).json({ error: "Smart Lead Finder is not configured. Please add SERPAPI_KEY to your secrets." });
      }

      // Search for businesses with pagination
      const searchResults = await serpApiService.searchBusinesses({
        keyword: keyword.trim(),
        location: location?.trim(),
        page: Number(page),
        perPage: Number(perPage),
        previousTotal: Number(previousTotal) || 0,
      });

      res.json({
        keyword: keyword.trim(),
        location: location?.trim() || null,
        ...searchResults,
      });
    } catch (error: any) {
      console.error("Smart Lead Finder error:", error.message);
      res.status(500).json({ error: error.message || "Failed to search for businesses" });
    }
  });

  // Smart Lead Finder - Search ALL results at once (for Select All functionality)
  app.post("/api/leads/smart-finder/search-all", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can use smart lead finder
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { keyword, location } = req.body;

      if (!keyword || typeof keyword !== "string" || keyword.trim().length < 2) {
        return res.status(400).json({ error: "Please provide a valid search keyword (at least 2 characters)" });
      }

      if (!location || typeof location !== "string" || location.trim().length < 2) {
        return res.status(400).json({ error: "Please provide a location for business search" });
      }

      if (!serpApiService.isConfigured()) {
        return res.status(500).json({ error: "Smart Lead Finder is not configured. Please add SERPAPI_KEY to your secrets." });
      }

      // Fetch ALL results at once
      const searchResults = await serpApiService.searchAllBusinesses({
        keyword: keyword.trim(),
        location: location.trim(),
      });

      res.json({
        keyword: keyword.trim(),
        location: location.trim(),
        results: searchResults.results,
        totalResults: searchResults.totalResults,
      });
    } catch (error: any) {
      console.error("Smart Lead Finder search-all error:", error.message);
      res.status(500).json({ error: error.message || "Failed to search for businesses" });
    }
  });

  // Smart Lead Finder - Bulk import selected leads
  app.post("/api/leads/smart-finder/import", authenticateToken, auditMiddleware("create", "lead"), async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can import leads
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { selectedLeads, defaultCategory, defaultSource } = req.body;

      if (!Array.isArray(selectedLeads) || selectedLeads.length === 0) {
        return res.status(400).json({ error: "Please select at least one lead to import" });
      }

      const results = {
        success: 0,
        failed: 0,
        skipped: 0,
        errors: [] as { name: string; error: string }[],
        duplicates: [] as { name: string; reason: string }[],
        imported: [] as any[],
      };

      for (const lead of selectedLeads) {
        try {
          const name = String(lead.name || "").trim();
          const email = lead.email ? String(lead.email).trim() : null;
          const phone = lead.phone ? String(lead.phone).trim() : null;
          const website = lead.website ? String(lead.website).trim() : null;
          // User's selected category takes priority, but fall back to API's category if user didn't select one
          // Using nullish coalescing (??) to preserve API data when user leaves selector blank
          const category = (defaultCategory && defaultCategory.trim())
            ? String(defaultCategory).trim()
            : (lead.category ? String(lead.category).trim() : null);

          // Validation: name is required
          if (!name) {
            results.failed++;
            results.errors.push({ name: "(empty)", error: "Name is required" });
            continue;
          }

          // Validation: at least one contact method (email, phone, or website)
          if (!email && !phone && !website) {
            results.failed++;
            results.errors.push({ name, error: "At least one contact method (email, phone, or website) is required" });
            continue;
          }

          // Validate email format if provided
          if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            results.failed++;
            results.errors.push({ name, error: "Invalid email format" });
            continue;
          }

          // Check for duplicates by email, website, OR business name
          let isDuplicate = false;
          let duplicateReason = "";

          // 1. Check by email
          if (email) {
            const existingByEmail = await db.select().from(leads).where(eq(leads.email, email)).limit(1);
            if (existingByEmail.length > 0) {
              isDuplicate = true;
              duplicateReason = `Email "${email}" already exists`;
            }
          }

          // 2. Check by website
          if (!isDuplicate && website) {
            const existingByWebsite = await db.select().from(leads).where(eq(leads.website, website)).limit(1);
            if (existingByWebsite.length > 0) {
              isDuplicate = true;
              duplicateReason = `Website "${website}" already exists`;
            }
          }

          // 3. Check by business name (normalized: lowercase, trim, remove common punctuation)
          if (!isDuplicate && name) {
            // Normalize the name: lowercase, trim, remove periods and common suffixes
            const normalizedName = name.toLowerCase().trim()
              .replace(/[.,\-]/g, '')
              .replace(/\s+/g, ' ')
              .replace(/\s*(ltd|llc|inc|corp|co|company|limited|pvt|private)\.?\s*$/i, '');

            const existingByName = await db.select().from(leads).where(
              sql`LOWER(REGEXP_REPLACE(REGEXP_REPLACE(${leads.name}, '[.,\-]', '', 'g'), '\s*(ltd|llc|inc|corp|co|company|limited|pvt|private)\.?\s*$', '', 'i')) = ${normalizedName}`
            ).limit(1);
            if (existingByName.length > 0) {
              isDuplicate = true;
              duplicateReason = `Business name "${name}" already exists (similar to "${existingByName[0].name}")`;
            }
          }

          if (isDuplicate) {
            results.skipped++;
            results.duplicates.push({ name, reason: duplicateReason });
            continue;
          }

          // Build notes with additional info
          const notesArr: string[] = [];
          if (lead.address) notesArr.push(`Address: ${lead.address}`);
          if (lead.rating) notesArr.push(`Rating: ${lead.rating}/5`);
          if (lead.reviews) notesArr.push(`Reviews: ${lead.reviews}`);
          if (lead.source && lead.source !== "Smart Lead Finder") notesArr.push(`Found via: ${lead.source}`);

          // Set follow-up date to 7 days from now
          const followUpDate = new Date();
          followUpDate.setDate(followUpDate.getDate() + 7);

          // Insert lead with user-selected source or default
          const source = defaultSource
            ? String(defaultSource).trim()
            : "Smart Lead Finder";

          const [newLead] = await db.insert(leads).values({
            name,
            email,
            phone,
            website,
            category,
            status: "new",
            source,
            notes: notesArr.length > 0 ? notesArr.join("\n") : null,
            followUpDate,
          }).returning();

          results.success++;
          results.imported.push(newLead);
        } catch (err: any) {
          results.failed++;
          results.errors.push({ name: lead.name || "(unknown)", error: err.message || "Unknown error" });
        }
      }

      const message = [
        `Imported ${results.success} lead(s) successfully`,
        results.skipped > 0 ? `${results.skipped} skipped (duplicates)` : "",
        results.failed > 0 ? `${results.failed} failed` : ""
      ].filter(Boolean).join(", ");

      res.json({
        message,
        success: results.success,
        skipped: results.skipped,
        failed: results.failed,
        errors: results.errors,
        duplicates: results.duplicates,
        imported: results.imported,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to import leads" });
    }
  });

  // Lead Categories
  app.get("/api/lead-categories", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can access lead categories
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const categories = await db.select().from(leadCategories).orderBy(asc(leadCategories.name));
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/lead-categories", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin can create categories
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Access denied" });
      }

      const data = insertLeadCategorySchema.parse(req.body);
      const [category] = await db.insert(leadCategories).values(data).returning();
      res.json(category);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/lead-categories/seed", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin can seed categories
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check if any categories exist
      const existing = await db.select().from(leadCategories).limit(1);
      if (existing.length > 0) {
        return res.status(400).json({ error: "Categories already exist. Use the add category feature instead." });
      }

      // Seed default categories
      const categories = [];
      for (const name of DEFAULT_LEAD_CATEGORIES) {
        const [category] = await db.insert(leadCategories).values({
          name,
          isActive: true,
        }).returning();
        categories.push(category);
      }

      res.json({ message: `Created ${categories.length} default categories`, categories });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/lead-categories/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin can update categories
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Access denied" });
      }

      const data = insertLeadCategorySchema.partial().parse(req.body);
      const [category] = await db.update(leadCategories).set(data).where(eq(leadCategories.id, req.params.id)).returning();
      res.json(category);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/lead-categories/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin can delete categories
      if (req.userRole !== "admin") {
        return res.status(403).json({ error: "Access denied" });
      }

      await db.delete(leadCategories).where(eq(leadCategories.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Lead Folders
  app.get("/api/lead-folders", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const folders = await db.select().from(leadFolders).orderBy(asc(leadFolders.createdAt));
      res.json(folders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/lead-folders", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const data = insertLeadFolderSchema.parse(req.body);
      const [folder] = await db.insert(leadFolders).values(data).returning();
      res.json(folder);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/lead-folders/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const data = insertLeadFolderSchema.partial().parse(req.body);
      const [folder] = await db.update(leadFolders).set(data).where(eq(leadFolders.id, req.params.id)).returning();
      res.json(folder);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/lead-folders/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Check if folder has leads? Maybe handle in frontend or Cascade if DB configured?
      // For now, allow delete.
      await db.delete(leadFolders).where(eq(leadFolders.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Email Templates
  app.get("/api/email-templates", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const templates = await db.select().from(emailTemplates).orderBy(desc(emailTemplates.createdAt));
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/email-templates", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const data = insertEmailTemplateSchema.parse({ ...req.body, createdBy: req.userId });
      const [template] = await db.insert(emailTemplates).values(data).returning();
      res.json(template);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/email-templates/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const data = insertEmailTemplateSchema.partial().parse(req.body);
      const [template] = await db.update(emailTemplates).set(data).where(eq(emailTemplates.id, req.params.id)).returning();
      res.json(template);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/email-templates/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      await db.delete(emailTemplates).where(eq(emailTemplates.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk Email to Leads
  app.post("/api/leads/bulk-email", authenticateToken, auditMiddleware("create", "lead_email"), async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can send bulk emails
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { leadIds, subject, message, attachments } = bulkEmailSchema.parse(req.body);

      // Get leads with email addresses
      const leadsToEmail = await db.select().from(leads).where(inArray(leads.id, leadIds));

      const results = {
        success: 0,
        failed: 0,
        skipped: 0,
        errors: [] as { name: string; error: string }[],
        sent: [] as { leadId: string; name: string; email: string }[],
      };

      for (const lead of leadsToEmail) {
        try {
          if (!lead.email) {
            results.skipped++;
            results.errors.push({ name: lead.name, error: "No email address" });
            continue;
          }

          // Send email
          const html = `<div style="font-family: Arial, sans-serif; line-height: 1.6;">
              ${message.split('\n').map(line => `<p>${line}</p>`).join('')}
              <hr style="border: 1px solid #eee; margin-top: 30px;">
              <p style="color: #666; font-size: 12px;">This email was sent by MaxTech BD</p>
            </div>`;
          const emailResult = await emailService.sendEmail(lead.email, subject, html, attachments || []);

          if (emailResult.success) {
            // Save to message history
            await db.insert(leadMessageHistory).values({
              leadId: lead.id,
              subject,
              message,
              status: "sent",
              sentBy: req.userId!,
            });

            results.success++;
            results.sent.push({ leadId: lead.id, name: lead.name, email: lead.email });
          } else {
            // Save failed attempt to history
            await db.insert(leadMessageHistory).values({
              leadId: lead.id,
              subject,
              message,
              status: "failed",
              sentBy: req.userId!,
              errorMessage: emailResult.error,
            });

            results.failed++;
            results.errors.push({ name: lead.name, error: emailResult.error || "Failed to send" });
          }
        } catch (err: any) {
          results.failed++;
          results.errors.push({ name: lead.name, error: err.message || "Unknown error" });
        }
      }

      const statusMessage = [
        `Sent ${results.success} email(s) successfully`,
        results.skipped > 0 ? `${results.skipped} skipped (no email)` : "",
        results.failed > 0 ? `${results.failed} failed` : ""
      ].filter(Boolean).join(", ");

      res.json({
        message: statusMessage,
        success: results.success,
        skipped: results.skipped,
        failed: results.failed,
        errors: results.errors,
        sent: results.sent,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to send bulk emails" });
    }
  });

  // Get message history for a lead
  app.get("/api/leads/:id/messages", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can view message history
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const messages = await db.select({
        id: leadMessageHistory.id,
        subject: leadMessageHistory.subject,
        message: leadMessageHistory.message,
        status: leadMessageHistory.status,
        sentAt: leadMessageHistory.sentAt,
        errorMessage: leadMessageHistory.errorMessage,
        sentBy: users.fullName,
      })
        .from(leadMessageHistory)
        .leftJoin(users, eq(leadMessageHistory.sentBy, users.id))
        .where(eq(leadMessageHistory.leadId, req.params.id))
        .orderBy(desc(leadMessageHistory.sentAt));

      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/leads/:id", authenticateToken, auditMiddleware("update", "lead"), async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can update leads
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const data = insertLeadSchema.partial().parse(req.body);
      const [lead] = await db.update(leads).set(data).where(eq(leads.id, req.params.id)).returning();
      res.json(lead);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/leads/:id/copy", authenticateToken, auditMiddleware("create", "lead"), async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can copy leads
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { folderId } = req.body;
      const [originalLead] = await db.select().from(leads).where(eq(leads.id, req.params.id)).limit(1);

      if (!originalLead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const { id, createdAt, ...leadData } = originalLead;
      leadData.folderId = folderId || null; // Target folder
      leadData.name = `${leadData.name} (Copy)`;

      const [newLead] = await db.insert(leads).values(leadData).returning();
      res.json(newLead);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/leads/:id", authenticateToken, auditMiddleware("delete", "lead"), async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can delete leads
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      await db.delete(leads).where(eq(leads.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Lead Email Routes
  app.get("/api/leads/:id/emails", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can view lead emails
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const emails = await db
        .select()
        .from(leadEmails)
        .where(eq(leadEmails.leadId, req.params.id))
        .orderBy(desc(leadEmails.createdAt));

      res.json(emails);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk send custom message
  app.post("/api/leads/bulk-message", authenticateToken, async (req: AuthRequest, res) => {
    console.log("BULK MESSAGE API HIT");
    try {
      // Only admin and operational_head can send bulk emails
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { leadIds, subject, content } = req.body;

      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ error: "No leads selected" });
      }

      if (!subject || !content) {
        return res.status(400).json({ error: "Subject and content are required" });
      }

      // Get sender info
      const [sender] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);

      let successCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      // Process each lead
      for (const leadId of leadIds) {
        try {
          const [lead] = await db
            .select()
            .from(leads)
            .where(eq(leads.id, leadId))
            .limit(1);

          if (!lead) {
            failedCount++;
            errors.push(`Lead ${leadId} not found`);
            continue;
          }

          if (!lead.email) {
            failedCount++;
            errors.push(`Lead ${lead.name} has no email`);
            continue;
          }

          // Create email record
          const [emailRecord] = await db
            .insert(leadEmails)
            .values({
              leadId: lead.id,
              templateName: "custom_bulk",
              subject,
              status: "pending",
              sentBy: req.userId!,
            })
            .returning();

          // Send email
          const customTemplate = { subject, message: content };
          const sent = await emailService.sendCustomEmail(lead, customTemplate, sender);

          if (sent) {
            successCount++;
            await db
              .update(leadEmails)
              .set({ status: "sent", sentAt: new Date() })
              .where(eq(leadEmails.id, emailRecord.id));
          } else {
            failedCount++;
            errors.push(`Failed to send email to ${lead.email}`);
            await db
              .update(leadEmails)
              .set({ status: "failed", errorMessage: "Email service failed to send" })
              .where(eq(leadEmails.id, emailRecord.id));
          }

        } catch (err: any) {
          failedCount++;
          errors.push(`Error processing lead ${leadId}: ${err.message}`);
        }
      }

      res.json({
        success: successCount,
        failed: failedCount,
        errors
      });

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/leads/:id/emails/send", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can send emails to leads
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { templateName } = req.body;

      if (!templateName) {
        return res.status(400).json({ error: "Template is required" });
      }

      // Get lead info
      const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.id, req.params.id))
        .limit(1);

      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      let subject = "";
      let isCustom = false;
      let customHtml = "";
      let customTemplate: any;

      // Check if it's a system template
      if (LEAD_EMAIL_TEMPLATES.includes(templateName as any)) {
        subject = emailService.getTemplateSubject(templateName);
      } else if (templateName === "write_custom") {
        // Custom template (Manual)
        subject = req.body.subject;
        const messageBody = req.body.message;

        if (!subject || !messageBody) {
          return res.status(400).json({ error: "Subject and message are required for custom emails" });
        }

        isCustom = true;

        // Construct temp template object for sendCustomEmail
        customTemplate = {
          subject,
          message: messageBody,
          attachments: req.body.attachments
        };
      } else {
        // Check if it's a custom template from DB
        const [t] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, templateName)).limit(1);
        if (!t) {
          return res.status(400).json({
            error: "Invalid template. Valid templates: " + LEAD_EMAIL_TEMPLATES.join(", ") + " or 'write_custom'."
          });
        }
        customTemplate = t;
        subject = t.subject;
        isCustom = true;
      }

      // Create email record
      const [emailRecord] = await db
        .insert(leadEmails)
        .values({
          leadId: lead.id,
          templateName: isCustom ? "custom" : templateName,
          subject,
          status: "pending",
          sentBy: req.userId!,
        })
        .returning();

      // Send email
      let success = false;
      if (isCustom && customTemplate) {
        // Get sender info for variable substitution
        const [sender] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
        success = await emailService.sendCustomEmail(lead, customTemplate, sender);
      } else {
        success = await emailService.sendLeadTemplateEmail(lead, templateName);
      }

      // Update email record with result
      if (success) {
        await db
          .update(leadEmails)
          .set({ status: "sent", sentAt: new Date() })
          .where(eq(leadEmails.id, emailRecord.id));
      } else {
        await db
          .update(leadEmails)
          .set({ status: "failed", errorMessage: "Email service failed to send" })
          .where(eq(leadEmails.id, emailRecord.id));
      }

      // Get updated record
      const [updatedEmail] = await db
        .select()
        .from(leadEmails)
        .where(eq(leadEmails.id, emailRecord.id))
        .limit(1);

      res.json({
        success,
        message: success ? "Email sent successfully" : "Failed to send email",
        email: updatedEmail,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Send welcome emails to new lead (batch)
  app.post("/api/leads/:id/emails/send-welcome", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can send welcome emails
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Get lead info
      const [lead] = await db
        .select()
        .from(leads)
        .where(eq(leads.id, req.params.id))
        .limit(1);

      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      const templatesToSend = ["service_introduction", "company_profile", "pricing_brochure"];
      const results = [];

      for (const templateName of templatesToSend) {
        const subject = emailService.getTemplateSubject(templateName);

        // Create email record
        const [emailRecord] = await db
          .insert(leadEmails)
          .values({
            leadId: lead.id,
            templateName,
            subject,
            status: "pending",
            sentBy: req.userId!,
          })
          .returning();

        // Send email
        const success = await emailService.sendLeadTemplateEmail(lead, templateName);

        // Update record
        if (success) {
          await db
            .update(leadEmails)
            .set({ status: "sent", sentAt: new Date() })
            .where(eq(leadEmails.id, emailRecord.id));
        } else {
          await db
            .update(leadEmails)
            .set({ status: "failed", errorMessage: "Email service failed to send" })
            .where(eq(leadEmails.id, emailRecord.id));
        }

        results.push({ templateName, success });
      }

      const successCount = results.filter(r => r.success).length;
      res.json({
        message: `Sent ${successCount}/${templatesToSend.length} welcome emails`,
        results,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });



  // Bulk send custom message
  app.post("/api/leads/bulk-message", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can send bulk emails
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { leadIds, subject, content } = req.body;

      if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
        return res.status(400).json({ error: "No leads selected" });
      }

      if (!subject || !content) {
        return res.status(400).json({ error: "Subject and content are required" });
      }

      // Get sender info
      const [sender] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);

      let successCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      // Process each lead
      for (const leadId of leadIds) {
        try {
          const [lead] = await db
            .select()
            .from(leads)
            .where(eq(leads.id, leadId))
            .limit(1);

          if (!lead) {
            failedCount++;
            errors.push(`Lead ${leadId} not found`);
            continue;
          }

          if (!lead.email) {
            failedCount++;
            errors.push(`Lead ${lead.name} has no email`);
            continue;
          }

          // Create email record
          const [emailRecord] = await db
            .insert(leadEmails)
            .values({
              leadId: lead.id,
              templateName: "custom_bulk",
              subject,
              status: "pending",
              sentBy: req.userId!,
            })
            .returning();

          // Send email
          const customTemplate = { subject, message: content };
          const sent = await emailService.sendCustomEmail(lead, customTemplate, sender);

          if (sent) {
            successCount++;
            await db
              .update(leadEmails)
              .set({ status: "sent", sentAt: new Date() })
              .where(eq(leadEmails.id, emailRecord.id));
          } else {
            failedCount++;
            errors.push(`Failed to send email to ${lead.email}`);
            await db
              .update(leadEmails)
              .set({ status: "failed", errorMessage: "Email service failed to send" })
              .where(eq(leadEmails.id, emailRecord.id));
          }

        } catch (err: any) {
          failedCount++;
          errors.push(`Error processing lead ${leadId}: ${err.message}`);
        }
      }

      res.json({
        success: successCount,
        failed: failedCount,
        errors
      });

    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Clients
  app.get("/api/clients", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can access clients
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const allClients = await db.select().from(clients).orderBy(desc(clients.createdAt));
      res.json(allClients);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/clients", authenticateToken, auditMiddleware("create", "client"), async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can create clients
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const data = insertClientSchema.parse(req.body);

      // Check for duplicate email
      const [existingClient] = await db
        .select()
        .from(clients)
        .where(eq(clients.email, data.email))
        .limit(1);

      if (existingClient) {
        return res.status(400).json({ error: "A client with this email already exists" });
      }

      const [client] = await db.insert(clients).values(data).returning();
      res.json(client);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/clients/:id", authenticateToken, auditMiddleware("update", "client"), async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can update clients
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const data = insertClientSchema.partial().parse(req.body);
      const [client] = await db.update(clients).set(data).where(eq(clients.id, req.params.id)).returning();
      res.json(client);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/clients/:id", authenticateToken, auditMiddleware("delete", "client"), async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can delete clients
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Check if client has associated projects
      const clientProjects = await db
        .select()
        .from(projects)
        .where(eq(projects.clientId, req.params.id))
        .limit(1);

      if (clientProjects.length > 0) {
        return res.status(400).json({
          error: "Cannot delete client with associated projects. Please delete or reassign projects first."
        });
      }

      await db.delete(clients).where(eq(clients.id, req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Projects
  app.get("/api/projects", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }
      let allProjects;
      if (req.userRole === "client") {
        // Get user's client ID
        const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
        if (!user?.clientId) {
          return res.status(403).json({ error: "No client associated with this account" });
        }
        allProjects = await db.select().from(projects)
          .where(eq(projects.clientId, user.clientId))
          .orderBy(desc(projects.createdAt));
      } else {
        allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));
      }
      res.json(allProjects);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/projects", authenticateToken, auditMiddleware("create", "project"), async (req: AuthRequest, res) => {
    try {
      const data = insertProjectSchema.parse(req.body);
      const [project] = await db.insert(projects).values({
        ...data,
        createdBy: req.userId,
      }).returning();
      res.json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/projects/:id", authenticateToken, auditMiddleware("update", "project"), async (req: AuthRequest, res) => {
    try {
      const data = insertProjectSchema.partial().parse(req.body);
      const [project] = await db.update(projects).set(data).where(eq(projects.id, req.params.id)).returning();
      res.json(project);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Tasks
  app.get("/api/tasks", authenticateToken, async (req: AuthRequest, res) => {
    try {
      let allTasks: any[];

      // CLIENT SECURITY: Clients can only view tasks from their own projects (read-only)
      if (req.userRole === "client") {
        // Get user's clientId
        const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
        if (!user?.clientId) {
          return res.status(403).json({ error: "No client associated with this user" });
        }

        // Get all projects for this client
        const clientProjects = await db.select().from(projects).where(eq(projects.clientId, user.clientId));
        const projectIds = clientProjects.map(p => p.id);

        if (projectIds.length > 0) {
          // Use inArray for safe parameter binding (prevents SQL injection)
          allTasks = await db.select().from(tasks)
            .where(inArray(tasks.projectId, projectIds))
            .orderBy(desc(tasks.createdAt));
        } else {
          allTasks = [];
        }
      } else {
        allTasks = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
      }

      res.json(allTasks);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tasks", authenticateToken, auditMiddleware("create", "task"), async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can create tasks
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const data = insertTaskSchema.parse(req.body);
      const [task] = await db.insert(tasks).values(data).returning();

      // Send email notification to assignee if assigned
      if (task.assignedTo) {
        const [assignee] = await db.select().from(users).where(eq(users.id, task.assignedTo)).limit(1);
        if (assignee) {
          const [project] = await db.select().from(projects).where(eq(projects.id, task.projectId)).limit(1);
          await emailService.sendTaskAssignment({ ...task, project }, assignee);
        }
      }

      res.json(task);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/tasks/:id", authenticateToken, auditMiddleware("update", "task"), async (req: AuthRequest, res) => {
    try {
      const data = insertTaskSchema.partial().parse(req.body);
      const [task] = await db.update(tasks).set(data).where(eq(tasks.id, req.params.id)).returning();
      res.json(task);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Attendance
  app.get("/api/attendance", authenticateToken, async (req: AuthRequest, res) => {
    try {
      let allAttendance;
      if (req.userRole === "admin" || req.userRole === "operational_head") {
        allAttendance = await db.select().from(attendance).orderBy(desc(attendance.date));
      } else {
        allAttendance = await db.select().from(attendance).where(eq(attendance.userId, req.userId!)).orderBy(desc(attendance.date));
      }
      res.json(allAttendance);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/attendance/check-in", authenticateToken, auditMiddleware("check-in", "attendance"), async (req: AuthRequest, res) => {
    try {
      const [existing] = await db.select().from(attendance)
        .where(eq(attendance.userId, req.userId!))
        .orderBy(desc(attendance.date))
        .limit(1);

      if (existing && new Date(existing.date).toDateString() === new Date().toDateString() && existing.checkIn) {
        return res.status(400).json({ error: "Already checked in today" });
      }

      const today = new Date().toISOString().split('T')[0];
      const [record] = await db.insert(attendance).values({
        userId: req.userId!,
        date: today,
        checkIn: new Date(),
        status: "on-time",
      }).returning();

      res.json(record);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post("/api/attendance/check-out", authenticateToken, auditMiddleware("check-out", "attendance"), async (req: AuthRequest, res) => {
    try {
      const [existing] = await db.select().from(attendance)
        .where(eq(attendance.userId, req.userId!))
        .orderBy(desc(attendance.date))
        .limit(1);

      if (!existing || !existing.checkIn) {
        return res.status(400).json({ error: "No check-in found for today" });
      }

      if (existing.checkOut) {
        return res.status(400).json({ error: "Already checked out today" });
      }

      const [record] = await db.update(attendance)
        .set({ checkOut: new Date() })
        .where(eq(attendance.id, existing.id))
        .returning();

      res.json(record);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Manual attendance entry - Admin only
  app.post("/api/attendance/manual", authenticateToken, auditMiddleware("create", "attendance"), async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can manually add attendance
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { userId, date, status, checkIn, checkOut, notes } = req.body;

      // DEBUG: Log incoming status
      console.log("🔍 Manual Attendance - Received status:", status, "| Type:", typeof status);
      console.log("🔍 Full request body:", JSON.stringify(req.body));

      // Validate required fields
      if (!userId || !date || !status) {
        return res.status(400).json({ error: "User ID, date, and status are required" });
      }

      // CRITICAL FIX: Verify that the user exists and has an employee record
      const [userRecord] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!userRecord) {
        return res.status(404).json({ error: "User not found" });
      }

      // Check if user has an employee record
      const [employeeRecord] = await db.select().from(employees)
        .where(eq(employees.userId, userId))
        .limit(1);

      if (!employeeRecord) {
        return res.status(400).json({
          error: "This user does not have an employee record. Please create an employee record first before adding attendance."
        });
      }

      // Convert time strings to proper timestamps by combining with date
      let checkInTimestamp = null;
      let checkOutTimestamp = null;

      if (checkIn && checkIn.trim() !== "") {
        // Combine date (YYYY-MM-DD) with time (HH:MM) to create ISO timestamp
        checkInTimestamp = new Date(`${date}T${checkIn}:00`);

        // Validate timestamp
        if (isNaN(checkInTimestamp.getTime())) {
          return res.status(400).json({ error: "Invalid check-in time format" });
        }
      }

      if (checkOut && checkOut.trim() !== "") {
        // Combine date (YYYY-MM-DD) with time (HH:MM) to create ISO timestamp
        checkOutTimestamp = new Date(`${date}T${checkOut}:00`);

        // Validate timestamp
        if (isNaN(checkOutTimestamp.getTime())) {
          return res.status(400).json({ error: "Invalid check-out time format" });
        }
      }

      // Check if attendance already exists for this user and date
      const [existing] = await db.select().from(attendance)
        .where(and(
          eq(attendance.userId, userId),
          sql`${attendance.date} = ${date}`
        ))
        .limit(1);

      let record;
      if (existing) {
        // Update existing attendance
        console.log("🔍 UPDATING existing attendance with status:", status);
        [record] = await db.update(attendance)
          .set({
            status,
            checkIn: checkInTimestamp,
            checkOut: checkOutTimestamp,
            notes,
          })
          .where(eq(attendance.id, existing.id))
          .returning();
      } else {
        // Create new attendance record
        console.log("🔍 CREATING new attendance with status:", status);
        [record] = await db.insert(attendance).values({
          userId,
          date,
          status,
          checkIn: checkInTimestamp,
          checkOut: checkOutTimestamp,
          notes,
        }).returning();
      }

      console.log("🔍 SAVED record - status:", record.status);
      res.json(record);
    } catch (error: any) {
      console.error("Manual attendance error:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // GET /api/employees - Fetch all active employees with user information
  app.get("/api/employees", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can access employee list
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Fetch all active employees with their user information
      const employeeList = await db
        .select({
          id: employees.id,
          userId: employees.userId,
          employeeId: employees.employeeId,
          departmentId: employees.departmentId,
          designationId: employees.designationId,
          status: employees.status,
          user: {
            id: users.id,
            fullName: users.fullName,
            email: users.email,
          },
        })
        .from(employees)
        .innerJoin(users, eq(employees.userId, users.id))
        .where(eq(employees.status, "active"));

      res.json(employeeList);
    } catch (error: any) {
      console.error("Employees GET error:", error);
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  // Income
  app.get("/api/income", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can access finance records
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const allIncome = await db.select().from(income).orderBy(desc(income.date));
      res.json(allIncome);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/income", authenticateToken, auditMiddleware("create", "income"), async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can create income records
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const data = insertIncomeSchema.parse(req.body);
      const [incomeRecord] = await db.insert(income).values({
        ...data,
        createdBy: req.userId,
      }).returning();
      res.json(incomeRecord);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Expenses
  app.get("/api/expenses", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can access finance records
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const allExpenses = await db.select().from(expenses).orderBy(desc(expenses.date));
      res.json(allExpenses);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/expenses", authenticateToken, auditMiddleware("create", "expense"), async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can create expense records
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const data = insertExpenseSchema.parse(req.body);
      const [expense] = await db.insert(expenses).values({
        ...data,
        createdBy: req.userId,
      }).returning();
      res.json(expense);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Expense Categories
  app.get("/api/expense-categories", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const categories = await db.select().from(expenseCategories).orderBy(expenseCategories.name);
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/expense-categories", authenticateToken, auditMiddleware("create", "expense_category"), async (req: AuthRequest, res) => {
    try {
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const data = insertExpenseCategorySchema.parse(req.body);
      const [category] = await db.insert(expenseCategories).values(data).returning();
      res.json(category);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/expense-categories/:id", authenticateToken, auditMiddleware("update", "expense_category"), async (req: AuthRequest, res) => {
    try {
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { id } = req.params;
      const data = insertExpenseCategorySchema.partial().parse(req.body);
      const [category] = await db.update(expenseCategories).set(data).where(eq(expenseCategories.id, id)).returning();
      res.json(category);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/expense-categories/:id", authenticateToken, auditMiddleware("delete", "expense_category"), async (req: AuthRequest, res) => {
    try {
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { id } = req.params;
      await db.delete(expenseCategories).where(eq(expenseCategories.id, id));
      res.json({ message: "Category deleted" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Invoices
  app.get("/api/invoices", authenticateToken, async (req: AuthRequest, res) => {
    try {
      let allInvoices;
      if (req.userRole === "client") {
        // Get user's client ID
        const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
        if (!user?.clientId) {
          return res.status(403).json({ error: "No client associated with this account" });
        }
        allInvoices = await db.select().from(invoices)
          .where(eq(invoices.clientId, user.clientId))
          .orderBy(desc(invoices.createdAt));
      } else if (req.userRole === "admin" || req.userRole === "operational_head") {
        allInvoices = await db.select().from(invoices).orderBy(desc(invoices.createdAt));
      } else {
        // Developers and other roles don't have access to invoices
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(allInvoices);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/invoices", authenticateToken, auditMiddleware("create", "invoice"), async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can create invoices
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const data = insertInvoiceSchema.parse(req.body);
      const [invoice] = await db.insert(invoices).values(data).returning();
      res.json(invoice);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/invoices/:id", authenticateToken, auditMiddleware("update", "invoice"), async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can update invoices
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const data = insertInvoiceSchema.partial().parse(req.body);
      const [invoice] = await db.update(invoices).set(data).where(eq(invoices.id, req.params.id)).returning();

      // Send email notification when invoice is marked as sent
      if (data.status === "sent" && invoice.clientId) {
        const [client] = await db.select().from(clients).where(eq(clients.id, invoice.clientId)).limit(1);
        if (client) {
          await emailService.sendInvoiceReminder({ ...invoice, client });
        }
      }

      res.json(invoice);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/invoices/:id/download", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const invoiceId = req.params.id;

      // Get invoice with client information
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);

      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      // Check access permissions
      if (req.userRole === "client") {
        // Clients can only download their own invoices
        const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
        if (!user?.clientId || user.clientId !== invoice.clientId) {
          return res.status(403).json({ error: "Access denied" });
        }
      } else if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        // Developers and other roles don't have access
        return res.status(403).json({ error: "Access denied" });
      }

      // Get client details
      const [client] = await db.select().from(clients).where(eq(clients.id, invoice.clientId)).limit(1);

      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Generate PDF using pdfkit with professional design
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        bufferPages: true
      });

      // Set response headers
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`);

      // Pipe the PDF to the response
      doc.pipe(res);

      // ===== PROFESSIONAL HEADER SECTION =====
      // Background color bar for header
      doc.save();
      doc.rect(0, 0, 595, 120).fill('#F8F9FA');
      doc.restore();

      // Company Logo
      try {
        const logoPath = path.join(__dirname, "../attached_assets/Untitled design (1)_1763794635122.png");
        doc.image(logoPath, 40, 30, { width: 80, height: 80 });
      } catch (error) {
        console.warn("Logo not found, skipping logo in PDF");
      }

      // Company Information (right side of header)
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#C8102E");
      doc.text("MaxTech BD", 350, 35, { width: 200, align: "right" });

      doc.fontSize(9).font("Helvetica").fillColor("#212121");
      doc.text("522, SK Mujib Road (4th Floor)", 350, 52, { width: 200, align: "right" });
      doc.text("Agrabad, Double Mooring", 350, 64, { width: 200, align: "right" });
      doc.text("Chattogram, Bangladesh", 350, 76, { width: 200, align: "right" });
      doc.text("Phone: +8801843180008", 350, 92, { width: 200, align: "right" });
      doc.text("Email: info@maxtechbd.com", 350, 104, { width: 200, align: "right" });

      // ===== INVOICE TITLE =====
      doc.fontSize(32).font("Helvetica-Bold").fillColor("#C8102E");
      doc.text("INVOICE", 40, 145);

      // ===== TWO-COLUMN SECTION: Invoice Details & Bill To =====
      const detailsStartY = 200;

      // Left Column - Invoice Details Box
      doc.save();
      doc.rect(40, detailsStartY, 250, 110).stroke("#E5E7EB");
      doc.rect(40, detailsStartY, 250, 30).fillAndStroke("#F3F4F6", "#E5E7EB");
      doc.restore();

      doc.fontSize(11).font("Helvetica-Bold").fillColor("#374151");
      doc.text("Invoice Details", 50, detailsStartY + 8);

      doc.fontSize(10).font("Helvetica").fillColor("#6B7280");
      doc.text("Invoice Number:", 50, detailsStartY + 45);
      doc.text("Invoice Date:", 50, detailsStartY + 62);
      doc.text("Due Date:", 50, detailsStartY + 79);
      doc.text("Status:", 50, detailsStartY + 96);

      doc.font("Helvetica-Bold").fillColor("#111827");
      doc.text(invoice.invoiceNumber, 160, detailsStartY + 45);
      doc.text(new Date(invoice.createdAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      }), 160, detailsStartY + 62);
      doc.text(new Date(invoice.dueDate).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      }), 160, detailsStartY + 79);

      // Status badge
      const statusColors: Record<string, string> = {
        'draft': '#9CA3AF',
        'sent': '#3B82F6',
        'paid': '#10B981',
        'overdue': '#EF4444'
      };
      doc.fillColor(statusColors[invoice.status] || '#9CA3AF');
      doc.text(invoice.status.toUpperCase(), 160, detailsStartY + 96);

      // Right Column - Bill To Box
      doc.save();
      doc.rect(305, detailsStartY, 250, 110).stroke("#E5E7EB");
      doc.rect(305, detailsStartY, 250, 30).fillAndStroke("#F3F4F6", "#E5E7EB");
      doc.restore();

      doc.fontSize(11).font("Helvetica-Bold").fillColor("#374151");
      doc.text("Bill To", 315, detailsStartY + 8);

      doc.fontSize(11).font("Helvetica-Bold").fillColor("#111827");
      doc.text(client.name, 315, detailsStartY + 45, { width: 230 });

      doc.fontSize(10).font("Helvetica").fillColor("#6B7280");
      let billToY = detailsStartY + 62;
      if (client.email) {
        doc.text(client.email, 315, billToY, { width: 230 });
        billToY += 15;
      }
      if (client.phone) {
        doc.text(client.phone, 315, billToY, { width: 230 });
      }

      // ===== ITEMS TABLE =====
      const tableTop = 340;
      const rowHeight = 40;
      let currentY = tableTop + 35;

      // Check if invoice has itemized lines
      const invoiceItems = invoice.items && Array.isArray(invoice.items) && invoice.items.length > 0
        ? invoice.items as InvoiceItem[]
        : null;

      if (invoiceItems) {
        // Render itemized invoice with quantity, rate, and amount columns
        // Table Header
        doc.save();
        doc.rect(40, tableTop, 515, 35).fillAndStroke("#C8102E", "#C8102E");
        doc.restore();

        doc.fontSize(11).font("Helvetica-Bold").fillColor("#FFFFFF");
        doc.text("Description", 50, tableTop + 11, { width: 220 });
        doc.text("Qty", 280, tableTop + 11, { width: 50, align: "right" });
        doc.text("Rate", 340, tableTop + 11, { width: 80, align: "right" });
        doc.text("Amount", 430, tableTop + 11, { width: 115, align: "right" });

        // Calculate line totals from quantity * rate (single source of truth)
        const calculatedLineTotals: string[] = [];

        // Render each item
        invoiceItems.forEach((item, index) => {
          const bgColor = index % 2 === 0 ? "#FAFAFA" : "#FFFFFF";
          doc.save();
          doc.rect(40, currentY, 515, rowHeight).fillAndStroke(bgColor, "#E5E7EB");
          doc.restore();

          // Calculate line total from quantity * rate
          const lineTotal = calculateLineTotal(item.quantity || 0, item.rate || 0);
          calculatedLineTotals.push(lineTotal);

          doc.fontSize(10).font("Helvetica").fillColor("#374151");
          doc.text(item.description || 'Item', 50, currentY + 13, { width: 220 });
          doc.text(String(item.quantity || 0), 280, currentY + 13, { width: 50, align: "right" });
          doc.text(formatCurrency(item.rate || 0, { prefix: '' }), 340, currentY + 13, { width: 80, align: "right" });
          doc.font("Helvetica-Bold").fillColor("#111827");
          doc.text(formatCurrency(lineTotal), 430, currentY + 13, { width: 115, align: "right" });

          currentY += rowHeight;
        });

        // Calculate subtotal from calculated line totals (not stored amounts)
        const subtotal = sumAmounts(calculatedLineTotals);

      } else {
        // Render simple single-amount invoice
        // Table Header
        doc.save();
        doc.rect(40, tableTop, 515, 35).fillAndStroke("#C8102E", "#C8102E");
        doc.restore();

        doc.fontSize(11).font("Helvetica-Bold").fillColor("#FFFFFF");
        doc.text("Description", 50, tableTop + 11);
        doc.text("Amount", 450, tableTop + 11, { width: 95, align: "right" });

        // Render single row
        doc.save();
        doc.rect(40, currentY, 515, rowHeight).fillAndStroke("#FAFAFA", "#E5E7EB");
        doc.restore();

        doc.fontSize(10).font("Helvetica").fillColor("#374151");
        doc.text("Invoice Amount", 50, currentY + 13);
        doc.font("Helvetica-Bold").fillColor("#111827");
        doc.text(formatCurrency(invoice.amount), 450, currentY + 13, { width: 95, align: "right" });

        currentY += rowHeight;
      }

      // ===== SUMMARY SECTION =====
      currentY += rowHeight + 20;

      // Subtotal
      doc.fontSize(10).font("Helvetica").fillColor("#6B7280");
      doc.text("Subtotal:", 350, currentY);
      doc.font("Helvetica").fillColor("#374151");
      doc.text(formatCurrency(invoice.amount), 450, currentY, { width: 95, align: "right" });

      currentY += 25;

      // Total Amount Due - Highlighted (draw background first, then text)
      const totalBoxX = 310;
      const totalBoxWidth = 245;
      const totalBoxRight = totalBoxX + totalBoxWidth;

      doc.save();
      doc.rect(totalBoxX, currentY - 5, totalBoxWidth, 40).fillAndStroke("#F3F4F6", "#E5E7EB");
      doc.restore();

      doc.fontSize(13).font("Helvetica-Bold").fillColor("#111827");
      doc.text("Total Amount Due:", totalBoxX + 10, currentY + 8);
      doc.fontSize(16).fillColor("#C8102E");
      doc.text(formatCurrency(invoice.amount), totalBoxRight - 105, currentY + 6, { width: 95, align: "right" });

      // ===== NOTES SECTION =====
      if (invoice.notes) {
        currentY += 70;
        const notesBoxHeight = Math.min(invoice.notes.length / 2 + 60, 150);

        doc.save();
        doc.rect(40, currentY, 515, notesBoxHeight).stroke("#E5E7EB");
        doc.rect(40, currentY, 515, 25).fillAndStroke("#F3F4F6", "#E5E7EB");
        doc.restore();

        doc.fontSize(11).font("Helvetica-Bold").fillColor("#374151");
        doc.text("Notes", 50, currentY + 7);

        doc.fontSize(10).font("Helvetica").fillColor("#6B7280");
        doc.text(invoice.notes, 50, currentY + 35, { width: 495, align: "left" });
      }

      // ===== FOOTER =====
      const footerY = 720;
      doc.save();
      doc.rect(0, footerY, 595, 100).fill("#F8F9FA");
      doc.restore();

      doc.fontSize(10).font("Helvetica-Bold").fillColor("#C8102E");
      doc.text("Thank you for your business!", 0, footerY + 20, { width: 595, align: "center" });

      doc.fontSize(8).font("Helvetica").fillColor("#6B7280");
      doc.text("MaxTech BD", 0, footerY + 40, { width: 595, align: "center" });
      doc.text("522, SK Mujib Road (4th Floor), Agrabad, Double Mooring, Chattogram, Bangladesh", 0, footerY + 52, { width: 595, align: "center" });
      doc.text("Phone: +8801843180008 | Email: info@maxtechbd.com", 0, footerY + 64, { width: 595, align: "center" });

      // Finalize the PDF
      doc.end();
    } catch (error: any) {
      console.error("PDF generation error:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  });

  // P&L PDF Export
  app.get("/api/profit-loss/export-pdf", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export P&L
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);
      const category = (req.query.category as string) || "all";

      if (!month || !year) {
        return res.status(400).json({ error: "Month and year are required" });
      }

      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

      // Calculate date range
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      // Fetch data
      const allIncomes = await db.select().from(income);
      const allExpenses = await db.select().from(expenses);
      const allPayrolls = await db.select().from(payroll);

      // Filter by date
      let periodIncomes = allIncomes.filter(inc => {
        const itemDate = new Date(inc.date);
        return itemDate >= startDate && itemDate <= endDate;
      });

      let periodExpenses = allExpenses.filter(exp => {
        const itemDate = new Date(exp.date);
        return itemDate >= startDate && itemDate <= endDate;
      });

      let periodPayrolls = allPayrolls.filter(
        p => p.status === "paid" && p.month === month && p.year === year
      );

      // Apply category filter
      if (category !== "all") {
        periodIncomes = periodIncomes.filter(inc => inc.category === category);
        periodExpenses = periodExpenses.filter(exp => exp.category === category);
        periodPayrolls = [];
      }

      // Calculate totals using Decimal.js for precision
      // Group by category (keep as string arrays for Decimal precision)
      const incomeGrouped = periodIncomes.reduce((acc, inc) => {
        if (!acc[inc.category]) acc[inc.category] = [];
        acc[inc.category].push(inc.amount);
        return acc;
      }, {} as Record<string, string[]>);

      const expenseGrouped = periodExpenses.reduce((acc, exp) => {
        if (!acc[exp.category]) acc[exp.category] = [];
        acc[exp.category].push(exp.amount);
        return acc;
      }, {} as Record<string, string[]>);

      // Calculate category totals using Decimal.js
      const incomeByCategory: Record<string, number> = {};
      Object.entries(incomeGrouped).forEach(([cat, amounts]) => {
        incomeByCategory[cat] = Number(sumAmounts(amounts));
      });

      const expenseByCategory: Record<string, number> = {};
      Object.entries(expenseGrouped).forEach(([cat, amounts]) => {
        expenseByCategory[cat] = Number(sumAmounts(amounts));
      });

      const totalIncome = Number(sumAmounts(periodIncomes.map(inc => inc.amount)));
      const totalExpenses = Number(sumAmounts(periodExpenses.map(exp => exp.amount)));
      const totalPayroll = Number(sumAmounts(periodPayrolls.map(p => p.netSalary)));
      const totalCosts = totalExpenses + totalPayroll;
      const grossProfit = totalIncome - totalCosts;
      const profitMargin = ((grossProfit / (totalIncome || 1)) * 100);

      // Generate PDF using shared template
      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });

      res.setHeader("Content-Type", "application/pdf");
      const categoryLabel = category !== "all" ? `-${category}` : "";
      res.setHeader("Content-Disposition", `attachment; filename="P&L-${months[month - 1]}-${year}${categoryLabel}.pdf"`);

      doc.pipe(res);

      // Add branded header
      const subtitle = category !== "all"
        ? `${months[month - 1]} ${year} - Category: ${category}`
        : `${months[month - 1]} ${year}`;

      let currentY = addReportHeader({
        doc,
        title: "Profit & Loss Statement",
        subtitle,
        includeDate: true
      });

      currentY += 10;

      // Revenue Section
      doc.fontSize(14).font("Helvetica-Bold").fillColor(BRAND_COLORS.primary);
      doc.text("REVENUE", 40, currentY);
      currentY += 25;

      currentY = createTableHeader(doc, currentY, [
        { label: "Category", width: 350, align: "left" },
        { label: "Amount", width: 165, align: "right" }
      ]);

      let rowIndex = 0;
      Object.entries(incomeByCategory).forEach(([cat, amount]) => {
        currentY = createTableRow(doc, currentY, [
          { text: cat, width: 350, align: "left" },
          { text: formatCurrency(amount), width: 165, align: "right" }
        ], rowIndex % 2 === 0);
        rowIndex++;
      });

      if (Object.keys(incomeByCategory).length === 0) {
        currentY = createTableRow(doc, currentY, [
          { text: "No income recorded", width: 350, align: "left" },
          { text: formatCurrency(0), width: 165, align: "right" }
        ], true);
      }

      // Total Revenue
      currentY = createTableRow(doc, currentY, [
        { text: "Total Revenue", width: 350, align: "left", bold: true },
        { text: formatCurrency(totalIncome), width: 165, align: "right", bold: true }
      ], false);

      currentY += 20;

      // Operating Expenses Section
      doc.fontSize(14).font("Helvetica-Bold").fillColor(BRAND_COLORS.primary);
      doc.text("OPERATING EXPENSES", 40, currentY);
      currentY += 25;

      currentY = createTableHeader(doc, currentY, [
        { label: "Category", width: 350, align: "left" },
        { label: "Amount", width: 165, align: "right" }
      ]);

      rowIndex = 0;
      Object.entries(expenseByCategory).forEach(([cat, amount]) => {
        currentY = createTableRow(doc, currentY, [
          { text: cat, width: 350, align: "left" },
          { text: formatCurrency(amount), width: 165, align: "right" }
        ], rowIndex % 2 === 0);
        rowIndex++;
      });

      if (Object.keys(expenseByCategory).length === 0) {
        currentY = createTableRow(doc, currentY, [
          { text: "No expenses recorded", width: 350, align: "left" },
          { text: formatCurrency(0), width: 165, align: "right" }
        ], true);
      }

      // Total Operating Expenses
      currentY = createTableRow(doc, currentY, [
        { text: "Total Operating Expenses", width: 350, align: "left", bold: true },
        { text: formatCurrency(totalExpenses), width: 165, align: "right", bold: true }
      ], false);

      currentY += 20;

      // Payroll Section
      doc.fontSize(14).font("Helvetica-Bold").fillColor(BRAND_COLORS.primary);
      doc.text("PAYROLL EXPENSES", 40, currentY);
      currentY += 25;

      currentY = createTableHeader(doc, currentY, [
        { label: "Description", width: 350, align: "left" },
        { label: "Amount", width: 165, align: "right" }
      ]);

      currentY = createTableRow(doc, currentY, [
        { text: `Employee Salaries (${periodPayrolls.length} payments)`, width: 350, align: "left" },
        { text: formatCurrency(totalPayroll), width: 165, align: "right" }
      ], true);

      currentY = createTableRow(doc, currentY, [
        { text: "Total Costs", width: 350, align: "left", bold: true },
        { text: formatCurrency(totalCosts), width: 165, align: "right", bold: true }
      ], false);

      currentY += 30;

      // Net Profit/Loss Summary
      currentY = addSummarySection(doc, currentY, [
        { label: "Total Revenue", value: formatCurrency(totalIncome) },
        { label: "Total Costs", value: formatCurrency(totalCosts) },
        { label: "Net Profit/Loss", value: `${grossProfit >= 0 ? '' : '-'}${formatCurrency(Math.abs(grossProfit))}`, highlight: true },
        { label: "Profit Margin", value: `${profitMargin.toFixed(2)}%` }
      ]);

      // Add footer
      addReportFooter(doc);

      doc.end();
    } catch (error: any) {
      console.error("P&L PDF export error:", error);
      res.status(500).json({ error: "Failed to export PDF" });
    }
  });

  // P&L Excel Export
  app.get("/api/profit-loss/export-excel", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export P&L
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);
      const category = (req.query.category as string) || "all";

      if (!month || !year) {
        return res.status(400).json({ error: "Month and year are required" });
      }

      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

      // Calculate date range
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      // Fetch data
      const allIncomes = await db.select().from(income);
      const allExpenses = await db.select().from(expenses);
      const allPayrolls = await db.select().from(payroll);

      // Filter by date
      let periodIncomes = allIncomes.filter(inc => {
        const itemDate = new Date(inc.date);
        return itemDate >= startDate && itemDate <= endDate;
      });

      let periodExpenses = allExpenses.filter(exp => {
        const itemDate = new Date(exp.date);
        return itemDate >= startDate && itemDate <= endDate;
      });

      let periodPayrolls = allPayrolls.filter(
        p => p.status === "paid" && p.month === month && p.year === year
      );

      // Apply category filter
      if (category !== "all") {
        periodIncomes = periodIncomes.filter(inc => inc.category === category);
        periodExpenses = periodExpenses.filter(exp => exp.category === category);
        periodPayrolls = [];
      }

      // Calculate totals using Decimal.js for precision
      // Group by category (keep as string arrays for Decimal precision)
      const incomeGrouped = periodIncomes.reduce((acc, inc) => {
        if (!acc[inc.category]) acc[inc.category] = [];
        acc[inc.category].push(inc.amount);
        return acc;
      }, {} as Record<string, string[]>);

      const expenseGrouped = periodExpenses.reduce((acc, exp) => {
        if (!acc[exp.category]) acc[exp.category] = [];
        acc[exp.category].push(exp.amount);
        return acc;
      }, {} as Record<string, string[]>);

      // Calculate category totals using Decimal.js
      const incomeByCategory: Record<string, number> = {};
      Object.entries(incomeGrouped).forEach(([cat, amounts]) => {
        incomeByCategory[cat] = Number(sumAmounts(amounts));
      });

      const expenseByCategory: Record<string, number> = {};
      Object.entries(expenseGrouped).forEach(([cat, amounts]) => {
        expenseByCategory[cat] = Number(sumAmounts(amounts));
      });

      const totalIncome = Number(sumAmounts(periodIncomes.map(inc => inc.amount)));
      const totalExpenses = Number(sumAmounts(periodExpenses.map(exp => exp.amount)));
      const totalPayroll = Number(sumAmounts(periodPayrolls.map(p => p.netSalary)));
      const totalCosts = totalExpenses + totalPayroll;
      const grossProfit = totalIncome - totalCosts;
      const profitMargin = ((grossProfit / (totalIncome || 1)) * 100);

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Profit & Loss");

      // Set column widths
      worksheet.columns = [
        { width: 40 },
        { width: 20 }
      ];

      // Add company header with branding
      worksheet.mergeCells('A1:B1');
      const titleRow = worksheet.getCell('A1');
      titleRow.value = COMPANY_INFO.name;
      titleRow.font = { size: 16, bold: true, color: { argb: 'FFE11D26' } };
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A2:B2');
      const addressRow1 = worksheet.getCell('A2');
      addressRow1.value = COMPANY_INFO.address1;
      addressRow1.font = { size: 10 };
      addressRow1.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A3:B3');
      const addressRow2 = worksheet.getCell('A3');
      addressRow2.value = `${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`;
      addressRow2.font = { size: 10 };
      addressRow2.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A4:B4');
      const contactRow = worksheet.getCell('A4');
      contactRow.value = `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`;
      contactRow.font = { size: 10 };
      contactRow.alignment = { horizontal: 'center' };

      // Add report title
      worksheet.addRow([]);
      worksheet.mergeCells('A6:B6');
      const reportTitle = worksheet.getCell('A6');
      reportTitle.value = "Profit & Loss Statement";
      reportTitle.font = { size: 18, bold: true };
      reportTitle.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A7:B7');
      const subtitle = worksheet.getCell('A7');
      subtitle.value = category !== "all"
        ? `${months[month - 1]} ${year} - Category: ${category}`
        : `${months[month - 1]} ${year}`;
      subtitle.font = { size: 12 };
      subtitle.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A8:B8');
      const dateRow = worksheet.getCell('A8');
      dateRow.value = `Generated on: ${new Date().toLocaleString()}`;
      dateRow.font = { size: 10, italic: true };
      dateRow.alignment = { horizontal: 'center' };

      let currentRow = 10;

      // Revenue Section
      worksheet.getCell(`A${currentRow}`).value = "REVENUE";
      worksheet.getCell(`A${currentRow}`).font = { size: 14, bold: true, color: { argb: 'FFE11D26' } };
      currentRow += 2;

      // Revenue header
      const revenueHeaderRow = worksheet.getRow(currentRow);
      revenueHeaderRow.values = ["Category", "Amount"];
      revenueHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      revenueHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D26' } };
      revenueHeaderRow.alignment = { horizontal: 'left', vertical: 'middle' };
      currentRow++;

      // Revenue items
      Object.entries(incomeByCategory).forEach(([cat, amount]) => {
        const row = worksheet.getRow(currentRow);
        row.values = [cat, formatCurrency(amount)];
        row.alignment = { horizontal: 'left', vertical: 'middle' };
        currentRow++;
      });

      if (Object.keys(incomeByCategory).length === 0) {
        worksheet.getRow(currentRow).values = ["No income recorded", formatCurrency(0)];
        currentRow++;
      }

      // Total Revenue
      const totalRevenueRow = worksheet.getRow(currentRow);
      totalRevenueRow.values = ["Total Revenue", formatCurrency(totalIncome)];
      totalRevenueRow.font = { bold: true };
      totalRevenueRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
      currentRow += 2;

      // Operating Expenses Section
      worksheet.getCell(`A${currentRow}`).value = "OPERATING EXPENSES";
      worksheet.getCell(`A${currentRow}`).font = { size: 14, bold: true, color: { argb: 'FFE11D26' } };
      currentRow += 2;

      // Expenses header
      const expenseHeaderRow = worksheet.getRow(currentRow);
      expenseHeaderRow.values = ["Category", "Amount"];
      expenseHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      expenseHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D26' } };
      expenseHeaderRow.alignment = { horizontal: 'left', vertical: 'middle' };
      currentRow++;

      // Expense items
      Object.entries(expenseByCategory).forEach(([cat, amount]) => {
        const row = worksheet.getRow(currentRow);
        row.values = [cat, formatCurrency(amount)];
        row.alignment = { horizontal: 'left', vertical: 'middle' };
        currentRow++;
      });

      if (Object.keys(expenseByCategory).length === 0) {
        worksheet.getRow(currentRow).values = ["No expenses recorded", formatCurrency(0)];
        currentRow++;
      }

      // Total Operating Expenses
      const totalExpensesRow = worksheet.getRow(currentRow);
      totalExpensesRow.values = ["Total Operating Expenses", formatCurrency(totalExpenses)];
      totalExpensesRow.font = { bold: true };
      totalExpensesRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
      currentRow += 2;

      // Payroll Section
      worksheet.getCell(`A${currentRow}`).value = "PAYROLL EXPENSES";
      worksheet.getCell(`A${currentRow}`).font = { size: 14, bold: true, color: { argb: 'FFE11D26' } };
      currentRow += 2;

      // Payroll header
      const payrollHeaderRow = worksheet.getRow(currentRow);
      payrollHeaderRow.values = ["Description", "Amount"];
      payrollHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      payrollHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D26' } };
      payrollHeaderRow.alignment = { horizontal: 'left', vertical: 'middle' };
      currentRow++;

      // Payroll item
      const payrollRow = worksheet.getRow(currentRow);
      payrollRow.values = [`Employee Salaries (${periodPayrolls.length} payments)`, formatCurrency(totalPayroll)];
      payrollRow.alignment = { horizontal: 'left', vertical: 'middle' };
      currentRow++;

      // Total Costs
      const totalCostsRow = worksheet.getRow(currentRow);
      totalCostsRow.values = ["Total Costs", formatCurrency(totalCosts)];
      totalCostsRow.font = { bold: true };
      totalCostsRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
      currentRow += 2;

      // Summary Section
      currentRow++;
      const summaryRow1 = worksheet.getRow(currentRow);
      summaryRow1.values = ["Total Revenue", formatCurrency(totalIncome)];
      summaryRow1.font = { size: 11 };
      currentRow++;

      const summaryRow2 = worksheet.getRow(currentRow);
      summaryRow2.values = ["Total Costs", formatCurrency(totalCosts)];
      summaryRow2.font = { size: 11 };
      currentRow++;

      const profitRow = worksheet.getRow(currentRow);
      profitRow.values = ["Net Profit/Loss", `${grossProfit >= 0 ? '' : '-'}${formatCurrency(Math.abs(grossProfit))}`];
      profitRow.font = { size: 12, bold: true, color: { argb: grossProfit >= 0 ? 'FF10B981' : 'FFEF4444' } };
      currentRow++;

      const marginRow = worksheet.getRow(currentRow);
      marginRow.values = ["Profit Margin", `${profitMargin.toFixed(2)}%`];
      marginRow.font = { size: 11 };

      // Set response headers
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      const categoryLabel = category !== "all" ? `-${category}` : "";
      res.setHeader("Content-Disposition", `attachment; filename="P&L-${months[month - 1]}-${year}${categoryLabel}.xlsx"`);

      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      console.error("P&L Excel export error:", error);
      res.status(500).json({ error: "Failed to export Excel" });
    }
  });

  // P&L Word Export
  app.get("/api/profit-loss/export-word", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export P&L
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);
      const category = (req.query.category as string) || "all";

      if (!month || !year) {
        return res.status(400).json({ error: "Month and year are required" });
      }

      const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

      // Calculate date range
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      // Fetch data
      const allIncomes = await db.select().from(income);
      const allExpenses = await db.select().from(expenses);
      const allPayrolls = await db.select().from(payroll);

      // Filter by date
      let periodIncomes = allIncomes.filter(inc => {
        const itemDate = new Date(inc.date);
        return itemDate >= startDate && itemDate <= endDate;
      });

      let periodExpenses = allExpenses.filter(exp => {
        const itemDate = new Date(exp.date);
        return itemDate >= startDate && itemDate <= endDate;
      });

      let periodPayrolls = allPayrolls.filter(
        p => p.status === "paid" && p.month === month && p.year === year
      );

      // Apply category filter
      if (category !== "all") {
        periodIncomes = periodIncomes.filter(inc => inc.category === category);
        periodExpenses = periodExpenses.filter(exp => exp.category === category);
        periodPayrolls = [];
      }

      // Calculate totals using Decimal.js for precision
      // Group by category (keep as string arrays for Decimal precision)
      const incomeGrouped = periodIncomes.reduce((acc, inc) => {
        if (!acc[inc.category]) acc[inc.category] = [];
        acc[inc.category].push(inc.amount);
        return acc;
      }, {} as Record<string, string[]>);

      const expenseGrouped = periodExpenses.reduce((acc, exp) => {
        if (!acc[exp.category]) acc[exp.category] = [];
        acc[exp.category].push(exp.amount);
        return acc;
      }, {} as Record<string, string[]>);

      // Calculate category totals using Decimal.js
      const incomeByCategory: Record<string, number> = {};
      Object.entries(incomeGrouped).forEach(([cat, amounts]) => {
        incomeByCategory[cat] = Number(sumAmounts(amounts));
      });

      const expenseByCategory: Record<string, number> = {};
      Object.entries(expenseGrouped).forEach(([cat, amounts]) => {
        expenseByCategory[cat] = Number(sumAmounts(amounts));
      });

      const totalIncome = Number(sumAmounts(periodIncomes.map(inc => inc.amount)));
      const totalExpenses = Number(sumAmounts(periodExpenses.map(exp => exp.amount)));
      const totalPayroll = Number(sumAmounts(periodPayrolls.map(p => p.netSalary)));
      const totalCosts = totalExpenses + totalPayroll;
      const grossProfit = totalIncome - totalCosts;
      const profitMargin = ((grossProfit / (totalIncome || 1)) * 100);

      // Create Word document
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Company Header
            new Paragraph({
              children: [new TextRun({ text: COMPANY_INFO.name, bold: true, size: 32, color: "E11D26" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: COMPANY_INFO.address1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),

            // Report Title
            new Paragraph({
              text: "Profit & Loss Statement",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: category !== "all"
                ? `${months[month - 1]} ${year} - Category: ${category}`
                : `${months[month - 1]} ${year}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [new TextRun({ text: `Generated on: ${new Date().toLocaleString()}`, italics: true })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),

            // Revenue Section
            new Paragraph({
              children: [new TextRun({ text: "REVENUE", bold: true, size: 24, color: "E11D26" })],
              spacing: { before: 200, after: 200 }
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                // Header
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Category", bold: true })] })],
                      width: { size: 70, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Amount", bold: true })], alignment: AlignmentType.RIGHT })],
                      width: { size: 30, type: WidthType.PERCENTAGE }
                    })
                  ]
                }),
                // Revenue items
                ...Object.entries(incomeByCategory).map(([cat, amount]) =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph(cat)] }),
                      new TableCell({ children: [new Paragraph({ text: formatCurrency(amount), alignment: AlignmentType.RIGHT })] })
                    ]
                  })
                ),
                // Total Revenue
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Total Revenue", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatCurrency(totalIncome), bold: true })], alignment: AlignmentType.RIGHT })] })
                  ]
                })
              ]
            }),

            // Operating Expenses Section
            new Paragraph({
              children: [new TextRun({ text: "OPERATING EXPENSES", bold: true, size: 24, color: "E11D26" })],
              spacing: { before: 400, after: 200 }
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                // Header
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Category", bold: true })] })],
                      width: { size: 70, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Amount", bold: true })], alignment: AlignmentType.RIGHT })],
                      width: { size: 30, type: WidthType.PERCENTAGE }
                    })
                  ]
                }),
                // Expense items
                ...Object.entries(expenseByCategory).map(([cat, amount]) =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph(cat)] }),
                      new TableCell({ children: [new Paragraph({ text: formatCurrency(amount), alignment: AlignmentType.RIGHT })] })
                    ]
                  })
                ),
                // Total Expenses
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Total Operating Expenses", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatCurrency(totalExpenses), bold: true })], alignment: AlignmentType.RIGHT })] })
                  ]
                })
              ]
            }),

            // Payroll Section
            new Paragraph({
              children: [new TextRun({ text: "PAYROLL EXPENSES", bold: true, size: 24, color: "E11D26" })],
              spacing: { before: 400, after: 200 }
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true })] })],
                      width: { size: 70, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Amount", bold: true })], alignment: AlignmentType.RIGHT })],
                      width: { size: 30, type: WidthType.PERCENTAGE }
                    })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(`Employee Salaries (${periodPayrolls.length} payments)`)] }),
                    new TableCell({ children: [new Paragraph({ text: formatCurrency(totalPayroll), alignment: AlignmentType.RIGHT })] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Total Costs", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatCurrency(totalCosts), bold: true })], alignment: AlignmentType.RIGHT })] })
                  ]
                })
              ]
            }),

            // Summary
            new Paragraph({
              text: "",
              spacing: { before: 400 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Total Revenue: ", bold: true }),
                new TextRun(formatCurrency(totalIncome))
              ],
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Total Costs: ", bold: true }),
                new TextRun(formatCurrency(totalCosts))
              ],
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Net Profit/Loss: ", bold: true, size: 28 }),
                new TextRun({
                  text: `${grossProfit >= 0 ? '' : '-'}${formatCurrency(Math.abs(grossProfit))}`,
                  bold: true,
                  size: 28,
                  color: grossProfit >= 0 ? "10B981" : "EF4444"
                })
              ],
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Profit Margin: ", bold: true }),
                new TextRun(`${profitMargin.toFixed(2)}%`)
              ]
            }),

            // Footer
            new Paragraph({
              text: "",
              spacing: { before: 600 }
            }),
            new Paragraph({
              text: `${COMPANY_INFO.name} | ${COMPANY_INFO.address1}, ${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`,
              alignment: AlignmentType.CENTER
            })
          ]
        }]
      });

      // Set response headers
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      const categoryLabel = category !== "all" ? `-${category}` : "";
      res.setHeader("Content-Disposition", `attachment; filename="P&L-${months[month - 1]}-${year}${categoryLabel}.docx"`);

      // Write to response using Packer
      const { Packer } = await import("docx");
      const buffer = await Packer.toBuffer(doc);
      res.send(buffer);
    } catch (error: any) {
      console.error("P&L Word export error:", error);
      res.status(500).json({ error: "Failed to export Word document" });
    }
  });

  // === GENERAL LEDGER EXPORTS ===

  // General Ledger PDF Export
  app.get("/api/general-ledger/export-pdf", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export General Ledger
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Fetch all data
      const allIncomes = await db.select().from(income);
      const allExpenses = await db.select().from(expenses);
      const allPayrolls = await db.select().from(payroll);

      // Create ledger entries
      type LedgerEntry = {
        date: string;
        type: "income" | "expense" | "payroll";
        description: string;
        category: string;
        debit: string;
        credit: string;
      };

      const ledgerEntries: LedgerEntry[] = [];

      // Income entries (debits)
      allIncomes.forEach(inc => {
        ledgerEntries.push({
          date: typeof inc.date === 'string' ? inc.date : inc.date.toISOString(),
          type: "income",
          description: inc.source,
          category: inc.category,
          debit: inc.amount,
          credit: "0",
        });
      });

      // Expense entries (credits)
      allExpenses.forEach(exp => {
        ledgerEntries.push({
          date: typeof exp.date === 'string' ? exp.date : exp.date.toISOString(),
          type: "expense",
          description: exp.title,
          category: exp.category,
          debit: "0",
          credit: exp.amount,
        });
      });

      // Payroll entries (credits)
      allPayrolls.filter(p => p.status === "paid").forEach(pay => {
        ledgerEntries.push({
          date: new Date(pay.year, pay.month - 1, 1).toISOString(),
          type: "payroll",
          description: `Payroll ${pay.month}/${pay.year}`,
          category: "Payroll",
          debit: "0",
          credit: pay.netSalary,
        });
      });

      // Sort by date (oldest first for chronological balance calculation)
      ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate running balance using Decimal.js
      let runningBalance = new Decimal(0);
      const entriesWithBalance = ledgerEntries.map(entry => {
        const debitAmount = new Decimal(entry.debit);
        const creditAmount = new Decimal(entry.credit);
        runningBalance = runningBalance.plus(debitAmount).minus(creditAmount);
        return {
          ...entry,
          balance: runningBalance.toFixed(2)
        };
      });

      // Calculate totals using Decimal.js (keep as strings for precision)
      const totalDebits = sumAmounts(entriesWithBalance.map(e => e.debit));
      const totalCredits = sumAmounts(entriesWithBalance.map(e => e.credit));
      const finalBalance = new Decimal(totalDebits).minus(totalCredits).toFixed(2);
      const finalBalanceNum = parseFloat(finalBalance);

      // Generate PDF using shared template
      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });

      // Add header
      let currentY = addReportHeader({
        doc,
        title: "General Ledger",
        subtitle: `Complete Transaction History`,
        includeDate: true
      });

      currentY += 10;

      // Table header
      currentY = createTableHeader(doc, currentY, [
        { label: "Date", width: 80, align: "left" },
        { label: "Description", width: 150, align: "left" },
        { label: "Category", width: 80, align: "left" },
        { label: "Debit", width: 75, align: "right" },
        { label: "Credit", width: 75, align: "right" },
        { label: "Balance", width: 75, align: "right" }
      ]);

      // Table rows
      let isEven = false;
      entriesWithBalance.forEach((entry, index) => {
        // Check if we need a new page
        if (currentY > 700) {
          addReportFooter(doc);
          doc.addPage();
          currentY = 40;
        }

        currentY = createTableRow(doc, currentY, [
          { text: format(new Date(entry.date), 'dd/MM/yyyy'), width: 80, align: "left" },
          { text: entry.description, width: 150, align: "left" },
          { text: entry.category, width: 80, align: "left" },
          { text: entry.debit !== "0" ? formatCurrency(entry.debit) : "-", width: 75, align: "right" },
          { text: entry.credit !== "0" ? formatCurrency(entry.credit) : "-", width: 75, align: "right" },
          { text: formatCurrency(entry.balance), width: 75, align: "right", bold: true }
        ], isEven);

        isEven = !isEven;
      });

      // Summary Section
      currentY += 20;
      currentY = addSummarySection(doc, currentY, [
        { label: "Total Debits", value: formatCurrency(totalDebits) },
        { label: "Total Credits", value: formatCurrency(totalCredits) },
        { label: "Final Balance", value: `${finalBalanceNum >= 0 ? '' : '-'}${formatCurrency(Math.abs(finalBalanceNum))}`, highlight: true }
      ]);

      // Add footer
      addReportFooter(doc);

      // Stream to response
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=General-Ledger.pdf");

      doc.pipe(res);
      doc.end();
    } catch (error: any) {
      console.error("General Ledger PDF export error:", error);
      res.status(500).json({ error: "Failed to export PDF" });
    }
  });

  // General Ledger Excel Export
  app.get("/api/general-ledger/export-excel", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export General Ledger
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Fetch all data
      const allIncomes = await db.select().from(income);
      const allExpenses = await db.select().from(expenses);
      const allPayrolls = await db.select().from(payroll);

      // Create ledger entries
      type LedgerEntry = {
        date: string;
        type: "income" | "expense" | "payroll";
        description: string;
        category: string;
        debit: string;
        credit: string;
      };

      const ledgerEntries: LedgerEntry[] = [];

      // Income entries (debits)
      allIncomes.forEach(inc => {
        ledgerEntries.push({
          date: typeof inc.date === 'string' ? inc.date : inc.date.toISOString(),
          type: "income",
          description: inc.source,
          category: inc.category,
          debit: inc.amount,
          credit: "0",
        });
      });

      // Expense entries (credits)
      allExpenses.forEach(exp => {
        ledgerEntries.push({
          date: typeof exp.date === 'string' ? exp.date : exp.date.toISOString(),
          type: "expense",
          description: exp.title,
          category: exp.category,
          debit: "0",
          credit: exp.amount,
        });
      });

      // Payroll entries (credits)
      allPayrolls.filter(p => p.status === "paid").forEach(pay => {
        ledgerEntries.push({
          date: new Date(pay.year, pay.month - 1, 1).toISOString(),
          type: "payroll",
          description: `Payroll ${pay.month}/${pay.year}`,
          category: "Payroll",
          debit: "0",
          credit: pay.netSalary,
        });
      });

      // Sort by date (oldest first for chronological balance calculation)
      ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate running balance using Decimal.js
      let runningBalance = new Decimal(0);
      const entriesWithBalance = ledgerEntries.map(entry => {
        const debitAmount = new Decimal(entry.debit);
        const creditAmount = new Decimal(entry.credit);
        runningBalance = runningBalance.plus(debitAmount).minus(creditAmount);
        return {
          ...entry,
          balance: runningBalance.toFixed(2)
        };
      });

      // Calculate totals using Decimal.js (keep as strings for precision)
      const totalDebits = sumAmounts(entriesWithBalance.map(e => e.debit));
      const totalCredits = sumAmounts(entriesWithBalance.map(e => e.credit));
      const finalBalance = new Decimal(totalDebits).minus(totalCredits).toFixed(2);
      const finalBalanceNum = parseFloat(finalBalance);

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("General Ledger");

      // Set column widths
      worksheet.columns = [
        { width: 15 },  // Date
        { width: 35 },  // Description
        { width: 20 },  // Category
        { width: 18 },  // Debit
        { width: 18 },  // Credit
        { width: 18 }   // Balance
      ];

      // Add company header with branding
      worksheet.mergeCells('A1:F1');
      const titleRow = worksheet.getCell('A1');
      titleRow.value = COMPANY_INFO.name;
      titleRow.font = { size: 16, bold: true, color: { argb: 'FFE11D26' } };
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A2:F2');
      const addressRow1 = worksheet.getCell('A2');
      addressRow1.value = COMPANY_INFO.address1;
      addressRow1.font = { size: 10 };
      addressRow1.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A3:F3');
      const addressRow2 = worksheet.getCell('A3');
      addressRow2.value = `${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`;
      addressRow2.font = { size: 10 };
      addressRow2.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A4:F4');
      const contactRow = worksheet.getCell('A4');
      contactRow.value = `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`;
      contactRow.font = { size: 10 };
      contactRow.alignment = { horizontal: 'center' };

      // Add report title
      worksheet.addRow([]);
      worksheet.mergeCells('A6:F6');
      const reportTitle = worksheet.getCell('A6');
      reportTitle.value = "General Ledger";
      reportTitle.font = { size: 18, bold: true };
      reportTitle.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A7:F7');
      const subtitle = worksheet.getCell('A7');
      subtitle.value = "Complete Transaction History";
      subtitle.font = { size: 12 };
      subtitle.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A8:F8');
      const dateRow = worksheet.getCell('A8');
      dateRow.value = `Generated on: ${new Date().toLocaleString()}`;
      dateRow.font = { size: 10, italic: true };
      dateRow.alignment = { horizontal: 'center' };

      let currentRow = 10;

      // Table header
      const headerRow = worksheet.getRow(currentRow);
      headerRow.values = ["Date", "Description", "Category", "Debit", "Credit", "Balance"];
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D26' } };
      headerRow.alignment = { horizontal: 'left', vertical: 'middle' };
      currentRow++;

      // Add data rows
      entriesWithBalance.forEach(entry => {
        const row = worksheet.getRow(currentRow);
        row.values = [
          format(new Date(entry.date), 'dd/MM/yyyy'),
          entry.description,
          entry.category,
          entry.debit !== "0" ? formatCurrency(entry.debit) : "-",
          entry.credit !== "0" ? formatCurrency(entry.credit) : "-",
          formatCurrency(entry.balance)
        ];
        row.alignment = { horizontal: 'left', vertical: 'middle' };
        currentRow++;
      });

      // Add summary section
      currentRow += 2;
      const summaryRow1 = worksheet.getRow(currentRow);
      summaryRow1.values = ["", "", "", "", "Total Debits", formatCurrency(totalDebits)];
      summaryRow1.font = { bold: true };
      currentRow++;

      const summaryRow2 = worksheet.getRow(currentRow);
      summaryRow2.values = ["", "", "", "", "Total Credits", formatCurrency(totalCredits)];
      summaryRow2.font = { bold: true };
      currentRow++;

      const summaryRow3 = worksheet.getRow(currentRow);
      summaryRow3.values = ["", "", "", "", "Final Balance", `${finalBalanceNum >= 0 ? '' : '-'}${formatCurrency(Math.abs(finalBalanceNum))}`];
      summaryRow3.font = { size: 12, bold: true, color: { argb: finalBalanceNum >= 0 ? 'FF10B981' : 'FFEF4444' } };

      // Set response headers
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=General-Ledger.xlsx");

      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      console.error("General Ledger Excel export error:", error);
      res.status(500).json({ error: "Failed to export Excel" });
    }
  });

  // General Ledger Word Export
  app.get("/api/general-ledger/export-word", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export General Ledger
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Fetch all data
      const allIncomes = await db.select().from(income);
      const allExpenses = await db.select().from(expenses);
      const allPayrolls = await db.select().from(payroll);

      // Create ledger entries
      type LedgerEntry = {
        date: string;
        type: "income" | "expense" | "payroll";
        description: string;
        category: string;
        debit: string;
        credit: string;
      };

      const ledgerEntries: LedgerEntry[] = [];

      // Income entries (debits)
      allIncomes.forEach(inc => {
        ledgerEntries.push({
          date: typeof inc.date === 'string' ? inc.date : inc.date.toISOString(),
          type: "income",
          description: inc.source,
          category: inc.category,
          debit: inc.amount,
          credit: "0",
        });
      });

      // Expense entries (credits)
      allExpenses.forEach(exp => {
        ledgerEntries.push({
          date: typeof exp.date === 'string' ? exp.date : exp.date.toISOString(),
          type: "expense",
          description: exp.title,
          category: exp.category,
          debit: "0",
          credit: exp.amount,
        });
      });

      // Payroll entries (credits)
      allPayrolls.filter(p => p.status === "paid").forEach(pay => {
        ledgerEntries.push({
          date: new Date(pay.year, pay.month - 1, 1).toISOString(),
          type: "payroll",
          description: `Payroll ${pay.month}/${pay.year}`,
          category: "Payroll",
          debit: "0",
          credit: pay.netSalary,
        });
      });

      // Sort by date (oldest first for chronological balance calculation)
      ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate running balance using Decimal.js
      let runningBalance = new Decimal(0);
      const entriesWithBalance = ledgerEntries.map(entry => {
        const debitAmount = new Decimal(entry.debit);
        const creditAmount = new Decimal(entry.credit);
        runningBalance = runningBalance.plus(debitAmount).minus(creditAmount);
        return {
          ...entry,
          balance: runningBalance.toFixed(2)
        };
      });

      // Calculate totals using Decimal.js (keep as strings for precision)
      const totalDebits = sumAmounts(entriesWithBalance.map(e => e.debit));
      const totalCredits = sumAmounts(entriesWithBalance.map(e => e.credit));
      const finalBalance = new Decimal(totalDebits).minus(totalCredits).toFixed(2);
      const finalBalanceNum = parseFloat(finalBalance);

      // Create Word document
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Company Header
            new Paragraph({
              children: [new TextRun({ text: COMPANY_INFO.name, bold: true, size: 32, color: "E11D26" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: COMPANY_INFO.address1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),

            // Report Title
            new Paragraph({
              children: [new TextRun({ text: "General Ledger", bold: true, size: 28 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: "Complete Transaction History",
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [new TextRun({ text: `Generated on: ${new Date().toLocaleString()}`, italics: true })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),

            // Ledger Table
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                // Header
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Date", bold: true })], alignment: AlignmentType.LEFT })],
                      width: { size: 12, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Description", bold: true })], alignment: AlignmentType.LEFT })],
                      width: { size: 30, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Category", bold: true })], alignment: AlignmentType.LEFT })],
                      width: { size: 18, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Debit", bold: true })], alignment: AlignmentType.RIGHT })],
                      width: { size: 13, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Credit", bold: true })], alignment: AlignmentType.RIGHT })],
                      width: { size: 13, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Balance", bold: true })], alignment: AlignmentType.RIGHT })],
                      width: { size: 14, type: WidthType.PERCENTAGE }
                    })
                  ]
                }),
                // Data rows
                ...entriesWithBalance.map(entry =>
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ text: format(new Date(entry.date), 'dd/MM/yyyy'), alignment: AlignmentType.LEFT })] }),
                      new TableCell({ children: [new Paragraph({ text: entry.description, alignment: AlignmentType.LEFT })] }),
                      new TableCell({ children: [new Paragraph({ text: entry.category, alignment: AlignmentType.LEFT })] }),
                      new TableCell({ children: [new Paragraph({ text: entry.debit !== "0" ? formatCurrency(entry.debit) : "-", alignment: AlignmentType.RIGHT })] }),
                      new TableCell({ children: [new Paragraph({ text: entry.credit !== "0" ? formatCurrency(entry.credit) : "-", alignment: AlignmentType.RIGHT })] }),
                      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatCurrency(entry.balance), bold: true })], alignment: AlignmentType.RIGHT })] })
                    ]
                  })
                )
              ]
            }),

            // Summary
            new Paragraph({
              text: "",
              spacing: { before: 400 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Total Debits: ", bold: true }),
                new TextRun(formatCurrency(totalDebits))
              ],
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Total Credits: ", bold: true }),
                new TextRun(formatCurrency(totalCredits))
              ],
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Final Balance: ", bold: true, size: 28 }),
                new TextRun({
                  text: `${finalBalanceNum >= 0 ? '' : '-'}${formatCurrency(Math.abs(finalBalanceNum))}`,
                  bold: true,
                  size: 28,
                  color: finalBalanceNum >= 0 ? "10B981" : "EF4444"
                })
              ]
            }),

            // Footer
            new Paragraph({
              text: "",
              spacing: { before: 600 }
            }),
            new Paragraph({
              text: `${COMPANY_INFO.name} | ${COMPANY_INFO.address1}, ${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`,
              alignment: AlignmentType.CENTER
            })
          ]
        }]
      });

      // Set response headers
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", "attachment; filename=General-Ledger.docx");

      // Write to response using Packer
      const { Packer } = await import("docx");
      const buffer = await Packer.toBuffer(doc);
      res.send(buffer);
    } catch (error: any) {
      console.error("General Ledger Word export error:", error);
      res.status(500).json({ error: "Failed to export Word document" });
    }
  });

  // Financial Reports PDF Export
  app.get("/api/financial-reports/export-pdf", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export Financial Reports
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const period = (req.query.period || "12months") as "6months" | "12months";
      const monthsCount = period === "6months" ? 6 : 12;

      // Fetch all data
      const allIncomes = await db.select().from(income);
      const allExpenses = await db.select().from(expenses);

      // Calculate monthly data using Decimal.js
      const now = new Date();
      type MonthlyData = {
        month: string;
        income: string;
        expenses: string;
        profit: string;
      };

      const monthlyData: MonthlyData[] = [];
      for (let i = monthsCount - 1; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const startDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const endDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

        const monthIncomes = allIncomes.filter(inc => {
          const incDate = new Date(typeof inc.date === 'string' ? inc.date : inc.date.toISOString());
          return incDate >= startDate && incDate <= endDate;
        });

        const monthExpenses = allExpenses.filter(exp => {
          const expDate = new Date(typeof exp.date === 'string' ? exp.date : exp.date.toISOString());
          return expDate >= startDate && expDate <= endDate;
        });

        const totalIncome = sumAmounts(monthIncomes.map(inc => inc.amount));
        const totalExpenses = sumAmounts(monthExpenses.map(exp => exp.amount));
        const profit = new Decimal(totalIncome).minus(totalExpenses).toFixed(2);

        monthlyData.push({
          month: format(monthDate, 'MMM yyyy'),
          income: totalIncome,
          expenses: totalExpenses,
          profit: profit,
        });
      }

      // Calculate totals using Decimal.js
      const totalIncome = sumAmounts(monthlyData.map(m => m.income));
      const totalExpenses = sumAmounts(monthlyData.map(m => m.expenses));
      const totalProfit = new Decimal(totalIncome).minus(totalExpenses).toFixed(2);
      const totalProfitNum = parseFloat(totalProfit);
      const avgMonthlyIncome = new Decimal(totalIncome).dividedBy(monthsCount).toFixed(2);
      const avgMonthlyExpenses = new Decimal(totalExpenses).dividedBy(monthsCount).toFixed(2);

      // Generate PDF using shared template
      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });

      // Add header
      let currentY = addReportHeader({
        doc,
        title: "Financial Reports",
        subtitle: `${period === "6months" ? "Last 6 Months" : "Last 12 Months"} Analysis`,
        includeDate: true
      });

      currentY += 10;

      // Summary section
      currentY = addSummarySection(doc, currentY, [
        { label: "Total Income", value: formatCurrency(totalIncome) },
        { label: "Total Expenses", value: formatCurrency(totalExpenses) },
        { label: "Net Profit", value: `${totalProfitNum >= 0 ? '' : '-'}${formatCurrency(Math.abs(totalProfitNum))}`, highlight: true },
        { label: "Avg Monthly Income", value: formatCurrency(avgMonthlyIncome) },
        { label: "Avg Monthly Expenses", value: formatCurrency(avgMonthlyExpenses) }
      ]);

      currentY += 20;

      // Table header
      currentY = createTableHeader(doc, currentY, [
        { label: "Month", width: 120, align: "left" },
        { label: "Income", width: 120, align: "right" },
        { label: "Expenses", width: 120, align: "right" },
        { label: "Net Profit/Loss", width: 120, align: "right" }
      ]);

      // Table rows
      let isEven = false;
      monthlyData.forEach((data, index) => {
        // Check if we need a new page
        if (currentY > 700) {
          addReportFooter(doc);
          doc.addPage();
          currentY = 40;
        }

        const profitNum = parseFloat(data.profit);
        currentY = createTableRow(doc, currentY, [
          { text: data.month, width: 120, align: "left" },
          { text: formatCurrency(data.income), width: 120, align: "right" },
          { text: formatCurrency(data.expenses), width: 120, align: "right" },
          { text: `${profitNum >= 0 ? '+' : '-'}${formatCurrency(Math.abs(profitNum))}`, width: 120, align: "right", bold: true }
        ], isEven);

        isEven = !isEven;
      });

      // Add footer
      addReportFooter(doc);

      // Stream to response
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=Financial-Reports.pdf");

      doc.pipe(res);
      doc.end();
    } catch (error: any) {
      console.error("Financial Reports PDF export error:", error);
      res.status(500).json({ error: "Failed to export PDF" });
    }
  });

  // Financial Reports Excel Export
  app.get("/api/financial-reports/export-excel", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export Financial Reports
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const period = (req.query.period || "12months") as "6months" | "12months";
      const monthsCount = period === "6months" ? 6 : 12;

      // Fetch all data
      const allIncomes = await db.select().from(income);
      const allExpenses = await db.select().from(expenses);

      // Calculate monthly data using Decimal.js
      const now = new Date();
      type MonthlyData = {
        month: string;
        income: string;
        expenses: string;
        profit: string;
      };

      const monthlyData: MonthlyData[] = [];
      for (let i = monthsCount - 1; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const startDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const endDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

        const monthIncomes = allIncomes.filter(inc => {
          const incDate = new Date(typeof inc.date === 'string' ? inc.date : inc.date.toISOString());
          return incDate >= startDate && incDate <= endDate;
        });

        const monthExpenses = allExpenses.filter(exp => {
          const expDate = new Date(typeof exp.date === 'string' ? exp.date : exp.date.toISOString());
          return expDate >= startDate && expDate <= endDate;
        });

        const totalIncome = sumAmounts(monthIncomes.map(inc => inc.amount));
        const totalExpenses = sumAmounts(monthExpenses.map(exp => exp.amount));
        const profit = new Decimal(totalIncome).minus(totalExpenses).toFixed(2);

        monthlyData.push({
          month: format(monthDate, 'MMM yyyy'),
          income: totalIncome,
          expenses: totalExpenses,
          profit: profit,
        });
      }

      // Calculate totals using Decimal.js
      const totalIncome = sumAmounts(monthlyData.map(m => m.income));
      const totalExpenses = sumAmounts(monthlyData.map(m => m.expenses));
      const totalProfit = new Decimal(totalIncome).minus(totalExpenses).toFixed(2);
      const totalProfitNum = parseFloat(totalProfit);
      const avgMonthlyIncome = new Decimal(totalIncome).dividedBy(monthsCount).toFixed(2);
      const avgMonthlyExpenses = new Decimal(totalExpenses).dividedBy(monthsCount).toFixed(2);

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Financial Reports");

      // Set column widths
      worksheet.columns = [
        { width: 20 },  // Month
        { width: 18 },  // Income
        { width: 18 },  // Expenses
        { width: 20 }   // Net Profit/Loss
      ];

      // Add company header with branding
      worksheet.mergeCells('A1:D1');
      const titleRow = worksheet.getCell('A1');
      titleRow.value = COMPANY_INFO.name;
      titleRow.font = { size: 16, bold: true, color: { argb: 'FFE11D26' } };
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A2:D2');
      const addressRow1 = worksheet.getCell('A2');
      addressRow1.value = COMPANY_INFO.address1;
      addressRow1.font = { size: 10 };
      addressRow1.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A3:D3');
      const addressRow2 = worksheet.getCell('A3');
      addressRow2.value = `${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`;
      addressRow2.font = { size: 10 };
      addressRow2.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A4:D4');
      const contactRow = worksheet.getCell('A4');
      contactRow.value = `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`;
      contactRow.font = { size: 10 };
      contactRow.alignment = { horizontal: 'center' };

      // Add report title
      worksheet.addRow([]);
      worksheet.mergeCells('A6:D6');
      const reportTitle = worksheet.getCell('A6');
      reportTitle.value = "Financial Reports";
      reportTitle.font = { size: 18, bold: true };
      reportTitle.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A7:D7');
      const subtitle = worksheet.getCell('A7');
      subtitle.value = `${period === "6months" ? "Last 6 Months" : "Last 12 Months"} Analysis`;
      subtitle.font = { size: 12 };
      subtitle.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A8:D8');
      const dateRow = worksheet.getCell('A8');
      dateRow.value = `Generated on: ${new Date().toLocaleString()}`;
      dateRow.font = { size: 10, italic: true };
      dateRow.alignment = { horizontal: 'center' };

      let currentRow = 10;

      // Summary section
      const summaryRow1 = worksheet.getRow(currentRow);
      summaryRow1.values = ["Total Income", formatCurrency(totalIncome), "Avg Monthly Income", formatCurrency(avgMonthlyIncome)];
      summaryRow1.font = { bold: true };
      currentRow++;

      const summaryRow2 = worksheet.getRow(currentRow);
      summaryRow2.values = ["Total Expenses", formatCurrency(totalExpenses), "Avg Monthly Expenses", formatCurrency(avgMonthlyExpenses)];
      summaryRow2.font = { bold: true };
      currentRow++;

      const summaryRow3 = worksheet.getRow(currentRow);
      summaryRow3.values = ["Net Profit", `${totalProfitNum >= 0 ? '' : '-'}${formatCurrency(Math.abs(totalProfitNum))}`, "", ""];
      summaryRow3.font = { size: 12, bold: true, color: { argb: totalProfitNum >= 0 ? 'FF10B981' : 'FFEF4444' } };
      currentRow += 3;

      // Table header
      const headerRow = worksheet.getRow(currentRow);
      headerRow.values = ["Month", "Income", "Expenses", "Net Profit/Loss"];
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D26' } };
      headerRow.alignment = { horizontal: 'left', vertical: 'middle' };
      currentRow++;

      // Add data rows
      monthlyData.forEach(data => {
        const row = worksheet.getRow(currentRow);
        const profitNum = parseFloat(data.profit);
        row.values = [
          data.month,
          formatCurrency(data.income),
          formatCurrency(data.expenses),
          `${profitNum >= 0 ? '+' : '-'}${formatCurrency(Math.abs(profitNum))}`
        ];
        row.alignment = { horizontal: 'left', vertical: 'middle' };
        currentRow++;
      });

      // Set response headers
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=Financial-Reports.xlsx");

      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      console.error("Financial Reports Excel export error:", error);
      res.status(500).json({ error: "Failed to export Excel" });
    }
  });

  // Financial Reports Word Export
  app.get("/api/financial-reports/export-word", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export Financial Reports
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const period = (req.query.period || "12months") as "6months" | "12months";
      const monthsCount = period === "6months" ? 6 : 12;

      // Fetch all data
      const allIncomes = await db.select().from(income);
      const allExpenses = await db.select().from(expenses);

      // Calculate monthly data using Decimal.js
      const now = new Date();
      type MonthlyData = {
        month: string;
        income: string;
        expenses: string;
        profit: string;
      };

      const monthlyData: MonthlyData[] = [];
      for (let i = monthsCount - 1; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const startDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
        const endDate = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59);

        const monthIncomes = allIncomes.filter(inc => {
          const incDate = new Date(typeof inc.date === 'string' ? inc.date : inc.date.toISOString());
          return incDate >= startDate && incDate <= endDate;
        });

        const monthExpenses = allExpenses.filter(exp => {
          const expDate = new Date(typeof exp.date === 'string' ? exp.date : exp.date.toISOString());
          return expDate >= startDate && expDate <= endDate;
        });

        const totalIncome = sumAmounts(monthIncomes.map(inc => inc.amount));
        const totalExpenses = sumAmounts(monthExpenses.map(exp => exp.amount));
        const profit = new Decimal(totalIncome).minus(totalExpenses).toFixed(2);

        monthlyData.push({
          month: format(monthDate, 'MMM yyyy'),
          income: totalIncome,
          expenses: totalExpenses,
          profit: profit,
        });
      }

      // Calculate totals using Decimal.js
      const totalIncome = sumAmounts(monthlyData.map(m => m.income));
      const totalExpenses = sumAmounts(monthlyData.map(m => m.expenses));
      const totalProfit = new Decimal(totalIncome).minus(totalExpenses).toFixed(2);
      const totalProfitNum = parseFloat(totalProfit);
      const avgMonthlyIncome = new Decimal(totalIncome).dividedBy(monthsCount).toFixed(2);
      const avgMonthlyExpenses = new Decimal(totalExpenses).dividedBy(monthsCount).toFixed(2);

      // Create Word document
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Company Header
            new Paragraph({
              children: [new TextRun({ text: COMPANY_INFO.name, bold: true, size: 32, color: "E11D26" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: COMPANY_INFO.address1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),

            // Report Title
            new Paragraph({
              children: [new TextRun({ text: "Financial Reports", bold: true, size: 28, color: "E11D26" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: `${period === "6months" ? "Last 6 Months" : "Last 12 Months"} Analysis`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [new TextRun({ text: `Generated on: ${new Date().toLocaleString()}`, italics: true })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),

            // Summary
            new Paragraph({
              children: [
                new TextRun({ text: "Total Income: ", bold: true }),
                new TextRun(formatCurrency(totalIncome))
              ],
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Total Expenses: ", bold: true }),
                new TextRun(formatCurrency(totalExpenses))
              ],
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Net Profit: ", bold: true, size: 28 }),
                new TextRun({
                  text: `${totalProfitNum >= 0 ? '' : '-'}${formatCurrency(Math.abs(totalProfitNum))}`,
                  bold: true,
                  size: 28,
                  color: totalProfitNum >= 0 ? "10B981" : "EF4444"
                })
              ],
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Avg Monthly Income: ", bold: true }),
                new TextRun(formatCurrency(avgMonthlyIncome))
              ],
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Avg Monthly Expenses: ", bold: true }),
                new TextRun(formatCurrency(avgMonthlyExpenses))
              ],
              spacing: { after: 300 }
            }),

            // Monthly Breakdown Table
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                // Header
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Month", bold: true })], alignment: AlignmentType.LEFT })],
                      width: { size: 25, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Income", bold: true })], alignment: AlignmentType.RIGHT })],
                      width: { size: 25, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Expenses", bold: true })], alignment: AlignmentType.RIGHT })],
                      width: { size: 25, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Net Profit/Loss", bold: true })], alignment: AlignmentType.RIGHT })],
                      width: { size: 25, type: WidthType.PERCENTAGE }
                    })
                  ]
                }),
                // Data rows
                ...monthlyData.map(data => {
                  const profitNum = parseFloat(data.profit);
                  return new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ text: data.month, alignment: AlignmentType.LEFT })] }),
                      new TableCell({ children: [new Paragraph({ text: formatCurrency(data.income), alignment: AlignmentType.RIGHT })] }),
                      new TableCell({ children: [new Paragraph({ text: formatCurrency(data.expenses), alignment: AlignmentType.RIGHT })] }),
                      new TableCell({
                        children: [new Paragraph({
                          children: [new TextRun({
                            text: `${profitNum >= 0 ? '+' : '-'}${formatCurrency(Math.abs(profitNum))}`,
                            bold: true,
                            color: profitNum >= 0 ? "10B981" : "EF4444"
                          })],
                          alignment: AlignmentType.RIGHT
                        })]
                      })
                    ]
                  });
                })
              ]
            }),

            // Footer
            new Paragraph({
              text: "",
              spacing: { before: 600 }
            }),
            new Paragraph({
              text: `${COMPANY_INFO.name} | ${COMPANY_INFO.address1}, ${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`,
              alignment: AlignmentType.CENTER
            })
          ]
        }]
      });

      // Set response headers
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", "attachment; filename=Financial-Reports.docx");

      // Write to response using Packer
      const { Packer } = await import("docx");
      const buffer = await Packer.toBuffer(doc);
      res.send(buffer);
    } catch (error: any) {
      console.error("Financial Reports Word export error:", error);
      res.status(500).json({ error: "Failed to export Word document" });
    }
  });

  // ========== SALARY PROCESSING SYSTEM API ENDPOINTS ==========

  // POST /api/payroll/generate - Generate salary for selected month/year based on attendance
  app.post("/api/payroll/generate", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can generate salary
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { month, year } = req.body;

      // Validate month and year
      if (!month || !year || month < 1 || month > 12 || year < 2000 || year > 2100) {
        return res.status(400).json({ error: "Valid month (1-12) and year (2000-2100) are required" });
      }

      // Delete existing payroll records for this month/year to allow regeneration
      await db.delete(payroll).where(and(eq(payroll.month, month), eq(payroll.year, year)));

      // Get HR settings to check if overtime is enabled
      const [settings] = await db.select().from(hrSettings).limit(1);
      const overtimeEnabled = settings?.overtimeEnabled ?? false;

      console.log("🔍 PAYROLL GENERATION - Overtime Enabled:", overtimeEnabled);

      // Fetch all active employees with salary structure
      const employeesWithSalary = await db
        .select({
          employee: employees,
          user: users,
          salaryStructure: salaryStructure,
        })
        .from(employees)
        .leftJoin(users, eq(employees.userId, users.id))
        .leftJoin(salaryStructure, eq(employees.id, salaryStructure.employeeId));

      // Calculate salary for each employee
      const payrollRecords = [];
      for (const record of employeesWithSalary) {
        if (!record.salaryStructure) continue; // Skip employees without salary structure

        const employeeId = record.employee.id;
        const basicSalary = parseFloat(record.salaryStructure.basicSalary || "0");
        const houseAllowance = parseFloat(record.salaryStructure.houseAllowance || "0");
        const medicalAllowance = parseFloat(record.salaryStructure.medicalAllowance || "0");
        const travelAllowance = parseFloat(record.salaryStructure.travelAllowance || "0");
        const foodAllowance = parseFloat(record.salaryStructure.foodAllowance || "0");
        const otherAllowances = parseFloat(record.salaryStructure.otherAllowances || "0");
        const totalAllowances = houseAllowance + medicalAllowance + travelAllowance + foodAllowance + otherAllowances;

        // Calculate attendance stats for the month
        const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
        const lastDay = new Date(year, month, 0).toISOString().split("T")[0];

        const attendanceRecords = await db
          .select()
          .from(attendance)
          .where(
            and(
              eq(attendance.userId, record.employee.userId!),
              sql`${attendance.date} >= ${firstDay}`,
              sql`${attendance.date} <= ${lastDay}`
            )
          );

        // Count attendance stats
        let totalPresentDays = 0;
        let totalAbsentDays = 0;
        let totalLateDays = 0;
        let totalOvertimeHours = 0;
        let totalHalfDays = 0; // Track half-days separately for proper deduction calculation

        attendanceRecords.forEach((att) => {
          if (att.status === "present") totalPresentDays++;
          else if (att.status === "absent") totalAbsentDays++;
          else if (att.status === "late") {
            // Count late as present day + increment late counter
            totalPresentDays++;
            totalLateDays++;
          }
          else if (att.status === "half-day" || att.status === "half_day") {
            totalHalfDays++;
            // Count half-day as present for display purposes, deduction handled separately
            totalPresentDays++;
          }

          // Calculate overtime hours ONLY if overtime is enabled in HR settings
          if (overtimeEnabled && att.checkIn && att.checkOut) {
            const checkIn = new Date(att.checkIn);
            const checkOut = new Date(att.checkOut);

            // Validate that both timestamps are valid and checkOut is after checkIn
            if (!isNaN(checkIn.getTime()) && !isNaN(checkOut.getTime()) && checkOut > checkIn) {
              const hoursWorked = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);

              // Only calculate overtime if worked more than 8 hours
              if (hoursWorked > 8) {
                totalOvertimeHours += hoursWorked - 8;
              }
            }
          }
        });

        // Apply Late Policy: 3 Lates = 1 Absent (auto-convert)
        const lateAbsents = Math.floor(totalLateDays / 3);
        totalAbsentDays += lateAbsents;

        // Calculate deductions
        const dailyRate = basicSalary / 30;
        const hourlyRate = dailyRate / 8;

        const absentDeduction = dailyRate * totalAbsentDays;
        const lateDeduction = dailyRate * (totalLateDays % 3) * (1 / 3); // Remaining lates not yet converted to absent
        const halfDayDeduction = dailyRate * 0.5 * totalHalfDays; // Half-day = 0.5 × daily rate

        // ONLY calculate overtime amount if overtime is enabled
        const overtimeAmount = overtimeEnabled ? (hourlyRate * 1.5 * totalOvertimeHours) : 0;

        if (!overtimeEnabled && totalOvertimeHours > 0) {
          console.log(`⚠️ Overtime DISABLED - Skipping ${totalOvertimeHours.toFixed(2)} hours for employee ${record.employee.employeeId}`);
        }

        // Calculate final salary
        const grossSalary = basicSalary + totalAllowances;
        const totalDeductions = absentDeduction + lateDeduction + halfDayDeduction;
        const netSalary = grossSalary - totalDeductions + overtimeAmount;

        // Create payroll record
        const [newPayroll] = await db
          .insert(payroll)
          .values({
            employeeId: employeeId,
            month: month,
            year: year,
            basicSalary: basicSalary.toFixed(2),
            totalAllowances: totalAllowances.toFixed(2),
            overtimeAmount: overtimeAmount.toFixed(2),
            loanDeduction: "0",
            lateDeduction: (absentDeduction + lateDeduction).toFixed(2),
            otherDeductions: halfDayDeduction.toFixed(2),
            grossSalary: grossSalary.toFixed(2),
            netSalary: netSalary.toFixed(2),
            totalLateDays: totalLateDays,
            totalAbsentDays: Math.floor(totalAbsentDays), // Round down for display
            totalPresentDays: Math.floor(totalPresentDays),
            totalHalfDays: totalHalfDays,
            totalOvertimeHours: totalOvertimeHours.toFixed(2),
            workingDays: 30,
            status: "generated",
            generatedBy: req.userId,
          })
          .returning();

        payrollRecords.push(newPayroll);
      }

      res.json({
        success: true,
        message: `Salary generated for ${payrollRecords.length} employees`,
        count: payrollRecords.length,
      });
    } catch (error: any) {
      console.error("Salary generation error:", error);
      res.status(500).json({ error: "Failed to generate salary" });
    }
  });

  // POST /api/payroll/:id/adjustments - Add manual adjustment to payroll
  app.post("/api/payroll/:id/adjustments", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const payrollId = req.params.id;
      const { type, amount, reason } = req.body;

      // Validate input
      if (!type || !amount || !reason) {
        return res.status(400).json({ error: "Type, amount, and reason are required" });
      }

      if (!["bonus", "penalty", "loan_deduction", "advance", "other"].includes(type)) {
        return res.status(400).json({ error: "Invalid adjustment type" });
      }

      // Check if payroll record exists
      const [payrollRecord] = await db.select().from(payroll).where(eq(payroll.id, payrollId));
      if (!payrollRecord) {
        return res.status(404).json({ error: "Payroll record not found" });
      }

      // Create adjustment record
      await db.insert(salaryAdjustments).values({
        payrollId: payrollId,
        type: type,
        amount: amount.toString(),
        reason: reason,
        createdBy: req.userId!,
      });

      // Recalculate net salary with adjustments
      const adjustments = await db.select().from(salaryAdjustments).where(eq(salaryAdjustments.payrollId, payrollId));

      let totalAdjustments = 0;
      adjustments.forEach((adj) => {
        const adjAmount = parseFloat(adj.amount);
        if (adj.type === "bonus") {
          totalAdjustments += adjAmount;
        } else {
          totalAdjustments -= adjAmount;
        }
      });

      const baseNetSalary =
        parseFloat(payrollRecord.grossSalary ?? "0")
        - parseFloat(payrollRecord.lateDeduction ?? "0")
        + parseFloat(payrollRecord.overtimeAmount ?? "0");
      const newNetSalary = baseNetSalary + totalAdjustments;

      // Update payroll record with new net salary and other deductions
      await db
        .update(payroll)
        .set({
          otherDeductions: Math.abs(totalAdjustments < 0 ? totalAdjustments : 0).toFixed(2),
          netSalary: newNetSalary.toFixed(2),
        })
        .where(eq(payroll.id, payrollId));

      res.json({ success: true, message: "Adjustment added successfully" });
    } catch (error: any) {
      console.error("Add adjustment error:", error);
      res.status(500).json({ error: "Failed to add adjustment" });
    }
  });

  // GET /api/payroll/:id/adjustments - Get all adjustments for a payroll record
  app.get("/api/payroll/:id/adjustments", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const payrollId = req.params.id;
      const adjustments = await db
        .select({
          adjustment: salaryAdjustments,
          createdBy: users,
        })
        .from(salaryAdjustments)
        .leftJoin(users, eq(salaryAdjustments.createdBy, users.id))
        .where(eq(salaryAdjustments.payrollId, payrollId));

      res.json(adjustments);
    } catch (error: any) {
      console.error("Fetch adjustments error:", error);
      res.status(500).json({ error: "Failed to fetch adjustments" });
    }
  });

  // PATCH /api/payroll/:id/status - Update payment status (generated -> paid)
  app.patch("/api/payroll/:id/status", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const payrollId = req.params.id;
      const { status } = req.body;

      if (!["draft", "generated", "paid"].includes(status)) {
        return res.status(400).json({ error: "Invalid status" });
      }

      const updateData: any = { status };
      if (status === "paid") {
        updateData.paidAt = new Date();
      }

      await db.update(payroll).set(updateData).where(eq(payroll.id, payrollId));

      res.json({ success: true, message: "Status updated successfully" });
    } catch (error: any) {
      console.error("Update status error:", error);
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  // DELETE /api/payroll/:payrollId/adjustments/:adjustmentId - Delete a manual adjustment
  app.delete("/api/payroll/:payrollId/adjustments/:adjustmentId", authenticateToken, async (req: AuthRequest, res) => {
    try {
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { payrollId, adjustmentId } = req.params;

      // Delete the adjustment
      await db.delete(salaryAdjustments).where(eq(salaryAdjustments.id, adjustmentId));

      // Recalculate net salary
      const [payrollRecord] = await db.select().from(payroll).where(eq(payroll.id, payrollId));
      if (!payrollRecord) {
        return res.status(404).json({ error: "Payroll record not found" });
      }

      const adjustments = await db.select().from(salaryAdjustments).where(eq(salaryAdjustments.payrollId, payrollId));

      let totalAdjustments = 0;
      adjustments.forEach((adj) => {
        const adjAmount = parseFloat(adj.amount);
        if (adj.type === "bonus") {
          totalAdjustments += adjAmount;
        } else {
          totalAdjustments -= adjAmount;
        }
      });

      const baseNetSalary =
        parseFloat(payrollRecord.grossSalary ?? "0")
        - parseFloat(payrollRecord.lateDeduction ?? "0")
        + parseFloat(payrollRecord.overtimeAmount ?? "0");
      const newNetSalary = baseNetSalary + totalAdjustments;

      await db
        .update(payroll)
        .set({
          otherDeductions: Math.abs(totalAdjustments < 0 ? totalAdjustments : 0).toFixed(2),
          netSalary: newNetSalary.toFixed(2),
        })
        .where(eq(payroll.id, payrollId));

      res.json({ success: true, message: "Adjustment deleted successfully" });
    } catch (error: any) {
      console.error("Delete adjustment error:", error);
      res.status(500).json({ error: "Failed to delete adjustment" });
    }
  });

  // Payroll Report GET endpoint (filtered by month/year)
  app.get("/api/payroll-report", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can access payroll reports
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);

      // Validate month and year - check for NaN FIRST before any other validation
      if (isNaN(month) || isNaN(year) || !Number.isInteger(month) || !Number.isInteger(year)) {
        return res.status(400).json({ error: "Valid month and year are required" });
      }

      if (month < 1 || month > 12 || year < 2000 || year > 2100) {
        return res.status(400).json({ error: "Month must be 1-12 and year must be 2000-2100" });
      }

      // Fetch payroll records for the selected month/year
      const payrollRecords = await db
        .select({
          payroll: payroll,
          employee: employees,
          user: users,
        })
        .from(payroll)
        .leftJoin(employees, eq(payroll.employeeId, employees.id))
        .leftJoin(users, eq(employees.userId, users.id))
        .where(and(eq(payroll.month, month), eq(payroll.year, year)));

      return res.json(payrollRecords);
    } catch (error: any) {
      console.error("Payroll Report GET error:", error);
      return res.status(500).json({ error: "Failed to fetch payroll report" });
    }
  });

  // Helper function for professional signature footer with smart positioning
  function addSignatureFooter(doc: typeof PDFDocument.prototype, currentY: number): number {
    const signatureBoxWidth = 165;
    const signatureBoxHeight = 60;
    const gap = 12;
    const totalFooterHeight = signatureBoxHeight + 18; // Box + tagline

    // Check if we need a new page for signature block
    if (currentY + totalFooterHeight > 750) {
      doc.addPage();
      currentY = 40;
    }

    // Add some spacing before signature section
    currentY += 15;
    const footerY = currentY;

    const x1 = 40;
    const x2 = x1 + signatureBoxWidth + gap;
    const x3 = x2 + signatureBoxWidth + gap;

    const signatureFields = [
      { label: "Prepared By", name: "HR Manager", position: x1 },
      { label: "Verified By", name: "Accounts Head", position: x2 },
      { label: "Approved By", name: "Managing Director", position: x3 }
    ];

    signatureFields.forEach(field => {
      // Signature box
      doc.save();
      doc.roundedRect(field.position, footerY, signatureBoxWidth, signatureBoxHeight, 3)
        .strokeColor("#d6dae2")
        .lineWidth(1)
        .stroke();
      doc.restore();

      // Label
      doc.fontSize(8).font("Helvetica").fillColor("#6b7280");
      doc.text(field.label, field.position + 10, footerY + 10, { width: signatureBoxWidth - 20, align: "left" });

      // Signature line
      doc.moveTo(field.position + 10, footerY + 35)
        .lineTo(field.position + signatureBoxWidth - 10, footerY + 35)
        .strokeColor("#d6dae2")
        .lineWidth(1)
        .stroke();

      // Name
      doc.fontSize(9).font("Helvetica-Bold").fillColor(BRAND_COLORS.black);
      doc.text(field.name, field.position + 10, footerY + 40, { width: signatureBoxWidth - 20, align: "center" });
    });

    // Company tagline at bottom
    doc.fontSize(7).font("Helvetica-Oblique").fillColor(BRAND_COLORS.gray);
    doc.text("MaxTech BD - Smart Agency Control Hub", 40, footerY + signatureBoxHeight + 8, { width: 515, align: "center" });

    return footerY + totalFooterHeight;
  }

  // Payroll Report PDF Export - Corporate Grade Professional Design
  app.get("/api/payroll-report/export-pdf", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export Payroll Reports
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);

      // Validate month and year - check for NaN FIRST before any other validation
      if (isNaN(month) || isNaN(year) || !Number.isInteger(month) || !Number.isInteger(year)) {
        return res.status(400).json({ error: "Valid month and year are required" });
      }

      if (month < 1 || month > 12 || year < 2000 || year > 2100) {
        return res.status(400).json({ error: "Month must be 1-12 and year must be 2000-2100" });
      }

      // Fetch payroll records for the selected month/year with employee and user data
      const payrollRecords = await db
        .select({
          payroll: payroll,
          employee: employees,
          user: users,
        })
        .from(payroll)
        .leftJoin(employees, eq(payroll.employeeId, employees.id))
        .leftJoin(users, eq(employees.userId, users.id))
        .where(and(eq(payroll.month, month), eq(payroll.year, year)));

      // Calculate totals using Decimal.js with null-safe handling
      const totalGrossSalary = sumAmounts(payrollRecords.map(r => r.payroll.grossSalary || "0"));
      const totalDeductions = sumAmounts(
        payrollRecords.flatMap(r => [
          r.payroll.loanDeduction || "0",
          r.payroll.lateDeduction || "0",
          r.payroll.otherDeductions || "0"
        ])
      );
      const totalNetSalary = sumAmounts(payrollRecords.map(r => r.payroll.netSalary || "0"));
      const totalEmployees = payrollRecords.length;
      const paidCount = payrollRecords.filter(r => r.payroll.status === "paid").length;

      // ===== CORPORATE-GRADE PDF GENERATION =====
      const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];

      let currentY = 30;
      const headerStartY = currentY;

      // ===== PROFESSIONAL HEADER (Non-Overlapping Three-Section Layout) =====
      const leftBounds = { x: 40, width: 90 };
      const centerBounds = { x: 140, width: 240 };
      const rightBounds = { x: 390, width: 165 };

      let maxHeaderHeight = 0;

      // LEFT: Logo
      let logoHeight = 75;
      try {
        const logoPath = path.join(__dirname, "../attached_assets/Untitled design (1)_1763794635122.png");
        doc.image(logoPath, leftBounds.x, headerStartY, { width: 75, height: 75 });
        maxHeaderHeight = Math.max(maxHeaderHeight, logoHeight);
      } catch (error) {
        console.warn("Logo not found");
        logoHeight = 0;
      }

      // CENTER: Company Details
      let centerY = headerStartY;
      let centerHeight = 0;

      doc.fontSize(16).font("Helvetica-Bold").fillColor(BRAND_COLORS.primary);
      const nameHeight = doc.heightOfString("MAXTECH BD", { width: centerBounds.width, align: "center" });
      doc.text("MAXTECH BD", centerBounds.x, centerY, { width: centerBounds.width, align: "center" });
      centerY += nameHeight + 4;
      centerHeight += nameHeight + 4;

      doc.fontSize(8).font("Helvetica").fillColor(BRAND_COLORS.black);
      const addr1Height = doc.heightOfString("522, SK Mujib Road (4th Floor)", { width: centerBounds.width, align: "center" });
      doc.text("522, SK Mujib Road (4th Floor)", centerBounds.x, centerY, { width: centerBounds.width, align: "center" });
      centerY += addr1Height + 2;
      centerHeight += addr1Height + 2;

      const addr2Height = doc.heightOfString("Agrabad, Double Mooring, Chattogram", { width: centerBounds.width, align: "center" });
      doc.text("Agrabad, Double Mooring, Chattogram", centerBounds.x, centerY, { width: centerBounds.width, align: "center" });
      centerY += addr2Height + 3;
      centerHeight += addr2Height + 3;

      doc.fontSize(7).font("Helvetica").fillColor(BRAND_COLORS.gray);
      const contactHeight = doc.heightOfString("Phone: +8801843180008 | Email: support@maxtechbd.com", { width: centerBounds.width, align: "center" });
      doc.text("Phone: +8801843180008 | Email: support@maxtechbd.com", centerBounds.x, centerY, { width: centerBounds.width, align: "center" });
      centerHeight += contactHeight;

      maxHeaderHeight = Math.max(maxHeaderHeight, centerHeight);

      // RIGHT: Report Info Box
      let rightY = headerStartY;
      const boxPadding = 10;
      const boxInnerWidth = rightBounds.width - (2 * boxPadding);

      doc.fontSize(10).font("Helvetica-Bold");
      const titleText = "Salary Sheet";
      const titleHeight = doc.heightOfString(titleText, { width: boxInnerWidth, align: "center" });

      doc.fontSize(7).font("Helvetica");
      const periodText = `Period: ${monthNames[month - 1]} ${year}`;
      const periodHeight = doc.heightOfString(periodText, { width: boxInnerWidth, align: "center" });

      const generatedText = `Generated: ${format(new Date(), "MMM dd, yyyy")}`;
      const generatedHeight = doc.heightOfString(generatedText, { width: boxInnerWidth, align: "center" });

      const lineSpacing = 4;
      const boxHeight = boxPadding + titleHeight + lineSpacing + periodHeight + lineSpacing + generatedHeight + boxPadding;

      doc.save();
      doc.roundedRect(rightBounds.x, rightY, rightBounds.width, boxHeight, 3)
        .fillAndStroke("#f7f8fa", "#d6dae2");
      doc.restore();

      rightY += boxPadding;

      doc.fontSize(10).font("Helvetica-Bold").fillColor(BRAND_COLORS.primary);
      doc.text(titleText, rightBounds.x + boxPadding, rightY, { width: boxInnerWidth, align: "center", lineBreak: false });
      rightY += titleHeight + lineSpacing;

      doc.fontSize(7).font("Helvetica").fillColor("#6b7280");
      doc.text(periodText, rightBounds.x + boxPadding, rightY, { width: boxInnerWidth, align: "center", lineBreak: false });
      rightY += periodHeight + lineSpacing;

      doc.text(generatedText, rightBounds.x + boxPadding, rightY, { width: boxInnerWidth, align: "center", lineBreak: false });

      maxHeaderHeight = Math.max(maxHeaderHeight, boxHeight);
      currentY = headerStartY + maxHeaderHeight + 12;

      // Header separator
      doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor(BRAND_COLORS.border).lineWidth(1).stroke();
      currentY += 18;

      // ===== SUMMARY CARDS (2 rows × 3 columns) - Fixed Dimensions =====
      const cardWidth = 165;
      const cardHeight = 55;
      const cardGap = 12;
      const cardX1 = 40;
      const cardX2 = cardX1 + cardWidth + cardGap;
      const cardX3 = cardX2 + cardWidth + cardGap;

      const summaryCards = [
        { label: "Total Employees", value: totalEmployees.toString(), color: "#3b82f6" },
        { label: "Paid", value: paidCount.toString(), color: "#10b981" },
        { label: "Pending", value: (totalEmployees - paidCount).toString(), color: "#f59e0b" },
        { label: "Gross Salary", value: formatCurrency(totalGrossSalary), color: "#059669" },
        { label: "Total Deductions", value: formatCurrency(totalDeductions), color: "#ef4444" },
        { label: "Net Payroll", value: formatCurrency(totalNetSalary), color: "#3b82f6" }
      ];

      const summaryStartY = currentY;

      // Row 1
      for (let i = 0; i < 3; i++) {
        const card = summaryCards[i];
        const xPos = i === 0 ? cardX1 : i === 1 ? cardX2 : cardX3;

        doc.save();
        doc.roundedRect(xPos, summaryStartY, cardWidth, cardHeight, 4)
          .fillAndStroke("#f7f8fa", "#d6dae2");
        doc.restore();

        doc.fontSize(9).font("Helvetica").fillColor("#6b7280");
        doc.text(card.label, xPos + 12, summaryStartY + 12, { width: cardWidth - 24, align: "left" });

        doc.fontSize(13).font("Helvetica-Bold").fillColor(card.color);
        doc.text(card.value, xPos + 12, summaryStartY + 28, { width: cardWidth - 24, align: "left" });
      }

      // Row 2
      const row2Y = summaryStartY + cardHeight + cardGap;
      for (let i = 3; i < 6; i++) {
        const card = summaryCards[i];
        const xPos = (i - 3) === 0 ? cardX1 : (i - 3) === 1 ? cardX2 : cardX3;

        doc.save();
        doc.roundedRect(xPos, row2Y, cardWidth, cardHeight, 4)
          .fillAndStroke("#f7f8fa", "#d6dae2");
        doc.restore();

        doc.fontSize(9).font("Helvetica").fillColor("#6b7280");
        doc.text(card.label, xPos + 12, row2Y + 12, { width: cardWidth - 24, align: "left" });

        doc.fontSize(13).font("Helvetica-Bold").fillColor(card.color);
        doc.text(card.value, xPos + 12, row2Y + 28, { width: cardWidth - 24, align: "left" });
      }

      currentY = row2Y + cardHeight + 18;

      // ===== DETAILED SALARY TABLE =====
      const tableX = 40;
      const colWidths = [150, 90, 90, 90, 95]; // Employee, Basic, Allowances, Deductions, Net
      const totalTableWidth = colWidths.reduce((sum, w) => sum + w, 0);

      // Table Header
      doc.save();
      doc.rect(tableX, currentY, totalTableWidth, 32).fillAndStroke(BRAND_COLORS.primary, BRAND_COLORS.primary);
      doc.restore();

      doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff");
      const headerLabels = ["Employee Name", "Basic Salary", "Allowances", "Deductions", "Net Salary"];
      let colX = tableX + 8;
      headerLabels.forEach((label, i) => {
        const align = i === 0 ? "left" : "right";
        const width = colWidths[i] - 16;
        doc.text(label, colX, currentY + 10, { width, align });
        colX += colWidths[i];
      });

      currentY += 32;

      // Table Rows
      let isEven = false;
      payrollRecords.forEach((record) => {
        if (currentY > 680) {
          // Start new page for next row
          doc.addPage();
          currentY = 40;

          // Re-draw table header on new page
          doc.save();
          doc.rect(tableX, currentY, totalTableWidth, 32).fillAndStroke(BRAND_COLORS.primary, BRAND_COLORS.primary);
          doc.restore();

          doc.fontSize(9).font("Helvetica-Bold").fillColor("#ffffff");
          let headerColX = tableX + 8;
          headerLabels.forEach((label, i) => {
            const align = i === 0 ? "left" : "right";
            const width = colWidths[i] - 16;
            doc.text(label, headerColX, currentY + 10, { width, align });
            headerColX += colWidths[i];
          });

          currentY += 32;
          isEven = false; // Reset alternation on new page
        }

        const totalDed = sumAmounts([
          record.payroll.loanDeduction || "0",
          record.payroll.lateDeduction || "0",
          record.payroll.otherDeductions || "0"
        ]);

        const bgColor = isEven ? "#fbfbfb" : "#ffffff";

        doc.save();
        doc.rect(tableX, currentY, totalTableWidth, 28).fillAndStroke(bgColor, "#e5e7eb");
        doc.restore();

        doc.fontSize(9).font("Helvetica").fillColor(BRAND_COLORS.black);

        colX = tableX + 8;
        const rowData = [
          { text: record.user?.fullName || "Unknown", align: "left" as const },
          { text: formatCurrency(record.payroll.basicSalary || "0"), align: "right" as const },
          { text: formatCurrency(record.payroll.totalAllowances || "0"), align: "right" as const },
          { text: formatCurrency(totalDed), align: "right" as const },
          { text: formatCurrency(record.payroll.netSalary || "0"), align: "right" as const, bold: true }
        ];

        rowData.forEach((item, i) => {
          if (item.bold) doc.font("Helvetica-Bold");
          else doc.font("Helvetica");

          const width = colWidths[i] - 16;
          doc.text(item.text, colX, currentY + 8, { width, align: item.align });
          colX += colWidths[i];
        });

        currentY += 28;
        isEven = !isEven;
      });

      // Subtotal Rows
      currentY += 5;

      // Gross Earnings
      doc.save();
      doc.rect(tableX, currentY, totalTableWidth, 30).fillAndStroke("#f0fdf4", "#86efac");
      doc.restore();

      doc.fontSize(10).font("Helvetica-Bold").fillColor("#065f46");
      doc.text("Total Gross Earnings", tableX + 8, currentY + 9, { width: colWidths[0] + colWidths[1] + colWidths[2] - 16, align: "right" });
      doc.text(formatCurrency(totalGrossSalary), tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 8, currentY + 9, { width: colWidths[4] - 16, align: "right" });
      currentY += 30;

      // Total Deductions
      doc.save();
      doc.rect(tableX, currentY, totalTableWidth, 30).fillAndStroke("#fef2f2", "#fca5a5");
      doc.restore();

      doc.fontSize(10).font("Helvetica-Bold").fillColor("#991b1b");
      doc.text("Total Deductions", tableX + 8, currentY + 9, { width: colWidths[0] + colWidths[1] + colWidths[2] - 16, align: "right" });
      doc.text(formatCurrency(totalDeductions), tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 8, currentY + 9, { width: colWidths[4] - 16, align: "right" });
      currentY += 30;

      // Net Payroll
      doc.save();
      doc.rect(tableX, currentY, totalTableWidth, 35).fillAndStroke("#eff6ff", "#3b82f6");
      doc.restore();

      doc.fontSize(11).font("Helvetica-Bold").fillColor("#1e40af");
      doc.text("NET PAYROLL COST", tableX + 8, currentY + 11, { width: colWidths[0] + colWidths[1] + colWidths[2] - 16, align: "right" });
      doc.fontSize(13).font("Helvetica-Bold");
      doc.text(formatCurrency(totalNetSalary), tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + 8, currentY + 10, { width: colWidths[4] - 16, align: "right" });
      currentY += 35;

      // Add signature footer with smart positioning
      currentY = addSignatureFooter(doc, currentY);

      // Stream response
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=Salary-Sheet-${monthNames[month - 1]}-${year}.pdf`);

      doc.pipe(res);
      doc.end();
    } catch (error: any) {
      console.error("Payroll Report PDF export error:", error);
      res.status(500).json({ error: "Failed to export PDF" });
    }
  });

  // Payroll Report Excel Export
  app.get("/api/payroll-report/export-excel", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export Payroll Reports
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);

      // Validate month and year - check for NaN FIRST before any other validation
      if (isNaN(month) || isNaN(year) || !Number.isInteger(month) || !Number.isInteger(year)) {
        return res.status(400).json({ error: "Valid month and year are required" });
      }

      if (month < 1 || month > 12 || year < 2000 || year > 2100) {
        return res.status(400).json({ error: "Month must be 1-12 and year must be 2000-2100" });
      }

      // Fetch payroll records
      const payrollRecords = await db
        .select({
          payroll: payroll,
          employee: employees,
          user: users,
        })
        .from(payroll)
        .leftJoin(employees, eq(payroll.employeeId, employees.id))
        .leftJoin(users, eq(employees.userId, users.id))
        .where(and(eq(payroll.month, month), eq(payroll.year, year)));

      // Calculate totals with null-safe handling
      const totalGrossSalary = sumAmounts(payrollRecords.map(r => r.payroll.grossSalary || "0"));
      const totalDeductions = sumAmounts(
        payrollRecords.flatMap(r => [
          r.payroll.loanDeduction || "0",
          r.payroll.lateDeduction || "0",
          r.payroll.otherDeductions || "0"
        ])
      );
      const totalNetSalary = sumAmounts(payrollRecords.map(r => r.payroll.netSalary || "0"));

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Payroll Report");

      // Set column widths
      worksheet.columns = [
        { width: 25 },  // Employee Name
        { width: 15 },  // Employee ID
        { width: 15 },  // Basic Salary
        { width: 15 },  // Allowances
        { width: 15 },  // Deductions
        { width: 15 },  // Net Salary
        { width: 12 },  // Present
        { width: 12 }   // Status
      ];

      // Add company header
      worksheet.mergeCells('A1:H1');
      const titleRow = worksheet.getCell('A1');
      titleRow.value = COMPANY_INFO.name;
      titleRow.font = { size: 16, bold: true, color: { argb: 'FFE11D26' } };
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A2:H2');
      const addressRow1 = worksheet.getCell('A2');
      addressRow1.value = COMPANY_INFO.address1;
      addressRow1.font = { size: 10 };
      addressRow1.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A3:H3');
      const addressRow2 = worksheet.getCell('A3');
      addressRow2.value = `${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`;
      addressRow2.font = { size: 10 };
      addressRow2.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A4:H4');
      const contactRow = worksheet.getCell('A4');
      contactRow.value = `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`;
      contactRow.font = { size: 10 };
      contactRow.alignment = { horizontal: 'center' };

      // Add report title
      worksheet.addRow([]);
      worksheet.mergeCells('A6:H6');
      const reportTitle = worksheet.getCell('A6');
      reportTitle.value = "Payroll Report";
      reportTitle.font = { size: 18, bold: true };
      reportTitle.alignment = { horizontal: 'center' };

      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
      worksheet.mergeCells('A7:H7');
      const subtitle = worksheet.getCell('A7');
      subtitle.value = `${monthNames[month - 1]} ${year}`;
      subtitle.font = { size: 12 };
      subtitle.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A8:H8');
      const dateRow = worksheet.getCell('A8');
      dateRow.value = `Generated on: ${new Date().toLocaleString()}`;
      dateRow.font = { size: 10, italic: true };
      dateRow.alignment = { horizontal: 'center' };

      let currentRow = 10;

      // Summary section
      const summaryRow1 = worksheet.getRow(currentRow);
      summaryRow1.values = ["Total Employees", payrollRecords.length, "", "Gross Salary", formatCurrency(totalGrossSalary)];
      summaryRow1.font = { bold: true };
      currentRow++;

      const summaryRow2 = worksheet.getRow(currentRow);
      summaryRow2.values = ["Paid Employees", payrollRecords.filter(r => r.payroll.status === "paid").length, "", "Total Deductions", formatCurrency(totalDeductions)];
      summaryRow2.font = { bold: true };
      currentRow++;

      const summaryRow3 = worksheet.getRow(currentRow);
      summaryRow3.values = ["", "", "", "Net Payroll Cost", formatCurrency(totalNetSalary)];
      summaryRow3.font = { size: 12, bold: true, color: { argb: 'FF10B981' } };
      currentRow += 3;

      // Table header
      const headerRow = worksheet.getRow(currentRow);
      headerRow.values = ["Employee Name", "Employee ID", "Basic Salary", "Allowances", "Deductions", "Net Salary", "Present", "Status"];
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D26' } };
      headerRow.alignment = { horizontal: 'left', vertical: 'middle' };
      currentRow++;

      // Add data rows
      payrollRecords.forEach(record => {
        const totalDed = sumAmounts([
          record.payroll.loanDeduction || "0",
          record.payroll.lateDeduction || "0",
          record.payroll.otherDeductions || "0"
        ]);

        const row = worksheet.getRow(currentRow);
        row.values = [
          record.user?.fullName || "Unknown",
          record.employee?.employeeId || "N/A",
          formatCurrency(record.payroll.basicSalary || "0"),
          formatCurrency(record.payroll.totalAllowances || "0"),
          formatCurrency(totalDed),
          formatCurrency(record.payroll.netSalary || "0"),
          `${record.payroll.totalPresentDays ?? 0}/${record.payroll.workingDays}`,
          record.payroll.status || "draft"
        ];
        row.alignment = { horizontal: 'left', vertical: 'middle' };
        currentRow++;
      });

      // Set response headers
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=Payroll-Report-${month}-${year}.xlsx`);

      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      console.error("Payroll Report Excel export error:", error);
      res.status(500).json({ error: "Failed to export Excel" });
    }
  });

  // Payroll Report Word Export
  app.get("/api/payroll-report/export-word", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export Payroll Reports
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);

      // Validate month and year - check for NaN FIRST before any other validation
      if (isNaN(month) || isNaN(year) || !Number.isInteger(month) || !Number.isInteger(year)) {
        return res.status(400).json({ error: "Valid month and year are required" });
      }

      if (month < 1 || month > 12 || year < 2000 || year > 2100) {
        return res.status(400).json({ error: "Month must be 1-12 and year must be 2000-2100" });
      }

      // Fetch payroll records
      const payrollRecords = await db
        .select({
          payroll: payroll,
          employee: employees,
          user: users,
        })
        .from(payroll)
        .leftJoin(employees, eq(payroll.employeeId, employees.id))
        .leftJoin(users, eq(employees.userId, users.id))
        .where(and(eq(payroll.month, month), eq(payroll.year, year)));

      // Calculate totals with null-safe handling
      const totalGrossSalary = sumAmounts(payrollRecords.map(r => r.payroll.grossSalary || "0"));
      const totalDeductions = sumAmounts(
        payrollRecords.flatMap(r => [
          r.payroll.loanDeduction || "0",
          r.payroll.lateDeduction || "0",
          r.payroll.otherDeductions || "0"
        ])
      );
      const totalNetSalary = sumAmounts(payrollRecords.map(r => r.payroll.netSalary || "0"));

      // Create Word document
      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Company Header
            new Paragraph({
              children: [new TextRun({ text: COMPANY_INFO.name, bold: true, size: 32, color: "E11D26" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: COMPANY_INFO.address1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),

            // Report Title
            new Paragraph({
              children: [new TextRun({ text: "Payroll Report", bold: true, size: 28, color: "E11D26" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: `${monthNames[month - 1]} ${year}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [new TextRun({ text: `Generated on: ${new Date().toLocaleString()}`, italics: true })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),

            // Summary
            new Paragraph({
              children: [
                new TextRun({ text: "Total Employees: ", bold: true }),
                new TextRun(payrollRecords.length.toString())
              ],
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Paid Employees: ", bold: true }),
                new TextRun(payrollRecords.filter(r => r.payroll.status === "paid").length.toString())
              ],
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Gross Salary: ", bold: true }),
                new TextRun(formatCurrency(totalGrossSalary))
              ],
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Total Deductions: ", bold: true }),
                new TextRun(formatCurrency(totalDeductions))
              ],
              spacing: { after: 100 }
            }),
            new Paragraph({
              children: [
                new TextRun({ text: "Net Payroll Cost: ", bold: true, size: 28 }),
                new TextRun({
                  text: formatCurrency(totalNetSalary),
                  bold: true,
                  size: 28,
                  color: "10B981"
                })
              ],
              spacing: { after: 300 }
            }),

            // Employee Breakdown Table
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                // Header
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Employee", bold: true })], alignment: AlignmentType.LEFT })],
                      width: { size: 25, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Basic", bold: true })], alignment: AlignmentType.RIGHT })],
                      width: { size: 15, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Allowances", bold: true })], alignment: AlignmentType.RIGHT })],
                      width: { size: 15, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Deductions", bold: true })], alignment: AlignmentType.RIGHT })],
                      width: { size: 15, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Net Salary", bold: true })], alignment: AlignmentType.RIGHT })],
                      width: { size: 15, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Status", bold: true })], alignment: AlignmentType.CENTER })],
                      width: { size: 15, type: WidthType.PERCENTAGE }
                    })
                  ]
                }),
                // Data rows
                ...payrollRecords.map(record => {
                  const totalDed = new Decimal(record.payroll.loanDeduction || "0")
                    .plus(record.payroll.lateDeduction || "0")
                    .plus(record.payroll.otherDeductions || "0")
                    .toFixed(2);

                  return new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ text: record.user?.fullName || "Unknown", alignment: AlignmentType.LEFT })] }),
                      new TableCell({ children: [new Paragraph({ text: formatCurrency(record.payroll.basicSalary || "0"), alignment: AlignmentType.RIGHT })] }),
                      new TableCell({ children: [new Paragraph({ text: formatCurrency(record.payroll.totalAllowances || "0"), alignment: AlignmentType.RIGHT })] }),
                      new TableCell({ children: [new Paragraph({ text: formatCurrency(totalDed), alignment: AlignmentType.RIGHT })] }),
                      new TableCell({
                        children: [new Paragraph({
                          children: [new TextRun({
                            text: formatCurrency(record.payroll.netSalary || "0"),
                            bold: true
                          })],
                          alignment: AlignmentType.RIGHT
                        })]
                      }),
                      new TableCell({ children: [new Paragraph({ text: record.payroll.status || "draft", alignment: AlignmentType.CENTER })] })
                    ]
                  });
                })
              ]
            }),

            // Footer
            new Paragraph({
              text: "",
              spacing: { before: 600 }
            }),
            new Paragraph({
              text: `${COMPANY_INFO.name} | ${COMPANY_INFO.address1}, ${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`,
              alignment: AlignmentType.CENTER
            })
          ]
        }]
      });

      // Set response headers
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename=Payroll-Report-${month}-${year}.docx`);

      // Write to response using Packer
      const { Packer } = await import("docx");
      const buffer = await Packer.toBuffer(doc);
      res.send(buffer);
    } catch (error: any) {
      console.error("Payroll Report Word export error:", error);
      res.status(500).json({ error: "Failed to export Word document" });
    }
  });

  // Salary Sheet GET endpoint (filtered by month/year)
  // Shows ALL employees with salary structures, with payroll data if available
  app.get("/api/salary-sheet", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can access Salary Sheet
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);

      // Validate month and year - check for NaN FIRST before any other validation
      if (isNaN(month) || isNaN(year) || !Number.isInteger(month) || !Number.isInteger(year)) {
        return res.status(400).json({ error: "Valid month and year are required" });
      }

      if (month < 1 || month > 12 || year < 2000 || year > 2100) {
        return res.status(400).json({ error: "Month must be 1-12 and year must be 2000-2100" });
      }

      // Fetch ALL employees with salary structures
      // Left join with payroll to get payroll data if it exists for this month/year
      // Join with users, departments, designations for complete info
      const salaryRecords = await db
        .select({
          employee: employees,
          user: users,
          department: departments,
          designation: designations,
          salaryStructure: salaryStructure,
          payroll: payroll,
        })
        .from(employees)
        .innerJoin(users, eq(employees.userId, users.id))
        .innerJoin(salaryStructure, eq(salaryStructure.employeeId, employees.id))
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .leftJoin(designations, eq(employees.designationId, designations.id))
        .leftJoin(
          payroll,
          and(
            eq(payroll.employeeId, employees.id),
            eq(payroll.month, month),
            eq(payroll.year, year)
          )
        )
        .where(eq(employees.status, "active"));

      return res.json(salaryRecords);
    } catch (error: any) {
      console.error("Salary Sheet GET error:", error);
      return res.status(500).json({ error: "Failed to fetch salary sheet" });
    }
  });

  // Salary Sheet PDF Export - Professional Corporate Format
  app.get("/api/salary-sheet/export-pdf", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export Salary Sheet
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);

      // Validate month and year - check for NaN FIRST before any other validation
      if (isNaN(month) || isNaN(year) || !Number.isInteger(month) || !Number.isInteger(year)) {
        return res.status(400).json({ error: "Valid month and year are required" });
      }

      if (month < 1 || month > 12 || year < 2000 || year > 2100) {
        return res.status(400).json({ error: "Month must be 1-12 and year must be 2000-2100" });
      }

      // Fetch ALL employees with salary structures
      const salaryRecords = await db
        .select({
          employee: employees,
          user: users,
          department: departments,
          designation: designations,
          salaryStructure: salaryStructure,
          payroll: payroll,
        })
        .from(employees)
        .innerJoin(users, eq(employees.userId, users.id))
        .innerJoin(salaryStructure, eq(salaryStructure.employeeId, employees.id))
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .leftJoin(designations, eq(employees.designationId, designations.id))
        .leftJoin(
          payroll,
          and(
            eq(payroll.employeeId, employees.id),
            eq(payroll.month, month),
            eq(payroll.year, year)
          )
        )
        .where(eq(employees.status, "active"));

      // Calculate totals using Decimal.js with null-safe handling
      const totalBasic = sumAmounts(salaryRecords.map(r =>
        r.payroll?.basicSalary || r.salaryStructure?.basicSalary || "0"
      ));
      const totalAllowances = sumAmounts(salaryRecords.map(r =>
        r.payroll?.totalAllowances || sumAmounts([
          r.salaryStructure?.houseAllowance || "0",
          r.salaryStructure?.foodAllowance || "0",
          r.salaryStructure?.travelAllowance || "0",
          r.salaryStructure?.medicalAllowance || "0",
          r.salaryStructure?.otherAllowances || "0"
        ])
      ));
      const totalOvertime = sumAmounts(salaryRecords.map(r => r.payroll?.overtimeAmount || "0"));
      const totalDeductions = sumAmounts(
        salaryRecords.flatMap(r => [
          r.payroll?.loanDeduction || "0",
          r.payroll?.lateDeduction || "0",
          r.payroll?.otherDeductions || "0"
        ])
      );
      const totalNetSalary = sumAmounts(salaryRecords.map(r => {
        if (r.payroll?.netSalary) {
          return r.payroll.netSalary;
        }
        const basic = r.salaryStructure?.basicSalary || "0";
        const allowances = sumAmounts([
          r.salaryStructure?.houseAllowance || "0",
          r.salaryStructure?.foodAllowance || "0",
          r.salaryStructure?.travelAllowance || "0",
          r.salaryStructure?.medicalAllowance || "0",
          r.salaryStructure?.otherAllowances || "0"
        ]);
        return sumAmounts([basic, allowances]);
      }));
      const totalEmployees = salaryRecords.length;

      // ========== PROFESSIONAL PAYROLL PDF - A4 LANDSCAPE ==========
      const doc = new PDFDocument({
        margin: 30,
        size: 'A4',
        layout: 'landscape', // Landscape for wide salary sheet
        bufferPages: true
      });

      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];

      const pageWidth = 842; // A4 Landscape width
      const pageHeight = 595; // A4 Landscape height
      const margin = 30;
      const contentWidth = pageWidth - (margin * 2);

      // ========== PROFESSIONAL HEADER ==========
      let currentY = margin;

      // Company Logo (Left)
      try {
        const logoPath = "attached_assets/Untitled design (1)_1763794635122.png";
        doc.image(logoPath, margin, currentY, { width: 70, height: 35 });
      } catch (error) {
        console.warn("Logo not found:", error);
      }

      // Company Info (Center)
      const headerCenterX = margin + 120;
      doc.fontSize(16).font("Helvetica-Bold").fillColor("#E11D26");
      doc.text("MaxTech BD", headerCenterX, currentY, { width: 500, align: "center" });

      doc.fontSize(9).font("Helvetica").fillColor("#333333");
      doc.text("522, SK Mujib Road (4th Floor), Agrabad, Double Mooring, Chattogram, Bangladesh", headerCenterX, currentY + 18, { width: 500, align: "center" });
      doc.text("Phone: +8801843180008 | Email: info@maxtechbd.com", headerCenterX, currentY + 30, { width: 500, align: "center" });

      currentY += 50;

      // Separator line
      doc.moveTo(margin, currentY).lineTo(pageWidth - margin, currentY).strokeColor("#E5E7EB").lineWidth(1).stroke();
      currentY += 15;

      // Report Title
      doc.fontSize(18).font("Helvetica-Bold").fillColor("#1E1E1E");
      doc.text(`Salary Sheet – ${monthNames[month - 1]} ${year}`, margin, currentY, { width: contentWidth, align: "center" });
      currentY += 25;

      const now = new Date();
      doc.fontSize(9).font("Helvetica").fillColor("#999999");
      doc.text(`Generated on: ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`, margin, currentY, { width: contentWidth, align: "center" });
      currentY += 25;

      // ========== COMPREHENSIVE SALARY TABLE ==========
      const tableX = margin;
      const tableWidth = contentWidth;
      // Column widths for landscape A4 (782px total) - 19 columns
      const colWidths = [
        55,  // Emp Code
        80,  // Name
        45,  // Dept
        50,  // Desig
        40,  // Basic
        35,  // HRA
        35,  // Med
        35,  // Conv
        35,  // Other
        45,  // Gross
        30,  // Present
        30,  // Absent
        30,  // Late
        30,  // Half
        35,  // OT Hrs
        40,  // Late Ded
        40,  // Loan
        40,  // Other Ded
        52   // Net Pay
      ];
      const rowHeight = 22;
      const cellPadding = 3;

      // Helper function to draw table header
      const drawTableHeader = (y: number): number => {
        doc.rect(tableX, y, tableWidth, rowHeight).fillAndStroke("#E11D26", "#E11D26");

        doc.fontSize(7).font("Helvetica-Bold").fillColor("#FFFFFF");
        let headerX = tableX;
        const headerY = y + 7;

        doc.text("Emp Code", headerX + cellPadding, headerY, { width: colWidths[0] - (cellPadding * 2), lineBreak: false }); headerX += colWidths[0];
        doc.text("Name", headerX + cellPadding, headerY, { width: colWidths[1] - (cellPadding * 2), lineBreak: false }); headerX += colWidths[1];
        doc.text("Dept", headerX + cellPadding, headerY, { width: colWidths[2] - (cellPadding * 2), lineBreak: false }); headerX += colWidths[2];
        doc.text("Desig", headerX + cellPadding, headerY, { width: colWidths[3] - (cellPadding * 2), lineBreak: false }); headerX += colWidths[3];
        doc.text("Basic", headerX + cellPadding, headerY, { width: colWidths[4] - (cellPadding * 2), align: "right", lineBreak: false }); headerX += colWidths[4];
        doc.text("HRA", headerX + cellPadding, headerY, { width: colWidths[5] - (cellPadding * 2), align: "right", lineBreak: false }); headerX += colWidths[5];
        doc.text("Med", headerX + cellPadding, headerY, { width: colWidths[6] - (cellPadding * 2), align: "right", lineBreak: false }); headerX += colWidths[6];
        doc.text("Conv", headerX + cellPadding, headerY, { width: colWidths[7] - (cellPadding * 2), align: "right", lineBreak: false }); headerX += colWidths[7];
        doc.text("Other", headerX + cellPadding, headerY, { width: colWidths[8] - (cellPadding * 2), align: "right", lineBreak: false }); headerX += colWidths[8];
        doc.text("Gross", headerX + cellPadding, headerY, { width: colWidths[9] - (cellPadding * 2), align: "right", lineBreak: false }); headerX += colWidths[9];
        doc.text("Pres", headerX + cellPadding, headerY, { width: colWidths[10] - (cellPadding * 2), align: "center", lineBreak: false }); headerX += colWidths[10];
        doc.text("Abs", headerX + cellPadding, headerY, { width: colWidths[11] - (cellPadding * 2), align: "center", lineBreak: false }); headerX += colWidths[11];
        doc.text("Late", headerX + cellPadding, headerY, { width: colWidths[12] - (cellPadding * 2), align: "center", lineBreak: false }); headerX += colWidths[12];
        doc.text("Half", headerX + cellPadding, headerY, { width: colWidths[13] - (cellPadding * 2), align: "center", lineBreak: false }); headerX += colWidths[13];
        doc.text("OT Hrs", headerX + cellPadding, headerY, { width: colWidths[14] - (cellPadding * 2), align: "right", lineBreak: false }); headerX += colWidths[14];
        doc.text("Late Ded", headerX + cellPadding, headerY, { width: colWidths[15] - (cellPadding * 2), align: "right", lineBreak: false }); headerX += colWidths[15];
        doc.text("Loan", headerX + cellPadding, headerY, { width: colWidths[16] - (cellPadding * 2), align: "right", lineBreak: false }); headerX += colWidths[16];
        doc.text("Oth Ded", headerX + cellPadding, headerY, { width: colWidths[17] - (cellPadding * 2), align: "right", lineBreak: false }); headerX += colWidths[17];
        doc.text("Net Pay", headerX + cellPadding, headerY, { width: colWidths[18] - (cellPadding * 2), align: "right", lineBreak: false });

        return y + rowHeight;
      };

      // Draw table header
      currentY = drawTableHeader(currentY);

      // Employee rows with detailed breakdown
      let isEven = false;

      // Calculate grand totals for all columns
      let totalHRA = "0", totalMedical = "0", totalConv = "0", totalOtherAllow = "0", totalGross = "0";
      let totalLateDeduct = "0", totalLoanDeduct = "0", totalOtherDeduct = "0";
      let totalPresentDays = 0, totalAbsentDays = 0, totalLateDays = 0, totalHalfDays = 0;
      let totalOTHours: number = 0;

      salaryRecords.forEach((record) => {
        // Check if new page needed
        if (currentY > pageHeight - 80) {
          doc.addPage();
          currentY = margin;
          currentY = drawTableHeader(currentY);
          isEven = false;
        }

        // Extract detailed salary components
        const basicSalary = record.payroll?.basicSalary || record.salaryStructure?.basicSalary || "0";
        const houseAllowance = record.salaryStructure?.houseAllowance || "0";
        const medicalAllowance = record.salaryStructure?.medicalAllowance || "0";
        const travelAllowance = record.salaryStructure?.travelAllowance || "0";
        const otherAllowances = sumAmounts([
          record.salaryStructure?.foodAllowance || "0",
          record.salaryStructure?.otherAllowances || "0"
        ]);

        const grossSalary = sumAmounts([basicSalary, houseAllowance, medicalAllowance, travelAllowance, otherAllowances]);

        // Attendance data
        const presentDays = record.payroll?.totalPresentDays || 0;
        const absentDays = record.payroll?.totalAbsentDays || 0;
        const lateDays = record.payroll?.totalLateDays || 0;
        const halfDays = record.payroll?.totalHalfDays || 0;
        const otHours = Number(record.payroll?.totalOvertimeHours || 0);

        // Deductions breakdown
        const lateDeduction = record.payroll?.lateDeduction || "0";
        const loanDeduction = record.payroll?.loanDeduction || "0";
        const otherDeductions = record.payroll?.otherDeductions || "0";

        const netSalary = record.payroll?.netSalary || sumAmounts([grossSalary, `-${lateDeduction}`, `-${loanDeduction}`, `-${otherDeductions}`]);

        // Accumulate totals
        totalHRA = sumAmounts([totalHRA, houseAllowance]);
        totalMedical = sumAmounts([totalMedical, medicalAllowance]);
        totalConv = sumAmounts([totalConv, travelAllowance]);
        totalOtherAllow = sumAmounts([totalOtherAllow, otherAllowances]);
        totalGross = sumAmounts([totalGross, grossSalary]);
        totalLateDeduct = sumAmounts([totalLateDeduct, lateDeduction]);
        totalLoanDeduct = sumAmounts([totalLoanDeduct, loanDeduction]);
        totalOtherDeduct = sumAmounts([totalOtherDeduct, otherDeductions]);
        totalPresentDays += presentDays;
        totalAbsentDays += absentDays;
        totalLateDays += lateDays;
        totalHalfDays += halfDays;
        totalOTHours += otHours;

        // Draw row
        const rowBg = isEven ? "#F9F9F9" : "#FFFFFF";
        doc.rect(tableX, currentY, tableWidth, rowHeight).fillAndStroke(rowBg, "#E5E7EB");

        doc.fontSize(7).font("Helvetica").fillColor("#1E1E1E");
        let xPos = tableX;
        const textY = currentY + 8;

        // Employee info
        doc.text(record.employee?.employeeId || "N/A", xPos + cellPadding, textY, { width: colWidths[0] - (cellPadding * 2), lineBreak: false }); xPos += colWidths[0];
        doc.text(record.user?.fullName || "Unknown", xPos + cellPadding, textY, { width: colWidths[1] - (cellPadding * 2), lineBreak: false }); xPos += colWidths[1];
        doc.text(record.department?.name || "N/A", xPos + cellPadding, textY, { width: colWidths[2] - (cellPadding * 2), lineBreak: false }); xPos += colWidths[2];
        doc.text(record.designation?.title || "N/A", xPos + cellPadding, textY, { width: colWidths[3] - (cellPadding * 2), lineBreak: false }); xPos += colWidths[3];

        // Earnings (right-aligned, no currency prefix)
        doc.text(formatCurrency(basicSalary, { prefix: '' }), xPos + cellPadding, textY, { width: colWidths[4] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[4];
        doc.text(formatCurrency(houseAllowance, { prefix: '' }), xPos + cellPadding, textY, { width: colWidths[5] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[5];
        doc.text(formatCurrency(medicalAllowance, { prefix: '' }), xPos + cellPadding, textY, { width: colWidths[6] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[6];
        doc.text(formatCurrency(travelAllowance, { prefix: '' }), xPos + cellPadding, textY, { width: colWidths[7] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[7];
        doc.text(formatCurrency(otherAllowances, { prefix: '' }), xPos + cellPadding, textY, { width: colWidths[8] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[8];
        doc.font("Helvetica-Bold");
        doc.text(formatCurrency(grossSalary, { prefix: '' }), xPos + cellPadding, textY, { width: colWidths[9] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[9];

        // Attendance (center-aligned)
        doc.font("Helvetica");
        doc.text(presentDays.toString(), xPos + cellPadding, textY, { width: colWidths[10] - (cellPadding * 2), align: "center", lineBreak: false }); xPos += colWidths[10];
        doc.text(absentDays.toString(), xPos + cellPadding, textY, { width: colWidths[11] - (cellPadding * 2), align: "center", lineBreak: false }); xPos += colWidths[11];
        doc.text(lateDays.toString(), xPos + cellPadding, textY, { width: colWidths[12] - (cellPadding * 2), align: "center", lineBreak: false }); xPos += colWidths[12];
        doc.text(halfDays.toString(), xPos + cellPadding, textY, { width: colWidths[13] - (cellPadding * 2), align: "center", lineBreak: false }); xPos += colWidths[13];
        doc.text(otHours.toFixed(2), xPos + cellPadding, textY, { width: colWidths[14] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[14];

        // Deductions (right-aligned, no currency prefix)
        doc.text(formatCurrency(lateDeduction, { prefix: '' }), xPos + cellPadding, textY, { width: colWidths[15] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[15];
        doc.text(formatCurrency(loanDeduction, { prefix: '' }), xPos + cellPadding, textY, { width: colWidths[16] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[16];
        doc.text(formatCurrency(otherDeductions, { prefix: '' }), xPos + cellPadding, textY, { width: colWidths[17] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[17];

        // Net Pay (bold, right-aligned, no currency prefix)
        doc.font("Helvetica-Bold").fillColor("#E11D26");
        doc.text(formatCurrency(netSalary, { prefix: '' }), xPos + cellPadding, textY, { width: colWidths[18] - (cellPadding * 2), align: "right", lineBreak: false });

        currentY += rowHeight;
        isEven = !isEven;
      });

      // ========== TOTALS ROW ==========
      doc.rect(tableX, currentY, tableWidth, rowHeight + 2).fillAndStroke("#FFF9E6", "#E11D26");

      doc.fontSize(8).font("Helvetica-Bold").fillColor("#1E1E1E");
      let xPos = tableX;
      const totalsY = currentY + 9;

      doc.text("TOTALS", xPos + cellPadding, totalsY, { width: colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] - (cellPadding * 2), lineBreak: false });
      xPos += colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3];

      doc.text(formatCurrency(totalBasic, { prefix: '' }), xPos + cellPadding, totalsY, { width: colWidths[4] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[4];
      doc.text(formatCurrency(totalHRA, { prefix: '' }), xPos + cellPadding, totalsY, { width: colWidths[5] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[5];
      doc.text(formatCurrency(totalMedical, { prefix: '' }), xPos + cellPadding, totalsY, { width: colWidths[6] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[6];
      doc.text(formatCurrency(totalConv, { prefix: '' }), xPos + cellPadding, totalsY, { width: colWidths[7] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[7];
      doc.text(formatCurrency(totalOtherAllow, { prefix: '' }), xPos + cellPadding, totalsY, { width: colWidths[8] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[8];
      doc.fillColor("#E11D26");
      doc.text(formatCurrency(totalGross, { prefix: '' }), xPos + cellPadding, totalsY, { width: colWidths[9] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[9];

      doc.fillColor("#1E1E1E");
      doc.text(totalPresentDays.toString(), xPos + cellPadding, totalsY, { width: colWidths[10] - (cellPadding * 2), align: "center", lineBreak: false }); xPos += colWidths[10];
      doc.text(totalAbsentDays.toString(), xPos + cellPadding, totalsY, { width: colWidths[11] - (cellPadding * 2), align: "center", lineBreak: false }); xPos += colWidths[11];
      doc.text(totalLateDays.toString(), xPos + cellPadding, totalsY, { width: colWidths[12] - (cellPadding * 2), align: "center", lineBreak: false }); xPos += colWidths[12];
      doc.text(totalHalfDays.toString(), xPos + cellPadding, totalsY, { width: colWidths[13] - (cellPadding * 2), align: "center", lineBreak: false }); xPos += colWidths[13];
      doc.text(totalOTHours.toFixed(2), xPos + cellPadding, totalsY, { width: colWidths[14] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[14];

      doc.text(formatCurrency(totalLateDeduct, { prefix: '' }), xPos + cellPadding, totalsY, { width: colWidths[15] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[15];
      doc.text(formatCurrency(totalLoanDeduct, { prefix: '' }), xPos + cellPadding, totalsY, { width: colWidths[16] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[16];
      doc.text(formatCurrency(totalOtherDeduct, { prefix: '' }), xPos + cellPadding, totalsY, { width: colWidths[17] - (cellPadding * 2), align: "right", lineBreak: false }); xPos += colWidths[17];

      doc.fillColor("#E11D26").fontSize(9);
      doc.text(formatCurrency(totalNetSalary, { prefix: '' }), xPos + cellPadding, totalsY, { width: colWidths[18] - (cellPadding * 2), align: "right", lineBreak: false });

      currentY += rowHeight + 2;

      // ========== SIGNATURE SECTION ==========
      currentY += 20;

      // Three signature lines
      const signatureLineWidth = 150;
      const sectionWidth = contentWidth / 3;

      const sig1X = margin + (sectionWidth / 2) - (signatureLineWidth / 2);
      const sig2X = margin + sectionWidth + (sectionWidth / 2) - (signatureLineWidth / 2);
      const sig3X = margin + (sectionWidth * 2) + (sectionWidth / 2) - (signatureLineWidth / 2);

      // Draw signature lines
      doc.strokeColor("#333333").lineWidth(1);
      doc.moveTo(sig1X, currentY).lineTo(sig1X + signatureLineWidth, currentY).stroke();
      doc.moveTo(sig2X, currentY).lineTo(sig2X + signatureLineWidth, currentY).stroke();
      doc.moveTo(sig3X, currentY).lineTo(sig3X + signatureLineWidth, currentY).stroke();

      // Signature labels
      doc.fontSize(10).font("Helvetica").fillColor("#333333");
      doc.text("Prepared By", sig1X, currentY + 10, { width: signatureLineWidth, align: "center", lineBreak: false });
      doc.text("Verified By", sig2X, currentY + 10, { width: signatureLineWidth, align: "center", lineBreak: false });
      doc.text("Approved By", sig3X, currentY + 10, { width: signatureLineWidth, align: "center", lineBreak: false });

      currentY += 40;

      // ========== FOOTER ==========
      doc.moveTo(margin, currentY).lineTo(pageWidth - margin, currentY).strokeColor("#E5E7EB").lineWidth(1).stroke();

      doc.fontSize(8).font("Helvetica").fillColor("#999999");
      doc.text(
        "MaxTech BD | Smart Agency Control Hub",
        margin, currentY + 8, { width: contentWidth, align: "center", lineBreak: false }
      );

      // Stream to response
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=Salary-Sheet-${month}-${year}.pdf`);

      doc.pipe(res);
      doc.end();
    } catch (error: any) {
      console.error("Salary Sheet PDF export error:", error);
      res.status(500).json({ error: "Failed to export PDF" });
    }
  });

  // Salary Sheet Excel Export
  app.get("/api/salary-sheet/export-excel", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export Salary Sheet
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);

      // Validate month and year - check for NaN FIRST before any other validation
      if (isNaN(month) || isNaN(year) || !Number.isInteger(month) || !Number.isInteger(year)) {
        return res.status(400).json({ error: "Valid month and year are required" });
      }

      if (month < 1 || month > 12 || year < 2000 || year > 2100) {
        return res.status(400).json({ error: "Month must be 1-12 and year must be 2000-2100" });
      }

      // Fetch ALL employees with salary structures
      const salaryRecords = await db
        .select({
          employee: employees,
          user: users,
          department: departments,
          designation: designations,
          salaryStructure: salaryStructure,
          payroll: payroll,
        })
        .from(employees)
        .innerJoin(users, eq(employees.userId, users.id))
        .innerJoin(salaryStructure, eq(salaryStructure.employeeId, employees.id))
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .leftJoin(designations, eq(employees.designationId, designations.id))
        .leftJoin(
          payroll,
          and(
            eq(payroll.employeeId, employees.id),
            eq(payroll.month, month),
            eq(payroll.year, year)
          )
        )
        .where(eq(employees.status, "active"));

      // Calculate totals
      const totalBasic = sumAmounts(salaryRecords.map(r =>
        r.payroll?.basicSalary || r.salaryStructure?.basicSalary || "0"
      ));
      const totalAllowances = sumAmounts(salaryRecords.map(r =>
        r.payroll?.totalAllowances || sumAmounts([
          r.salaryStructure?.houseAllowance || "0",
          r.salaryStructure?.foodAllowance || "0",
          r.salaryStructure?.travelAllowance || "0",
          r.salaryStructure?.medicalAllowance || "0",
          r.salaryStructure?.otherAllowances || "0"
        ])
      ));
      const totalDeductions = sumAmounts(
        salaryRecords.flatMap(r => [
          r.payroll?.loanDeduction || "0",
          r.payroll?.lateDeduction || "0",
          r.payroll?.otherDeductions || "0"
        ])
      );
      const totalOvertime = sumAmounts(salaryRecords.map(r => r.payroll?.overtimeAmount || "0"));
      const totalNetSalary = sumAmounts(salaryRecords.map(r => {
        if (r.payroll?.netSalary) {
          return r.payroll.netSalary;
        }
        const basic = r.salaryStructure?.basicSalary || "0";
        const allowances = sumAmounts([
          r.salaryStructure?.houseAllowance || "0",
          r.salaryStructure?.foodAllowance || "0",
          r.salaryStructure?.travelAllowance || "0",
          r.salaryStructure?.medicalAllowance || "0",
          r.salaryStructure?.otherAllowances || "0"
        ]);
        return sumAmounts([basic, allowances]);
      }));

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Salary Sheet");

      // Set column widths
      worksheet.columns = [
        { width: 25 },  // Employee Name
        { width: 15 },  // Employee ID
        { width: 18 },  // Department
        { width: 18 },  // Designation
        { width: 15 },  // Basic Salary
        { width: 15 },  // Allowances
        { width: 15 },  // Deductions
        { width: 15 },  // Overtime
        { width: 16 },  // Net Salary
        { width: 15 }   // Status
      ];

      // Add header with branding
      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];

      worksheet.mergeCells('A1:J1');
      const titleRow = worksheet.getCell('A1');
      titleRow.value = COMPANY_INFO.name;
      titleRow.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFE11D26' } };
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' };

      worksheet.mergeCells('A2:J2');
      const addressRow = worksheet.getCell('A2');
      addressRow.value = `${COMPANY_INFO.address1}, ${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`;
      addressRow.font = { name: 'Arial', size: 10 };
      addressRow.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A3:J3');
      const contactRow = worksheet.getCell('A3');
      contactRow.value = `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`;
      contactRow.font = { name: 'Arial', size: 10 };
      contactRow.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A5:J5');
      const reportTitleRow = worksheet.getCell('A5');
      reportTitleRow.value = `Salary Sheet - ${monthNames[month - 1]} ${year}`;
      reportTitleRow.font = { name: 'Arial', size: 14, bold: true };
      reportTitleRow.alignment = { horizontal: 'center' };

      // Add column headers
      const headerRow = worksheet.addRow([
        'Employee Name', 'Employee ID', 'Department', 'Designation',
        'Basic Salary', 'Allowances', 'Deductions', 'Overtime', 'Net Salary', 'Payment Status'
      ]);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE11D26' }
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.height = 22;

      // Add data rows
      salaryRecords.forEach((record) => {
        const basicSalary = record.payroll?.basicSalary || record.salaryStructure?.basicSalary || "0";
        const allowances = record.payroll?.totalAllowances || sumAmounts([
          record.salaryStructure?.houseAllowance || "0",
          record.salaryStructure?.foodAllowance || "0",
          record.salaryStructure?.travelAllowance || "0",
          record.salaryStructure?.medicalAllowance || "0",
          record.salaryStructure?.otherAllowances || "0"
        ]);
        const overtime = record.payroll?.overtimeAmount || "0";
        const deductions = sumAmounts([
          record.payroll?.loanDeduction || "0",
          record.payroll?.lateDeduction || "0",
          record.payroll?.otherDeductions || "0"
        ]);
        const netSalary = record.payroll?.netSalary || sumAmounts([basicSalary, allowances, overtime, `-${deductions}`]);
        const status = record.payroll?.status || "Not Generated";

        const row = worksheet.addRow([
          record.user?.fullName || "Unknown",
          record.employee?.employeeId || "N/A",
          record.department?.name || "N/A",
          record.designation?.title || "N/A",
          parseFloat(basicSalary),
          parseFloat(allowances),
          parseFloat(deductions),
          parseFloat(overtime),
          parseFloat(netSalary),
          status
        ]);

        // Format currency cells
        row.getCell(5).numFmt = '#,##0.00';
        row.getCell(6).numFmt = '#,##0.00';
        row.getCell(7).numFmt = '#,##0.00';
        row.getCell(8).numFmt = '#,##0.00';
        row.getCell(9).numFmt = '#,##0.00';
        row.getCell(9).font = { bold: true };
      });

      // Add totals row
      const totalsRow = worksheet.addRow([
        'TOTAL',
        '',
        '',
        '',
        parseFloat(totalBasic),
        parseFloat(totalAllowances),
        parseFloat(totalDeductions),
        parseFloat(totalOvertime),
        parseFloat(totalNetSalary),
        ''
      ]);
      totalsRow.font = { bold: true };
      totalsRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE8E8E8' }
      };
      totalsRow.getCell(5).numFmt = '#,##0.00';
      totalsRow.getCell(6).numFmt = '#,##0.00';
      totalsRow.getCell(7).numFmt = '#,##0.00';
      totalsRow.getCell(8).numFmt = '#,##0.00';
      totalsRow.getCell(9).numFmt = '#,##0.00';

      // Set response headers
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=Salary-Sheet-${month}-${year}.xlsx`);

      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      console.error("Salary Sheet Excel export error:", error);
      res.status(500).json({ error: "Failed to export Excel" });
    }
  });

  // Salary Sheet Word Export
  app.get("/api/salary-sheet/export-word", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export Salary Sheet
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);

      // Validate month and year - check for NaN FIRST before any other validation
      if (isNaN(month) || isNaN(year) || !Number.isInteger(month) || !Number.isInteger(year)) {
        return res.status(400).json({ error: "Valid month and year are required" });
      }

      if (month < 1 || month > 12 || year < 2000 || year > 2100) {
        return res.status(400).json({ error: "Month must be 1-12 and year must be 2000-2100" });
      }

      // Fetch ALL employees with salary structures
      const salaryRecords = await db
        .select({
          employee: employees,
          user: users,
          department: departments,
          designation: designations,
          salaryStructure: salaryStructure,
          payroll: payroll,
        })
        .from(employees)
        .innerJoin(users, eq(employees.userId, users.id))
        .innerJoin(salaryStructure, eq(salaryStructure.employeeId, employees.id))
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .leftJoin(designations, eq(employees.designationId, designations.id))
        .leftJoin(
          payroll,
          and(
            eq(payroll.employeeId, employees.id),
            eq(payroll.month, month),
            eq(payroll.year, year)
          )
        )
        .where(eq(employees.status, "active"));

      // Calculate totals
      const totalEmployees = salaryRecords.length;
      const totalBasic = sumAmounts(salaryRecords.map(r =>
        r.payroll?.basicSalary || r.salaryStructure?.basicSalary || "0"
      ));
      const totalAllowances = sumAmounts(salaryRecords.map(r =>
        r.payroll?.totalAllowances || sumAmounts([
          r.salaryStructure?.houseAllowance || "0",
          r.salaryStructure?.foodAllowance || "0",
          r.salaryStructure?.travelAllowance || "0",
          r.salaryStructure?.medicalAllowance || "0",
          r.salaryStructure?.otherAllowances || "0"
        ])
      ));
      const totalDeductions = sumAmounts(
        salaryRecords.flatMap(r => [
          r.payroll?.loanDeduction || "0",
          r.payroll?.lateDeduction || "0",
          r.payroll?.otherDeductions || "0"
        ])
      );
      const totalNetSalary = sumAmounts(salaryRecords.map(r => {
        if (r.payroll?.netSalary) {
          return r.payroll.netSalary;
        }
        const basic = r.salaryStructure?.basicSalary || "0";
        const allowances = sumAmounts([
          r.salaryStructure?.houseAllowance || "0",
          r.salaryStructure?.foodAllowance || "0",
          r.salaryStructure?.travelAllowance || "0",
          r.salaryStructure?.medicalAllowance || "0",
          r.salaryStructure?.otherAllowances || "0"
        ]);
        return sumAmounts([basic, allowances]);
      }));

      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];

      // Create Word document
      const { Document, Paragraph, TextRun, Table, TableCell, TableRow, WidthType, AlignmentType, BorderStyle, ShadingType } = await import("docx");

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Header
            new Paragraph({
              children: [new TextRun({ text: COMPANY_INFO.name, bold: true, size: 32, color: "E11D26" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `${COMPANY_INFO.address1}, ${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 50 }
            }),
            new Paragraph({
              text: `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 }
            }),

            // Title
            new Paragraph({
              children: [new TextRun({ text: `Salary Sheet - ${monthNames[month - 1]} ${year}`, bold: true, size: 28 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),

            // Summary Section
            new Paragraph({
              children: [new TextRun({ text: "Summary", bold: true, size: 22 })],
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Total Employees: ${totalEmployees}`,
              spacing: { after: 50 }
            }),
            new Paragraph({
              text: `Total Basic Salary: ${formatCurrency(totalBasic)}`,
              spacing: { after: 50 }
            }),
            new Paragraph({
              text: `Total Allowances: ${formatCurrency(totalAllowances)}`,
              spacing: { after: 50 }
            }),
            new Paragraph({
              text: `Total Deductions: ${formatCurrency(totalDeductions)}`,
              spacing: { after: 50 }
            }),
            new Paragraph({
              children: [new TextRun({ text: `Total Net Payable: ${formatCurrency(totalNetSalary)}`, bold: true, size: 24 })],
              spacing: { after: 300 }
            }),

            // Salary table
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                // Header row
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Name", bold: true, color: "FFFFFF" })], alignment: AlignmentType.LEFT })],
                      width: { size: 15, type: WidthType.PERCENTAGE },
                      shading: { fill: "E11D26", type: ShadingType.SOLID }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Emp ID", bold: true, color: "FFFFFF" })], alignment: AlignmentType.LEFT })],
                      width: { size: 10, type: WidthType.PERCENTAGE },
                      shading: { fill: "E11D26", type: ShadingType.SOLID }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Dept", bold: true, color: "FFFFFF" })], alignment: AlignmentType.LEFT })],
                      width: { size: 12, type: WidthType.PERCENTAGE },
                      shading: { fill: "E11D26", type: ShadingType.SOLID }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Desig", bold: true, color: "FFFFFF" })], alignment: AlignmentType.LEFT })],
                      width: { size: 12, type: WidthType.PERCENTAGE },
                      shading: { fill: "E11D26", type: ShadingType.SOLID }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Basic", bold: true, color: "FFFFFF" })], alignment: AlignmentType.RIGHT })],
                      width: { size: 10, type: WidthType.PERCENTAGE },
                      shading: { fill: "E11D26", type: ShadingType.SOLID }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Allowances", bold: true, color: "FFFFFF" })], alignment: AlignmentType.RIGHT })],
                      width: { size: 12, type: WidthType.PERCENTAGE },
                      shading: { fill: "E11D26", type: ShadingType.SOLID }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Deductions", bold: true, color: "FFFFFF" })], alignment: AlignmentType.RIGHT })],
                      width: { size: 12, type: WidthType.PERCENTAGE },
                      shading: { fill: "E11D26", type: ShadingType.SOLID }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Net Salary", bold: true, color: "FFFFFF" })], alignment: AlignmentType.RIGHT })],
                      width: { size: 12, type: WidthType.PERCENTAGE },
                      shading: { fill: "E11D26", type: ShadingType.SOLID }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Status", bold: true, color: "FFFFFF" })], alignment: AlignmentType.CENTER })],
                      width: { size: 10, type: WidthType.PERCENTAGE },
                      shading: { fill: "E11D26", type: ShadingType.SOLID }
                    })
                  ]
                }),
                // Data rows
                ...salaryRecords.map(record => {
                  const basicSalary = record.payroll?.basicSalary || record.salaryStructure?.basicSalary || "0";
                  const allowances = record.payroll?.totalAllowances || sumAmounts([
                    record.salaryStructure?.houseAllowance || "0",
                    record.salaryStructure?.foodAllowance || "0",
                    record.salaryStructure?.travelAllowance || "0",
                    record.salaryStructure?.medicalAllowance || "0",
                    record.salaryStructure?.otherAllowances || "0"
                  ]);
                  const deductions = sumAmounts([
                    record.payroll?.loanDeduction || "0",
                    record.payroll?.lateDeduction || "0",
                    record.payroll?.otherDeductions || "0"
                  ]);
                  const netSalary = record.payroll?.netSalary || sumAmounts([basicSalary, allowances, `-${deductions}`]);
                  const status = record.payroll?.status || "Not Generated";

                  return new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ text: record.user?.fullName || "Unknown", alignment: AlignmentType.LEFT })] }),
                      new TableCell({ children: [new Paragraph({ text: record.employee?.employeeId || "N/A", alignment: AlignmentType.LEFT })] }),
                      new TableCell({ children: [new Paragraph({ text: record.department?.name || "N/A", alignment: AlignmentType.LEFT })] }),
                      new TableCell({ children: [new Paragraph({ text: record.designation?.title || "N/A", alignment: AlignmentType.LEFT })] }),
                      new TableCell({ children: [new Paragraph({ text: formatCurrency(basicSalary), alignment: AlignmentType.RIGHT })] }),
                      new TableCell({ children: [new Paragraph({ text: formatCurrency(allowances), alignment: AlignmentType.RIGHT })] }),
                      new TableCell({ children: [new Paragraph({ text: formatCurrency(deductions), alignment: AlignmentType.RIGHT })] }),
                      new TableCell({
                        children: [new Paragraph({
                          children: [new TextRun({
                            text: formatCurrency(netSalary),
                            bold: true
                          })],
                          alignment: AlignmentType.RIGHT
                        })]
                      }),
                      new TableCell({ children: [new Paragraph({ text: status, alignment: AlignmentType.CENTER })] })
                    ]
                  });
                })
              ]
            }),

            // Signature Section
            new Paragraph({
              text: "",
              spacing: { before: 600, after: 400 }
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({ text: "__________________", alignment: AlignmentType.CENTER }),
                        new Paragraph({ text: "Prepared By", alignment: AlignmentType.CENTER })
                      ],
                      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                      width: { size: 33, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ text: "__________________", alignment: AlignmentType.CENTER }),
                        new Paragraph({ text: "Verified By", alignment: AlignmentType.CENTER })
                      ],
                      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                      width: { size: 33, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ text: "__________________", alignment: AlignmentType.CENTER }),
                        new Paragraph({ text: "Approved By", alignment: AlignmentType.CENTER })
                      ],
                      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } },
                      width: { size: 33, type: WidthType.PERCENTAGE }
                    })
                  ]
                })
              ]
            }),

            // Footer
            new Paragraph({
              text: "",
              spacing: { before: 400 }
            }),
            new Paragraph({
              text: `${COMPANY_INFO.name} | ${COMPANY_INFO.address1}, ${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`,
              alignment: AlignmentType.CENTER
            })
          ]
        }]
      });

      // Set response headers
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename=Salary-Sheet-${month}-${year}.docx`);

      // Write to response using Packer
      const { Packer } = await import("docx");
      const buffer = await Packer.toBuffer(doc);
      res.send(buffer);
    } catch (error: any) {
      console.error("Salary Sheet Word export error:", error);
      res.status(500).json({ error: "Failed to export Word document" });
    }
  });

  // Salary Slip (Individual Employee)
  app.get("/api/salary-slip", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can access salary slips
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const employeeId = req.query.employeeId as string;
      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);

      if (!employeeId || !month || !year) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      if (!Number.isInteger(month) || month < 1 || month > 12) {
        return res.status(400).json({ error: "Invalid month" });
      }

      if (!Number.isInteger(year) || year < 2020 || year > 2100) {
        return res.status(400).json({ error: "Invalid year" });
      }

      // Fetch employee with relations
      const [employee] = await db.select({
        id: employees.id,
        employeeId: employees.employeeId,
        userId: employees.userId,
        departmentId: employees.departmentId,
        designationId: employees.designationId,
        user: {
          id: users.id,
          fullName: users.fullName
        },
        department: {
          id: departments.id,
          name: departments.name
        },
        designation: {
          id: designations.id,
          title: designations.title
        }
      })
        .from(employees)
        .leftJoin(users, eq(employees.userId, users.id))
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .leftJoin(designations, eq(employees.designationId, designations.id))
        .where(eq(employees.id, employeeId))
        .limit(1);

      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Fetch payroll record
      const [payrollRecord] = await db.select()
        .from(payroll)
        .where(and(
          eq(payroll.employeeId, employeeId),
          eq(payroll.month, month),
          eq(payroll.year, year)
        ))
        .limit(1);

      if (!payrollRecord) {
        return res.status(404).json({ error: "No salary record found for this period" });
      }

      // Fetch salary structure
      const [salaryStructureRecord] = await db.select()
        .from(salaryStructure)
        .where(eq(salaryStructure.employeeId, employeeId))
        .orderBy(desc(salaryStructure.effectiveFrom))
        .limit(1);

      res.json({
        employee,
        payroll: payrollRecord,
        salaryStructure: salaryStructureRecord || null
      });
    } catch (error: any) {
      console.error("Salary Slip fetch error:", error);
      res.status(500).json({ error: "Failed to fetch salary slip" });
    }
  });

  // Salary Slip PDF Export
  app.get("/api/salary-slip/export-pdf", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export salary slips
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const employeeId = req.query.employeeId as string;
      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);

      if (!employeeId || !Number.isInteger(month) || !Number.isInteger(year)) {
        return res.status(400).json({ error: "Invalid parameters" });
      }

      // Fetch data
      const [employee] = await db.select({
        id: employees.id,
        employeeId: employees.employeeId,
        user: {
          fullName: users.fullName
        },
        department: {
          name: departments.name
        },
        designation: {
          title: designations.title
        }
      })
        .from(employees)
        .leftJoin(users, eq(employees.userId, users.id))
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .leftJoin(designations, eq(employees.designationId, designations.id))
        .where(eq(employees.id, employeeId))
        .limit(1);

      const [payrollRecord] = await db.select()
        .from(payroll)
        .where(and(
          eq(payroll.employeeId, employeeId),
          eq(payroll.month, month),
          eq(payroll.year, year)
        ))
        .limit(1);

      const [salaryStructureRecord] = await db.select()
        .from(salaryStructure)
        .where(eq(salaryStructure.employeeId, employeeId))
        .orderBy(desc(salaryStructure.effectiveFrom))
        .limit(1);

      if (!employee || !payrollRecord) {
        return res.status(404).json({ error: "Salary slip not found" });
      }

      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({ margin: 40, size: "A4" });

      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];

      // Compact header (no template - custom compact design)
      // Header background
      doc.rect(0, 0, 595, 70).fill("#F8F9FA");

      // Company Logo (smaller)
      try {
        const path = await import("path");
        const logoPath = path.default.join(__dirname, "../attached_assets/Untitled design (1)_1763794635122.png");
        doc.image(logoPath, 40, 15, { width: 50, height: 50 });
      } catch (error) {
        console.warn("Logo not found");
      }

      // Company name and info (compact - right side)
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#E11D26").text("MaxTech BD", 400, 18, { width: 155, align: "right" });
      doc.fontSize(7).font("Helvetica").fillColor("#444444")
        .text("522, SK Mujib Road (4th Floor)", 400, 32, { width: 155, align: "right" })
        .text("Agrabad, Chattogram | +8801843180008", 400, 42, { width: 155, align: "right" })
        .text("info@maxtechbd.com", 400, 52, { width: 155, align: "right" });

      // Title centered
      doc.fontSize(16).font("Helvetica-Bold").fillColor("#1E1E1E").text("SALARY SLIP", 100, 25, { width: 280, align: "center" });
      doc.fontSize(10).font("Helvetica").fillColor("#444444").text(`${monthNames[month - 1]} ${year}`, 100, 45, { width: 280, align: "center" });

      let currentY = 80;

      // Employee Information Section - 2 columns layout
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#E11D26").text("Employee Information", 40, currentY);
      currentY += 15;

      // Draw a light background box for employee info
      doc.rect(40, currentY, 515, 50).fill("#FAFAFA").stroke("#E5E7EB");
      currentY += 8;

      const empInfoLeft = [
        ["Name:", employee.user?.fullName || "Unknown"],
        ["Employee ID:", employee.employeeId || "N/A"],
        ["Department:", employee.department?.name || "N/A"]
      ];
      const empInfoRight = [
        ["Designation:", employee.designation?.title || "N/A"],
        ["Working Days:", `${payrollRecord.workingDays} days`],
        ["Status:", payrollRecord.status || "draft"]
      ];

      empInfoLeft.forEach(([label, value], i) => {
        doc.fontSize(8).font("Helvetica").fillColor("#666666").text(label, 50, currentY + i * 14, { width: 70 });
        doc.font("Helvetica-Bold").fillColor("#000000").text(value, 120, currentY + i * 14, { width: 130 });
      });

      empInfoRight.forEach(([label, value], i) => {
        doc.fontSize(8).font("Helvetica").fillColor("#666666").text(label, 300, currentY + i * 14, { width: 80 });
        doc.font("Helvetica-Bold").fillColor("#000000").text(value, 375, currentY + i * 14, { width: 150 });
      });

      currentY += 55;

      // Earnings and Deductions Side by Side
      const leftX = 40;
      const rightX = 300;
      let leftY = currentY;
      let rightY = currentY;

      // Earnings Section Header
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#16a34a").text("Earnings", leftX, leftY);
      leftY += 14;

      const earnings = [["Basic Salary", payrollRecord.basicSalary || "0"]];
      if (salaryStructureRecord) {
        earnings.push(
          ["House Allowance", salaryStructureRecord.houseAllowance || "0"],
          ["Food Allowance", salaryStructureRecord.foodAllowance || "0"],
          ["Travel Allowance", salaryStructureRecord.travelAllowance || "0"],
          ["Medical Allowance", salaryStructureRecord.medicalAllowance || "0"],
          ["Other Allowances", salaryStructureRecord.otherAllowances || "0"]
        );
      }
      earnings.push(["Overtime Pay", payrollRecord.overtimeAmount || "0"]);

      const totalEarnings = new Decimal(payrollRecord.basicSalary || "0")
        .plus(payrollRecord.totalAllowances || "0")
        .plus(payrollRecord.overtimeAmount || "0")
        .toFixed(2);

      earnings.forEach(([label, amount]) => {
        doc.fontSize(8).font("Helvetica").fillColor("#000000")
          .text(label, leftX, leftY, { width: 130 })
          .text(formatCurrency(amount), leftX + 130, leftY, { width: 80, align: "right" });
        leftY += 14;
      });

      doc.fontSize(9).font("Helvetica-Bold").fillColor("#16a34a")
        .text("Total Earnings", leftX, leftY, { width: 130 })
        .text(formatCurrency(totalEarnings), leftX + 130, leftY, { width: 80, align: "right" });
      leftY += 16;

      // Deductions Section Header
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#dc2626").text("Deductions", rightX, rightY);
      rightY += 14;

      const deductions = [
        ["Loan Deduction", payrollRecord.loanDeduction || "0"],
        [`Late Deduction (${payrollRecord.totalLateDays} days)`, payrollRecord.lateDeduction || "0"],
        ["Other Deductions", payrollRecord.otherDeductions || "0"]
      ];

      const totalDeductions = new Decimal(payrollRecord.loanDeduction || "0")
        .plus(payrollRecord.lateDeduction || "0")
        .plus(payrollRecord.otherDeductions || "0")
        .toFixed(2);

      deductions.forEach(([label, amount]) => {
        doc.fontSize(8).font("Helvetica").fillColor("#000000")
          .text(label, rightX, rightY, { width: 140 })
          .text(formatCurrency(amount), rightX + 140, rightY, { width: 80, align: "right" });
        rightY += 14;
      });

      doc.fontSize(9).font("Helvetica-Bold").fillColor("#dc2626")
        .text("Total Deductions", rightX, rightY, { width: 140 })
        .text(formatCurrency(totalDeductions), rightX + 140, rightY, { width: 80, align: "right" });

      currentY = Math.max(leftY, rightY) + 15;

      // Attendance Summary - single row
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#E11D26").text("Attendance Summary", 40, currentY);
      currentY += 14;

      const attData = [
        ["Present:", (payrollRecord.totalPresentDays ?? 0).toString()],
        ["Absent:", (payrollRecord.totalAbsentDays ?? 0).toString()],
        ["Late:", (payrollRecord.totalLateDays ?? 0).toString()],
        ["OT Hours:", payrollRecord.totalOvertimeHours || "0"]
      ];

      attData.forEach(([label, value], i) => {
        const xPos = 40 + i * 130;
        doc.fontSize(8).font("Helvetica").fillColor("#666666").text(label, xPos, currentY, { width: 45 });
        doc.font("Helvetica-Bold").fillColor("#000000").text(value, xPos + 45, currentY, { width: 70 });
      });

      currentY += 25;

      // Net Salary Box (compact)
      doc.rect(40, currentY, 515, 35).fillAndStroke("#E11D26", "#E11D26");
      doc.fontSize(12).fillColor("#FFFFFF").font("Helvetica-Bold")
        .text("Net Salary:", 55, currentY + 10)
        .text(formatCurrency(payrollRecord.netSalary || "0"), 400, currentY + 10, { width: 140, align: "right" });

      currentY += 50;

      // Signature Section (compact)
      doc.fontSize(9).fillColor("#000000").font("Helvetica")
        .text("_____________________", 80, currentY)
        .text("Employee Signature", 80, currentY + 12, { width: 120, align: "center" })
        .text("_____________________", 380, currentY)
        .text("Authorized Signature", 380, currentY + 12, { width: 120, align: "center" });

      currentY += 40;

      // Footer Note (compact)
      doc.fontSize(7).fillColor("#888888")
        .text("This is a computer-generated salary slip and does not require a physical signature.", 40, currentY, { width: 515, align: "center" })
        .text("For any queries, please contact HR Department at info@maxtechbd.com", 40, currentY + 10, { width: 515, align: "center" });

      // Simple footer line
      doc.moveTo(40, 780).lineTo(555, 780).strokeColor("#E5E7EB").lineWidth(0.5).stroke();
      doc.fontSize(7).fillColor("#888888").text("MaxTech BD | Smart Agency Control Hub", 40, 785, { width: 515, align: "center" });

      // Stream to response
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=Salary-Slip-${employee.employeeId}-${month}-${year}.pdf`);

      doc.pipe(res);
      doc.end();
    } catch (error: any) {
      console.error("Salary Slip PDF export error:", error);
      res.status(500).json({ error: "Failed to export PDF" });
    }
  });

  // Salary Slip Excel Export
  app.get("/api/salary-slip/export-excel", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export salary slips
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const employeeId = req.query.employeeId as string;
      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);

      if (!employeeId || !Number.isInteger(month) || !Number.isInteger(year)) {
        return res.status(400).json({ error: "Invalid parameters" });
      }

      // Fetch data (same as PDF)
      const [employee] = await db.select({
        id: employees.id,
        employeeId: employees.employeeId,
        user: { fullName: users.fullName },
        department: { name: departments.name },
        designation: { title: designations.title }
      })
        .from(employees)
        .leftJoin(users, eq(employees.userId, users.id))
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .leftJoin(designations, eq(employees.designationId, designations.id))
        .where(eq(employees.id, employeeId))
        .limit(1);

      const [payrollRecord] = await db.select()
        .from(payroll)
        .where(and(eq(payroll.employeeId, employeeId), eq(payroll.month, month), eq(payroll.year, year)))
        .limit(1);

      const [salaryStructureRecord] = await db.select()
        .from(salaryStructure)
        .where(eq(salaryStructure.employeeId, employeeId))
        .orderBy(desc(salaryStructure.effectiveFrom))
        .limit(1);

      if (!employee || !payrollRecord) {
        return res.status(404).json({ error: "Salary slip not found" });
      }

      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];

      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Salary Slip");

      // Set column widths
      worksheet.columns = [
        { width: 30 },
        { width: 20 }
      ];

      // Add company header
      worksheet.mergeCells('A1:B1');
      const titleRow = worksheet.getCell('A1');
      titleRow.value = COMPANY_INFO.name;
      titleRow.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFE11D26' } };
      titleRow.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A2:B2');
      const addressRow = worksheet.getCell('A2');
      addressRow.value = `${COMPANY_INFO.address1}, ${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`;
      addressRow.font = { name: 'Arial', size: 10 };
      addressRow.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A3:B3');
      const contactRow = worksheet.getCell('A3');
      contactRow.value = `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`;
      contactRow.font = { name: 'Arial', size: 10 };
      contactRow.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A5:B5');
      const slipTitleRow = worksheet.getCell('A5');
      slipTitleRow.value = "SALARY SLIP";
      slipTitleRow.font = { name: 'Arial', size: 14, bold: true };
      slipTitleRow.alignment = { horizontal: 'center' };

      worksheet.mergeCells('A6:B6');
      const periodRow = worksheet.getCell('A6');
      periodRow.value = `${monthNames[month - 1]} ${year}`;
      periodRow.font = { name: 'Arial', size: 12 };
      periodRow.alignment = { horizontal: 'center' };

      let currentRow = 8;

      // Employee Information
      const empInfoHeader = worksheet.getRow(currentRow);
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      empInfoHeader.getCell(1).value = "Employee Information";
      empInfoHeader.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      empInfoHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D26' } };
      currentRow++;

      const empInfo = [
        ["Employee Name", employee.user?.fullName || "Unknown"],
        ["Employee ID", employee.employeeId || "N/A"],
        ["Department", employee.department?.name || "N/A"],
        ["Designation", employee.designation?.title || "N/A"],
        ["Working Days", `${payrollRecord.workingDays} days`],
        ["Payment Status", payrollRecord.status || "draft"]
      ];

      empInfo.forEach(([label, value]) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = label;
        row.getCell(1).font = { bold: true };
        row.getCell(2).value = value;
        currentRow++;
      });

      currentRow++;

      // Earnings
      const earningsHeader = worksheet.getRow(currentRow);
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      earningsHeader.getCell(1).value = "Earnings";
      earningsHeader.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      earningsHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16A34A' } };
      currentRow++;

      const earnings = [
        ["Basic Salary", parseFloat(payrollRecord.basicSalary || "0")],
      ];

      if (salaryStructureRecord) {
        earnings.push(
          ["House Allowance", parseFloat(salaryStructureRecord.houseAllowance || "0")],
          ["Food Allowance", parseFloat(salaryStructureRecord.foodAllowance || "0")],
          ["Travel Allowance", parseFloat(salaryStructureRecord.travelAllowance || "0")],
          ["Medical Allowance", parseFloat(salaryStructureRecord.medicalAllowance || "0")],
          ["Other Allowances", parseFloat(salaryStructureRecord.otherAllowances || "0")]
        );
      }

      earnings.push(["Overtime Pay", parseFloat(payrollRecord.overtimeAmount || "0")]);

      earnings.forEach(([label, amount]) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = label;
        row.getCell(2).value = amount;
        row.getCell(2).numFmt = '#,##0.00';
        currentRow++;
      });

      const totalEarnings = new Decimal(payrollRecord.basicSalary || "0")
        .plus(payrollRecord.totalAllowances || "0")
        .plus(payrollRecord.overtimeAmount || "0");

      const totalEarningsRow = worksheet.getRow(currentRow);
      totalEarningsRow.getCell(1).value = "Total Earnings";
      totalEarningsRow.getCell(1).font = { bold: true };
      totalEarningsRow.getCell(2).value = parseFloat(totalEarnings.toFixed(2));
      totalEarningsRow.getCell(2).numFmt = '#,##0.00';
      totalEarningsRow.getCell(2).font = { bold: true };
      totalEarningsRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
      currentRow++;
      currentRow++;

      // Deductions
      const deductionsHeader = worksheet.getRow(currentRow);
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      deductionsHeader.getCell(1).value = "Deductions";
      deductionsHeader.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      deductionsHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } };
      currentRow++;

      const deductions = [
        ["Loan Deduction", parseFloat(payrollRecord.loanDeduction || "0")],
        [`Late Deduction (${payrollRecord.totalLateDays} days)`, parseFloat(payrollRecord.lateDeduction || "0")],
        ["Other Deductions", parseFloat(payrollRecord.otherDeductions || "0")]
      ];

      deductions.forEach(([label, amount]) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = label;
        row.getCell(2).value = amount;
        row.getCell(2).numFmt = '#,##0.00';
        currentRow++;
      });

      const totalDeductions = new Decimal(payrollRecord.loanDeduction || "0")
        .plus(payrollRecord.lateDeduction || "0")
        .plus(payrollRecord.otherDeductions || "0");

      const totalDeductionsRow = worksheet.getRow(currentRow);
      totalDeductionsRow.getCell(1).value = "Total Deductions";
      totalDeductionsRow.getCell(1).font = { bold: true };
      totalDeductionsRow.getCell(2).value = parseFloat(totalDeductions.toFixed(2));
      totalDeductionsRow.getCell(2).numFmt = '#,##0.00';
      totalDeductionsRow.getCell(2).font = { bold: true };
      totalDeductionsRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
      currentRow++;
      currentRow++;

      // Attendance Summary
      const attendanceHeader = worksheet.getRow(currentRow);
      worksheet.mergeCells(`A${currentRow}:B${currentRow}`);
      attendanceHeader.getCell(1).value = "Attendance Summary";
      attendanceHeader.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      attendanceHeader.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D26' } };
      currentRow++;

      const attendanceInfo = [
        ["Present Days", payrollRecord.totalPresentDays ?? 0],
        ["Absent Days", payrollRecord.totalAbsentDays ?? 0],
        ["Late Days", payrollRecord.totalLateDays ?? 0],
        ["Overtime Hours", payrollRecord.totalOvertimeHours || "0"]
      ];

      attendanceInfo.forEach(([label, value]) => {
        const row = worksheet.getRow(currentRow);
        row.getCell(1).value = label;
        row.getCell(1).font = { bold: true };
        row.getCell(2).value = value;
        currentRow++;
      });

      currentRow++;

      // Net Salary
      const netSalaryRow = worksheet.getRow(currentRow);
      netSalaryRow.getCell(1).value = "NET SALARY";
      netSalaryRow.getCell(1).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      netSalaryRow.getCell(2).value = parseFloat(payrollRecord.netSalary || "0");
      netSalaryRow.getCell(2).numFmt = '#,##0.00';
      netSalaryRow.getCell(2).font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      netSalaryRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D26' } };
      netSalaryRow.height = 25;

      // Write to buffer and send
      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=Salary-Slip-${employee.employeeId}-${month}-${year}.xlsx`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Salary Slip Excel export error:", error);
      res.status(500).json({ error: "Failed to export Excel" });
    }
  });

  // Salary Slip Word Export
  app.get("/api/salary-slip/export-word", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export salary slips
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const employeeId = req.query.employeeId as string;
      const month = parseInt(req.query.month as string);
      const year = parseInt(req.query.year as string);

      if (!employeeId || !Number.isInteger(month) || !Number.isInteger(year)) {
        return res.status(400).json({ error: "Invalid parameters" });
      }

      // Fetch data (same as PDF/Excel)
      const [employee] = await db.select({
        id: employees.id,
        employeeId: employees.employeeId,
        user: { fullName: users.fullName },
        department: { name: departments.name },
        designation: { title: designations.title }
      })
        .from(employees)
        .leftJoin(users, eq(employees.userId, users.id))
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .leftJoin(designations, eq(employees.designationId, designations.id))
        .where(eq(employees.id, employeeId))
        .limit(1);

      const [payrollRecord] = await db.select()
        .from(payroll)
        .where(and(eq(payroll.employeeId, employeeId), eq(payroll.month, month), eq(payroll.year, year)))
        .limit(1);

      const [salaryStructureRecord] = await db.select()
        .from(salaryStructure)
        .where(eq(salaryStructure.employeeId, employeeId))
        .orderBy(desc(salaryStructure.effectiveFrom))
        .limit(1);

      if (!employee || !payrollRecord) {
        return res.status(404).json({ error: "Salary slip not found" });
      }

      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];

      const { Document, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } = await import("docx");

      const totalEarnings = new Decimal(payrollRecord.basicSalary || "0")
        .plus(payrollRecord.totalAllowances || "0")
        .plus(payrollRecord.overtimeAmount || "0")
        .toFixed(2);

      const totalDeductions = new Decimal(payrollRecord.loanDeduction || "0")
        .plus(payrollRecord.lateDeduction || "0")
        .plus(payrollRecord.otherDeductions || "0")
        .toFixed(2);

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Header
            new Paragraph({
              children: [new TextRun({ text: COMPANY_INFO.name, bold: true, size: 32, color: "E11D26" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `${COMPANY_INFO.address1}, ${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 50 }
            }),
            new Paragraph({
              text: `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            new Paragraph({
              children: [new TextRun({ text: "SALARY SLIP", bold: true, size: 28 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `${monthNames[month - 1]} ${year}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 }
            }),

            // Employee Information
            new Paragraph({
              children: [new TextRun({ text: "Employee Information", bold: true, color: "E11D26" })],
              spacing: { after: 200 }
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1 },
                bottom: { style: BorderStyle.SINGLE, size: 1 },
                left: { style: BorderStyle.SINGLE, size: 1 },
                right: { style: BorderStyle.SINGLE, size: 1 },
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Employee Name", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ text: employee.user?.fullName || "Unknown" })] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Employee ID", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ text: employee.employeeId || "N/A" })] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Department", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ text: employee.department?.name || "N/A" })] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Designation", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ text: employee.designation?.title || "N/A" })] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Working Days", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ text: `${payrollRecord.workingDays} days` })] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Payment Status", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ text: payrollRecord.status || "draft" })] })
                  ]
                })
              ]
            }),

            // Spacing
            new Paragraph({ text: "", spacing: { before: 300 } }),

            // Earnings
            new Paragraph({
              children: [new TextRun({ text: "Earnings", bold: true, color: "16A34A" })],
              spacing: { after: 200 }
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: "Basic Salary" })] }),
                    new TableCell({ children: [new Paragraph({ text: formatCurrency(payrollRecord.basicSalary || "0"), alignment: AlignmentType.RIGHT })] })
                  ]
                }),
                ...(salaryStructureRecord ? [
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ text: "House Allowance" })] }),
                      new TableCell({ children: [new Paragraph({ text: formatCurrency(salaryStructureRecord.houseAllowance || "0"), alignment: AlignmentType.RIGHT })] })
                    ]
                  }),
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ text: "Food Allowance" })] }),
                      new TableCell({ children: [new Paragraph({ text: formatCurrency(salaryStructureRecord.foodAllowance || "0"), alignment: AlignmentType.RIGHT })] })
                    ]
                  }),
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ text: "Travel Allowance" })] }),
                      new TableCell({ children: [new Paragraph({ text: formatCurrency(salaryStructureRecord.travelAllowance || "0"), alignment: AlignmentType.RIGHT })] })
                    ]
                  }),
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ text: "Medical Allowance" })] }),
                      new TableCell({ children: [new Paragraph({ text: formatCurrency(salaryStructureRecord.medicalAllowance || "0"), alignment: AlignmentType.RIGHT })] })
                    ]
                  }),
                  new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph({ text: "Other Allowances" })] }),
                      new TableCell({ children: [new Paragraph({ text: formatCurrency(salaryStructureRecord.otherAllowances || "0"), alignment: AlignmentType.RIGHT })] })
                    ]
                  })
                ] : []),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: "Overtime Pay" })] }),
                    new TableCell({ children: [new Paragraph({ text: formatCurrency(payrollRecord.overtimeAmount || "0"), alignment: AlignmentType.RIGHT })] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Total Earnings", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatCurrency(totalEarnings), bold: true })], alignment: AlignmentType.RIGHT })] })
                  ]
                })
              ]
            }),

            // Spacing
            new Paragraph({ text: "", spacing: { before: 300 } }),

            // Deductions
            new Paragraph({
              children: [new TextRun({ text: "Deductions", bold: true, color: "DC2626" })],
              spacing: { after: 200 }
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: "Loan Deduction" })] }),
                    new TableCell({ children: [new Paragraph({ text: formatCurrency(payrollRecord.loanDeduction || "0"), alignment: AlignmentType.RIGHT })] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: `Late Deduction (${payrollRecord.totalLateDays} days)` })] }),
                    new TableCell({ children: [new Paragraph({ text: formatCurrency(payrollRecord.lateDeduction || "0"), alignment: AlignmentType.RIGHT })] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: "Other Deductions" })] }),
                    new TableCell({ children: [new Paragraph({ text: formatCurrency(payrollRecord.otherDeductions || "0"), alignment: AlignmentType.RIGHT })] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Total Deductions", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: formatCurrency(totalDeductions), bold: true })], alignment: AlignmentType.RIGHT })] })
                  ]
                })
              ]
            }),

            // Spacing
            new Paragraph({ text: "", spacing: { before: 300 } }),

            // Attendance Summary
            new Paragraph({
              children: [new TextRun({ text: "Attendance Summary", bold: true, color: "E11D26" })],
              spacing: { after: 200 }
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Present Days", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ text: (payrollRecord.totalPresentDays ?? 0).toString() })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Absent Days", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ text: (payrollRecord.totalAbsentDays ?? 0).toString() })] })
                  ]
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Late Days", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ text: (payrollRecord.totalLateDays ?? 0).toString() })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Overtime Hours", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ text: payrollRecord.totalOvertimeHours || "0" })] })
                  ]
                })
              ]
            }),

            // Spacing
            new Paragraph({ text: "", spacing: { before: 400 } }),

            // Net Salary
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "NET SALARY", bold: true, size: 28, color: "FFFFFF" })], alignment: AlignmentType.LEFT })],
                      shading: { fill: "E11D26" }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: formatCurrency(payrollRecord.netSalary || "0"), bold: true, size: 28, color: "FFFFFF" })], alignment: AlignmentType.RIGHT })],
                      shading: { fill: "E11D26" }
                    })
                  ]
                })
              ]
            }),

            // Spacing
            new Paragraph({ text: "", spacing: { before: 600 } }),

            // Signature Section
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE },
                insideVertical: { style: BorderStyle.NONE }
              },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({ text: "_____________________", alignment: AlignmentType.CENTER, spacing: { before: 600 } }),
                        new Paragraph({ text: "Employee Signature", alignment: AlignmentType.CENTER, spacing: { before: 100 } })
                      ],
                      borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE }
                      }
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ text: "_____________________", alignment: AlignmentType.CENTER, spacing: { before: 600 } }),
                        new Paragraph({ text: "Authorized Signature", alignment: AlignmentType.CENTER, spacing: { before: 100 } })
                      ],
                      borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE }
                      }
                    })
                  ]
                })
              ]
            }),

            // Footer
            new Paragraph({
              text: "",
              spacing: { before: 400 }
            }),
            new Paragraph({
              text: "This is a computer-generated salary slip and does not require a physical signature.",
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: "For any queries, please contact HR Department at info@maxtechbd.com",
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: `${COMPANY_INFO.name} | ${COMPANY_INFO.address1}, ${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`,
              alignment: AlignmentType.CENTER
            })
          ]
        }]
      });

      // Set response headers
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename=Salary-Slip-${employee.employeeId}-${month}-${year}.docx`);

      // Write to response using Packer
      const { Packer } = await import("docx");
      const buffer = await Packer.toBuffer(doc);
      res.send(buffer);
    } catch (error: any) {
      console.error("Salary Slip Word export error:", error);
      res.status(500).json({ error: "Failed to export Word document" });
    }
  });

  // Payments
  app.get("/api/payments", authenticateToken, async (req: AuthRequest, res) => {
    try {
      let allPayments: any[] = [];
      if (req.userRole === "client") {
        // Get user's client ID
        const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
        if (!user?.clientId) {
          return res.status(403).json({ error: "No client associated with this account" });
        }

        // Get all invoices for this client first
        const clientInvoices = await db.select().from(invoices).where(eq(invoices.clientId, user.clientId));
        const invoiceIds = clientInvoices.map(inv => inv.id);

        if (invoiceIds.length > 0) {
          // Use inArray for safe parameter binding (prevents SQL injection)
          allPayments = await db.select().from(payments)
            .where(inArray(payments.invoiceId, invoiceIds))
            .orderBy(desc(payments.createdAt));
        } else {
          allPayments = [];
        }
      } else if (req.userRole === "admin" || req.userRole === "operational_head") {
        // Only admin and operational_head can see all payments
        allPayments = await db.select().from(payments).orderBy(desc(payments.createdAt));
      } else {
        // Developers and other roles don't have access to payments
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(allPayments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/payments", authenticateToken, auditMiddleware("create", "payment"), async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can create payments
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied. Only admin and operational head can create payments." });
      }

      const data = insertPaymentSchema.parse(req.body);
      const [payment] = await db.insert(payments).values(data).returning();
      res.json(payment);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/payments/:id", authenticateToken, auditMiddleware("update", "payment"), async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can update payments
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied. Only admin and operational head can update payments." });
      }

      const data = insertPaymentSchema.partial().parse(req.body);
      const [payment] = await db.update(payments).set(data).where(eq(payments.id, req.params.id)).returning();

      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      res.json(payment);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete("/api/payments/:id", authenticateToken, auditMiddleware("delete", "payment"), async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can delete payments
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Access denied. Only admin and operational head can delete payments." });
      }

      const [payment] = await db.delete(payments).where(eq(payments.id, req.params.id)).returning();

      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      res.json({ message: "Payment deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Payment Receipt
  app.get("/api/payment-receipt", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can access payment receipts
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const paymentId = req.query.paymentId as string;

      if (!paymentId) {
        return res.status(400).json({ error: "Payment ID is required" });
      }

      // Fetch payment with invoice and client details
      const [payment] = await db.select({
        payment: {
          id: payments.id,
          amount: payments.amount,
          paymentDate: payments.paymentDate,
          paymentMethod: payments.paymentMethod,
          notes: payments.notes
        },
        invoice: {
          invoiceNumber: invoices.invoiceNumber,
          amount: invoices.amount,
          dueDate: invoices.dueDate,
          status: invoices.status
        },
        client: {
          companyName: clients.name,
          email: clients.email,
          phone: clients.phone
        }
      })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .innerJoin(clients, eq(invoices.clientId, clients.id))
        .where(eq(payments.id, paymentId))
        .limit(1);

      if (!payment) {
        return res.status(404).json({ error: "Payment receipt not found" });
      }

      res.json(payment);
    } catch (error: any) {
      console.error("Payment Receipt fetch error:", error);
      res.status(500).json({ error: "Failed to fetch payment receipt" });
    }
  });

  // Payment Receipt PDF Export
  app.get("/api/payment-receipt/export-pdf", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export payment receipts
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const paymentId = req.query.paymentId as string;

      if (!paymentId) {
        return res.status(400).json({ error: "Payment ID is required" });
      }

      // Fetch payment receipt data
      const [receiptData] = await db.select({
        payment: {
          id: payments.id,
          amount: payments.amount,
          paymentDate: payments.paymentDate,
          paymentMethod: payments.paymentMethod,
          notes: payments.notes
        },
        invoice: {
          invoiceNumber: invoices.invoiceNumber,
          amount: invoices.amount,
          dueDate: invoices.dueDate,
          status: invoices.status
        },
        client: {
          companyName: clients.name,
          email: clients.email,
          phone: clients.phone
        }
      })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .innerJoin(clients, eq(invoices.clientId, clients.id))
        .where(eq(payments.id, paymentId))
        .limit(1);

      if (!receiptData) {
        return res.status(404).json({ error: "Payment receipt not found" });
      }

      // Generate PDF using pdfkit with professional design matching Invoice/Salary Sheet
      const doc = new PDFDocument({
        margin: 40,
        size: 'A4',
        bufferPages: true
      });

      // Set response headers
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=Payment-Receipt-${receiptData.payment.id.substring(0, 8)}.pdf`);

      // Pipe the PDF to the response
      doc.pipe(res);

      // ===== PROFESSIONAL HEADER SECTION (matching Invoice style) =====
      // Background color bar for header
      doc.save();
      doc.rect(0, 0, 595, 120).fill('#F8F9FA');
      doc.restore();

      // Company Logo
      try {
        const logoPath = path.join(__dirname, "../attached_assets/Untitled design (1)_1763794635122.png");
        if (require('fs').existsSync(logoPath)) {
          doc.image(logoPath, 40, 30, { width: 80, height: 80 });
        } else {
          console.warn("Logo file not found at:", logoPath);
        }
      } catch (error) {
        console.warn("Logo loading error:", error);
      }

      // Company Information (right side of header)
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#C8102E");
      doc.text("MaxTech BD", 350, 35, { width: 200, align: "right" });

      doc.fontSize(9).font("Helvetica").fillColor("#212121");
      doc.text("522, SK Mujib Road (4th Floor)", 350, 52, { width: 200, align: "right" });
      doc.text("Agrabad, Double Mooring, Chattogram,", 350, 64, { width: 200, align: "right" });
      doc.text("Phone: +8801843180008", 350, 76, { width: 200, align: "right" });
      doc.text("Email: info@maxtechbd.com", 350, 88, { width: 200, align: "right" });

      // Document Title - reset position after header
      const headerBottom = 120;
      doc.x = doc.page.margins.left;
      doc.y = headerBottom + 20;

      doc.fontSize(20).font("Helvetica-Bold").fillColor("#111827");
      doc.text("PAYMENT RECEIPT", 40, headerBottom + 20, { width: 515, align: "center" });

      doc.fontSize(12).font("Helvetica").fillColor("#6B7280");
      const receiptNumber = receiptData.payment.id.substring(0, 8).toUpperCase();
      doc.text(`Receipt #: ${receiptNumber}`, 40, headerBottom + 45, { width: 515, align: "center" });

      doc.fontSize(10).fillColor("#9CA3AF");
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 40, headerBottom + 60, { width: 515, align: "center" });

      // Reset position for content sections
      let currentY = headerBottom + 90;
      doc.x = doc.page.margins.left;
      doc.y = currentY;

      // ===== INFORMATION BOXES SECTION =====
      // Save the baseline Y for both columns
      const rowTop = currentY;
      const cardHeight = 120;

      // Left Column - Payment Information
      doc.save();
      doc.rect(40, rowTop, 250, cardHeight).stroke("#E5E7EB");
      doc.rect(40, rowTop, 250, 30).fillAndStroke("#F3F4F6", "#E5E7EB");
      doc.restore();

      doc.fontSize(11).font("Helvetica-Bold").fillColor("#374151");
      doc.text("Payment Information", 50, rowTop + 8);

      doc.fontSize(10).font("Helvetica").fillColor("#6B7280");
      doc.text("Receipt Number:", 50, rowTop + 45);
      doc.text("Payment Date:", 50, rowTop + 62);
      doc.text("Payment Method:", 50, rowTop + 79);
      doc.text("Amount Paid:", 50, rowTop + 96);

      doc.font("Helvetica-Bold").fillColor("#111827");
      doc.text(receiptNumber, 160, rowTop + 45);
      doc.text(format(new Date(receiptData.payment.paymentDate), "MMMM dd, yyyy"), 160, rowTop + 62);
      doc.text(receiptData.payment.paymentMethod, 160, rowTop + 79);
      doc.text(formatCurrency(receiptData.payment.amount || "0"), 160, rowTop + 96);

      // Right Column - Client Information (using same baseline)
      doc.save();
      doc.rect(305, rowTop, 250, cardHeight).stroke("#E5E7EB");
      doc.rect(305, rowTop, 250, 30).fillAndStroke("#F3F4F6", "#E5E7EB");
      doc.restore();

      doc.fontSize(11).font("Helvetica-Bold").fillColor("#374151");
      doc.text("Client Information", 315, rowTop + 8);

      doc.fontSize(11).font("Helvetica-Bold").fillColor("#111827");
      doc.text(receiptData.client.companyName, 315, rowTop + 45, { width: 230 });

      doc.fontSize(10).font("Helvetica").fillColor("#6B7280");
      let clientY = rowTop + 62;
      if (receiptData.client.email) {
        doc.text(receiptData.client.email, 315, clientY, { width: 230 });
        clientY += 15;
      }
      if (receiptData.client.phone) {
        doc.text(receiptData.client.phone, 315, clientY, { width: 230 });
      }

      // Advance Y position after both columns
      currentY = rowTop + cardHeight + 20;

      // ===== INVOICE REFERENCE BOX =====
      doc.save();
      doc.rect(40, currentY, 515, 110).stroke("#E5E7EB");
      doc.rect(40, currentY, 515, 30).fillAndStroke("#F3F4F6", "#E5E7EB");
      doc.restore();

      doc.fontSize(11).font("Helvetica-Bold").fillColor("#374151");
      doc.text("Invoice Reference", 50, currentY + 8);

      doc.fontSize(10).font("Helvetica").fillColor("#6B7280");
      doc.text("Invoice Number:", 50, currentY + 45);
      doc.text("Invoice Amount:", 50, currentY + 62);
      doc.text("Due Date:", 50, currentY + 79);
      doc.text("Status:", 350, currentY + 45);

      doc.font("Helvetica-Bold").fillColor("#111827");
      doc.text(receiptData.invoice.invoiceNumber, 160, currentY + 45);
      doc.text(formatCurrency(receiptData.invoice.amount || "0"), 160, currentY + 62);
      doc.text(format(new Date(receiptData.invoice.dueDate), "MMM dd, yyyy"), 160, currentY + 79);

      // Status badge
      const statusColors: Record<string, string> = {
        'draft': '#9CA3AF',
        'sent': '#3B82F6',
        'paid': '#10B981',
        'overdue': '#EF4444'
      };
      doc.fillColor(statusColors[receiptData.invoice.status] || '#10B981');
      doc.text(receiptData.invoice.status.toUpperCase(), 410, currentY + 45);

      currentY += 130;

      // ===== TOTAL AMOUNT PAID - Highlighted (centered and balanced) =====
      const totalBoxWidth = 220;
      const totalBoxX = (595 - totalBoxWidth) / 2; // Center the box on the page

      doc.save();
      doc.rect(totalBoxX, currentY - 5, totalBoxWidth, 40).fillAndStroke("#F3F4F6", "#E5E7EB");
      doc.restore();

      doc.fontSize(13).font("Helvetica-Bold").fillColor("#111827");
      doc.text("Total Amount Paid:", totalBoxX, currentY + 8, { width: totalBoxWidth, align: "center" });
      doc.fontSize(16).fillColor("#C8102E");
      doc.text(formatCurrency(receiptData.payment.amount || "0"), totalBoxX, currentY + 25, { width: totalBoxWidth, align: "center" });

      currentY += 55;

      // ===== NOTES SECTION =====
      if (receiptData.payment.notes) {
        const notesBoxHeight = Math.min(receiptData.payment.notes.length / 2 + 60, 100);

        doc.save();
        doc.rect(40, currentY, 515, notesBoxHeight).stroke("#E5E7EB");
        doc.rect(40, currentY, 515, 25).fillAndStroke("#F3F4F6", "#E5E7EB");
        doc.restore();

        doc.fontSize(11).font("Helvetica-Bold").fillColor("#374151");
        doc.text("Notes:", 50, currentY + 7);

        doc.fontSize(10).font("Helvetica").fillColor("#6B7280");
        doc.text(receiptData.payment.notes, 50, currentY + 35, { width: 495, align: "left" });

        currentY += notesBoxHeight + 20;
      }

      // ===== SIGNATURE SECTION =====
      currentY += 20;
      const signatureY = Math.min(currentY, 600); // Ensure signatures stay on first page

      doc.fontSize(10).font("Helvetica").fillColor("#111827");

      // Draw professional signature lines
      const sig1X = 100;
      const sig2X = 350;
      const lineLength = 130;

      doc.save();
      doc.moveTo(sig1X, signatureY).lineTo(sig1X + lineLength, signatureY).strokeColor("#374151").lineWidth(1).stroke();
      doc.moveTo(sig2X, signatureY).lineTo(sig2X + lineLength, signatureY).strokeColor("#374151").lineWidth(1).stroke();
      doc.restore();

      doc.text("Received By", sig1X, signatureY + 10, { width: lineLength, align: "center" });
      doc.text("Authorized Signature", sig2X, signatureY + 10, { width: lineLength, align: "center" });

      // ===== FOOTER (inline, not fixed position) =====
      const footerY = Math.min(signatureY + 60, 720);

      doc.save();
      doc.moveTo(40, footerY)
        .lineTo(555, footerY)
        .strokeColor("#E5E7EB")
        .lineWidth(1)
        .stroke();
      doc.restore();

      doc.fontSize(8).font("Helvetica").fillColor("#6B7280");
      doc.text(
        "MaxTech BD | 522, SK Mujib Road (4th Floor), Agrabad, Double Mooring, Chattogram, Bangladesh",
        40,
        footerY + 10,
        { width: 515, align: "center" }
      );
      doc.text(
        "Phone: +8801843180008 | Email: info@maxtechbd.com",
        40,
        footerY + 22,
        { width: 515, align: "center" }
      );

      // Finalize the PDF
      doc.end();
    } catch (error: any) {
      console.error("Payment Receipt PDF export error:", error);
      res.status(500).json({ error: "Failed to export PDF" });
    }
  });

  // Payment Receipt Excel Export
  app.get("/api/payment-receipt/export-excel", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export payment receipts
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const paymentId = req.query.paymentId as string;

      if (!paymentId) {
        return res.status(400).json({ error: "Payment ID is required" });
      }

      // Fetch payment receipt data
      const [receiptData] = await db.select({
        payment: {
          id: payments.id,
          amount: payments.amount,
          paymentDate: payments.paymentDate,
          paymentMethod: payments.paymentMethod,
          notes: payments.notes
        },
        invoice: {
          invoiceNumber: invoices.invoiceNumber,
          amount: invoices.amount,
          dueDate: invoices.dueDate,
          status: invoices.status
        },
        client: {
          companyName: clients.name,
          email: clients.email,
          phone: clients.phone
        }
      })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .innerJoin(clients, eq(invoices.clientId, clients.id))
        .where(eq(payments.id, paymentId))
        .limit(1);

      if (!receiptData) {
        return res.status(404).json({ error: "Payment receipt not found" });
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Payment Receipt");

      // Company Header
      worksheet.mergeCells("A1:D1");
      const titleRow = worksheet.getCell("A1");
      titleRow.value = "MaxTech BD";
      titleRow.font = { size: 18, bold: true, color: { argb: "FFE11D26" } };
      titleRow.alignment = { horizontal: "center", vertical: "middle" };

      worksheet.mergeCells("A2:D2");
      const addressRow = worksheet.getCell("A2");
      addressRow.value = "522 SK Mujib Road, Dhaka, Bangladesh";
      addressRow.font = { size: 10 };
      addressRow.alignment = { horizontal: "center" };

      worksheet.mergeCells("A3:D3");
      const contactRow = worksheet.getCell("A3");
      contactRow.value = "Phone: +8801843180008 | Email: info@maxtechbd.com";
      contactRow.font = { size: 10 };
      contactRow.alignment = { horizontal: "center" };

      worksheet.addRow([]);

      // Receipt Title
      worksheet.mergeCells("A5:D5");
      const receiptTitleRow = worksheet.getCell("A5");
      receiptTitleRow.value = "PAYMENT RECEIPT";
      receiptTitleRow.font = { size: 14, bold: true };
      receiptTitleRow.alignment = { horizontal: "center" };

      worksheet.addRow([]);

      // Payment Information
      worksheet.addRow(["Payment Information"]).font = { bold: true, size: 12 };
      worksheet.addRow(["Receipt Number:", receiptData.payment.id.substring(0, 8).toUpperCase()]);
      worksheet.addRow(["Payment Date:", format(new Date(receiptData.payment.paymentDate), "MMMM dd, yyyy")]);
      worksheet.addRow(["Payment Method:", receiptData.payment.paymentMethod]);

      worksheet.addRow([]);

      // Client Information
      worksheet.addRow(["Client Information"]).font = { bold: true, size: 12 };
      worksheet.addRow(["Company Name:", receiptData.client.companyName]);
      worksheet.addRow(["Email:", receiptData.client.email]);
      worksheet.addRow(["Phone:", receiptData.client.phone || "N/A"]);

      worksheet.addRow([]);

      // Invoice Reference
      worksheet.addRow(["Invoice Reference"]).font = { bold: true, size: 12 };
      worksheet.addRow(["Invoice Number:", receiptData.invoice.invoiceNumber]);
      worksheet.addRow(["Invoice Amount:", parseFloat(receiptData.invoice.amount || "0")]);
      worksheet.addRow(["Due Date:", format(new Date(receiptData.invoice.dueDate), "MMM dd, yyyy")]);
      worksheet.addRow(["Status:", receiptData.invoice.status.toUpperCase()]);

      worksheet.addRow([]);

      // Amount Paid (highlighted)
      const amountRow = worksheet.addRow(["TOTAL AMOUNT PAID:", parseFloat(receiptData.payment.amount || "0")]);
      amountRow.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
      amountRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE11D26" } };
      amountRow.getCell(2).numFmt = "#,##0.00";

      worksheet.addRow([]);

      // Notes (if any)
      if (receiptData.payment.notes) {
        worksheet.addRow(["Notes:"]).font = { bold: true, size: 12 };
        worksheet.addRow([receiptData.payment.notes]);
        worksheet.addRow([]);
      }

      // Signature Section
      worksheet.addRow([]);
      worksheet.addRow(["Received By", "", "Authorized Signature"]);
      worksheet.addRow(["_______________________", "", "_______________________"]);

      // Column widths
      worksheet.getColumn(1).width = 25;
      worksheet.getColumn(2).width = 30;
      worksheet.getColumn(3).width = 25;
      worksheet.getColumn(4).width = 30;

      // Write to buffer and send
      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=Payment-Receipt-${receiptData.payment.id.substring(0, 8)}.xlsx`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Payment Receipt Excel export error:", error);
      res.status(500).json({ error: "Failed to export Excel" });
    }
  });

  // Payment Receipt Word Export
  app.get("/api/payment-receipt/export-word", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export payment receipts
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const paymentId = req.query.paymentId as string;

      if (!paymentId) {
        return res.status(400).json({ error: "Payment ID is required" });
      }

      // Fetch payment receipt data
      const [receiptData] = await db.select({
        payment: {
          id: payments.id,
          amount: payments.amount,
          paymentDate: payments.paymentDate,
          paymentMethod: payments.paymentMethod,
          notes: payments.notes
        },
        invoice: {
          invoiceNumber: invoices.invoiceNumber,
          amount: invoices.amount,
          dueDate: invoices.dueDate,
          status: invoices.status
        },
        client: {
          companyName: clients.name,
          email: clients.email,
          phone: clients.phone
        }
      })
        .from(payments)
        .innerJoin(invoices, eq(payments.invoiceId, invoices.id))
        .innerJoin(clients, eq(invoices.clientId, clients.id))
        .where(eq(payments.id, paymentId))
        .limit(1);

      if (!receiptData) {
        return res.status(404).json({ error: "Payment receipt not found" });
      }

      const doc = new Document({
        sections: [{
          children: [
            // Company Header
            new Paragraph({
              text: "MaxTech BD",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: "522 SK Mujib Road, Dhaka, Bangladesh",
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: "Phone: +8801843180008 | Email: info@maxtechbd.com",
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),

            // Receipt Title
            new Paragraph({
              text: "PAYMENT RECEIPT",
              heading: HeadingLevel.HEADING_2,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),

            // Payment Information
            new Paragraph({
              text: "Payment Information",
              heading: HeadingLevel.HEADING_3,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: `Receipt Number: ${receiptData.payment.id.substring(0, 8).toUpperCase()}`,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Payment Date: ${format(new Date(receiptData.payment.paymentDate), "MMMM dd, yyyy")}`,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Payment Method: ${receiptData.payment.paymentMethod}`,
              spacing: { after: 300 }
            }),

            // Client Information
            new Paragraph({
              text: "Client Information",
              heading: HeadingLevel.HEADING_3,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: `Company Name: ${receiptData.client.companyName}`,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Email: ${receiptData.client.email}`,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Phone: ${receiptData.client.phone || "N/A"}`,
              spacing: { after: 300 }
            }),

            // Invoice Reference
            new Paragraph({
              text: "Invoice Reference",
              heading: HeadingLevel.HEADING_3,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: `Invoice Number: ${receiptData.invoice.invoiceNumber}`,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Invoice Amount: ${formatCurrency(receiptData.invoice.amount || "0")}`,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Due Date: ${format(new Date(receiptData.invoice.dueDate), "MMM dd, yyyy")}`,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Status: ${receiptData.invoice.status.toUpperCase()}`,
              spacing: { after: 300 }
            }),

            // Amount Paid (highlighted)
            new Paragraph({
              text: `TOTAL AMOUNT PAID: ${formatCurrency(receiptData.payment.amount || "0")}`,
              alignment: AlignmentType.CENTER,
              spacing: { before: 300, after: 300 },
              shading: {
                type: ShadingType.SOLID,
                color: "E11D26",
                fill: "E11D26"
              }
            }),

            // Notes (if any)
            ...(receiptData.payment.notes ? [
              new Paragraph({
                text: "Notes",
                heading: HeadingLevel.HEADING_3,
                spacing: { before: 300, after: 200 }
              }),
              new Paragraph({
                text: receiptData.payment.notes,
                spacing: { after: 300 }
              })
            ] : []),

            // Signature Section
            new Paragraph({
              text: "",
              spacing: { before: 600, after: 200 }
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({
                        text: "Received By",
                        alignment: AlignmentType.CENTER
                      })],
                      borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: "" })],
                      borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
                    }),
                    new TableCell({
                      children: [new Paragraph({
                        text: "Authorized Signature",
                        alignment: AlignmentType.CENTER
                      })],
                      borders: { top: { style: BorderStyle.SINGLE, size: 1 }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }
                    })
                  ]
                })
              ]
            }),

            // Footer
            new Paragraph({
              text: `Generated on ${format(new Date(), "MMMM dd, yyyy")}`,
              alignment: AlignmentType.CENTER,
              spacing: { before: 600 }
            })
          ]
        }]
      });

      const buffer = await Packer.toBuffer(doc);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename=Payment-Receipt-${receiptData.payment.id.substring(0, 8)}.docx`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Payment Receipt Word export error:", error);
      res.status(500).json({ error: "Failed to export Word document" });
    }
  });

  // HR Attendance Report
  app.get("/api/hr-attendance-report", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can view attendance reports
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { startDate, endDate, employeeId, departmentId } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: "Start date and end date are required" });
      }

      // Build where conditions (always include date range)
      const whereConditions: any[] = [
        gte(attendance.date, startDate as string),
        lte(attendance.date, endDate as string),
      ];

      // Add employee or department filter
      if (employeeId && employeeId !== "all") {
        whereConditions.push(eq(employees.id, employeeId as string));
      } else if (departmentId && departmentId !== "all") {
        whereConditions.push(eq(employees.departmentId, departmentId as string));
      }

      // Build and execute attendance query (always has at least date range conditions)
      // Use leftJoin for employees to show all attendance records
      // Use CASE to check if employee record exists and provide appropriate fallback
      const attendanceRecords = await db.select({
        id: attendance.id,
        userId: attendance.userId,
        date: attendance.date,
        checkIn: attendance.checkIn,
        checkOut: attendance.checkOut,
        status: attendance.status,
        lateDuration: attendance.lateDuration,
        notes: attendance.notes,
        employeeId: employees.id,
        employeeCode: employees.employeeId,
        employeeName: sql<string>`CASE WHEN ${employees.id} IS NULL THEN 'Unassigned Employee' ELSE ${users.fullName} END`.as('employeeName'),
        departmentId: employees.departmentId,
        departmentName: sql<string>`CASE WHEN ${departments.id} IS NULL THEN 'N/A' ELSE ${departments.name} END`.as('departmentName'),
      })
        .from(attendance)
        .innerJoin(users, eq(attendance.userId, users.id))
        .leftJoin(employees, eq(users.id, employees.userId))
        .leftJoin(departments, eq(employees.departmentId, departments.id))
        .where(and(...whereConditions))
        .orderBy(attendance.date);

      // Format attendance data for frontend
      // Note: COALESCE in SQL query handles null values, so no need for fallbacks here
      const attendanceData = attendanceRecords.map(record => ({
        date: record.date,
        employeeId: record.employeeId || "N/A",
        employeeName: record.employeeName, // Already has COALESCE fallback in SQL
        employeeCode: record.employeeCode || "N/A",
        department: record.departmentName, // Already has COALESCE fallback in SQL
        status: record.status || "Absent", // Keep original casing - frontend handles normalization
        checkInTime: record.checkIn ? format(new Date(record.checkIn), "hh:mm a") : null,
        checkOutTime: record.checkOut ? format(new Date(record.checkOut), "hh:mm a") : null,
        notes: record.notes || null,
        lateDuration: record.lateDuration || 0,
      }));

      // Calculate summary statistics (case-insensitive matching)
      const totalDays = attendanceData.length;
      const presentCount = attendanceData.filter(a => a.status.toLowerCase() === "present").length;
      const lateCount = attendanceData.filter(a => a.status.toLowerCase() === "late").length;
      const halfDayCount = attendanceData.filter(a => a.status.toLowerCase() === "half-day").length;
      const absentCount = attendanceData.filter(a => a.status.toLowerCase() === "absent").length;
      // Overtime: Set to 0 as proper overtime tracking is not yet implemented
      // TODO: Implement proper overtime calculation based on office hours settings
      const overtimeCount = 0;

      // Calculate working days (excluding Sundays for Bangladesh)
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      let workingDays = 0;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        // Count all days except Sundays (day 0)
        if (d.getDay() !== 0) {
          workingDays++;
        }
      }

      // Fetch HR settings to get expected hours per day
      const hrSettingsRecord = await db.select().from(hrSettings).limit(1);
      let expectedDailyHours = 8; // Default fallback
      if (hrSettingsRecord.length > 0) {
        const parsedHours = parseFloat(hrSettingsRecord[0].fullDayHours || "8");
        // Resilient fallback: if parseFloat returns NaN, use default
        expectedDailyHours = !isNaN(parsedHours) && parsedHours > 0 ? parsedHours : 8;
      }

      // Calculate on-time count (present and not late, excluding half-day)
      const onTimeCount = Math.max(0, presentCount - lateCount - halfDayCount);

      // Calculate total hours worked and per-day overtime with null safety
      let totalHoursWorked = 0;
      let overtimeHours = 0;

      attendanceData.forEach(record => {
        // Only calculate hours if both check-in and check-out times exist
        if (record.checkInTime && record.checkOutTime &&
          record.checkInTime.trim() !== "" && record.checkOutTime.trim() !== "") {
          try {
            const checkIn = new Date(`2000-01-01 ${record.checkInTime}`);
            const checkOut = new Date(`2000-01-01 ${record.checkOutTime}`);

            // Validate that dates are valid
            if (!isNaN(checkIn.getTime()) && !isNaN(checkOut.getTime())) {
              const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
              // Only add positive hours (check-out after check-in)
              if (hours > 0 && hours < 24) {
                totalHoursWorked += hours;
                // Calculate per-day overtime (hours worked - expected daily hours)
                const dailyOvertime = Math.max(0, hours - expectedDailyHours);
                overtimeHours += dailyOvertime;
              }
            }
          } catch (e) {
            // Skip invalid times silently
          }
        }
      });

      res.json({
        attendanceData,
        summary: {
          totalDays,
          workingDays,
          presentCount,
          onTimeCount,
          lateCount,
          halfDayCount,
          absentCount,
          overtimeCount,
          overtimeHours: overtimeHours.toFixed(2),
          totalHoursWorked: totalHoursWorked.toFixed(2),
          presentPercentage: totalDays > 0 ? ((presentCount / totalDays) * 100).toFixed(2) : "0",
          latePercentage: totalDays > 0 ? ((lateCount / totalDays) * 100).toFixed(2) : "0",
          halfDayPercentage: totalDays > 0 ? ((halfDayCount / totalDays) * 100).toFixed(2) : "0",
          absentPercentage: totalDays > 0 ? ((absentCount / totalDays) * 100).toFixed(2) : "0",
        },
        dateRange: {
          start: format(new Date(startDate as string), "MMM dd, yyyy"),
          end: format(new Date(endDate as string), "MMM dd, yyyy"),
        },
      });
    } catch (error: any) {
      console.error("HR Attendance Report fetch error:", error);
      res.status(500).json({ error: "Failed to fetch attendance report" });
    }
  });

  // HR Attendance Report PDF Export - Professional Job Card Format
  app.get("/api/hr-attendance-report/export-pdf", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export attendance reports
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const reportData = JSON.parse(decodeURIComponent(req.query.data as string));
      const isEmployeeJobCard = reportData.attendanceData.length > 0 &&
        reportData.attendanceData.every((r: any) => r.employeeId === reportData.attendanceData[0].employeeId);

      const doc = new PDFDocument({ margin: 25, size: 'A4' });
      const fileName = isEmployeeJobCard
        ? `Job-Card-${reportData.attendanceData[0]?.employeeName?.replace(/\s+/g, '-')}-${format(new Date(), "yyyy-MM-dd")}.pdf`
        : `Attendance-Report-${format(new Date(), "yyyy-MM-dd")}.pdf`;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
      doc.pipe(res);

      // ===== PROFESSIONAL HEADER SECTION (Non-Overlapping Bounds) =====
      let currentY = 30;
      const headerStartY = currentY;

      // Define explicit bounding boxes to prevent overlap
      const leftBounds = { x: 40, width: 80 };        // Logo section
      const centerBounds = { x: 125, width: 270 };    // Company details  
      const rightBounds = { x: 405, width: 150 };     // Job card info

      let maxHeaderHeight = 0;

      // ===== LEFT: Logo =====
      let logoHeight = 70;
      try {
        const logoPath = path.join(__dirname, "../attached_assets/Untitled design (1)_1763794635122.png");
        doc.image(logoPath, leftBounds.x, headerStartY, { width: 70, height: 70 });
        maxHeaderHeight = Math.max(maxHeaderHeight, logoHeight);
      } catch (error) {
        console.warn("Logo not found, skipping logo in PDF");
        logoHeight = 0;
      }

      // ===== CENTER: Company Details =====
      let centerY = headerStartY;
      let centerHeight = 0;

      // Company name
      doc.fontSize(16).font("Helvetica-Bold").fillColor(BRAND_COLORS.primary);
      const companyNameHeight = doc.heightOfString("MAXTECH BD", { width: centerBounds.width, align: "center" });
      doc.text("MAXTECH BD", centerBounds.x, centerY, { width: centerBounds.width, align: "center" });
      centerY += companyNameHeight + 5;
      centerHeight += companyNameHeight + 5;

      // Address line 1
      doc.fontSize(9).font("Helvetica").fillColor(BRAND_COLORS.black);
      const addr1Height = doc.heightOfString("522, SK Mujib Road (4th Floor)", { width: centerBounds.width, align: "center" });
      doc.text("522, SK Mujib Road (4th Floor)", centerBounds.x, centerY, { width: centerBounds.width, align: "center" });
      centerY += addr1Height + 2;
      centerHeight += addr1Height + 2;

      // Address line 2
      const addr2Height = doc.heightOfString("Agrabad, Double Mooring, Chattogram", { width: centerBounds.width, align: "center" });
      doc.text("Agrabad, Double Mooring, Chattogram", centerBounds.x, centerY, { width: centerBounds.width, align: "center" });
      centerY += addr2Height + 3;
      centerHeight += addr2Height + 3;

      // Contact info
      doc.fontSize(8).font("Helvetica").fillColor(BRAND_COLORS.gray);
      const contactHeight = doc.heightOfString("Phone: +8801843180008", { width: centerBounds.width, align: "center" });
      doc.text("Phone: +8801843180008 | Email: support@maxtechbd.com", centerBounds.x, centerY, { width: centerBounds.width, align: "center" });
      centerHeight += contactHeight;

      maxHeaderHeight = Math.max(maxHeaderHeight, centerHeight);

      // ===== RIGHT: Job Card Info Box =====
      let rightY = headerStartY;
      let rightHeight = 0;

      // Measure actual text heights for box content
      const boxPadding = 10;
      const boxInnerWidth = rightBounds.width - (2 * boxPadding);

      doc.fontSize(10).font("Helvetica-Bold");
      const titleText = isEmployeeJobCard ? "Employee Job Card" : "Attendance Report";
      const titleHeight = doc.heightOfString(titleText, { width: boxInnerWidth, align: "center" });

      doc.fontSize(7).font("Helvetica");
      const periodText = `Period: ${reportData.dateRange.start} – ${reportData.dateRange.end}`;
      const periodHeight = doc.heightOfString(periodText, { width: boxInnerWidth, align: "center" });

      const generatedText = `Generated: ${format(new Date(), "MMM dd, yyyy")}`;
      const generatedHeight = doc.heightOfString(generatedText, { width: boxInnerWidth, align: "center" });

      // Calculate total box height based on measured content
      const lineSpacing = 4;
      const boxHeight = boxPadding + titleHeight + lineSpacing + periodHeight + lineSpacing + generatedHeight + boxPadding;

      // Draw box background
      doc.save();
      doc.roundedRect(rightBounds.x, rightY, rightBounds.width, boxHeight, 3)
        .fillAndStroke("#f8f9fa", "#d1d5db");
      doc.restore();

      rightY += boxPadding;

      // Title
      doc.fontSize(10).font("Helvetica-Bold").fillColor(BRAND_COLORS.primary);
      doc.text(titleText, rightBounds.x + boxPadding, rightY, {
        width: boxInnerWidth,
        align: "center",
        lineBreak: false
      });
      rightY += titleHeight + lineSpacing;

      // Period
      doc.fontSize(7).font("Helvetica").fillColor("#6b7280");
      doc.text(periodText, rightBounds.x + boxPadding, rightY, {
        width: boxInnerWidth,
        align: "center",
        lineBreak: false
      });
      rightY += periodHeight + lineSpacing;

      // Generated date
      doc.text(generatedText, rightBounds.x + boxPadding, rightY, {
        width: boxInnerWidth,
        align: "center",
        lineBreak: false
      });

      rightHeight = boxHeight;
      maxHeaderHeight = Math.max(maxHeaderHeight, rightHeight);

      // Advance cursor by maximum header height
      currentY = headerStartY + maxHeaderHeight + 15;

      // Header separator line
      doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor(BRAND_COLORS.border).lineWidth(1).stroke();
      currentY += 20;

      // ===== EMPLOYEE INFO PANEL (For Job Card) - Full-width Professional Box =====
      if (isEmployeeJobCard) {
        // Full-width professional box with subtle grey background
        doc.save();
        doc.roundedRect(40, currentY, 515, 70, 4)
          .fillAndStroke("#f5f5f5", "#d1d5db");
        doc.restore();

        // Employee details in clean horizontal layout
        const infoY = currentY + 20;

        // Employee Name (Primary Info)
        doc.fontSize(11).font("Helvetica").fillColor("#6b7280");
        doc.text("EMPLOYEE NAME", 55, infoY, { width: 120 });
        doc.fontSize(12).font("Helvetica-Bold").fillColor(BRAND_COLORS.black);
        doc.text(reportData.attendanceData[0].employeeName, 55, infoY + 14, { width: 200 });

        // Employee Code
        doc.fontSize(11).font("Helvetica").fillColor("#6b7280");
        doc.text("CODE", 270, infoY, { width: 80 });
        doc.fontSize(12).font("Helvetica-Bold").fillColor(BRAND_COLORS.black);
        doc.text(reportData.attendanceData[0].employeeCode, 270, infoY + 14, { width: 100 });

        // Department
        doc.fontSize(11).font("Helvetica").fillColor("#6b7280");
        doc.text("DEPARTMENT", 385, infoY, { width: 150 });
        doc.fontSize(12).font("Helvetica-Bold").fillColor(BRAND_COLORS.black);
        doc.text(reportData.attendanceData[0].department, 385, infoY + 14, { width: 150 });

        currentY += 90;
      }

      // ===== ATTENDANCE SUMMARY GRID (6 Cards: 3×2 Professional Layout) =====
      doc.fontSize(14).font("Helvetica-Bold").fillColor(BRAND_COLORS.primary);
      doc.text("Attendance Summary", 40, currentY, { width: 515, align: "center" });
      currentY += 30;

      // Streamlined 6-card layout for cleaner look
      const summaryItems = [
        { label: "Working Days", value: reportData.summary.workingDays || reportData.summary.totalDays, color: "#000000" },
        { label: "Present", value: reportData.summary.presentCount, color: "#10B981" },
        { label: "Late", value: reportData.summary.lateCount, color: "#F59E0B" },
        { label: "Absent", value: reportData.summary.absentCount, color: "#EF4444" },
        { label: "Total Hours", value: `${reportData.summary.totalHoursWorked || "0.00"}`, color: "#1E40AF" },
        { label: "Overtime", value: `${reportData.summary.overtimeHours || "0.00"}`, color: "#8B5CF6" },
      ];

      // Professional grid layout (3 columns × 2 rows with even spacing)
      const gridCols = 3;
      const cardGap = 12;
      const cardWidth = (515 - (cardGap * (gridCols - 1))) / gridCols;
      const cardHeight = 65;

      summaryItems.forEach((item, index) => {
        const col = index % gridCols;
        const row = Math.floor(index / gridCols);
        const x = 40 + (col * (cardWidth + cardGap));
        const y = currentY + (row * (cardHeight + cardGap));

        // Card with professional border and subtle background
        doc.save();
        doc.roundedRect(x, y, cardWidth, cardHeight, 4)
          .fillAndStroke("#fafafa", "#e0e0e0");
        doc.restore();

        // Label (small, uppercase, grey)
        doc.fontSize(9).font("Helvetica").fillColor("#6b7280");
        doc.text(item.label.toUpperCase(), x + 12, y + 15, {
          width: cardWidth - 24,
          align: "left"
        });

        // Value (large, bold, colored)
        doc.fontSize(20).font("Helvetica-Bold").fillColor(item.color);
        doc.text(String(item.value), x + 12, y + 32, {
          width: cardWidth - 24,
          align: "left"
        });
      });

      currentY += (2 * (cardHeight + cardGap)) + 25;

      // ===== DAILY ATTENDANCE TABLE (Corporate Style) =====
      doc.fontSize(13).font("Helvetica-Bold").fillColor(BRAND_COLORS.primary);
      doc.text("Daily Attendance Record", 40, currentY, { width: 515, align: "center" });
      currentY += 25;

      // Table columns
      const columns = isEmployeeJobCard
        ? [
          { label: "Date", width: 90, align: "left" as const },
          { label: "Day", width: 70, align: "left" as const },
          { label: "Check In", width: 85, align: "left" as const },
          { label: "Check Out", width: 85, align: "left" as const },
          { label: "Status", width: 105, align: "left" as const },
          { label: "Hours", width: 80, align: "right" as const },
        ]
        : [
          { label: "Date", width: 85, align: "left" as const },
          { label: "Employee", width: 120, align: "left" as const },
          { label: "Dept", width: 90, align: "left" as const },
          { label: "Status", width: 80, align: "center" as const },
          { label: "Check In", width: 70, align: "center" as const },
          { label: "Check Out", width: 70, align: "center" as const },
        ];

      // Table header with professional styling
      let tableY = currentY;
      const tableX = 40;
      const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
      const headerHeight = 32;

      // Header background
      doc.save();
      doc.rect(tableX, tableY, totalWidth, headerHeight).fill("#f5f5f5");
      doc.rect(tableX, tableY, totalWidth, headerHeight).strokeColor("#d1d5db").lineWidth(1).stroke();
      doc.restore();

      // Header text
      doc.fontSize(10).font("Helvetica-Bold").fillColor(BRAND_COLORS.black);
      let headerX = tableX + 8;
      columns.forEach(col => {
        doc.text(col.label, headerX, tableY + 10, {
          width: col.width - 16,
          align: col.align
        });
        headerX += col.width;
      });

      tableY += headerHeight;

      // Table rows with alternating colors
      reportData.attendanceData.forEach((record: any, index: number) => {
        if (tableY > 730) {
          doc.addPage();
          tableY = 50;

          // Repeat header on new page
          doc.save();
          doc.rect(tableX, tableY, totalWidth, headerHeight).fill("#f5f5f5");
          doc.rect(tableX, tableY, totalWidth, headerHeight).strokeColor("#d1d5db").lineWidth(1).stroke();
          doc.restore();

          doc.fontSize(10).font("Helvetica-Bold").fillColor(BRAND_COLORS.black);
          let repeatHeaderX = tableX + 8;
          columns.forEach(col => {
            doc.text(col.label, repeatHeaderX, tableY + 10, {
              width: col.width - 16,
              align: col.align
            });
            repeatHeaderX += col.width;
          });
          tableY += headerHeight;
        }

        const rowHeight = 28;
        const bgColor = index % 2 === 0 ? "#ffffff" : "#fafafa";

        // Row background
        doc.save();
        doc.rect(tableX, tableY, totalWidth, rowHeight).fill(bgColor);
        doc.rect(tableX, tableY, totalWidth, rowHeight).strokeColor("#e5e7eb").lineWidth(0.5).stroke();
        doc.restore();

        // Calculate hours worked
        let hoursWorked = "-";
        if (record.checkInTime && record.checkOutTime) {
          try {
            const checkIn = new Date(`2000-01-01 ${record.checkInTime}`);
            const checkOut = new Date(`2000-01-01 ${record.checkOutTime}`);
            const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
            hoursWorked = hours > 0 ? hours.toFixed(1) : "-";
          } catch (e) {
            hoursWorked = "-";
          }
        }

        const dayOfWeek = format(new Date(record.date), "EEE");

        // Row data
        const rowData = isEmployeeJobCard
          ? [
            { text: record.date, width: 90, align: "left" as const, bold: false },
            { text: dayOfWeek, width: 70, align: "left" as const, bold: false },
            { text: record.checkInTime || "-", width: 85, align: "left" as const, bold: false },
            { text: record.checkOutTime || "-", width: 85, align: "left" as const, bold: false },
            { text: record.status, width: 105, align: "left" as const, bold: true },
            { text: hoursWorked, width: 80, align: "right" as const, bold: false },
          ]
          : [
            { text: record.date, width: 85, align: "left" as const, bold: false },
            { text: record.employeeName, width: 120, align: "left" as const, bold: false },
            { text: record.department, width: 90, align: "left" as const, bold: false },
            { text: record.status, width: 80, align: "center" as const, bold: true },
            { text: record.checkInTime || "-", width: 70, align: "center" as const, bold: false },
            { text: record.checkOutTime || "-", width: 70, align: "center" as const, bold: false },
          ];

        // Row text
        doc.fontSize(9).fillColor(BRAND_COLORS.black);
        let rowX = tableX + 8;
        rowData.forEach(col => {
          if (col.bold) {
            doc.font("Helvetica-Bold");
          } else {
            doc.font("Helvetica");
          }
          doc.text(col.text, rowX, tableY + 9, {
            width: col.width - 16,
            align: col.align
          });
          rowX += col.width;
        });

        tableY += rowHeight;
      });

      // ===== PROFESSIONAL FOOTER =====
      const footerY = 770;
      doc.moveTo(40, footerY).lineTo(555, footerY).strokeColor(BRAND_COLORS.border).lineWidth(1).stroke();

      doc.fontSize(9).font("Helvetica-Bold").fillColor(BRAND_COLORS.black);
      doc.text("MaxTech BD | Smart Agency Control Hub", 40, footerY + 12, { width: 515, align: "center" });

      doc.fontSize(8).font("Helvetica").fillColor(BRAND_COLORS.gray);
      doc.text("Developed by MaxTech BD IT Team", 40, footerY + 26, { width: 515, align: "center" });

      doc.end();
    } catch (error: any) {
      console.error("HR Attendance Report PDF export error:", error);
      res.status(500).json({ error: "Failed to export PDF" });
    }
  });

  // HR Attendance Report Excel Export - Enhanced Job Card Format
  app.get("/api/hr-attendance-report/export-excel", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export attendance reports
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const reportData = JSON.parse(decodeURIComponent(req.query.data as string));
      const isEmployeeJobCard = reportData.attendanceData.length > 0 &&
        reportData.attendanceData.every((r: any) => r.employeeId === reportData.attendanceData[0].employeeId);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(isEmployeeJobCard ? "Job Card" : "Attendance Report");

      const maxCol = isEmployeeJobCard ? "G" : "F";

      // Company header
      worksheet.mergeCells(`A1:${maxCol}1`);
      worksheet.getCell("A1").value = COMPANY_INFO.name;
      worksheet.getCell("A1").font = { size: 18, bold: true, color: { argb: "FFE11D26" } };
      worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(1).height = 25;

      worksheet.mergeCells(`A2:${maxCol}2`);
      worksheet.getCell("A2").value = COMPANY_INFO.address1;
      worksheet.getCell("A2").alignment = { horizontal: "center" };

      worksheet.mergeCells(`A3:${maxCol}3`);
      worksheet.getCell("A3").value = `${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`;
      worksheet.getCell("A3").alignment = { horizontal: "center" };

      worksheet.mergeCells(`A4:${maxCol}4`);
      worksheet.getCell("A4").value = `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`;
      worksheet.getCell("A4").alignment = { horizontal: "center" };

      // Report title
      worksheet.mergeCells(`A6:${maxCol}6`);
      worksheet.getCell("A6").value = isEmployeeJobCard ? "EMPLOYEE JOB CARD" : "HR ATTENDANCE REPORT";
      worksheet.getCell("A6").font = { size: 16, bold: true, color: { argb: "FFE11D26" } };
      worksheet.getCell("A6").alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(6).height = 22;

      worksheet.mergeCells(`A7:${maxCol}7`);
      worksheet.getCell("A7").value = `Period: ${reportData.dateRange.start} to ${reportData.dateRange.end}`;
      worksheet.getCell("A7").alignment = { horizontal: "center" };

      let row = 9;

      // Employee info for job card
      if (isEmployeeJobCard) {
        worksheet.mergeCells(`A${row}:B${row}`);
        worksheet.getCell(`A${row}`).value = "Employee Name:";
        worksheet.getCell(`A${row}`).font = { bold: true };
        worksheet.mergeCells(`C${row}:${maxCol}${row}`);
        worksheet.getCell(`C${row}`).value = reportData.attendanceData[0].employeeName;
        row++;

        worksheet.mergeCells(`A${row}:B${row}`);
        worksheet.getCell(`A${row}`).value = "Employee Code:";
        worksheet.getCell(`A${row}`).font = { bold: true };
        worksheet.getCell(`C${row}`).value = reportData.attendanceData[0].employeeCode;
        worksheet.mergeCells(`D${row}:E${row}`);
        worksheet.getCell(`D${row}`).value = "Department:";
        worksheet.getCell(`D${row}`).font = { bold: true };
        worksheet.mergeCells(`F${row}:${maxCol}${row}`);
        worksheet.getCell(`F${row}`).value = reportData.attendanceData[0].department;
        row += 2;
      }

      // Enhanced Summary section with all analytics
      worksheet.mergeCells(`A${row}:${maxCol}${row}`);
      worksheet.getCell(`A${row}`).value = "ATTENDANCE SUMMARY";
      worksheet.getCell(`A${row}`).font = { size: 14, bold: true, color: { argb: "FFFFFFFF" } };
      worksheet.getCell(`A${row}`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE11D26" }
      };
      worksheet.getCell(`A${row}`).alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(row).height = 25;
      row++;

      // Summary grid
      const summaryData = [
        ["Working Days", reportData.summary.workingDays || reportData.summary.totalDays, "Present", `${reportData.summary.presentCount} (${reportData.summary.presentPercentage}%)`],
        ["On-Time", reportData.summary.onTimeCount || "0", "Late", `${reportData.summary.lateCount} (${reportData.summary.latePercentage}%)`],
        ["Half-Day", `${reportData.summary.halfDayCount} (${reportData.summary.halfDayPercentage}%)`, "Absent", `${reportData.summary.absentCount} (${reportData.summary.absentPercentage}%)`],
        ["Total Hours", `${reportData.summary.totalHoursWorked || "0"} hrs`, "Overtime", `${reportData.summary.overtimeHours || "0"} hrs`],
      ];

      summaryData.forEach((dataRow, idx) => {
        worksheet.getCell(`A${row + idx}`).value = dataRow[0];
        worksheet.getCell(`A${row + idx}`).font = { bold: true };
        worksheet.getCell(`A${row + idx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };

        worksheet.getCell(`B${row + idx}`).value = dataRow[1];
        worksheet.getCell(`B${row + idx}`).font = { bold: true, size: 12 };

        worksheet.getCell(`C${row + idx}`).value = dataRow[2];
        worksheet.getCell(`C${row + idx}`).font = { bold: true };
        worksheet.getCell(`C${row + idx}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };

        worksheet.mergeCells(`D${row + idx}:${maxCol}${row + idx}`);
        worksheet.getCell(`D${row + idx}`).value = dataRow[3];
        worksheet.getCell(`D${row + idx}`).font = { bold: true, size: 12 };
      });
      row += summaryData.length + 2;

      // Daily attendance table
      worksheet.mergeCells(`A${row}:${maxCol}${row}`);
      worksheet.getCell(`A${row}`).value = "DAILY ATTENDANCE RECORD";
      worksheet.getCell(`A${row}`).font = { size: 13, bold: true, color: { argb: "FFFFFFFF" } };
      worksheet.getCell(`A${row}`).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE11D26" }
      };
      worksheet.getCell(`A${row}`).alignment = { horizontal: "center", vertical: "middle" };
      worksheet.getRow(row).height = 22;
      row++;

      // Table headers
      if (isEmployeeJobCard) {
        ["A", "B", "C", "D", "E", "F", "G"].forEach((col, i) => {
          const headers = ["Date", "Day", "Check In", "Check Out", "Status", "Hours", "Remarks"];
          const cell = worksheet.getCell(`${col}${row}`);
          cell.value = headers[i];
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E1E1E" } };
          cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
          };
        });
      } else {
        ["A", "B", "C", "D", "E", "F"].forEach((col, i) => {
          const headers = ["Date", "Employee", "Department", "Status", "Check In", "Check Out"];
          const cell = worksheet.getCell(`${col}${row}`);
          cell.value = headers[i];
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E1E1E" } };
          cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          cell.alignment = { horizontal: "center", vertical: "middle" };
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" }
          };
        });
      }
      row++;

      // Table data
      reportData.attendanceData.forEach((record: any, index: number) => {
        // Calculate hours worked
        let hoursWorked = "-";
        if (record.checkInTime && record.checkOutTime) {
          try {
            const checkIn = new Date(`2000-01-01 ${record.checkInTime}`);
            const checkOut = new Date(`2000-01-01 ${record.checkOutTime}`);
            const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
            hoursWorked = hours > 0 ? hours.toFixed(1) : "-";
          } catch (e) {
            hoursWorked = "-";
          }
        }

        const dayOfWeek = format(new Date(record.date), "EEEE");

        if (isEmployeeJobCard) {
          worksheet.getCell(`A${row}`).value = record.date;
          worksheet.getCell(`B${row}`).value = dayOfWeek;
          worksheet.getCell(`C${row}`).value = record.checkInTime || "-";
          worksheet.getCell(`C${row}`).alignment = { horizontal: "center" };
          worksheet.getCell(`D${row}`).value = record.checkOutTime || "-";
          worksheet.getCell(`D${row}`).alignment = { horizontal: "center" };
          worksheet.getCell(`E${row}`).value = record.status;
          worksheet.getCell(`E${row}`).alignment = { horizontal: "center" };
          worksheet.getCell(`F${row}`).value = hoursWorked;
          worksheet.getCell(`F${row}`).alignment = { horizontal: "center" };
          worksheet.getCell(`G${row}`).value = record.notes || "";

          ["A", "B", "C", "D", "E", "F", "G"].forEach(col => {
            const cell = worksheet.getCell(`${col}${row}`);
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" }
            };
            if (index % 2 === 0) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
            }
          });
        } else {
          worksheet.getCell(`A${row}`).value = record.date;
          worksheet.getCell(`B${row}`).value = record.employeeName;
          worksheet.getCell(`C${row}`).value = record.department;
          worksheet.getCell(`D${row}`).value = record.status;
          worksheet.getCell(`D${row}`).alignment = { horizontal: "center" };
          worksheet.getCell(`E${row}`).value = record.checkInTime || "-";
          worksheet.getCell(`E${row}`).alignment = { horizontal: "center" };
          worksheet.getCell(`F${row}`).value = record.checkOutTime || "-";
          worksheet.getCell(`F${row}`).alignment = { horizontal: "center" };

          ["A", "B", "C", "D", "E", "F"].forEach(col => {
            const cell = worksheet.getCell(`${col}${row}`);
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" }
            };
            if (index % 2 === 0) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
            }
          });
        }

        // Color code status
        const statusColor = record.status.toLowerCase() === "present" ? "FF10B981" :
          record.status.toLowerCase() === "late" ? "FFF59E0B" :
            record.status.toLowerCase() === "half-day" ? "FF3B82F6" :
              "FFEF4444";
        worksheet.getCell(`${isEmployeeJobCard ? "E" : "D"}${row}`).font = { color: { argb: statusColor }, bold: true };

        row++;
      });

      // Set column widths
      if (isEmployeeJobCard) {
        worksheet.getColumn("A").width = 14;
        worksheet.getColumn("B").width = 12;
        worksheet.getColumn("C").width = 12;
        worksheet.getColumn("D").width = 12;
        worksheet.getColumn("E").width = 12;
        worksheet.getColumn("F").width = 10;
        worksheet.getColumn("G").width = 20;
      } else {
        worksheet.getColumn("A").width = 14;
        worksheet.getColumn("B").width = 25;
        worksheet.getColumn("C").width = 20;
        worksheet.getColumn("D").width = 12;
        worksheet.getColumn("E").width = 12;
        worksheet.getColumn("F").width = 12;
      }

      const fileName = isEmployeeJobCard
        ? `Job-Card-${reportData.attendanceData[0]?.employeeName?.replace(/\s+/g, '-')}-${format(new Date(), "yyyy-MM-dd")}.xlsx`
        : `Attendance-Report-${format(new Date(), "yyyy-MM-dd")}.xlsx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      console.error("HR Attendance Report Excel export error:", error);
      res.status(500).json({ error: "Failed to export Excel" });
    }
  });

  // HR Attendance Report Word Export
  app.get("/api/hr-attendance-report/export-word", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export attendance reports
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const reportData = JSON.parse(decodeURIComponent(req.query.data as string));

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Company Header
            new Paragraph({
              children: [new TextRun({ text: COMPANY_INFO.name, bold: true, size: 32, color: "E11D26" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: COMPANY_INFO.address1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),

            // Report Title
            new Paragraph({
              children: [new TextRun({ text: "HR Attendance Report", bold: true, size: 28, color: "E11D26" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: `Period: ${reportData.dateRange.start} to ${reportData.dateRange.end}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 }
            }),

            // Enhanced Summary Section
            new Paragraph({
              children: [new TextRun({ text: "ATTENDANCE SUMMARY", bold: true, size: 26, color: "E11D26" })],
              spacing: { after: 250 }
            }),
            new Paragraph({
              text: `Working Days: ${reportData.summary.workingDays || reportData.summary.totalDays}`,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Present: ${reportData.summary.presentCount} (${reportData.summary.presentPercentage}%) | On-Time: ${reportData.summary.onTimeCount || "0"}`,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Late: ${reportData.summary.lateCount} (${reportData.summary.latePercentage}%)`,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Half-Day: ${reportData.summary.halfDayCount} (${reportData.summary.halfDayPercentage}%)`,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Absent: ${reportData.summary.absentCount} (${reportData.summary.absentPercentage}%)`,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Total Hours Worked: ${reportData.summary.totalHoursWorked || "0"} hrs | Overtime: ${reportData.summary.overtimeHours || "0"} hrs`,
              spacing: { after: 300 }
            }),

            // Daily Attendance Record
            new Paragraph({
              children: [new TextRun({ text: "DAILY ATTENDANCE RECORD", bold: true, size: 26, color: "E11D26" })],
              spacing: { after: 200 }
            }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                // Header row
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ text: "Date", bold: true })],
                      shading: { fill: "E11D26", type: ShadingType.SOLID },
                      width: { size: 15, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: "Employee", bold: true })],
                      shading: { fill: "E11D26", type: ShadingType.SOLID },
                      width: { size: 25, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: "Department", bold: true })],
                      shading: { fill: "E11D26", type: ShadingType.SOLID },
                      width: { size: 20, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: "Status", bold: true })],
                      shading: { fill: "E11D26", type: ShadingType.SOLID },
                      width: { size: 15, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: "Check In", bold: true })],
                      shading: { fill: "E11D26", type: ShadingType.SOLID },
                      width: { size: 12, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: "Check Out", bold: true })],
                      shading: { fill: "E11D26", type: ShadingType.SOLID },
                      width: { size: 13, type: WidthType.PERCENTAGE }
                    })
                  ]
                }),
                // Data rows
                ...reportData.attendanceData.map((record: any) => {
                  return new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph(record.date)] }),
                      new TableCell({ children: [new Paragraph(record.employeeName)] }),
                      new TableCell({ children: [new Paragraph(record.department)] }),
                      new TableCell({ children: [new Paragraph(record.status)] }),
                      new TableCell({ children: [new Paragraph(record.checkInTime || "-")] }),
                      new TableCell({ children: [new Paragraph(record.checkOutTime || "-")] })
                    ]
                  });
                })
              ]
            }),

            // Footer
            new Paragraph({
              text: `Generated on ${format(new Date(), "MMMM dd, yyyy")}`,
              alignment: AlignmentType.CENTER,
              spacing: { before: 600 }
            })
          ]
        }]
      });

      const buffer = await Packer.toBuffer(doc);
      const isEmployeeJobCard = reportData.attendanceData.length > 0 &&
        reportData.attendanceData.every((r: any) => r.employeeId === reportData.attendanceData[0].employeeId);

      const fileName = isEmployeeJobCard
        ? `Job-Card-${reportData.attendanceData[0]?.employeeName?.replace(/\s+/g, '-')}-${format(new Date(), "yyyy-MM-dd")}.docx`
        : `Attendance-Report-${format(new Date(), "yyyy-MM-dd")}.docx`;

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename=${fileName}`);
      res.send(buffer);
    } catch (error: any) {
      console.error("HR Attendance Report Word export error:", error);
      res.status(500).json({ error: "Failed to export Word document" });
    }
  });

  // Leave Summary Report
  app.get("/api/leave-summary-report", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can view leave summary reports
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { year, employeeId, leaveTypeId } = req.query;
      const reportYear = year ? parseInt(year as string) : new Date().getFullYear();

      // Build employee filter with joins to get user and department data
      let employeeQuery = db.select({
        id: employees.id,
        departmentId: employees.departmentId,
        fullName: users.fullName,
        departmentName: departments.name,
      })
        .from(employees)
        .leftJoin(users, eq(employees.userId, users.id))
        .leftJoin(departments, eq(employees.departmentId, departments.id));

      if (employeeId && employeeId !== "all") {
        employeeQuery = employeeQuery.where(eq(employees.id, employeeId as string)) as any;
      }
      const employeesList = await employeeQuery;

      // Build leave types filter
      let leaveTypesQuery = db.select().from(leaveTypes);
      if (leaveTypeId && leaveTypeId !== "all") {
        leaveTypesQuery = leaveTypesQuery.where(eq(leaveTypes.id, leaveTypeId as string)) as any;
      }
      const leaveTypesList = await leaveTypesQuery;

      // Fetch all leave balances for the year
      const leaveBalancesList = await db.select()
        .from(leaveBalances)
        .where(eq(leaveBalances.year, reportYear));

      // Fetch all leave requests that overlap with the year
      const yearStart = new Date(reportYear, 0, 1);
      const yearEnd = new Date(reportYear, 11, 31, 23, 59, 59);
      const leaveRequestsList = await db.select()
        .from(leaveRequests)
        .where(
          and(
            lte(leaveRequests.startDate, yearEnd),
            gte(leaveRequests.endDate, yearStart)
          )
        );

      // Build leave summary data
      const leaveSummaryData: any[] = [];

      for (const employee of employeesList) {
        for (const leaveType of leaveTypesList) {
          // Find leave balance for this employee and leave type
          const balance = leaveBalancesList.find(
            b => b.employeeId === employee.id && b.leaveTypeId === leaveType.id && b.year === reportYear
          );

          // Count leave requests by status for this employee and leave type
          const requests = leaveRequestsList.filter(
            r => r.employeeId === employee.id && r.leaveTypeId === leaveType.id
          );

          const pendingCount = requests.filter(r => r.status === "pending").length;
          const approvedCount = requests.filter(r => r.status === "approved").length;
          const rejectedCount = requests.filter(r => r.status === "rejected").length;

          // Only add row if there's a balance or at least one request
          if (balance || requests.length > 0) {
            leaveSummaryData.push({
              employeeId: employee.id,
              employeeName: employee.fullName || "Unknown",
              department: employee.departmentName || "Unknown",
              leaveType: leaveType.name,
              totalDays: balance ? parseFloat(balance.totalDays || "0").toFixed(1) : "0.0",
              usedDays: balance ? parseFloat(balance.usedDays || "0").toFixed(1) : "0.0",
              remainingDays: balance ? parseFloat(balance.remainingDays || "0").toFixed(1) : "0.0",
              pendingRequests: pendingCount,
              approvedRequests: approvedCount,
              rejectedRequests: rejectedCount,
            });
          }
        }
      }

      res.json({
        leaveSummaryData,
        summary: {
          totalEmployees: employeesList.length,
          totalLeaveTypes: leaveTypesList.length,
          totalPendingRequests: leaveSummaryData.reduce((sum, item) => sum + item.pendingRequests, 0),
          totalApprovedRequests: leaveSummaryData.reduce((sum, item) => sum + item.approvedRequests, 0),
          totalRejectedRequests: leaveSummaryData.reduce((sum, item) => sum + item.rejectedRequests, 0),
        },
        year: reportYear,
      });
    } catch (error: any) {
      console.error("Leave Summary Report fetch error:", error);
      res.status(500).json({ error: "Failed to fetch leave summary report" });
    }
  });

  // Leave Summary Report PDF Export
  app.get("/api/leave-summary-report/export-pdf", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export leave summary reports
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const reportData = JSON.parse(decodeURIComponent(req.query.data as string));

      const doc = new PDFDocument({ margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=Leave-Summary-Report-${reportData.year}-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      doc.pipe(res);

      // Add header
      addReportHeader({ doc, title: "Leave Summary Report" });
      doc.fontSize(10).fillColor("#666666")
        .text(`Year: ${reportData.year}`, { align: "center" })
        .moveDown(2);

      // Add summary section
      doc.fontSize(12).fillColor("#000000").text("Summary", { underline: true }).moveDown(0.5);
      doc.fontSize(10).fillColor("#333333")
        .text(`Total Employees: ${reportData.summary.totalEmployees}`)
        .text(`Total Leave Types: ${reportData.summary.totalLeaveTypes}`)
        .text(`Pending Requests: ${reportData.summary.totalPendingRequests}`)
        .text(`Approved Requests: ${reportData.summary.totalApprovedRequests}`)
        .text(`Rejected Requests: ${reportData.summary.totalRejectedRequests}`)
        .moveDown(1.5);

      // Add leave summary table
      doc.fontSize(12).fillColor("#000000").text("Leave Details", { underline: true }).moveDown(0.5);

      const tableTop = doc.y;
      const headers = ["Employee", "Dept", "Type", "Total", "Used", "Remaining", "Pending", "Approved", "Rejected"];
      const columnWidths = [80, 60, 70, 40, 40, 50, 45, 50, 50];

      const columns = headers.map((header, i) => ({
        label: header,
        width: columnWidths[i]
      }));

      createTableHeader(doc, tableTop, columns);

      let y = tableTop + 25;
      reportData.leaveSummaryData.forEach((record: any, index: number) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
          createTableHeader(doc, y, columns);
          y += 25;
        }

        const rowValues = [
          record.employeeName,
          record.department,
          record.leaveType,
          record.totalDays,
          record.usedDays,
          record.remainingDays,
          record.pendingRequests.toString(),
          record.approvedRequests.toString(),
          record.rejectedRequests.toString()
        ];

        const rowColumns = rowValues.map((text, i) => ({
          text,
          width: columnWidths[i]
        }));

        createTableRow(doc, y, rowColumns, index % 2 === 0);
        y += 20;
      });

      // Add footer
      addReportFooter(doc);
      doc.end();
    } catch (error: any) {
      console.error("Leave Summary Report PDF export error:", error);
      res.status(500).json({ error: "Failed to export PDF" });
    }
  });

  // Leave Summary Report Excel Export
  app.get("/api/leave-summary-report/export-excel", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export leave summary reports
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const reportData = JSON.parse(decodeURIComponent(req.query.data as string));

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Leave Summary Report");

      // Add company header
      worksheet.mergeCells("A1:I1");
      const titleCell = worksheet.getCell("A1");
      titleCell.value = COMPANY_INFO.name;
      titleCell.font = { bold: true, size: 16, color: { argb: "FFE11D26" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };

      worksheet.mergeCells("A2:I2");
      const addressCell = worksheet.getCell("A2");
      addressCell.value = `${COMPANY_INFO.address1}, ${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`;
      addressCell.alignment = { horizontal: "center" };

      worksheet.mergeCells("A3:I3");
      const contactCell = worksheet.getCell("A3");
      contactCell.value = `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`;
      contactCell.alignment = { horizontal: "center" };

      // Add report title
      worksheet.mergeCells("A5:I5");
      const reportTitleCell = worksheet.getCell("A5");
      reportTitleCell.value = "Leave Summary Report";
      reportTitleCell.font = { bold: true, size: 14, color: { argb: "FFE11D26" } };
      reportTitleCell.alignment = { horizontal: "center" };

      worksheet.mergeCells("A6:I6");
      const yearCell = worksheet.getCell("A6");
      yearCell.value = `Year: ${reportData.year}`;
      yearCell.alignment = { horizontal: "center" };

      // Add summary section
      worksheet.getCell("A8").value = "Summary";
      worksheet.getCell("A8").font = { bold: true, size: 12 };
      worksheet.getCell("A9").value = `Total Employees: ${reportData.summary.totalEmployees}`;
      worksheet.getCell("A10").value = `Total Leave Types: ${reportData.summary.totalLeaveTypes}`;
      worksheet.getCell("A11").value = `Pending Requests: ${reportData.summary.totalPendingRequests}`;
      worksheet.getCell("A12").value = `Approved Requests: ${reportData.summary.totalApprovedRequests}`;
      worksheet.getCell("A13").value = `Rejected Requests: ${reportData.summary.totalRejectedRequests}`;

      // Add table headers
      const headerRow = worksheet.getRow(15);
      headerRow.values = ["Employee", "Department", "Leave Type", "Total", "Used", "Remaining", "Pending", "Approved", "Rejected"];
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
      headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE11D26" }
      };
      headerRow.alignment = { horizontal: "center", vertical: "middle" };
      headerRow.height = 25;

      // Add data rows
      reportData.leaveSummaryData.forEach((record: any, index: number) => {
        const row = worksheet.addRow([
          record.employeeName,
          record.department,
          record.leaveType,
          record.totalDays,
          record.usedDays,
          record.remainingDays,
          record.pendingRequests,
          record.approvedRequests,
          record.rejectedRequests
        ]);

        if (index % 2 === 0) {
          row.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF3F4F6" }
          };
        }
      });

      // Set column widths
      worksheet.getColumn(1).width = 20;
      worksheet.getColumn(2).width = 15;
      worksheet.getColumn(3).width = 15;
      worksheet.getColumn(4).width = 10;
      worksheet.getColumn(5).width = 10;
      worksheet.getColumn(6).width = 12;
      worksheet.getColumn(7).width = 10;
      worksheet.getColumn(8).width = 12;
      worksheet.getColumn(9).width = 12;

      // Add footer
      const footerRowNum = worksheet.rowCount + 2;
      worksheet.mergeCells(`A${footerRowNum}:I${footerRowNum}`);
      const footerCell = worksheet.getCell(`A${footerRowNum}`);
      footerCell.value = `Generated on ${format(new Date(), "MMMM dd, yyyy")}`;
      footerCell.alignment = { horizontal: "center" };

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=Leave-Summary-Report-${reportData.year}-${format(new Date(), "yyyy-MM-dd")}.xlsx`);

      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      console.error("Leave Summary Report Excel export error:", error);
      res.status(500).json({ error: "Failed to export Excel" });
    }
  });

  // Leave Summary Report Word Export
  app.get("/api/leave-summary-report/export-word", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can export leave summary reports
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const reportData = JSON.parse(decodeURIComponent(req.query.data as string));

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Company Header
            new Paragraph({
              children: [new TextRun({ text: COMPANY_INFO.name, bold: true, size: 32, color: "E11D26" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: COMPANY_INFO.address1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `${COMPANY_INFO.address2}, ${COMPANY_INFO.city}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Phone: ${COMPANY_INFO.phone} | Email: ${COMPANY_INFO.email}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 }
            }),

            // Report Title
            new Paragraph({
              children: [new TextRun({ text: "Leave Summary Report", bold: true, size: 28, color: "E11D26" })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: `Year: ${reportData.year}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 }
            }),

            // Summary Section
            new Paragraph({
              children: [new TextRun({ text: "Summary", bold: true, size: 24 })],
              spacing: { after: 200 }
            }),
            new Paragraph({
              text: `Total Employees: ${reportData.summary.totalEmployees}`,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Total Leave Types: ${reportData.summary.totalLeaveTypes}`,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Pending Requests: ${reportData.summary.totalPendingRequests}`,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Approved Requests: ${reportData.summary.totalApprovedRequests}`,
              spacing: { after: 100 }
            }),
            new Paragraph({
              text: `Rejected Requests: ${reportData.summary.totalRejectedRequests}`,
              spacing: { after: 300 }
            }),

            // Leave Details Table
            new Paragraph({
              children: [new TextRun({ text: "Leave Details", bold: true, size: 24 })],
              spacing: { after: 200 }
            }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                // Header row
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Employee", bold: true })] })],
                      shading: { fill: "E11D26", type: ShadingType.SOLID },
                      width: { size: 15, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Department", bold: true })] })],
                      shading: { fill: "E11D26", type: ShadingType.SOLID },
                      width: { size: 12, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Leave Type", bold: true })] })],
                      shading: { fill: "E11D26", type: ShadingType.SOLID },
                      width: { size: 13, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Total", bold: true })] })],
                      shading: { fill: "E11D26", type: ShadingType.SOLID },
                      width: { size: 10, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Used", bold: true })] })],
                      shading: { fill: "E11D26", type: ShadingType.SOLID },
                      width: { size: 10, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Remaining", bold: true })] })],
                      shading: { fill: "E11D26", type: ShadingType.SOLID },
                      width: { size: 10, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Pending", bold: true })] })],
                      shading: { fill: "E11D26", type: ShadingType.SOLID },
                      width: { size: 10, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Approved", bold: true })] })],
                      shading: { fill: "E11D26", type: ShadingType.SOLID },
                      width: { size: 10, type: WidthType.PERCENTAGE }
                    }),
                    new TableCell({
                      children: [new Paragraph({ children: [new TextRun({ text: "Rejected", bold: true })] })],
                      shading: { fill: "E11D26", type: ShadingType.SOLID },
                      width: { size: 10, type: WidthType.PERCENTAGE }
                    })
                  ]
                }),
                // Data rows
                ...reportData.leaveSummaryData.map((record: any) => {
                  return new TableRow({
                    children: [
                      new TableCell({ children: [new Paragraph(record.employeeName)] }),
                      new TableCell({ children: [new Paragraph(record.department)] }),
                      new TableCell({ children: [new Paragraph(record.leaveType)] }),
                      new TableCell({ children: [new Paragraph(record.totalDays)] }),
                      new TableCell({ children: [new Paragraph(record.usedDays)] }),
                      new TableCell({ children: [new Paragraph(record.remainingDays)] }),
                      new TableCell({ children: [new Paragraph(record.pendingRequests.toString())] }),
                      new TableCell({ children: [new Paragraph(record.approvedRequests.toString())] }),
                      new TableCell({ children: [new Paragraph(record.rejectedRequests.toString())] })
                    ]
                  });
                })
              ]
            }),

            // Footer
            new Paragraph({
              text: `Generated on ${format(new Date(), "MMMM dd, yyyy")}`,
              alignment: AlignmentType.CENTER,
              spacing: { before: 600 }
            })
          ]
        }]
      });

      const buffer = await Packer.toBuffer(doc);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename=Leave-Summary-Report-${reportData.year}-${format(new Date(), "yyyy-MM-dd")}.docx`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Leave Summary Report Word export error:", error);
      res.status(500).json({ error: "Failed to export Word document" });
    }
  });

  // Files
  app.get("/api/files", authenticateToken, async (req: AuthRequest, res) => {
    try {
      let allFiles: any[] = [];
      if (req.userRole === "client") {
        // Get user's client ID and fetch files for their projects only
        const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
        if (!user?.clientId) {
          return res.status(403).json({ error: "No client associated with this account" });
        }

        // Get all projects for this client
        const clientProjects = await db.select().from(projects).where(eq(projects.clientId, user.clientId));
        const projectIds = clientProjects.map(p => p.id);

        if (projectIds.length > 0) {
          // Use inArray for safe parameter binding (prevents SQL injection)
          allFiles = await db.select().from(files)
            .where(inArray(files.projectId, projectIds))
            .orderBy(desc(files.createdAt));
        } else {
          allFiles = [];
        }
      } else {
        allFiles = await db.select().from(files).orderBy(desc(files.createdAt));
      }
      res.json(allFiles);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/files", authenticateToken, upload.single("file"), auditMiddleware("upload", "file"), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const projectId = req.body.projectId || null;

      // CLIENT SECURITY: Clients must provide projectId and can only upload to their own projects
      if (req.userRole === "client") {
        if (!projectId) {
          return res.status(400).json({ error: "Project ID is required for client file uploads" });
        }
        // Get user's clientId
        const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
        if (!user?.clientId) {
          return res.status(403).json({ error: "No client associated with this user" });
        }

        // Verify client owns this project
        const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
        if (!project) {
          return res.status(404).json({ error: "Project not found" });
        }

        if (project.clientId !== user.clientId) {
          return res.status(403).json({ error: "Access denied: You can only upload files to your own projects" });
        }
      }

      const data = {
        projectId,
        uploadedBy: req.userId!,
        fileName: req.file.originalname,
        fileUrl: req.file.path,
        fileSize: req.file.size,
        fileType: req.file.mimetype,
      };

      const [file] = await db.insert(files).values(data).returning();

      // Create notifications for project members if file is associated with a project
      if (projectId) {
        await notificationService.notifyFileUpload(projectId, req.userId!, req.file.originalname);
      }

      res.json(file);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/files/:id/download", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const [file] = await db.select().from(files).where(eq(files.id, req.params.id)).limit(1);

      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      // Client role: ensure file belongs to their project
      if (req.userRole === "client") {
        const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
        if (!user?.clientId) {
          return res.status(403).json({ error: "No client associated with this account" });
        }

        // If file has a projectId, verify it belongs to this client
        if (file.projectId) {
          const [project] = await db.select().from(projects).where(eq(projects.id, file.projectId)).limit(1);
          if (!project || project.clientId !== user.clientId) {
            return res.status(403).json({ error: "Not authorized to download this file" });
          }
        } else {
          // File without project - clients can't access
          return res.status(403).json({ error: "Not authorized to download this file" });
        }
      }

      // Check if file exists on filesystem
      try {
        await fs.access(file.fileUrl);
      } catch (error) {
        return res.status(404).json({ error: "File not found on server" });
      }

      // Set appropriate headers
      res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
      res.setHeader("Content-Type", file.fileType || "application/octet-stream");

      // Stream the file with error handling
      const fileStream = (await import("fs")).createReadStream(file.fileUrl);

      fileStream.on("error", (error) => {
        console.error("Error streaming file:", error);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      fileStream.pipe(res);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/files/:id", authenticateToken, auditMiddleware("delete", "file"), async (req: AuthRequest, res) => {
    try {
      const [file] = await db.select().from(files).where(eq(files.id, req.params.id)).limit(1);

      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      // Check permissions: only uploader or admin/operational_head can delete
      if (file.uploadedBy !== req.userId && !["admin", "operational_head"].includes(req.userRole!)) {
        return res.status(403).json({ error: "Not authorized to delete this file" });
      }

      // Delete file from filesystem
      try {
        await fs.unlink(file.fileUrl);
      } catch (error) {
        console.error("Error deleting file from filesystem:", error);
        // Continue with database deletion even if file doesn't exist
      }

      // Delete from database
      await db.delete(files).where(eq(files.id, req.params.id));

      res.json({ message: "File deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // ===== PROJECT CREDENTIALS MANAGER (Admin Only) =====
  // Get all project credentials - Admin only (with client info)
  app.get("/api/project-credentials", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin can access all credentials
      if (!["admin", "operational_head"].includes(req.userRole!)) {
        return res.status(403).json({ error: "Access denied. Admin only." });
      }

      const allCredentials = await db
        .select({
          id: projectCredentials.id,
          projectName: projectCredentials.projectName,
          clientId: projectCredentials.clientId,
          hostingPlatform: projectCredentials.hostingPlatform,
          liveLink: projectCredentials.liveLink,
          adminPanelLink: projectCredentials.adminPanelLink,
          databaseUrl: projectCredentials.databaseUrl,
          serverCredentials: projectCredentials.serverCredentials,
          thumbnailUrl: projectCredentials.thumbnailUrl,
          shortDescription: projectCredentials.shortDescription,
          additionalNotes: projectCredentials.additionalNotes,
          shortVideoUrl: projectCredentials.shortVideoUrl,
          fullVideoUrl: projectCredentials.fullVideoUrl,
          createdBy: projectCredentials.createdBy,
          createdAt: projectCredentials.createdAt,
          updatedAt: projectCredentials.updatedAt,
          clientName: clients.name,
          clientEmail: clients.email,
          clientCompany: clients.company,
        })
        .from(projectCredentials)
        .leftJoin(clients, eq(projectCredentials.clientId, clients.id))
        .orderBy(desc(projectCredentials.createdAt));

      res.json(allCredentials);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get project credentials for a specific client (Client Portal)
  app.get("/api/project-credentials/client", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Get user's clientId
      const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);

      if (!user?.clientId) {
        return res.status(403).json({ error: "No client associated with this user" });
      }

      // Fetch credentials for the client's projects only
      const clientCredentials = await db
        .select({
          id: projectCredentials.id,
          projectName: projectCredentials.projectName,
          hostingPlatform: projectCredentials.hostingPlatform,
          liveLink: projectCredentials.liveLink,
          adminPanelLink: projectCredentials.adminPanelLink,
          databaseUrl: projectCredentials.databaseUrl,
          serverCredentials: projectCredentials.serverCredentials,
          thumbnailUrl: projectCredentials.thumbnailUrl,
          shortDescription: projectCredentials.shortDescription,
          shortVideoUrl: projectCredentials.shortVideoUrl,
          fullVideoUrl: projectCredentials.fullVideoUrl,
        })
        .from(projectCredentials)
        .where(eq(projectCredentials.clientId, user.clientId))
        .orderBy(desc(projectCredentials.createdAt));

      res.json(clientCredentials);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single project credential
  app.get("/api/project-credentials/:id", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const [credential] = await db
        .select({
          id: projectCredentials.id,
          projectName: projectCredentials.projectName,
          clientId: projectCredentials.clientId,
          hostingPlatform: projectCredentials.hostingPlatform,
          liveLink: projectCredentials.liveLink,
          adminPanelLink: projectCredentials.adminPanelLink,
          databaseUrl: projectCredentials.databaseUrl,
          serverCredentials: projectCredentials.serverCredentials,
          thumbnailUrl: projectCredentials.thumbnailUrl,
          shortDescription: projectCredentials.shortDescription,
          additionalNotes: projectCredentials.additionalNotes,
          shortVideoUrl: projectCredentials.shortVideoUrl,
          fullVideoUrl: projectCredentials.fullVideoUrl,
          createdBy: projectCredentials.createdBy,
          createdAt: projectCredentials.createdAt,
          updatedAt: projectCredentials.updatedAt,
          clientName: clients.name,
        })
        .from(projectCredentials)
        .leftJoin(clients, eq(projectCredentials.clientId, clients.id))
        .where(eq(projectCredentials.id, req.params.id))
        .limit(1);

      if (!credential) {
        return res.status(404).json({ error: "Credential not found" });
      }

      // Check permissions
      if (req.userRole === "client") {
        const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
        if (!user?.clientId || credential.clientId !== user.clientId) {
          return res.status(403).json({ error: "Access denied" });
        }
      } else if (!["admin", "operational_head"].includes(req.userRole!)) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(credential);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create project credential - Admin only
  app.post("/api/project-credentials", authenticateToken, upload.single("thumbnail"), auditMiddleware("create", "project_credentials"), async (req: AuthRequest, res) => {
    try {
      // Only admin can create credentials
      if (!["admin", "operational_head"].includes(req.userRole!)) {
        return res.status(403).json({ error: "Access denied. Admin only." });
      }

      const data = { ...req.body };

      // Handle thumbnail upload
      if (req.file) {
        const uploadDir = "uploads/thumbnails";
        await fs.mkdir(uploadDir, { recursive: true });
        const newPath = path.join(uploadDir, `${Date.now()}-${req.file.originalname}`);
        await fs.rename(req.file.path, newPath);
        data.thumbnailUrl = newPath;
      }

      data.createdBy = req.userId;

      const validated = insertProjectCredentialsSchema.parse(data);

      const [newCredential] = await db
        .insert(projectCredentials)
        .values(validated)
        .returning();

      res.status(201).json(newCredential);
    } catch (error: any) {
      console.error("Error creating project credential:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Update project credential - Admin only
  app.patch("/api/project-credentials/:id", authenticateToken, upload.single("thumbnail"), auditMiddleware("update", "project_credentials"), async (req: AuthRequest, res) => {
    try {
      // Only admin can update credentials
      if (!["admin", "operational_head"].includes(req.userRole!)) {
        return res.status(403).json({ error: "Access denied. Admin only." });
      }

      const [existing] = await db
        .select()
        .from(projectCredentials)
        .where(eq(projectCredentials.id, req.params.id))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Credential not found" });
      }

      const data = { ...req.body };

      // Handle thumbnail upload
      if (req.file) {
        const uploadDir = "uploads/thumbnails";
        await fs.mkdir(uploadDir, { recursive: true });
        const newPath = path.join(uploadDir, `${Date.now()}-${req.file.originalname}`);
        await fs.rename(req.file.path, newPath);

        // Delete old thumbnail if it exists
        if (existing.thumbnailUrl) {
          try {
            await fs.unlink(existing.thumbnailUrl);
          } catch (e) {
            console.error("Error deleting old thumbnail:", e);
          }
        }

        data.thumbnailUrl = newPath;
      }

      data.updatedAt = new Date();

      const [updated] = await db
        .update(projectCredentials)
        .set(data)
        .where(eq(projectCredentials.id, req.params.id))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating project credential:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // Delete project credential - Admin only
  app.delete("/api/project-credentials/:id", authenticateToken, auditMiddleware("delete", "project_credentials"), async (req: AuthRequest, res) => {
    try {
      // Only admin can delete credentials
      if (!["admin", "operational_head"].includes(req.userRole!)) {
        return res.status(403).json({ error: "Access denied. Admin only." });
      }

      const [existing] = await db
        .select()
        .from(projectCredentials)
        .where(eq(projectCredentials.id, req.params.id))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Credential not found" });
      }

      // Delete thumbnail if it exists
      if (existing.thumbnailUrl) {
        try {
          await fs.unlink(existing.thumbnailUrl);
        } catch (e) {
          console.error("Error deleting thumbnail:", e);
        }
      }

      await db.delete(projectCredentials).where(eq(projectCredentials.id, req.params.id));

      res.json({ message: "Project credential deleted successfully" });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Get hosting platforms list
  app.get("/api/hosting-platforms", authenticateToken, async (req: AuthRequest, res) => {
    res.json(HOSTING_PLATFORMS);
  });

  // Messages - Unified Inbox Support
  app.get("/api/messages", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const projectId = req.query.projectId as string;
      console.log("🔵 GET /api/messages - User:", req.userId, "Role:", req.userRole, "ProjectId:", projectId);

      // UNIFIED INBOX: Return enriched messages with client/project info
      let allMessages;

      // CLIENT SECURITY: Clients can only view messages for their own projects
      if (req.userRole === "client") {
        // Get user's clientId
        const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
        if (!user?.clientId) {
          return res.status(403).json({ error: "No client associated with this user" });
        }

        if (projectId) {
          // Verify client owns this specific project
          const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
          if (!project) {
            return res.status(404).json({ error: "Project not found" });
          }

          if (project.clientId !== user.clientId) {
            return res.status(403).json({ error: "Access denied: You can only view messages for your own projects" });
          }

          // Fetch messages for this specific project (single project view)
          allMessages = await db
            .select({
              id: messages.id,
              projectId: messages.projectId,
              userId: messages.userId,
              content: messages.content,
              fileUrl: messages.fileUrl,
              fileName: messages.fileName,
              fileType: messages.fileType,
              createdAt: messages.createdAt,
              projectName: projects.name,
              clientId: clients.id,
              clientName: clients.name,
              senderName: users.fullName,
              senderRole: users.role,
            })
            .from(messages)
            .leftJoin(projects, eq(messages.projectId, projects.id))
            .leftJoin(clients, eq(projects.clientId, clients.id))
            .leftJoin(users, eq(messages.userId, users.id))
            .where(eq(messages.projectId, projectId))
            .orderBy(asc(messages.createdAt));
        } else {
          // CLIENT UNIFIED INBOX: No projectId provided, fetch ALL messages from ALL client's projects
          // This shows BOTH client messages AND admin/team replies
          const clientProjects = await db.select({ id: projects.id }).from(projects).where(eq(projects.clientId, user.clientId));
          const projectIds = clientProjects.map(p => p.id);

          console.log("🔵 Client unified inbox - fetching messages for", projectIds.length, "projects");

          if (projectIds.length === 0) {
            return res.json([]);
          }

          // Fetch all messages from all client's projects
          allMessages = await db
            .select({
              id: messages.id,
              projectId: messages.projectId,
              userId: messages.userId,
              content: messages.content,
              fileUrl: messages.fileUrl,
              fileName: messages.fileName,
              fileType: messages.fileType,
              createdAt: messages.createdAt,
              projectName: projects.name,
              clientId: clients.id,
              clientName: clients.name,
              senderName: users.fullName,
              senderRole: users.role,
            })
            .from(messages)
            .leftJoin(projects, eq(messages.projectId, projects.id))
            .leftJoin(clients, eq(projects.clientId, clients.id))
            .leftJoin(users, eq(messages.userId, users.id))
            .where(sql`${messages.projectId} = ANY(ARRAY[${sql.join(projectIds.map(id => sql`${id}`), sql`, `)}])`)
            .orderBy(asc(messages.createdAt));

          console.log("✅ Client unified inbox: Fetched", allMessages.length, "messages from", projectIds.length, "projects");
        }

        return res.json(allMessages);
      }

      if (projectId) {
        // Single project view (for clients or specific project)
        allMessages = await db
          .select({
            id: messages.id,
            projectId: messages.projectId,
            userId: messages.userId,
            content: messages.content,
            fileUrl: messages.fileUrl,
            fileName: messages.fileName,
            fileType: messages.fileType,
            createdAt: messages.createdAt,
            projectName: projects.name,
            clientId: clients.id,
            clientName: clients.name,
            senderName: users.fullName,
            senderRole: users.role,
          })
          .from(messages)
          .leftJoin(projects, eq(messages.projectId, projects.id))
          .leftJoin(clients, eq(projects.clientId, clients.id))
          .leftJoin(users, eq(messages.userId, users.id))
          .where(eq(messages.projectId, projectId))
          .orderBy(asc(messages.createdAt));
      } else {
        // Unified inbox (for developers/admins/ops only) - all assigned projects

        // SECURITY: For admins and operational heads, get all projects
        // For developers, get only assigned projects via tasks
        let projectIds: string[];

        if (req.userRole === "admin" || req.userRole === "operational_head") {
          // Admins/ops can see all projects
          const allProjects = await db.select({ id: projects.id }).from(projects);
          projectIds = allProjects.map(p => p.id);

          // SECURITY: If no projects exist at all, return empty
          if (projectIds.length === 0) {
            return res.json([]);
          }
        } else {
          // Developers see only projects they're assigned to via tasks
          const assignedTasks = await db
            .select({ projectId: tasks.projectId })
            .from(tasks)
            .where(eq(tasks.assignedTo, req.userId!));

          console.log("🔍 Developer assigned tasks:", assignedTasks);

          const uniqueProjectIds = new Set(assignedTasks.map(t => t.projectId));
          projectIds = Array.from(uniqueProjectIds);

          console.log("🔍 Developer project IDs:", projectIds);

          // SECURITY: If developer has no assigned projects, return empty immediately
          if (projectIds.length === 0) {
            console.log("❌ Developer has no assigned projects, returning empty");
            return res.json([]);
          }
        }

        // Get all messages from accessible projects with enriched data
        // Use inArray from drizzle-orm for safer array handling
        console.log("🔄 Fetching messages for project IDs:", projectIds);
        allMessages = await db
          .select({
            id: messages.id,
            projectId: messages.projectId,
            userId: messages.userId,
            content: messages.content,
            fileUrl: messages.fileUrl,
            fileName: messages.fileName,
            fileType: messages.fileType,
            createdAt: messages.createdAt,
            projectName: projects.name,
            clientId: clients.id,
            clientName: clients.name,
            senderName: users.fullName,
            senderRole: users.role,
          })
          .from(messages)
          .leftJoin(projects, eq(messages.projectId, projects.id))
          .leftJoin(clients, eq(projects.clientId, clients.id))
          .leftJoin(users, eq(messages.userId, users.id))
          .where(sql`${messages.projectId} = ANY(ARRAY[${sql.join(projectIds.map(id => sql`${id}`), sql`, `)}])`)
          .orderBy(asc(messages.createdAt));

        console.log("✅ Fetched", allMessages.length, "messages");
      }

      console.log("📤 Returning", allMessages.length, "messages");
      res.json(allMessages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/messages", authenticateToken, auditMiddleware("create", "message"), async (req: AuthRequest, res) => {
    try {
      const data = insertMessageSchema.parse(req.body);

      // CLIENT SECURITY: Clients can only send messages to their own projects
      if (req.userRole === "client") {
        // Get user's clientId
        const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
        if (!user?.clientId) {
          return res.status(403).json({ error: "No client associated with this user" });
        }

        // Verify client owns this project
        const [project] = await db.select().from(projects).where(eq(projects.id, data.projectId)).limit(1);
        if (!project) {
          return res.status(404).json({ error: "Project not found" });
        }

        if (project.clientId !== user.clientId) {
          return res.status(403).json({ error: "Access denied: You can only send messages to your own projects" });
        }
      }

      const [message] = await db.insert(messages).values({
        ...data,
        userId: req.userId!,
      }).returning();

      // Broadcast message via WebSocket to all project subscribers
      wsService.broadcastMessage(data.projectId, message);

      // Create notifications for project members
      await notificationService.notifyNewMessage(data.projectId, req.userId!, data.content);

      res.json(message);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // Chat file upload
  app.post("/api/messages/upload", authenticateToken, upload.single("file"), auditMiddleware("upload", "chat_file"), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const projectId = req.body.projectId;
      if (!projectId) {
        return res.status(400).json({ error: "Project ID is required" });
      }

      // SECURITY: Validate file type - only allow images and common documents
      const allowedMimeTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        // Delete uploaded file
        await fs.unlink(req.file.path).catch(() => { });
        return res.status(400).json({ error: "File type not allowed. Only images and documents (PDF, DOC, DOCX, TXT) are supported" });
      }

      // SECURITY: Validate file size - max 10MB
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (req.file.size > maxSize) {
        await fs.unlink(req.file.path).catch(() => { });
        return res.status(400).json({ error: "File size exceeds 10MB limit" });
      }

      // Verify project exists
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project) {
        await fs.unlink(req.file.path).catch(() => { });
        return res.status(404).json({ error: "Project not found" });
      }

      // SECURITY: Verify user has access to this project
      // Strict access control: all non-admin roles must have explicit project access
      if (req.userRole === "client") {
        const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
        if (!user?.clientId) {
          await fs.unlink(req.file.path).catch(() => { });
          return res.status(403).json({ error: "No client associated with this user" });
        }

        if (project.clientId !== user.clientId) {
          await fs.unlink(req.file.path).catch(() => { });
          return res.status(403).json({ error: "Access denied: You can only upload files to your own projects" });
        }
      } else if (req.userRole === "developer" || req.userRole === "operational_head") {
        // SECURITY: Staff roles can only upload to projects they're assigned to via tasks
        const assignedTasks = await db
          .select({ projectId: tasks.projectId })
          .from(tasks)
          .where(eq(tasks.assignedTo, req.userId!));

        const hasAccess = assignedTasks.some(task => task.projectId === projectId);
        if (!hasAccess) {
          await fs.unlink(req.file.path).catch(() => { });
          return res.status(403).json({ error: "Access denied: You can only upload files to projects you're assigned to" });
        }
      }
      // Note: Only admin role has unrestricted access to all projects

      // Create chat uploads directory if it doesn't exist
      const chatUploadsDir = path.join(process.cwd(), "uploads", "chat");
      await fs.mkdir(chatUploadsDir, { recursive: true });

      // Move file to chat uploads directory with sanitized name
      const originalFileName = req.file.originalname;
      const fileExtension = path.extname(originalFileName);
      const fileNameWithoutExt = path.basename(originalFileName, fileExtension);
      // Sanitize filename: remove non-alphanumeric characters except hyphens and underscores
      const sanitizedName = fileNameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, '_');
      const uniqueFileName = `${sanitizedName}_${Date.now()}${fileExtension}`;
      const targetPath = path.join(chatUploadsDir, uniqueFileName);

      await fs.rename(req.file.path, targetPath);

      const fileUrl = `/uploads/chat/${uniqueFileName}`;
      const fileType = req.file.mimetype;

      // Create message with file attachment
      const [message] = await db.insert(messages).values({
        projectId,
        userId: req.userId!,
        content: null,
        fileUrl,
        fileName: originalFileName,
        fileType,
      }).returning();

      // Broadcast message via WebSocket with guaranteed projectId
      wsService.broadcastMessage(message.projectId, message);

      // Create notification for file upload
      await notificationService.notifyNewMessage(message.projectId, req.userId!, `📎 ${originalFileName}`);

      res.json(message);
    } catch (error: any) {
      // Clean up uploaded file on error
      if (req.file?.path) {
        await fs.unlink(req.file.path).catch(() => { });
      }
      res.status(400).json({ error: error.message });
    }
  });

  // Notifications
  app.get("/api/notifications", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Get all notifications for the current user
      const userNotifications = await db.select()
        .from(notifications)
        .where(eq(notifications.userId, req.userId!))
        .orderBy(desc(notifications.createdAt));

      res.json(userNotifications);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/notifications", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can create notifications manually
      // (Notifications are usually created automatically by the system)
      if (req.userRole !== "admin" && req.userRole !== "operational_head") {
        return res.status(403).json({ error: "Only admins can create notifications manually" });
      }

      const data = insertNotificationSchema.parse(req.body);
      const [notification] = await db.insert(notifications).values(data).returning();

      // Broadcast notification via WebSocket to the recipient
      wsService.broadcastNotification(notification.userId, notification);

      res.json(notification);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch("/api/notifications/:id/read", authenticateToken, async (req: AuthRequest, res) => {
    try {
      const notificationId = req.params.id;

      // Verify the notification belongs to the current user
      const [notification] = await db.select()
        .from(notifications)
        .where(eq(notifications.id, notificationId))
        .limit(1);

      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }

      if (notification.userId !== req.userId) {
        return res.status(403).json({ error: "Access denied: This is not your notification" });
      }

      // Mark as read
      const [updated] = await db.update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.id, notificationId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mark all notifications as read for current user
  app.post("/api/notifications/mark-all-read", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Update all unread notifications for the current user
      await db.update(notifications)
        .set({ isRead: true })
        .where(and(
          eq(notifications.userId, req.userId!),
          eq(notifications.isRead, false)
        ));

      res.json({ success: true, message: "All notifications marked as read" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Audit Logs
  app.get("/api/audit-logs", authenticateToken, async (req: AuthRequest, res) => {
    try {
      // Only admin and operational_head can access audit logs
      if (!await checkPermission(req.userRole!, req.path)) {
        return res.status(403).json({ error: "Access denied" });
      }

      const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Register HR & Payroll routes module
  const { registerHrPayrollRoutes } = await import("./hr/routes");
  registerHrPayrollRoutes(app, db, authenticateToken, auditMiddleware);

  const httpServer = createServer(app);

  // Initialize WebSocket server
  wsService.initialize(httpServer);

  return httpServer;
}
# MaxTech BD - Smart Agency Control Hub

## Overview
MaxTech BD is a comprehensive enterprise agency management system designed to streamline operations across various departments. It integrates 12 core modules for managing leads, clients, projects, staff, and finances within a single platform. The system aims to enhance efficiency, improve decision-making through real-time data, and provide a unified control hub for agencies. Key capabilities include robust CRM, project management, financial tracking, HR and payroll functionalities with biometric device integration, and a dedicated client portal for transparent communication.

## User Preferences
I prefer simple language. I want iterative development. Ask before making major changes.

## System Architecture

### UI/UX Decisions
The frontend is built with React, TypeScript, Vite, Tailwind CSS, and shadcn/ui, ensuring a modern, responsive, and accessible user interface. The design emphasizes a consistent visual language and intuitive navigation through a professionally organized sidebar menu with four main sections:
- **MAIN MENU**: Dashboard, Leads, Clients, Projects, Tasks, Team, Communication (expandable: Chat, Files)
- **HR MANAGEMENT**: Attendance, Employees, Departments, Leave Management, Payroll (expandable: Salary Sheet, Salary Slip, Attendance Report, Leave Summary)
- **ACCOUNTS & FINANCE**: Invoices, Payments, Expense Categories, Salary Payments, Financial Reports, Profit & Loss, General Ledger, Payroll Report, Payment Receipt
- **SETTINGS**: Office Settings, Profile, Logout

The sidebar features bold uppercase section headers, expandable/collapsible sub-menus for Communication and Payroll, consistent spacing between groups, and proper visual hierarchy. Client-facing interfaces are tailored to provide relevant information without overwhelming the user.

### Technical Implementations
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui.
- **Backend**: Express.js, TypeScript.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Authentication**: JWT with role-based access control (Admin, Operational Head, Developer, Client). Tokens are stored in localStorage with auto-logout on 401. Both REST API and WebSocket use the same JWT_SECRET for consistent token verification.
- **Data Handling**: Comprehensive 4-layer date handling architecture for standardization, including shared utilities, backend serialization, and frontend normalization to ensure timezone-safe and accurate date representations across the system.
- **Email Notifications**: NodeMailer-based service with scheduled tasks for welcome emails, task assignments, invoice reminders, and lead follow-up reminders.
- **Real-time Communication**: WebSocket server for live chat with auto-subscription feature. Features project-based message broadcasting, JWT authentication, and automatic reconnection with exponential backoff. Messages follow industry-standard UX (WhatsApp/Messenger pattern).
- **HR and Payroll**: Advanced HR module with 14 new database tables for departments, designations, employees, attendance devices, leave management, payroll, and performance tracking. Includes a pluggable device adapter system for biometric devices and an attendance sync service.
- **File Management**: Secure file upload, download, and delete functionalities with authentication and client-specific authorization for downloads.
- **PDF Generation**: Uses `pdfkit` library for generating professional PDF documents (e.g., invoices, payroll reports).
- **Financial Reporting**: Uses `recharts` library for interactive financial dashboards with visual analytics.
- **Form Validation**: Implemented using `react-hook-form` with `Zod` schemas, including `z.coerce.number()`, `z.coerce.date()`, and `z.coerce.string()` for robust type coercion and validation.
- **Data Fetching**: All pages use `React Query` for data fetching with proper loading states and error handling.
- **Testing**: Extensive `data-testid` coverage (40+ instances per page) for automated testing compliance.
- **Decimal-Safe Calculations**: Monetary calculations use `sumAmounts()` utility with null-safe guards for precision.

### Feature Specifications
- **Core Modules**: Authentication, Dashboard, CRM (Leads, Clients), Projects, Tasks, Staff Attendance, Finance (Income/Expenses), Invoices, Unified Inbox Chat, Files, Audit Logs, Client Portal.
- **Floating Chat Widget (Unified Inbox)**: Intercom-style unified inbox accessible from all pages via a floating button. All roles see unified inbox: Admins see all project messages; Developers see messages from assigned projects; Clients see ALL messages (including admin/team replies) from their own projects. Auto-routes replies to correct project. Uses React Portal.
- **Client Portal**: Dedicated dashboard for client role with filtered access to projects, invoices, payments, and files. Data access is strictly controlled to their specific projects via `clientId`.
- **Access Control**: Robust RBAC implemented across all endpoints with the following role-based permissions:
  - **Admin**: Full unrestricted access to all projects, files, and system resources
  - **Operational Head**: Full unrestricted access to all projects and files (management/supervisor role)
  - **Developer**: Project-scoped access - restricted to projects they're assigned to via tasks
  - **Client**: Strictly limited to their own projects via clientId - cannot access other clients' data
  
  Standard access patterns (used in /api/files, /api/messages, /api/messages/upload):
  - Client role: Always verify project ownership via clientId
  - Developer role: For chat/communication features, verify task assignment to project
  - Admin/Operational_head: Full access without additional checks (by design for management oversight)
  
  **Chat File Upload Exception**: The `/api/messages/upload` endpoint implements stricter security:
  - Admin: Full unrestricted access
  - Operational_head: Restricted to projects they're assigned to via tasks (like developers)
  - Developer: Restricted to projects they're assigned to via tasks
  - Client: Strictly limited to their own projects via clientId
- **HR Management**: Employee management, departments & designations, attendance (biometric device management, punch log, correction requests), leave management, and payroll management (salary structure, generation, records).
- **Attendance Reports & Job Cards**: Comprehensive HR attendance report with employee-wise job card feature. When filtering by a single employee, the system automatically displays a Job Card indicator with detailed employee information and provides specialized export buttons ("Export Job Card PDF/Excel/Word"). Job cards include comprehensive analytics: working days, on-time count, total hours, overtime calculation, and daily check-in/check-out breakdown. Manual attendance entry validates employee record existence to prevent "Unknown" employee issues in reports. **Professional PDF Design**: Employee Job Card PDF features corporate-grade layout with non-overlapping three-section header using explicit bounding boxes (logo: 40-120px, company: 125-395px, job card: 405-555px), proper height calculation via PDFKit's heightOfString() for accurate text positioning, full-width employee info panel with grey background, 6-card attendance summary grid (3×2) with rounded borders and color coding, corporate-style daily attendance table with alternating row colors, and professional footer with MaxTech BD branding. The header implementation uses dynamic height measurement to prevent text overflow and overlap issues.
- **Accounts Module**: Financial dashboard, expense categories (income/expense), salary payments (ledger linking), financial reports (monthly/yearly), profit & loss statement (detailed breakdown), general ledger (transaction history).
- **Payroll Reports**: Interactive payroll report page with month/year selector, employee-wise salary breakdown, and professional PDF, Excel, and Word export capabilities with MaxTech BD branding. **Professional Payroll-Grade PDF Design (A4 Landscape)**: Salary sheet PDF follows standard payroll report format with comprehensive earnings and deductions breakdown. Features include: professional header with company logo and full contact details; 19-column detailed table showing Employee Code, Name, Department, Designation; earnings breakdown (Basic, HRA, Medical, Conveyance, Other Allowances, Gross Salary); attendance data (Present Days, Absent Days, Late Days, Half Days, OT Hours); deductions breakdown (Late Deduction, Loan Deduction, Other Deductions); and Net Payable Salary. **Totals Row**: Bottom row displays grand totals for all financial columns, attendance summary, and total net payable highlighted in red. **Signature Section**: Three-column signature block (Prepared By, Verified By, Approved By) with horizontal lines. **Footer**: "MaxTech BD | Smart Agency Control Hub" branding. Layout optimized for A4 landscape format to accommodate all columns with proper readability, matching industry-standard payroll report formats (SAP, Oracle, Zoho, Odoo).

### System Design Choices
- **Modularity**: Designed with a modular approach for independent development and maintenance.
- **Scalability**: PostgreSQL and Express.js provide a scalable foundation.
- **Security**: Emphasis on security with JWT authentication, RBAC, secure API endpoints, and prevention of self-approval.
- **Automation**: Integration of schedulers for automated tasks like email reminders and biometric device synchronization.
- **Error Handling**: Comprehensive error handling, loading states, and user-friendly alerts.

## External Dependencies
- **Database**: PostgreSQL (Neon).
- **ORM**: Drizzle ORM.
- **Email Service**: Nodemailer.
- **Biometric Devices**: Pluggable adapter system for devices (e.g., ZKTeco, Suprema).
- **Frontend Libraries**: React, Vite, Tailwind CSS, shadcn/ui, React Query, react-hook-form, Zod, recharts.
- **Backend Libraries**: Express.js, pdfkit.
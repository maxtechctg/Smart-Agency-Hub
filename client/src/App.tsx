import { Switch, Route, Redirect } from "wouter";
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/lib/theme-provider";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import ChatWidget from "@/components/chat-widget";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const Login = lazy(() => import("@/pages/login"));
const Leads = lazy(() => import("@/pages/leads"));
const Clients = lazy(() => import("@/pages/clients"));
const Projects = lazy(() => import("@/pages/projects"));
const Tasks = lazy(() => import("@/pages/tasks"));
const Team = lazy(() => import("@/pages/team"));
const AttendancePage = lazy(() => import("@/pages/attendance"));
const Finance = lazy(() => import("@/pages/finance"));
const Invoices = lazy(() => import("@/pages/invoices"));
const Payments = lazy(() => import("@/pages/payments"));
const Files = lazy(() => import("@/pages/files"));
const Chat = lazy(() => import("@/pages/chat"));
const AuditLogs = lazy(() => import("@/pages/audit-logs"));
const Settings = lazy(() => import("@/pages/settings"));
const Employees = lazy(() => import("@/pages/employees"));
const Departments = lazy(() => import("@/pages/departments"));
const HRAttendance = lazy(() => import("@/pages/hr-attendance"));
const LeaveManagement = lazy(() => import("@/pages/leave-management"));
const Payroll = lazy(() => import("@/pages/payroll"));
const AccountsDashboard = lazy(() => import("@/pages/accounts-dashboard"));
const ExpenseCategories = lazy(() => import("@/pages/expense-categories"));
const SalaryPayments = lazy(() => import("@/pages/salary-payments"));
const FinancialReports = lazy(() => import("@/pages/financial-reports"));
const ProfitLoss = lazy(() => import("@/pages/profit-loss"));
const GeneralLedger = lazy(() => import("@/pages/general-ledger"));
const PayrollReport = lazy(() => import("@/pages/payroll-report"));
const SalarySheet = lazy(() => import("@/pages/salary-sheet"));
const SalarySlip = lazy(() => import("@/pages/salary-slip"));
const PaymentReceipt = lazy(() => import("@/pages/payment-receipt"));
const HRAttendanceReport = lazy(() => import("@/pages/hr-attendance-report"));
const LeaveSummaryReport = lazy(() => import("@/pages/leave-summary-report"));
const OfficeSettings = lazy(() => import("@/pages/office-settings"));
const ProjectCredentials = lazy(() => import("@/pages/project-credentials"));
const EmailTemplates = lazy(() => import("@/pages/email-templates"));
const NotFound = lazy(() => import("@/pages/not-found"));

function ProtectedRoute({ component: Component }: { component: ComponentType<any> | LazyExoticComponent<any> }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function ProtectedRouteWithRoles({
  component: Component,
  allowedRoles
}: {
  component: ComponentType<any> | LazyExoticComponent<any>;
  allowedRoles: string[];
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function AuthRoute({ component: Component }: { component: ComponentType<any> | LazyExoticComponent<any> }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

function AppRouter() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    }>
      <Switch>
        <Route path="/login" component={() => <AuthRoute component={Login} />} />
        <Route path="/" component={() => <AuthRoute component={Login} />} />
        <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
        <Route path="/leads" component={() => <ProtectedRoute component={Leads} />} />
        <Route path="/clients" component={() => <ProtectedRoute component={Clients} />} />
        <Route path="/projects" component={() => <ProtectedRoute component={Projects} />} />
        <Route path="/tasks" component={() => <ProtectedRoute component={Tasks} />} />
        <Route path="/team" component={() => <ProtectedRoute component={Team} />} />
        <Route path="/attendance" component={() => <ProtectedRoute component={AttendancePage} />} />
        <Route path="/finance" component={() => <ProtectedRoute component={Finance} />} />
        <Route path="/invoices" component={() => <ProtectedRoute component={Invoices} />} />
        <Route path="/payments" component={() => <ProtectedRoute component={Payments} />} />
        <Route path="/files" component={() => <ProtectedRoute component={Files} />} />
        <Route path="/chat" component={() => <ProtectedRoute component={Chat} />} />
        <Route path="/audit-logs" component={() => <ProtectedRoute component={AuditLogs} />} />
        <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
        <Route path="/office-settings" component={() => <ProtectedRouteWithRoles component={OfficeSettings} allowedRoles={["admin"]} />} />
        <Route path="/hr/employees" component={() => <ProtectedRoute component={Employees} />} />
        <Route path="/hr/departments" component={() => <ProtectedRoute component={Departments} />} />
        <Route path="/hr/attendance" component={() => <ProtectedRoute component={HRAttendance} />} />
        <Route path="/hr/leave" component={() => <ProtectedRoute component={LeaveManagement} />} />
        <Route path="/hr/payroll" component={() => <ProtectedRoute component={Payroll} />} />
        <Route path="/hr/salary-sheet" component={() => <ProtectedRouteWithRoles component={SalarySheet} allowedRoles={["admin", "operational_head"]} />} />
        <Route path="/hr/salary-slip" component={() => <ProtectedRouteWithRoles component={SalarySlip} allowedRoles={["admin", "operational_head"]} />} />
        <Route path="/accounts/dashboard" component={() => <ProtectedRouteWithRoles component={AccountsDashboard} allowedRoles={["admin", "operational_head"]} />} />
        <Route path="/accounts/categories" component={() => <ProtectedRouteWithRoles component={ExpenseCategories} allowedRoles={["admin", "operational_head"]} />} />
        <Route path="/accounts/salary-payments" component={() => <ProtectedRouteWithRoles component={SalaryPayments} allowedRoles={["admin", "operational_head"]} />} />
        <Route path="/accounts/reports" component={() => <ProtectedRouteWithRoles component={FinancialReports} allowedRoles={["admin", "operational_head"]} />} />
        <Route path="/accounts/profit-loss" component={() => <ProtectedRouteWithRoles component={ProfitLoss} allowedRoles={["admin", "operational_head"]} />} />
        <Route path="/accounts/ledger" component={() => <ProtectedRouteWithRoles component={GeneralLedger} allowedRoles={["admin", "operational_head"]} />} />
        <Route path="/accounts/payroll-report" component={() => <ProtectedRouteWithRoles component={PayrollReport} allowedRoles={["admin", "operational_head"]} />} />
        <Route path="/accounts/payment-receipt" component={() => <ProtectedRouteWithRoles component={PaymentReceipt} allowedRoles={["admin", "operational_head"]} />} />
        <Route path="/hr/attendance-report" component={() => <ProtectedRouteWithRoles component={HRAttendanceReport} allowedRoles={["admin", "operational_head"]} />} />
        <Route path="/hr/leave-summary" component={() => <ProtectedRouteWithRoles component={LeaveSummaryReport} allowedRoles={["admin", "operational_head"]} />} />
        <Route path="/project-credentials" component={() => <ProtectedRouteWithRoles component={ProjectCredentials} allowedRoles={["admin", "operational_head"]} />} />
        <Route path="/settings/email-templates" component={() => <ProtectedRoute component={EmailTemplates} />} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function AppLayout() {
  const { user } = useAuth();

  if (!user) {
    return <AppRouter />;
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <>
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1">
            <header className="flex items-center justify-between p-4 border-b">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="flex items-center gap-2">
                <NotificationBell />
                <ThemeToggle />
              </div>
            </header>
            <main className="flex-1 overflow-auto">
              <AppRouter />
            </main>
          </div>
        </div>
      </SidebarProvider>
      <ChatWidget />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <AppLayout />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

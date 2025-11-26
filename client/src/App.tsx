import { Switch, Route, Redirect } from "wouter";
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

import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";
import Leads from "@/pages/leads";
import Clients from "@/pages/clients";
import Projects from "@/pages/projects";
import Tasks from "@/pages/tasks";
import Team from "@/pages/team";
import AttendancePage from "@/pages/attendance";
import Finance from "@/pages/finance";
import Invoices from "@/pages/invoices";
import Payments from "@/pages/payments";
import Files from "@/pages/files";
import Chat from "@/pages/chat";
import AuditLogs from "@/pages/audit-logs";
import Settings from "@/pages/settings";
import Employees from "@/pages/employees";
import Departments from "@/pages/departments";
import HRAttendance from "@/pages/hr-attendance";
import LeaveManagement from "@/pages/leave-management";
import Payroll from "@/pages/payroll";
import AccountsDashboard from "@/pages/accounts-dashboard";
import ExpenseCategories from "@/pages/expense-categories";
import SalaryPayments from "@/pages/salary-payments";
import FinancialReports from "@/pages/financial-reports";
import ProfitLoss from "@/pages/profit-loss";
import GeneralLedger from "@/pages/general-ledger";
import PayrollReport from "@/pages/payroll-report";
import SalarySheet from "@/pages/salary-sheet";
import SalarySlip from "@/pages/salary-slip";
import PaymentReceipt from "@/pages/payment-receipt";
import HRAttendanceReport from "@/pages/hr-attendance-report";
import LeaveSummaryReport from "@/pages/leave-summary-report";
import OfficeSettings from "@/pages/office-settings";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component }: { component: () => JSX.Element }) {
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
  component: () => JSX.Element; 
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

function AuthRoute({ component: Component }: { component: () => JSX.Element }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/login" component={() => <AuthRoute component={Login} />} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
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
      <Route component={NotFound} />
    </Switch>
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
      {/* Floating Chat Widget - Rendered outside layout to ensure fixed positioning works */}
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

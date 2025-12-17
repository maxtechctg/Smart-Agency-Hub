import { LayoutDashboard, Users, UserPlus, Briefcase, CheckSquare, UsersRound, Clock, DollarSign, FileText, CreditCard, Upload, MessageSquare, FileCheck, Settings, LogOut, UserCog, Building2, Fingerprint, CalendarDays, Wallet, PieChart, FolderOpen, Receipt, TrendingUp, BookOpen, ClipboardList, ChevronDown, ChevronRight, User, KeyRound } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import logoImage from "@assets/Untitled design (1)_1763794635122.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import { useQuery } from "@tanstack/react-query";
import type { Role } from "@shared/schema";

// Main Menu Items
const mainMenuItems = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "operational_head", "developer", "client"],
  },
  {
    title: "Leads",
    url: "/leads",
    icon: UserPlus,
    roles: ["admin", "operational_head"],
  },
  {
    title: "Clients",
    url: "/clients",
    icon: Users,
    roles: ["admin", "operational_head"],
  },
  {
    title: "Projects",
    url: "/projects",
    icon: Briefcase,
    roles: ["admin", "operational_head", "developer", "client"],
  },
  {
    title: "Tasks",
    url: "/tasks",
    icon: CheckSquare,
    roles: ["admin", "operational_head", "developer", "client"],
  },
  {
    title: "Team",
    url: "/team",
    icon: UsersRound,
    roles: ["admin", "operational_head"],
  },
  {
    title: "Project Credentials",
    url: "/project-credentials",
    icon: KeyRound,
    roles: ["admin", "operational_head"],
  },
];

// Communication with sub-items
const communicationItem = {
  title: "Communication",
  icon: MessageSquare,
  roles: ["admin", "operational_head", "developer", "client"],
  subItems: [
    {
      title: "Chat",
      url: "/chat",
      roles: ["admin", "operational_head", "developer", "client"],
    },
    {
      title: "Files",
      url: "/files",
      roles: ["admin", "operational_head", "developer", "client"],
    },
  ],
};

// HR Management Items
const hrMenuItems = [
  {
    title: "Attendance",
    url: "/attendance",
    icon: Clock,
    roles: ["admin", "operational_head", "developer"],
  },
  {
    title: "Employees",
    url: "/hr/employees",
    icon: UserCog,
    roles: ["admin", "operational_head"],
  },
  {
    title: "Departments",
    url: "/hr/departments",
    icon: Building2,
    roles: ["admin", "operational_head"],
  },
  {
    title: "Leave Management",
    url: "/hr/leave",
    icon: CalendarDays,
    roles: ["admin", "operational_head"],
  },
];

// Payroll with sub-items
const payrollItem = {
  title: "Payroll",
  icon: Wallet,
  url: "/hr/payroll",
  roles: ["admin", "operational_head"],
  subItems: [
    {
      title: "Salary Sheet",
      url: "/hr/salary-sheet",
      roles: ["admin", "operational_head"],
    },
    {
      title: "Salary Slip",
      url: "/hr/salary-slip",
      roles: ["admin", "operational_head"],
    },
    {
      title: "Attendance Report",
      url: "/hr/attendance-report",
      roles: ["admin", "operational_head"],
    },
    {
      title: "Leave Summary",
      url: "/hr/leave-summary",
      roles: ["admin", "operational_head"],
    },
  ],
};

// Accounts & Finance Items
const accountsMenuItems = [
  {
    title: "Invoices",
    url: "/invoices",
    icon: FileText,
    roles: ["admin", "operational_head", "client"],
  },
  {
    title: "Payments",
    url: "/payments",
    icon: CreditCard,
    roles: ["admin", "operational_head", "client"],
  },
  {
    title: "Expense Categories",
    url: "/accounts/categories",
    icon: FolderOpen,
    roles: ["admin", "operational_head"],
  },
  {
    title: "Salary Payments",
    url: "/accounts/salary-payments",
    icon: Receipt,
    roles: ["admin", "operational_head"],
  },
  {
    title: "Financial Reports",
    url: "/accounts/reports",
    icon: TrendingUp,
    roles: ["admin", "operational_head"],
  },
  {
    title: "Profit & Loss",
    url: "/accounts/profit-loss",
    icon: FileText,
    roles: ["admin", "operational_head"],
  },
  {
    title: "General Ledger",
    url: "/accounts/ledger",
    icon: BookOpen,
    roles: ["admin", "operational_head"],
  },
  {
    title: "Payroll Report",
    url: "/accounts/payroll-report",
    icon: Wallet,
    roles: ["admin", "operational_head"],
  },
  {
    title: "Payment Receipt",
    url: "/accounts/payment-receipt",
    icon: Receipt,
    roles: ["admin", "operational_head"],
  },
];

// Settings Items
const settingsItems = [
  {
    title: "Office Settings",
    url: "/office-settings",
    icon: Clock,
    roles: ["admin"],
  },
  {
    title: "Audit Logs",
    url: "/audit-logs",
    icon: User,
    roles: ["admin"],
  },
  {
    title: "Profile",
    url: "/settings",
    icon: User,
    roles: ["admin", "operational_head", "developer", "client"],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [communicationOpen, setCommunicationOpen] = useState(true);
  const [payrollOpen, setPayrollOpen] = useState(true);

  // Fetch all roles to check permissions for dynamic roles
  const { data: roles, isLoading: rolesLoading, error: rolesError } = useQuery<Role[]>({ queryKey: ["/api/roles"] });

  if (rolesLoading) console.log("[Sidebar] Loading roles...");
  if (rolesError) console.error("[Sidebar] Error loading roles:", rolesError);
  if (roles) console.log("[Sidebar] Roles loaded:", roles);
  if (user) console.log("[Sidebar] Current user:", user.role, user);

  // Helper to check if user has permission for an item
  const hasPermission = (item: { roles?: string[], url?: string }) => {
    if (!user) return false;

    // 1. Check strict role match (System roles)
    if (item.roles?.includes(user.role)) return true;

    // 2. Check dynamic permissions
    // Find the user's role configuration
    const userRoleConfig = roles?.find(r => r.name === user.role);
    if (!userRoleConfig) {
      console.warn(`[Sidebar] No role config found for role: ${user.role}`);
      return false;
    }

    // If item has a URL, check if that URL is in permissions (or mapped resource ID)
    // Map URL to resource ID (simple mapping based on URL start)
    const permissions = userRoleConfig.permissions as string[];
    if (!permissions) return false;

    // Simple Mapping Strategy:
    // If permission name is part of the URL, grant access.
    // e.g. permission "leads" -> url "/leads"
    // e.g. permission "projects" -> url "/projects"
    if (item.url) {
      if (item.url.startsWith("/dashboard")) {
        // Allow if explicit 'dashboard' permission OR if they have at least one module access?
        // For now, require 'dashboard' or 'leads' (legacy hack) or just 'dashboard'
        if (permissions.includes("dashboard")) return true;
        // Fallback: If they have any permissions, let them see dashboard?
        // No, let's look for "dashboard" permission.
      }

      const resourceId = item.url.split('/')[1]; // e.g. "leads", "projects"

      // Handle HR sub-routes
      if (item.url.startsWith("/hr/")) return permissions.includes("hr");
      if (item.url.startsWith("/attendance")) return permissions.includes("hr");

      // Handle Accounts
      if (item.url.startsWith("/accounts/")) return permissions.includes("finance");
      if (item.url.startsWith("/invoices") || item.url.startsWith("/payments")) return permissions.includes("finance");

      // Handle Communication
      if (item.url.startsWith("/chat") || item.url.startsWith("/files")) return permissions.includes("communication");

      // Handle Settings
      if (item.url.startsWith("/office-settings") || item.url.startsWith("/audit-logs")) return permissions.includes("settings");

      return permissions.includes(resourceId);
    }

    return false;
  };

  const filteredMainItems = mainMenuItems.filter(item => hasPermission(item));

  const filteredCommunicationSubItems = communicationItem.subItems.filter(item => hasPermission(item));

  const showCommunication = hasPermission({ roles: communicationItem.roles }) && filteredCommunicationSubItems.length > 0;

  const filteredHRItems = hrMenuItems.filter(item => hasPermission(item));

  const filteredPayrollSubItems = payrollItem.subItems.filter(item => hasPermission(item));

  const showPayroll = hasPermission({ roles: payrollItem.roles });

  const filteredAccountsItems = accountsMenuItems.filter(item => hasPermission(item));

  const filteredSettingsItems = settingsItems.filter(item => hasPermission(item));


  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b">
        <div className="flex items-center gap-2">
          <img src={logoImage} alt="MaxTech BD" className="h-8 object-contain" />
          <div>
            <h2 className="font-semibold text-sm">MaxTech BD</h2>
            <p className="text-xs text-muted-foreground">Control Hub</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* MAIN MENU */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-bold uppercase tracking-wider text-foreground/70 px-2 mb-1">
            Main Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredMainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`nav-${item.title.toLowerCase()}`}>
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span className="text-sm">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Communication Expandable */}
              {showCommunication && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => setCommunicationOpen(!communicationOpen)}
                      data-testid="nav-communication"
                    >
                      <communicationItem.icon className="w-4 h-4 shrink-0" />
                      <span className="text-sm">{communicationItem.title}</span>
                      {communicationOpen ? (
                        <ChevronDown className="ml-auto w-4 h-4" />
                      ) : (
                        <ChevronRight className="ml-auto w-4 h-4" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {communicationOpen && (
                    <SidebarMenuSub>
                      {filteredCommunicationSubItems.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.title}>
                          <SidebarMenuSubButton asChild isActive={location === subItem.url} data-testid={`nav-${subItem.title.toLowerCase()}`}>
                            <Link href={subItem.url}>
                              <span className="text-sm">{subItem.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  )}
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* HR MANAGEMENT */}
        {(filteredHRItems.length > 0 || showPayroll) && (
          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="text-xs font-bold uppercase tracking-wider text-foreground/70 px-2 mb-1">
              HR Management
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredHRItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}

                {/* Payroll Expandable */}
                {showPayroll && (
                  <>
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => setPayrollOpen(!payrollOpen)}
                        isActive={location === payrollItem.url}
                        data-testid="nav-payroll"
                      >
                        <payrollItem.icon className="w-4 h-4 shrink-0" />
                        <span className="text-sm">{payrollItem.title}</span>
                        {payrollOpen ? (
                          <ChevronDown className="ml-auto w-4 h-4" />
                        ) : (
                          <ChevronRight className="ml-auto w-4 h-4" />
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    {payrollOpen && (
                      <SidebarMenuSub>
                        {filteredPayrollSubItems.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild isActive={location === subItem.url} data-testid={`nav-${subItem.title.toLowerCase().replace(/\s+/g, '-')}`}>
                              <Link href={subItem.url}>
                                <span className="text-sm">{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* ACCOUNTS & FINANCE */}
        {filteredAccountsItems.length > 0 && (
          <SidebarGroup className="mt-4">
            <SidebarGroupLabel className="text-xs font-bold uppercase tracking-wider text-foreground/70 px-2 mb-1">
              Accounts & Finance
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {filteredAccountsItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={location === item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      <Link href={item.url}>
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* SETTINGS */}
        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-xs font-bold uppercase tracking-wider text-foreground/70 px-2 mb-1">
            Settings
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredSettingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span className="text-sm">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={logout} data-testid="button-logout">
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span className="text-sm">Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t">
        <div className="flex items-center gap-3 p-2 rounded-md bg-sidebar-accent">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground text-xs font-semibold">
              {user?.fullName.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.fullName}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

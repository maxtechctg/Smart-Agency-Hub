import { LayoutDashboard, Users, UserPlus, Briefcase, CheckSquare, UsersRound, Clock, DollarSign, FileText, CreditCard, Upload, MessageSquare, FileCheck, Settings, LogOut, UserCog, Building2, Fingerprint, CalendarDays, Wallet, PieChart, FolderOpen, Receipt, TrendingUp, BookOpen, ClipboardList, ChevronDown, ChevronRight, User } from "lucide-react";
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

// Main Menu Items
const mainMenuItems = [
  {
    title: "Dashboard",
    url: "/",
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

  const filteredMainItems = mainMenuItems.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  const filteredCommunicationSubItems = communicationItem.subItems.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  const showCommunication = user?.role && communicationItem.roles.includes(user.role) && filteredCommunicationSubItems.length > 0;

  const filteredHRItems = hrMenuItems.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  const filteredPayrollSubItems = payrollItem.subItems.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  const showPayroll = user?.role && payrollItem.roles.includes(user.role);

  const filteredAccountsItems = accountsMenuItems.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

  const filteredSettingsItems = settingsItems.filter(item => 
    user?.role && item.roles.includes(user.role)
  );

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

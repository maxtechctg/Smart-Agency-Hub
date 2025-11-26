import { Users, UserPlus, Briefcase, DollarSign, TrendingUp, Clock, CheckSquare, FileText, Folder } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import ClientDashboard from "./client-dashboard";
import { formatDistanceToNow } from "date-fns";

interface AdminDashboardStats {
  totalLeads: number;
  totalClients: number;
  activeProjects: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  attendanceRate: number;
  leadsGrowth: number;
  revenueGrowth: number;
}

interface DeveloperDashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalTasks: number;
  myTasks: number;
  completedTasks: number;
  totalFiles: number;
  attendanceRate: number;
}

interface AdminRecentActivity {
  leads: Array<{ id: string; name: string; createdAt: string }>;
  projects: Array<{ id: string; name: string; status: string; createdAt: string }>;
  invoices: Array<{ id: string; invoiceNumber: string; amount: string; createdAt: string }>;
}

interface DeveloperRecentActivity {
  tasks: Array<{ id: string; title: string; status: string; createdAt: string }>;
  files: Array<{ id: string; name: string; createdAt: string }>;
}

interface AdminUpcomingDeadlines {
  projects: Array<{ id: string; name: string; endDate: string; status: string }>;
  tasks: Array<{ id: string; title: string; dueDate: string; priority: string; status: string }>;
}

interface DeveloperUpcomingDeadlines {
  tasks: Array<{ id: string; title: string; dueDate: string; priority: string; status: string }>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useQuery<AdminDashboardStats | DeveloperDashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: recentActivity, isLoading: isLoadingActivity } = useQuery<AdminRecentActivity | DeveloperRecentActivity>({
    queryKey: ["/api/dashboard/recent-activity"],
    enabled: !!user?.role && user.role !== "client",
  });

  const { data: upcomingDeadlines, isLoading: isLoadingDeadlines } = useQuery<AdminUpcomingDeadlines | DeveloperUpcomingDeadlines>({
    queryKey: ["/api/dashboard/upcoming-deadlines"],
    enabled: !!user?.role && user.role !== "client",
  });

  // Render client-specific dashboard for client role
  if (user?.role === "client") {
    return <ClientDashboard />;
  }

  // Wait for user role to be loaded to prevent flashing sensitive data
  if (!user?.role) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-24 animate-pulse" />
                <div className="h-8 w-8 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-16 mb-2 animate-pulse" />
                <div className="h-3 bg-muted rounded w-20 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Developer-specific KPIs (sanitized, no sensitive data)
  const developerKpis: Array<{
    title: string;
    value: string | number;
    icon: any;
    color: string;
    bgColor: string;
  }> = [
    {
      title: "Total Projects",
      value: (stats as DeveloperDashboardStats)?.totalProjects ?? 0,
      icon: Folder,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-950",
    },
    {
      title: "Active Projects",
      value: (stats as DeveloperDashboardStats)?.activeProjects ?? 0,
      icon: Briefcase,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-950",
    },
    {
      title: "All Tasks",
      value: (stats as DeveloperDashboardStats)?.totalTasks ?? 0,
      icon: CheckSquare,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-950",
    },
    {
      title: "My Tasks",
      value: (stats as DeveloperDashboardStats)?.myTasks ?? 0,
      icon: CheckSquare,
      color: "text-indigo-600",
      bgColor: "bg-indigo-100 dark:bg-indigo-950",
    },
    {
      title: "Completed Tasks",
      value: (stats as DeveloperDashboardStats)?.completedTasks ?? 0,
      icon: CheckSquare,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100 dark:bg-emerald-950",
    },
    {
      title: "Total Files",
      value: (stats as DeveloperDashboardStats)?.totalFiles ?? 0,
      icon: FileText,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-950",
    },
    {
      title: "My Attendance",
      value: `${(stats as DeveloperDashboardStats)?.attendanceRate ?? 0}%`,
      icon: Clock,
      color: "text-cyan-600",
      bgColor: "bg-cyan-100 dark:bg-cyan-950",
    },
  ];

  // Admin/Operational Head KPIs (full access)
  const adminKpis: Array<{
    title: string;
    value: string | number;
    icon: any;
    trend?: number;
    color: string;
    bgColor: string;
  }> = [
    {
      title: "Total Leads",
      value: (stats as AdminDashboardStats)?.totalLeads ?? 0,
      icon: UserPlus,
      trend: (stats as AdminDashboardStats)?.leadsGrowth ?? 0,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-950",
    },
    {
      title: "Active Clients",
      value: (stats as AdminDashboardStats)?.totalClients ?? 0,
      icon: Users,
      trend: 0,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-950",
    },
    {
      title: "Active Projects",
      value: (stats as AdminDashboardStats)?.activeProjects ?? 0,
      icon: Briefcase,
      trend: 0,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-950",
    },
    {
      title: "Monthly Revenue",
      value: (stats as AdminDashboardStats)?.monthlyRevenue ?? 0,
      icon: DollarSign,
      trend: (stats as AdminDashboardStats)?.revenueGrowth ?? 0,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100 dark:bg-emerald-950",
    },
    {
      title: "Monthly Expenses",
      value: `${(stats as AdminDashboardStats)?.monthlyExpenses ?? 0}`,
      icon: TrendingUp,
      trend: 0,
      color: "text-red-600",
      bgColor: "bg-red-100 dark:bg-red-950",
    },
    {
      title: "Attendance Rate",
      value: `${(stats as AdminDashboardStats)?.attendanceRate ?? 0}%`,
      icon: Clock,
      trend: 0,
      color: "text-orange-600",
      bgColor: "bg-orange-100 dark:bg-orange-950",
    },
  ];

  // Select KPIs based on user role
  const kpis = user?.role === "developer" ? developerKpis : adminKpis;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <div className="h-4 bg-muted rounded w-24 animate-pulse" />
                <div className="h-8 w-8 bg-muted rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-16 mb-2 animate-pulse" />
                <div className="h-3 bg-muted rounded w-20 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return { text: "text-orange-600", bg: "bg-orange-100 dark:bg-orange-950" };
      case "medium": return { text: "text-yellow-600", bg: "bg-yellow-100 dark:bg-yellow-950" };
      case "low": return { text: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-950" };
      default: return { text: "text-gray-600", bg: "bg-gray-100 dark:bg-gray-950" };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "text-green-500";
      case "in_progress": return "text-blue-500";
      case "pending": return "text-yellow-500";
      case "completed": case "done": return "text-purple-500";
      default: return "text-gray-500";
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-dashboard-title">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Welcome to MaxTech BD Control Hub</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.title} data-testid={`card-kpi-${kpi.title.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <div className={`p-2 rounded-md ${kpi.bgColor}`}>
                <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`text-${kpi.title.toLowerCase().replace(/\s+/g, '-')}`}>
                {kpi.value}
              </div>
              {'trend' in kpi && typeof kpi.trend === 'number' && kpi.trend !== 0 && (
                <p className="text-xs text-muted-foreground">
                  {kpi.trend > 0 ? "+" : ""}
                  {kpi.trend}% from last month
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingActivity ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-md bg-muted/50">
                    <div className="w-2 h-2 bg-muted rounded-full animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                      <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : user?.role === "developer" ? (
              <div className="space-y-4">
                {recentActivity && 'tasks' in recentActivity && recentActivity.tasks.length > 0 ? (
                  recentActivity.tasks.slice(0, 3).map((task) => (
                    <div key={task.id} className="flex items-center gap-4 p-3 rounded-md bg-muted/50">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(task.status)}`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {task.status} • {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                )}
                {recentActivity && 'files' in recentActivity && recentActivity.files.length > 0 && (
                  recentActivity.files.slice(0, 2).map((file) => (
                    <div key={file.id} className="flex items-center gap-4 p-3 rounded-md bg-muted/50">
                      <div className="w-2 h-2 bg-purple-500 rounded-full" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">File uploaded: {file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(file.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity && 'leads' in recentActivity && recentActivity.leads.map((lead) => (
                  <div key={lead.id} className="flex items-center gap-4 p-3 rounded-md bg-muted/50">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">New lead added: {lead.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
                {recentActivity && 'projects' in recentActivity && recentActivity.projects.map((project) => (
                  <div key={project.id} className="flex items-center gap-4 p-3 rounded-md bg-muted/50">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(project.status)}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Project: {project.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {project.status} • {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
                {recentActivity && 'invoices' in recentActivity && recentActivity.invoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center gap-4 p-3 rounded-md bg-muted/50">
                    <div className="w-2 h-2 bg-orange-500 rounded-full" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Invoice: {invoice.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        BDT {invoice.amount} • {formatDistanceToNow(new Date(invoice.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
                {(!recentActivity || ('leads' in recentActivity && recentActivity.leads.length === 0 && recentActivity.projects.length === 0 && recentActivity.invoices.length === 0)) && (
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{user?.role === "developer" ? "My Upcoming Tasks" : "Upcoming Deadlines"}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingDeadlines ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-muted rounded w-3/4 animate-pulse" />
                      <div className="h-3 bg-muted rounded w-1/2 animate-pulse" />
                    </div>
                    <div className="h-6 w-16 bg-muted rounded animate-pulse ml-4" />
                  </div>
                ))}
              </div>
            ) : user?.role === "developer" ? (
              <div className="space-y-4">
                {upcomingDeadlines && 'tasks' in upcomingDeadlines && upcomingDeadlines.tasks.length > 0 ? (
                  upcomingDeadlines.tasks.map((task) => {
                    const priorityColors = getPriorityColor(task.priority);
                    const daysUntil = Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <div key={task.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">{task.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Due in {daysUntil} {daysUntil === 1 ? 'day' : 'days'}
                          </p>
                        </div>
                        <span className={`text-xs font-medium ${priorityColors.text} ${priorityColors.bg} px-2 py-1 rounded capitalize`}>
                          {task.priority}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">No upcoming tasks</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingDeadlines && 'projects' in upcomingDeadlines && upcomingDeadlines.projects.map((project) => {
                  const daysUntil = Math.ceil((new Date(project.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  const priority = daysUntil <= 3 ? 'high' : daysUntil <= 7 ? 'medium' : 'low';
                  const priorityColors = getPriorityColor(priority);
                  return (
                    <div key={project.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{project.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Due in {daysUntil} {daysUntil === 1 ? 'day' : 'days'}
                        </p>
                      </div>
                      <span className={`text-xs font-medium ${priorityColors.text} ${priorityColors.bg} px-2 py-1 rounded capitalize`}>
                        {priority}
                      </span>
                    </div>
                  );
                })}
                {upcomingDeadlines && 'tasks' in upcomingDeadlines && upcomingDeadlines.tasks.map((task) => {
                  const priorityColors = getPriorityColor(task.priority);
                  const daysUntil = Math.ceil((new Date(task.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={task.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">{task.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Due in {daysUntil} {daysUntil === 1 ? 'day' : 'days'}
                        </p>
                      </div>
                      <span className={`text-xs font-medium ${priorityColors.text} ${priorityColors.bg} px-2 py-1 rounded capitalize`}>
                        {task.priority}
                      </span>
                    </div>
                  );
                })}
                {(!upcomingDeadlines || ('projects' in upcomingDeadlines && upcomingDeadlines.projects.length === 0 && upcomingDeadlines.tasks.length === 0)) && (
                  <p className="text-sm text-muted-foreground">No upcoming deadlines</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

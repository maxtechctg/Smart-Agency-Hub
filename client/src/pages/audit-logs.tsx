import { FileCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { type AuditLog } from "@shared/schema";

export default function AuditLogs() {
  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs"],
  });

  const getActionColor = (action: string) => {
    if (action.includes("create")) return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300";
    if (action.includes("update")) return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300";
    if (action.includes("delete")) return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
    return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 bg-muted rounded w-32 mb-6 animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-5 bg-muted rounded w-3/4 mb-2 animate-pulse" />
                <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">Track all system activities</p>
      </div>

      {!logs || logs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileCheck className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No activity logs</h3>
            <p className="text-sm text-muted-foreground">System activities will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <Card key={log.id} data-testid={`log-${log.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <Badge className={getActionColor(log.action)} data-testid={`badge-action-${log.id}`}>
                        {log.action}
                      </Badge>
                      <span className="text-sm font-medium">{log.resourceType}</span>
                      {log.resourceId && (
                        <span className="text-xs font-mono text-muted-foreground">
                          ID: {log.resourceId.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

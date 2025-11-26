import { useState } from "react";
import { Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type Attendance } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";

export default function AttendancePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: attendanceRecords, isLoading } = useQuery<Attendance[]>({
    queryKey: ["/api/attendance"],
  });

  const checkInMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/attendance/check-in"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({ title: "Success", description: "Checked in successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/attendance/check-out"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({ title: "Success", description: "Checked out successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const todayAttendance = attendanceRecords?.find(
    (record) =>
      new Date(record.date).toDateString() === new Date().toDateString() &&
      record.userId === user?.id
  );

  const handleCheckIn = async () => {
    checkInMutation.mutate();
  };

  const handleCheckOut = async () => {
    checkOutMutation.mutate();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "on-time": return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300";
      case "late": return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300";
      case "absent": return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 bg-muted rounded w-32 mb-6 animate-pulse" />
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardContent className="p-6">
              <div className="h-20 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Attendance</h1>
        <p className="text-sm text-muted-foreground">Track your work hours</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Today's Attendance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayAttendance ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Check-in</span>
                  <span className="font-mono font-semibold" data-testid="text-check-in-time">
                    {todayAttendance.checkIn ? new Date(todayAttendance.checkIn).toLocaleTimeString() : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Check-out</span>
                  <span className="font-mono font-semibold" data-testid="text-check-out-time">
                    {todayAttendance.checkOut ? new Date(todayAttendance.checkOut).toLocaleTimeString() : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge className={getStatusColor(todayAttendance.status)} data-testid="badge-status">
                    {todayAttendance.status}
                  </Badge>
                </div>
                {!todayAttendance.checkOut && (
                  <Button
                    onClick={handleCheckOut}
                    disabled={checkOutMutation.isPending}
                    className="w-full"
                    variant="destructive"
                    data-testid="button-check-out"
                  >
                    {checkOutMutation.isPending ? "Processing..." : "Check Out"}
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">
                  You haven't checked in today
                </p>
                <Button
                  onClick={handleCheckIn}
                  disabled={checkInMutation.isPending}
                  className="w-full"
                  data-testid="button-check-in"
                >
                  {checkInMutation.isPending ? "Processing..." : "Check In Now"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold" data-testid="text-days-present">
                  {attendanceRecords?.filter((r) => r.status !== "absent").length ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Days Present</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600" data-testid="text-late-days">
                  {attendanceRecords?.filter((r) => r.status === "late").length ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Late Days</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-600" data-testid="text-absent-days">
                  {attendanceRecords?.filter((r) => r.status === "absent").length ?? 0}
                </p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance History</CardTitle>
        </CardHeader>
        <CardContent>
          {!attendanceRecords || attendanceRecords.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No attendance records yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attendanceRecords.slice(0, 10).map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                  data-testid={`record-${record.id}`}
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">
                      {new Date(record.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-mono">
                      {record.checkIn ? new Date(record.checkIn).toLocaleTimeString() : "-"}
                      {" → "}
                      {record.checkOut ? new Date(record.checkOut).toLocaleTimeString() : "-"}
                    </div>
                    <Badge className={getStatusColor(record.status)}>
                      {record.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

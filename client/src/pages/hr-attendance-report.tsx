import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, FileSpreadsheet, FileType, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, subDays } from "date-fns";

interface AttendanceRecord {
  date: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  status: "present" | "late" | "half-day" | "absent";
  checkInTime: string | null;
  checkOutTime: string | null;
  notes?: string | null;
}

interface AttendanceReportData {
  attendanceData: AttendanceRecord[];
  summary: {
    totalDays: number;
    workingDays?: number;
    presentCount: number;
    onTimeCount?: number;
    lateCount: number;
    halfDayCount: number;
    absentCount: number;
    overtimeCount: number;
    overtimeHours?: string;
    totalHoursWorked?: string;
    presentPercentage: string;
    latePercentage: string;
    halfDayPercentage: string;
    absentPercentage: string;
  };
  dateRange: {
    start: string;
    end: string;
  };
}

export default function HRAttendanceReport() {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [reportGenerated, setReportGenerated] = useState(false);

  // Fetch employees for filter
  const { data: employees } = useQuery<any[]>({
    queryKey: ["/api/employees"],
  });

  // Fetch departments for filter
  const { data: departments } = useQuery<any[]>({
    queryKey: ["/api/departments"],
  });

  // Fetch report data
  const { data: reportData, isLoading: reportLoading, refetch } = useQuery<AttendanceReportData>({
    queryKey: ["/api/hr-attendance-report", startDate, endDate, selectedEmployee, selectedDepartment],
    queryFn: async () => {
      if (!startDate || !endDate) {
        throw new Error("Start date and end date are required");
      }
      const params = new URLSearchParams({
        startDate: startDate,
        endDate: endDate,
      });
      if (selectedEmployee && selectedEmployee !== "all") params.append("employeeId", selectedEmployee);
      if (selectedDepartment && selectedDepartment !== "all") params.append("departmentId", selectedDepartment);

      const response = await fetch(`/api/hr-attendance-report?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch attendance report");
      }
      return response.json();
    },
    enabled: reportGenerated,
  });

  const handleGenerateReport = () => {
    if (!startDate || !endDate) {
      toast({
        title: "Error",
        description: "Please select both start and end dates",
        variant: "destructive",
      });
      return;
    }
    setReportGenerated(true);
    refetch();
  };

  const handleExport = async (exportFormat: "pdf" | "excel" | "word") => {
    if (!reportData) {
      toast({
        title: "Error",
        description: "Please generate the report first",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(
        `/api/hr-attendance-report/export-${exportFormat}?data=${encodeURIComponent(JSON.stringify(reportData))}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      if (!response.ok) throw new Error(`Failed to export ${exportFormat.toUpperCase()}`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fileExt = exportFormat === "excel" ? "xlsx" : exportFormat === "pdf" ? "pdf" : "docx";
      a.download = `Attendance-Report-${format(new Date(), "yyyy-MM-dd")}.${fileExt}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: `Report exported as ${exportFormat.toUpperCase()} successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to export report",
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus === "present") return "default";
    if (normalizedStatus === "late") return "secondary";
    if (normalizedStatus === "half-day") return "outline";
    return "destructive"; // absent
  };

  // Detect if this is an Employee Job Card (single employee selected)
  const isJobCard = reportData && reportData.attendanceData.length > 0 && 
    reportData.attendanceData.every(r => r.employeeId === reportData.attendanceData[0].employeeId);
  
  const jobCardEmployee = isJobCard ? reportData.attendanceData[0] : null;

  return (
    <div className="p-6 space-y-6" data-testid="page-hr-attendance-report">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">HR Attendance Report</h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          View and export employee attendance records with detailed status tracking
        </p>
      </div>

      {/* Filters Card */}
      <Card data-testid="card-filters">
        <CardHeader>
          <CardTitle data-testid="text-filters-title">Report Filters</CardTitle>
          <CardDescription data-testid="text-filters-description">
            Select date range and optional filters to generate attendance report
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date" data-testid="label-start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date" data-testid="label-end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee" data-testid="label-employee">Employee (Optional)</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger id="employee" data-testid="select-employee">
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="select-employee-all">All Employees</SelectItem>
                  {employees?.map((emp) => {
                    // Access user data from the users array returned by /api/employees
                    // Handle both JSON string and parsed array formats
                    let usersArray: any[] = [];
                    if (typeof emp.users === 'string') {
                      try {
                        usersArray = JSON.parse(emp.users);
                      } catch {
                        usersArray = [];
                      }
                    } else if (Array.isArray(emp.users)) {
                      usersArray = emp.users;
                    }
                    
                    const user = usersArray.length > 0 ? usersArray[0] : null;
                    const userName = user?.fullName || '';
                    const employeeCode = emp.employeeId || emp.id;
                    
                    return (
                      <SelectItem key={emp.id} value={emp.id} data-testid={`select-employee-${emp.id}`}>
                        {employeeCode}{userName ? ` - ${userName}` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="department" data-testid="label-department">Department (Optional)</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger id="department" data-testid="select-department">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="select-department-all">All Departments</SelectItem>
                  {departments?.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id} data-testid={`select-department-${dept.id}`}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleGenerateReport} data-testid="button-generate-report">
              <Calendar className="mr-2 h-4 w-4" />
              Generate Report
            </Button>
            {selectedEmployee && (
              <Button 
                variant="outline" 
                onClick={() => setSelectedEmployee("")}
                data-testid="button-clear-employee"
              >
                Clear Employee Filter
              </Button>
            )}
            {selectedDepartment && (
              <Button 
                variant="outline" 
                onClick={() => setSelectedDepartment("")}
                data-testid="button-clear-department"
              >
                Clear Department Filter
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Employee Job Card Indicator */}
      {isJobCard && jobCardEmployee && (
        <Card data-testid="card-job-card-indicator" className="border-primary/50 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="text-job-card-title">
              <FileText className="h-5 w-5 text-primary" />
              Employee Job Card
            </CardTitle>
            <CardDescription data-testid="text-job-card-description">
              Viewing detailed job card for <strong>{jobCardEmployee.employeeName}</strong> ({jobCardEmployee.employeeCode}) - {jobCardEmployee.department}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This report shows comprehensive attendance analytics including daily check-in/check-out times, 
              working hours, overtime calculation, and on-time tracking. Export to PDF, Excel, or Word for professional documentation.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Summary Card */}
      {reportData && (
        <Card data-testid="card-summary">
          <CardHeader>
            <CardTitle data-testid="text-summary-title">
              {isJobCard ? "Job Card Summary" : "Attendance Summary"}
            </CardTitle>
            <CardDescription data-testid="text-summary-description">
              {reportData.dateRange.start} to {reportData.dateRange.end}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1" data-testid="summary-working-days">
                <p className="text-sm text-muted-foreground">Working Days</p>
                <p className="text-2xl font-bold" data-testid="text-working-days">
                  {reportData.summary.workingDays || reportData.summary.totalDays}
                </p>
              </div>
              <div className="space-y-1" data-testid="summary-present">
                <p className="text-sm text-muted-foreground">Present</p>
                <p className="text-2xl font-bold text-green-600" data-testid="text-present-count">
                  {reportData.summary.presentCount} ({reportData.summary.presentPercentage}%)
                </p>
              </div>
              <div className="space-y-1" data-testid="summary-on-time">
                <p className="text-sm text-muted-foreground">On-Time</p>
                <p className="text-2xl font-bold text-emerald-600" data-testid="text-on-time-count">
                  {reportData.summary.onTimeCount || 0}
                </p>
              </div>
              <div className="space-y-1" data-testid="summary-late">
                <p className="text-sm text-muted-foreground">Late</p>
                <p className="text-2xl font-bold text-orange-600" data-testid="text-late-count">
                  {reportData.summary.lateCount} ({reportData.summary.latePercentage}%)
                </p>
              </div>
              <div className="space-y-1" data-testid="summary-half-day">
                <p className="text-sm text-muted-foreground">Half-Day</p>
                <p className="text-2xl font-bold text-blue-600" data-testid="text-half-day-count">
                  {reportData.summary.halfDayCount} ({reportData.summary.halfDayPercentage}%)
                </p>
              </div>
              <div className="space-y-1" data-testid="summary-absent">
                <p className="text-sm text-muted-foreground">Absent</p>
                <p className="text-2xl font-bold text-red-600" data-testid="text-absent-count">
                  {reportData.summary.absentCount} ({reportData.summary.absentPercentage}%)
                </p>
              </div>
              <div className="space-y-1" data-testid="summary-total-hours">
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold text-slate-700 dark:text-slate-300" data-testid="text-total-hours">
                  {reportData.summary.totalHoursWorked ? parseFloat(reportData.summary.totalHoursWorked).toFixed(1) : "0.0"} hrs
                </p>
              </div>
              <div className="space-y-1" data-testid="summary-overtime-hours">
                <p className="text-sm text-muted-foreground">Overtime</p>
                <p className="text-2xl font-bold text-purple-600" data-testid="text-overtime-hours">
                  {reportData.summary.overtimeHours ? parseFloat(reportData.summary.overtimeHours).toFixed(1) : "0.0"} hrs
                </p>
              </div>
            </div>

            <div className="flex gap-2 mt-6 flex-wrap">
              <Button onClick={() => handleExport("pdf")} variant="outline" data-testid="button-export-pdf">
                <FileText className="mr-2 h-4 w-4" />
                {isJobCard ? "Export Job Card (PDF)" : "Export PDF"}
              </Button>
              <Button onClick={() => handleExport("excel")} variant="outline" data-testid="button-export-excel">
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                {isJobCard ? "Export Job Card (Excel)" : "Export Excel"}
              </Button>
              <Button onClick={() => handleExport("word")} variant="outline" data-testid="button-export-word">
                <FileType className="mr-2 h-4 w-4" />
                {isJobCard ? "Export Job Card (Word)" : "Export Word"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Table */}
      {reportData && reportData.attendanceData.length > 0 && (
        <Card data-testid="card-attendance-table">
          <CardHeader>
            <CardTitle data-testid="text-table-title">Attendance Details</CardTitle>
            <CardDescription data-testid="text-table-description">
              Detailed attendance records for the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead data-testid="header-date">Date</TableHead>
                    <TableHead data-testid="header-employee">Employee</TableHead>
                    <TableHead data-testid="header-employee-code">Employee Code</TableHead>
                    <TableHead data-testid="header-department">Department</TableHead>
                    <TableHead data-testid="header-status">Status</TableHead>
                    <TableHead data-testid="header-check-in">Check In</TableHead>
                    <TableHead data-testid="header-check-out">Check Out</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.attendanceData.map((record, index) => (
                    <TableRow key={`${record.employeeId}-${record.date}`} data-testid={`row-attendance-${index}`}>
                      <TableCell data-testid={`cell-date-${index}`}>{record.date}</TableCell>
                      <TableCell data-testid={`cell-employee-${index}`}>{record.employeeName}</TableCell>
                      <TableCell data-testid={`cell-employee-code-${index}`}>{record.employeeCode}</TableCell>
                      <TableCell data-testid={`cell-department-${index}`}>{record.department}</TableCell>
                      <TableCell data-testid={`cell-status-${index}`}>
                        <Badge variant={getStatusBadgeVariant(record.status)} data-testid={`badge-status-${index}`}>
                          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`cell-check-in-${index}`}>{record.checkInTime || "-"}</TableCell>
                      <TableCell data-testid={`cell-check-out-${index}`}>{record.checkOutTime || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {reportLoading && (
        <Card data-testid="card-loading">
          <CardContent className="py-10">
            <p className="text-center text-muted-foreground" data-testid="text-loading">
              Generating attendance report...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {reportGenerated && reportData && reportData.attendanceData.length === 0 && (
        <Card data-testid="card-empty">
          <CardContent className="py-10">
            <p className="text-center text-muted-foreground" data-testid="text-empty">
              No attendance records found for the selected period and filters.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

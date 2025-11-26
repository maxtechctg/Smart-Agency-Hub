import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type LeaveSummaryData = {
  employeeId: string;
  employeeName: string;
  department: string;
  leaveType: string;
  totalDays: string;
  usedDays: string;
  remainingDays: string;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
};

type ReportData = {
  leaveSummaryData: LeaveSummaryData[];
  summary: {
    totalEmployees: number;
    totalLeaveTypes: number;
    totalPendingRequests: number;
    totalApprovedRequests: number;
    totalRejectedRequests: number;
  };
  year: number;
};

export default function LeaveSummaryReport() {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(currentYear.toString());
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>("all");
  const [reportGenerated, setReportGenerated] = useState(false);

  // Generate year options (current year and 5 years back)
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  // Fetch employees
  const { data: employees } = useQuery<any[]>({
    queryKey: ["/api/employees"],
  });

  // Fetch leave types
  const { data: leaveTypes } = useQuery<any[]>({
    queryKey: ["/api/hr/leave-types"],
  });

  // Fetch report data
  const { data: reportData, isLoading: reportLoading, refetch } = useQuery<ReportData>({
    queryKey: ["/api/leave-summary-report", selectedYear, selectedEmployee, selectedLeaveType],
    queryFn: async () => {
      const params = new URLSearchParams({
        year: selectedYear,
      });
      if (selectedEmployee && selectedEmployee !== "all") params.append("employeeId", selectedEmployee);
      if (selectedLeaveType && selectedLeaveType !== "all") params.append("leaveTypeId", selectedLeaveType);

      const response = await fetch(`/api/leave-summary-report?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch leave summary report");
      }
      return response.json();
    },
    enabled: reportGenerated,
  });

  const handleGenerateReport = () => {
    if (!selectedYear) {
      toast({
        title: "Error",
        description: "Please select a year",
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
      const endpoint = exportFormat === "pdf" 
        ? "/api/leave-summary-report/export-pdf"
        : exportFormat === "excel"
        ? "/api/leave-summary-report/export-excel"
        : "/api/leave-summary-report/export-word";

      const params = new URLSearchParams({
        data: encodeURIComponent(JSON.stringify(reportData)),
      });

      const response = await fetch(`${endpoint}?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Leave-Summary-Report-${selectedYear}-${new Date().toISOString().split("T")[0]}.${
        exportFormat === "pdf" ? "pdf" : exportFormat === "excel" ? "xlsx" : "docx"
      }`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: `Report exported as ${exportFormat.toUpperCase()} successfully`,
      });
    } catch (error: any) {
      console.error("Export error:", error);
      toast({
        title: "Error",
        description: "Failed to export report",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="container-leave-summary-report">
      <div>
        <h1 className="text-2xl font-bold" data-testid="heading-page-title">Leave Summary Report</h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          Generate comprehensive leave summary reports with employee-wise balance and request statistics
        </p>
      </div>

      <Card data-testid="card-filters">
        <CardHeader>
          <CardTitle data-testid="heading-filters-title">Report Filters</CardTitle>
          <CardDescription data-testid="text-filters-description">
            Select filters to generate the leave summary report
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" data-testid="label-year">
                Year
              </label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger data-testid="select-year-trigger">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent data-testid="select-year-content">
                  {yearOptions.map((year) => (
                    <SelectItem 
                      key={year} 
                      value={year.toString()} 
                      data-testid={`select-year-option-${year}`}
                    >
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" data-testid="label-employee">
                Employee
              </label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger data-testid="select-employee-trigger">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent data-testid="select-employee-content">
                  <SelectItem value="all" data-testid="select-employee-option-all">
                    All Employees
                  </SelectItem>
                  {employees?.map((emp) => {
                    // Get the full name from the first user associated with this employee
                    const employeeName = emp.users && emp.users.length > 0 
                      ? emp.users[0].fullName 
                      : "Unknown Employee";
                    return (
                      <SelectItem 
                        key={emp.id} 
                        value={emp.id} 
                        data-testid={`select-employee-option-${emp.id}`}
                      >
                        {employeeName}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" data-testid="label-leave-type">
                Leave Type
              </label>
              <Select value={selectedLeaveType} onValueChange={setSelectedLeaveType}>
                <SelectTrigger data-testid="select-leave-type-trigger">
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent data-testid="select-leave-type-content">
                  <SelectItem value="all" data-testid="select-leave-type-option-all">
                    All Leave Types
                  </SelectItem>
                  {leaveTypes?.map((type) => (
                    <SelectItem 
                      key={type.id} 
                      value={type.id} 
                      data-testid={`select-leave-type-option-${type.id}`}
                    >
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={handleGenerateReport} 
            className="w-full md:w-auto"
            data-testid="button-generate-report"
          >
            Generate Report
          </Button>
        </CardContent>
      </Card>

      {reportLoading && (
        <Card data-testid="card-loading">
          <CardContent className="p-8">
            <div className="flex items-center justify-center">
              <div className="text-muted-foreground" data-testid="text-loading">
                Loading report data...
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {reportData && !reportLoading && (
        <>
          {/* Summary Card */}
          <Card data-testid="card-summary">
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle data-testid="heading-summary-title">Summary - {reportData.year}</CardTitle>
                <CardDescription data-testid="text-summary-description">
                  Overview of leave statistics for the selected period
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleExport("pdf")}
                  data-testid="button-export-pdf"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  PDF
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleExport("excel")}
                  data-testid="button-export-excel"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Excel
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleExport("word")}
                  data-testid="button-export-word"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Word
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="flex flex-col gap-1" data-testid="container-summary-employees">
                  <div className="text-2xl font-bold" data-testid="text-total-employees">
                    {reportData.summary.totalEmployees}
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid="label-total-employees">
                    Total Employees
                  </div>
                </div>
                <div className="flex flex-col gap-1" data-testid="container-summary-leave-types">
                  <div className="text-2xl font-bold" data-testid="text-total-leave-types">
                    {reportData.summary.totalLeaveTypes}
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid="label-total-leave-types">
                    Leave Types
                  </div>
                </div>
                <div className="flex flex-col gap-1" data-testid="container-summary-pending">
                  <div className="text-2xl font-bold text-yellow-600" data-testid="text-total-pending">
                    {reportData.summary.totalPendingRequests}
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid="label-total-pending">
                    Pending
                  </div>
                </div>
                <div className="flex flex-col gap-1" data-testid="container-summary-approved">
                  <div className="text-2xl font-bold text-green-600" data-testid="text-total-approved">
                    {reportData.summary.totalApprovedRequests}
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid="label-total-approved">
                    Approved
                  </div>
                </div>
                <div className="flex flex-col gap-1" data-testid="container-summary-rejected">
                  <div className="text-2xl font-bold text-red-600" data-testid="text-total-rejected">
                    {reportData.summary.totalRejectedRequests}
                  </div>
                  <div className="text-sm text-muted-foreground" data-testid="label-total-rejected">
                    Rejected
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leave Details Table */}
          <Card data-testid="card-details">
            <CardHeader>
              <CardTitle data-testid="heading-details-title">Leave Details</CardTitle>
              <CardDescription data-testid="text-details-description">
                Detailed breakdown of leave balance and requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reportData.leaveSummaryData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="text-no-data">
                  No leave data found for the selected filters
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table data-testid="table-leave-details">
                    <TableHeader>
                      <TableRow>
                        <TableHead data-testid="header-employee">Employee</TableHead>
                        <TableHead data-testid="header-department">Department</TableHead>
                        <TableHead data-testid="header-leave-type">Leave Type</TableHead>
                        <TableHead className="text-right" data-testid="header-total">Total</TableHead>
                        <TableHead className="text-right" data-testid="header-used">Used</TableHead>
                        <TableHead className="text-right" data-testid="header-remaining">Remaining</TableHead>
                        <TableHead className="text-center" data-testid="header-pending">Pending</TableHead>
                        <TableHead className="text-center" data-testid="header-approved">Approved</TableHead>
                        <TableHead className="text-center" data-testid="header-rejected">Rejected</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.leaveSummaryData.map((record, index) => (
                        <TableRow key={`${record.employeeId}-${record.leaveType}-${index}`} data-testid={`row-leave-${index}`}>
                          <TableCell className="font-medium" data-testid={`cell-employee-${index}`}>
                            {record.employeeName}
                          </TableCell>
                          <TableCell data-testid={`cell-department-${index}`}>
                            {record.department}
                          </TableCell>
                          <TableCell data-testid={`cell-leave-type-${index}`}>
                            {record.leaveType}
                          </TableCell>
                          <TableCell className="text-right" data-testid={`cell-total-${index}`}>
                            {record.totalDays}
                          </TableCell>
                          <TableCell className="text-right" data-testid={`cell-used-${index}`}>
                            {record.usedDays}
                          </TableCell>
                          <TableCell className="text-right" data-testid={`cell-remaining-${index}`}>
                            {record.remainingDays}
                          </TableCell>
                          <TableCell className="text-center" data-testid={`cell-pending-${index}`}>
                            <Badge variant="secondary" data-testid={`badge-pending-${index}`}>
                              {record.pendingRequests}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center" data-testid={`cell-approved-${index}`}>
                            <Badge 
                              variant="secondary" 
                              className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100"
                              data-testid={`badge-approved-${index}`}
                            >
                              {record.approvedRequests}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center" data-testid={`cell-rejected-${index}`}>
                            <Badge 
                              variant="secondary" 
                              className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100"
                              data-testid={`badge-rejected-${index}`}
                            >
                              {record.rejectedRequests}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!reportGenerated && !reportLoading && (
        <Card data-testid="card-empty-state">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="text-muted-foreground" data-testid="text-empty-state">
                Select filters and click "Generate Report" to view leave summary data
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, FileSpreadsheet, Users, DollarSign, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { sumAmounts } from "@shared/currency";
import Decimal from "decimal.js-light";

type Employee = {
  id: string;
  employeeId: string;
  userId: string;
};

type User = {
  id: string;
  name: string;
};

type Payroll = {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  basicSalary: string;
  totalAllowances: string;
  overtimeAmount: string;
  loanDeduction: string;
  lateDeduction: string;
  otherDeductions: string;
  grossSalary: string;
  netSalary: string;
  totalLateDays: number;
  totalAbsentDays: number;
  totalPresentDays: number;
  totalOvertimeHours: string;
  workingDays: number;
  status: string;
  paidAt?: string;
  createdAt: string;
};

type PayrollWithEmployee = {
  payroll: Payroll;
  employee: Employee | null;
  user: User | null;
};

export default function PayrollReport() {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const { toast } = useToast();

  const { data: payrolls, isLoading } = useQuery<PayrollWithEmployee[]>({
    queryKey: ["/api/payroll-report", selectedMonth, selectedYear],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/payroll-report?month=${selectedMonth}&year=${selectedYear}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Access denied");
        }
        throw new Error("Failed to fetch payroll report");
      }
      
      return response.json();
    }
  });

  // Export to PDF
  const exportToPDF = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/payroll-report/export-pdf?month=${selectedMonth}&year=${selectedYear}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Access denied - insufficient permissions");
        }
        throw new Error("Failed to generate PDF");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payroll-Report-${selectedMonth}-${selectedYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "PDF Downloaded",
        description: "Payroll Report exported successfully",
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export PDF",
        variant: "destructive",
      });
    }
  };

  // Export to Excel
  const exportToExcel = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/payroll-report/export-excel?month=${selectedMonth}&year=${selectedYear}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Access denied - insufficient permissions");
        }
        throw new Error("Failed to generate Excel");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payroll-Report-${selectedMonth}-${selectedYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Excel Downloaded",
        description: "Payroll Report exported successfully",
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export Excel",
        variant: "destructive",
      });
    }
  };

  // Export to Word
  const exportToWord = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/payroll-report/export-word?month=${selectedMonth}&year=${selectedYear}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Access denied - insufficient permissions");
        }
        throw new Error("Failed to generate Word document");
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payroll-Report-${selectedMonth}-${selectedYear}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Word Document Downloaded",
        description: "Payroll Report exported successfully",
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export Word document",
        variant: "destructive",
      });
    }
  };

  // Calculate totals using Decimal.js with null-safe handling
  const totalEmployees = payrolls?.length || 0;
  const totalGrossSalary = sumAmounts((payrolls || []).map(p => p.payroll.grossSalary || "0"));
  const totalDeductions = sumAmounts(
    (payrolls || []).flatMap(p => [
      p.payroll.loanDeduction || "0",
      p.payroll.lateDeduction || "0",
      p.payroll.otherDeductions || "0"
    ])
  );
  const totalNetSalary = sumAmounts((payrolls || []).map(p => p.payroll.netSalary || "0"));
  const totalPaidCount = (payrolls || []).filter(p => p.payroll.status === "paid").length;

  const months = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const years = Array.from({ length: 11 }, (_, i) => (currentYear - 5 + i).toString());

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-payroll-report">Payroll Report</h1>
          <p className="text-muted-foreground" data-testid="text-subtitle">Employee salary breakdown and payroll summary</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px]" data-testid="select-month">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value} data-testid={`option-month-${month.value}`}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]" data-testid="select-year">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year} data-testid={`option-year-${year}`}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportToPDF}
              data-testid="button-export-pdf"
            >
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToExcel}
              data-testid="button-export-excel"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToWord}
              data-testid="button-export-word"
            >
              <FileText className="h-4 w-4 mr-2" />
              Word
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-total-employees">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-employees">{totalEmployees}</div>
            <p className="text-xs text-muted-foreground">
              {totalPaidCount} paid
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-gross-salary">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gross Salary</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-gross-salary">
              {parseFloat(totalGrossSalary).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Before deductions
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-deductions">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Deductions</CardTitle>
            <DollarSign className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-total-deductions">
              {parseFloat(totalDeductions).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Loans, lates, other
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-net-payroll">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Payroll Cost</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-net-payroll">
              {parseFloat(totalNetSalary).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Total payout
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Employee Breakdown */}
      <Card data-testid="card-employee-breakdown">
        <CardHeader>
          <CardTitle>Employee Breakdown</CardTitle>
          <CardDescription>
            Detailed salary information for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading payroll data...</div>
          ) : !payrolls || payrolls.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-payroll">
              No payroll records found for this period
            </div>
          ) : (
            <div className="space-y-4">
              {payrolls.map((record, index) => {
                const totalDed = sumAmounts([
                  record.payroll.loanDeduction || "0",
                  record.payroll.lateDeduction || "0",
                  record.payroll.otherDeductions || "0"
                ]);
                
                return (
                  <div key={record.payroll.id} className="p-4 rounded-md bg-card border" data-testid={`payroll-${index}`}>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div>
                        <h3 className="font-semibold" data-testid={`text-employee-name-${index}`}>
                          {record.user?.name || "Unknown Employee"}
                        </h3>
                        <p className="text-sm text-muted-foreground" data-testid={`text-employee-id-${index}`}>
                          ID: {record.employee?.employeeId || "N/A"}
                        </p>
                      </div>
                      <Badge
                        variant={record.payroll.status === "paid" ? "default" : record.payroll.status === "draft" ? "secondary" : "outline"}
                        data-testid={`badge-status-${index}`}
                      >
                        {record.payroll.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Basic Salary</div>
                        <div className="font-medium" data-testid={`text-basic-${index}`}>
                          {parseFloat(record.payroll.basicSalary).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Allowances</div>
                        <div className="font-medium text-green-600" data-testid={`text-allowances-${index}`}>
                          +{parseFloat(record.payroll.totalAllowances).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Deductions</div>
                        <div className="font-medium text-red-600" data-testid={`text-deductions-${index}`}>
                          -{parseFloat(totalDed).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Net Salary</div>
                        <div className="font-medium text-lg" data-testid={`text-net-${index}`}>
                          {parseFloat(record.payroll.netSalary).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm mt-3 pt-3 border-t">
                      <div>
                        <div className="text-muted-foreground">Present Days</div>
                        <div className="font-medium" data-testid={`text-present-${index}`}>{record.payroll.totalPresentDays}/{record.payroll.workingDays}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Absent/Late</div>
                        <div className="font-medium" data-testid={`text-absent-late-${index}`}>
                          {record.payroll.totalAbsentDays}/{record.payroll.totalLateDays}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Overtime</div>
                        <div className="font-medium" data-testid={`text-overtime-${index}`}>
                          {parseFloat(record.payroll.totalOvertimeHours).toFixed(1)}h
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { FileText, FileSpreadsheet, FileType, Calendar, DollarSign, Plus, Trash2, RefreshCw, Clock, CheckCircle2, Edit } from "lucide-react";
import { sumAmounts } from "@shared/currency";
import { apiRequest, queryClient } from "@/lib/queryClient";

type User = {
  id: string;
  fullName: string;
  email: string;
};

type Employee = {
  id: string;
  employeeId: string;
  userId: string;
  departmentId: string | null;
  designationId: string | null;
  status: string;
};

type Department = {
  id: string;
  name: string;
} | null;

type Designation = {
  id: string;
  title: string;
} | null;

type SalaryStructure = {
  id: string;
  employeeId: string;
  basicSalary: string;
  houseAllowance: string;
  foodAllowance: string;
  travelAllowance: string;
  medicalAllowance: string;
  otherAllowances: string;
} | null;

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
  totalHalfDays: number;
  totalOvertimeHours: string;
  workingDays: number;
  status: string;
  paidAt?: string;
  createdAt: string;
} | null;

type SalaryAdjustment = {
  id: string;
  payrollId: string;
  type: string;
  amount: string;
  reason: string;
  createdBy: string;
  createdAt: string;
  creator?: {
    fullName: string;
  };
};

type SalarySheetRecord = {
  employee: Employee;
  user: User;
  department: Department;
  designation: Designation;
  salaryStructure: SalaryStructure;
  payroll: Payroll;
};

export default function SalarySheet() {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = useState(false);
  const [viewAdjustmentsDialogOpen, setViewAdjustmentsDialogOpen] = useState(false);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null);
  const [adjustmentForm, setAdjustmentForm] = useState({
    type: "bonus",
    amount: "",
    reason: ""
  });
  const { toast } = useToast();

  const { data: salaryRecords, isLoading, refetch } = useQuery<SalarySheetRecord[]>({
    queryKey: ["/api/salary-sheet", selectedMonth, selectedYear],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/salary-sheet?month=${selectedMonth}&year=${selectedYear}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Access denied");
        }
        throw new Error("Failed to fetch salary sheet");
      }

      return response.json();
    }
  });

  // Get adjustments for selected payroll
  const { data: adjustments } = useQuery<SalaryAdjustment[]>({
    queryKey: ["/api/payroll", selectedPayroll?.id, "adjustments"],
    enabled: !!selectedPayroll && viewAdjustmentsDialogOpen,
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/payroll/${selectedPayroll!.id}/adjustments`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to fetch adjustments");
      }

      return response.json();
    }
  });

  // Generate salary mutation
  const generateSalaryMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/payroll/generate", {
        month: parseInt(selectedMonth),
        year: parseInt(selectedYear)
      });
    },
    onSuccess: () => {
      toast({
        title: "Salary Generated",
        description: "Salary has been successfully generated for all employees",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate salary",
        variant: "destructive",
      });
    }
  });

  // Add adjustment mutation
  const addAdjustmentMutation = useMutation({
    mutationFn: async ({ payrollId, data }: { payrollId: string; data: any }) => {
      return apiRequest("POST", `/api/payroll/${payrollId}/adjustments`, data);
    },
    onSuccess: () => {
      toast({
        title: "Adjustment Added",
        description: "Salary adjustment has been applied successfully",
      });
      setAdjustmentDialogOpen(false);
      setAdjustmentForm({ type: "bonus", amount: "", reason: "" });
      refetch();
      // Invalidate both payroll records and adjustments queries
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
    },
    onError: (error: any) => {
      toast({
        title: "Adjustment Failed",
        description: error.message || "Failed to add adjustment",
        variant: "destructive",
      });
    }
  });

  // Delete adjustment mutation
  const deleteAdjustmentMutation = useMutation({
    mutationFn: async ({ payrollId, adjustmentId }: { payrollId: string; adjustmentId: string }) => {
      return apiRequest("DELETE", `/api/payroll/${payrollId}/adjustments/${adjustmentId}`);
    },
    onSuccess: () => {
      toast({
        title: "Adjustment Deleted",
        description: "Salary adjustment has been removed successfully",
      });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete adjustment",
        variant: "destructive",
      });
    }
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ payrollId, status }: { payrollId: string; status: string }) => {
      return apiRequest("PATCH", `/api/payroll/${payrollId}/status`, { status });
    },
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "Payment status has been updated successfully",
      });
      setStatusDialogOpen(false);
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    }
  });

  // Export to PDF
  const exportToPDF = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/salary-sheet/export-pdf?month=${selectedMonth}&year=${selectedYear}`, {
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
      a.download = `Salary-Sheet-${selectedMonth}-${selectedYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "PDF Downloaded",
        description: "Salary Sheet exported successfully",
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
      const response = await fetch(`/api/salary-sheet/export-excel?month=${selectedMonth}&year=${selectedYear}`, {
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
      a.download = `Salary-Sheet-${selectedMonth}-${selectedYear}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Excel Downloaded",
        description: "Salary Sheet exported successfully",
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
      const response = await fetch(`/api/salary-sheet/export-word?month=${selectedMonth}&year=${selectedYear}`, {
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
      a.download = `Salary-Sheet-${selectedMonth}-${selectedYear}.docx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Word Document Downloaded",
        description: "Salary Sheet exported successfully",
      });
    } catch (error: any) {
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export Word document",
        variant: "destructive",
      });
    }
  };

  const handleAddAdjustment = () => {
    if (!selectedPayroll) return;

    // Validate amount
    const amountValue = parseFloat(adjustmentForm.amount);
    if (!adjustmentForm.amount || isNaN(amountValue) || amountValue <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive amount",
        variant: "destructive",
      });
      return;
    }

    if (!adjustmentForm.reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for this adjustment",
        variant: "destructive",
      });
      return;
    }

    // Determine if amount should be negative (penalties and deductions subtract from salary)
    const isDeduction = adjustmentForm.type === "penalty" ||
      adjustmentForm.type === "loan_deduction" ||
      adjustmentForm.type === "advance";
    const finalAmount = isDeduction ? -Math.abs(amountValue) : Math.abs(amountValue);

    addAdjustmentMutation.mutate({
      payrollId: selectedPayroll.id,
      data: {
        type: adjustmentForm.type,
        amount: Number(finalAmount.toFixed(2)), // Send as number with 2 decimal precision
        reason: adjustmentForm.reason
      }
    });
  };

  const handleUpdateStatus = (newStatus: string) => {
    if (!selectedPayroll) return;

    // Prevent status regression: Cannot go back from "paid" to "draft" or "generated"
    if (selectedPayroll.status === "paid" && (newStatus === "draft" || newStatus === "generated")) {
      toast({
        title: "Invalid Status Change",
        description: "Cannot change status from 'Paid' back to 'Draft' or 'Generated'. This is a one-way workflow.",
        variant: "destructive",
      });
      return;
    }

    // Prevent going back from "generated" to "draft" (optional - uncomment if needed)
    // if (selectedPayroll.status === "generated" && newStatus === "draft") {
    //   toast({
    //     title: "Invalid Status Change",
    //     description: "Cannot change status from 'Generated' back to 'Draft'.",
    //     variant: "destructive",
    //   });
    //   return;
    // }

    updateStatusMutation.mutate({
      payrollId: selectedPayroll.id,
      status: newStatus
    });
  };

  // Calculate totals with null-safe handling
  const totalEmployees = salaryRecords?.length || 0;

  const totalBasic = sumAmounts((salaryRecords || []).map(r =>
    r.payroll?.basicSalary || r.salaryStructure?.basicSalary || "0"
  ));

  const totalAllowances = sumAmounts((salaryRecords || []).map(r =>
    r.payroll?.totalAllowances || sumAmounts([
      r.salaryStructure?.houseAllowance || "0",
      r.salaryStructure?.foodAllowance || "0",
      r.salaryStructure?.travelAllowance || "0",
      r.salaryStructure?.medicalAllowance || "0",
      r.salaryStructure?.otherAllowances || "0"
    ])
  ));

  const totalDeductions = sumAmounts(
    (salaryRecords || []).flatMap(r => [
      r.payroll?.loanDeduction || "0",
      r.payroll?.lateDeduction || "0",
      r.payroll?.otherDeductions || "0"
    ])
  );

  const totalOvertime = sumAmounts((salaryRecords || []).map(r => r.payroll?.overtimeAmount || "0"));

  const totalNetSalary = sumAmounts((salaryRecords || []).map(r => {
    if (r.payroll?.netSalary) {
      return r.payroll.netSalary;
    }
    const basic = r.salaryStructure?.basicSalary || "0";
    const allowances = sumAmounts([
      r.salaryStructure?.houseAllowance || "0",
      r.salaryStructure?.foodAllowance || "0",
      r.salaryStructure?.travelAllowance || "0",
      r.salaryStructure?.medicalAllowance || "0",
      r.salaryStructure?.otherAllowances || "0"
    ]);
    return sumAmounts([basic, allowances]);
  }));

  const totalPaidCount = (salaryRecords || []).filter(r => r.payroll?.status === "paid").length;
  const hasGeneratedSalary = (salaryRecords || []).some(r => r.payroll !== null);

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
    { value: "12", label: "December" }
  ];

  const years = Array.from({ length: 11 }, (_, i) => ({
    value: (currentYear - 5 + i).toString(),
    label: (currentYear - 5 + i).toString()
  }));

  const adjustmentTypes = [
    { value: "bonus", label: "Bonus" },
    { value: "penalty", label: "Penalty" },
    { value: "loan_deduction", label: "Loan Deduction" },
    { value: "advance", label: "Advance" },
    { value: "other", label: "Other" }
  ];

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "paid":
        return "default";
      case "generated":
        return "secondary";
      case "draft":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle2 className="w-3 h-3 mr-1" />;
      case "generated":
        return <Clock className="w-3 h-3 mr-1" />;
      default:
        return <Edit className="w-3 h-3 mr-1" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-salary-sheet">Salary Sheet</h1>
          <p className="text-muted-foreground">Monthly salary details with attendance integration</p>
        </div>
      </div>

      {/* Period Selector and Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Select Period & Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger data-testid="select-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year.value} value={year.value}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap pt-2 border-t">
            {/* Generate/Regenerate Salary */}
            {hasGeneratedSalary ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="default" data-testid="button-regenerate-salary">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Regenerate Salary
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Regenerate Salary?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete existing salary records and adjustments for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}, then recalculate based on current attendance data. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-regenerate">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => generateSalaryMutation.mutate()}
                      disabled={generateSalaryMutation.isPending}
                      data-testid="button-confirm-regenerate"
                    >
                      {generateSalaryMutation.isPending ? "Regenerating..." : "Regenerate"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <Button
                onClick={() => generateSalaryMutation.mutate()}
                disabled={generateSalaryMutation.isPending}
                data-testid="button-generate-salary"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                {generateSalaryMutation.isPending ? "Generating..." : "Generate Salary"}
              </Button>
            )}

            {/* Export Buttons */}
            <Button onClick={exportToPDF} variant="outline" data-testid="button-export-pdf">
              <FileText className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            <Button onClick={exportToExcel} variant="outline" data-testid="button-export-excel">
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Export Excel
            </Button>
            <Button onClick={exportToWord} variant="outline" data-testid="button-export-word">
              <FileType className="w-4 h-4 mr-2" />
              Export Word
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-employees">{totalEmployees}</div>
            <p className="text-xs text-muted-foreground mt-1">{totalPaidCount} paid</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Basic</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-basic">
              {parseFloat(totalBasic).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Allowances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-allowances">
              {parseFloat(totalAllowances).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Deductions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-total-deductions">
              {parseFloat(totalDeductions).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Overtime</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-overtime">
              {parseFloat(totalOvertime).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Net Payable</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary" data-testid="text-net-payable">
              {parseFloat(totalNetSalary).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Salary Sheet Details */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Salary Details</CardTitle>
          <CardDescription>
            Comprehensive salary sheet for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading salary data...</div>
          ) : !salaryRecords || salaryRecords.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-no-records">
              No employees with salary structures found for this period
            </div>
          ) : (
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead data-testid="header-name">Employee</TableHead>
                    <TableHead data-testid="header-id">ID</TableHead>
                    <TableHead data-testid="header-dept">Department</TableHead>
                    <TableHead data-testid="header-designation">Designation</TableHead>
                    <TableHead className="text-center" data-testid="header-present">Present</TableHead>
                    <TableHead className="text-center" data-testid="header-absent">Absent</TableHead>
                    <TableHead className="text-center" data-testid="header-late">Late</TableHead>
                    <TableHead className="text-center" data-testid="header-half">Half-Day</TableHead>
                    <TableHead className="text-center" data-testid="header-ot">OT (hrs)</TableHead>
                    <TableHead className="text-right" data-testid="header-basic">Basic</TableHead>
                    <TableHead className="text-right" data-testid="header-allowances">Allowances</TableHead>
                    <TableHead className="text-right" data-testid="header-deductions">Deductions</TableHead>
                    <TableHead className="text-right" data-testid="header-overtime">Overtime</TableHead>
                    <TableHead className="text-right" data-testid="header-net">Net Salary</TableHead>
                    <TableHead className="text-center" data-testid="header-status">Status</TableHead>
                    <TableHead className="text-center" data-testid="header-actions">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryRecords.map((record, index) => {
                    const basicSalary = record.payroll?.basicSalary || record.salaryStructure?.basicSalary || "0";
                    const allowances = record.payroll?.totalAllowances || sumAmounts([
                      record.salaryStructure?.houseAllowance || "0",
                      record.salaryStructure?.foodAllowance || "0",
                      record.salaryStructure?.travelAllowance || "0",
                      record.salaryStructure?.medicalAllowance || "0",
                      record.salaryStructure?.otherAllowances || "0"
                    ]);
                    const overtime = record.payroll?.overtimeAmount || "0";
                    const deductions = sumAmounts([
                      record.payroll?.loanDeduction || "0",
                      record.payroll?.lateDeduction || "0",
                      record.payroll?.otherDeductions || "0"
                    ]);
                    const netSalary = record.payroll?.netSalary || sumAmounts([basicSalary, allowances, overtime, `-${deductions}`]);
                    const status = record.payroll?.status || "Not Generated";

                    return (
                      <TableRow key={record.employee.id} data-testid={`salary-row-${index}`}>
                        <TableCell className="font-medium" data-testid={`text-employee-name-${index}`}>
                          {record.user.fullName}
                        </TableCell>
                        <TableCell data-testid={`text-employee-id-${index}`}>
                          {record.employee.employeeId}
                        </TableCell>
                        <TableCell data-testid={`text-department-${index}`}>
                          {record.department?.name || "N/A"}
                        </TableCell>
                        <TableCell data-testid={`text-designation-${index}`}>
                          {record.designation?.title || "N/A"}
                        </TableCell>
                        <TableCell className="text-center" data-testid={`text-present-${index}`}>
                          {record.payroll?.totalPresentDays || "-"}
                        </TableCell>
                        <TableCell className="text-center" data-testid={`text-absent-${index}`}>
                          {record.payroll?.totalAbsentDays || "-"}
                        </TableCell>
                        <TableCell className="text-center" data-testid={`text-late-${index}`}>
                          {record.payroll?.totalLateDays || "-"}
                        </TableCell>
                        <TableCell className="text-center" data-testid={`text-half-${index}`}>
                          {record.payroll?.totalHalfDays || "-"}
                        </TableCell>
                        <TableCell className="text-center" data-testid={`text-ot-${index}`}>
                          {record.payroll?.totalOvertimeHours ? parseFloat(record.payroll.totalOvertimeHours).toFixed(1) : "-"}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-basic-${index}`}>
                          {parseFloat(basicSalary).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-green-600" data-testid={`text-allowances-${index}`}>
                          {parseFloat(allowances).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-red-600" data-testid={`text-deductions-${index}`}>
                          {parseFloat(deductions).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-overtime-${index}`}>
                          {parseFloat(overtime).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-bold" data-testid={`text-net-${index}`}>
                          {parseFloat(netSalary).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center" data-testid={`text-payment-${index}`}>
                          <Badge
                            variant={getStatusBadgeVariant(status)}
                            className="flex items-center justify-center whitespace-nowrap"
                            data-testid={`badge-status-${index}`}
                          >
                            {getStatusIcon(status)}
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            {/* Add Adjustment */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedPayroll(record.payroll);
                                setAdjustmentDialogOpen(true);
                              }}
                              disabled={!record.payroll}
                              data-testid={`button-add-adjustment-${index}`}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>

                            {/* View Adjustments */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedPayroll(record.payroll);
                                setViewAdjustmentsDialogOpen(true);
                              }}
                              disabled={!record.payroll}
                              data-testid={`button-view-adjustments-${index}`}
                            >
                              <Edit className="w-3 h-3" />
                            </Button>

                            {/* Update Status */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedPayroll(record.payroll);
                                setStatusDialogOpen(true);
                              }}
                              disabled={!record.payroll}
                              data-testid={`button-update-status-${index}`}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Adjustment Dialog */}
      <Dialog open={adjustmentDialogOpen} onOpenChange={setAdjustmentDialogOpen}>
        <DialogContent data-testid="dialog-add-adjustment">
          <DialogHeader>
            <DialogTitle>Add Salary Adjustment</DialogTitle>
            <DialogDescription>
              Add a manual adjustment to the salary (bonus, penalty, loan deduction, etc.)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="adjustment-type">Adjustment Type</Label>
              <Select
                value={adjustmentForm.type}
                onValueChange={(value) => setAdjustmentForm({ ...adjustmentForm, type: value })}
              >
                <SelectTrigger id="adjustment-type" data-testid="select-adjustment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {adjustmentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjustment-amount">Amount</Label>
              <Input
                id="adjustment-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter amount"
                value={adjustmentForm.amount}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })}
                data-testid="input-adjustment-amount"
              />
              <p className="text-xs text-muted-foreground">
                {adjustmentForm.type === "bonus" || adjustmentForm.type === "other"
                  ? "Enter positive amount (will be added to salary)"
                  : "Enter positive amount (will be deducted from salary automatically)"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjustment-reason">Reason</Label>
              <Textarea
                id="adjustment-reason"
                placeholder="Provide a reason for this adjustment"
                value={adjustmentForm.reason}
                onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                data-testid="textarea-adjustment-reason"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAdjustmentDialogOpen(false);
                setAdjustmentForm({ type: "bonus", amount: "", reason: "" });
              }}
              data-testid="button-cancel-adjustment"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddAdjustment}
              disabled={addAdjustmentMutation.isPending}
              data-testid="button-save-adjustment"
            >
              {addAdjustmentMutation.isPending ? "Adding..." : "Add Adjustment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Adjustments Dialog */}
      <Dialog open={viewAdjustmentsDialogOpen} onOpenChange={setViewAdjustmentsDialogOpen}>
        <DialogContent className="max-w-3xl" data-testid="dialog-view-adjustments">
          <DialogHeader>
            <DialogTitle>Salary Adjustments</DialogTitle>
            <DialogDescription>
              All manual adjustments applied to this salary record
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {!adjustments || adjustments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No adjustments have been added yet
              </div>
            ) : (
              <div className="space-y-2">
                {adjustments.map((adj, index) => (
                  <div
                    key={adj.id}
                    className="flex items-center justify-between p-4 border rounded-md"
                    data-testid={`adjustment-item-${index}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" data-testid={`badge-adjustment-type-${index}`}>
                          {adj.type.replace("_", " ").toUpperCase()}
                        </Badge>
                        <span className="font-bold" data-testid={`text-adjustment-amount-${index}`}>
                          {parseFloat(adj.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} BDT
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground" data-testid={`text-adjustment-reason-${index}`}>
                        {adj.reason}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Added by {adj.creator?.fullName} on {new Date(adj.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (selectedPayroll) {
                          deleteAdjustmentMutation.mutate({
                            payrollId: selectedPayroll.id,
                            adjustmentId: adj.id
                          });
                        }
                      }}
                      disabled={deleteAdjustmentMutation.isPending}
                      data-testid={`button-delete-adjustment-${index}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setViewAdjustmentsDialogOpen(false)}
              data-testid="button-close-adjustments"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent data-testid="dialog-update-status">
          <DialogHeader>
            <DialogTitle>Update Payment Status</DialogTitle>
            <DialogDescription>
              Change the payment status for this salary record
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">
              Current Status: <Badge variant={getStatusBadgeVariant(selectedPayroll?.status || "draft")}>
                {selectedPayroll?.status || "draft"}
              </Badge>
            </p>

            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedPayroll?.status === "draft" ? "default" : "outline"}
                onClick={() => handleUpdateStatus("draft")}
                disabled={updateStatusMutation.isPending || selectedPayroll?.status === "draft"}
                data-testid="button-status-draft"
              >
                <Edit className="w-4 h-4 mr-2" />
                Draft
              </Button>
              <Button
                variant={selectedPayroll?.status === "generated" ? "default" : "outline"}
                onClick={() => handleUpdateStatus("generated")}
                disabled={updateStatusMutation.isPending || selectedPayroll?.status === "generated"}
                data-testid="button-status-generated"
              >
                <Clock className="w-4 h-4 mr-2" />
                Generated
              </Button>
              <Button
                variant={selectedPayroll?.status === "paid" ? "default" : "outline"}
                onClick={() => handleUpdateStatus("paid")}
                disabled={updateStatusMutation.isPending || selectedPayroll?.status === "paid"}
                data-testid="button-status-paid"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Paid
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStatusDialogOpen(false)}
              data-testid="button-close-status"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

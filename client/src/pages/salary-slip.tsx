import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { FileText, FileSpreadsheet, FileType, Calendar, User } from "lucide-react";
import { formatCurrency } from "@shared/currency";

type Employee = {
  id: string;
  employeeId: string;
  userId: string;
  departmentId: string | null;
  designationId: string | null;
  user: {
    id: string;
    fullName: string;
  };
  department: {
    id: string;
    name: string;
  } | null;
  designation: {
    id: string;
    title: string;
  } | null;
};

type SalarySlipData = {
  employee: Employee;
  payroll: {
    id: string;
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
    paidAt: string | null;
  };
  salaryStructure: {
    basicSalary: string;
    houseAllowance: string;
    foodAllowance: string;
    travelAllowance: string;
    medicalAllowance: string;
    otherAllowances: string;
  } | null;
};

export default function SalarySlip() {
  const { toast } = useToast();
  const currentDate = new Date();
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  // Fetch all employees
  const { data: employees = [], isLoading: isLoadingEmployees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"]
  });

  // Fetch salary slip data
  const { data: salarySlip, isLoading: isLoadingSlip } = useQuery<SalarySlipData>({
    queryKey: ["/api/salary-slip", selectedEmployee, selectedMonth, selectedYear],
    enabled: !!selectedEmployee && !!selectedMonth && !!selectedYear
  });

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handleExport = async (format: 'pdf' | 'excel' | 'word') => {
    if (!selectedEmployee || !selectedMonth || !selectedYear) {
      toast({
        title: "Missing Information",
        description: "Please select employee and period first",
        variant: "destructive"
      });
      return;
    }

    try {
      const endpoint = `/api/salary-slip/export-${format}?employeeId=${selectedEmployee}&month=${selectedMonth}&year=${selectedYear}`;
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      });

      if (response.status === 403) {
        toast({
          title: "Access Denied",
          description: "You don't have permission to export salary slips",
          variant: "destructive"
        });
        return;
      }

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Salary-Slip-${salarySlip?.employee.employeeId}-${selectedMonth}-${selectedYear}.${format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: `Salary slip exported as ${format.toUpperCase()}`
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: "Failed to export salary slip",
        variant: "destructive"
      });
    }
  };

  const calculateTotalEarnings = () => {
    if (!salarySlip) return "0";
    const basic = parseFloat(salarySlip.payroll.basicSalary || "0");
    const allowances = parseFloat(salarySlip.payroll.totalAllowances || "0");
    const overtime = parseFloat(salarySlip.payroll.overtimeAmount || "0");
    return (basic + allowances + overtime).toFixed(2);
  };

  const calculateTotalDeductions = () => {
    if (!salarySlip) return "0";
    const loan = parseFloat(salarySlip.payroll.loanDeduction || "0");
    const late = parseFloat(salarySlip.payroll.lateDeduction || "0");
    const other = parseFloat(salarySlip.payroll.otherDeductions || "0");
    return (loan + late + other).toFixed(2);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">Salary Slip</h1>
          <p className="text-muted-foreground" data-testid="page-description">
            Generate and download individual employee salary slips
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card data-testid="card-filters">
        <CardHeader>
          <CardTitle data-testid="card-title-filters">Select Employee & Period</CardTitle>
          <CardDescription data-testid="card-description-filters">
            Choose employee and salary period to generate slip
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Employee Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium" data-testid="label-employee">
                <User className="inline w-4 h-4 mr-1" />
                Employee
              </label>
              <Select
                value={selectedEmployee}
                onValueChange={setSelectedEmployee}
                disabled={isLoadingEmployees}
              >
                <SelectTrigger data-testid="select-employee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} data-testid={`option-employee-${emp.id}`}>
                      {emp.user?.fullName} ({emp.employeeId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Month Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium" data-testid="label-month">
                <Calendar className="inline w-4 h-4 mr-1" />
                Month
              </label>
              <Select
                value={selectedMonth.toString()}
                onValueChange={(val) => setSelectedMonth(parseInt(val))}
              >
                <SelectTrigger data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((month, index) => (
                    <SelectItem key={index + 1} value={(index + 1).toString()} data-testid={`option-month-${index + 1}`}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Year Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium" data-testid="label-year">
                Year
              </label>
              <Select
                value={selectedYear.toString()}
                onValueChange={(val) => setSelectedYear(parseInt(val))}
              >
                <SelectTrigger data-testid="select-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - i).map((year) => (
                    <SelectItem key={year} value={year.toString()} data-testid={`option-year-${year}`}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Salary Slip Display */}
      {isLoadingSlip && selectedEmployee && (
        <Card data-testid="card-loading">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground" data-testid="text-loading">Loading salary slip...</p>
          </CardContent>
        </Card>
      )}

      {!isLoadingSlip && selectedEmployee && !salarySlip && (
        <Card data-testid="card-no-data">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground" data-testid="text-no-data">
              No salary record found for this employee in {monthNames[selectedMonth - 1]} {selectedYear}
            </p>
          </CardContent>
        </Card>
      )}

      {salarySlip && (
        <>
          {/* Export Buttons */}
          <div className="flex gap-2 flex-wrap" data-testid="container-export-buttons">
            <Button
              onClick={() => handleExport('pdf')}
              variant="outline"
              data-testid="button-export-pdf"
            >
              <FileText className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button
              onClick={() => handleExport('excel')}
              variant="outline"
              data-testid="button-export-excel"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Download Excel
            </Button>
            <Button
              onClick={() => handleExport('word')}
              variant="outline"
              data-testid="button-export-word"
            >
              <FileType className="w-4 h-4 mr-2" />
              Download Word
            </Button>
          </div>

          {/* Salary Slip Content */}
          <Card data-testid="card-salary-slip">
            <CardHeader className="bg-primary text-primary-foreground">
              <div className="text-center">
                <CardTitle className="text-2xl mb-2" data-testid="text-company-name">MaxTech BD</CardTitle>
                <CardDescription className="text-primary-foreground/90" data-testid="text-company-address">
                  522, SK Mujib Road (4th Floor), Agrabad, Double Mooring, Chattogram, Bangladesh
                </CardDescription>
                <p className="text-sm text-primary-foreground/90 mt-1" data-testid="text-company-contact">
                  Phone: +8801843180008 | Email: info@maxtechbd.com
                </p>
                <h2 className="text-xl font-bold mt-4" data-testid="text-slip-title">SALARY SLIP</h2>
                <p className="text-sm" data-testid="text-slip-period">
                  {monthNames[salarySlip.payroll.month - 1]} {salarySlip.payroll.year}
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              {/* Employee Information */}
              <div className="border-b pb-4" data-testid="section-employee-info">
                <h3 className="font-semibold mb-3" data-testid="text-section-title-employee">Employee Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground" data-testid="label-employee-name">Employee Name</p>
                    <p className="font-medium" data-testid="text-employee-name">{salarySlip.employee.user?.fullName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground" data-testid="label-employee-id">Employee ID</p>
                    <p className="font-medium" data-testid="text-employee-id">{salarySlip.employee.employeeId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground" data-testid="label-department">Department</p>
                    <p className="font-medium" data-testid="text-department">
                      {salarySlip.employee.department?.name || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground" data-testid="label-designation">Designation</p>
                    <p className="font-medium" data-testid="text-designation">
                      {salarySlip.employee.designation?.title || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground" data-testid="label-working-days">Working Days</p>
                    <p className="font-medium" data-testid="text-working-days">{salarySlip.payroll.workingDays} days</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground" data-testid="label-payment-status">Payment Status</p>
                    <p className="font-medium capitalize" data-testid="text-payment-status">{salarySlip.payroll.status}</p>
                  </div>
                </div>
              </div>

              {/* Earnings & Deductions Side by Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Earnings */}
                <div className="border rounded-md p-4" data-testid="section-earnings">
                  <h3 className="font-semibold mb-3 text-green-600 dark:text-green-400" data-testid="text-section-title-earnings">
                    Earnings
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm" data-testid="label-basic-salary">Basic Salary</span>
                      <span className="font-medium" data-testid="text-basic-salary">
                        {formatCurrency(salarySlip.payroll.basicSalary || "0")}
                      </span>
                    </div>
                    {salarySlip.salaryStructure && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-sm" data-testid="label-house-allowance">House Allowance</span>
                          <span className="font-medium" data-testid="text-house-allowance">
                            {formatCurrency(salarySlip.salaryStructure.houseAllowance || "0")}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm" data-testid="label-food-allowance">Food Allowance</span>
                          <span className="font-medium" data-testid="text-food-allowance">
                            {formatCurrency(salarySlip.salaryStructure.foodAllowance || "0")}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm" data-testid="label-travel-allowance">Travel Allowance</span>
                          <span className="font-medium" data-testid="text-travel-allowance">
                            {formatCurrency(salarySlip.salaryStructure.travelAllowance || "0")}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm" data-testid="label-medical-allowance">Medical Allowance</span>
                          <span className="font-medium" data-testid="text-medical-allowance">
                            {formatCurrency(salarySlip.salaryStructure.medicalAllowance || "0")}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm" data-testid="label-other-allowances">Other Allowances</span>
                          <span className="font-medium" data-testid="text-other-allowances">
                            {formatCurrency(salarySlip.salaryStructure.otherAllowances || "0")}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm" data-testid="label-overtime">Overtime Pay</span>
                      <span className="font-medium" data-testid="text-overtime">
                        {formatCurrency(salarySlip.payroll.overtimeAmount || "0")}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="font-semibold" data-testid="label-total-earnings">Total Earnings</span>
                      <span className="font-bold text-green-600 dark:text-green-400" data-testid="text-total-earnings">
                        {formatCurrency(calculateTotalEarnings())}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="border rounded-md p-4" data-testid="section-deductions">
                  <h3 className="font-semibold mb-3 text-red-600 dark:text-red-400" data-testid="text-section-title-deductions">
                    Deductions
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm" data-testid="label-loan-deduction">Loan Deduction</span>
                      <span className="font-medium" data-testid="text-loan-deduction">
                        {formatCurrency(salarySlip.payroll.loanDeduction || "0")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm" data-testid="label-late-deduction">Late Deduction ({salarySlip.payroll.totalLateDays} days)</span>
                      <span className="font-medium" data-testid="text-late-deduction">
                        {formatCurrency(salarySlip.payroll.lateDeduction || "0")}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm" data-testid="label-other-deductions">Other Deductions</span>
                      <span className="font-medium" data-testid="text-other-deductions">
                        {formatCurrency(salarySlip.payroll.otherDeductions || "0")}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t">
                      <span className="font-semibold" data-testid="label-total-deductions">Total Deductions</span>
                      <span className="font-bold text-red-600 dark:text-red-400" data-testid="text-total-deductions">
                        {formatCurrency(calculateTotalDeductions())}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attendance Summary */}
              <div className="border rounded-md p-4 bg-muted/50" data-testid="section-attendance">
                <h3 className="font-semibold mb-3" data-testid="text-section-title-attendance">Attendance Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground" data-testid="label-present-days">Present Days</p>
                    <p className="text-lg font-bold text-green-600" data-testid="text-present-days">
                      {salarySlip.payroll.totalPresentDays}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground" data-testid="label-absent-days">Absent Days</p>
                    <p className="text-lg font-bold text-red-600" data-testid="text-absent-days">
                      {salarySlip.payroll.totalAbsentDays}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground" data-testid="label-late-days">Late Days</p>
                    <p className="text-lg font-bold text-orange-600" data-testid="text-late-days">
                      {salarySlip.payroll.totalLateDays}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground" data-testid="label-overtime-hours">Overtime Hours</p>
                    <p className="text-lg font-bold text-blue-600" data-testid="text-overtime-hours">
                      {salarySlip.payroll.totalOvertimeHours}
                    </p>
                  </div>
                </div>
              </div>

              {/* Net Salary */}
              <div className="border-2 border-primary rounded-md p-4 bg-primary/5" data-testid="section-net-salary">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold" data-testid="label-net-salary">Net Salary</span>
                  <span className="text-2xl font-bold text-primary" data-testid="text-net-salary">
                    {formatCurrency(salarySlip.payroll.netSalary || "0")}
                  </span>
                </div>
              </div>

              {/* Signature Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t" data-testid="section-signatures">
                <div className="text-center">
                  <div className="border-t border-foreground/20 pt-2 mt-16 inline-block min-w-48">
                    <p className="text-sm font-medium" data-testid="text-employee-signature">Employee Signature</p>
                  </div>
                </div>
                <div className="text-center">
                  <div className="border-t border-foreground/20 pt-2 mt-16 inline-block min-w-48">
                    <p className="text-sm font-medium" data-testid="text-authorized-signature">Authorized Signature</p>
                  </div>
                </div>
              </div>

              {/* Footer Note */}
              <div className="text-center text-xs text-muted-foreground pt-4 border-t" data-testid="text-footer-note">
                <p>This is a computer-generated salary slip and does not require a physical signature.</p>
                <p className="mt-1">For any queries, please contact HR Department at info@maxtechbd.com</p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

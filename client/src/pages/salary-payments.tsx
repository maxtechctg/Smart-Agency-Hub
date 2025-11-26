import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Wallet, Users, TrendingDown } from "lucide-react";
import { format } from "date-fns";

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
  status: string;
  paidAt?: string;
  createdAt: string;
};

type Employee = {
  id: string;
  userId: string;
  employeeId: string;
};

type User = {
  id: string;
  fullName: string;
};

export default function SalaryPayments() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "pending">("all");
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());

  const { data: payrolls, isLoading: payrollsLoading } = useQuery<Payroll[]>({
    queryKey: ["/api/payroll"],
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/team"],
  });

  const getEmployeeName = (employeeId: string) => {
    const employee = employees?.find(e => e.id === employeeId);
    if (!employee) return "Unknown";
    const user = users?.find(u => u.id === employee.userId);
    return user?.fullName || "Unknown";
  };

  const filteredPayrolls = payrolls?.filter(payroll => {
    const employeeName = getEmployeeName(payroll.employeeId);
    const matchesSearch = employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         `${payroll.month}/${payroll.year}`.includes(searchQuery);
    const matchesStatus = filterStatus === "all" || payroll.status === filterStatus;
    const matchesYear = selectedYear === "all" || payroll.year.toString() === selectedYear;
    return matchesSearch && matchesStatus && matchesYear;
  }) || [];

  const sortedPayrolls = [...filteredPayrolls].sort((a, b) => {
    const dateA = new Date(a.year, a.month - 1);
    const dateB = new Date(b.year, b.month - 1);
    return dateB.getTime() - dateA.getTime();
  });

  const totalPaidSalaries = filteredPayrolls
    .filter(p => p.status === "paid")
    .reduce((sum, p) => sum + Number(p.netSalary), 0);

  const totalPendingSalaries = filteredPayrolls
    .filter(p => p.status === "pending" || p.status === "draft")
    .reduce((sum, p) => sum + Number(p.netSalary), 0);

  const totalPayments = filteredPayrolls.filter(p => p.status === "paid").length;

  const years = [currentYear, currentYear - 1, currentYear - 2];
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-salary-payments">Salary Payments</h1>
        <p className="text-muted-foreground" data-testid="text-subtitle">Track employee salary payments and payroll expenses</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-total-paid">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <Wallet className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-total-paid">
              {totalPaidSalaries.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">{totalPayments} payments</p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-pending">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600" data-testid="text-total-pending">
              {totalPendingSalaries.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredPayrolls.filter(p => p.status === "pending" || p.status === "draft").length} pending
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-employees">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-employees">
              {employees?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Active employees</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4">
        <Input
          placeholder="Search by employee or period..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
          data-testid="input-search"
        />
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as typeof filterStatus)}>
          <SelectTrigger className="w-[180px]" data-testid="select-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="option-all">All Statuses</SelectItem>
            <SelectItem value="paid" data-testid="option-paid">Paid Only</SelectItem>
            <SelectItem value="pending" data-testid="option-pending">Pending Only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-[150px]" data-testid="select-year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" data-testid="option-year-all">All Years</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={year.toString()} data-testid={`option-year-${year}`}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card data-testid="card-payments">
        <CardHeader>
          <CardTitle>Salary Payments ({sortedPayrolls.length})</CardTitle>
          <CardDescription>Complete history of salary payments</CardDescription>
        </CardHeader>
        <CardContent>
          {payrollsLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : sortedPayrolls.length > 0 ? (
            <div className="space-y-2">
              {sortedPayrolls.map((payroll) => (
                <div
                  key={payroll.id}
                  className="flex items-center gap-4 p-4 rounded-md bg-card border hover-elevate"
                  data-testid={`payment-${payroll.id}`}
                >
                  <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="font-medium truncate" data-testid={`text-employee-${payroll.id}`}>
                        {getEmployeeName(payroll.employeeId)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {months[payroll.month - 1]} {payroll.year}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Net Salary</div>
                      <div className="font-semibold text-red-600" data-testid={`text-amount-${payroll.id}`}>
                        {Number(payroll.netSalary).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm text-muted-foreground">Status</div>
                        <Badge
                          variant={
                            payroll.status === "paid"
                              ? "default"
                              : payroll.status === "pending"
                              ? "secondary"
                              : "outline"
                          }
                          data-testid={`badge-status-${payroll.id}`}
                        >
                          {payroll.status}
                        </Badge>
                      </div>
                      {payroll.paidAt && (
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">Paid on</div>
                          <div className="text-xs font-medium">
                            {format(new Date(payroll.paidAt), "MMM d, yyyy")}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No salary payments found</div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-summary">
        <CardHeader>
          <CardTitle>Payroll Summary</CardTitle>
          <CardDescription>Overview of all salary payments</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Total Payments Made</span>
              <span className="font-medium" data-testid="text-summary-paid">
                {totalPaidSalaries.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Pending Payments</span>
              <span className="font-medium text-orange-600" data-testid="text-summary-pending">
                {totalPendingSalaries.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">Total Payroll Liability</span>
              <span className="font-bold text-lg" data-testid="text-summary-total">
                {(totalPaidSalaries + totalPendingSalaries).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  DollarSign,
  TrendingUp,
  Calendar,
  Users,
  FileText,
} from "lucide-react";

type SalaryStructure = {
  id: string;
  employeeId: string;
  basicSalary: string;
  houseAllowance: string;
  transportAllowance: string;
  medicalAllowance: string;
  otherAllowances: string;
  effectiveFrom: string;
  createdAt: string;
};

type Payroll = {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  basicSalary: string;
  totalAllowances: string;
  totalDeductions: string;
  netSalary: string;
  status: string;
  paidAt?: string;
  createdAt: string;
};

type Employee = {
  id: string;
  employeeId: string;
  userId: string;
};

const salaryStructureSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  basicSalary: z.coerce.number().min(0, "Basic salary must be 0 or greater"),
  houseAllowance: z.coerce.number().min(0).default(0),
  transportAllowance: z.coerce.number().min(0).default(0),
  medicalAllowance: z.coerce.number().min(0).default(0),
  otherAllowances: z.coerce.number().min(0).default(0),
  effectiveFrom: z.string().min(1, "Effective date is required"),
});

type SalaryStructureFormData = z.infer<typeof salaryStructureSchema>;

export default function Payroll() {
  const { toast } = useToast();
  const [structureCreateOpen, setStructureCreateOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const { data: salaryStructures, isLoading: structuresLoading } = useQuery<SalaryStructure[]>({
    queryKey: ["/api/salary-structure"],
  });

  const { data: payrollRecords, isLoading: payrollLoading } = useQuery<Payroll[]>({
    queryKey: ["/api/payroll", { month: selectedMonth, year: selectedYear }],
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const structureCreateForm = useForm<SalaryStructureFormData>({
    resolver: zodResolver(salaryStructureSchema),
    defaultValues: {
      employeeId: "",
      basicSalary: 0,
      houseAllowance: 0,
      transportAllowance: 0,
      medicalAllowance: 0,
      otherAllowances: 0,
      effectiveFrom: new Date().toISOString().split("T")[0],
    },
  });

  const structureCreateMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/salary-structure", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary-structure"] });
      setStructureCreateOpen(false);
      structureCreateForm.reset();
      toast({ title: "Success", description: "Salary structure created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const generatePayrollMutation = useMutation({
    mutationFn: (data: { month: number; year: number }) =>
      apiRequest("POST", "/api/payroll/generate", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      toast({ title: "Success", description: "Payroll generated successfully for all employees" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onStructureCreateSubmit = (data: SalaryStructureFormData) => {
    // Convert numeric salary fields to strings for backend API
    const payload = {
      ...data,
      basicSalary: String(data.basicSalary),
      houseAllowance: String(data.houseAllowance),
      transportAllowance: String(data.transportAllowance),
      medicalAllowance: String(data.medicalAllowance),
      otherAllowances: String(data.otherAllowances),
    };
    structureCreateMutation.mutate(payload);
  };

  const handleGeneratePayroll = () => {
    if (
      confirm(
        `Generate payroll for ${getMonthName(selectedMonth)} ${selectedYear}?\nThis will create payroll records for all employees with salary structures.`
      )
    ) {
      generatePayrollMutation.mutate({ month: selectedMonth, year: selectedYear });
    }
  };

  // Get employee by ID
  const getEmployee = (empId: string) => {
    return employees?.find((e) => e.id === empId);
  };

  const getMonthName = (month: number) => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    return months[month - 1];
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    approved: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    paid: "bg-green-500/10 text-green-700 dark:text-green-400",
    rejected: "bg-red-500/10 text-red-700 dark:text-red-400",
  };

  const payrollStats = {
    total: payrollRecords?.length || 0,
    pending: payrollRecords?.filter((p) => p.status === "pending").length || 0,
    paid: payrollRecords?.filter((p) => p.status === "paid").length || 0,
    totalAmount:
      payrollRecords?.reduce((sum, p) => sum + parseFloat(p.netSalary || "0"), 0) || 0,
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            Payroll Management
          </h1>
          <p className="text-muted-foreground">
            Manage salary structures, generate payroll, and track payments
          </p>
        </div>

        <Tabs defaultValue="payroll" className="w-full">
          <TabsList>
            <TabsTrigger value="payroll" data-testid="tab-payroll">
              <DollarSign className="w-4 h-4 mr-2" />
              Payroll Records
            </TabsTrigger>
            <TabsTrigger value="structure" data-testid="tab-structure">
              <TrendingUp className="w-4 h-4 mr-2" />
              Salary Structure
            </TabsTrigger>
          </TabsList>

          {/* PAYROLL RECORDS TAB */}
          <TabsContent value="payroll" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Records</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{payrollStats.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending</CardTitle>
                  <Calendar className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{payrollStats.pending}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Paid</CardTitle>
                  <FileText className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{payrollStats.paid}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
                  <DollarSign className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {payrollStats.totalAmount.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle>Payroll for {getMonthName(selectedMonth)} {selectedYear}</CardTitle>
                  <div className="flex gap-2 flex-wrap">
                    <Select
                      value={selectedMonth.toString()}
                      onValueChange={(val) => setSelectedMonth(parseInt(val))}
                    >
                      <SelectTrigger className="w-[140px]" data-testid="select-month">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {months.map((month) => (
                          <SelectItem key={month} value={month.toString()}>
                            {getMonthName(month)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={selectedYear.toString()}
                      onValueChange={(val) => setSelectedYear(parseInt(val))}
                    >
                      <SelectTrigger className="w-[100px]" data-testid="select-year">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {years.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleGeneratePayroll}
                      disabled={generatePayrollMutation.isPending}
                      data-testid="button-generate-payroll"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Generate Payroll
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {payrollLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading payroll...</p>
                ) : payrollRecords && payrollRecords.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No payroll records for this period
                  </p>
                ) : (
                  <div className="space-y-3">
                    {payrollRecords?.map((record) => {
                      const employee = getEmployee(record.employeeId);
                      return (
                        <Card key={record.id} className="hover-elevate">
                          <CardContent className="pt-4">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-2 flex-1">
                                  <div className="font-medium">
                                    {employee?.employeeId || "Unknown Employee"}
                                  </div>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <div className="text-muted-foreground">Basic Salary</div>
                                      <div className="font-medium">{parseFloat(record.basicSalary).toLocaleString()}</div>
                                    </div>
                                    <div>
                                      <div className="text-muted-foreground">Allowances</div>
                                      <div className="font-medium text-green-600">
                                        +{parseFloat(record.totalAllowances).toLocaleString()}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-muted-foreground">Deductions</div>
                                      <div className="font-medium text-red-600">
                                        -{parseFloat(record.totalDeductions).toLocaleString()}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-muted-foreground">Net Salary</div>
                                      <div className="font-bold text-lg">
                                        {parseFloat(record.netSalary).toLocaleString()}
                                      </div>
                                    </div>
                                  </div>
                                  {record.paidAt && (
                                    <div className="text-xs text-muted-foreground">
                                      Paid on {new Date(record.paidAt).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                                <Badge className={statusColors[record.status]}>{record.status}</Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SALARY STRUCTURE TAB */}
          <TabsContent value="structure" className="space-y-4">
            <div className="flex items-center justify-end">
              <Dialog open={structureCreateOpen} onOpenChange={setStructureCreateOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-structure">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Salary Structure
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-create-structure">
                  <DialogHeader>
                    <DialogTitle>Add Salary Structure</DialogTitle>
                  </DialogHeader>
                  <Form {...structureCreateForm}>
                    <form onSubmit={structureCreateForm.handleSubmit(onStructureCreateSubmit)} className="space-y-4">
                      <FormField
                        control={structureCreateForm.control}
                        name="employeeId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Employee*</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-employee">
                                  <SelectValue placeholder="Select employee" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent position="popper">
                                {employees?.map((emp) => (
                                  <SelectItem key={emp.id} value={emp.id}>
                                    {emp.employeeId}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={structureCreateForm.control}
                        name="basicSalary"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Basic Salary*</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                step="0.01"
                                data-testid="input-basic-salary"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={structureCreateForm.control}
                          name="houseAllowance"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>House Allowance</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  step="0.01"
                                  data-testid="input-house-allowance"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={structureCreateForm.control}
                          name="transportAllowance"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Transport Allowance</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  step="0.01"
                                  data-testid="input-transport-allowance"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={structureCreateForm.control}
                          name="medicalAllowance"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Medical Allowance</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  step="0.01"
                                  data-testid="input-medical-allowance"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={structureCreateForm.control}
                          name="otherAllowances"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Other Allowances</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  step="0.01"
                                  data-testid="input-other-allowances"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={structureCreateForm.control}
                        name="effectiveFrom"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Effective From*</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" data-testid="input-effective-from" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setStructureCreateOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={structureCreateMutation.isPending} data-testid="button-submit-structure">
                          {structureCreateMutation.isPending ? "Creating..." : "Create Structure"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {structuresLoading ? (
                <Card className="col-span-full">
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">Loading salary structures...</p>
                  </CardContent>
                </Card>
              ) : salaryStructures && salaryStructures.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">No salary structures configured</p>
                  </CardContent>
                </Card>
              ) : (
                salaryStructures?.map((structure) => {
                  const employee = getEmployee(structure.employeeId);
                  const totalAllowances =
                    parseFloat(structure.houseAllowance || "0") +
                    parseFloat(structure.transportAllowance || "0") +
                    parseFloat(structure.medicalAllowance || "0") +
                    parseFloat(structure.otherAllowances || "0");
                  const grossSalary = parseFloat(structure.basicSalary) + totalAllowances;

                  return (
                    <Card key={structure.id} data-testid={`card-structure-${structure.id}`} className="hover-elevate">
                      <CardHeader>
                        <CardTitle className="text-lg">
                          {employee?.employeeId || "Unknown Employee"}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs">
                          Effective from {new Date(structure.effectiveFrom).toLocaleDateString()}
                        </Badge>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Basic Salary:</span>
                          <span className="font-medium">{parseFloat(structure.basicSalary).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">House:</span>
                          <span>{parseFloat(structure.houseAllowance).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Transport:</span>
                          <span>{parseFloat(structure.transportAllowance).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Medical:</span>
                          <span>{parseFloat(structure.medicalAllowance).toLocaleString()}</span>
                        </div>
                        {parseFloat(structure.otherAllowances) > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Other:</span>
                            <span>{parseFloat(structure.otherAllowances).toLocaleString()}</span>
                          </div>
                        )}
                        <div className="pt-2 border-t">
                          <div className="flex justify-between text-sm font-bold">
                            <span>Gross Salary:</span>
                            <span className="text-lg">{grossSalary.toLocaleString()}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

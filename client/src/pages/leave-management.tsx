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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
} from "lucide-react";

type LeaveType = {
  id: string;
  name: string;
  daysPerYear: number;
  carryForward: string;
  requiresApproval: string;
  isPaid: string;
  createdAt: string;
};

type LeaveRequest = {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: string;
  reason: string;
  status: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
};

type LeaveBalance = {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  totalDays: string;
  usedDays: string;
  remainingDays: string;
  createdAt: string;
};

type Employee = {
  id: string;
  employeeId: string;
  userId: string;
};

const leaveTypeSchema = z.object({
  name: z.string().min(1, "Leave type name is required"),
  daysPerYear: z.coerce.number().min(1, "Days per year must be at least 1"),
  carryForward: z.string().default("no"),
  requiresApproval: z.string().default("yes"),
  isPaid: z.string().default("yes"),
});

const leaveRequestSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  leaveTypeId: z.string().min(1, "Leave type is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  totalDays: z.coerce.number().min(0.5, "Total days must be at least 0.5"),
  reason: z.string().min(1, "Reason is required"),
});

type LeaveTypeFormData = z.infer<typeof leaveTypeSchema>;
type LeaveRequestFormData = z.infer<typeof leaveRequestSchema>;

export default function LeaveManagement() {
  const { toast } = useToast();
  const [typeCreateOpen, setTypeCreateOpen] = useState(false);
  const [requestCreateOpen, setRequestCreateOpen] = useState(false);

  const { data: leaveTypes, isLoading: typesLoading } = useQuery<LeaveType[]>({
    queryKey: ["/api/leave-types"],
  });

  const { data: leaveRequests, isLoading: requestsLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["/api/leave-requests"],
  });

  const { data: leaveBalances, isLoading: balancesLoading } = useQuery<LeaveBalance[]>({
    queryKey: ["/api/leave-balances"],
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const typeCreateForm = useForm<LeaveTypeFormData>({
    resolver: zodResolver(leaveTypeSchema),
    defaultValues: {
      name: "",
      daysPerYear: 10,
      carryForward: "no",
      requiresApproval: "yes",
      isPaid: "yes",
    },
  });

  const requestCreateForm = useForm<LeaveRequestFormData>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      employeeId: "",
      leaveTypeId: "",
      startDate: "",
      endDate: "",
      totalDays: 1,
      reason: "",
    },
  });

  const typeCreateMutation = useMutation({
    mutationFn: async (data: LeaveTypeFormData) => {
      return apiRequest("POST", "/api/leave-types", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-types"] });
      setTypeCreateOpen(false);
      typeCreateForm.reset();
      toast({ title: "Success", description: "Leave type created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const requestCreateMutation = useMutation({
    mutationFn: async (data: LeaveRequestFormData) => {
      return apiRequest("POST", "/api/leave-requests", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-balances"] });
      setRequestCreateOpen(false);
      requestCreateForm.reset();
      toast({ title: "Success", description: "Leave request submitted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const approveRequestMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/leave-requests/${id}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/leave-balances"] });
      toast({ title: "Success", description: "Leave request approved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const rejectRequestMutation = useMutation({
    mutationFn: (data: { id: string; reason: string }) =>
      apiRequest("POST", `/api/leave-requests/${data.id}/reject`, {
        rejectionReason: data.reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });
      toast({ title: "Success", description: "Leave request rejected" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onTypeCreateSubmit = (data: LeaveTypeFormData) => {
    typeCreateMutation.mutate(data);
  };

  const onRequestCreateSubmit = (data: LeaveRequestFormData) => {
    requestCreateMutation.mutate(data);
  };

  const handleApproveRequest = (id: string) => {
    if (confirm("Approve this leave request?")) {
      approveRequestMutation.mutate(id);
    }
  };

  const handleRejectRequest = (id: string) => {
    const reason = prompt("Enter rejection reason:");
    if (reason) {
      rejectRequestMutation.mutate({ id, reason });
    }
  };

  // Get leave type name
  const getLeaveTypeName = (typeId: string) => {
    return leaveTypes?.find((t) => t.id === typeId)?.name || "Unknown";
  };

  // Get employee by ID
  const getEmployee = (empId: string) => {
    return employees?.find((e) => e.id === empId);
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    approved: "bg-green-500/10 text-green-700 dark:text-green-400",
    rejected: "bg-red-500/10 text-red-700 dark:text-red-400",
  };

  const requestStats = {
    total: leaveRequests?.length || 0,
    pending: leaveRequests?.filter((r) => r.status === "pending").length || 0,
    approved: leaveRequests?.filter((r) => r.status === "approved").length || 0,
    rejected: leaveRequests?.filter((r) => r.status === "rejected").length || 0,
  };

  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            Leave Management
          </h1>
          <p className="text-muted-foreground">
            Manage leave types, requests, approvals, and balances
          </p>
        </div>

        <Tabs defaultValue="requests" className="w-full">
          <TabsList>
            <TabsTrigger value="requests" data-testid="tab-requests">
              <FileText className="w-4 h-4 mr-2" />
              Requests ({requestStats.pending})
            </TabsTrigger>
            <TabsTrigger value="balances" data-testid="tab-balances">
              <Calendar className="w-4 h-4 mr-2" />
              Balances
            </TabsTrigger>
            <TabsTrigger value="types" data-testid="tab-types">
              <Clock className="w-4 h-4 mr-2" />
              Leave Types
            </TabsTrigger>
          </TabsList>

          {/* REQUESTS TAB */}
          <TabsContent value="requests" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="grid gap-4 md:grid-cols-4 flex-1">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{requestStats.total}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending</CardTitle>
                    <Clock className="h-4 w-4 text-yellow-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-yellow-600">{requestStats.pending}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Approved</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{requestStats.approved}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Rejected</CardTitle>
                    <XCircle className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{requestStats.rejected}</div>
                  </CardContent>
                </Card>
              </div>
              <Dialog open={requestCreateOpen} onOpenChange={setRequestCreateOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-request">
                    <Plus className="w-4 h-4 mr-2" />
                    New Request
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-create-request">
                  <DialogHeader>
                    <DialogTitle>Submit Leave Request</DialogTitle>
                  </DialogHeader>
                  <Form {...requestCreateForm}>
                    <form onSubmit={requestCreateForm.handleSubmit(onRequestCreateSubmit)} className="space-y-4">
                      <FormField
                        control={requestCreateForm.control}
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
                        control={requestCreateForm.control}
                        name="leaveTypeId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Leave Type*</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-leave-type">
                                  <SelectValue placeholder="Select leave type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent position="popper">
                                {leaveTypes?.map((type) => (
                                  <SelectItem key={type.id} value={type.id}>
                                    {type.name} ({type.daysPerYear} days/year)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={requestCreateForm.control}
                          name="startDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Start Date*</FormLabel>
                              <FormControl>
                                <Input {...field} type="date" data-testid="input-start-date" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={requestCreateForm.control}
                          name="endDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>End Date*</FormLabel>
                              <FormControl>
                                <Input {...field} type="date" data-testid="input-end-date" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={requestCreateForm.control}
                        name="totalDays"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Total Days*</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                step="0.5"
                                data-testid="input-total-days"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={requestCreateForm.control}
                        name="reason"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reason*</FormLabel>
                            <FormControl>
                              <Textarea {...field} placeholder="Reason for leave" data-testid="input-reason" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setRequestCreateOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={requestCreateMutation.isPending} data-testid="button-submit-request">
                          {requestCreateMutation.isPending ? "Submitting..." : "Submit Request"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Leave Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {requestsLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading requests...</p>
                ) : leaveRequests && leaveRequests.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No leave requests found</p>
                ) : (
                  <div className="space-y-3">
                    {leaveRequests?.map((request) => {
                      const employee = getEmployee(request.employeeId);
                      return (
                        <Card key={request.id} className="hover-elevate">
                          <CardContent className="pt-4">
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1 flex-1">
                                  <div className="font-medium">
                                    {employee?.employeeId || "Unknown Employee"} -{" "}
                                    {getLeaveTypeName(request.leaveTypeId)}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {new Date(request.startDate).toLocaleDateString()} to{" "}
                                    {new Date(request.endDate).toLocaleDateString()} ({request.totalDays} days)
                                  </div>
                                  <div className="text-sm">
                                    <span className="text-muted-foreground">Reason: </span>
                                    {request.reason}
                                  </div>
                                  {request.rejectionReason && (
                                    <div className="text-sm text-destructive">
                                      <span className="font-medium">Rejected: </span>
                                      {request.rejectionReason}
                                    </div>
                                  )}
                                  <div className="text-xs text-muted-foreground">
                                    Requested {new Date(request.createdAt).toLocaleString()}
                                  </div>
                                </div>
                                <Badge className={statusColors[request.status]}>{request.status}</Badge>
                              </div>
                              {request.status === "pending" && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleApproveRequest(request.id)}
                                    disabled={approveRequestMutation.isPending}
                                    data-testid={`button-approve-${request.id}`}
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRejectRequest(request.id)}
                                    disabled={rejectRequestMutation.isPending}
                                    data-testid={`button-reject-${request.id}`}
                                  >
                                    <XCircle className="w-4 h-4 mr-1" />
                                    Reject
                                  </Button>
                                </div>
                              )}
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

          {/* BALANCES TAB */}
          <TabsContent value="balances" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Leave Balances ({new Date().getFullYear()})</CardTitle>
              </CardHeader>
              <CardContent>
                {balancesLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading balances...</p>
                ) : leaveBalances && leaveBalances.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No leave balances found</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {leaveBalances?.map((balance) => {
                      const employee = getEmployee(balance.employeeId);
                      const leaveType = leaveTypes?.find((t) => t.id === balance.leaveTypeId);
                      return (
                        <Card key={balance.id} className="hover-elevate">
                          <CardHeader>
                            <CardTitle className="text-lg">
                              {employee?.employeeId || "Unknown"}
                            </CardTitle>
                            <Badge variant="outline">{leaveType?.name || "Unknown Type"}</Badge>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Total:</span>
                              <span className="font-medium">{balance.totalDays} days</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Used:</span>
                              <span className="font-medium text-orange-600">{balance.usedDays} days</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Remaining:</span>
                              <span className="font-medium text-green-600">{balance.remainingDays} days</span>
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

          {/* LEAVE TYPES TAB */}
          <TabsContent value="types" className="space-y-4">
            <div className="flex items-center justify-end">
              <Dialog open={typeCreateOpen} onOpenChange={setTypeCreateOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-type">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Leave Type
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-create-type">
                  <DialogHeader>
                    <DialogTitle>Add Leave Type</DialogTitle>
                  </DialogHeader>
                  <Form {...typeCreateForm}>
                    <form onSubmit={typeCreateForm.handleSubmit(onTypeCreateSubmit)} className="space-y-4">
                      <FormField
                        control={typeCreateForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Leave Type Name*</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Annual Leave" data-testid="input-type-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={typeCreateForm.control}
                        name="daysPerYear"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Days Per Year*</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="number"
                                data-testid="input-days-per-year"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={typeCreateForm.control}
                        name="carryForward"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Carry Forward</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-carry-forward">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent position="popper">
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={typeCreateForm.control}
                        name="requiresApproval"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Requires Approval</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-requires-approval">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent position="popper">
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={typeCreateForm.control}
                        name="isPaid"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Is Paid Leave</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-is-paid">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent position="popper">
                                <SelectItem value="yes">Yes</SelectItem>
                                <SelectItem value="no">No</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setTypeCreateOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={typeCreateMutation.isPending} data-testid="button-submit-type">
                          {typeCreateMutation.isPending ? "Creating..." : "Create Leave Type"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {typesLoading ? (
                <Card className="col-span-full">
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">Loading leave types...</p>
                  </CardContent>
                </Card>
              ) : leaveTypes && leaveTypes.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">No leave types configured</p>
                  </CardContent>
                </Card>
              ) : (
                leaveTypes?.map((type) => (
                  <Card key={type.id} data-testid={`card-type-${type.id}`} className="hover-elevate">
                    <CardHeader>
                      <CardTitle className="text-lg">{type.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Days/Year:</span>
                        <span className="font-medium">{type.daysPerYear}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Carry Forward:</span>
                        <Badge variant={type.carryForward === "yes" ? "default" : "outline"}>
                          {type.carryForward}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Paid:</span>
                        <Badge variant={type.isPaid === "yes" ? "default" : "outline"}>{type.isPaid}</Badge>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Approval Required:</span>
                        <Badge variant={type.requiresApproval === "yes" ? "default" : "outline"}>
                          {type.requiresApproval}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

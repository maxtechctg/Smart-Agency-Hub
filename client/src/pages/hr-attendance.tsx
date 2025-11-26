import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Edit,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Calendar,
  UserPlus,
} from "lucide-react";

type AttendanceDevice = {
  id: string;
  name: string;
  deviceType: string;
  ipAddress: string;
  port?: number;
  apiEndpoint?: string;
  apiKey?: string;
  status: string;
  isActive: boolean;
  lastSyncAt?: string;
  lastSyncError?: string;
  createdAt: string;
};

type DeviceLog = {
  id: string;
  deviceId: string;
  employeeId: string;
  punchTime: string;
  punchType: string;
  synced: boolean;
  syncedAt?: string;
  createdAt: string;
};

type PunchCorrection = {
  id: string;
  attendanceId: string;
  employeeId: string;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason: string;
  status: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
};

const deviceSchema = z.object({
  name: z.string().min(1, "Device name is required"),
  deviceType: z.string().min(1, "Device type is required"),
  ipAddress: z.string().min(1, "IP address is required"),
  port: z.coerce.number().optional(),
  apiEndpoint: z.string().optional(),
  apiKey: z.string().optional(),
  status: z.string().default("active"),
  isActive: z.boolean().default(true),
});

type DeviceFormData = z.infer<typeof deviceSchema>;

const manualAttendanceSchema = z.object({
  userId: z.string().min(1, "Employee is required"),
  date: z.string().min(1, "Date is required"),
  status: z.string().min(1, "Status is required"),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  notes: z.string().optional(),
});

type ManualAttendanceFormData = z.infer<typeof manualAttendanceSchema>;

type Employee = {
  id: string;
  userId: string;
  employeeId: string;
  user: {
    id: string;
    fullName: string;
  };
};

export default function HRAttendance() {
  const { toast } = useToast();
  const [deviceCreateOpen, setDeviceCreateOpen] = useState(false);
  const [deviceEditOpen, setDeviceEditOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<AttendanceDevice | null>(null);

  const { data: devices, isLoading: devicesLoading} = useQuery<AttendanceDevice[]>({
    queryKey: ["/api/attendance-devices"],
  });

  const { data: deviceLogs, isLoading: logsLoading } = useQuery<DeviceLog[]>({
    queryKey: ["/api/device-logs"],
  });

  const { data: punchCorrections, isLoading: correctionsLoading } = useQuery<PunchCorrection[]>({
    queryKey: ["/api/punch-corrections"],
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const deviceCreateForm = useForm<DeviceFormData>({
    resolver: zodResolver(deviceSchema),
    defaultValues: {
      name: "",
      deviceType: "zkteco",
      ipAddress: "",
      port: 4370,
      status: "active",
      isActive: true,
    },
  });

  const deviceEditForm = useForm<DeviceFormData>({
    resolver: zodResolver(deviceSchema),
  });

  const manualAttendanceForm = useForm<ManualAttendanceFormData>({
    resolver: zodResolver(manualAttendanceSchema),
    defaultValues: {
      userId: "",
      date: new Date().toISOString().split("T")[0],
      status: "present",
      checkIn: "",
      checkOut: "",
      notes: "",
    },
  });

  const deviceCreateMutation = useMutation({
    mutationFn: async (data: DeviceFormData) => {
      return apiRequest("POST", "/api/attendance-devices", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance-devices"] });
      setDeviceCreateOpen(false);
      deviceCreateForm.reset();
      toast({ title: "Success", description: "Attendance device created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deviceUpdateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<DeviceFormData> }) =>
      apiRequest("PATCH", `/api/attendance-devices/${data.id}`, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance-devices"] });
      setDeviceEditOpen(false);
      setEditingDevice(null);
      toast({ title: "Success", description: "Device updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deviceDeleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/attendance-devices/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance-devices"] });
      toast({ title: "Success", description: "Device deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deviceSyncMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/attendance-devices/${id}/sync`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance-devices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/device-logs"] });
      toast({ title: "Success", description: "Device synced successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const correctionApproveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/punch-corrections/${id}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/punch-corrections"] });
      toast({ title: "Success", description: "Punch correction approved" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const correctionRejectMutation = useMutation({
    mutationFn: (data: { id: string; reason: string }) =>
      apiRequest("POST", `/api/punch-corrections/${data.id}/reject`, {
        rejectionReason: data.reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/punch-corrections"] });
      toast({ title: "Success", description: "Punch correction rejected" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const manualAttendanceMutation = useMutation({
    mutationFn: async (data: ManualAttendanceFormData) => {
      return apiRequest("POST", "/api/attendance/manual", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      manualAttendanceForm.reset({
        userId: "",
        date: new Date().toISOString().split("T")[0],
        status: "present",
        checkIn: "",
        checkOut: "",
        notes: "",
      });
      toast({ title: "Success", description: "Attendance record added successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onDeviceCreateSubmit = (data: DeviceFormData) => {
    deviceCreateMutation.mutate(data);
  };

  const onManualAttendanceSubmit = (data: ManualAttendanceFormData) => {
    console.log("🔍 FRONTEND - Form data before mutation:", data);
    console.log("🔍 FRONTEND - Status value:", data.status);
    manualAttendanceMutation.mutate(data);
  };

  const onDeviceEditSubmit = (data: DeviceFormData) => {
    if (!editingDevice) return;
    deviceUpdateMutation.mutate({ id: editingDevice.id, updates: data });
  };

  const handleDeviceEdit = (device: AttendanceDevice) => {
    setEditingDevice(device);
    deviceEditForm.reset({
      name: device.name,
      deviceType: device.deviceType,
      ipAddress: device.ipAddress,
      port: device.port,
      apiEndpoint: device.apiEndpoint || "",
      apiKey: device.apiKey || "",
      status: device.status,
      isActive: device.isActive,
    });
    setDeviceEditOpen(true);
  };

  const handleDeviceDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this device?")) {
      deviceDeleteMutation.mutate(id);
    }
  };

  const handleDeviceSync = (id: string) => {
    deviceSyncMutation.mutate(id);
  };

  const handleApproveCorrection = (id: string) => {
    if (confirm("Approve this punch correction?")) {
      correctionApproveMutation.mutate(id);
    }
  };

  const handleRejectCorrection = (id: string) => {
    const reason = prompt("Enter rejection reason:");
    if (reason) {
      correctionRejectMutation.mutate({ id, reason });
    }
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-700 dark:text-green-400",
    inactive: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
    pending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
    approved: "bg-green-500/10 text-green-700 dark:text-green-400",
    rejected: "bg-red-500/10 text-red-700 dark:text-red-400",
  };

  const deviceStats = {
    total: devices?.length || 0,
    active: devices?.filter((d) => d.isActive).length || 0,
    inactive: devices?.filter((d) => !d.isActive).length || 0,
  };

  const correctionStats = {
    pending: punchCorrections?.filter((c) => c.status === "pending").length || 0,
    approved: punchCorrections?.filter((c) => c.status === "approved").length || 0,
    rejected: punchCorrections?.filter((c) => c.status === "rejected").length || 0,
  };

  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            Attendance Management
          </h1>
          <p className="text-muted-foreground">
            Manage biometric devices, punch logs, and attendance corrections
          </p>
        </div>

        <Tabs defaultValue="manual" className="w-full">
          <TabsList>
            <TabsTrigger value="manual" data-testid="tab-manual">
              <UserPlus className="w-4 h-4 mr-2" />
              Manual Entry
            </TabsTrigger>
            <TabsTrigger value="devices" data-testid="tab-devices">
              <Wifi className="w-4 h-4 mr-2" />
              Devices ({deviceStats.total})
            </TabsTrigger>
            <TabsTrigger value="logs" data-testid="tab-logs">
              <Clock className="w-4 h-4 mr-2" />
              Punch Logs
            </TabsTrigger>
            <TabsTrigger value="corrections" data-testid="tab-corrections">
              <AlertCircle className="w-4 h-4 mr-2" />
              Corrections ({correctionStats.pending})
            </TabsTrigger>
          </TabsList>

          {/* MANUAL ENTRY TAB */}
          <TabsContent value="manual" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Add Manual Attendance</CardTitle>
                <CardDescription>
                  Manually add attendance records for employees. This is useful for backfilling data or handling special cases.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...manualAttendanceForm}>
                  <form onSubmit={manualAttendanceForm.handleSubmit(onManualAttendanceSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={manualAttendanceForm.control}
                        name="userId"
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
                                  <SelectItem key={emp.userId} value={emp.userId}>
                                    {emp.user.fullName} ({emp.employeeId})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={manualAttendanceForm.control}
                        name="date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date*</FormLabel>
                            <FormControl>
                              <Input
                                type="date"
                                {...field}
                                data-testid="input-date"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={manualAttendanceForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status*</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-status">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent position="popper">
                              <SelectItem value="present">Present</SelectItem>
                              <SelectItem value="absent">Absent</SelectItem>
                              <SelectItem value="late">Late</SelectItem>
                              <SelectItem value="half-day">Half Day</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={manualAttendanceForm.control}
                        name="checkIn"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Check-in Time (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                type="time"
                                {...field}
                                data-testid="input-checkin"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={manualAttendanceForm.control}
                        name="checkOut"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Check-out Time (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                type="time"
                                {...field}
                                data-testid="input-checkout"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={manualAttendanceForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              placeholder="Add any notes about this attendance record..."
                              data-testid="input-notes"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        disabled={manualAttendanceMutation.isPending}
                        data-testid="button-submit-attendance"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {manualAttendanceMutation.isPending ? "Adding..." : "Add Attendance"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => manualAttendanceForm.reset()}
                        data-testid="button-reset-form"
                      >
                        Reset Form
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DEVICES TAB */}
          <TabsContent value="devices" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="grid gap-4 md:grid-cols-3 flex-1">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
                    <Wifi className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{deviceStats.total}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{deviceStats.active}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Inactive</CardTitle>
                    <WifiOff className="h-4 w-4 text-gray-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-gray-600">{deviceStats.inactive}</div>
                  </CardContent>
                </Card>
              </div>
              <Dialog open={deviceCreateOpen} onOpenChange={setDeviceCreateOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-device">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Device
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-create-device">
                  <DialogHeader>
                    <DialogTitle>Add Attendance Device</DialogTitle>
                  </DialogHeader>
                  <Form {...deviceCreateForm}>
                    <form onSubmit={deviceCreateForm.handleSubmit(onDeviceCreateSubmit)} className="space-y-4">
                      <FormField
                        control={deviceCreateForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Device Name*</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Main Entrance" data-testid="input-device-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={deviceCreateForm.control}
                          name="deviceType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Device Type*</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-device-type">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent position="popper">
                                  <SelectItem value="zkteco">ZKTeco</SelectItem>
                                  <SelectItem value="suprema">Suprema</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={deviceCreateForm.control}
                          name="port"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Port</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  type="number"
                                  placeholder="4370"
                                  data-testid="input-port"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={deviceCreateForm.control}
                        name="ipAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>IP Address*</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="192.168.1.100" data-testid="input-ip-address" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={deviceCreateForm.control}
                        name="apiEndpoint"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>API Endpoint</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="/api/v1" data-testid="input-api-endpoint" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={deviceCreateForm.control}
                        name="apiKey"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>API Key</FormLabel>
                            <FormControl>
                              <Input {...field} type="password" placeholder="Device API key" data-testid="input-api-key" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setDeviceCreateOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={deviceCreateMutation.isPending} data-testid="button-submit-device">
                          {deviceCreateMutation.isPending ? "Creating..." : "Create Device"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {devicesLoading ? (
                <Card className="col-span-full">
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">Loading devices...</p>
                  </CardContent>
                </Card>
              ) : devices && devices.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="pt-6">
                    <p className="text-center text-muted-foreground">No devices configured</p>
                  </CardContent>
                </Card>
              ) : (
                devices?.map((device) => (
                  <Card key={device.id} data-testid={`card-device-${device.id}`} className="hover-elevate">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1 min-w-0">
                          <CardTitle className="text-lg truncate">{device.name}</CardTitle>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {device.deviceType}
                            </Badge>
                            <Badge className={statusColors[device.status]}>
                              {device.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">IP Address:</span>
                          <span className="font-mono">{device.ipAddress}:{device.port || 4370}</span>
                        </div>
                        {device.lastSyncAt && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Last Sync:</span>
                            <span className="text-xs">
                              {new Date(device.lastSyncAt).toLocaleString()}
                            </span>
                          </div>
                        )}
                        {device.lastSyncError && (
                          <div className="text-xs text-destructive line-clamp-2">
                            Error: {device.lastSyncError}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeviceSync(device.id)}
                          disabled={deviceSyncMutation.isPending}
                          data-testid={`button-sync-${device.id}`}
                        >
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Sync
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeviceEdit(device)}
                          data-testid={`button-edit-device-${device.id}`}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeviceDelete(device.id)}
                          data-testid={`button-delete-device-${device.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* LOGS TAB */}
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Recent Punch Logs (Last 200)</CardTitle>
              </CardHeader>
              <CardContent>
                {logsLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading logs...</p>
                ) : deviceLogs && deviceLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No punch logs found</p>
                ) : (
                  <div className="space-y-2">
                    {deviceLogs?.slice(0, 50).map((log) => (
                      <Card key={log.id} className="hover-elevate">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="space-y-1">
                              <div className="font-medium">Employee ID: {log.employeeId}</div>
                              <div className="text-sm text-muted-foreground">
                                {new Date(log.punchTime).toLocaleString()} - {log.punchType}
                              </div>
                            </div>
                            <Badge className={log.synced ? statusColors.approved : statusColors.pending}>
                              {log.synced ? "Synced" : "Pending"}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CORRECTIONS TAB */}
          <TabsContent value="corrections" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending</CardTitle>
                  <AlertCircle className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">{correctionStats.pending}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Approved</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{correctionStats.approved}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Rejected</CardTitle>
                  <XCircle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{correctionStats.rejected}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Punch Correction Requests</CardTitle>
              </CardHeader>
              <CardContent>
                {correctionsLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading corrections...</p>
                ) : punchCorrections && punchCorrections.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No correction requests</p>
                ) : (
                  <div className="space-y-3">
                    {punchCorrections?.map((correction) => (
                      <Card key={correction.id} className="hover-elevate">
                        <CardContent className="pt-4">
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1 flex-1">
                                <div className="font-medium">Employee ID: {correction.employeeId}</div>
                                <div className="text-sm text-muted-foreground">
                                  {correction.requestedCheckIn &&
                                    `Check-in: ${new Date(correction.requestedCheckIn).toLocaleString()}`}
                                  {correction.requestedCheckIn && correction.requestedCheckOut && " | "}
                                  {correction.requestedCheckOut &&
                                    `Check-out: ${new Date(correction.requestedCheckOut).toLocaleString()}`}
                                </div>
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Reason: </span>
                                  {correction.reason}
                                </div>
                                {correction.rejectionReason && (
                                  <div className="text-sm text-destructive">
                                    <span className="font-medium">Rejected: </span>
                                    {correction.rejectionReason}
                                  </div>
                                )}
                              </div>
                              <Badge className={statusColors[correction.status]}>{correction.status}</Badge>
                            </div>
                            {correction.status === "pending" && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleApproveCorrection(correction.id)}
                                  disabled={correctionApproveMutation.isPending}
                                  data-testid={`button-approve-${correction.id}`}
                                >
                                  <CheckCircle2 className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRejectCorrection(correction.id)}
                                  disabled={correctionRejectMutation.isPending}
                                  data-testid={`button-reject-${correction.id}`}
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Device Dialog */}
        <Dialog open={deviceEditOpen} onOpenChange={setDeviceEditOpen}>
          <DialogContent data-testid="dialog-edit-device">
            <DialogHeader>
              <DialogTitle>Edit Attendance Device</DialogTitle>
            </DialogHeader>
            <Form {...deviceEditForm}>
              <form onSubmit={deviceEditForm.handleSubmit(onDeviceEditSubmit)} className="space-y-4">
                <FormField
                  control={deviceEditForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Device Name*</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Main Entrance" data-testid="input-edit-device-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={deviceEditForm.control}
                    name="deviceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Device Type*</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-device-type">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent position="popper">
                            <SelectItem value="zkteco">ZKTeco</SelectItem>
                            <SelectItem value="suprema">Suprema</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={deviceEditForm.control}
                    name="port"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Port</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            placeholder="4370"
                            data-testid="input-edit-port"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={deviceEditForm.control}
                  name="ipAddress"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>IP Address*</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="192.168.1.100" data-testid="input-edit-ip-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDeviceEditOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={deviceUpdateMutation.isPending} data-testid="button-submit-edit-device">
                    {deviceUpdateMutation.isPending ? "Updating..." : "Update Device"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

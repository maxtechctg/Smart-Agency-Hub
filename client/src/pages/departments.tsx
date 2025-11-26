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
  Edit,
  Trash2,
  Search,
  Building2,
  Briefcase,
  Users,
} from "lucide-react";

type Department = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
};

type Designation = {
  id: string;
  title: string;
  departmentId?: string;
  description?: string;
  createdAt: string;
};

const departmentSchema = z.object({
  name: z.string().min(1, "Department name is required"),
  description: z.string().optional(),
});

const designationSchema = z.object({
  title: z.string().min(1, "Designation title is required"),
  departmentId: z.string().optional(),
  description: z.string().optional(),
});

type DepartmentFormData = z.infer<typeof departmentSchema>;
type DesignationFormData = z.infer<typeof designationSchema>;

export default function Departments() {
  const { toast } = useToast();
  const [deptCreateOpen, setDeptCreateOpen] = useState(false);
  const [deptEditOpen, setDeptEditOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deptSearchQuery, setDeptSearchQuery] = useState("");

  const [desigCreateOpen, setDesigCreateOpen] = useState(false);
  const [desigEditOpen, setDesigEditOpen] = useState(false);
  const [editingDesig, setEditingDesig] = useState<Designation | null>(null);
  const [desigSearchQuery, setDesigSearchQuery] = useState("");
  const [desigDeptFilter, setDesigDeptFilter] = useState("all");

  const { data: departments, isLoading: deptLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: designations, isLoading: desigLoading } = useQuery<Designation[]>({
    queryKey: ["/api/designations"],
  });

  const deptCreateForm = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
    defaultValues: { name: "", description: "" },
  });

  const deptEditForm = useForm<DepartmentFormData>({
    resolver: zodResolver(departmentSchema),
  });

  const desigCreateForm = useForm<DesignationFormData>({
    resolver: zodResolver(designationSchema),
    defaultValues: { title: "", description: "", departmentId: "" },
  });

  const desigEditForm = useForm<DesignationFormData>({
    resolver: zodResolver(designationSchema),
  });

  // Department Mutations
  const deptCreateMutation = useMutation({
    mutationFn: async (data: DepartmentFormData) => {
      return apiRequest("POST", "/api/departments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setDeptCreateOpen(false);
      deptCreateForm.reset();
      toast({ title: "Success", description: "Department created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deptUpdateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<DepartmentFormData> }) =>
      apiRequest("PATCH", `/api/departments/${data.id}`, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      setDeptEditOpen(false);
      setEditingDept(null);
      toast({ title: "Success", description: "Department updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deptDeleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/departments/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "Success", description: "Department deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Designation Mutations
  const desigCreateMutation = useMutation({
    mutationFn: async (data: DesignationFormData) => {
      return apiRequest("POST", "/api/designations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/designations"] });
      setDesigCreateOpen(false);
      desigCreateForm.reset();
      toast({ title: "Success", description: "Designation created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const desigUpdateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<DesignationFormData> }) =>
      apiRequest("PATCH", `/api/designations/${data.id}`, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/designations"] });
      setDesigEditOpen(false);
      setEditingDesig(null);
      toast({ title: "Success", description: "Designation updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const desigDeleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/designations/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/designations"] });
      toast({ title: "Success", description: "Designation deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Department Handlers
  const onDeptCreateSubmit = (data: DepartmentFormData) => {
    deptCreateMutation.mutate(data);
  };

  const onDeptEditSubmit = (data: DepartmentFormData) => {
    if (!editingDept) return;
    deptUpdateMutation.mutate({ id: editingDept.id, updates: data });
  };

  const handleDeptEdit = (dept: Department) => {
    setEditingDept(dept);
    deptEditForm.reset({
      name: dept.name,
      description: dept.description || "",
    });
    setDeptEditOpen(true);
  };

  const handleDeptDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this department?")) {
      deptDeleteMutation.mutate(id);
    }
  };

  // Designation Handlers
  const onDesigCreateSubmit = (data: DesignationFormData) => {
    desigCreateMutation.mutate(data);
  };

  const onDesigEditSubmit = (data: DesignationFormData) => {
    if (!editingDesig) return;
    desigUpdateMutation.mutate({ id: editingDesig.id, updates: data });
  };

  const handleDesigEdit = (desig: Designation) => {
    setEditingDesig(desig);
    desigEditForm.reset({
      title: desig.title,
      departmentId: desig.departmentId || "",
      description: desig.description || "",
    });
    setDesigEditOpen(true);
  };

  const handleDesigDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this designation?")) {
      desigDeleteMutation.mutate(id);
    }
  };

  // Get department name
  const getDepartmentName = (deptId?: string) => {
    if (!deptId) return "No Department";
    return departments?.find((d) => d.id === deptId)?.name || "Unknown";
  };

  // Count designations per department
  const getDesignationsCount = (deptId: string) => {
    return designations?.filter((d) => d.departmentId === deptId).length || 0;
  };

  // Filter departments
  const filteredDepartments =
    departments?.filter((dept) =>
      dept.name.toLowerCase().includes(deptSearchQuery.toLowerCase())
    ) || [];

  // Filter designations
  const filteredDesignations =
    designations?.filter((desig) => {
      const matchesSearch = desig.title.toLowerCase().includes(desigSearchQuery.toLowerCase());
      const matchesDept =
        desigDeptFilter === "all" || desig.departmentId === desigDeptFilter;
      return matchesSearch && matchesDept;
    }) || [];

  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            Department & Designation Management
          </h1>
          <p className="text-muted-foreground">
            Organize your workforce with departments and designations
          </p>
        </div>

        <Tabs defaultValue="departments" className="w-full">
          <TabsList>
            <TabsTrigger value="departments" data-testid="tab-departments">
              <Building2 className="w-4 h-4 mr-2" />
              Departments
            </TabsTrigger>
            <TabsTrigger value="designations" data-testid="tab-designations">
              <Briefcase className="w-4 h-4 mr-2" />
              Designations
            </TabsTrigger>
          </TabsList>

          {/* DEPARTMENTS TAB */}
          <TabsContent value="departments" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search departments..."
                    value={deptSearchQuery}
                    onChange={(e) => setDeptSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-dept-search"
                  />
                </div>
              </div>
              <Dialog open={deptCreateOpen} onOpenChange={setDeptCreateOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-dept">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Department
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-create-dept">
                  <DialogHeader>
                    <DialogTitle>Add New Department</DialogTitle>
                  </DialogHeader>
                  <Form {...deptCreateForm}>
                    <form onSubmit={deptCreateForm.handleSubmit(onDeptCreateSubmit)} className="space-y-4">
                      <FormField
                        control={deptCreateForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Department Name*</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Engineering" data-testid="input-dept-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={deptCreateForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Department description"
                                data-testid="input-dept-description"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setDeptCreateOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={deptCreateMutation.isPending} data-testid="button-submit-dept">
                          {deptCreateMutation.isPending ? "Creating..." : "Create Department"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Departments ({filteredDepartments.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {deptLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading departments...</p>
                ) : filteredDepartments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No departments found</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredDepartments.map((dept) => (
                      <Card key={dept.id} data-testid={`card-dept-${dept.id}`} className="hover-elevate">
                        <CardHeader>
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 flex-1 min-w-0">
                              <CardTitle className="text-lg truncate" data-testid={`text-dept-name-${dept.id}`}>
                                {dept.name}
                              </CardTitle>
                              <Badge variant="outline" className="text-xs">
                                <Users className="w-3 h-3 mr-1" />
                                {getDesignationsCount(dept.id)} Designations
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {dept.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{dept.description}</p>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Created {new Date(dept.createdAt).toLocaleDateString()}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeptEdit(dept)}
                              className="flex-1"
                              data-testid={`button-edit-dept-${dept.id}`}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeptDelete(dept.id)}
                              data-testid={`button-delete-dept-${dept.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* DESIGNATIONS TAB */}
          <TabsContent value="designations" className="space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex gap-4 flex-wrap flex-1">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search designations..."
                      value={desigSearchQuery}
                      onChange={(e) => setDesigSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-desig-search"
                    />
                  </div>
                </div>
                <Select value={desigDeptFilter} onValueChange={setDesigDeptFilter}>
                  <SelectTrigger className="w-[200px]" data-testid="select-desig-dept-filter">
                    <SelectValue placeholder="Filter by department" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments?.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Dialog open={desigCreateOpen} onOpenChange={setDesigCreateOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-desig">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Designation
                  </Button>
                </DialogTrigger>
                <DialogContent data-testid="dialog-create-desig">
                  <DialogHeader>
                    <DialogTitle>Add New Designation</DialogTitle>
                  </DialogHeader>
                  <Form {...desigCreateForm}>
                    <form onSubmit={desigCreateForm.handleSubmit(onDesigCreateSubmit)} className="space-y-4">
                      <FormField
                        control={desigCreateForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Designation Title*</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Senior Developer" data-testid="input-desig-title" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={desigCreateForm.control}
                        name="departmentId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Department</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-desig-dept">
                                  <SelectValue placeholder="Select department" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent position="popper">
                                {departments?.map((dept) => (
                                  <SelectItem key={dept.id} value={dept.id}>
                                    {dept.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={desigCreateForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                placeholder="Designation description"
                                data-testid="input-desig-description"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setDesigCreateOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={desigCreateMutation.isPending} data-testid="button-submit-desig">
                          {desigCreateMutation.isPending ? "Creating..." : "Create Designation"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Designations ({filteredDesignations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {desigLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading designations...</p>
                ) : filteredDesignations.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No designations found</p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredDesignations.map((desig) => (
                      <Card key={desig.id} data-testid={`card-desig-${desig.id}`} className="hover-elevate">
                        <CardHeader>
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-1 flex-1 min-w-0">
                              <CardTitle className="text-lg truncate" data-testid={`text-desig-title-${desig.id}`}>
                                {desig.title}
                              </CardTitle>
                              <Badge variant="outline" className="text-xs">
                                <Building2 className="w-3 h-3 mr-1" />
                                {getDepartmentName(desig.departmentId)}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {desig.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{desig.description}</p>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Created {new Date(desig.createdAt).toLocaleDateString()}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDesigEdit(desig)}
                              className="flex-1"
                              data-testid={`button-edit-desig-${desig.id}`}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDesigDelete(desig.id)}
                              data-testid={`button-delete-desig-${desig.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
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

        {/* Edit Department Dialog */}
        <Dialog open={deptEditOpen} onOpenChange={setDeptEditOpen}>
          <DialogContent data-testid="dialog-edit-dept">
            <DialogHeader>
              <DialogTitle>Edit Department</DialogTitle>
            </DialogHeader>
            <Form {...deptEditForm}>
              <form onSubmit={deptEditForm.handleSubmit(onDeptEditSubmit)} className="space-y-4">
                <FormField
                  control={deptEditForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department Name*</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Engineering" data-testid="input-edit-dept-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={deptEditForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Department description"
                          data-testid="input-edit-dept-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDeptEditOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={deptUpdateMutation.isPending} data-testid="button-submit-edit-dept">
                    {deptUpdateMutation.isPending ? "Updating..." : "Update Department"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Edit Designation Dialog */}
        <Dialog open={desigEditOpen} onOpenChange={setDesigEditOpen}>
          <DialogContent data-testid="dialog-edit-desig">
            <DialogHeader>
              <DialogTitle>Edit Designation</DialogTitle>
            </DialogHeader>
            <Form {...desigEditForm}>
              <form onSubmit={desigEditForm.handleSubmit(onDesigEditSubmit)} className="space-y-4">
                <FormField
                  control={desigEditForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designation Title*</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Senior Developer" data-testid="input-edit-desig-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={desigEditForm.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-desig-dept">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent position="popper">
                          {departments?.map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={desigEditForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Designation description"
                          data-testid="input-edit-desig-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDesigEditOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={desigUpdateMutation.isPending} data-testid="button-submit-edit-desig">
                    {desigUpdateMutation.isPending ? "Updating..." : "Update Designation"}
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

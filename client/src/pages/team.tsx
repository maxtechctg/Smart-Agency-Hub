import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { UserPlus, Edit, Trash2, Users, Mail, Shield, Search, Plus } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";


type User = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  clientId?: string;
  createdAt: string;
};

type Client = {
  id: string;
  name: string;
  email: string;
};

const userSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email address"),
  role: z.string().min(1, "Role is required"),
  clientId: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
}).refine(
  (data) => {
    // If role is client, clientId must be provided
    if (data.role === "client") {
      return !!data.clientId;
    }
    return true;
  },
  {
    message: "Client must be selected for client role",
    path: ["clientId"],
  }
);

const updateUserSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email address"),
  role: z.string().min(1, "Role is required"),
  clientId: z.string().optional(),
  password: z.string().optional(),
});

type RoleConfig = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
};

type Resource = {
  id: string;
  name: string;
  paths: string[];
};


type UserFormData = z.infer<typeof userSchema>;
type UpdateUserFormData = z.infer<typeof updateUserSchema>;

const roleColors: Record<string, string> = {
  admin: "bg-red-500/10 text-red-700 dark:text-red-400",
  operational_head: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  developer: "bg-green-500/10 text-green-700 dark:text-green-400",
  client: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

const roleLabels: Record<string, string> = {
  admin: "Admin",
  operational_head: "Operational Head",
  developer: "Developer",
  client: "Client",
};

export default function Team() {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const createForm = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      fullName: "",
      email: "",
      role: "developer",
      password: "",
    },
  });

  const { data: dynamicRoles } = useQuery<RoleConfig[]>({ queryKey: ["/api/roles"] });
  const { data: resources } = useQuery<Resource[]>({ queryKey: ["/api/resources"] });
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const createRoleMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; permissions: string[] }) => {
      return apiRequest("POST", "/api/roles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/roles"] });
      setCreateRoleOpen(false);
      setNewRoleName("");
      setNewRoleDesc("");
      setSelectedPermissions([]);
      toast({ title: "Success", description: "Role created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });

  const handleCreateRole = () => {
    if (!newRoleName) {
      toast({ title: "Error", description: "Role name is required", variant: "destructive" });
      return;
    }
    createRoleMutation.mutate({
      name: newRoleName,
      description: newRoleDesc,
      permissions: selectedPermissions
    });
  };

  const editForm = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserSchema),
  });

  const createMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      return apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setCreateOpen(false);
      createForm.reset();
      toast({ title: "Success", description: "User created successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; updates: Partial<UpdateUserFormData> }) =>
      apiRequest("PATCH", `/api/users/${data.id}`, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditOpen(false);
      setEditingUser(null);
      toast({ title: "Success", description: "User updated successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/users/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Success", description: "User deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const onCreateSubmit = (data: UserFormData) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: UpdateUserFormData) => {
    if (!editingUser) return;
    const updates: Partial<UpdateUserFormData> = {};

    if (data.fullName !== editingUser.fullName) updates.fullName = data.fullName;
    if (data.email !== editingUser.email) updates.email = data.email;
    if (data.role !== editingUser.role) updates.role = data.role;
    if (data.clientId !== editingUser.clientId) updates.clientId = data.clientId;
    if (data.password) updates.password = data.password;

    updateMutation.mutate({ id: editingUser.id, updates });
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    editForm.reset({
      fullName: user.fullName,
      email: user.email,
      role: user.role as any,
      clientId: user.clientId || undefined,
      password: "",
    });
    setEditOpen(true);
  };

  const handleDelete = (user: User) => {
    if (confirm(`Are you sure you want to delete ${user.fullName}? This action cannot be undone.`)) {
      deleteMutation.mutate(user.id);
    }
  };

  const filteredUsers = users?.filter(user => {
    const matchesSearch = user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    return matchesSearch && matchesRole;
  }) || [];

  const roleStats = users?.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="h-full overflow-auto">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Team Management</h1>
            <p className="text-muted-foreground">Manage your team members and their roles</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-user">
                <UserPlus className="w-4 h-4 mr-2" />
                Add Team Member
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-create-user">
              <DialogHeader>
                <DialogTitle>Add New Team Member</DialogTitle>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                  <FormField
                    control={createForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-fullName" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" data-testid="input-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={createForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-role">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent position="popper">
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="operational_head">Operational Head</SelectItem>
                            <SelectItem value="developer">Developer</SelectItem>
                            <SelectItem value="client">Client</SelectItem>
                            {dynamicRoles?.map(role => (
                              <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>
                            ))}
                            <div className="p-2 border-t mt-1">
                              <Button size="sm" variant="secondary" className="w-full text-xs" onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation(); // Prevent select closing
                                setCreateRoleOpen(true);
                              }}>
                                <Plus className="w-3 h-3 mr-1" /> Create New Role
                              </Button>
                            </div>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {createForm.watch("role") === "client" && (
                    <FormField
                      control={createForm.control}
                      name="clientId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-clientId">
                                <SelectValue placeholder="Select client" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent position="popper">
                              {clients?.map((client) => (
                                <SelectItem key={client.id} value={client.id}>
                                  {client.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} data-testid="button-cancel-create">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-create">
                      {createMutation.isPending ? "Creating..." : "Create User"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Create Role Dialog */}
        <Dialog open={createRoleOpen} onOpenChange={setCreateRoleOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Dynamic Role</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Role Name</Label>
                <Input placeholder="e.g. Project Manager" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea placeholder="Describe the role..." value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Permissions (Allowed Routes)</Label>
                <div className="grid grid-cols-2 gap-2 border p-3 rounded-md">
                  {resources?.map(resource => (
                    <div key={resource.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={resource.id}
                        checked={selectedPermissions.includes(resource.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedPermissions([...selectedPermissions, resource.id]);
                          } else {
                            setSelectedPermissions(selectedPermissions.filter(p => p !== resource.id));
                          }
                        }}
                      />
                      <Label htmlFor={resource.id} className="text-sm cursor-pointer">{resource.name}</Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateRoleOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateRole} disabled={createRoleMutation.isPending}>
                  {createRoleMutation.isPending ? "Creating..." : "Create Role"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-users">{users?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Admins</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-admin-count">{roleStats?.admin || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Developers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-developer-count">{roleStats?.developer || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-client-count">{roleStats?.client || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-role-filter">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="operational_head">Operational Head</SelectItem>
                  <SelectItem value="developer">Developer</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              No users found
            </div>
          ) : (
            filteredUsers.map((user) => (
              <Card key={user.id} data-testid={`card-user-${user.id}`} className="hover-elevate">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 flex-1 min-w-0">
                      <CardTitle className="text-lg truncate" data-testid={`text-user-name-${user.id}`}>
                        {user.fullName}
                      </CardTitle>
                      <Badge className={roleColors[user.role]} data-testid={`badge-role-${user.id}`}>
                        {roleLabels[user.role]}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span className="truncate" data-testid={`text-user-email-${user.id}`}>{user.email}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(user)}
                      className="flex-1"
                      data-testid={`button-edit-${user.id}`}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(user)}
                      data-testid={`button-delete-${user.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent data-testid="dialog-edit-user">
            <DialogHeader>
              <DialogTitle>Edit Team Member</DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-fullName" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" data-testid="input-edit-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password (leave blank to keep current)</FormLabel>
                      <FormControl>
                        <Input {...field} type="password" placeholder="Enter new password" data-testid="input-edit-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="role"
                  render={({ field }) => {
                    const getRolePermissionsDisplay = (roleName: string) => {
                      if (roleName === "admin") return ["Full System Access"];
                      if (roleName === "operational_head") return ["Full System Access (Operational)"];
                      if (roleName === "developer") return ["Dashboard", "Tasks", "Projects", "Files", "Users"];
                      if (roleName === "client") return ["Dashboard", "Projects"];

                      const role = dynamicRoles?.find(r => r.name === roleName);
                      if (!role || !role.permissions) return [];

                      return role.permissions.map(p => resources?.find(r => r.id === p)?.name || p);
                    };

                    const selectedRolePermissions = getRolePermissionsDisplay(field.value);

                    return (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-role">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent position="popper">
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="operational_head">Operational Head</SelectItem>
                            <SelectItem value="developer">Developer</SelectItem>
                            <SelectItem value="client">Client</SelectItem>
                            {dynamicRoles?.map(role => (
                              <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {selectedRolePermissions.length > 0 && (
                          <div className="mt-2 p-3 bg-muted/50 rounded-md text-sm border">
                            <span className="font-semibold block mb-1 text-xs uppercase text-muted-foreground">Access Rights:</span>
                            <div className="flex flex-wrap gap-1">
                              {selectedRolePermissions.map((perm, i) => (
                                <Badge key={i} variant="secondary" className="text-xs font-normal">
                                  {perm}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                {editForm.watch("role") === "client" && (
                  <FormField
                    control={editForm.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-clientId">
                              <SelectValue placeholder="Select client" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent position="popper">
                            {clients?.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setEditOpen(false)} data-testid="button-cancel-edit">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit">
                    {updateMutation.isPending ? "Updating..." : "Update User"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div >
  );
}

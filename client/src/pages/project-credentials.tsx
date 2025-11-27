import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Plus, 
  Pencil, 
  Trash2, 
  ExternalLink, 
  Copy, 
  Check, 
  Search, 
  Server, 
  Globe, 
  Database, 
  Key, 
  Play,
  Image as ImageIcon,
  Video,
  Building2,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type ProjectCredentials, type Client, HOSTING_PLATFORMS } from "@shared/schema";

interface EnrichedCredential extends ProjectCredentials {
  clientName: string | null;
  clientEmail: string | null;
  clientCompany: string | null;
}

const formSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  clientId: z.string().optional(),
  hostingPlatform: z.string().optional(),
  liveLink: z.string().url("Invalid URL").optional().or(z.literal("")),
  adminPanelLink: z.string().url("Invalid URL").optional().or(z.literal("")),
  databaseUrl: z.string().optional(),
  serverCredentials: z.string().optional(),
  shortDescription: z.string().optional(),
  additionalNotes: z.string().optional(),
  shortVideoUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  fullVideoUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
});

type FormData = z.infer<typeof formSchema>;

export default function ProjectCredentialsPage() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<EnrichedCredential | null>(null);
  const [deleteCredential, setDeleteCredential] = useState<EnrichedCredential | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      projectName: "",
      clientId: "none",
      hostingPlatform: "",
      liveLink: "",
      adminPanelLink: "",
      databaseUrl: "",
      serverCredentials: "",
      shortDescription: "",
      additionalNotes: "",
      shortVideoUrl: "",
      fullVideoUrl: "",
    },
  });

  const { data: credentials, isLoading } = useQuery<EnrichedCredential[]>({
    queryKey: ["/api/project-credentials"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value && value !== "none") formData.append(key, value);
      });
      if (thumbnailFile) {
        formData.append("thumbnail", thumbnailFile);
      }
      
      const token = localStorage.getItem("token");
      const response = await fetch("/api/project-credentials", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create credential");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-credentials"] });
      toast({ title: "Project credential created successfully" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const formData = new FormData();
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "none") formData.append(key, value);
      });
      if (thumbnailFile) {
        formData.append("thumbnail", thumbnailFile);
      }
      
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/project-credentials/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update credential");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-credentials"] });
      toast({ title: "Project credential updated successfully" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/project-credentials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-credentials"] });
      toast({ title: "Project credential deleted successfully" });
      setDeleteCredential(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    form.reset();
    setEditingCredential(null);
    setIsDialogOpen(false);
    setThumbnailFile(null);
    setThumbnailPreview(null);
  };

  const handleEdit = (credential: EnrichedCredential) => {
    setEditingCredential(credential);
    form.reset({
      projectName: credential.projectName,
      clientId: credential.clientId || "none",
      hostingPlatform: credential.hostingPlatform || "",
      liveLink: credential.liveLink || "",
      adminPanelLink: credential.adminPanelLink || "",
      databaseUrl: credential.databaseUrl || "",
      serverCredentials: credential.serverCredentials || "",
      shortDescription: credential.shortDescription || "",
      additionalNotes: credential.additionalNotes || "",
      shortVideoUrl: credential.shortVideoUrl || "",
      fullVideoUrl: credential.fullVideoUrl || "",
    });
    if (credential.thumbnailUrl) {
      setThumbnailPreview(`/${credential.thumbnailUrl}`);
    }
    setIsDialogOpen(true);
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const onSubmit = (data: FormData) => {
    if (editingCredential) {
      updateMutation.mutate({ id: editingCredential.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredCredentials = credentials?.filter(c => 
    c.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.hostingPlatform?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getHostingBadgeColor = (platform: string | null) => {
    if (!platform) return "secondary";
    const colors: Record<string, string> = {
      "Render": "bg-purple-500/10 text-purple-600 dark:text-purple-400",
      "Replit": "bg-orange-500/10 text-orange-600 dark:text-orange-400",
      "Namecheap": "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      "VPS": "bg-green-500/10 text-green-600 dark:text-green-400",
      "Shared Hosting": "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
      "AWS": "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      "DigitalOcean": "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
      "Vercel": "bg-slate-500/10 text-slate-600 dark:text-slate-400",
      "Netlify": "bg-teal-500/10 text-teal-600 dark:text-teal-400",
      "Heroku": "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    };
    return colors[platform] || "bg-gray-500/10 text-gray-600 dark:text-gray-400";
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Project Credentials</h1>
          <p className="text-muted-foreground">Manage software project credentials, hosting details, and video links</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (!open) resetForm();
          setIsDialogOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-credential">
              <Plus className="h-4 w-4 mr-2" />
              Add Credential
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingCredential ? "Edit Project Credential" : "Add New Project Credential"}</DialogTitle>
              <DialogDescription>
                Store all credentials and links for easy access and sharing with clients.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="projectName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="My Awesome Project" {...field} data-testid="input-project-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-client">
                              <SelectValue placeholder="Select a client" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No Client</SelectItem>
                            {clients?.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name} {client.company ? `(${client.company})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="hostingPlatform"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hosting Platform</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-hosting">
                              <SelectValue placeholder="Select platform" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {HOSTING_PLATFORMS.map((platform) => (
                              <SelectItem key={platform} value={platform}>
                                {platform}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="liveLink"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Live Link</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com" {...field} data-testid="input-live-link" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="adminPanelLink"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Admin Panel Link</FormLabel>
                        <FormControl>
                          <Input placeholder="https://example.com/admin" {...field} data-testid="input-admin-link" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="databaseUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Database URL</FormLabel>
                        <FormControl>
                          <Input placeholder="postgresql://..." {...field} data-testid="input-database-url" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="serverCredentials"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Server Login Credentials</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Username: admin&#10;Password: ****&#10;SSH Key: ..." 
                          className="min-h-[80px]"
                          {...field} 
                          data-testid="input-server-credentials"
                        />
                      </FormControl>
                      <FormDescription>Store SSH, FTP, or hosting panel credentials</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="shortVideoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Short Presentable Video (1-2 min)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://youtube.com/watch?v=..." {...field} data-testid="input-short-video" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fullVideoUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Features Video (Demo)</FormLabel>
                        <FormControl>
                          <Input placeholder="https://youtube.com/watch?v=..." {...field} data-testid="input-full-video" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div>
                  <FormLabel>Project Thumbnail / Logo</FormLabel>
                  <div className="mt-2 flex items-center gap-4">
                    {thumbnailPreview && (
                      <div className="relative">
                        <img 
                          src={thumbnailPreview} 
                          alt="Thumbnail preview" 
                          className="h-20 w-20 object-cover rounded-md border"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground"
                          onClick={() => {
                            setThumbnailFile(null);
                            setThumbnailPreview(null);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailChange}
                      data-testid="input-thumbnail"
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="shortDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Short Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Brief description of the project..." 
                          className="min-h-[60px]"
                          {...field} 
                          data-testid="input-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="additionalNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any other important information..." 
                          className="min-h-[60px]"
                          {...field} 
                          data-testid="input-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={resetForm} data-testid="button-cancel">
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-submit"
                  >
                    {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingCredential ? "Update" : "Create"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects, clients, or platforms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Badge variant="secondary" className="whitespace-nowrap">
          {filteredCredentials?.length || 0} Projects
        </Badge>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !filteredCredentials?.length ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Server className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">No Project Credentials</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm ? "No credentials match your search." : "Add your first project credential to get started."}
            </p>
            {!searchTerm && (
              <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-first">
                <Plus className="h-4 w-4 mr-2" />
                Add Credential
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCredentials.map((credential) => (
            <Card key={credential.id} className="group" data-testid={`card-credential-${credential.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    {credential.thumbnailUrl ? (
                      <img 
                        src={`/${credential.thumbnailUrl}`} 
                        alt={credential.projectName}
                        className="h-10 w-10 rounded-md object-cover border"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate" data-testid={`text-project-name-${credential.id}`}>
                        {credential.projectName}
                      </CardTitle>
                      {credential.clientName && (
                        <CardDescription className="flex items-center gap-1 text-xs">
                          <Building2 className="h-3 w-3" />
                          <span className="truncate">{credential.clientName}</span>
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  {credential.hostingPlatform && (
                    <Badge variant="secondary" className={getHostingBadgeColor(credential.hostingPlatform)}>
                      {credential.hostingPlatform}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {credential.shortDescription && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {credential.shortDescription}
                  </p>
                )}

                <div className="space-y-2">
                  {credential.liveLink && (
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                        <Globe className="h-4 w-4 shrink-0" />
                        <span className="truncate">{credential.liveLink}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => copyToClipboard(credential.liveLink!, `live-${credential.id}`)}
                          data-testid={`button-copy-live-${credential.id}`}
                        >
                          {copiedField === `live-${credential.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => window.open(credential.liveLink!, "_blank")}
                          data-testid={`button-open-live-${credential.id}`}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {credential.adminPanelLink && (
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                        <Key className="h-4 w-4 shrink-0" />
                        <span className="truncate">Admin Panel</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => copyToClipboard(credential.adminPanelLink!, `admin-${credential.id}`)}
                          data-testid={`button-copy-admin-${credential.id}`}
                        >
                          {copiedField === `admin-${credential.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => window.open(credential.adminPanelLink!, "_blank")}
                          data-testid={`button-open-admin-${credential.id}`}
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {credential.databaseUrl && (
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground min-w-0">
                        <Database className="h-4 w-4 shrink-0" />
                        <span className="truncate">Database URL</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => copyToClipboard(credential.databaseUrl!, `db-${credential.id}`)}
                        data-testid={`button-copy-db-${credential.id}`}
                      >
                        {copiedField === `db-${credential.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  )}
                </div>

                {(credential.shortVideoUrl || credential.fullVideoUrl) && (
                  <div className="flex items-center gap-2 pt-2">
                    {credential.shortVideoUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.open(credential.shortVideoUrl!, "_blank")}
                        data-testid={`button-short-video-${credential.id}`}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Short Demo
                      </Button>
                    )}
                    {credential.fullVideoUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => window.open(credential.fullVideoUrl!, "_blank")}
                        data-testid={`button-full-video-${credential.id}`}
                      >
                        <Video className="h-3 w-3 mr-1" />
                        Full Demo
                      </Button>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end gap-1 pt-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(credential)}
                    data-testid={`button-edit-${credential.id}`}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteCredential(credential)}
                    data-testid={`button-delete-${credential.id}`}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteCredential} onOpenChange={() => setDeleteCredential(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project Credential</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteCredential?.projectName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteCredential && deleteMutation.mutate(deleteCredential.id)}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// src/pages/leads.tsx
import { useState, useRef } from "react";
import { Plus, Mail, Phone, Calendar, Search, X, Trash, Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle2, Send, History, Clock, Check, XCircle, Sparkles } from "lucide-react";
import { SmartLeadFinder } from "@/components/smart-lead-finder";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import { insertLeadSchema, type Lead, type LeadEmail, LEAD_SOURCES, LEAD_EMAIL_TEMPLATES } from "@shared/schema";
import { z } from "zod";
import { normalizeLeadData } from "@/lib/normalizeDateInputs";

const EMAIL_TEMPLATE_LABELS: Record<string, string> = {
  service_introduction: "Service Introduction",
  company_profile: "Company Profile",
  pricing_brochure: "Pricing Brochure",
  follow_up_reminder: "Follow-up Reminder",
};

const ALL_SENTINEL = "__ALL__";

// Required fields except notes
const leadFormSchema = insertLeadSchema.merge(
  z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Enter a valid email"),
    phone: z.string().min(1, "Phone is required"),
    status: z.string().min(1, "Status is required"),
    source: z.string().min(1, "Source is required"),
    notes: z.string().optional(),
    followUpDate: z.string().min(1, "Follow-up date is required"),
  }),
);

type LeadFormData = z.infer<typeof leadFormSchema>;

/**
 * Ensure SweetAlert is placed above any other modals/overlays and accepts pointer events.
 * We use a very large z-index (max 32-bit signed int) to be safe.
 */
function applySwalZIndex() {
  try {
    const container = Swal.getContainer ? Swal.getContainer() : null;
    const popup = Swal.getPopup ? Swal.getPopup() : null;
    const backdrop = container?.querySelector(
      ".swal2-backdrop",
    ) as HTMLElement | null;
    // Super-high z-index
    const z = "2147483647";
    if (container) {
      container.style.zIndex = z;
      container.style.pointerEvents = "auto";
      // also ensure full-screen backdrop receives pointer events correctly
      if (backdrop) {
        backdrop.style.zIndex = z;
        backdrop.style.pointerEvents = "auto";
      }
    }
    if (popup) {
      popup.style.zIndex = String(Number(z) + 1);
      popup.style.pointerEvents = "auto";
    }
  } catch (e) {
    // ignore
    // console.warn("applySwalZIndex failed", e);
  }
}

function extractErrorMessage(err: any): string {
  if (!err) return "An unknown error occurred.";
  if (typeof err === "string") return err;
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.response?.data) {
    try {
      if (typeof err.response.data === "string") return err.response.data;
      return JSON.stringify(err.response.data);
    } catch {
      // fallthrough
    }
  }
  if (err?.message) return err.message;
  if (err instanceof Response) {
    try {
      return `Request failed with status ${err.status}`;
    } catch {
      return `Request failed with status ${err.status}`;
    }
  }
  return "Request failed.";
}

export default function Leads() {
  const [open, setOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  
  // Bulk selection states
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [bulkMessageOpen, setBulkMessageOpen] = useState(false);
  const [bulkMessageSubject, setBulkMessageSubject] = useState("");
  const [bulkMessageContent, setBulkMessageContent] = useState("");
  const [isSendingBulk, setIsSendingBulk] = useState(false);

  // Bulk upload states
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: number;
    failed: number;
    errors: { row: number; name: string; error: string }[];
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email states
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedLeadForEmail, setSelectedLeadForEmail] = useState<Lead | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Smart Lead Finder state
  const [smartFinderOpen, setSmartFinderOpen] = useState(false);

  const { toast } = useToast();

  // Email history query
  const { data: emailHistory = [], refetch: refetchEmails } = useQuery<LeadEmail[]>({
    queryKey: ["/api/leads", selectedLeadForEmail?.id, "emails"],
    queryFn: async () => {
      if (!selectedLeadForEmail) return [];
      const res = await apiRequest("GET", `/api/leads/${selectedLeadForEmail.id}/emails`);
      return res as LeadEmail[];
    },
    enabled: !!selectedLeadForEmail,
  });

  const handleSearch = () => {
    setSearchQuery(searchInput);
  };

  // Fetch categories from database
  const { data: categories = [] } = useQuery<{ id: number; name: string; isActive: boolean }[]>({
    queryKey: ["/api/lead-categories"],
  });
  
  const activeCategories = categories.filter(c => c.isActive);

  const queryParams = new URLSearchParams();
  if (searchQuery.trim()) queryParams.append("search", searchQuery);
  if (statusFilter.trim()) queryParams.append("status", statusFilter);
  if (sourceFilter.trim()) queryParams.append("source", sourceFilter);
  if (categoryFilter.trim()) queryParams.append("category", categoryFilter);

  const queryString = queryParams.toString();

  // React Query v5 object signature
  const {
    data: leads = [],
    isLoading,
    refetch,
  } = useQuery<Lead[]>({
    queryKey: ["leads", queryString],
    queryFn: async () => {
      const url = `/api/leads${queryString ? `?${queryString}` : ""}`;
      const res = await apiRequest("GET", url);
      return res as Lead[];
    },
    keepPreviousData: true,
  });

  // Create Lead
  const createMutation = useMutation({
    mutationFn: (data: LeadFormData) => apiRequest("POST", "/api/leads", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Success", description: "Lead created successfully" });
      setOpen(false);
      setEditingLead(null);
      form.reset();
      void refetch();
    },
    onError: (error: any) => {
      const msg = extractErrorMessage(error);
      // if backend returns 400 or message contains duplicate -> show friendly SweetAlert
      if (
        error?.response?.status === 400 ||
        /duplicate|already exists|unique/i.test(msg)
      ) {
        Swal.fire({
          title: "Duplicate lead",
          text: msg || "A lead with the same details already exists.",
          icon: "warning",
          didOpen: applySwalZIndex,
          // safety: repeat inline styles via willOpen too
          willOpen: applySwalZIndex,
        });
      } else {
        Swal.fire({
          title: "Failed to create lead",
          text: msg,
          icon: "error",
          didOpen: applySwalZIndex,
          willOpen: applySwalZIndex,
        });
      }
      console.error("Create lead error:", error);
    },
  });

  // Update Lead
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: LeadFormData }) =>
      apiRequest("PATCH", `/api/leads/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Success", description: "Lead updated successfully" });
      setOpen(false);
      setEditingLead(null);
      form.reset();
      void refetch();
    },
    onError: (error: any) => {
      const msg = extractErrorMessage(error);
      if (
        error?.response?.status === 400 ||
        /duplicate|already exists|unique/i.test(msg)
      ) {
        Swal.fire({
          title: "Duplicate lead",
          text: msg || "A lead with the same details already exists.",
          icon: "warning",
          didOpen: applySwalZIndex,
          willOpen: applySwalZIndex,
        });
      } else {
        Swal.fire({
          title: "Failed to update lead",
          text: msg,
          icon: "error",
          didOpen: applySwalZIndex,
          willOpen: applySwalZIndex,
        });
      }
      console.error("Update lead error:", error);
    },
  });

  // Delete Lead
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/leads/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      Swal.fire({
        title: "Deleted",
        text: "Lead removed successfully",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
        didOpen: applySwalZIndex,
        willOpen: applySwalZIndex,
      });
      void refetch();
    },
    onError: (error: any) => {
      const msg = extractErrorMessage(error);
      Swal.fire({
        title: "Failed to delete",
        text: msg,
        icon: "error",
        didOpen: applySwalZIndex,
        willOpen: applySwalZIndex,
      });
      console.error("Delete lead error:", error);
    },
  });

  // SweetAlert2 delete confirmation
  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: "Delete Lead?",
      text: "This action cannot be undone.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#dc2626",
      didOpen: applySwalZIndex,
      willOpen: applySwalZIndex,
    });

    if (result.isConfirmed) {
      Swal.fire({
        title: "Deleting...",
        allowOutsideClick: false,
        didOpen: () => {
          applySwalZIndex();
          Swal.showLoading();
        },
        willOpen: applySwalZIndex,
      });

      deleteMutation.mutate(id);
    }
  };

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      status: "new",
      source: undefined,
      notes: "",
      followUpDate: "",
    },
  });

  const onSubmit = (data: LeadFormData) => {
    const payload = normalizeLeadData(data);
    if (editingLead) {
      updateMutation.mutate({ id: editingLead.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    form.reset({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      status: lead.status,
      source: lead.source as any,
      notes: lead.notes || "",
      followUpDate: lead.followUpDate
        ? new Date(lead.followUpDate).toISOString().split("T")[0]
        : "",
    });
    setOpen(true);
  };

  // Email functions
  const openEmailDialog = (lead: Lead) => {
    setSelectedLeadForEmail(lead);
    setSelectedTemplate("");
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (!selectedLeadForEmail || !selectedTemplate) return;
    
    setIsSendingEmail(true);
    try {
      const response = await apiRequest("POST", `/api/leads/${selectedLeadForEmail.id}/emails/send`, {
        templateName: selectedTemplate,
      }) as { success: boolean; message: string };
      
      if (response.success) {
        toast({ title: "Success", description: response.message });
        refetchEmails();
        setSelectedTemplate("");
      } else {
        toast({ title: "Error", description: response.message, variant: "destructive" });
      }
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to send email", 
        variant: "destructive" 
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSendWelcomeEmails = async (lead: Lead) => {
    setIsSendingEmail(true);
    try {
      const response = await apiRequest("POST", `/api/leads/${lead.id}/emails/send-welcome`) as { 
        message: string; 
        results: { templateName: string; success: boolean }[] 
      };
      
      toast({ title: "Success", description: response.message });
      
      // If email dialog is open for this lead, refresh
      if (selectedLeadForEmail?.id === lead.id) {
        refetchEmails();
      }
    } catch (error: any) {
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to send welcome emails", 
        variant: "destructive" 
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleAddNew = () => {
    setEditingLead(null);
    form.reset({
      name: "",
      email: "",
      phone: "",
      status: "new",
      source: undefined,
      notes: "",
      followUpDate: "",
    });
    setOpen(true);
  };

  // Bulk upload handlers
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = localStorage.getItem("token");
      const response = await fetch("/api/leads/bulk-upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      setUploadResult({
        success: result.success,
        failed: result.failed,
        errors: result.errors || [],
      });

      if (result.success > 0) {
        queryClient.invalidateQueries({ queryKey: ["leads"] });
        toast({
          title: "Upload Complete",
          description: result.message,
        });
      }
    } catch (error: any) {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const downloadTemplate = () => {
    const csvContent = `name,email,phone,status,source,notes,followUpDate
John Doe,john@example.com,+1234567890,new,Facebook,Sample lead note,2025-01-15
Jane Smith,jane@example.com,+0987654321,contacted,LinkedIn,Another lead,2025-02-20`;
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "leads_template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "new":
        return "bg-blue-200 text-blue-800";
      case "contacted":
        return "bg-yellow-200 text-yellow-800";
      case "qualified":
        return "bg-green-200 text-green-800";
      case "converted":
        return "bg-purple-200 text-purple-800";
      default:
        return "bg-gray-200 text-gray-700";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">Manage your clients</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setSmartFinderOpen(true)} data-testid="button-smart-finder">
            <Sparkles className="w-4 h-4 mr-2" /> Smart Lead Finder
          </Button>
          <Button variant="outline" onClick={() => setBulkUploadOpen(true)} data-testid="button-bulk-upload">
            <Upload className="w-4 h-4 mr-2" /> Bulk Upload
          </Button>
          <Button onClick={handleAddNew} data-testid="button-add-lead">
            <Plus className="w-4 h-4 mr-2" /> Add Lead
          </Button>
        </div>
      </div>

      {/* SEARCH + FILTERS */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Search */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="pl-10"
              />
              {searchInput && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => {
                    setSearchInput("");
                    setSearchQuery("");
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Button onClick={handleSearch}>
              <Search className="w-4 h-4 mr-2" /> Search
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            {/* Status */}
            <Select
              value={statusFilter || ALL_SENTINEL}
              onValueChange={(v) =>
                setStatusFilter(v === ALL_SENTINEL ? "" : v)
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SENTINEL}>All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
              </SelectContent>
            </Select>

            {/* Source */}
            <Select
              value={sourceFilter || ALL_SENTINEL}
              onValueChange={(v) =>
                setSourceFilter(v === ALL_SENTINEL ? "" : v)
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SENTINEL}>All Sources</SelectItem>
                {LEAD_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Category */}
            <Select
              value={categoryFilter || ALL_SENTINEL}
              onValueChange={(v) =>
                setCategoryFilter(v === ALL_SENTINEL ? "" : v)
              }
              data-testid="select-category-filter"
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SENTINEL}>All Categories</SelectItem>
                {activeCategories.map((c) => (
                  <SelectItem key={c.id} value={c.name}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(statusFilter || sourceFilter || searchQuery || categoryFilter) && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchInput("");
                  setSearchQuery("");
                  setStatusFilter("");
                  setSourceFilter("");
                  setCategoryFilter("");
                }}
              >
                Clear All
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* MODAL */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingLead ? "Edit Lead" : "Add New Lead"}
            </DialogTitle>
            <DialogDescription>
              {editingLead
                ? "Update this lead's information"
                : "Create a new lead"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {/* NAME */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} required />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* EMAIL */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input {...field} required />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* PHONE */}
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input {...field} required />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* SOURCE */}
                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source</FormLabel>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {LEAD_SOURCES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* STATUS */}
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="converted">Converted</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* FOLLOW-UP */}
                <FormField
                  control={form.control}
                  name="followUpDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Follow-up Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} required />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* NOTES */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingLead ? "Update Lead" : "Create Lead"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Bulk Selection Bar */}
      {selectedLeadIds.size > 0 && (
        <Card className="mb-4 border-primary">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Badge variant="secondary" data-testid="text-selected-count">
                {selectedLeadIds.size} lead{selectedLeadIds.size !== 1 ? 's' : ''} selected
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedLeadIds(new Set())}
                data-testid="button-clear-selection"
              >
                Clear Selection
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const allIds = new Set(leads.map(l => l.id));
                  setSelectedLeadIds(allIds);
                }}
                data-testid="button-select-all"
              >
                Select All ({leads.length})
              </Button>
            </div>
            <Button
              onClick={() => setBulkMessageOpen(true)}
              data-testid="button-bulk-message"
            >
              <Send className="w-4 h-4 mr-2" />
              Send Bulk Message
            </Button>
          </CardContent>
        </Card>
      )}

      {/* LEADS LIST */}
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => {
            const leadId = lead.id;
            const isSelected = selectedLeadIds.has(leadId);
            
            return (
              <Card
                key={lead.id}
                className={`relative cursor-pointer hover:shadow-lg ${isSelected ? 'ring-2 ring-primary' : ''}`}
                onClick={() => handleEdit(lead)}
                data-testid={`card-lead-${lead.id}`}
              >
                {/* CHECKBOX */}
                <div 
                  className="absolute top-2 left-2 z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      const newSet = new Set(selectedLeadIds);
                      if (checked) {
                        newSet.add(leadId);
                      } else {
                        newSet.delete(leadId);
                      }
                      setSelectedLeadIds(newSet);
                    }}
                    data-testid={`checkbox-lead-${lead.id}`}
                  />
                </div>
                
                {/* ACTION BUTTONS */}
                <div className="absolute top-2 right-2 flex gap-1 z-10">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEmailDialog(lead);
                    }}
                    title="Send Email"
                    data-testid={`button-email-${lead.id}`}
                    className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40"
                  >
                    <Send className="w-4 h-4 text-blue-600" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(lead.id);
                    }}
                    title="Delete Lead"
                    data-testid={`button-delete-${lead.id}`}
                    className="bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40"
                  >
                    <Trash className="w-4 h-4 text-red-600" />
                  </Button>
                </div>

                <CardContent className="p-6 pt-10 space-y-2">
                  <h3 className="font-bold text-lg">{lead.name}</h3>
                  <div className="flex flex-wrap gap-1">
                    <Badge className={statusColor(lead.status)}>
                      {lead.status}
                    </Badge>
                    {lead.category && (
                      <Badge variant="outline" data-testid={`badge-category-${lead.id}`}>
                        {lead.category}
                      </Badge>
                    )}
                  </div>

                  <div className="text-sm space-y-1">
                    <div className="flex gap-2 items-center">
                      <Mail className="w-4 h-4" />
                      {lead.email}
                    </div>

                    <div className="flex gap-2 items-center">
                      <Phone className="w-4 h-4" />
                      {lead.phone}
                    </div>

                    <div className="flex gap-2 items-center">
                      <Calendar className="w-4 h-4" />
                      Follow-up:{" "}
                      {new Date(lead.followUpDate).toLocaleDateString()}
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Source: {lead.source}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Smart Lead Finder Dialog */}
      <SmartLeadFinder open={smartFinderOpen} onOpenChange={setSmartFinderOpen} />

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkUploadOpen} onOpenChange={(open) => {
        setBulkUploadOpen(open);
        if (!open) {
          setUploadResult(null);
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Bulk Upload Leads
            </DialogTitle>
            <DialogDescription>
              Upload a CSV or Excel file to import multiple leads at once.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Template Download */}
            <div className="p-4 bg-muted rounded-md">
              <h4 className="font-medium mb-2">Required Format</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Your file must include these columns: <strong>name</strong>, <strong>email</strong>, phone, status, source, notes, followUpDate
              </p>
              <div className="text-xs text-muted-foreground mb-3 space-y-1">
                <p><strong>Valid statuses:</strong> new, contacted, qualified, converted</p>
                <p><strong>Valid sources:</strong> Facebook, LinkedIn, Fiverr, Upwork, Freelancer.com, People per Hour, Reference, Local Market, Legit</p>
                <p><strong>Date format:</strong> YYYY-MM-DD (e.g., 2025-01-15)</p>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate} data-testid="button-download-template">
                <Download className="w-4 h-4 mr-2" /> Download Template
              </Button>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-medium">Select File</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleBulkUpload}
                disabled={isUploading}
                className="block w-full text-sm text-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-medium
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  cursor-pointer"
                data-testid="input-file-upload"
              />
              <p className="text-xs text-muted-foreground">
                Supported formats: CSV, Excel (.xlsx, .xls)
              </p>
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="flex items-center gap-2 p-4 bg-muted rounded-md">
                <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm">Uploading and processing leads...</span>
              </div>
            )}

            {/* Upload Results */}
            {uploadResult && (
              <div className="space-y-3">
                <div className="flex gap-4">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">{uploadResult.success} successful</span>
                  </div>
                  {uploadResult.failed > 0 && (
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-medium">{uploadResult.failed} failed</span>
                    </div>
                  )}
                </div>

                {/* Error Details */}
                {uploadResult.errors.length > 0 && (
                  <div className="max-h-48 overflow-y-auto border rounded-md">
                    <table className="w-full text-sm">
                      <thead className="bg-muted sticky top-0">
                        <tr>
                          <th className="text-left p-2 font-medium">Row</th>
                          <th className="text-left p-2 font-medium">Name</th>
                          <th className="text-left p-2 font-medium">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadResult.errors.map((err, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2">{err.row}</td>
                            <td className="p-2">{err.name}</td>
                            <td className="p-2 text-red-600">{err.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setBulkUploadOpen(false)} data-testid="button-close-bulk-upload">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={(open) => {
        setEmailDialogOpen(open);
        if (!open) {
          setSelectedLeadForEmail(null);
          setSelectedTemplate("");
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Send Email to Lead
            </DialogTitle>
            {selectedLeadForEmail && (
              <DialogDescription>
                Send marketing or follow-up emails to {selectedLeadForEmail.name} ({selectedLeadForEmail.email})
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4">
            {/* Send Individual Template */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Select Email Template</label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger data-testid="select-email-template">
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_EMAIL_TEMPLATES.map((template) => (
                    <SelectItem key={template} value={template}>
                      {EMAIL_TEMPLATE_LABELS[template] || template}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={handleSendEmail}
                disabled={!selectedTemplate || isSendingEmail}
                className="w-full"
                data-testid="button-send-template-email"
              >
                {isSendingEmail ? (
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 animate-spin" />
                    Sending...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Send Selected Template
                  </span>
                )}
              </Button>
            </div>

            {/* Quick Actions */}
            <div className="border-t pt-4">
              <label className="text-sm font-medium text-muted-foreground">Quick Actions</label>
              <Button
                variant="outline"
                onClick={() => selectedLeadForEmail && handleSendWelcomeEmails(selectedLeadForEmail)}
                disabled={isSendingEmail}
                className="w-full mt-2"
                data-testid="button-send-welcome-emails"
              >
                {isSendingEmail ? (
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 animate-spin" />
                    Sending...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Send All Welcome Emails (3 Templates)
                  </span>
                )}
              </Button>
            </div>

            {/* Email History */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4" />
                <label className="text-sm font-medium">Email History</label>
              </div>
              
              {emailHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No emails sent to this lead yet.
                </p>
              ) : (
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {emailHistory.map((email) => (
                      <div
                        key={email.id}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                        data-testid={`email-history-${email.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {EMAIL_TEMPLATE_LABELS[email.templateName] || email.templateName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {email.sentAt 
                              ? new Date(email.sentAt).toLocaleString() 
                              : new Date(email.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {email.status === "sent" ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <Check className="w-3 h-3 mr-1" />
                              Sent
                            </Badge>
                          ) : email.status === "failed" ? (
                            <Badge variant="outline" className="text-red-600 border-red-600">
                              <XCircle className="w-3 h-3 mr-1" />
                              Failed
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                              <Clock className="w-3 h-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} data-testid="button-close-email-dialog">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Bulk Message Composer Dialog */}
      <Dialog open={bulkMessageOpen} onOpenChange={(open) => {
        setBulkMessageOpen(open);
        if (!open) {
          setBulkMessageSubject("");
          setBulkMessageContent("");
        }
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Send Bulk Message
            </DialogTitle>
            <DialogDescription>
              Send a promotional email to {selectedLeadIds.size} selected lead{selectedLeadIds.size !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Recipients Preview */}
            <div>
              <label className="text-sm font-medium">Recipients</label>
              <div className="mt-2 p-3 bg-muted rounded-md max-h-24 overflow-y-auto">
                <div className="flex flex-wrap gap-1">
                  {Array.from(selectedLeadIds).slice(0, 10).map((id) => {
                    const lead = leads.find(l => l.id === id);
                    return lead ? (
                      <Badge key={id} variant="outline" className="text-xs">
                        {lead.name}
                      </Badge>
                    ) : null;
                  })}
                  {selectedLeadIds.size > 10 && (
                    <Badge variant="secondary" className="text-xs">
                      +{selectedLeadIds.size - 10} more
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            {/* Subject */}
            <div>
              <label className="text-sm font-medium">Subject</label>
              <Input
                value={bulkMessageSubject}
                onChange={(e) => setBulkMessageSubject(e.target.value)}
                placeholder="Enter email subject..."
                className="mt-2"
                data-testid="input-bulk-subject"
              />
            </div>
            
            {/* Message Content */}
            <div>
              <label className="text-sm font-medium">Message</label>
              <Textarea
                value={bulkMessageContent}
                onChange={(e) => setBulkMessageContent(e.target.value)}
                placeholder="Enter your promotional message..."
                className="mt-2 min-h-[200px]"
                data-testid="input-bulk-message"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Use {"{name}"} to personalize the message with the recipient's name.
              </p>
            </div>
            
            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setBulkMessageOpen(false)}
                disabled={isSendingBulk}
                data-testid="button-cancel-bulk"
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  if (!bulkMessageSubject.trim() || !bulkMessageContent.trim()) {
                    toast({
                      title: "Missing Information",
                      description: "Please enter both subject and message content.",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  setIsSendingBulk(true);
                  try {
                    const selectedLeads = leads.filter(l => selectedLeadIds.has(l.id));
                    const leadIds = selectedLeads.map(l => l.id);
                    
                    const response = await apiRequest("POST", "/api/leads/bulk-message", {
                      leadIds,
                      subject: bulkMessageSubject,
                      content: bulkMessageContent,
                    });
                    
                    const result = response as { success: number; failed: number; errors: string[] };
                    
                    if (result.success > 0) {
                      toast({
                        title: "Bulk Message Sent",
                        description: `Successfully sent to ${result.success} recipient${result.success !== 1 ? 's' : ''}${result.failed > 0 ? `. ${result.failed} failed.` : ''}`,
                      });
                      setBulkMessageOpen(false);
                      setSelectedLeadIds(new Set());
                      setBulkMessageSubject("");
                      setBulkMessageContent("");
                    } else {
                      toast({
                        title: "Send Failed",
                        description: result.errors.join(", ") || "Failed to send messages",
                        variant: "destructive",
                      });
                    }
                  } catch (error: any) {
                    toast({
                      title: "Error",
                      description: error.message || "Failed to send bulk message",
                      variant: "destructive",
                    });
                  } finally {
                    setIsSendingBulk(false);
                  }
                }}
                disabled={isSendingBulk || !bulkMessageSubject.trim() || !bulkMessageContent.trim()}
                data-testid="button-send-bulk"
              >
                {isSendingBulk ? (
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 animate-spin" />
                    Sending...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    Send to {selectedLeadIds.size} Lead{selectedLeadIds.size !== 1 ? 's' : ''}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

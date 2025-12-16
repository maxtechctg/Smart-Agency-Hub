import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertEmailTemplateSchema, type EmailTemplate } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
    Card, CardContent, CardHeader, CardTitle, CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash, Mail, Paperclip } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";

export default function EmailTemplates() {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);

    const { data: templates = [], isLoading } = useQuery<EmailTemplate[]>({
        queryKey: ["/api/email-templates"],
    });

    const createMutation = useMutation({
        mutationFn: (data: any) => apiRequest("POST", "/api/email-templates", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
            toast({ title: "Success", description: "Template created" });
            setOpen(false);
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: any) => apiRequest("PATCH", `/api/email-templates/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
            toast({ title: "Success", description: "Template updated" });
            setOpen(false);
            setEditingTemplate(null);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiRequest("DELETE", `/api/email-templates/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
            toast({ title: "Success", description: "Template deleted" });
        }
    });

    const form = useForm({
        resolver: zodResolver(insertEmailTemplateSchema),
        defaultValues: {
            name: "",
            subject: "",
            message: "",
            attachments: []
        }
    });

    const onSubmit = (data: any) => {
        // If message contains pure \n, maybe convert to HTML or keep as text?
        // We already do split('\n') in backend for basic viewing.
        // So raw text is fine.
        if (editingTemplate) {
            updateMutation.mutate({ id: editingTemplate.id, data });
        } else {
            createMutation.mutate(data);
        }
    };

    const handleEdit = (template: EmailTemplate) => {
        setEditingTemplate(template);
        form.reset({
            name: template.name,
            subject: template.subject,
            subject: template.subject,
            message: template.message,
            attachments: (template.attachments as any[]) || []
        });
        setOpen(true);
    };

    const handleAddNew = () => {
        setEditingTemplate(null);
        form.reset({ name: "", subject: "", message: "", attachments: [] });
        setOpen(true);
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">Email Templates</h1>
                    <p className="text-muted-foreground">Manage your custom email templates</p>
                </div>
                <Button onClick={handleAddNew}>
                    <Plus className="w-4 h-4 mr-2" /> New Template
                </Button>
            </div>

            {isLoading ? (
                <p>Loading templates...</p>
            ) : templates.length === 0 ? (
                <div className="text-center py-10 bg-muted/20 rounded-lg">
                    <Mail className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No email templates found.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {templates.map(template => (
                        <Card key={template.id}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg flex justify-between items-center">
                                    <span className="truncate mr-2">{template.name}</span>
                                    <div className="flex gap-2 flex-shrink-0">
                                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(template)}>
                                            <Pencil className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(template.id)}>
                                            <Trash className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardTitle>
                                <CardDescription className="truncate font-medium">{template.subject}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground line-clamp-3 bg-muted p-2 rounded-md font-mono whitespace-pre-wrap">
                                    {template.message}
                                </p>
                                {template.attachments && (template.attachments as any[]).length > 0 && (
                                    <div className="mt-2 flex items-center text-xs text-muted-foreground">
                                        <Paperclip className="w-3 h-3 mr-1" />
                                        {(template.attachments as any[]).length} attachment(s)
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingTemplate ? "Edit Template" : "New Template"}</DialogTitle>
                        <DialogDescription>Create a template to use for lead communications.</DialogDescription>
                    </DialogHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Template Name (Internal)</FormLabel>
                                    <FormControl><Input placeholder="e.g. Welcome Email" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="subject" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Subject</FormLabel>
                                    <FormControl><Input placeholder="Welcome {{lead.name}}!" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="message" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Message Body</FormLabel>
                                    <div className="text-xs text-muted-foreground mb-2 flex flex-wrap gap-2">
                                        <span>Available variables:</span>
                                        <code className="bg-muted px-1 rounded text-primary">{"{{lead.name}}"}</code>
                                        <code className="bg-muted px-1 rounded text-primary">{"{{lead.email}}"}</code>
                                        <code className="bg-muted px-1 rounded text-primary">{"{{lead.phone}}"}</code>
                                        <code className="bg-muted px-1 rounded text-primary">{"{{user.name}}"}</code>
                                    </div>
                                    <FormControl><Textarea className="min-h-[200px] font-mono" placeholder="Hi {{lead.name}}, ..." {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <FormField control={form.control} name="attachments" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Attachments</FormLabel>
                                    <FormControl>
                                        <FileUpload
                                            value={field.value || []}
                                            onChange={field.onChange}
                                            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.mp4"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
                                <Button type="submit">Save Template</Button>
                            </div>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

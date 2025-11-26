// screenshot (uploaded): /mnt/data/9f60c74e-08f2-49de-a525-fffdf9c8129e.png

import { useState } from "react";
import { Plus, Mail, Phone, MessageCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertClientSchema, type Client } from "@shared/schema";
import Swal from "sweetalert2";
import { z } from "zod";

import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";

type ClientFormData = z.infer<typeof insertClientSchema>;

export default function Clients() {
  const [open, setOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const { toast } = useToast();

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const createMutation = useMutation({
    mutationFn: (data: ClientFormData) =>
      apiRequest("POST", "/api/clients", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Success", description: "Client created successfully" });
      setOpen(false);
      setEditingClient(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ClientFormData }) =>
      apiRequest("PATCH", `/api/clients/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Success", description: "Client updated successfully" });
      setOpen(false);
      setEditingClient(null);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Success", description: "Client deleted successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const form = useForm<ClientFormData>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company: "",
      whatsapp: "",
      address: "",
    },
  });

  const onSubmit = async (data: ClientFormData) => {
    // Phone is stored in the form as "+<digits>" (react-phone-input-2 onChange prepends '+')
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);

    // Keep phone value as-is (we store with leading +). PhoneInput expects a value without spaces/plus when showing,
    // but in the field render we'll normalize it.
    form.reset({
      name: client.name,
      email: client.email,
      phone: client.phone || "",
      company: client.company || "",
      whatsapp: client.whatsapp || "",
      address: client.address || "",
    });

    setOpen(true);
  };

  const handleAddNew = () => {
    setEditingClient(null);
    form.reset({
      name: "",
      email: "",
      phone: "",
      company: "",
      whatsapp: "",
      address: "",
    });
    setOpen(true);
  };

  const handleDelete = async (e: React.MouseEvent, client: Client) => {
    e.stopPropagation(); // Prevent card click event
    const result = await Swal.fire({
      title: "Delete Client?",
      text: `Are you sure you want to delete ${client.name}? This action cannot be undone.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Yes, delete it",
      cancelButtonText: "Cancel",
    });
    if (result.isConfirmed) {
      deleteMutation.mutate(client.id);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 bg-muted rounded w-32 mb-6 animate-pulse" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-12 w-12 bg-muted rounded-full mb-3 animate-pulse" />
                <div className="h-6 bg-muted rounded w-3/4 mb-2 animate-pulse" />
                <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            Clients
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your active clients
          </p>
        </div>
        <Button data-testid="button-add-client" onClick={handleAddNew}>
          <Plus className="w-4 h-4 mr-2" /> Add Client
        </Button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingClient ? "Edit Client" : "Add New Client"}
              </DialogTitle>
              <DialogDescription>
                {editingClient
                  ? "Update client information"
                  : "Create a new client profile"}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="John Doe"
                            {...field}
                            data-testid="input-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Acme Inc"
                            {...field}
                            value={field.value ?? ""}
                            data-testid="input-company"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="john@example.com"
                            {...field}
                            data-testid="input-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Phone field replaced with react-phone-input-2 */}
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone</FormLabel>
                        <FormControl>
                          <PhoneInput
                            country={"bd"} // default country
                            value={
                              field.value ? field.value.replace(/\D/g, "") : ""
                            }
                            onChange={(value: string) => {
                              // `value` comes without + and may contain spaces. Store with leading + and no spaces.
                              const digitsOnly = value.replace(/\D/g, "");
                              field.onChange(
                                digitsOnly ? `+${digitsOnly}` : "",
                              );
                            }}
                            inputProps={{
                              name: field.name,
                              required: false,
                              autoFocus: false,
                            }}
                            inputStyle={{
                              width: "100%",
                              height: 42,
                              borderRadius: 6,
                            }}
                            buttonStyle={{
                              borderTopLeftRadius: 6,
                              borderBottomLeftRadius: 6,
                              paddingLeft: 8,
                              paddingRight: 8,
                            }}
                            containerStyle={{
                              width: "100%",
                            }}
                            enableAreaCodes={true}
                            enableSearch={true}
                            disableSearchIcon={false}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground mt-1">
                          Enter full phone number (country + number). Example:
                          +1 5551234567
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="whatsapp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>WhatsApp</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="+1234567890"
                            {...field}
                            value={field.value ?? ""}
                            data-testid="input-whatsapp"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Street address..."
                          {...field}
                          value={field.value ?? ""}
                          data-testid="input-address"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="button-submit-client">
                    {editingClient ? "Update Client" : "Create Client"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {!clients || clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No clients yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start by adding your first client
            </p>
            <Button onClick={() => setOpen(true)}>Add Client</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clients.map((client) => (
            <Card
              key={client.id}
              className="hover-elevate cursor-pointer relative"
              data-testid={`card-client-${client.id}`}
              onClick={() => handleEdit(client)}
            >
              {/* DELETE BUTTON: high z-index and stopPropagation in handler */}
              <div className="absolute top-3 right-3 z-20">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => handleDelete(e, client)}
                  data-testid={`button-delete-${client.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* CONSISTENT PADDING / MARGINS FOR CARD */}
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <Avatar>
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(client.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <h3
                      className="font-semibold text-lg truncate"
                      data-testid={`text-client-name-${client.id}`}
                    >
                      {client.name}
                    </h3>
                    {client.company && (
                      <p className="text-sm text-muted-foreground truncate">
                        {client.company}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{client.email}</span>
                  </div>

                  {client.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      <span>{client.phone}</span>
                    </div>
                  )}

                  {client.whatsapp && (
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 flex-shrink-0 text-green-600" />
                      <a
                        href={`https://wa.me/${client.whatsapp.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-600 hover:underline"
                        data-testid={`link-whatsapp-${client.id}`}
                      >
                        Chat on WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

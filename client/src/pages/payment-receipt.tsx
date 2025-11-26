import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@shared/currency";
import { format } from "date-fns";

interface PaymentReceiptData {
  payment: {
    id: string;
    amount: string;
    paymentDate: string;
    paymentMethod: string;
    notes: string | null;
  };
  invoice: {
    invoiceNumber: string;
    amount: string;
    dueDate: string;
    status: string;
  };
  client: {
    companyName: string;
    email: string;
    phone: string | null;
  };
}

export default function PaymentReceipt() {
  const [selectedPaymentId, setSelectedPaymentId] = useState<string>("");
  const { toast } = useToast();

  // Fetch all payments
  const { data: payments, isLoading: paymentsLoading } = useQuery<any[]>({
    queryKey: ["/api/payments"],
  });

  // Fetch selected payment receipt details
  const { data: receiptData, isLoading: receiptLoading } = useQuery<PaymentReceiptData>({
    queryKey: ["/api/payment-receipt", selectedPaymentId],
    queryFn: async () => {
      if (!selectedPaymentId) {
        throw new Error("Payment ID is required");
      }
      const response = await fetch(`/api/payment-receipt?paymentId=${encodeURIComponent(selectedPaymentId)}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch payment receipt");
      }
      return response.json();
    },
    enabled: !!selectedPaymentId,
  });

  const handleExport = async (format: "pdf" | "excel" | "word") => {
    if (!selectedPaymentId) {
      toast({
        title: "No payment selected",
        description: "Please select a payment to export the receipt",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`/api/payment-receipt/export-${format}?paymentId=${selectedPaymentId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Payment-Receipt-${receiptData?.payment?.id || "receipt"}.${format === "excel" ? "xlsx" : format === "word" ? "docx" : "pdf"}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export successful",
        description: `Payment receipt exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Failed to export payment receipt",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Payment Receipt</h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Generate payment receipts for client transactions
          </p>
        </div>
      </div>

      <Card data-testid="card-payment-selector">
        <CardHeader>
          <CardTitle data-testid="text-selector-title">Select Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={selectedPaymentId}
            onValueChange={setSelectedPaymentId}
            disabled={paymentsLoading}
          >
            <SelectTrigger data-testid="select-payment-trigger">
              <SelectValue placeholder="Select a payment" />
            </SelectTrigger>
            <SelectContent>
              {payments?.map((payment) => (
                <SelectItem
                  key={payment.id}
                  value={payment.id}
                  data-testid={`select-payment-option-${payment.id}`}
                >
                  Payment #{payment.id.substring(0, 8)} - {formatCurrency(payment.amount || "0")} - {format(new Date(payment.paymentDate), "MMM dd, yyyy")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedPaymentId && (
            <div className="flex gap-2">
              <Button
                onClick={() => handleExport("pdf")}
                disabled={receiptLoading}
                data-testid="button-export-pdf"
              >
                <FileText className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
              <Button
                onClick={() => handleExport("excel")}
                disabled={receiptLoading}
                variant="outline"
                data-testid="button-export-excel"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
              <Button
                onClick={() => handleExport("word")}
                disabled={receiptLoading}
                variant="outline"
                data-testid="button-export-word"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Word
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {receiptLoading && (
        <Card data-testid="card-loading">
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground" data-testid="text-loading">Loading payment receipt...</p>
          </CardContent>
        </Card>
      )}

      {receiptData && !receiptLoading && (
        <Card data-testid="card-receipt-display">
          <CardHeader>
            <CardTitle data-testid="text-receipt-title">Payment Receipt</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Company Header */}
            <div className="text-center border-b pb-4" data-testid="section-company-header">
              <h2 className="text-2xl font-bold text-primary" data-testid="text-company-name">MaxTech BD</h2>
              <p className="text-sm text-muted-foreground" data-testid="text-company-address">522 SK Mujib Road, Dhaka, Bangladesh</p>
              <p className="text-sm text-muted-foreground" data-testid="text-company-contact">
                Phone: +8801843180008 | Email: info@maxtechbd.com
              </p>
            </div>

            {/* Receipt Details */}
            <div className="grid grid-cols-2 gap-6" data-testid="section-receipt-details">
              <div className="space-y-2">
                <h3 className="font-semibold text-lg" data-testid="text-payment-info-heading">Payment Information</h3>
                <div className="space-y-1">
                  <p data-testid="text-receipt-number">
                    <span className="font-medium">Receipt #:</span> {receiptData.payment.id.substring(0, 8).toUpperCase()}
                  </p>
                  <p data-testid="text-payment-date">
                    <span className="font-medium">Payment Date:</span> {format(new Date(receiptData.payment.paymentDate), "MMMM dd, yyyy")}
                  </p>
                  <p data-testid="text-payment-method">
                    <span className="font-medium">Payment Method:</span> {receiptData.payment.paymentMethod}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold text-lg" data-testid="text-client-info-heading">Client Information</h3>
                <div className="space-y-1">
                  <p data-testid="text-client-name">
                    <span className="font-medium">Name:</span> {receiptData.client.companyName}
                  </p>
                  <p data-testid="text-client-email">
                    <span className="font-medium">Email:</span> {receiptData.client.email}
                  </p>
                  <p data-testid="text-client-phone">
                    <span className="font-medium">Phone:</span> {receiptData.client.phone || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Invoice Reference */}
            <div className="border-t pt-4" data-testid="section-invoice-reference">
              <h3 className="font-semibold text-lg mb-2" data-testid="text-invoice-heading">Invoice Reference</h3>
              <div className="grid grid-cols-2 gap-4">
                <p data-testid="text-invoice-number">
                  <span className="font-medium">Invoice #:</span> {receiptData.invoice.invoiceNumber}
                </p>
                <p data-testid="text-invoice-amount">
                  <span className="font-medium">Invoice Amount:</span> {formatCurrency(receiptData.invoice.amount || "0")}
                </p>
                <p data-testid="text-invoice-due-date">
                  <span className="font-medium">Due Date:</span> {format(new Date(receiptData.invoice.dueDate), "MMM dd, yyyy")}
                </p>
                <p data-testid="text-invoice-status">
                  <span className="font-medium">Status:</span>{" "}
                  <span className="capitalize">{receiptData.invoice.status}</span>
                </p>
              </div>
            </div>

            {/* Payment Amount */}
            <div className="border-t pt-4" data-testid="section-payment-amount">
              <div className="flex justify-between items-center bg-muted p-4 rounded-md">
                <span className="text-lg font-semibold" data-testid="text-amount-label">Amount Paid:</span>
                <span className="text-2xl font-bold text-primary" data-testid="text-amount-paid">
                  {formatCurrency(receiptData.payment.amount || "0")}
                </span>
              </div>
            </div>

            {/* Notes */}
            {receiptData.payment.notes && (
              <div className="border-t pt-4" data-testid="section-notes">
                <h3 className="font-semibold text-lg mb-2" data-testid="text-notes-heading">Notes</h3>
                <p className="text-muted-foreground" data-testid="text-notes-content">{receiptData.payment.notes}</p>
              </div>
            )}

            {/* Signature */}
            <div className="border-t pt-6 mt-6" data-testid="section-signature">
              <div className="flex justify-between">
                <div className="text-center" data-testid="section-receiver-signature">
                  <div className="border-t border-foreground w-48 mb-2"></div>
                  <p className="text-sm font-medium" data-testid="text-receiver-label">Received By</p>
                </div>
                <div className="text-center" data-testid="section-authorized-signature">
                  <div className="border-t border-foreground w-48 mb-2"></div>
                  <p className="text-sm font-medium" data-testid="text-authorized-label">Authorized Signature</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

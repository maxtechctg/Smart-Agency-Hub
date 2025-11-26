import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowUpCircle, ArrowDownCircle, Wallet, FileText, FileSpreadsheet } from "lucide-react";
import { format } from "date-fns";
import { sumAmounts } from "@shared/currency";
import { useToast } from "@/hooks/use-toast";
import Decimal from "decimal.js-light";

type Income = {
  id: string;
  source: string;
  amount: string;
  category: string;
  date: string;
  description?: string;
};

type Expense = {
  id: string;
  title: string;
  amount: string;
  category: string;
  date: string;
  description?: string;
};

type Payroll = {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  netSalary: string;
  status: string;
};

type LedgerEntry = {
  id: string;
  date: string;
  type: "income" | "expense" | "payroll";
  description: string;
  category: string;
  debit: string;
  credit: string;
  balance: string;
};

export default function GeneralLedger() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense" | "payroll">("all");
  const { toast } = useToast();

  const { data: incomes, isLoading: incomesLoading } = useQuery<Income[]>({
    queryKey: ["/api/income"],
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: payrolls, isLoading: payrollsLoading } = useQuery<Payroll[]>({
    queryKey: ["/api/payroll"],
  });

  const isLoading = incomesLoading || expensesLoading || payrollsLoading;

  // Export to PDF
  const exportToPDF = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/general-ledger/export-pdf`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error("Failed to generate PDF");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'General-Ledger.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "PDF Downloaded",
        description: "General Ledger exported successfully",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export PDF",
        variant: "destructive",
      });
    }
  };

  // Export to Excel
  const exportToExcel = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/general-ledger/export-excel`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error("Failed to generate Excel");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'General-Ledger.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Excel Downloaded",
        description: "General Ledger exported successfully",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export Excel",
        variant: "destructive",
      });
    }
  };

  // Export to Word
  const exportToWord = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/general-ledger/export-word`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error("Failed to generate Word document");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'General-Ledger.docx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Word Document Downloaded",
        description: "General Ledger exported successfully",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export Word document",
        variant: "destructive",
      });
    }
  };

  const ledgerEntries: LedgerEntry[] = [];

  incomes?.forEach(inc => {
    ledgerEntries.push({
      id: inc.id,
      date: inc.date,
      type: "income",
      description: inc.source,
      category: inc.category,
      debit: inc.amount,
      credit: "0",
      balance: "0",
    });
  });

  expenses?.forEach(exp => {
    ledgerEntries.push({
      id: exp.id,
      date: exp.date,
      type: "expense",
      description: exp.title,
      category: exp.category,
      debit: "0",
      credit: exp.amount,
      balance: "0",
    });
  });

  payrolls?.filter(p => p.status === "paid").forEach(pay => {
    ledgerEntries.push({
      id: pay.id,
      date: new Date(pay.year, pay.month - 1, 1).toISOString(),
      type: "payroll",
      description: `Payroll ${pay.month}/${pay.year}`,
      category: "Payroll",
      debit: "0",
      credit: pay.netSalary,
      balance: "0",
    });
  });

  // Create ascending copy for balance calculation (oldest first)
  const sortedForBalance = [...ledgerEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate running balance using Decimal.js and create enriched array
  let runningBalance = new Decimal(0);
  const entriesWithBalance = sortedForBalance.map(entry => {
    const debitAmount = new Decimal(entry.debit);
    const creditAmount = new Decimal(entry.credit);
    runningBalance = runningBalance.plus(debitAmount).minus(creditAmount);
    return {
      ...entry,
      balance: runningBalance.toFixed(2)
    };
  });

  // Sort enriched entries by date (newest first for display)
  const displayEntries = [...entriesWithBalance].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredEntries = displayEntries.filter(entry => {
    const matchesSearch = entry.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         entry.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || entry.type === filterType;
    return matchesSearch && matchesType;
  });

  // Calculate totals using Decimal.js for precision (keep as strings)
  const debitAmounts = entriesWithBalance.map(e => e.debit);
  const creditAmounts = entriesWithBalance.map(e => e.credit);
  const totalDebits = sumAmounts(debitAmounts);
  const totalCredits = sumAmounts(creditAmounts);
  const finalBalance = new Decimal(totalDebits).minus(totalCredits).toFixed(2);
  const finalBalanceNum = parseFloat(finalBalance);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-general-ledger">General Ledger</h1>
        <p className="text-muted-foreground" data-testid="text-subtitle">Comprehensive transaction history</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-total-debits">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Debits (Income)</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-total-debits">
              {parseFloat(totalDebits).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-credits">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credits (Expenses)</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-total-credits">
              {parseFloat(totalCredits).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-balance">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${finalBalanceNum >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-balance">
              {Math.abs(finalBalanceNum).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4">
          <Input
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
            data-testid="input-search"
          />
          <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
            <SelectTrigger className="w-[180px]" data-testid="select-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="option-all">All Transactions</SelectItem>
              <SelectItem value="income" data-testid="option-income">Income Only</SelectItem>
              <SelectItem value="expense" data-testid="option-expense">Expenses Only</SelectItem>
              <SelectItem value="payroll" data-testid="option-payroll">Payroll Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportToPDF}
            data-testid="button-export-pdf"
          >
            <FileText className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            data-testid="button-export-excel"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToWord}
            data-testid="button-export-word"
          >
            <FileText className="h-4 w-4 mr-2" />
            Word
          </Button>
        </div>
      </div>

      <Card data-testid="card-ledger">
        <CardHeader>
          <CardTitle>Ledger Entries ({filteredEntries.length})</CardTitle>
          <CardDescription>All financial transactions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : filteredEntries.length > 0 ? (
            <div className="space-y-2">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-4 p-3 rounded-md bg-card border hover-elevate"
                  data-testid={`entry-${entry.id}`}
                >
                  <div className="flex-shrink-0">
                    {entry.type === "income" ? (
                      <ArrowUpCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <ArrowDownCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" data-testid={`text-description-${entry.id}`}>{entry.description}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(entry.date), "MMM d, yyyy")} • {entry.category}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex gap-4">
                      {entry.debit !== "0" && (
                        <div className="text-sm">
                          <div className="text-muted-foreground">Debit</div>
                          <div className="font-medium text-green-600" data-testid={`text-debit-${entry.id}`}>
                            {parseFloat(entry.debit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      )}
                      {entry.credit !== "0" && (
                        <div className="text-sm">
                          <div className="text-muted-foreground">Credit</div>
                          <div className="font-medium text-red-600" data-testid={`text-credit-${entry.id}`}>
                            {parseFloat(entry.credit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      )}
                      <div className="text-sm">
                        <div className="text-muted-foreground">Balance</div>
                        <div className={`font-medium ${parseFloat(entry.balance) >= 0 ? "text-green-600" : "text-red-600"}`} data-testid={`text-balance-${entry.id}`}>
                          {Math.abs(parseFloat(entry.balance)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No transactions found</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

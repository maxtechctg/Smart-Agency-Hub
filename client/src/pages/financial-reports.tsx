import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { FileText, TrendingUp, TrendingDown, FileSpreadsheet } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, subMonths, subYears } from "date-fns";
import { sumAmounts } from "@shared/currency";
import { useToast } from "@/hooks/use-toast";
import Decimal from "decimal.js-light";

type Income = {
  id: string;
  amount: string;
  category: string;
  date: string;
};

type Expense = {
  id: string;
  amount: string;
  category: string;
  date: string;
};

type MonthlyData = {
  month: string;
  income: string;
  expenses: string;
  profit: string;
};

export default function FinancialReports() {
  const [period, setPeriod] = useState<"6months" | "12months">("12months");
  const { toast } = useToast();

  const { data: incomes, isLoading: incomesLoading } = useQuery<Income[]>({
    queryKey: ["/api/income"],
  });

  const { data: expenses, isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const isLoading = incomesLoading || expensesLoading;

  // Export to PDF
  const exportToPDF = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/financial-reports/export-pdf?period=${period}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error("Failed to generate PDF");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Financial-Reports.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "PDF Downloaded",
        description: "Financial Reports exported successfully",
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
      const response = await fetch(`/api/financial-reports/export-excel?period=${period}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error("Failed to generate Excel");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Financial-Reports.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Excel Downloaded",
        description: "Financial Reports exported successfully",
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
      const response = await fetch(`/api/financial-reports/export-word?period=${period}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error("Failed to generate Word document");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Financial-Reports.docx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Word Document Downloaded",
        description: "Financial Reports exported successfully",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export Word document",
        variant: "destructive",
      });
    }
  };

  const now = new Date();
  const monthsCount = period === "6months" ? 6 : 12;
  
  const monthlyData: MonthlyData[] = [];
  for (let i = monthsCount - 1; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const startDate = startOfMonth(monthDate);
    const endDate = endOfMonth(monthDate);

    const monthIncomes = incomes?.filter(inc => {
      const incDate = new Date(inc.date);
      return incDate >= startDate && incDate <= endDate;
    }) || [];

    const monthExpenses = expenses?.filter(exp => {
      const expDate = new Date(exp.date);
      return expDate >= startDate && expDate <= endDate;
    }) || [];

    const totalIncome = sumAmounts(monthIncomes.map(inc => inc.amount));
    const totalExpenses = sumAmounts(monthExpenses.map(exp => exp.amount));
    const profit = new Decimal(totalIncome).minus(totalExpenses).toFixed(2);

    monthlyData.push({
      month: format(monthDate, "MMM yyyy"),
      income: totalIncome,
      expenses: totalExpenses,
      profit: profit,
    });
  }

  const totalIncome = sumAmounts(monthlyData.map(m => m.income));
  const totalExpenses = sumAmounts(monthlyData.map(m => m.expenses));
  const totalProfit = new Decimal(totalIncome).minus(totalExpenses).toFixed(2);
  const totalProfitNum = parseFloat(totalProfit);
  const avgMonthlyIncome = new Decimal(totalIncome).dividedBy(monthsCount).toFixed(2);
  const avgMonthlyExpenses = new Decimal(totalExpenses).dividedBy(monthsCount).toFixed(2);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-financial-reports">Financial Reports</h1>
          <p className="text-muted-foreground" data-testid="text-subtitle">Monthly and yearly financial analysis</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as "6months" | "12months")} data-testid="tabs-period">
            <TabsList>
              <TabsTrigger value="6months" data-testid="tab-6months">Last 6 Months</TabsTrigger>
              <TabsTrigger value="12months" data-testid="tab-12months">Last 12 Months</TabsTrigger>
            </TabsList>
          </Tabs>
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
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-total-income">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-total-income">
              {parseFloat(totalIncome).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg {parseFloat(avgMonthlyIncome).toLocaleString(undefined, { maximumFractionDigits: 0 })}/month
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-expenses">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-total-expenses">
              {parseFloat(totalExpenses).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg {parseFloat(avgMonthlyExpenses).toLocaleString(undefined, { maximumFractionDigits: 0 })}/month
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-net-profit">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalProfitNum >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-net-profit">
              {Math.abs(totalProfitNum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalIncome === '0.00' ? '0.0' : new Decimal(totalProfit).dividedBy(totalIncome).times(100).toFixed(1)}% margin
            </p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-monthly-breakdown">
        <CardHeader>
          <CardTitle>Monthly Breakdown</CardTitle>
          <CardDescription>Income, expenses, and profit by month</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-4">
              {monthlyData.map((data, index) => (
                <div key={index} className="p-4 rounded-md bg-card border" data-testid={`month-${index}`}>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h3 className="font-semibold" data-testid={`text-month-${index}`}>{data.month}</h3>
                    <Badge variant={parseFloat(data.profit) >= 0 ? "default" : "destructive"} data-testid={`badge-profit-${index}`}>
                      {parseFloat(data.profit) >= 0 ? "Profit" : "Loss"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Income</div>
                      <div className="font-medium text-green-600" data-testid={`text-income-${index}`}>
                        {parseFloat(data.income).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Expenses</div>
                      <div className="font-medium text-red-600" data-testid={`text-expenses-${index}`}>
                        {parseFloat(data.expenses).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Net</div>
                      <div className={`font-medium ${parseFloat(data.profit) >= 0 ? "text-green-600" : "text-red-600"}`} data-testid={`text-net-${index}`}>
                        {parseFloat(data.profit) >= 0 ? "+" : "-"}{Math.abs(parseFloat(data.profit)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

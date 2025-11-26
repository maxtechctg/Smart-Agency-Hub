import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {TrendingUp, TrendingDown, DollarSign, CreditCard, Wallet, PieChart } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

type Income = {
  id: string;
  source: string;
  amount: string;
  category: string;
  date: string;
  description?: string;
  createdAt: string;
};

type Expense = {
  id: string;
  title: string;
  amount: string;
  category: string;
  date: string;
  description?: string;
  createdAt: string;
};

type Payroll = {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  netSalary: string;
  status: string;
};

export default function AccountsDashboard() {
  const [timeframe, setTimeframe] = useState<"month" | "year">("month");

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

  const now = new Date();
  const startDate = timeframe === "month" ? startOfMonth(now) : startOfYear(now);
  const endDate = timeframe === "month" ? endOfMonth(now) : endOfYear(now);

  const filterByDate = (date: string) => {
    const itemDate = new Date(date);
    return itemDate >= startDate && itemDate <= endDate;
  };

  const filteredIncomes = incomes?.filter(income => filterByDate(income.date)) || [];
  const filteredExpenses = expenses?.filter(expense => filterByDate(expense.date)) || [];
  const filteredPayrolls = payrolls?.filter(
    p => p.status === "paid" && new Date(p.year, p.month - 1) >= startDate && new Date(p.year, p.month - 1) <= endDate
  ) || [];

  const totalIncome = filteredIncomes.reduce((sum, inc) => sum + Number(inc.amount), 0);
  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const totalPayroll = filteredPayrolls.reduce((sum, pay) => sum + Number(pay.netSalary), 0);
  const totalCosts = totalExpenses + totalPayroll;
  const netProfit = totalIncome - totalCosts;

  const incomeByCategory = filteredIncomes.reduce((acc, income) => {
    acc[income.category] = (acc[income.category] || 0) + Number(income.amount);
    return acc;
  }, {} as Record<string, number>);

  const expenseByCategory = filteredExpenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + Number(expense.amount);
    return acc;
  }, {} as Record<string, number>);

  const topIncomeCategories = Object.entries(incomeByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topExpenseCategories = Object.entries(expenseByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-accounts-dashboard">Financial Dashboard</h1>
          <p className="text-muted-foreground" data-testid="text-subtitle">Comprehensive financial overview and analytics</p>
        </div>
        <Tabs value={timeframe} onValueChange={(v) => setTimeframe(v as "month" | "year")} data-testid="tabs-timeframe">
          <TabsList>
            <TabsTrigger value="month" data-testid="tab-month">This Month</TabsTrigger>
            <TabsTrigger value="year" data-testid="tab-year">This Year</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-income">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-income">
              {totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">{filteredIncomes.length} transactions</p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-expenses">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-expenses">
              {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">{filteredExpenses.length} transactions</p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-payroll">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payroll Costs</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-payroll">
              {totalPayroll.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">{filteredPayrolls.length} salary payments</p>
          </CardContent>
        </Card>

        <Card data-testid="card-net-profit">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            {netProfit >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-net-profit">
              {Math.abs(netProfit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground">
              {((netProfit / (totalIncome || 1)) * 100).toFixed(1)}% margin
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-income-categories">
          <CardHeader>
            <CardTitle>Top Income Categories</CardTitle>
            <CardDescription>Revenue breakdown by category</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : topIncomeCategories.length > 0 ? (
              <div className="space-y-4">
                {topIncomeCategories.map(([category, amount]) => (
                  <div key={category} className="flex items-center justify-between gap-2" data-testid={`income-category-${category}`}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span className="text-sm truncate">{category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-xs text-muted-foreground">
                        {((amount / totalIncome) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No income data available</div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-expense-categories">
          <CardHeader>
            <CardTitle>Top Expense Categories</CardTitle>
            <CardDescription>Cost breakdown by category</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : topExpenseCategories.length > 0 ? (
              <div className="space-y-4">
                {topExpenseCategories.map(([category, amount]) => (
                  <div key={category} className="flex items-center justify-between gap-2" data-testid={`expense-category-${category}`}>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm truncate">{category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-xs text-muted-foreground">
                        {((amount / totalCosts) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No expense data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-financial-summary">
        <CardHeader>
          <CardTitle>Financial Summary</CardTitle>
          <CardDescription>
            Period: {format(startDate, "MMM d, yyyy")} - {format(endDate, "MMM d, yyyy")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 p-4 rounded-md bg-card border">
              <div>
                <div className="text-sm text-muted-foreground">Revenue (Income)</div>
                <div className="text-2xl font-bold text-green-600" data-testid="text-summary-income">
                  {totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
            <div className="flex items-center justify-between gap-2 p-4 rounded-md bg-card border">
              <div>
                <div className="text-sm text-muted-foreground">Operating Expenses</div>
                <div className="text-2xl font-bold text-red-600" data-testid="text-summary-expenses">
                  {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
            <div className="flex items-center justify-between gap-2 p-4 rounded-md bg-card border">
              <div>
                <div className="text-sm text-muted-foreground">Payroll Expenses</div>
                <div className="text-2xl font-bold text-red-600" data-testid="text-summary-payroll">
                  {totalPayroll.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <Wallet className="h-8 w-8 text-red-600" />
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between gap-2 p-4 rounded-md bg-primary/10 border-2 border-primary">
              <div>
                <div className="text-sm font-medium">Net Profit/Loss</div>
                <div className={`text-3xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-summary-net">
                  {netProfit >= 0 ? "+" : "-"}{Math.abs(netProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {netProfit >= 0 ? "Profitable" : "Loss"} • {((netProfit / (totalIncome || 1)) * 100).toFixed(1)}% margin
                </div>
              </div>
              {netProfit >= 0 ? (
                <TrendingUp className="h-10 w-10 text-green-600" />
              ) : (
                <TrendingDown className="h-10 w-10 text-red-600" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

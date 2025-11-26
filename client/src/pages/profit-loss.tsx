import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, FileSpreadsheet, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { sumAmounts } from "@shared/currency";

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

type Payroll = {
  id: string;
  month: number;
  year: number;
  netSalary: string;
  status: string;
};

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function ProfitLoss() {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: incomes } = useQuery<Income[]>({
    queryKey: ["/api/income"],
  });

  const { data: expenses } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const { data: payrolls } = useQuery<Payroll[]>({
    queryKey: ["/api/payroll"],
  });

  // Calculate data for current period
  const startDate = startOfMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1));
  const endDate = endOfMonth(new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1));

  const filterByDate = (date: string) => {
    const itemDate = new Date(date);
    return itemDate >= startDate && itemDate <= endDate;
  };

  let periodIncomes = incomes?.filter(inc => filterByDate(inc.date)) || [];
  let periodExpenses = expenses?.filter(exp => filterByDate(exp.date)) || [];
  let periodPayrolls = payrolls?.filter(
    p => p.status === "paid" && p.month === parseInt(selectedMonth) && p.year === parseInt(selectedYear)
  ) || [];

  // Apply category filter
  if (selectedCategory !== "all") {
    periodIncomes = periodIncomes.filter(inc => inc.category === selectedCategory);
    periodExpenses = periodExpenses.filter(exp => exp.category === selectedCategory);
    // Note: Payroll doesn't have categories, so it's excluded when a specific category is selected
    periodPayrolls = [];
  }

  // Calculate previous month data for comparison
  const prevMonthDate = subMonths(startDate, 1);
  const prevMonthStart = startOfMonth(prevMonthDate);
  const prevMonthEnd = endOfMonth(prevMonthDate);

  const filterByPrevMonth = (date: string) => {
    const itemDate = new Date(date);
    return itemDate >= prevMonthStart && itemDate <= prevMonthEnd;
  };

  let prevMonthIncomes = incomes?.filter(inc => filterByPrevMonth(inc.date)) || [];
  let prevMonthExpenses = expenses?.filter(exp => filterByPrevMonth(exp.date)) || [];
  let prevMonthPayrolls = payrolls?.filter(
    p => p.status === "paid" && p.month === prevMonthDate.getMonth() + 1 && p.year === prevMonthDate.getFullYear()
  ) || [];

  // Apply category filter to previous month data
  if (selectedCategory !== "all") {
    prevMonthIncomes = prevMonthIncomes.filter(inc => inc.category === selectedCategory);
    prevMonthExpenses = prevMonthExpenses.filter(exp => exp.category === selectedCategory);
    prevMonthPayrolls = [];
  }

  // Group by category (keep as string arrays for Decimal precision)
  const incomeGrouped = periodIncomes.reduce((acc, inc) => {
    if (!acc[inc.category]) acc[inc.category] = [];
    acc[inc.category].push(inc.amount);
    return acc;
  }, {} as Record<string, string[]>);

  const expenseGrouped = periodExpenses.reduce((acc, exp) => {
    if (!acc[exp.category]) acc[exp.category] = [];
    acc[exp.category].push(exp.amount);
    return acc;
  }, {} as Record<string, string[]>);

  // Calculate category totals using Decimal.js
  const incomeByCategory: Record<string, number> = {};
  Object.entries(incomeGrouped).forEach(([cat, amounts]) => {
    incomeByCategory[cat] = Number(sumAmounts(amounts));
  });

  const expenseByCategory: Record<string, number> = {};
  Object.entries(expenseGrouped).forEach(([cat, amounts]) => {
    expenseByCategory[cat] = Number(sumAmounts(amounts));
  });

  const totalIncome = Number(sumAmounts(periodIncomes.map(inc => inc.amount)));
  const totalExpenses = Number(sumAmounts(periodExpenses.map(exp => exp.amount)));
  const totalPayroll = Number(sumAmounts(periodPayrolls.map(p => p.netSalary)));
  const totalCosts = totalExpenses + totalPayroll;
  const grossProfit = totalIncome - totalCosts;
  const profitMargin = ((grossProfit / (totalIncome || 1)) * 100);

  // Previous month calculations
  const prevTotalIncome = Number(sumAmounts(prevMonthIncomes.map(inc => inc.amount)));
  const prevTotalExpenses = Number(sumAmounts(prevMonthExpenses.map(exp => exp.amount)));
  const prevTotalPayroll = Number(sumAmounts(prevMonthPayrolls.map(p => p.netSalary)));
  const prevGrossProfit = prevTotalIncome - (prevTotalExpenses + prevTotalPayroll);

  // Calculate trends
  const profitChange = prevGrossProfit !== 0 ? ((grossProfit - prevGrossProfit) / Math.abs(prevGrossProfit)) * 100 : 0;
  const revenueChange = prevTotalIncome !== 0 ? ((totalIncome - prevTotalIncome) / prevTotalIncome) * 100 : 0;

  // Chart data
  const revenueVsExpensesData = [
    { name: 'Revenue', amount: totalIncome, fill: '#10b981' },
    { name: 'Operating Expenses', amount: totalExpenses, fill: '#ef4444' },
    { name: 'Payroll', amount: totalPayroll, fill: '#f59e0b' },
  ];

  // Monthly trend data (last 6 months)
  const monthlyTrendData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(startDate, i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      
      let monthIncomes = incomes?.filter(inc => {
        const itemDate = new Date(inc.date);
        return itemDate >= monthStart && itemDate <= monthEnd;
      }) || [];
      
      let monthExpenses = expenses?.filter(exp => {
        const itemDate = new Date(exp.date);
        return itemDate >= monthStart && itemDate <= monthEnd;
      }) || [];
      
      let monthPayrolls = payrolls?.filter(
        p => p.status === "paid" && p.month === date.getMonth() + 1 && p.year === date.getFullYear()
      ) || [];

      // Apply category filter to monthly trend data
      if (selectedCategory !== "all") {
        monthIncomes = monthIncomes.filter(inc => inc.category === selectedCategory);
        monthExpenses = monthExpenses.filter(exp => exp.category === selectedCategory);
        monthPayrolls = [];
      }
      
      const monthRevenue = Number(sumAmounts(monthIncomes.map(inc => inc.amount)));
      const monthExpense = Number(sumAmounts(monthExpenses.map(exp => exp.amount)));
      const monthPayroll = Number(sumAmounts(monthPayrolls.map(p => p.netSalary)));
      const monthProfit = monthRevenue - (monthExpense + monthPayroll);
      
      data.push({
        month: format(date, 'MMM yy'),
        profit: monthProfit,
        revenue: monthRevenue,
        expenses: monthExpense + monthPayroll,
      });
    }
    return data;
  }, [incomes, expenses, payrolls, startDate, selectedCategory]);

  // Expense breakdown pie chart data
  const expenseBreakdownData = [
    ...Object.entries(expenseByCategory).map(([name, value]) => ({ name, value })),
    ...(totalPayroll > 0 ? [{ name: 'Payroll', value: totalPayroll }] : [])
  ];

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const years = [currentYear, currentYear - 1, currentYear - 2];

  // Get all unique categories
  const allCategories = Array.from(new Set([
    ...periodIncomes.map(i => i.category),
    ...periodExpenses.map(e => e.category)
  ]));

  // Export to PDF
  const exportToPDF = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/profit-loss/export-pdf?month=${selectedMonth}&year=${selectedYear}&category=${selectedCategory}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to export PDF");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const categoryLabel = selectedCategory !== "all" ? `-${selectedCategory}` : "";
      a.download = `P&L-${months[parseInt(selectedMonth) - 1]}-${selectedYear}${categoryLabel}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Export to Excel
  const exportToExcel = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/profit-loss/export-excel?month=${selectedMonth}&year=${selectedYear}&category=${selectedCategory}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to export Excel");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const categoryLabel = selectedCategory !== "all" ? `-${selectedCategory}` : "";
      a.download = `P&L-${months[parseInt(selectedMonth) - 1]}-${selectedYear}${categoryLabel}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Excel export failed:', error);
    }
  };

  // Export to Word
  const exportToWord = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`/api/profit-loss/export-word?month=${selectedMonth}&year=${selectedYear}&category=${selectedCategory}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to export Word");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const categoryLabel = selectedCategory !== "all" ? `-${selectedCategory}` : "";
      a.download = `P&L-${months[parseInt(selectedMonth) - 1]}-${selectedYear}${categoryLabel}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Word export failed:', error);
    }
  };

  // Calculate insights
  const insights = useMemo(() => {
    const result = [];
    
    // Profit trend insight
    if (Math.abs(profitChange) > 5) {
      const direction = profitChange > 0 ? 'increased' : 'decreased';
      result.push({
        type: profitChange > 0 ? 'positive' : 'negative',
        message: `Profit ${direction} by ${Math.abs(profitChange).toFixed(1)}% from last month.`
      });
    }
    
    // Expense composition insight
    if (totalCosts > 0) {
      const payrollPercent = (totalPayroll / totalCosts) * 100;
      if (payrollPercent > 40) {
        result.push({
          type: 'warning',
          message: `Salary expenses make up ${payrollPercent.toFixed(0)}% of total expenses.`
        });
      }
    }
    
    // Revenue dependency insight
    const sortedIncomeCategories = Object.entries(incomeByCategory).sort((a, b) => b[1] - a[1]);
    if (sortedIncomeCategories.length > 0 && totalIncome > 0) {
      const topCategoryPercent = (sortedIncomeCategories[0][1] / totalIncome) * 100;
      if (topCategoryPercent > 60) {
        result.push({
          type: 'warning',
          message: `${topCategoryPercent.toFixed(0)}% of revenue comes from ${sortedIncomeCategories[0][0]}. Consider diversifying income sources.`
        });
      }
    }
    
    // Profit margin insight
    if (profitMargin < 10 && profitMargin > 0) {
      result.push({
        type: 'warning',
        message: `Low profit margin (${profitMargin.toFixed(1)}%). Consider reviewing expenses or pricing.`
      });
    } else if (profitMargin > 30) {
      result.push({
        type: 'positive',
        message: `Excellent profit margin of ${profitMargin.toFixed(1)}%. Business is performing well!`
      });
    }
    
    // Revenue growth
    if (Math.abs(revenueChange) > 10) {
      const direction = revenueChange > 0 ? 'grew' : 'declined';
      result.push({
        type: revenueChange > 0 ? 'positive' : 'negative',
        message: `Revenue ${direction} by ${Math.abs(revenueChange).toFixed(1)}% compared to last month.`
      });
    }
    
    return result;
  }, [profitChange, totalCosts, totalPayroll, incomeByCategory, totalIncome, profitMargin, revenueChange]);

  return (
    <div className="p-6 space-y-6">
      {/* Header with Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-profit-loss">Profit & Loss Statement</h1>
          <p className="text-muted-foreground" data-testid="text-subtitle">Comprehensive financial analysis and insights</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[150px]" data-testid="select-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((month, idx) => (
                <SelectItem key={idx} value={(idx + 1).toString()} data-testid={`option-month-${idx}`}>
                  {month}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()} data-testid={`option-year-${year}`}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[150px]" data-testid="select-category">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" data-testid="option-category-all">All Categories</SelectItem>
              {allCategories.map((cat) => (
                <SelectItem key={cat} value={cat} data-testid={`option-category-${cat}`}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportToPDF} data-testid="button-export-pdf">
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={exportToExcel} data-testid="button-export-excel">
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={exportToWord} data-testid="button-export-word">
            <FileText className="h-4 w-4 mr-2" />
            Export Word
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="card-revenue">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-metric-revenue">
              {totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            {revenueChange !== 0 && (
              <p className="text-xs text-muted-foreground mt-1" data-testid="text-revenue-change">
                {revenueChange > 0 ? '+' : ''}{revenueChange.toFixed(1)}% from last month
              </p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-expenses">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-metric-expenses">
              {totalCosts.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1" data-testid="text-expense-breakdown">
              Operating: ${totalExpenses.toFixed(0)} | Payroll: ${totalPayroll.toFixed(0)}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-profit">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit/Loss</CardTitle>
            <Badge variant={grossProfit >= 0 ? "default" : "destructive"} data-testid="badge-profit-status">
              {grossProfit >= 0 ? "Profit" : "Loss"}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${grossProfit >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-metric-profit">
              {grossProfit >= 0 ? "+" : "-"}{Math.abs(grossProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            {profitChange !== 0 && (
              <p className="text-xs text-muted-foreground mt-1" data-testid="text-profit-change">
                {profitChange > 0 ? '+' : ''}{profitChange.toFixed(1)}% from last month
              </p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-margin">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profitMargin >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-metric-margin">
              {profitMargin.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {profitMargin > 20 ? 'Excellent' : profitMargin > 10 ? 'Good' : profitMargin > 0 ? 'Fair' : 'Needs Attention'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Insights Section */}
      {insights.length > 0 && (
        <Card data-testid="card-insights">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Financial Insights
            </CardTitle>
            <CardDescription>Key observations and recommendations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.map((insight, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-md border ${
                  insight.type === 'positive' ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800' :
                  insight.type === 'negative' ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800' :
                  'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800'
                }`}
                data-testid={`insight-${idx}`}
              >
                {insight.type === 'positive' ? (
                  <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                ) : insight.type === 'negative' ? (
                  <TrendingDown className="h-5 w-5 text-red-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                )}
                <p className="text-sm flex-1" data-testid={`insight-text-${idx}`}>{insight.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Revenue vs Expenses Bar Chart */}
        <Card data-testid="card-chart-bar">
          <CardHeader>
            <CardTitle>Revenue vs Expenses</CardTitle>
            <CardDescription>Current period comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueVsExpensesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `${Number(value).toLocaleString()}`} />
                <Bar dataKey="amount" fill="#8884d8">
                  {revenueVsExpensesData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expense Breakdown Pie Chart */}
        <Card data-testid="card-chart-pie">
          <CardHeader>
            <CardTitle>Expense Breakdown</CardTitle>
            <CardDescription>Distribution by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expenseBreakdownData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {expenseBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${Number(value).toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Profit Trend Line Chart */}
      <Card data-testid="card-chart-trend">
        <CardHeader>
          <CardTitle>6-Month Profit Trend</CardTitle>
          <CardDescription>Historical performance analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => `${Number(value).toLocaleString()}`} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#10b981" name="Revenue" strokeWidth={2} />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" name="Expenses" strokeWidth={2} />
              <Line type="monotone" dataKey="profit" stroke="#3b82f6" name="Net Profit" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detailed P&L Statement */}
      <Card data-testid="card-summary">
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle>Detailed P&L Statement</CardTitle>
              <CardDescription>
                Period: {format(startDate, "MMMM d, yyyy")} - {format(endDate, "MMMM d, yyyy")}
              </CardDescription>
            </div>
            <Badge variant={grossProfit >= 0 ? "default" : "destructive"} data-testid="badge-status">
              {grossProfit >= 0 ? "Profitable" : "Loss"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-semibold mb-3 text-lg text-green-600 dark:text-green-500">Revenue</h3>
            <div className="space-y-2 pl-4">
              {Object.entries(incomeByCategory).map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between gap-2" data-testid={`income-${category}`}>
                  <span className="text-sm">{category}</span>
                  <span className="font-medium" data-testid={`income-amount-${category}`}>
                    {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
              {Object.keys(incomeByCategory).length === 0 && (
                <div className="text-sm text-muted-foreground">No income recorded</div>
              )}
            </div>
            <div className="h-px bg-border my-3" />
            <div className="flex items-center justify-between gap-2 font-semibold">
              <span>Total Revenue</span>
              <span className="text-green-600 dark:text-green-500" data-testid="text-total-revenue">
                {totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div>
            <h3 className="font-semibold mb-3 text-lg text-red-600 dark:text-red-500">Operating Expenses</h3>
            <div className="space-y-2 pl-4">
              {Object.entries(expenseByCategory).map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between gap-2" data-testid={`expense-${category}`}>
                  <span className="text-sm">{category}</span>
                  <span className="font-medium" data-testid={`expense-amount-${category}`}>
                    {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
              {Object.keys(expenseByCategory).length === 0 && (
                <div className="text-sm text-muted-foreground">No expenses recorded</div>
              )}
            </div>
            <div className="h-px bg-border my-3" />
            <div className="flex items-center justify-between gap-2 font-semibold">
              <span>Total Operating Expenses</span>
              <span className="text-red-600 dark:text-red-500" data-testid="text-total-expenses">
                {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div>
            <h3 className="font-semibold mb-3 text-lg text-red-600 dark:text-red-500">Payroll Expenses</h3>
            <div className="flex items-center justify-between gap-2 pl-4">
              <span className="text-sm">Employee Salaries ({periodPayrolls.length} payments)</span>
              <span className="font-medium text-red-600 dark:text-red-500" data-testid="text-total-payroll">
                {totalPayroll.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div>
            <div className="flex items-center justify-between gap-2 font-semibold">
              <span>Total Costs</span>
              <span className="text-red-600 dark:text-red-500" data-testid="text-total-costs">
                {totalCosts.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className={`p-4 rounded-md border-2 ${grossProfit >= 0 ? 'bg-green-50 border-green-500 dark:bg-green-950 dark:border-green-700' : 'bg-red-50 border-red-500 dark:bg-red-950 dark:border-red-700'}`}>
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <span className="text-lg font-bold">Net Profit/Loss</span>
              <span className={`text-2xl font-bold ${grossProfit >= 0 ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`} data-testid="text-net-profit">
                {grossProfit >= 0 ? "+" : "-"}{Math.abs(grossProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>Profit Margin</span>
              <span data-testid="text-profit-margin">{profitMargin.toFixed(2)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

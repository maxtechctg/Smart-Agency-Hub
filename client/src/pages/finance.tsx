import { useState } from "react";
import { Plus, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertIncomeSchema, insertExpenseSchema, type Income, type Expense } from "@shared/schema";
import { normalizeIncomeData, normalizeExpenseData } from "@/lib/normalizeDateInputs";

type IncomeFormData = z.infer<typeof insertIncomeSchema>;
type ExpenseFormData = z.infer<typeof insertExpenseSchema>;

import { z } from "zod";

const incomeCategories = ["Project Payment", "Consulting", "Product Sales", "Other"];
const expenseCategories = ["Salary", "Office Rent", "Utilities", "Software", "Marketing", "Other"];

export default function Finance() {
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const { toast } = useToast();

  const { data: incomes, isLoading: incomesLoading } = useQuery<Income[]>({
    queryKey: ["/api/income"],
  });
  const { data: expenses, isLoading: expensesLoading } = useQuery<Expense[]>({
    queryKey: ["/api/expenses"],
  });

  const createIncomeMutation = useMutation({
    mutationFn: (data: IncomeFormData) => apiRequest("POST", "/api/income", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/income"] });
      toast({ title: "Success", description: "Income added successfully" });
      setIncomeOpen(false);
      incomeForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: (data: ExpenseFormData) => apiRequest("POST", "/api/expenses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      toast({ title: "Success", description: "Expense added successfully" });
      setExpenseOpen(false);
      expenseForm.reset();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const incomeForm = useForm<IncomeFormData>({
    resolver: zodResolver(insertIncomeSchema),
    defaultValues: {
      source: "",
      amount: "0",
      category: "",
      description: "",
    },
  });

  const expenseForm = useForm<ExpenseFormData>({
    resolver: zodResolver(insertExpenseSchema),
    defaultValues: {
      title: "",
      amount: "0",
      category: "",
      description: "",
    },
  });

  const onIncomeSubmit = async (data: IncomeFormData) => {
    const normalizedData = normalizeIncomeData(data);
    createIncomeMutation.mutate(normalizedData);
  };

  const onExpenseSubmit = async (data: ExpenseFormData) => {
    const normalizedData = normalizeExpenseData(data);
    createExpenseMutation.mutate(normalizedData);
  };

  const totalIncome = incomes?.reduce((sum, income) => sum + Number(income.amount), 0) ?? 0;
  const totalExpenses = expenses?.reduce((sum, expense) => sum + Number(expense.amount), 0) ?? 0;
  const balance = totalIncome - totalExpenses;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Finance</h1>
          <p className="text-sm text-muted-foreground">Track income and expenses</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <div className="p-2 rounded-md bg-green-100 dark:bg-green-950">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-total-income">
              {totalIncome.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <div className="p-2 rounded-md bg-red-100 dark:bg-red-950">
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="text-total-expenses">
              {totalExpenses.toFixed(2)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
            <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-950">
              <DollarSign className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${balance >= 0 ? "text-green-600" : "text-red-600"}`} data-testid="text-balance">
              {balance.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="income" className="space-y-4">
        <TabsList>
          <TabsTrigger value="income" data-testid="tab-income">Income</TabsTrigger>
          <TabsTrigger value="expenses" data-testid="tab-expenses">Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="income" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={incomeOpen} onOpenChange={setIncomeOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-income">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Income
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Income</DialogTitle>
                  <DialogDescription>Record a new income entry</DialogDescription>
                </DialogHeader>
                <Form {...incomeForm}>
                  <form onSubmit={incomeForm.handleSubmit(onIncomeSubmit)} className="space-y-4">
                    <FormField
                      control={incomeForm.control}
                      name="source"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Source</FormLabel>
                          <FormControl>
                            <Input placeholder="Client ABC Payment" {...field} data-testid="input-source" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={incomeForm.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="5000" {...field} data-testid="input-amount" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={incomeForm.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-category">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {incomeCategories.map((cat) => (
                                  <SelectItem key={cat} value={cat}>
                                    {cat}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={incomeForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Additional details..." {...field} value={field.value ?? ""} data-testid="input-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIncomeOpen(false)}>Cancel</Button>
                      <Button type="submit" data-testid="button-submit-income">Add Income</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {incomesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="h-5 bg-muted rounded w-3/4 mb-2 animate-pulse" />
                    <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !incomes || incomes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <h3 className="text-lg font-semibold mb-2">No income recorded</h3>
                <p className="text-sm text-muted-foreground mb-4">Add your first income entry</p>
                <Button onClick={() => setIncomeOpen(true)}>Add Income</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {incomes.map((income) => (
                <Card key={income.id} data-testid={`card-income-${income.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{income.source}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{income.category}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(income.date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-lg font-bold text-green-600" data-testid={`text-amount-${income.id}`}>
                        +{Number(income.amount).toFixed(2)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-expense">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Expense</DialogTitle>
                  <DialogDescription>Record a new expense</DialogDescription>
                </DialogHeader>
                <Form {...expenseForm}>
                  <form onSubmit={expenseForm.handleSubmit(onExpenseSubmit)} className="space-y-4">
                    <FormField
                      control={expenseForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Office Supplies" {...field} data-testid="input-title" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid gap-4 md:grid-cols-2">
                      <FormField
                        control={expenseForm.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="500" {...field} data-testid="input-amount" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={expenseForm.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-category">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {expenseCategories.map((cat) => (
                                  <SelectItem key={cat} value={cat}>
                                    {cat}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={expenseForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Additional details..." {...field} value={field.value ?? ""} data-testid="input-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setExpenseOpen(false)}>Cancel</Button>
                      <Button type="submit" data-testid="button-submit-expense">Add Expense</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {expensesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="h-5 bg-muted rounded w-3/4 mb-2 animate-pulse" />
                    <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !expenses || expenses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <h3 className="text-lg font-semibold mb-2">No expenses recorded</h3>
                <p className="text-sm text-muted-foreground mb-4">Add your first expense</p>
                <Button onClick={() => setExpenseOpen(true)}>Add Expense</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {expenses.map((expense) => (
                <Card key={expense.id} data-testid={`card-expense-${expense.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold">{expense.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{expense.category}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(expense.date).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="text-lg font-bold text-red-600" data-testid={`text-amount-${expense.id}`}>
                        -{Number(expense.amount).toFixed(2)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

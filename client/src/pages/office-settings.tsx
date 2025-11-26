import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { HrSettings } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Clock, DollarSign, Users, Calendar } from "lucide-react";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const officeSettingsSchema = z.object({
  officeStartTime: z.string().min(1, "Required"),
  officeEndTime: z.string().min(1, "Required"),
  fullDayHours: z.coerce.number().min(1, "Must be at least 1 hour"),
  gracePeriodMinutes: z.coerce.number().min(0, "Cannot be negative"),
  halfDayCutoffTime: z.string().min(1, "Required"),
  halfDayHours: z.coerce.number().min(0.5, "Must be at least 0.5 hours"),
  minimumHoursForPresent: z.coerce.number().min(1, "Must be at least 1 hour"),
  overtimeEnabled: z.boolean(),
  overtimeRateMultiplier: z.coerce.number().min(1, "Must be at least 1.0"),
  lateDeductionRule: z.coerce.number().min(1, "Must be at least 1"),
  weeklyOffDays: z.array(z.string()).min(1, "Select at least one day"),
});

type OfficeSettingsFormData = z.infer<typeof officeSettingsSchema>;

export default function OfficeSettings() {
  const { toast } = useToast();
  const [settingsId, setSettingsId] = useState<string>("");

  const { data: settings, isLoading } = useQuery<HrSettings>({
    queryKey: ["/api/hr-settings"],
  });

  // Update settingsId when settings are loaded
  useEffect(() => {
    if (settings?.id) {
      setSettingsId(settings.id);
    }
  }, [settings]);

  const form = useForm<OfficeSettingsFormData>({
    resolver: zodResolver(officeSettingsSchema),
    values: settings
      ? {
          officeStartTime: settings.officeStartTime || "09:00",
          officeEndTime: settings.officeEndTime || "18:00",
          fullDayHours: Number(settings.fullDayHours) || 8,
          gracePeriodMinutes: Number(settings.gracePeriodMinutes) || 10,
          halfDayCutoffTime: settings.halfDayCutoffTime || "14:00",
          halfDayHours: Number(settings.halfDayHours) || 4,
          minimumHoursForPresent: Number(settings.minimumHoursForPresent) || 6,
          overtimeEnabled: settings.overtimeEnabled || false,
          overtimeRateMultiplier: Number(settings.overtimeRateMultiplier) || 1.5,
          lateDeductionRule: Number(settings.lateDeductionRule) || 3,
          weeklyOffDays: Array.isArray(settings.weeklyOffDays)
            ? settings.weeklyOffDays
            : ["Friday"],
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: OfficeSettingsFormData) =>
      apiRequest("PATCH", `/api/hr-settings/${settingsId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr-settings"] });
      toast({
        title: "Success",
        description: "Office settings updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: OfficeSettingsFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-8 bg-muted rounded w-48 mb-6 animate-pulse" />
        <div className="grid gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-6 bg-muted rounded w-32 mb-2 animate-pulse" />
                <div className="h-4 bg-muted rounded w-48 animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">
          Office Hours Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure timing rules for attendance and salary calculations
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Office Timings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <CardTitle>Office Timings</CardTitle>
              </div>
              <CardDescription>
                Set the standard office hours and working time
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="officeStartTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Office Start Time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        data-testid="input-office-start-time"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="officeEndTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Office End Time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        data-testid="input-office-end-time"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fullDayHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Working Hours per Day</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        {...field}
                        data-testid="input-full-day-hours"
                      />
                    </FormControl>
                    <FormDescription>Standard hours for full day</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gracePeriodMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grace Period (Minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        data-testid="input-grace-period"
                      />
                    </FormControl>
                    <FormDescription>
                      Allowed delay before marking as late
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Attendance Rules */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <CardTitle>Attendance Rules</CardTitle>
              </div>
              <CardDescription>
                Configure half-day and present/absent criteria
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="halfDayCutoffTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Half-Day Cutoff Time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        data-testid="input-half-day-cutoff"
                      />
                    </FormControl>
                    <FormDescription>
                      Check-in after this time = half day
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="halfDayHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Half-Day Working Hours</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        {...field}
                        data-testid="input-half-day-hours"
                      />
                    </FormControl>
                    <FormDescription>Hours required for half day</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="minimumHoursForPresent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Minimum Hours for Present</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.5"
                        {...field}
                        data-testid="input-minimum-hours"
                      />
                    </FormControl>
                    <FormDescription>
                      Below this = marked absent
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lateDeductionRule"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Late Count Threshold</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        data-testid="input-late-threshold"
                      />
                    </FormControl>
                    <FormDescription>
                      This many lates = 1 absent
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Overtime Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                <CardTitle>Overtime Configuration</CardTitle>
              </div>
              <CardDescription>
                Configure overtime pay calculations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="overtimeEnabled"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Enable Overtime Calculation
                      </FormLabel>
                      <FormDescription>
                        Calculate and pay for extra working hours
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-overtime-enabled"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="overtimeRateMultiplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Overtime Rate Multiplier</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        {...field}
                        disabled={!form.watch("overtimeEnabled")}
                        data-testid="input-overtime-multiplier"
                      />
                    </FormControl>
                    <FormDescription>
                      E.g., 1.5 = 1.5× normal hourly rate
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Weekly Off Days */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <CardTitle>Weekly Off Days</CardTitle>
              </div>
              <CardDescription>
                Select weekly holidays (non-working days)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="weeklyOffDays"
                render={() => (
                  <FormItem>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {DAYS_OF_WEEK.map((day) => (
                        <FormField
                          key={day}
                          control={form.control}
                          name="weeklyOffDays"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={day}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(day)}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([...field.value, day])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== day
                                            )
                                          );
                                    }}
                                    data-testid={`checkbox-day-${day.toLowerCase()}`}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  {day}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              data-testid="button-save-settings"
            >
              {updateMutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

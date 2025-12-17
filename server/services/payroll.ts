/**
 * Payroll Calculation Service
 * Handles monthly payroll generation with late deduction logic
 */

import { db } from "../db";
import {
  employees,
  attendance,
  salaryStructure,
  payroll,
  salarySlips,
  hrSettings
} from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { toDateOnlyString } from "@shared/date-utils";

class PayrollService {
  /**
   * Calculate late deduction based on configurable rule: floor(late_days / lateDeductionRule) * day_salary
   */
  private calculateLateDeduction(lateDaysCount: number, monthlySalary: number, lateDeductionRule: number, workingDaysPerMonth: number = 26): number {
    const daySalary = monthlySalary / workingDaysPerMonth;
    const deductionDays = Math.floor(lateDaysCount / lateDeductionRule);
    return deductionDays * daySalary;
  }

  /**
   * Generate payroll for a specific employee for a given month/year
   */
  async generateEmployeePayroll(employeeId: string, month: number, year: number): Promise<any> {
    try {
      // Get employee details
      const [employee] = await db.select()
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);

      if (!employee) {
        throw new Error(`Employee not found: ${employeeId}`);
      }

      // Get salary structure
      const [salary] = await db.select()
        .from(salaryStructure)
        .where(eq(salaryStructure.employeeId, employeeId))
        .orderBy(sql`${salaryStructure.effectiveFrom} DESC`)
        .limit(1);

      if (!salary) {
        throw new Error(`No salary structure found for employee: ${employeeId}`);
      }

      // Get HR settings for calculations
      const [settings] = await db.select().from(hrSettings).limit(1);

      // Use configured office settings with fallback defaults
      const fullDayHours = settings?.fullDayHours ? parseFloat(settings.fullDayHours.toString()) : 8;
      const overtimeEnabled = settings?.overtimeEnabled ?? false;
      const overtimeRateMultiplier = settings?.overtimeRateMultiplier ? parseFloat(settings.overtimeRateMultiplier.toString()) : 1.5;
      const lateDeductionRule = settings?.lateDeductionRule ? parseInt(settings.lateDeductionRule.toString()) : 3;

      // Calculate date range for the month (timezone-safe)
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0); // Last day of month
      const startDateStr = toDateOnlyString(startDate);
      const endDateStr = toDateOnlyString(endDate);

      // Calculate actual working days in the month (excluding weekly offs)
      const weeklyOffDays = (Array.isArray(settings?.weeklyOffDays) ? settings.weeklyOffDays : ["Friday"]) as string[];
      const dayOfWeekMap: { [key: string]: number } = {
        "Sunday": 0, "Monday": 1, "Tuesday": 2, "Wednesday": 3,
        "Thursday": 4, "Friday": 5, "Saturday": 6
      };
      const offDayNumbers = weeklyOffDays.map((day: string) => dayOfWeekMap[day]).filter((num: number | undefined) => num !== undefined) as number[];

      // Count working days in the month
      let workingDaysInMonth = 0;
      const totalDaysInMonth = endDate.getDate();
      for (let day = 1; day <= totalDaysInMonth; day++) {
        const currentDate = new Date(year, month - 1, day);
        const dayOfWeek = currentDate.getDay();
        if (!offDayNumbers.includes(dayOfWeek)) {
          workingDaysInMonth++;
        }
      }

      // Get attendance records for the month
      const attendanceRecords = await db.select()
        .from(attendance)
        .where(and(
          eq(attendance.userId, employee.userId!),
          sql`${attendance.date} >= ${startDateStr}`,
          sql`${attendance.date} <= ${endDateStr}`
        ));

      console.log(`🔍 PAYROLL DEBUG - Employee: ${employee.employeeId}`);
      console.log(`🔍 Date Range: ${startDateStr} to ${endDateStr}`);
      console.log(`🔍 Total attendance records fetched: ${attendanceRecords.length}`);
      console.log(`🔍 Attendance records:`, attendanceRecords.map(r => ({ date: r.date, status: r.status })));

      // Calculate attendance metrics
      const presentDays = attendanceRecords.filter(a => a.status === 'present' || a.status === 'late').length;
      const lateDays = attendanceRecords.filter(a => a.status === 'late').length;
      const absentDays = attendanceRecords.filter(a => a.status === 'absent').length;
      const halfDays = attendanceRecords.filter(a => a.status === 'half-day').length;

      console.log(`🔍 CALCULATED - Present: ${presentDays}, Late: ${lateDays}, Absent: ${absentDays}, Half-Day: ${halfDays}`);

      // Calculate overtime hours from actual check-in/check-out times (only if enabled)
      let totalOvertimeHours = 0;

      if (overtimeEnabled) {
        for (const record of attendanceRecords) {
          if (record.checkIn && record.checkOut) {
            const checkInTime = new Date(record.checkIn);
            const checkOutTime = new Date(record.checkOut);
            const hoursWorked = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

            if (hoursWorked > fullDayHours) {
              totalOvertimeHours += (hoursWorked - fullDayHours);
            }
          }
        }
      }

      // Calculate components
      const basicSalary = parseFloat(salary.basicSalary.toString());
      const houseAllowance = parseFloat(salary.houseAllowance?.toString() || '0');
      const foodAllowance = parseFloat(salary.foodAllowance?.toString() || '0');
      const travelAllowance = parseFloat(salary.travelAllowance?.toString() || '0');
      const medicalAllowance = parseFloat(salary.medicalAllowance?.toString() || '0');

      const grossSalary = basicSalary + houseAllowance + foodAllowance + travelAllowance + medicalAllowance;

      // Calculate deductions using configured office settings and actual working days
      const effectiveWorkingDays = workingDaysInMonth > 0 ? workingDaysInMonth : 26; // Fallback to 26 if calculation fails
      const dailyRate = basicSalary / effectiveWorkingDays;
      const hourlyRate = dailyRate / fullDayHours; // Hourly rate based on configured full-day hours

      // Late deduction: Using configured late deduction rule and actual working days
      const lateDeduction = this.calculateLateDeduction(lateDays, basicSalary, lateDeductionRule, effectiveWorkingDays);

      console.log(`🔍 LATE CALCULATION - Late Days: ${lateDays}, Basic: ${basicSalary}, Rule: ${lateDeductionRule}, Working Days: ${effectiveWorkingDays}`);
      console.log(`🔍 LATE DEDUCTION CALCULATED: ${lateDeduction}`);

      // Half-day deduction: 0.5 × Daily Rate
      const halfDayDeduction = halfDays * (dailyRate * 0.5);

      // Absent deduction: Daily Rate × Absent Days
      const absentDeduction = absentDays * dailyRate;

      // Loan and advance deductions (set to 0 during initial generation - can be added via manual adjustments later)
      const loanDeduction = 0;
      const advanceDeduction = 0;

      const totalDeductions = lateDeduction + halfDayDeduction + absentDeduction + loanDeduction + advanceDeduction;

      // Calculate overtime: Using configured overtime rate multiplier
      const overtimeAmount = overtimeEnabled ? (totalOvertimeHours * (hourlyRate * overtimeRateMultiplier)) : 0;

      // Calculate net salary
      const netSalary = grossSalary + overtimeAmount - totalDeductions;

      // Create payroll record with full attendance breakdown
      const payrollData = {
        employeeId: employeeId,
        month,
        year,
        basicSalary: basicSalary.toString(),
        totalAllowances: (houseAllowance + foodAllowance + travelAllowance + medicalAllowance).toString(),
        overtimeAmount: overtimeAmount.toString(),
        lateDeduction: lateDeduction.toString(),
        loanDeduction: loanDeduction.toString(),
        otherDeductions: (halfDayDeduction + absentDeduction).toString(),
        grossSalary: grossSalary.toString(),
        netSalary: netSalary.toString(),
        totalPresentDays: presentDays,
        totalAbsentDays: absentDays,
        totalLateDays: lateDays,
        totalHalfDays: halfDays,
        totalOvertimeHours: (Math.round(totalOvertimeHours * 100) / 100).toString(),
        workingDays: workingDaysInMonth, // Actual working days excluding weekly offs
      };

      return payrollData;
    } catch (error: any) {
      console.error(`Error generating payroll for employee ${employeeId}:`, error.message);
      throw error;
    }
  }

  /**
   * Generate payroll for all active employees for a given month/year
   */
  async generateMonthlyPayroll(month: number, year: number, generatedBy: string): Promise<number> {
    try {
      // Get all active employees
      const activeEmployees = await db.select()
        .from(employees)
        .where(eq(employees.status, 'active'));

      console.log(`Generating payroll for ${activeEmployees.length} employees for ${year}-${month}`);

      let generatedCount = 0;

      for (const employee of activeEmployees) {
        try {
          // Check if payroll already exists
          const [existing] = await db.select()
            .from(payroll)
            .where(and(
              eq(payroll.employeeId, employee.id),
              eq(payroll.month, month),
              eq(payroll.year, year)
            ))
            .limit(1);

          if (existing) {
            console.log(`Payroll already exists for employee ${employee.employeeId} for ${year}-${month}`);
            continue;
          }

          // Generate payroll
          const payrollData = await this.generateEmployeePayroll(employee.id, month, year);

          // Insert payroll record
          await db.insert(payroll).values({
            ...payrollData,
            generatedBy,
          });

          generatedCount++;
        } catch (error: any) {
          console.error(`Failed to generate payroll for employee ${employee.employeeId}:`, error.message);
        }
      }

      console.log(`Successfully generated ${generatedCount} payroll records`);
      return generatedCount;
    } catch (error: any) {
      console.error('Error generating monthly payroll:', error.message);
      throw error;
    }
  }
}

export const payrollService = new PayrollService();

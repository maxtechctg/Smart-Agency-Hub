/**
 * Response Serialization Utilities
 * 
 * Ensures consistent date serialization in API responses
 * Converts JavaScript Date objects to ISO strings
 */

import { toDateTimeString, toDateOnlyString } from "@shared/date-utils";

/**
 * Fields that should be serialized as date-only strings (YYYY-MM-DD)
 */
const DATE_ONLY_FIELDS = new Set([
  "followUpDate",
  "deadline",
  "dueDate",
  "date", // for attendance, income, expenses
  "sentDate",
  "joiningDate", // employees
  "dateOfBirth", // employees
  "startDate", // leave_requests
  "endDate", // leave_requests
  "effectiveFrom", // salary_structure
]);

/**
 * Fields that should be serialized as datetime strings
 */
const DATE_TIME_FIELDS = new Set([
  "createdAt",
  "checkIn",
  "checkOut",
  "paymentDate",
  "lastFollowUpReminderAt",
  "lastReminderSentAt",
  "lastSyncAt", // attendance_devices
  "punchTime", // device_logs
  "syncedAt", // device_logs
  "approvedAt", // leave_requests, punch_corrections
  "requestedCheckIn", // punch_corrections
  "requestedCheckOut", // punch_corrections
  "paidAt", // payroll
  "generatedAt", // salary_slips
  "emailedAt", // salary_slips
  "updatedAt", // hr_settings
]);

/**
 * Serializes a single record by converting Date fields to ISO strings
 * Recursively processes nested objects and arrays
 * @param record - Database record with potential Date fields
 * @returns Serialized record with string dates
 */
export function serializeRecord<T extends Record<string, any>>(record: T): T {
  if (!record) return record;

  const serialized: any = { ...record };

  for (const [key, value] of Object.entries(serialized)) {
    if (value === null || value === undefined) {
      // Keep null/undefined as-is
      serialized[key] = value;
    } else if (value instanceof Date) {
      // Check if this field should be date-only or datetime
      if (DATE_ONLY_FIELDS.has(key)) {
        serialized[key] = toDateOnlyString(value);
      } else if (DATE_TIME_FIELDS.has(key)) {
        serialized[key] = toDateTimeString(value);
      } else {
        // Default to datetime for unknown date fields
        serialized[key] = toDateTimeString(value);
      }
    } else if (Array.isArray(value)) {
      // Recursively serialize array items
      serialized[key] = value.map(item => {
        if (item && typeof item === 'object' && !(item instanceof Date)) {
          return serializeRecord(item);
        }
        return item;
      });
    } else if (typeof value === 'object') {
      // Recursively serialize nested objects
      serialized[key] = serializeRecord(value);
    }
  }

  return serialized as T;
}

/**
 * Serializes an array of records
 * @param records - Array of database records
 * @returns Array of serialized records
 */
export function serializeRecords<T extends Record<string, any>>(records: T[]): T[] {
  return records.map(serializeRecord);
}

/**
 * Deep serializes any value, including nested objects and arrays
 * Uses explicit field name mapping to determine date vs datetime format
 * Recursively uses serializeRecord for nested objects to preserve field context
 * @param value - Any value to serialize
 * @returns Serialized value with Date objects converted to strings
 */
function deepSerialize(value: any): any {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    // Default to datetime for loose Date objects (no field context)
    return toDateTimeString(value);
  }

  if (Array.isArray(value)) {
    return value.map(item => {
      // For arrays of objects (records), use serializeRecord to preserve field context
      if (item && typeof item === 'object' && !(item instanceof Date)) {
        return serializeRecord(item);
      }
      return deepSerialize(item);
    });
  }

  if (typeof value === 'object') {
    // Check if this looks like a data record (has date fields we care about)
    const hasKnownDateFields = Object.keys(value).some(key => 
      DATE_ONLY_FIELDS.has(key) || DATE_TIME_FIELDS.has(key)
    );

    if (hasKnownDateFields) {
      // Use serializeRecord to preserve field-specific date handling
      return serializeRecord(value);
    }

    // For wrapper objects without known date fields, serialize values recursively
    const serialized: any = {};
    for (const [key, val] of Object.entries(value)) {
      serialized[key] = deepSerialize(val);
    }
    return serialized;
  }

  return value;
}

/**
 * Express middleware to automatically serialize response data
 * Wraps res.json to serialize dates before sending
 * Handles nested objects, arrays, and success/error wrappers
 */
export function serializeResponseMiddleware(req: any, res: any, next: any) {
  const originalJson = res.json.bind(res);

  res.json = function (data: any) {
    const serialized = deepSerialize(data);
    return originalJson(serialized);
  };

  next();
}

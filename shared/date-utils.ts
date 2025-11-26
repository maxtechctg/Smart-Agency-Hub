/**
 * Date Handling Utilities
 * 
 * Provides consistent date serialization/deserialization across the application
 * to prevent timezone drift and handle optional dates properly.
 */

/**
 * Regex for date-only strings (YYYY-MM-DD)
 */
export const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Regex for ISO datetime strings
 */
export const DATE_TIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;

/**
 * Converts a Date object to an ISO datetime string
 * @param date - JavaScript Date object or ISO string
 * @returns ISO datetime string (e.g., "2025-11-16T12:30:00.000Z")
 */
export function toDateTimeString(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  if (typeof date === 'string') return date;
  return date.toISOString();
}

/**
 * Converts a Date object to a date-only string (YYYY-MM-DD)
 * Prevents timezone drift by extracting only the date portion
 * @param date - JavaScript Date object or date string
 * @returns Date-only string (e.g., "2025-11-16")
 */
export function toDateOnlyString(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  
  // If already a date-only string, return as-is
  if (typeof date === 'string' && DATE_ONLY_REGEX.test(date)) {
    return date;
  }
  
  // Convert to Date if string, then extract date portion
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString().split('T')[0];
}

/**
 * Parses an optional date string to a Date object
 * Handles null, undefined, and empty strings gracefully
 * Validates that the resulting Date is valid
 * @param value - Date string, Date object, null, undefined, or empty string
 * @returns Date object or null
 */
export function parseOptionalDate(value: string | Date | null | undefined): Date | null {
  if (!value || value === '') return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value;
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return date;
}

/**
 * Parses a required date string to a Date object
 * Throws error if value is missing or invalid
 * @param value - Date string or Date object
 * @returns Date object
 */
export function parseRequiredDate(value: string | Date): Date {
  if (!value || value === '') {
    throw new Error('Date value is required');
  }
  if (value instanceof Date) return value;
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return date;
}

/**
 * Normalizes a date value from form inputs
 * Converts empty strings to null, preserves valid dates
 * @param value - Form input value (string, Date, or empty)
 * @returns Date-only string or null
 */
export function normalizeDateInput(value: string | Date | null | undefined): string | null {
  if (!value || value === '') return null;
  return toDateOnlyString(value);
}

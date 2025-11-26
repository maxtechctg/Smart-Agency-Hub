/**
 * Frontend Date Normalization Utilities
 * 
 * Normalizes date inputs from forms before sending to API
 * Ensures consistent date format and handles empty strings
 */

/**
 * Normalizes form data before mutation (DATE-ONLY fields)
 * - Converts empty string dates to undefined
 * - Converts Date objects to YYYY-MM-DD strings
 * - Leaves valid date strings as-is
 * 
 * @param data - Form data object with potential date fields
 * @param dateFields - Array of field names that contain date-only values
 * @returns Normalized data ready for API submission
 */
export function normalizeDateInputs<T extends Record<string, any>>(
  data: T,
  dateFields: string[]
): T {
  const normalized: any = { ...data };

  for (const field of dateFields) {
    const value = normalized[field];

    // Convert empty strings to undefined
    if (value === "" || value === null) {
      normalized[field] = undefined;
      continue;
    }

    // Convert Date objects to YYYY-MM-DD strings
    if (value instanceof Date) {
      normalized[field] = value.toISOString().split('T')[0];
      continue;
    }

    // Leave valid strings as-is
    if (typeof value === 'string') {
      normalized[field] = value;
    }
  }

  return normalized as T;
}

/**
 * Normalizes form data before mutation (DATETIME fields)
 * - Converts empty string datetimes to undefined
 * - Converts Date objects to full ISO timestamp strings
 * - Leaves valid datetime strings as-is
 * 
 * @param data - Form data object with potential datetime fields
 * @param dateTimeFields - Array of field names that contain datetime values
 * @returns Normalized data ready for API submission
 */
export function normalizeDateTimeInputs<T extends Record<string, any>>(
  data: T,
  dateTimeFields: string[]
): T {
  const normalized: any = { ...data };

  for (const field of dateTimeFields) {
    const value = normalized[field];

    // Convert empty strings to undefined
    if (value === "" || value === null) {
      normalized[field] = undefined;
      continue;
    }

    // Convert Date objects to full ISO timestamp strings
    if (value instanceof Date) {
      normalized[field] = value.toISOString();
      continue;
    }

    // Leave valid strings as-is
    if (typeof value === 'string') {
      normalized[field] = value;
    }
  }

  return normalized as T;
}

/**
 * Pre-configured normalization for lead data
 */
export function normalizeLeadData<T extends Record<string, any>>(data: T): T {
  return normalizeDateInputs(data, ['followUpDate']);
}

/**
 * Pre-configured normalization for project data
 */
export function normalizeProjectData<T extends Record<string, any>>(data: T): T {
  return normalizeDateInputs(data, ['deadline']);
}

/**
 * Pre-configured normalization for task data
 */
export function normalizeTaskData<T extends Record<string, any>>(data: T): T {
  return normalizeDateInputs(data, ['deadline']);
}

/**
 * Pre-configured normalization for invoice data
 */
export function normalizeInvoiceData<T extends Record<string, any>>(data: T): T {
  return normalizeDateInputs(data, ['dueDate', 'sentDate']);
}

/**
 * Pre-configured normalization for attendance data
 * date: date-only field
 * checkIn, checkOut: datetime fields
 */
export function normalizeAttendanceData<T extends Record<string, any>>(data: T): T {
  let normalized = normalizeDateInputs(data, ['date']);
  normalized = normalizeDateTimeInputs(normalized, ['checkIn', 'checkOut']);
  return normalized;
}

/**
 * Pre-configured normalization for income data
 */
export function normalizeIncomeData<T extends Record<string, any>>(data: T): T {
  return normalizeDateInputs(data, ['date']);
}

/**
 * Pre-configured normalization for expense data
 */
export function normalizeExpenseData<T extends Record<string, any>>(data: T): T {
  return normalizeDateInputs(data, ['date']);
}

/**
 * Pre-configured normalization for payment data
 * paymentDate: datetime field
 */
export function normalizePaymentData<T extends Record<string, any>>(data: T): T {
  return normalizeDateTimeInputs(data, ['paymentDate']);
}

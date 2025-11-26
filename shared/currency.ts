import Decimal from 'decimal.js-light';

// Configure Decimal for financial calculations
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Format currency with BDT prefix and proper decimal handling
 * Uses Decimal.js for precision-safe calculations
 */
export function formatCurrency(amount: string | number | Decimal, options: { prefix?: 'BDT' | '' } = { prefix: 'BDT' }): string {
  try {
    // Convert to Decimal for precision
    const decimal = new Decimal(amount || 0);
    
    // Round to 2 decimal places (half-up rounding)
    const rounded = decimal.toFixed(2);
    
    // Split into integer and decimal parts
    const [integerPart, decimalPart] = rounded.split('.');
    
    // Add commas to integer part
    const withCommas = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    
    // Construct final formatted string
    const formatted = `${withCommas}.${decimalPart}`;
    
    // Add prefix if requested
    return options.prefix ? `${options.prefix} ${formatted}` : formatted;
  } catch (error) {
    // Fallback for invalid inputs
    return options.prefix === 'BDT' ? 'BDT 0.00' : '0.00';
  }
}

/**
 * Parse currency string or number to Decimal
 * Removes commas and handles various input formats
 */
export function parseCurrency(value: string | number): Decimal {
  try {
    // Remove BDT prefix and commas
    const cleaned = String(value)
      .replace(/BDT/gi, '')
      .replace(/,/g, '')
      .trim();
    
    return new Decimal(cleaned || 0);
  } catch (error) {
    return new Decimal(0);
  }
}

/**
 * Calculate line total from quantity and rate
 */
export function calculateLineTotal(quantity: string | number, rate: string | number): string {
  const qty = new Decimal(quantity || 0);
  const rateDecimal = new Decimal(rate || 0);
  return qty.times(rateDecimal).toFixed(2);
}

/**
 * Sum an array of amounts
 */
export function sumAmounts(amounts: (string | number)[]): string {
  const total = amounts.reduce((sum, amount) => {
    return sum.plus(new Decimal(amount || 0));
  }, new Decimal(0));
  
  return total.toFixed(2);
}

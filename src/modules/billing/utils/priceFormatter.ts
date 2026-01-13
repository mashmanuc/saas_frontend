/**
 * Price Formatter Utility (v0.75.0)
 * 
 * Formats prices from minor units (kopiykas/cents) to major units with currency symbols.
 * 
 * REQUIREMENTS:
 * - Convert minor to major: amount_minor / factor(currency)
 * - factor = 100 for most currencies
 * - No decimals if .00 (499.00 → 499)
 * - Currency symbols: UAH → ₴, USD → $
 */

/**
 * Currency configuration
 */
const CURRENCY_CONFIG: Record<string, { factor: number; symbol: string; position: 'before' | 'after' }> = {
  UAH: { factor: 100, symbol: '₴', position: 'after' },
  USD: { factor: 100, symbol: '$', position: 'before' },
  EUR: { factor: 100, symbol: '€', position: 'before' },
  // Fallback for unknown currencies
  DEFAULT: { factor: 100, symbol: '', position: 'after' }
}

/**
 * Format price from minor units to human-readable string
 * 
 * @param amountMinor - Price in minor units (kopiykas/cents)
 * @param currency - Currency code (UAH, USD, EUR)
 * @returns Formatted price string with currency symbol
 * 
 * @example
 * formatPrice(49900, 'UAH') // "499 ₴"
 * formatPrice(49950, 'UAH') // "499.50 ₴"
 * formatPrice(0, 'UAH') // "0 ₴"
 * formatPrice(5000, 'USD') // "$50"
 */
export function formatPrice(amountMinor: number, currency: string = 'UAH'): string {
  const config = CURRENCY_CONFIG[currency.toUpperCase()] || CURRENCY_CONFIG.DEFAULT
  
  // Convert to major units
  const amountMajor = amountMinor / config.factor
  
  // Format without decimals if .00, otherwise show 2 decimals
  const hasDecimals = amountMajor % 1 !== 0
  const formattedAmount = hasDecimals 
    ? amountMajor.toFixed(2)
    : amountMajor.toString()
  
  // Add currency symbol
  if (config.position === 'before') {
    return `${config.symbol}${formattedAmount}`
  } else {
    return `${formattedAmount} ${config.symbol || currency.toUpperCase()}`
  }
}

/**
 * Get currency symbol for a currency code
 * 
 * @param currency - Currency code
 * @returns Currency symbol or code if no symbol defined
 */
export function getCurrencySymbol(currency: string): string {
  const config = CURRENCY_CONFIG[currency.toUpperCase()] || CURRENCY_CONFIG.DEFAULT
  return config.symbol || currency.toUpperCase()
}

/**
 * Convert minor units to major units
 * 
 * @param amountMinor - Amount in minor units
 * @param currency - Currency code
 * @returns Amount in major units
 */
export function minorToMajor(amountMinor: number, currency: string = 'UAH'): number {
  const config = CURRENCY_CONFIG[currency.toUpperCase()] || CURRENCY_CONFIG.DEFAULT
  return amountMinor / config.factor
}

/**
 * Format money from major units (v0.76.0)
 * 
 * Source of truth for price formatting.
 * API returns amount in MAJOR units (e.g., 999 UAH, not 99900 kopiykas).
 * 
 * @param amount - Price in major units (UAH, USD)
 * @param currency - Currency code (UAH, USD, EUR)
 * @returns Formatted price string with currency symbol
 * 
 * @example
 * formatMoney(999, 'UAH') // "999 ₴"
 * formatMoney(999.50, 'UAH') // "999.50 ₴"
 * formatMoney(0, 'UAH') // "0 ₴"
 * formatMoney(50, 'USD') // "$50"
 */
export function formatMoney(amount: number, currency: string = 'UAH'): string {
  const config = CURRENCY_CONFIG[currency.toUpperCase()] || CURRENCY_CONFIG.DEFAULT
  
  // Format without decimals if .00, otherwise show 2 decimals
  const hasDecimals = amount % 1 !== 0
  const formattedAmount = hasDecimals 
    ? amount.toFixed(2)
    : amount.toString()
  
  // Add currency symbol
  if (config.position === 'before') {
    return `${config.symbol}${formattedAmount}`
  } else {
    return `${formattedAmount} ${config.symbol || currency.toUpperCase()}`
  }
}

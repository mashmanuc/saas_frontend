/**
 * Price Formatter Unit Tests (v0.75.0)
 * 
 * Tests for price formatting utility
 */

import { describe, it, expect } from 'vitest'
import { formatPrice, getCurrencySymbol, minorToMajor } from '../priceFormatter'

describe('priceFormatter', () => {
  describe('formatPrice', () => {
    it('formats UAH prices correctly', () => {
      expect(formatPrice(49900, 'UAH')).toBe('499 ₴')
      expect(formatPrice(0, 'UAH')).toBe('0 ₴')
      expect(formatPrice(100, 'UAH')).toBe('1 ₴')
    })

    it('formats UAH prices with decimals when needed', () => {
      expect(formatPrice(49950, 'UAH')).toBe('499.50 ₴')
      expect(formatPrice(49999, 'UAH')).toBe('499.99 ₴')
      expect(formatPrice(150, 'UAH')).toBe('1.50 ₴')
    })

    it('formats USD prices correctly', () => {
      expect(formatPrice(5000, 'USD')).toBe('$50')
      expect(formatPrice(0, 'USD')).toBe('$0')
      expect(formatPrice(100, 'USD')).toBe('$1')
    })

    it('formats USD prices with decimals when needed', () => {
      expect(formatPrice(5050, 'USD')).toBe('$50.50')
      expect(formatPrice(5099, 'USD')).toBe('$50.99')
      expect(formatPrice(150, 'USD')).toBe('$1.50')
    })

    it('formats EUR prices correctly', () => {
      expect(formatPrice(5000, 'EUR')).toBe('€50')
      expect(formatPrice(5050, 'EUR')).toBe('€50.50')
    })

    it('handles unknown currencies with fallback', () => {
      expect(formatPrice(5000, 'GBP')).toBe('50 GBP')
      expect(formatPrice(5050, 'GBP')).toBe('50.50 GBP')
    })

    it('handles case-insensitive currency codes', () => {
      expect(formatPrice(5000, 'uah')).toBe('50 ₴')
      expect(formatPrice(5000, 'usd')).toBe('$50')
      expect(formatPrice(5000, 'eur')).toBe('€50')
    })

    it('defaults to UAH when currency not specified', () => {
      expect(formatPrice(5000)).toBe('50 ₴')
    })

    it('handles large amounts correctly', () => {
      expect(formatPrice(100000000, 'UAH')).toBe('1000000 ₴')
      expect(formatPrice(999999, 'UAH')).toBe('9999.99 ₴')
    })

    it('handles zero amount', () => {
      expect(formatPrice(0, 'UAH')).toBe('0 ₴')
      expect(formatPrice(0, 'USD')).toBe('$0')
    })
  })

  describe('getCurrencySymbol', () => {
    it('returns correct symbols for known currencies', () => {
      expect(getCurrencySymbol('UAH')).toBe('₴')
      expect(getCurrencySymbol('USD')).toBe('$')
      expect(getCurrencySymbol('EUR')).toBe('€')
    })

    it('returns currency code for unknown currencies', () => {
      expect(getCurrencySymbol('GBP')).toBe('GBP')
      expect(getCurrencySymbol('JPY')).toBe('JPY')
    })

    it('handles case-insensitive input', () => {
      expect(getCurrencySymbol('uah')).toBe('₴')
      expect(getCurrencySymbol('usd')).toBe('$')
    })
  })

  describe('minorToMajor', () => {
    it('converts minor to major units correctly', () => {
      expect(minorToMajor(49900, 'UAH')).toBe(499)
      expect(minorToMajor(5000, 'USD')).toBe(50)
      expect(minorToMajor(100, 'EUR')).toBe(1)
    })

    it('handles decimals correctly', () => {
      expect(minorToMajor(49950, 'UAH')).toBe(499.5)
      expect(minorToMajor(5099, 'USD')).toBe(50.99)
    })

    it('handles zero amount', () => {
      expect(minorToMajor(0, 'UAH')).toBe(0)
      expect(minorToMajor(0, 'USD')).toBe(0)
    })

    it('defaults to UAH when currency not specified', () => {
      expect(minorToMajor(5000)).toBe(50)
    })
  })
})

/**
 * Unit tests for checkoutHelper (v0.73.0)
 * 
 * Tests for checkout form submission utilities.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { submitCheckoutForm, validateCheckoutResponse } from '../checkoutHelper'
import type { CheckoutDetails } from '../../api/billingApi'

describe('checkoutHelper', () => {
  describe('validateCheckoutResponse', () => {
    it('should validate correct LiqPay checkout response', () => {
      const checkoutDetails: CheckoutDetails = {
        method: 'POST',
        url: 'https://www.liqpay.ua/api/3/checkout',
        form_fields: {
          data: 'base64data',
          signature: 'base64signature'
        }
      }

      expect(() => {
        validateCheckoutResponse('liqpay', 'order_123', checkoutDetails)
      }).not.toThrow()
    })

    it('should throw error if provider is missing', () => {
      const checkoutDetails: CheckoutDetails = {
        method: 'POST',
        url: 'https://example.com',
        form_fields: { data: 'test', signature: 'test' }
      }

      expect(() => {
        validateCheckoutResponse('', 'session_123', checkoutDetails)
      }).toThrow('Invalid checkout response: missing provider or session_id')
    })

    it('should throw error if session_id is missing', () => {
      const checkoutDetails: CheckoutDetails = {
        method: 'POST',
        url: 'https://example.com',
        form_fields: { data: 'test', signature: 'test' }
      }

      expect(() => {
        validateCheckoutResponse('liqpay', '', checkoutDetails)
      }).toThrow('Invalid checkout response: missing provider or session_id')
    })

    it('should throw error if checkout details are missing', () => {
      expect(() => {
        validateCheckoutResponse('liqpay', 'session_123', null as any)
      }).toThrow('Invalid checkout response: missing checkout details')
    })

    it('should throw error if method is not POST', () => {
      const checkoutDetails = {
        method: 'GET',
        url: 'https://example.com',
        form_fields: { data: 'test', signature: 'test' }
      } as any

      expect(() => {
        validateCheckoutResponse('liqpay', 'session_123', checkoutDetails)
      }).toThrow('Unsupported checkout method: GET')
    })

    it('should throw error if LiqPay data is missing', () => {
      const checkoutDetails: CheckoutDetails = {
        method: 'POST',
        url: 'https://www.liqpay.ua/api/3/checkout',
        form_fields: {
          signature: 'base64signature'
        } as any
      }

      expect(() => {
        validateCheckoutResponse('liqpay', 'order_123', checkoutDetails)
      }).toThrow('Invalid LiqPay checkout: missing data or signature')
    })

    it('should throw error if LiqPay signature is missing', () => {
      const checkoutDetails: CheckoutDetails = {
        method: 'POST',
        url: 'https://www.liqpay.ua/api/3/checkout',
        form_fields: {
          data: 'base64data'
        } as any
      }

      expect(() => {
        validateCheckoutResponse('liqpay', 'order_123', checkoutDetails)
      }).toThrow('Invalid LiqPay checkout: missing data or signature')
    })

    it('should validate Stripe checkout without specific field requirements', () => {
      const checkoutDetails: CheckoutDetails = {
        method: 'POST',
        url: 'https://checkout.stripe.com/session',
        form_fields: {
          data: 'stripe_data',
          signature: 'stripe_signature',
          session_id: 'cs_test_123'
        }
      }

      expect(() => {
        validateCheckoutResponse('stripe', 'session_123', checkoutDetails)
      }).not.toThrow()
    })
  })

  describe('submitCheckoutForm', () => {
    let formSubmitSpy: any

    beforeEach(() => {
      // Mock form.submit()
      formSubmitSpy = vi.fn()
      const originalCreateElement = document.createElement.bind(document)
      vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const element = originalCreateElement(tagName)
        if (tagName === 'form') {
          element.submit = formSubmitSpy
        }
        return element
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
      // Clean up any forms that might have been added
      document.querySelectorAll('form[style*="display: none"]').forEach(form => {
        if (form.parentNode) {
          form.parentNode.removeChild(form)
        }
      })
    })

    it('should create and submit form with correct fields', () => {
      const checkoutDetails: CheckoutDetails = {
        method: 'POST',
        url: 'https://www.liqpay.ua/api/3/checkout',
        form_fields: {
          data: 'base64data',
          signature: 'base64signature'
        }
      }

      submitCheckoutForm(checkoutDetails)

      expect(formSubmitSpy).toHaveBeenCalled()
    })

    it('should set correct form attributes', () => {
      const checkoutDetails: CheckoutDetails = {
        method: 'POST',
        url: 'https://www.liqpay.ua/api/3/checkout',
        form_fields: {
          data: 'test_data',
          signature: 'test_signature'
        }
      }

      const appendChildSpy = vi.spyOn(document.body, 'appendChild')

      submitCheckoutForm(checkoutDetails)

      expect(appendChildSpy).toHaveBeenCalled()
      const form = appendChildSpy.mock.calls[0][0] as HTMLFormElement
      expect(form.method).toBe('POST')
      expect(form.action).toBe('https://www.liqpay.ua/api/3/checkout')
      expect(form.style.display).toBe('none')
    })

    it('should create hidden inputs for all form fields', () => {
      const checkoutDetails: CheckoutDetails = {
        method: 'POST',
        url: 'https://example.com/checkout',
        form_fields: {
          data: 'test_data',
          signature: 'test_signature',
          custom_field: 'custom_value'
        }
      }

      const appendChildSpy = vi.spyOn(document.body, 'appendChild')

      submitCheckoutForm(checkoutDetails)

      const form = appendChildSpy.mock.calls[0][0] as HTMLFormElement
      const inputs = form.querySelectorAll('input[type="hidden"]')
      
      expect(inputs).toHaveLength(3)
      
      const dataInput = Array.from(inputs).find(input => input.getAttribute('name') === 'data')
      expect(dataInput?.getAttribute('value')).toBe('test_data')
      
      const signatureInput = Array.from(inputs).find(input => input.getAttribute('name') === 'signature')
      expect(signatureInput?.getAttribute('value')).toBe('test_signature')
      
      const customInput = Array.from(inputs).find(input => input.getAttribute('name') === 'custom_field')
      expect(customInput?.getAttribute('value')).toBe('custom_value')
    })
  })
})

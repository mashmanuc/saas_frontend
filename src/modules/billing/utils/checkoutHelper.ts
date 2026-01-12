/**
 * Checkout Helper (v0.73.0)
 * 
 * Utility for submitting payment provider checkout forms.
 * Handles dynamic POST form submission for LiqPay and other providers.
 */

import type { CheckoutDetails } from '../api/billingApi'

/**
 * Submit checkout form to payment provider
 * 
 * Creates a hidden form with provided fields and submits it.
 * This causes browser to navigate to the payment provider's checkout page.
 * 
 * @param checkoutDetails - Checkout details from backend (method, url, form_fields)
 */
export function submitCheckoutForm(checkoutDetails: CheckoutDetails): void {
  const { method, url, form_fields } = checkoutDetails

  // Create form element
  const form = document.createElement('form')
  form.method = method
  form.action = url
  form.style.display = 'none'

  // Add all form fields as hidden inputs
  Object.entries(form_fields).forEach(([name, value]) => {
    const input = document.createElement('input')
    input.type = 'hidden'
    input.name = name
    input.value = value
    form.appendChild(input)
  })

  // Append to body, submit, and cleanup
  document.body.appendChild(form)
  form.submit()
  
  // Note: cleanup happens after navigation, but we set timeout as safety
  setTimeout(() => {
    if (document.body.contains(form)) {
      document.body.removeChild(form)
    }
  }, 1000)
}

/**
 * Validate checkout response before submission
 * 
 * @param provider - Payment provider name
 * @param sessionId - Checkout session ID
 * @param checkoutDetails - Checkout details to validate
 * @returns True if valid, throws error otherwise
 */
export function validateCheckoutResponse(
  provider: string,
  sessionId: string,
  checkoutDetails: CheckoutDetails
): boolean {
  if (!provider || !sessionId) {
    throw new Error('Invalid checkout response: missing provider or session_id')
  }

  if (!checkoutDetails || !checkoutDetails.url || !checkoutDetails.form_fields) {
    throw new Error('Invalid checkout response: missing checkout details')
  }

  if (checkoutDetails.method !== 'POST') {
    throw new Error(`Unsupported checkout method: ${checkoutDetails.method}`)
  }

  // LiqPay specific validation
  if (provider === 'liqpay') {
    if (!checkoutDetails.form_fields.data || !checkoutDetails.form_fields.signature) {
      throw new Error('Invalid LiqPay checkout: missing data or signature')
    }
  }

  return true
}

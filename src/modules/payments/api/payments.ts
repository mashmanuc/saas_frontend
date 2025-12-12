// F1: Payments API Client
import apiClient from '@/utils/apiClient'

// Types
export interface Booking {
  id: number
  booking_id: string
  tutor_name: string
  subject: string
  date: string
}

export interface Payment {
  id: number
  uuid: string
  payment_type: 'lesson' | 'subscription' | 'package' | 'tip'
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
  amount: number
  currency: string
  platform_fee: number
  net_amount: number
  description: string
  booking?: Booking
  paid_at: string | null
  created_at: string
}

export interface PaymentMethod {
  id: number
  card_brand: string
  card_last4: string
  card_exp_month: number
  card_exp_year: number
  is_default: boolean
}

export interface Wallet {
  balance: number
  pending: number
  total_earned: number
  total_withdrawn: number
  currency: string
  can_withdraw: boolean
  payout_threshold: number
  bank_name?: string
  bank_account?: string
  bank_holder_name?: string
  payout_method?: string
  auto_payout_enabled?: boolean
}

export interface WalletTransaction {
  id: number
  transaction_type: 'earning' | 'tip' | 'withdrawal' | 'refund' | 'adjustment' | 'bonus'
  amount: number
  balance_after: number
  description: string
  created_at: string
}

export interface PayoutRequest {
  id: number
  uuid: string
  amount: number
  currency: string
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'failed' | 'cancelled'
  payout_method: string
  created_at: string
  processed_at: string | null
}

export interface Plan {
  id: number
  name: string
  slug: string
  description: string
  price: number
  currency: string
  interval: 'monthly' | 'quarterly' | 'yearly'
  lessons_per_month: number
  features: string[]
  is_featured: boolean
}

export interface Subscription {
  id: number
  plan: Plan
  status: 'active' | 'past_due' | 'cancelled' | 'expired' | 'trialing'
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  lessons_used_this_period: number
}

export interface Invoice {
  id: number
  uuid: string
  number: string
  status: 'draft' | 'open' | 'paid' | 'void'
  subtotal: number
  tax: number
  total: number
  currency: string
  issued_at: string
  paid_at: string | null
  pdf_url: string
}

export interface EarningsPeriod {
  label: string
  amount: number
}

export interface EarningsAnalytics {
  total: number
  average_per_lesson: number
  lessons_count: number
  by_period: EarningsPeriod[]
}

export interface PayoutSettings {
  payout_method: string
  bank_name?: string
  bank_account?: string
  bank_holder_name?: string
  auto_payout_enabled?: boolean
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface PaymentIntentResponse {
  payment_id: number
  client_secret: string
}

// API
export const paymentsApi = {
  // Payment Intent
  createPaymentIntent: (data: {
    amount: number
    currency?: string
    payment_type: string
    booking_id?: number
  }): Promise<PaymentIntentResponse> =>
    apiClient.post('/payments/intent/', data),

  confirmPayment: (paymentId: number, paymentIntentId: string): Promise<Payment> =>
    apiClient.post('/payments/confirm/', {
      payment_id: paymentId,
      payment_intent_id: paymentIntentId,
    }),

  // Payments
  getPayments: (params?: {
    status?: string
    type?: string
    page?: number
  }): Promise<PaginatedResponse<Payment>> =>
    apiClient.get('/payments/', { params }),

  getPayment: (id: number): Promise<Payment> =>
    apiClient.get(`/payments/${id}/`),

  requestRefund: (id: number, reason?: string): Promise<Payment> =>
    apiClient.post(`/payments/${id}/refund/`, { reason }),

  // Payment Methods
  getPaymentMethods: (): Promise<PaymentMethod[]> =>
    apiClient.get('/payments/methods/'),

  addPaymentMethod: (providerMethodId: string): Promise<PaymentMethod> =>
    apiClient.post('/payments/methods/', { provider_method_id: providerMethodId }),

  removePaymentMethod: (id: number): Promise<void> =>
    apiClient.delete(`/payments/methods/${id}/`),

  setDefaultPaymentMethod: (id: number): Promise<PaymentMethod> =>
    apiClient.patch(`/payments/methods/${id}/default/`),

  // Wallet
  getWallet: (): Promise<Wallet> =>
    apiClient.get('/wallet/'),

  getTransactions: (params?: {
    type?: string
    page?: number
  }): Promise<PaginatedResponse<WalletTransaction>> =>
    apiClient.get('/wallet/transactions/', { params }),

  getEarningsAnalytics: (period?: 'week' | 'month' | 'year'): Promise<EarningsAnalytics> =>
    apiClient.get('/wallet/analytics/', { params: { period } }),

  updatePayoutSettings: (data: PayoutSettings): Promise<Wallet> =>
    apiClient.patch('/wallet/settings/', data),

  // Payouts
  requestPayout: (amount?: number): Promise<PayoutRequest> =>
    apiClient.post('/payouts/', { amount }),

  getPayouts: (params?: { status?: string }): Promise<PayoutRequest[]> =>
    apiClient.get('/payouts/', { params }),

  cancelPayout: (id: number): Promise<void> =>
    apiClient.delete(`/payouts/${id}/`),

  // Subscriptions
  getPlans: (): Promise<Plan[]> =>
    apiClient.get('/subscriptions/plans/'),

  createSubscription: (
    planId: number,
    paymentMethodId?: number
  ): Promise<Subscription> =>
    apiClient.post('/subscriptions/', {
      plan_id: planId,
      payment_method_id: paymentMethodId,
    }),

  getCurrentSubscription: (): Promise<Subscription | null> =>
    apiClient.get('/subscriptions/current/'),

  cancelSubscription: (atPeriodEnd?: boolean): Promise<Subscription> =>
    apiClient.post('/subscriptions/cancel/', { at_period_end: atPeriodEnd }),

  reactivateSubscription: (): Promise<Subscription> =>
    apiClient.post('/subscriptions/reactivate/'),

  changePlan: (planId: number): Promise<Subscription> =>
    apiClient.post('/subscriptions/change-plan/', { plan_id: planId }),

  // Invoices
  getInvoices: (params?: { status?: string }): Promise<Invoice[]> =>
    apiClient.get('/invoices/', { params }),

  getInvoice: (id: number): Promise<Invoice> =>
    apiClient.get(`/invoices/${id}/`),

  downloadInvoicePdf: (id: number): Promise<Blob> =>
    apiClient.get(`/invoices/${id}/pdf/`, { responseType: 'blob' }),
}

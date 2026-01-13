# Billing Module (v0.74)

## Overview

Модуль білінгу відповідає за управління підписками, планами та платежами в M4SH Platform.

**Source of Truth:** Backend API (`/api/v1/billing/*`)

---

## Architecture

### Store

**Location:** `src/modules/billing/stores/billingStore.ts`

**Store ID:** `billing-v074`

**Invariants:**
1. Store НЕ обчислює features або limits — тільки читає з backend
2. Store НЕ містить hardcoded планів або feature logic
3. Після будь-якої billing action (checkout, cancel) store автоматично refetch `/billing/me`
4. Checkout використовує POST form submission (LiqPay) або redirect (Stripe)

### API Client

**Location:** `src/modules/billing/api/billingApi.ts`

**Endpoints:**
- `GET /api/v1/billing/me/` — поточний стан підписки користувача
- `GET /api/v1/billing/plans/` — список доступних планів
- `POST /api/v1/billing/checkout/` — ініціація checkout сесії
- `POST /api/v1/billing/cancel/` — скасування підписки

**Contract:** Backend v0.74.0

### Components

**Views:**
- `AccountBillingView.vue` — головна сторінка білінгу (`/dashboard/account/billing`)

**Components:**
- `CurrentPlanCard.vue` — відображення поточного плану
- `PlanCard.vue` — картка одного плану
- `PlansList.vue` — список доступних планів

---

## Usage

### Import Store

```typescript
import { useBillingStore } from '@/modules/billing/stores/billingStore'

const billingStore = useBillingStore()
```

### Fetch Billing Data

```typescript
// Завантажити поточний стан підписки
await billingStore.fetchMe()

// Завантажити список планів
await billingStore.fetchPlans()
```

### Access State

```typescript
// Computed properties
billingStore.currentPlanCode // 'FREE' | 'PRO' | 'BUSINESS'
billingStore.subscription    // SubscriptionDto | null
billingStore.entitlement     // EntitlementDto | null
billingStore.isSubscribed    // boolean
billingStore.isPro           // boolean
billingStore.isFree          // boolean

// Check feature access
billingStore.hasFeature('CONTACT_UNLOCK') // boolean
```

### Initiate Checkout

```typescript
try {
  await billingStore.startCheckout('PRO')
  // User will be redirected to payment provider
} catch (error) {
  console.error('Checkout failed:', error)
}
```

### Cancel Subscription

```typescript
try {
  await billingStore.cancel(true) // true = at period end
  // Store automatically refetches billing status
} catch (error) {
  console.error('Cancel failed:', error)
}
```

---

## Testing

### Unit Tests

**Location:** `src/modules/billing/stores/__tests__/billingStore.spec.ts`

**Coverage:**
- fetchMe() — успішне завантаження, FREE user, error handling
- fetchPlans() — успішне завантаження, empty list, error handling
- startCheckout() — LiqPay flow, Stripe flow, error handling
- cancel() — успішне скасування, refetch після cancel
- hasFeature() — перевірка доступу до features
- $reset() — скидання стану store

**Run tests:**
```bash
npm test -- billingStore
```

---

## Integration with Backend

### API Contract v0.74

**BillingMeDto:**
```typescript
{
  subscription: {
    status: 'active' | 'past_due' | 'canceled' | 'expired' | 'none'
    provider: 'liqpay' | 'stripe' | null
    current_period_end: string | null
    cancel_at_period_end: boolean
    canceled_at: string | null
  }
  entitlement: {
    plan_code: string
    features: string[]
    expires_at: string | null
  }
}
```

**PlanDto:**
```typescript
{
  code: string
  title: string
  price: {
    amount: number
    currency: string
  }
  interval: 'monthly' | 'yearly' | null
  features: string[]
  is_active: boolean
  sort_order: number
}
```

**CheckoutResponse:**
```typescript
{
  provider: 'liqpay' | 'stripe'
  session_id: string
  checkout?: {
    method: 'POST'
    url: string
    form_fields: Record<string, string>
  }
  checkout_url?: string // Stripe only
}
```

---

## Migration from Legacy Store

**⚠️ DEPRECATED:** `src/stores/billingStore.ts` (v0.64)

**Новий store:** `src/modules/billing/stores/billingStore.ts` (v0.74)

### Breaking Changes

1. **Store ID:** `'billing'` → `'billing-v074'`
2. **Import path:** `@/stores/billingStore` → `@/modules/billing/stores/billingStore`
3. **API methods:**
   - `loadBillingMe()` → `fetchMe()`
   - `checkout(planSlug)` → `startCheckout(planCode)`
   - `resume()` — видалено (не підтримується backend)
4. **State properties:**
   - `error` → `lastError`
   - `subscriptionStatus` → `subscription.status`
   - `currentPeriodEnd` → `subscription.current_period_end`
   - `entitlements` → `entitlement`
5. **Computed:**
   - Додано `currentPlanCode`, `isPro`, `isBusiness`, `isFree`

### Migration Guide

**Before:**
```typescript
import { useBillingStore } from '@/stores/billingStore'

const store = useBillingStore()
await store.loadBillingMe()
const status = store.subscriptionStatus
```

**After:**
```typescript
import { useBillingStore } from '@/modules/billing/stores/billingStore'

const store = useBillingStore()
await store.fetchMe()
const status = store.subscription?.status
```

---

## Troubleshooting

### Store ID Conflicts

Якщо бачите помилку `useBillingStore is not a function` або `fetchMe is not a function`:

1. Перевірте, що імпортуєте з правильного шляху:
   ```typescript
   import { useBillingStore } from '@/modules/billing/stores/billingStore'
   ```

2. Перевірте, що старий store видалено:
   ```bash
   npm run lint:store-duplicates
   ```

### API Errors

Якщо бачите `INVALID URL: path should not start with /api/`:

- API client автоматично виправляє це (див. `src/utils/apiClient.js`)
- Переконайтесь, що `baseURL` налаштований правильно

### Checkout Not Working

1. Перевірте, що backend повертає правильний `CheckoutResponse`
2. Для LiqPay: має бути `checkout.form_fields`
3. Для Stripe: має бути `checkout_url`
4. Перевірте console для помилок валідації

---

## CI/CD

### Pre-commit Checks

```bash
# Перевірка дублікатів store ID
npm run lint:store-duplicates
```

### Build

```bash
npm run build
```

### Tests

```bash
npm test
```

---

## Contacts

**Owner:** Frontend Team  
**Version:** v0.74.0  
**Last Updated:** 2026-01-12

**Related Docs:**
- Backend API: `backend/docs/plan/v0.74.0/BE_plan.md`
- Frontend Plan: `backend/docs/plan/v0.74.0/FE_plan.md`
- Implementation Report: `backend/docs/reports/v0.74.0/FRONTEND_REPORT_v0.74_UI.md`

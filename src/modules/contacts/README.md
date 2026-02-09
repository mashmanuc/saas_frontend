# Contacts Module (Contact Tokens)

## Overview

Модуль контактних токенів відповідає за управління токенами для розблокування контактів учнів у M4SH Platform.

**Source of Truth:** Backend API (`/v1/contacts/*`)

---

## Architecture

### Store

**Location:** `src/modules/contacts/stores/contactTokensStore.ts`

**Store ID:** `contactTokens`

**Invariants:**
1. Store керує балансом токенів, історією транзакцій (ledger) та покупками
2. Підтримує optimistic deduction при прийнятті запиту
3. Автоматичне оновлення балансу після grant/purchase операцій
4. Кешування з TTL 5 хвилин для зменшення API calls

### API Client

**Location:** `src/modules/contacts/api/contacts.ts`

**Endpoints:**
- `GET /v1/contacts/tokens/balance/` — поточний баланс токенів
- `GET /v1/contacts/tokens/ledger/` — історія транзакцій
- `GET /v1/contacts/tokens/packages/` — доступні пакети для покупки
- `POST /v1/contacts/tokens/purchase/` — ініціація покупки
- `POST /v1/contacts/tokens/grant/` — нарахування токенів учню

**Contract:** DOMAIN-07 Contacts

### Components

**Views:**
- `ContactsView.vue` — головна сторінка управління токенами (`/dashboard/contacts`)

**Components:**
- `ContactBalanceWidget.vue` — відображення балансу з індикаторами
- `ContactLedgerTable.vue` — таблиця історії транзакцій
- `MonthlyAllowanceWidget.vue` — інформація про щомісячну надбавку
- `PurchaseTokensModal.vue` — модальне вікно покупки токенів
- `TokenGrantModal.vue` — модальне вікно нарахування токенів

### Composables

- `useContactBalance()` — реактивний доступ до балансу
- `useCanAffordContact()` — перевірка можливості розблокування

---

## Usage

### Import Store

```typescript
import { useContactTokensStore } from '@/modules/contacts/stores/contactTokensStore'

const contactStore = useContactTokensStore()
```

### Fetch Balance

```typescript
// Завантажити баланс (з кешуванням)
await contactStore.fetchBalance()

// Примусове оновлення (бypass cache)
await contactStore.fetchBalance(true)
```

### Check Balance

```typescript
// Computed properties
contactStore.balance           // number
contactStore.formattedBalance  // string з форматуванням
contactStore.hasLowBalance     // boolean (<= 3 токенів)
contactStore.hasNoTokens       // boolean
```

### Purchase Tokens

```typescript
try {
  const result = await contactStore.purchaseTokens('basic', {
    success: '/dashboard/contacts/purchase/success',
    cancel: '/dashboard/contacts/purchase/cancel'
  })
  // Redirect to payment provider
  window.location.href = result.redirectUrl
} catch (error) {
  console.error('Purchase failed:', error)
}
```

### Grant Tokens to Student

```typescript
try {
  await contactStore.grantTokens(3, 'Excellent work on math test', studentSubscriptionId)
} catch (error) {
  console.error('Grant failed:', error)
}
```

### Optimistic Deduction (Inquiry Accept)

```typescript
// При прийнятті запиту — оптимістично зменшуємо баланс
contactStore.optimisticDeduction()

// При скасуванні — повертаємо токен
contactStore.refundToken()
```

### Ledger Pagination

```typescript
// Завантажити перші записи
await contactStore.fetchLedger({ limit: 20 })

// Завантажити більше (infinite scroll)
await contactStore.loadMoreLedger()

// Перевірити чи є ще записи
contactStore.ledgerHasMore // boolean
```

---

## Testing

### Unit Tests

**Location:** `src/modules/contacts/stores/__tests__/contactTokensStore.spec.ts`

**Coverage:**
- fetchBalance() — успішне завантаження, кешування, force refresh, error handling
- fetchLedger() — pagination, filtering by type
- purchaseTokens() — успішна ініціація, error handling
- grantTokens() — нарахування, оновлення балансу
- optimisticDeduction() / refundToken() — optimistic updates
- getters — hasLowBalance, hasNoTokens, formattedBalance, daysUntilAllowance

**Run tests:**
```bash
npm test -- contactTokensStore
```

---

## Integration with Backend

### API Contract

**ContactBalance:**
```typescript
{
  balance: number
  pending_grants: number
  last_grant_date: string | null
  next_allowance_date: string | null
  plan_allowance: number
}
```

**ContactLedgerEntry:**
```typescript
{
  id: number
  type: 'GRANT' | 'DEDUCTION' | 'PURCHASE' | 'EXPIRY'
  amount: number
  balance_after: number
  created_at: string
  description: string
}
```

**ContactPackage:**
```typescript
{
  id: string
  name: string
  tokens: number
  price: number
  currency: string
  bonus: number
  is_popular: boolean
  is_best_value: boolean
}
```

---

## Routes

| Route | Component | Meta | Description |
|-------|-----------|------|-------------|
| `/dashboard/contacts` | ContactsView.vue | requiresAuth, roles: [TUTOR] | Головна сторінка токенів |
| `/dashboard/contacts/purchase` | ContactsView.vue | requiresAuth, roles: [TUTOR] | Відкриває модаль покупки |
| `/dashboard/contacts/purchase/success` | ContactsView.vue | requiresAuth, roles: [TUTOR] | Успішна покупка |
| `/dashboard/contacts/purchase/cancel` | ContactsView.vue | requiresAuth, roles: [TUTOR] | Скасована покупка |

---

## Troubleshooting

### Low Balance Warning

- `hasLowBalance` показується при <= 3 токенах
- Рекомендується показувати банер з CTA на покупку

### Cache Issues

```typescript
// Очистити кеш та оновити дані
await contactStore.fetchBalance(true)
await contactStore.fetchLedger({ limit: 20 })
```

### Purchase Flow Debugging

1. Перевірте що backend повертає `redirect_url`
2. Для LiqPay: перевірте `provider: 'liqpay'`
3. Для Stripe: перевірте `provider: 'stripe'`

---

## i18n Keys

**Namespace:** `contacts`

```yaml
contacts:
  title: "Контактні токени"
  balance:
    title: "Ваш баланс"
    lowBalance: "Низький баланс"
    zeroBalance: "Немає токенів"
  ledger:
    title: "Історія транзакцій"
  purchase:
    title: "Купівля токенів"
  grant:
    title: "Нарахувати токени"
```

---

## Version

**Version:** v1.0.0  
**Domain:** DOMAIN-07 Contacts  
**Last Updated:** 2026-02-08

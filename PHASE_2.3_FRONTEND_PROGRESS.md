# Phase 2.3 Frontend - Progress Report

**Дата:** 2026-01-25  
**Статус:** IN PROGRESS (P1.1-P1.2 завершено)

---

## Завершено ✅

### P1.1: API Client (contactsApi)

**Файл:** `src/api/billing.ts`

**Додано методи:**
```typescript
getContactBalance(): Promise<ContactBalanceDTO>
getContactLedger(limit: number, offset: number): Promise<ContactLedgerItemDTO[]>
getInquiryStats(): Promise<InquiryStatsDTO>
```

**Типи:** `src/types/billing.ts`
- `ContactBalanceDTO`
- `ContactLedgerItemDTO`
- `InquiryStatsDTO`

**SSOT:** limit+offset pagination (без cursor)

---

### P1.2: Pinia Store (contactsStore)

**Файл:** `src/stores/contactsStore.ts`

**State:**
- `balance`, `ledger`, `stats`
- `ledgerLimit`, `ledgerOffset`, `ledgerHasMore`
- Loading/error states

**Actions:**
- `fetchBalance()` - GET /api/v1/billing/contacts/balance/
- `fetchStats()` - GET /api/v1/inquiries/stats/
- `fetchLedger({ limit, offset, append })` - pagination
- `resetLedgerAndFetchFirstPage()` - reset + fetch
- `loadMoreLedger()` - "Load More" button
- `afterAcceptRefresh()` - INV-3: refetch після accept

**Інваріанти:**
- ✅ INV-1: Pagination тільки limit+offset
- ✅ INV-3: afterAcceptRefresh() → refetch balance + ledger
- ✅ INV-5: Error handling (errorBalance, errorLedger, errorStats)

---

## В процесі 🔄

### P1.3-P1.6: UI Components

**Потрібно створити:**
1. Header Widget (contacts balance) - показує balance, відкриває modal
2. Contact Ledger Modal - список транзакцій + "Load More"
3. Warnings/banners - decline streak, blocked status
4. 429 Retry-After UX - countdown + disable button

---

## Залишається ⏳

### P1.7: i18n Keys
- `contacts.balance`, `contacts.ledger.*`
- `warnings.declineStreak`, `warnings.blocked`
- `errors.accessDenied`, `errors.rateLimited`
- UK + EN

### P1.8: A11Y
- Modal focus trap + ESC close
- aria-labels
- Countdown без spam screen reader

### P2.1: Tests
- Unit: store pagination, afterAcceptRefresh
- E2E: ledger open → load more → accept → refetch

---

## Backend Contracts (готові)

1. ✅ `GET /api/v1/billing/contacts/balance/`
2. ✅ `GET /api/v1/billing/contacts/ledger/?limit=50&offset=0`
3. ✅ `GET /api/v1/inquiries/stats/`
4. ✅ `POST /api/v1/inquiries/{id}/mark-spam/` (spam_status)
5. ✅ `POST /api/v1/inquiries/` (429 + Retry-After)

---

## Файли створені/змінені

### Створені:
1. `src/stores/contactsStore.ts` - Pinia store з pagination

### Змінені:
1. `src/api/billing.ts` - додано 3 методи Phase 2.3
2. `src/types/billing.ts` - додано 3 типи Phase 2.3

---

## Наступні кроки

1. Створити UI компоненти (Widget, Modal, Warnings)
2. Додати i18n ключі
3. Реалізувати 429 countdown UX
4. A11Y (focus trap, aria)
5. Unit tests для store
6. E2E tests (якщо є Playwright)
7. Фінальна перевірка DoD

---

**Примітка:** Backend готовий (GREEN), працюємо тільки у frontend. Сервери вже запущені.

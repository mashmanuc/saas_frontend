# API Client Authentication Fix - 2026-01-25

## 🔴 Проблема

**401 Unauthorized** на endpoints `/api/v1/billing/contacts/ledger/` та інших v1 endpoints для автентифікованих користувачів.

## 🔍 Root Cause

**6 API файлів використовували голий `axios` замість `apiClient`**, що призводило до:
- ❌ Відсутності `Authorization: Bearer <JWT>` header
- ❌ Відсутності автоматичного refresh токена при 401
- ❌ Відсутності CSRF token для POST/PUT/PATCH/DELETE
- ❌ Відсутності `withCredentials: true`

### Виявлені файли з проблемою:

1. `src/api/billing.ts` — billing endpoints (checkout, subscription, contact tokens, ledger)
2. `src/api/entitlements.ts` — user entitlements
3. `src/api/negotiationChat.ts` — negotiation chat threads
4. `src/api/staff.ts` — staff console operations
5. `src/api/trust.ts` — trust & safety (block/report)
6. `src/api/users.ts` — user contacts

### Чому це сталося?

Ці файли імпортували:
```typescript
import axios from 'axios'
```

Замість правильного:
```typescript
import apiClient from '@/utils/apiClient'
```

## ✅ Виправлення

### Зміни в кожному файлі:

#### 1. Замінено import
```diff
- import axios from 'axios'
+ import apiClient from '@/utils/apiClient'
```

#### 2. Оновлено BASE_URL (видалено `/api` prefix)
```diff
- const BASE_URL = '/api/v1/billing'
+ const BASE_URL = '/v1/billing'
```

**Причина**: `apiClient` вже має `baseURL: '/api'` в конфігурації (`@apiClient.js:20`)

#### 3. Замінено всі виклики axios на apiClient
```diff
- const response = await axios.get<DTO>(`${BASE_URL}/endpoint/`)
- return response.data
+ return apiClient.get(`${BASE_URL}/endpoint/`)
```

**Причина**: `apiClient` автоматично розпаковує `response.data` через interceptor (`@apiClient.js:82-85`)

### Повний список змін:

**`billing.ts`** (6 методів):
- `startCheckout()` ✅
- `getBillingMe()` ✅
- `cancelSubscription()` ✅
- `getContactBalance()` ✅
- `getContactLedger()` ✅
- `getInquiryStats()` ✅

**`entitlements.ts`** (1 метод):
- `getEntitlements()` ✅

**`negotiationChat.ts`** (4 методи):
- `ensureNegotiationThread()` ✅
- `fetchThreads()` ✅
- `fetchMessages()` ✅
- `sendMessage()` ✅

**`staff.ts`** (7 методів):
- `getUserOverview()` ✅
- `listReports()` ✅
- `getReport()` ✅
- `resolveReport()` ✅
- `createBan()` ✅
- `liftBan()` ✅
- `cancelBilling()` ✅

**`trust.ts`** (6 методів):
- `blockUser()` ✅
- `unblockUser()` ✅
- `getBlocks()` ✅
- `createReport()` ✅
- `getReports()` ✅
- `getBanStatus()` ✅

**`users.ts`** (1 метод):
- `getContact()` ✅

**Всього виправлено: 25 методів у 6 файлах**

## 🧪 Тестування

### Перевірка фіксу (для користувача):

1. **Перезавантажте frontend dev server:**
   ```bash
   cd D:\m4sh_v1\frontend
   pnpm dev
   ```

2. **Увійдіть як tutor** (роль має бути `tutor`, не `student`)

3. **Відкрийте DevTools → Network**

4. **Перейдіть на сторінку з billing dashboard** (де викликається `/api/v1/billing/contacts/ledger/`)

5. **Перевірте Request Headers для ledger запиту:**
   ```
   ✅ Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
   ✅ X-Request-Id: <uuid>
   ✅ Cookie: csrf=...; sessionid=...
   ```

6. **Очікуваний результат:**
   - ✅ Status: **200 OK** (замість 401)
   - ✅ Response: масив транзакцій ledger
   - ✅ Немає помилки "User is not authenticated"

### Перевірка інших endpoints:

**Entitlements:**
```bash
GET /api/v1/users/me/entitlements/
# Має повернути: { plan: "FREE", features: [...], ... }
```

**Negotiation Chat:**
```bash
POST /api/v1/chat/threads/negotiation/
# Body: { inquiryId: "<uuid>" }
# Має повернути: { thread: { threadId: "...", ... } }
```

**Trust & Safety:**
```bash
GET /api/v1/trust/blocks/me/
# Має повернути: { blocks: [...] }
```

**Staff Console (тільки для admin/staff):**
```bash
GET /api/v1/staff/reports/
# Має повернути: { reports: [...], total: N }
```

## 📊 Вплив на систему

### Що тепер працює:

1. ✅ **Billing endpoints** — checkout, subscription management, contact tokens
2. ✅ **Contact ledger** — історія транзакцій для tutor
3. ✅ **Entitlements** — перевірка доступу до features
4. ✅ **Negotiation chat** — створення threads, відправка повідомлень
5. ✅ **Trust & Safety** — block/unblock, reports
6. ✅ **Staff console** — admin operations
7. ✅ **User contacts** — unlock contact info

### Що НЕ змінилося:

- ❌ Backend код (не потребує змін)
- ❌ Інші API файли, які вже використовували `apiClient` (notifications, marketplace, booking, etc.)
- ❌ Authentication flow (login/refresh/logout)

## 🔒 Безпека

### Що додає apiClient автоматично:

1. **JWT Authentication** (`@apiClient.js:43-45`):
   ```javascript
   if (store.access) {
     config.headers.Authorization = `Bearer ${store.access}`
   }
   ```

2. **CSRF Protection** (`@apiClient.js:53-58`):
   ```javascript
   if (isStateChanging && !config.headers['X-CSRF-Token']) {
     const csrfToken = store.csrfToken || getCookie('csrf')
     if (csrfToken) {
       config.headers['X-CSRF-Token'] = csrfToken
     }
   }
   ```

3. **Auto Token Refresh** (`@apiClient.js:123-140`):
   ```javascript
   if (status === 401 && !isAuthRefresh && !original._retry) {
     const newAccess = await store.refreshAccess()
     original.headers.Authorization = `Bearer ${newAccess}`
     return api(original)  // Retry з новим токеном
   }
   ```

4. **Credentials** (`@apiClient.js:22,41`):
   ```javascript
   withCredentials: true  // Дозволяє cookies для CORS
   ```

## 📝 Рекомендації для майбутнього

### ❌ НЕ РОБИТИ:
```typescript
// WRONG - голий axios без auth
import axios from 'axios'
const response = await axios.get('/api/v1/endpoint/')
```

### ✅ ПРАВИЛЬНО:
```typescript
// CORRECT - apiClient з автоматичним auth
import apiClient from '@/utils/apiClient'
const data = await apiClient.get('/v1/endpoint/')
```

### Чекліст для нових API файлів:

- [ ] Імпортувати `apiClient` замість `axios`
- [ ] BASE_URL починається з `/v1/` (не `/api/v1/`)
- [ ] Не використовувати `response.data` (apiClient розпаковує автоматично)
- [ ] Для вкладених об'єктів використовувати type assertion: `const response: DTO = await apiClient.get(...)`

## 🎯 Статус

**✅ ВИПРАВЛЕНО** — всі 6 файлів оновлені, 25 методів тепер використовують apiClient з JWT authentication.

**Дата виправлення:** 2026-01-25  
**Виправив:** M4SH Autonomous Agent  
**Тікет:** API Client Auth Fix (billing 401 issue)

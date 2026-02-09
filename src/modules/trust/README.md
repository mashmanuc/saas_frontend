# Trust & Safety Module

## Overview

Модуль Trust & Safety відповідає за управління блокуваннями, скаргами, банами та апеляціями в M4SH Platform. Забезпечує безпечне середовище для всіх користувачів.

**Source of Truth:** Backend API (`/v1/trust/*`)

---

## Architecture

### Store

**Location:** `src/modules/trust/stores/trustStore.ts`

**Store ID:** `trust`

**Invariants:**
1. Store керує списками блокувань, скарг, банів та апеляцій
2. Автоматичне оновлення при зміні стану
3. Кешування для оптимізації API calls
4. Optimistic updates для block/unblock операцій

### API Client

**Location:** `src/modules/trust/api/trust.ts`

**Endpoints:**
- `GET /v1/trust/blocks/` — список заблокованих користувачів
- `POST /v1/trust/blocks/` — заблокувати користувача
- `DELETE /v1/trust/blocks/{id}/` — розблокувати користувача
- `POST /v1/trust/reports/` — створити скаргу
- `GET /v1/trust/bans/` — список активних банів
- `POST /v1/trust/appeals/` — подати апеляцію
- `POST /v1/trust/suspicious-activity/` — повідомити про підозрілу активність

**Contract:** DOMAIN-12 Trust & Safety

### Components

**Views:**
- `BlockedUsersView.vue` — сторінка заблокованих користувачів (`/dashboard/trust/blocked`)
- `AppealsView.vue` — сторінка апеляцій (`/dashboard/trust/appeals`)

**Components:**
- `BlockUserModal.vue` — модальне вікно блокування
- `ReportUserModal.vue` — модальне вікно скарги
- `BlockedUsersList.vue` — список заблокованих користувачів
- `TrustGuardBanner.vue` — банер помилок Trust & Safety

---

## Usage

### Import Store

```typescript
import { useTrustStore } from '@/modules/trust/stores/trustStore'

const trustStore = useTrustStore()
```

### Block User

```typescript
// Заблокувати користувача
try {
  await trustStore.blockUser(userId, 'harassment', 'Repeated inappropriate messages')
} catch (error) {
  console.error('Block failed:', error)
}

// Перевірити чи заблокований
const isBlocked = trustStore.isBlocked(userId) // boolean
```

### Unblock User

```typescript
try {
  await trustStore.unblockUser(blockId)
} catch (error) {
  console.error('Unblock failed:', error)
}
```

### Create Report

```typescript
try {
  const report = await trustStore.createReport(
    'user',        // target_type: 'user' | 'inquiry' | 'review' | 'message'
    targetId,      // ID об'єкта скарги
    'spam',        // category
    'User sending promotional messages'  // comment
  )
} catch (error) {
  console.error('Report failed:', error)
}
```

### Check Bans

```typescript
// Завантажити активні бани
await trustStore.fetchBans()

// Перевірити наявність банів
if (trustStore.hasActiveBans) {
  console.log('Active bans:', trustStore.activeBanCount)
}

// Бани за типом
const banCounts = trustStore.activeBansByScope
// { inquiries: 1, messaging: 0, marketplace: 0 }
```

### Appeals

```typescript
// Подати апеляцію
try {
  await trustStore.createAppeal(banId, 'I believe this was a mistake because...')
} catch (error) {
  console.error('Appeal failed:', error)
}

// Перевірити статус
const pendingAppeals = trustStore.pendingAppeals
```

### Blocked Users Set

```typescript
// Отримати Set заблокованих ID (для швидкої перевірки)
const blockedIds = trustStore.blockedUserIds

// Використання в компоненті
const canMessage = !blockedIds.has(targetUserId)
```

---

## Testing

### Unit Tests

**Location:** `src/modules/trust/stores/__tests__/trustStore.spec.ts`

**Coverage:**
- fetchBlocks() — успішне завантаження, error handling
- blockUser() — блокування, додавання до списку
- unblockUser() — розблокування, видалення зі списку
- isBlocked() — перевірка статусу
- createReport() — створення скарги
- fetchBans() — завантаження банів
- createAppeal() — подання апеляції
- getters — blockedUserIds, activeBanCount, pendingAppeals, activeBansByScope

**Run tests:**
```bash
npm test -- trustStore
```

---

## Integration with Backend

### API Contract

**Block:**
```typescript
{
  id: number
  target_user_id: number
  target_user_name: string
  reason: string
  created_at: string
}
```

**Report:**
```typescript
{
  id: number
  target_type: 'user' | 'inquiry' | 'review' | 'message'
  target_id: number
  category: string
  comment: string
  status: 'pending' | 'reviewing' | 'resolved'
  resolution?: string
  created_at: string
}
```

**Ban:**
```typescript
{
  id: number
  scope: 'all' | 'inquiries' | 'messaging' | 'marketplace'
  reason: string
  expires_at: string | null
  is_permanent: boolean
  created_at: string
}
```

**Appeal:**
```typescript
{
  id: number
  ban_id: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  admin_response?: string
  created_at: string
}
```

---

## Routes

| Route | Component | Meta | Description |
|-------|-----------|------|-------------|
| `/dashboard/trust/blocked` | BlockedUsersView.vue | requiresAuth | Заблоковані користувачі |
| `/dashboard/trust/appeals` | AppealsView.vue | requiresAuth | Апеляції на бани |

---

## Block Reasons

| Reason | Description |
|--------|-------------|
| `harassment` | Домагання, образи |
| `spam` | Спам, реклама |
| `inappropriate` | Недоречна поведінка |
| `other` | Інша причина |

## Report Categories

| Category | Description |
|----------|-------------|
| `spam` | Спам, небажані повідомлення |
| `harassment` | Домагання, булінг |
| `inappropriate_content` | Неприйнятний контент |
| `fake_profile` | Фальшивий профіль |
| `scam` | Шахрайство |
| `other` | Інше |

---

## Troubleshooting

### User Still Visible After Block

```typescript
// Перевірити що блокування збережено
await trustStore.fetchBlocks()

// Використовувати blockedUserIds для фільтрації
const visibleUsers = allUsers.filter(u => !trustStore.blockedUserIds.has(u.id))
```

### Report Not Created

```typescript
// Перевірка валідації
try {
  await trustStore.createReport('user', targetId, category, comment)
} catch (error) {
  if (error.response?.status === 409) {
    console.log('Already reported')
  }
}
```

---

## i18n Keys

**Namespace:** `trust`

```yaml
trust:
  blocked:
    title: "Заблоковані користувачі"
    unblock: "Розблокувати"
    empty: "Немає заблокованих користувачів"
  block:
    title: "Заблокувати користувача"
    reasonLabel: "Причина блокування"
    reasons:
      harassment: "Домагання"
      spam: "Спам"
      inappropriate: "Недоречна поведінка"
      other: "Інше"
    submit: "Заблокувати"
  report:
    title: "Поскаржитись"
    categoryLabel: "Категорія скарги"
    submit: "Відправити скаргу"
  appeals:
    title: "Мої апеляції"
    fileAppeal: "Подати апеляцію"
    pending: "На розгляді"
    noActiveBans: "Немає активних блокувань"
```

---

## Version

**Version:** v1.0.0  
**Domain:** DOMAIN-12 Trust & Safety  
**Last Updated:** 2026-02-08

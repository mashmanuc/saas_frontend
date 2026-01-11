# E2E Calendar Tests - Deep Analysis

## Проблема: 401 Unauthorized під час створення уроку

### Симптоми
- Modal відкривається успішно ✅
- Форма заповнюється правильно ✅
- При submit отримуємо 401 Unauthorized ❌
- Попередження "Перекриття часу" з'являється в модалці

### Аналіз auth flow

#### 1. Global Setup (працює)
```typescript
// tests/e2e/global-setup.ts:230-269
- Логін через API: POST /api/v1/auth/login ✅
- Отримання access token ✅
- Збереження в localStorage: access + user ✅
- Збереження storageState в .auth/user.json ✅
```

#### 2. Test Runtime (проблема тут)
```typescript
// playwright.config.ts
storageState: './tests/e2e/.auth/user.json'
```

**Проблема**: storageState містить cookies та localStorage, але:
- Access token може бути expired
- Refresh token механізм не працює в E2E контексті
- apiClient.js:36 перевіряє `store.access` з Pinia store
- Pinia store НЕ ініціалізується з localStorage автоматично

### Рішення

#### Варіант 1: Ініціалізувати Pinia store перед тестами
```typescript
// В beforeEach кожного тесту
await page.evaluate(() => {
  const access = localStorage.getItem('access')
  const user = localStorage.getItem('user')
  // Trigger Pinia store initialization
  window.__PINIA_INIT__ = { access, user }
})
```

#### Варіант 2: Використовувати loginViaApi в beforeEach
```typescript
// Замість loginAsTutorUI
import { loginViaApi } from '../helpers/auth'

test.beforeEach(async ({ page }) => {
  await loginViaApi(page)
  await page.goto('/booking/tutor')
})
```

#### Варіант 3: Перевірити authStore ініціалізацію
```typescript
// src/modules/auth/store/authStore.js
// Має завантажувати з localStorage при створенні
```

### Наступні кроки
1. Перевірити authStore.js - чи ініціалізується з localStorage
2. Якщо ні - додати ініціалізацію
3. Якщо так - перевірити timing (можливо store ініціалізується пізніше за API call)
4. Розглянути використання loginViaApi замість storageState

# Аудит мережевого шару (Network Layer)

**Дата:** 2026-02-01  
**Версія:** v0.1.0  
**Статус:** КРИТИЧНИЙ — джерело 401/429 циклів

---

## Executive Summary

**Проблема:** Мережевий шар має **множинні джерела запитів** без централізованого контролю, що призводить до:
- Нескінченних refresh-циклів (401 → refresh → 429 → 401)
- Self-DDoS через неконтрольований polling
- Logout через BACKGROUND запити
- Відсутність класифікації endpoint'ів

**Рішення:** Впровадити 5-рівневий Request Governor з чіткими інваріантами.

---

## 1. Поточна архітектура

### 1.1 Центральний HTTP-клієнт

**Файл:** `src/utils/apiClient.js`

**Конфігурація:**
```javascript
const api = axios.create({
  baseURL: import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_BASE_URL || '/api'),
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})
```

**Interceptors:**

**Request Interceptor:**
- ✅ Додає `Authorization: Bearer <access>` з `authStore.access`
- ✅ Додає `X-CSRF-Token` для POST/PUT/PATCH/DELETE
- ✅ Додає `X-Request-Id` для трейсингу
- ✅ Запускає `loaderStore.start()`
- ❌ Немає перевірки "чи дозволено робити запит зараз"
- ❌ Немає класифікації endpoint'ів

**Response Interceptor:**
- ✅ Single-flight refresh на 401 (через `isRefreshingToken` flag + queue)
- ✅ Backoff на 429 (не робить logout)
- ✅ Unwrap `.data` автоматично
- ❌ BACKGROUND запити можуть тригерити refresh
- ❌ Немає розрізнення між CRITICAL_AUTH та USER_CRITICAL

---

### 1.2 Auth Store

**Файл:** `src/modules/auth/store/authStore.js`

**State:**
```javascript
{
  access: string | null,
  user: object | null,
  refreshPromise: Promise | null,
  lockedUntil: string | null,  // cooldown після 429
  sessionExpiredNotified: boolean,
}
```

**Refresh Flow:**
```javascript
async refreshAccess() {
  if (!this.access) return null
  
  // Cooldown check
  if (this.lockedUntil && Date.now() < Date.parse(this.lockedUntil)) {
    return null
  }
  
  // Single-flight
  if (this.refreshPromise) {
    return this.refreshPromise
  }
  
  this.refreshPromise = (async () => {
    const res = await authApi.refresh()
    this.access = res.access
    return this.access
  })()
  
  try {
    return await this.refreshPromise
  } catch (error) {
    if (error?.response?.status === 429) {
      this.lockedUntil = new Date(Date.now() + 60_000).toISOString()
      return null
    }
    throw error
  } finally {
    this.refreshPromise = null
  }
}
```

**Проблеми:**
- ❌ `isAuthenticated = Boolean(access && user)` — boolean, а не state machine
- ❌ Proactive refresh interval (25 хв) може конфліктувати з reactive refresh
- ❌ Немає явних станів `BOOT/CHECKING/REFRESHING/COOLDOWN/LOGGED_OUT`

---

### 1.3 Polling Mechanisms

#### Notifications Polling

**Файл:** `src/stores/notificationsStore.ts`

```typescript
function startPolling(intervalMs: number = 60000) {
  if (pollInterval) stopPolling()
  pollInterval = setInterval(() => {
    pollUnreadCount()
  }, intervalMs)
  pollUnreadCount()  // immediate first call
}

async function pollUnreadCount() {
  try {
    const response = await notificationsApi.getNotifications({ 
      unreadOnly: true, 
      limit: 1 
    })
    unreadCount.value = response.count
  } catch (err) {
    console.error('[notificationsStore] Failed to poll unread count:', err)
  }
}
```

**Тригер:** `NotificationBell.vue` → `onMounted` + `watch(authStore.isAuthenticated)`

**Проблеми (ВИПРАВЛЕНО):**
- ✅ Тепер стартує тільки при `isAuthenticated`
- ✅ Зупиняється при logout
- ⚠️ Але все ще децентралізований (компонент керує polling)

#### Lessons Polling

**Файл:** `src/modules/lessons/store/lessonStore.js`

```javascript
startPolling(fetchFn) {
  this.stopPolling()
  this.pollingTimer = setInterval(fetchFn, POLLING_INTERVAL)
}
```

**Проблеми:**
- ❌ Немає guard по auth state
- ❌ Немає backoff на 429
- ❌ Кожен store має власну реалізацію polling

---

### 1.4 Marketplace Fetch Patterns

**Файл:** `src/modules/marketplace/stores/marketplaceStore.ts`

**Debounced reload:**
```typescript
const debouncedReload = debounce(() => {
  void loadTutors(true)
}, 300)

function setFilters(newFilters: Partial<CatalogFilters>) {
  filters.value = { ...filters.value, ...newFilters }
  debouncedReload()
}
```

**Проблеми:**
- ✅ Є debounce (300ms)
- ❌ Немає cancel previous request
- ❌ Немає черги (можливі паралельні запити)
- ❌ Немає pause при `REFRESHING/COOLDOWN`

---

## 2. Інвентар усіх мережевих запитів

### 2.1 Auth & Session

| Endpoint | Клас | Частота | Тригер |
|----------|------|---------|--------|
| `/v1/auth/refresh/` | CRITICAL_AUTH | На 401 | apiClient interceptor |
| `/v1/auth/logout` | CRITICAL_AUTH | Manual | User action |
| `/v1/me/` | CRITICAL_AUTH | Bootstrap | authStore.bootstrap() |
| `/v1/auth/csrf` | CRITICAL_AUTH | Login flow | authStore.ensureCsrfToken() |

### 2.2 User Profile

| Endpoint | Клас | Частота | Тригер |
|----------|------|---------|--------|
| `/v1/tutors/me/profile/` | USER_CRITICAL | On demand | marketplaceStore.loadMyProfile() |
| `/v1/tutors/me/profile/` (PUT) | USER_CRITICAL | On save | marketplaceStore.updateProfile() |
| `/marketplace/profile/` (POST) | USER_CRITICAL | On create | marketplaceStore.createProfile() |
| `/v1/marketplace/tutors/me/publish/` | USER_CRITICAL | Manual | marketplaceStore.publishProfile() |

### 2.3 Marketplace Data

| Endpoint | Клас | Частота | Тригер |
|----------|------|---------|--------|
| `/v1/marketplace/tutors/` | MARKETPLACE_DATA | On filter change | marketplaceStore.loadTutors() |
| `/v1/marketplace/tutors/<slug>/profile/` | MARKETPLACE_DATA | On view | marketplaceStore.loadProfile() |
| `/v1/marketplace/filters/` | MARKETPLACE_DATA | Once | marketplaceStore.loadFilterOptions() |
| `/v1/catalog/subjects` | MARKETPLACE_DATA | Once | marketplaceStore.loadCatalogSubjects() |
| `/v1/catalog/tags` | MARKETPLACE_DATA | Once | marketplaceStore.loadCatalogTags() |

### 2.4 Background

| Endpoint | Клас | Частота | Тригер |
|----------|------|---------|--------|
| `/notifications/me/?unread=true&limit=1` | BACKGROUND | 60s interval | notificationsStore.pollUnreadCount() |
| `/users/online-status/` | BACKGROUND | On demand | Presence system |

### 2.5 Diagnostic

| Endpoint | Клас | Частота | Тригер |
|----------|------|---------|--------|
| `/metrics/` | DIAGNOSTIC | Manual | Admin/monitoring |
| `/health/` | DIAGNOSTIC | Health check | Monitoring |

---

## 3. Проблемні сценарії (виявлені баги)

### 3.1 Нескінченний refresh-цикл (ВИПРАВЛЕНО)

**Було:**
1. Notifications polling → 401
2. apiClient interceptor → `authStore.refreshAccess()`
3. Refresh → 429 (rate limit)
4. apiClient → `forceLogout()` ❌
5. Повторний login → знову polling → 401 → ...

**Виправлено:**
- ✅ Notifications polling стартує тільки при `isAuthenticated`
- ✅ 429 на refresh не викликає logout
- ✅ Cooldown `lockedUntil` блокує повторні refresh

**Залишилось:**
- ⚠️ Немає гарантії, що інший polling не зробить те саме
- ⚠️ BACKGROUND запити все ще можуть тригерити refresh

---

### 3.2 Self-DDoS через marketplace filters (ЧАСТКОВО)

**Сценарій:**
1. Користувач швидко змінює фільтри (subject, country, price)
2. Кожна зміна → `debouncedReload()` → `loadTutors()`
3. Якщо debounce не встиг, паралельні запити

**Поточний стан:**
- ✅ Є debounce 300ms
- ❌ Немає cancel previous
- ❌ Немає черги

---

### 3.3 Logout через BACKGROUND (ВИПРАВЛЕНО ЧАСТКОВО)

**Було:**
1. Notifications polling → 401
2. Refresh → 401 (invalid refresh token)
3. apiClient → `forceLogout()` ❌

**Виправлено:**
- ✅ 429 на refresh не викликає logout
- ⚠️ Але 401 на refresh все ще викликає logout (це правильно для CRITICAL_AUTH)
- ❌ BACKGROUND запити не мають окремої політики

---

## 4. Відсутні компоненти

### 4.1 Request Governor

**Немає:**
- ❌ Глобальний дозвіл/заборона запитів
- ❌ Класифікація endpoint'ів
- ❌ Policy по класах (що робити на 401/429/403)

**Потрібно:**
```typescript
requestGovernor.canRequest(ctx: RequestContext): boolean {
  if (!authState.isReady()) return false
  if (authState === 'COOLDOWN' && ctx.class !== 'CRITICAL_AUTH') return false
  if (marketplaceBusy && ctx.class === 'BACKGROUND') return false
  return true
}
```

---

### 4.2 Endpoint Classifier

**Немає:**
- ❌ Автоматичне визначення класу endpoint'а
- ❌ Таблиця regex → class

**Потрібно:**
```typescript
endpointClassifier.classify(url: string): EndpointClass {
  if (/\/auth\/(refresh|logout|csrf)/.test(url)) return 'CRITICAL_AUTH'
  if (/\/v1\/me\//.test(url)) return 'CRITICAL_AUTH'
  if (/\/tutors\/me\/profile/.test(url)) return 'USER_CRITICAL'
  if (/\/notifications\/me/.test(url)) return 'BACKGROUND'
  if (/\/marketplace\/tutors/.test(url)) return 'MARKETPLACE_DATA'
  return 'MARKETPLACE_DATA'  // default
}
```

---

### 4.3 Auth State Machine

**Поточний стан:**
```javascript
isAuthenticated: (state) => Boolean(state.access && state.user)
```

**Потрібно:**
```typescript
authState: 'BOOT' | 'CHECKING' | 'AUTHENTICATED' | 'REFRESHING' | 'COOLDOWN' | 'LOGGED_OUT'
```

**Переходи:**
- `BOOT` → `CHECKING` (при bootstrap)
- `CHECKING` → `AUTHENTICATED` (після `/v1/me/`)
- `AUTHENTICATED` → `REFRESHING` (на 401)
- `REFRESHING` → `AUTHENTICATED` (refresh success)
- `REFRESHING` → `COOLDOWN` (refresh 429)
- `COOLDOWN` → `AUTHENTICATED` (після timeout)
- `*` → `LOGGED_OUT` (на критичну помилку)

---

### 4.4 Polling Manager

**Поточний стан:**
- Кожен store має власну реалізацію `startPolling/stopPolling`
- Компоненти керують polling напряму

**Потрібно:**
```typescript
pollingManager.register({
  name: 'notifications',
  interval: 60000,
  allowedStates: ['AUTHENTICATED'],
  pauseWhen: () => marketplaceStore.isLoading,
  backoffOn429: true,
  fn: () => notificationsStore.pollUnreadCount()
})
```

---

### 4.5 Marketplace Fetch Queue

**Поточний стан:**
- Debounce є, але немає cancel/queue

**Потрібно:**
```typescript
marketplaceFetchQueue.enqueue({
  key: 'tutors',
  debounceMs: 300,
  cancelPrevious: true,
  priority: 'normal',
  fn: () => marketplaceApi.getTutors(...)
})
```

---

## 5. Інваріанти (порушені зараз)

### 5.1 Критичні інваріанти

| Інваріант | Поточний стан | Потрібно |
|-----------|---------------|----------|
| `429 ≠ logout` | ✅ ВИПРАВЛЕНО | ✅ OK |
| `BACKGROUND ≠ auth breaker` | ❌ ПОРУШЕНО | 🔴 FIX |
| `Polling ≠ early` | ✅ ВИПРАВЛЕНО | ✅ OK |
| `Watchers ≠ fetch` | ✅ OK (debounce) | ✅ OK |
| `Auth ≠ boolean` | ❌ ПОРУШЕНО | 🔴 FIX |
| `Request ≠ без дозволу` | ❌ ПОРУШЕНО | 🔴 FIX |

---

## 6. Метрики поточного стану

| Метрика | Значення |
|---------|----------|
| Кількість axios instances | 1 (apiClient) |
| Кількість interceptors | 2 (request, response) |
| Кількість polling mechanisms | 2+ (notifications, lessons) |
| Кількість endpoint'ів | 20+ |
| Кількість класів endpoint'ів | 0 (немає класифікації) |
| Auth states | 1 (boolean) |
| Request governor | ❌ Немає |
| Polling manager | ❌ Немає |
| Fetch queue | ❌ Немає |

---

## 7. Залежності між компонентами

```
NotificationBell ──> notificationsStore.startPolling()
                              │
                              ├──> notificationsApi.getNotifications()
                              │         │
                              │         └──> apiClient.get()
                              │                   │
                              │                   ├──> authStore.access (header)
                              │                   └──> on 401 → authStore.refreshAccess()
                              │
MyProfileView ──> marketplaceStore.loadMyProfile()
                              │
                              └──> marketplaceApi.getTutorMeProfile()
                                        │
                                        └──> apiClient.get()
```

**Проблема:** Немає централізованого контролю, кожен компонент/store робить запити напряму.

---

## 8. Рекомендації

### 8.1 Негайні дії (P0)

1. ✅ **ВИПРАВЛЕНО:** Додати guard для notifications polling
2. ✅ **ВИПРАВЛЕНО:** Backoff на 429 refresh
3. ❌ **TODO:** Додати endpoint classifier (пасивний режим, тільки логи)

### 8.2 Середньострокові (P1)

1. Впровадити Auth State Machine
2. Додати Request Governor (enforced)
3. Створити Polling Manager

### 8.3 Довгострокові (P2)

1. Marketplace Fetch Queue
2. Telemetry для мережевих запитів
3. Circuit breaker для проблемних endpoint'ів

---

## 9. Висновки

**Поточний стан:** 🟡 **ПОКРАЩЕНО, але не готово до production**

**Що виправлено:**
- ✅ Refresh-цикли (429 backoff)
- ✅ Notifications polling (auth guard)
- ✅ Single-flight refresh

**Що залишилось:**
- ❌ Немає Request Governor
- ❌ Немає класифікації endpoint'ів
- ❌ Auth state = boolean (не state machine)
- ❌ Децентралізований polling

**Наступний крок:** Реалізація 5-рівневого Network Governor згідно з планом у `NETWORK_GOVERNOR_5LEVEL_PLAN.md`

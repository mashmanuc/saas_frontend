# План реалізації 5-рівневого Network Governor

**Дата:** 2026-02-01  
**Версія:** v1.0.0  
**Статус:** READY FOR IMPLEMENTATION

---

## Мета

Створити **5-рівневу систему контролю мережевих запитів**, що унеможливлює self-DDoS, refresh-цикли та logout через BACKGROUND запити.

---

## Інваріанти (MUST HOLD)

```
1. 429 ≠ logout
2. BACKGROUND ≠ auth breaker
3. Polling ≠ early (тільки при AUTHENTICATED)
4. Watchers ≠ fetch (debounce + cancel)
5. Auth ≠ boolean (state machine)
6. Request ≠ без дозволу (governor)
```

---

## Архітектура (5 рівнів)

```
┌─────────────────────────────────────────┐
│  РІВЕНЬ 5: Marketplace Fetch Queue      │  ← Debounce, cancel, priority
├─────────────────────────────────────────┤
│  РІВЕНЬ 4: Polling Orchestration        │  ← Centralized polling manager
├─────────────────────────────────────────┤
│  РІВЕНЬ 3: Auth State Machine           │  ← BOOT/CHECKING/AUTHENTICATED/...
├─────────────────────────────────────────┤
│  РІВЕНЬ 2: Endpoint Classification      │  ← CRITICAL_AUTH, USER_CRITICAL, ...
├─────────────────────────────────────────┤
│  РІВЕНЬ 1: Request Governor (SSOT)      │  ← Global allow/deny
└─────────────────────────────────────────┘
           ↓
      apiClient (axios)
```

---

## РІВЕНЬ 1: Request Governor (ОБОВ'ЯЗКОВО)

### Мета
Єдиний глобальний модуль, який блокує/дозволяє всі запити.

### Інваріанти

```
❌ ЖОДЕН axios/fetch не йде напряму
✅ Всі запити проходять через governor
```

### Реалізація

**Файл:** `src/core/network/requestGovernor.ts`

```typescript
/**
 * Request Governor — SSOT для дозволу запитів
 */

import type { EndpointClass } from './endpointClassifier'

type GovernorState = {
  rateLimitedUntil: number | null
  authReady: boolean
  marketplaceBusy: boolean
}

const state: GovernorState = {
  rateLimitedUntil: null,
  authReady: false,
  marketplaceBusy: false,
}

export type RequestContext = {
  url: string
  method: string
  endpointClass: EndpointClass
  isBackground: boolean
}

/**
 * Перевірити, чи дозволено робити запит
 */
export function canRequest(ctx: RequestContext): boolean {
  // 1. Rate limit check
  if (state.rateLimitedUntil && Date.now() < state.rateLimitedUntil) {
    // CRITICAL_AUTH може пройти навіть при rate limit
    if (ctx.endpointClass !== 'CRITICAL_AUTH') {
      return false
    }
  }
  
  // 2. Auth ready check
  if (!state.authReady && ctx.endpointClass !== 'CRITICAL_AUTH') {
    return false
  }
  
  // 3. Marketplace busy check
  if (state.marketplaceBusy && ctx.endpointClass === 'BACKGROUND') {
    return false
  }
  
  return true
}

/**
 * Встановити rate limit
 */
export function onRateLimited(seconds: number): void {
  state.rateLimitedUntil = Date.now() + seconds * 1000
  
  if (import.meta.env.DEV) {
    console.warn(`[RequestGovernor] Rate limited for ${seconds}s`)
  }
}

/**
 * Очистити rate limit
 */
export function clearRateLimit(): void {
  state.rateLimitedUntil = null
}

/**
 * Встановити auth ready
 */
export function setAuthReady(ready: boolean): void {
  state.authReady = ready
}

/**
 * Встановити marketplace busy
 */
export function setMarketplaceBusy(busy: boolean): void {
  state.marketplaceBusy = busy
}

/**
 * Отримати поточний стан (для debug)
 */
export function getState(): Readonly<GovernorState> {
  return { ...state }
}
```

### Інтеграція в apiClient

**Файл:** `src/utils/apiClient.js`

```javascript
import { canRequest, onRateLimited } from '@/core/network/requestGovernor'
import { classifyEndpoint } from '@/core/network/endpointClassifier'

api.interceptors.request.use(
  (config) => {
    const store = useAuthStore()
    const loader = useLoaderStore()
    
    // Classify endpoint
    const endpointClass = classifyEndpoint(config.url || '')
    const isBackground = config.meta?.isBackground || false
    
    // Check governor
    const ctx = {
      url: config.url || '',
      method: config.method || 'get',
      endpointClass,
      isBackground,
    }
    
    if (!canRequest(ctx)) {
      const error = new Error('REQUEST_BLOCKED_BY_GOVERNOR')
      error.config = config
      error.governorContext = ctx
      return Promise.reject(error)
    }
    
    // ... решта логіки
  }
)

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status
    
    // Handle 429
    if (status === 429) {
      const retryAfter = error.response?.headers?.['retry-after']
      const seconds = retryAfter ? parseInt(retryAfter) : 60
      onRateLimited(seconds)
      
      // ... notify user
    }
    
    // ... решта логіки
  }
)
```

### Acceptance Criteria

- [ ] `requestGovernor.ts` створено
- [ ] Інтеграція в `apiClient.js`
- [ ] Всі запити проходять через `canRequest()`
- [ ] Rate limit блокує запити
- [ ] CRITICAL_AUTH може пройти навіть при rate limit

---

## РІВЕНЬ 2: Класифікація Endpoint'ів (ДУЖЕ ВАЖЛИВО)

### Мета
Кожен endpoint має клас, який визначає його поведінку.

### Типи endpoint'ів

```typescript
type EndpointClass =
  | 'CRITICAL_AUTH'      // /v1/me, refresh, logout
  | 'USER_CRITICAL'      // save profile, publish
  | 'BACKGROUND'         // notifications, online status
  | 'MARKETPLACE_DATA'   // tutors, filters
  | 'DIAGNOSTIC'         // metrics, health
```

### Інваріанти

```
❌ BACKGROUND НІКОЛИ не може викликати logout
❌ RATE_LIMITED НІКОЛИ не дорівнює auth failure
✅ logout можливий ТІЛЬКИ з CRITICAL_AUTH
```

### Реалізація

**Файл:** `src/core/network/endpointClassifier.ts`

```typescript
export type EndpointClass =
  | 'CRITICAL_AUTH'
  | 'USER_CRITICAL'
  | 'BACKGROUND'
  | 'MARKETPLACE_DATA'
  | 'DIAGNOSTIC'

type ClassificationRule = {
  pattern: RegExp
  class: EndpointClass
}

const rules: ClassificationRule[] = [
  // CRITICAL_AUTH
  { pattern: /\/auth\/(refresh|logout|csrf)/, class: 'CRITICAL_AUTH' },
  { pattern: /\/v1\/me\/?$/, class: 'CRITICAL_AUTH' },
  
  // USER_CRITICAL
  { pattern: /\/tutors\/me\/profile/, class: 'USER_CRITICAL' },
  { pattern: /\/marketplace\/tutors\/me\/(publish|unpublish)/, class: 'USER_CRITICAL' },
  { pattern: /\/marketplace\/profile/, class: 'USER_CRITICAL' },
  
  // BACKGROUND
  { pattern: /\/notifications\/me/, class: 'BACKGROUND' },
  { pattern: /\/users\/online-status/, class: 'BACKGROUND' },
  
  // DIAGNOSTIC
  { pattern: /\/(metrics|health)/, class: 'DIAGNOSTIC' },
  
  // MARKETPLACE_DATA (default)
]

export function classifyEndpoint(url: string): EndpointClass {
  for (const rule of rules) {
    if (rule.pattern.test(url)) {
      return rule.class
    }
  }
  
  // Default
  return 'MARKETPLACE_DATA'
}

/**
 * Політика обробки помилок по класах
 */
export function getErrorPolicy(endpointClass: EndpointClass, status: number): {
  canTriggerLogout: boolean
  canTriggerRefresh: boolean
  shouldNotify: boolean
} {
  // 401 handling
  if (status === 401) {
    if (endpointClass === 'CRITICAL_AUTH') {
      return {
        canTriggerLogout: true,   // тільки CRITICAL_AUTH може logout
        canTriggerRefresh: false, // refresh endpoint сам не рефрешить
        shouldNotify: true,
      }
    }
    
    if (endpointClass === 'BACKGROUND') {
      return {
        canTriggerLogout: false,  // ❌ BACKGROUND не ламає auth
        canTriggerRefresh: true,  // але може спробувати refresh
        shouldNotify: false,      // не показувати toast
      }
    }
    
    return {
      canTriggerLogout: false,
      canTriggerRefresh: true,
      shouldNotify: true,
    }
  }
  
  // 429 handling
  if (status === 429) {
    return {
      canTriggerLogout: false,  // ❌ 429 ≠ logout
      canTriggerRefresh: false,
      shouldNotify: true,
    }
  }
  
  return {
    canTriggerLogout: false,
    canTriggerRefresh: false,
    shouldNotify: true,
  }
}
```

### Інтеграція в apiClient

**Файл:** `src/utils/apiClient.js`

```javascript
import { classifyEndpoint, getErrorPolicy } from '@/core/network/endpointClassifier'

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status
    const url = error.config?.url || ''
    const endpointClass = classifyEndpoint(url)
    
    const policy = getErrorPolicy(endpointClass, status)
    
    // 401 handling
    if (status === 401) {
      if (policy.canTriggerRefresh && !isAuthRefresh && !isAuthLogout) {
        // Try refresh
        // ...
      }
      
      if (policy.canTriggerLogout) {
        // Only CRITICAL_AUTH can logout
        await store.forceLogout()
      }
      
      if (policy.shouldNotify) {
        notifySessionExpired()
      }
    }
    
    // ... решта
  }
)
```

### Acceptance Criteria

- [ ] `endpointClassifier.ts` створено
- [ ] Всі endpoint'и класифіковані
- [ ] `getErrorPolicy()` реалізовано
- [ ] BACKGROUND не викликає logout
- [ ] Unit tests покривають всі правила

---

## РІВЕНЬ 3: Auth State Machine (НЕ boolean)

### Мета
Замінити `isAuthenticated: boolean` на явну state machine.

### Стани

```typescript
type AuthState =
  | 'BOOT'           // Початкове завантаження
  | 'CHECKING'       // Перевірка сесії (/v1/me/)
  | 'AUTHENTICATED'  // Валідна сесія
  | 'REFRESHING'     // Оновлення токена
  | 'COOLDOWN'       // Після 429, чекаємо
  | 'LOGGED_OUT'     // Немає сесії
```

### Переходи

```
BOOT → CHECKING (bootstrap)
CHECKING → AUTHENTICATED (success)
CHECKING → LOGGED_OUT (failure)
AUTHENTICATED → REFRESHING (401)
REFRESHING → AUTHENTICATED (success)
REFRESHING → COOLDOWN (429)
REFRESHING → LOGGED_OUT (failure)
COOLDOWN → AUTHENTICATED (timeout)
* → LOGGED_OUT (logout)
```

### Інваріанти

```
Polling дозволений ТІЛЬКИ у AUTHENTICATED
Marketplace fetch — НЕ у REFRESHING / COOLDOWN
COOLDOWN ≠ logout
```

### Реалізація

**Файл:** `src/modules/auth/store/authStore.js`

```javascript
export const useAuthStore = defineStore('auth', {
  state: () => ({
    access: storage.getAccess(),
    user: storage.getUser(),
    authState: 'BOOT',  // ← NEW
    refreshPromise: null,
    lockedUntil: null,
    // ...
  }),
  
  getters: {
    isAuthenticated: (state) => state.authState === 'AUTHENTICATED',
    isRefreshing: (state) => state.authState === 'REFRESHING',
    isInCooldown: (state) => state.authState === 'COOLDOWN',
    canMakeRequests: (state) => ['AUTHENTICATED', 'REFRESHING'].includes(state.authState),
  },
  
  actions: {
    async bootstrap() {
      this.authState = 'CHECKING'
      
      if (!this.access) {
        this.authState = 'LOGGED_OUT'
        return
      }
      
      try {
        const user = await authApi.getCurrentUser()
        this.user = user
        this.authState = 'AUTHENTICATED'
        requestGovernor.setAuthReady(true)
      } catch (error) {
        this.authState = 'LOGGED_OUT'
        requestGovernor.setAuthReady(false)
      }
    },
    
    async refreshAccess() {
      if (this.authState === 'COOLDOWN') {
        // Check if cooldown expired
        if (this.lockedUntil && Date.now() < Date.parse(this.lockedUntil)) {
          return null
        }
        // Cooldown expired
        this.authState = 'AUTHENTICATED'
        this.lockedUntil = null
      }
      
      if (this.authState === 'REFRESHING') {
        return this.refreshPromise
      }
      
      this.authState = 'REFRESHING'
      
      this.refreshPromise = (async () => {
        try {
          const res = await authApi.refresh()
          this.access = res.access
          this.authState = 'AUTHENTICATED'
          return this.access
        } catch (error) {
          if (error?.response?.status === 429) {
            this.authState = 'COOLDOWN'
            this.lockedUntil = new Date(Date.now() + 60_000).toISOString()
            return null
          }
          this.authState = 'LOGGED_OUT'
          throw error
        }
      })()
      
      try {
        return await this.refreshPromise
      } finally {
        this.refreshPromise = null
      }
    },
    
    async forceLogout() {
      this.authState = 'LOGGED_OUT'
      this.access = null
      this.user = null
      requestGovernor.setAuthReady(false)
      // ...
    },
  },
})
```

### Інтеграція з requestGovernor

```typescript
// В authStore.bootstrap()
if (this.authState === 'AUTHENTICATED') {
  requestGovernor.setAuthReady(true)
} else {
  requestGovernor.setAuthReady(false)
}
```

### Acceptance Criteria

- [ ] `authState` додано в authStore
- [ ] Всі переходи реалізовані
- [ ] `isAuthenticated` тепер getter
- [ ] requestGovernor синхронізований
- [ ] Тести покривають всі переходи

---

## РІВЕНЬ 4: Polling Orchestration

### Мета
Централізувати всі polling-джоби під єдиним менеджером.

### Інваріанти

```
polling не знає про auth напряму
він підкоряється глобальному оркестратору
втрата auth → polling автоматично гасне
```

### Реалізація

**Файл:** `src/core/network/pollingManager.ts`

```typescript
import { useAuthStore } from '@/modules/auth/store/authStore'
import type { AuthState } from '@/modules/auth/store/authStore'

type PollingJob = {
  name: string
  interval: number
  allowedStates: AuthState[]
  pauseWhen?: () => boolean
  backoffOn429: boolean
  fn: () => Promise<void> | void
}

const jobs = new Map<string, {
  job: PollingJob
  timerId: ReturnType<typeof setInterval> | null
  isRunning: boolean
}>()

/**
 * Зареєструвати polling job
 */
export function register(job: PollingJob): void {
  if (jobs.has(job.name)) {
    console.warn(`[PollingManager] Job "${job.name}" already registered`)
    return
  }
  
  jobs.set(job.name, {
    job,
    timerId: null,
    isRunning: false,
  })
  
  // Start if allowed
  checkAndStart(job.name)
  
  if (import.meta.env.DEV) {
    console.log(`[PollingManager] Registered job "${job.name}"`)
  }
}

/**
 * Видалити polling job
 */
export function unregister(name: string): void {
  const entry = jobs.get(name)
  if (!entry) return
  
  if (entry.timerId) {
    clearInterval(entry.timerId)
  }
  
  jobs.delete(name)
  
  if (import.meta.env.DEV) {
    console.log(`[PollingManager] Unregistered job "${name}"`)
  }
}

/**
 * Перевірити та запустити job (якщо дозволено)
 */
function checkAndStart(name: string): void {
  const entry = jobs.get(name)
  if (!entry) return
  
  const authStore = useAuthStore()
  const { job } = entry
  
  // Check if allowed
  const isAllowed = job.allowedStates.includes(authStore.authState)
  const isPaused = job.pauseWhen?.() || false
  
  if (isAllowed && !isPaused && !entry.timerId) {
    // Start
    entry.timerId = setInterval(async () => {
      if (entry.isRunning) return  // skip if previous run not finished
      
      entry.isRunning = true
      try {
        await job.fn()
      } catch (error) {
        if (job.backoffOn429 && error?.response?.status === 429) {
          // Pause job temporarily
          if (entry.timerId) {
            clearInterval(entry.timerId)
            entry.timerId = null
          }
          
          // Restart after 60s
          setTimeout(() => checkAndStart(name), 60_000)
        }
      } finally {
        entry.isRunning = false
      }
    }, job.interval)
    
    // Immediate first run
    job.fn().catch(() => {})
  } else if ((!isAllowed || isPaused) && entry.timerId) {
    // Stop
    clearInterval(entry.timerId)
    entry.timerId = null
  }
}

/**
 * Оновити всі jobs (викликається при зміні authState)
 */
export function updateAll(): void {
  for (const name of jobs.keys()) {
    checkAndStart(name)
  }
}

/**
 * Зупинити всі jobs
 */
export function stopAll(): void {
  for (const entry of jobs.values()) {
    if (entry.timerId) {
      clearInterval(entry.timerId)
      entry.timerId = null
    }
  }
}
```

### Інтеграція

**Файл:** `src/stores/notificationsStore.ts`

```typescript
import { pollingManager } from '@/core/network/pollingManager'

// Замість власного startPolling/stopPolling
export const useNotificationsStore = defineStore('notifications', () => {
  // ... state
  
  // Register polling job (once)
  pollingManager.register({
    name: 'notifications',
    interval: 60000,
    allowedStates: ['AUTHENTICATED'],
    pauseWhen: () => false,  // або marketplaceStore.isLoading
    backoffOn429: true,
    fn: async () => {
      const response = await notificationsApi.getNotifications({ 
        unreadOnly: true, 
        limit: 1 
      })
      unreadCount.value = response.count
    },
  })
  
  // ... решта
})
```

**Файл:** `src/modules/auth/store/authStore.js`

```javascript
import { pollingManager } from '@/core/network/pollingManager'

// В watch або action при зміні authState
watch(() => this.authState, () => {
  pollingManager.updateAll()
})
```

### Acceptance Criteria

- [ ] `pollingManager.ts` створено
- [ ] Notifications polling мігровано
- [ ] Lessons polling мігровано
- [ ] Polling стартує/стопається автоматично
- [ ] Backoff на 429 працює

---

## РІВЕНЬ 5: Marketplace Fetch Governor

### Мета
Запобігти паралельним/дублюючим запитам до Marketplace API.

### Інваріанти

```
fetch на кожен watcher — ЗАБОРОНЕНО
паралельні tutors + filters + pagination — ЗАБОРОНЕНО
```

### Реалізація

**Файл:** `src/modules/marketplace/services/marketplaceFetchQueue.ts`

```typescript
type FetchRequest = {
  key: string
  debounceMs: number
  cancelPrevious: boolean
  priority: 'high' | 'normal' | 'low'
  fn: () => Promise<any>
}

const queue = new Map<string, {
  timerId: ReturnType<typeof setTimeout> | null
  abortController: AbortController | null
  promise: Promise<any> | null
}>()

/**
 * Додати запит у чергу
 */
export async function enqueue(req: FetchRequest): Promise<any> {
  const existing = queue.get(req.key)
  
  // Cancel previous if requested
  if (req.cancelPrevious && existing) {
    if (existing.timerId) {
      clearTimeout(existing.timerId)
    }
    if (existing.abortController) {
      existing.abortController.abort()
    }
  }
  
  // Debounce
  return new Promise((resolve, reject) => {
    const timerId = setTimeout(async () => {
      const abortController = new AbortController()
      
      queue.set(req.key, {
        timerId: null,
        abortController,
        promise: null,
      })
      
      try {
        const result = await req.fn()
        resolve(result)
      } catch (error) {
        reject(error)
      } finally {
        queue.delete(req.key)
      }
    }, req.debounceMs)
    
    queue.set(req.key, {
      timerId,
      abortController: null,
      promise: null,
    })
  })
}

/**
 * Очистити чергу
 */
export function clear(): void {
  for (const entry of queue.values()) {
    if (entry.timerId) {
      clearTimeout(entry.timerId)
    }
    if (entry.abortController) {
      entry.abortController.abort()
    }
  }
  queue.clear()
}
```

### Інтеграція

**Файл:** `src/modules/marketplace/stores/marketplaceStore.ts`

```typescript
import { marketplaceFetchQueue } from '../services/marketplaceFetchQueue'

async function loadTutors(reset: boolean = false) {
  return marketplaceFetchQueue.enqueue({
    key: 'tutors',
    debounceMs: 300,
    cancelPrevious: true,
    priority: 'normal',
    fn: async () => {
      if (reset) {
        currentPage.value = 1
        tutors.value = []
      }
      
      isLoading.value = true
      
      try {
        const response = await marketplaceApi.getTutors(
          filters.value,
          currentPage.value,
          pageSize.value,
          sortBy.value
        )
        
        if (reset) {
          tutors.value = response.results
        } else {
          tutors.value = [...tutors.value, ...response.results]
        }
        totalCount.value = response.count
      } finally {
        isLoading.value = false
      }
    },
  })
}
```

### Acceptance Criteria

- [ ] `marketplaceFetchQueue.ts` створено
- [ ] `loadTutors()` використовує чергу
- [ ] Cancel previous працює
- [ ] Debounce працює
- [ ] Немає паралельних запитів

---

## Технічні завдання (для агентів)

### ТЗ-1: Request Governor (Рівень 1)

**Файли:**
- `src/core/network/requestGovernor.ts`
- Інтеграція в `src/utils/apiClient.js`

**Acceptance:**
- `canRequest()` блокує запити
- Rate limit працює
- CRITICAL_AUTH може пройти

**Час:** 3 години

---

### ТЗ-2: Endpoint Classifier (Рівень 2)

**Файли:**
- `src/core/network/endpointClassifier.ts`
- Інтеграція в `src/utils/apiClient.js`

**Acceptance:**
- Всі endpoint'и класифіковані
- `getErrorPolicy()` працює
- BACKGROUND не викликає logout
- Unit tests 100%

**Час:** 4 години

---

### ТЗ-3: Auth State Machine (Рівень 3)

**Файли:**
- `src/modules/auth/store/authStore.js`

**Acceptance:**
- `authState` реалізовано
- Всі переходи працюють
- `isAuthenticated` = getter
- Тести покривають всі стани

**Час:** 5 годин

---

### ТЗ-4: Polling Manager (Рівень 4)

**Файли:**
- `src/core/network/pollingManager.ts`
- Міграція `notificationsStore.ts`
- Міграція `lessonStore.js`

**Acceptance:**
- Polling централізований
- Backoff на 429 працює
- Автоматичний start/stop

**Час:** 4 години

---

### ТЗ-5: Marketplace Fetch Queue (Рівень 5)

**Файли:**
- `src/modules/marketplace/services/marketplaceFetchQueue.ts`
- Міграція `marketplaceStore.ts`

**Acceptance:**
- Cancel previous працює
- Debounce працює
- Немає паралельних запитів

**Час:** 3 години

---

### ТЗ-6: Integration Tests

**Файли:**
- `src/core/network/__tests__/integration.spec.ts`

**Acceptance:**
- Тести покривають всі 5 рівнів
- Інваріанти перевіряються
- CI/CD проходить

**Час:** 4 години

---

## Загальний час реалізації

**Рівень 1:** 3 години  
**Рівень 2:** 4 години  
**Рівень 3:** 5 годин  
**Рівень 4:** 4 години  
**Рівень 5:** 3 години  
**Тести:** 4 години  

**Всього:** ~23 години (3 робочі дні для агента)

---

## Порядок впровадження (ВАЖЛИВО)

### Фаза A: Пасивний режим (тільки логи)

1. ТЗ-1 (Request Governor) — пасивний, тільки логи
2. ТЗ-2 (Endpoint Classifier) — пасивний, тільки логи

**Мета:** Зібрати метрики, переконатися що класифікація правильна.

### Фаза B: Enforced режим

3. ТЗ-1 (Request Governor) — увімкнути blocking
4. ТЗ-3 (Auth State Machine)

**Мета:** Заблокувати self-DDoS, впровадити state machine.

### Фаза C: Централізація

5. ТЗ-4 (Polling Manager)
6. ТЗ-5 (Marketplace Fetch Queue)

**Мета:** Централізувати polling та marketplace fetch.

### Фаза D: Тести та фіксація

7. ТЗ-6 (Integration Tests)
8. Документація
9. Team training

---

## Ризики та мітігація

| Ризик | Ймовірність | Вплив | Мітігація |
|-------|-------------|-------|-----------|
| Ламається auth flow | Середня | Критичний | Пасивний режим спочатку |
| Performance regression | Низька | Середній | Benchmarks до/після |
| Складність підтримки | Середня | Середній | Чітка документація |
| Конфлікт з існуючим кодом | Висока | Високий | Поетапне впровадження |

---

## Успішне завершення

**Критерії:**
- ✅ Всі 5 рівнів реалізовані
- ✅ Інваріанти виконуються
- ✅ Немає refresh-циклів
- ✅ Немає self-DDoS
- ✅ BACKGROUND не ламає auth
- ✅ Тести проходять
- ✅ CI/CD перевіряє

**Наступний крок:** Production deployment з моніторингом.

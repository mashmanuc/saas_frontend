# План В — Викоренення подьргування сторінок і викидання в авторизацію
**Дата:** 2026-02-26
**Пріоритет:** 🔴 КРИТИЧНО для UX та стабільності
**Статус:** Готовий до виконання

---

## Два окремих феномени

### Феномен 1: "Подьргування" (jiggling)
Сторінка завантажується → з'являється лоадер → зникає лоадер → сторінка "стрибає"

### Феномен 2: "Викидання в авторизацію" (auth redirect)
Користувач натискає посилання → коротко бачить `/start` або форму реєстрації → повертається

---

## ЧАСТИНА 1 — Подьргування сторінок

### Корінна причина

```
Навігація між сторінками:
  ↓ router.push('/tutor/marketplace')
  ↓ beforeEach guard: await authStore.reloadUser()  ← 200-500ms API call
  ↓ компонент монтується
  ↓ onMounted: store.fetchData() → loader.start()    ← ще один запит
  ↓ GlobalLoader overlay з'являється (z-index: 60)   ← контент прихований
  ↓ API відповідає → loader.stop()
  ↓ fade-out 200ms                                   ← overlay блокував кліки (ВЖЕ ВИПРАВЛЕНО)
  ↓ сторінка доступна
```

**Проблем дві:**
1. ~~overlay блокував кліки~~ ← **ВЖЕ ВИПРАВЛЕНО** в GlobalLoader.vue
2. Навігаційні запити тригерять GlobalLoader замість inline-спінера

### Виправлення 1.1 — GlobalLoader (ВЖЕ ВИПРАВЛЕНО) ✅

`pointer-events: none` додано в `GlobalLoader.vue`.

### Виправлення 1.2 — skipLoader для всіх навігаційних API

**Правило:** GlobalLoader показується тільки для **явних дій користувача** (сабміт форми, завантаження файлу). Навігаційні запити — inline-спінер у компоненті.

#### Де додати skipLoader:

**Файл:** `frontend/src/modules/marketplace/api/marketplace.ts`
```ts
// getTutorMeProfile — ВЖЕ ВИПРАВЛЕНО (Bug #12)
// apiGetFull — ВЖЕ ВИПРАВЛЕНО (Bug #12)

// Перевірити ще:
export function getTutorCatalog(params) {
  return api.get('/marketplace/tutors', {
    params,
    meta: { skipLoader: true }  // ← каталог завантажується inline
  })
}

export function getTutorPublicProfile(slug: string) {
  return api.get(`/marketplace/tutors/${slug}`, {
    meta: { skipLoader: true }  // ← профіль тьютора
  })
}
```

**Файл:** `frontend/src/modules/booking/api/` (calendarWeekApi та інші)
```ts
// Весь calendar API — тільки inline-спінери:
export function fetchWeekSnapshot(params) {
  return api.get('/booking/calendar/snapshot', {
    params,
    meta: { skipLoader: true }
  })
}

export function fetchAvailability(tutorId, params) {
  return api.get(`/booking/tutors/${tutorId}/availability`, {
    params,
    meta: { skipLoader: true }
  })
}
```

**Файл:** `frontend/src/stores/notificationsStore.js`
```js
async loadNotifications(params = {}) {
  // Додати skipLoader:
  const response = await api.get('/notifications', {
    params,
    meta: { skipLoader: true }
  })
}
```

**Файл:** `frontend/src/stores/relationsStore.js`
```js
async fetchRelations() {
  if (this._inFlight) return
  this._inFlight = true
  try {
    const response = await api.get('/people/relations', {
      meta: { skipLoader: true }
    })
    // ...
  } finally {
    this._inFlight = false
  }
}
```

#### Коли GlobalLoader залишається (без skipLoader):
- `POST /marketplace/profile` — збереження профілю
- `POST /booking/slots` — збереження слотів
- `POST /auth/login` — логін
- `PUT /marketplace/profile/publish` — публікація профілю
- Будь-яка дія з кнопки "Зберегти" / "Опублікувати"

### Виправлення 1.3 — Уникнути reloadUser при кожній навігації

**Файл:** `frontend/src/router/index.js`

**Поточна логіка:**
```js
router.beforeEach(async (to, from, next) => {
  if (!auth.initialized) await auth.bootstrap()
  if (auth.hasToken && !auth.user) await auth.reloadUser()  // ← виклик API при кожній навігації якщо user не завантажений
  // ...
})
```

**Проблема:** Якщо Vue Suspense або компонент скинув `auth.user` (наприклад при помилці) — кожна навігація робить зайвий API call.

**Виправлення — додати часову мітку:**
```js
// authStore.js — додати lastUserFetch:
state: () => ({
  // ...
  _lastUserFetch: null,
  USER_CACHE_TTL: 5 * 60 * 1000,  // 5 хвилин
}),

actions: {
  async reloadUser() {
    const now = Date.now()
    if (this._lastUserFetch && (now - this._lastUserFetch) < this.USER_CACHE_TTL) {
      return  // Не перезавантажувати якщо дані свіжі
    }
    try {
      const res = await api.get('/users/me', { meta: { skipLoader: true } })
      this.user = res.data.data
      this._lastUserFetch = now
    } catch (e) {
      this.forceLogout()
    }
  }
}
```

---

## ЧАСТИНА 2 — Викидання в авторизацію

### Корінна причина

```
Сценарій 1: Жорстка навігація (window.location.href = '/tutor')
  ↓ Повне перезавантаження сторінки
  ↓ Vue/Pinia починаються з нуля
  ↓ authStore.bootstrap() — async, займає 200-800ms
  ↓ router.beforeEach() спрацьовує СИНХРОННО або раніше
  ↓ auth.initialized = false → auth.user = null
  ↓ guard: !isAuthenticated → next('/start')
  ↓ ← ВИКИДАННЯ В АВТОРИЗАЦІЮ!

Сценарій 2: Access token протух, refresh не встиг
  ↓ api.get('/users/me') → 401
  ↓ apiClient interceptor: спроба refresh
  ↓ якщо refresh теж 401 → forceLogout()
  ↓ ← ВИКИДАННЯ В АВТОРИЗАЦІЮ (правильно, але неочікувано для юзера)

Сценарій 3: Notification кліком → неправильний роут
  ↓ router.push('/relations/123')  ← НЕІСНУЮЧИЙ РОУТ
  ↓ router fallback → redirect to '/start'
  ↓ ← ВИКИДАННЯ В АВТОРИЗАЦІЮ!
  ← ВЖЕ ВИПРАВЛЕНО в NotificationBell.vue та NotificationsView.vue
```

### Виправлення 2.1 — Заборона жорсткої навігації

**Правило:** Ніколи не використовувати `window.location.href` всередині Vue app.

**Пошук:**
```bash
grep -rn "window.location.href\|window.location.assign\|window.location.replace" frontend/src/ --include="*.vue" --include="*.ts" --include="*.js"
```

**Замінити на:**
```js
// Замість:
window.location.href = '/tutor'

// Використовувати:
import { useRouter } from 'vue-router'
const router = useRouter()
router.push('/tutor')

// Або якщо потрібно повне перезавантаження (лише після logout):
// router.push('/start')
// window.location.href = '/start'  ← тільки для logout!
```

### Виправлення 2.2 — Захист router guard від race condition

**Файл:** `frontend/src/router/index.js`

**Поточний guard (вже відносно непоганий):**
```js
router.beforeEach(async (to, from, next) => {
  if (!auth.initialized) {
    await auth.bootstrap()
  }
  if (auth.hasToken && !auth.user) {
    await auth.reloadUser()
  }
  // ...
})
```

**Проблема:** `auth.hasToken` перевіряє `localStorage` синхронно, але `auth.user` null між стартом і завершенням `bootstrap()`.

**Виправлення — додати `bootstrapPromise` щоб не запускати bootstrap двічі:**
```js
// authStore.js
state: () => ({
  _bootstrapPromise: null,
  initialized: false,
}),

actions: {
  bootstrap() {
    if (this._bootstrapPromise) return this._bootstrapPromise
    this._bootstrapPromise = this._doBootstrap()
      .finally(() => {
        this.initialized = true
        this._bootstrapPromise = null
      })
    return this._bootstrapPromise
  },

  async _doBootstrap() {
    if (this.initialized) return
    const token = storage.getAccess()
    if (token) {
      await this.reloadUser()
    }
    this.startProactiveRefresh()
  }
}
```

**router/index.js:**
```js
router.beforeEach(async (to, from, next) => {
  // Один виклик bootstrap (idempotent через promise reuse):
  await auth.bootstrap()

  const isAuth = auth.isAuthenticated
  const requiresAuth = to.meta.requiresAuth !== false

  if (requiresAuth && !isAuth) {
    return next({ path: '/start', query: { redirect: to.fullPath } })
  }

  if (!requiresAuth && isAuth && to.path === '/start') {
    return next(auth.getDefaultRoute())
  }

  // Role-based access:
  if (!hasAccess(auth.user, to)) {
    return next(auth.getDefaultRoute())
  }

  next()
})
```

### Виправлення 2.3 — Proactive token refresh (вже є, але перевірити)

**Файл:** `frontend/src/modules/auth/store/authStore.js`

Вже реалізовано:
```js
startProactiveRefresh() {
  // Кожні 15 хвилин рефрешить токен
  // Пропускає якщо вкладка прихована
  // Рефрешить при focus якщо минуло > 14 хвилин
}
```

**Перевірити що `startProactiveRefresh()` викликається з `bootstrap()`:**
```js
async _doBootstrap() {
  if (this.initialized) return
  const token = storage.getAccess()
  if (token) {
    await this.reloadUser()
  }
  this.startProactiveRefresh()  // ← повинно бути тут
}
```

### Виправлення 2.4 — apiClient race condition (вже є, перевірити)

**Файл:** `frontend/src/utils/apiClient.js`

Вже реалізовано:
```js
// isRefreshingToken + refreshQueue:
if (isRefreshingToken) {
  return new Promise((resolve, reject) => {
    refreshQueue.push({ resolve, reject })
  })
}
```

**Переконатись що при 401:**
1. Не робиться `forceLogout()` одразу
2. Спочатку намагається `refreshAccess()`
3. Тільки при невдачі refresh → `forceLogout()`

### Виправлення 2.5 — Нотифікувати користувача перед logout

**Файл:** `frontend/src/modules/auth/store/authStore.js`

```js
async forceLogout(reason = 'session_expired') {
  // Зберегти URL куди повернутись:
  const returnUrl = router.currentRoute.value?.fullPath

  // Очистити стан:
  storage.clearAccess()
  this.user = null
  this.initialized = false

  // Відключити WS:
  realtimeStore.disconnect()

  // Скинути всі store:
  // this.$reset() та інші store

  // Зберегти повідомлення для показу після логін:
  if (reason === 'session_expired') {
    sessionStorage.setItem('auth_message', 'session_expired')
  }

  // Redirect з поверненням:
  router.push({
    path: '/start',
    query: returnUrl ? { redirect: returnUrl } : {}
  })
}
```

**На сторінці логіну — показати повідомлення:**
```js
onMounted(() => {
  const msg = sessionStorage.getItem('auth_message')
  if (msg === 'session_expired') {
    sessionStorage.removeItem('auth_message')
    notifyStore.warning('Сесія закінчилась. Будь ласка, увійдіть знову.')
  }
})
```

---

## ЧАСТИНА 3 — Правильний refresh token flow

### Поточний flow (з apiClient.js)

```
API call → 401 Unauthorized
  ↓
isRefreshingToken = false?
  ↓ YES
  isRefreshingToken = true
  POST /auth/token/refresh (httpOnly cookie)
  ↓ SUCCESS → новий access token
    oновити localStorage
    processRefreshQueue(token)  ← виконати всі очікуючі запити
    isRefreshingToken = false
    retry original request
  ↓ FAIL → forceLogout()

isRefreshingToken = true?
  ↓ YES (concurrent request)
  Додати в refreshQueue
  Чекати на результат
```

**Цей flow вже правильний.** Але є одна потенційна проблема:

### Виправлення 3.1 — Не робити forceLogout при мережевій помилці

```js
// apiClient.js — interceptor на помилки:
if (error.response?.status === 401) {
  // Спроба refresh
  try {
    const newToken = await authStore.refreshAccess()
    // retry...
  } catch (refreshError) {
    // Перевірити чи це мережева помилка:
    if (!navigator.onLine || refreshError.code === 'NETWORK_ERROR') {
      // Не робити forceLogout при відсутності інтернету!
      // Просто повернути помилку:
      return Promise.reject(error)
    }
    // Тільки при 401 від сервера → logout:
    authStore.forceLogout('session_expired')
    return Promise.reject(error)
  }
}
```

### Виправлення 3.2 — Sync access token між вкладками

```js
// authStore.js — синхронізація між вкладками:
onMounted(() => {
  window.addEventListener('storage', (event) => {
    if (event.key === 'access') {
      if (!event.newValue) {
        // Інша вкладка зробила logout:
        authStore.forceLogout('other_tab_logout')
      } else if (event.newValue !== event.oldValue) {
        // Інша вкладка оновила токен — взяти новий:
        // Не потрібен re-fetch, apiClient сам візьме з localStorage
      }
    }
  })
})
```

---

## Підсумок — Порядок виконання

| # | Дія | Де | Пріоритет | Складність |
|---|-----|-----|-----------|-----------|
| 1 | ~~GlobalLoader pointer-events~~ | `GlobalLoader.vue` | ✅ Зроблено | — |
| 2 | skipLoader для marketplace catalog, getTutorPublicProfile | `marketplace.ts` | 🔴 Зараз | 30 хв |
| 3 | skipLoader для calendar API | `calendarWeekApi.ts` | 🔴 Зараз | 30 хв |
| 4 | skipLoader для notifications/relations store | stores | 🔴 Зараз | 20 хв |
| 5 | Пошук та заміна window.location.href | весь src/ | 🟡 Важливо | 30 хв |
| 6 | bootstrapPromise в authStore | `authStore.js` | 🟡 Важливо | 1 год |
| 7 | _lastUserFetch кеш в authStore | `authStore.js` | 🟡 Важливо | 30 хв |
| 8 | forceLogout + сесія message + return URL | `authStore.js` | 🟡 Важливо | 1 год |
| 9 | forceLogout при мережевій помилці — НЕ logout | `apiClient.js` | 🟡 Важливо | 20 хв |
| 10 | localStorage sync між вкладками | `authStore.js` | 🟢 Minor | 30 хв |

---

## Очікуваний результат після виконання

### До виправлень:
```
Навігація → GlobalLoader 4-7 сек → overlay блокує кліки → "подьргування"
Refresh сторінки → /start на 0.5с → повернення на сторінку
Ноутбук прокинувся → токен протух → silently logout без пояснень
```

### Після виправлень:
```
Навігація → inline спінер у компоненті → контент з'являється плавно
Refresh сторінки → завантажується одразу (bootstrap ідемпотентний)
Ноутбук прокинувся → proactive refresh відновлює токен непомітно
Токен протух (рідкість) → "Сесія закінчилась, увійдіть знову" → /start
```

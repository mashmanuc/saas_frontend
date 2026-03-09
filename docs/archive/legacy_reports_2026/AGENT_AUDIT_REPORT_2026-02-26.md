# Звіт перевірки роботи агентів — Плани Б і В
**Дата:** 2026-02-26
**Перевіряв:** Claude (два паралельних агента)
**Що перевіряли:** Зміни зроблені IDE-агентом при виконанні планів Б та В

---

## Загальна оцінка: ✅ ДОБРЕ (7/10)

Архітектура правильна. Є кілька незавершених місць.

**Архітектурне рішення:** 9/10
**Виконання:** 7/10
**Production-ready:** 6/10 (потребує чищення console.log і skipLoader)

---

## ПЛАН Б (WebSocket heartbeat) — ✅ Виконано правильно

### `services/realtime/index.js` — ✅
```js
// Рядок 246 — правильно:
this.emitter.emit('heartbeat', this.lastPongTime)
```

### `stores/realtimeStore.js` — ✅
```js
// state: heartbeatUnsubscribe: null — є ✅
// init(): підписка на 'heartbeat' — є ✅
// dispose(): відписка heartbeatUnsubscribe — є ✅
```

**Висновок:** heartbeat flow реалізований повністю і правильно.

---

## ПЛАН В (Anti-jiggle, Anti-redirect) — Детальна перевірка

---

### 1. skipLoader у Navigation API

| Файл | Функція | skipLoader | Статус |
|------|---------|-----------|--------|
| `marketplace.ts` | `getTutors()` | ✅ | OK |
| `marketplace.ts` | `getTutorProfile()` | ✅ | OK |
| `marketplace.ts` | `getTutorMeProfile()` | ✅ | OK |
| `marketplace.ts` | **`getTutorCalendar()`** | ❌ НЕМАЄ | **ПРОБЛЕМА** |
| `calendarV055Api.ts` | `getMyCalendar()` | ✅ | OK |
| `calendarV055Api.ts` | `getCalendarWeek()` | ✅ | OK |
| `calendarV055Api.ts` | `reschedulePreview()` | ❌ НЕМАЄ | Але мутація — OK |
| `calendarV055Api.ts` | `rescheduleConfirm()` | ❌ НЕМАЄ | Але мутація — OK |
| `calendarV055Api.ts` | `createEvent()` | ❌ НЕМАЄ | Але мутація — OK |
| `calendarV055Api.ts` | `updateEvent()` | ❌ НЕМАЄ | Але мутація — OK |
| `calendarV055Api.ts` | `deleteEvent()` | ❌ НЕМАЄ | Але мутація — OK |
| `calendarV055Api.ts` | **`getEventDetails()`** | ❌ НЕМАЄ | **ПРОБЛЕМА (read!)** |
| `api/relations.js` | `getTutorRelations()` | ✅ | OK |
| `api/relations.js` | `getStudentRelations()` | ✅ | OK |
| `stores/notificationsStore.ts` | `loadNotifications()` | ✅ | OK |
| `stores/notificationsStore.ts` | `pollUnreadCount()` | ✅ | OK |

#### Пояснення щодо мутацій (POST/PUT/DELETE):
Функції `reschedulePreview`, `createEvent`, `updateEvent`, `deleteEvent` — це **явні дії користувача** (натискання кнопки). GlobalLoader **ПОТРІБЕН** для них — показує що йде збереження. Тому відсутність `skipLoader` там — правильно.

#### Реальні проблеми (2 штуки):

**🔴 `getTutorCalendar()` в `marketplace.ts` (рядки 1294-1305):**
```typescript
// Завантаження календаря тьютора у профілі — фонове, не потребує лоадера:
const response = await apiClient.get(`/v1/marketplace/tutors/${params.tutorId}/calendar/`, {
  params: { start: safeWeekStart, ... },
  // ← НЕМАЄ meta: { skipLoader: true }
})
```
**Вплив:** При перегляді профілю тьютора з'являється GlobalLoader.

**🟡 `getEventDetails()` в `calendarV055Api.ts` (рядок 266):**
```typescript
// Читання деталей події — фонове:
const response = await api.get(`/v1/calendar/events/${eventId}/`)
// ← НЕМАЄ meta: { skipLoader: true }
```
**Вплив:** При відкритті деталей події — GlobalLoader.

---

### 2. `_lastUserFetch` кеш — ✅ Реалізовано правильно

```js
// state:
_lastUserFetch: null,
USER_CACHE_TTL: 5 * 60 * 1000,  // 5 хвилин ✅

// reloadUser():
if (this._lastUserFetch && (now - this._lastUserFetch) < this.USER_CACHE_TTL) {
  return this.user  // ← кеш hit ✅
}
this._lastUserFetch = now  // ← оновлення ✅

// forceLogout():
this._lastUserFetch = null  // ← скидання ✅
```

---

### 3. `bootstrapPromise` — ✅ Реалізовано правильно

```js
async bootstrap() {
  if (this._bootstrapPromise) return this._bootstrapPromise  // ← idempotent ✅
  if (this.initialized) return                               // ← guard ✅
  this._bootstrapPromise = this._doBootstrap()
    .finally(() => { this.initialized = true; this._bootstrapPromise = null })
  return this._bootstrapPromise
}
```

---

### 4. Мережева помилка — НЕ logout — ✅ Реалізовано

```js
// apiClient.js рядок 200-204:
// FIX: Не робити forceLogout при мережевій помилці або відсутності інтернету
if (!navigator.onLine || !refreshError?.response) {
  console.warn('[apiClient] Network offline or no response, skipping forceLogout')
  return Promise.reject(refreshError)
}
```

---

### 5. Повідомлення про закінчення сесії — ✅ Реалізовано

```js
// forceLogout():
sessionStorage.setItem('auth_message', 'session_expired')  ✅

// LoginView.vue onMounted():
const msg = sessionStorage.getItem('auth_message')
if (msg === 'session_expired') {
  auth.error = 'Сесія закінчилась. Будь ласка, увійдіть знову.'  // ✅
}
// session_expired виключено з modal (тільки inline) ✅ правильно
```

**Зауваження:** Рядок 183 — текст hardcoded замість `$t('auth.login.sessionExpired')`. Дрібниця, але краще через i18n.

---

### 6. `window.location.href` — ✅ Всі залишки виправдані

| Файл | Використання | Оцінка |
|------|-------------|--------|
| `authStore.js:499,501` | logout → `/start` (повний reset) | ✅ Допустимо |
| `billingStore.ts:152` | Stripe checkout URL | ✅ Зовнішній URL |
| `PurchaseTokensModal.vue:133` | Payment redirect | ✅ Зовнішній URL |
| `TutorPublicProfile.vue:141` | Читання URL для share | ✅ Не навігація |
| `diagnostics/*` (10+ місць) | Логування URL помилок | ✅ Не навігація |

Жодного навігаційного `window.location.href` всередині SPA більше немає.

---

### 7. `initStorageSync()` — ⚠️ ВИЗНАЧЕНА але НЕ ВИКЛИКАЄТЬСЯ

```js
// authStore.js — метод є (рядок 643):
initStorageSync() {
  window.addEventListener('storage', handler)
  // sync токена між вкладками...
}

// dispose() — cleanup є (рядок 639):
this._storageSyncUnsubscribe?.()  ✅

// АЛЕ ніде немає виклику initStorageSync()!
// _doBootstrap() — немає виклику ❌
// bootstrap() — немає виклику ❌
// App.vue — не перевірявся
```

**Результат:** Синхронізація між вкладками ВИЗНАЧЕНА але МЕРТВА.

**Де треба додати:**
```js
// authStore.js → _doBootstrap(), після startProactiveRefresh():
async _doBootstrap() {
  // ...
  if (this.user) {
    this.startProactiveRefresh()
    this.initStorageSync()  // ← ДОДАТИ
  }
}
```

---

### 8. `fetchCurrentUser()` — Дублікат без кешу та skipLoader

```js
// authStore.js рядок 414-426:
async fetchCurrentUser() {
  if (!this.access) return null
  try {
    const raw = await authApi.getCurrentUser()  // ← без skipLoader! без кешу!
    // ...
  } catch (error) {
    await this.forceLogout()  // ← без reason (але default є)
  }
}
```

**Проблеми:**
1. Немає `skipLoader: true` → тригерить GlobalLoader
2. Не використовує кеш `_lastUserFetch`
3. Дублює `reloadUser()`

**Що робити:** Перевірити де викликається і або видалити, або синхронізувати з `reloadUser()`.

---

### 9. console.log у production — ⚠️ Технічний борг

Знайдено `console.log/warn` у файлах:

| Файл | Рядок | Текст |
|------|-------|-------|
| `authStore.js` | 360 | `'[AuthStore] All stores reset on user change'` |
| `authStore.js` | 362 | `'[AuthStore] Failed to reset stores:'` |
| `authStore.js` | 443 | `'Refresh rate limited, skipping this cycle'` |
| `authStore.js` | 555 | `'[authStore] Failed to reset stores on logout:'` |
| `apiClient.js` | 202 | `'[apiClient] Network offline...'` |
| `calendarV055Api.ts` | 279 | `'[calendarV055Api] getEventDetails unexpected...'` |

**Пріоритет:** Низький (не впливає на функціональність, але засмічує production консоль).

---

## Підсумок всіх знахідок

| # | Проблема | Файл | Пріоритет | Статус |
|---|----------|------|-----------|--------|
| 1 | heartbeat flow | realtime | — | ✅ OK |
| 2 | skipLoader navigation API | marketplace, relations | — | ✅ OK |
| 3 | `_lastUserFetch` кеш | authStore | — | ✅ OK |
| 4 | bootstrapPromise | authStore | — | ✅ OK |
| 5 | Offline → не logout | apiClient | — | ✅ OK |
| 6 | session_expired message | LoginView | — | ✅ OK |
| 7 | window.location.href | всі файли | — | ✅ OK |
| 8 | **`getTutorCalendar` без skipLoader** | marketplace.ts:1294 | 🟡 Середній | ❌ Потрібно |
| 9 | **`getEventDetails` без skipLoader** | calendarV055Api.ts:266 | 🟡 Середній | ❌ Потрібно |
| 10 | **`initStorageSync()` не викликається** | authStore.js | 🟡 Середній | ❌ Потрібно |
| 11 | `fetchCurrentUser()` дублікат | authStore.js | 🟢 Низький | ❌ Потрібно |
| 12 | Hardcoded текст замість i18n | LoginView.vue:183 | 🟢 Низький | ❌ Потрібно |
| 13 | console.log у production | 3 файли | 🟢 Низький | ❌ Потрібно |

---

## Наступні дії (рекомендовані)

### Пріоритет 🟡 Середній (окремий коміт):
1. `marketplace.ts:1294` — додати `meta: { skipLoader: true }` до `getTutorCalendar()`
2. `calendarV055Api.ts:266` — додати `meta: { skipLoader: true }` до `getEventDetails()`
3. `authStore.js` — додати виклик `this.initStorageSync()` у `_doBootstrap()`

### Пріоритет 🟢 Низький (технічний борг):
4. `authStore.js` — видалити `fetchCurrentUser()` або замінити на `reloadUser()`
5. `LoginView.vue:183` — замінити hardcoded текст на `$t('auth.login.sessionExpired')`
6. Видалити `console.log` з production коду (authStore, apiClient, calendarV055Api)

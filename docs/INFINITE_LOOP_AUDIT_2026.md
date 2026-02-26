# Аудит нескінченних лодерів — 2026-02-26

## Дата: 2026-02-26
## Статус: ВИПРАВЛЕНО

---

## Симптом

На багатьох сторінках (dashboard, billing, classrooms та ін.) глобальний спінер "Завантаження..." залишався активним нескінченно довго, блокуючи UI.

---

## Архітектура глобального лодера

```
GlobalLoader.vue  →  loaderStore.js  →  apiClient.js interceptors
     ↑ isLoading        ↑ active > 0         ↑ start() / stop()
```

- `loaderStore.js` — лічильник `active`. Кожен `start()` інкрементує (+1), `stop()` декрементує (-1).
- `GlobalLoader.vue` — показує оверлей коли `active > 0`.
- `apiClient.js` — request interceptor робить `loader.start()`, response interceptor — `loader.stop()`.

Якщо `start()` викликається більше разів ніж `stop()` — лодер зависає назавжди.

---

## Root Causes (3 критичні)

### RC-1: `authApi.refresh()` і `authApi.csrf()` без `skipLoader`

**Файл**: `src/modules/auth/api/authApi.js`

`refresh()` викликається:
1. Кожні 15 хвилин через `startProactiveRefresh()` (authStore.js:410)
2. При поверненні до вкладки через `visibilitychange` (authStore.js:432)
3. При 401 error в apiClient interceptor (apiClient.js:175)

`csrf()` викликається при ініціалізації сесії.

**Проблема**: Ці фонові запити проходили через `apiClient` без `meta.skipLoader`, тому кожен refresh показував глобальний спінер на ~200-500мс. При повільній мережі або race conditions — спінер міг застрягнути.

**Виправлення**: Додано `{ meta: { skipLoader: true } }` для `refresh()` і `csrf()`.

### RC-2: Подвійний `loader.start()` при 401 retry

**Файл**: `src/utils/apiClient.js`

**Сценарій**:
1. Original request → `loader.start()` (+1)
2. 401 error → `loader.stop()` (-1) в error interceptor
3. Token refresh → `authApi.refresh()` → (тепер skipLoader)
4. Retry request `api(original)` → **знову `loader.start()`** (+1) через request interceptor
5. Retry response → `loader.stop()` (-1)

Для одного запиту: `start(2) - stop(2) = 0` — balanced.

**АЛЕ**: при паралельних запитах (5-10 одночасно), кожен потрапляє в `refreshQueue`, і кожен retry робить додатковий `start()`. Якщо один з retries фейлиться — `active` залишається > 0.

**Виправлення**: Retry-запити позначаються `meta.skipLoader = true`, бо `stop()` для оригінального запиту вже відбувся.

### RC-3: Відсутність safety timeout

**Файл**: `src/stores/loaderStore.js`

**Проблема**: Не існувало механізму автоматичного скидання лічильника. Якщо через будь-який edge case `active > 0` залишався назавжди — UI був заблокований до перезавантаження.

**Виправлення**: Додано safety timeout 15 секунд — якщо лодер крутиться більше 15с, лічильник автоматично скидається до 0 з console.warn для діагностики.

---

## Виправлені файли

| Файл | Зміна |
|---|---|
| `src/modules/auth/api/authApi.js` | `skipLoader: true` для `refresh()` і `csrf()` |
| `src/utils/apiClient.js` | `skipLoader: true` для retry-запитів (рядки 166-168, 185-186) |
| `src/stores/loaderStore.js` | Safety timeout 15с + `_startSafetyTimer` / `_clearSafetyTimer` |

---

## Перевірені та ОК stores/composables (108 файлів)

Всі наступні stores мають коректні `try/finally` блоки для скидання `isLoading`:

- `dashboardStore.ts` — `fetchStudentDashboard`, `fetchTutorDashboard` ✅
- `relationsStore.js` — `fetchTutorRelations`, `fetchStudentRelations` ✅
- `billingStore.ts` — `fetchMe`, `fetchPlans`, `startCheckout`, `cancel` ✅
- `entitlementsStore.ts` — `loadEntitlements` ✅
- `marketplaceStore.ts` — `searchTutors`, `loadMore` ✅
- `notificationsStore.ts` — `loadNotifications` ✅
- `inquiriesStore.ts` — `createInquiry`, `fetchInquiries`, etc. ✅
- `staffStore.ts` — всі async actions ✅
- `trustStore.ts` — всі async actions ✅
- `reviewStore.ts` — всі async actions ✅
- `subscriptionStore.ts` — `loadCurrentSubscription`, `subscribe`, `changePlan` ✅
- `paymentStore.ts` — `loadPayments`, `loadPayment` ✅
- `negotiationChatStore.ts` — `ensureThread`, `fetchThreads`, `fetchMessages` ✅
- `calendarStore.ts` — `loadSettings`, `updateSettings`, `loadSlots`, etc. ✅
- `slotStore.ts` — `loadSlots`, `updateSlot` ✅
- `onboardingStore.ts` — всі async actions ✅
- `boardHistoryStore.ts` — всі async actions ✅
- `useSlotEditor.ts` — `editSlot` ✅
- `useDragDrop.ts` — `checkPreview`, `confirmDrop` ✅
- `useTimeline.ts` — `loadTimeline` ✅
- `useClassroomEntry.ts` — `getJwtAndNavigate` ✅
- `useAvailability.ts` — `fetchWeek` ✅
- `useChatPolling.ts` — `loadInitialMessages` ✅

---

## Скрипт для автоматичного аудиту

**Файл**: `scripts/audit-loaders.mjs`

Запуск:
```bash
node scripts/audit-loaders.mjs
```

Шукає:
1. `isLoading = true` без `finally { isLoading = false }`
2. `loader.start()` без відповідного `loader.stop()`
3. `setTimeout` для скидання `isLoading` (fragile pattern)
4. `setInterval` без `clearInterval`

---

## Рекомендації для майбутньої розробки

1. **Завжди використовуйте `try/finally`** для скидання `isLoading` в async функціях
2. **Фонові запити** (polling, refresh, health-check) повинні мати `meta: { skipLoader: true }`
3. **Retry-запити** не повинні інкрементувати глобальний лодер
4. **Періодично запускайте** `node scripts/audit-loaders.mjs` для перевірки нових файлів
5. **Safety timeout** в `loaderStore` — останній рубіж захисту, не покладайтесь тільки на нього


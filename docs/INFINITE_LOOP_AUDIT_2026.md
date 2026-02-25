# Аудит нескінченних циклів та зависань
**Дата:** 2026-02-26  
**Автор:** Cascade (автоматичний аналіз)  
**Статус:** КРИТИЧНО — потребує негайного виправлення

---

## 🔴 КРИТИЧНІ БАГИ (виправлено в цій сесії)

### BUG-1: `inquiriesStore` — рефетч ніколи не виконується після мутацій

**Файл:** `src/stores/inquiriesStore.ts`  
**Проблема:** `fetchInquiries()` мала guard `if (isLoading.value) return items.value`.
Функції `cancelInquiry`, `acceptInquiry`, `rejectInquiry` встановлюють `isLoading=true`, 
потім викликають `refetch()` → `fetchInquiries()`. Але `fetchInquiries` бачить `isLoading=true` 
і **повертається без HTTP-запиту**. Дані залишаються застарілими після кожної дії.

**Наслідок:** UI показує старий статус inquiry після cancel/accept/reject. 
Користувач бачить "OPEN" коли має бути "CANCELLED".

**Виправлення:** Видалено `isLoading` guard з `fetchInquiries` з поясненням у коментарі.

---

## 🔴 КРИТИЧНІ ПРОБЛЕМИ (потребують виправлення)

### BUG-2: `negotiationChatStore` — `fetchThreads()` блокується своїм же `isLoading`

**Файл:** `src/stores/negotiationChatStore.ts:78`
```typescript
async function fetchThreads(): Promise<NegotiationThreadDTO[]> {
  if (isLoading.value) return threads.value  // ← BUG: блокує повторний виклик
```
**Проблема:** Якщо `ensureThread()` запущений (він ставить `isLoading=true`), 
одночасний `fetchThreads()` поверне кешовані дані без мережевого запиту.
Потенційний deadlock при паралельних викликах.

**Рекомендація:** Використати окремі `isLoadingThreads` та `isLoadingMessages` замість спільного `isLoading`.

---

### BUG-3: `dashboardStore` — єдиний `isLoading` блокує `fetchStudentDashboard` + `fetchTutorDashboard`

**Файл:** `src/modules/dashboard/store/dashboardStore.ts:42,90`
```typescript
async function fetchStudentDashboard() {
  if (isLoading.value) return  // ← Якщо tutor dashboard вантажиться — student не завантажиться
```
**Проблема:** Один спільний `isLoading` для двох незалежних функцій. 
При одночасному рендері student + tutor компонентів один з них ніколи не завантажиться.

**Рекомендація:** Окремі `isLoadingStudent` та `isLoadingTutor`.

---

### BUG-4: `useChatTransport` — watch на `chatStatus` може викликати нескінченний reconnect loop

**Файл:** `src/modules/chat/composables/useChatTransport.js:47-58`
```javascript
watch(() => chatStore.chatStatus, (status) => {
  if (status === 'offline') {
    wsFailureCount.value++
    if (wsFailureCount.value >= WS_RECONNECT_THRESHOLD) {
      fallbackToPolling()
    }
  }
})
```
**Проблема:** `fallbackToPolling()` → `startRecoveryAttempts()` → кожні 2 хв викликає 
`chatStore.subscribeToRealtime()`. Якщо WS постійно fail → `status` oscillates 
`offline → connecting → offline` → `wsFailureCount++` кожен раз.
Після деяких циклів `wsFailureCount` → Infinity, fallback залишається активним назавжди.

**Рекомендація:** Скинути `wsFailureCount=0` при переключенні на polling, 
або додати cap `wsFailureCount = Math.min(wsFailureCount, MAX_COUNT)`.

---

### BUG-5: `while(true)` без timeout guard у `usePdfImport`

**Файл:** `src/modules/winterboard/composables/usePdfImport.ts:133`
```typescript
while (true) {
  if (abortController?.signal.aborted) { ... }
  const elapsed = Date.now() - startTime
  if (elapsed > POLL_TIMEOUT_MS) { ... }  // 5 хв timeout
  const status = await winterboardApi.getImportStatus(sid, taskId)
  ...
  await sleep(POLL_INTERVAL_MS)
}
```
**Статус:** Частково безпечно — є timeout (5 хв) та abort signal.
**Ризик:** Якщо `winterboardApi.getImportStatus` кидає помилку без catch — цикл зупиняється.
Але якщо API постійно повертає `status: 'processing'` — зупиниться через 5 хв.

**Рекомендація:** Додати catch для мережевих помилок з лічильником невдалих спроб.

---

## 🟡 ПОМІРНІ ПРОБЛЕМИ

### WARN-1: Дублювання polling registration при re-mount компонентів

**Файли:** `App.vue`, `DashboardTutor.vue`, `StudentActiveTutorsSection.vue`, `ChatNotificationsBell.vue`

**Проблема:** Всі 4 компоненти реєструють polling task з `id: 'chat-unread-summary'` або 
`id: 'notifications-unread'`. `pollingCoordinator` дедуплікує за ID (підраховує `subscribers`).
Але при швидкому mount/unmount компонентів (наприклад, при router navigation) може виникнути 
ситуація де `subscribers` стає від'ємним через race condition.

**Рекомендація:** Перевірити `pollingCoordinator.unsubscribe()` — додати guard `Math.max(0, ...)`.

---

### WARN-2: `App.vue` — подвійна реєстрація polling при re-auth

**Файл:** `src/App.vue:57,119`
```javascript
// onMounted — реєструє polling
unsubNotifPolling = pollingCoordinator.register({ id: 'notifications-unread', ... })

// watch(isAuthenticated) — реєструє polling ЗНОВУ при логіні
unsubNotifPolling = pollingCoordinator.register({ id: 'notifications-unread', ... })
```
**Проблема:** Якщо користувач логіниться після mount — `unsubNotifPolling` перезаписується 
без виклику старого unsub. Старий subscriber залишається активним (`subscribers` +1).

**Виправлення:** Перед новою реєстрацією викликати `if (unsubNotifPolling) { unsubNotifPolling(); unsubNotifPolling = null }`.

---

### WARN-3: `inquiriesStore.fetchInquiries` після fix — потенційне дублювання запитів

**Після виправлення BUG-1:** Прибрано `isLoading` guard. Тепер паралельні виклики 
`fetchInquiries` можуть запустити кілька HTTP-запитів одночасно. 

**Рекомендація:** Замість `isLoading` guard використати promise deduplication:
```typescript
let fetchPromise: Promise<InquiryDTO[]> | null = null

async function fetchInquiries(filters = {}) {
  if (fetchPromise) return fetchPromise
  fetchPromise = apiFetchInquiries(filters)
    .finally(() => { fetchPromise = null })
  return fetchPromise
}
```

---

### WARN-4: `useCalendarDeepLink` — watch без `immediate: false` може тригерити fetch двічі

**Файл:** `src/composables/useCalendarDeepLink.ts:109`
```typescript
watch(() => route.query, () => {
  applyDeepLink()
})
```
**Проблема:** `applyDeepLink()` може викликатись і в `onMounted` і в watch при першому рендері.
Подвійний fetch при cold start.

---

## 🟢 БЕЗПЕЧНІ ПАТЕРНИ (підтверджено)

- `pollingCoordinator` — централізований, дедуплікований, visibility-aware ✅
- `useFollowMode` — `setInterval` з `clearInterval` в `stopFollowing` та `onUnmounted` ✅  
- `useLaserPointer` — `setInterval` з `clearInterval` в `onUnmounted` ✅
- `WBRemoteCursors` — `setInterval` з `clearInterval` в `onUnmounted` ✅
- `useAutosave` — debounce + cleanup в `destroy()` + `onUnmounted` ✅
- `boardStore.js` — `cursorCleanupTimer` з `clearInterval` в cleanup ✅
- `presenceStore.js` — `timer` з `clearInterval` в reset/destroy ✅

---

## 🔧 Рекомендовані виправлення (пріоритет)

| # | Файл | Проблема | Пріоритет |
|---|------|----------|-----------|
| 1 | `inquiriesStore.ts` | ✅ FIXED: refetch блокувався isLoading | КРИТИЧНО |
| 2 | `negotiationChatStore.ts` | Окремі isLoading для threads/messages | ВИСОКИЙ |
| 3 | `dashboardStore.ts` | Окремі isLoading для student/tutor | СЕРЕДНІЙ |
| 4 | `useChatTransport.js` | wsFailureCount cap + reset | СЕРЕДНІЙ |
| 5 | `App.vue` | Подвійна реєстрація polling при re-auth | СЕРЕДНІЙ |
| 6 | `inquiriesStore.ts` | Promise deduplication замість isLoading guard | НИЗЬКИЙ |

---

## 📊 Скрипт для детекції проблем у runtime

Для виявлення зависань у браузері можна запустити в DevTools Console:

```javascript
// Моніторинг нескінченних fetch-запитів
(function monitorInfiniteRequests() {
  const counts = {};
  const orig = window.fetch;
  window.fetch = function(url, ...args) {
    const key = typeof url === 'string' ? url.split('?')[0] : url;
    counts[key] = (counts[key] || 0) + 1;
    if (counts[key] > 10) {
      console.warn('[InfiniteLoop?] Fetch called', counts[key], 'times for:', key);
    }
    return orig.apply(this, [url, ...args]);
  };
  setInterval(() => {
    const suspects = Object.entries(counts)
      .filter(([, n]) => n > 5)
      .sort(([, a], [, b]) => b - a);
    if (suspects.length) console.table(suspects.map(([url, n]) => ({ url, count: n })));
    Object.keys(counts).forEach(k => counts[k] = 0);
  }, 5000);
})();

// Моніторинг pollingCoordinator
console.table(window.__pollingCoordinator?.getStats());
```

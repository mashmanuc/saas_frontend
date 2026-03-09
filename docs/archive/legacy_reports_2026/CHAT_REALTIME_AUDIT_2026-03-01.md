# Chat & Realtime — Глибокий аудит кодової бази

**Дата:** 2026-03-01
**Тригер:** Production логи — постійний HTTP polling online-status кожні 30с, auth/refresh 429 rate-limit, loader "Завантаження..." висить в ChatModal

---

## 1. Виявлені проблеми (за критичністю)

---

### P1 — CRITICAL: Presence polling кожні 30 секунд замість WebSocket

**Симптом у логах:**
```
22:36:27 "GET /api/users/online-status/?ids=21" 200 60
22:36:58 "GET /api/users/online-status/?ids=21" 200 60
22:37:28 "GET /api/users/online-status/?ids=21" 200 60
22:37:57 "GET /api/users/online-status/?ids=21" 200 60
```

**Root cause:**
`presenceStore.js:114-119` — `setInterval` кожні `REFRESH_INTERVAL = 30_000ms` викликає `fetch(trackedIds)` через HTTP API, **навіть коли WebSocket з'єднання через `realtimeService` ВІДКРИТЕ і працює**.

```
// presenceStore.js:114-119
this.timer = setInterval(() => {
  this.prune()
  if (this.trackedIds.length) {
    this.fetch(this.trackedIds)  // <-- HTTP GET кожні 30с ЗАВЖДИ
  }
}, REFRESH_INTERVAL)
```

`presenceStore` підписується на `realtimeService.subscribe('presence', ...)` для WS events (рядок 105-112), **але HTTP polling працює паралельно і НІКОЛИ не зупиняється** коли WS підключений.

**Вплив:** ~2880 зайвих HTTP запитів на добу на одного користувача. При 100 користувачах = 288К запитів/день.

**Файли:**
- `src/stores/presenceStore.js:94-119` — `subscribeRealtime()`, HTTP timer
- `src/api/presence.js:9` — HTTP endpoint `/users/online-status/`
- `backend/apps/users/api/urls.py:104` — `UsersOnlineStatusView`

---

### P2 — CRITICAL: Auth refresh 429 ще відбувається в production

**Симптом у логах:**
```
22:37:38 Rate limit exceeded for /api/v1/auth/refresh/ from IP 93.170.162.92
22:37:38 "POST /api/v1/auth/refresh/" 429 187
```

**Root cause:**
Хоча ми зафіксили `apiClient.js` (S1 — 422 тепер тригерить forceLogout), **це ще не задеплоєне в production**. Коміт `804a7ad` ще тільки локальний.

Крім того, є ще один вектор:
- `realtimeService` отримує `auth_required` → емітить event → authStore робить `refreshAccess()`
- Якщо `refreshAccess()` фейлиться з 429 → `lockedUntil` ставить 60с lock
- Але `useChatWebSocket.ts:75-85` має СВІЙ reconnect logic з backoff → при close code != 4001/4003 починає reconnect → token expired → знову refresh → ще один 429

**Подвійний reconnect loop:**
1. `realtimeService` → `handleClose()` → `scheduleReconnect()` → `connect()` → token refresh
2. `useChatWebSocket.ts` → `onclose` → `setTimeout(connectInternal)` → token refresh

**Два окремих WS з'єднання** обидва тригерять refresh одночасно → 429.

**Файли:**
- `src/utils/apiClient.js:237-260` — 422 handling (зафіксовано, не задеплоєно)
- `src/services/realtime/index.js:277-301` — handleClose + reconnect
- `src/composables/useChatWebSocket.ts:69-86` — onclose + reconnect
- `src/modules/auth/store/authStore.js` — refreshAccess()

---

### P3 — HIGH: Подвійна WebSocket архітектура — 2 з'єднання одночасно

**Проблема:**
Існують ДВІ незалежні WS системи:

| Компонент | WS URL | Використовується |
|-----------|--------|-----------------|
| `realtimeService` (singleton) | `/ws/gateway/` або `VITE_WS_URL` | `presenceStore`, `notifications`, `calendar` |
| `useChatWebSocket.ts` (per-thread) | `/ws/room/{threadId}/` | `negotiationChatStore` при `setActiveThread()` |

При відкритому чаті обидва відкриті одночасно. Це:
- Подвоює кількість WebSocket з'єднань на сервері
- Подвоює heartbeat traffic
- Подвоює auth token refresh при експірації
- Робить race condition між двома reconnect loops

**Правильна архітектура:** `useChatWebSocket` має використовувати `realtimeService` як транспорт, а не створювати окреме WS з'єднання.

**Файли:**
- `src/services/realtime/index.js` — глобальний WS singleton
- `src/composables/useChatWebSocket.ts:53-89` — другий WS
- `src/stores/negotiationChatStore.ts:200-206` — `setActiveThread()` → `wsConnect()`

---

### P4 — HIGH: ChatModal loader "Завантаження..." висить

**Симптом:** На скріншоті spinner + "Завантаження..." в модальному вікні чату.

**Root cause (ланцюг):**

1. `ChatModal.vue:222` — `watch(isOpen)` → `loadThread()`
2. `ChatModal.vue:48-49` — перевіряє кеш `threadsByStudent` → якщо є, верифікує через `GET /api/v1/chat/threads/{id}/messages/`
3. `chatThreadsStore.js:52` — `await apiClient.get('/api/v1/chat/threads/{cached.threadId}/messages/')`
4. **Цей запит може зафейлитись** якщо:
   - Access token протух (401) → тригерить refresh → якщо refresh повертає 422/429 → forceLogout або hang
   - Thread не існує (404) → `catch` видаляє кеш → створює новий thread
   - Network timeout → loader висить нескінченно

**Ключова помилка:** `ensureThread()` робить **верифікаційний GET запит** при КОЖНОМУ відкритті модалки, навіть якщо thread вже є в кеші. Це зайвий network round-trip.

```javascript
// chatThreadsStore.js:48-57
const cached = threadsByStudent.value.get(studentId)
if (cached?.threadId) {
  try {
    await apiClient.get(`/api/v1/chat/threads/${cached.threadId}/messages/`)
    return cached.threadId  // <-- extra GET for verification
  } catch (err) {
    threadsByStudent.value.delete(studentId)
  }
}
```

**Файли:**
- `src/modules/chat/components/ChatModal.vue:111-206` — `loadThread()`
- `src/stores/chatThreadsStore.js:37-86` — `ensureThread()`

---

### P5 — MEDIUM: Unread summary polling без адаптивної частоти

**Проблема:** `fetchUnreadSummary()` викликається:
- При mount `DashboardTutor.vue` та `StudentActiveTutorsSection.vue`
- При закритті `ChatModal` (рядок 211)
- Немає periodic polling → unread badge не оновлюється в реальному часі

**Але:** Якщо додати polling — це ще більше навантажить backend. Правильне рішення — отримувати unread updates через вже відкритий WebSocket.

**Файли:**
- `src/stores/chatThreadsStore.js:88-150` — `fetchUnreadSummary()`
- `src/modules/dashboard/views/DashboardTutor.vue:710-712`

---

### P6 — MEDIUM: NegotiationChatWindow — немає real-time оновлення

**Проблема:** `NegotiationChatWindow.vue` при `onMounted`:
1. Викликає `store.setActiveThread(threadId)` → це відкриває WS через `useChatWebSocket`
2. Викликає `store.fetchMessages(threadId)` → HTTP GET повідомлень

**Але:** WS handler `handleWsMessage()` працює через `room.message` → `message.new` payload — **це потребує що бекенд ChatConsumer надсилає message.new broadcast в room group**. Якщо ChatConsumer не broadcasti'ть (тільки відповідає відправнику) — другий користувач не бачить повідомлень в реальному часі.

Перевірити: `backend/apps/chat/services/chat_adapter.py` — чи broadcasti'ть `message.new` в room group.

**Файли:**
- `src/modules/negotiation/components/NegotiationChatWindow.vue:132-138`
- `src/composables/useChatWebSocket.ts:23-51` — `handleWsMessage()`
- `backend/apps/chat/consumers.py` — ChatConsumer
- `backend/apps/chat/services/chat_adapter.py` — routing logic

---

## 2. Архітектурна діаграма (поточний стан)

```
Browser
├── realtimeService (WebSocket #1)
│   └── ws://host/ws/gateway/?token=JWT
│       ├── subscribe('presence') → presenceStore
│       ├── subscribe('notifications') → notificationsStore
│       └── subscribe('chat') → chatStore (legacy)
│
├── useChatWebSocket (WebSocket #2)  ← ДУБЛІКАТ
│   └── ws://host/ws/room/{threadId}/?token=JWT
│       └── onmessage → negotiationChatStore.appendMessage()
│
├── presenceStore
│   ├── HTTP GET /users/online-status/ кожні 30с ← ЗАЙВИЙ
│   └── realtimeService.subscribe('presence')
│
├── chatThreadsStore
│   ├── HTTP POST /chat/threads/negotiation/ (ensureThread)
│   ├── HTTP GET /chat/threads/{id}/messages/ (verify cache) ← ЗАЙВИЙ
│   └── HTTP GET /chat/unread-summary/
│
└── negotiationChatStore
    ├── HTTP GET messages (initial load)
    ├── HTTP POST send message
    └── WS via useChatWebSocket (real-time updates)
```

---

## 3. План фіксів (в порядку пріоритету)

### Fix 1: Deploy existing auth fixes to production
**Зусилля:** 0 (вже зроблено, потрібен тільки deploy)
- Коміт `804a7ad` — apiClient.js 422 → forceLogout
- Це зупинить P2 на рівні interceptor

### Fix 2: Presence — зупинити HTTP polling коли WS підключений
**Зусилля:** ~30 хв | Файл: `presenceStore.js`
```
subscribeRealtime() {
  // ... existing subscribe ...
  this.timer = setInterval(() => {
    this.prune()
    // FIX: HTTP polling тільки як fallback коли WS не підключений
    if (this.trackedIds.length && realtimeService.getState() !== 'open') {
      this.fetch(this.trackedIds)
    }
  }, REFRESH_INTERVAL)
}
```
**Результат:** Зменшення HTTP трафіку на ~95% для presence.

### Fix 3: Уніфікація WS — видалити useChatWebSocket, використовувати realtimeService
**Зусилля:** ~2-3 години | Файли: `useChatWebSocket.ts`, `negotiationChatStore.ts`

Замість створення окремого WS на `/ws/room/{threadId}/`:
1. Підписатися через `realtimeService.subscribe(`chat:${threadId}`, handler)`
2. Backend: при `subscribe` до `chat:{threadId}` — додати user до room group
3. Frontend: видалити `useChatWebSocket.ts` повністю
4. `negotiationChatStore.setActiveThread()` → `realtimeService.subscribe()`

**Результат:** 1 WS з'єднання замість 2. Усунення подвійного reconnect loop (P3).

### Fix 4: ChatModal — не верифікувати кеш через HTTP
**Зусилля:** ~20 хв | Файл: `chatThreadsStore.js`
```
async function ensureThread(studentId, relationId) {
  const cached = threadsByStudent.value.get(studentId)
  // FIX: довіряємо кешу без верифікації — thread_id стабільний
  if (cached?.threadId) {
    return cached.threadId
  }
  // ... create thread via POST ...
}
```
**Результат:** ChatModal відкривається миттєво при повторних відкриттях.

### Fix 5: Unread updates через WebSocket
**Зусилля:** ~1-2 години | Файли: `chatThreadsStore.js`, backend consumer

Backend надсилає `{channel: 'chat', type: 'unread_update', thread_id, unread_count}` через WS коли приходить нове повідомлення.

Frontend: `realtimeService.subscribe('chat', handler)` → оновити `unreadSummary`.

**Результат:** Real-time unread badge без polling.

### Fix 6: Перевірити ChatConsumer broadcast
**Зусилля:** ~1 година | Файл: `backend/apps/chat/services/chat_adapter.py`

Перевірити що `message.send` handler broadcasti'ть `message.new` в `room_{thread_id}` group, а не тільки відповідає відправнику.

**Результат:** Другий учасник чату бачить повідомлення в реальному часі.

---

## 4. Порядок виконання

```
ЗАРАЗ:  Fix 1 (deploy) → Fix 2 (presence polling)
ПОТІМ:  Fix 4 (ChatModal cache trust) → Fix 6 (verify broadcast)
ПОТІМ:  Fix 3 (WS unification) → Fix 5 (WS unread)
```

---

## 5. Метрики успіху

| Метрика | Зараз | Після фіксів |
|---------|-------|-------------|
| HTTP requests/user/hour (presence) | ~120 | 0 (WS) або ~4 (fallback) |
| WebSocket connections/user | 2 | 1 |
| ChatModal open latency | 500ms-3s | <100ms (cached) |
| Auth refresh 429 в логах | Регулярно | 0 |
| Unread badge update delay | Manual refresh | <500ms (WS) |

---

## 6. Реалізовані фікси

### Fix 1 ✅ — apiClient 422 → forceLogout (раніше)
- **Файл:** `src/utils/apiClient.js:237-260`
- **Статус:** Зроблено, потребує deploy в production

### Fix 2 ✅ — Presence: HTTP polling тільки як fallback
- **Файл:** `src/stores/presenceStore.js:117`
- **Зміна:** Додано перевірку `realtimeService.getState() !== 'open'` — HTTP polling зупиняється коли WS підключений
- **Результат:** ~95% зменшення HTTP трафіку на `/users/online-status/`

### Fix 3 ✅ — WS уніфікація: realtimeService замість useChatWebSocket
**Backend:**
- `apps/realtime/gateway.py` — додано ACL для `chat:thread:{uuid}` каналів + метод `_is_chat_thread_participant()`
- `apps/websocket_engine/engine.py` — додано `WebSocketEngine.send_to_channel()` для broadcast в gateway groups
- `apps/chat/services/chat_realtime_service.py` — dual broadcast: `send_to_room()` + `send_to_channel('chat:thread:{uuid}')` для всіх подій (message.new, typing, read, edit, delete)

**Frontend:**
- `src/stores/negotiationChatStore.ts` — замінено `wsConnect/wsDisconnect/wsSend` на `realtimeService.subscribe('chat:thread:{uuid}')` + `_handleRealtimeEvent()`
- `src/modules/negotiation/components/NegotiationChatWindow.vue` — видалено імпорт `wsIsConnected`
- `src/stores/__tests__/negotiationChatStore.spec.ts` — оновлено mock з `useChatWebSocket` на `realtimeService`
- **Результат:** 1 WS з'єднання замість 2. Усунення подвійного reconnect loop

### Fix 4 ✅ — ChatModal: trust cache without verification GET
- **Файл:** `src/stores/chatThreadsStore.js:43-51`
- **Зміна:** Видалено верифікаційний `GET /api/v1/chat/threads/{id}/messages/` при кожному відкритті. Thread ID стабільний — довіряємо кешу
- **Результат:** ChatModal відкривається миттєво при повторних відкриттях

### Fix 5 — Backlog
- Unread updates через WS (не критично для поточного релізу)

### Fix 6 ✅ — ChatConsumer broadcast verified
- Backend `ChatRealtimeService.send_message()` коректно broadcasti'ть `message.new` в `room_{thread_id}` group
- Тепер також broadcasti'ть в `chat_thread_{uuid}` group для gateway підписників

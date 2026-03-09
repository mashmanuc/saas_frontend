# План Б — Глобальна стабілізація WebSocket / Realtime
**Дата:** 2026-02-26 (оновлено після аналізу реального коду)
**Пріоритет:** 🔴 КРИТИЧНО для real-time функціональності
**Статус:** Причина знайдена — готово до виконання

---

## Поточний стан (з browser-аудиту)

```
realtimeStore:
  status: "open"          ← з'єднання відкрите ✅
  initialized: true       ← ініціалізовано ✅
  lastHeartbeat: null     ← ❌ жодного heartbeat у store!
  subscriptions: []       ← Map не серіалізується (візуальна проблема)
  offline: false          ← онлайн ✅
```

---

## Архітектура (реальна, після аналізу коду)

```
realtimeStore.js
  └─ init()
       └─ realtimeService.init()      (services/realtime/index.js — RealtimeService)
       └─ realtimeService.on('message', ...) ← шукає {type:'pong'}
       └─ bindAuthWatcher() → auth.$subscribe() → connect() при логіні

RealtimeService (services/realtime/index.js):
  └─ connect() → new WebSocket(url?token=...)
  └─ handleOpen() → flushPending() + resubscribeAll() + startHeartbeat()
  └─ startHeartbeat() → setInterval(25_000ms) → надсилає {type:'ping'}
  └─ handleMessage()
       └─ {type:'pong'} → this.lastPongTime = Date.now()  ← ТІЛЬКИ ЛОКАЛЬНО!
                        → НЕ emit('message', ...)          ← ОСЬ БАГ!
       └─ {type:'auth_required'} → emit('auth_required')
       └─ {channel:'...'} → dispatch до channelSubscriptions
       └─ ІНШЕ → emit('message', data)
```

---

## ПРОБЛЕМА 1 — lastHeartbeat: null (ПРИЧИНА ЗНАЙДЕНА)

### Точний діагноз

**Файл:** `frontend/src/services/realtime/index.js`, рядки 243-247:

```js
// handleMessage() у RealtimeService:
if (data?.type === 'pong') {
  this.lastPongTime = Date.now()   // ← зберігає ЛОКАЛЬНО в сервісі
  this.resetHeartbeatTimeout()
  return                            // ← повертає! НЕ emit('message', data)!
}
```

**Файл:** `frontend/src/stores/realtimeStore.js`, рядки 114-118:

```js
// realtimeStore.init() слухає:
this.messageUnsubscribe = realtimeService.on('message', (payload) => {
  if (payload?.type === 'pong') {
    this.lastHeartbeat = Date.now()  // ← НІКОЛИ не виконується!
  }                                  // pong перехоплено раніше без emit
})
```

**Висновок:** `pong` перехоплюється в `RealtimeService.handleMessage()` і **не передається** в `realtimeStore` через emitter.

### Виправлення

**Варіант А (рекомендований) — нова подія 'heartbeat':**

**Файл:** `frontend/src/services/realtime/index.js`

```js
// В handleMessage(), після resetHeartbeatTimeout():
if (data?.type === 'pong') {
  this.lastPongTime = Date.now()
  this.resetHeartbeatTimeout()
  this.emitter.emit('heartbeat', this.lastPongTime)  // ← ДОДАТИ ЦЕЙ РЯДОК
  return
}
```

**Файл:** `frontend/src/stores/realtimeStore.js`

```js
// В state():
heartbeatUnsubscribe: null,

// В init() — замінити/доповнити messageUnsubscribe:
if (this.heartbeatUnsubscribe) {
  this.heartbeatUnsubscribe()
  this.heartbeatUnsubscribe = null
}
this.heartbeatUnsubscribe = realtimeService.on('heartbeat', (timestamp) => {
  this.lastHeartbeat = timestamp
})

// В dispose():
if (this.heartbeatUnsubscribe) {
  this.heartbeatUnsubscribe()
  this.heartbeatUnsubscribe = null
}
this.lastHeartbeat = null
```

---

## ПРОБЛЕМА 2 — subscriptions: [] (ДІАГНОЗ)

`realtimeStore.subscriptions` — це **`new Map()`**, а не масив.

При серіалізації в браузері (Vue devtools, JSON.stringify) `Map` виглядає як `{}` або `[]`. Це **не функціональний баг** — підписки реально є в Map.

**Перевірка в консолі:**
```js
const store = window.__pinia?.state?.value?.realtime
console.log('subs size:', store?.subscriptions?.size)        // → 1 або більше
console.log('channels:', [...(store?.subscriptions?.keys() || [])])
// → ["notifications_user_123"]
```

**Якщо size = 0 після логіну** — App.vue викликає підписку до встановлення з'єднання.
Це **не критично**: `RealtimeService.subscribe()` при відсутньому WS складає повідомлення в `pendingMessages[]` і відправляє після `handleOpen()` → `flushPending()`.

---

## ПРОБЛЕМА 3 — Re-subscribe після reconnect (ВЖЕ РЕАЛІЗОВАНО ✅)

**Файл:** `frontend/src/services/realtime/index.js`:

```js
// handleOpen() вже викликає:
resubscribeAll() {
  this.channelSubscriptions.forEach((subscribers, channel) => {
    if (subscribers.size) {
      this.send({ type: 'subscribe', channel })
    }
  })
}
```

✅ Після reconnect всі підписки автоматично відновлюються.

---

## ПРОБЛЕМА 4 — auth_required flow (ВЖЕ РЕАЛІЗОВАНО ✅)

```
Backend надсилає {type: 'auth_required'}
  ↓
RealtimeService.handleMessage() → emitter.emit('auth_required')
  ↓
websocket.ts: on('auth_required') → authStore.refreshAccess()
  ↓
realtimeService.handleTokenRefresh() → disconnect() + connect() з новим токеном
```

✅ При 401/protuhлому токені WS автоматично перепідключається.

---

## ПРОБЛЕМА 5 — Backend pong response

**Перевірити:**
```bash
grep -rn "pong\|ping" backend/ --include="*.py"
```

Frontend надсилає `{type: 'ping'}` кожні **25 секунд**. Backend має відповідати `{type: 'pong'}`.
При відсутності відповіді через 60 секунд → frontend закриє з'єднання і перепідключиться.

**Якщо backend не обробляє ping:**
```python
# consumers.py або routing handler
async def receive(self, text_data=None, bytes_data=None):
    data = json.loads(text_data or '{}')

    if data.get('type') == 'ping':
        import time
        await self.send(text_data=json.dumps({
            'type': 'pong',
            'timestamp': time.time()
        }))
        return
    # ... решта логіки
```

---

## Порядок виконання

### Крок 1 (КРИТИЧНИЙ, ~15 хв): Виправити lastHeartbeat

1. `services/realtime/index.js` — додати `this.emitter.emit('heartbeat', ...)` після pong
2. `stores/realtimeStore.js` — підписатись на `'heartbeat'` подію

### Крок 2 (5 хв): Перевірити backend pong

```bash
grep -rn "pong" backend/ --include="*.py"
```

Якщо немає — додати.

### Крок 3 (5 хв): Тестування

```js
// Після логіну в консолі:
const r = window.__pinia?.state?.value?.realtime
console.log('status:', r?.status)           // → "open"
console.log('heartbeat:', r?.lastHeartbeat) // → null спочатку
// Через 25 секунд:
console.log('heartbeat:', r?.lastHeartbeat) // → timestamp!
console.log('subs:', r?.subscriptions?.size) // → > 0
```

---

## Підсумок

| # | Проблема | Статус | Файл |
|---|----------|--------|------|
| 1 | lastHeartbeat: null | 🔴 БАГ | `services/realtime/index.js` + `stores/realtimeStore.js` |
| 2 | subscriptions: [] | 🟡 Map → виглядає порожнім | Не баг, але перевірити size |
| 3 | re-subscribe після reconnect | ✅ Реалізовано | — |
| 4 | auth_required + handleTokenRefresh | ✅ Реалізовано | — |
| 5 | Backend pong | 🔍 Перевірити | `backend/*/consumers.py` |

---

## Очікуваний результат після виправлення

```
realtimeStore:
  status: "open"
  initialized: true
  lastHeartbeat: 1740564615000  ← оновлюється кожні 25с
  subscriptions: Map(1) {"notifications_user_123" → Set(1)}
  offline: false
```

- ✅ Real-time сповіщення доходять до студента і тьютора
- ✅ При розриві — reconnect + re-subscribe (вже є)
- ✅ При протуханні токена — refresh + reconnect (вже є)
- ✅ При 60с без pong — автоматичний reconnect (вже є)

# Anti-Jank Strategy — SSOT

> Документ описує стратегію боротьби з "дьорганням" сторінки (page jank).
> Дата: 2026-02-20

---

## 1. Проблема

На production сторінка періодично "дьоргається" — приблизно кожні 30 секунд відбувається візуальний стрибок (layout shift). Причина: **множинні незалежні polling-цикли**, які одночасно оновлюють reactive state і тригерять re-render DOM.

### Виявлені джерела polling (до фіксу)

| Компонент | Endpoint | Інтервал | Проблема |
|-----------|----------|----------|----------|
| `App.vue` → `notificationsStore.startPolling()` | `/v1/notifications/?unread_only=true` | 60с (без WS) / 300с (з WS) | Глобальний, завжди активний |
| `ChatNotificationsBell.vue` | `chatThreadsStore.fetchUnreadSummary()` | **30с** (visible) / 120с (hidden) | Дуже агресивний |
| `NotificationsBadge.vue` | `/v1/booking/requests/` | 60с | Окремий endpoint |
| `DashboardTutor.vue` | `chatThreadsStore.fetchUnreadSummary()` | 120с | **Дублює** ChatNotificationsBell |
| `StudentActiveTutorsSection.vue` | `chatThreadsStore.fetchUnreadSummary()` | 120с | **Дублює** ChatNotificationsBell |
| `authStore.js` → `startProactiveRefresh()` | `/auth/refresh/` | 25хв | Не проблема |

### Чому це викликає дьоргання

1. **Дублювання запитів** — `fetchUnreadSummary()` викликається 3 компонентами незалежно
2. **Одночасні re-renders** — кілька polling відповідей приходять одночасно → кілька reactive updates → кілька DOM re-renders в одному frame
3. **Layout shifts** — оновлення badge counters, списків, банерів змінює розміри елементів
4. **Відсутність visibility awareness** — деякі polling працюють навіть коли вкладка прихована

---

## 2. Рішення: Polling Coordinator

### Архітектура

```
┌─────────────────────────────────────────────┐
│                App.vue                       │
│  ┌─────────────────────────────────────┐    │
│  │       pollingCoordinator            │    │
│  │  ┌──────────┐  ┌──────────────────┐ │    │
│  │  │ Task:    │  │ Task:            │ │    │
│  │  │ notif-   │  │ chat-unread-     │ │    │
│  │  │ unread   │  │ summary          │ │    │
│  │  │ (60s)    │  │ (60s)            │ │    │
│  │  └──────────┘  └──────────────────┘ │    │
│  │  ┌──────────┐                       │    │
│  │  │ Task:    │  subscribers: 3       │    │
│  │  │ booking- │  (Bell + Dashboard    │    │
│  │  │ badge    │   + StudentSection)   │    │
│  │  │ (120s)   │                       │    │
│  │  └──────────┘                       │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### Ключові принципи

1. **Дедуплікація** — кілька компонентів реєструються з одним `id` → один polling task
2. **Stagger** — запити розносяться в часі щоб не приходити одночасно
3. **Visibility awareness** — polling сповільнюється ×4 коли вкладка прихована
4. **requestIdleCallback** — low-priority tasks виконуються коли браузер вільний
5. **Exponential backoff** — при помилках інтервал збільшується
6. **Subscriber counting** — task видаляється тільки коли всі підписники відписались

### Файли

- **`src/services/pollingCoordinator.ts`** — центральний координатор
- **`src/utils/jankDetector.ts`** — діагностичний інструмент

---

## 3. Jank Detector

Інструмент для виявлення та діагностики jank в production.

### Що моніторить

| Тип | Метод | Поріг |
|-----|-------|-------|
| Layout Shifts (CLS) | `PerformanceObserver('layout-shift')` | score > 0.001 |
| Long Tasks | `PerformanceObserver('longtask')` | > 50ms |
| DOM Mutations | `MutationObserver` | > 3 nodes per batch |
| Polling Responses | Fetch/XHR patching | > 2 calls per endpoint |
| Frame Drops | `requestAnimationFrame` gap | > 2 frames dropped |

### Використання в production

```js
// В консолі браузера:
__jankDetector.dump()           // Вивести повний звіт
__jankDetector.getReport()      // Отримати JSON звіт
__pollingCoordinator.getStats() // Статистика polling
```

### Використання в dev

```js
// Автоматично запускається в dev mode (verbose)
// Кожен jank event виводиться в консоль з кольоровим маркером
```

---

## 4. Правила для розробників

### DO ✅

- **Використовуй `pollingCoordinator.register()`** для будь-якого polling
- **Використовуй один `id`** для одного endpoint (дедуплікація)
- **Встановлюй `priority: 'low'`** для фонових задач
- **Встановлюй `visibilityAware: true`** для всіх polling
- **Відписуйся в `onUnmounted()`** — `const unsub = register(); onUnmounted(unsub)`
- **Використовуй `skipLoader: true`** в API-клієнті для polling запитів

### DON'T ❌

- **НЕ використовуй `setInterval` напряму** для polling
- **НЕ створюй новий polling task** якщо вже є з таким endpoint
- **НЕ оновлюй reactive state** якщо дані не змінились (shallow compare)
- **НЕ показуй loading spinner** при polling (тільки при user-initiated actions)
- **НЕ використовуй `document.addEventListener('visibilitychange')` вручну** — coordinator робить це за тебе

### Приклад правильного polling

```ts
import { pollingCoordinator } from '@/services/pollingCoordinator'
import { onMounted, onUnmounted } from 'vue'

let unsub = null

onMounted(() => {
  unsub = pollingCoordinator.register({
    id: 'my-feature-data',        // Унікальний ID (або спільний для дедуплікації)
    fn: () => myStore.fetchData(),
    interval: 60_000,              // 1 хвилина
    priority: 'low',               // 'high' | 'normal' | 'low'
    runImmediately: true,          // Виконати одразу при реєстрації
    visibilityAware: true,         // Сповільнити коли вкладка прихована
  })
})

onUnmounted(() => {
  unsub?.()
})
```

---

## 5. Зміни в компонентах (v1.0)

| Файл | Було | Стало |
|------|------|-------|
| `App.vue` | `notificationsStore.startPolling(60s)` | `pollingCoordinator.register('notifications-unread', 60s)` |
| `ChatNotificationsBell.vue` | `setInterval(30s)` + manual visibility | `pollingCoordinator.register('chat-unread-summary', 60s)` |
| `NotificationsBadge.vue` | `setInterval(60s)` | `pollingCoordinator.register('booking-requests-badge', 120s)` |
| `DashboardTutor.vue` | `setInterval(120s)` | `pollingCoordinator.register('chat-unread-summary', 60s)` — **дедупліковано** |
| `StudentActiveTutorsSection.vue` | `setInterval(120s)` | `pollingCoordinator.register('chat-unread-summary', 60s)` — **дедупліковано** |

### Результат

- **До**: 5 незалежних `setInterval`, 3 з яких дублюють `fetchUnreadSummary()`
- **Після**: 3 координовані polling tasks, `fetchUnreadSummary()` викликається **1 раз** замість 3

---

## 6. Діагностика в production

Якщо сторінка знову дьоргається:

1. Відкрити DevTools Console
2. `__jankDetector.dump()` — побачити всі jank events
3. `__pollingCoordinator.getStats()` — перевірити polling статистику
4. Шукати:
   - **layout-shift** events — які елементи зміщуються
   - **polling-response** events — які endpoints найчастіше викликаються
   - **long-task** events — які операції блокують main thread
   - **forced-reflow** events — де пропускаються frames

---

## 7. Майбутні покращення (backlog)

- [ ] Server-Sent Events (SSE) замість polling для notifications
- [ ] WebSocket multiplexing для chat + notifications в одному з'єднанні
- [ ] `IntersectionObserver` — polling тільки для видимих компонентів
- [ ] Batch reactive updates через `nextTick` grouping
- [ ] Content-hash порівняння response перед оновленням store

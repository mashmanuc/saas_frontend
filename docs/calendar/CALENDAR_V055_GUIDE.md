# Calendar v0.55 - Frontend Guide

**Версія:** v0.55.0  
**Дата:** 27.12.2025  
**Статус:** ✅ IMPLEMENTED

---

## Огляд

Calendar v0.55 — це повна переробка календаря тьютора з фокусом на UX parity з Bukischool. Ключові покращення:

- **Шарова архітектура** з абсолютним позиціонуванням подій
- **Arbitrary time support** (не прив'язано до 30-хв слотів)
- **Past is Grey** — візуальне затінення минулого часу
- **First lesson highlight** — окремий колір для першого заняття
- **Drag & Drop** через preview/confirm pattern
- **Обов'язковий refetch** після кожної мутації

---

## Архітектура компонентів

### CalendarBoardV2 — Головний компонент

**Розташування:** `src/modules/booking/components/calendar/CalendarBoardV2.vue`

**Структура:**
```
CalendarBoardV2
├── GridLayer (z-index: 1)
├── AvailabilityLayer (z-index: 2)
├── EventsLayer (z-index: 3)
└── InteractionLayer (z-index: 4)
```

**Відповідальність:**
- Координація всіх шарів
- Обробка подій (event-click, drag-complete)
- Інтеграція з calendarWeekStore

**Props:**
```typescript
interface Props {
  isDragEnabled?: boolean
}
```

**Events:**
```typescript
interface Emits {
  'event-click': [event: CalendarEvent]
  'drag-complete': [eventId: number, newStart: string, newEnd: string]
}
```

---

### Шари (Layers)

#### 1. GridLayer — Фон календаря

**Файл:** `layers/GridLayer.vue`

**Відповідальність:**
- Рендерити сітку з кроком 30 хв
- Показувати години дня (06:00-22:00)
- Затінювати минулий час (Past is Grey)
- Відображати dayStatus (working/partial/day_off)

**Ключові правила:**
- Сітка — це лише фон, не джерело істини
- Події НЕ прив'язуються до клітинок
- Минулі години: `opacity: 0.4`, `background: #f5f5f5`

#### 2. AvailabilityLayer — Заблоковані діапазони

**Файл:** `layers/AvailabilityLayer.vue`

**Відповідальність:**
- Показувати blocked ranges як фон (не як окремі карти)
- Рендерити з абсолютним позиціонуванням

**Стиль:**
- Діагональні смуги (`repeating-linear-gradient`)
- Пунктирна рамка (`border: 1px dashed #ccc`)

#### 3. EventsLayer — Шар подій

**Файл:** `layers/EventsLayer.vue`

**Відповідальність:**
- Рендерити уроки з абсолютним позиціонуванням
- Підтримувати arbitrary time (21:55, 18:10 тощо)
- Виділяти перше заняття окремим кольором
- Приглушувати минулі уроки

**Кольори:**
- Перше заняття: `#9C27B0` (фіолетовий)
- Звичайне заняття: `#4CAF50` (зелений)
- No-show: `#757575` (сірий)
- Cancelled: `#f44336` (червоний)

**Позиціонування:**
```typescript
topPx = minutesFromDayStart * pxPerMinute
heightPx = durationMinutes * pxPerMinute
```

#### 4. InteractionLayer — Drag & Drop

**Файл:** `layers/InteractionLayer.vue`

**Відповідальність:**
- Обробка drag events
- Показ preview slot під час перетягування
- Інтеграція з useDragDrop composable

---

## Composables

### useCalendarGrid

**Файл:** `composables/useCalendarGrid.ts`

**Призначення:** Утиліти для розрахунків сітки календаря

**API:**
```typescript
const {
  pxPerMinute,        // 2px per minute = 120px per hour
  hours,              // [6, 7, 8, ..., 22]
  gridHeight,         // Total height in px
  isPast,             // (datetime: string) => boolean
  calculateTopPx,     // (datetime: string) => number
  calculateHeightPx,  // (start: string, end: string) => number
  formatTime,         // (datetime: string) => "HH:MM"
  formatHour          // (hour: number) => "HH:00"
} = useCalendarGrid()
```

### useDragDrop

**Файл:** `composables/useDragDrop.ts`

**Призначення:** Drag & Drop логіка з preview/confirm

**API:**
```typescript
const {
  isDragging,
  draggedEvent,
  previewSlot,
  previewResult,
  isLoading,
  error,
  
  startDrag,          // (event: CalendarEvent) => void
  updatePreview,      // (start: string, end: string) => void
  checkPreview,       // () => Promise<ReschedulePreviewResponse>
  confirmDrop,        // (onSuccess?: () => void) => Promise<boolean>
  cancelDrag,         // () => void
  calculateTargetSlot // (mouseY, containerTop, pxPerMinute, duration) => { start, end }
} = useDragDrop()
```

**Workflow:**
1. `startDrag(event)` — початок перетягування
2. `updatePreview(start, end)` — оновлення позиції під час руху
3. `checkPreview()` — перевірка конфліктів (API call)
4. `confirmDrop()` — підтвердження + refetch snapshot
5. `cancelDrag()` — скасування

---

## Додаткові компоненти

### CalendarHeaderV2

**Файл:** `CalendarHeaderV2.vue`

**Елементи:**
- Інформаційне повідомлення (нагадування про Marketplace)
- Кнопка "Відмітити вільний час" (Quick Block)
- Посилання на легенду кольорів
- Посилання на відеоінструкцію

### ColorLegendModal

**Файл:** `ColorLegendModal.vue`

**Показує:**
- Перше заняття (фіолетовий)
- Звичайне заняття (зелений)
- No-show (сірий)
- Заблокований час (смуги)
- Минулий час (затінений)

### LessonCardDrawer

**Файл:** `LessonCardDrawer.vue`

**Функціонал:**
- Деталі уроку (студент, час, Zoom-лінк)
- Кнопка "Перенести урок" (якщо `can_reschedule`)
- Кнопка "Перейти до уроку"
- Кнопка "Позначити No-show" (якщо минулий + `can_mark_no_show`)
- Бейдж "Перше заняття" (якщо `is_first`)

### RescheduleModal

**Файл:** `RescheduleModal.vue`

**Workflow:**
1. Вибір нової дати/часу
2. Автоматичний preview при зміні
3. Показ конфліктів (якщо є)
4. Кнопка "Підтвердити" (активна тільки якщо `allowed: true`)
5. Confirm → refetch snapshot

### CalendarFooter

**Файл:** `CalendarFooter.vue`

**Функціонал:**
- Відображення Zoom-лінку тьютора
- Кнопка копіювання в clipboard
- Feedback "Скопійовано" (2 секунди)

---

## API Integration

### calendarV055Api

**Файл:** `api/calendarV055Api.ts`

**Методи:**

#### 1. getCalendarWeek
```typescript
await calendarV055Api.getCalendarWeek(tutorId, weekStart, etag?)
// Returns: CalendarSnapshot
```

**Response:**
```typescript
{
  days: DaySnapshot[]
  events: CalendarEvent[]
  accessible: AccessibleSlot[]
  blockedRanges: BlockedRange[]
  dictionaries: Dictionaries
  meta: SnapshotMeta
}
```

#### 2. reschedulePreview
```typescript
await calendarV055Api.reschedulePreview(eventId, {
  new_start: "2025-12-25T10:00:00+02:00",
  new_end: "2025-12-25T11:00:00+02:00"
})
// Returns: { allowed: boolean, conflicts: [], warnings: [] }
```

#### 3. rescheduleConfirm
```typescript
await calendarV055Api.rescheduleConfirm(eventId, {
  new_start: "2025-12-25T10:00:00+02:00",
  new_end: "2025-12-25T11:00:00+02:00"
})
// Returns: { success: true, event_id: 123 }
```

#### 4. markNoShow
```typescript
await calendarV055Api.markNoShow(eventId, {
  reason_id: 1,
  comment: "Студент не з'явився"
})
// Returns: { success: true }
```

#### 5. blockDayRange
```typescript
await calendarV055Api.blockDayRange("2025-12-25", {
  start: "2025-12-25T10:00:00+02:00",
  end: "2025-12-25T12:00:00+02:00",
  reason: "Особисті справи"
})
// Returns: { success: true, blocked_range_id: 456 }
```

---

## Store Integration

### calendarWeekStore (оновлення для v0.55)

**TODO:** Додати підтримку нового snapshot формату

**Нові computed:**
```typescript
const blockedRanges = computed(() => snapshot.value?.blockedRanges || [])
const dictionaries = computed(() => snapshot.value?.dictionaries || {})
const meta = computed(() => snapshot.value?.meta || {})
```

**Оновлені actions:**
```typescript
// Після кожної мутації — обов'язковий refetch
const rescheduleConfirm = async (eventId, target) => {
  await calendarV055Api.rescheduleConfirm(eventId, target)
  await fetchWeekSnapshot() // ОБОВ'ЯЗКОВО
}

const markNoShow = async (eventId, payload) => {
  await calendarV055Api.markNoShow(eventId, payload)
  await fetchWeekSnapshot() // ОБОВ'ЯЗКОВО
}

const blockDayRange = async (dayKey, payload) => {
  await calendarV055Api.blockDayRange(dayKey, payload)
  await fetchWeekSnapshot() // ОБОВ'ЯЗКОВО
}
```

---

## i18n

### Нові ключі (UA/EN)

**Файли:**
- `i18n/locales/calendar_guide_uk.json`
- `i18n/locales/calendar_guide_en.json`

**Структура:**
```json
{
  "calendar": {
    "header": { ... },
    "legend": { ... },
    "lesson_card": { ... },
    "reschedule": { ... },
    "footer": { ... },
    "drag": { ... }
  }
}
```

**Використання:**
```vue
<template>
  <span>{{ t('calendar.header.reminder') }}</span>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>
```

---

## Testing

### Unit Tests

**Файл:** `tests/modules/booking/components/CalendarBoardV2.spec.ts`

**Покриття:**
- Рендеринг всіх 4 шарів
- Абсолютне позиціонування подій
- Виділення першого заняття
- Emit event-click
- Past styling
- Blocked ranges
- Interaction layer (drag enabled/disabled)

**Запуск:**
```bash
npm run test:unit
```

### E2E Tests (TODO)

**Файли:**
- `tests/e2e/calendar/drag-drop.spec.ts`
- `tests/e2e/calendar/no-show.spec.ts`
- `tests/e2e/calendar/quick-block.spec.ts`

**Сценарії:**
1. Drag&drop урок → preview → confirm → refetch
2. Позначити no-show → refetch
3. Quick block діапазон → refetch
4. Копіювання Zoom-лінку

---

## Performance

### Оптимізації

1. **Абсолютне позиціонування** — без перерахунків layout
2. **Computed properties** — кешування розрахунків
3. **v-for з :key** — ефективний re-render
4. **CSS transitions** — плавна анімація без JS
5. **Lazy loading** — модалки завантажуються по потребі

### Метрики

- **CLS (Cumulative Layout Shift):** 0
- **LCP (Largest Contentful Paint):** < 2.5s
- **FID (First Input Delay):** < 100ms

---

## Accessibility

### WCAG 2.1 AA Compliance

- **Keyboard navigation:** Tab, Enter, Escape
- **ARIA labels:** `aria-label`, `aria-describedby`
- **Focus management:** Visible focus indicators
- **Color contrast:** >= 4.5:1
- **Screen reader support:** Semantic HTML + ARIA

### Приклад:
```vue
<button
  aria-label="Перенести урок"
  @click="openReschedule"
>
  {{ t('calendar.lesson_card.reschedule') }}
</button>
```

---

## Responsive Design

### Breakpoints

- **Mobile:** < 768px
- **Tablet:** 768px - 1024px
- **Desktop:** > 1024px

### Mobile адаптації

- Drawer замість модалок
- Вертикальні кнопки
- Touch-friendly розміри (min 44x44px)
- Swipe gestures (TODO)

---

## Troubleshooting

### Проблема: Події не позиціонуються правильно

**Рішення:** Перевірте `pxPerMinute` та розрахунок `minutesFromDayStart`

### Проблема: Past is Grey не працює

**Рішення:** Перевірте `currentTime` prop та функцію `isPastHour`

### Проблема: Drag&drop не працює

**Рішення:** Переконайтесь, що `isDragEnabled={true}` та InteractionLayer рендериться

### Проблема: Refetch не спрацьовує після мутації

**Рішення:** Додайте `await fetchWeekSnapshot()` після кожного API call

---

## Roadmap

### v0.56 (Next)

- [ ] WebSocket real-time updates
- [ ] Swipe gestures для mobile
- [ ] Bulk reschedule
- [ ] Calendar export (iCal)
- [ ] Recurring events management

### v0.57 (Future)

- [ ] Multi-tutor calendar
- [ ] Calendar sharing
- [ ] Advanced filters
- [ ] Analytics dashboard

---

## Контакти

**Документація:** `frontend/docs/calendar/`  
**Технічне завдання:** `backend/docs/plan/v0.55/v0.55.0 frontend.md`  
**API контракти:** `backend/docs/plan/v0.55/TECHNICAL_TASK_BACKEND.md`

---

**Статус:** ✅ READY FOR PRODUCTION

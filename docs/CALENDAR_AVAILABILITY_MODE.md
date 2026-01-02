# Calendar Availability Mode — v0.55.7

## Огляд

"Mark Free Time" режим дозволяє викладачам швидко та інтуїтивно керувати своїми доступними годинами через hover-based інтерфейс з підтримкою batch-операцій, відстеження прогресу та автоматичної перевірки конфліктів.

## Архітектура

### Компоненти

**Core Components:**
- `AvailabilityToolbar.vue` — панель управління з прогресом, кнопками та summary
- `InteractionLayer.vue` — оновлений для availability mode з hover states
- `AvailabilityLegend.vue` — легенда кольорів та підказки
- `AvailabilityConflictsDrawer.vue` — відображення конфліктів

**State Management:**
- `availabilityDraftStore.ts` — Pinia store з draft lifecycle, undo/redo, API integration

**API Client:**
- `calendarAvailabilityApi.ts` — методи для draft CRUD, conflicts, workload

### Data Flow

```
User Action → InteractionLayer → availabilityDraftStore → API → Backend
                                        ↓
                                  Local State Update
                                        ↓
                                  UI Re-render
```

## Використання

### Вхід у режим

```typescript
import { useAvailabilityDraftStore } from '@/modules/booking/stores/availabilityDraftStore'

const draftStore = useAvailabilityDraftStore()

// Enter availability mode
draftStore.enterMode()
```

### Додавання слотів

```typescript
// Add new slot
const slot = draftStore.addSlot(
  '2025-01-29T17:00:00Z',
  '2025-01-29T18:00:00Z',
  'available'
)

// slot = { tempId: 'temp-...', start: '...', end: '...', status: 'available' }
```

### Видалення слотів

```typescript
// Remove draft slot by tempId
draftStore.removeSlot(undefined, 'temp-123')

// Mark existing slot for removal
draftStore.removeSlot(456)

// Toggle slot removal
draftStore.toggleSlot(456, '2025-01-29T17:00:00Z', '2025-01-29T18:00:00Z')
```

### Збереження змін

```typescript
// Create draft
const draft = await draftStore.createDraft('2025-01-27')
// draft = { token: 'draft_abc', expiresAt: '...', conflicts: [], summary: {...} }

// Apply draft
const result = await draftStore.applyDraft()
// result = { status: 'applied', appliedAt: '...', workloadProgress: {...} }

// Or with force flag
const result = await draftStore.applyDraft(true)
```

### Перевірка конфліктів

```typescript
const conflicts = await draftStore.checkConflicts('2025-01-27')
// conflicts = { conflicts: [...] }

if (draftStore.hasConflicts) {
  // Show conflicts drawer
}
```

### Undo/Redo

```typescript
// Undo last action
if (draftStore.canUndo) {
  draftStore.undo()
}

// Redo action
if (draftStore.canRedo) {
  draftStore.redo()
}
```

## UI States

### Loading State
- Skeleton для toolbar
- Disabled buttons
- Loading spinner

### Success State
- Зелений прогрес-бар
- Активні кнопки
- Summary з змінами

### Error State
- Червоний banner з помилкою
- Кнопка "Повторити"
- Детальний опис помилки

### Conflict State
- Жовтий banner з попередженням
- Conflicts drawer з деталями
- Опції "Виправити" або "Застосувати примусово"

## Accessibility

### ARIA Attributes
```html
<div role="toolbar" aria-label="Availability editing toolbar">
<div role="grid" aria-label="Calendar grid">
<div role="progressbar" aria-valuenow="15" aria-valuemin="0" aria-valuemax="16">
<div role="dialog" aria-modal="true">
```

### Keyboard Navigation
- **Tab** — навігація між елементами
- **Enter/Space** — підтвердження дії на клітинці
- **Escape** — вихід з режиму / закриття drawer
- **Ctrl+Z** — undo
- **Ctrl+Shift+Z** — redo
- **Arrow keys** — навігація по клітинках (майбутня фіча)

### Screen Reader Support
- Всі кнопки мають aria-label
- Прогрес-бар озвучується з поточним значенням
- Конфлікти озвучуються з деталями

## i18n Keys

### Ukrainian (uk.json)
```json
{
  "calendar.availability.header.title": "Внесіть вільні години",
  "calendar.availability.save": "Зберегти",
  "calendar.availability.cancel": "Скасувати",
  "calendar.availability.progress.needs_more": "Відміть ще як мінімум {hours} год.",
  "calendar.availability.conflicts.title": "Виявлено конфлікти"
}
```

### English (en.json)
```json
{
  "calendar.availability.header.title": "Add available hours",
  "calendar.availability.save": "Save",
  "calendar.availability.cancel": "Cancel",
  "calendar.availability.progress.needs_more": "Mark at least {hours} more hours",
  "calendar.availability.conflicts.title": "Conflicts detected"
}
```

Повний список ключів: `src/i18n/locales/availability_v0557_*.json`

## Performance

### Оптимізації
- Debounced hover updates (150ms)
- Lazy loading conflicts drawer
- Memoized computed properties
- Virtual scrolling для великих списків конфліктів (майбутня фіча)

### Benchmarks
- Hover response: < 50ms
- Slot add/remove: < 100ms
- Draft create API: < 300ms
- Draft apply API: < 500ms

## Testing

### Unit Tests
```bash
npm run test:unit -- availabilityDraftStore.spec.ts
```

Coverage:
- ✅ Mode management (enter/exit)
- ✅ Slot operations (add/remove/toggle)
- ✅ Computed properties (addedSlots, removedSlots, hoursDelta)
- ✅ History and undo/redo
- ✅ API integration (create/apply/delete draft)
- ✅ Error handling

### E2E Tests
```bash
npm run test:e2e -- availability-editor.cy.ts
```

Scenarios:
- ✅ Enter availability mode
- ✅ Add multiple slots
- ✅ Remove existing slots
- ✅ Save changes successfully
- ✅ Handle conflicts
- ✅ Undo/redo actions
- ✅ Cancel and exit
- ✅ Show legend
- ✅ Accessibility checks
- ✅ Responsive behavior

## Troubleshooting

### Проблема: Слоти не додаються
**Рішення:** Перевірте, чи немає перетину з існуючими уроками або заблокованим часом.

### Проблема: Помилка при збереженні
**Рішення:** 
1. Перевірте інтернет-з'єднання
2. Перевірте, чи не закінчився draft token (TTL 24h)
3. Перегляньте конфлікти в drawer

### Проблема: Прогрес не оновлюється
**Рішення:** Перезавантажте snapshot після успішного apply.

### Проблема: Undo не працює
**Рішення:** Перевірте, чи є доступна історія (`canUndo === true`).

## Майбутні покращення (Backlog)

1. **Drag selection** — виділення декількох клітинок мишею
2. **Template integration** — швидке застосування шаблонів
3. **WebSocket updates** — real-time синхронізація між клієнтами
4. **Recurring patterns** — створення повторюваних слотів
5. **Mobile gestures** — swipe для додавання/видалення
6. **Analytics** — heatmap навантаження по днях тижня

## API Reference

Детальний API контракт: `backend/docs/plan/v0.55.7/API_CONTRACT_V0557.md`

### Endpoints
- `POST /api/v1/calendar/availability/draft/` — створити draft
- `POST /api/v1/calendar/availability/draft/{token}/apply` — застосувати draft
- `DELETE /api/v1/calendar/availability/draft/{token}/` — видалити draft
- `POST /api/v1/calendar/availability/conflicts/` — перевірити конфлікти
- `GET /api/v1/calendar/workload-target/` — отримати workload targets
- `PUT /api/v1/calendar/workload-target/` — оновити workload targets

## Changelog

### v0.55.7 (2026-01-01)
- ✅ Initial release
- ✅ Hover-based slot editing
- ✅ Draft API with Redis storage
- ✅ Conflict detection
- ✅ Workload progress tracking
- ✅ Undo/redo support
- ✅ Full i18n (UA/EN)
- ✅ Accessibility (ARIA, keyboard navigation)
- ✅ Unit and E2E tests
- ✅ Comprehensive documentation

## Автори

M4SH Frontend Team — v0.55.7 Implementation

## Ліцензія

Internal M4SH Platform — Proprietary

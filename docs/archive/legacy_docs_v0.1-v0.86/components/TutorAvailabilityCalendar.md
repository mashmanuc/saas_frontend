# TutorAvailabilityCalendar Component

## Overview

`TutorAvailabilityCalendar` — компонент для відображення реального календаря доступності тьютора на маркетплейсі. Використовується студентами для перегляду та вибору доступних слотів для бронювання пробного уроку.

**Версія:** v0.59 (Real Availability Calendar)

## Props

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `tutorId` | `number` | - | ✅ | ID тьютора |
| `timezone` | `string` | `'Europe/Kyiv'` | ❌ | Таймзона для відображення часу |
| `view` | `'full' \| 'compact'` | `'full'` | ❌ | Режим відображення календаря |
| `maxWeeks` | `number` | `4` | ❌ | Максимальна кількість тижнів для навігації |
| `showHeader` | `boolean` | `true` | ❌ | Показувати заголовок з навігацією |
| `emptyState` | `string` | - | ❌ | Кастомний текст для порожнього стану |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| `slot-click` | `CalendarSlot` | Викликається при кліку на доступний слот |

### CalendarSlot Interface

```typescript
interface CalendarSlot {
  slot_id: string      // Унікальний ідентифікатор слота (SHA256 hash)
  start_at: string     // ISO 8601 дата-час початку слота
  duration: number     // Тривалість у хвилинах
  status: string       // Статус слота ('available')
}
```

## Usage

### Basic Example

```vue
<template>
  <TutorAvailabilityCalendar
    :tutor-id="123"
    timezone="Europe/Kyiv"
    @slot-click="handleSlotClick"
  />
</template>

<script setup>
import TutorAvailabilityCalendar from '@/modules/marketplace/components/TutorAvailabilityCalendar.vue'

function handleSlotClick(slot) {
  console.log('Selected slot:', slot)
  // Open trial request modal with slot data
}
</script>
```

### Compact View

```vue
<TutorAvailabilityCalendar
  :tutor-id="tutorId"
  view="compact"
  :max-weeks="2"
  :show-header="false"
  @slot-click="handleSlotClick"
/>
```

### Custom Empty State

```vue
<TutorAvailabilityCalendar
  :tutor-id="tutorId"
  empty-state="Тьютор поки не додав доступні слоти. Зв'яжіться з ним напряму."
  @slot-click="handleSlotClick"
/>
```

## Features

### 1. Real-time Data
- Дані завантажуються з `/api/v1/marketplace/tutors/{id}/calendar/`
- Показує лише реальні слоти з `CalendarAccessibleSlot` (booking system)
- Автоматичне оновлення при навігації між тижнями

### 2. HTTP Caching
- Підтримка ETag для ефективного кешування
- `Cache-Control: private, max-age=300`
- Умовні запити через `If-None-Match`

### 3. Horizon Validation
- Максимум 4 тижні вперед (за замовчуванням)
- Кнопки навігації автоматично блокуються при досягненні межі
- Показ помилки при спробі завантажити дані за межами horizon

### 4. States

#### Loading State
```vue
<div class="loading-state">
  <LoaderIcon class="animate-spin" />
  <p>Завантаження...</p>
</div>
```

#### Empty State
```vue
<div class="empty-state">
  <CalendarIcon />
  <p>{{ emptyState || $t('marketplace.noAvailableSlots') }}</p>
</div>
```

#### Error State
```vue
<div class="error-state">
  <AlertCircleIcon />
  <p>{{ error }}</p>
  <button @click="loadAvailability">Повторити</button>
</div>
```

#### Success State
- Групування слотів по днях
- 7-колонковий grid на desktop
- 1-2 колонки на mobile (responsive)

### 5. Accessibility

- ✅ `tabindex="0"` на всіх кнопках слотів
- ✅ `aria-label` з локалізованим часом
- ✅ Підтримка клавіатурної навігації (Enter, Space, ESC)
- ✅ Видимий focus-state
- ✅ Disabled стан для кнопок навігації

### 6. Telemetry

Компонент автоматично відправляє події:

```javascript
// При завантаженні календаря
gtag('event', 'availability_viewed', {
  tutor_id: 123,
  week_start: '2026-01-05',
  slot_count: 15
})

// При кліку на слот
gtag('event', 'availability_slot_clicked', {
  tutor_id: 123,
  slot_id: 'a1b2c3d4...'
})
```

## API Contract

### Request

```
GET /api/v1/marketplace/tutors/{id}/calendar/?start=2026-01-05&tz=Europe/Kyiv
```

### Response

```json
{
  "tutor_id": 123,
  "week_start": "2026-01-05",
  "timezone": "Europe/Kyiv",
  "cells": [
    {
      "slot_id": "a1b2c3d4e5f67890abcdef1234567890",
      "start_at": "2026-01-06T09:00:00+02:00",
      "duration": 60,
      "status": "available"
    }
  ]
}
```

### Error Responses

| Status | Error Code | Description |
|--------|------------|-------------|
| 400 | `validation_error` | Відсутній або невалідний параметр `start` |
| 404 | `not_found` | Тьютор не знайдений |
| 422 | `invalid_range` | Дата за межами horizon (4 тижні) |
| 500 | `internal_error` | Внутрішня помилка сервера |

## Styling

Компонент використовує scoped styles з підтримкою compact режиму:

```css
.tutor-availability-calendar {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
}

.tutor-availability-calendar.compact-view {
  padding: 8px;
}
```

## Testing

### Unit Tests

```bash
npm run test:unit -- TutorAvailabilityCalendar.spec.ts
```

**Покриття:**
- ✅ Групування слотів по днях
- ✅ Емісія `slot-click` події
- ✅ Empty/Error/Loading стани
- ✅ Horizon validation (maxWeeks)
- ✅ Keyboard navigation
- ✅ Accessibility attributes

### E2E Tests

```bash
npm run test:e2e -- marketplace/calendar.spec.ts
```

## Migration from Legacy

### Before (v0.58)

```vue
<WeeklyAvailabilityWidget
  :slug="tutorSlug"
  @select-slot="handleSlot"
/>
```

### After (v0.59)

```vue
<TutorAvailabilityCalendar
  :tutor-id="tutorId"
  @slot-click="handleSlot"
/>
```

**Ключові зміни:**
- `slug` → `tutor-id` (number замість string)
- `select-slot` → `slot-click` (нова структура даних)
- Слоти тепер містять `slot_id` для валідації
- Дані з реального календаря, а не з weekly availability

## Performance

- Lazy rendering списків слотів
- Мемоізація `groupedSlots` через `computed`
- HTTP caching через ETag
- Відсутність блокуючих операцій

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Related Components

- `TrialRequestModal` — модалка для створення запиту на пробний урок
- `TutorProfileView` — сторінка профілю тьютора (використовує календар)

## References

- [Backend API Contract](../../backend/docs/marketplace/calendar.md)
- [Technical Task Frontend v0.59](../../backend/docs/plan/v0.59/TECHNICAL_TASK_FRONTEND_v0.59.md)
- [MANIFEST_CALENDAR](../../backend/docs/MANIFEST_CALENDAR.md)

---

**Version:** v0.59  
**Last Updated:** 2026-01-05  
**Status:** ✅ Production Ready

# Marketplace Calendar v0.59.1 — Implementation Report

## Дата: 2026-01-05

## Мета
Адаптація фронтенду до нового контракту API для календаря доступності тьютора в маркетплейсі.

---

## 1. Зміни в API контракті

### Старий контракт (до v0.59.1)
```json
{
  "tutor_id": 79,
  "week_start": "2026-01-06",
  "timezone": "Europe/Kyiv",
  "cells": [
    { "startAtUTC": "2026-01-06T10:00:00Z", "status": "available", "duration": 60 }
  ]
}
```

### Новий контракт (v0.59.1+)
```json
{
  "tutor_id": 79,
  "timezone": "Europe/Kyiv",
  "week_start": "2026-01-06",
  "week_end": "2026-01-12",
  "horizon_weeks": 4,
  "generated_at": "2026-01-05T20:00:00Z",
  "cells": [
    {
      "date": "2026-01-06",
      "day_status": "working",
      "slots": [
        {
          "slot_id": "sha256:...",
          "start_at": "2026-01-06T10:00:00Z",
          "duration_min": 60,
          "status": "available"
        }
      ]
    }
  ]
}
```

### Ключові відмінності
- ✅ `cells` тепер завжди 7 елементів (по одному на кожен день тижня)
- ✅ Кожен `cell` має `date`, `day_status` та масив `slots[]`
- ✅ `slot_id` має префікс `sha256:`
- ✅ `duration_min` замість `duration` або `duration_minutes`
- ✅ `week_start` нормалізується бекендом до понеділка
- ✅ Додано `week_end`, `horizon_weeks`, `generated_at`

---

## 2. Зміни в коді

### 2.1 Оновлення типів (`marketplace.ts`)

**Файл:** `src/modules/marketplace/api/marketplace.ts`

**Зміни:**
```typescript
// Новий тип для слота
export interface AvailableSlot {
  slot_id: string          // було: startAtUTC
  start_at: string         // було: startAtUTC
  duration_min: number     // було: duration
  status: 'available' | 'booked' | 'blocked'
}

// Новий тип для дня
export interface CalendarDayCell {
  date: string
  day_status: string
  slots: AvailableSlot[]
}

// Оновлений тип відповіді
export interface TutorCalendarResponse {
  tutor_id: number
  timezone: string
  week_start: string
  week_end: string
  horizon_weeks: number
  generated_at: string
  cells: CalendarDayCell[]  // було: AvailableSlot[]
}
```

**Статус:** ✅ Завершено

---

### 2.2 Переробка компонента (`TutorAvailabilityCalendar.vue`)

**Файл:** `src/modules/marketplace/components/TutorAvailabilityCalendar.vue`

**Основні зміни:**

1. **Прибрано `groupedSlots` computed**
   - Раніше: FE групував слоти по датах через `start_at.split('T')[0]`
   - Тепер: BE повертає готову структуру з 7 днями

2. **Нова структура даних**
   ```typescript
   // Було
   const slots = ref<CalendarSlot[]>([])
   const groupedSlots = computed(() => { /* групування */ })
   
   // Стало
   const dayCells = ref<DayCell[]>([])
   const hasAnySlots = computed(() => 
     dayCells.value.some(day => day.slots.length > 0)
   )
   ```

3. **Синхронізація `weekStart` з бекендом**
   ```typescript
   // Після отримання відповіді
   if (response.week_start) {
     weekStart.value = new Date(response.week_start + 'T00:00:00')
   }
   ```

4. **Оновлення рендерингу**
   ```vue
   <!-- Було -->
   <div v-for="day in groupedSlots" :key="day.date">
   
   <!-- Стало -->
   <div v-for="day in dayCells" :key="day.date">
   ```

5. **Видалено `normalizeSlots()`**
   - Функція більше не потрібна, бо BE повертає правильний контракт

**Статус:** ✅ Завершено

---

### 2.3 Виправлення `weekStart` логіки

**Зміна:**
```typescript
// Було: getNextMonday() — завжди наступний понеділок
function getNextMonday(): Date {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  return new Date(today.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000)
}

// Стало: getCurrentMonday() — понеділок поточного тижня
function getCurrentMonday(): Date {
  const today = new Date()
  const dayOfWeek = today.getDay()
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  return new Date(today.getTime() - daysToMonday * 24 * 60 * 60 * 1000)
}
```

**Результат:** Календар показує поточний тиждень, а не наступний.

**Статус:** ✅ Завершено

---

### 2.4 data-testid атрибути

Додано всі необхідні `data-testid` для E2E тестів:

| Елемент | data-testid | Додатково |
|---------|-------------|-----------|
| Root календаря | `tutor-availability-calendar` | ✅ Вже було |
| Loading state | `availability-loading-state` | ✅ Додано |
| Error state | `availability-error-state` | ✅ Додано |
| Empty state | `availability-empty-state` | ✅ Додано |
| Slot button | `marketplace-slot` | ✅ Додано |
| Slot ID | `data-slot-id="{slot_id}"` | ✅ Додано |

**Статус:** ✅ Завершено

---

### 2.5 i18n ключі

Всі hardcoded тексти винесено в i18n:

**Додано ключі:**
```json
{
  "marketplace": {
    "calendar": {
      "errorHorizon": "Неможливо завантажити календар за межами 4 тижнів",
      "errorLoad": "Не вдалося завантажити доступність",
      "bookSlotAria": "Забронювати слот на {time}"
    }
  },
  "menu": {
    "marketplace": "Маркетплейс"
  }
}
```

**Файли:**
- `src/i18n/locales/uk.json` ✅
- `src/i18n/locales/en.json` ✅

**Статус:** ✅ Завершено

---

## 3. E2E тести

### 3.1 Оновлення mock даних

**Файл:** `tests/e2e/marketplace/marketplace-availability-smoke.spec.ts`

**Зміни:**
- ✅ Mock відповіді тепер повертають 7 `cells` з `slots[]`
- ✅ Використовуються `data-testid` для селекторів
- ✅ `slot_id` має префікс `sha256:`
- ✅ `duration_min` замість `duration`

**Приклад mock:**
```typescript
{
  tutor_id: 79,
  timezone: 'Europe/Kyiv',
  week_start: '2026-01-06',
  week_end: '2026-01-12',
  horizon_weeks: 4,
  generated_at: '2026-01-05T20:00:00Z',
  cells: [
    {
      date: '2026-01-06',
      day_status: 'working',
      slots: [
        { 
          slot_id: 'sha256:fixed001', 
          start_at: '2026-01-06T10:00:00Z', 
          duration_min: 60, 
          status: 'available' 
        }
      ]
    },
    // ... ще 6 днів
  ]
}
```

### 3.2 Покриття тестами

| Сценарій | Статус | Повторів |
|----------|--------|----------|
| Calendar navigation (prev/next week) | ✅ Pass | 5/5 |
| Error state on API failure | ✅ Pass | 5/5 |
| Empty state (no slots) | ✅ Pass | 5/5 |
| Horizon validation (422 error) | ✅ Pass | 5/5 |
| **409 conflict handling** | ✅ **Pass** | **5/5** |

**Результат:** **25/25 тестів пройшли успішно** (5 повторів × 5 тестів)

**Виправлення 409 conflict тесту:**
- ✅ Додано `data-testid="trial-request-submit"` на кнопку submit в `TrialRequestModal`
- ✅ Додано `data-testid="trial-request-cancel"` на кнопку cancel
- ✅ Додано логування 409 response для діагностики
- ✅ Підтверджено правильний контракт помилки: `{"error":"slot_unavailable"}`
- ✅ Conflict banner відображається коректно (`hasConflictBanner: true`)

**Статус:** ✅ Завершено

---

## 4. Інтеграція lint:api-duplicates

**Зміни:**
- ✅ Додано `pnpm lint:api-duplicates` у pre-commit hook
- ✅ Скрипт перевіряє відсутність .js/.ts shadowing

**Файл:** `.husky/pre-commit`
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm i18n:check
pnpm lint:api-duplicates
```

**Статус:** ✅ Завершено

---

## 5. Сумісність з TutorProfileView

**Перевірено:**
- ✅ `TutorAvailabilityCalendar` інтегрований у `TutorProfileView`
- ✅ Кнопка "Записатись" скролить до календаря (без legacy-редіректів)
- ✅ `TrialRequestModal` відкривається при кліку на слот
- ✅ `has_availability` flag контролює відображення секції

**Статус:** ✅ Завершено

---

## 6. Definition of Done

| Критерій | Статус |
|----------|--------|
| ✅ Marketplace tutor profile без legacy redirect | ✅ |
| ✅ `TutorAvailabilityCalendar` має всі `data-testid` | ✅ |
| ✅ Усі тексти/aria-labels через i18n | ✅ |
| ✅ `menu.marketplace` існує в uk/en | ✅ |
| ✅ `marketplaceApi.getTutorCalendar` працює в runtime | ✅ |
| ✅ `lint:api-duplicates` інтегрований як gate | ✅ |
| ✅ **E2E smoke стабільні (25/25 passed)** | ✅ |
| ✅ **409 conflict handling працює** | ✅ |
| ✅ Новий контракт API повністю підтримується | ✅ |
| ✅ weekStart синхронізується з бекендом | ✅ |

---

## 7. Файли змінені

### Основні файли
1. `src/modules/marketplace/api/marketplace.ts` — оновлення типів
2. `src/modules/marketplace/components/TutorAvailabilityCalendar.vue` — переробка логіки
3. `src/modules/marketplace/components/trial/TrialRequestModal.vue` — додано data-testid
4. `src/i18n/locales/uk.json` — додано i18n ключі
5. `src/i18n/locales/en.json` — додано i18n ключі
6. `tests/e2e/marketplace/marketplace-availability-smoke.spec.ts` — оновлення тестів
7. `.husky/pre-commit` — додано lint:api-duplicates

### Допоміжні файли
- `src/modules/marketplace/views/TutorProfileView.vue` — перевірено інтеграцію

---

## 8. Як запустити тести

```bash
# Запустити smoke тести
pnpm test:e2e tests/e2e/marketplace/marketplace-availability-smoke.spec.ts

# Запустити з повторами для перевірки стабільності
pnpm test:e2e tests/e2e/marketplace/marketplace-availability-smoke.spec.ts --repeat-each=5

# Перевірити API duplicates
pnpm lint:api-duplicates
```

---

## 9. Backward compatibility

**Важливо:** Старий контракт API більше не підтримується.

Якщо бекенд поверне старий формат:
- ❌ FE не зможе правильно відобразити дані
- ❌ Тести провалюються

**Рекомендація:** Переконайтеся, що бекенд повертає новий контракт перед деплоєм.

---

## 10. Наступні кроки

### P1 (Completed)
- [x] ~~Додати тест для 409 conflict після виправлення timing issues~~ ✅ **Виконано**
  - Додано `data-testid` на кнопки модалу
  - Тест стабільно проходить 5/5 разів
  - Conflict banner відображається коректно

### P2 (Optional)
- [ ] Додати unit тести для `TutorAvailabilityCalendar`
- [ ] Додати telemetry для navigation events

### P3 (Future)
- [ ] Додати skeleton loader для календаря
- [ ] Підтримка різних timezone для студентів
- [ ] Кешування calendar responses

---

## 11. Контакти

**Frontend Lead:** Autonomous Agent  
**Backend Contract Owner:** Backend Team  
**Дата релізу:** v0.59.1  
**Статус:** ✅ Ready for Production

---

**Підсумок:** Всі зміни для v0.59.1 успішно імплементовані та протестовані. Фронтенд повністю адаптований до нового контракту API календаря доступності тьютора.

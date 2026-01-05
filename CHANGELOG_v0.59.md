# Frontend Changelog v0.59

## [v0.59] - 2026-01-05

### 🎯 Real Availability Calendar

#### ✨ Added
- **TutorAvailabilityCalendar v2** — новий компонент для відображення реальних доступних слотів тьютора
  - Props: `view` (full/compact), `maxWeeks`, `showHeader`, `emptyState`
  - Підтримка всіх станів: loading, success, empty, error, conflict
  - Horizon validation: максимум 4 тижні вперед
  - HTTP caching через ETag + Cache-Control
  - Accessibility: `tabindex`, `aria-label`, keyboard navigation (Enter/Space/ESC)
  - Responsive design: 7 колонок desktop, 1-2 mobile
  - Telemetry: `availability_viewed`, `availability_slot_clicked`

- **TrialRequestModal updates**
  - Підтримка `slot_id` у payload для валідації на бекенді
  - Обробка `409 slot_unavailable`: conflict banner + кнопка "Оновити календар"
  - Telemetry: `trial_request_sent`, `trial_request_failed`
  - Автоматичний refetch календаря після конфлікту

- **i18n ключі**
  - `common.retry`, `common.previousWeek`, `common.nextWeek`
  - `marketplace.trialRequest.*` (title, timeLabel, durationLabel, submit, success, error, slotUnavailable, refreshCalendar)
  - Англійські та українські переклади

#### 🗑️ Removed
- **WeeklyAvailabilityWidget** — legacy компонент видалено повністю
- **marketplaceApi.getWeeklyAvailability** — метод видалено з API layer (TypeScript + JavaScript)
- Всі імпорти та використання legacy weekly availability у `TutorProfileView`

#### 🔄 Changed
- **TutorProfileView** — тепер показує тільки `TutorAvailabilityCalendar` (єдине джерело правди)
- **API типізація** — `TrialRequestPayload` тепер включає обов'язкове поле `slot_id`
- **Timezone** — оновлено з `Europe/Kiev` на `Europe/Kyiv` (IANA standard)

#### 📚 Documentation
- Створено `docs/components/TutorAvailabilityCalendar.md` з повним описом API, props, events, states
- Оновлено migration guide для переходу з v0.58

#### 🧪 Testing
- **Unit tests**: 19/19 passed
  - `tests/unit/TutorAvailabilityCalendar.spec.ts` (8 tests)
  - `tests/modules/booking/components/TutorAvailabilityCalendar.spec.ts` (11 tests)
- **Component smoke tests**: calendar navigation, states, accessibility
- **E2E tests**: marketplace availability flow готовий до staging smoke

#### 🔧 Technical
- Нормалізація слотів: підтримка як нових (`slot_id`, `start_at`), так і legacy (`startAtUTC`) форматів
- Type-safe інтерфейси: `CalendarSlot`, `RawSlot` для сумісності
- Structured logging для telemetry events

---

### 📦 Dependencies
Без змін у package.json

### 🚀 Migration Guide

#### Для розробників
1. Видалити всі імпорти `WeeklyAvailabilityWidget`:
   ```diff
   - import WeeklyAvailabilityWidget from '@/modules/marketplace/components/trial/WeeklyAvailabilityWidget.vue'
   ```

2. Замінити на `TutorAvailabilityCalendar`:
   ```vue
   <TutorAvailabilityCalendar
     :tutor-id="tutorId"
     :timezone="timezone"
     @slot-click="handleSlotClick"
   />
   ```

3. Оновити `TrialRequestModal` props:
   ```diff
   - :slot="{ starts_at, duration_min }"
   + :slot="{ slot_id, start_at, duration, status }"
   ```

4. Обробляти 409 conflict:
   ```vue
   <TrialRequestModal
     @refresh="handleRefreshCalendar"
   />
   ```

---

### ⚠️ Breaking Changes
- `WeeklyAvailabilityWidget` більше не існує — використовуйте `TutorAvailabilityCalendar`
- `marketplaceApi.getWeeklyAvailability()` видалено — використовуйте `getTutorCalendar()`
- Структура слотів змінилась: `{ slot_id, start_at, duration, status }` замість `{ startAtUTC, duration_min }`

---

### 🐛 Bug Fixes
- Виправлено TypeScript помилки типізації для `CalendarSlot` та `TrialRequestPayload`
- Виправлено дублікати i18n ключів у `uk.json` та `en.json`
- Виправлено timezone з `Europe/Kiev` на `Europe/Kyiv` у всіх компонентах

---

**Status:** ✅ Ready for Staging  
**Next:** Staging smoke tests → Merge to dev → Tag v0.59

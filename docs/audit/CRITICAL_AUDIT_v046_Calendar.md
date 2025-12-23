# 🚨 КРИТИЧНИЙ АУДИТ: Календар v0.46 не працює

**Дата:** 23 грудня 2024  
**Статус:** 🔴 КРИТИЧНА ПРОБЛЕМА - календар не відображає дані  
**Причина:** Невідповідність структури даних між backend та frontend

---

## 🔍 ВИЯВЛЕНА ПРОБЛЕМА

### Симптом
Календар показує порожню сітку з повідомленням "Немає доступних слотів". API повертає `cells: []`.

### Логи з консолі
```
[CalendarCellGrid] Loading week view: {tutorId: 79, weekStart: '2025-12-22', timezone: 'Europe/Kiev'}
[calendarApi] Calling /api/calendar/week/ with params: {start: '2025-12-22', tz: 'Europe/Kiev', tutor_id: 79}
[CalendarCellGrid] Loaded cells: 0
[CalendarCellGrid] Cells data: []
```

### Root Cause Analysis

#### 1. **КРИТИЧНА ПОМИЛКА: Невідповідність ключів у JSON**

**Backend код** (`week_generator.py:159-162`):
```python
for slot_data in template.weekly_slots:
    weekday = slot_data.get('weekday')
    start_time_str = slot_data.get('start_time')  # ❌ ШУКАЄ 'start_time'
    end_time_str = slot_data.get('end_time')      # ❌ ШУКАЄ 'end_time'
```

**Модель даних** (`tutor_availability.py:22-38`):
```python
weekly_slots = models.JSONField(default=list)
"""
[
    {
        "weekday": 1,
        "start": "09:00",    # ✅ НАСПРАВДІ 'start'
        "end": "12:00"       # ✅ НАСПРАВДІ 'end'
    }
]
"""
```

**Результат:** Код шукає `start_time` та `end_time`, але в JSON є `start` та `end`. Через це:
- `start_time_str = None`
- `end_time_str = None`
- Умова `if weekday is None or not start_time_str or not end_time_str: continue` спрацьовує
- Жоден слот не обробляється
- Повертається порожній масив клітинок зі статусом `empty`

#### 2. **Відсутність даних у тьютора**

Навіть якщо виправити ключі, можливо у тьютора ID=79 немає `TutorAvailabilityTemplate` або `weekly_slots` порожній.

#### 3. **Відсутність fallback UI**

Коли `cells` порожній, UI не показує корисного повідомлення типу:
- "У вас ще немає налаштованого розкладу"
- "Створіть шаблон доступності"
- Кнопку для переходу до налаштувань

---

## 🛠️ ПЛАН ВИПРАВЛЕННЯ

### Пріоритет 1: Виправити backend (КРИТИЧНО)

**Файл:** `backend/apps/booking/services/week_generator.py`

**Зміна 1:** Виправити ключі JSON
```python
# Було:
start_time_str = slot_data.get('start_time')
end_time_str = slot_data.get('end_time')

# Має бути:
start_time_str = slot_data.get('start') or slot_data.get('start_time')  # Backward compatibility
end_time_str = slot_data.get('end') or slot_data.get('end_time')
```

**Зміна 2:** Додати детальне логування
```python
logger.info(f"[week_generator] Processing tutor_id={tutor_id}, week_start={week_start}")
logger.info(f"[week_generator] Template found: {template is not None}")
if template:
    logger.info(f"[week_generator] Weekly slots count: {len(template.weekly_slots)}")
    logger.info(f"[week_generator] Weekly slots data: {template.weekly_slots}")
```

### Пріоритет 2: Створити тестові дані

**Файл:** `backend/apps/booking/management/commands/create_test_availability.py`

```python
from django.core.management.base import BaseCommand
from apps.marketplace.models import TutorAvailabilityTemplate
from django.contrib.auth import get_user_model

class Command(BaseCommand):
    def handle(self, *args, **options):
        User = get_user_model()
        tutor = User.objects.get(id=79)
        
        template, created = TutorAvailabilityTemplate.objects.get_or_create(
            tutor=tutor,
            defaults={
                'timezone': 'Europe/Kiev',
                'weekly_slots': [
                    {'weekday': 0, 'start': '09:00', 'end': '12:00'},  # Monday
                    {'weekday': 0, 'start': '14:00', 'end': '18:00'},
                    {'weekday': 1, 'start': '09:00', 'end': '12:00'},  # Tuesday
                    {'weekday': 2, 'start': '09:00', 'end': '17:00'},  # Wednesday
                    {'weekday': 3, 'start': '10:00', 'end': '16:00'},  # Thursday
                    {'weekday': 4, 'start': '09:00', 'end': '13:00'},  # Friday
                ]
            }
        )
        
        self.stdout.write(f"Template {'created' if created else 'updated'} for tutor {tutor.email}")
```

### Пріоритет 3: Покращити frontend UX

**Файл:** `frontend/src/modules/booking/components/calendar/CalendarCellGrid.vue`

**Додати empty state:**
```vue
<div v-if="!loading && cells.length === 0 && !error" class="empty-state">
  <CalendarIcon class="empty-icon" />
  <h3>{{ $t('booking.calendar.noSchedule') }}</h3>
  <p>{{ $t('booking.calendar.noScheduleDesc') }}</p>
  <button @click="goToSettings" class="btn-primary">
    {{ $t('booking.calendar.setupSchedule') }}
  </button>
</div>
```

**i18n ключі** (`frontend/src/locales/uk.json`):
```json
{
  "booking": {
    "calendar": {
      "noSchedule": "Розклад не налаштовано",
      "noScheduleDesc": "Створіть шаблон доступності, щоб студенти могли бронювати уроки",
      "setupSchedule": "Налаштувати розклад"
    }
  }
}
```

### Пріоритет 4: Додати dev mock для швидкого тестування

**Файл:** `frontend/src/modules/booking/api/calendarApi.ts`

```typescript
export const calendarApi = {
  async getWeekView(params: {
    weekStart: string
    timezone: string
    tutorId?: number
  }): Promise<WeekViewResponse> {
    // DEV MOCK для тестування
    if (import.meta.env.DEV && import.meta.env.VITE_USE_MOCK_CALENDAR === 'true') {
      console.log('[calendarApi] Using MOCK data')
      return {
        week_start: params.weekStart,
        timezone: params.timezone,
        cells: generateMockCells(params.weekStart),
      }
    }
    
    // Production code...
  }
}

function generateMockCells(weekStart: string): CalendarCell[] {
  const cells: CalendarCell[] = []
  const start = new Date(weekStart)
  
  for (let day = 0; day < 7; day++) {
    for (let hour = 9; hour < 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const date = new Date(start)
        date.setDate(date.getDate() + day)
        date.setHours(hour, minute, 0, 0)
        
        cells.push({
          startAtUTC: date.toISOString(),
          durationMin: 30,
          status: hour >= 9 && hour < 17 ? 'available' : 'empty',
          source: 'template',
        })
      }
    }
  }
  
  return cells
}
```

**Env var** (`.env.development`):
```
VITE_USE_MOCK_CALENDAR=true
```

---

## 🧹 ЗАСТАРІЛИЙ КОД ДЛЯ ВИДАЛЕННЯ

### 1. Дублікат calendar API

**Видалити:** `backend/apps/calendar/api/` (якщо існує)  
**Причина:** Коментар у `config/urls.py:55-56` каже, що calendar endpoints переїхали в `apps.booking.urls`

### 2. Старі booking endpoints

**Перевірити використання:**
- `apps/booking/api/views.py` - старі view класи
- Можливо дублюють функціонал з `v1_week_view.py` та `v1_manual_booking.py`

**Дія:** Провести аудит і видалити неактивні endpoints

### 3. Невикористовувані stores у frontend

**Файл:** `frontend/src/modules/booking/stores/calendarStore.ts`

**Проблема:** Store має багато методів, які не використовуються в новому v0.46 календарі:
- `loadSlots()` - використовує старий API
- `loadWeekSlots()` - дублює `loadWeekView()`
- `blockSlot()` / `unblockSlot()` - старий підхід, замінений на draft patches
- `createCustomSlot()` - дублює manual booking

**Рекомендація:** Створити окремий `calendarStoreV046.ts` з чистою архітектурою:
```typescript
export const useCalendarStoreV046 = defineStore('calendar-v046', () => {
  const weekCells = ref<CalendarCell[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  async function loadWeekView(params: WeekViewParams) {
    // Тільки новий API
  }
  
  return { weekCells, loading, error, loadWeekView }
})
```

### 4. Старі компоненти

**Перевірити:**
- `WeekCalendar.vue` - можливо застарілий, якщо `CalendarCellGrid.vue` його замінює
- `MonthCalendar.vue` - перевірити використання

---

## 📊 МЕТРИКИ ПРОБЛЕМИ

### Вплив на користувачів
- 🔴 **100% тьюторів** не можуть використовувати новий календар
- 🔴 **0 бронювань** через новий UI
- 🔴 **Втрата часу** на налаштування, яке не працює

### Технічний борг
- **Невідповідність документації:** План v0.46 не згадує про структуру `weekly_slots`
- **Відсутність тестів:** Немає інтеграційних тестів для `week_generator.py`
- **Відсутність валідації:** Backend не валідує структуру JSON у `weekly_slots`

---

## ✅ ЧЕКЛИСТ ВИПРАВЛЕННЯ

### Backend
- [ ] Виправити ключі JSON у `week_generator.py` (`start`/`end` замість `start_time`/`end_time`)
- [ ] Додати детальне логування
- [ ] Створити management command для тестових даних
- [ ] Додати unit тести для `generate_week_cells()`
- [ ] Додати валідацію JSON schema для `weekly_slots`

### Frontend
- [ ] Додати empty state UI
- [ ] Додати dev mock для швидкого тестування
- [ ] Додати i18n ключі
- [ ] Покращити error handling
- [ ] Додати loading skeleton

### Документація
- [ ] Оновити контракт API у `docs/plan/v0.46/`
- [ ] Додати приклади JSON для `weekly_slots`
- [ ] Створити troubleshooting guide

### Testing
- [ ] Протестувати з реальними даними тьютора
- [ ] Протестувати з порожнім template
- [ ] Протестувати з різними timezones
- [ ] Протестувати DST transitions

### Cleanup
- [ ] Видалити `apps/calendar/api/` (якщо існує)
- [ ] Провести аудит старих booking endpoints
- [ ] Рефакторити `calendarStore.ts` або створити v046 версію
- [ ] Видалити невикористовувані компоненти

---

## 🎯 ОЧІКУВАНИЙ РЕЗУЛЬТАТ

Після виправлення:
1. ✅ API повертає клітинки з `status: 'available'` для налаштованих слотів
2. ✅ Календар відображає зелені клітинки для доступних часів
3. ✅ Клік на клітинку відкриває popover з діями
4. ✅ Якщо немає розкладу, показується зрозуміле повідомлення з CTA

---

**Пріоритет:** 🔴 КРИТИЧНИЙ  
**ETA виправлення:** 2-4 години  
**Відповідальний:** Backend + Frontend team  
**Блокує:** Весь функціонал календаря v0.46

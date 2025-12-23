# 🔍 Debug Instructions: Empty Calendar Issue

## Проблема
Календар відображає header та DST banner, але не показує комірки з часовими слотами.

## Додано Debug Logging

Я додав детальний logging у всі критичні точки для діагностики проблеми:

### 1. TutorCalendarView
- Перевіряє `tutorId`, `currentWeekStart`, `isV046CalendarClickMode`
- Логує, чи користувач авторизований

### 2. CalendarCellGrid
- Логує параметри завантаження (tutorId, weekStart, timezone)
- Показує кількість завантажених комірок

### 3. calendarStore
- Логує API запит та відповідь
- Показує кількість отриманих cells
- Виводить помилки з деталями

### 4. calendarApi
- Логує параметри запиту до backend
- Показує raw response від API

---

## Як перевірити проблему

### Крок 1: Запустити backend
```bash
cd d:/m4sh_v1/backend
python manage.py runserver
```

### Крок 2: Запустити frontend
```bash
cd d:/m4sh_v1/frontend
npm run dev
```

### Крок 3: Відкрити календар
URL: `http://localhost:5173/booking/tutor`

### Крок 4: Відкрити DevTools Console
**Натисніть F12 → вкладка Console**

---

## Що шукати в Console

### Сценарій 1: Backend не запущений
```
[calendarApi] Calling /api/calendar/week/ with params: {...}
❌ Error: Network Error
```
**Рішення:** Запустити backend

---

### Сценарій 2: Користувач не авторизований
```
[TutorCalendarView] Mounted, tutorId: 0
⚠️ [TutorCalendarView] No tutorId, user not authenticated?
```
**Рішення:** Авторизуватися як тютор

---

### Сценарій 3: API повертає 404
```
[calendarApi] Calling /api/calendar/week/ with params: {...}
❌ Error: Request failed with status code 404
```
**Рішення:** Перевірити, чи endpoint `/api/calendar/week/` існує на backend

---

### Сценарій 4: API повертає порожній масив
```
[calendarApi] Response data: { cells: [], week_start: "2025-12-22", timezone: "Europe/Kiev" }
[calendarStore] Cells received: 0
[CalendarCellGrid] Loaded cells: 0
```
**Рішення:** Backend не генерує комірки. Потрібно:
1. Перевірити, чи є availability у тютора
2. Перевірити, чи правильно працює генерація комірок на backend

---

### Сценарій 5: API повертає дані, але вони не відображаються
```
[calendarApi] Response data: { cells: [150 items], ... }
[calendarStore] Cells received: 150
[CalendarCellGrid] Loaded cells: 150
```
Але календар порожній.

**Рішення:** Проблема з рендерингом. Перевірити:
1. Чи `CellGrid` отримує `cells` prop
2. Чи `getCellsForDay()` правильно фільтрує комірки
3. Чи `CalendarCell` компонент рендериться

---

## Можливі причини порожнього календаря

### 1. Backend не запущений ❌
```bash
# Перевірити
curl http://localhost:8000/api/calendar/week/?start=2025-12-22&tz=Europe/Kiev
```

### 2. Endpoint не існує ❌
Перевірити `backend/apps/booking/urls.py`:
```python
path('calendar/week/', WeekViewAPI.as_view(), name='week-view'),
```

### 3. Користувач не авторизований ❌
Перевірити в DevTools → Application → Local Storage:
- `auth_token` має бути присутнім

### 4. У тютора немає availability ❌
```bash
# Перевірити через Django shell
python manage.py shell
>>> from apps.booking.models import Availability
>>> Availability.objects.filter(tutor_id=YOUR_TUTOR_ID).count()
```

### 5. Backend повертає неправильну структуру даних ❌
Очікувана структура:
```json
{
  "week_start": "2025-12-22",
  "timezone": "Europe/Kiev",
  "cells": [
    {
      "startAtUTC": "2025-12-22T08:00:00Z",
      "durationMin": 30,
      "status": "available",
      "source": "template"
    }
  ]
}
```

---

## Наступні кроки після діагностики

### Якщо backend не запущений:
```bash
cd d:/m4sh_v1/backend
python manage.py runserver
```

### Якщо endpoint не існує:
Потрібно реалізувати `WeekViewAPI` на backend.

### Якщо користувач не авторизований:
Авторизуватися через `/auth/login`

### Якщо немає availability:
Створити availability через UI або Django admin:
```bash
python manage.py createsuperuser
# Потім відкрити http://localhost:8000/admin
```

### Якщо backend повертає порожній масив:
Перевірити логіку генерації комірок у `WeekViewAPI`:
```python
# backend/apps/booking/api/v1_week_view.py
class WeekViewAPI(APIView):
    def get(self, request):
        # Тут має бути логіка генерації cells
        pass
```

---

## Швидка перевірка через curl

```bash
# 1. Перевірити, чи backend працює
curl http://localhost:8000/api/health/

# 2. Перевірити week view endpoint
curl http://localhost:8000/api/calendar/week/?start=2025-12-22&tz=Europe/Kiev

# 3. Якщо потрібна авторизація
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/api/calendar/week/?start=2025-12-22&tz=Europe/Kiev
```

---

## Контрольний список

- [ ] Backend запущений на http://localhost:8000
- [ ] Frontend запущений на http://localhost:5173
- [ ] Користувач авторизований як тютор
- [ ] Endpoint `/api/calendar/week/` існує
- [ ] У тютора є availability
- [ ] API повертає дані (перевірити в Network tab)
- [ ] Console показує logs без помилок
- [ ] Комірки відображаються в календарі

---

## Після виявлення проблеми

**Надішліть мені скріншот Console з логами**, і я зможу точно визначити проблему та виправити її.

Очікувані логи:
```
[TutorCalendarView] Mounted, tutorId: 123
[TutorCalendarView] currentWeekStart: 2025-12-22
[CalendarCellGrid] Loading week view: {...}
[calendarStore] Loading week view with params: {...}
[calendarApi] Calling /api/calendar/week/ with params: {...}
[calendarApi] Response data: {...}
[calendarStore] Cells received: 150
[CalendarCellGrid] Loaded cells: 150
```

**Якщо бачите помилку або 0 cells - це ключ до вирішення проблеми!**

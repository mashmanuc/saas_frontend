# 🔍 ГЛИБОКИЙ АУДИТ: Проблеми календаря v0.46

**Дата:** 23 грудня 2024, 17:10  
**Статус:** 🔴 ВИЯВЛЕНО КРИТИЧНІ ПРОБЛЕМИ

---

## 🚨 ВИЯВЛЕНІ ПРОБЛЕМИ

### 1. ❌ Подвійний `/api/api/` в URL

**Логи:**
```
GET /api/api/calendar/week/?start=2025-12-22&tz=Europe%2FKiev&tutor_id=79 HTTP/1.1" 404
```

**Проблема:** URL містить подвійний префікс `/api/api/` замість `/api/`

**Причина:** 
- `apiClient.js` має `baseURL: '/api'`
- `calendarApi.ts` робить запит до `/api/calendar/week/`
- Результат: `/api` + `/api/calendar/week/` = `/api/api/calendar/week/`

**Виправлення:**
```typescript
// В calendarApi.ts змінити:
const response = await apiClient.get('/api/calendar/week/', ...)

// На:
const response = await apiClient.get('/calendar/week/', ...)
```

---

### 2. ❌ 404 на всі booking endpoints

**Логи:**
```
GET /api/v1/booking/slots/ -> 404
GET /api/v1/booking/settings/ -> 404
GET /api/v1/booking/availability/ -> 404
GET /api/v1/booking/bookings/ -> 404
```

**Проблема:** Frontend робить запити до `/api/v1/booking/*`, але backend має `/api/booking/*`

**Причина:** Невідповідність версій API

**Backend маршрути (правильні):**
```python
# backend/apps/booking/urls.py
path('booking/settings/', ...)        # /api/booking/settings/
path('booking/availability/', ...)    # /api/booking/availability/
path('booking/slots/', ...)           # /api/booking/slots/
path('booking/bookings/', ...)        # /api/booking/bookings/
```

**Frontend запити (неправильні):**
```typescript
// Шукає /api/v1/booking/*, але має бути /api/booking/*
```

**Виправлення:** Оновити всі API клієнти у frontend, щоб не використовували `/v1/` префікс для booking endpoints.

---

### 3. ❌ DST Warning 22 грудня

**Проблема:** Показує попередження про перехід на літній/зимовий час 22 грудня

**Скріншот:** "Увага: перехід на літній/зимовий час 22 гру."

**Причина:** Функція `isDSTTransitionDay()` перевіряє КОЖЕН день, а не тільки березень/жовтень

**Виправлено:** ✅ Додано перевірку місяця (тільки березень та жовтень)

```typescript
// frontend/src/utils/timezone.ts
export function isDSTTransitionDay(date: Date, timezone: string): boolean {
  const month = date.getMonth() // 0-11
  
  // Only check for DST in March (2) and October (9)
  if (month !== 2 && month !== 9) {
    return false
  }
  // ... rest of logic
}
```

---

### 4. ❌ Empty State замість календаря

**Проблема:** Показує "Розклад не налаштовано" замість календаря

**Причина:** У тьютора ID=79 немає `TutorAvailabilityTemplate` в базі даних

**Рішення:** Створити template через management command (але потрібно активувати venv)

---

## 🔧 ВИПРАВЛЕННЯ

### Виправлення 1: Подвійний /api/

<function_calls>
<invoke name="edit">
<parameter name="file_path">d:\m4sh_v1\frontend\src\modules\booking\api\calendarApi.ts

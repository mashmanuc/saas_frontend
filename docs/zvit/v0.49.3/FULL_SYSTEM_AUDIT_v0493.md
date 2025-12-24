# 🔍 Повний системний аудит v0.49.3 Calendar Integration

**Дата:** 24.12.2024  
**Статус:** 🔴 КРИТИЧНІ ПРОБЛЕМИ ВИЯВЛЕНО

---

## 📋 Виявлені проблеми

### 1. ❌ API Endpoint Mismatch (КРИТИЧНО)

**Проблема:**
- Frontend стукає в `/api/calendar/week/`
- Backend очікує `/api/v1/calendar/week/`

**Код:**
```typescript
// frontend/src/modules/booking/api/calendarWeekApi.ts:67
const response = await api.get<WeekSnapshotResponse>('/calendar/week/', {
```

**Backend routing:**
```python
# backend/apps/booking/urls.py:123
path('v1/calendar/week/', CalendarWeekView.as_view(), name='calendar-week-v0492'),
```

**Результат:** `GET /api/calendar/week/ → 400 Bad Request`

**Виправлення:** Додати `/v1/` префікс у всіх calendar API викликах.

---

### 2. ❌ WebSocket Endpoint 404 (КРИТИЧНО)

**Проблема:**
- Frontend намагається підключитись до `/ws/calendar/`
- Backend endpoint не зареєстрований у routing

**Код:**
```typescript
// frontend/src/modules/booking/api/calendarWebSocket.ts
const wsUrl = `${protocol}//${host}/ws/calendar/?token=${encodeURIComponent(token)}`
```

**Результат:** `GET /ws/calendar/ → 404 Not Found` (постійні retries)

**Виправлення:** 
1. Зареєструвати WebSocket consumer у backend routing
2. Додати авторизацію через access token
3. Імплементувати calendar events broadcasting

---

### 3. ❌ Trial Request Flow Broken (КРИТИЧНО)

**Проблема:**
- Студент відправляє trial request через marketplace
- Тьютор НЕ бачить запит у pending bookings
- Можлива проблема з API endpoint або нотифікаціями

**Потенційні причини:**
1. Trial request API не створює booking record
2. Booking не потрапляє у pending list для тьютора
3. Відсутня нотифікація/WebSocket event

**Виправлення:** Перевірити повний flow:
```
Student → POST /api/marketplace/trial-request
       → Backend creates BookingRequest
       → Notification to Tutor
       → Tutor sees in /api/booking/requests/list/
```

---

### 4. ⚠️ Duplicate API Prefix (ПОМИЛКА)

**Проблема:**
```
GET /api/api/tutor/relations/ -> 404
```

**Причина:** Подвійний `/api/` префікс у запиті

**Виправлення:** Перевірити baseURL у apiClient та URL у викликах

---

### 5. ⚠️ includePayments/includeStats Parameters

**Проблема:**
- Frontend передає `includePayments=true&includeStats=true`
- Backend очікує ці параметри, але можливо неправильно парсить

**Backend код:**
```python
# v1_calendar_week.py:80-81
include_payments = request.query_params.get('includePayments', 'false').lower() == 'true'
include_stats = request.query_params.get('includeStats', 'false').lower() == 'true'
```

**Статус:** Код виглядає правильно, але треба перевірити чому 400

---

## 🔧 План виправлень

### Пріоритет 1: API Endpoints (БЛОКУЮЧЕ)

- [ ] **Виправити calendar API paths у frontend**
  - `calendarWeekApi.ts`: `/calendar/week/` → `/v1/calendar/week/`
  - `calendarWeekApi.ts`: create/update/delete → `/v1/calendar/event/*`
  - Перевірити всі інші calendar endpoints

- [ ] **Зареєструвати WebSocket routing у backend**
  - Створити `CalendarConsumer` у `apps/booking/consumers.py`
  - Додати routing у `asgi.py` або `routing.py`
  - Імплементувати авторизацію через token query param
  - Додати broadcasting для calendar events

### Пріоритет 2: Trial Request Flow

- [ ] **Перевірити trial request API**
  - Endpoint: `POST /api/marketplace/trial-request/`
  - Чи створюється BookingRequest?
  - Чи прив'язується до тьютора?

- [ ] **Перевірити pending bookings list**
  - Endpoint: `GET /api/booking/requests/list/`
  - Чи повертаються trial requests?
  - Чи правильний фільтр по тьютору?

- [ ] **Додати нотифікації**
  - WebSocket event для нового trial request
  - Email/push notification (опціонально)

### Пріоритет 3: Інші виправлення

- [ ] **Виправити подвійний /api/ префікс**
  - Знайти джерело `/api/api/tutor/relations/`
  - Виправити URL або baseURL

- [ ] **Перевірити CSS imports**
  - Чи завантажуються `calendar-theme.css` та інші?
  - Чи застосовуються стилі?

---

## 📊 Поточний стан endpoints

### ✅ Працюючі endpoints:
- `GET /api/v1/dashboard/tutor/` → 200 OK
- `GET /api/v1/solo/sessions/` → 200 OK

### ❌ Не працюючі endpoints:
- `GET /api/calendar/week/` → 400 (неправильний шлях)
- `GET /ws/calendar/` → 404 (не зареєстрований)
- `GET /api/api/tutor/relations/` → 404 (подвійний префікс)

### ❓ Невідомий статус:
- Trial request endpoints
- Booking requests list
- Calendar event create/update/delete

---

## 🎯 Acceptance Criteria для завершення

1. ✅ Calendar week snapshot завантажується без 400/404
2. ✅ WebSocket підключається та отримує realtime updates
3. ✅ Trial requests від студентів доходять до тьютора
4. ✅ Тьютор бачить pending bookings у sidebar
5. ✅ Create/Update/Delete events працюють
6. ✅ Стилі календаря застосовуються коректно
7. ✅ ETag caching працює (304 Not Modified)
8. ✅ Error handling показує правильні toast повідомлення

---

## 📝 Наступні кроки

1. **НЕГАЙНО:** Виправити API paths у `calendarWeekApi.ts`
2. **НЕГАЙНО:** Зареєструвати WebSocket consumer
3. **ВИСОКИЙ:** Дослідити trial request flow
4. **СЕРЕДНІЙ:** Виправити подвійний API prefix
5. **НИЗЬКИЙ:** Перевірити CSS imports

---

## 🔗 Пов'язані документи

- `API_CONTRACTS_v0493.md` — специфікація API
- `FE_TASKS_v0493_FULL.md` — frontend завдання
- `FE_AGENT_REPORT_v0493.md` — звіт про виконання
- `UI_UX_PROGRESS_REPORT.md` — UI/UX прогрес

---

**Висновок:** Frontend код написаний правильно згідно контрактів, але використовує неправильні URL paths. Backend має всі необхідні endpoints, але вони не підключені до правильних маршрутів. Після виправлення paths та WebSocket routing система має запрацювати повністю.

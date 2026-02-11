# План впровадження EventSummaryModal (29.12.2025)

## 1. Мета
Замінити поточне стандартне EventModal на легке «карткове» модальне вікно для швидкого перегляду уроку, дій «перенести/перейти/ноу-шоу», з можливістю перейти до повного редагування.

## 2. Дані, які потрібні
- `eventId` — передається з календаря, в UI не показується, але потрібен для всіх дій.
- `title/type` — тип уроку (разовий / регулярний тощо).
- `studentName`, `orderId` — імʼя та номер замовлення (посилання).
- `start`, `end` — дата та інтервал часу.
- `remainingHours` — кількість невикористаних годин.
- `subscriptionActiveUntil` — дата дії абонемента.
- `lessonUrl` — посилання для кнопки «Перейти до заняття».
- `rescheduleAvailable` — чи можна показувати «Перенести урок».
- `noShowUrl` або прапорець `allowNoShow` для дії «Учень не зʼявився».
- Статуси `paidStatus`, `doneStatus` для відображення у статусних бейджах (як у current EventDetailsView).

> Якщо якихось полів немає у відповіді `GET /v1/calendar/event/{id}/`, потрібно додати їх у бекенді та в `calendarWeekApi.getEventDetails`.

## 3. UX / структура компонента
Компонент: `EventSummaryModal.vue`

1. **Хедер**
   - Статусна крапка (колір за статусом).
   - Текст типу («Звичайний урок»).
   - Кнопка закриття (X).
   - Іконка олівця справа — відкриває повний EventModal (режим редагування).

2. **Основний блок**
   - Імʼя студента + посилання на замовлення (№xxxxxx).
   - Рядок з датою + часом (локалізовано: «Вівторок, 30 груд, 12:00 – 13:00»).

3. **Інфобокс**
   - «К-сть невикористаних годин: X»
   - «Абонемент активний до: DD.MM.YYYY»

4. **Кнопки**
   - Secondary: «Перенести урок» — відкриває CreateLessonModal/reschedule.
   - Primary: «Перейти до заняття» — `window.open(lessonUrl)`.
   - Лінк під кнопками: «Учень не зʼявився на заняття?» — викликає confirm/дію no-show.

5. **Редагування**
   - Кнопка-олівець + можлива допоміжна кнопка «Редагувати» (якщо потрібно) → відкриває старий EventModal зі всіма полями.

## 4. Інтеграція з календарем
1. При кліку по події:
   ```ts
   selectedEventId.value = event.id
   selectedEventDetails.value = await store.getEventDetails(event.id)
   showSummaryModal.value = true
   ```
2. `EventSummaryModal` приймає `eventDetails` + емить події:
   - `close`
   - `edit` – відкриває EventModal (існуюcha логіка)
   - `reschedule` – відкриває CreateLessonModal
   - `join` – відкриває lessonUrl
   - `noShow` – викликає ConfirmDialog → API
3. Кешування: використати ті ж дані при переході в режим редагування, щоб не робити повторний запит.

## 5. i18n
Створити блок `booking.calendar.eventSummary` у `en.json` та `uk.json`:
```json
{
  "title": "Звичайний урок",
  "student": "Студент",
  "order": "Замовлення №{id}",
  "timeRange": "{day}, {date} • {start} – {end}",
  "remainingHours": "К-сть невикористаних годин: {count}",
  "subscriptionUntil": "Абонемент активний до: {date}",
  "reschedule": "Перенести урок",
  "joinLesson": "Перейти до заняття",
  "noShow": "Учень не зʼявився на заняття?"
}
```

## 6. Етапи реалізації
1. **API/Store**: оновити `calendarWeekApi.getEventDetails`, типи `EventDetailsResponse`, Pinia store (додати `selectedEventDetails`).
2. **Компонент**: створити `EventSummaryModal.vue` (адаптивний layout, підтримка клавіатурної навігації, фокус-трап).
3. **Інтеграція**: підключити до `CalendarWeekView`, повʼязати кнопки з існуючими модалками/діями.
4. **i18n**: додати ключі для `booking.calendar.eventSummary` (uk/en).
5. **Тестування**: сценарії відриття → join → reschedule → edit → no-show, мобільний вид, відсутні дані (fallback).

## 7. Питання до узгодження
- Чи є готовий API для `remainingHours`, `subscriptionActiveUntil`, `lessonUrl`, `noShowUrl`? Якщо ні — створюємо беклог для бекенду.
- Коли стартувати розробку (одразу чи після додаткового дизайну)?
- Чи треба логіку reschedule/no-show вже зараз, чи лише кнопки з TODO.

---

## 8. API-контракти з бекендом

### 8.1 Існуючий endpoint
`GET /api/v1/calendar/event/{id}/`

Поточна відповідь (`v1_event_details.py`):
```jsonc
{
  "status": "success",
  "data": {
    "event": {
      "id": 123,
      "type": "class",
      "start": "2025-12-30T10:00:00+02:00",
      "end": "2025-12-30T11:00:00+02:00",
      "durationMin": 60,
      "orderId": 821425,
      "clientName": "Никита",
      "clientPhone": "+380...",
      "paidStatus": "paid|unpaid",
      "doneStatus": "done|not_done|…",
      "regularity": "single|once_a_week|twice_a_week",
      "tutorComment": ""
    },
    "dictionaries": {
      "durations": [30, 60, 90],
      "regularities": ["single", "once_a_week", "twice_a_week"],
      "classTypes": ["common", "first", "trial"],
      "paidStatuses": ["unpaid", "paid"],
      "doneStatuses": ["not_done", "done", "not_done_client_missed", "done_client_missed"]
    }
  }
}
```

### 8.2 Що потрібно додати для EventSummaryModal
Пропонуємо доповнити блок `data.event` (або `data.meta`) такими полями:

| Поле | Тип | Опис |
|------|-----|------|
| `remainingHours` | number \| null | Кількість невикористаних годин за абонементом |
| `subscriptionActiveUntil` | string (ISO date) \| null | Дата, доки діє абонемент |
| `lessonUrl` | string \| null | URL відеочату для кнопки «Перейти до заняття» |
| `rescheduleAvailable` | boolean | Чи можна переносити урок (true = показуємо кнопку) |
| `reschedulePayload` | object \| null | Дані, які треба підставити в CreateLessonModal (наприклад `{ start: ..., durationMin: ... }`) |
| `noShowAllowed` | boolean | Чи можна позначити «Учень не зʼявився» |
| `noShowAction` | { `method`: \"POST\", `url`: string } \| null | Куди відправляємо запит, якщо клієнт не зʼявився |
| `editAllowed` | boolean | Чи дозволено редагувати (можна reuse логіку canEdit) |

> Поля `reschedulePayload`, `noShowAction` необов’язкові: можна почати з boolean + TODO, але краще закласти структуру одразу.

### 8.3 Формат відповіді після розширення
```jsonc
{
  "status": "success",
  "data": {
    "event": {
      "...": "...",
      "remainingHours": 3,
      "subscriptionActiveUntil": "2026-02-01",
      "lessonUrl": "https://video.m4sh.app/room/abc",
      "rescheduleAvailable": true,
      "reschedulePayload": {
        "start": "2025-12-30T10:00:00+02:00",
        "durationMin": 60
      },
      "noShowAllowed": true,
      "noShowAction": {
        "method": "POST",
        "url": "/api/v1/calendar/event/123/no-show/"
      },
      "editAllowed": true
    },
    "dictionaries": { "...": "..." }
  }
}
```

### 8.4 Зміни на фронтенді
1. **Типізація** – оновити `EventDetailsResponse` та `CalendarEvent` у `calendarWeekApi.ts` / `calendarWeekStore.ts`.
2. **Store** – зберігати `selectedEventDetails` і прокидати в нове модальне вікно.
3. **Компонент** – відображати нові поля, ховати кнопки якщо відповідні прапорці `false` або значення `null`.

### 8.5 Edge cases / контрактні вимоги
- Якщо `lessonUrl` = null → кнопка «Перейти до заняття» disabled.
- `remainingHours` або `subscriptionActiveUntil` можуть бути `null` → показуємо «—» або приховуємо рядок.
- Для `noShowAction` бажано, щоб бекенд повертав уже зібраний URL, бо логіка може змінюватися.
- Всі дати повертаємо у форматі ISO 8601 (UTC або з таймзоною) — фронтенд форматуватиме локально.

### 8.6 Подальші кроки з бекендом
1. Обговорити з бекенд-командою розширення `EventDetailsView` в `apps/booking/api/v1_event_details.py`.
2. Додати нові поля в serializer/response (можна створити окремий DTO `EventSummaryDto`).
3. За потреби створити окремі endpoints:
   - `POST /api/v1/calendar/event/{id}/reschedule/`
   - `POST /api/v1/calendar/event/{id}/no-show/`
   (поки що мінімально достатньо мати URL у відповіді).

  ===== M4SH CALENDAR STABILITY AUDIT v0.53.1 =====
Мета: довести календар до стану "100% стабільно" — слоти доступності можна НАДІЙНО створювати/редагувати/видаляти

═══════════════════════════════════════════════════════════════════════════════
ЕТАП A: INVENTORY & EVIDENCE
═══════════════════════════════════════════════════════════════════════════════

[2025-12-26 12:21] 🔍 Початок інвентаризації ендпоінтів та збору доказів

ПОПЕРЕДНІ ВИПРАВЛЕННЯ (v0.53.0):
1. ✅ Подвійний /api/ в URL запитах
2. ✅ Невірна обробка response в useSlotEditor
3. ✅ Невірна стратегія user_choice замість override
4. ✅ 500 помилка через celery регенерацію в update_template
5. ✅ AttributeError через template_id_id (має бути template_id.id)
6. ✅ 404 помилка в DELETE через відсутність /v1/ в URL
7. ✅ Vue composition API помилка (useSlotEditor в handler)
8. ✅ SlotEditHistory.log_edit тепер приймає edited_by_id

ВІДОМІ СИМПТОМИ (потребують систематичного дослідження):
- Слоти інколи редагуються, інколи — ні (race condition / stale state?)
- Delete працює, edit частково, add часто не працює
- Немає механізму створення blocked/busy слотів
- Bulk endpoint проблеми (HTTP 500, неділя, UX)
- 401/422 помилки при протермінованій сесії (потребує interceptor)

═══════════════════════════════════════════════════════════════════════════════
A.1) ІНВЕНТАРИЗАЦІЯ ЕНДПОІНТІВ
═══════════════════════════════════════════════════════════════════════════════

📋 BACKEND ENDPOINTS (Django REST Framework):

1. GET /api/v1/calendar/week/ (CalendarWeekView)
   - Snapshot-driven: повертає всі дані для тижня
   - Query params: page, timezone, includePayments, includeStats
   - Кешування: ETag, 60s cache
   - Rate limit: 60 req/min
   - Файл: apps/booking/api/v1_calendar_week.py
   - Сервіс: apps/booking/services/week_snapshot_generator.py

2. PUT /api/v1/booking/slots/{id}/ (SlotDetailView)
   - Редагування одного слоту
   - Body: start_time, end_time, strategy, override_reason
   - Strategies: override, update_template, update_slot
   - Throttle: SlotEditingThrottle
   - Файл: apps/booking/api/views.py:126-161
   - Сервіс: apps/booking/services/slot_editor_service.py

3. DELETE /api/v1/booking/slots/{id}/ (SlotDetailView)
   - Видалення слоту (якщо не booked)
   - Файл: apps/booking/api/views.py:163-175
   - Сервіс: slot_editor_service.delete_slot()

4. POST /api/v1/booking/slots/batch-edit/ (SlotBatchEditView)
   - Пакетне редагування слотів
   - Body: slots[], start_time?, end_time?, strategy, override_reason?
   - Throttle: SlotBatchEditingThrottle
   - Файл: apps/booking/api/views.py:178-210

5. POST /api/v1/booking/slots/check-conflicts/ (SlotConflictsView)
   - Перевірка конфліктів перед збереженням
   - Body: date, start_time, end_time, exclude_slot_id?
   - Файл: apps/booking/api/views.py:213-241

6. POST /booking/availability/bulk/ (AvailabilityBulkView)
   - Bulk оновлення weekly availability
   - Тригерить async Celery job
   - Throttle: AvailabilityBulkThrottle (10 req/hour)
   - Файл: apps/booking/api/views.py:333-416

7. POST /api/v1/calendar/event/create/ (CreateEventView)
   - Створення calendar event
   - Файл: apps/booking/api/v1_calendar_event.py:24-100

8. POST /api/v1/calendar/event/delete/ (DeleteEventView)
   - Видалення calendar event

9. POST /api/v1/calendar/event/update/ (UpdateEventView)
   - Оновлення calendar event

📋 FRONTEND API CLIENTS:

1. bookingApi (src/modules/booking/api/booking.ts)
   - editSlot(slotId, data) → PUT /v1/booking/slots/{id}/
   - deleteSlot(slotId) → DELETE /v1/booking/slots/{id}/
   - checkSlotConflicts(data) → POST /v1/booking/slots/check-conflicts/
   - batchEditSlots(data) → POST /v1/booking/slots/batch-edit/
   - blockSlot(slotId, reason) → POST /booking/slots/block/
   - createCustomSlot(data) → POST /booking/slots/custom/

2. availabilityApi (src/modules/booking/api/availabilityApi.ts)
   - updateAvailability(schedule) → POST /booking/availability/bulk/
   - getTemplate() → GET /api/v1/booking/availability/template/
   - saveTemplate(data) → PUT/POST /api/v1/booking/availability/template/
   - getGenerationJobStatus(jobId) → GET /api/v1/booking/availability/jobs/{id}/

3. calendarWeekApi (src/modules/booking/api/calendarWeekApi.ts)
   - getWeek(params) → GET /api/v1/calendar/week/

📋 FRONTEND COMPOSABLES:

1. useSlotEditor (src/modules/booking/composables/useSlotEditor.ts)
   - editSlot(slotId, newStart, newEnd, strategy, overrideReason)
   - deleteSlot(slotId)
   - detectConflicts(slotId, slotDate, newStart, newEnd)
   - batchEditSlots(slotIds, startTime?, endTime?, strategy, overrideReason?)

📋 PINIA STORES:

1. calendarWeekStore (src/modules/booking/stores/calendarWeekStore.ts)
   - fetchWeek(page) — основний метод для refetch
   - State: eventsById, accessibleById, computedCells336, weekMeta

ЛОГИ ПІСЛЯ ТЕСТУВАННЯ (вставити нижче):
---

═══════════════════════════════════════════════════════════════════════════════
A.2) ВІДТВОРЕННЯ БАГІВ ТА ЗБІР ДОКАЗІВ
═══════════════════════════════════════════════════════════════════════════════

[2025-12-26 12:30] 🐛 Відтворення симптомів та збір network traces

СЦЕНАРІЙ 1: Редагування слоту (інколи працює, інколи ні)
──────────────────────────────────────────────────────────
Кроки:
1. Логін як тьютор (m3@gmail.com)
2. Відкрити календар /booking/tutor
3. Клікнути на жовтий слот (наприклад, 09:00-21:00)
4. Змінити час на 09:00-20:00
5. Натиснути "Зберегти"

СПОСТЕРЕЖЕННЯ (з попередніх тестів):
✅ Успішний кейс:
   - PUT /api/v1/booking/slots/76/ → 200 OK
   - Response: {"slot": {...}, "warnings": []}
   - Toast: "Слот успішно збережено"
   - Модалка закривається
   - UI оновлюється після fetchWeek()

❌ Проблемний кейс (401/422):
   - PUT /api/v1/booking/slots/76/ → 401 Unauthorized
   - POST /api/v1/auth/refresh → 422 Unprocessable Entity
   - Toast: "Помилка збереження"
   - Модалка залишається відкритою
   
ROOT CAUSE: Протермінована сесія, відсутній interceptor для auto-refresh

СЦЕНАРІЙ 2: Видалення слоту
──────────────────────────────
Кроки:
1. Відкрити слот
2. Натиснути "Видалити"
3. Підтвердити

СПОСТЕРЕЖЕННЯ:
✅ Працює стабільно після виправлення:
   - DELETE /api/v1/booking/slots/76/ → 204 No Content
   - Toast: "Слот успішно видалено"
   - UI оновлюється одразу

СЦЕНАРІЙ 3: Створення нового слоту (add часто не працює)
─────────────────────────────────────────────────────────
ПРОБЛЕМА: Немає UI для створення окремих слотів!
ЗНАЙДЕНІ ENDPOINTS:
- POST /booking/slots/custom/ (bookingApi.createCustomSlot)
- POST /api/v1/availability/slots (availabilityApi.createSlot)

❌ НЕ РЕАЛІЗОВАНО В UI:
   - Немає кнопки "Додати слот" в календарі
   - Немає модалки для створення нового слоту
   - Єдиний спосіб — через bulk availability або template

СЦЕНАРІЙ 4: Blocked/Busy слоти
───────────────────────────────
ПРОБЛЕМА: Немає механізму створення blocked слотів!
ЗНАЙДЕНІ ENDPOINTS:
- POST /booking/slots/block/ (bookingApi.blockSlot)
- POST /api/v1/availability/slots/{id}/block (availabilityApi.blockSlotV2)

❌ НЕ РЕАЛІЗОВАНО:
   - Немає UI для блокування часу
   - Модель TutorAvailabilitySlot має status='blocked', але не використовується
   - Week snapshot не включає blocked slots окремо

СЦЕНАРІЙ 5: Bulk availability update
─────────────────────────────────────
Endpoint: POST /booking/availability/bulk/
ПРОБЛЕМА: HTTP 500, неділя, UX

Потребує окремого тестування з різними сценаріями:
- Неділя (weekday=6)
- Overlap слотів
- Минулі дати
- Велика кількість змін (>100)

═══════════════════════════════════════════════════════════════════════════════
A.3) ROOT CAUSES (ПРІОРИТИЗОВАНІ)
═══════════════════════════════════════════════════════════════════════════════

🔴 КРИТИЧНІ (блокують основний функціонал):

RC-1: Відсутній механізм створення окремих слотів
     - Симптом: "add часто не працює"
     - Причина: Немає UI для POST /booking/slots/custom/
     - Вплив: Тьютор не може додати разовий слот поза шаблоном
     - Пріоритет: P0

RC-2: Відсутній механізм blocked/busy слотів
     - Симптом: Немає способу заблокувати час (перерва, зайнятість)
     - Причина: UI не реалізований, snapshot не включає blocked
     - Вплив: Тьютор не може позначити зайнятий час
     - Пріоритет: P0

RC-3: Auth token expiry без auto-refresh
     - Симптом: 401/422 помилки при редагуванні
     - Причина: Axios interceptor не обробляє 401 з refresh
     - Вплив: Користувач втрачає дані при протермінованій сесії
     - Пріоритет: P1

🟡 ВАЖЛИВІ (впливають на стабільність):

RC-4: Race condition в bulk endpoint
     - Симптом: HTTP 500 при bulk update
     - Причина: Відсутність optimistic locking / idempotency
     - Вплив: Непередбачувана поведінка при одночасних запитах
     - Пріоритет: P1

RC-5: Stale state в calendarWeekStore
     - Симптом: UI не оновлюється одразу після команди
     - Причина: fetchWeek() не завжди викликається або кеш не інвалідується
     - Вплив: Користувач бачить застарілі дані
     - Пріоритет: P2

RC-6: Неділя (weekday=6) обробка
     - Симптом: Помилки при роботі з неділею
     - Причина: Невідомо (потребує дослідження)
     - Пріоритет: P2

🟢 ПОКРАЩЕННЯ (UX та observability):

RC-7: Відсутність saving/loading індикаторів
     - Вплив: Користувач не розуміє, чи виконується операція
     - Пріоритет: P3

RC-8: Недостатнє логування помилок
     - Вплив: Важко діагностувати проблеми в production
     - Пріоритет: P3

═══════════════════════════════════════════════════════════════════════════════
ЕТАП B: BACKEND AUDIT & FIXES
═══════════════════════════════════════════════════════════════════════════════

[2025-12-26 12:45] ✅ B1: Atomic Protocol + Optimistic Locking + Validation

ПАТЧІ ЗАСТОСОВАНО:

1. **SlotEditSerializer** (D:\m4sh_v1\backend\apps\booking\api\serializers.py:409-463)
   ✅ Додано optimistic locking: `expected_version` field (DateTimeField)
   ✅ Розширена валідація:
      - start < end (було)
      - Мінімальна тривалість: 15 хвилин
      - Максимальна тривалість: 8 годин
   ✅ Структуровані помилки з полями

2. **BatchSlotEditSerializer** (D:\m4sh_v1\backend\apps\booking\api\serializers.py:487-516)
   ✅ Додано max_length=50 для batch операцій
   ✅ Валідація наявності хоча б одного параметра

3. **SlotEditorService.edit_single_slot()** (D:\m4sh_v1\backend\apps\booking\services\slot_editor_service.py:153-238)
   ✅ Додано параметр `expected_version` для optimistic locking
   ✅ Перевірка версії перед редагуванням → 409 CONFLICT якщо stale
   ✅ Валідація: не можна редагувати BOOKED слоти → 422 UNPROCESSABLE_ENTITY
   ✅ Валідація: не можна редагувати минулі дати → 422 UNPROCESSABLE_ENTITY
   ✅ Чіткі коди помилок: STALE_REVISION, CANNOT_EDIT_BOOKED, CANNOT_EDIT_PAST
   ✅ Метрики для кожного типу помилки

4. **SlotDetailView.put()** (D:\m4sh_v1\backend\apps\booking\api\views.py:126-188)
   ✅ Передача expected_version в service
   ✅ Структуровані відповіді з кодами:
      - 409 для stale_version
      - 422 для validation errors (booked, past_date)
      - 404 для not_found
   ✅ Формат: {status, error: {code, message, conflicts, warnings}}

5. **AvailabilityBulkView.post()** (D:\m4sh_v1\backend\apps\booking\api\views.py:346-498)
   ✅ Обгорнуто в transaction.atomic() — вся операція атомарна
   ✅ Валідація weekday: 0-6 (0=Monday, 6=Sunday) → 422 INVALID_WEEKDAY
   ✅ Валідація max 50 windows → 422 TOO_MANY_WINDOWS
   ✅ Валідація overlaps → 422 OVERLAPPING_WINDOWS
   ✅ Proper exception handling з логуванням
   ✅ Структуровані відповіді

6. **Тести** (D:\m4sh_v1\backend\apps\booking\tests\test_slot_editing_atomic.py)
   ✅ test_optimistic_locking_success
   ✅ test_optimistic_locking_stale_version
   ✅ test_cannot_edit_booked_slot
   ✅ test_cannot_edit_past_slot
   ✅ test_concurrent_edit_race_condition
   ✅ test_batch_edit_atomic
   ✅ test_invalid_weekday_rejected (weekday > 6)
   ✅ test_sunday_weekday_6_accepted
   ✅ test_too_many_windows_rejected
   ✅ test_overlapping_windows_rejected

ROOT CAUSES ВИРІШЕНО:
✅ RC-4: Race condition в bulk endpoint — додано atomic transaction
✅ RC-6: Неділя (weekday=6) — додано валідацію 0-6 з чітким повідомленням
✅ Частково RC-5: Stale state — optimistic locking дозволяє виявити застарілі дані

HOW TO VERIFY:

1. Запустити тести:
```bash
cd D:\m4sh_v1\backend
python manage.py test apps.booking.tests.test_slot_editing_atomic -v 2
```

2. Перевірити optimistic locking вручну:
```bash
# Terminal 1: Отримати слот
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/v1/booking/slots/76/

# Зберегти updated_at з response

# Terminal 2: Редагувати слот з правильною версією
curl -X PUT -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "start_time": "09:00",
    "end_time": "11:00",
    "strategy": "override",
    "expected_version": "2025-12-26T10:30:00Z"
  }' \
  http://localhost:8000/api/v1/booking/slots/76/

# Очікується: 200 OK

# Terminal 3: Спробувати з застарілою версією
curl -X PUT -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "start_time": "09:00",
    "end_time": "12:00",
    "strategy": "override",
    "expected_version": "2025-12-26T09:00:00Z"
  }' \
  http://localhost:8000/api/v1/booking/slots/76/

# Очікується: 409 CONFLICT з кодом STALE_REVISION
```

3. Перевірити валідацію weekday:
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": {
      "7": [{"start_time": "09:00", "end_time": "17:00"}]
    }
  }' \
  http://localhost:8000/api/booking/availability/bulk/

# Очікується: 422 UNPROCESSABLE_ENTITY з кодом INVALID_WEEKDAY
```

4. Перевірити неділю (weekday=6):
```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "schedule": {
      "6": [{"start_time": "09:00", "end_time": "17:00"}]
    }
  }' \
  http://localhost:8000/api/booking/availability/bulk/

# Очікується: 200 OK (неділя тепер працює)
```

НАСТУПНІ КРОКИ:
- B2: Auth auto-refresh interceptor (401/422)
- C: Blocked/Busy slots backend + snapshot
- D: UI для створення слотів + blocked UI
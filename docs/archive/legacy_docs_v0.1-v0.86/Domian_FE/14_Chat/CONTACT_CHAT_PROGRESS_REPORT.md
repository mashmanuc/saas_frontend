# Contact→Chat Integration - Progress Report

**Дата:** 2026-02-04  
**Базовий документ:** `PLAN_CONTACT_CHAT_ENTRY.md`  
**Статус:** 🟡 В процесі (Backend завершено, Frontend State завершено, UI в процесі)

---

## EXECUTIVE SUMMARY

Реалізація Contact→Chat інтеграції згідно з планом `PLAN_CONTACT_CHAT_ENTRY.md`. Backend частина повністю завершена з 12/12 тестами, що пройшли. Frontend State layer завершено. UI/UX компоненти та тести в процесі реалізації.

---

## ✅ ЗАВЕРШЕНО

### Backend (100%)

#### 1. Модель ChatThread розширена
- ✅ Додано `Kind.CONTACT` для relation-based threads
- ✅ Додано `relation` OneToOneField
- ✅ Додано CheckConstraint для консистентності (negotiation XOR contact)
- ✅ Оновлено `is_writable()` для contact threads (перевірка ACTIVE relation)
- ✅ Створено міграцію `0006_add_contact_thread_support`

**Файл:** `apps/chat/models.py`

#### 2. API Endpoints розширені
- ✅ `POST /api/v1/chat/threads/negotiation/` підтримує `relation_id`
- ✅ Додано `_create_contact_thread()` з перевіркою ContactAccess
- ✅ Guards: relation ACTIVE + ContactAccess unlocked (для tutor)
- ✅ Студент може створювати thread без ContactAccess check
- ✅ Ідемпотентність (one thread per relation)

**Файл:** `apps/chat/api_chat_views.py`

#### 3. Unread Summary Endpoint
- ✅ `GET /api/v1/chat/unread-summary/`
- ✅ Повертає threads з непрочитаними повідомленнями
- ✅ Фільтрація за роллю (tutor/student)
- ✅ Сортування за часом останнього повідомлення
- ✅ View-only природа (не domain API)

**Файл:** `apps/chat/api_unread_summary.py`

#### 4. Serializers оновлені
- ✅ `ChatThreadCreateSerializer` підтримує `inquiry_id` XOR `relation_id`
- ✅ `ChatThreadSerializer` додано `relation_id`, `student_id`
- ✅ Валідація: тільки один з inquiry_id/relation_id

**Файл:** `apps/chat/api_serializers.py`

#### 5. URLs оновлені
- ✅ Додано route для `/unread-summary/`
- ✅ Оновлено версію до v0.70

**Файл:** `apps/chat/urls_chat.py`

#### 6. Документація оновлена
- ✅ API_ENDPOINTS.md розширено для Contact→Chat
- ✅ Додано приклади request/response
- ✅ Документовано guards та status codes

**Файл:** `docs/Domian_BE/14_Chat/API_ENDPOINTS.md`

#### 7. Backend тести
- ✅ 12 тестів створено та пройшли
- ✅ `ContactThreadTestCase` (8 тестів)
  - Перевірка ACTIVE relation requirement
  - Перевірка ContactAccess requirement для tutor
  - Ідемпотентність
  - Студент без ContactAccess check
  - Ізоляція між tutors
  - is_writable() для різних статусів
- ✅ `UnreadSummaryTestCase` (4 тести)
  - Empty state
  - Unread messages
  - Виключення власних повідомлень
  - Виключення прочитаних
  - Підрахунок множинних unread

**Файл:** `apps/chat/tests/test_contact_threads.py`

**Результат:** `12 passed in 73.80s` ✅

---

### Frontend State (100%)

#### 1. chatThreadsStore створено
- ✅ Pinia store з правильною архітектурою
- ✅ `threadsByStudent` = навігаційний кеш (НЕ SSOT)
- ✅ `ensureThread(studentId, relationId)` - створення/отримання thread
- ✅ `fetchUnreadSummary()` - polling unread
- ✅ `markThreadRead(threadId)` - позначення прочитаним
- ✅ `clearCache()`, `removeThread()` - lifecycle management
- ✅ Getters: `getThreadIdByStudent`, `getUnreadCount`, `totalUnread`
- ✅ Готовий до `threadId === null` (backend verification)

**Файл:** `src/stores/chatThreadsStore.js`

**Контракти дотримано:**
- ✅ Store cache = похідний стан
- ✅ UI готовий до threadId === null
- ✅ unread-summary = view-only

#### 2. Contact Access Layer розширено
- ✅ Додано `canOpenChat(studentId)` helper
- ✅ Простіша перевірка: `hasContactAccess` (Boolean)
- ✅ Chat domain НЕ читає access_level semantics

**Файл:** `src/stores/contactAccessStore.js`

---

## 🟡 В ПРОЦЕСІ

### UI/UX Components (0%)

Наступні компоненти потрібно реалізувати:

#### 1. DashboardTutor.vue оновлення
- [ ] Додати кнопку "Чат зі студентом" поруч із "Створити урок"
- [ ] Guard: disabled якщо `!canOpenChat(studentId)`
- [ ] Badge з `getUnreadCount(studentId)`
- [ ] onClick → `ensureThread` → `router.push(/chat/student/:id)`

#### 2. DashboardStudent.vue оновлення
- [ ] Симетрична кнопка "Чат з тьютором"
- [ ] Ті самі guards та badge

#### 3. ChatNotificationsBell компонент
- [ ] Header bell icon з `totalUnread` badge
- [ ] Dropdown з `unreadSummary.threads`
- [ ] Smart polling (visible 3s, hidden 15s)
- [ ] Клік по item → відкриття чату

#### 4. Chat Route/Page
- [ ] Route `/chat/student/:id` або `/chat/tutor/:id`
- [ ] Інтеграція `NegotiationChatWindow`
- [ ] onMount → `ensureThread`
- [ ] onFocus → `markThreadRead`

---

## ⏳ PENDING

### Tests (0%)
- [ ] Unit тести для `chatThreadsStore`
- [ ] Component тести для UI компонентів
- [ ] E2E тести (Playwright)
  - Accept → unlock → chat button → відкриття → надсилання
  - Студент пише → tutor бачить badge → відкриває → badge зникає
  - Revoke → кнопка disabled

### Rollout (0%)
- [ ] Feature flag `enableContactChatEntry`
- [ ] Аналітика events:
  - `contact_chat_button_shown`
  - `chat_thread_ensured`
  - `chat_opened_from_relation`
  - `chat_notifications_viewed`

### i18n (0%)
- [ ] Додати ключі для нових UI елементів
- [ ] `dashboard.tutor.cta.chatWithStudent`
- [ ] `dashboard.student.cta.chatWithTutor`
- [ ] `chat.notifications.title`
- [ ] `chat.notifications.empty`

---

## 📊 СТАТИСТИКА

| Категорія | Статус | Прогрес |
|-----------|--------|---------|
| Backend Models | ✅ Завершено | 100% |
| Backend API | ✅ Завершено | 100% |
| Backend Tests | ✅ Завершено | 100% (12/12) |
| Backend Docs | ✅ Завершено | 100% |
| Frontend State | ✅ Завершено | 100% |
| Frontend UI | 🟡 В процесі | 0% |
| Frontend Tests | ⏳ Pending | 0% |
| i18n | ⏳ Pending | 0% |
| Rollout | ⏳ Pending | 0% |

**Загальний прогрес:** ~50% (Backend + State завершено, UI/Tests pending)

---

## 🔧 ТЕХНІЧНІ ДЕТАЛІ

### Backend Architecture

```
ChatThread Model
├── kind: 'negotiation' | 'contact'
├── inquiry: OneToOne (nullable)
└── relation: OneToOne (nullable)
    └── Constraint: (negotiation + inquiry) XOR (contact + relation)

Contact Thread Creation Flow:
1. POST /chat/threads/negotiation/ { relation_id }
2. Verify: user is participant
3. Verify: relation.status === ACTIVE
4. Verify (tutor only): ContactAccess.can_access_contacts()
5. get_or_create(relation=relation, kind=CONTACT)
6. Return: thread_id, kind, relation_id, student_id, is_writable
```

### Frontend Architecture

```
chatThreadsStore (Pinia)
├── threadsByStudent: Map<studentId, {threadId, kind, lastSync}>
├── unreadSummary: {threads[], total}
└── Actions:
    ├── ensureThread(studentId, relationId) → threadId
    ├── fetchUnreadSummary() → updates cache
    └── markThreadRead(threadId) → clears unread

UI Flow:
1. User clicks "Чат зі студентом" (guard: canOpenChat)
2. ensureThread(studentId, relationId) → backend call
3. router.push(/chat/student/:studentId)
4. Page loads NegotiationChatWindow with threadId
5. onFocus → markThreadRead(threadId)
```

---

## 🎯 НАСТУПНІ КРОКИ

1. **UI Components** (пріоритет HIGH)
   - Оновити `DashboardTutor.vue` з кнопкою чату
   - Створити `ChatNotificationsBell.vue`
   - Додати chat route

2. **i18n Keys** (пріоритет MEDIUM)
   - Додати всі необхідні ключі в uk.json/en.json

3. **Tests** (пріоритет HIGH)
   - Unit тести для store
   - E2E тести для критичних flow

4. **Rollout** (пріоритет LOW)
   - Feature flag
   - Аналітика

---

## 🚨 КРИТИЧНІ НОТАТКИ

### Дотримання DDR принципів

✅ **ContactAccess ≠ Chat**
- Chat перевіряє тільки факт `hasContactAccess`
- НЕ читає `access_level` semantics

✅ **ensureThread викликається on ACTION**
- НЕ автоматично після unlock
- Тільки при натисканні кнопки чату

✅ **Store cache ≠ SSOT**
- `threadsByStudent` = навігаційний кеш
- Завжди верифікуємо через backend

✅ **Revoke → Chat disable**
- `removeThread(studentId)` очищає кеш
- Кнопка стає disabled

---

## 📝 ФАЙЛИ СТВОРЕНІ/ОНОВЛЕНІ

### Backend
1. `apps/chat/models.py` - розширено ChatThread
2. `apps/chat/migrations/0006_add_contact_thread_support.py` - міграція
3. `apps/chat/api_chat_views.py` - додано _create_contact_thread
4. `apps/chat/api_serializers.py` - розширено serializers
5. `apps/chat/api_unread_summary.py` - новий endpoint
6. `apps/chat/urls_chat.py` - додано route
7. `apps/chat/tests/test_contact_threads.py` - 12 тестів
8. `docs/Domian_BE/14_Chat/API_ENDPOINTS.md` - оновлено

### Frontend
9. `src/stores/chatThreadsStore.js` - новий store
10. `src/stores/contactAccessStore.js` - додано canOpenChat
11. `docs/Domian_FE/14_Chat/PLAN_CONTACT_CHAT_ENTRY.md` - план
12. `docs/Domian_FE/14_Chat/CONTACT_CHAT_PROGRESS_REPORT.md` - цей звіт

---

**Готовність до продовження:** ✅ Backend foundation готовий, можна продовжувати UI реалізацію.

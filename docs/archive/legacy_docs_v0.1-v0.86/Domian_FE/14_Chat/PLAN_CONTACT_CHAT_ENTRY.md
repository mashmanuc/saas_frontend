# PLAN: Contact → Chat Entry & Notifications

**Дата:** 2026-02-04  
**Домени:** Contact Access (SSOT), Chat (Negotiation), Dashboard Tutor/Student  
**Статус:** Draft v1 (узгоджений scope, готовий до реалізації)

---

## 1. Контекст та залежності

- `ContactAccess` — єдиний домен, який знає, чи дозволено розкривати контактні дані студента.
- `NegotiationChat` — реалізовані smart polling, `is_read`, `mark-read`, UI компоненти (`NegotiationChatWindow`, `useChatPolling`).
- Текуща поведінка: чат відкривається тільки через active lesson (`getMessageAction`). Contact unlock не активує чат.
- Ціль: додати шлях «contact unlock → кнопка чату», notification bell з unread summary, симетрію для студента.

**DDR закони в силі:**
1. ContactAccess ≠ Chat (домени не змішуються).
2. Accept ≠ Unlock (навіть після accept чат не з’являється без unlock).
3. Unlock ≠ Auto Thread (thread створюється тільки коли користувач натискає кнопку чату).
4. Store cache ≠ SSOT (будь-який front-store = похідний стан; backend вирішує істину).

---

## 2. Contracts & Guards

| Правило | Опис / Enforcement |
|---------|--------------------|
| ContactAccess prerequisite | Чатова кнопка активується лише якщо `contactAccessStore.hasContactAccess(studentId) === true`. Access level **не** інтерпретується чатами. |
| Chat domain не читає ContactAccess semantics | Chat-store отримує тільки Boolean «доступ дозволено». Ніяких `CHAT_ENABLED/FULL_ACCESS` у Chat UI. |
| Thread creation on demand | `chatThreadsStore.ensureThread(studentId)` викликається тільки при першій спробі відкрити чат (кнопка/дзвіночок). Ніколи автоматично після unlock. |
| Cache invalidation | При перезавантаженні або race фронт завжди звертається до backend (`POST /chat/threads/negotiation/` або `GET /chat/threads/`) і оновлює кеш. |
| Revoke → Chat disable | Після `revokeContacts` фронт очищає кеш для студента і блокує кнопки чату. Якщо чат уже відкритий, показуємо state «Доступ закрито» та переводимо UI у read-only до моменту повторного unlock. |
| Notifications single source | Лічильник непрочитаних синхронізується через backend endpoint (не локальна евристика). |
| UI готовий до threadId === null | Будь-яка операція, що потребує threadId, перевіряє `getThreadIdByStudent` на `null` і повторно викликає backend ensure. `threadsByStudent` використовується лише як навігаційний кеш, не як доменна істина. |

---

## 3. Backend tasks (перевірка/розширення)

1. **Thread discovery API**
   - Підтвердити, що `POST /api/v1/chat/threads/negotiation/ { inquiry_id | relation_id }` ідемпотентний і не створює дублікатів.
   - Якщо потрібен прямий mapping studentId → threadId (без inquiry), додати `student_id` параметр (з guard-ами).

2. **Unread summary endpoint**
   - `GET /api/v1/chat/unread-summary/`
     ```json
     {
       "threads": [
         {
           "thread_id": "uuid",
           "student_id": 123,
           "student_name": "...",
           "last_message_preview": "...",
           "last_message_at": "ISO",
           "unread_count": 2
         }
       ],
       "total": 5
     }
     ```
   - Фільтрація за роллю: tutor бачить свої, студент — свої.

3. **Mark read consistency**
   - `POST /chat/threads/{id}/mark-read/` має підтримувати масові виклики без race (вже готово, просто зафіксувати в документації flow).

4. **Events / observability (опційно)**
   - Логувати `thread_created`, `chat_opened`, `notifications_viewed` (не обов’язково на першому етапі, але бажано для аналітики).

---

## 4. Frontend state (Pinia)

### 4.1 `chatThreadsStore` (новий)

- **State:**
  - `threadsByStudent = Map<studentId, ChatThreadMeta>`
  - `unreadSummary = { total, items: [] }`
  - `loading`, `error`

- **Actions:**
  - `ensureThread(studentId)` → дергає backend для створення/отримання thread, зберігає `threadId` в `threadsByStudent`.
  - `fetchUnreadSummary()` → `GET /chat/unread-summary/`, оновлює `unreadSummary` і badge’и для студентів.
  - `markThreadRead(threadId)` → викликає API, обнуляє локальний `unread_count`.
  - `syncThreads()` → при перезавантаженні сторінки (optional idle job) підтягує метадані.

- **Getters:**
  - `getThreadIdByStudent(studentId)`
  - `getUnreadCount(studentId)`
  - `totalUnread`

> **Правило:** store кеш = похідний стан; без backend call не робимо припущень.
>
> **Додатково:** будь-яка UI-логіка має бути готова до `threadId === null`. Якщо кешу немає або він застарів, діємо як вперше (викликаємо ensure/loader).

### 4.2 Використання Contact Access у Chat UI

- У `useChatAccess`/`contactAccessStore`: додати helper `canOpenChat(studentId)` (просто `hasContactAccess`).
- Кнопки чату рендеряться тільки якщо `canOpenChat` true. Якщо false — disabled + tooltip “Спершу відкрийте контакти”.

---

## 5. UI Integration

### 5.1 Dashboard Tutor (relations list)

1. **Кнопка “Чат зі студентом”**
   - Розміщення: поруч із «Створити урок» (div `.flex gap-2`).
   - States:
     - `Disabled`, якщо `contactAccessStore.hasContactAccess === false`.
     - `Loading`, якщо ensureThread в процесі.
     - `Active`, якщо thread існує → натискання веде на `router.push(/chat/student/:studentId)`.
   - Label: `t('dashboard.tutor.cta.chatWithStudent')`.
   - Badge: показувати `chatThreadsStore.getUnreadCount(studentId)` (якщо >0).

2. **Student-facing UI**
   - Аналогічна кнопка «Чат з тьютором» у `DashboardStudent` (або модулі inquiries). Ті самі guards.

3. **Route / Page**
   - Новий маршрут `src/modules/chat/views/TutorStudentChat.vue` (або використати `NegotiationChatWindow` у модальному режимі).
   - Пропси: `studentId`, `threadId`, `studentName`.
   - Поведінка:
     - `onMounted` → `chatThreadsStore.ensureThread(studentId)` (якщо ще немає).
     - Після отримання threadId → `<NegotiationChatWindow :thread-id="threadId" ... />`.
     - `onFocus/inView` → `markThreadRead`.

### 5.2 “Чат” у дзвіночку (header)

- Компонент `ChatNotificationsBell`:
  - Підписаний на `chatThreadsStore.totalUnread`.
  - Polls `fetchUnreadSummary()` за тим самим smart rule (visible → 3s, hidden →15s).
  - Dropdown:
    - Список `unreadSummary.items` (ім’я студента, preview, time, badge).
    - Клік → `router.push(/chat/student/:studentId)` (викликає ensureThread, якщо потрібно).
  - Empty state: “Непрочитаних повідомлень немає”.

> **View-only природа unread-summary:** endpoint використовується лише для відображення лічильників/preview. Він **не** виступає джерелом правди для стану thread чи доступів. Усі операції створення/валидації thread ідуть через базові `/chat/threads/...` API.

### 5.3 ContactUnlock → Chat CTA

- У компоненті `StudentContactUnlock` (або поруч) після успішного unlock показати інформативний блок: “Контакти відкрито — тепер доступний чат”.
- Але **не** викликати `ensureThread` автоматично. Просто підсвітити кнопку чату поруч.

---

## 6. Тестування

### 6.1 Unit / Store tests
- `chatThreadsStore.spec.ts` (ensureThread idempotency, unread summary merge, markThreadRead).
- Update `contactAccessStore` тестів (canOpenChat helper).

### 6.2 Component tests
- `DashboardTutor.spec.ts`: перевірити states кнопки (locked → disabled, unlocked → enabled, unread badge).
- `ChatNotificationsBell.spec.ts`: симулювати fetchUnreadSummary, клік по item.

### 6.3 E2E сценарії
1. Tutor приймає relation → unlock контакти → кнопка чату активується → відкриваємо → відправляємо повідомлення.
2. Студент пише повідомлення → тьютор бачить bell=1, клік → список, відкриває чат → badge зникає.
3. Revoke контактів → кнопка чату пропадає / disabled, чат не відкривається.

---

## 7. Rollout & Observability

- Feature flag (frontend): `enableContactChatEntry`. Спочатку rolling out обмеженій групі.
- Логування ключових подій (через існуючий аналітичний шар):
  - `contact_chat_button_shown`
  - `chat_thread_ensured`
  - `chat_opened_from_relation`
  - `chat_notifications_viewed`
- Моніторинг backend: кількість thread’ів, середня кількість unread.

---

## 8. To-do Checklist (узгоджений scope)

1. **Backend**
   - [ ] Перевірити/розширити `POST /chat/threads/negotiation/` для studentId.
   - [ ] Додати `GET /chat/unread-summary/`.
   - [ ] Оновити документацію (API_ENDPOINTS.md).

2. **Frontend State**
   - [ ] Створити `chatThreadsStore` (Pinia) + тести.
   - [ ] Додати helper `canOpenChat` у Contact Access layer.

3. **UI / UX**
   - [ ] Оновити `DashboardTutor.vue` (кнопка, badge, guard).
   - [ ] Оновити student UI (симетрична кнопка).
   - [ ] Додати `ChatNotificationsBell` + dropdown.
   - [ ] Підключити `NegotiationChatWindow` як standalone route.

4. **Tests & Monitoring**
   - [ ] Unit/Component/E2E тести (перелік вище).
   - [ ] Feature flag + rollout план.
   - [ ] Аналітика/логування подій.

---

**Готово до реалізації.** Усі критичні місця помічені, контракт між доменами зафіксовано. Наступний крок — імплементація згідно з checklist.

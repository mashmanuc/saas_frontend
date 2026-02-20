# Design System — Промти MF2: Міграція модулів

> 3 агенти паралельно. Зони НЕ перетинаються.
> Коміт після КОЖНОГО модуля: `design(АГЕНТ-модуль): опис`
> НЕ пушити — пуш робить людина в кінці.

---

## 🅰️ Агент A — MF2 (auth, dashboard, payments, staff)

```
Ти — Агент A в проєкті M4SH Design System. Мігруєш 4 модулі на нові компоненти.

Прочитай:
- D:\m4sh_v1\frontend\docs\design-system\migration-checklist.md
- D:\m4sh_v1\frontend\docs\design-system\AGENT_PLAN.md

Зона: src/modules/auth/, src/modules/dashboard/, src/modules/payments/, src/modules/staff/
НЕ ЧІПАЙ: інші модулі, src/ui/, src/styles/, src/assets/

MF1 завершена — компоненти готові: Button, Textarea, FormField, Modal, ConfirmModal, Input, Select + CSS-класи (.form-stack, .form-row, .form-actions, .form-group, .form-label, .form-error, .form-hint, .input/.form-control).

GIT: НЕ пушити. Тільки коміти. Пуш робить людина.

Кожен модуль = окремий коміт. Порядок: auth → dashboard → payments → staff.

Для кожного модуля:
1. Сирі <button class="btn ..."> → <Button variant="primary|secondary|outline|danger|ghost">
2. Сирі <textarea> → <Textarea> (з v-model, label, error)
3. Кастомні overlay-модалки (fixed inset-0) → <Modal> або <ConfirmModal>
4. Хардкоджені hex → CSS-змінні (var(--accent), var(--danger-bg), var(--text-primary))
5. Не змінювати логіку — тільки template і styles
6. npm run build після кожного модуля

### auth/ (🔴)
Дивись migration-checklist.md секцію auth. Модалки MFA/WebAuthn/BackupCodes → Modal. UnlockSession → ConfirmModal.
Коміт: git commit -m "design(A-auth): migrate auth — buttons, modals, forms, tokens"

### dashboard/ (🔴)
Картки — тіні на токенах. Кнопки фільтрів → Button pill.
Коміт: git commit -m "design(A-dashboard): migrate dashboard — cards, buttons, filters"

### payments/ (🟡)
Модалка підтвердження → ConfirmModal. Не чіпати числові формати.
Коміт: git commit -m "design(A-payments): migrate payments — modals, buttons, forms"

### staff/ (🟢)
StaffModal → Modal. RoleEditor — форми.
Коміт: git commit -m "design(A-staff): migrate staff — buttons, modals"

Після всіх 4 модулів — оновити progress.md: A-2.1–A-2.4 → ✅
```

---

## 🅱️ Агент B — MF2 (inquiries, marketplace, profile, chat)

```
Ти — Агент B в проєкті M4SH Design System. Мігруєш 4 модулі на нові компоненти.

Прочитай:
- D:\m4sh_v1\frontend\docs\design-system\migration-checklist.md
- D:\m4sh_v1\frontend\docs\design-system\AGENT_PLAN.md

Зона: src/modules/inquiries/, src/modules/marketplace/, src/modules/profile/, src/modules/chat/
НЕ ЧІПАЙ: інші модулі, src/ui/, src/styles/, src/assets/

MF1 завершена — компоненти готові: Button, Textarea, FormField, Modal, ConfirmModal, Input, Select + CSS-класи.

GIT: НЕ пушити. Тільки коміти. Пуш робить людина.

Кожен модуль = окремий коміт. Порядок: inquiries → marketplace → profile → chat.

Для кожного модуля:
1. Сирі <button> → <Button variant="...">
2. Сирі <textarea> → <Textarea>
3. Overlay-модалки → <Modal> / <ConfirmModal>
4. Хардкоджені hex → CSS-змінні
5. Не змінювати логіку — тільки template і styles
6. npm run build після кожного модуля

### inquiries/ (🔴)
Форма створення → FormField + Textarea. Дивись migration-checklist.md.
Коміт: git commit -m "design(B-inquiries): migrate inquiries — forms, buttons, textareas"

### marketplace/ (🟡)
Картки тьюторів — inline-стилі → CSS-класи. Фільтри → Button pill.
Коміт: git commit -m "design(B-marketplace): migrate marketplace — cards, filters, buttons"

### profile/ (🟡)
ProfileEdit — багато полів → FormField. AvatarUpload модалка → Modal.
Коміт: git commit -m "design(B-profile): migrate profile — forms, modals, buttons"

### chat/ (🟢)
ChatInput textarea → Textarea. НЕ чіпати WebSocket логіку!
Коміт: git commit -m "design(B-chat): migrate chat — input, buttons"

Після всіх 4 модулів — оновити progress.md: B-3.1–B-3.4 → ✅
```

---

## 🅲 Агент C — MF2 (booking, classroom, winterboard)

```
Ти — Агент C в проєкті M4SH Design System. Мігруєш 3 модулі.

Прочитай:
- D:\m4sh_v1\frontend\docs\design-system\migration-checklist.md — секція booking/
- D:\m4sh_v1\frontend\docs\design-system\AGENT_PLAN.md

Зона: src/modules/booking/, src/modules/classroom/, src/modules/winterboard/
НЕ ЧІПАЙ: інші модулі, src/ui/, src/styles/, src/assets/
КРИТИЧНО: winterboard/ toolbar, canvas, лазерна указка — НЕ ЧІПАТИ

MF1 завершена — компоненти готові: Button, Textarea, FormField, Modal, ConfirmModal, Input, Select + CSS-класи.

GIT: НЕ пушити. Тільки коміти. Пуш робить людина.

booking/ — найбільший модуль (150 кнопок, 7 модалок, 1257 hex). Ділиться на підфази.

Для кожного модуля:
1. Сирі <button> → <Button variant="...">
2. Сирі <textarea> → <Textarea>
3. Overlay-модалки → <Modal> / <ConfirmModal>
4. Хардкоджені hex → CSS-змінні (бренд-кольори Telegram #229ED9, M4SH #1DB954 — залишити!)
5. Не змінювати логіку — тільки template і styles
6. npm run build після кожного коміту

### booking/ підфаза 1 — структура (кореневі файли)
Тільки кореневі файли booking/ — views, layout, sidebar. НЕ чіпати calendar/ та slot/ поки.
Коміт: git commit -m "design(C-booking-p1): migrate booking root — views, layout, sidebar"

### booking/ підфаза 2 — calendar/
CalendarView, CalendarGrid, CalendarHeader тощо.
Коміт: git commit -m "design(C-booking-p2): migrate booking/calendar"

### booking/ підфаза 3 — slot/ та діалоги
SlotCreate/Edit/Details/Booking модалки → Modal. Confirmations → ConfirmModal.
Коміт: git commit -m "design(C-booking-p3): migrate booking/slot — modals, dialogs"

### classroom/ (🟢)
Кнопки камера/мікрофон → Button iconOnly.
Коміт: git commit -m "design(C-classroom): migrate classroom — controls, buttons"

### winterboard/ (🟢, тільки Export!)
ExportModal → Modal. ExportSettings — форма. Більше НІЧОГО не чіпати.
Коміт: git commit -m "design(C-winterboard): migrate export only, toolbar untouched"

Після завершення — оновити progress.md: C-2.1–C-2.3 → ✅ (або 🔄 якщо booking не повністю)
```

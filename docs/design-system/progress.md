# Design System — Прогрес виконання

> Останнє оновлення: 2026-02-20
> Загальний статус: **MF3 ЗАВЕРШЕНО → MF4 полірування**
> Режим: **3 агенти паралельно** (див. `AGENT_PLAN.md`)

**Легенда:** ⬜ Не розпочато | 🔄 В процесі | ✅ Завершено | ⏸️ Призупинено | ❌ Заблоковано

---

## Загальний прогрес по мегафазах

| MF | Назва | Агенти | Статус | Дата початку | Дата завершення |
|----|-------|--------|--------|-------------|----------------|
| 0 | Фундамент (токени) | A соло | ✅ | 2026-02-20 | 2026-02-20 |
| 1 | Компоненти + CSS | A ║ B ║ C | ✅ | 2026-02-20 | 2026-02-20 |
| 2 | Міграція модулів | A ║ B ║ C | ✅ | 2026-02-20 | 2026-02-20 |
| 2.5 | Добивання хвостів MF2 | A ║ B ║ C | ✅ | 2026-02-20 | 2026-02-20 |
| 3 | Очищення + QA | A ║ B ║ C | ✅ | 2026-02-20 | 2026-02-20 |
| 4 | Полірування + ThemeStore | A ║ B ║ C | ✅ | 2026-02-20 | 2026-02-20 |
| 5 | Button self-contained + дублікати | A → A ║ B → C | ✅ | 2026-02-20 | 2026-02-20 |
| 6 | Фінальне очищення: залишки + токенізація | A ║ B → C | ⬜ | — | — |

---

## MF0 — Фундамент (Агент A соло)

| # | Задача | Статус | Коміт | Примітки |
|---|--------|--------|-------|----------|
| 0.1 | Створити `src/styles/tokens.css` | ✅ | design(A-0) | Єдині токени: radius, spacing, typography, shadows, z-index, transitions, overlay |
| 0.2 | Підключити в `main.js` першим імпортом | ✅ | design(A-0) | Першим серед CSS-імпортів |
| 0.3 | Позначити старі файли `@deprecated` | ✅ | design(A-0) | `ui/tokens.css` + `ui-contract/tokens/tokens.css` |
| 0.4 | Синхронізувати `tailwind.config.js` | ✅ | design(A-0) | borderRadius + zIndex через CSS vars |
| ✓ | **Checkpoint:** build OK, токени доступні | ✅ | — | `npm run build` — OK |

---

## MF1 — Компоненти + CSS

### Агент A — CSS-класи для форм

| # | Задача | Статус | Коміт | Примітки |
|---|--------|--------|-------|----------|
| A-1.1 | `.form-stack`, `.form-row`, `.form-actions` | ✅ | design(A-1) | Layout класи з токенами, responsive .form-row |
| A-1.2 | Уніфікувати `.input` / `.form-control` | ✅ | design(A-1) | Хардкод → токени, .form-control як аліас |
| A-1.3 | `.form-label`, `.form-error`, `.form-hint` | ✅ | design(A-1) | Токени для розмірів та кольорів |
| A-1.4 | Глобальний `.form-group` | ✅ | design(A-1) | Backward-compatible, 214 використань |

### Агент B — UI-компоненти

| # | Задача | Статус | Коміт | Примітки |
|---|--------|--------|-------|----------|
| B-1.1 | Оновити `Button.vue` (pill, iconOnly, fullWidth) | ✅ | design(B-1.1) | pill, iconOnly, fullWidth props + scoped CSS |
| B-1.2 | Створити `Textarea.vue` | ✅ | design(B-1.2) | v-model, maxlength counter, error/help, design tokens |
| B-1.3 | Створити `FormField.vue` | ✅ | design(B-1.3) | Wrapper з label/error/hint слотами |
| B-1.4 | Оновити `Input.vue` на токени | ✅ | design(B-1.4) | Tailwind → .form-field__label/error/hint |
| B-1.5 | Оновити `Select.vue` на токени | ✅ | design(B-1.5) | Хардкод → токени, focus state |
| B-2.1 | Створити `Modal.vue` (teleport, focus trap, a11y) | ✅ | design(B-2.1) | Teleport, focus trap, Esc, body scroll lock, animations, a11y |
| B-2.2 | Створити `ConfirmModal.vue` | ✅ | design(B-2.2) | Обгортка Modal, primary/danger, loading |

### Агент C — Аудит і підготовка

| # | Задача | Статус | Коміт | Примітки |
|---|--------|--------|-------|----------|
| C-1.1 | Аудит сирих `<button>` по модулях | ✅ | design(C-1) | 120 сирих, 58 `<Button>` |
| C-1.2 | Аудит кастомних overlay-модалок | ✅ | design(C-1) | 48 файлів (42 реальних модалки) |
| C-1.3 | Аудит хардкоджених кольорів | ✅ | design(C-1) | 2941 hex (≈20% реальних хардкодів) |
| C-1.4 | Чеклист міграції для кожного модуля | ✅ | design(C-1) | `migration-checklist.md` |

---

## MF2 — Міграція модулів

### Агент A — Група 1

| # | Модуль | Кнопок | Модалок | Статус | Коміт | Примітки |
|---|--------|--------|---------|--------|-------|----------|
| A-2.1 | `auth/` | ~30 | 4 | ✅ | 0cc5600 | Modal+Button+tokens |
| A-2.2 | `dashboard/` | ~20 | 0 | ✅ | 0dacba8 | cards, buttons, filters, tokens |
| A-2.3 | `payments/` | ~10 | 2 | ✅ | 52688af | CancelModal→Modal, buttons→Button, tokens |
| A-2.4 | `staff/` | ~30 | 3 | ✅ | 3cb692c | modals, buttons, layouts, tokens |

### Агент B — Група 2

| # | Модуль | Кнопок | Модалок | Статус | Коміт | Примітки |
|---|--------|--------|---------|--------|-------|----------|
| B-3.1 | `inquiries/` | ~15 | 3 | ✅ | 0cc5600 | buttons→Button, hex→tokens |
| B-3.2 | `marketplace/` | ~40 | 5 | ✅ | fdb9931 | 8 modals: action buttons→Button, hex→tokens |
| B-3.3 | `profile/` | ~25 | 2 | ✅ | ff1de05 | draft dialog→Modal, already had Button |
| B-3.4 | `chat/` | ~20 | 2 | ✅ | 2cc91a8 | ErrorBoundary→Button, hex→CSS vars (no WS) |

### Агент C — Група 3

| # | Модуль | Кнопок | Модалок | Статус | Коміт | Примітки |
|---|--------|--------|---------|--------|-------|----------|
| C-2.1 | `booking/` | ~150 | 7 | ✅ | design(C-booking-p3) | P1 views+root, P2 calendar, P3 modals/availability/links/settings/analytics |
| C-2.2 | `classroom/` | ~15 | 2 | ✅ | design(C-classroom) | HistoryModal→Modal, buttons→Button |
| C-2.3 | `winterboard/` | ~100 | 1 | ✅ | design(C-winterboard) | WBExportDialog→Modal+Button, toolbar untouched |

---

## MF2.5 — Добивання хвостів

### Агент B — Малі модулі

| # | Модуль | Що зроблено | Статус | Коміт | Примітки |
|---|--------|-------------|--------|-------|----------|
| B-5.1 | `matches/` | buttons→Button, BookingModal overlay→Modal+Textarea | ✅ | f3fbef7 | AvailabilityEditor, BookingModal, MatchDetail |
| B-5.2 | `people/` | CreateInquiryModal overlay→Modal+Textarea+Button | ✅ | f3fbef7 | hex→CSS vars |
| B-5.3 | `trust/` | buttons→Button, textarea→Textarea | ✅ | f3fbef7 | BlockUser, Report, BlockedUsers, Appeals |
| B-5.4 | `contacts/` | buttons→Button, textarea→Textarea | ✅ | f3fbef7 | PurchaseTokens, TokenGrant, ContactBalance |
| B-5.5 | `classrooms/` | InviteStudentModal overlay→Modal | ✅ | f3fbef7 | Already had Button |
| B-5.6 | `admin/` | AdminArchiveUserModal overlay→Modal+Textarea | ✅ | b43085b | Already had Button |
| B-5.7 | `student/` | MyTutorWidget buttons→Button | ✅ | b43085b | 3 raw buttons replaced |
| B-5.8 | `tutors/` | TutorAnalyticsView retry→Button, hex→CSS vars | ✅ | b43085b | ~25 hex colors replaced |
| B-5.9 | `call/` | — | ✅ | — | Call UI controls, not standard buttons |
| B-5.10 | `negotiation/` | — | ✅ | — | Already uses Button from @/ui |
| B-5.11 | `profileV2/` | — | ✅ | — | Already uses ui-contract (Button, Modal, FormField) |
| B-5.12 | `tutor/` | — | ✅ | — | TutorSearchView already uses Button |

### Агент A — Залишкові модулі

| # | Модуль | Що зроблено | Статус | Коміт | Примітки |
|---|--------|-------------|--------|-------|----------|
| A-5.1 | `reviews/` | buttons→Button, textarea→Textarea, overlay→Modal, hex→tokens | ✅ | 27c9908..96c10bb | ~44 buttons, ~4 textarea, ~35 hex |
| A-5.2 | `billing/` | buttons→Button, overlay→Modal, hex→tokens | ✅ | 96c10bb | CheckoutLockedAlert, UpgradeCTA, SubscriptionRequiredModal/Banner |
| A-5.3 | `onboarding/` | buttons→Button, overlay→Modal | ✅ | 34a8f81 | 9 files, ~25 raw buttons replaced |
| A-5.4 | `lessons/` | buttons→Button, overlay→Modal, hex→tokens | ✅ | 839a25f | LessonList create/cancel modals, LessonView retry+hex |
| A-5.5 | `entitlements/` | buttons→Button | ✅ | 6221a59 | FeatureGate, GraceBanner, PlanFeaturesView |
| A-5.6 | `diagnostics/` | buttons→Button | ✅ | 6221a59 | DiagnosticsPanel clear/close |

### Агент C — Залишкові модулі booking/

| # | Модуль | Що зроблено | Статус | Коміт | Примітки |
|---|--------|-------------|--------|-------|----------|
| C-5.1 | `booking/availability` | raw buttons, textareas→Button, Textarea | ✅ | 4ebc008 | |
| C-5.2 | `booking/modals` | raw buttons, textareas→Button, Textarea | ✅ | 27c9908 | |
| C-5.3 | `booking/calendar` | raw buttons→Button | ✅ | 3cca033 | |
| C-5.4 | `booking/common+SlotPicker` | raw buttons→Button | ✅ | e35b475 | |
| C-5.5 | `marketplace/` | raw buttons, close-btns→Button | ✅ | 6221a59 | |

---

## MF3 — Очищення + QA

> Промти: `PROMPTS_MF3.md`

### Агент A — Очищення CSS

| # | Задача | Статус | Коміт | Примітки |
|---|--------|--------|-------|----------|
| A-3.1 | Консолідація `m4sh.css` → `tokens.css` | ✅ | 59d63aa | --font-serif, --leading-*, --text-display/title додано; дублі spacing/radius/transition видалено |
| A-3.2 | Видалити `src/ui/tokens.css` | ✅ | 17f434f | Аліаси перенесено в tokens.css, файл видалено, style.css оновлено |
| A-3.3 | Видалити `src/assets2/ui-contract/tokens/tokens.css` | ✅ | 25299fe | 289 --ui-* аліасів перенесено в tokens.css, import з main.js видалено |
| A-3.4 | Позначити `.btn-*` в `main.css` як @deprecated | ✅ | 1a5bb4a | Коментар @deprecated додано, чекає B-4.0 для видалення |
| A-3.5 | Фінальний аудит hex в CSS файлах | ✅ | b43e3c3 | .btn-soft/.btn-white #fff→var(--card-bg); theme defs + brand hex залишені |
| A-3.6 | Sync `tailwind.config.js` з `tokens.css` | ✅ | — | Вже синхронізовано: borderRadius, zIndex, colors, boxShadow |
| A-3.7 | Видалити `.btn-*` з `main.css` | ✅ | — | 0 залежностей від глобального .btn, весь блок видалено |

### Агент B — Масова заміна btn→Button + очищення компонентів

| # | Задача | Статус | Коміт | Примітки |
|---|--------|--------|-------|----------|
| B-4.0 | `class="btn"` → `<Button>` в marketplace/ (18 файлів) | ✅ | B | Агент B |
| B-4.0b | `class="btn"` → `<Button>` в booking+classroom+board+operator (12 файлів) | ✅ | B | Агент B |
| B-4.0c | `class="btn btn-*"` залишки → scoped (11 файлів: router-link/a/label) | ✅ | — | Координатор: link-primary/link-ghost/label-secondary scoped |
| B-4.1 | Замінити `components/ui/Modal` → `@/ui/Modal` (6 файлів) | ✅ | B | Агент B |
| B-4.2 | Замінити `ConfirmDialog` → `@/ui/ConfirmModal` (2 файли) | ✅ | B | Агент B |
| B-4.3 | Видалити `components/ui/Modal.vue` + `ConfirmDialog.vue` | ✅ | — | 0 імпортів, файли видалено |

### Агент C — QA

| # | Перевірка | Light | Dark | Classic |
|---|-----------|-------|------|---------|
| C-3.0 | Фінальний аудит метрик | ✅ | ✅ | ✅ |
| C-3.1 | Кнопки (всі варіанти) | ✅ | ✅ | ✅ |
| C-3.2 | Модалки (backdrop, focus trap, Esc) | ⚠️ | ⚠️ | ⚠️ |
| C-3.3 | Форми (focus, error, disabled) | ✅ | ✅ | ✅ |
| C-3.4 | Картки (border, shadow) | ✅ | ✅ | ✅ |
| C-3.5 | Mobile (375px) | ✅ | ✅ | ✅ |
| C-3.6 | Tablet (768px) | ✅ | — | — |
| C-3.7 | Desktop (1280px) | ✅ | ✅ | ✅ |
| C-3.8 | Accessibility | ✅ | ✅ | ✅ |
| C-3.9 | Фінальний звіт `MF3_QA_REPORT.md` | ✅ | ✅ | ✅ |

---

## Метрики

| Метрика | Початок | Після MF2.5 | Після MF3/A | Ціль |
|---------|---------|-------------|-------------|------|
| Файлів з сирими `<button>` | 856 | ~95 | **211** | < 50 |
| Файлів з сирими `<textarea>` | 20+ | 20+ | **2** | 0 |
| Overlay-модалки (`fixed inset-0`) | 63 | ~43 | **2** (chat, profile) | 0 |
| Файлів токенів | 5 | 5 | **1** (tokens.css SSOT) ✅ | 1 |
| `class="btn"` в модулях | ? | ? | **3** (board, trust) | < 15 ✅ |
| Hex в CSS (`src/styles/`, `src/assets/`) | ~30 | ~2500 | **132** | < 20 |
| Імпорти `components/ui/Modal` | ? | ? | **0** ✅ | 0 |
| Імпорти `ConfirmDialog` (старий) | ? | ? | **0** ✅ (2 файли = аліас на @/ui/ConfirmModal) | 0 |
| `src/ui/tokens.css` | існує | існує | **видалено** ✅ | видалено |
| `src/assets2/ui-contract/tokens/tokens.css` | існує | існує | **видалено** ✅ | видалено |
| `npm run build` | OK | OK | **OK** ✅ | OK |

### C-3.0 Аналіз: 211 файлів з raw `<button>`

> Більшість — це form-specific UI (tabs, chips, filters, duration pickers, rating pills,
> accordion headers, slot buttons, canvas toolbar, chat inline, debug) які **свідомо НЕ мігруються**.
> Агент B (B-4.0–B-4.0e) ще працює над `class="btn"` → `<Button>` заміною.
> Після B-4.0 кількість зменшиться значно.

**Overlay-модалки (2):**
- `chat/ChatModal.vue` — chat-specific UI
- `profile/AccountDeletionModal.vue` — потребує міграції (B або A)

**`class="btn"` залишки (3):**
- `board/export/ExportModal.vue` — board UI
- `board/history/HistoryPanel.vue` — board UI
- `trust/TrustGuardBanner.vue` — потребує міграції (B-4.0e)

---

## Лог змін

| Дата | Що зроблено | Агент | Коміт |
|------|-------------|-------|-------|
| 2026-02-20 | Створено план і ТЗ | — | — |
| 2026-02-20 | Переробка на 3-агентний план (AGENT_PLAN.md) | — | — |
| 2026-02-20 | MF0 завершено: tokens.css, main.js, @deprecated, tailwind sync | A | design(A-0) |
| 2026-02-20 | C-1.1—C-1.4: аудит модулів (buttons, modals, colors) + migration-checklist.md | C | design(C-1) |
| 2026-02-20 | MF1/A завершено: form CSS classes, .input/.form-control уніфікація | A | design(A-1) |
| 2026-02-20 | B-1.1: Button.vue — pill, iconOnly, fullWidth props | B | design(B-1.1) |
| 2026-02-20 | B-1.2: Textarea.vue створено | B | design(B-1.2) |
| 2026-02-20 | B-1.3: FormField.vue створено | B | design(B-1.3) |
| 2026-02-20 | B-1.4: Input.vue оновлено на токени | B | design(B-1.4) |
| 2026-02-20 | B-1.5: Select.vue оновлено на токени | B | design(B-1.5) |
| 2026-02-20 | B-2.1: Modal.vue створено (focus trap, a11y, animations) | B | design(B-2.1) |
| 2026-02-20 | B-2.2: ConfirmModal.vue створено | B | design(B-2.2) |
| 2026-02-20 | **MF1/B ЗАВЕРШЕНО** — build OK | B | — |
| 2026-02-20 | C-2.1/P1: booking/ root views + components — buttons→Button, modals→Modal, hex→CSS vars | C | design(C-booking-p1) |
| 2026-02-20 | C-2.2: classroom/ — HistoryModal→Modal, SessionEnded/WaitingRoom/ReconnectOverlay buttons→Button | C | design(C-classroom) |
| 2026-02-20 | C-2.3: winterboard/ — WBExportDialog overlay→Modal, action-btn→Button, hex→CSS vars | C | design(C-winterboard) |
| 2026-02-20 | B-3.1: inquiries/ — buttons→Button, Modal for contacts, hex→tokens | B | 0cc5600 |
| 2026-02-20 | B-3.2: marketplace/ — 8 modals action buttons→Button, conflict-banner hex→tokens | B | fdb9931 |
| 2026-02-20 | B-3.3: profile/ — draft dialog→Modal component | B | ff1de05 |
| 2026-02-20 | B-3.4: chat/ — ErrorBoundary buttons→Button, hex→CSS vars (no WS changes) | B | 2cc91a8 |
| 2026-02-20 | **MF2/B ЗАВЕРШЕНО** — all 4 modules migrated, build OK | B | — |
| 2026-02-20 | C-2.1/P2: booking/calendar — CalendarHeader(V2), CalendarFooter, CalendarWeekView hex→CSS vars | C | design(C-booking-p2) |
| 2026-02-20 | C-2.1/P3: hex→CSS vars — modals/ (Edit,Create,Event,ManualBooking,TemplateConfirm,JoinLessonPicker,EventDetails), availability/ (GenerationProgress,AvailabilityEditor,TemplateEditor), common/ (DraftToolbar,StudentAutocomplete), lessonLinks/, requests/, settings/, analytics/ | C | 3af8a86 |
| 2026-02-20 | C-2.1/P3: overlay→Modal — BookingRequestModal, TemplateConfirmModal, GenerationProgressModal | C | 85c3b6c |
| 2026-02-20 | C-2.1/P3: raw button→Button — EventModal, EditLessonModal, CreateLessonModal, BookingRequestModal, GenerationProgressModal, TemplateConfirmModal, LessonLinksEditor, BookingSettings, SlotAnalyticsDashboard | C | c51f9e5 |
| 2026-02-20 | **C-2.1 ЗАВЕРШЕНО** — booking/ повністю мігровано (3 підфази), build OK | C | — |
| 2026-02-20 | B-5.1–B-5.2: matches/ + people/ — buttons→Button, overlays→Modal, textarea→Textarea | B | f3fbef7 |
| 2026-02-20 | B-5.3–B-5.5: trust/ + contacts/ + classrooms/ — buttons→Button, textarea→Textarea, overlay→Modal | B | f3fbef7 |
| 2026-02-20 | B-5.6–B-5.8: admin/ + student/ + tutors/ — overlay→Modal, buttons→Button, hex→CSS vars | B | b43085b |
| 2026-02-20 | B-5.9–B-5.12: call/, negotiation/, profileV2/, tutor/ — already migrated, no changes needed | B | — |
| 2026-02-20 | **MF2.5/B ЗАВЕРШЕНО** — all 12 modules audited, 8 migrated, build OK | B | — |
| 2026-02-20 | A-5.1: reviews/ — buttons→Button, textarea→Textarea, overlay→Modal, hex→tokens | A | 96c10bb |
| 2026-02-20 | A-5.2: billing/ — buttons→Button, overlay→Modal, hex→tokens | A | 96c10bb |
| 2026-02-20 | A-5.3: onboarding/ — buttons→Button, overlay→Modal (9 files, ~25 buttons) | A | 34a8f81 |
| 2026-02-20 | A-5.4: lessons/ — buttons→Button, overlay→Modal, hex→tokens | A | 839a25f |
| 2026-02-20 | A-5.5–A-5.6: entitlements/ + diagnostics/ — buttons→Button | A | 6221a59 |
| 2026-02-20 | C-5.1–C-5.5: booking/ remaining + marketplace/ — raw buttons/textareas→Button/Textarea | C | 4ebc008..6221a59 |
| 2026-02-20 | **MF2.5/A ЗАВЕРШЕНО** — all 6 modules migrated, build OK | A | — |
| 2026-02-20 | **MF2.5 ЗАВЕРШЕНО** — all agents done | — | — |
| 2026-02-20 | A-3.1: consolidate m4sh.css → tokens.css (--font-serif, --leading-*, --text-display/title; дублі видалено) | A | 59d63aa |
| 2026-02-20 | A-3.2: видалено src/ui/tokens.css, аліаси перенесено в tokens.css | A | 17f434f |
| 2026-02-20 | A-3.3: видалено assets2/ui-contract/tokens/tokens.css, 289 --ui-* аліасів перенесено | A | 25299fe |
| 2026-02-20 | A-3.4: .btn-* в main.css позначено @deprecated | A | 1a5bb4a |
| 2026-02-20 | A-3.5: фінальний аудит hex — .btn-soft/.btn-white #fff→var(--card-bg) | A | b43e3c3 |
| 2026-02-20 | A-3.6: tailwind.config.js вже синхронізовано з tokens.css | A | — |
| 2026-02-20 | **MF3/A ЗАВЕРШЕНО** (крім A-3.7 — чекає B-4.0) — build OK, 5→1 token files | A | — |
| 2026-02-20 | C-3.0: фінальний аудит метрик — 211 btn, 2 textarea, 2 overlay, 1 token, 0 old imports, build OK | C | bcc88c5 |
| 2026-02-20 | C-3.1–C-3.8: візуальне QA — тьютор m10@gmail.com, 8 вкладок × 3 теми × 3 breakpoints | C | — |
| 2026-02-20 | C-3.9: фінальний звіт MF3_QA_REPORT.md — PASS з зауваженнями | C | — |
| 2026-02-20 | **MF3/C ЗАВЕРШЕНО** — QA pass, звіт створено | C | — |
| 2026-02-20 | **MF3 ЗАВЕРШЕНО** — all agents done, Design System migration complete | — | — |
| 2026-02-20 | B-5: migrate last 3 btn remnants + AccountDeletionModal → @/ui/Modal | B | 3e90ac9 |
| 2026-02-20 | A-4: consolidate themeStore — single Pinia store, fix theme reset on navigation | A | — |
| 2026-02-20 | C-4.1: тема НЕ скидається при навігації — PASS (4 маршрути перевірено) | C | — |
| 2026-02-20 | C-4.2: ThemeSwitcher — всі 3 теми перемикаються коректно — PASS | C | — |
| 2026-02-20 | C-4.3: Modal.vue аудит — focus trap + Esc + backdrop + scroll lock — PASS | C | — |
| 2026-02-20 | C-4.4: AccountDeletionModal → @/ui/Modal.vue — PASS | C | — |
| 2026-02-20 | C-4.5: ExportModal — НЕ мігрована (board-specific, backlog) | C | — |
| 2026-02-20 | C-4.6: npm run build — OK (11.02s) | C | — |
| 2026-02-20 | C-4.7: MF4_QA_REPORT.md створено — PASS | C | — |
| 2026-02-20 | **MF4 ЗАВЕРШЕНО** — theme stable, modals verified, build OK | — | — |
| 2026-02-20 | B-6: remove 15 duplicated .btn scoped styles (booking + marketplace) | B | — |
| 2026-02-20 | C-5.1–C-5.4: Button QA — 5 variants × 3 themes × 3 sizes, responsive 375px — PASS | C | — |
| 2026-02-20 | C-5.5: booking модалки — 12 файлів очищені від .btn дублікатів, :deep(.btn) OK | C | — |
| 2026-02-20 | C-5.6: marketplace модалки — 4 файли очищені | C | — |
| 2026-02-20 | C-5.7: npm run build — OK (11.07s) | C | — |
| 2026-02-20 | C-5.8: MF5_QA_REPORT.md — PASS з зауваженнями (variant="destructive" баг, ~10 залишків) | C | — |
| 2026-02-20 | **MF5 ЗАВЕРШЕНО** — .btn SSOT in Button.vue, 16 files cleaned, build OK | — | — |

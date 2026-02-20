# Design System — Промти MF3: Очищення + QA

> MF0 ✅ → MF1 ✅ → MF2 ✅ → MF2.5 ✅ → **MF3 (фінал)**
> 3 агенти паралельно. Зони НЕ перетинаються.
> Коміт після КОЖНОГО логічного блоку: `design(АГЕНТ-задача): опис`
> НЕ пушити — пуш робить людина.

---

## Контекст після MF2.5

Що зроблено:
- `src/styles/tokens.css` — SSOT токени (radius, spacing, typography, shadows, z-index, transitions, overlay)
- `src/ui/Button.vue` — variant: primary, secondary, outline, danger, ghost; props: pill, iconOnly, fullWidth, size
- `src/ui/Modal.vue` — teleport, focus trap, a11y, persistent
- `src/ui/ConfirmModal.vue` — обгортка Modal для підтверджень
- `src/ui/Textarea.vue` — v-model, maxlength, error, help
- `src/ui/Input.vue`, `src/ui/Select.vue`, `src/ui/FormField.vue` — форм-елементи
- Більшість модулів мігровані на нові компоненти

Що залишилось (проблеми):
1. **106 файлів** ще використовують `class="btn ..."` (старий CSS-клас з `main.css`) замість `<Button>`
2. **Дублювання токенів** — `m4sh.css`, `src/ui/tokens.css`, `src/assets2/ui-contract/tokens/tokens.css` дублюють `src/styles/tokens.css`
3. **Старий `components/ui/Modal.vue`** — 6 файлів ще імпортують замість `@/ui/Modal.vue`
4. **Старий `components/common/ConfirmDialog.vue`** — 2 файли ще імпортують
5. **`.btn-*` стилі в `main.css`** — більше не потрібні (Button.vue має свої стилі)

---

## 🅰️ Агент A — MF3: Очищення CSS + масова заміна btn→Button

```
Ти — Агент A в проєкті M4SH Design System. Фінальна фаза — очищення CSS та масова заміна залишків.

Прочитай:
- D:\m4sh_v1\frontend\docs\design-system\AGENT_PLAN.md
- D:\m4sh_v1\frontend\src\styles\tokens.css — SSOT токени
- D:\m4sh_v1\frontend\src\styles\m4sh.css — дублює деякі токени
- D:\m4sh_v1\frontend\src\ui\tokens.css — старі токени (deprecated)
- D:\m4sh_v1\frontend\src\assets2\ui-contract\tokens\tokens.css — старі токени (deprecated)
- D:\m4sh_v1\frontend\src\assets\main.css — містить .btn-* стилі для видалення

Зона: src/styles/, src/assets/main.css, src/assets2/ui-contract/tokens/, src/ui/tokens.css, src/main.js, src/style.css, tailwind.config.js
НЕ ЧІПАЙ: src/ui/*.vue (компоненти), src/modules/ (модулі — це зона Агента B)

GIT: НЕ пушити. Тільки коміти. Пуш робить людина.

---

### A-3.1. Консолідація m4sh.css → tokens.css

m4sh.css визначає:
- --font-family-sans, --font-family-serif (tokens.css має --font-sans)
- --font-size-display, --font-size-title, --font-size-body, --font-size-caption (tokens.css має --text-xs..--text-2xl)
- --line-height-tight, --line-height-snug, --line-height-relaxed (tokens.css НЕ має — ДОДАТИ)
- --space-2xs..--space-xl (tokens.css вже має, РІЗНІ значення — tokens.css = SSOT)
- --radius-sm..--radius-xl (tokens.css вже має, РІЗНІ значення — tokens.css = SSOT)
- --transition-base, --transition-emphasized (tokens.css має --transition-fast/base/slow)

Задача:
1. Перенести з m4sh.css в tokens.css ТІЛЬКИ те, чого немає:
   - --font-family-serif
   - --line-height-tight, --line-height-snug, --line-height-relaxed
   - --font-size-display, --font-size-title (як alias: --text-display, --text-title)
2. НЕ переносити дублікати — tokens.css = SSOT
3. Залишити в m4sh.css ТІЛЬКИ:
   - body { ... } стилі
   - .headline-xl, .headline-lg, .text-muted, .text-subtle
   - .stack-xs, .stack-sm, .stack-md, .stack-lg
   - .surface-card, .badge-accent
   - Ці класи мають використовувати var() з tokens.css
4. Видалити з m4sh.css дублюючі :root { } змінні (radius, spacing, transitions)

Коміт: git commit -m "design(A-3.1): consolidate m4sh.css tokens → tokens.css"

### A-3.2. Видалити src/ui/tokens.css

Файл src/ui/tokens.css — deprecated. Імпортується в src/style.css:
  @import './ui/tokens.css';

Задача:
1. Перевірити чи всі змінні з ui/tokens.css вже є в src/styles/tokens.css
2. Якщо щось відсутнє — додати в tokens.css
3. Видалити рядок @import './ui/tokens.css'; з src/style.css
4. Видалити файл src/ui/tokens.css

Коміт: git commit -m "design(A-3.2): remove deprecated src/ui/tokens.css"

### A-3.3. Видалити src/assets2/ui-contract/tokens/tokens.css

Файл імпортується в src/main.js (рядок 10):
  import './assets2/ui-contract/tokens/tokens.css'

Задача:
1. Перевірити чи всі змінні з assets2/ui-contract/tokens/tokens.css вже є в src/styles/tokens.css
2. Якщо щось відсутнє — додати в tokens.css
3. Видалити рядок import з src/main.js
4. Оновити коментар в src/assets2/ui-contract/index.ts (рядок 2 — посилання на старий файл)
5. Видалити файл src/assets2/ui-contract/tokens/tokens.css

Коміт: git commit -m "design(A-3.3): remove deprecated assets2/ui-contract/tokens/tokens.css"

### A-3.4. Очистити main.css від .btn-* стилів

main.css містить стилі .btn, .btn-primary, .btn-secondary, .btn-outline, .btn-danger, .btn-ghost, .btn-soft, .btn-white (рядки ~175-268).

УВАГА: 106 файлів ще використовують class="btn ..." — тому НЕ ВИДАЛЯТИ одразу!

Задача:
1. Спочатку додай @deprecated коментар до .btn блоку:
   /* @deprecated — Use <Button variant="..."> from @/ui/Button.vue instead */
2. Залиш .btn стилі поки Агент B не замінить всі 106 файлів
3. Після підтвердження від Агента B — видалити весь .btn блок

Коміт: git commit -m "design(A-3.4): mark .btn CSS as deprecated in main.css"

### A-3.5. Фінальний аудит хардкоджених кольорів

Після завершення A-3.1—A-3.4:
1. Запусти: grep -rn '#[0-9a-fA-F]\{3,8\}' src/styles/ src/assets/main.css --include="*.css"
2. Заміни залишкові хардкоджені hex на var() де можливо
3. Залиш тільки:
   - rgba() значення (вже з opacity)
   - Brand hex (#229ED9 Telegram, #1DB954 M4SH)
   - Fallback значення в var(--token, #hex)

Коміт: git commit -m "design(A-3.5): final audit — hardcoded colors in CSS files"

### A-3.6. Перевірка tailwind.config.js

Переконайся що tailwind.config.js використовує CSS-змінні з tokens.css:
- borderRadius має посилатися на var(--radius-*)
- zIndex має посилатися на var(--z-*)
- Якщо ні — додати

Коміт: git commit -m "design(A-3.6): sync tailwind.config.js with tokens.css"

npm run build після КОЖНОГО коміту. Оновити progress.md.
```

---

## 🅱️ Агент B — MF3: Масова заміна class="btn" → <Button> + очищення старих компонентів

```
Ти — Агент B в проєкті M4SH Design System. Фінальна фаза — масова заміна залишків btn та очищення старих компонентів.

Прочитай:
- D:\m4sh_v1\frontend\docs\design-system\AGENT_PLAN.md
- D:\m4sh_v1\frontend\src\ui\Button.vue — variant: primary, secondary, outline, danger, ghost; props: pill, iconOnly, fullWidth, size

Зона: src/modules/, src/components/
НЕ ЧІПАЙ: src/styles/, src/assets/, src/ui/, tailwind.config.js, src/main.js

GIT: НЕ пушити. Тільки коміти. Пуш робить людина.

---

### B-4.0. Масова заміна class="btn ..." → <Button> (106 файлів!)

УВАГА: Це найбільша задача MF3. 106 файлів ще використовують class="btn btn-primary" тощо замість <Button variant="primary">.

Правила заміни:
- <button class="btn btn-primary"> → <Button variant="primary">
- <button class="btn btn-secondary"> → <Button variant="secondary">
- <button class="btn btn-outline"> → <Button variant="outline">
- <button class="btn btn-danger"> → <Button variant="danger">
- <button class="btn btn-ghost"> → <Button variant="ghost">
- <button class="btn btn-soft"> → <Button variant="outline"> (найближчий)
- <button class="btn btn-white"> → <Button variant="secondary"> (найближчий)
- <router-link class="btn btn-primary"> → залишити як є (router-link не є button)
- <a class="btn btn-primary"> → залишити як є (link не є button)

Для кожного файлу:
1. Замінити <button class="btn btn-VARIANT" ...> → <Button variant="VARIANT" ...>
2. Замінити </button> → </Button> (для замінених кнопок)
3. Додати import Button from '@/ui/Button.vue' (якщо ще немає)
4. Видалити локальні scoped .btn-* стилі якщо вони дублюють Button.vue
5. НЕ змінювати логіку — тільки template

НЕ МІГРУВАТИ (свідомо залишити class="btn"):
- booking/debug/ — dev-only компоненти (CalendarDebugPanel, LogsSection, MetadataSection, SnapshotSection)
- <router-link class="btn ..."> — це посилання, не кнопки
- <a class="btn ..."> — це посилання, не кнопки

Порядок міграції (по модулях, коміт на кожен):

1. marketplace/ (~30 файлів) — найбільший:
   MyProfileView (4), CertificationsEditor (3), SubjectTagsSelector (3), ProfileContact (3),
   TutorCatalogView (3), ProfileAnalyticsDashboard (2), CatalogFilterBar (2),
   CertificationsSection (2), EducationSection (2), LanguagesSection (2), TeachingLanguagesTab (2),
   ProfileHero (2), ProfileStickyBar (2), SearchResultsView (2), TutorCard (1),
   CreateProfilePrompt (1), ProfileEditor (1), SubjectsTab (1), TabbedCard (1),
   FeaturedTutorsSection (1), RecommendedTutorsWidget (1), DoubtCard (1), NewTutorCard (1),
   ProfileCtaStrip (1), SortDropdown (1), FilterChips (1), FilterSection (1),
   SearchFiltersModal (1), SearchBar (1), TutorProfileView (1), PublishGuardModal (1),
   TutorCalendarWidget (1)
   Коміт: git commit -m "design(B-4.0-marketplace): replace class=btn → <Button> in marketplace"

2. booking/ (~15 файлів, без debug/):
   CalendarHeaderV2 (1), MyLessonsView (1), BookingRequestsView (filter btns),
   та інші залишки
   Коміт: git commit -m "design(B-4.0-booking): replace class=btn → <Button> in booking"

3. classroom/ (~8 файлів):
   ClassroomBoard (1), LessonReplay (2), ReconnectView (2), LessonRoom (1),
   SnapshotViewer (2), LessonSummary (2), SnapshotExport (1)
   Коміт: git commit -m "design(B-4.0-classroom): replace class=btn → <Button> in classroom"

4. board/ (~7 файлів):
   ErrorBoundary (3), ExportModal (2), HistoryPanel (2), ZoomControls, ConflictIndicator,
   TemplateGallery, VideoOverlay, BoardView
   Коміт: git commit -m "design(B-4.0-board): replace class=btn → <Button> in board"

5. Інші модулі (inquiries, matches, operator, contacts, entitlements, auth, dashboard, payments, admin):
   По 1-3 файли кожен
   Коміт: git commit -m "design(B-4.0-misc): replace class=btn → <Button> in remaining modules"

npm run build після КОЖНОГО коміту.

### B-4.1. Замінити import components/ui/Modal.vue → @/ui/Modal.vue

6 файлів ще імпортують старий Modal:
- src/modules/trust/components/BlockUserModal.vue — import Modal from '@/components/ui/Modal.vue'
- src/modules/trust/components/ReportUserModal.vue — import Modal from '@/components/ui/Modal.vue'
- src/modules/trust/views/AppealsView.vue — import Modal from '@/components/ui/Modal.vue'
- src/modules/inquiries/components/SpamReportModal.vue — import Modal from '@/components/ui/Modal.vue'
- src/modules/contacts/components/PurchaseTokensModal.vue — import Modal from '@/components/ui/Modal.vue'
- src/modules/contacts/components/TokenGrantModal.vue — import Modal from '@/components/ui/Modal.vue'

Задача:
1. В кожному файлі замінити: import Modal from '@/components/ui/Modal.vue' → import Modal from '@/ui/Modal.vue'
2. Перевірити що props/slots сумісні (новий Modal має: modelValue, title, persistent, maxWidth, #default, #footer)
3. Якщо старий Modal має інший API — адаптувати template

Коміт: git commit -m "design(B-4.1): migrate 6 files from components/ui/Modal → @/ui/Modal"

### B-4.2. Замінити import ConfirmDialog → @/ui/ConfirmModal.vue

2 файли ще імпортують старий ConfirmDialog:
- src/modules/booking/components/modals/EditLessonModal.vue
- src/modules/booking/components/modals/EventModal.vue

Задача:
1. Замінити import ConfirmDialog from '@/components/common/ConfirmDialog.vue' → import ConfirmModal from '@/ui/ConfirmModal.vue'
2. Замінити <ConfirmDialog> → <ConfirmModal> в template
3. Адаптувати props якщо потрібно

Коміт: git commit -m "design(B-4.2): migrate 2 files from ConfirmDialog → @/ui/ConfirmModal"

### B-4.3. Видалити старі компоненти (ТІЛЬКИ після B-4.1 і B-4.2!)

Після того як ЖОДЕН файл не імпортує старі компоненти:
1. Видалити src/components/ui/Modal.vue
2. Видалити src/components/common/ConfirmDialog.vue
3. Перевірити grep — чи ніхто більше не імпортує ці файли

Коміт: git commit -m "design(B-4.3): delete deprecated components/ui/Modal, ConfirmDialog"

npm run build після КОЖНОГО коміту. Оновити progress.md.
```

---

## 🅲 Агент C — MF3: QA всіх тем + фінальний аудит метрик

```
Ти — Агент C в проєкті M4SH Design System. Фінальна фаза — QA перевірка та фінальний аудит.

Прочитай:
- D:\m4sh_v1\frontend\docs\design-system\AGENT_PLAN.md
- D:\m4sh_v1\frontend\docs\design-system\progress.md

Зона: docs/design-system/, тестування через браузер
НЕ ЧІПАЙ: src/ui/, src/styles/, src/assets/, src/modules/ (тільки якщо знайдеш критичний баг)

GIT: НЕ пушити. Тільки коміти. Пуш робить людина.

---

### C-3.0. Фінальний аудит метрик (ПЕРЕД візуальним QA)

Запусти команди та запиши результати:

1. Сирі <button> (без <Button>):
   grep -rn '<button[\s>]' src/modules/ --include="*.vue" -l | wc -l
   Очікування: < 50 файлів (залишаються тільки canvas/toolbar/debug/chat-inline)

2. Сирі <textarea> (без <Textarea>):
   grep -rn '<textarea[\s>]' src/modules/ --include="*.vue" -l | wc -l
   Очікування: < 10 файлів

3. Overlay-модалки (fixed inset-0):
   grep -rn 'fixed inset-0' src/modules/ --include="*.vue" -l | wc -l
   Очікування: 0 (крім canvas/board)

4. Файли токенів:
   Перевірити що залишився ТІЛЬКИ src/styles/tokens.css
   ls src/ui/tokens.css — має бути видалений
   ls src/assets2/ui-contract/tokens/tokens.css — має бути видалений

5. class="btn " залишки:
   grep -rn 'class="btn ' src/modules/ --include="*.vue" -l | wc -l
   Очікування: < 15 файлів (тільки debug, router-link, canvas)

6. Хардкоджені hex в CSS:
   grep -rn '#[0-9a-fA-F]\{3,8\}' src/styles/ src/assets/main.css --include="*.css" | wc -l
   Очікування: < 20 (тільки brand, rgba fallbacks)

7. Імпорти старих компонентів:
   grep -rn 'components/ui/Modal' src/modules/ --include="*.vue" | wc -l — має бути 0
   grep -rn 'ConfirmDialog' src/modules/ --include="*.vue" | wc -l — має бути 0

8. Build:
   npm run build — має пройти без помилок

Запиши всі результати в таблицю в progress.md секція "Фінальні метрики MF3".

Коміт: git commit -m "design(C-3.0): final metrics audit"

### C-3.1—C-3.8. Візуальне QA (3 теми × 8 перевірок)

Запусти npm run dev та перевір кожну комбінацію:

Теми: Light, Dark, Classic
Breakpoints: Mobile (375px), Tablet (768px), Desktop (1280px)

Для кожної теми перевір:

| # | Перевірка | Що саме | Де перевірити |
|---|-----------|---------|---------------|
| C-3.1 | Кнопки | Всі варіанти (primary, secondary, outline, danger, ghost), hover, focus, disabled | Dashboard, Marketplace, Booking calendar |
| C-3.2 | Модалки | Backdrop blur, focus trap (Tab), Esc закриває, persistent не закриває | Booking → створити урок, Marketplace → фільтри |
| C-3.3 | Форми | Input focus ring, error state (червоний), disabled (сірий), placeholder | Profile editor, Booking → manual booking |
| C-3.4 | Картки | Border, shadow, hover effect, border-radius | Dashboard cards, Marketplace tutor cards |
| C-3.5 | Mobile 375px | Кнопки fullWidth, модалки на весь екран, навігація | Весь flow: login → dashboard → marketplace |
| C-3.6 | Tablet 768px | Sidebar collapse, grid layout, модалки centered | Dashboard, Booking calendar |
| C-3.7 | Desktop 1280px | Повний layout, sidebar visible, grid 3 columns | Marketplace catalog, Staff panel |
| C-3.8 | Accessibility | Focus trap в модалках, Esc закриває, Tab navigation, contrast ratio | Будь-яка модалка, форма |

Формат звіту для кожної перевірки:
✅ — працює коректно
⚠️ — працює з незначними проблемами (описати)
❌ — зламано (описати + створити issue)

Якщо знайдеш критичний баг:
1. Опиши баг детально (файл, рядок, що зламано)
2. Якщо баг у src/modules/ — виправ сам і закоміть: git commit -m "fix(C-3.X): опис бага"
3. Якщо баг у src/ui/ або src/styles/ — НЕ чіпай, запиши в progress.md як блокер для Агента A

### C-3.9. Фінальний звіт

Створи файл docs/design-system/MF3_QA_REPORT.md з:
1. Таблиця метрик (до/після)
2. Таблиця QA перевірок (3 теми × 8 перевірок)
3. Список знайдених багів та їх статус (fixed/open)
4. Рекомендації для подальшого розвитку

Коміт: git commit -m "design(C-3.9): MF3 QA report"

npm run build фінальний. Оновити progress.md — MF3 ✅.
```

---

## 📊 Залежності між агентами MF3

```
Агент A (CSS)                    Агент B (Модулі)              Агент C (QA)
─────────────                    ────────────────              ────────────
A-3.1 consolidate m4sh.css       B-4.0 btn→Button (106 файлів)  C-3.0 метрики (ЧЕКАЄ A+B)
A-3.2 delete ui/tokens.css       B-4.1 Modal import fix (6)     C-3.1-3.8 QA (ЧЕКАЄ A+B)
A-3.3 delete assets2/tokens.css  B-4.2 ConfirmDialog fix (2)    C-3.9 звіт
A-3.4 mark .btn deprecated       B-4.3 delete old components
A-3.5 audit hex in CSS           ↓
A-3.6 tailwind sync              B підтверджує → A видаляє .btn
                                 ↓
                                 A-3.7 delete .btn from main.css
```

**ВАЖЛИВО:** Агент C починає QA тільки ПІСЛЯ завершення A і B!
Поки чекає — виконує C-3.0 (метрики).

---

## ✅ DoD MF3

- [ ] Файлів токенів = 1 (`src/styles/tokens.css`)
- [ ] `src/ui/tokens.css` — видалено
- [ ] `src/assets2/ui-contract/tokens/tokens.css` — видалено
- [ ] `components/ui/Modal.vue` — видалено
- [ ] `components/common/ConfirmDialog.vue` — видалено
- [ ] `.btn-*` стилі в `main.css` — видалено
- [ ] `class="btn "` в модулях < 15 (тільки debug/router-link/canvas)
- [ ] `npm run build` — OK
- [ ] QA: 3 теми × 8 перевірок — всі ✅ або ⚠️ (без ❌)
- [ ] `MF3_QA_REPORT.md` створено
- [ ] `progress.md` — MF3 ✅

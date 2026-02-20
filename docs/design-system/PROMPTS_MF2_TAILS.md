# Design System — Промти MF2.5: Добивання хвостів

> Аудит показав: 15 модулів НЕ були в MF2 + великі залишки в покритих модулях.
> Загальний стан: ~1035 сирих `<button>`, 48 `<textarea>`, 7 overlay-модалок, 2580 hex-кольорів.
> 3 агенти паралельно. Зони НЕ перетинаються.
> Коміт після КОЖНОГО модуля: `design(АГЕНТ-модуль): опис`
> НЕ пушити — пуш робить людина.

---

## Що НЕ мігрувати (свідомо залишити)

- **winterboard/ toolbar, canvas, color picker** — специфічний canvas UI, не стандартні action buttons
- **classroom/ board toolbars** (BoardToolbar, BoardToolbarNew, BoardToolbarVertical, Subtoolbar, ExportMenu) — canvas-специфічний UI
- **dev/** — DevThemePlayground, тестовий модуль
- **chat inline buttons** (edit, delete, retry, send, loadMore) — частина chat UI
- **TelegramNotifications** — toggle switch, brand-color #229ED9
- **ChatMessage AVATAR_COLORS** — бренд-палітра
- **Rating chips** — специфічний UI
- **Brand hex** (#229ED9 Telegram, #1DB954 M4SH) — залишити як є
- **booking/ debug/** — CalendarDebugPanel, LogsSection, MetadataSection, SnapshotSection — dev-only

---

## 🅰️ Агент A — MF2.5 (нові модулі: reviews, billing, lessons, onboarding, entitlements, diagnostics)

```
Ти — Агент A в проєкті M4SH Design System. Мігруєш 6 модулів, які НЕ були покриті в MF2.

Прочитай:
- D:\m4sh_v1\frontend\docs\design-system\AGENT_PLAN.md
- D:\m4sh_v1\frontend\src\ui\Button.vue — доступні variant: primary, secondary, outline, danger, ghost; props: pill, iconOnly, fullWidth
- D:\m4sh_v1\frontend\src\ui\Modal.vue — teleport, focus trap, a11y
- D:\m4sh_v1\frontend\src\ui\Textarea.vue — v-model, maxlength, error, help

Зона: src/modules/reviews/, src/modules/billing/, src/modules/lessons/, src/modules/onboarding/, src/modules/entitlements/, src/modules/diagnostics/
НЕ ЧІПАЙ: інші модулі, src/ui/, src/styles/, src/assets/

GIT: НЕ пушити. Тільки коміти. Пуш робить людина.

Для кожного модуля:
1. Сирі <button class="btn ..."> → <Button variant="primary|secondary|outline|danger|ghost">
2. Сирі <textarea> → <Textarea> (з v-model, label, error)
3. Кастомні overlay-модалки (div з fixed inset-0) → <Modal> або <ConfirmModal>
4. Хардкоджені hex → CSS-змінні (var(--accent), var(--danger-bg), var(--text-primary), var(--bg-secondary), var(--border-color))
5. Не змінювати логіку — тільки template і styles
6. npm run build після кожного модуля
7. Імпортувати компоненти: import Button from '@/ui/Button.vue', import Modal from '@/ui/Modal.vue', import Textarea from '@/ui/Textarea.vue'

### reviews/ (~44 buttons, ~4 textarea, ~35 hex-файлів) — НАЙБІЛЬШИЙ
Файли: ReviewCard, ReviewForm, ReviewsList, MyReviewsView, WriteReviewView, ReviewActions, ReportButton, HelpfulButton, StarRating, ResponseForm, ReviewPrompt, TutorRatingWidget, TutorReviewsView.
Особливості:
- ReviewForm/ResponseForm мають <textarea> → замінити на <Textarea>
- StarRating — специфічний UI, НЕ замінювати зірки на Button
- ReportButton — кнопка "поскаржитись" → Button variant="ghost" або "danger"
Коміт: git commit -m "design(A-reviews): migrate reviews — buttons, textareas, hex→tokens"

### billing/ (~26 buttons, 1 overlay)
Файли: BillingView, PlanCard, BillingSuccessView, CheckoutLockedAlert, SubscriptionRequiredBanner, SubscriptionRequiredModal, UpgradeCTA, AccountBillingView, BillingCancelView, CurrentPlanCard, PlansList.
Особливості:
- SubscriptionRequiredModal має overlay → замінити на <Modal>
- PlanCard — кнопки "Обрати план" → Button variant="primary"
Коміт: git commit -m "design(A-billing): migrate billing — buttons, modal, hex→tokens"

### onboarding/ (~25 buttons)
Файли: TutorOnboardingView, OnboardingView, StudentOnboardingView, OnboardingTooltip, WelcomeBanner, ChecklistCategory/Item/Panel, CompletionStep, FirstActionStep, PreferencesStep, OnboardingModal.
Особливості:
- OnboardingModal — якщо є overlay → <Modal>
- WelcomeBanner — CTA кнопки → Button
Коміт: git commit -m "design(A-onboarding): migrate onboarding — buttons, modal, hex→tokens"

### lessons/ (~20 buttons, 2 overlay)
Файли: LessonList (16 buttons!), LessonInviteResolveView, LessonView.
Особливості:
- LessonList — дуже багато кнопок, уважно з табличними action buttons
- Якщо є overlay-модалки → <Modal>
Коміт: git commit -m "design(A-lessons): migrate lessons — buttons, hex→tokens"

### entitlements/ (~5 buttons)
Файли: GraceBanner, FeatureGate, PlanFeaturesView.
Коміт: git commit -m "design(A-entitlements): migrate entitlements — buttons, hex→tokens"

### diagnostics/ (~2 buttons)
Файли: DiagnosticsPanel.
Коміт: git commit -m "design(A-diagnostics): migrate diagnostics — buttons"

Після всіх модулів — оновити progress.md.
```

---

## 🅱️ Агент B — MF2.5 (нові модулі: matches, people, trust, contacts, negotiation, call, classrooms, profileV2, student, tutor, tutors, admin)

```
Ти — Агент B в проєкті M4SH Design System. Мігруєш 12 невеликих модулів, які НЕ були покриті в MF2.

Прочитай:
- D:\m4sh_v1\frontend\docs\design-system\AGENT_PLAN.md
- D:\m4sh_v1\frontend\src\ui\Button.vue — variant: primary, secondary, outline, danger, ghost; props: pill, iconOnly, fullWidth
- D:\m4sh_v1\frontend\src\ui\Modal.vue — teleport, focus trap, a11y
- D:\m4sh_v1\frontend\src\ui\ConfirmModal.vue — обгортка Modal для підтверджень
- D:\m4sh_v1\frontend\src\ui\Textarea.vue — v-model, maxlength, error, help

Зона: src/modules/matches/, src/modules/people/, src/modules/trust/, src/modules/contacts/, src/modules/negotiation/, src/modules/call/, src/modules/classrooms/, src/modules/profileV2/, src/modules/student/, src/modules/tutor/, src/modules/tutors/, src/modules/admin/
НЕ ЧІПАЙ: інші модулі, src/ui/, src/styles/, src/assets/

GIT: НЕ пушити. Тільки коміти. Пуш робить людина.

Для кожного модуля:
1. Сирі <button> → <Button variant="...">
2. Сирі <textarea> → <Textarea>
3. Overlay-модалки (div з fixed inset-0) → <Modal> / <ConfirmModal>
4. Хардкоджені hex → CSS-змінні
5. Не змінювати логіку — тільки template і styles
6. npm run build після кожного модуля
7. Імпорт: import Button from '@/ui/Button.vue' тощо

### matches/ (~25 buttons, 1 overlay, ~2 textarea)
Файли: AvailabilityEditor (10!), BookingModal, MatchDetailView, MatchDetail, AvailabilityCalendar, ConversationView, MatchList.
Особливості:
- AvailabilityEditor — багато кнопок для слотів, уважно з UI
- BookingModal — якщо overlay → <Modal>
Коміт: git commit -m "design(B-matches): migrate matches — buttons, modal, textarea, hex→tokens"

### people/ (~14 buttons, 1 overlay, 1 textarea)
Файли: TutorInquiriesInbox, ChatThreadView, StudentInquiriesView, CreateInquiryModal.
Особливості:
- CreateInquiryModal має overlay (fixed inset-0) → <Modal>
- ChatThreadView — textarea → <Textarea>
Коміт: git commit -m "design(B-people): migrate people — buttons, modal, textarea, hex→tokens"

### trust/ (~10 buttons)
Файли: AppealsView, BlockUserModal, ReportUserModal, TrustGuardBanner, BlockedUsersList.
Особливості:
- BlockUserModal, ReportUserModal — якщо overlay → <Modal>
Коміт: git commit -m "design(B-trust): migrate trust — buttons, modals, hex→tokens"

### contacts/ (~8 buttons)
Файли: ContactBalanceWidget, ContactLedgerTable, PurchaseTokensModal, TokenGrantModal.
Коміт: git commit -m "design(B-contacts): migrate contacts — buttons, hex→tokens"

### call/ (~6 buttons)
Файли: CallControls, ReconnectOverlay.
Особливості:
- CallControls — кнопки камера/мікрофон → Button iconOnly
Коміт: git commit -m "design(B-call): migrate call — buttons"

### classrooms/ (~6 buttons, 1 overlay)
Файли: InviteStudentModal, ClassroomCard, ClassroomDetailView, ClassroomListView, DashboardClassroomsView.
Особливості:
- InviteStudentModal має overlay → <Modal>
Коміт: git commit -m "design(B-classrooms): migrate classrooms — buttons, modal, hex→tokens"

### admin/ (~7 buttons, 1 overlay)
Файли: I18nMissingTranslations, AdminArchiveUserModal.
Особливості:
- AdminArchiveUserModal має overlay → <Modal>
Коміт: git commit -m "design(B-admin): migrate admin — buttons, modal"

### negotiation/ (~5 buttons, 1 textarea)
Файли: ChatView, NegotiationChatInput, ChatListView.
Особливості:
- NegotiationChatInput — textarea → <Textarea>
Коміт: git commit -m "design(B-negotiation): migrate negotiation — buttons, textarea"

### profileV2/ (~9 buttons)
Файли: ProfileEditView, UserAccountView, ProfileOverviewView.
Коміт: git commit -m "design(B-profileV2): migrate profileV2 — buttons, hex→tokens"

### student/ (~3 buttons)
Файли: MyTutorWidget.
Коміт: git commit -m "design(B-student): migrate student — buttons"

### tutor/ (~1 button) + tutors/ (~2 buttons)
Файли: TutorSearchView, TutorAnalyticsView.
Коміт: git commit -m "design(B-tutor): migrate tutor+tutors — buttons, hex→tokens"

Після всіх модулів — оновити progress.md.
```

---

## 🅲 Агент C — MF2.5 (залишки в покритих модулях: booking, marketplace, classroom + textarea sweep)

```
Ти — Агент C в проєкті M4SH Design System. Добиваєш залишки в модулях, які вже частково мігровані в MF2.

Прочитай:
- D:\m4sh_v1\frontend\docs\design-system\AGENT_PLAN.md
- D:\m4sh_v1\frontend\src\ui\Button.vue — variant: primary, secondary, outline, danger, ghost; props: pill, iconOnly, fullWidth
- D:\m4sh_v1\frontend\src\ui\Modal.vue
- D:\m4sh_v1\frontend\src\ui\Textarea.vue

Зона: src/modules/booking/, src/modules/marketplace/, src/modules/classroom/, src/modules/profile/, src/modules/chat/, src/modules/inquiries/, src/modules/staff/, src/modules/auth/, src/modules/dashboard/, src/modules/payments/, src/modules/board/
НЕ ЧІПАЙ: src/ui/, src/styles/, src/assets/
НЕ ЧІПАЙ: модулі Агента A (reviews, billing, lessons, onboarding, entitlements, diagnostics)
НЕ ЧІПАЙ: модулі Агента B (matches, people, trust, contacts, negotiation, call, classrooms, profileV2, student, tutor, tutors, admin)

GIT: НЕ пушити. Тільки коміти. Пуш робить людина.

УВАГА: Ці модулі вже частково мігровані. Деякі файли вже мають <Button>, <Modal>. Твоя задача — знайти і замінити ЗАЛИШКИ.

Для кожного файлу:
1. Перевір чи вже є import Button — якщо так, тільки заміни сирі <button> що залишились
2. Сирі <textarea> → <Textarea> (УВАГА: деякі textarea мають специфічну логіку auto-resize — перевіряй)
3. Хардкоджені hex → CSS-змінні
4. Не змінювати логіку — тільки template і styles
5. npm run build після кожного коміту

### НЕ МІГРУВАТИ (свідомо):
- booking/debug/ — dev-only компоненти
- classroom/ board toolbars (BoardToolbar*, Subtoolbar, ExportMenu) — canvas UI
- winterboard/ — вже зроблено Export, toolbar не чіпати
- chat inline buttons (edit, delete, retry, send) — chat UI
- Duration buttons в booking/ модалках — form-specific селектори

### booking/ залишки (~200 buttons, ~10 textarea)
Основні файли з великою кількістю залишків:
- EditLessonModal (14), CreateLessonModal (10), StudentAvailabilityCalendar (8)
- AvailabilityEditor (6), AvailabilityTemplateEditor (6), EventModal (6)
- StudentCalendarView (6), WeekNavigation (5), JoinLessonPicker (5), BookLessonView (5)
- ExceptionManager (4), BookingCard (4), CalendarFooter (4), CalendarWeekView (4)
- BookingModal×2 (3+4), ManualBookingModal (4), BlockSlotModal (3), CreateSlotModal (3)
- GenerationProgressModal (3), SlotEditor (3), BookingActions (3), ConflictResolver (3)
- AvailabilityConflictsDrawer (3), AvailabilityOverlay (3), CalendarHeader (3)
- WeekNavigationSimple (3), WeekSwitcher (3), DraftToolbar (3), LessonLinksEditor (3)
- BookingRequestModal (3), та інші по 1-2

Підхід: групуй по підпапках, коміт на кожну підпапку:
1. booking/components/modals/ — git commit -m "design(C-booking-modals): remaining buttons→Button, textarea→Textarea"
2. booking/components/availability/ — git commit -m "design(C-booking-avail): remaining buttons, textarea, hex"
3. booking/components/calendar/ — git commit -m "design(C-booking-cal): remaining buttons, hex"
4. booking/components/booking/ + booking/components/common/ + booking/components/requests/ + booking/components/lessonLinks/ — git commit -m "design(C-booking-misc): remaining buttons, hex"
5. booking/views/ — git commit -m "design(C-booking-views): remaining buttons, hex"

### marketplace/ залишки (~142 buttons, ~3 textarea)
Основні файли:
- AdvancedFiltersModal (7), MarketplaceSearch (6), ProfileEditor (6), SubjectsTab (6)
- DraftConflictModal (5), MergeConfirmationModal (5), VerificationRequestModal (5)
- TutorAvailabilityCalendar (4), SubjectSelectionPanel (4), SubjectTagsSelector (4)
- TabbedCard (4), CreateReviewModal (4), TrialRequestModal (4), TutorProfileView (4)
- та багато файлів по 1-3

Підхід:
1. marketplace/components/editor/ — git commit -m "design(C-mkt-editor): remaining buttons, textarea, hex"
2. marketplace/components/catalog/ + marketplace/components/search/ + marketplace/components/filters/ — git commit -m "design(C-mkt-catalog): remaining buttons, hex"
3. marketplace/components/profile/ + marketplace/components/verification/ + marketplace/components/trial/ — git commit -m "design(C-mkt-profile): remaining buttons, hex"
4. marketplace/components/ (root) + marketplace/views/ — git commit -m "design(C-mkt-views): remaining buttons, hex"

### classroom/ залишки (~85 buttons) — ТІЛЬКИ НЕ-TOOLBAR
НЕ чіпати: BoardToolbar, BoardToolbarNew, BoardToolbarVertical, Subtoolbar, ExportMenu, BoardDock — canvas UI.
Мігрувати:
- RoomToolbar (10) — кнопки управління кімнатою
- ClassroomBoard (9) — якщо є action buttons
- ReplayControls (4), VideoControls (3), SessionEnded (3), HistoryModal (2), ReconnectOverlay (2), WaitingRoom (2)
- MobileCompact (2), SnapshotExport (2), SnapshotViewer (2), LessonHistory (2), ReconnectView (2)
- та інші по 1
Коміт: git commit -m "design(C-classroom-room): remaining buttons (no toolbar)"

### board/ (~34 buttons, ~1 overlay)
Файли: BoardToolbar (5), HistoryPanel (4), LayersPanel (4), ZoomControls (4), ErrorBoundary (3), ExportModal (3), toolbar/BoardToolbar (3), ConflictIndicator (2), TemplateGallery (2), VideoOverlay (2), BoardView (2).
Особливості:
- ExportModal — якщо overlay → <Modal>
- BoardToolbar — це НЕ classroom toolbar, це окремий модуль board/
Коміт: git commit -m "design(C-board): migrate board — buttons, modal, hex→tokens"

### Залишки в інших покритих модулях (profile, chat, inquiries, staff, auth, dashboard, payments)
Перевір кожен модуль на залишки сирих <button> і <textarea>. Якщо є — замінити.
Коміт по модулю: git commit -m "design(C-MODULE-tails): remaining buttons/textarea/hex"

Після всіх модулів — оновити progress.md.
```

---

## 📊 Зведена таблиця MF2.5

| Агент | Модулі | ~Buttons | ~Textarea | ~Overlay | Тип |
|-------|--------|----------|-----------|----------|-----|
| **A** | reviews, billing, lessons, onboarding, entitlements, diagnostics | ~122 | ~6 | ~2 | Нові модулі |
| **B** | matches, people, trust, contacts, negotiation, call, classrooms, profileV2, student, tutor, tutors, admin | ~96 | ~4 | ~5 | Нові модулі (дрібні) |
| **C** | booking↻, marketplace↻, classroom↻, board, profile↻, chat↻, інші↻ | ~500+ | ~15+ | ~1 | Залишки + board |

**↻** = модуль вже частково мігрований, добиваємо залишки

---

## ✅ DoD MF2.5

- [ ] Сирих `<button>` в модулях < 50 (залишаються тільки canvas/toolbar/chat-inline)
- [ ] Сирих `<textarea>` = 0 (крім canvas-специфічних)
- [ ] Overlay-модалок (fixed inset-0) = 0
- [ ] `npm run build` — OK
- [ ] progress.md оновлено

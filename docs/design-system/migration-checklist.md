# Design System — Чеклист міграції модулів

> Створено: 2026-02-20 (Агент C, задачі C-1.1 — C-1.4)
> Метод: автоматичний аудит grep по `src/modules/`

---

## Зведена таблиця

| Модуль | Сирих `<button>` | `<Button>` | Модалок | Hex-кольорів | Файлів з кнопками | Агент | Пріоритет |
|--------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| auth/ | 5 | 32 | 5 | 36 | 1 | A | 🔴 |
| dashboard/ | 0 | 4 | 0 | 45 | 0 | A | 🔴 |
| inquiries/ | 9 | 0 | 1 | 30 | 4 | B | 🔴 |
| marketplace/ | 29 | 0 | 8 | 217 | 35 | B | 🟡 |
| profile/ | 0 | 20 | 1 | 6 | 1 | B | 🟡 |
| booking/ | 17 | 0 | 22 | 1257 | 39 | C | 🟡 |
| payments/ | 4 | 2 | 1 | 322 | 11 | A | 🟡 |
| chat/ | 6 | 0 | 1 | 41 | 3 | B | 🟢 |
| classroom/ | 14 | 0 | 2 | 261 | 12 | C | 🟢 |
| winterboard/ | 19 | 0 | 4 | 549 | 7 | C | 🟢 |
| staff/ | 17 | 0 | 3 | 177 | 5 | A | 🟢 |
| **ВСЬОГО** | **120** | **58** | **48** | **2941** | **118** | — | — |

> **Примітка:** Hex-кольори включають як UI-кольори (потребують заміни), так і fallback-значення у `var(--token, #hex)` конструкціях та бренд-кольори (залишити). Реальна кількість кольорів для заміни значно менша.

---

## Детально по модулях

---

### auth/ (Агент A) 🔴

**Файли з сирими кнопками:**
- `components/BackupCodesModal.vue` (5 кнопок)

> Решта 32 кнопки вже використовують `<Button>` — auth майже мігрований.

**Модалки для заміни:**
- `components/BackupCodesModal.vue` — тип: info/confirm, складність: середня
- `components/MFASetupModal.vue` — тип: form (wizard), складність: складна
- `components/MFAVerifyModal.vue` — тип: form, складність: середня
- `components/UnlockConfirmModal.vue` — тип: confirm, складність: проста
- `components/WebAuthnEnrollModal.vue` — тип: form (wizard), складність: складна

**Хардкоджені кольори (36 входжень):**
- `views/LoginView.vue` — `var(--danger, #d92d20)` → fallback, OK
- `components/WebAuthnPrompt.vue` — `var(--primary-bg, #e0f2fe)`, `var(--warning-bg, #fef3c7)`, `var(--danger-bg, #fee2e2)` → fallback-и, OK
- `components/WebAuthnEnrollModal.vue` — `#0f172a`, `#3c165f`, `#b45309`, `#fff` → замінити на `var(--text-primary)`, `var(--text-secondary)`, `var(--warning)`, `var(--bg)`
- `components/TrialBanner.vue` — `var(--info-bg, #dbeafe)`, `var(--warning-bg, #fef3c7)` → fallback-и, OK
- `components/BackupCodesModal.vue` — `var(--danger-bg, #fee2e2)`, `var(--success-bg, #d1fae5)` → fallback-и, OK

> Більшість hex — це fallback-значення в `var()`. Реальних хардкоджених ~6.

**Оцінка часу:** 2 години

---

### dashboard/ (Агент A) 🔴

**Файли з сирими кнопками:**
- Немає сирих `<button>` — всі 4 вже `<Button>`.

**Модалки для заміни:**
- Немає модалок.

**Хардкоджені кольори (45 входжень):**
- `components/UpcomingLessonCard.vue` — `var(--bg-primary, #fff)`, `var(--border-color, #e5e7eb)`, `var(--primary-500, #3b82f6)` тощо → fallback-и
- `components/StudentContactUnlock.vue` — `#f0f9ff`, `#bae6fd`, `#0c4a6e`, `#3b82f6`, `#ef4444`, `#dc2626`, `#6b7280`, `#4b5563` → **замінити на CSS-змінні**
- `components/DashboardStats.vue` — `var(--bg-primary, #fff)`, `var(--primary-600, #2563eb)` → fallback-и
- `components/TutorAcceptAvailabilityBadge.vue` — `#10b981`, `#f59e0b`, `#ef4444`, `#dc2626` → замінити на `var(--success)`, `var(--warning)`, `var(--danger)`

> `StudentContactUnlock.vue` — найбільший боржник: ~15 хардкоджених кольорів без `var()`.

**Оцінка часу:** 1.5 години (тільки кольори)

---

### inquiries/ (Агент B) 🔴

**Файли з сирими кнопками:**
- `components/RecommendedTutorsWidget.vue` (3 кнопки)
- `components/SpamReportModal.vue` (1 кнопка)
- `views/StudentInquiriesView.vue` (1 кнопка)
- `views/TutorInquiriesView.vue` (4 кнопки)

**Модалки для заміни:**
- `components/SpamReportModal.vue` — тип: form, складність: середня

> `TutorInquiriesView.vue` містить inline-модалку (accept/reject) — потребує виділення в окремий `<Modal>`.

**Хардкоджені кольори (30 входжень):**
- `views/TutorInquiriesView.vue` — `#111827`, `#6B7280`, `#F0F9FF`, `#3B82F6`, `#1E40AF`, `#4F46E5`, `#F3F4F6`, `#E5E7EB`, `#9CA3AF` → **все замінити на CSS-змінні**
- `views/StudentInquiriesView.vue` — `#111827`, `#6B7280`, `#F3F4F6`, `#374151`, `#E5E7EB` → **замінити**

> Обидва views мають повністю хардкоджені стилі без `var()`. Потребують повної міграції.

**Оцінка часу:** 3 години

---

### marketplace/ (Агент B) 🟡

**Файли з сирими кнопками (29 кнопок у 35 файлах):**
- `components/catalog/AdvancedFiltersModal.vue` (7)
- `components/MergeConfirmationModal.vue` (5)
- `components/MarketplaceSearch.vue` (4)
- `components/editor/ProfileEditor.vue` (4)
- `components/trial/TrialRequestModal.vue` (4)
- `views/TutorProfileView.vue` (4)
- `components/TutorAvailabilityCalendar.vue` (3)
- `components/TutorAvailabilityWidget.vue` (3)
- `components/profile/ProfileContact.vue` (3)
- `components/profile/ProfileHero.vue` (3)
- `components/search/SearchFiltersModal.vue` (3)
- `views/SearchResultsView.vue` (3)
- `views/TutorCatalogView.vue` (3)
- та ще 22 файли по 1-2 кнопки

**Модалки для заміни:**
- `components/DraftConflictModal.vue` — тип: confirm, складність: проста
- `components/MergeConfirmationModal.vue` — тип: confirm (diff view), складність: складна
- `components/PublishGuardModal.vue` — тип: confirm, складність: проста
- `components/catalog/AdvancedFiltersModal.vue` — тип: form (фільтри), складність: складна
- `components/profile/CreateReviewModal.vue` — тип: form, складність: середня
- `components/search/SearchFiltersModal.vue` — тип: form (фільтри), складність: середня
- `components/trial/TrialRequestModal.vue` — тип: form, складність: середня
- `components/verification/VerificationRequestModal.vue` — тип: form, складність: середня

**Хардкоджені кольори (217 входжень):**
- `views/TutorProfileView.vue` — `#e5e7eb`, `#374151`, `#f3f4f6` → замінити
- `components/TutorCalendarWidget.vue` — `#111827`, `#f3f4f6`, `#e5e7eb`, `#6b7280`, `#3b82f6`, `#2563eb` → замінити
- `components/TutorAvailabilityCalendar.vue` — `#e5e7eb`, `#f3f4f6`, `#374151`, `#10b981`, `#059669`, `#d1d5db` → замінити
- `components/trial/TrialRequestModal.vue` — `#fef2f2`, `#fecaca`, `#dc2626`, `#991b1b`, `#b91c1c` → замінити
- `components/verification/VerificationBadge.vue` — `#10b981`, `#3b82f6`, `#f59e0b` → **бренд-кольори верифікації, залишити або винести в токени**
- `components/PublishGuardModal.vue` — `var(--warning-bg, #fef3c7)` → fallback, OK
- `components/MergeConfirmationModal.vue` — `var(--danger, #dc2626)`, `var(--success, #059669)` → fallback, OK
- `components/profile/ProfileSubjects.vue` — `#d1fae5`, `#065f46`, `#6ee7b7`, `#fef3c7`, `#92400e` → замінити

> Найбільший модуль за кількістю файлів. Багато хардкоджених кольорів у widget-ах та views.

**Оцінка часу:** 6 годин

---

### profile/ (Агент B) 🟡

**Файли з сирими кнопками:**
- `components/settings/TelegramNotifications.vue` (1 кнопка — Telegram CTA)

> 20 кнопок вже `<Button>` — profile майже мігрований.

**Модалки для заміни:**
- `components/AccountDeletionModal.vue` — тип: confirm (destructive), складність: середня
- `views/ProfileEditView.vue` — inline draft-діалог з `fixed inset-0` → замінити на `<Modal>`

**Хардкоджені кольори (6 входжень):**
- `components/settings/TelegramNotifications.vue` — `#229ED9`, `#1e8fc4` → **бренд Telegram, ЗАЛИШИТИ**
- `components/ActivityMetadataTree.vue` — `var(--text-primary, #0f172a)` → fallback, OK

> Мінімальний обсяг роботи. Telegram-кольори — бренд, не чіпати.

**Оцінка часу:** 1 година

---

### booking/ (Агент C) 🟡 ⚠️ Найбільший модуль

**Файли з сирими кнопками (17 кнопок у 39 файлах):**
- `components/calendar/StudentAvailabilityCalendar.vue` (7)
- `debug/components/CalendarDebugPanel.vue` (5)
- `components/booking/BookingCard.vue` (4)
- `components/calendar/CalendarWeekView.vue` (4)
- `components/calendar/LessonCardDrawer.vue` (4)
- `components/modals/BookingModal.vue` (4)
- `views/BookLessonView.vue` (4)
- та ще 32 файли по 1-3 кнопки

**Модалки для заміни (22 файли):**
- `components/BookingModal.vue` — тип: form, складність: середня
- `components/BookingRequestModal.vue` — тип: form, складність: середня
- `components/availability/BlockSlotModal.vue` — тип: form, складність: проста
- `components/availability/CreateSlotModal.vue` — тип: form, складність: середня
- `components/availability/GenerationProgressModal.vue` — тип: info (progress), складність: проста
- `components/calendar/AvailabilityConflictsDrawer.vue` — тип: info (drawer), складність: середня
- `components/calendar/AvailabilityOverlay.vue` — тип: overlay (calendar), складність: **НЕ мігрувати** (calendar-specific)
- `components/calendar/CalendarGuideModal.vue` — тип: info, складність: проста
- `components/calendar/ColorLegendModal.vue` — тип: info, складність: проста
- `components/calendar/DragSelectOverlay.vue` — тип: overlay (calendar), складність: **НЕ мігрувати** (interaction-specific)
- `components/calendar/EventsOverlay.vue` — тип: overlay (calendar), складність: **НЕ мігрувати** (calendar-specific)
- `components/calendar/LessonCardDrawer.vue` — тип: info (drawer), складність: середня
- `components/calendar/NoShowReasonModal.vue` — тип: form, складність: проста
- `components/calendar/RescheduleModal.vue` — тип: form, складність: складна
- `components/modals/BookingModal.vue` — тип: form, складність: середня
- `components/modals/CreateLessonModal.vue` — тип: form, складність: складна
- `components/modals/EditLessonModal.vue` — тип: form, складність: складна
- `components/modals/EventModal.vue` — тип: info, складність: проста
- `components/modals/ManualBookingModal.vue` — тип: form, складність: середня
- `components/modals/SlotEditorModal.vue` — тип: form, складність: складна
- `components/modals/TemplateConfirmModal.vue` — тип: confirm, складність: проста
- `components/requests/BookingRequestModal.vue` — тип: form, складність: середня

> 3 overlay-компоненти (AvailabilityOverlay, DragSelectOverlay, EventsOverlay) — це calendar-specific шари, НЕ модалки. Не мігрувати на `<Modal>`.

**Хардкоджені кольори (1257 входжень):**
- Найбільший боржник проєкту
- `views/TutorCalendarView.vue` — масивні хардкоджені стилі: `#3b82f6`, `#e5e7eb`, `#111827`, `#6b7280`, `#667eea`, `#764ba2` тощо
- `views/StudentCalendarView.vue` — аналогічно: `#e5e7eb`, `#3b82f6`, `#dc2626`, `#111827`
- `views/TutorLessonLinksView.vue` — `#2563eb`, `#f87171`, `#b91c1c`, `#dc2626`, `#d1d5db`
- `views/TutorAvailabilityView.vue` — `#0ea5e9`, `#0f172a`, `#475569`
- `views/BookLessonView.vue` — множинні хардкоджені кольори
- `components/calendar/*` — масивні хардкоджені стилі у всіх calendar-компонентах
- `debug/components/*` — debug-панель, низький пріоритет

> Більшість hex — UI-кольори без `var()`. Потребує повної міграції на CSS-змінні. Debug-компоненти можна мігрувати останніми.

**Оцінка часу:** 12 годин

---

### payments/ (Агент A) 🟡

**Файли з сирими кнопками (4 кнопки у 11 файлах):**
- `components/payout/PayoutForm.vue` (3)
- `components/subscription/CancelModal.vue` (3)
- `components/subscription/CurrentPlan.vue` (2)
- `views/PlansView.vue` (2)
- та ще 7 файлів по 1 кнопці

**Модалки для заміни:**
- `components/subscription/CancelModal.vue` — тип: confirm (destructive), складність: середня

**Хардкоджені кольори (322 входження):**
- `views/WalletView.vue` — `var(--color-text-secondary, #6b7280)`, `var(--color-border, #d1d5db)` → fallback-и
- `views/SubscriptionView.vue` — `var(--color-border, #e5e7eb)`, `var(--color-warning-light, #fef3c7)` → fallback-и
- `views/PayoutView.vue` — `var(--color-border, #e5e7eb)`, `var(--color-primary, #3b82f6)` → fallback-и
- `views/PaymentHistoryView.vue` — `var(--color-text-secondary, #6b7280)` → fallback-и

> Більшість hex — fallback-значення в `var()`. Реальних хардкоджених мало. Добре структурований модуль.

**Оцінка часу:** 2 години

---

### chat/ (Агент B) 🟢

**Файли з сирими кнопками (6 кнопок у 3 файлах):**
- `components/ChatErrorBoundary.vue` (2)
- `components/ChatMessage.vue` (2)
- `components/ChatPanel.vue` (2)

**Модалки для заміни:**
- `components/ChatModal.vue` — тип: container (chat window), складність: складна (вже має Teleport)

**Хардкоджені кольори (41 входження):**
- `components/ChatMessage.vue` — масив `AVATAR_COLORS`: `#1A73E8`, `#D93025`, `#188038`, `#F9AB00`, `#9334E6`, `#0097A7`, `#F57C00`, `#7B1FA2`, `#388E3C`, `#1976D2`, `#D84315`, `#00796B` → **Google-style avatar кольори, ЗАЛИШИТИ**
- `components/ChatMessage.vue` — `#2563eb`, `#7c3aed`, `#059669`, `#dc2626` → замінити на CSS-змінні
- `components/ChatPanel.vue` — `#4f46e5`, `#d63a3a` → замінити
- `components/ChatErrorBoundary.vue` — `#ef4444`, `#1f2937`, `#6b7280`, `#3b82f6`, `#2563eb`, `#374151`, `#d1d5db`, `#f9fafb`, `#9ca3af` → замінити

> Avatar кольори — бренд/UX, залишити. Решта — UI-кольори для заміни.

**Оцінка часу:** 2 години

---

### classroom/ (Агент C) 🟢

**Файли з сирими кнопками (14 кнопок у 12 файлах):**
- `views/ClassroomBoard.vue` (9)
- `components/board/BoardDock.vue` (3)
- `components/room/SessionEnded.vue` (3)
- `components/modals/HistoryModal.vue` (2)
- `components/room/ReconnectOverlay.vue` (2)
- `components/room/WaitingRoom.vue` (2)
- `views/ReconnectView.vue` (2)
- та ще 5 файлів по 1 кнопці

**Модалки для заміни:**
- `components/modals/HistoryModal.vue` — тип: info (list), складність: середня
- `components/room/ReconnectOverlay.vue` — тип: overlay (status), складність: проста

**Хардкоджені кольори (261 входження):**
- `views/ClassroomBoard.vue` — `var(--color-bg-tertiary, #f1f5f9)`, `var(--color-brand, #7c3aed)` → fallback-и
- `components/room/WaitingRoom.vue` — `#1f2937`, `#111827`, `var(--color-primary, #3b82f6)` → частково fallback, частково хардкод
- `components/room/SessionEnded.vue` — `#1f2937`, `#111827` → замінити
- `timeline/TimelinePreview.vue` — `#1a1a2e`, `#fff`, `#3b82f6` → canvas-кольори, **залишити** (canvas rendering)
- `history/SnapshotDiff.vue` — `#1a1a2e`, `#ffffff`, `#3b82f6` → canvas-кольори, **залишити**
- `replay/ReplayControls.vue` — `var(--color-bg-secondary, #374151)` → fallback

> Canvas-кольори (timeline, snapshot, replay) — специфічні для rendering, залишити. UI-кольори в room/* — замінити.

**Оцінка часу:** 4 години

---

### winterboard/ (Агент C) 🟢

**Файли з сирими кнопками (19 кнопок у 7 файлах):**
- `views/WBSoloRoom.vue` (7)
- `views/WBSessionList.vue` (6)
- `views/WBClassroomRoom.vue` (5)
- `components/export/WBExportDialog.vue` (3)
- `components/sharing/WBShareDialog.vue` (3)
- `components/WBErrorBoundary.vue` (1)
- `components/pdf/WBPdfImportButton.vue` (1)

**Модалки для заміни:**
- `components/export/WBExportDialog.vue` — тип: form (export options), складність: середня
- `components/sharing/WBShareDialog.vue` — тип: form (share link), складність: середня
- `components/dialogs/WBClearPageDialog.vue` — тип: confirm (destructive), складність: проста

> `components/collaboration/WBRemoteCursorsOverlay.vue` — це canvas overlay, НЕ модалка. Не мігрувати.

**Хардкоджені кольори (549 входжень):**
- `views/WBSoloRoom.vue` — масивні: `#1DB954` (бренд M4SH logo), `#2563eb`, `#f1f5f9`, `#0f172a`, `#e2e8f0`, `#22c55e`, `#eab308`, `#ef4444`, `#f97316`, `#94a3b8`, `#bbf7d0`, `#64748b`, `#ffffff`, `#475569`, `#f8fafc`, `#0066FF`
- `views/WBSessionList.vue` — SVG кольори: `#ef4444`, `#94a3b8` → SVG inline, залишити або винести
- `views/WBClassroomRoom.vue` — аналогічно WBSoloRoom

> Більшість hex у WBSoloRoom — це fallback-и у `var(--wb-*, #hex)` конструкціях. `#1DB954` — бренд M4SH, залишити. SVG stroke кольори в WBSessionList — залишити. Toolbar кнопки — **НЕ ЧІПАТИ** (canvas UI).

**Оцінка часу:** 4 години (без toolbar)

---

### staff/ (Агент A) 🟢

**Файли з сирими кнопками (17 кнопок у 5 файлах):**
- `components/UserBillingOpsPanel.vue` (5)
- `components/FinalizeModal.vue` (4)
- `views/StaffUserOverviewView.vue` (4)
- `components/ReportDetailsModal.vue` (3)
- `views/StaffReportsView.vue` (1)

**Модалки для заміни:**
- `components/FinalizeModal.vue` — тип: confirm, складність: середня
- `components/GrantExemptionModal.vue` — тип: form, складність: середня (має `fixed inset-0`)
- `components/ReportDetailsModal.vue` — тип: info (detail view), складність: середня

**Хардкоджені кольори (177 входжень):**
- `views/StaffUserOverviewView.vue` — `#007bff`, `#fee`, `#fcc`, `#c00`, `#666`, `#f8f9fa`, `#ddd`, `#ffc107`, `#856404`, `#28a745`, `#dc3545` → **повністю хардкоджені, замінити все**
- `views/StaffReportsView.vue` — `#ddd`, `#fee`, `#fcc`, `#c00`, `#666`, `#f8f9fa`, `#333`, `#eee`, `#007bff`, `#ccc` → **повністю хардкоджені, замінити все**
- `views/StaffDashboard.vue` — `#1a202c`, `#e2e8f0`, `#3b82f6`, `#eff6ff`, `#64748b` → замінити
- `layouts/StaffLayout.vue` — `#f8fafc`, `#e2e8f0`, `#1a202c`, `#64748b`, `#f1f5f9`, `#3b82f6`, `#eff6ff`, `#cbd5e1` → замінити
- `components/UserBillingOpsPanel.vue` — `#fff`, `#4CAF50`, `#45a049`, `#f44336`, `#2196F3`, `#f9f9f9`, `#333`, `#666`, `#e0e0e0`, `#1976d2`, `#7b1fa2` → **повністю хардкоджені, замінити все**

> Staff — найгірший модуль по хардкоджених кольорах. Жодного `var()`. Потребує повної міграції.

**Оцінка часу:** 4 години

---

## Підсумок

### Загальна статистика
- **Сирих `<button>`:** 120 (ціль: < 50, потрібно замінити ~70+)
- **`<Button>` компонент:** 58 (вже мігровані)
- **Модалок/діалогів:** 48 файлів (з них ~6 overlay-ів не потребують міграції → 42 реальних)
- **Hex-кольорів:** 2941 входжень (з них ~60% — fallback-и в `var()`, ~20% — бренд/canvas, ~20% — реальні хардкоди)

### Кольори: класифікація

| Тип | Дія | Приклади |
|-----|-----|---------|
| **Fallback у `var()`** | Залишити (видалити при очищенні MF3) | `var(--danger, #dc2626)` |
| **Бренд-кольори** | Залишити | Telegram `#229ED9`, M4SH `#1DB954`, Google avatar colors |
| **Canvas/SVG rendering** | Залишити | `ctx.fillStyle = '#1a1a2e'`, SVG stroke |
| **UI хардкод** | **Замінити на `var(--token)`** | `color: #6b7280`, `background: #f3f4f6` |

### Пріоритет міграції (рекомендований порядок)

1. **auth/** — майже готовий, тільки BackupCodesModal + 5 модалок
2. **dashboard/** — тільки кольори, без кнопок
3. **profile/** — майже готовий, 1 кнопка + 1 модалка
4. **inquiries/** — 9 кнопок, 1 модалка, багато хардкоджених кольорів
5. **payments/** — 4 кнопки, 1 модалка, fallback-кольори
6. **chat/** — 6 кнопок, 1 модалка
7. **staff/** — 17 кнопок, 3 модалки, повністю хардкоджені кольори
8. **classroom/** — 14 кнопок, 2 модалки, canvas-кольори залишити
9. **winterboard/** — 19 кнопок, 3 модалки (без toolbar)
10. **marketplace/** — 29 кнопок, 8 модалок, 217 hex → найбільший за файлами
11. **booking/** — 17 кнопок, 19 модалок, 1257 hex → найбільший за обсягом

### Загальна оцінка часу

| Агент | Модулі | Оцінка |
|-------|--------|--------|
| A | auth, dashboard, payments, staff | ~9.5 годин |
| B | inquiries, marketplace, profile, chat | ~12 годин |
| C | booking, classroom, winterboard | ~20 годин |
| **Всього** | | **~41.5 годин** |

> Booking — критичний шлях. Агент C має найбільший обсяг через booking (12 годин).

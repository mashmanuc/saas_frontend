# MF7 — Токенізація `background: white` → CSS vars (Фаза 5, Хвиля 1)

> Дата: 2026-02-20
> Попередня фаза: MF6 (Design System міграція ЗАВЕРШЕНА) — ✅
> Мета: Замінити хардкоджені `background: white/#fff/#ffffff` на `var(--card-bg)` / `var(--bg-primary)` у файлах, видимих користувачу

---

## Контекст

### Аудит MF7

- **55 файлів** з `background: white/#fff/#ffffff` у scoped стилях
- **Виключено** (не входить в MF7): debug (4), lighthouse (1), winterboard (8), board (6), classroom/board (2) = **21 файл**
- **Scope MF7: ~34 файли** — видимі користувачу

### Правила заміни

```css
/* БУЛО: */
background: white;
background: #fff;
background: #ffffff;

/* СТАЄ (для карток, панелей, модалок): */
background: var(--card-bg);

/* СТАЄ (для основного фону): */
background: var(--bg-primary);

/* СТАЄ (для hover/secondary): */
background: var(--bg-secondary);
```

**Як обирати:**
- `var(--card-bg)` — картки, модалки, поповери, тултіпи, sidebar, popover
- `var(--bg-primary)` — основний фон сторінки/секції
- `var(--bg-secondary)` — hover стани, secondary areas

### Додатково

Якщо поруч є інші хардкоджені hex (`border: 1px solid #e5e7eb`, `color: #111827`, `box-shadow: rgba(0,0,0,...)`), замінити їх теж:
- `#e5e7eb` / `#e0e0e0` → `var(--border-color)`
- `#111827` / `#1f2937` → `var(--text-primary)`
- `#6b7280` / `#9ca3af` → `var(--text-secondary)`
- `rgba(0,0,0,0.1)` → `var(--shadow-sm)` або залишити (shadow OK для обох тем)

---

## Розподіл файлів

### Агент A — Booking + Marketplace (14 файлів)

```
src/modules/booking/components/calendar/AvailabilityLegend.vue      (2 matches)
src/modules/booking/components/calendar/CalendarBoardV2.vue          (2 matches)
src/modules/booking/components/calendar/CalendarPopover.vue          (2 matches)
src/modules/booking/components/calendar/CalendarSidebar.vue          (1 match)
src/modules/booking/components/calendar/DayColumnV2.vue              (1 match)
src/modules/booking/components/calendar/TimeColumn.vue               (1 match)
src/modules/booking/components/calendar/WeekHeader.vue               (1 match)
src/modules/booking/components/modals/SlotEditorModal.vue            (1 match)
src/modules/marketplace/views/TutorProfileView.vue                   (2 matches)
src/modules/marketplace/components/TutorCalendarWidget.vue           (1 match)
src/modules/marketplace/components/catalog/AdvancedFiltersModal.vue  (2 matches)
src/modules/marketplace/components/catalog/CatalogPagination.vue     (1 match)
src/modules/matches/components/AvailabilityEditor.vue                (1 match)
src/modules/payments/components/wallet/WalletBalance.vue             (1 match)
```

### Агент B — Components + Views (16 файлів)

```
src/components/Notifications/NotificationPreferences.vue             (2 matches)
src/components/contacts/ContactLedgerModal.vue                       (2 matches)
src/components/contacts/ContactsBalanceWidget.vue                    (1 match)
src/components/contacts/DeclineStreakWarning.vue                      (1 match)
src/components/inquiries/InquiryModal.vue                            (2 matches)
src/components/inquiries/InquiryCard.vue                             (1 match)
src/components/inquiries/InquiryFormModal.vue                        (1 match)
src/components/inquiries/RecommendedTutorsSection.vue                (1 match)
src/components/inquiries/RejectInquiryModal.vue                      (1 match)
src/components/chat/MessageEditModal.vue                             (1 match)
src/components/trust/ReportModal.vue                                 (1 match)
src/components/geo/CityAutocomplete.vue                              (1 match)
src/components/ui/ConnectionStatusBar.vue                            (1 match)
src/components/ui/Toggle.vue                                         (1 match)
src/views/NotificationsView.vue                                      (4 matches)
src/views/BillingView.vue                                            (2 matches)
```

### Агент C — Onboarding + QA (4 файли + QA)

```
src/modules/onboarding/components/widgets/WelcomeBanner.vue          (1 match)
src/modules/classroom/components/board/BoardDock.vue                 (1 match — видимий UI)
src/modules/classroom/components/board/BoardCanvas.vue               (1 match — text-edit overlay)
```

Після A + B:
- QA всіх змін у 3 темах
- `npm run build`
- Створити `MF7_QA_REPORT.md`

---

## Деталі по агентах

### Агент A — Booking + Marketplace

#### A-7.1: Calendar компоненти (7 файлів)

Всі calendar компоненти мають `background: white` для карток/поповерів.

**Паттерн заміни:**
```css
/* CalendarBoardV2.vue */
background: white;  →  background: var(--card-bg);
background: #ffffff; → background: var(--card-bg);

/* CalendarPopover.vue */
background: white;  →  background: var(--card-bg);
/* + arrow теж white → var(--card-bg) */

/* CalendarSidebar, DayColumnV2, TimeColumn, WeekHeader */
background: white;  →  background: var(--card-bg);

/* AvailabilityLegend */
background: white;  →  background: var(--card-bg);
```

**Також замінити hex поруч:**
- `border: 1px solid #e0e0e0` → `border: 1px solid var(--border-color)`
- `border: 1px solid #e5e7eb` → `border: 1px solid var(--border-color)`

#### A-7.2: Modals + Marketplace (7 файлів)

```css
/* SlotEditorModal.vue */
background: white; → background: var(--card-bg);

/* AdvancedFiltersModal.vue */
background: white; → background: var(--card-bg);

/* TutorProfileView.vue */
background: white; → background: var(--card-bg);

/* TutorCalendarWidget.vue */
background: white; → background: var(--card-bg);

/* CatalogPagination.vue */
background: white; → background: var(--card-bg);

/* AvailabilityEditor.vue */
background: white; → background: var(--card-bg);

/* WalletBalance.vue */
background: white; → background: var(--card-bg);
```

#### A-7.3: `npm run build` + коміт

```
design(A-7): tokenize background:white → var(--card-bg) in booking + marketplace (14 files)
```

### DoD Агент A

- [ ] 14 файлів: `background: white/#fff` → `var(--card-bg)`
- [ ] Hex borders поруч → `var(--border-color)` де можливо
- [ ] `npm run build` OK

---

### Агент B — Components + Views

#### B-8.1: Inquiry компоненти (5 файлів)

```css
/* InquiryModal.vue, InquiryCard.vue, InquiryFormModal.vue,
   RecommendedTutorsSection.vue, RejectInquiryModal.vue */
background: white; → background: var(--card-bg);
```

#### B-8.2: Contacts + Chat + Trust (5 файлів)

```css
/* ContactLedgerModal.vue, ContactsBalanceWidget.vue,
   DeclineStreakWarning.vue, MessageEditModal.vue, ReportModal.vue */
background: white; → background: var(--card-bg);
```

#### B-8.3: UI + Notifications (4 файли)

```css
/* NotificationPreferences.vue */
background: white; → background: var(--card-bg);

/* ConnectionStatusBar.vue */
background: white; → background: var(--card-bg);

/* Toggle.vue */
background: white; → background: var(--card-bg);

/* CityAutocomplete.vue */
background: white; → background: var(--card-bg);
```

#### B-8.4: Views (2 файли)

```css
/* NotificationsView.vue — 4 matches */
background: white; → background: var(--card-bg);

/* BillingView.vue — 2 matches */
background: white; → background: var(--card-bg);
```

#### B-8.5: `npm run build` + коміт

```
design(B-8): tokenize background:white → var(--card-bg) in components + views (16 files)
```

### DoD Агент B

- [ ] 16 файлів: `background: white/#fff` → `var(--card-bg)`
- [ ] `npm run build` OK

---

### Агент C — Onboarding + QA

#### C-7.1: Залишки (3 файли)

```css
/* WelcomeBanner.vue */
background: white; → background: var(--card-bg);

/* BoardDock.vue */
background: white; → background: var(--card-bg);

/* BoardCanvas.vue — text-edit overlay */
background: white; → background: var(--card-bg);
```

#### C-7.2: QA

| # | Перевірка |
|---|-----------|
| C-7.2.1 | Booking calendar — 3 теми |
| C-7.2.2 | Marketplace — TutorProfileView, AdvancedFiltersModal — 3 теми |
| C-7.2.3 | Inquiries — модалки — 3 теми |
| C-7.2.4 | Contacts — модалки — 3 теми |
| C-7.2.5 | NotificationsView — 3 теми |
| C-7.2.6 | BillingView — 3 теми |
| C-7.2.7 | `npm run build` фінальний |
| C-7.2.8 | Створити `MF7_QA_REPORT.md` |

### DoD Агент C

- [ ] 3 файли токенізовані
- [ ] QA всіх змін у 3 темах
- [ ] `npm run build` OK
- [ ] `MF7_QA_REPORT.md` створено

---

## Розподіл файлів — НУЛЬ ПЕРЕТИНІВ

```
Агент A (14 файлів):
  src/modules/booking/components/calendar/AvailabilityLegend.vue
  src/modules/booking/components/calendar/CalendarBoardV2.vue
  src/modules/booking/components/calendar/CalendarPopover.vue
  src/modules/booking/components/calendar/CalendarSidebar.vue
  src/modules/booking/components/calendar/DayColumnV2.vue
  src/modules/booking/components/calendar/TimeColumn.vue
  src/modules/booking/components/calendar/WeekHeader.vue
  src/modules/booking/components/modals/SlotEditorModal.vue
  src/modules/marketplace/views/TutorProfileView.vue
  src/modules/marketplace/components/TutorCalendarWidget.vue
  src/modules/marketplace/components/catalog/AdvancedFiltersModal.vue
  src/modules/marketplace/components/catalog/CatalogPagination.vue
  src/modules/matches/components/AvailabilityEditor.vue
  src/modules/payments/components/wallet/WalletBalance.vue

Агент B (16 файлів):
  src/components/Notifications/NotificationPreferences.vue
  src/components/contacts/ContactLedgerModal.vue
  src/components/contacts/ContactsBalanceWidget.vue
  src/components/contacts/DeclineStreakWarning.vue
  src/components/inquiries/InquiryModal.vue
  src/components/inquiries/InquiryCard.vue
  src/components/inquiries/InquiryFormModal.vue
  src/components/inquiries/RecommendedTutorsSection.vue
  src/components/inquiries/RejectInquiryModal.vue
  src/components/chat/MessageEditModal.vue
  src/components/trust/ReportModal.vue
  src/components/geo/CityAutocomplete.vue
  src/components/ui/ConnectionStatusBar.vue
  src/components/ui/Toggle.vue
  src/views/NotificationsView.vue
  src/views/BillingView.vue

Агент C (3 файли + QA):
  src/modules/onboarding/components/widgets/WelcomeBanner.vue
  src/modules/classroom/components/board/BoardDock.vue
  src/modules/classroom/components/board/BoardCanvas.vue
  docs/design-system/MF7_QA_REPORT.md (створити)
```

---

## Що НЕ входить в MF7

| Елемент | Кількість | Причина |
|---------|-----------|---------|
| `booking/debug/*` | 4 файли | Dev-only, не видно користувачу |
| `__lighthouse__/*` | 1 файл | Test-only |
| `winterboard/*` | 8 файлів | Canvas-specific, окремий DS |
| `board/*` | 6 файлів | Canvas-specific |
| Hex кольори (не background) | ~250 файлів | Окрема фаза (MF8) |
| Raw `<textarea>` | 52 файли | Окрема фаза (MF9) |
| Overlay модалки | 1 файл | ChatModal — окрема фаза |

---

## Фінальні метрики

| Метрика | Було (MF6) | Ціль MF7 | Перевірка |
|---------|-----------|----------|-----------|
| `background: white` (user-facing) | 34 | 0 | `grep -rl 'background:\s*white' src/` |
| Build | OK | OK | `npm run build` |

---

## Після MF7

Наступні кроки (backlog):
- **MF8**: Hex sweep — `#e5e7eb` → `var(--border-color)`, `#111827` → `var(--text-primary)` тощо
- **MF9**: `<textarea>` → `<Textarea>` компонент
- **MF10**: Winterboard/Board DS токенізація

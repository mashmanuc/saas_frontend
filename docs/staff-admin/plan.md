# Staff Admin Console — Plan

> **Meta:** v1.0 | 2026-02-21
> **Goal:** Довести адмін-панель до рівня основної платформи

---

## Поточний стан (AS-IS)

### Frontend (`modules/staff/`)
| Сторінка | Рівень | Проблеми |
|----------|--------|----------|
| StaffDashboard | 2/10 | 1 тайл, 0 метрик, 0 пошуку, 0 графіків |
| StaffReportsView | 4/10 | Базова таблиця, raw `<select>`, немає пагінації, немає деталей |
| StaffUserOverviewView | 6/10 | Функціональний, але сирий дизайн, raw forms, no breadcrumbs |
| TutorActivityManagement | 7/10 | Найкращий — фільтри, пагінація, exemptions |
| StaffLayout | 3/10 | Тільки 2 nav-links у header, no sidebar, no breadcrumbs |

### Backend (`apps/staff/`, `apps/operator/`)
| Ресурс | Рівень | Примітка |
|--------|--------|----------|
| User Overview | 9/10 | trust + billing + activity |
| Reports CRUD | 8/10 | list/detail/resolve, audit |
| Bans CRUD | 9/10 | create/lift, audit, scopes |
| Billing Ops | 9/10 | snapshot, preview, finalize |
| Tutor Activity | 8/10 | list + exemptions |
| System Health | 7/10 | notifications, telemetry, cache, ws, sessions |
| **User Search** | 0/10 | **НЕ ІСНУЄ** |
| **Dashboard Stats** | 0/10 | **НЕ ІСНУЄ** |

---

## Target (TO-BE)

Професійна адмін-панель з:
- **Sidebar navigation** з секціями та іконками
- **Dashboard** з KPI-картками, графіками, останніми подіями
- **Global User Search** — пошук по email/name з автокомплітом
- **User Overview** — полірований UI з Card/Badge/Button компонентами
- **Reports Console** — розширена таблиця з timeline, bulk actions, деталями
- **System Health** — інтеграція operator console
- **i18n** — всі тексти в uk.json/en.json
- **Responsive** — mobile-friendly
- **3 теми** — Light/Dark/Classic через CSS tokens

---

## Архітектура

```
modules/staff/
├── layouts/
│   └── StaffLayout.vue          # REWRITE: sidebar + topbar + breadcrumbs
├── views/
│   ├── StaffDashboard.vue       # REWRITE: KPI cards + charts + search + recent
│   ├── StaffReportsView.vue     # REWRITE: DataTable + filters + pagination + detail panel
│   ├── StaffUserOverviewView.vue # UPGRADE: Card sections + design system components
│   ├── StaffUsersListView.vue   # NEW: searchable user list with filters
│   ├── TutorActivityManagement.vue # MINOR: align with design system
│   ├── StaffBillingView.vue     # NEW: pending sessions overview
│   └── StaffSystemHealthView.vue # NEW: operator health + telemetry
├── components/
│   ├── StaffSidebar.vue         # NEW: sidebar navigation
│   ├── StaffBreadcrumbs.vue     # NEW: breadcrumb trail
│   ├── UserSearchBar.vue        # NEW: global search with dropdown
│   ├── StatCard.vue             # NEW: KPI metric card
│   ├── RecentActivityFeed.vue   # NEW: last N audit events
│   ├── ReportTimelineCard.vue   # NEW: report history timeline
│   ├── SystemHealthCard.vue     # NEW: subsystem health indicator
│   ├── UserQuickCard.vue        # NEW: compact user info card for search results
│   ├── GrantExemptionModal.vue  # KEEP
│   ├── ReportDetailsModal.vue   # UPGRADE: richer layout
│   ├── UserBillingOpsPanel.vue  # KEEP
│   ├── FinalizeModal.vue        # KEEP
│   └── DevModeBadge.vue         # KEEP
├── api/
│   ├── staffApi.ts              # EXTEND: user search + stats endpoints
│   ├── billingOpsApi.ts         # KEEP
│   └── staffStatsApi.ts         # NEW: dashboard stats
├── composables/
│   └── useStaffStats.ts         # NEW: polling/refresh for stats
└── types/
    └── staff.ts                 # EXTEND: new DTOs
```

---

## Фази реалізації

---

### Фаза 0: Backend — нові endpoints (FOUNDATION)

**Мета:** Створити API для dashboard stats та user search.

#### BE-0.1: Staff Stats Overview endpoint
**Файл:** `backend/apps/staff/api/stats_views.py` (NEW)
```
GET /api/v1/staff/stats/overview/
Response: {
  users: { total, students, tutors, staff, new_7d, new_30d },
  billing: { active_subscriptions, pro_count, business_count, pending_sessions, trial_active },
  trust: { open_reports, active_bans, suspicious_open },
  activity: { active_tutors, inactive_tutors, exempted_tutors }
}
```
- Використовує `User.objects.filter().aggregate()`, `Subscription.objects`, `UserReport.objects`, `UserBan.objects`
- Permission: `IsStaffAdmin`
- Cache: 60 секунд (redis)
- **Складність:** 3-4 години

#### BE-0.2: User Search endpoint
**Файл:** `backend/apps/staff/api/user_search_views.py` (NEW)
```
GET /api/v1/staff/users/search/?q=john&role=STUDENT&limit=20&offset=0
Response: {
  count: 142,
  results: [
    { id, email, first_name, last_name, role, is_active, created_at, avatar_small,
      has_active_ban, open_reports_count, subscription_plan }
  ]
}
```
- Пошук по: `email__icontains`, `first_name__icontains`, `last_name__icontains`
- Фільтри: `role`, `is_active`, `created_at__gte/lte`
- Annotate: active bans count, open reports count, subscription plan
- Permission: `IsStaffAdmin`
- **Складність:** 3-4 години

#### BE-0.3: Staff Billing Summary endpoint
**Файл:** додати в `stats_views.py`
```
GET /api/v1/staff/stats/billing/
Response: {
  subscriptions_by_plan: { PRO: 45, BUSINESS: 12 },
  subscriptions_by_status: { ACTIVE: 50, TRIALING: 7, CANCELED: 15 },
  pending_checkouts: [ { order_id, user_email, plan, pending_age_seconds, created_at } ],
  recent_payments: [ { user_email, amount, currency, status, created_at } ]
}
```
- **Складність:** 2-3 години

#### BE-0.4: URL registration
**Файл:** `backend/apps/staff/api/urls.py` (MODIFY)
- Додати 3 нових URL patterns
- **Складність:** 15 хвилин

**Фаза 0 Total: ~8-10 годин**

---

### Фаза 1: Layout & Navigation (SKELETON)

**Мета:** Замінити мінімальний header на повноцінний sidebar layout.

#### F1.1: StaffSidebar.vue (NEW)
Бічна панель з секціями:
```
── Overview
   ├── Dashboard
   └── Users
── Operations
   ├── Reports
   ├── Tutor Activity
   └── Billing
── System
   ├── Health
   └── Audit Log (future)
```
- Collapsible на mobile (hamburger menu)
- Active route highlighting
- Badge з кількістю open reports
- Секції з іконками (SVG inline)
- Використовує CSS tokens (--bg-secondary, --border-color, --accent)

#### F1.2: StaffBreadcrumbs.vue (NEW)
- Auto-generated з route.matched
- Clickable path segments
- User name в breadcrumb для `/staff/users/:id`

#### F1.3: StaffLayout.vue (REWRITE)
```
┌────────────────────────────────────────────┐
│ TopBar: Logo | Search Bar | User avatar    │
├──────────┬─────────────────────────────────┤
│          │ Breadcrumbs                     │
│ Sidebar  │─────────────────────────────────│
│          │ <router-view />                 │
│          │                                 │
└──────────┴─────────────────────────────────┘
```
- Sidebar: fixed 260px, collapsible на <1024px
- TopBar: sticky, з UserSearchBar
- Content area: max-width 1400px, responsive padding
- Mobile: sidebar → overlay drawer

#### F1.4: Router updates
- Додати нові routes: `staff-users`, `staff-billing`, `staff-health`
- Оновити meta для breadcrumbs (додати `title` field)

**Фаза 1 Total: ~6-8 годин**

---

### Фаза 2: Dashboard з метриками (DASHBOARD)

**Мета:** Головна сторінка зі stat cards, графіками, recent activity.

#### F2.1: StatCard.vue (NEW)
Універсальна KPI-картка:
```
┌─────────────────────┐
│ 📊  1,247           │
│ Всього користувачів │
│ +12% за 7 днів      │
└─────────────────────┘
```
- Props: `icon`, `value`, `label`, `trend` (optional), `color`
- Skeleton loading state
- Click → navigate to detail page
- CSS tokens, 3 themes

#### F2.2: staffStatsApi.ts (NEW)
```typescript
getStatsOverview(): Promise<StatsOverview>
getStatsBilling(): Promise<StatsBilling>
```

#### F2.3: useStaffStats.ts (NEW composable)
- Auto-refresh кожні 5 хвилин
- Loading/error state management
- Cache в memory

#### F2.4: RecentActivityFeed.vue (NEW)
- Останні 10-15 audit events
- Іконки по типу (auth, billing, trust, marketplace)
- Relative time ("5 хв тому")
- Click → navigate to user or entity

#### F2.5: StaffDashboard.vue (REWRITE)
Layout:
```
┌────────┬────────┬────────┬────────┐
│ Users  │ Subs   │ Reports│ Tutors │  ← StatCards row
├────────┴────────┼────────┴────────┤
│                 │                 │
│ Quick Search    │ Recent Activity │
│ (UserSearchBar) │ (ActivityFeed)  │
│                 │                 │
├─────────────────┼─────────────────┤
│ Pending Billing │ System Health   │
│ (top 5 stuck)   │ (health cards)  │
└─────────────────┴─────────────────┘
```

Stat cards (row 1):
1. **Користувачі** — total + new_7d trend
2. **Підписки** — active + breakdown tooltip
3. **Відкриті скарги** — open_reports (red if > 0)
4. **Репетитори** — active vs inactive vs exempted

Quick sections:
- **Quick Search** — UserSearchBar з instant results
- **Recent Activity** — RecentActivityFeed
- **Pending Billing** — top 5 stuck checkout sessions з pending_age
- **System Health** — 4 mini-cards (notifications, cache, ws, sessions)

**Фаза 2 Total: ~8-10 годин**

---

### Фаза 3: User Search & Users List (SEARCH)

**Мета:** Глобальний пошук юзерів та повноцінна сторінка списку.

#### F3.1: UserSearchBar.vue (NEW)
- Input з іконкою пошуку в topbar
- Debounced search (300ms)
- Dropdown з результатами (max 8)
- Кожен результат: avatar + name + email + role badge
- Click → `/staff/users/:id`
- "Показати всіх" → `/staff/users?q=...`
- Keyboard navigation (↑↓ Enter Esc)
- Closes on click outside

#### F3.2: UserQuickCard.vue (NEW)
Compact card для search results:
```
┌──────────────────────────────────────┐
│ 👤 Іван Петренко       STUDENT      │
│    ivan@example.com    ⚠️ 1 ban     │
└──────────────────────────────────────┘
```

#### F3.3: StaffUsersListView.vue (NEW)
Повноцінна сторінка пошуку:
```
┌──────────────────────────────────────────┐
│ Користувачі                    [Export]  │
├──────────────────────────────────────────┤
│ 🔍 Search...  | Role ▾ | Status ▾ |     │
├──────────────────────────────────────────┤
│ # │ Avatar │ Name+Email │ Role │ Bans │→ │
│ 1 │   👤   │ Іван...    │ STU  │  0   │→ │
│ 2 │   👤   │ Олена...   │ TUT  │  1   │→ │
├──────────────────────────────────────────┤
│ ← 1 2 3 ... 15 →         142 results    │
└──────────────────────────────────────────┘
```
- Filters: role, is_active, date range
- Sortable columns (created_at, role)
- Click row → `/staff/users/:id`
- Pagination (20 per page)
- Loading skeleton

#### F3.4: staffApi.ts (EXTEND)
```typescript
searchUsers(params: UserSearchParams): Promise<PaginatedResponse<StaffUserListItem>>
```

**Фаза 3 Total: ~6-8 годин**

---

### Фаза 4: User Overview upgrade (POLISH)

**Мета:** Замінити сирий UI на полірований з Card/Badge/Button.

#### F4.1: StaffUserOverviewView.vue (UPGRADE)
Layout з Card:
```
┌─────────────────────────────────────────────┐
│ ← Users    Іван Петренко                    │
│            ivan@example.com   STUDENT  ✅    │
├─────────────────────────────────────────────┤
│                                             │
│ ┌──── User Info ────┐ ┌──── Activity ─────┐ │
│ │ ID: 1234          │ │ 📨 12 inquiries   │ │
│ │ Created: 01.02.26 │ │ 🔓 5 unlocked    │ │
│ │ Phone: +380...    │ │ Last: 2 days ago  │ │
│ └───────────────────┘ └───────────────────┘ │
│                                             │
│ ┌──── Trust & Safety ───────────────────────┐│
│ │ 🔴 1 active ban  │  📋 2 open reports    ││
│ │ ┌─ BAN: CONTACTS ── ACTIVE ─────────┐    ││
│ │ │ Reason: spam    Ends: permanent    │    ││
│ │ │                          [Lift Ban]│    ││
│ │ └───────────────────────────────────┘    ││
│ │                                          ││
│ │ [+ Create Ban]                           ││
│ └──────────────────────────────────────────┘│
│                                             │
│ ┌──── Billing ──────────────────────────────┐│
│ │ Plan: PRO  Status: ACTIVE  Period end:.. ││
│ │ [Cancel at period end] [Cancel immediate]││
│ │                                          ││
│ │ ──── Billing Operations ────             ││
│ │ (UserBillingOpsPanel)                    ││
│ └──────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```
- Використовувати `<Card>`, `<Badge>`, `<Button>`, `<FormField>`, `<Select>`, `<Textarea>`
- Замінити raw `<select>`, `<input>`, `<textarea>` на UI компоненти
- ConfirmModal замість `window.confirm()` для cancel billing
- Avatar + role badge у header
- Breadcrumbs: Staff → Users → Іван Петренко
- Loading skeleton для кожної секції

#### F4.2: Ban form redesign
- Замінити raw form на FormField + Select + Textarea + Button
- Inline validation
- ConfirmModal для lift ban

**Фаза 4 Total: ~4-6 годин**

---

### Фаза 5: Reports Console upgrade (REPORTS)

**Мета:** Професійна таблиця скарг з деталями та timeline.

#### F5.1: StaffReportsView.vue (REWRITE)
```
┌──────────────────────────────────────────────────┐
│ Скарги                          Open: 5  Total: 87│
├──────────────────────────────────────────────────┤
│ Status ▾ │ Category ▾ │ Date range │ 🔍 Search   │
├──────────────────────────────────────────────────┤
│ │ Reporter │ Target │ Category │ Date │ Status │→ │
│ │ Іван...  │ Олена..│ SPAM     │ 21.02│ 🟡 OPEN│→ │
│ │ Петро... │ Марія..│ FRAUD    │ 20.02│ ✅ DONE│  │
├──────────────────────────────────────────────────┤
│ ← 1 2 3 →                              87 total  │
└──────────────────────────────────────────────────┘
```
- Filters: status (pills), category (Select), date range, search
- Status pills: OPEN (yellow), DISMISSED (gray), ACTIONED (green)
- Click row → expand detail panel (right side or inline)
- Pagination
- Loading skeleton
- Empty state з EmptyState component

#### F5.2: ReportDetailsModal.vue (UPGRADE)
- Full-width modal (size="lg")
- Sections: Reporter info, Target info, Report details, Timeline
- Timeline: created → reviewed → resolved (з датами та staff notes)
- Actions: Dismiss (з note) | Action (з note) | View user → link

#### F5.3: ReportTimelineCard.vue (NEW)
- Vertical timeline visualization
- Events: Created, Assigned, Note added, Resolved
- Staff name + timestamp for each event

**Фаза 5 Total: ~6-8 годин**

---

### Фаза 6: Billing Overview & System Health (OPERATIONS)

**Мета:** Окремі сторінки для billing та system health.

#### F6.1: StaffBillingView.vue (NEW)
```
┌────────────────────────────────────────────┐
│ Billing Overview                           │
├────────────────────────────────────────────┤
│ ┌── PRO ──┐ ┌── BUS ──┐ ┌── Trial ──┐    │
│ │   45    │ │   12    │ │    7      │    │
│ │ active  │ │ active  │ │ trialing  │    │
│ └─────────┘ └─────────┘ └──────────┘    │
├────────────────────────────────────────────┤
│ Pending Checkout Sessions (stuck)          │
│ ┌──────────────────────────────────────┐   │
│ │ Order │ User │ Plan │ Pending │ Act. │   │
│ │ ABC.. │ ivan │ PRO  │ 2h 15m  │ [▶] │   │
│ └──────────────────────────────────────┘   │
├────────────────────────────────────────────┤
│ Recent Payments                            │
│ (last 20 payments table)                   │
└────────────────────────────────────────────┘
```

#### F6.2: StaffSystemHealthView.vue (NEW)
```
┌────────────────────────────────────────────┐
│ System Health                              │
├────────────┬────────────┬─────────────────┤
│ 🟢 Notif.  │ 🟢 Cache   │ 🟡 Telemetry   │
│ Queue: 0   │ Hit: 94%   │ Lag: 5s        │
├────────────┴────────────┴─────────────────┤
│ Active Sessions: 142                       │
│ WebSocket Hosts: ws1, ws2                  │
├────────────────────────────────────────────┤
│ Operator Actions                           │
│ [Force Publish] [Clear Cache] [Replay DLQ] │
├────────────────────────────────────────────┤
│ Telemetry Chart (last 24h)                 │
│ (TelemetryChart component)                 │
└────────────────────────────────────────────┘
```

#### F6.3: SystemHealthCard.vue (NEW)
- Status indicator (green/yellow/red)
- Metric name + value
- Tooltip з деталями

**Фаза 6 Total: ~6-8 годин**

---

### Фаза 7: i18n + Polish + QA (FINISH)

**Мета:** Переклади, фінальна полірація, тестування.

#### F7.1: i18n keys
Додати всі нові ключі в `src/i18n/locales/uk.json` та `en.json`:
```
staff.sidebar.*         — навігація sidebar
staff.dashboard.*       — KPI cards, search, sections
staff.users.*           — users list, search, filters
staff.userOverview.*    — оновлені секції (деякі вже є)
staff.reports.*         — оновлені (деякі вже є)
staff.billing.*         — billing overview
staff.health.*          — system health
staff.breadcrumbs.*     — breadcrumb labels
```

#### F7.2: TutorActivityManagement.vue (MINOR)
- Замінити raw `<button>` на `<Button>`
- Замінити raw `<input>` на `<Input>`
- Замінити raw `<select>` на `<Select>`
- Hardcoded Tailwind classes → CSS tokens

#### F7.3: Visual QA
- [ ] Перевірити всі 7 сторінок у 3 темах (Light, Dark, Classic)
- [ ] Перевірити responsive: 375px, 768px, 1024px, 1440px
- [ ] Перевірити empty states
- [ ] Перевірити loading states
- [ ] Перевірити error states
- [ ] Перевірити navigation flow (sidebar → pages → breadcrumbs)
- [ ] Перевірити search (empty, no results, results, click result)

#### F7.4: Cleanup
- Видалити старий `AdminDashboard.vue` якщо він дублює функціонал
- Прибрати невикористані styles
- Перевірити TypeScript типи

**Фаза 7 Total: ~4-6 годин**

---

## Залежності між фазами

```
Фаза 0 (Backend) ──┬──→ Фаза 2 (Dashboard) ──→ Фаза 7 (QA)
                    │
                    ├──→ Фаза 3 (Search)     ──→ Фаза 7 (QA)
                    │
Фаза 1 (Layout)  ──┤
                    │
                    ├──→ Фаза 4 (User Overview) → Фаза 7 (QA)
                    │
                    ├──→ Фаза 5 (Reports)    ──→ Фаза 7 (QA)
                    │
                    └──→ Фаза 6 (Operations) ──→ Фаза 7 (QA)
```

**Критичний шлях:** Фаза 0 → Фаза 1 → Фаза 2 → Фаза 7

**Паралельно після Фаз 0+1:**
- Фаза 2 + Фаза 3 (можуть паралельно)
- Фаза 4 + Фаза 5 + Фаза 6 (можуть паралельно)

---

## Оцінка часу

| Фаза | Опис | Годин | Паралельність |
|------|------|-------|---------------|
| 0 | Backend endpoints | 8-10 | Перша |
| 1 | Layout & Navigation | 6-8 | Після 0, паралельно з 0 |
| 2 | Dashboard | 8-10 | Після 0+1 |
| 3 | User Search | 6-8 | Після 0+1, паралельно з 2 |
| 4 | User Overview upgrade | 4-6 | Після 1, паралельно з 2/3 |
| 5 | Reports upgrade | 6-8 | Після 1, паралельно з 2/3/4 |
| 6 | Billing & Health | 6-8 | Після 0+1, паралельно з 2-5 |
| 7 | i18n + QA | 4-6 | Остання |
| **Total** | | **48-64** | |

**При послідовній роботі:** ~5-7 робочих днів
**При паралельній (2-3 агенти):** ~2-3 робочі дні

---

## Commit Strategy

Кожна фаза — окремий коміт (або серія) для safe rollback:
```
feat(staff): BE-0 — stats overview + user search + billing summary endpoints
feat(staff): F1 — sidebar layout + breadcrumbs + navigation
feat(staff): F2 — dashboard with KPI cards + search + recent activity
feat(staff): F3 — user search bar + users list page
refactor(staff): F4 — user overview UI polish (Card/Badge/Button)
refactor(staff): F5 — reports console upgrade (DataTable + timeline)
feat(staff): F6 — billing overview + system health pages
chore(staff): F7 — i18n keys + visual QA + cleanup
```

---

## Нові файли (всього ~20)

### Backend (4 файли):
```
apps/staff/api/stats_views.py          # Dashboard stats + billing summary
apps/staff/api/user_search_views.py    # User search + list endpoint
apps/staff/serializers/stats_serializers.py  # Optional: DRF serializers
apps/staff/api/urls.py                 # MODIFY: add new URLs
```

### Frontend (16 файлів):
```
modules/staff/layouts/StaffLayout.vue       # REWRITE
modules/staff/views/StaffDashboard.vue      # REWRITE
modules/staff/views/StaffReportsView.vue    # REWRITE
modules/staff/views/StaffUserOverviewView.vue # UPGRADE
modules/staff/views/StaffUsersListView.vue  # NEW
modules/staff/views/StaffBillingView.vue    # NEW
modules/staff/views/StaffSystemHealthView.vue # NEW
modules/staff/components/StaffSidebar.vue   # NEW
modules/staff/components/StaffBreadcrumbs.vue # NEW
modules/staff/components/UserSearchBar.vue  # NEW
modules/staff/components/StatCard.vue       # NEW
modules/staff/components/RecentActivityFeed.vue # NEW
modules/staff/components/ReportTimelineCard.vue # NEW
modules/staff/components/SystemHealthCard.vue # NEW
modules/staff/components/UserQuickCard.vue  # NEW
modules/staff/api/staffStatsApi.ts          # NEW
modules/staff/composables/useStaffStats.ts  # NEW
```

---

## Ризики

| Ризик | Ймовірність | Мітігація |
|-------|-------------|-----------|
| Backend stats query повільний | Середня | Redis cache 60s |
| User search по email без індексу | Низька | email вже indexed (unique) |
| Sidebar ламає mobile UX | Середня | Overlay drawer + тестування |
| i18n ключі не повні | Висока | Dedicated pass в Фазі 7 |
| TutorActivity стилі конфліктують | Низька | Scoped styles + postupовий рефакторинг |

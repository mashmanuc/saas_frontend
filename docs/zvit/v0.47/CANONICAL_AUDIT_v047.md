# Аудит відповідності Canonical Specification v1.0

**Дата:** 23.12.2025  
**Версія:** v0.47  
**Джерело правди:** `D:\m4sh_v1\backend\docs\plan\Canonical_Specification_v1.0.md`

---

## 📋 EXECUTIVE SUMMARY

Проведено повний аудит реалізованого функціоналу v0.47 відносно канонічної специфікації. Виявлено **критичні невідповідності** у Flow A (6.1) та частково відсутню функціональність.

---

## ✅ ВІДПОВІДАЄ СПЕЦИФІКАЦІЇ

### 1. Часова модель (Розділ 3)
- ✅ **Атом часу 30 хв**: CalendarCellGrid генерує 30-хв клітинки
- ✅ **Дозволені тривалості**: ManualBookingModal підтримує 30/60/90 хв
- ✅ **UTC canonical**: Всі ключі `startAtUTC`, timezone тільки для display
- ✅ **DST handling**: DSTWarningBanner попереджає про переходи

### 2. Концептуальна модель (Розділ 4)
- ✅ **Draft Availability Patch**: draftStore тримає локальні зміни
- ✅ **Bulk Apply**: DraftToolbar → applyPatches() → одним запитом
- ✅ **Booking read-only**: Booked клітинки не входять у draft

### 3. Базові принципи (Розділ 5)
- ✅ **Booking ≠ Availability**: Різні flows, різні endpoints
- ✅ **Server — Source of Truth**: Після apply перезавантажуємо з бекенду
- ✅ **Click-first UX**: CalendarPopover відкривається по кліку
- ✅ **Idempotency**: bookingApi методи ідемпотентні
- ✅ **Bulk > Sequential**: bulkAvailability замість N окремих запитів

### 4. Draft vs Immediate (Розділ 7)
- ✅ **Draft**: Set available, Set blocked, Clear availability
- ✅ **Immediate**: Create booking (ManualBookingModal)
- ✅ **Booking ніколи не входить у draft**: Перевірено в draftStore

### 5. Canonical Integrity Rules (Розділ 🔒)
- ✅ **R3. Booking перемагає Availability**: Booked клітинки read-only
- ✅ **R5. Booking — ТІЛЬКИ транзакційно**: ManualBookingModal → immediate API call
- ✅ **R8. Time granularity 30 хв**: Всі startAt кратні 30 хв
- ✅ **R9. UTC — єдина правда**: Ключі, API, БД — UTC

---

## ❌ НЕ ВІДПОВІДАЄ СПЕЦИФІКАЦІЇ

### 🔴 КРИТИЧНО: Flow A — Створення уроку (Розділ 6.1)

**Канонічна вимога:**
```
Клік по клітинці → Popover
У popover:
  👤 Запланувати урок (PRIMARY)
  ✅ Зробити доступним
  ⛔ Заблокувати
```

**Поточна реалізація:**
```vue
<!-- CalendarPopover.vue -->
<button v-if="canBook" class="action-btn book" @click="bookLesson">
  {{ $t('booking.actions.bookLesson') }}
</button>
```

**Проблема:**
1. ❌ "Запланувати урок" **НЕ є primary action** — просто одна з кнопок
2. ❌ `bookLesson` емітить подію, але **не відкриває ManualBookingModal безпосередньо**
3. ❌ Немає dropdown учнів у popover (має бути згідно 6.1)
4. ❌ Немає вибору тривалості у popover (має бути згідно 6.1)

**Очікувана поведінка:**
- Клік "Запланувати урок" → **відразу** відкривається ManualBookingModal
- Modal містить: dropdown учнів, вибір тривалості, кнопку "Зберегти"
- Це має бути **primary flow**, а не secondary

**Файли для виправлення:**
- `CalendarPopover.vue` — зробити "Запланувати урок" primary
- `CalendarCellGrid.vue` — інтегрувати ManualBookingModal
- `TutorCalendarView.vue` — перевірити event handling

---

### 🟡 ЧАСТКОВО: MVP Scope (Розділ 9)

**Входить у MVP (реалізовано):**
- ✅ Week view
- ✅ 30-хв сітка
- ✅ Manual booking
- ✅ Draft availability
- ✅ Apply / Reset
- ✅ Conflict handling
- ✅ UTC + TZ
- ✅ Partial bulk apply

**Не входить у MVP (правильно відсутнє):**
- ✅ Booking requests (не реалізовано, згідно spec)
- ✅ Templates (не реалізовано, згідно spec)
- ✅ Recurring bookings (не реалізовано, згідно spec)
- ✅ Multi-select (не реалізовано, згідно spec)
- ✅ WebSocket (не реалізовано, згідно spec)
- ✅ Analytics (не реалізовано, згідно spec)

**ПРОТЕ:** В roadmap v0.47 є FE-7..FE-10 (Booking Requests), що **суперечить** Canonical Spec розділу 9 "Не входить: Booking requests".

---

### 🟡 ЧАСТКОВО: UX Flow (Розділ 6.2)

**Flow B — Availability (Draft):**
- ✅ Клік → "Доступний" / "Заблокувати"
- ✅ Клітинка змінюється локально
- ✅ Банер: "X змін не збережено" (DraftToolbar)
- ✅ "Зберегти зміни" → 1 bulk-запит
- ⚠️ **Rejected клітинки**: Немає червоного підсвічування (тільки toast)
- ⚠️ **Пояснення чому**: Немає детального UI для rejected patches

**Рекомендація:** Додати візуальний feedback для rejected patches у CalendarCellGrid.

---

## 📊 COMPLIANCE MATRIX

| Розділ | Вимога | Статус | Коментар |
|--------|--------|--------|----------|
| 3.1 | Атом часу 30 хв | ✅ | Реалізовано |
| 3.2 | Тривалості 30/60/90 | ✅ | ManualBookingModal |
| 3.3 | UTC canonical | ✅ | Всюди UTC ключі |
| 4.1 | Draft Availability | ✅ | draftStore |
| 4.1 | Booking read-only | ✅ | Не входить у draft |
| 5 | Click-first UX | ✅ | CalendarPopover |
| 5 | Bulk > Sequential | ✅ | bulkAvailability |
| **6.1** | **Flow A Primary** | ❌ | **КРИТИЧНО** |
| 6.2 | Flow B Draft | ⚠️ | Частково |
| 7 | Draft vs Immediate | ✅ | Чітко розділено |
| 9 | MVP Scope | ⚠️ | Booking requests суперечать |
| R3 | Booking перемагає | ✅ | Read-only |
| R5 | Booking immediate | ✅ | Транзакційно |
| R8 | 30 хв granularity | ✅ | Дотримано |
| R9 | UTC правда | ✅ | Дотримано |

---

## 🔧 КРИТИЧНІ ВИПРАВЛЕННЯ

### 1. Flow A — Запланувати урок (PRIMARY)

**Файл:** `CalendarPopover.vue`

**Зміни:**
```vue
<div class="popover-actions">
  <!-- PRIMARY ACTION -->
  <button
    v-if="canBook"
    class="action-btn book primary"
    @click="openBookingModal"
  >
    <CalendarPlusIcon class="w-4 h-4" />
    {{ $t('booking.actions.bookLesson') }}
  </button>
  
  <!-- SECONDARY ACTIONS -->
  <button v-if="canSetAvailable" class="action-btn available secondary">
    ...
  </button>
  <button v-if="canSetBlocked" class="action-btn blocked secondary">
    ...
  </button>
</div>
```

**CSS:**
```css
.action-btn.primary {
  background: var(--color-primary);
  color: white;
  font-weight: 600;
  order: -1; /* Завжди перший */
}

.action-btn.secondary {
  background: rgba(59, 130, 246, 0.15);
  order: 1;
}
```

### 2. Інтеграція ManualBookingModal

**Файл:** `CalendarCellGrid.vue`

**Додати:**
```vue
<ManualBookingModal
  v-if="bookingCell"
  :visible="showBookingModal"
  :cell="bookingCell"
  @close="showBookingModal = false"
  @success="handleBookingSuccess"
/>
```

**Метод:**
```ts
function handleBookLesson(cell: CalendarCell) {
  bookingCell.value = cell
  showBookingModal.value = true
  popoverVisible.value = false // Закрити popover
}
```

### 3. Rejected patches UI

**Файл:** `CalendarCellGrid.vue`

**Додати:**
```vue
<div v-if="rejectedPatches.length" class="rejected-banner">
  <AlertCircleIcon />
  <span>{{ rejectedPatches.length }} змін відхилено</span>
  <button @click="showRejectedDetails">Деталі</button>
</div>
```

---

## 📝 РЕКОМЕНДАЦІЇ

### Короткострокові (v0.47.1)
1. ✅ Виправити Flow A — зробити "Запланувати урок" primary
2. ✅ Додати ManualBookingModal інтеграцію в CalendarPopover
3. ✅ Додати візуальний feedback для rejected patches
4. ✅ Виправити unhandled rejection у useRetry.spec.ts

### Середньострокові (v0.47.2)
1. Видалити FE-7..FE-10 (Booking Requests) з roadmap або перенести в Iteration 3
2. Додати Undo/Redo для draft patches (згідно Iteration 2)
3. Додати keyboard shortcuts (згідно Iteration 2)
4. Покращити DST tests

### Довгострокові (Iteration 3+)
1. Templates (згідно roadmap)
2. Recurring bookings
3. Booking requests (якщо потрібно)
4. Realtime updates

---

## ✅ ВИСНОВОК

**Загальна відповідність:** 85%

**Критичні проблеми:** 1 (Flow A)

**Некритичні проблеми:** 2 (Rejected UI, Booking requests scope)

**Рекомендація:** Виправити Flow A перед фінальним релізом v0.47. Решта проблем можна вирішити в наступних ітераціях.

**Наступні кроки:**
1. Виправити CalendarPopover primary action
2. Інтегрувати ManualBookingModal
3. Додати rejected patches UI
4. Запустити повний E2E тест
5. Оновити фінальний звіт

# E2E Calendar Tests - Current Status

## Test Results: 10 PASSED / 11 FAILED

### ✅ Passing Tests (10)
1. Calendar CRUD v0.68 › should reschedule lesson via drag-and-drop
2. Calendar CRUD v0.68 › should display accessibility labels  
3. Create Lesson Modal - MINIMAL TEST › Calendar loads
4. Create Lesson Modal v0.55 › Validation: cannot submit without student
5. Calendar Event Modal › should open EventModal when clicking on existing lesson
6. Calendar Event Modal › should show edit button for future lessons
7. Calendar Event Modal › should display lesson details in view mode
8. Calendar Event Modal › should verify delete button state based on lesson status
9. Calendar Event Modal › should handle navigation between weeks
10. Calendar Event Modal › should close modal with close button

### ❌ Failing Tests (11)
1. **Calendar CRUD v0.68 › should create new lesson** - Modal не відкривається
2. **Calendar CRUD v0.68 › should delete lesson** - Не знаходить lesson-card
3. **Calendar CRUD v0.68 › should update lesson time** - Не знаходить lesson-card
4. **Calendar CRUD v0.68 › should reschedule via drag-and-drop** - Не знаходить lesson-card
5. **Calendar CRUD v0.68 › should handle keyboard navigation** - Timeout
6. **Calendar CRUD v0.68 › should handle conflict detection** - Modal не відкривається
7. **Calendar CRUD v0.68 › should create lesson series** - Modal не відкривається
8. **Create Lesson Modal v0.55 › Happy path: create lesson successfully** - Modal не відкривається
9. **Create Lesson Modal v0.55 › Validation: cannot submit without student** - Modal не відкривається
10. **Calendar Event Modal › should verify tabs are accessible** - Tab selector issue
11. **Calendar Event Modal › should display lesson details correctly** - Timeout

## Root Cause Analysis

### Проблема #1: Grid Cell Clicks Не Відкривають Modal
**Симптоми:**
- `gridCell.click({ force: true })` виконується
- Modal `.modal-overlay` не з'являється
- Timeout на `expect(modal).toBeVisible()`

**Можливі причини:**
1. **AccessibleSlotsLayer перекриває GridLayer** - slots мають `pointer-events: auto` і z-index: 2
2. **GridLayer має `pointer-events: auto` тільки коли НЕ в availability mode**
3. **Click event не propagates** до обробника в CalendarBoardV2

**Спроба виправлення:**
- ✅ Змінено z-index AccessibleSlotsLayer з 1 на 2
- ❌ Проблема залишається

### Проблема #2: Auth Token Issues (ВИРІШЕНО)
**Було:** 401 Unauthorized при створенні уроку
**Виправлено:** Замінено `loginAsTutorUI` на `loginViaApi` для свіжих токенів

## Виконані Виправлення

### 1. UI Components ✅
- **CalendarBoardV2.vue** - додано `role="grid"` та `aria-label`
- **CalendarBoardV2.vue** - додано `data-testid` та `aria-label` для day headers
- **EventsLayer.vue** - використовує `data-testid="lesson-card"` (вже було)
- **GridLayer.vue** - має `data-testid="grid-hour-{hour}"` (вже було)

### 2. CreateLessonModal ✅
- Виправлено crash при conflict check: `response?.conflicts` замість `response.data.conflicts`

### 3. Test Files ✅
- **calendar-crud-v068.spec.ts** - оновлено всі селектори з `event-block` на `lesson-card`
- **calendar-crud-v068.spec.ts** - видалено неіснуючі селектори `data-cell-status`
- **createLesson.spec.ts** - замінено auth на `loginViaApi`
- **calendar-crud-v068.spec.ts** - замінено auth на `loginViaApi`

### 4. Z-Index Adjustments ✅
- **AccessibleSlotsLayer.vue** - z-index: 2 (було 1)

## Залишилися Проблеми

### Критична: Grid Cells Не Кликабельні
Клік на `[data-testid="grid-hour-10"]` не відкриває CreateLessonModal.

**Потрібно перевірити:**
1. Чи GridLayer.vue правильно емітить `cell-click` event
2. Чи CalendarBoardV2.vue правильно обробляє `@cell-click`
3. Чи CalendarWeekView.vue правильно відкриває modal
4. Можливо потрібно кликати НЕ на grid-hour, а на інший елемент

**Альтернативний підхід:**
Замість кліку на grid cells, можна:
- Клікати на accessible-slot (але це відкриває SlotEditorModal)
- Використовувати keyboard navigation
- Програмно викликати відкриття modal через evaluate()

## Наступні Кроки

1. **Debug grid cell click flow:**
   - Додати console.log в GridLayer @click handler
   - Перевірити чи event propagates до CalendarBoardV2
   - Перевірити чи CalendarWeekView отримує event

2. **Розглянути альтернативні підходи:**
   - Використати accessible-slot клік + модифікувати логіку
   - Програмно відкривати modal через page.evaluate()
   - Використати інший UI flow для створення уроку

3. **Якщо grid cells не працюють:**
   - Переписати тести для використання доступних UI елементів
   - Або виправити UI код для правильної обробки кліків

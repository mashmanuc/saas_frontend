# Deep Dive: Why Grid Cells Don't Open CreateLessonModal

## Problem Statement
Clicking on `[data-testid="grid-hour-10"]` does NOT open the CreateLessonModal, despite:
- ✅ Element exists and is visible
- ✅ Click executes without error
- ✅ Event flow is correctly wired

## Event Flow Analysis

### Expected Flow
```
User Click on grid-hour-10
  ↓
GridLayer.vue @click="handleCellClick(hour)"
  ↓ emits
'cell-click' event with hour: 10
  ↓
CalendarBoardV2.vue @cell-click="(hour) => handleCellClick(day.date, hour)"
  ↓ emits
'cell-click' event with { date: '2026-01-06', hour: 10 }
  ↓
CalendarWeekView.vue @cell-click="handleCellClickRouter"
  ↓ routes to
handleCellClick({ date, hour })
  ↓ sets
showCreateModal.value = true
  ↓
CreateLessonModal renders
```

### Actual Behavior
Modal does NOT appear. Timeout on `expect(modal).toBeVisible()`.

## Root Cause Hypothesis

### Theory #1: Z-Index Stacking (MOST LIKELY)
**Layer Stack (bottom to top):**
1. GridLayer - z-index: 1, pointer-events: auto
2. AccessibleSlotsLayer - z-index: 1, pointer-events: none (but slots have pointer-events: auto)
3. AvailabilityLayer - z-index: 2, pointer-events: none
4. EventsLayer - z-index: 3, pointer-events: none (but events have pointer-events: auto)
5. InteractionLayer - z-index: 4, pointer-events: none (auto in availability mode)

**Problem:** AccessibleSlotsLayer slots have `pointer-events: auto` and cover the grid cells where accessible slots exist. When we click on hour 10, if there's an accessible slot at that position, the click goes to the slot, not the grid cell.

**Evidence:**
- Accessible slots are created at hours 10, 11, 14, 15, 16
- Tests try to click on grid-hour-10
- Grid-hour-10 is COVERED by an accessible slot
- Click goes to accessible slot → opens SlotEditorModal, not CreateLessonModal

### Theory #2: Availability Mode
**Check:** Is calendar in availability mode?
- If `availabilityMode === true`, GridLayer has `pointer-events: none`
- This would completely disable grid clicks

**Likelihood:** Low - tests don't activate availability mode

### Theory #3: Past Hour Disabled
**Check:** Is hour 10 in the past?
- GridLayer marks past hours with `is-disabled` class
- Disabled hours have `pointer-events: none`

**Likelihood:** Low - seed data creates future dates

## Solution Approaches

### Approach A: Click on Empty Grid Cells (RECOMMENDED)
Instead of clicking on hour 10 (which has accessible slot), click on an hour WITHOUT accessible slot.

**Accessible slots:** 10, 11, 14, 15, 16
**Empty hours:** 6, 7, 8, 9, 12, 13, 17, 18, 19, 20, 21

```typescript
// Click on hour 9 instead of 10
const gridCell = page.locator('[data-testid="grid-hour-9"]').first()
await gridCell.click()
```

### Approach B: Lower AccessibleSlotsLayer Z-Index
Make accessible slots appear BELOW grid layer.

**Problem:** This breaks the visual hierarchy - slots should be visible above grid.

### Approach C: Remove pointer-events from Accessible Slots
Make slots non-clickable, only grid clickable.

**Problem:** This breaks slot editing functionality.

### Approach D: Use Accessible Slot Click + Modify Handler
Click on accessible slot but modify the handler to open CreateLessonModal instead of SlotEditorModal.

**Problem:** This changes production behavior for tests.

## Recommended Fix

**Change test strategy to click on EMPTY grid cells:**

```typescript
// In createLesson.spec.ts
async function openCreateLessonModal(page: any) {
  // Click on hour 9 (no accessible slot there)
  const gridCell = page.locator('[data-testid="grid-hour-9"]').first()
  await gridCell.scrollIntoViewIfNeeded()
  await gridCell.click({ force: true })
  
  const modal = page.locator('.modal-overlay')
  await expect(modal).toBeVisible({ timeout: 5000 })
}
```

**Update all tests to use empty hours:**
- Hour 9 (before first slot at 10)
- Hour 12 (between slots 11 and 14)
- Hour 13 (between slots 11 and 14)
- Hour 17 (after slot 16)

This preserves production behavior while making tests work.

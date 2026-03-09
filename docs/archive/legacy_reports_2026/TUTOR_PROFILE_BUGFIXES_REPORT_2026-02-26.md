# Tutor Profile Bug Fixes — Execution Report
**Date:** 2026-02-26  
**Session:** Bugfix sprint for tutor profile, calendar, and navigation  
**Status:** ✅ Completed

---

## Summary

Fixed **6 critical/ medium bugs** across tutor profile editor, calendar availability system, and global navigation UX.

---

## Detailed Changes

### 1. Bug 5b — Inline validation for `custom_direction_text`
**Component:** `SubjectsTab` → `TabbedCard` description textarea  
**Problem:** Validation errors shown only as toast on save, not inline  
**Solution:**
- Added `:class="{ 'has-error': description.length > 0 && description.length < 50 }"`
- Character count with color feedback (`char-error` / `char-ok`)
- Inline message: "мін. 50 символів" when below minimum
- CSS: red border on textarea, red/green counter colors

**Files:**
- `src/modules/marketplace/components/editor/TabbedCard.vue` (template + styles)

---

### 2. Bug 14 — Critical: Overlapping days in calendar
**Component:** `AvailabilityEditor`  
**Problem:** Adding new time window always uses 09:00-17:00, causing overlaps  
**Solution:**
- Added `windowsOverlap()`, `getOverlapsForDay()`, `hasOverlaps` computed
- `addWindow()` now finds a free 60-min gap (after last / before first / between windows)
- `updateWindow()` warns user if overlap detected
- Save button disabled when overlaps exist
- Visual warning banner with AlertCircle icon

**Files:**
- `src/modules/booking/components/availability/AvailabilityEditor.vue`

---

### 3. Bug 15 — Cancel changes doesn't exit edit mode
**Component:** `DraftChangesBar`  
**Problem:** "Discard" button cleared changes but `mode` stayed `'edit'`, keeping UI in edit state  
**Solution:**
- `handleDiscard()` now calls `draftStore.exitMode()` instead of `clearDraft()`
- Added missing import for `useAvailabilityDraftUnifiedStore`

**Files:**
- `src/modules/booking/components/availability/DraftChangesBar.vue`

---

### 4. Bug 1 — "Start" button UI on profile creation
**Component:** `CreateProfilePrompt`  
**Problem:** Button not prominent, ArrowRight icon in wrong slot  
**Solution:**
- Added `size="lg"`, `fullWidth`, `:loading` props
- Moved `<ArrowRight>` to `#iconRight` slot

**Files:**
- `src/modules/marketplace/components/editor/CreateProfilePrompt.vue`

---

### 5. Bug 4 — Loading on every city input keystroke
**Component:** `CityAutocomplete`  
**Problem:** `watch` on `modelValue` triggered re-fetch on autosave updates  
**Solution:**
- Added guard: skip if `selectedCity?.code === code`
- Added guard: skip if `code === oldCode` (reactive re-trigger)

**Files:**
- `src/components/geo/CityAutocomplete.vue`

---

### 6. Bug 12 — Global loader on sidebar navigation
**Problem:** Every API call triggered GlobalLoader overlay, blocking UI on navigation  
**Solution:**
- Added `skipLoader: true` to `getTutorMeProfile()` (uses inline spinner in view)
- Added `skipLoader: true` to `apiGetFull()` (cached filter options, etc.)

**Files:**
- `src/modules/marketplace/api/marketplace.ts`

---

## Technical Decisions

1. **Inline validation over toast** — Better UX, immediate feedback  
2. **Gap-finding algorithm** — Uses 60-min blocks, prefers after-last, then before-first, then between  
3. **exitMode() for discard** — Properly exits `'edit'` mode, unlike `resetState()`  
4. **skipLoader for navigation** — Views have own loading states (inline spinners), GlobalLoader only for explicit actions

---

## Git Commands for Commit

```bash
# Stage all modified files
git add frontend/src/modules/marketplace/components/editor/TabbedCard.vue
git add frontend/src/modules/booking/components/availability/AvailabilityEditor.vue
git add frontend/src/modules/booking/components/availability/DraftChangesBar.vue
git add frontend/src/modules/marketplace/components/editor/CreateProfilePrompt.vue
git add frontend/src/components/geo/CityAutocomplete.vue
git add frontend/src/modules/marketplace/api/marketplace.ts

# Create commit
git commit -m "fix(tutor-profile): Bug fixes #5b, #14, #15, #1, #4, #12

- Inline validation for custom_direction_text (50-800 chars)
- Calendar overlap detection with gap-finding algorithm
- DraftChangesBar.exitMode() on discard
- CreateProfilePrompt button UI (lg, fullWidth, iconRight)
- CityAutocomplete watch guards (skip re-fetch)
- skipLoader for navigation APIs (getTutorMeProfile, apiGetFull)

Fixes: tutor profile validation, calendar availability UX, navigation loading"

# Push (you mentioned you'll handle this yourself)
# git push origin <branch>
```

---

## Verification Checklist

- [ ] TabbedCard shows inline validation (red < 50 chars, green >= 50)
- [ ] AvailabilityEditor prevents overlapping windows
- [ ] DraftChangesBar properly exits edit mode on discard
- [ ] CreateProfilePrompt button is full-width with arrow icon
- [ ] CityAutocomplete doesn't re-fetch on autosave
- [ ] Navigation doesn't show GlobalLoader overlay

---

**Next Steps:** User will commit, push, and deploy.

# Manual Smoke Test: Winterboard Board Productization v0.94.0.3

**Date:** 2026-01-18  
**Version:** v0.94.0.3  
**Duration:** ~10 minutes  
**Environment:** Development + Production

---

## Prerequisites

- [ ] Backend server running (`http://localhost:8000`)
- [ ] Frontend dev server running (`http://localhost:5173`)
- [ ] `VITE_VERTICAL_LAYOUT=true` in `.env` file
- [ ] User authenticated with access to classroom workspace
- [ ] Browser: Chrome/Firefox latest version
- [ ] Console open for debug verification

---

## Test Steps

### 1. Tool State Centralization (P0.1)

**Action:**
- Open classroom session (NOT `dev-workspace-*`)
- Wait for bootstrap to complete
- Open browser console
- Click "Pen" tool in left sidebar
- Type in console: `whiteboardStore.currentTool`
- Click "Rectangle" tool
- Check console again

**Expected:**
- ✅ Console shows `'pen'` after clicking Pen
- ✅ Console shows `'rectangle'` after clicking Rectangle
- ✅ Tool state synchronized across components

**Status:** [ ] PASS [ ] FAIL

---

### 2. Tool Switch and Drawing (P0.1 + P0.5)

**Action:**
- Select "Pen" tool (left sidebar)
- Select blue color
- Select size 4
- Draw a stroke on Page 1
- Select "Rectangle" tool
- Select green color
- Draw a rectangle on Page 1

**Expected:**
- ✅ Pen stroke is blue, size 4
- ✅ Rectangle is green
- ✅ Both shapes visible on canvas
- ✅ No tool state mismatch

**Status:** [ ] PASS [ ] FAIL

---

### 3. Color and Size Picker (P0.5)

**Action:**
- Click each color preset (black, green, pink, blue, yellow)
- Click color picker icon
- Select custom color (e.g., orange)
- Click each size preset (1px, 2px, 4px, 8px)
- Draw with each size

**Expected:**
- ✅ Color presets work
- ✅ Custom color picker works
- ✅ Size presets work
- ✅ Drawing reflects selected color/size

**Status:** [ ] PASS [ ] FAIL

---

### 4. Persistency: Basic Save (P0.2)

**Action:**
- Draw pen stroke on Page 1
- Wait 2 seconds (autosave debounce)
- Check console for: `[WhiteboardStore] Page state updated`
- Scroll to Page 2
- Draw rectangle on Page 2
- Wait 2 seconds
- Reload page (F5)
- Check Page 1 and Page 2

**Expected:**
- ✅ Console shows save confirmation
- ✅ After reload: Page 1 stroke restored
- ✅ After reload: Page 2 rectangle restored

**Status:** [ ] PASS [ ] FAIL

---

### 5. Persistency: 409 Conflict Retry (P0.2)

**Action:**
- Open same workspace in 2 browser tabs (Tab A, Tab B)
- Tab A: Draw stroke on Page 1
- Tab B: Draw rectangle on Page 1 (triggers version conflict)
- Check console in Tab B for:
  - `Version conflict detected, resyncing and retrying save`
  - `Retrying save after resync`
  - `Save retry succeeded`

**Expected:**
- ✅ Tab B resyncs and retries save
- ✅ Both strokes persisted (no silent drop)
- ✅ Console shows retry flow

**Status:** [ ] PASS [ ] FAIL [ ] SKIP (requires 2 tabs)

---

### 6. Persistency: 413 Block (P0.2)

**Action:**
- (Simulation) Draw many strokes to exceed payload limit
- OR manually trigger 413 via backend mock
- Check console for: `Payload too large, blocking further saves`
- Try to draw another stroke
- Check console for: `Autosave blocked due to payload too large`

**Expected:**
- ✅ Error state shows "Content Too Large"
- ✅ Autosave blocked after 413
- ✅ No infinite retry loop

**Status:** [ ] PASS [ ] FAIL [ ] SKIP (requires backend mock)

---

### 7. Scroll Stability (P0.3)

**Action:**
- Quickly scroll up and down between pages (10 times)
- Observe active page indicator (highlighted page)
- Check for "lightning" effect (rapid flapping)

**Expected:**
- ✅ Active page changes smoothly
- ✅ No rapid flapping between two pages
- ✅ No "teleport lightning" effect
- ✅ Scroll feels deterministic

**Verification:**
- Console: No flood of `setActivePageByScroll` messages
- Visual: Smooth transitions

**Status:** [ ] PASS [ ] FAIL

---

### 8. Scroll Stability: Programmatic Scroll (P0.3)

**Action:**
- Enable follow mode (if available)
- OR manually trigger `scrollToPage()` via console
- Observe scroll behavior
- Check for cycles (scroll → IO → scroll → IO)

**Expected:**
- ✅ Programmatic scroll completes smoothly
- ✅ No infinite scroll loop
- ✅ Guard clears after 600ms

**Status:** [ ] PASS [ ] FAIL [ ] SKIP

---

### 9. Bootstrap UX: No Blank State (P0.4)

**Action:**
- (Simulation) Open workspace with 0 pages
- OR manually set backend to return empty pages list
- Check UI

**Expected:**
- ✅ Error state shows "No pages available" (not blank UI)
- ✅ No infinite loader
- ✅ Clear error message

**Status:** [ ] PASS [ ] FAIL [ ] SKIP (requires backend setup)

---

### 10. Bootstrap UX: Safe Page Creation (P0.4)

**Action:**
- Open workspace with 0 pages (backend allows creation)
- Wait for bootstrap
- Check console for:
  - `No pages found, creating pages safely`
  - `Created page: ...` (up to 10 times or limit)
  - `Bootstrap completed with X pages`

**Expected:**
- ✅ Pages created up to limit (10 or backend max)
- ✅ At least 1 page visible
- ✅ No crash if limit reached mid-creation

**Status:** [ ] PASS [ ] FAIL [ ] SKIP

---

### 11. Tool UX Parity: All Tools (P0.5)

**Action:**
- Test each tool:
  - **Select:** Click stroke, drag to move
  - **Pen:** Draw freehand stroke
  - **Highlighter:** Draw semi-transparent stroke
  - **Line:** Draw straight line
  - **Rectangle:** Draw rectangle
  - **Circle:** Draw circle/ellipse
  - **Text:** Click to add text, type, press Enter
  - **Eraser:** Click stroke to delete

**Expected:**
- ✅ All tools work correctly
- ✅ Drawing behavior matches tool type
- ✅ Eraser deletes strokes
- ✅ Text tool allows input

**Status:** [ ] PASS [ ] FAIL

---

### 12. Debug Counters (P0.7)

**Action:**
- Open browser console
- Type: `window.__WINTERBOARD_DEBUG__`
- Scroll up/down several times
- Check counter values again

**Expected:**
- ✅ Object exists with `mountedCanvasesCount` and `activeObserversCount`
- ✅ `mountedCanvasesCount` stays stable (3-5 for visible + neighbors)
- ✅ `activeObserversCount` = 1
- ✅ Counters don't grow unbounded

**Example output:**
```javascript
{
  mountedCanvasesCount: 3,
  activeObserversCount: 1
}
```

**Status:** [ ] PASS [ ] FAIL

---

### 13. Error UX: Network Timeout (P0.5)

**Action:**
- Disable network (browser DevTools → Network → Offline)
- Try to draw on page
- Wait for autosave attempt
- Check error state

**Expected:**
- ✅ Error state shows "Connection Error" or similar
- ✅ Retry button visible (if applicable)
- ✅ No infinite loader

**Status:** [ ] PASS [ ] FAIL [ ] SKIP

---

### 14. Tool State Persistence Across Pages (P0.1)

**Action:**
- Select "Rectangle" tool + red color + size 8
- Scroll to Page 2
- Check if tool/color/size still selected
- Draw on Page 2

**Expected:**
- ✅ Tool state persists across page changes
- ✅ Rectangle tool still active
- ✅ Red color still selected
- ✅ Size 8 still selected

**Status:** [ ] PASS [ ] FAIL

---

### 15. Reload: Tool State Persistence (P0.1)

**Action:**
- Select "Circle" tool + blue color + size 4
- Reload page (F5)
- Wait for bootstrap
- Check selected tool/color/size

**Expected:**
- ✅ Tool state resets to default (pen, black, size 4)
- OR ✅ Tool state persisted (if implemented)

**Note:** Current implementation resets tool state on reload (acceptable).

**Status:** [ ] PASS [ ] FAIL

---

## Summary

**Total Tests:** 15  
**Passed:** ___  
**Failed:** ___  
**Skipped:** ___  

**Overall Status:** [ ] ✅ PASS [ ] ❌ FAIL

---

## Notes

_Add any observations, issues, or comments here:_

---

## Sign-off

**Tester:** _______________  
**Date:** _______________  
**Environment:** [ ] Dev [ ] Staging [ ] Production

---

**END OF SMOKE TEST**

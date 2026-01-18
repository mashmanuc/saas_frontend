# Manual Smoke Test: Winterboard Board Productization v0.94.0.2

**Date:** 2026-01-18  
**Version:** v0.94.0.2  
**Duration:** ~5 minutes  
**Environment:** Development + Production

---

## Prerequisites

- [ ] Backend server running (`http://localhost:8000`)
- [ ] Frontend dev server running (`http://localhost:5173`)
- [ ] `VITE_VERTICAL_LAYOUT=true` in `.env` file
- [ ] User authenticated with access to classroom workspace
- [ ] Browser: Chrome/Firefox latest version
- [ ] Console open for debug counters verification

---

## Test Steps

### 1. Enable Feature Flag

**Action:**
- Verify `VITE_VERTICAL_LAYOUT=true` in `.env`
- Reload frontend if needed

**Expected:**
- ✅ Frontend starts without errors
- ✅ Console shows no critical errors

**Status:** [ ] PASS [ ] FAIL

---

### 2. Open Real Workspace

**Action:**
- Navigate to classroom session (NOT `dev-workspace-*`)
- Example: `/classroom/session-abc123`
- Wait for bootstrap to complete

**Expected:**
- ✅ Loading spinner appears
- ✅ Bootstrap completes (no infinite loader)
- ✅ Vertical layout renders (pages stack visible)
- ✅ No error state shown

**Verification:**
- Check console for: `[WhiteboardStore] Production workspace ready with X pages`

**Status:** [ ] PASS [ ] FAIL

---

### 3. Confirm Pages Loaded

**Action:**
- Count visible pages in vertical stack
- Check if pages >= 1 (ideally up to limit)

**Expected:**
- ✅ At least 1 page visible
- ✅ If workspace was empty: up to 10 pages created (or limit)
- ✅ Pages have titles: "Page 1", "Page 2", etc.

**Verification:**
- Console: `[WhiteboardStore] Bootstrap completed with X pages`
- If limit reached: `[WhiteboardStore] Page limit reached after creating X pages`

**Status:** [ ] PASS [ ] FAIL

---

### 4. Draw on Two Pages

**Action:**
- **Page 1:**
  - Select "Pen" tool from left sidebar
  - Draw a stroke (any shape)
  - Wait 2 seconds (autosave)
  
- **Page 2:**
  - Scroll down to Page 2
  - Select "Rectangle" tool
  - Draw a rectangle
  - Wait 2 seconds (autosave)

**Expected:**
- ✅ Pen stroke visible on Page 1
- ✅ Rectangle visible on Page 2
- ✅ Console shows: `[WhiteboardStore] Page state updated`
- ✅ No error messages

**Status:** [ ] PASS [ ] FAIL

---

### 5. Reload and Confirm Persisted

**Action:**
- Press F5 or Ctrl+R to reload page
- Wait for bootstrap
- Scroll to Page 1 and Page 2

**Expected:**
- ✅ Page 1: Pen stroke restored
- ✅ Page 2: Rectangle restored
- ✅ No data loss

**Verification:**
- Console: `[WhiteboardStore] Production workspace ready with X pages`
- Visual: Both drawings visible

**Status:** [ ] PASS [ ] FAIL

---

### 6. Check Tools Sidebar Works

**Action:**
- Verify BoardToolbarVertical visible on left side
- Click through tools:
  - Pen → Highlighter → Line → Rectangle → Circle → Text → Eraser → Select
- Draw with each tool

**Expected:**
- ✅ Toolbar visible and styled correctly
- ✅ Each tool click changes active tool
- ✅ Drawing behavior matches selected tool
- ✅ Color picker works
- ✅ Size slider works

**Status:** [ ] PASS [ ] FAIL

---

### 7. Check Scroll Stable

**Action:**
- Quickly scroll up and down between pages (5-10 times)
- Observe active page indicator
- Check for "lightning" or "teleport" behavior

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

### 8. Check Debug Counters (Dev Mode Only)

**Action:**
- Open browser console
- Type: `window.__WINTERBOARD_DEBUG__`
- Scroll up/down several times
- Check counter values again

**Expected:**
- ✅ Object exists with `mountedCanvasesCount` and `activeObserversCount`
- ✅ `mountedCanvasesCount` stays stable (3-5 for visible + neighbors)
- ✅ `activeObserversCount` = 1
- ✅ Counters don't grow unbounded with scroll

**Example output:**
```javascript
{
  mountedCanvasesCount: 3,
  activeObserversCount: 1
}
```

**Status:** [ ] PASS [ ] FAIL

---

## Error Scenarios (Optional)

### 9. Test 401 Error (Session Expired)

**Action:**
- Clear auth cookies
- Try to draw on page

**Expected:**
- ✅ WhiteboardErrorState shows "Session Expired"
- ✅ Reload button visible
- ✅ No infinite loader

**Status:** [ ] PASS [ ] FAIL [ ] SKIP

---

### 10. Test 409 Error (Page Limit)

**Action:**
- If user has page limit (e.g., 2 pages on free plan)
- Try to create more pages than limit

**Expected:**
- ✅ Bootstrap stops at limit
- ✅ Console: `[WhiteboardStore] Page limit reached after creating X pages`
- ✅ No crash, workspace usable with existing pages

**Status:** [ ] PASS [ ] FAIL [ ] SKIP

---

## Summary

**Total Tests:** 10  
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

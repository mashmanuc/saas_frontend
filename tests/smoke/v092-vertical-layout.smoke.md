# Smoke Test Plan v0.92.0 — Dev Vertical Layout

**Version:** v0.92.0  
**Date:** 2026-01-17  
**Tester:** _____________  
**Environment:** Dev / Staging

---

## Prerequisites

- [ ] Frontend `.env.local` has `VITE_VERTICAL_LAYOUT=true`
- [ ] Backend `ENABLE_DEV_CLASSROOM=True` in dev settings
- [ ] User has `is_staff=True` permission
- [ ] Dev launcher accessible at `/dev/classroom`

---

## Test Case 1: Dev Session with Vertical Layout

**Objective:** Verify dev session creates vertical whiteboard stack

### Steps:
1. Navigate to `/dev/classroom`
2. Click "Create & Join"
3. Wait for redirect to `/classroom/{sessionId}`
4. Observe whiteboard area

### Expected Results:
- [ ] URL contains session ID
- [ ] PageVerticalStack component is visible
- [ ] 4 placeholder pages are rendered (Page 1, Page 2, Page 3, Page 4)
- [ ] First page (Page 1) has active highlight (blue border)
- [ ] Each page shows index number (1, 2, 3, 4)
- [ ] VideoDock is NOT visible
- [ ] No errors in browser console

### Actual Results:
```
Status: ☐ Pass ☐ Fail
Notes:


```

---

## Test Case 2: Vertical Stack Scrolling

**Objective:** Verify vertical stack is scrollable and pages load on scroll

### Steps:
1. Continue from Test Case 1
2. Scroll down in the vertical stack
3. Observe page 2, 3, 4 coming into view

### Expected Results:
- [ ] Stack scrolls smoothly
- [ ] Pages become visible as they enter viewport
- [ ] Active page highlight updates on scroll
- [ ] Placeholder content visible for each page
- [ ] No layout shifts or jumps

### Actual Results:
```
Status: ☐ Pass ☐ Fail
Notes:


```

---

## Test Case 3: Production Session (No Vertical Layout)

**Objective:** Verify production sessions use legacy BoardDock

### Steps:
1. Create a production classroom session (via normal booking flow)
2. Join the session
3. Observe whiteboard area

### Expected Results:
- [ ] BoardDock component is visible (not PageVerticalStack)
- [ ] VideoDock IS visible
- [ ] No vertical stack elements present
- [ ] Normal side-by-side layout active
- [ ] No dev-workspace- prefix in workspace_id

### Actual Results:
```
Status: ☐ Pass ☐ Fail
Notes:


```

---

## Test Case 4: Feature Flag Disabled

**Objective:** Verify vertical layout disabled when VITE_VERTICAL_LAYOUT=false

### Steps:
1. Set `VITE_VERTICAL_LAYOUT=false` in `.env.local`
2. Rebuild frontend (`npm run dev`)
3. Navigate to `/dev/classroom`
4. Create & join session

### Expected Results:
- [ ] BoardDock is rendered (not PageVerticalStack)
- [ ] VideoDock is visible
- [ ] Dev session still works normally
- [ ] No vertical layout elements

### Actual Results:
```
Status: ☐ Pass ☐ Fail
Notes:


```

---

## Test Case 5: Dev Workspace Permissions

**Objective:** Verify dev workspace has full permissions

### Steps:
1. Set `VITE_VERTICAL_LAYOUT=true`
2. Create dev session via launcher
3. Check whiteboard permissions in DevTools console:
   ```js
   window.$nuxt.$store.state.whiteboard.myRole
   window.$nuxt.$store.state.whiteboard.canEdit
   window.$nuxt.$store.state.whiteboard.canModerate
   ```

### Expected Results:
- [ ] `myRole` is `'moderator'`
- [ ] `canEdit` is `true`
- [ ] `canModerate` is `true`
- [ ] `isBoardFrozen` is `false`
- [ ] `limits.maxPages` is `null`

### Actual Results:
```
Status: ☐ Pass ☐ Fail
Notes:


```

---

## Test Case 6: No Backend Calls for Dev Workspace

**Objective:** Verify dev workspace doesn't call storage/policy APIs

### Steps:
1. Open DevTools Network tab
2. Filter for `/api/v1/whiteboard/`
3. Create dev session via launcher
4. Observe network requests

### Expected Results:
- [ ] No calls to `/api/v1/whiteboard/workspaces/{id}/pages/`
- [ ] No calls to `/api/v1/whiteboard/workspaces/{id}/limits/`
- [ ] Whiteboard loads instantly (no API delay)
- [ ] 4 pages appear immediately

### Actual Results:
```
Status: ☐ Pass ☐ Fail
Notes:


```

---

## Test Case 7: Regression - Existing Features

**Objective:** Verify existing classroom features still work

### Steps:
1. Create dev session
2. Test basic interactions:
   - Timer starts
   - Connection status shows "connected"
   - Room toolbar visible
   - Session controls (pause/resume/terminate) accessible

### Expected Results:
- [ ] Timer counts up
- [ ] Connection status indicator green
- [ ] Toolbar buttons functional
- [ ] No JavaScript errors
- [ ] Room header displays session info

### Actual Results:
```
Status: ☐ Pass ☐ Fail
Notes:


```

---

## Summary

**Total Tests:** 7  
**Passed:** ___  
**Failed:** ___  
**Blocked:** ___

**Overall Status:** ☐ Pass ☐ Fail ☐ Blocked

**Critical Issues:**
```


```

**Notes:**
```


```

**Sign-off:**
- Tester: _____________ Date: _______
- Reviewer: _____________ Date: _______

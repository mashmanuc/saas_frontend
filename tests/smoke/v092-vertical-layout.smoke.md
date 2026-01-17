# Smoke Test Plan v0.92.1 — Dev Vertical Layout (Hardening)

**Version:** v0.92.1
**Date:** 2026-01-17
**Tester:** _____________
**Environment:** Dev / Staging

---

## Changes from v0.92.0

v0.92.1 вносить такі зміни для hardening dev-only режиму:

1. **FE-92.1.1**: `useVerticalLayout` тепер жорстко перевіряє `isDevWorkspace && verticalFlagEnabled`
2. **FE-92.1.2**: `layoutStore.verticalLayoutEnabled` більше не може вмикати vertical для prod
3. **FE-92.1.3**: Додано tripwire watchEffect для логування порушень dev-only invariant
4. **QA-92.1.1**: E2E тести використовують `.env.e2e` замість localStorage hack

---

## Prerequisites

- [ ] Frontend `.env.local` has `VITE_VERTICAL_LAYOUT=true`
- [ ] Backend `ENABLE_DEV_CLASSROOM=True` in dev settings
- [ ] User has `is_staff=True` permission
- [ ] Dev launcher accessible at `/dev/classroom`

---

## Test Case 1: Dev Session with Vertical Layout (VITE_VERTICAL_LAYOUT=true)

**Objective:** Verify dev session creates vertical whiteboard stack

### Steps:
1. Set `VITE_VERTICAL_LAYOUT=true` in `.env.local`
2. Restart dev server (`npm run dev`)
3. Navigate to `/dev/classroom`
4. Click "Create & Join"
5. Wait for redirect to `/classroom/{sessionId}`
6. Observe whiteboard area

### Expected Results:
- [ ] URL contains session ID
- [ ] PageVerticalStack component is visible
- [ ] ≥3 placeholder pages are rendered (Page 1, Page 2, Page 3, ...)
- [ ] First page (Page 1) has active highlight (blue border)
- [ ] Each page shows index number
- [ ] VideoDock is NOT visible
- [ ] No errors in browser console
- [ ] No `[WINTERBOARD] ILLEGAL_VERTICAL_LAYOUT_NON_DEV_WORKSPACE` error in console

### Actual Results:
```
Status: ☐ Pass ☐ Fail
Notes:


```

---

## Test Case 2: Dev Session WITHOUT Vertical Layout (VITE_VERTICAL_LAYOUT=false)

**Objective:** Verify vertical layout disabled when VITE_VERTICAL_LAYOUT=false

### Steps:
1. Set `VITE_VERTICAL_LAYOUT=false` in `.env.local`
2. Restart dev server (`npm run dev`)
3. Navigate to `/dev/classroom`
4. Click "Create & Join"
5. Wait for redirect to `/classroom/{sessionId}`

### Expected Results:
- [ ] BoardDock is rendered (not PageVerticalStack)
- [ ] VideoDock is visible (legacy layout)
- [ ] Dev session still works normally
- [ ] No vertical layout elements
- [ ] No JavaScript errors

### Actual Results:
```
Status: ☐ Pass ☐ Fail
Notes:


```

---

## Test Case 3: Production Session (CRITICAL - Dev-Only Invariant)

**Objective:** Verify production sessions NEVER use vertical layout, regardless of feature flag

### Steps:
1. Set `VITE_VERTICAL_LAYOUT=true` in `.env.local`
2. Restart dev server
3. Create a production classroom session (via normal booking flow)
4. Join the session (workspace_id does NOT start with `dev-workspace-`)
5. Observe whiteboard area
6. Check browser console for tripwire warnings

### Expected Results (CRITICAL):
- [ ] BoardDock component is visible (not PageVerticalStack)
- [ ] `whiteboard-host--vertical` class is NOT present
- [ ] VideoDock IS visible (legacy layout)
- [ ] No vertical stack elements present
- [ ] workspace_id does NOT start with `dev-workspace-`
- [ ] Console shows NO `[WINTERBOARD] ILLEGAL_VERTICAL_LAYOUT_NON_DEV_WORKSPACE` error

### Actual Results:
```
Status: ☐ Pass ☐ Fail
Notes:


```

---

## Test Case 4: Vertical Stack Scrolling

**Objective:** Verify vertical stack is scrollable and pages load on scroll

### Steps:
1. Continue from Test Case 1 (dev session with vertical layout)
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

## Test Case 5: layoutStore.verticalLayoutEnabled Deprecation

**Objective:** Verify deprecated store method shows warning and doesn't affect prod

### Steps:
1. Open DevTools console
2. In dev session, execute:
   ```js
   // Отримати store
   const store = window.__pinia__.state.value['classroom-layout']
   console.log('verticalLayoutEnabled:', store.verticalLayoutEnabled)
   ```
3. Verify deprecation warning appears if enableVerticalLayout() is called

### Expected Results:
- [ ] Console shows deprecation warning when calling enableVerticalLayout()
- [ ] `verticalLayoutEnabled` state exists but doesn't affect prod layout
- [ ] No UI element to toggle vertical layout in prod

### Actual Results:
```
Status: ☐ Pass ☐ Fail
Notes:


```

---

## Test Case 6: Dev Workspace Permissions

**Objective:** Verify dev workspace has full permissions

### Steps:
1. Set `VITE_VERTICAL_LAYOUT=true`
2. Create dev session via launcher
3. Check whiteboard is not readonly

### Expected Results:
- [ ] Whiteboard is NOT in readonly mode
- [ ] No `whiteboard-host--readonly` class
- [ ] No `whiteboard-host--frozen` class
- [ ] Can interact with whiteboard

### Actual Results:
```
Status: ☐ Pass ☐ Fail
Notes:


```

---

## Test Case 7: Regression - Legacy Features

**Objective:** Verify existing classroom features still work

### Steps:
1. Create dev session
2. Test basic interactions:
   - Timer starts
   - Connection status shows "connected"
   - Room toolbar visible
   - Session controls accessible

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

## Test Case 8: E2E Test Run Validation

**Objective:** Verify E2E tests pass with correct env configuration

### Steps:
1. Run E2E tests:
   ```bash
   cd frontend
   npm run test:e2e:dev-vertical
   ```
2. Verify all tests pass

### Expected Results:
- [ ] All E2E tests pass
- [ ] No localStorage hacks used (check spec file)
- [ ] Tests use `.env.e2e` for env flags

### Actual Results:
```
Status: ☐ Pass ☐ Fail
E2E Output:


```

---

## Summary

**Total Tests:** 8
**Passed:** ___
**Failed:** ___
**Blocked:** ___

**Overall Status:** ☐ Pass ☐ Fail ☐ Blocked

**v0.92.1 Invariants Verified:**
- [ ] Vertical layout works ONLY for `dev-workspace-*` + `VITE_VERTICAL_LAYOUT=true`
- [ ] Production workspace NEVER gets vertical layout
- [ ] `layoutStore.verticalLayoutEnabled` cannot enable vertical for prod
- [ ] E2E tests don't use fake localStorage for env flags

**Critical Issues:**
```


```

**Notes:**
```


```

**Sign-off:**
- Tester: _____________ Date: _______
- Reviewer: _____________ Date: _______

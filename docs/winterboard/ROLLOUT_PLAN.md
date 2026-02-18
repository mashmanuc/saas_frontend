# Winterboard Rollout Plan

> Phase 7: A7.2 — Feature Flag + Rollout Prep
> Date: 2026-02-18

---

## Feature Flags

| Flag | Scope | Default | Location | Description |
|------|-------|---------|----------|-------------|
| `VITE_WB_ENABLED` | FE | `false` | `.env` | Master switch for Winterboard |
| `VITE_WB_USE_YJS` | FE | `false` | `.env` | Yjs real-time collaboration |
| `WB_USE_YJS` | BE | `false` | Django settings | Yjs server-side routing |

### Override Priority (first match wins)

1. **URL param**: `?wb=true` / `?wb=false` — persists to localStorage
2. **localStorage**: `wb_enabled` / `wb_yjs_enabled`
3. **Env variable**: `VITE_WB_ENABLED` / `VITE_WB_USE_YJS`
4. **Default**: `false`

### Programmatic API

```typescript
import {
  isWinterboardEnabled,
  isWinterboardYjsEnabled,
  setWinterboardEnabled,
  setWinterboardYjsEnabled,
  clearWinterboardOverrides,
} from '@/modules/winterboard/config/featureFlags'

// Check flags
isWinterboardEnabled()      // boolean
isWinterboardYjsEnabled()   // boolean (nested: requires WB enabled)

// Manual overrides (dev tools / admin panel)
setWinterboardEnabled(true)
setWinterboardYjsEnabled(true)

// Clear all overrides
clearWinterboardOverrides()
```

---

## Rollout Stages

### Stage 1: Internal (Team Only)

- **Config**: `VITE_WB_ENABLED=false` in production `.env`
- **Access**: Team members use `?wb=true` URL param
- **Duration**: 1 week
- **Monitoring**:
  - Console errors
  - Network failures
  - Canvas rendering issues
- **Criteria to proceed**:
  - No critical bugs
  - Performance within budgets (FCP < 2s, draw latency < 16ms)
  - All smoke tests pass

### Stage 2: Beta (10% Users)

- **Config**: Enable via user flag in API (`is_wb_beta=true` on user model)
- **Access**: Selected users see WB in navigation
- **Duration**: 2 weeks
- **Monitoring**:
  - Error rates (Sentry)
  - Performance metrics (Prometheus)
  - User feedback (in-app)
  - Data integrity (session save/load)
- **Criteria to proceed**:
  - Error rate < 0.1%
  - No data loss incidents
  - Positive user feedback
  - P95 save latency < 500ms

### Stage 3: Full Rollout

- **Config**: `VITE_WB_ENABLED=true` in production `.env`
- **Access**: All users (STUDENT, TUTOR roles)
- **Duration**: Monitor for 1 week post-rollout
- **Monitoring**:
  - All Stage 2 metrics
  - Server load / WebSocket connections
  - Storage growth rate

---

## Rollback Procedure

1. Set `VITE_WB_ENABLED=false` in production `.env`
2. Redeploy frontend (Netlify auto-deploy on env change)
3. Users lose access to WB routes (redirected to /404)
4. **Data is preserved** — sessions remain in database
5. Fix issues
6. Re-enable when ready

### Emergency Rollback (no redeploy)

For immediate rollback without redeployment:
- Backend can set user flag `is_wb_beta=false` for all users
- Users with localStorage override will still have access (acceptable for team)

---

## Yjs Collaboration Sub-rollout

Yjs is a **nested flag** — requires WB to be enabled first.

| Stage | WB Enabled | Yjs Enabled | Users |
|-------|-----------|-------------|-------|
| 1 | Team only | No | Team |
| 2 | Beta 10% | Team only | Beta users (no collab) |
| 3 | All users | Beta 10% | All users (some with collab) |
| 4 | All users | All users | Full collaboration |

---

## Router Guard

All WB routes (except public share links) are protected by `winterboardGuard`:

```typescript
function winterboardGuard(to, from, next) {
  if (!isWinterboardEnabled()) {
    next({ path: '/404' })
  } else {
    next()
  }
}
```

**Public share links** (`/winterboard/public/:token`) bypass the guard — shared links should always work regardless of feature flag state.

---

## Implementation Files

| File | Description |
|------|-------------|
| `config/featureFlags.ts` | Centralized feature flag system |
| `router.ts` | Route guard integration |
| `composables/useCollaboration.ts` | Yjs flag delegation |

## Tests

| File | Tests |
|------|-------|
| `__tests__/featureFlags.spec.ts` | 14 tests (env, URL, localStorage, nested, guard) |
| `__tests__/bundleOptimization.spec.ts` | 7 tests (lazy routes, async components, Yjs) |

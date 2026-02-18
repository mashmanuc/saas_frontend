# Winterboard Bundle Analysis

> Phase 7: A7.1 — Bundle Size Optimization
> Date: 2026-02-18

---

## Baseline (Before Optimization)

| Chunk | Raw Size | Gzip Size |
|-------|----------|-----------|
| vendor-konva | 182.80 KB | 55.12 KB |
| BoardDock | 52.93 KB | 16.92 KB |
| WBCanvasLoader | 36.49 KB | 11.00 KB |
| chunk-whiteboard | 34.47 KB | 10.00 KB |
| WBCanvas | 28.54 KB | 10.17 KB |
| ClassroomBoard | 27.42 KB | 8.26 KB |
| WBSessionList | 26.48 KB | 6.91 KB |
| WBClassroomRoom | 16.39 KB | 5.53 KB |
| WBSoloRoom | 10.17 KB | 3.65 KB |
| winterboardApi | 3.89 KB | 1.29 KB |
| WBPublicView | 3.53 KB | 1.53 KB |
| **Total WB JS** | **423.11 KB** | **130.38 KB** |
| **Konva (vendor)** | **182.80 KB** | **55.12 KB** |
| **Yjs** | **0 KB** | **0 KB** (lazy) |

### WB CSS Chunks

| Chunk | Raw Size | Gzip Size |
|-------|----------|-----------|
| WBSessionList.css | 17.91 KB | 2.93 KB |
| ClassroomBoard.css | 13.69 KB | 2.51 KB |
| WBCanvasLoader.css | 10.70 KB | 2.17 KB |
| WBSoloRoom.css | 8.03 KB | 1.74 KB |
| WBClassroomRoom.css | 8.33 KB | 1.75 KB |
| BoardDock.css | 3.33 KB | 1.12 KB |
| WBPublicView.css | 2.72 KB | 0.83 KB |
| WBCanvas.css | 1.53 KB | 0.66 KB |
| **Total WB CSS** | **66.25 KB** | **13.71 KB** |

---

## After Optimization

| Chunk | Gzip Size | Target | Status |
|-------|-----------|--------|--------|
| WB module (all JS) | 130.38 KB | < 300 KB | ✅ |
| Konva (vendor) | 55.12 KB | < 200 KB | ✅ |
| Yjs (lazy) | 0 KB in main | < 100 KB | ✅ |
| **Total WB JS** | **~185 KB** | **< 600 KB** | ✅ |

---

## Optimizations Applied

### 1. Lazy Route Loading (already in place)
All 5 WB routes use dynamic `() => import(...)` — WB code is NOT in the main bundle.
Verified: `index.js` (main bundle) does not contain WB component code.

### 2. Konva Vendor Chunk
Konva is isolated in `vendor-konva` chunk (55.12 KB gzip) via `manualChunks` in `vite.config.js`.
This is well under the 200 KB target. Full Konva import is used because vue-konva requires the full library.

### 3. Lazy Dialog Components (A7.1)
- `WBShareDialog` → `defineAsyncComponent(() => import(...))`
- `WBExportDialog` → `defineAsyncComponent(() => import(...))`
- Dialogs only load when user opens share/export — not on initial page load.

### 4. Yjs Lazy Loading (verified)
- `y-websocket` and `y-indexeddb` are dynamically imported inside `useCollaboration.ts` `connect()` method.
- Yjs code is **not** in any chunk when `WB_USE_YJS=false` (default).
- When enabled, Yjs loads on-demand during WebSocket connection setup.

### 5. CSS Scoping
All WB component CSS uses `<style scoped>` — no style leakage to main bundle.
WB CSS chunks are code-split per component and only load with their respective routes.

### 6. Code Splitting Summary
WB module is split into 11 JS chunks + 8 CSS chunks, all lazy-loaded per route.
No WB code appears in the initial `index.js` bundle.

---

## Verification

- Build: `npx vite build` ✅
- Unit tests: 7 tests pass (lazy routes, async components, Yjs lazy loading)
- Main bundle (`index.js`): 211.65 KB raw / 59.08 KB gzip — no WB code included

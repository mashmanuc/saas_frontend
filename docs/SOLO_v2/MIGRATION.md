# Migration Guide - Solo Board v2

This guide helps you upgrade from Solo Board v1 to v2.

## Overview

Solo Board v2 is a **fully backward compatible** update. Existing sessions and data will continue to work without any migration steps.

---

## Breaking Changes

**None** - All changes are additive and backward compatible.

---

## What's New

### New Tools
| Tool | Shortcut | Description |
|------|----------|-------------|
| Circle | `C` | Draw circles |
| Arrow | `A` | Draw arrows with head styles |
| Select | `V` | Select, move, resize objects |

### New Features
- Background options (grid, dots, ruled, graph, color)
- PDF import
- Keyboard shortcuts (22 combinations)
- Debounced autosave
- Undo/redo with history

### New Dependencies
```bash
# Optional - only needed for PDF import
npm install pdfjs-dist
```

---

## Upgrade Steps

### Step 1: Update Dependencies

```bash
cd frontend
npm install
```

### Step 2: Verify Types (Optional)

If you're using TypeScript, update your type imports:

```typescript
// New types available
import type {
  BackgroundType,
  PageBackground,
  ArrowStyle,
} from '@/modules/solo/types/solo'
```

### Step 3: Use New Composables (Optional)

If you want to integrate new features into custom components:

```typescript
// Keyboard shortcuts
import { useKeyboardShortcuts } from '@/modules/solo/composables/useKeyboardShortcuts'

// Selection
import { useSelection } from '@/modules/solo/composables/useSelection'

// History (undo/redo)
import { useHistory } from '@/modules/solo/composables/useHistory'

// Autosave
import { useAutosave } from '@/modules/solo/composables/useAutosave'

// Canvas optimization
import { useCanvasOptimization } from '@/modules/solo/composables/useCanvasOptimization'

// PDF import
import { usePdfImport } from '@/modules/solo/composables/usePdfImport'
```

### Step 4: Update Store Usage (Optional)

The store now includes autosave functionality:

```typescript
const soloStore = useSoloStore()

// Schedule autosave (debounced)
soloStore.scheduleAutosave(sessionId, state)

// Force immediate save
await soloStore.saveNow(sessionId, state)

// Check autosave status
soloStore.autosave.isSaving
soloStore.autosave.lastSaved
soloStore.autosave.pendingChanges
```

---

## Data Migration

### Session State

No migration required. Old session data works as-is.

**New optional fields:**
```typescript
// PageState now supports:
interface PageState {
  id: string
  name: string
  strokes: Stroke[]
  shapes: Shape[]
  texts: TextElement[]
  background?: PageBackground  // NEW - defaults to white if missing
}
```

### Shape Data

Old shapes work without changes. New shapes may include:

```typescript
interface Shape {
  // Existing fields...

  // New optional fields (v2):
  radius?: number       // For circles
  arrowStart?: boolean  // For arrows
  arrowEnd?: boolean    // For arrows
  arrowSize?: number    // For arrows
}
```

---

## API Compatibility

**No API changes required.**

All existing endpoints work as before:
- Sessions CRUD
- Sharing
- Export
- Uploads

The backend stores `state` as a JSONB blob, so new fields are automatically supported without backend changes.

---

## Feature Flags

No feature flags needed - all features are enabled by default.

To disable specific features:

```typescript
// Disable autosave
const soloStore = useSoloStore()
soloStore.setAutosaveEnabled(false)

// Disable keyboard shortcuts
const { disable } = useKeyboardShortcuts({})
disable()
```

---

## Component Updates

### SoloCanvas.vue

Now supports:
- `items-update` event for selection changes
- `items-delete` event for deletion
- Background rendering
- Selection UI layer

```vue
<SoloCanvas
  :page="page"
  :tool="tool"
  :color="color"
  :size="size"
  :zoom="zoom"
  :panX="panX"
  :panY="panY"
  @stroke-end="handleStrokeEnd"
  @shape-end="handleShapeEnd"
  @items-update="handleItemsUpdate"  <!-- NEW -->
  @items-delete="handleItemsDelete"  <!-- NEW -->
/>
```

### SoloToolbar.vue

Now includes:
- Arrow style dropdown
- More keyboard shortcut hints
- SVG icons (instead of emoji)
- Responsive design

---

## Testing

Run tests to verify upgrade:

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e
```

---

## Troubleshooting

### Issue: PDF import not working

**Solution:** Install pdfjs-dist:
```bash
npm install pdfjs-dist
```

### Issue: Old sessions show white background

**Expected behavior.** The `background` field defaults to white when not set.

### Issue: Keyboard shortcuts not working

**Check:**
1. Canvas has focus (click on it)
2. Not editing text (shortcuts disabled during text edit)
3. Shortcuts not disabled programmatically

### Issue: Autosave not triggering

**Check:**
1. `soloStore.autosaveEnabled` is true
2. Session has valid ID
3. State is being updated (deep watch)

---

## Rollback

If you need to rollback:

1. Revert frontend code to previous version
2. No database changes needed
3. Old sessions will still work

---

## Support

For issues or questions:
- Check [PROGRESS_LOG.md](./PROGRESS_LOG.md) for implementation details
- Check [API_CONTRACTS_LOCK.md](./API_CONTRACTS_LOCK.md) for API documentation
- Check [KEYBOARD_SHORTCUTS.md](./KEYBOARD_SHORTCUTS.md) for shortcut reference

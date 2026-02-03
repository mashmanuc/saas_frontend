# Changelog - Solo Board v2

All notable changes to the Solo Board frontend are documented in this file.

## [2.0.0] - 2024-02-03

### Major Refactoring Release

This release includes significant improvements to the Solo Board whiteboard application, focusing on new tools, better UX, and performance optimizations.

---

## Added

### New Drawing Tools

#### Circle Tool (Prompt #2)
- Draw circles by dragging from center
- Live preview while drawing
- Stored in `shapes[]` array with `radius` property
- Keyboard shortcut: `C`

#### Arrow Tool (Prompt #3)
- Draw arrows with customizable head styles
- Options: arrow-end, arrow-start, arrow-both
- Adjustable arrow head size (8-30px)
- Stored in `shapes[]` with `arrowStart`, `arrowEnd`, `arrowSize` properties
- Keyboard shortcut: `A`

### Selection Tool (Prompt #6)
- **Rectangle Selection**: Drag to select multiple objects
- **Lasso Selection**: Shift+Drag for freehand selection
- **Multi-select**: Ctrl+Click to toggle selection
- **Move**: Drag selected objects (Shift disables snap)
- **Resize**: 8 corner handles (Shift=aspect ratio, Alt=from center)
- **Visual feedback**: Bounding box, handles, highlights
- **Delete**: Delete/Backspace removes selected
- Keyboard shortcut: `V`

### Background Options (Prompt #7)
- **White** - Plain white (default)
- **Grid** - Vertical and horizontal lines
- **Dots** - Dot pattern
- **Ruled** - Lined paper (horizontal lines)
- **Graph** - Math grid with major/minor lines
- **Custom Color** - Any color via picker
- Configurable grid size (10/20/40 px)
- Configurable line color

### PDF Import (Prompt #8)
- Import PDF files as images
- Client-side conversion using pdfjs-dist
- Progress tracking with modal
- Multi-page support (creates pages)
- Cancel/retry support
- Max file size: 10MB

### Keyboard Shortcuts (Prompt #5)
- 10 tool shortcuts (P, H, E, L, A, R, C, T, N, V)
- 8 action shortcuts (Undo, Redo, Copy, Paste, Select All, Delete, Escape)
- 4 view shortcuts (Zoom In/Out/Reset, Pan mode)
- Cross-platform (Ctrl on Windows, ⌘ on Mac)
- Disabled during text editing

### Performance Optimizations (Prompt #9)
- **Debounced Autosave**: Saves after 2 sec idle, max 10 sec wait
- **Stroke Batching**: Groups strokes by color/size
- **Lazy Rendering**: Only renders visible pages
- **Konva Caching**: Caches complex shapes (>100 strokes)
- **History Limit**: Max 50 undo actions
- **Dev Metrics**: Performance monitoring in dev mode

### Undo/Redo System (Prompt #9)
- Full undo/redo support for all actions
- Batch operations support
- Optional localStorage persistence
- Max 50 actions (configurable)
- Structural sharing (efficient memory)

---

## Improved

### Toolbar (Prompt #4)
- **ToolButton.vue**: SVG icons, animated tooltips, keyboard shortcuts display
- **ColorPicker.vue**: Dropdown UI, recent colors (localStorage), preset palette
- **SizePicker.vue**: Dropdown UI, presets, range slider, live preview
- **SoloToolbar.vue**: SVG icons, grouping, responsive design, dark mode

### Canvas (Multiple Prompts)
- Improved cursor feedback based on mode
- Selection highlights for selected objects
- Pan mode with Space key
- Better zoom controls

---

## Technical Details

### API Contracts
**All existing API contracts preserved** - No backend changes required.

### New Types Added
```typescript
// Prompt #3
type ArrowStyle = 'arrow-end' | 'arrow-start' | 'arrow-both'

// Prompt #7
type BackgroundType = 'white' | 'grid' | 'dots' | 'ruled' | 'graph' | 'color'
interface PageBackground {
  type: BackgroundType
  color?: string
  gridSize?: number
  lineColor?: string
}

// Extended PageState
interface PageState {
  // ... existing
  background?: PageBackground  // NEW
}

// Extended Shape
interface Shape {
  // ... existing
  radius?: number      // for circle
  arrowStart?: boolean // for arrow
  arrowEnd?: boolean   // for arrow
  arrowSize?: number   // for arrow
}
```

### New Composables
| File | Purpose |
|------|---------|
| `useKeyboardShortcuts.ts` | Keyboard shortcut handling |
| `useSelection.ts` | Selection, move, resize logic |
| `useHistory.ts` | Undo/redo stack management |
| `useAutosave.ts` | Debounced autosave |
| `useCanvasOptimization.ts` | Performance optimizations |
| `usePdfImport.ts` | PDF import processing |

### New Components
| File | Purpose |
|------|---------|
| `BackgroundPicker.vue` | Background type selection |
| `PdfImportButton.vue` | PDF import with progress |

### Store Updates
- `soloStore.ts`: Added autosave state and debounced save actions

---

## Backward Compatibility

All changes are **backward compatible**:
- New fields are optional
- Missing `background` defaults to white
- Old sessions work without modification
- No API changes required

---

## Dependencies

### New (Optional)
- `pdfjs-dist` - PDF import (lazy loaded, ~500KB)

### Existing (Unchanged)
- Vue 3
- Pinia
- Konva
- perfect-freehand

---

## Migration

See [MIGRATION.md](./MIGRATION.md) for upgrade instructions.

---

## Contributors

- Solo Board Team
- Claude AI (Anthropic)

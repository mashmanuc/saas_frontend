# Solo Board Frontend

> Interactive whiteboard application with real-time collaboration features.

## Features

### Drawing Tools
- **Pen** (`P`) - Freehand drawing with pressure sensitivity
- **Highlighter** (`H`) - Semi-transparent marker
- **Eraser** (`E`) - Remove strokes

### Shape Tools
- **Line** (`L`) - Straight lines
- **Arrow** (`A`) - Arrows with customizable head styles
- **Rectangle** (`R`) - Rectangles and squares
- **Circle** (`C`) - Circles and ellipses

### Text Tools
- **Text** (`T`) - Add text elements
- **Note** (`N`) - Sticky notes

### Selection Tools
- **Select** (`V`) - Select, move, and resize objects
  - Rectangle selection (drag)
  - Lasso selection (Shift+drag)
  - Multi-select (Ctrl+click)
  - Resize handles (8 points)
  - Move with snap to grid

### Background Options
- White (default)
- Grid (lines)
- Dots
- Ruled (lined paper)
- Graph (math grid)
- Custom color

### Additional Features
- **PDF Import** - Import PDF files as images
- **Undo/Redo** - Full history support (Ctrl+Z / Ctrl+Shift+Z)
- **Zoom** - Zoom in/out (Ctrl+=/-, reset with Ctrl+0)
- **Pan** - Hold Space to pan canvas
- **Autosave** - Automatic saving with debounce

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `P` | Pen tool |
| `H` | Highlighter |
| `E` | Eraser |
| `L` | Line |
| `A` | Arrow |
| `R` | Rectangle |
| `C` | Circle |
| `T` | Text |
| `N` | Note |
| `V` | Select |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+C` | Copy |
| `Ctrl+V` | Paste |
| `Ctrl+A` | Select all |
| `Delete` | Delete selected |
| `Escape` | Deselect / Cancel |
| `Ctrl+=` | Zoom in |
| `Ctrl+-` | Zoom out |
| `Ctrl+0` | Reset zoom |
| `Space` | Pan mode (hold) |

## Project Structure

```
solo_FE/
├── api/
│   └── soloApi.ts          # API client
├── components/
│   ├── canvas/
│   │   └── SoloCanvas.vue  # Main canvas component
│   └── toolbar/
│       ├── SoloToolbar.vue
│       ├── ToolButton.vue
│       ├── ColorPicker.vue
│       ├── SizePicker.vue
│       ├── BackgroundPicker.vue
│       └── PdfImportButton.vue
├── composables/
│   ├── useKeyboardShortcuts.ts
│   ├── useSelection.ts
│   ├── useHistory.ts
│   ├── useAutosave.ts
│   ├── useCanvasOptimization.ts
│   └── usePdfImport.ts
├── store/
│   └── soloStore.ts        # Pinia store
├── types/
│   └── solo.ts             # TypeScript types
└── tests/
    └── e2e/
        └── new-tools.spec.ts
```

## Types

### Tool Types
```typescript
type Tool =
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'arrow'
  | 'rectangle'
  | 'circle'
  | 'text'
  | 'note'
  | 'select'
```

### Page State
```typescript
interface PageState {
  id: string
  name: string
  strokes: Stroke[]
  shapes: Shape[]
  texts: TextElement[]
  background?: PageBackground
}
```

### Background Types
```typescript
type BackgroundType = 'white' | 'grid' | 'dots' | 'ruled' | 'graph' | 'color'

interface PageBackground {
  type: BackgroundType
  color?: string       // for 'color' type
  gridSize?: number    // spacing (default 20)
  lineColor?: string   // pattern color
}
```

## API Integration

All data is persisted through the Solo API:

```typescript
// Sessions
soloApi.getSessions()
soloApi.getSession(id)
soloApi.createSession(data)
soloApi.updateSession(id, data)
soloApi.deleteSession(id)
soloApi.duplicateSession(id)

// Sharing
soloApi.createShare(id, options)
soloApi.getShare(id)
soloApi.revokeShare(id)
soloApi.getPublicSession(token)

// Export
soloApi.requestExport(id, format)
soloApi.getExportStatus(exportId)

// Upload
soloApi.presignUpload(payload)
```

## Performance

### Optimizations
- **Debounced autosave** - Saves after 2 sec idle, max 10 sec wait
- **Stroke batching** - Groups strokes by color/size for efficient rendering
- **Lazy rendering** - Only renders visible pages
- **Konva caching** - Caches complex shapes (>100 strokes)
- **History limit** - Keeps last 50 undo actions

### Dev Tools
```javascript
// Performance metrics (dev mode only)
window.__soloCanvasPerf.printReport()
window.__soloCanvasPerf.getMetrics()
window.__soloCanvasPerf.getAverage()
```

## Testing

### Unit Tests
```bash
npm run test
```

### E2E Tests
```bash
npm run test:e2e
```

## Dependencies

- **Vue 3** - Framework
- **Pinia** - State management
- **Konva** - Canvas rendering
- **perfect-freehand** - Stroke smoothing
- **pdfjs-dist** - PDF import (lazy loaded)

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for version history.

## License

MIT

# Solo v2 Migration Guide

**Версія**: 2.0  
**Дата**: 2026-02-03  
**Гілка**: `solo-v2-migration`  
**Статус**: Ready for Testing

---

## 📋 Зміст

1. [Огляд змін](#огляд-змін)
2. [Нові можливості](#нові-можливості)
3. [Breaking Changes](#breaking-changes)
4. [Інструкція з міграції](#інструкція-з-міграції)
5. [API Changes](#api-changes)
6. [Тестування](#тестування)
7. [Rollback](#rollback)
8. [FAQ](#faq)

---

## 🎯 Огляд Змін

Solo v2 - це major update з новими інструментами, composables та покращеною архітектурою. Всі зміни backward compatible.

### Що нового?
- ✅ Arrow tool з 3 стилями
- ✅ Circle tool
- ✅ Background picker (6 типів)
- ✅ PDF Import
- ✅ Keyboard shortcuts (22 комбінації)
- ✅ Autosave з debounce
- ✅ Selection tools (lasso, rectangle)
- ✅ Canvas optimization

### Що змінилось?
- ✅ UI Toolbar (SVG іконки замість емоджі)
- ✅ Store (додано autosave)
- ✅ Canvas (нові інструменти + optimization)
- ✅ Workspace (keyboard shortcuts + autosave)

### Що залишилось без змін?
- ✅ Старі інструменти (Pen, Highlighter, Eraser, Line, Rectangle, Text, Note)
- ✅ API endpoints
- ✅ Data structures (розширено, не замінено)

---

## 🚀 Нові Можливості

### 1. Arrow Tool
**Що це**: Інструмент для малювання стрілок з різними стилями

**Як використовувати**:
```vue
<SoloToolbar
  :current-tool="tool"
  :current-arrow-style="arrowStyle"
  :current-arrow-size="arrowSize"
  @tool-change="tool = $event"
  @arrow-style-change="arrowStyle = $event"
  @arrow-size-change="arrowSize = $event"
/>
```

**Стилі**:
- `arrow-end` - стрілка в кінці
- `arrow-start` - стрілка на початку
- `arrow-both` - стрілки з обох боків

**Розмір голівки**: 8-30px (default: 15px)

**Keyboard shortcut**: `A`

---

### 2. Circle Tool
**Що це**: Інструмент для малювання кіл

**Як використовувати**:
```typescript
// Canvas автоматично обробляє circle tool
// Просто встановіть tool = 'circle'
```

**Keyboard shortcut**: `C`

---

### 3. Background Picker
**Що це**: Вибір фону для сторінки

**Типи фону**:
1. `white` - білий фон (default)
2. `grid` - сітка
3. `dots` - точки
4. `ruled` - лінії (як в зошиті)
5. `graph` - графічна сітка
6. `color` - solid color

**Як використовувати**:
```vue
<BackgroundPicker
  :model-value="currentBackground"
  @update:model-value="updateBackground"
/>
```

**Структура**:
```typescript
interface PageBackground {
  type: BackgroundType
  color?: string       // для 'color' type
  gridSize?: number    // spacing (10-50px, default: 20)
  lineColor?: string   // колір ліній (default: #e5e7eb)
}
```

---

### 4. PDF Import
**Що це**: Імпорт PDF файлів на canvas

**Як використовувати**:
```vue
<PdfImportButton
  :session-id="sessionId"
  :max-file-size-m-b="10"
  @import-complete="handlePdfImport"
  @import-error="handleError"
/>
```

**Обмеження**:
- Max file size: 10MB (configurable)
- Render scale: 2x (для якості)
- Image quality: 0.92

**Process**:
1. User selects PDF
2. Render кожної сторінки в canvas
3. Convert to blob
4. Upload на CDN
5. Create pages з background images

---

### 5. Keyboard Shortcuts
**Що це**: 22 гарячі клавіші для швидкої роботи

**Tools**:
- `P` - Pen
- `H` - Highlighter
- `E` - Eraser
- `L` - Line
- `A` - Arrow
- `R` - Rectangle
- `C` - Circle
- `T` - Text
- `N` - Note
- `V` - Select

**Actions**:
- `Ctrl+Z` - Undo
- `Ctrl+Y` / `Ctrl+Shift+Z` - Redo
- `Ctrl+C` - Copy selected
- `Ctrl+V` - Paste
- `Delete` / `Backspace` - Delete selected
- `Ctrl+A` - Select all
- `Escape` - Deselect

**Zoom**:
- `Ctrl+Plus` - Zoom in
- `Ctrl+Minus` - Zoom out
- `Ctrl+0` - Reset zoom

**Pan**:
- `Space+Drag` - Pan canvas

**Як використовувати**:
```typescript
import { useKeyboardShortcuts } from '@/modules/solo/composables/useKeyboardShortcuts'

const { isEnabled, setEnabled } = useKeyboardShortcuts({
  onToolChange: (tool) => currentTool.value = tool,
  onUndo: () => undo(),
  onRedo: () => redo(),
  // ... інші callbacks
})
```

---

### 6. Autosave
**Що це**: Автоматичне збереження змін з debounce

**Конфігурація**:
- Debounce: 2000ms (2 секунди)
- Max wait: 10000ms (10 секунд)
- Save before unload: так

**Як використовувати**:
```typescript
import { useSoloStore } from '@/modules/solo/store/soloStore'

const store = useSoloStore()

// Schedule autosave
store.scheduleAutosave(sessionId, workspaceState)

// Force save
await store.saveNow(sessionId, workspaceState)

// Cancel pending
store.cancelAutosave()

// Toggle
store.setAutosaveEnabled(false)
```

**Status**:
```typescript
const isSaving = computed(() => store.isSaving)
const hasPendingChanges = computed(() => store.hasPendingChanges)
const lastSavedAt = computed(() => store.lastSavedAt)
const saveCount = computed(() => store.saveCount)
```

---

### 7. Selection Tools
**Що це**: Виділення та маніпуляція об'єктами

**Режими**:
1. **Rectangle Select** - прямокутне виділення
2. **Lasso Select** - вільне виділення
3. **Move** - переміщення виділених
4. **Resize** - зміна розміру

**Як використовувати**:
```typescript
import { useSelection } from '@/modules/solo/composables/useSelection'

const {
  selectedItems,
  selectionMode,
  selectItems,
  deselectAll,
  moveSelected,
  resizeSelected,
  deleteSelected
} = useSelection(pageState)
```

**Keyboard**:
- `Ctrl+A` - Select all
- `Delete` - Delete selected
- `Escape` - Deselect

---

### 8. Canvas Optimization
**Що це**: Performance optimization для великих canvas

**Features**:
- Stroke batching за color/size
- Lazy rendering (тільки видимі сторінки)
- Performance metrics (dev mode)
- Memory management

**Metrics** (dev mode):
```typescript
{
  renderTime: number      // час рендерингу (ms)
  strokeCount: number     // кількість штрихів
  batchCount: number      // кількість батчів
  fps: number            // frames per second
}
```

---

## ⚠️ Breaking Changes

**Немає breaking changes!**

Всі зміни backward compatible. Старий код працює без модифікацій.

### Що може потребувати уваги:

1. **TypeScript Types**
   - Додано нові optional поля в `Shape`, `PageState`
   - Якщо ви використовуєте strict type checking, може знадобитися оновити типи

2. **Events**
   - Додано нові events: `arrow-style-change`, `arrow-size-change`, `items-update`, `items-delete`
   - Старі events працюють як раніше

3. **Props**
   - Додано нові optional props в `SoloToolbar`
   - Старі props працюють як раніше

---

## 📝 Інструкція з Міграції

### Крок 1: Оновити Dependencies

```bash
npm install pdfjs-dist@4.0.379
```

### Крок 2: Перевірити TypeScript

```bash
npm run typecheck
```

Якщо є помилки в Solo модулі - повідомте команду.

### Крок 3: Оновити Компоненти (якщо потрібно)

Якщо ви використовуєте Solo компоненти в інших місцях:

**До**:
```vue
<SoloToolbar
  :current-tool="tool"
  :current-color="color"
  :current-size="size"
  @tool-change="tool = $event"
/>
```

**Після** (з новими можливостями):
```vue
<SoloToolbar
  :current-tool="tool"
  :current-color="color"
  :current-size="size"
  :current-arrow-style="arrowStyle"
  :current-arrow-size="arrowSize"
  @tool-change="tool = $event"
  @arrow-style-change="arrowStyle = $event"
  @arrow-size-change="arrowSize = $event"
/>
```

### Крок 4: Тестування

```bash
# Dev server
npm run dev

# Unit tests
npm run test:unit

# E2E tests
npm run test:e2e
```

---

## 🔄 API Changes

### Store

**Додано**:
```typescript
// State
autosave: AutosaveStatus
autosaveEnabled: boolean

// Getters
isSaving: boolean
hasPendingChanges: boolean
lastSavedAt: Date | null
saveCount: number

// Actions
scheduleAutosave(id: string, state: WorkspaceState): void
saveNow(id: string, state: WorkspaceState): Promise<void>
cancelAutosave(): void
setAutosaveEnabled(enabled: boolean): void
```

### Types

**Додано**:
```typescript
type Tool = '...' | 'arrow' | 'circle'
type ArrowStyle = 'arrow-end' | 'arrow-start' | 'arrow-both'
type BackgroundType = 'white' | 'grid' | 'dots' | 'ruled' | 'graph' | 'color'

interface PageBackground {
  type: BackgroundType
  color?: string
  gridSize?: number
  lineColor?: string
}

interface Shape {
  // ... existing
  radius?: number
  arrowStart?: boolean
  arrowEnd?: boolean
  arrowSize?: number
}

interface PageState {
  // ... existing
  background?: PageBackground
}
```

### Events

**Додано**:
```typescript
// SoloToolbar
'arrow-style-change': [style: ArrowStyle]
'arrow-size-change': [size: number]

// SoloCanvas
'items-update': [items: any[]]
'items-delete': [itemIds: string[]]
```

---

## 🧪 Тестування

### Мануальне Тестування

**Чек-лист**:

1. **Інструменти**:
   - [ ] Pen - малювання працює
   - [ ] Highlighter - напівпрозорий
   - [ ] Eraser - видаляє штрихи
   - [ ] Line - пряма лінія
   - [ ] Arrow - 3 стилі працюють
   - [ ] Rectangle - прямокутник
   - [ ] Circle - коло
   - [ ] Text - текст додається
   - [ ] Note - sticky note
   - [ ] Select - виділення працює

2. **Background**:
   - [ ] White - default
   - [ ] Grid - сітка відображається
   - [ ] Dots - точки відображаються
   - [ ] Ruled - лінії як в зошиті
   - [ ] Graph - графічна сітка
   - [ ] Color - solid color

3. **Keyboard Shortcuts**:
   - [ ] P, H, E, L, A, R, C, T, N, V - tools
   - [ ] Ctrl+Z, Ctrl+Y - undo/redo
   - [ ] Ctrl+C, Ctrl+V - copy/paste
   - [ ] Delete - delete selected
   - [ ] Ctrl+A - select all
   - [ ] Escape - deselect

4. **Autosave**:
   - [ ] Зміни зберігаються через 2s
   - [ ] Max wait 10s працює
   - [ ] Save before unload
   - [ ] Visual indicator

5. **PDF Import**:
   - [ ] File select працює
   - [ ] Progress modal показується
   - [ ] Pages створюються
   - [ ] Error handling

### Unit Tests

```bash
npm run test:unit
```

Перевірити:
- `useKeyboardShortcuts.spec.ts`
- `useSelection.spec.ts`
- `useHistory.spec.ts`

### E2E Tests

```bash
npm run test:e2e
```

Перевірити:
- `new-tools.spec.ts` (Arrow, Circle)
- Autosave flow
- PDF import flow

---

## 🔙 Rollback

Якщо щось пішло не так, можна повернутися до старої версії.

### Швидкий Rollback

```bash
# 1. Checkout попередній commit
git checkout HEAD~1

# 2. Або використати backup файли
cp docs/SOLO_v2/solo_v1_backup/*.vue src/modules/solo/...
cp docs/SOLO_v2/solo_v1_backup/soloStore.ts src/modules/solo/store/
```

### Повний Rollback

```bash
# 1. Видалити нові composables
rm src/modules/solo/composables/useKeyboardShortcuts.ts
rm src/modules/solo/composables/useSelection.ts
rm src/modules/solo/composables/useHistory.ts
rm src/modules/solo/composables/useAutosave.ts
rm src/modules/solo/composables/useCanvasOptimization.ts
rm src/modules/solo/composables/usePdfImport.ts

# 2. Видалити нові компоненти
rm src/modules/solo/components/toolbar/BackgroundPicker.vue
rm src/modules/solo/components/toolbar/PdfImportButton.vue

# 3. Відновити старі файли з backup
cp docs/SOLO_v2/solo_v1_backup/soloStore.ts src/modules/solo/store/
cp docs/SOLO_v2/solo_v1_backup/SoloToolbar.vue src/modules/solo/components/toolbar/
cp docs/SOLO_v2/solo_v1_backup/ToolButton.vue src/modules/solo/components/toolbar/
cp docs/SOLO_v2/solo_v1_backup/SoloCanvas.vue src/modules/solo/components/canvas/
cp docs/SOLO_v2/solo_v1_backup/SoloWorkspace.vue src/modules/solo/views/

# 4. Відновити старі типи
git checkout HEAD~2 -- src/modules/solo/types/solo.ts

# 5. Видалити pdfjs-dist
npm uninstall pdfjs-dist

# 6. Restart dev server
npm run dev
```

**Час rollback**: ~5 хвилин

---

## ❓ FAQ

### Q: Чи потрібно оновлювати існуючий код?
**A**: Ні. Всі зміни backward compatible. Старий код працює без модифікацій.

### Q: Чи можна використовувати тільки деякі нові features?
**A**: Так. Всі нові features optional. Можна використовувати тільки те, що потрібно.

### Q: Що робити, якщо typecheck не проходить?
**A**: Перевірте, чи всі типи оновлені. Якщо проблема в Solo модулі - повідомте команду.

### Q: Як вимкнути autosave?
**A**: `store.setAutosaveEnabled(false)`

### Q: Як змінити debounce час для autosave?
**A**: Наразі hardcoded (2s/10s). Якщо потрібно змінити - відредагуйте константи в `soloStore.ts`:
```typescript
const AUTOSAVE_DEBOUNCE_MS = 2000
const AUTOSAVE_MAX_WAIT_MS = 10000
```

### Q: Чи працює PDF import offline?
**A**: Ні. Потрібен інтернет для завантаження pdfjs worker з CDN.

### Q: Як додати свій keyboard shortcut?
**A**: Відредагуйте `useKeyboardShortcuts.ts` та додайте нову комбінацію в `keyMap`.

### Q: Чи можна використовувати старі емоджі іконки?
**A**: Так. ToolButton підтримує fallback на emoji через prop `icon`.

### Q: Що робити при помилці "pdfjs-dist not found"?
**A**: Запустіть `npm install pdfjs-dist@4.0.379`

### Q: Як перевірити, чи працює autosave?
**A**: Відкрийте DevTools Console. В dev mode будуть логи `[Autosave] Saved (N total)`.

---

## 📞 Підтримка

**Питання?** Звертайтесь до команди:
- GitHub Issues: `solo-v2-migration` label
- Slack: #solo-board channel
- Email: dev@m4sh.com

**Документація**:
- `docs/SOLO_v2/PHASE_1_2_COMPLETE_REPORT.md` - повний звіт
- `docs/SOLO_v2/MIGRATION_PROGRESS_REPORT.md` - прогрес
- `docs/SOLO_v2/INTEGRATION_AUDIT_PLAN.md` - початковий план

---

**Версія**: 2.0  
**Дата**: 2026-02-03  
**Автор**: M4SH Team  
**Статус**: ✅ Ready for Testing

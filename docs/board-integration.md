# Board Integration Guide (Konva)

> Документація по інтеграції Konva-дошки в інші застосунки M4SH Platform.

## Огляд архітектури

Нова дошка побудована на **Konva.js** через **vue-konva** і складається з таких компонентів:

```
src/modules/classroom/components/board/
├── BoardCanvas.vue          # Основний Konva canvas
├── BoardDock.vue            # Обгортка з zoom controls
├── BoardToolbarVertical.vue # Вертикальна панель інструментів
├── Subtoolbar.vue           # Підпанель (товщина, кольори)
├── CloudStatus.vue          # Статус синхронізації
├── ExportMenu.vue           # Меню експорту (PNG/PDF/JSON)
└── icons/                   # SVG іконки
```

## Залежності

```json
{
  "konva": "^10.0.12",
  "vue-konva": "^3.2.6",
  "perfect-freehand": "^1.2.2"
}
```

### Реєстрація плагіна

У `src/main.js` обов'язково підключити:

```js
import VueKonva from 'vue-konva'

const app = createApp(App)
app.use(VueKonva)
```

## Базова інтеграція

### 1. Мінімальний приклад

```vue
<template>
  <div class="my-board-container">
    <BoardToolbarVertical
      :current-tool="boardStore.currentTool"
      :current-color="boardStore.currentColor"
      :current-size="boardStore.currentSize"
      @tool-change="boardStore.setTool"
      @color-change="boardStore.setColor"
      @size-change="boardStore.setSize"
      @undo="boardStore.undo"
      @redo="boardStore.redo"
    />
    
    <BoardDock
      :board-state="boardStore.serializedState"
      :permissions="permissions"
      :readonly="false"
      @event="handleBoardEvent"
      @state-change="handleStateChange"
    />
  </div>
</template>

<script setup>
import { useBoardStore } from '@/modules/classroom/board/state/boardStore'
import BoardDock from '@/modules/classroom/components/board/BoardDock.vue'
import BoardToolbarVertical from '@/modules/classroom/components/board/BoardToolbarVertical.vue'

const boardStore = useBoardStore()

const permissions = {
  can_draw: true,
  can_erase: true,
  can_add_text: true,
  can_add_shapes: true,
  can_add_images: true,
  can_add_layers: false,
  can_export: true,
}

function handleBoardEvent(eventType, data) {
  switch (eventType) {
    case 'stroke_add':
      boardStore.addStroke(data.stroke)
      break
    case 'tool_change':
      boardStore.setTool(data.tool)
      break
    // ...
  }
}

function handleStateChange(newState) {
  boardStore.markDirty()
}
</script>
```

### 2. З автозбереженням у хмару

```vue
<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import { useBoardStore } from '@/modules/classroom/board/state/boardStore'

const boardStore = useBoardStore()

onMounted(async () => {
  // Завантажити існуючу сесію
  const sessionId = route.params.id
  if (sessionId) {
    await boardStore.loadSession(sessionId)
  } else {
    // Створити нову сесію
    await boardStore.createSession('My Board')
  }
})

onBeforeUnmount(async () => {
  // Зберегти перед виходом
  await boardStore.autosave()
})
</script>
```

## Компоненти

### BoardDock

Основний контейнер дошки.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `boardState` | `object` | required | Серіалізований стан дошки |
| `permissions` | `RoomPermissions` | required | Права доступу |
| `readonly` | `boolean` | `false` | Режим тільки для читання |

| Event | Payload | Description |
|-------|---------|-------------|
| `event` | `(type, data)` | Події дошки (stroke_add, tool_change, etc.) |
| `state-change` | `state` | Зміна стану |

### BoardToolbarVertical

Вертикальна панель інструментів (Kami-style).

| Prop | Type | Description |
|------|------|-------------|
| `currentTool` | `string` | Поточний інструмент |
| `currentColor` | `string` | Поточний колір |
| `currentSize` | `number` | Поточна товщина |
| `canUndo` | `boolean` | Чи можна undo |
| `canRedo` | `boolean` | Чи можна redo |

| Event | Payload | Description |
|-------|---------|-------------|
| `tool-change` | `tool` | Зміна інструменту |
| `color-change` | `color` | Зміна кольору |
| `size-change` | `size` | Зміна товщини |
| `undo` | — | Undo |
| `redo` | — | Redo |
| `clear` | — | Очистити дошку |

### Subtoolbar

Підпанель для налаштування товщини та кольору.

| Prop | Type | Description |
|------|------|-------------|
| `currentSize` | `number` | Поточна товщина |
| `currentColor` | `string` | Поточний колір |
| `sizes` | `number[]` | Доступні товщини (default: [1, 2, 4, 8]) |
| `colors` | `string[]` | Доступні кольори |

## boardStore API

### State

```ts
interface BoardState {
  sessionId: string | null
  sessionName: string
  strokes: unknown[]
  assets: unknown[]
  pages: unknown[]
  currentPageIndex: number
  syncStatus: 'idle' | 'syncing' | 'saved' | 'error'
  lastSavedAt: Date | null
  currentTool: string
  currentColor: string
  currentSize: number
  zoom: number
  undoStack: unknown[]
  redoStack: unknown[]
}
```

### Actions

| Method | Description |
|--------|-------------|
| `loadSession(id)` | Завантажити сесію з бекенду |
| `createSession(name?)` | Створити нову сесію |
| `updateSession()` | Зберегти поточний стан |
| `autosave()` | Автозбереження (debounced) |
| `markDirty()` | Позначити як змінений |
| `addStroke(stroke)` | Додати штрих |
| `undo()` | Скасувати |
| `redo()` | Повторити |
| `clearBoard()` | Очистити дошку |
| `setTool(tool)` | Встановити інструмент |
| `setColor(color)` | Встановити колір |
| `setSize(size)` | Встановити товщину |
| `setZoom(zoom)` | Встановити масштаб |

### Getters

| Getter | Description |
|--------|-------------|
| `canUndo` | Чи можна undo |
| `canRedo` | Чи можна redo |
| `serializedState` | Серіалізований стан для BoardDock |
| `hasSession` | Чи є активна сесія |
| `isSyncing` | Чи йде синхронізація |

## Інструменти

| Tool | Description |
|------|-------------|
| `pen` | Олівець |
| `highlighter` | Маркер (напівпрозорий) |
| `eraser` | Гумка |
| `line` | Лінія |
| `rectangle` | Прямокутник |
| `text` | Текст |
| `select` | Виділення |

## Кольори за замовчуванням

```js
const PRESET_COLORS = [
  '#111111', // Black
  '#22c55e', // Green
  '#e879f9', // Pink
  '#2563eb', // Blue
  '#eab308', // Yellow
]
```

## Товщини за замовчуванням

```js
const PRESET_SIZES = [1, 2, 4, 8] // px
```

## Розміри UI (ТЗ v0.28)

### Desktop

- **Toolbar**: 48px width, buttons 40×40, icons 20×20
- **Header**: 64px height, padding 0 24px
- **Footer**: 48px height, padding 0 20px

### Mobile (≤768px)

- **Toolbar**: 44px width, buttons 36×36, icons 18×18
- **Header**: padding 0 16px (≤1024px)

## Приклади використання

### Solo Workspace

Див. `src/modules/classroom/views/SoloRoom.vue`

### Lesson Room

Див. `src/modules/classroom/views/LessonRoom.vue`

### Public View (readonly)

```vue
<BoardDock
  :board-state="sessionState"
  :permissions="{ can_draw: false }"
  :readonly="true"
/>
```

## Експорт

Використовуйте `ExportMenu` для експорту:

```vue
<ExportMenu
  :session-id="boardStore.sessionId"
  @export-start="boardStore.setExporting(true)"
  @export-complete="handleExportComplete"
  @export-error="handleExportError"
/>
```

## Troubleshooting

### Компоненти v-stage/v-layer не рендеряться

Переконайтеся, що `vue-konva` підключено в `main.js`:

```js
import VueKonva from 'vue-konva'
app.use(VueKonva)
```

### Помилки типів

Перевірте, що `konva` та `vue-konva` встановлені:

```bash
npm install konva vue-konva perfect-freehand
```

### Дошка не зберігається

Перевірте, що `boardStore.markDirty()` викликається після кожної зміни.

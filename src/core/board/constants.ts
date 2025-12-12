// Board Constants for Advanced Whiteboard v2

import type { GridConfig, ToolConfig, Viewport } from './types'

// Viewport defaults
export const DEFAULT_VIEWPORT: Viewport = {
  x: 0,
  y: 0,
  zoom: 1,
  width: 0,
  height: 0,
}

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 5.0
export const ZOOM_STEP = 0.1

// Grid defaults
export const DEFAULT_GRID_CONFIG: GridConfig = {
  enabled: true,
  size: 20,
  color: '#e0e0e0',
  opacity: 0.5,
  snap: false,
}

// Tool defaults
export const DEFAULT_TOOL_CONFIG: ToolConfig = {
  color: '#000000',
  thickness: 3,
  opacity: 1,
  shapeType: 'rectangle',
  fontSize: 16,
  fontFamily: 'Inter, sans-serif',
  stickyColor: '#fff740',
  connectorType: 'straight',
}

// Stroke smoothing
export const STROKE_SMOOTHING = 0.3
export const MIN_STROKE_DISTANCE = 2

// Selection
export const SELECTION_HANDLE_SIZE = 8
export const SELECTION_PADDING = 4
export const SELECTION_COLOR = '#0066ff'
export const SELECTION_FILL = 'rgba(0, 102, 255, 0.1)'

// Layers
export const MAX_LAYERS = 20
export const DEFAULT_LAYER_OPACITY = 1

// History
export const MAX_HISTORY_ENTRIES = 100

// Offline
export const OFFLINE_STORAGE_KEY = 'board_offline_state'
export const OFFLINE_QUEUE_KEY = 'board_offline_queue'
export const MAX_OFFLINE_QUEUE_SIZE = 1000

// Sync
export const SYNC_DEBOUNCE_MS = 500
export const CURSOR_SYNC_INTERVAL_MS = 50
export const CURSOR_TIMEOUT_MS = 5000

// Canvas
export const CANVAS_BACKGROUND = '#ffffff'
export const CANVAS_PADDING = 100

// Sticky note colors
export const STICKY_COLORS = [
  '#fff740', // Yellow
  '#ff7eb9', // Pink
  '#7afcff', // Cyan
  '#98ff98', // Green
  '#ffb347', // Orange
  '#dda0dd', // Plum
]

// Shape defaults
export const DEFAULT_SHAPE_FILL = '#ffffff'
export const DEFAULT_SHAPE_STROKE = '#000000'
export const DEFAULT_SHAPE_STROKE_WIDTH = 2

// Text defaults
export const DEFAULT_TEXT_COLOR = '#000000'
export const DEFAULT_FONT_SIZE = 16
export const DEFAULT_FONT_FAMILY = 'Inter, sans-serif'
export const FONT_FAMILIES = [
  'Inter, sans-serif',
  'Arial, sans-serif',
  'Georgia, serif',
  'Courier New, monospace',
  'Comic Sans MS, cursive',
]

// Connector defaults
export const CONNECTOR_ARROW_SIZE = 10
export const CONNECTOR_HIT_TOLERANCE = 10

// Export
export const EXPORT_QUALITY = {
  low: 0.6,
  medium: 0.8,
  high: 1.0,
}

export const EXPORT_SCALE = {
  '1x': 1,
  '2x': 2,
  '3x': 3,
}

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS: Record<string, string> = {
  'v': 'select',
  'h': 'pan',
  'p': 'pencil',
  'm': 'marker',
  'e': 'eraser',
  's': 'shape',
  't': 'text',
  'n': 'sticky',
  'l': 'connector',
}

// Tool cursors
export const TOOL_CURSORS: Record<string, string> = {
  select: 'default',
  pan: 'grab',
  pencil: 'crosshair',
  marker: 'crosshair',
  highlighter: 'crosshair',
  eraser: 'crosshair',
  shape: 'crosshair',
  text: 'text',
  image: 'copy',
  sticky: 'crosshair',
  connector: 'crosshair',
  laser: 'crosshair',
}

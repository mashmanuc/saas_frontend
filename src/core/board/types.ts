// Board Types for Advanced Whiteboard v2

export interface Point {
  x: number
  y: number
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface Viewport {
  x: number
  y: number
  zoom: number
  width: number
  height: number
}

export interface Transform {
  x?: number
  y?: number
  rotation?: number
  scaleX?: number
  scaleY?: number
}

// Layer Types
export type LayerType = 'background' | 'content' | 'annotation' | 'overlay'

export interface Layer {
  id: number
  name: string
  type: LayerType
  order: number
  visible: boolean
  locked: boolean
  opacity: number
  color?: string
  componentCount: number
}

export interface LayerData {
  id: number
  name: string
  type: LayerType
  order: number
  visible: boolean
  locked: boolean
  opacity: number
  color?: string
}

// Component Types
export type ComponentType = 'stroke' | 'shape' | 'text' | 'image' | 'sticky' | 'connector' | 'frame'

export interface Component {
  id: string
  type: ComponentType
  layerId: number
  x: number
  y: number
  width?: number
  height?: number
  rotation: number
  scaleX: number
  scaleY: number
  data: ComponentData
  locked: boolean
  visible: boolean
  version: number
}

export type ComponentData = StrokeData | ShapeData | TextData | ImageData | StickyData | ConnectorData | FrameData

export interface StrokeData {
  points: Point[]
  color: string
  thickness: number
  opacity: number
  tool: 'pencil' | 'marker' | 'highlighter'
  smoothing?: number
}

export type ShapeType = 'rectangle' | 'ellipse' | 'triangle' | 'line' | 'arrow' | 'star' | 'polygon'

export interface ShapeData {
  shapeType: ShapeType
  fill?: string
  stroke?: string
  strokeWidth?: number
  opacity?: number
  cornerRadius?: number
  sides?: number // for polygon
}

export interface TextData {
  text: string
  fontSize: number
  fontFamily: string
  fontWeight?: number
  fontStyle?: 'normal' | 'italic'
  color: string
  align?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  lineHeight?: number
}

export interface ImageData {
  src: string
  originalWidth: number
  originalHeight: number
  crop?: { x: number; y: number; width: number; height: number }
  filters?: ImageFilters
}

export interface ImageFilters {
  brightness?: number
  contrast?: number
  saturation?: number
  blur?: number
}

export interface StickyData {
  text: string
  color: string
  fontSize?: number
}

export interface ConnectorData {
  startComponentId?: string
  endComponentId?: string
  startPoint: Point
  endPoint: Point
  pathType: 'straight' | 'curved' | 'orthogonal'
  startArrow?: boolean
  endArrow?: boolean
  color: string
  thickness: number
}

export interface FrameData {
  name: string
  backgroundColor?: string
}

// Tool Types
export type ToolType =
  | 'select'
  | 'pan'
  | 'pencil'
  | 'marker'
  | 'highlighter'
  | 'eraser'
  | 'shape'
  | 'text'
  | 'image'
  | 'sticky'
  | 'connector'
  | 'laser'

export interface ToolConfig {
  color?: string
  thickness?: number
  opacity?: number
  shapeType?: ShapeType
  fontSize?: number
  fontFamily?: string
  stickyColor?: string
  connectorType?: 'straight' | 'curved' | 'orthogonal'
}

// History Types
export type HistoryAction = 'create' | 'update' | 'delete' | 'move' | 'transform' | 'batch'

export interface HistoryEntry {
  id: string
  action: HistoryAction
  componentId: string | null
  previousState: unknown
  newState: unknown
  timestamp: number
  batchId?: string
}

export interface HistoryEntryData {
  id: string
  action: HistoryAction
  componentId: string | null
  previousState: unknown
  newState: unknown
  timestamp: number
  batchId?: string
}

// Sync Types
export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error' | 'offline'

export interface BoardOperation {
  id?: string
  type: 'create' | 'update' | 'delete' | 'batch'
  componentId?: string
  data?: unknown
  operations?: BoardOperation[]
}

export interface QueuedOperation {
  id: string
  operation: BoardOperation
  timestamp: number
  retries: number
}

export interface SyncResult {
  success: boolean
  synced: number
  failed: number
  errors?: Error[]
}

// Remote Cursor
export interface RemoteCursor {
  id: string
  userId: string
  userName: string
  color: string
  x: number
  y: number
  tool?: ToolType
  lastUpdate: number
}

// Grid Config
export interface GridConfig {
  enabled: boolean
  size: number
  color: string
  opacity: number
  snap: boolean
}

// Export Types
export type ExportFormat = 'png' | 'jpg' | 'svg' | 'pdf' | 'json'

export interface ExportOptions {
  viewport?: boolean
  quality?: number
  scale?: number
  background?: string
  includeGrid?: boolean
}

// Video Integration
export type VideoLayout = 'pip' | 'split' | 'hidden'

// Board Version
export interface BoardVersion {
  id: number
  name: string
  description?: string
  createdAt: Date
  createdBy: string
  thumbnail?: string
}

// Board State
export interface BoardState {
  sessionId: string
  layers: Layer[]
  components: Component[]
  viewport: Viewport
  version: number
}

// Board Config
export interface BoardConfig {
  sessionId: string
  userId: string
  apiUrl: string
  wsUrl: string
  readOnly?: boolean
  initialViewport?: Viewport
}

// Board Error
export interface BoardError {
  code: string
  message: string
  details?: unknown
}

// Render Options
export interface RenderOptions {
  showGrid?: boolean
  showCursors?: boolean
  showSelection?: boolean
  quality?: 'low' | 'medium' | 'high'
}

// Infinite Canvas Config
export interface InfiniteCanvasConfig {
  minZoom?: number
  maxZoom?: number
  zoomStep?: number
  panInertia?: boolean
  wheelZoom?: boolean
  pinchZoom?: boolean
}

// Create/Update Component Data
export interface CreateComponentData {
  type: ComponentType
  layerId: number
  position: Point
  data: ComponentData
}

export interface UpdateComponentData {
  id: string
  updates: Partial<Component>
}

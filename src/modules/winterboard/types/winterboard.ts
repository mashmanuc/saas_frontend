// WB: Core type definitions for Winterboard v3
// Ref: ARCHITECTURE.md, ManifestWinterboard_v2.md (LAW-03, LAW-08, LAW-09, LAW-15, LAW-19)

// ─── Geometry ───────────────────────────────────────────────────────────────

export interface WBPoint {
  x: number
  y: number
  /** Timestamp (ms since epoch) for velocity/pressure calculations */
  t?: number
  /** Pointer pressure 0.0–1.0 (LAW-15: pressure sensitivity) */
  pressure?: number
}

// ─── Tools ──────────────────────────────────────────────────────────────────

export type WBToolType =
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'rectangle'
  | 'circle'
  | 'text'
  | 'select'
  | 'laser'
  | 'sticky'

// ─── Laser Pointer (v5 A4 — ephemeral, not persisted) ──────────────────────

export interface WBLaserPosition {
  x: number
  y: number
}

export interface WBRemoteLaser {
  userId: string
  displayName: string
  x: number
  y: number
  pageId: string
  color: string
  active: boolean
  lastUpdate: number
}

// ─── Stroke ─────────────────────────────────────────────────────────────────

export interface WBStroke {
  id: string
  tool: WBToolType
  color: string
  size: number
  opacity: number
  points: WBPoint[]
  /** For shapes (rectangle, circle) — bounding dimensions */
  width?: number
  height?: number
  /** For text tool */
  text?: string
  /** v5 A3: Lock state — locked items cannot be moved/deleted/erased */
  locked?: boolean
  lockedBy?: string
}

// ─── Selection (v5: A1 — Rectangle Select) ─────────────────────────────────

export interface WBSelectionRect {
  x: number
  y: number
  width: number
  height: number
}

export interface WBSelectionState {
  selectedIds: string[]
  selectionRect: WBSelectionRect | null
  isMultiSelect: boolean
}

// ─── Group (v5: A2 — Group/Ungroup) ─────────────────────────────────────────

export interface WBGroup {
  id: string
  itemIds: string[]  // stroke/asset IDs
  createdBy: string
}

// ─── Shape (future-proof alias — shapes are strokes with tool=rectangle|circle|line) ─

export type WBShape = WBStroke & {
  tool: 'rectangle' | 'circle' | 'line'
  width: number
  height: number
}

// ─── Text Element ───────────────────────────────────────────────────────────

export type WBTextElement = WBStroke & {
  tool: 'text'
  text: string
}

// ─── Asset ──────────────────────────────────────────────────────────────────

export interface WBAsset {
  id: string
  type: 'image' | 'sticky'
  src: string
  x: number
  y: number
  w: number
  h: number
  rotation: number
  /** v5 A3: Lock state — locked items cannot be moved/deleted/erased */
  locked?: boolean
  lockedBy?: string
  /** v5 A9: Sticky note fields (present when type='sticky') */
  text?: string
  bgColor?: string
  textColor?: string
  fontSize?: number
}

// v5 A9: Sticky note — typed alias for assets with type='sticky'
export interface WBStickyNote extends WBAsset {
  type: 'sticky'
  text: string
  bgColor: string      // '#fde047' default
  textColor: string    // '#1e293b' default
  fontSize: number     // 14 default
}

export const STICKY_COLORS = [
  { name: 'yellow', bg: '#fde047', text: '#1e293b' },
  { name: 'green',  bg: '#86efac', text: '#1e293b' },
  { name: 'blue',   bg: '#93c5fd', text: '#1e293b' },
  { name: 'pink',   bg: '#f9a8d4', text: '#1e293b' },
  { name: 'purple', bg: '#c4b5fd', text: '#1e293b' },
  { name: 'orange', bg: '#fdba74', text: '#1e293b' },
] as const

export const STICKY_DEFAULTS = {
  width: 200, height: 150, fontSize: 14,
  bgColor: '#fde047', textColor: '#1e293b', text: '',
} as const

// ─── Page ───────────────────────────────────────────────────────────────────
// LAW-03: Pages = Ordered Stack

// A5.1: PDF background for imported PDF pages
export interface WBPdfBackground {
  type: 'pdf'
  url: string
  assetId: string
}

export type WBPageBackground = 'white' | 'grid' | 'dots' | 'lined' | WBPdfBackground

export interface WBPage {
  id: string
  name: string
  strokes: WBStroke[]
  assets: WBAsset[]
  background?: WBPageBackground
  /** A5.1: Custom page dimensions (e.g. from PDF import) */
  width?: number
  height?: number
  /** v5 A2: Groups — flat grouping of strokes/assets */
  groups?: WBGroup[]
}

// ─── Workspace State (serialized to backend JSONB) ──────────────────────────
// LAW-01: workspace_id = SSOT root

export interface WBWorkspaceState {
  pages: WBPage[]
  currentPageIndex: number
}

// ─── Undo/Redo ──────────────────────────────────────────────────────────────
// LAW-19: Command Pattern

export type WBHistoryActionType =
  | 'add-stroke'
  | 'remove-stroke'
  | 'update-stroke'
  | 'add-asset'
  | 'remove-asset'
  | 'update-asset'
  | 'clear-page'
  | 'batch'

export interface WBHistoryEntry {
  type: WBHistoryActionType
  pageId: string
  timestamp: number
  /** Payload varies by type — kept generic for extensibility */
  data: Record<string, unknown>
}

// ─── Sync Status ────────────────────────────────────────────────────────────

export type WBSyncStatus = 'idle' | 'syncing' | 'saved' | 'error' | 'offline'

// ─── Presence / Cursor ──────────────────────────────────────────────────────
// LAW-16: Multi-User Presence

export interface WBRemoteCursor {
  userId: string
  displayName: string
  color: string
  x: number
  y: number
  pageId: string
  tool: WBToolType
  /** Last update timestamp for fade-out logic */
  lastUpdate: number
  /** A5.2: Viewport data for follow mode */
  scrollX?: number
  scrollY?: number
  zoom?: number
  /** Role hint: 'teacher' | 'student' | undefined */
  role?: string
}

// ─── Session (mirrors backend WBSession) ────────────────────────────────────

export interface WBSession {
  id: string
  name: string
  owner_id: string
  state: WBWorkspaceState | null
  page_count: number
  thumbnail_url: string | null
  rev: number
  created_at: string
  updated_at: string
}

// ─── Export ─────────────────────────────────────────────────────────────────

export type WBExportFormat = 'png' | 'pdf' | 'json' | 'annotated_pdf'
export type WBExportStatus = 'pending' | 'processing' | 'done' | 'error'

export interface WBExport {
  id: string
  session_id: string
  format: WBExportFormat
  status: WBExportStatus
  file_url: string | null
  error: string | null
}

// ─── Share Token ────────────────────────────────────────────────────────────

export interface WBShareToken {
  id: string
  session_id: string
  token: string
  is_active: boolean
  expires_at: string | null
  max_views: number | null
  view_count: number
  allow_download: boolean
}

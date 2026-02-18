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
  type: 'image'
  src: string
  x: number
  y: number
  w: number
  h: number
  rotation: number
}

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

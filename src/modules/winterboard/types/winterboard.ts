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

// ─── Interaction Layer ──────────────────────────────────────────────────────
// Extensible interaction model for board objects (text, hint, answer, etc.)
// Audio stays as legacy flat fields; new interaction types go through this array.

export type WBInteractionType = 'text'
// Future: 'hint' | 'answer' | 'explanation'

export interface WBInteraction {
  /** Unique ID (UUID v4) */
  id: string
  /** Interaction type */
  type: WBInteractionType
  /** Payload — plain text, max 2000 chars */
  content: string
  /** Optional label ("Відповідь", "Підказка") */
  label?: string
  /** ISO timestamp for ordering */
  createdAt?: string
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
  // Phase 35: Font system (optional — backward compatible)
  // REC-2: WBStroke(text) uses `size` as fontSize — NO separate fontSize field
  fontFamily?: string     // default render: 'Inter, sans-serif'
  fontWeight?: number     // 400 (normal) | 700 (bold), default: 400
  fontStyle?: string      // 'normal' | 'italic', default: 'normal'
  textAlign?: string      // 'left' | 'center' | 'right', default: 'left'
  // Object Audio: voice annotation attached to this stroke
  audioUrl?: string       // CDN URL of recorded audio
  audioDuration?: number  // duration in seconds
  // Interaction Layer: extensible interactions (text, hint, answer, etc.)
  interactions?: WBInteraction[]
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
  type: 'image' | 'sticky' | 'audio_player' | 'video_player' | 'youtube_player'
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
  /** Phase 3C: Media object fields (present when type='audio_player'|'video_player') */
  title?: string
  duration?: number
  thumbnail?: string
  /** Phase 10 P3: YouTube embed URL (present when type='youtube_player') */
  youtubeUrl?: string
  // Phase 35: Image properties (optional — backward compatible)
  opacity?: number         // 0.0 - 1.0, default: 1
  borderRadius?: number    // 0 - 20 (px), default: 0. FIX-8: max 20px
  // Phase 35 REC-1: Font fields for sticky (sticky = WBAsset, not WBStroke)
  // REC-2: WBAsset(sticky) uses existing `fontSize` field — NO `size` field
  fontFamily?: string      // default: 'Inter, sans-serif'
  fontWeight?: number      // 400 | 700, default: 400
  fontStyle?: string       // 'normal' | 'italic', default: 'normal'
  textAlign?: string       // 'left' | 'center' | 'right', default: 'left'
  // Object Audio: voice annotation attached to this asset
  audioUrl?: string        // CDN URL of recorded audio
  audioDuration?: number   // duration in seconds
  // Interaction Layer: extensible interactions (text, hint, answer, etc.)
  interactions?: WBInteraction[]
}

// Phase 10 P5: Lesson navigation marker — lightweight anchor in the replay timeline.
// Matches backend WBLessonMarkerSerializer fields exactly.
export type LessonMarkerCategory = 'theory' | 'formula' | 'example' | 'practice' | 'solution' | 'custom'

export interface WBLessonMarker {
  id: string
  title: string
  operation_index: number
  page_id: string
  board_position: { x: number; y: number }
  thumbnail_url: string
  category: LessonMarkerCategory
  order: number
  created_at: string
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

// ─── Per-Page Grid Settings (A9: Grid Scope Fix) ───────────────────────────
// Ref: responsive/prompts/active/DAY12-13_PHASE6.md A9
// Bug fix: grid is now per-page (not global), with configurable color/opacity

/** Visual style for per-page grid pattern (Phase 10 expansion) */
export type GridStyle = 'dots' | 'lines' | 'small-grid' | 'large-grid' | 'ruled' | 'coordinate'

export interface WBPageGridSettings {
  enabled: boolean
  /** Tile size in pixels */
  size: number
  /** Visual style: dots, lines, small-grid, large-grid, ruled, coordinate */
  style: GridStyle
  /** CSS color string — default '#000000' */
  color: string
  /** 0.0–1.0 alpha — default 0.4 (clearly visible on white and video conference backgrounds) */
  opacity: number
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
  /** v5 A2: Groups — flat grouping of strokes/assets */
  groups?: WBGroup[]
  /** A9: Per-page grid settings — overrides global grid (usePageGrid) */
  grid?: WBPageGridSettings
  /** Phase 35 B6: Per-page background color (default '#ffffff') */
  backgroundColor?: string
  /** Phase 37: Test objects (HTML overlay) — per page */
  testObjects?: WBTestObject[]
  testMeta?: WBTestMeta
}

// ─── Phase 37: Test Objects (HTML overlay layer) ────────────────────────────

export type WBTestObjectType = 'input' | 'radio' | 'checkbox' | 'dropdown' | 'gap-fill' | 'matching'

export interface WBTestObject {
  id: string
  type: WBTestObjectType
  // Position (canvas coordinates)
  x: number
  y: number
  width: number
  height: number
  // Content
  label?: string
  correctAnswer?: string
  points: number
  // State
  locked?: boolean
  // Metadata
  createdBy: string
  createdAt: number
}

export interface WBTestInput extends WBTestObject {
  type: 'input'
  inputType: 'text' | 'number'
  placeholder?: string
  caseSensitive?: boolean
}

export interface WBTestRadio extends WBTestObject {
  type: 'radio'
  options: string[]
  correctIndex: number
  layout: 'vertical' | 'horizontal'
}

export interface WBTestCheckbox extends WBTestObject {
  type: 'checkbox'
  options: string[]
  correctIndices: number[]
  layout: 'vertical' | 'horizontal'
}

export interface WBTestDropdown extends WBTestObject {
  type: 'dropdown'
  options: string[]
  correctIndex: number
}

export interface WBTestGapFill extends WBTestObject {
  type: 'gap-fill'
  template: string
  gaps: Array<{
    position: number
    correctAnswer: string
    caseSensitive?: boolean
  }>
}

export interface WBTestMatching extends WBTestObject {
  type: 'matching'
  /** Left column items (prompts) */
  leftItems: string[]
  /** Right column items (answers), same length as leftItems */
  rightItems: string[]
  /** Correct mapping: correctPairs[i] = index in rightItems that matches leftItems[i] */
  correctPairs: number[]
}

export interface WBTestMeta {
  title?: string
  totalPoints: number
  passingScore?: number
  timeLimit?: number
  showCorrectAfter?: boolean
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

export type WBExportFormat = 'png' | 'pdf' | 'annotated_pdf'
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

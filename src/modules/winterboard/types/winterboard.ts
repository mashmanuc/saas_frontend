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
  // Phase 35: Font system (optional — backward compatible)
  // REC-2: WBStroke(text) uses `size` as fontSize — NO separate fontSize field
  fontFamily?: string     // default render: 'Inter, sans-serif'
  fontWeight?: number     // 400 (normal) | 700 (bold), default: 400
  fontStyle?: string      // 'normal' | 'italic', default: 'normal'
  textAlign?: string      // 'left' | 'center' | 'right', default: 'left'
  // Object Audio: voice annotation attached to this stroke
  audioUrl?: string       // CDN URL of recorded audio
  audioDuration?: number  // duration in seconds
  // Object Link: external URL attachment — click opens у новій вкладці.
  // Дотримуємось audio-style sync pattern (через stroke_update, без окремого op).
  // Validation: http: / https: only (utils/urlSafety.ts).
  linkUrl?: string        // http(s):// URL
  linkTitle?: string      // user-friendly label (optional)
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

// ─── Document Viewer (PLAN_v4) ──────────────────────────────────────────────

/** Content reference for document_viewer assets — links to backend ContentItem */
export interface WBContentRef {
  content_id: number
  content_type: 'pdf' | 'document' | 'presentation' | string
}

/** Single page/slide in a document viewer — lightweight (thumbnail URL only) */
export interface WBViewerPage {
  index: number    // 0-based
  url: string      // thumbnail_url (compressed, NOT full resolution)
}

/** Alias for backward compat — used by GenericDocumentViewer & normalizeViewerItems */
export type ViewerSlide = WBViewerPage

// ─── Asset ──────────────────────────────────────────────────────────────────

// Phase O (SSOT §3.7.1): 10 fixed geometry solid types — locked, no custom shapes
export type SolidType =
  | 'cube'
  | 'cuboid'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'tetrahedron'
  | 'pyramid3'
  | 'pyramid4'
  | 'prism3'
  | 'prism6'

/**
 * Phase O state schema for geometry_solid asset.
 * Persisted у WBBoardOperation.payload.asset.data — version: 1.
 * Ref: WINTERBOARD_SSOT.md §3.7.1.
 *
 * NB: 'building' EXCLUDED — animation progress, ephemeral runtime-only.
 * NB: showNet та showCut взаємовиключні (mutex per SSOT).
 */
export interface SolidAssetState {
  /** mesh visibility (default true) */
  showFaces: boolean
  /** wireframe edges (default true) */
  showEdges: boolean
  /** dots + labels (default false) */
  showVertices: boolean
  /** opacity 0.32 vs 1.0 (default false) */
  transparent: boolean
  /** unfolded net — mutex з showCut (default false) */
  showNet: boolean
  /** cross-section plane — mutex з showNet (default false) */
  showCut: boolean
  /** 0.0–1.0 (default 0.5) */
  cutHeight: number
  /** auto-rotation (default true) */
  autoRotate: boolean
}

/**
 * Versioned data envelope для geometry_solid WBAsset.data.
 * version=1 mandatory для replay schema migrations (PR-O5 reader).
 */
export interface SolidAssetData {
  version: 1
  state: SolidAssetState
}

export interface WBAsset {
  id: string
  type:
    | 'image'
    | 'sticky'
    | 'audio_player'
    | 'video_player'
    | 'youtube_player'
    | 'document_viewer'
    /** Phase G v2 (2026-05-13) — dynamic geometry, bundle-backed (vendor/geo2d/). */
    | 'geometry_2d_v2'
    | 'geometry_solid'
    /** Phase G (2026-05-05) — interactive graph_calculator per OPS_SYNC_SSOT INV-21 */
    | 'graph_calculator'
    /** Phase Calculus (2026-05-15) — derivative + antiderivative cards. */
    | 'calculus_card'
    /** TrigCircle (2026-05-16) — unit circle ↔ sin/cos/tg/ctg graph widget. */
    | 'trig_circle'
    /** Helix (2026-05-17) — 3D helix P=(θ, sin θ, cos θ) visualization widget. */
    | 'helix'
    /** TrigSolver (2026-05-19) — unified trig equation + inequality solver card (§3.7.7). */
    | 'trig_solver'
    /** NMT3D (2026-05-21) — parametric 3D stereometry widget (21 templates, adapt/draw modes). */
    | 'nmt3d'
    /** NmtTask (2026-05-23) — interactive NMT task card (single_choice/matching/open_answer). §3.7.9 */
    | 'nmt_task'
    /** QuadraticCard (2026-05-28) — ax²+bx+c parabola, discriminant, roots. §3.7.10 */
    | 'quadratic_card'
    /** FormulaCard (2026-05-30) — draggable KaTeX formula card. §3.7.11 */
    | 'formula_card'
    /** TheoryCard (2026-06-03) — рухома картка теорії+формул (Lesson Constructor). §3.7.12
     *  Замінює page-level theoryBlock/formulaBlock на повноцінний draggable WBAsset. */
    | 'theory_card'
    /** MashScene (2026-07-07, A3) — MASH Live Asset envelope з публічної воронки /mash/*
     *  (Proposal §8): сцена GraphMASH 2D/3D/GeoMASH їде на дошку ЗАВЖДИ (data.scene),
     *  рендер v1 = картка з deep-link «Відкрити у MASH» (нативізація — по-двигунно). §3.7.13 */
    | 'mash_scene'
    /** GeomashScene (2026-07-07, B3) — ЖИВА GeoMASH-геометрія (vendor/geomash).
     *  data = { version, scene:{objects,cs} }. Рендер нативний движком + інспектор. §3.7.14 */
    | 'geomash_scene'
    /** Graphmash3d (2026-07-07, B4) — ЖИВА GraphMASH 3D-поверхня (vendor/graphmash3d, WebGL).
     *  data = MashSceneData (app:'g3d', scene). Рендер нативний three.js-движком + інспектор. §3.7.15 */
    | 'graphmash_3d'
  /**
   * Asset source descriptor.
   * - URL для image/audio/video/document_viewer
   * - SolidType для geometry_solid (one of 10 fixed shapes per SSOT §3.7.1)
   */
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
  // Object Link: external URL — opens у новій вкладці. Validated http(s).
  linkUrl?: string         // http(s):// URL
  linkTitle?: string       // user-friendly label
  /**
   * P0 UX (2026-04-28): optimistic image paste status flag — FE-only.
   *
   * 'uploading' — asset створений з blob: URL, S3 upload триває у фоні.
   * 'ready'     — upload завершено, src оновлено на final S3/CDN URL.
   * 'error'     — upload fail, показуємо retry UI.
   *
   * Інваріанти:
   *   - НЕ персистимо у BE: recorder.ts strip-ає поле з payload (як і dataURL/blob URLs).
   *   - НЕ блокує replay: якщо replay чомусь отримає asset зі status='uploading'
   *     (race), рендер відбувається з тим src що є — graceful degradation.
   *   - Visual indicator only — рендер компонент може показати spinner/badge.
   */
  status?: 'uploading' | 'ready' | 'error'
  /** Localized error message коли status='error' (FE-only, не персистимо). */
  errorMessage?: string
  // PLAN_v4: Document Viewer fields (present when type='document_viewer')
  // viewer = canvas asset with page navigation (like sticky note but for documents)
  content_ref?: WBContentRef
  /** Current page/slide index (0-based) */
  currentPage?: number
  /** Total number of pages/slides */
  totalPages?: number
  /** Page URLs for navigation — NOT persisted in WS/state, hydrated from API */
  pages?: WBViewerPage[]
  /** Display mode: compact (default) or expanded */
  viewerMode?: 'compact' | 'expanded'
  /**
   * Phase O (SSOT §3.7.1): geometry_solid persisted state envelope.
   * MUST be present when `type === 'geometry_solid'`.
   * Phase G (INV-21): graph_calculator data envelope.
   * Версіонується для replay schema migrations.
   *
   * Type-safe access pattern:
   *   if (asset.type === 'geometry_solid' && asset.data) {
   *     const state = asset.data.state as SolidAssetState
   *   }
   *   if (asset.type === 'graph_calculator' && asset.data) {
   *     const state = asset.data.state as GraphCalculatorState
   *   }
   */
  data?:
    | SolidAssetData
    | import('./graphCalculator').GraphCalculatorData
    | import('./geometry2dV2').Geometry2DV2Data
    | import('./calculus').CalculusData
    | import('./trigCircle').TrigCircleData
    | import('./helix').HelixData
    | import('./trigSolver').TrigSolverData
    | import('./nmt3d').Nmt3dData
    | import('./quad').QuadraticData
    | import('./formulaCard').FormulaCardData
    | TheoryCardData
    | MashSceneData
    | GeomashSceneData
}

/**
 * Phase O typed alias — assets з type='geometry_solid' гарантовано мають
 * src: SolidType + data: SolidAssetData per SSOT §3.7.1.
 */
export interface SolidAsset extends WBAsset {
  type: 'geometry_solid'
  src: SolidType
  data: SolidAssetData
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
  /** Lesson Constructor: semantic page role */
  pageRole?: 'theory' | 'practice' | 'solution'
  /** Lesson Constructor: structured theory content (HTML overlay, replaces sticky note) */
  theoryBlock?: WBTheoryBlock
  /** Lesson Constructor: structured formula content (HTML overlay) */
  formulaBlock?: WBFormulaBlock
}

// ─── Lesson Constructor: Theory overlay types ────────────────────────────────

export interface WBTheoryBlock {
  title: string
  body: string
  hint?: string
}

export interface WBFormulaEntry {
  latex: string
  label: string
}

export interface WBFormulaBlock {
  title: string
  formulas: WBFormulaEntry[]
}

// ─── TheoryCard (2026-06-03) — рухома картка теорії як WBAsset ───────────────
// Об'єднує theory (title/body/hint) + опційну сітку формул в ОДНІЙ draggable картці.
// data зберігається у asset.data (flat-data asset). Рендериться TheoryCardRenderer.
export interface TheoryCardData {
  version: 1
  title: string
  body: string
  /** Підпис у шапці картки. Порожньо → 'Теорія' (поведінка старих карток). */
  badge?: string
  hint?: string
  /** Заголовок секції формул (якщо є формули). */
  formulaTitle?: string
  /** Сітка формул (latex+label). Порожній масив → секція формул не рендериться. */
  formulas?: WBFormulaEntry[]
}

export type TheoryCardAsset = WBAsset & { type: 'theory_card'; data: TheoryCardData }

/**
 * MashScene (§3.7.13, A3 2026-07-07) — MASH Live Asset envelope (Proposal §8).
 * data.scene = ПОВНА серіалізована сцена додатка as-is ({format,version,…} самого MASH) —
 * зберігається завжди, щоб об'єкт «ожив» при нативізації двигуна без міграцій.
 * preview data-URL НЕ зберігаємо: ops-recorder стрипає data:-URLs + state-bloat freeze.
 */
export interface MashSceneData {
  version: 1
  /** Який MASH-додаток: g2d (GraphMASH 2D) | g3d (3D) | geo (GeoMASH). stereo → нативний nmt3d. */
  app: 'g2d' | 'g3d' | 'geo'
  /** data.scene.format сцени (graphmash-2d | …-3d-scene | geomash-scene) — для майбутніх мігрувань. */
  sceneFormat: string
  /** Повна сцена MASH-додатка as-is. */
  scene: Record<string, unknown>
  /** Заголовок картки (назва графіка/сцени, якщо додаток його дав). */
  title?: string
  /** Стиснутий JPEG-thumbnail сцени (data-URL, кап ~90KB) — показ обʼєкта на картці. */
  previewUrl?: string
}
export type MashSceneAsset = WBAsset & { type: 'mash_scene'; data: MashSceneData }

/** GeomashScene (§3.7.14, B3) — жива GeoMASH-сцена. data.scene = {objects[], cs}. */
export interface GeomashSceneData {
  version: 1
  scene: {
    format?: string
    version?: number
    objects: Array<Record<string, unknown>>
    cs?: { ox: number; oy: number; sc: number }
  }
  title?: string
}
export type GeomashSceneAsset = WBAsset & { type: 'geomash_scene'; data: GeomashSceneData }
export type Graphmash3dAsset = WBAsset & { type: 'graphmash_3d'; data: MashSceneData }

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
  // Lesson Constructor semantic fields
  solution?: string    // LaTeX розбір — показується в constructor edit mode
  externalId?: string  // NMTProblem.id — для "замінити/додати з бази"
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

export interface WBExportV2Response {
  id: string
  status: 'completed' | 'failed'
  file_url: string | null
  file_size: number
  page_count: number
  engine: 'v2'
  diagnostics: {
    rendered_counts: Record<string, number>
    skipped_types: string[]
  }
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

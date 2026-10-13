// A11: Library TypeScript types
// Ref: DAY16_AGENT-A.md — точно відповідають BE serializers
// Zone: AGENT-A (types/)

// ─── Library Tag ───────────────────────────────────────────────────────────

export interface LibraryTag {
  id: number           // int PK
  name: string
  color: string
  created_at: string   // ISO datetime
}

// ─── Library Folder (flat mode) ────────────────────────────────────────────

/** Системні теки «Дзеркала» (TZ_MIRROR_SNAPSHOTS_GROUPING): «🪞 Дзеркало» і група одного запуску. */
export type LibrarySystemKind = '' | 'mirror_root' | 'mirror_run'

export interface LibraryFolder {
  id: number           // int PK
  name: string
  parent: number | null  // FK int, НЕ parent_id
  system_kind?: LibrarySystemKind
  children_count: number
  assets_count: number   // НЕ asset_count
  created_at: string
  updated_at: string
}

// ─── Library Folder (tree mode, ?tree=true) ────────────────────────────────

export interface LibraryFolderTree {
  id: number
  name: string
  parent: number | null
  system_kind?: LibrarySystemKind
  children: LibraryFolderTree[]  // recursive
  assets_count: number
}

// ─── Library Asset ─────────────────────────────────────────────────────────

export interface LibraryAsset {
  id: number           // int PK
  name: string
  storage_key: string  // read-only
  cdn_url: string
  thumbnail_url: string
  content_type: string // 'image/png', 'application/pdf', etc.
  size_bytes: number
  /** 'archived' — архів відео (сховано зі списку, без строку; ≠ кошик). */
  status: 'pending' | 'active' | 'deleted' | 'archived'
  folder: number | null  // FK int, НЕ folder_id
  is_favorite: boolean
  last_used_at: string | null
  tags: string[]         // масив імен тегів
  created_at: string
  updated_at: string
  /** Phase 9 SSOT FK — ContentItem PK. null для старих активів без ContentItem. */
  content_item_id?: number | null
  /** ContentItem processing status (pending|processing|ready|failed). */
  processing_status?: string
  /** Presentation slide count (from ContentItem). */
  slide_count?: number | null
  /** PDF/DOCX page count (from ContentItem). */
  page_count?: number | null
  /** Походження: `board_mirror` — знімок «Дзеркала дошки». */
  origin?: '' | 'board_mirror'
}

/** «Прибрати зайві»: хто тримає знімок (лише свої дошки й записи). */
export interface MirrorUsageHolder {
  kind: 'board' | 'replay' | 'template'
  id: string
  title: string
}

export interface MirrorCleanupResult {
  total: number
  total_bytes: number
  /** id знімків, на які ніщо не посилається */
  free: number[]
  free_bytes: number
  used: { id: number; where: string; holders: MirrorUsageHolder[] }[]
  /** Облік не вдалося зібрати — нічого не прибрано */
  usage_unknown: boolean
  dry_run: boolean
  archived: number
}

// ─── Paginated list response (GET /library/assets/) ───────────────────────

export interface LibraryAssetListResponse {
  count: number
  /** Total paste-sourced assets (незалежно від поточного source filter) — для UI chip. */
  paste_count?: number
  results: LibraryAsset[]
  /** Скільки файлів кожного типу в цьому переліку без пошуку й без фільтра типу (кнопки типів у панелі) */
  category_counts?: Record<string, number>
}

// ─── Create asset request ──────────────────────────────────────────────────

export interface LibraryAssetCreateRequest {
  name: string
  folder?: number | null
  content_type: string
  size_bytes: number
}

// ─── Update asset request (PATCH) ─────────────────────────────────────────

export interface LibraryAssetUpdateRequest {
  name?: string
  folder?: number | null
  is_favorite?: boolean
  tags?: string[]    // передаєш масив імен — backend створить/підв'яже
}

// ─── Confirm upload request ────────────────────────────────────────────────

export interface LibraryAssetConfirmRequest {
  cdn_url: string
  thumbnail_url?: string
  size_bytes?: number
}

// ─── Assets query params ───────────────────────────────────────────────────

export interface LibraryAssetsQuery {
  folder?: number
  favorite?: true
  content_type?: string  // prefix match: 'image', 'application/pdf'
  tag?: string
  /**
   * Source filter (2026-04-16):
   * - undefined / 'upload' → default (exclude paste — уникаємо clipboard spam)
   * - 'paste' → лише Ctrl+V картинки
   * - 'all' → upload + paste (legacy behavior)
   */
  source?: 'upload' | 'paste' | 'all'
  /** 'only' — лише архів відео (без нього архівовані відео в переліки не потрапляють). */
  archived?: 'only'
  limit?: number         // default 50, max 100
  offset?: number
  /** Тип файлів за класифікацією бічної панелі: image | pdf | document | audio | video | youtube | presentation */
  category?: string
  /** Пошук за назвою */
  search?: string
}

// ─── Вкладка «Відео» (GET /library/videos/, ТЗ TZ_BOARD_VIDEO_PICKER_AND_LIBRARY §7) ───

/** Джерело відео: усе, лише YouTube-посилання чи лише власні відеофайли. */
export type LibraryVideoKind = 'all' | 'youtube' | 'file'

/** Порядок: спершу нові · спершу старі · за назвою. */
export type LibraryVideoOrdering = '-created_at' | 'created_at' | 'name'

export interface LibraryVideosQuery {
  kind: LibraryVideoKind
  ordering: LibraryVideoOrdering
  /** 'only' — архів відео (лише YouTube: у файлів архіву немає). */
  archived?: 'only'
  limit?: number         // default 100, max 100
  offset?: number
}

/** Рядок вкладки: матеріал + наша семантика джерела й прев'ю. */
export interface LibraryVideo extends LibraryAsset {
  video_kind: 'youtube' | 'file'
  /** Прев'ю: власне або кадр відеофайла; '' — показуємо значок відео. */
  poster_url: string
}

export interface LibraryVideoListResponse {
  count: number
  results: LibraryVideo[]
}

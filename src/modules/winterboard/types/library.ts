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

export interface LibraryFolder {
  id: number           // int PK
  name: string
  parent: number | null  // FK int, НЕ parent_id
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
  status: 'pending' | 'active' | 'deleted'
  folder: number | null  // FK int, НЕ folder_id
  is_favorite: boolean
  last_used_at: string | null
  tags: string[]         // масив імен тегів
  created_at: string
  updated_at: string
}

// ─── Paginated list response (GET /library/assets/) ───────────────────────

export interface LibraryAssetListResponse {
  count: number
  results: LibraryAsset[]
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
  limit?: number         // default 50, max 100
  offset?: number
}

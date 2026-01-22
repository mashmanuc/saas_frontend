/**
 * Subject Tag Map Types (v0.85)
 * 
 * Types for subject_tag_map.json structure and catalog versioning.
 * 
 * References:
 * - Frontend v0.85 plan: docs/plan/v0.85.0/Frontend v0.85.md
 * - Backend v0.85 plan: docs/plan/v0.85.0/Backend v0.85.md
 */

/**
 * Subject tag group identifier
 */
export type SubjectTagGroup = 
  | 'classes' 
  | 'exams' 
  | 'goals' 
  | 'format' 
  | 'audience' 
  | string

/**
 * Configuration for a specific subject's tags
 */
export interface SubjectTagConfig {
  /**
   * Which tag groups are enabled for this subject
   * If not specified, uses defaults
   */
  enabled_groups?: SubjectTagGroup[]
  
  /**
   * Order in which groups should be displayed
   * If not specified, uses defaults
   */
  groups_order?: SubjectTagGroup[]
  
  /**
   * Whether to show all tags from enabled groups
   * If false, only show tags listed in allowed_tags
   */
  allow_all_tags_in_enabled_groups?: boolean
  
  /**
   * Specific tags allowed per group (when allow_all is false)
   * Map of group name to array of tag codes
   */
  allowed_tags?: Record<SubjectTagGroup, string[]>
}

/**
 * Default configuration for all subjects
 */
export interface SubjectTagDefaults {
  /**
   * Default enabled groups for subjects without overrides
   */
  enabled_groups: SubjectTagGroup[]
  
  /**
   * Default order for displaying groups
   */
  groups_order?: SubjectTagGroup[]
  
  /**
   * Default allow_all setting
   */
  allow_all_tags_in_enabled_groups: boolean
}

/**
 * Complete subject tag map structure
 */
export interface SubjectTagMap {
  /**
   * Map format version
   */
  version: number
  
  /**
   * Default configuration for all subjects
   */
  defaults: SubjectTagDefaults
  
  /**
   * Per-subject overrides
   * Key is subject code (e.g., 'mathematics', 'physics')
   */
  subjects?: Record<string, SubjectTagConfig>
}

/**
 * Filter options response from API (v0.85+)
 */
export interface FilterOptionsResponse {
  /**
   * Catalog version hash (sha256)
   * Used for cache invalidation
   */
  catalog_version: string
  
  /**
   * Subject tag map
   */
  subject_tag_map: SubjectTagMap
  
  /**
   * ETag for HTTP caching
   */
  etag?: string
  
  /**
   * Cache TTL in seconds
   */
  expires_in?: number
  
  /**
   * Other filter options (existing fields)
   */
  categories?: any[]
  subjects?: any[]
  countries?: any[]
  languages?: any[]
  price_range?: any
  experience_range?: any
}

/**
 * Resolved tag configuration for a specific subject
 * 
 * Result of applying defaults + overrides
 */
export interface ResolvedSubjectTagConfig {
  /**
   * Subject code
   */
  subjectCode: string
  
  /**
   * Enabled tag groups for this subject
   */
  enabledGroups: SubjectTagGroup[]
  
  /**
   * Order to display groups
   */
  groupsOrder: SubjectTagGroup[]
  
  /**
   * Whether all tags in enabled groups are allowed
   */
  allowAllTags: boolean
  
  /**
   * Specific allowed tags per group (when allowAllTags is false)
   */
  allowedTags: Record<SubjectTagGroup, string[]>
}

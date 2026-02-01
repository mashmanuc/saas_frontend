/**
 * Subject Tag Resolver (v0.85)
 * 
 * Resolves which tags are available for a specific subject
 * by applying defaults and subject-specific overrides.
 * 
 * References:
 * - Frontend v0.85 plan: docs/plan/v0.85.0/Frontend v0.85.md
 */

import type { 
  SubjectTagMap, 
  SubjectTagGroup, 
  ResolvedSubjectTagConfig 
} from '../types/subjectTagMap'

/**
 * Resolve tag configuration for a specific subject
 * 
 * @param subjectCode - Subject code (e.g., 'mathematics', 'physics')
 * @param tagMap - Complete subject tag map
 * @returns Resolved configuration with enabled groups and allowed tags
 */
export function resolveSubjectTags(
  subjectCode: string,
  tagMap: SubjectTagMap
): ResolvedSubjectTagConfig {
  const defaults = tagMap.defaults
  const override = tagMap.subjects?.[subjectCode]
  
  // Resolve enabled groups (override or defaults)
  const enabledGroups = override?.enabled_groups ?? defaults.enabled_groups
  
  // Resolve groups order (override > defaults > enabled groups)
  const groupsOrder = 
    override?.groups_order ?? 
    defaults.groups_order ?? 
    enabledGroups
  
  // Resolve allow_all flag (override or defaults)
  const allowAllTags = 
    override?.allow_all_tags_in_enabled_groups ?? 
    defaults.allow_all_tags_in_enabled_groups
  
  // Resolve allowed tags (only relevant when allowAllTags is false)
  const allowedTags: Record<SubjectTagGroup, string[]> = {}
  
  if (!allowAllTags && override?.allowed_tags) {
    // Use override's allowed_tags
    Object.assign(allowedTags, override.allowed_tags)
  }
  
  return {
    subjectCode,
    enabledGroups,
    groupsOrder,
    allowAllTags,
    allowedTags,
  }
}

/**
 * Check if a specific tag is allowed for a subject
 * 
 * @param tagCode - Tag code to check
 * @param tagGroup - Group the tag belongs to
 * @param config - Resolved subject tag configuration
 * @returns True if tag is allowed for this subject
 */
export function isTagAllowedForSubject(
  tagCode: string,
  tagGroup: SubjectTagGroup,
  config: ResolvedSubjectTagConfig
): boolean {
  // Check if group is enabled
  if (!config.enabledGroups.includes(tagGroup)) {
    return false
  }
  
  // If allow_all is true, all tags in enabled groups are allowed
  if (config.allowAllTags) {
    return true
  }
  
  // Otherwise, check if tag is in allowed list
  const allowedInGroup = config.allowedTags[tagGroup] ?? []
  return allowedInGroup.includes(tagCode)
}

/**
 * Normalize tag group names for compatibility between API and subject_tag_map.json
 * API uses: grades, formats
 * subject_tag_map.json uses: classes, format
 */
function normalizeTagGroup(group: string): string {
  const normalizationMap: Record<string, string> = {
    'grades': 'classes',
    'formats': 'format',
  }
  return normalizationMap[group] ?? group
}

/**
 * Filter tags by subject configuration
 * 
 * @param tags - Array of tags with code and group
 * @param config - Resolved subject tag configuration
 * @returns Filtered tags that are allowed for this subject
 */
export function filterTagsForSubject<T extends { code: string; group: string }>(
  tags: T[],
  config: ResolvedSubjectTagConfig
): T[] {
  return tags.filter(tag => {
    const normalizedGroup = normalizeTagGroup(tag.group)
    return isTagAllowedForSubject(tag.code, normalizedGroup, config)
  })
}

/**
 * FAIL-CLOSED: Filter tags for a subject with safety checks
 * 
 * Returns empty array if:
 * - tagMap is null/undefined (not loaded yet)
 * - subject is not in the map (no configuration)
 * 
 * This prevents showing incorrect tags (e.g., language tags for STEM subjects)
 * when the tag map hasn't loaded or subject isn't configured.
 * 
 * @param subjectCode - Subject code (e.g., 'mathematics', 'physics')
 * @param allTags - Complete catalog of available tags
 * @param tagMap - Subject tag map (may be null if not loaded)
 * @returns Filtered tags or empty array (fail-closed)
 */
export function filterTagsForSubjectSafe<T extends { code: string; group: string }>(
  subjectCode: string,
  allTags: T[],
  tagMap: SubjectTagMap | null
): T[] {
  // FAIL-CLOSED: No map loaded → return empty array
  if (!tagMap) {
    console.warn(`[subjectTagResolver] No tagMap loaded for ${subjectCode}`)
    return []
  }
  
  // v0.86 FIX: If subject not in map, use defaults with allowAllTags=true
  // This allows all subjects to show tags even without explicit configuration
  if (!tagMap.subjects || !tagMap.subjects[subjectCode]) {
    try {
      // Use defaults: show all tags from enabled groups
      const config: ResolvedSubjectTagConfig = {
        subjectCode,
        enabledGroups: tagMap.defaults.enabled_groups,
        groupsOrder: tagMap.defaults.groups_order ?? tagMap.defaults.enabled_groups,
        allowAllTags: true, // Show all tags from enabled groups
        allowedTags: {},
      }
      return filterTagsForSubject(allTags, config)
    } catch (err) {
      console.error(`[subjectTagResolver] Error using defaults for ${subjectCode}:`, err)
      return []
    }
  }
  
  try {
    // Resolve configuration and filter tags
    const config = resolveSubjectTags(subjectCode, tagMap)
    return filterTagsForSubject(allTags, config)
  } catch (err) {
    // FAIL-CLOSED: Error during resolution → return empty array
    console.error(`[subjectTagResolver] Error filtering tags for ${subjectCode}:`, err)
    return []
  }
}

/**
 * Group tags by their group identifier
 * 
 * @param tags - Array of tags with group property
 * @returns Map of group name to tags in that group
 */
export function groupTagsByGroup<T extends { group: string }>(
  tags: T[]
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {}
  
  for (const tag of tags) {
    if (!grouped[tag.group]) {
      grouped[tag.group] = []
    }
    grouped[tag.group].push(tag)
  }
  
  return grouped
}

/**
 * Get ordered groups for display
 * 
 * @param config - Resolved subject tag configuration
 * @param availableGroups - Groups that actually have tags
 * @returns Ordered list of groups to display
 */
export function getOrderedGroups(
  config: ResolvedSubjectTagConfig,
  availableGroups: SubjectTagGroup[]
): SubjectTagGroup[] {
  // Filter groups_order to only include enabled and available groups
  const enabledAndAvailable = config.groupsOrder.filter(
    group => config.enabledGroups.includes(group) && availableGroups.includes(group)
  )
  
  // Add any enabled groups not in groups_order (shouldn't happen, but defensive)
  const missing = config.enabledGroups.filter(
    group => !enabledAndAvailable.includes(group) && availableGroups.includes(group)
  )
  
  return [...enabledAndAvailable, ...missing]
}

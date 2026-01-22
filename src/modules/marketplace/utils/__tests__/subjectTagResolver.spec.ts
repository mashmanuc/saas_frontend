/**
 * Unit tests for subjectTagResolver (v0.85)
 * 
 * Tests resolver logic for subject-specific tags.
 */
import { describe, it, expect } from 'vitest'
import {
  resolveSubjectTags,
  isTagAllowedForSubject,
  filterTagsForSubject,
  filterTagsForSubjectSafe,
  groupTagsByGroup,
  getOrderedGroups,
} from '../subjectTagResolver'
import type { SubjectTagMap } from '../../types/subjectTagMap'

describe('subjectTagResolver', () => {
  const mockTagMap: SubjectTagMap = {
    version: 1,
    defaults: {
      enabled_groups: ['classes', 'exams', 'goals'],
      groups_order: ['classes', 'exams', 'goals'],
      allow_all_tags_in_enabled_groups: true,
    },
    subjects: {
      mathematics: {
        enabled_groups: ['classes', 'exams'],
        groups_order: ['classes', 'exams'],
        allow_all_tags_in_enabled_groups: false,
        allowed_tags: {
          classes: ['class_1_4', 'class_5_9'],
          exams: ['exam_nmt'],
        },
      },
      english: {
        enabled_groups: ['goals', 'audience'],
        allow_all_tags_in_enabled_groups: true,
      },
    },
  }

  describe('resolveSubjectTags', () => {
    it('should use defaults for subject without override', () => {
      const config = resolveSubjectTags('physics', mockTagMap)

      expect(config.subjectCode).toBe('physics')
      expect(config.enabledGroups).toEqual(['classes', 'exams', 'goals'])
      expect(config.allowAllTags).toBe(true)
    })

    it('should apply subject-specific overrides', () => {
      const config = resolveSubjectTags('mathematics', mockTagMap)

      expect(config.subjectCode).toBe('mathematics')
      expect(config.enabledGroups).toEqual(['classes', 'exams'])
      expect(config.groupsOrder).toEqual(['classes', 'exams'])
      expect(config.allowAllTags).toBe(false)
      expect(config.allowedTags.classes).toEqual(['class_1_4', 'class_5_9'])
      expect(config.allowedTags.exams).toEqual(['exam_nmt'])
    })

    it('should merge enabled_groups from override with defaults', () => {
      const config = resolveSubjectTags('english', mockTagMap)

      expect(config.enabledGroups).toEqual(['goals', 'audience'])
      expect(config.allowAllTags).toBe(true)
    })

    it('should use defaults.groups_order when override does not specify', () => {
      const config = resolveSubjectTags('english', mockTagMap)

      // Should use defaults.groups_order since override doesn't specify groups_order
      // and defaults has groups_order defined
      expect(config.groupsOrder).toEqual(['classes', 'exams', 'goals'])
    })
  })

  describe('isTagAllowedForSubject', () => {
    it('should return false if group is not enabled', () => {
      const config = resolveSubjectTags('mathematics', mockTagMap)

      const allowed = isTagAllowedForSubject('goal_level_up', 'goals', config)

      expect(allowed).toBe(false)
    })

    it('should return true if allowAllTags is true and group is enabled', () => {
      const config = resolveSubjectTags('physics', mockTagMap)

      const allowed = isTagAllowedForSubject('class_1_4', 'classes', config)

      expect(allowed).toBe(true)
    })

    it('should check allowed_tags when allowAllTags is false', () => {
      const config = resolveSubjectTags('mathematics', mockTagMap)

      expect(isTagAllowedForSubject('class_1_4', 'classes', config)).toBe(true)
      expect(isTagAllowedForSubject('class_10_11', 'classes', config)).toBe(false)
    })

    it('should return false for tag not in allowed_tags list', () => {
      const config = resolveSubjectTags('mathematics', mockTagMap)

      const allowed = isTagAllowedForSubject('exam_zno', 'exams', config)

      expect(allowed).toBe(false)
    })
  })

  describe('filterTagsForSubject', () => {
    const mockTags = [
      { code: 'class_1_4', group: 'classes', title: 'Grades 1-4' },
      { code: 'class_5_9', group: 'classes', title: 'Grades 5-9' },
      { code: 'class_10_11', group: 'classes', title: 'Grades 10-11' },
      { code: 'exam_nmt', group: 'exams', title: 'NMT' },
      { code: 'exam_zno', group: 'exams', title: 'ZNO' },
      { code: 'goal_level_up', group: 'goals', title: 'Level up' },
    ]

    it('should filter tags based on subject config', () => {
      const config = resolveSubjectTags('mathematics', mockTagMap)

      const filtered = filterTagsForSubject(mockTags, config)

      expect(filtered).toHaveLength(3)
      expect(filtered.map(t => t.code)).toEqual(['class_1_4', 'class_5_9', 'exam_nmt'])
    })

    it('should return all enabled group tags when allowAllTags is true', () => {
      const config = resolveSubjectTags('physics', mockTagMap)

      const filtered = filterTagsForSubject(mockTags, config)

      // Should include all classes, exams, and goals tags
      expect(filtered).toHaveLength(6)
    })

    it('should return empty array if no tags match', () => {
      const config = resolveSubjectTags('mathematics', mockTagMap)
      const onlyGoalsTags = [{ code: 'goal_level_up', group: 'goals', title: 'Level up' }]

      const filtered = filterTagsForSubject(onlyGoalsTags, config)

      expect(filtered).toHaveLength(0)
    })
  })

  describe('groupTagsByGroup', () => {
    it('should group tags by their group property', () => {
      const tags = [
        { code: 'class_1_4', group: 'classes' },
        { code: 'class_5_9', group: 'classes' },
        { code: 'exam_nmt', group: 'exams' },
      ]

      const grouped = groupTagsByGroup(tags)

      expect(grouped.classes).toHaveLength(2)
      expect(grouped.exams).toHaveLength(1)
      expect(grouped.classes[0].code).toBe('class_1_4')
    })

    it('should handle empty array', () => {
      const grouped = groupTagsByGroup([])

      expect(Object.keys(grouped)).toHaveLength(0)
    })
  })

  describe('getOrderedGroups', () => {
    it('should return groups in specified order', () => {
      const config = resolveSubjectTags('mathematics', mockTagMap)
      const availableGroups = ['exams', 'classes', 'goals']

      const ordered = getOrderedGroups(config, availableGroups)

      expect(ordered).toEqual(['classes', 'exams'])
    })

    it('should only include enabled and available groups', () => {
      const config = resolveSubjectTags('mathematics', mockTagMap)
      const availableGroups = ['classes', 'goals'] // exams not available

      const ordered = getOrderedGroups(config, availableGroups)

      expect(ordered).toEqual(['classes'])
    })

    it('should append missing enabled groups at the end', () => {
      const config = resolveSubjectTags('english', mockTagMap)
      config.groupsOrder = ['audience'] // Only one in order
      config.enabledGroups = ['audience', 'goals']
      const availableGroups = ['audience', 'goals']

      const ordered = getOrderedGroups(config, availableGroups)

      expect(ordered).toEqual(['audience', 'goals'])
    })
  })

  describe('filterTagsForSubjectSafe (FAIL-CLOSED)', () => {
    const mockTags = [
      { code: 'class_1_4', group: 'classes', title: 'Grades 1-4' },
      { code: 'class_5_9', group: 'classes', title: 'Grades 5-9' },
      { code: 'exam_nmt', group: 'exams', title: 'NMT' },
      { code: 'goal_business', group: 'goals', title: 'Business' },
      { code: 'goal_conversational', group: 'goals', title: 'Conversational' },
    ]

    it('FAIL-CLOSED: should return empty array when tagMap is null', () => {
      const filtered = filterTagsForSubjectSafe('mathematics', mockTags, null)

      expect(filtered).toEqual([])
    })

    it('FAIL-CLOSED: should return empty array when subject not in map', () => {
      const filtered = filterTagsForSubjectSafe('chemistry', mockTags, mockTagMap)

      expect(filtered).toEqual([])
    })

    it('FAIL-CLOSED: should return empty array when subjects field is missing', () => {
      const incompleteMap = {
        version: 1,
        defaults: mockTagMap.defaults,
      } as any

      const filtered = filterTagsForSubjectSafe('mathematics', mockTags, incompleteMap)

      expect(filtered).toEqual([])
    })

    it('should return filtered tags when subject is configured', () => {
      const filtered = filterTagsForSubjectSafe('mathematics', mockTags, mockTagMap)

      // Mathematics allows only class_1_4, class_5_9, exam_nmt
      expect(filtered).toHaveLength(3)
      expect(filtered.map(t => t.code)).toEqual(['class_1_4', 'class_5_9', 'exam_nmt'])
    })

    it('should prevent language tags from appearing in STEM subjects', () => {
      // Create a STEM subject map that explicitly excludes language goals
      const stemMap: SubjectTagMap = {
        version: 1,
        defaults: {
          enabled_groups: ['classes', 'exams', 'goals'],
          groups_order: ['classes', 'exams', 'goals'],
          allow_all_tags_in_enabled_groups: true,
        },
        subjects: {
          mathematics: {
            enabled_groups: ['classes', 'exams'],
            allow_all_tags_in_enabled_groups: false,
            allowed_tags: {
              classes: ['class_1_4', 'class_5_9'],
              exams: ['exam_nmt'],
            },
          },
        },
      }

      const filtered = filterTagsForSubjectSafe('mathematics', mockTags, stemMap)

      // Should NOT include goal_business or goal_conversational
      expect(filtered.some(t => t.code === 'goal_business')).toBe(false)
      expect(filtered.some(t => t.code === 'goal_conversational')).toBe(false)
      // Should only include allowed tags
      expect(filtered.map(t => t.code)).toEqual(['class_1_4', 'class_5_9', 'exam_nmt'])
    })

    it('FAIL-CLOSED: should handle errors gracefully and return empty array', () => {
      // Create a malformed map that might cause errors
      const malformedMap = {
        version: 1,
        defaults: null,
        subjects: {
          mathematics: null,
        },
      } as any

      const filtered = filterTagsForSubjectSafe('mathematics', mockTags, malformedMap)

      // Should not throw, should return empty array
      expect(filtered).toEqual([])
    })
  })
})


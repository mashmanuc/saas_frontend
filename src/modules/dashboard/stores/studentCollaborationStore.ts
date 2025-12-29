/**
 * Student Collaboration Store
 * 
 * Unified source of truth for student-tutor collaboration state.
 * Aggregates active, invited, and paused tutors with full context.
 * 
 * Architecture: Domain-First Law - this store owns the Collaboration domain,
 * separate from generic dashboard or relations concerns.
 * 
 * Platform Expansion Law: Built to scale for multiple tutors, extended stats,
 * and future collaboration features without breaking existing contracts.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import relationsApi from '@/api/relations'
import type { AssignedTutor } from '../api/dashboard'

export interface CollaborationTutor extends AssignedTutor {
  relation_id: number
  collaboration_status: 'active' | 'invited' | 'paused' | 'archived'
  lesson_count: number
  last_activity_at: string | null
  next_available_slot: string | null
  relationship_start: string
  created_at: string
}

export const useStudentCollaborationStore = defineStore('studentCollaboration', () => {
  // State
  const tutors = ref<CollaborationTutor[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed - Domain-specific getters
  const activeTutors = computed(() => 
    tutors.value.filter(t => t.collaboration_status === 'active')
  )

  const invitedTutors = computed(() => 
    tutors.value.filter(t => t.collaboration_status === 'invited')
  )

  const pausedTutors = computed(() => 
    tutors.value.filter(t => t.collaboration_status === 'paused')
  )

  const hasActiveTutors = computed(() => activeTutors.value.length > 0)
  const hasInvitations = computed(() => invitedTutors.value.length > 0)

  const totalLessonsCount = computed(() => 
    activeTutors.value.reduce((sum, t) => sum + (t.lesson_count || 0), 0)
  )

  // Actions
  async function fetchCollaborationState() {
    isLoading.value = true
    error.value = null

    try {
      // Fetch all student relations (active, invited, paused)
      const response = await relationsApi.getStudentRelations()
      const relations = Array.isArray(response) ? response : response?.results || []
      
      // Map to CollaborationTutor format
      tutors.value = relations.map((rel: any) => ({
        id: rel.tutor?.id || 0,
        relation_id: rel.relation_id || rel.id,
        full_name: rel.full_name || '',
        email: rel.email || '',
        avatar_url: rel.avatar_url || null,
        timezone: rel.timezone || null,
        headline: rel.headline || null,
        subjects: rel.subjects || [],
        average_rating: rel.average_rating || null,
        collaboration_status: rel.status || 'invited',
        lesson_count: rel.lesson_count || 0,
        last_activity_at: rel.last_activity_at || null,
        next_available_slot: rel.next_available_slot || null,
        relationship_start: rel.relationship_start || '',
        created_at: rel.created_at || '',
      }))
    } catch (err: unknown) {
      const e = err as Error
      error.value = e.message || 'Failed to load collaboration state'
      console.error('[StudentCollaboration] Failed to fetch:', err)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function acceptInvitation(relationId: number) {
    try {
      await relationsApi.acceptRelation(relationId)
      // Refresh state after action
      await fetchCollaborationState()
    } catch (err) {
      console.error('[StudentCollaboration] Failed to accept invitation:', err)
      throw err
    }
  }

  async function declineInvitation(relationId: number) {
    try {
      await relationsApi.declineRelation(relationId)
      // Refresh state after action
      await fetchCollaborationState()
    } catch (err) {
      console.error('[StudentCollaboration] Failed to decline invitation:', err)
      throw err
    }
  }

  function reset() {
    tutors.value = []
    error.value = null
  }

  return {
    // State
    tutors,
    isLoading,
    error,

    // Computed
    activeTutors,
    invitedTutors,
    pausedTutors,
    hasActiveTutors,
    hasInvitations,
    totalLessonsCount,

    // Actions
    fetchCollaborationState,
    acceptInvitation,
    declineInvitation,
    reset,
  }
})

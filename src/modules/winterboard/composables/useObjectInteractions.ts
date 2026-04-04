// WB: Object Interactions composable — CRUD for interaction layer
// Ref: PLAN.md v2 §1.3.4
//
// Manages `interactions[]` array on WBStroke / WBAsset.
// All changes go through store.updateStroke / updateAsset → ops pipeline.

import { computed, type Ref } from 'vue'
import type { WBStroke, WBAsset, WBInteraction, WBInteractionType } from '../types/winterboard'

// ─── Constants ─────────────────────────────────────────────────────────────

export const MAX_INTERACTIONS_PER_OBJECT = 5
export const MAX_INTERACTION_CONTENT_LENGTH = 2000

// ─── Types ─────────────────────────────────────────────────────────────────

export interface UseObjectInteractionsOptions {
  /** Currently selected object ID */
  objectId: Ref<string | null>
  /** Getter: find object by ID (stroke or asset) */
  getObjectById: (id: string) => (WBStroke | WBAsset) | undefined
  /** Callback to persist update via ops pipeline */
  onUpdate: (objectId: string, patch: { interactions: WBInteraction[] | undefined }) => void
}

// ─── Composable ────────────────────────────────────────────────────────────

export function useObjectInteractions(options: UseObjectInteractionsOptions) {
  const { objectId, getObjectById, onUpdate } = options

  // ── Reactive state ───────────────────────────────────────────────────────

  const currentObject = computed(() => {
    const id = objectId.value
    if (!id) return null
    return getObjectById(id) ?? null
  })

  const interactions = computed<WBInteraction[]>(() =>
    currentObject.value?.interactions ?? [],
  )

  const hasInteractions = computed(() => interactions.value.length > 0)

  const canAddMore = computed(() => interactions.value.length < MAX_INTERACTIONS_PER_OBJECT)

  // ── CRUD ─────────────────────────────────────────────────────────────────

  function addInteraction(
    type: WBInteractionType,
    content: string,
    label?: string,
  ): boolean {
    const id = objectId.value
    if (!id) return false
    const obj = getObjectById(id)
    if (!obj) return false

    const existing = obj.interactions ?? []
    if (existing.length >= MAX_INTERACTIONS_PER_OBJECT) return false

    const trimmed = content.trim().slice(0, MAX_INTERACTION_CONTENT_LENGTH)
    if (!trimmed) return false

    const newItem: WBInteraction = {
      id: crypto.randomUUID(),
      type,
      content: trimmed,
      label: label?.trim() || undefined,
      createdAt: new Date().toISOString(),
    }

    onUpdate(id, { interactions: [...existing, newItem] })
    return true
  }

  function updateInteraction(
    interactionId: string,
    content: string,
    label?: string,
  ): boolean {
    const id = objectId.value
    if (!id) return false
    const obj = getObjectById(id)
    if (!obj) return false

    const existing = obj.interactions ?? []
    const idx = existing.findIndex(i => i.id === interactionId)
    if (idx === -1) return false

    const trimmed = content.trim().slice(0, MAX_INTERACTION_CONTENT_LENGTH)
    if (!trimmed) return false

    const updated = [...existing]
    updated[idx] = {
      ...updated[idx],
      content: trimmed,
      label: label?.trim() || undefined,
    }

    onUpdate(id, { interactions: updated })
    return true
  }

  function removeInteraction(interactionId: string): boolean {
    const id = objectId.value
    if (!id) return false
    const obj = getObjectById(id)
    if (!obj) return false

    const existing = obj.interactions ?? []
    const filtered = existing.filter(i => i.id !== interactionId)
    if (filtered.length === existing.length) return false

    onUpdate(id, { interactions: filtered.length > 0 ? filtered : undefined })
    return true
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getInteraction(interactionId: string): WBInteraction | undefined {
    return interactions.value.find(i => i.id === interactionId)
  }

  function getInteractionsByType(type: WBInteractionType): WBInteraction[] {
    return interactions.value.filter(i => i.type === type)
  }

  return {
    interactions,
    hasInteractions,
    canAddMore,
    addInteraction,
    updateInteraction,
    removeInteraction,
    getInteraction,
    getInteractionsByType,
  }
}

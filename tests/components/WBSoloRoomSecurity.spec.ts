/**
 * [P17-A3.2] Unit tests — WBSoloRoom isSessionOwner Security
 * Ref: DAY3_AGENT_A.md A3.2
 *
 * Tests:
 * 1. Returns true when auth user matches session owner
 * 2. Returns false when auth user does not match
 * 3. Returns false when not authenticated
 * 4. Returns false when ownerId is null
 */

import { describe, it, expect } from 'vitest'
import { ref, computed, reactive } from 'vue'

// We test the isSessionOwner computed logic directly.

function createOwnershipCheck(opts: { ownerId: string | null; userId: string | number | null }) {
  const store = reactive({ ownerId: opts.ownerId })
  const authStore = reactive({
    user: opts.userId != null ? { id: opts.userId } : null,
  })

  const isSessionOwner = computed(() => {
    if (!store.ownerId || !authStore.user) return false
    return String(store.ownerId) === String(authStore.user.id)
  })

  return { store, authStore, isSessionOwner }
}

describe('WBSoloRoom — isSessionOwner', () => {
  it('returns true when auth user matches session owner', () => {
    const { isSessionOwner } = createOwnershipCheck({ ownerId: '123', userId: '123' })
    expect(isSessionOwner.value).toBe(true)
  })

  it('returns true when IDs match but types differ (string vs number)', () => {
    const { isSessionOwner } = createOwnershipCheck({ ownerId: '456', userId: 456 })
    expect(isSessionOwner.value).toBe(true)
  })

  it('returns false when auth user does not match', () => {
    const { isSessionOwner } = createOwnershipCheck({ ownerId: '123', userId: '456' })
    expect(isSessionOwner.value).toBe(false)
  })

  it('returns false when not authenticated', () => {
    const { isSessionOwner } = createOwnershipCheck({ ownerId: '123', userId: null })
    expect(isSessionOwner.value).toBe(false)
  })

  it('returns false when ownerId is null', () => {
    const { isSessionOwner } = createOwnershipCheck({ ownerId: null, userId: '123' })
    expect(isSessionOwner.value).toBe(false)
  })

  it('becomes true after hydration sets ownerId', () => {
    const { store, isSessionOwner } = createOwnershipCheck({ ownerId: null, userId: '123' })
    expect(isSessionOwner.value).toBe(false)

    // Simulate hydration
    store.ownerId = '123'
    expect(isSessionOwner.value).toBe(true)
  })

  it('becomes false after logout clears user', () => {
    const { authStore, isSessionOwner } = createOwnershipCheck({ ownerId: '123', userId: '123' })
    expect(isSessionOwner.value).toBe(true)

    // Simulate logout
    authStore.user = null
    expect(isSessionOwner.value).toBe(false)
  })
})

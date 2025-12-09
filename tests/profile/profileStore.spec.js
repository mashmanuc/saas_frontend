import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProfileStore } from '../../src/modules/profile/store/profileStore'
import {
  getMeProfile,
  patchMeProfile,
  autosaveProfile,
  fetchProfileDraft,
  discardProfileDraft,
} from '../../src/api/profile'
import { notifySuccess, notifyError } from '../../src/utils/notify'

vi.mock('../../src/api/profile', () => ({
  getMeProfile: vi.fn(),
  patchMeProfile: vi.fn(),
  autosaveProfile: vi.fn(),
  fetchProfileDraft: vi.fn(),
  discardProfileDraft: vi.fn(),
  updateAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
}))

vi.mock('../../src/utils/notify', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
  notifyWarning: vi.fn(),
  notifyInfo: vi.fn(),
}))

const baseProfileResponse = {
  user: {
    id: 1,
    first_name: 'Ada',
    last_name: 'Lovelace',
    timezone: 'Europe/Kyiv',
    role: 'student',
  },
  profile: {
    headline: 'Math genius',
    bio: 'Invented algorithms',
    subjects: ['Math'],
  },
  settings: {
    timezone: 'Europe/Kyiv',
  },
  avatar_url: '/media/avatar.png',
}

describe('profileStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('autosave rate limit handling', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('blocks autosave for 10 seconds after receiving 429', async () => {
      autosaveProfile.mockRejectedValueOnce({ response: { status: 429 } })
      const store = useProfileStore()
      const payload = { user: { first_name: 'Ada' } }

      const firstResult = await store.autosaveDraft(payload)

      expect(firstResult).toEqual({ status: 'rate_limited' })
      expect(store.isRateLimited).toBe(true)
      expect(autosaveProfile).toHaveBeenCalledTimes(1)

      await store.autosaveDraft(payload)
      expect(autosaveProfile).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(10_001)
      autosaveProfile.mockResolvedValueOnce({ status: 'ok' })
      await store.autosaveDraft(payload)

      expect(autosaveProfile).toHaveBeenCalledTimes(2)
      expect(store.isRateLimited).toBe(false)
    })
  })

  it('loads profile and populates state', async () => {
    getMeProfile.mockResolvedValueOnce(baseProfileResponse)
    const store = useProfileStore()

    await store.loadProfile()

    expect(store.user?.first_name).toBe('Ada')
    expect(store.profile?.headline).toBe('Math genius')
    expect(store.avatarUrl).toContain('avatar.png')
    expect(store.initialized).toBe(true)
    expect(notifyError).not.toHaveBeenCalled()
  })

  it('saves profile and updates timestamps', async () => {
    patchMeProfile.mockResolvedValueOnce(baseProfileResponse)
    const store = useProfileStore()

    await store.saveProfile({ user: { first_name: 'Ada' } })

    expect(patchMeProfile).toHaveBeenCalledWith({ user: { first_name: 'Ada' } })
    expect(store.lastSavedAt).toBeInstanceOf(Date)
    expect(store.lastAutosavedAt).toBeInstanceOf(Date)
    expect(store.hasUnsavedChanges).toBe(false)
    expect(notifySuccess).toHaveBeenCalledTimes(1)
  })

  it('autosaves draft data and sets flags', async () => {
    autosaveProfile.mockResolvedValueOnce({ status: 'ok' })
    const store = useProfileStore()

    await store.autosaveDraft({ user: { first_name: 'Ada' } })

    expect(autosaveProfile).toHaveBeenCalled()
    expect(store.hasDraft).toBe(true)
    expect(store.hasUnsavedChanges).toBe(false)
    expect(store.lastAutosavedAt).toBeInstanceOf(Date)
    expect(store.draftData?.user?.first_name).toBe('Ada')
  })

  it('does not call autosave when payload is empty (clean state)', async () => {
    const store = useProfileStore()

    await store.autosaveDraft(null)

    expect(autosaveProfile).not.toHaveBeenCalled()
  })

  it('handles missing drafts gracefully', async () => {
    fetchProfileDraft.mockRejectedValueOnce({ response: { status: 404 } })
    const store = useProfileStore()

    const result = await store.loadProfileDraft()

    expect(result).toBeNull()
    expect(store.hasDraft).toBe(false)
    expect(store.draftData).toBeNull()
    expect(store.draftError).toBeNull()
  })

  it('restores draft metadata with autosaved timestamp', async () => {
    const autosavedAt = '2024-01-01T10:00:00Z'
    fetchProfileDraft.mockResolvedValueOnce({
      data: { user: { first_name: 'Ada' } },
      autosaved_at: autosavedAt,
    })
    const store = useProfileStore()

    await store.loadProfileDraft()

    expect(store.hasDraft).toBe(true)
    expect(store.draftData?.user?.first_name).toBe('Ada')
    expect(store.lastAutosavedAt?.toISOString()).toBe(new Date(autosavedAt).toISOString())
  })

  it('discards draft and clears state', async () => {
    fetchProfileDraft.mockResolvedValueOnce({
      data: { user: { first_name: 'Ada' } },
      autosaved_at: '2024-01-01T10:00:00Z',
    })
    discardProfileDraft.mockResolvedValueOnce({})

    const store = useProfileStore()
    await store.loadProfileDraft()
    await store.discardProfileDraft()

    expect(discardProfileDraft).toHaveBeenCalled()
    expect(store.hasDraft).toBe(false)
    expect(store.draftData).toBeNull()
  })
})

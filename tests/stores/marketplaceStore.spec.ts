import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import type { TutorPublicListResponse } from '@/types/relations'
import { useMarketplaceStore } from '@/stores/marketplaceStore'

const apiClientGetMock = vi.fn()

vi.mock('@/utils/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => apiClientGetMock(...args)
  }
}))

describe('marketplaceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('searchTutors loads tutors and stores next cursor', async () => {
    const response: TutorPublicListResponse = {
      results: [
        {
          id: 'tutor-1',
          name: 'Tutor One',
          avatar_url: '',
          subjects: ['Math'],
          hourly_rate: 20,
          currency: 'USD',
          rating: 4.8,
          review_count: 15,
          country: 'UA',
          bio: 'Senior math tutor',
          has_relation: false
        }
      ],
      next: 'https://api.test/tutors?cursor=abc',
      previous: null,
      filters_applied: {}
    }
    apiClientGetMock.mockResolvedValueOnce(response)

    const store = useMarketplaceStore()
    await store.searchTutors({ subjects: 'Math' })

    expect(apiClientGetMock).toHaveBeenCalledWith('/v1/tutors/public-list/', {
      params: { subjects: 'Math' }
    })
    expect(store.tutors).toHaveLength(1)
    expect(store.nextCursor).toBe('https://api.test/tutors?cursor=abc')
    expect(store.error).toBeNull()
  })

  it('searchTutors captures errors and sets message', async () => {
    apiClientGetMock.mockRejectedValueOnce(new Error('offline'))

    const store = useMarketplaceStore()
    await store.searchTutors({})

    expect(store.error).toBe('offline')
    expect(store.isLoading).toBe(false)
  })

  it('loadMore appends tutors when cursor present', async () => {
    const firstPage: TutorPublicListResponse = {
      results: [
        {
          id: 'tutor-1',
          name: 'Tutor One',
          avatar_url: '',
          subjects: ['Math'],
          hourly_rate: 20,
          currency: 'USD',
          rating: 4.8,
          review_count: 15,
          country: 'UA',
          bio: 'Senior math tutor',
          has_relation: false
        }
      ],
      next: 'https://api.test/tutors?cursor=abc',
      previous: null,
      filters_applied: {}
    }

    const secondPage: TutorPublicListResponse = {
      results: [
        {
          id: 'tutor-2',
          name: 'Tutor Two',
          avatar_url: '',
          subjects: ['Physics'],
          hourly_rate: 25,
          currency: 'USD',
          rating: 4.9,
          review_count: 10,
          country: 'UA',
          bio: 'Physics tutor',
          has_relation: false
        }
      ],
      next: null,
      previous: null,
      filters_applied: {}
    }

    apiClientGetMock
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage)

    const store = useMarketplaceStore()
    await store.searchTutors({ subjects: 'Math' })
    await store.loadMore()

    expect(apiClientGetMock).toHaveBeenLastCalledWith('/v1/tutors/public-list/', {
      params: { subjects: 'Math', cursor: 'https://api.test/tutors?cursor=abc' }
    })
    expect(store.tutors).toHaveLength(2)
    expect(store.nextCursor).toBeNull()
  })

  it('serializeFilters emits only defined values', () => {
    const store = useMarketplaceStore()
    const params = store.serializeFilters({
      subjects: 'Math,Physics',
      min_rate: 10,
      max_rate: undefined,
      min_rating: 4.5,
      sort_by: 'rating_desc'
    })

    expect(params).toEqual({
      subjects: 'Math,Physics',
      min_rate: '10',
      min_rating: '4.5',
      sort_by: 'rating_desc'
    })
  })

  it('parseFiltersFromQuery converts CSV and numbers', () => {
    const store = useMarketplaceStore()
    const parsed = store.parseFiltersFromQuery({
      subjects: 'Math,Physics',
      min_rate: '15',
      max_rate: '45',
      min_rating: '4',
      sort_by: 'newest'
    })

    expect(parsed).toEqual({
      subjects: 'Math,Physics',
      min_rate: 15,
      max_rate: 45,
      min_rating: 4,
      sort_by: 'newest'
    })
  })

  it('loadMore does nothing if nextCursor is null', async () => {
    const store = useMarketplaceStore()
    store.nextCursor = null

    await store.loadMore()

    expect(apiClientGetMock).not.toHaveBeenCalled()
  })
})

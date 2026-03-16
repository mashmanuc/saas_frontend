import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetMyStats = vi.fn()
const mockGetViewsTimeseries = vi.fn()
const mockGetMyAchievements = vi.fn()

vi.mock('../api/analyticsApi', () => ({
  analyticsApi: {
    getMyStats: (...args: unknown[]) => mockGetMyStats(...args),
    getViewsTimeseries: (...args: unknown[]) => mockGetViewsTimeseries(...args),
    getMyAchievements: (...args: unknown[]) => mockGetMyAchievements(...args),
  },
}))

import { useKnowledgeAnalytics } from '../composables/useKnowledgeAnalytics'

const mockStats = {
  lessons_count: 5,
  total_views: 200,
  total_forks: 10,
  total_clones: 3,
  average_rating: 4.5,
  top_lessons: [],
}

const mockViews = [
  { date: '2026-03-15', views_count: 10 },
  { date: '2026-03-16', views_count: 20 },
]

const mockAchievements = [
  {
    achievement_type: 'first_lesson',
    display_name: 'First Lesson',
    description: 'Publish first lesson',
    icon: 'target',
    earned_at: '2026-01-10',
    progress: null,
    metadata: {},
  },
]

describe('useKnowledgeAnalytics', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('has correct initial state', () => {
    const { stats, viewsTimeseries, achievements, isLoading, error, period } = useKnowledgeAnalytics()
    expect(stats.value).toBeNull()
    expect(viewsTimeseries.value).toEqual([])
    expect(achievements.value).toEqual([])
    expect(isLoading.value).toBe(false)
    expect(error.value).toBeNull()
    expect(period.value).toBe(30)
  })

  it('loadAll fetches stats, views, and achievements', async () => {
    mockGetMyStats.mockResolvedValue(mockStats)
    mockGetViewsTimeseries.mockResolvedValue(mockViews)
    mockGetMyAchievements.mockResolvedValue(mockAchievements)

    const { loadAll, stats, viewsTimeseries, achievements, isLoading } = useKnowledgeAnalytics()

    await loadAll()

    expect(mockGetMyStats).toHaveBeenCalledOnce()
    expect(mockGetViewsTimeseries).toHaveBeenCalledWith(30)
    expect(mockGetMyAchievements).toHaveBeenCalledOnce()
    expect(stats.value).toEqual(mockStats)
    expect(viewsTimeseries.value).toEqual(mockViews)
    expect(achievements.value).toEqual(mockAchievements)
    expect(isLoading.value).toBe(false)
  })

  it('handles API error with detail message', async () => {
    mockGetMyStats.mockRejectedValue({
      response: { data: { detail: 'Not authorized' } },
    })
    mockGetViewsTimeseries.mockResolvedValue([])
    mockGetMyAchievements.mockResolvedValue([])

    const { loadAll, error, isLoading } = useKnowledgeAnalytics()

    await loadAll()

    expect(error.value).toBe('Not authorized')
    expect(isLoading.value).toBe(false)
  })

  it('handles API error without detail message', async () => {
    mockGetMyStats.mockRejectedValue(new Error('Network'))
    mockGetViewsTimeseries.mockResolvedValue([])
    mockGetMyAchievements.mockResolvedValue([])

    const { loadAll, error } = useKnowledgeAnalytics()

    await loadAll()

    expect(error.value).toContain('аналітику')
  })

  it('loadViews fetches views for current period', async () => {
    mockGetViewsTimeseries.mockResolvedValue(mockViews)

    const { loadViews, viewsTimeseries, period } = useKnowledgeAnalytics()
    period.value = 7

    await loadViews()

    expect(mockGetViewsTimeseries).toHaveBeenCalledWith(7)
    expect(viewsTimeseries.value).toEqual(mockViews)
  })
})

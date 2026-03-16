import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGet = vi.fn()

vi.mock('@/utils/apiClient', () => ({
  default: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}))

import { analyticsApi } from '../api/analyticsApi'

const mockStats = {
  lessons_count: 12,
  total_views: 340,
  total_forks: 15,
  total_clones: 8,
  average_rating: 4.6,
  top_lessons: [
    { id: 'l1', title: 'Math 101', slug: 'math-101', views: 120, forks: 5, avg_rating: 4.8 },
  ],
}

const mockViews = [
  { date: '2026-03-15', views_count: 10 },
  { date: '2026-03-16', views_count: 15 },
]

const mockAchievements = [
  {
    achievement_type: 'first_lesson',
    display_name: 'First Lesson',
    description: 'Publish first lesson',
    icon: 'target',
    earned_at: '2026-01-10T12:00:00Z',
    progress: null,
    metadata: {},
  },
]

describe('analyticsApi', () => {
  beforeEach(() => { vi.clearAllMocks() })

  describe('getMyStats', () => {
    it('calls GET at correct URL', async () => {
      mockGet.mockResolvedValue(mockStats)
      const res = await analyticsApi.getMyStats()
      expect(mockGet).toHaveBeenCalledWith('/v1/knowledge/my/analytics/')
      expect(res).toEqual(mockStats)
    })

    it('propagates API error', async () => {
      mockGet.mockRejectedValue(new Error('Unauthorized'))
      await expect(analyticsApi.getMyStats()).rejects.toThrow('Unauthorized')
    })
  })

  describe('getViewsTimeseries', () => {
    it('calls GET with default days=30', async () => {
      mockGet.mockResolvedValue(mockViews)
      const res = await analyticsApi.getViewsTimeseries()
      expect(mockGet).toHaveBeenCalledWith('/v1/knowledge/my/analytics/views/?days=30')
      expect(res).toEqual(mockViews)
    })

    it('passes custom days param', async () => {
      mockGet.mockResolvedValue(mockViews)
      await analyticsApi.getViewsTimeseries(7)
      expect(mockGet).toHaveBeenCalledWith('/v1/knowledge/my/analytics/views/?days=7')
    })
  })

  describe('getMyAchievements', () => {
    it('calls GET at correct URL', async () => {
      mockGet.mockResolvedValue(mockAchievements)
      const res = await analyticsApi.getMyAchievements()
      expect(mockGet).toHaveBeenCalledWith('/v1/knowledge/my/achievements/')
      expect(res).toEqual(mockAchievements)
    })
  })
})

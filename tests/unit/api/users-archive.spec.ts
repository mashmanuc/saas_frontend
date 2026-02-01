/**
 * Unit Tests for User Archive API
 * 
 * Tests for archiveAccount and adminArchiveUser API methods
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { archiveAccount, adminArchiveUser } from '@/api/users'
import apiClient from '@/utils/apiClient'

vi.mock('@/utils/apiClient')

describe('User Archive API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('archiveAccount', () => {
    it('should call POST /v1/users/me/archive with password and reason', async () => {
      const mockResponse = {
        status: 'success',
        message: 'Account archived successfully',
        archived_at: '2026-01-31T12:00:00Z',
        email_suffix: '!archived!1738281600'
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

      const result = await archiveAccount('testpass123', 'user_request')

      expect(apiClient.post).toHaveBeenCalledWith('/v1/users/me/archive', {
        password: 'testpass123',
        reason: 'user_request'
      })
      expect(result).toEqual(mockResponse)
    })

    it('should use default reason if not provided', async () => {
      const mockResponse = {
        status: 'success',
        message: 'Account archived successfully',
        archived_at: '2026-01-31T12:00:00Z',
        email_suffix: '!archived!1738281600'
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

      await archiveAccount('testpass123')

      expect(apiClient.post).toHaveBeenCalledWith('/v1/users/me/archive', {
        password: 'testpass123',
        reason: 'user_request'
      })
    })

    it('should handle API errors', async () => {
      const mockError = {
        response: {
          data: {
            message: 'Invalid password'
          }
        }
      }

      vi.mocked(apiClient.post).mockRejectedValue(mockError)

      await expect(archiveAccount('wrongpass')).rejects.toEqual(mockError)
    })
  })

  describe('adminArchiveUser', () => {
    it('should call POST /v1/users/admin/users/{id}/archive with reason and notes', async () => {
      const mockResponse = {
        status: 'success',
        message: 'User archived successfully',
        user_id: 123,
        archived_at: '2026-01-31T12:00:00Z'
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

      const result = await adminArchiveUser(123, 'policy_violation', 'Spam activity')

      expect(apiClient.post).toHaveBeenCalledWith('/v1/users/admin/users/123/archive', {
        reason: 'policy_violation',
        notes: 'Spam activity'
      })
      expect(result).toEqual(mockResponse)
    })

    it('should use default reason if not provided', async () => {
      const mockResponse = {
        status: 'success',
        message: 'User archived successfully',
        user_id: 123,
        archived_at: '2026-01-31T12:00:00Z'
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

      await adminArchiveUser(123)

      expect(apiClient.post).toHaveBeenCalledWith('/v1/users/admin/users/123/archive', {
        reason: 'admin_action',
        notes: undefined
      })
    })

    it('should handle notes as undefined if not provided', async () => {
      const mockResponse = {
        status: 'success',
        message: 'User archived successfully',
        user_id: 123,
        archived_at: '2026-01-31T12:00:00Z'
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse)

      await adminArchiveUser(123, 'admin_action')

      expect(apiClient.post).toHaveBeenCalledWith('/v1/users/admin/users/123/archive', {
        reason: 'admin_action',
        notes: undefined
      })
    })

    it('should handle API errors', async () => {
      const mockError = {
        response: {
          data: {
            message: 'User not found'
          }
        }
      }

      vi.mocked(apiClient.post).mockRejectedValue(mockError)

      await expect(adminArchiveUser(99999)).rejects.toEqual(mockError)
    })
  })
})

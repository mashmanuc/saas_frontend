/**
 * Staff Store Unit Tests v0.67.0
 * 
 * Tests for staffStore actions, optimistic updates, and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useStaffStore } from '../staffStore'
import * as staffApi from '@/api/staff'
import { ReportStatus, BanScope, BillingCancelMode } from '@/types/staff'
import type { StaffUserOverview, StaffReport, StaffBan } from '@/types/staff'

vi.mock('@/api/staff')

describe('staffStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('loadUserOverview', () => {
    it('loads user overview successfully', async () => {
      const mockOverview: StaffUserOverview = {
        user: {
          id: 'user-123',
          role: 'TUTOR',
          email: 'test@example.com',
          created_at: '2024-01-01T00:00:00Z'
        },
        trust: {
          bans: [],
          blocks_count: 2,
          reports_open_count: 1
        },
        billing: {
          plan: 'PRO',
          subscription_status: 'ACTIVE',
          current_period_end: '2024-12-31T00:00:00Z',
          cancel_at_period_end: false
        },
        activity: {
          inquiries_count_30d: 5,
          contacts_unlocked_30d: 3
        }
      }

      vi.mocked(staffApi.getUserOverview).mockResolvedValue(mockOverview)

      const store = useStaffStore()
      await store.loadUserOverview('user-123')

      expect(staffApi.getUserOverview).toHaveBeenCalledWith('user-123')
      expect(store.userOverview).toEqual(mockOverview)
      expect(store.isLoading).toBe(false)
      expect(store.loadUserOverviewError).toBeNull()
    })

    it('handles error when loading user overview fails', async () => {
      const error = new Error('Failed to load')
      vi.mocked(staffApi.getUserOverview).mockRejectedValue(error)

      const store = useStaffStore()
      
      await expect(store.loadUserOverview('user-123')).rejects.toThrow()
      expect(store.loadUserOverviewError).toBeTruthy()
      expect(store.isLoading).toBe(false)
    })
  })

  describe('loadReports', () => {
    it('loads reports successfully', async () => {
      const mockReports: StaffReport[] = [
        {
          id: 'report-1',
          reporter_id: 'user-1',
          target_id: 'user-2',
          target_type: 'PROFILE',
          category: 'SPAM',
          details: 'Test report',
          status: ReportStatus.OPEN,
          created_at: '2024-01-01T00:00:00Z'
        }
      ]

      vi.mocked(staffApi.listReports).mockResolvedValue({
        reports: mockReports,
        total: 1
      })

      const store = useStaffStore()
      await store.loadReports({ status: ReportStatus.OPEN })

      expect(staffApi.listReports).toHaveBeenCalledWith({ status: ReportStatus.OPEN })
      expect(store.reports).toEqual(mockReports)
      expect(store.reportsTotal).toBe(1)
      expect(store.isLoading).toBe(false)
    })

    it('handles error when loading reports fails', async () => {
      const error = new Error('Failed to load')
      vi.mocked(staffApi.listReports).mockRejectedValue(error)

      const store = useStaffStore()
      
      await expect(store.loadReports()).rejects.toThrow()
      expect(store.loadReportsError).toBeTruthy()
      expect(store.isLoading).toBe(false)
    })
  })

  describe('resolveReport', () => {
    it('resolves report with optimistic update', async () => {
      const mockReport: StaffReport = {
        id: 'report-1',
        reporter_id: 'user-1',
        target_id: 'user-2',
        target_type: 'PROFILE',
        category: 'SPAM',
        details: 'Test',
        status: ReportStatus.OPEN,
        created_at: '2024-01-01T00:00:00Z'
      }

      const updatedReport = { ...mockReport, status: ReportStatus.DISMISSED }

      vi.mocked(staffApi.resolveReport).mockResolvedValue(updatedReport)

      const store = useStaffStore()
      store.reports = [mockReport]

      await store.resolveReport('report-1', { status: 'DISMISSED' })

      expect(staffApi.resolveReport).toHaveBeenCalledWith('report-1', { status: 'DISMISSED' })
      expect(store.reports[0].status).toBe(ReportStatus.DISMISSED)
      expect(store.isLoading).toBe(false)
    })

    it('rolls back optimistic update on error', async () => {
      const mockReport: StaffReport = {
        id: 'report-1',
        reporter_id: 'user-1',
        target_id: 'user-2',
        target_type: 'PROFILE',
        category: 'SPAM',
        details: 'Test',
        status: ReportStatus.OPEN,
        created_at: '2024-01-01T00:00:00Z'
      }

      const error = new Error('Failed to resolve')
      vi.mocked(staffApi.resolveReport).mockRejectedValue(error)

      const store = useStaffStore()
      store.reports = [mockReport]

      await expect(store.resolveReport('report-1', { status: 'DISMISSED' })).rejects.toThrow()
      
      // Should rollback to original status
      expect(store.reports[0].status).toBe(ReportStatus.OPEN)
      expect(store.resolveReportError).toBeTruthy()
    })
  })

  describe('createBan', () => {
    it('creates ban successfully', async () => {
      const mockBan: StaffBan = {
        id: 'ban-1',
        scope: BanScope.CONTACTS,
        ends_at: null,
        reason: 'Test ban',
        status: 'ACTIVE',
        created_at: '2024-01-01T00:00:00Z'
      }

      vi.mocked(staffApi.createBan).mockResolvedValue(mockBan)

      const store = useStaffStore()
      store.userOverview = {
        user: { id: 'user-123', role: 'TUTOR', email: 'test@example.com', created_at: '2024-01-01T00:00:00Z' },
        trust: { bans: [], blocks_count: 0, reports_open_count: 0 },
        billing: { plan: null, subscription_status: null, current_period_end: null, cancel_at_period_end: false },
        activity: { inquiries_count_30d: 0, contacts_unlocked_30d: 0 }
      }

      await store.createBan({
        user_id: 'user-123',
        scope: BanScope.CONTACTS,
        reason: 'Test ban'
      })

      expect(staffApi.createBan).toHaveBeenCalled()
      expect(store.userOverview.trust.bans).toHaveLength(1)
      expect(store.userOverview.trust.bans[0]).toEqual(mockBan)
      expect(store.isLoading).toBe(false)
    })

    it('handles error when creating ban fails', async () => {
      const error = new Error('Failed to create')
      vi.mocked(staffApi.createBan).mockRejectedValue(error)

      const store = useStaffStore()
      
      await expect(store.createBan({
        user_id: 'user-123',
        scope: BanScope.CONTACTS,
        reason: 'Test'
      })).rejects.toThrow()
      
      expect(store.createBanError).toBeTruthy()
      expect(store.isLoading).toBe(false)
    })
  })

  describe('liftBan', () => {
    it('lifts ban with optimistic update', async () => {
      const mockBan: StaffBan = {
        id: 'ban-1',
        scope: BanScope.CONTACTS,
        ends_at: null,
        reason: 'Test',
        status: 'ACTIVE',
        created_at: '2024-01-01T00:00:00Z'
      }

      const liftedBan = { ...mockBan, status: 'LIFTED' as const }

      vi.mocked(staffApi.liftBan).mockResolvedValue(liftedBan)

      const store = useStaffStore()
      store.userOverview = {
        user: { id: 'user-123', role: 'TUTOR', email: 'test@example.com', created_at: '2024-01-01T00:00:00Z' },
        trust: { bans: [mockBan], blocks_count: 0, reports_open_count: 0 },
        billing: { plan: null, subscription_status: null, current_period_end: null, cancel_at_period_end: false },
        activity: { inquiries_count_30d: 0, contacts_unlocked_30d: 0 }
      }

      await store.liftBan('ban-1')

      expect(staffApi.liftBan).toHaveBeenCalledWith('ban-1', undefined)
      expect(store.userOverview.trust.bans[0].status).toBe('LIFTED')
      expect(store.isLoading).toBe(false)
    })

    it('rolls back optimistic update on error', async () => {
      const mockBan: StaffBan = {
        id: 'ban-1',
        scope: BanScope.CONTACTS,
        ends_at: null,
        reason: 'Test',
        status: 'ACTIVE',
        created_at: '2024-01-01T00:00:00Z'
      }

      const error = new Error('Failed to lift')
      vi.mocked(staffApi.liftBan).mockRejectedValue(error)

      const store = useStaffStore()
      store.userOverview = {
        user: { id: 'user-123', role: 'TUTOR', email: 'test@example.com', created_at: '2024-01-01T00:00:00Z' },
        trust: { bans: [mockBan], blocks_count: 0, reports_open_count: 0 },
        billing: { plan: null, subscription_status: null, current_period_end: null, cancel_at_period_end: false },
        activity: { inquiries_count_30d: 0, contacts_unlocked_30d: 0 }
      }

      await expect(store.liftBan('ban-1')).rejects.toThrow()
      
      // Should rollback to ACTIVE
      expect(store.userOverview.trust.bans[0].status).toBe('ACTIVE')
      expect(store.liftBanError).toBeTruthy()
    })
  })

  describe('cancelBilling', () => {
    it('cancels billing and reloads overview', async () => {
      const mockOverview: StaffUserOverview = {
        user: { id: 'user-123', role: 'TUTOR', email: 'test@example.com', created_at: '2024-01-01T00:00:00Z' },
        trust: { bans: [], blocks_count: 0, reports_open_count: 0 },
        billing: { plan: 'PRO', subscription_status: 'ACTIVE', current_period_end: '2024-12-31T00:00:00Z', cancel_at_period_end: true },
        activity: { inquiries_count_30d: 0, contacts_unlocked_30d: 0 }
      }

      vi.mocked(staffApi.cancelBilling).mockResolvedValue({ ok: true })
      vi.mocked(staffApi.getUserOverview).mockResolvedValue(mockOverview)

      const store = useStaffStore()
      store.userOverview = {
        user: { id: 'user-123', role: 'TUTOR', email: 'test@example.com', created_at: '2024-01-01T00:00:00Z' },
        trust: { bans: [], blocks_count: 0, reports_open_count: 0 },
        billing: { plan: 'PRO', subscription_status: 'ACTIVE', current_period_end: '2024-12-31T00:00:00Z', cancel_at_period_end: false },
        activity: { inquiries_count_30d: 0, contacts_unlocked_30d: 0 }
      }

      await store.cancelBilling('user-123', { mode: BillingCancelMode.AT_PERIOD_END })

      expect(staffApi.cancelBilling).toHaveBeenCalledWith('user-123', { mode: BillingCancelMode.AT_PERIOD_END })
      expect(staffApi.getUserOverview).toHaveBeenCalledWith('user-123')
      expect(store.userOverview.billing.cancel_at_period_end).toBe(true)
      expect(store.isLoading).toBe(false)
    })

    it('handles error when canceling billing fails', async () => {
      const error = new Error('Failed to cancel')
      vi.mocked(staffApi.cancelBilling).mockRejectedValue(error)

      const store = useStaffStore()
      
      await expect(store.cancelBilling('user-123', { mode: BillingCancelMode.IMMEDIATE })).rejects.toThrow()
      
      expect(store.cancelBillingError).toBeTruthy()
      expect(store.isLoading).toBe(false)
    })
  })

  describe('getters', () => {
    it('activeBans returns only active bans', () => {
      const store = useStaffStore()
      store.userOverview = {
        user: { id: 'user-123', role: 'TUTOR', email: 'test@example.com', created_at: '2024-01-01T00:00:00Z' },
        trust: {
          bans: [
            { id: 'ban-1', scope: BanScope.CONTACTS, ends_at: null, reason: 'Test', status: 'ACTIVE', created_at: '2024-01-01T00:00:00Z' },
            { id: 'ban-2', scope: BanScope.PLATFORM, ends_at: null, reason: 'Test', status: 'LIFTED', created_at: '2024-01-01T00:00:00Z' }
          ],
          blocks_count: 0,
          reports_open_count: 0
        },
        billing: { plan: null, subscription_status: null, current_period_end: null, cancel_at_period_end: false },
        activity: { inquiries_count_30d: 0, contacts_unlocked_30d: 0 }
      }

      expect(store.activeBans).toHaveLength(1)
      expect(store.activeBans[0].id).toBe('ban-1')
    })

    it('hasActiveBans returns true when active bans exist', () => {
      const store = useStaffStore()
      store.userOverview = {
        user: { id: 'user-123', role: 'TUTOR', email: 'test@example.com', created_at: '2024-01-01T00:00:00Z' },
        trust: {
          bans: [
            { id: 'ban-1', scope: BanScope.CONTACTS, ends_at: null, reason: 'Test', status: 'ACTIVE', created_at: '2024-01-01T00:00:00Z' }
          ],
          blocks_count: 0,
          reports_open_count: 0
        },
        billing: { plan: null, subscription_status: null, current_period_end: null, cancel_at_period_end: false },
        activity: { inquiries_count_30d: 0, contacts_unlocked_30d: 0 }
      }

      expect(store.hasActiveBans).toBe(true)
    })

    it('openReports returns only open reports', () => {
      const store = useStaffStore()
      store.reports = [
        { id: 'report-1', reporter_id: 'user-1', target_id: 'user-2', target_type: 'PROFILE', category: 'SPAM', details: 'Test', status: ReportStatus.OPEN, created_at: '2024-01-01T00:00:00Z' },
        { id: 'report-2', reporter_id: 'user-1', target_id: 'user-2', target_type: 'PROFILE', category: 'SPAM', details: 'Test', status: ReportStatus.DISMISSED, created_at: '2024-01-01T00:00:00Z' }
      ]

      expect(store.openReports).toHaveLength(1)
      expect(store.openReports[0].id).toBe('report-1')
    })
  })
})

/**
 * Staff Console Store v0.67.0
 * 
 * Pinia store for staff/admin operations
 */

import { defineStore } from 'pinia'
import axios from 'axios'
import * as staffApi from '@/api/staff'
import type {
  StaffUserOverview,
  StaffReport,
  StaffReportListParams,
  StaffReportResolvePayload,
  StaffCreateBanPayload,
  StaffLiftBanPayload,
  StaffCancelBillingPayload,
  StaffBan,
} from '@/types/staff'

/**
 * Standard error handling - rethrow as domain error
 * Avoids manual parsing of err.response
 */
function rethrowAsDomainError(err: unknown): never {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as any
    if (data?.code) {
      const error = new Error(data.message || data.code)
      ;(error as any).code = data.code
      ;(error as any).meta = data.meta
      throw error
    }
  }
  throw err
}

interface StaffStoreState {
  userOverview: StaffUserOverview | null
  reports: StaffReport[]
  reportsTotal: number
  selectedReport: StaffReport | null
  isLoading: boolean
  error: string | null
  loadUserOverviewError: string | null
  loadReportsError: string | null
  resolveReportError: string | null
  createBanError: string | null
  liftBanError: string | null
  cancelBillingError: string | null
}

export const useStaffStore = defineStore('staff', {
  state: (): StaffStoreState => ({
    userOverview: null,
    reports: [],
    reportsTotal: 0,
    selectedReport: null,
    isLoading: false,
    error: null,
    loadUserOverviewError: null,
    loadReportsError: null,
    resolveReportError: null,
    createBanError: null,
    liftBanError: null,
    cancelBillingError: null,
  }),

  getters: {
    activeBans: (state): StaffBan[] => {
      return state.userOverview?.trust.bans.filter(ban => ban.status === 'ACTIVE') || []
    },
    
    hasActiveBans: (state): boolean => {
      return state.userOverview?.trust.bans.some(ban => ban.status === 'ACTIVE') || false
    },

    openReports: (state): StaffReport[] => {
      return state.reports.filter(report => report.status === 'OPEN')
    },
  },

  actions: {
    /**
     * Load user overview (trust, billing, activity)
     */
    async loadUserOverview(userId: string): Promise<void> {
      this.isLoading = true
      this.loadUserOverviewError = null
      this.error = null

      try {
        this.userOverview = await staffApi.getUserOverview(userId)
      } catch (err) {
        try {
          rethrowAsDomainError(err)
        } catch (domainError: any) {
          this.loadUserOverviewError = domainError.message || 'Failed to load user overview'
          this.error = this.loadUserOverviewError
          throw domainError
        }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Load reports list with optional filters
     */
    async loadReports(params?: StaffReportListParams): Promise<void> {
      this.isLoading = true
      this.loadReportsError = null
      this.error = null

      try {
        const response = await staffApi.listReports(params)
        this.reports = response.reports
        this.reportsTotal = response.total
      } catch (err) {
        try {
          rethrowAsDomainError(err)
        } catch (domainError: any) {
          this.loadReportsError = domainError.message || 'Failed to load reports'
          this.error = this.loadReportsError
          throw domainError
        }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Load single report details
     */
    async loadReport(id: string): Promise<void> {
      this.isLoading = true
      this.error = null

      try {
        this.selectedReport = await staffApi.getReport(id)
      } catch (err) {
        try {
          rethrowAsDomainError(err)
        } catch (domainError: any) {
          this.error = domainError.message || 'Failed to load report'
          throw domainError
        }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Resolve a report (dismiss or actioned)
     */
    async resolveReport(id: string, payload: StaffReportResolvePayload): Promise<void> {
      this.isLoading = true
      this.resolveReportError = null
      this.error = null

      const originalReport = this.reports.find(r => r.id === id)
      const originalStatus = originalReport?.status

      // Optimistic update
      if (originalReport) {
        originalReport.status = payload.status as any
      }

      try {
        const updatedReport = await staffApi.resolveReport(id, payload)
        
        // Update in list
        const index = this.reports.findIndex(r => r.id === id)
        if (index !== -1) {
          this.reports[index] = updatedReport
        }

        // Update selected if it's the same report
        if (this.selectedReport?.id === id) {
          this.selectedReport = updatedReport
        }
      } catch (err) {
        // Rollback optimistic update
        if (originalReport && originalStatus) {
          originalReport.status = originalStatus
        }

        try {
          rethrowAsDomainError(err)
        } catch (domainError: any) {
          this.resolveReportError = domainError.message || 'Failed to resolve report'
          this.error = this.resolveReportError
          throw domainError
        }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Create a ban
     */
    async createBan(payload: StaffCreateBanPayload): Promise<void> {
      this.isLoading = true
      this.createBanError = null
      this.error = null

      try {
        const newBan = await staffApi.createBan(payload)
        
        // Update user overview if loaded
        if (this.userOverview && this.userOverview.user.id === payload.user_id) {
          this.userOverview.trust.bans.unshift(newBan)
        }
      } catch (err) {
        try {
          rethrowAsDomainError(err)
        } catch (domainError: any) {
          this.createBanError = domainError.message || 'Failed to create ban'
          this.error = this.createBanError
          throw domainError
        }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Lift a ban
     */
    async liftBan(id: string, payload?: StaffLiftBanPayload): Promise<void> {
      this.isLoading = true
      this.liftBanError = null
      this.error = null

      const originalBan = this.userOverview?.trust.bans.find(b => b.id === id)
      const originalStatus = originalBan?.status

      // Optimistic update
      if (originalBan) {
        originalBan.status = 'LIFTED'
      }

      try {
        const updatedBan = await staffApi.liftBan(id, payload)
        
        // Update in user overview
        if (this.userOverview) {
          const index = this.userOverview.trust.bans.findIndex(b => b.id === id)
          if (index !== -1) {
            this.userOverview.trust.bans[index] = updatedBan
          }
        }
      } catch (err) {
        // Rollback optimistic update
        if (originalBan && originalStatus) {
          originalBan.status = originalStatus
        }

        try {
          rethrowAsDomainError(err)
        } catch (domainError: any) {
          this.liftBanError = domainError.message || 'Failed to lift ban'
          this.error = this.liftBanError
          throw domainError
        }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Cancel user billing/subscription
     */
    async cancelBilling(userId: string, payload: StaffCancelBillingPayload): Promise<void> {
      this.isLoading = true
      this.cancelBillingError = null
      this.error = null

      try {
        await staffApi.cancelBilling(userId, payload)
        
        // Reload user overview to get updated billing state
        if (this.userOverview && this.userOverview.user.id === userId) {
          await this.loadUserOverview(userId)
        }
      } catch (err) {
        try {
          rethrowAsDomainError(err)
        } catch (domainError: any) {
          this.cancelBillingError = domainError.message || 'Failed to cancel billing'
          this.error = this.cancelBillingError
          throw domainError
        }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Clear all errors
     */
    clearErrors(): void {
      this.error = null
      this.loadUserOverviewError = null
      this.loadReportsError = null
      this.resolveReportError = null
      this.createBanError = null
      this.liftBanError = null
      this.cancelBillingError = null
    },

    /**
     * Reset store state
     */
    $reset(): void {
      this.userOverview = null
      this.reports = []
      this.reportsTotal = 0
      this.selectedReport = null
      this.isLoading = false
      this.clearErrors()
    },
  },
})

import { telemetry } from '@/services/telemetry'

export interface SearchEventPayload {
  query?: string
  filters: Record<string, any>
  resultsCount: number
  latencyMs: number
  sessionId: string
}

export interface FilterEventPayload {
  filterType: string
  filterValue: any
  sessionId: string
}

class SearchTrackingService {
  private sessionId: string

  constructor() {
    this.sessionId = this.generateSessionId()
  }

  private generateSessionId(): string {
    return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  trackSearchExecuted(payload: Omit<SearchEventPayload, 'sessionId'>) {
    const sanitizedPayload = {
      has_query: !!payload.query && payload.query.length >= 2,
      query_length: payload.query?.length || 0,
      filters_count: Object.keys(payload.filters).length,
      results_count: payload.resultsCount,
      latency_ms: payload.latencyMs,
      session_id: this.sessionId
    }

    telemetry.trigger('marketplace_search_executed', sanitizedPayload)

    if (payload.resultsCount === 0) {
      this.trackZeroResults(payload)
    }
  }

  trackZeroResults(payload: Omit<SearchEventPayload, 'sessionId'>) {
    const sanitizedPayload = {
      has_query: !!payload.query && payload.query.length >= 2,
      filters_count: Object.keys(payload.filters).length,
      session_id: this.sessionId
    }

    telemetry.trigger('marketplace_search_zero_results', sanitizedPayload)
  }

  trackFilterApplied(payload: Omit<FilterEventPayload, 'sessionId'>) {
    const sanitizedPayload = {
      filter_type: payload.filterType,
      has_value: !!payload.filterValue,
      session_id: this.sessionId
    }

    telemetry.trigger('marketplace_filter_applied', sanitizedPayload)
  }

  trackFilterReset() {
    telemetry.trigger('marketplace_filter_reset', {
      session_id: this.sessionId
    })
  }

  trackSortChanged(sortBy: string) {
    telemetry.trigger('marketplace_sort_changed', {
      sort_by: sortBy,
      session_id: this.sessionId
    })
  }

  resetSession() {
    this.sessionId = this.generateSessionId()
  }
}

export const searchTrackingService = new SearchTrackingService()
export default searchTrackingService

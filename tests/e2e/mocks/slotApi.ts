import { Page } from '@playwright/test'

interface MockSlotApiOptions {
  getSlot?: any
  getSlots?: any[]
  checkConflicts?: { has_conflicts: boolean; conflicts: any[] }
  checkBatchConflicts?: { has_conflicts: boolean; conflicts: any[] }
  editSlot?: any
  batchEditSlots?: { success_count: number; error_count: number; results: any[] }
  deleteSlot?: void
}

export function mockSlotApi(page: Page, options: MockSlotApiOptions) {
  // Mock API routes
  page.route('/api/v1/booking/slots/**', async (route) => {
    const url = route.request().url()
    const method = route.request().method()

    if (method === 'GET' && url.includes('/check-conflicts/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.checkConflicts || { has_conflicts: false, conflicts: [] })
      })
    } else if (method === 'POST' && url.includes('/check-conflicts/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.checkBatchConflicts || { has_conflicts: false, conflicts: [] })
      })
    } else if (method === 'PATCH' && url.includes('/edit/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.editSlot || {})
      })
    } else if (method === 'POST' && url.includes('/batch-edit/')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(options.batchEditSlots || { success_count: 0, error_count: 0, results: [] })
      })
    } else if (method === 'DELETE') {
      await route.fulfill({
        status: 204,
        body: ''
      })
    } else if (method === 'GET') {
      const slotId = url.split('/').pop()
      if (options.getSlot && slotId) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(options.getSlot)
        })
      } else if (options.getSlots) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(options.getSlots)
        })
      } else {
        await route.continue()
      }
    } else {
      await route.continue()
    }
  })

  // Track API calls for testing
  page.addInitScript(() => {
    window.__apiCalls = []
    
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const [url, options] = args
      window.__apiCalls.push({
        url,
        method: options?.method || 'GET',
        timestamp: Date.now()
      })
      return originalFetch(...args)
    }
  })
}

export function clearSlotApiMocks(page: Page) {
  page.unroute('/api/v1/booking/slots/**')
}

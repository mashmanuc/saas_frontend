// Mock handlers for availability API endpoints

export const availabilityHandlers = {
  // POST /api/v1/availability/bulk - Bulk Apply API
  bulkApply: (data: { patches: any[] }) => {
    const applied = data.patches.map(patch => ({
      startAtUTC: patch.startAtUTC,
      status: 'success',
    }))

    return {
      applied,
      rejected: [],
      summary: {
        total: data.patches.length,
        applied: data.patches.length,
        rejected: 0,
      },
    }
  },

  // Partial success scenario
  bulkApplyPartial: (data: { patches: any[] }) => {
    const halfIndex = Math.floor(data.patches.length / 2)
    const applied = data.patches.slice(0, halfIndex).map(patch => ({
      startAtUTC: patch.startAtUTC,
      status: 'success',
    }))
    const rejected = data.patches.slice(halfIndex).map(patch => ({
      startAtUTC: patch.startAtUTC,
      reason: 'conflict',
    }))

    return {
      applied,
      rejected,
      summary: {
        total: data.patches.length,
        applied: applied.length,
        rejected: rejected.length,
      },
    }
  },

  // Error scenario
  bulkApplyError: () => {
    throw new Error('Network error')
  },
}

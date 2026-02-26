import { defineStore } from 'pinia'

const SAFETY_TIMEOUT_MS = 15_000

export const useLoaderStore = defineStore('loader', {
  state: () => ({
    active: 0,
    _safetyTimer: null,
  }),

  getters: {
    isLoading: (state) => state.active > 0,
  },

  actions: {
    start() {
      this.active += 1
      this._startSafetyTimer()
    },
    stop() {
      if (this.active > 0) {
        this.active -= 1
      }
      if (this.active === 0) {
        this._clearSafetyTimer()
      }
    },
    reset() {
      this.active = 0
      this._clearSafetyTimer()
    },
    _startSafetyTimer() {
      // Safety net: якщо лодер крутиться > 15с — скидаємо примусово.
      // Це захист від дисбалансу start/stop через edge-cases в interceptor.
      if (this._safetyTimer) return
      this._safetyTimer = setTimeout(() => {
        if (this.active > 0) {
          console.warn(`[loaderStore] Safety timeout: active=${this.active} after ${SAFETY_TIMEOUT_MS}ms — resetting to 0`)
          this.active = 0
        }
        this._safetyTimer = null
      }, SAFETY_TIMEOUT_MS)
    },
    _clearSafetyTimer() {
      if (this._safetyTimer) {
        clearTimeout(this._safetyTimer)
        this._safetyTimer = null
      }
    },
  },
})

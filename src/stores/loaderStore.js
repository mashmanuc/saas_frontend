import { defineStore } from 'pinia'

// Phase RS PR-RS-C2 (2026-05-01): bumped 15_000 → 60_000.
// Rationale: safety net MUST fire тільки на real balance bugs, NOT on
// legitimately slow requests. Aligned з axios timeout у apiClient (30s):
//   - Slow request: axios timeout fires at 30s → loader.stop() called →
//     safety NEVER triggers (active=0 before 60s)
//   - Real bug (orphan start без stop): safety fires at 60s → INV-FE-4 emit
const SAFETY_TIMEOUT_MS = 60_000

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
      // Safety net: якщо лодер крутиться > SAFETY_TIMEOUT_MS — скидаємо
      // примусово. Це захист від дисбалансу start/stop (orphan starts).
      // Phase RS PR-RS-C2: emit INV-FE-4 violation + telemetry на fire.
      if (this._safetyTimer) return
      this._safetyTimer = setTimeout(() => {
        if (this.active > 0) {
          const stuckCount = this.active
          console.warn(
            `[loaderStore] Safety timeout: active=${stuckCount} after ` +
            `${SAFETY_TIMEOUT_MS}ms — resetting to 0`,
          )
          // INV-FE-4: loader.start() без matching stop() detected.
          // Lazy import щоб уникнути circular deps + bundling overhead
          // (loaderStore loaded дуже early у app boot).
          import('../utils/invariantGuard')
            .then((m) => {
              try {
                m.violate('FE-4', 'loader stuck — start() without matching stop()', {
                  active_count: stuckCount,
                  timeout_ms: SAFETY_TIMEOUT_MS,
                })
              } catch {
                // violate failure non-fatal — already logged via console.warn
              }
            })
            .catch(() => {
              // module load failed — ignore (extremely rare)
            })
          // FE telemetry → BE bridge (PR-RS-E4 deferred) → wb_loader_stuck_total
          import('../utils/telemetryAgent')
            .then((m) => {
              try {
                m.trackEvent('wb.loader.stuck', {
                  active_count: stuckCount,
                  timeout_ms: SAFETY_TIMEOUT_MS,
                })
              } catch {
                // telemetry failure non-fatal
              }
            })
            .catch(() => {})
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

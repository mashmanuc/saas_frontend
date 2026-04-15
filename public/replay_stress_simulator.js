/**
 * Winterboard Replay Stress Simulator
 *
 * Запускається В КОНСОЛІ БРАУЗЕРА коли тьютор відкритий solo-room
 * (`/winterboard/{session_id}`). Імітує реальні high-throughput drawing
 * scenarios для тестування ops-only migration.
 *
 * Використання:
 *   1. Відкрити solo-room у Chrome
 *   2. F12 → Console
 *   3. Вставити цей файл
 *   4. Запустити сценарій, наприклад:
 *        wbStressSim.run('baseline')
 *        wbStressSim.run('lockContention')
 *        wbStressSim.run('longSession')
 *   5. Спостерігати metrics у консолі
 *   6. wbStressSim.report() — підсумок
 *
 * Для TEST 2 (latency) — включити Chrome DevTools → Network → «Slow 3G»
 * Для TEST 3 (packet loss) — toggle «Offline» вкл/викл кожні 2-3 сек
 */
;(() => {
  // ── Guard ──────────────────────────────────────────────────────────────
  if (!window || !document) {
    console.error('[stress-sim] not in browser')
    return
  }

  /**
   * Спроба знайти recorder instance у runtime.
   * Workaround: Vue composables не expose globally. Sim працює через
   * прямі API calls (без recorder) — симулює той же flow як recorder робить.
   */
  const state = {
    sessionId: null,
    metrics: {
      sent: 0,
      acked: 0,
      errors: { 409: 0, 500: 0, network: 0, other: 0 },
      startedAt: null,
      endedAt: null,
    },
    running: false,
  }

  function currentSessionId() {
    // URL pattern: /winterboard/{uuid}  або  /winterboard/classroom/{id}
    const m = location.pathname.match(/\/winterboard\/([a-f0-9-]{36})/i)
    return m ? m[1] : null
  }

  function randomOp(i) {
    return {
      op_type: 'stroke_add',
      op_id: crypto.randomUUID(),
      page_id: 'page-1',
      payload: {
        stroke: {
          id: `sim-${Date.now()}-${i}`,
          points: Array.from({ length: 20 }, () => Math.random() * 1000),
          color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'),
          width: 2,
        },
      },
    }
  }

  async function postBatch(ops) {
    const sid = state.sessionId || currentSessionId()
    if (!sid) throw new Error('no session id — open a solo-room first')
    state.sessionId = sid

    const url = `/api/v1/winterboard/sessions/${sid}/replay/batch/`
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operations: ops }),
    })
    return res
  }

  async function sendBatch(ops) {
    state.metrics.sent += ops.length
    try {
      const res = await postBatch(ops)
      if (res.status === 201) {
        state.metrics.acked += ops.length
      } else if (res.status === 409) {
        state.metrics.errors[409]++
        // Retry once після короткого jitter (як recorder робить)
        await new Promise((r) => setTimeout(r, 100 + Math.random() * 200))
        const retry = await postBatch(ops)
        if (retry.status === 201) state.metrics.acked += ops.length
      } else if (res.status >= 500) {
        state.metrics.errors[500]++
      } else {
        state.metrics.errors.other++
      }
    } catch (err) {
      state.metrics.errors.network++
      console.warn('[stress-sim] network error:', err.message)
    }
  }

  async function scenarioBaseline({ duration = 30_000, opsPerSec = 10 } = {}) {
    console.log(`[stress-sim] BASELINE: ${opsPerSec} ops/s for ${duration}ms`)
    state.running = true
    state.metrics.startedAt = Date.now()
    let i = 0
    const intervalMs = 1000 / opsPerSec

    while (state.running && Date.now() - state.metrics.startedAt < duration) {
      // Batch по 5 ops (імітація WebSocket burst)
      const batch = []
      for (let n = 0; n < 5; n++) batch.push(randomOp(i++))
      // fire-and-forget через Promise — не блокуємо loop
      sendBatch(batch).catch(() => {})
      await new Promise((r) => setTimeout(r, intervalMs * 5))
    }
    state.metrics.endedAt = Date.now()
    state.running = false
    console.log('[stress-sim] baseline done')
  }

  async function scenarioLockContention({ concurrentBurst = 10, batchSize = 50 } = {}) {
    console.log(`[stress-sim] LOCK CONTENTION: ${concurrentBurst} parallel batches × ${batchSize} ops`)
    state.running = true
    state.metrics.startedAt = Date.now()
    const promises = []
    let i = 0
    for (let c = 0; c < concurrentBurst; c++) {
      const batch = []
      for (let n = 0; n < batchSize; n++) batch.push(randomOp(i++))
      promises.push(sendBatch(batch))
    }
    await Promise.all(promises)
    state.metrics.endedAt = Date.now()
    state.running = false
    console.log('[stress-sim] lock contention done')
  }

  async function scenarioLongSession({ minutes = 2 } = {}) {
    console.log(`[stress-sim] LONG SESSION: ${minutes} min at 5 ops/s`)
    await scenarioBaseline({ duration: minutes * 60 * 1000, opsPerSec: 5 })
  }

  function stop() {
    state.running = false
    console.log('[stress-sim] stopped')
  }

  function report() {
    const elapsedMs = (state.metrics.endedAt || Date.now()) - (state.metrics.startedAt || 0)
    const { sent, acked, errors } = state.metrics
    const loss = sent - acked
    const err409Rate = sent > 0 ? ((errors[409] / sent) * 100).toFixed(2) : '0'
    console.group('[stress-sim] REPORT')
    console.log(`Duration:        ${elapsedMs}ms`)
    console.log(`Sent ops:        ${sent}`)
    console.log(`Acked ops:       ${acked}`)
    console.log(`Loss:            ${loss} (${sent > 0 ? ((loss / sent) * 100).toFixed(2) : 0}%)`)
    console.log(`409 count:       ${errors[409]} (${err409Rate}% of sent)`)
    console.log(`500 count:       ${errors[500]}`)
    console.log(`Network errors:  ${errors.network}`)
    console.log(`Other errors:    ${errors.other}`)
    console.group('Advisor DoD')
    console.log(`sent_ops === stored_ops:      ${loss === 0 ? 'PASS ✅' : 'FAIL ❌'}`)
    console.log(`409 < 5% of sent:             ${err409Rate < 5 ? 'PASS ✅' : 'WARN ⚠️'}`)
    console.log(`No fatal cascade:             ${errors.network + errors.other < 10 ? 'PASS ✅' : 'WARN ⚠️'}`)
    console.groupEnd()
    console.groupEnd()
  }

  function reset() {
    state.metrics = {
      sent: 0,
      acked: 0,
      errors: { 409: 0, 500: 0, network: 0, other: 0 },
      startedAt: null,
      endedAt: null,
    }
  }

  window.wbStressSim = {
    run: async (name, opts) => {
      reset()
      const scenarios = {
        baseline: scenarioBaseline,
        lockContention: scenarioLockContention,
        longSession: scenarioLongSession,
      }
      const fn = scenarios[name]
      if (!fn) {
        console.error('[stress-sim] unknown scenario. Use: baseline | lockContention | longSession')
        return
      }
      await fn(opts)
      report()
    },
    stop,
    report,
    reset,
    metrics: () => state.metrics,
  }

  console.log(
    '%c[wbStressSim] loaded',
    'color:#0a84ff;font-weight:bold',
    '\nUsage:\n  wbStressSim.run("baseline")           // 30s, 10 ops/s\n  wbStressSim.run("lockContention")     // 10 parallel × 50 ops\n  wbStressSim.run("longSession", {minutes: 2})\n  wbStressSim.stop()\n  wbStressSim.report()',
  )
})()

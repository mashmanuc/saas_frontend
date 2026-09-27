// Час перегляду Replay — ЄДИНЕ джерело для рушія (затримки між op) і шкали програвача.
//
// Рушій навмисно стискає паузи уроку (рішення власника 2026-09-23): пауза > 2 с грає як 2 с.
// Шкала раніше була в реальному часі уроку: повзунок повз, а на кожній стиснутій паузі
// перескакував на решту, і під кінець «скакав» до кінця (скарга власника 2026-09-27,
// REPLAY_TIMELINE_AND_ENDING_INVESTIGATION_2026-09-27.md). Тепер шкала — час перегляду:
// та сама формула, що й затримки рушія, тож повзунок іде рівно й доходить до кінця разом
// з останньою op. Реальний час уроку лишається для `?t=` (старі посилання) і підпису
// «урок тривав».

/** Пауза уроку, довша за цю, грає як ця (рішення власника 2026-09-23). */
export const REPLAY_MAX_GAP_MS = 2000
/** Ops ближче за цю відстань застосовуються пачкою в одному такті (paste, batch). */
export const REPLAY_BURST_MS = 16
/** Мінімальна затримка між op, що не йдуть пачкою. */
export const REPLAY_MIN_DELAY_MS = 4
/**
 * Витримка після останньої op: готова дошка лишається видимою, повзунок плавно
 * доходить до кінця — завжди, незалежно від тиші в записі (рішення власника 2026-09-27).
 */
export const REPLAY_EPILOGUE_MS = 2500

/** Скільки часу перегляду (на 1×) займає пауза уроку між двома сусідніми op. 0 — пачка. */
export function viewGapMs(realGapMs: number): number {
  if (!Number.isFinite(realGapMs)) return REPLAY_BURST_MS   // як рушій: зламаний час → 16 мс
  const gap = Math.max(0, realGapMs)
  if (gap < REPLAY_BURST_MS) return 0
  return Math.max(REPLAY_MIN_DELAY_MS, Math.min(gap, REPLAY_MAX_GAP_MS))
}

export interface ReplayViewTimeline {
  /** Момент перегляду (мс від старту на 1×), коли показується op[i]. */
  viewAt: Float64Array
  /** Реальний зсув op[i] від першої op, мс (час уроку). */
  realAt: Float64Array
  /** Шкала повністю: остання op + витримка. */
  totalViewMs: number
  /** Урок від першої до останньої op, мс. */
  lessonMs: number
}

export function buildViewTimeline(createdAt: ReadonlyArray<string>): ReplayViewTimeline {
  const n = createdAt.length
  const viewAt = new Float64Array(n)
  const realAt = new Float64Array(n)
  if (n === 0) return { viewAt, realAt, totalViewMs: 0, lessonMs: 0 }
  const t0 = new Date(createdAt[0]).getTime()
  let prev = t0
  for (let i = 0; i < n; i++) {
    const t = new Date(createdAt[i]).getTime()
    realAt[i] = Number.isFinite(t) && Number.isFinite(t0) ? Math.max(0, t - t0) : (i > 0 ? realAt[i - 1] : 0)
    // Проміжок — між СУСІДНІМИ op, як у рушія: зламаний час з будь-якого боку дає 16 мс.
    // Не переносити «останній справжній час» через биту op — рушій так не робить, і шкала
    // з'їхала б на різницю (replayViewTime.spec: 500 мс замість 16).
    if (i > 0) viewAt[i] = viewAt[i - 1] + viewGapMs(t - prev)
    prev = t
  }
  return { viewAt, realAt, totalViewMs: viewAt[n - 1] + REPLAY_EPILOGUE_MS, lessonMs: realAt[n - 1] }
}

/** Перший індекс op, що показується не раніше `viewMs` (як findIndexByTimeMs, але на шкалі перегляду). */
export function findIndexByViewMs(tl: ReplayViewTimeline, viewMs: number): number {
  const n = tl.viewAt.length
  if (n === 0 || viewMs <= 0) return 0
  let lo = 0
  let hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (tl.viewAt[mid] < viewMs) lo = mid + 1
    else hi = mid
  }
  return tl.viewAt[lo] < viewMs ? n - 1 : lo
}

/**
 * Час уроку (реальний) для точки шкали перегляду — для `?t=`, щоб старі й нові посилання
 * мали одне значення. Усередині стиснутої паузи час уроку йде разом із переглядом, але не
 * далі за наступну op.
 */
export function lessonMsAtView(tl: ReplayViewTimeline, viewMs: number): number {
  const n = tl.viewAt.length
  if (n === 0) return 0
  let i = findIndexByViewMs(tl, viewMs)
  if (tl.viewAt[i] > viewMs && i > 0) i--
  const into = Math.max(0, viewMs - tl.viewAt[i])
  const cap = i + 1 < n ? tl.realAt[i + 1] : tl.realAt[i]
  return Math.min(tl.realAt[i] + into, cap)
}

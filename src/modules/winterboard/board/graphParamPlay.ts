/**
 * Графкалькулятор: кнопка ▶ «пробігання параметра», як у Desmos (власник 2026-10-04,
 * ТЗ `saas_docs/domains/winterboard/TZ_GRAPHCALC_PARAM_PLAY_2026-10-04.md`).
 *
 * Значення йде туди-назад між мін і макс; весь діапазон в один бік — PLAY_PERIOD_MS;
 * значення стає на сітку кроку. Кожен кадр рендерер віддає штатним шляхом повзунка
 * (`calc.setParamValue` → `graph_param_set`, ≤30/с, OPS_SYNC_SSOT INV-21 п.13) — тож
 * учні й Replay бачать рух; знімка картки під час руху немає (INV-21 п.5).
 * Тут — лише математика кроку й керування; час і кадри — ззовні (тести без браузера).
 */

/** Весь діапазон в один бік — за 4 с. */
export const PLAY_PERIOD_MS = 4000
/** Довша пауза між кадрами (вкладка у фоні) не стрибає параметр через весь діапазон. */
export const PLAY_MAX_DT_MS = 100

export interface PlayRange { min: number; max: number; step: number }
export interface PlayState { pos: number; dir: 1 | -1 }

/** Значення на сітці кроку від мін, у межах; без хвостів плаваючої коми. */
export function snapToStep(pos: number, r: PlayRange): number {
  const clamped = Math.min(r.max, Math.max(r.min, pos))
  if (!(r.step > 0)) return clamped
  const k = Math.round((clamped - r.min) / r.step)
  const v = Math.min(r.max, Math.max(r.min, r.min + k * r.step))
  return parseFloat(v.toFixed(10))
}

/** Один крок руху: нова неперервна позиція, напрям і значення на сітці кроку. */
export function stepParamPlay(state: PlayState, r: PlayRange, dtMs: number, periodMs = PLAY_PERIOD_MS): PlayState & { value: number } {
  const span = r.max - r.min
  if (!(span > 0)) return { pos: r.min, dir: state.dir, value: r.min }
  let pos = Math.min(r.max, Math.max(r.min, state.pos)) // межі могли змінити під час руху
  let dir = state.dir
  pos += dir * span * (Math.max(0, dtMs) / periodMs)
  // Відбиття від меж: туди-назад, як у Desmos.
  for (let i = 0; i < 4 && (pos > r.max || pos < r.min); i++) {
    if (pos > r.max) { pos = r.max - (pos - r.max); dir = -1 }
    if (pos < r.min) { pos = r.min + (r.min - pos); dir = 1 }
  }
  pos = Math.min(r.max, Math.max(r.min, pos))
  return { pos, dir, value: snapToStep(pos, r) }
}

export interface ParamPlayerDeps {
  /** Поточні межі й значення параметра; null — параметра більше немає. */
  read(name: string): (PlayRange & { value: number }) | null
  /** Кадр руху — штатний шлях повзунка (у рендерері `calc.setParamValue`). */
  setValue(name: string, value: number): void
  /** Відправити останнє значення одразу (у рендерері `flushParam`). */
  flush(): void
  /** Список параметрів, що біжать, змінився (для кнопок ▶/⏸). */
  onPlayingChange(names: string[]): void
  now(): number
  requestFrame(cb: (t: number) => void): number
  cancelFrame(id: number): void
}

export interface ParamPlayer {
  toggle(name: string): void
  stop(name: string): void
  stopAll(): void
  isPlaying(name: string): boolean
}

export function createParamPlayer(deps: ParamPlayerDeps): ParamPlayer {
  const states = new Map<string, PlayState & { last: number }>()
  let frame: number | null = null
  let lastT = 0

  const announce = () => deps.onPlayingChange([...states.keys()])

  function tick(t: number): void {
    frame = null
    const dt = Math.min(PLAY_MAX_DT_MS, Math.max(0, t - lastT))
    lastT = t
    for (const [name, st] of [...states]) {
      const r = deps.read(name)
      if (!r) { stop(name); continue }
      const next = stepParamPlay(st, r, dt)
      st.pos = next.pos
      st.dir = next.dir
      if (next.value !== st.last) {
        st.last = next.value
        deps.setValue(name, next.value)
      }
    }
    if (states.size > 0) frame = deps.requestFrame(tick)
  }

  function start(name: string): void {
    const r = deps.read(name)
    if (!r) return
    states.set(name, { pos: r.value, dir: r.value >= r.max ? -1 : 1, last: r.value })
    announce()
    if (frame == null) {
      lastT = deps.now()
      frame = deps.requestFrame(tick)
    }
  }

  function stop(name: string): void {
    if (!states.delete(name)) return
    if (states.size === 0 && frame != null) {
      deps.cancelFrame(frame)
      frame = null
    }
    deps.flush()
    announce()
  }

  return {
    toggle: (name) => (states.has(name) ? stop(name) : start(name)),
    stop,
    stopAll: () => { for (const name of [...states.keys()]) stop(name) },
    isPlaying: (name) => states.has(name),
  }
}

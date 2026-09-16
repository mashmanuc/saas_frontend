/**
 * V-D3 · машина станів і конверт сцени капсули накладання — чисто, без Vue.
 *
 * Конверт (`SceneEnvelope`) — контракт V-D2 §3.2. У V-D3 він живе ЛИШЕ в пам'яті
 * контролера: у `Geometry2DV2Data` для нього законного місця немає, а `toggles` —
 * не місце для іменованого стану. Тому reload/replay прогноз і стан НЕ відновлюють;
 * результат не replay-ready (ТЗ §3.2).
 */
import { landingVertex, type SourceId, type TargetId } from './trianglesOverlayGeometry'

export const VISUAL_ID = 'visual.triangles.congruence.overlay' as const
export const VERSION = 1 as const

export const STATES = ['separated', 'predicting', 'overlaying', 'matched', 'correspondence'] as const
export type SceneState = (typeof STATES)[number]
export type SceneMode = 'full' | 'recall'
export type Prediction = 'D' | 'E' | null

export interface SceneEnvelope {
  visual_id: typeof VISUAL_ID
  version: typeof VERSION
  state: SceneState
  mode: SceneMode
  lock: string[]
  marks: Record<string, unknown>
  prediction: Prediction
}

/** Пари вершин і сторін, які сцена мусить показати в кінці (§8.1 dossier). */
export const CORRESPONDENCE: ReadonlyArray<readonly [SourceId, TargetId]> = Object.freeze([
  ['A', 'E'],
  ['B', 'D'],
  ['C', 'F'],
] as const)
export const SIDE_PAIR = Object.freeze({ source: 'BC', target: 'DF', length_cm: 7 } as const)
/** Скільки кроків розкриття в `correspondence`: три пари вершин і пара сторін. */
export const REVEAL_STEPS = CORRESPONDENCE.length + 1

export class SceneContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SceneContractError'
  }
}

export function assertState(state: unknown): asserts state is SceneState {
  if (!(STATES as readonly unknown[]).includes(state)) {
    throw new SceneContractError(`невідомий стан сцени «${String(state)}»; дозволені: ${STATES.join(', ')}`)
  }
}

function assertMode(mode: unknown): asserts mode is SceneMode {
  if (mode !== 'full' && mode !== 'recall') {
    throw new SceneContractError(`невідомий режим «${String(mode)}»`)
  }
}

export function createEnvelope(mode: SceneMode): SceneEnvelope {
  assertMode(mode)
  return {
    visual_id: VISUAL_ID,
    version: VERSION,
    state: 'separated',
    mode,
    // Фігури під час сцени не тягаються: доказ не можна зіпсувати випадковим дотиком.
    lock: ['A', 'B', 'C', 'D', 'E', 'F'],
    marks: {},
    prediction: null,
  }
}

export function nextState(state: SceneState): SceneState | null {
  assertState(state)
  const i = STATES.indexOf(state)
  return i + 1 < STATES.length ? STATES[i + 1] : null
}

/** Позначки, які ВИВОДЯТЬСЯ зі стану й геометрії, а не задаються ззовні. */
export function marksFor(state: SceneState, prediction: Prediction, revealed = 0): Record<string, unknown> {
  assertState(state)
  if (state === 'separated' || state === 'predicting' || state === 'overlaying') return {}
  const landed = landingVertex('B')
  const verdict = {
    b_lands_on: landed,
    prediction,
    prediction_refuted: prediction !== null && prediction !== landed,
    prediction_confirmed: prediction === landed,
  }
  if (state === 'matched') return verdict
  const pairs = CORRESPONDENCE.map(([s]) => [s, landingVertex(s)] as const)
  return {
    ...verdict,
    pairs,
    side: { ...SIDE_PAIR },
    revealed: Math.max(0, Math.min(REVEAL_STEPS, revealed)),
  }
}

/** Перехід лише вперед на один стан; стрибок чи назад — порушення контракту. */
export function advance(env: SceneEnvelope, revealed = 0): SceneEnvelope {
  const next = nextState(env.state)
  if (next === null) throw new SceneContractError('сцена вже в останньому стані')
  return { ...env, state: next, marks: marksFor(next, env.prediction, revealed) }
}

export function withPrediction(env: SceneEnvelope, prediction: Prediction): SceneEnvelope {
  if (env.state !== 'predicting') {
    throw new SceneContractError(`прогноз фіксується лише в стані predicting, зараз «${env.state}»`)
  }
  if (prediction !== 'D' && prediction !== 'E') {
    throw new SceneContractError(`прогноз — D або E, отримано «${String(prediction)}»`)
  }
  return { ...env, prediction }
}

export function withReveal(env: SceneEnvelope, revealed: number): SceneEnvelope {
  if (env.state !== 'correspondence') {
    throw new SceneContractError('розкриття пар можливе лише в стані correspondence')
  }
  return { ...env, marks: marksFor('correspondence', env.prediction, revealed) }
}

/**
 * Скільки пунктів відповідності підсвічено на рисунку: 0 поза `correspondence`, інакше
 * `marks.revealed` (1 — A↔E … 4 — BC↔DF). Виводиться лише з конверта.
 */
export function highlightLevel(env: SceneEnvelope): number {
  if (env.state !== 'correspondence') return 0
  const revealed = (env.marks as { revealed?: unknown }).revealed
  if (typeof revealed !== 'number' || !Number.isInteger(revealed) || revealed < 1 || revealed > REVEAL_STEPS) {
    throw new SceneContractError(`correspondence без коректного revealed: ${String(revealed)}`)
  }
  return revealed
}

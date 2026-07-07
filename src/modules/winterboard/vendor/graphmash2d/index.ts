/**
 * GraphMASH 2D vendor loader (B2 — live 2D graph на дошці).
 *
 * ⚠️ ISOLATED NAMESPACE: `window.GraphCalculator` вже ЗАЙНЯТИЙ board-двигуном
 * `graph_calculator` (inv-21). Тому вендор-копії пропатчено на `window.__GM2D`
 * (+ `window.__GM2D_Fractal`) — жодних конфліктних глобалів (див. export-рядки
 * grapher-engine.js). Патч = механічний rename, не зміна логіки; при оновленні
 * з воронки — повторити rename (grep `window.__GM2D`).
 *
 * Порядок: fractal ПЕРШИЙ (engine посилається на __GM2D_Fractal для фракталів).
 * Движок самодостатній (0 CDN; MathQuill лише для UI-вводу воронки, не рендеру —
 * addExpression приймає текстовий src). Джерело: public/mash/grapher/.
 */
import './fractal-renderer.js'
import './grapher-engine.js'

/* ─── global types ───────────────────────────────────────────────────────── */

/** Один вираз/об'єкт у калькуляторі (спрощено — те, що потрібно board-рендереру). */
export interface GraphExpr {
  id: number
  src: string
  color: string
  hidden: boolean
  isTable?: boolean
}

export interface GraphViewport {
  cx: number
  cy: number
  scale: number
}

export interface GraphCalculatorInstance {
  expressions: GraphExpr[]
  params: Record<string, number>
  viewport: GraphViewport
  addExpression(src: string): GraphExpr
  addTable(table: unknown): GraphExpr
  removeExpression(id: number): void
  setColor(id: number, color: string): void
  setHidden(id: number, hidden: boolean): void
  setTRange(id: number, min: number, max: number): void
  setRegression(id: number, reg: unknown): void
  setParam?(name: string, value: number): void
  batch(fn: () => void): void
  onChange?: ((event: unknown) => void) | null
  destroy?(): void
}

export interface GM2DNamespace {
  GraphCalculator: new (
    container: HTMLElement,
    opts?: Record<string, unknown>,
  ) => GraphCalculatorInstance
  GraphCalc: {
    setAngleMode(mode: string): void
    getAngleMode(): string
    [k: string]: unknown
  }
  EventEmitter: unknown
}

declare global {
  interface Window {
    /** Ізольований namespace GraphMASH-2D движка (НЕ конфліктує з board graph_calculator). */
    __GM2D?: GM2DNamespace
    __GM2D_Fractal?: unknown
  }
}

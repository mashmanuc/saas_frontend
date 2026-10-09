/**
 * Порядок написів «як пише вчитель» (прототип: `reading_order` у render_clip.py).
 *
 * Рамки — за СПРАВЖНІМИ пікселями нової крейди (розширені на 10 px рамки злипали сусідні рядки).
 *  - Дріб — стовпчик: написи один над одним (перекриття по ширині ≥ 50 % вужчого, зазор ≤ 12 px) — згори вниз.
 *  - Стовпчики й написи — рядками (перекриття по висоті ≥ 30 % меншої), рядки згори вниз, у рядку зліва направо.
 */
import type { Box } from './raster'

export interface OrderItem { id: number; box: Box }

const STACK_X_OVERLAP = 0.5
const STACK_GAP_PX = 12
const ROW_Y_OVERLAP = 0.3

export function readingOrder(items: OrderItem[]): number[] {
  const n = items.length
  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i] }
    return i
  }
  for (let i = 0; i < n; i++) {
    const a = items[i].box
    for (let j = i + 1; j < n; j++) {
      const b = items[j].box
      const xov = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const gap = Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom)
      if (xov >= STACK_X_OVERLAP * Math.min(a.right - a.left, b.right - b.left) && gap <= STACK_GAP_PX) {
        parent[find(i)] = find(j)
      }
    }
  }
  const groups = new Map<number, OrderItem[]>()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    const g = groups.get(r)
    if (g) g.push(items[i]); else groups.set(r, [items[i]])
  }
  const gbox = (g: OrderItem[]): Box => ({
    top: Math.min(...g.map((o) => o.box.top)),
    bottom: Math.max(...g.map((o) => o.box.bottom)),
    left: Math.min(...g.map((o) => o.box.left)),
    right: Math.max(...g.map((o) => o.box.right)),
  })
  const gs = [...groups.values()].map((g) => ({ g, b: gbox(g) })).sort((p, q) => p.b.top - q.b.top)
  const rows: { g: OrderItem[]; b: Box }[][] = []
  let cur: { g: OrderItem[]; b: Box }[] = []
  let rtop = 0
  let rbot = 0
  for (const item of gs) {
    const { top, bottom } = item.b
    if (cur.length && Math.min(bottom, rbot) - Math.max(top, rtop) < ROW_Y_OVERLAP * Math.min(bottom - top, rbot - rtop)) {
      rows.push(cur)
      cur = []
    }
    if (!cur.length) { rtop = top; rbot = bottom } else { rtop = Math.min(rtop, top); rbot = Math.max(rbot, bottom) }
    cur.push(item)
  }
  if (cur.length) rows.push(cur)
  const out: number[] = []
  for (const row of rows) {
    for (const { g } of [...row].sort((p, q) => p.b.left - q.b.left)) {
      for (const o of [...g].sort((p, q) => p.box.top - q.box.top)) out.push(o.id)
    }
  }
  return out
}

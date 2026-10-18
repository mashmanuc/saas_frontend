/** INV-25.13: чисте обмежене компонування, не новий шлях запису. */
import type { WBAsset, WBPage } from '../../types/winterboard'
import { assetsEqualByOpsFields } from './assetEquality'
import { isAutoFitOnlyUpdate } from './autoFitHistory'

export interface GeneratedFlow {
  version: 1; groupId: string; members: string[]; row: number
  top: number; gap: number; rowLimit: number
  x: number; y: number; w: number; h: number; rotation: number
}
const dataOf = (a: WBAsset): Record<string, unknown> => (a.data ?? {}) as unknown as Record<string, unknown>
export function flowOf(a: WBAsset): GeneratedFlow | null {
  const f = dataOf(a).generatedFlow as GeneratedFlow | undefined
  if (a.type !== 'nmt_task' || !f || f.version !== 1 || typeof f.groupId !== 'string'
      || !Array.isArray(f.members) || f.members.length < 1 || f.members.length > 5
      || f.members.some(id => typeof id !== 'string') || new Set(f.members).size !== f.members.length
      || !f.members.includes(a.id) || !Number.isInteger(f.row) || f.row < 0 || f.row >= 5
      || ![f.top,f.gap,f.rowLimit,f.x,f.y,f.w,f.h,f.rotation].every(Number.isFinite)
      || f.top < 0 || f.gap !== 20 || f.rowLimit !== 2000 || f.w <= 0 || f.h <= 0) return null
  return f
}

/** Будь-яке ручне втручання зупиняє весь потік, не виправляється нишком. */
export function managedFlow(page: WBPage, asset: WBAsset): GeneratedFlow | null {
  const f = flowOf(asset)
  if (!f) return null
  const rows = new Set<number>()
  for (const id of f.members) {
    const a = page.assets.find(item => item.id === id)
    const m = a && flowOf(a)
    if (!a || !m || a.locked || a.minimized || m.groupId !== f.groupId
        || JSON.stringify(m.members) !== JSON.stringify(f.members)
        || m.top !== f.top || m.gap !== f.gap || m.rowLimit !== f.rowLimit
        || a.x !== m.x || a.y !== m.y || a.w !== m.w || (a.rotation ?? 0) !== m.rotation
        || (a.h !== m.h && a.h !== dataOf(a).autoFitH)) return null
    rows.add(m.row)
  }
  if (Array.from(rows).sort((a,b)=>a-b).some((row,i)=>row!==i)) return null
  const required = f.top + rows.size * f.rowLimit + (rows.size - 1) * f.gap + 60
  return (page.height ?? 1080) >= required ? f : null
}

export function reflowGenerated(page: WBPage, source: WBAsset, next: WBAsset): WBAsset[] | null {
  const f = managedFlow(page, source)
  if (!f || !isAutoFitOnlyUpdate(source, next)) return null
  const items = page.assets.map(a => a.id === next.id ? next : a)
  const rowHeights = new Map<number,number>()
  for (const a of items) {
    if (!f.members.includes(a.id)) continue
    const m = flowOf(a)!
    if (a.h > f.rowLimit) return null
    rowHeights.set(m.row, Math.max(rowHeights.get(m.row) ?? 0, a.h))
  }
  const ys: number[] = [f.top]
  for (let i=1;i<rowHeights.size;i++) ys[i]=ys[i-1]+rowHeights.get(i-1)!+f.gap
  return items.map(a => {
    if (!f.members.includes(a.id)) return a
    const m = flowOf(a)!
    const y = ys[m.row]
    return { ...a, y, data: { ...dataOf(a), generatedFlow: { ...m, y, h: a.h } } as unknown as WBAsset['data'] }
  })
}

/** У Replay не рухаємо рядів навіть локально: межа — записаний наступний ряд. */
export function generatedFitPageH(page: WBPage, asset: WBAsset, canWrite: boolean): number | null {
  const f=managedFlow(page,asset)
  if (!f) return null
  if (canWrite) return asset.y+f.rowLimit
  const below=page.assets.filter(a=>f.members.includes(a.id) && flowOf(a)!.row>f.row)
  return Math.min(asset.y+f.rowLimit, page.height ?? 1080,
    ...below.map(a=>a.y-f.gap))
}

/** RAF сусідньої картки міг ще не знати нового похідного y. Лише чистий fit. */
export function rebaseFlowFit(before: WBAsset, current: WBAsset, next: WBAsset): WBAsset {
  if (!flowOf(before) || !flowOf(current) || !isAutoFitOnlyUpdate(before,next)) return next
  const strip = (a: WBAsset): WBAsset => {
    const data = { ...dataOf(a) }; delete data.autoFitH; delete data.generatedFlow
    return { ...a, y:0, h:0, data: data as unknown as WBAsset['data'] }
  }
  if (!assetsEqualByOpsFields(strip(before),strip(current))) return current
  return { ...current, h:next.h, data:{ ...dataOf(current), autoFitH:next.h } as unknown as WBAsset['data'] }
}

/** Undo вмісту не повертає старі автоматичні координати/висоту. */
export function flowContentSnapshot(current: WBAsset, before: WBAsset, after: WBAsset, target: WBAsset): WBAsset {
  if (!flowOf(before) || !flowOf(after) || !flowOf(current)
      || !assetsEqualByOpsFields(before,{...after,data:before.data})) return target
  const data = { ...dataOf(current) }, b=dataOf(before), a=dataOf(after), t=dataOf(target)
  for (const key of new Set([...Object.keys(b),...Object.keys(a)])) {
    if (key==='generatedFlow' || key==='autoFitH' || JSON.stringify(b[key])===JSON.stringify(a[key])) continue
    if (Object.prototype.hasOwnProperty.call(t,key)) data[key]=t[key]; else delete data[key]
  }
  return { ...current, data:data as unknown as WBAsset['data'] }
}

/**
 * Растрові операції рушія «Дзеркала уроку» — чисті функції над масивами (тести без браузера).
 * Перенесено з прототипу `saas_docs/domains/winterboard/prototypes/lesson_mirror_engine/render_clip.py`:
 *  - гаусове розмиття — трьома прямокутними (так у сотні разів швидше за точне ядро σ=10, різниця для
 *    порогу крейди несуттєва);
 *  - розширення маски — ромб (відстань L1), як `scipy.ndimage.binary_dilation(iterations=k)` з хрестом;
 *  - зв'язні плями — 8 сусідів, як `ndi.label(structure=ones((3,3)))`.
 */

/** Сірий кадр (0…255) із RGBA. */
export function toGray(rgba: Uint8ClampedArray | Uint8Array, n: number): Float32Array {
  const g = new Float32Array(n)
  for (let i = 0, j = 0; i < n; i++, j += 4) g[i] = rgba[j] * 0.299 + rgba[j + 1] * 0.587 + rgba[j + 2] * 0.114
  return g
}

/** Радіуси трьох прямокутних розмиттів, що разом наближають гаус σ (Kovesi). */
export function boxRadiiForGauss(sigma: number, passes = 3): number[] {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / passes + 1)
  let wl = Math.floor(wIdeal)
  if (wl % 2 === 0) wl--
  const wu = wl + 2
  const mIdeal = (12 * sigma * sigma - passes * wl * wl - 4 * passes * wl - 3 * passes) / (-4 * wl - 4)
  const m = Math.round(mIdeal)
  return Array.from({ length: passes }, (_, i) => ((i < m ? wl : wu) - 1) / 2)
}

/** Прямокутне розмиття одного проходу по рядках (src → dst), краї — віддзеркалення найближчого. */
function boxH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const k = 1 / (2 * r + 1)
  for (let y = 0; y < h; y++) {
    const o = y * w
    let acc = 0
    for (let x = -r; x <= r; x++) acc += src[o + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      dst[o + x] = acc * k
      const add = Math.min(w - 1, x + r + 1)
      const sub = Math.max(0, x - r)
      acc += src[o + add] - src[o + sub]
    }
  }
}

function boxV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const k = 1 / (2 * r + 1)
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += src[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = acc * k
      const add = Math.min(h - 1, y + r + 1)
      const sub = Math.max(0, y - r)
      acc += src[add * w + x] - src[sub * w + x]
    }
  }
}

/** Наближене гаусове розмиття (нова копія). */
export function gaussBlur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  let a = Float32Array.from(src)
  let b = new Float32Array(src.length)
  for (const r of boxRadiiForGauss(sigma)) {
    if (r < 1) continue
    boxH(a, b, w, h, r)
    boxV(b, a, w, h, r)
  }
  b = a
  return b
}

/** Відстань L1 до найближчої одиниці маски (двопрохідна); 0 — сама маска. */
export function distanceL1(mask: Uint8Array, w: number, h: number): Uint16Array {
  const INF = 0xffff
  const d = new Uint16Array(w * h)
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? 0 : INF
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      let v = d[i]
      if (x > 0 && d[i - 1] + 1 < v) v = d[i - 1] + 1
      if (y > 0 && d[i - w] + 1 < v) v = d[i - w] + 1
      d[i] = v
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x
      let v = d[i]
      if (x < w - 1 && d[i + 1] + 1 < v) v = d[i + 1] + 1
      if (y < h - 1 && d[i + w] + 1 < v) v = d[i + w] + 1
      d[i] = v
    }
  }
  return d
}

/** Розширення маски ромбом радіуса r (= `binary_dilation(iterations=r)` із хрестом). */
export function dilate(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  if (r <= 0) return Uint8Array.from(mask)
  const d = distanceL1(mask, w, h)
  const out = new Uint8Array(mask.length)
  for (let i = 0; i < out.length; i++) out[i] = d[i] <= r ? 1 : 0
  return out
}

export interface Box { top: number; bottom: number; left: number; right: number }

/**
 * Зв'язні плями (8 сусідів). Повертає мітки (0 — фон, 1…n) і кількість.
 * Обхід стеком — без рекурсії, щоб велика пляма не переповнила стек.
 */
export function label8(mask: Uint8Array, w: number, h: number): { labels: Int32Array; count: number } {
  const labels = new Int32Array(mask.length)
  const stack = new Int32Array(mask.length)
  let count = 0
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start]) continue
    count++
    let sp = 0
    stack[sp++] = start
    labels[start] = count
    while (sp) {
      const i = stack[--sp]
      const x = i % w
      const y = (i - x) / w
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= w || (dx === 0 && dy === 0)) continue
          const j = yy * w + xx
          if (mask[j] && !labels[j]) { labels[j] = count; stack[sp++] = j }
        }
      }
    }
  }
  return { labels, count }
}

/** Прибрати плями, менші за minArea (нова маска). */
export function dropSmall(mask: Uint8Array, w: number, h: number, minArea: number): Uint8Array {
  const { labels, count } = label8(mask, w, h)
  if (!count) return Uint8Array.from(mask)
  const area = new Int32Array(count + 1)
  for (let i = 0; i < labels.length; i++) if (labels[i]) area[labels[i]]++
  const out = new Uint8Array(mask.length)
  for (let i = 0; i < labels.length; i++) if (labels[i] && area[labels[i]] >= minArea) out[i] = 1
  return out
}

/** Рамки плям за мітками (індекс = мітка; [0] не використовується). Порожня мітка — null. */
export function boxesOf(labels: Int32Array, count: number, w: number, only?: Uint8Array): (Box | null)[] {
  const boxes: (Box | null)[] = new Array(count + 1).fill(null)
  for (let i = 0; i < labels.length; i++) {
    const k = labels[i]
    if (!k || (only && !only[i])) continue
    const x = i % w
    const y = (i - x) / w
    const b = boxes[k]
    if (!b) boxes[k] = { top: y, bottom: y + 1, left: x, right: x + 1 }
    else {
      if (y < b.top) b.top = y
      if (y + 1 > b.bottom) b.bottom = y + 1
      if (x < b.left) b.left = x
      if (x + 1 > b.right) b.right = x + 1
    }
  }
  return boxes
}

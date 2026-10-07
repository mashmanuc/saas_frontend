/**
 * Б-166 (власник 2026-10-07): «Копіювати зображення» браузера по картинці на дошці копіювало
 * прозорий верхній шар Konva — вставка давала рамку без картинки. На `contextmenu` над
 * картинкою під курсор кладеться невидимий клон її `<img>`: меню браузера й «Копіювати
 * зображення» беруть оригінал. Модуль — board/imageContextMenuProxy.ts; обв'язка в WBCanvas —
 * сторожем по джерелу (полотно в тестах не монтується).
 */
import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import {
  IMAGE_PROXY_ATTR,
  IMAGE_PROXY_MOVE_GRACE_MS,
  attachImageContextMenuProxy,
  topImageAssetAt,
} from '../board/imageContextMenuProxy'
import type { WBAsset } from '../types/winterboard'

const asset = (over: Partial<WBAsset>): WBAsset =>
  ({ id: 'a', type: 'image', src: '/media/a.png', x: 0, y: 0, w: 100, h: 50, rotation: 0, ...over }) as WBAsset

describe('topImageAssetAt — картинка під точкою аркуша', () => {
  it('точка всередині — картинка; поза — нічого', () => {
    const img = asset({ x: 10, y: 20 })
    expect(topImageAssetAt([img], 60, 40)).toBe(img)
    expect(topImageAssetAt([img], 5, 40)).toBeNull()
  })

  it('поворот — навколо центру, як малює дошка', () => {
    // 100×50 з центром (50,25), повернута на 90°: займає x 25..75, y −25..75.
    const img = asset({ rotation: 90 })
    expect(topImageAssetAt([img], 50, -20)).toBe(img)   // лише в повернутій
    expect(topImageAssetAt([img], 95, 25)).toBeNull()   // лише в неповернутій
  })

  it('верхній за шарами вирішує: інший об’єкт поверх картинки її закриває', () => {
    const below = asset({ id: 'below' })
    const above = asset({ id: 'above', x: 20 })
    const note = asset({ id: 'note', type: 'sticky_note' as WBAsset['type'], x: 40, y: 0, w: 20, h: 20 })
    expect(topImageAssetAt([below, above], 30, 10)?.id).toBe('above')
    expect(topImageAssetAt([below, note], 45, 10)).toBeNull()
    expect(topImageAssetAt([below, note], 10, 40)?.id).toBe('below')
  })

  it('нульовий розмір пропускається', () => {
    expect(topImageAssetAt([asset({ w: 0 })], 0, 0)).toBeNull()
  })
})

describe('attachImageContextMenuProxy — невидима картинка під правим кліком', () => {
  let detach: (() => void) | null = null
  afterEach(() => {
    detach?.()
    detach = null
    document.body.innerHTML = ''
  })

  function loadedImage(src = 'https://cdn.example/a.png'): HTMLImageElement {
    const img = document.createElement('img')
    img.src = src
    img.crossOrigin = 'anonymous'
    Object.defineProperty(img, 'complete', { value: true })
    Object.defineProperty(img, 'naturalWidth', { value: 640 })
    return img
  }

  function setup(source: HTMLImageElement | null) {
    const container = document.createElement('div')
    document.body.appendChild(container)
    let t = 1000
    detach = attachImageContextMenuProxy(container, () => source, { now: () => t })
    return { container, advance: (ms: number) => { t += ms } }
  }

  const proxy = () => document.querySelector<HTMLImageElement>(`img[${IMAGE_PROXY_ATTR}]`)
  const rightClick = (el: Element, init: Record<string, unknown> = {}) =>
    el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 300, clientY: 200, ...init }))

  it('мишею над картинкою — під курсором невидимий клон тієї самої картинки', () => {
    const source = loadedImage()
    const { container } = setup(source)
    const notCancelled = rightClick(container)
    expect(notCancelled).toBe(true)              // меню браузера не скасовуємо
    const p = proxy()
    expect(p).not.toBeNull()
    expect(p!.src).toBe(source.src)
    expect(p!.crossOrigin).toBe('anonymous')
    expect(p!.style.position).toBe('fixed')
    expect(p!.style.opacity).toBe('0')
    expect(p!.style.left).toBe('296px')
    expect(p!.style.top).toBe('196px')
    expect(p!.parentElement).toBe(document.body)
  })

  it('перо й дотик — нічого не підкладаємо (не забрати відпускання штриха)', () => {
    const { container } = setup(loadedImage())
    for (const pointerType of ['pen', 'touch']) {
      const ev = new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 })
      Object.defineProperty(ev, 'pointerType', { value: pointerType })
      container.dispatchEvent(ev)
      expect(proxy(), pointerType).toBeNull()
    }
  })

  it('немає картинки під точкою або вона ще не завантажена — нічого', () => {
    setup(null)
    rightClick(document.querySelector('div')!)
    expect(proxy()).toBeNull()
    detach?.()
    document.body.innerHTML = ''
    const notLoaded = document.createElement('img')
    notLoaded.src = 'https://cdn.example/b.png'
    const { container } = setup(notLoaded)
    rightClick(container)
    expect(proxy()).toBeNull()
  })

  it('прибирається наступною дією після меню; рух одразу після кліку — ні (меню ще відкривається)', () => {
    const { container, advance } = setup(loadedImage())
    rightClick(container)
    window.dispatchEvent(new Event('pointermove'))
    expect(proxy()).not.toBeNull()
    advance(IMAGE_PROXY_MOVE_GRACE_MS + 1)
    window.dispatchEvent(new Event('pointermove'))
    expect(proxy()).toBeNull()

    for (const type of ['pointerdown', 'keydown', 'wheel']) {
      rightClick(container)
      expect(proxy(), type).not.toBeNull()
      window.dispatchEvent(new Event(type))
      expect(proxy(), type).toBeNull()
    }
  })

  it('повторний правий клік — один елемент, не купа', () => {
    const { container } = setup(loadedImage())
    rightClick(container)
    rightClick(container, { clientX: 50, clientY: 60 })
    expect(document.querySelectorAll(`img[${IMAGE_PROXY_ATTR}]`)).toHaveLength(1)
    expect(proxy()!.style.left).toBe('46px')
  })

  it('від’єднання прибирає елемент і більше не слухає', () => {
    const { container } = setup(loadedImage())
    rightClick(container)
    detach!()
    detach = null
    expect(proxy()).toBeNull()
    rightClick(container)
    expect(proxy()).toBeNull()
  })
})

describe('обв’язка в WBCanvas (сторож по джерелу)', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../components/canvas/WBCanvas.vue'), 'utf-8')

  it('приєднується при монтуванні до контейнера полотна, від’єднується при знятті', () => {
    const mountAt = src.indexOf('onMounted(async () => {')
    const attachAt = src.indexOf('attachImageContextMenuProxy(container, imageElementUnderEvent)')
    expect(attachAt).toBeGreaterThan(mountAt)
    const unmountAt = src.indexOf('onUnmounted(() => {\n  detachImageContextMenuProxy?.()')
    expect(unmountAt).toBeGreaterThan(-1)
  })

  it('картинка під подією — верхня за шарами, з уже завантажених елементів Konva', () => {
    const at = src.indexOf('function imageElementUnderEvent')
    const body = src.slice(at, src.indexOf('\n}\n', at))
    expect(body).toContain('topImageAssetAt(')
    expect(body).toContain('konvaAssets.value')
    expect(body).toContain('loadedImages.get(normalizeAssetUrl(assetEffectiveSrc(asset)))')
  })
})

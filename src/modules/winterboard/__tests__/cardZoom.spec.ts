// Обгортка карток із власним полотном на масштабі дошки (власник 2026-10-01; composables/cardZoom.ts).
// Коло, «Похідна/∫», графік — у шарі розміром із картку на ДОШЦІ, зменшеному scale(масштаб);
// масштаб змінився — рендерер просить нову роздільність. Інші картки — як були.
import { describe, it, expect, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ZOOM_SCALED_CARD_TYPES, cardZoomStyle, provideCardZoom, useCardZoom, useCardZoomRefresh } from '../composables/cardZoom'

const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf-8').replace(/\r\n/g, '\n')

describe('cardZoomStyle', () => {
  it('35 %: шар — 100/0,35 % розміру накладки, зменшений scale(0,35) від лівого верхнього кута', () => {
    expect(cardZoomStyle(0.35, false)).toEqual({
      position: 'absolute', left: '0', top: '0',
      width: `${100 / 0.35}%`, height: `${100 / 0.35}%`,
      transform: 'scale(0.35)', transformOrigin: '0 0',
    })
  })
  it.each([[1, false], [2, true], [0, false], [Number.NaN, false]])('масштаб %s, розгорнута %s — без трансформації, на всю накладку', (z, expanded) => {
    expect(cardZoomStyle(z as number, expanded as boolean)).toEqual({ position: 'absolute', left: '0', top: '0', width: '100%', height: '100%' })
  })
})

describe('useCardZoomRefresh', () => {
  it('масштаб дошки змінився — рушій перемальовує з новою роздільністю; поза дошкою — нічого', async () => {
    const zoom = ref(1)
    const refresh = vi.fn()
    const Child = defineComponent({ setup() { useCardZoomRefresh(refresh); return () => h('i') } })
    const Board = defineComponent({ setup() { provideCardZoom(zoom); return () => h(Child) } })
    mount(Board)
    zoom.value = 0.35
    await nextTick()
    expect(refresh).toHaveBeenCalledTimes(1)

    const lonely = vi.fn()
    mount(defineComponent({ setup() { useCardZoomRefresh(lonely); return () => h('i') } }))
    expect(lonely).not.toHaveBeenCalled()
  })
})

describe('useCardZoomRefresh — ПІСЛЯ оновлення DOM', () => {
  it('рушій міряє вже новий розмір картки (стенд 2026-10-01: інакше графік лишався з роздільністю 35 %)', async () => {
    const zoom = ref(1)
    const seen: string[] = []
    let el: HTMLElement | null = null
    const Child = defineComponent({
      setup() {
        const z = useCardZoom()
        useCardZoomRefresh(() => { seen.push(el?.textContent ?? '') })
        return () => h('i', { ref: (r: unknown) => { el = r as HTMLElement } }, String(z?.value))
      },
    })
    mount(defineComponent({ setup() { provideCardZoom(zoom); return () => h(Child) } }))
    zoom.value = 0.35
    await nextTick()
    expect(seen).toEqual(['0.35'])
  })
})

describe('проводка: які картки масштабуються і де', () => {
  it('рівно три типи з власним полотном', () => {
    expect([...ZOOM_SCALED_CARD_TYPES].sort()).toEqual(['calculus_card', 'graph_calculator', 'trig_circle'])
  })

  it('уніфікований шар (прод: VITE_UNIFIED_ZORDER=true) кладе лише ці типи в .wb-card-zoom', () => {
    const layer = read('components/canvas/WBOverlayLayer.vue')
    expect(layer).toContain('v-if="ZOOM_SCALED_CARD_TYPES.has(item.asset.type)"')
    expect(layer).toMatch(/class="wb-card-zoom"[\s\S]*?:style="cardZoomLayerStyle\(item\)"/)
    expect(layer).toContain('return cardZoomStyle(cardZoom?.value ?? 1, expanded)')
  })

  it('WBCanvas: дає масштаб карткам; старі блоки (відкат) теж обгорнуто; резерв шапки — у пікселях картки', () => {
    const canvas = read('components/canvas/WBCanvas.vue')
    expect(canvas).toContain('provideCardZoom(computed(() => props.zoom))')
    expect(canvas.split('<div class="wb-card-zoom" :style="cardZoomStyle(zoom, expandedAssetId === asset.id)">').length - 1).toBe(3)
    expect(canvas).toContain('ZOOM_SCALED_CARD_TYPES.has(t.type) && props.zoom > 0 ? width / props.zoom : width')
  })

  it.each([
    ['components/board/objects/TrigCircleRenderer.vue', 'trig'],
    ['components/board/objects/CalculusRenderer.vue', 'card'],
    ['components/board/objects/GraphCalculatorRenderer.vue', 'calc'],
  ])('%s просить нову роздільність при зміні масштабу', (file, inst) => {
    expect(read(file)).toContain(`useCardZoomRefresh(() => ${inst}?.refreshResolution())`)
  })
})

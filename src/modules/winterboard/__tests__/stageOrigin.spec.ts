/**
 * Б-26 (FIRST USER GATE 2026-09-23): пан / Ctrl+колесо відривали картки від аркуша.
 * Сцена зсувається лише коли відомий розмір контейнера, а картки брали
 * `canvasOffset` (= scroll). Тепер і сцена, і всі HTML-оверлеї, і перехід
 * «екран → аркуш» беруть одне значення — `stageOrigin`.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createPinia, setActivePinia } from 'pinia'
import { useWBStore } from '../board/state/boardStore'

describe('boardStore.stageOrigin', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('розмір контейнера невідомий — сцена в (0,0), і scroll її не зсуває', () => {
    const store = useWBStore()
    store.setScroll(-150, -100)
    expect(store.stageOrigin).toEqual({ x: 0, y: 0 })
  })

  it('розмір контейнера відомий, пан не ввімкнено — лише центрування, scroll не рухає', () => {
    const store = useWBStore()
    store.setContainerSize(3000, 2000)
    store.setScroll(10, 20)
    // сторінка 1920×1080 при zoom 1: (3000−1920)/2 = 540, (2000−1080)/2 = 460
    expect(store.stageOrigin).toEqual({ x: 540, y: 460 })
  })

  it('пан увімкнено (WBSoloRoom) — сцена зсувається на −scroll, як scrollLeft', () => {
    const store = useWBStore()
    store.setStageFollowsScroll(true)
    store.setScroll(150, 100)
    expect(store.stageOrigin).toEqual({ x: -150, y: -100 })
  })
})

describe('Б-26: ніхто, крім стора, не читає canvasOffset', () => {
  const root = resolve(__dirname, '..')
  const files = [
    'components/canvas/WBCanvas.vue',
    'components/canvas/SelectionQuickActions.vue',
    'views/WBSoloRoom.vue',
  ]
  for (const f of files) {
    it(f, () => {
      const src = readFileSync(resolve(root, f), 'utf-8')
      expect(src).not.toMatch(/(?:wbStore|store)\.canvasOffset/)
    })
  }

  it('stageConfig бере позицію сцени зі stageOrigin', () => {
    const src = readFileSync(resolve(root, 'components/canvas/WBCanvas.vue'), 'utf-8').replace(/\r\n/g, '\n')
    const block = src.slice(src.indexOf('const stageConfig = computed'), src.indexOf('const backgroundConfig'))
    expect(block).toContain('const origin = wbStore.stageOrigin')
    expect(block).toContain('x: origin.x')
    expect(block).toContain('y: origin.y')
  })
})

describe('Пан рухає аркуш: WBCanvas враховує позицію сцени', () => {
  const src = readFileSync(resolve(__dirname, '../components/canvas/WBCanvas.vue'), 'utf-8').replace(/\r\n/g, '\n')

  it('точка під пером — мінус позиція сцени (інакше після пану штрих лягає не під перо)', () => {
    expect(src).toContain('x: (pos.x - stage.x()) / props.zoom')
    expect(src).toContain('y: (pos.y - stage.y()) / props.zoom')
  })

  it('HTML-шари з `x × zoom` зсуваються разом зі сценою', () => {
    const rule = src.slice(src.indexOf('.wb-preview-canvas,'), src.indexOf('.wb-canvas {'))
    for (const cls of ['.wb-preview-canvas', '.wb-text-edit-overlay', '.wb-sticky-edit-overlay',
      '.wb-media-overlay', '.wb-laser-trail-dot', '.wb-laser-dot']) {
      expect(rule).toContain(cls)
    }
    expect(rule).toContain('translate: var(--wb-stage-ox, 0px) var(--wb-stage-oy, 0px)')
  })

  it('пан стартує з поточного scroll, а не з 0', () => {
    expect(src).toContain('panScrollStartX = currentScrollX()')
  })
})

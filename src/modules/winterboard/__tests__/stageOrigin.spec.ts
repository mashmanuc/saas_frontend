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

  it('розмір контейнера відомий — той самий зсув, що canvasOffset (центр + scroll)', () => {
    const store = useWBStore()
    store.setContainerSize(3000, 2000)
    store.setScroll(10, 20)
    expect(store.stageOrigin).toEqual(store.canvasOffset)
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

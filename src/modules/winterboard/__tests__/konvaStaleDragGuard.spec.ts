// Б-195 «обʼєкт прилипає»: перетягування, що пережило загублене «кнопку відпущено», ставиться на першому
// ж русі БЕЗ кнопки або при втраті фокуса; звичайне перетягування (кнопка натиснута) не зачіпається.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { installKonvaStaleDragGuard, stopStaleDrags, type KonvaLike } from '../board/konvaStaleDragGuard'

function fakeKonva(draggingCount = 1) {
  const nodes = Array.from({ length: draggingCount }, () => {
    const node = {
      dragging: true,
      isDragging: () => node.dragging,
      stopDrag: vi.fn(() => { node.dragging = false }),
    }
    return node
  })
  const konva: KonvaLike = {
    DD: { get isDragging() { return nodes.some(n => n.dragging) } },
    stages: [{ find: (fn: (n: (typeof nodes)[number]) => boolean) => nodes.filter(fn) }] as KonvaLike['stages'],
  }
  return { konva, nodes }
}

let detach: (() => void) | null = null
afterEach(() => { detach?.(); detach = null })

describe('konvaStaleDragGuard (Б-195)', () => {
  it('рух без натиснутої кнопки ставить обʼєкт, який Konva ще тягне', () => {
    const { konva, nodes } = fakeKonva()
    detach = installKonvaStaleDragGuard(konva)
    document.body.dispatchEvent(new MouseEvent('mousemove', { buttons: 0, bubbles: true }))
    expect(nodes[0].stopDrag).toHaveBeenCalledTimes(1)
    expect(konva.DD.isDragging).toBe(false)
  })

  it('звичайне перетягування — кнопка натиснута — не зачіпається', () => {
    const { konva, nodes } = fakeKonva()
    detach = installKonvaStaleDragGuard(konva)
    document.body.dispatchEvent(new MouseEvent('mousemove', { buttons: 1, bubbles: true }))
    expect(nodes[0].stopDrag).not.toHaveBeenCalled()
    expect(konva.DD.isDragging).toBe(true)
  })

  it('втрата фокуса вікна теж ставить обʼєкт', () => {
    const { konva, nodes } = fakeKonva(2)
    detach = installKonvaStaleDragGuard(konva)
    window.dispatchEvent(new Event('blur'))
    expect(nodes.every(n => n.stopDrag.mock.calls.length === 1)).toBe(true)
  })

  it('без перетягування нічого не робить; після відключення не слухає', () => {
    const { konva, nodes } = fakeKonva()
    nodes[0].dragging = false
    expect(stopStaleDrags(konva)).toBe(0)
    nodes[0].dragging = true
    detach = installKonvaStaleDragGuard(konva)
    detach()
    detach = null
    document.body.dispatchEvent(new MouseEvent('mousemove', { buttons: 0, bubbles: true }))
    expect(nodes[0].stopDrag).not.toHaveBeenCalled()
  })
})

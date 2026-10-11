/**
 * `useDraggableFab` — перетягування фігурки Інтегралика на лендінгу /start (ТЗ TZ_START_INTEGRALYK_HINTS_2026-10-11
 * §7). Логіку повторено з кнопки Інтегралика на дошці (`CommandPalette.vue`; дошку на composable не переведено —
 * див. шапку composable). Тести фіксують поведінку самого composable з типовими налаштуваннями (ті самі, що в
 * кнопки на дошці): поріг 5 px, відступ 4 px від краю, запис `{x, y}`, гасіння кліку після перетягування.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDraggableFab } from '../useDraggableFab'

const KEY = 'test:fab-pos'

function rect(left: number, top: number, size = 64) {
  return { left, top, width: size, height: size, right: left + size, bottom: top + size, x: left, y: top, toJSON: () => ({}) }
}

function pointer(clientX: number, clientY: number, opts: { button?: number; pointerType?: string; at?: ReturnType<typeof rect> } = {}) {
  const target = { getBoundingClientRect: () => opts.at ?? rect(100, 100), setPointerCapture: vi.fn() }
  return {
    clientX, clientY, pointerId: 1, button: opts.button ?? 0, pointerType: opts.pointerType ?? 'mouse', currentTarget: target,
  } as unknown as PointerEvent
}

/** Типові налаштування (поріг і відступ не задано) + розмір 64. */
function makeFab() {
  return useDraggableFab({ storageKey: KEY, size: 64 })
}

beforeEach(() => {
  localStorage.clear()
  Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true, writable: true })
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true, writable: true })
})

describe('useDraggableFab — типові налаштування (як у кнопки на дошці)', () => {
  it('без перетягування — типове місце з CSS (порожній стиль)', () => {
    expect(makeFab().style.value).toEqual({})
  })

  it('рух менше 5 px — це клік, не перетягування', () => {
    const fab = makeFab()
    fab.onPointerDown(pointer(120, 120))
    fab.onPointerMove(pointer(123, 123)) // ~4,2 px
    fab.onPointerUp()
    expect(fab.pos.value).toBeNull()
    expect(fab.consumeDragClick()).toBe(false)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('рух від 5 px — перетягування: позиція = старт + зсув, стиль left/top/right:auto, запис у localStorage', () => {
    const fab = makeFab()
    fab.onPointerDown(pointer(120, 120))
    fab.onPointerMove(pointer(124, 123)) // рівно 5 px
    expect(fab.dragging.value).toBe(true)
    fab.onPointerMove(pointer(220, 320))
    expect(fab.pos.value).toEqual({ x: 200, y: 300 })
    expect(fab.style.value).toEqual({ left: '200px', top: '300px', right: 'auto' })
    fab.onPointerUp()
    expect(fab.dragging.value).toBe(false)
    expect(JSON.parse(localStorage.getItem(KEY) || 'null')).toEqual({ x: 200, y: 300 })
  })

  it('додатковий стиль для переставленої фігурки (лендінг: bottom:auto)', () => {
    const fab = useDraggableFab({ storageKey: KEY, size: 64, positionedStyle: { bottom: 'auto' } })
    fab.onPointerDown(pointer(120, 120))
    fab.onPointerMove(pointer(220, 320))
    expect(fab.style.value).toEqual({ left: '200px', top: '300px', right: 'auto', bottom: 'auto' })
  })

  it('після перетягування перший click гаситься, наступний — ні', () => {
    const fab = makeFab()
    fab.onPointerDown(pointer(120, 120))
    fab.onPointerMove(pointer(200, 200))
    fab.onPointerUp()
    expect(fab.consumeDragClick()).toBe(true)
    expect(fab.consumeDragClick()).toBe(false)
  })

  it('межі екрана: відступ 4 px, з урахуванням розміру', () => {
    const fab = makeFab()
    fab.onPointerDown(pointer(120, 120))
    fab.onPointerMove(pointer(-5000, -5000))
    expect(fab.pos.value).toEqual({ x: 4, y: 4 })
    fab.onPointerMove(pointer(5000, 5000))
    expect(fab.pos.value).toEqual({ x: 1280 - 64 - 4, y: 800 - 64 - 4 })
  })

  it('права кнопка миші не тягне; перо й палець — тягнуть', () => {
    const fab = makeFab()
    fab.onPointerDown(pointer(120, 120, { button: 2 }))
    fab.onPointerMove(pointer(300, 300))
    expect(fab.pos.value).toBeNull()
    fab.onPointerDown(pointer(120, 120, { pointerType: 'pen', button: -1 }))
    fab.onPointerMove(pointer(300, 300))
    expect(fab.pos.value).toEqual({ x: 280, y: 280 })
  })

  it('відновлення: збережене місце — у межах теперішнього екрана; зіпсований запис — типове місце', () => {
    localStorage.setItem(KEY, JSON.stringify({ x: 5000, y: 10 }))
    const fab = makeFab()
    fab.restore()
    expect(fab.pos.value).toEqual({ x: 1280 - 64 - 4, y: 10 })

    localStorage.setItem(KEY, '{зіпсовано')
    const broken = makeFab()
    broken.restore()
    expect(broken.pos.value).toBeNull()

    localStorage.setItem(KEY, JSON.stringify({ x: 'a', y: 1 }))
    const wrong = makeFab()
    wrong.restore()
    expect(wrong.pos.value).toBeNull()
  })

  it('поворот/менший екран — reclamp повертає в межі; без позиції нічого не робить', () => {
    const fab = makeFab()
    fab.reclamp()
    expect(fab.pos.value).toBeNull()
    fab.onPointerDown(pointer(120, 120))
    fab.onPointerMove(pointer(1100, 700))
    fab.onPointerUp()
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true, writable: true })
    Object.defineProperty(window, 'innerHeight', { value: 300, configurable: true, writable: true })
    fab.reclamp()
    expect(fab.pos.value).toEqual({ x: 400 - 64 - 4, y: 300 - 64 - 4 })
  })
})

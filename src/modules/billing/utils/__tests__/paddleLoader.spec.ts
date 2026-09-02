import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadPaddle, _resetPaddleLoaderForTesting } from '../paddleLoader'

const SRC = 'https://cdn.paddle.com/paddle/v2/paddle.js'

// happy-dom реально завантажує <script src> після appendChild — перехоплюємо,
// щоб тест не ходив у мережу і сам керував onload/onerror.
let appended: HTMLScriptElement[] = []

describe('paddleLoader', () => {
  beforeEach(() => {
    _resetPaddleLoaderForTesting()
    delete (window as any).Paddle
    appended = []
    vi.spyOn(document.head, 'appendChild').mockImplementation((node: any) => {
      appended.push(node)
      return node
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('appends one script and resolves window.Paddle on load; repeat calls share the promise', async () => {
    const p1 = loadPaddle()
    const p2 = loadPaddle()
    expect(p1).toBe(p2)
    expect(appended).toHaveLength(1)
    expect(appended[0].src).toBe(SRC)

    const fake = { Initialize: () => {} }
    ;(window as any).Paddle = fake
    appended[0].onload!(new Event('load'))

    await expect(p1).resolves.toBe(fake)
  })

  it('resolves immediately without a script when Paddle is already on window', async () => {
    const fake = { Initialize: () => {} }
    ;(window as any).Paddle = fake

    await expect(loadPaddle()).resolves.toBe(fake)
    expect(appended).toHaveLength(0)
  })

  it('rejects on script error and allows a retry with a fresh script', async () => {
    const p1 = loadPaddle()
    appended[0].onerror!(new Event('error'))
    await expect(p1).rejects.toThrow('paddle_load_failed')

    const p2 = loadPaddle()
    expect(p2).not.toBe(p1)
    expect(appended).toHaveLength(2)
    p2.catch(() => {})
  })

  it('rejects when the script loads but leaves no Paddle namespace', async () => {
    const p1 = loadPaddle()
    appended[0].onload!(new Event('load'))
    await expect(p1).rejects.toThrow('paddle_namespace_missing')
  })
})

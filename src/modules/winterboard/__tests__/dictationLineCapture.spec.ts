/** Перевіряє справжню SVG-гілку capture з підміною лише браузерних Image/Canvas. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { snapshotElement } from '../utils/snapshotElement'
import { dictationLineSvg } from '../board/dictationLineSvg'
import { sentenceFixture } from './fixtures/dictationLineFixture'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

function nativeMocks() {
  const context = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '' }
  class Canvas {
    getContext() { return context }
    async convertToBlob() { return new Blob(['png'], { type: 'image/png' }) }
  }
  class ImageMock {
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    set src(_value: string) { queueMicrotask(() => this.onload?.()) }
  }
  vi.stubGlobal('OffscreenCanvas', Canvas)
  vi.stubGlobal('Image', ImageMock)
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:dictation-test')
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  return { context, revoke }
}
function root(transparent: boolean) {
  const element = document.createElement('div')
  element.innerHTML = dictationLineSvg(sentenceFixture())
  const svg = element.querySelector('svg')!
  if (!transparent) svg.removeAttribute('data-export-background')
  const rect = { x: 0, y: 0, width: 400, height: 120, top: 0, left: 0, right: 400, bottom: 120, toJSON: () => ({}) }
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect)
  vi.spyOn(svg, 'getBoundingClientRect').mockReturnValue(rect)
  return element
}

describe('SVG capture — alpha нового чорнила без зміни старих віджетів', () => {
  it('явно прозоре речення не закриває зошит білим прямокутником', async () => {
    const { context, revoke } = nativeMocks()
    const element = root(true)
    const before = element.innerHTML
    const result = await snapshotElement(element, new AbortController().signal)
    // Знімок — обвід frozen-чорнила, а не вся вільна область запиту.
    expect(result).toMatchObject({ width: 111, height: 31 })
    expect(context.drawImage).toHaveBeenCalledOnce()
    expect(context.fillRect).not.toHaveBeenCalled()
    expect(element.innerHTML).toBe(before)
    expect(revoke).toHaveBeenCalledWith('blob:dictation-test')
  })
  it('старий SVG без opt-in, як і раніше, отримує білий фон', async () => {
    const { context } = nativeMocks()
    await snapshotElement(root(false), new AbortController().signal)
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 111, 31)
    expect(context.fillStyle).toBe('#ffffff')
    expect(context.drawImage).toHaveBeenCalledOnce()
  })
  it('abort до знімка не запускає rasterize чи зміни', async () => {
    const { context } = nativeMocks()
    const controller = new AbortController(); controller.abort()
    expect(await snapshotElement(root(true), controller.signal)).toBeNull()
    expect(context.drawImage).not.toHaveBeenCalled()
  })
})

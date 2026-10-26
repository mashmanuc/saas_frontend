/**
 * LAW §9 v1.66 (власник 2026-10-26): «треба, щоб малювалися символи… а тоді перетворювалися на об'єкт»;
 * «якщо вводимо з мікрофона, тулбар не треба показувати… натиснемо мишкою — щоб появлявся тулбар».
 *
 *   — «пише рукою»: малюнок «Речення» до моменту руки містить лише закінчені штрихи й частину поточного; після кінця —
 *     той самий, що й без руки; рамка однакова (чорнило лягає туди, де стоятиме);
 *   — тихе виділення: після диктанту з пульта панелі немає, перший дотик на ноутбуці робить виділення звичайним.
 */
import { describe, it, expect } from 'vitest'
import { dictationLineSvg } from '../board/dictationLineSvg'
import { revealDictation, revealElapsed, finishReveal, revealDuration } from '../board/dictationReveal'
import { quietSelection, selectQuietly, isQuietSelection } from '../board/quietSelection'
import { sentenceFixture } from './fixtures/dictationLineFixture'

const polylines = (svg: string) => (svg.match(/<polyline/g) ?? []).length
const viewBox = (svg: string) => svg.match(/viewBox="([^"]+)"/)?.[1]

describe('v1.66 · «пише рукою»', () => {
  it('штрихи з\'являються в темпі руки, а в кінці — те саме, що готове речення', () => {
    const data = sentenceFixture()
    const total = revealDuration(data)
    expect(total).toBeGreaterThan(0)
    const done = dictationLineSvg(data)
    // на старті — лише штрихи, які рука вже закінчила (у тестових даних перший закінчується в мить 0)
    expect(polylines(dictationLineSvg(data, 0))).toBe(data.layout.strokes.filter((s) => s.t <= 0).length)
    const half = dictationLineSvg(data, total / 2)
    expect(polylines(half)).toBeGreaterThan(0)
    expect(polylines(half)).toBeLessThan(polylines(done))
    expect(dictationLineSvg(data, total)).toBe(done)
    expect(viewBox(half)).toBe(viewBox(done))
  })

  it('руку бачить лише ноутбук, що написав: без позначки — готове одразу', () => {
    expect(revealElapsed('other')).toBeNull()
    revealDictation('s1')
    expect(revealElapsed('s1')).not.toBeNull()
    finishReveal('s1')
    expect(revealElapsed('s1')).toBeNull()
  })
})

describe('v1.66 · тихе виділення після диктанту з пульта', () => {
  it('панелі немає до першого дотику на ноутбуці', () => {
    selectQuietly('sentence-1')
    expect(isQuietSelection(['sentence-1'])).toBe(true)
    expect(isQuietSelection(['sentence-1', 'other'])).toBe(false)
    expect(isQuietSelection(['other'])).toBe(false)
    window.dispatchEvent(new Event('pointerdown'))
    expect(quietSelection.id).toBeNull()
    expect(isQuietSelection(['sentence-1'])).toBe(false)
  })
})

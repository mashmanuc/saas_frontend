/**
 * Смуги прокрутки аркуша (власник 2026-09-24): колесо гортало збільшений аркуш
 * непомітно — верх із заголовками карток ховався без жодного знаку.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WBSheetScrollbars from '../components/canvas/WBSheetScrollbars.vue'
import { MIN_THUMB_PX, scrollFromThumbDelta, scrollThumb } from '../components/canvas/sheetScroll'

describe('sheetScroll — геометрія повзунка', () => {
  it('аркуш удвічі більший за поле → повзунок на пів доріжки; кінець прокрутки → у кінці доріжки', () => {
    expect(scrollThumb(0, 2000, 1000, 400)).toEqual({ size: 200, pos: 0 })
    expect(scrollThumb(1000, 2000, 1000, 400)).toEqual({ size: 200, pos: 200 })
  })

  it('дуже довгий аркуш — повзунок не менший за MIN_THUMB_PX', () => {
    expect(scrollThumb(0, 100000, 500, 400).size).toBe(MIN_THUMB_PX)
  })

  it('тягнемо повзунок на всю вільну доріжку → прокрутка до кінця, не далі', () => {
    expect(scrollFromThumbDelta(0, 200, 2000, 1000, 400)).toBe(1000)
    expect(scrollFromThumbDelta(0, 9999, 2000, 1000, 400)).toBe(1000)
    expect(scrollFromThumbDelta(500, -9999, 2000, 1000, 400)).toBe(0)
  })
})

describe('WBSheetScrollbars', () => {
  const base = { scrollX: 0, scrollY: 280, contentW: 1920, contentH: 1080, viewW: 1100, viewH: 800 }

  it('аркуш більший за поле → обидві смуги, позначені як «лише вигляд»', () => {
    const w = mount(WBSheetScrollbars, { props: base })
    const bars = w.findAll('.wb-sheet-scroll')
    expect(bars).toHaveLength(2)
    for (const b of bars) expect(b.attributes('data-wb-view-control')).toBeDefined()
  })

  it('аркуш вміщається → смуг немає', () => {
    const w = mount(WBSheetScrollbars, { props: { ...base, scrollY: 0, contentW: 1000, contentH: 560 } })
    expect(w.findAll('.wb-sheet-scroll')).toHaveLength(0)
  })

  it('клік по доріжці над повзунком → гортає вгору', async () => {
    const w = mount(WBSheetScrollbars, { props: base })
    const track = w.find('.wb-sheet-scroll--y')
    ;(track.element as HTMLElement).getBoundingClientRect = () => ({ top: 0, left: 0, width: 8, height: 788 } as DOMRect)
    await track.trigger('pointerdown', { button: 0, clientY: 0 })
    const ev = w.emitted('scroll') as Array<[number, number]>
    expect(ev[0][1]).toBeLessThan(280)
  })
})

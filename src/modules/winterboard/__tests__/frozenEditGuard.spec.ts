/**
 * Заморожена дошка (завершений запис): що вважається спробою змінити.
 * Рішення власника 2026-09-24 — див. шапку `board/frozenEditGuard.ts`.
 */
import { describe, expect, it } from 'vitest'
import { isEditingTool, shouldInterceptCanvasEvent } from '../board/frozenEditGuard'

describe('isEditingTool', () => {
  it.each(['pen', 'highlighter', 'eraser', 'line', 'rectangle', 'circle', 'text', 'sticky'])(
    '«%s» — намір змінити дошку', (tool) => {
      expect(isEditingTool(tool)).toBe(true)
    },
  )

  it.each(['select', 'laser'])('«%s» — лише перегляд/показ, питання немає', (tool) => {
    expect(isEditingTool(tool)).toBe(false)
  })
})

describe('shouldInterceptCanvasEvent', () => {
  it('ліва кнопка миші / перо / один палець — перехоплюємо', () => {
    expect(shouldInterceptCanvasEvent({ type: 'pointerdown', button: 0, pointerType: 'mouse', isPrimary: true })).toBe(true)
    expect(shouldInterceptCanvasEvent({ type: 'pointerdown', button: 0, pointerType: 'pen', isPrimary: true })).toBe(true)
    expect(shouldInterceptCanvasEvent({ type: 'pointerdown', button: 0, pointerType: 'touch', isPrimary: true })).toBe(true)
    expect(shouldInterceptCanvasEvent({ type: 'touchstart', touches: { length: 1 } })).toBe(true)
  })

  it('клік і подвійний клік (кнопки карток, × видалення) — перехоплюємо', () => {
    expect(shouldInterceptCanvasEvent({ type: 'click' })).toBe(true)
    expect(shouldInterceptCanvasEvent({ type: 'dblclick' })).toBe(true)
  })

  it('середня кнопка (пан) і права (меню) — вільні', () => {
    expect(shouldInterceptCanvasEvent({ type: 'pointerdown', button: 1, pointerType: 'mouse' })).toBe(false)
    expect(shouldInterceptCanvasEvent({ type: 'mousedown', button: 2 })).toBe(false)
  })

  it('другий палець (pinch-зум) — вільний', () => {
    expect(shouldInterceptCanvasEvent({ type: 'pointerdown', button: 0, pointerType: 'touch', isPrimary: false })).toBe(false)
    expect(shouldInterceptCanvasEvent({ type: 'touchstart', touches: { length: 2 } })).toBe(false)
  })

  it('колесо й рух миші не чіпаємо', () => {
    expect(shouldInterceptCanvasEvent({ type: 'wheel' })).toBe(false)
    expect(shouldInterceptCanvasEvent({ type: 'pointermove' })).toBe(false)
  })
})

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { penTapSelection, topCardAt, type TapCard } from '../board/penTapSelect'

const card = (id: string, extra: Partial<TapCard> = {}): TapCard => ({
  id, render: 'overlay', index: 0, x: 100, y: 100, w: 200, h: 100, ...extra,
})

describe('LAW §9 v1.35 — тап олівцем по картці', () => {
  it('влучання — за рамкою з даних, повз — null', () => {
    expect(topCardAt({ x: 150, y: 150 }, [card('a')], false)?.id).toBe('a')
    expect(topCardAt({ x: 99, y: 150 }, [card('a')], false)).toBeNull()
    expect(topCardAt({ x: 150, y: 201 }, [card('a')], false)).toBeNull()
  })

  it('видима висота картки, а не записана: підігнана під вміст картка ловить тап нижче', () => {
    const fitted = card('a', { h: 300 })
    expect(topCardAt({ x: 150, y: 350 }, [fitted], false)?.id).toBe('a')
  })

  it('обернута картка — навколо центру, як малює дошка', () => {
    const turned = card('a', { x: 0, y: 0, w: 200, h: 20, rotation: 90 })
    // Центр (100, 10); після 90° смуга вертикальна: x 90..110, y −90..110
    expect(topCardAt({ x: 100, y: 100 }, [turned], false)?.id).toBe('a')
    expect(topCardAt({ x: 180, y: 10 }, [turned], false)).toBeNull()
  })

  it('з двох карток під тапом — верхня за шарами, а не за масивом', () => {
    const pdf = card('pdf', { render: 'konva', index: 1 })
    const task = card('task', { render: 'overlay', index: 0 })
    // HTML-картки над звичайним Konva-полотном, навіть коли PDF пізніше в масиві
    expect(topCardAt({ x: 150, y: 150 }, [task, pdf], false)?.id).toBe('task')
    // …доки вся нативна група не стоїть після HTML-групи
    expect(topCardAt({ x: 150, y: 150 }, [task, pdf], true)?.id).toBe('pdf')
    const upper = card('upper', { index: 2 })
    expect(topCardAt({ x: 150, y: 150 }, [upper, task], false)?.id).toBe('upper')
  })

  it('картка-задача: тап виділяє, повторний тап — знімає', () => {
    expect(penTapSelection('a', true, [])).toEqual(['a'])
    expect(penTapSelection('a', true, ['b'])).toEqual(['a'])
    expect(penTapSelection('a', true, ['a', 'b'])).toEqual(['a'])
    expect(penTapSelection('a', true, ['a'])).toEqual([])
  })

  it('тап повз задачі знімає виділення; нічого не виділено — нічого не міняє', () => {
    expect(penTapSelection(null, false, ['a'])).toEqual([])
    expect(penTapSelection('text', false, ['a'])).toEqual([])
    expect(penTapSelection(null, false, [])).toBeNull()
    expect(penTapSelection('text', false, [])).toBeNull()
  })
})

describe('WBCanvas підключає тап олівцем лише там, де штриха немає', () => {
  // Полотно в тестах не змонтувати (Konva, WS, стори) — звіряємо розмітку виклику.
  const src = readFileSync(resolve(__dirname, '../components/canvas/WBCanvas.vue'), 'utf-8')
  const mouseUp = src.slice(src.indexOf('function handleMouseUp(): void {'), src.indexOf('// Create stroke', src.indexOf('function handleMouseUp(): void {')))

  it('лише в гілці «менше двох точок» (жест без руху) і лише для олівця й маркера', () => {
    expect(mouseUp).toMatch(/if \(currentPoints\.value\.length < 2\) \{[\s\S]*?selectCardByPenTap\(tap\)[\s\S]*?return\n  \}/)
    expect(mouseUp).toMatch(/currentTool\.value === 'pen' \|\| currentTool\.value === 'highlighter'\)\) selectCardByPenTap\(tap\)/)
  })

  it('рамка — видима висота картки (підгонка під вміст), згорнуті й показ на весь екран не ловлять тапу', () => {
    const fn = src.slice(src.indexOf('function selectCardByPenTap('), src.indexOf('function handleErase('))
    expect(fn).toMatch(/h: viewFitH\.value\.get\(asset\.id\) \?\? asset\.h/)
    expect(fn).toMatch(/isMinimizedOnBoard\(asset\) \|\| isInMediaShow\(asset\)/)
    expect(fn).toMatch(/actions\.handwrite \|\| actions\.taskHelp/)
  })
})

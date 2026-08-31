// Стан учня — контракт трьох рівнів.
//
// Тести названі за обіцянками контракту, а не за функціями: якщо
// реалізація зміниться, має лишитись видно, ЩО саме гарантується.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  adviseNext,
  applyReport,
  emptyLearnerState,
  freshRoots,
  persistentRoots,
} from '../learnerState'
import type { RunReport } from '../lessonMachine'

const HERE = dirname(fileURLToPath(import.meta.url))
const PUBLIC = resolve(HERE, '../../../../public')

function rep(roots: string[], extra: Partial<RunReport> = {}): RunReport {
  return {
    answered: roots.length,
    solved: 0,
    correct: 0,
    roots,
    mistakes: [],
    treated: [],
    practice: { attempts: 0, correct: 0 },
    ...extra,
  }
}

// ── Межа рівнів ──────────────────────────────────────────────────────────

describe('INV-L1 · план курсу не знає про учня', () => {
  it('у жодному зібраному занятті немає посилання на учня', () => {
    for (const file of ['lesson-percent.concept.json', 'lesson-percent.of_number.json']) {
      const raw = readFileSync(resolve(PUBLIC, file), 'utf-8')
      // не «немає таких полів у типі», а немає В ДАНИХ: тип можна
      // обійти, а зібраний план — це те, що реально поїде клієнту
      expect(raw).not.toMatch(/student|learner|userId|user_id|progress|mastery/i)
      const plan = JSON.parse(raw)
      expect(Object.keys(plan)).not.toContain('learner')
    }
  })

  it('межу перетинає rootId, а не крок показу і не симптом', () => {
    const s = applyReport(emptyLearnerState(), 'l1', rep(['percent/hundredth-not-tenth']))
    expect(Object.keys(s.roots)).toEqual(['percent/hundredth-not-tenth'])
    // симптоми й кроки показу у стан НЕ потрапляють
    const s2 = applyReport(emptyLearnerState(), 'l1',
      rep(['r/a'], { mistakes: ['percent_div_by_10'], treated: ['fix_hundredth'] }))
    expect(JSON.stringify(s2)).not.toContain('percent_div_by_10')
    expect(JSON.stringify(s2)).not.toContain('fix_hundredth')
  })
})

// ── Накопичення свідчень ─────────────────────────────────────────────────

describe('стан накопичує свідчення про корені', () => {
  it('той самий корінь у двох заняттях рахується як повторення', () => {
    let s = applyReport(emptyLearnerState(), 'l1', rep(['r/x']))
    s = applyReport(s, 'l2', rep(['r/x']))
    expect(s.roots['r/x'].lessons).toEqual(['l1', 'l2'])
    expect(s.roots['r/x'].hits).toBe(2)
    expect(persistentRoots(s)).toEqual(['r/x'])
  })

  it('корінь з ОДНОГО заняття ще не «стійкий» — могла бути неуважність', () => {
    const s = applyReport(emptyLearnerState(), 'l1', rep(['r/x', 'r/y']))
    expect(persistentRoots(s)).toEqual([])
    expect(freshRoots(s).sort()).toEqual(['r/x', 'r/y'])
  })

  it('повторний запис ТОГО САМОГО заняття не подвоює лічильники', () => {
    // учень перезавантажив сторінку — це не привід вважати, що він
    // помилився двічі
    let s = applyReport(emptyLearnerState(), 'l1', rep(['r/x']))
    const again = applyReport(s, 'l1', rep(['r/x']))
    expect(again.roots['r/x'].hits).toBe(1)
    expect(again.roots['r/x'].treated).toBe(1)
    expect(again.completed).toEqual(['l1'])
  })

  it('вхідний стан не змінюється (чиста функція)', () => {
    const s0 = applyReport(emptyLearnerState(), 'l1', rep(['r/x']))
    const snapshot = JSON.stringify(s0)
    applyReport(s0, 'l2', rep(['r/x', 'r/z']))
    expect(JSON.stringify(s0)).toBe(snapshot)
  })

  it('«щойно спіткнувся» стосується ОСТАННЬОГО заняття, не всіх', () => {
    let s = applyReport(emptyLearnerState(), 'l1', rep(['r/old']))
    s = applyReport(s, 'l2', rep(['r/new']))
    expect(freshRoots(s)).toEqual(['r/new'])
    expect(s.roots['r/old'].hits).toBe(1) // не забуто, лише не свіже
  })
})

// ── Порада, а не заборона ────────────────────────────────────────────────

describe('INV-L2 · стан радить, але не блокує', () => {
  const order = ['l1', 'l2', 'l3']

  it('стійкий корінь → радимо закріпити', () => {
    let s = applyReport(emptyLearnerState(), 'l1', rep(['r/x']))
    s = applyReport(s, 'l2', rep(['r/x']))
    const a = adviseNext(s, order, 'l2')
    expect(a.kind).toBe('repeat')
    expect(a.roots).toEqual(['r/x'])
  })

  it('чисте проходження → далі за планом курсу', () => {
    const s = applyReport(emptyLearnerState(), 'l1', rep([]))
    expect(adviseNext(s, order, 'l1').kind).toBe('continue')
  })

  it('останнє заняття курсу → «пройдено», а не порожня порада', () => {
    const s = applyReport(emptyLearnerState(), 'l3', rep([]))
    expect(adviseNext(s, order, 'l3').kind).toBe('done')
  })

  it('порада НЕ приховує наступного заняття навіть при стійкому корені', () => {
    // «repeat» — це рекомендація; наступне заняття лишається в порядку
    // курсу, і жодна функція тут його не викреслює
    let s = applyReport(emptyLearnerState(), 'l1', rep(['r/x']))
    s = applyReport(s, 'l2', rep(['r/x']))
    const a = adviseNext(s, order, 'l2')
    expect(a.kind).toBe('repeat')
    expect(order[order.indexOf('l2') + 1]).toBe('l3') // шлях далі існує
  })
})

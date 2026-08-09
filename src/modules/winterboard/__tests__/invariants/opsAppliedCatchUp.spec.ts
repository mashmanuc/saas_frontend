/**
 * A-T2 (2026-08-09) — `ops.applied` → INV-24 catchUp.
 *
 * Розслідування: BE шле `ops.applied` після кожного commit (LAW §8), і воно
 * ЗАВЖДИ долітало у вкладку — але `handleMessage` не мав цього типу й не мав
 * `default`, тож повідомлення тихо гинуло. Наслідок: серверний писець (enrich,
 * AI-фічі, друга вкладка) був невидимий без F5.
 *
 * Фікс — сигнал, а не другий apply-канал: при потрібних ops кличемо штатний
 * `catchUp()`. Головне обмеження — ЦІНА: broadcast дебаунситься 50ms і шлеться
 * на КОЖЕН apply, включно зі `stroke_add`; наївний виклик дав би потік
 * `GET /state/` (27KB+) з кожної вкладки.
 *
 * Під тестом саме фільтр — рішення «слати чи ні»:
 *   #1 серія stroke-ops → catchUp НЕ потрібен ЖОДНОГО разу (вимога рев'ю);
 *   #2 asset_* / page_* / *_update → потрібен (клас, що ламався в enrich);
 *   #3 порожня/крива пачка → НЕ потрібен (не гатимо state на сміття).
 */

import { describe, it, expect } from 'vitest'

import { needsCatchUp } from '../../composables/usePresence'

const op = (op_type: string) => ({ op_type })

describe('A-T2 #1 — штрихи не тягнуть catchUp', () => {
  it('серія stroke-ops → жодного catchUp', () => {
    // Саме цей сценарій робить ціну неприйнятною: учень малює, кожен apply
    // дає broadcast. Штрихи вже приходять живо через `stroke.broadcast`.
    const strokeBurst = Array.from({ length: 50 }, () => op('stroke_add'))
    expect(needsCatchUp(strokeBurst)).toBe(false)
  })

  it('stroke_update / stroke_delete теж не тягнуть', () => {
    // ⚠️ `stroke_update` навмисно НЕ підпадає під суфікс `_update`: цей
    // клас доставляє live-канал. Якби підпадав — фільтр був би марний.
    expect(needsCatchUp([op('stroke_update')])).toBe(false)
    expect(needsCatchUp([op('stroke_delete')])).toBe(false)
  })
})

describe('A-T2 #2 — те, чого live-канал не носить', () => {
  it('asset_add (саме він ламався в enrich) → потрібен', () => {
    expect(needsCatchUp([op('asset_add')])).toBe(true)
  })

  it('page_add / page_delete → потрібен', () => {
    expect(needsCatchUp([op('page_add')])).toBe(true)
    expect(needsCatchUp([op('page_delete')])).toBe(true)
  })

  it('grid_update / background_update → потрібен', () => {
    expect(needsCatchUp([op('grid_update')])).toBe(true)
    expect(needsCatchUp([op('background_update')])).toBe(true)
  })

  it('змішана пачка: один asset серед сотні штрихів → потрібен', () => {
    const mixed = [...Array.from({ length: 100 }, () => op('stroke_add')),
                   op('asset_add')]
    expect(needsCatchUp(mixed)).toBe(true)
  })
})

describe('A-T2 #3 — сміття не тягне catchUp', () => {
  it('порожня пачка, undefined, не-масив', () => {
    expect(needsCatchUp([])).toBe(false)
    expect(needsCatchUp(undefined)).toBe(false)
    expect(needsCatchUp('nonsense' as never)).toBe(false)
  })

  it('op без op_type або з нерядковим типом', () => {
    expect(needsCatchUp([{}])).toBe(false)
    expect(needsCatchUp([{ op_type: 42 } as never])).toBe(false)
  })
})

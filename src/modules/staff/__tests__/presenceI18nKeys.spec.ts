/**
 * Кожен ключ `staff.presence.*`, ужитий у блоках присутності й споживання, є в uk, en і ru.
 * Динамічні ключі (періоди, дні тижня, колонки топу, типи об'єктів) — за відомими списками:
 * без них у staff стояв би сирий шлях ключа замість підпису.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import uk from '@/i18n/locales/uk.json'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'

const FILES = [
  'src/modules/staff/components/PresenceNowPanel.vue',
  'src/modules/staff/components/PresenceUsageSection.vue',
]
const PERIODS = ['d1', 'd7', 'd30', 'd90']
const COLS = ['online_minutes', 'board_minutes', 'ai_requests', 'ai_month', 'storage_bytes', 'boards', 'replays']

function lookup(messages: Record<string, any>, key: string): unknown {
  return key.split('.').reduce<any>((node, part) => (node == null ? undefined : node[part]), messages)
}

function usedKeys(): string[] {
  const keys = new Set<string>()
  for (const file of FILES) {
    const src = readFileSync(resolve(process.cwd(), file), 'utf-8')
    for (const m of src.matchAll(/\$?t\(\s*'(staff\.presence[\w.]*)'/g)) keys.add(m[1])
  }
  for (const p of PERIODS) keys.add(`staff.presence.periods.${p}`)
  for (let d = 0; d < 7; d++) keys.add(`staff.presence.weekdays.${d}`)
  for (const c of COLS) keys.add(`staff.presence.top.cols.${c}`)
  return [...keys]
}

describe('ключі перекладу присутності й споживання', () => {
  it('знайдено достатньо ключів, щоб перевірка була змістовною', () => {
    expect(usedKeys().length).toBeGreaterThan(40)
  })

  it.each([['uk', uk], ['en', en], ['ru', ru]])('%s: усі ключі є і це рядки', (_loc, messages) => {
    const missing = usedKeys().filter(k => typeof lookup(messages as any, k) !== 'string')
    expect(missing).toEqual([])
  })

  it('підписи типів об\'єктів однакові за складом у трьох мовах', () => {
    const keysOf = (m: any) => Object.keys(m.staff.presence.objects).sort()
    expect(keysOf(en)).toEqual(keysOf(uk))
    expect(keysOf(ru)).toEqual(keysOf(uk))
  })
})

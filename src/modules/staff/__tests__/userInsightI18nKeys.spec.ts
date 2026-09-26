/**
 * Кожен ключ `staff.insight.*` / `staff.userOverview.lastActive`, ужитий у картці
 * користувача та її панелях, існує в uk, en і ru.
 *
 * Навіщо окремо від тестів панелей: заголовки секцій рендерить сама картка
 * (StaffUserOverviewView), яку в тесті не змонтуєш без стору й роутера, —
 * kill-проба з перейменованим ключем заголовка лишалась зеленою (2026-09-26).
 * Динамічні ключі (`kind.${…}`, `events.${…}`) перевіряються за відомими списками.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import uk from '@/i18n/locales/uk.json'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'

const FILES = [
  'src/modules/staff/views/StaffUserOverviewView.vue',
  'src/modules/staff/components/UserDevicesPanel.vue',
  'src/modules/staff/components/UserErrorsPanel.vue',
]
const KINDS = ['phone', 'tablet', 'computer', 'bot', 'unknown']
const SEVERITIES = ['error', 'warning', 'info']
// Причини, які пише бекенд: user_revoke (views_v1_me), account_archived (архівація), logout (пакет A)
const REASONS = ['logout', 'user_revoke', 'account_archived']
// Має збігатися з FAILURE_EVENTS у backend apps/staff/api/user_insight_views.py.
const EVENTS = [
  'wb.ops.save_blocked', 'wb.ops.desync', 'wb.ops.paused', 'wb.ops.lifecycle_blocked', 'wb.ops.payload_oversized',
  'auth.refresh.fail', 'auth.death', 'invariant.violation',
  'board.ops.apply_failed', 'board.validate_state.failed', 'recording.stop.failed',
]

function lookup(messages: Record<string, any>, key: string): unknown {
  return key.split('.').reduce<any>((node, part) => (node == null ? undefined : node[part]), messages)
}

function usedKeys(): string[] {
  const keys = new Set<string>()
  for (const file of FILES) {
    const src = readFileSync(resolve(process.cwd(), file), 'utf-8')
    for (const m of src.matchAll(/\$?t\(\s*'((?:staff\.insight|staff\.userOverview\.lastActive)[\w.]*)'/g)) {
      keys.add(m[1])
    }
  }
  for (const kind of KINDS) keys.add(`staff.insight.devices.kind.${kind}`)
  for (const ev of EVENTS) keys.add(`staff.insight.errors.events.${ev.replace(/\./g, '_')}`)
  for (const sev of SEVERITIES) keys.add(`staff.insight.errors.severity.${sev}`)
  for (const reason of REASONS) keys.add(`staff.insight.devices.reasons.${reason}`)
  return [...keys]
}

describe('ключі перекладу картки користувача в staff', () => {
  it('знайдено достатньо ключів, щоб перевірка була змістовною', () => {
    expect(usedKeys().length).toBeGreaterThan(25)
  })

  it.each([['uk', uk], ['en', en], ['ru', ru]])('%s: усі ключі є і це рядки', (_loc, messages) => {
    const missing = usedKeys().filter(k => typeof lookup(messages as any, k) !== 'string')
    expect(missing).toEqual([])
  })
})

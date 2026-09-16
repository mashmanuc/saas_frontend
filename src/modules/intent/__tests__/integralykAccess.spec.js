/**
 * TLV2-RC1 · доступ до Інтегралика без клієнтських build-прапорців (ТЗ 44 §4.2, §7).
 *
 * Палітру тут не монтуємо (вона тягне роутер, стор, голос — як у boardRoute.spec.js):
 * перевіряємо чисті правила `integralykAccess.js` і те, що палітра користується саме ними.
 *   • tutor/staff бачать Інтегралика, учень — ні; адмінка й пульт — ні;
 *   • `integralyk_enabled=false` ховає, відсутнє налаштування — показує;
 *   • серверний kill-switch (404 без коду на /intents/) чесно відрізняється від помилки команди;
 *   • жодного клієнтського build-прапорця Інтегралика чи трею у застосунку.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  canUseIntegralyk,
  INTEGRALYK_ROLES,
  isIntegralykOn,
  isIntegralykServerDisabled,
} from '../integralykAccess'

const SRC = resolve(__dirname, '../../..')
const read = (rel) => readFileSync(resolve(SRC, rel), 'utf-8').replace(/\r\n/g, '\n')
const BOARD = { name: 'winterboard-solo', path: '/winterboard/abc', meta: {} }

describe('TLV2-RC1 · хто бачить Інтегралика', () => {
  it.each(INTEGRALYK_ROLES)('роль %s на дошці — так', (role) => {
    expect(canUseIntegralyk({ role }, BOARD)).toBe(true)
  })

  it('staff-прапорець користувача — так; учень і гість — ні', () => {
    expect(canUseIntegralyk({ role: 'student', is_staff: true }, BOARD)).toBe(true)
    expect(canUseIntegralyk({ role: 'student' }, BOARD)).toBe(false)
    expect(canUseIntegralyk({ role: 'parent' }, BOARD)).toBe(false)
    expect(canUseIntegralyk(null, BOARD)).toBe(false)
  })

  it('чинні правила маршруту лишаються: адмінка, обидва пульти й публічний реплей — ні; класна кімната — так', () => {
    const tutor = { role: 'tutor' }
    expect(canUseIntegralyk(tutor, { name: 'staff-billing', path: '/staff/billing', meta: {} })).toBe(false)
    expect(canUseIntegralyk(tutor, { name: 'winterboard-remote', path: '/remote', meta: {} })).toBe(false)
    expect(canUseIntegralyk(tutor, { name: 'winterboard-remote-board', path: '/winterboard/a/remote', meta: {} })).toBe(false)
    expect(canUseIntegralyk(tutor, { name: 'winterboard-public', path: '/winterboard/public/t', meta: { public: true } })).toBe(false)
    expect(canUseIntegralyk(tutor, { name: 'winterboard-classroom', path: '/classroom/1', meta: {} })).toBe(true)
  })

  it('персональний вимикач: false ховає; true і відсутні налаштування — показують', () => {
    expect(isIntegralykOn({ integralyk_enabled: false })).toBe(false)
    expect(isIntegralykOn({ integralyk_enabled: true })).toBe(true)
    expect(isIntegralykOn(null)).toBe(true)
    expect(isIntegralykOn({})).toBe(true)
  })
})

describe('TLV2-RC1 · серверний kill-switch FEATURE_UIA — чесна відповідь, не зникнення', () => {
  const err = (status, url, data) => ({ response: { status, data, config: { url } } })

  it('404 без коду помилки на /intents/ — Інтегралик вимкнено на сервері', () => {
    expect(isIntegralykServerDisabled(err(404, '/v1/intents/ai/parse/', '<!doctype html>Not Found'))).toBe(true)
    expect(isIntegralykServerDisabled(err(404, '/v1/intents/', undefined))).toBe(true)
  })

  it('capability-помилка з кодом, інші URL і статуси — не kill-switch', () => {
    expect(isIntegralykServerDisabled(err(404, '/v1/intents/', { error: 'NOT_FOUND', detail: 'x' }))).toBe(false)
    expect(isIntegralykServerDisabled(err(404, '/v1/winterboard/sessions/1/', '<html>'))).toBe(false)
    expect(isIntegralykServerDisabled(err(503, '/v1/intents/ai/parse/', { error: 'AI_UNAVAILABLE' }))).toBe(false)
    expect(isIntegralykServerDisabled(new Error('network'))).toBe(false)
  })
})

describe('TLV2-RC1 · палітра без build-прапорців Інтегралика', () => {
  const palette = read('modules/intent/CommandPalette.vue')

  it('доступ, AI і голос — за правилами integralykAccess, а не за import.meta.env', () => {
    // інші домени (напр. EN-провідник) мають власні прапорці — їх цей крок не чіпає
    expect(palette).not.toContain('import.meta.env.' + 'VITE_FEATURE_' + 'UIA')
    expect(palette).toContain('return canUseIntegralyk(auth.user, route)')
    expect(palette).toContain('const integralykOn = computed(() => isIntegralykOn(profileStore.settings))')
    expect(palette).toContain('const showAI = computed(() => integralykOn.value && !serverAiOff.value)')
    expect(palette).toContain('const VOICE_ENABLED = voice.supported')
    // голос — лише коли доступний AI-режим (обидві кнопки мікрофона)
    expect(palette.match(/v-if="VOICE_ENABLED && showAI"/g)).toHaveLength(2)
    expect(palette).not.toContain('AI_ENABLED')
  })

  it('404 kill-switch: AI-тред і команди показують причину, AI ховається до reload', () => {
    const askStart = palette.indexOf('async function askAi')
    const ask = palette.slice(askStart, palette.indexOf('function continueAi', askStart))
    expect(ask).toMatch(/if \(isIntegralykServerDisabled\(e\)\) \{\s*serverAiOff\.value = true\s*aiPush\(\{ kind: 'bot', text: INTEGRALYK_SERVER_DISABLED_MESSAGE \}\)/)
    const run = palette.slice(palette.indexOf('async function run('), palette.indexOf('// ════════════ COMMAND DIALOG ENGINE'))
    expect(run).toContain('isIntegralykServerDisabled(e)')
  })

  it('у всьому src немає клієнтських прапорців Інтегралика й трею', () => {
    const names = ['VITE_FEATURE_' + 'UIA', 'VITE_WB_' + 'BOARD_TRAY', 'wb_board' + '_tray', 'isBoard' + 'TrayEnabled']
    const hits = []
    const walk = (dir) => {
      for (const n of readdirSync(dir)) {
        const full = join(dir, n)
        if (statSync(full).isDirectory()) walk(full)
        else if (/\.(ts|js|vue|json|mjs)$/.test(n)) {
          const text = readFileSync(full, 'utf-8')
          for (const name of names) if (text.includes(name)) hits.push(`${full} → ${name}`)
        }
      }
    }
    walk(SRC)
    expect(hits).toEqual([])
  })
})

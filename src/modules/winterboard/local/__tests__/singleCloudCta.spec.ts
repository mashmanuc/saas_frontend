/**
 * На локальному робочому столі — ОДНА кнопка входу в хмару, не дві.
 *
 * Було дві: «Підключити хмару» (реєстрація) і «Увійти» (логін). Розподіл між
 * ними не читався НАВІТЬ АВТОРОМ ПРОДУКТУ, і обидві дали живі промахи:
 *   2026-07-29 — новачок без акаунта натиснув «Увійти» і зламав собі шлях;
 *   2026-08-12 — власник натиснув «Підключити хмару» і отримав у свій акаунт
 *                нашу демо-вітрину замість власної роботи.
 * Дві людини, дві різні кнопки, обидва рази не те, що очікували.
 *
 * Рішення власника: одна кнопка з підписом про ВИГОДУ («зберегти роботу»), а
 * вибір «вхід чи реєстрація» робить сама auth-сторінка, де обидва шляхи поруч.
 *
 * ⚠️ Головне, що стережемо, — політика перенесення. Стара кнопка реєстрації
 * писала буфер ЗАВЖДИ, «навіть якщо на столі лише подарунок»; саме це й
 * поклало вітрину в акаунт. Лишилась обережна політика: переносимо, лише коли
 * на столі є щось людське.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const VIEW = path.resolve(
  __dirname, '../../views/WBSoloRoom.vue',
)
const src = fs.readFileSync(VIEW, 'utf-8')

/** Тіло функції за назвою — щоб перевіряти логіку, а не сусідні рядки.
 *
 * ⚠️ Ріжемо по НАСТУПНОМУ оголошенню, а не по фіксованій кількості символів:
 * перша версія брала 900 знаків і «загубила» останній рядок функції, бо його
 * витіснив довгий коментар. Тест падав на справному коді. */
function body(name: string): string {
  const start = src.indexOf(`function ${name}(`)
  expect(start, `функції ${name} немає`).toBeGreaterThan(-1)
  const rest = src.slice(start + 1)
  const next = rest.search(/\nfunction |\nconst |\n<\/script>/)
  return next === -1 ? rest : rest.slice(0, next)
}

describe('локальний стіл: одна CTA замість двох', () => {
  it('кнопки «Увійти» більше немає', () => {
    expect(src).not.toContain("t('winterboard.localWorkspace.login')")
    expect(src).not.toContain('function goToLogin(')
  })

  it('лишилась одна кнопка, і підпис — про вигоду, не про механізм', () => {
    const key = "t('winterboard.localWorkspace.saveWork')"
    expect(src).toContain(key)
    // рівно одне входження = рівно одна кнопка в хедері
    expect(src.split(key).length - 1).toBe(1)
    // «хмара» описує, як влаштовано, а не що людина отримає
    expect(src).not.toContain("t('winterboard.localWorkspace.connectCloud')")
  })

  it('НЕторкану вітрину в акаунт не переносимо', () => {
    const fn = body('goToCloudSignup')
    expect(fn).toContain('isUntouchedShowcase')
    expect(fn).toContain('stashHandoff')
    // stash має стояти ПІД умовою, а не безумовно перед нею
    expect(fn.indexOf('isUntouchedShowcase')).toBeLessThan(fn.indexOf('stashHandoff'))
  })

  it('шлях назад на /workspace зберігається', () => {
    expect(body('goToCloudSignup')).toContain("redirect: '/workspace'")
  })

  it('модалка апселу веде в ту саму точку, що й кнопка', () => {
    expect(body('onUpsellConnect')).toContain('goToCloudSignup')
    expect(body('onHeaderConnectCloud')).toContain('goToCloudSignup')
  })
})

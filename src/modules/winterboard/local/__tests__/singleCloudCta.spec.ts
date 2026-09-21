/**
 * На локальному робочому столі — одна ГОЛОВНА дія в шапці, не дві рівновагомі.
 *
 * Було дві: «Підключити хмару» (реєстрація) і «Увійти» (логін), обидві
 * однаково важкі. Розподіл між ними не читався НАВІТЬ АВТОРОМ ПРОДУКТУ, і
 * обидві дали живі промахи:
 *   2026-07-29 — новачок без акаунта натиснув «Увійти» і зламав собі шлях;
 *   2026-08-12 — власник натиснув «Підключити хмару» і отримав у свій акаунт
 *                нашу демо-вітрину замість власної роботи.
 * Дві людини, дві різні кнопки, обидва рази не те, що очікували.
 *
 * Рішення 224b0b60 (2026-08-12): одна кнопка з підписом про ВИГОДУ («зберегти
 * роботу»), «Увійти» прибрано з шапки цілком.
 *
 * Рішення bf4c4761 (2026-09-03) УТОЧНИЛО перше, не скасувало його — власник
 * живцем, двічі: «кнопки Увійти або Зареєструватися там немає», потім
 * «а в хедері не треба?». «Увійти» повернуто, але НЕ як друга рівновагома
 * кнопка (це і зламало 08-12) — тиха кнопка в шапці поруч із зеленою
 * («важлива, коли шукаєш очима» — не конкурує за той самий піксель) +
 * окремий пункт у ☰-меню гостя. Тест 08-12 цього не знав і був червоним із
 * 2026-09-03 — стереже правило, якого вже нема.
 *
 * ⚠️ Головне, що стережемо далі, — політика перенесення. Стара кнопка
 * реєстрації писала буфер ЗАВЖДИ, «навіть якщо на столі лише подарунок»;
 * саме це й поклало вітрину в акаунт. Лишилась обережна політика: переносимо,
 * лише коли на столі є щось людське. Та сама політика — і в `goToLogin`
 * (піднята з історії разом із нею, не вигадана заново 09-03).
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

// Блок `.wb-header-auth` — саме шапка, а не файл цілком (там же є ☰-меню
// гостя з тими самими двома написами вдруге; лічильники нижче мають бачити
// лише шапку, інакше "рівно одна кнопка" рахує обидва місця разом).
const headerAuthStart = src.indexOf('class="wb-header-auth"')
expect(headerAuthStart, 'блоку .wb-header-auth немає').toBeGreaterThan(-1)
const headerAuth = src.slice(headerAuthStart, src.indexOf('</header>', headerAuthStart))

describe('локальний стіл: одна ГОЛОВНА CTA в шапці, «Увійти» — тиха', () => {
  it('«Зберегти мою роботу» — рівно одна кнопка в шапці, з важким класом', () => {
    const key = "t('winterboard.localWorkspace.saveWork')"
    expect(headerAuth).toContain(key)
    expect(headerAuth.split(key).length - 1).toBe(1)
    expect(headerAuth).toContain('wb-header-btn--cloud')
    // «хмара» описує, як влаштовано, а не що людина отримає — старої назви нема ніде
    expect(src).not.toContain("t('winterboard.localWorkspace.connectCloud')")
  })

  it('«Увійти» в шапці є, але тиха — не друга рівновагома кнопка', () => {
    const key = "t('winterboard.localWorkspace.login')"
    expect(headerAuth).toContain(key)
    expect(headerAuth.split(key).length - 1).toBe(1)
    expect(headerAuth).toContain('wb-header-btn--login')
    expect(src).toContain('function goToLogin(')
  })

  it('у ☰-меню гостя є обидва пункти — saveWork і login', () => {
    const menuStart = src.indexOf('wb-sidebar-panel__section')
    expect(menuStart, 'секції ☰-меню немає').toBeGreaterThan(-1)
    const menu = src.slice(menuStart, src.indexOf('</template>', menuStart))
    expect(menu).toContain("t('winterboard.localWorkspace.saveWork')")
    expect(menu).toContain("t('winterboard.localWorkspace.login')")
  })

  it('goToLogin: redirect завжди, handoff лише якщо на дошці є щось людське', () => {
    const fn = body('goToLogin')
    expect(fn).toContain("redirect: '/workspace'")
    expect(fn).toContain('isUntouchedShowcase')
    expect(fn).toContain('stashHandoff')
    expect(fn.indexOf('isUntouchedShowcase')).toBeLessThan(fn.indexOf('stashHandoff'))
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

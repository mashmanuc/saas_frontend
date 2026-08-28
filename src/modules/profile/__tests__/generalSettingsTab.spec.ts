/**
 * Налаштування акаунта — три баги, знайдені власником на ПРОДІ 2026-08-28.
 *
 * Сценарій дослівно: «вимкнув Інтегралика, зайшов у налаштування, натиснув
 * застосувати — і мова переключилась на англійську… для поточного юзера це
 * як баг виглядає».
 *
 * Розібралось на три незалежні дефекти:
 *   1. часовий пояс порожній — `Europe/Kiev` у формі проти `Europe/Kyiv` у БД;
 *   2. мова стрибає — форма показувала серверне значення, а застосунок жив
 *      на localStorage['lang'], і «Зберегти» тихо ставало «Змінити мову»;
 *   3. підпис перемикача помічника вшитий українською — в англійському
 *      інтерфейсі лишався українським.
 *
 * Тести читають ДЖЕРЕЛО, а не монтують компонент: він тягне profileStore,
 * мережу й i18n, і перевірка перетворилась би на перевірку моків. Ціна —
 * прив'язка до тексту коду; вона свідома, бо кожен із трьох дефектів саме в
 * тексті коду й жив.
 */
import { describe, it, expect } from 'vitest'
import uk from '@/i18n/locales/uk.json'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'

async function readSrc(rel: string): Promise<string> {
  const fs = await import('node:fs/promises')
  const path = await import('node:path')
  return fs.readFile(path.resolve(process.cwd(), rel), 'utf-8')
}

const TAB = 'src/modules/profile/components/settings/GeneralSettingsTab.vue'
const I18N = 'src/i18n/index.js'

describe('1 · часовий пояс не порожній', () => {
  it('🔴 опція збігається з написанням бекенда', async () => {
    const src = await readSrc(TAB)
    expect(src).toContain('<option value="Europe/Kyiv">')
    expect(src).not.toContain('<option value="Europe/Kiev">')
  })

  it('старе написання нормалізується, а не лишає селект порожнім', async () => {
    const src = await readSrc(TAB)
    expect(src).toContain('function normalizeTz')
    expect(src).toContain("tz === 'Europe/Kiev' ? 'Europe/Kyiv'")
    expect(src).toContain('normalizeTz(settings.timezone)')
  })
})

describe('2 · мова не стрибає', () => {
  it('🔴 селект показує ДІЮЧУ мову, а не серверну', async () => {
    // Саме тут баг і жив: форма читала `settings.ui_language` першим, і
    // показувала користувачеві мову, якої він не бачить.
    const src = await readSrc(TAB)
    // ⚠️ Прив'язка саме до блоку ЗАВАНТАЖЕННЯ (`formData.value = {`), а не до
    // першого `ui_language:` у файлі: перше входження — це дефолт `ref({…})`,
    // і перша редакція тесту падала на справному коді, вказуючи не туди.
    const load = src.indexOf('formData.value = {')
    expect(load).toBeGreaterThan(0)
    const block = src.slice(load, load + 1400)
    const i = block.indexOf('ui_language:')
    expect(i).toBeGreaterThan(0)
    const expr = block.slice(i, block.indexOf('timezone:', i))
    expect(expr).toContain('i18n.global.locale.value')
    // Серверне значення лишається запасним — воно має йти ПІСЛЯ діючого.
    expect(expr.indexOf('i18n.global.locale.value'))
      .toBeLessThan(expr.indexOf('settings.ui_language'))
  })

  it('🔴 збереження йде через setI18nLocale, не прямим присвоєнням', async () => {
    // Пряме присвоєння не пише localStorage і не ставить <html lang>, тож
    // після F5 мова поверталась — зміна виглядала як незбережена.
    const src = await readSrc(TAB)
    expect(src).toContain('setLocale(formData.value.ui_language)')
    expect(src).not.toContain('i18n.global.locale.value = formData.value.ui_language')
  })

  it('🔴 `setLocale` у рантаймі — це псевдонім, який пише КЛЮЧ `lang`', async () => {
    // У проєкті два входи в i18n: `.js` (ключ `lang`) і `.ts` (ключ `locale`).
    // Vite резолвить `.js` раніше, тож виконується він. Якщо псевдонім
    // приберуть — імпорт перестане типізуватись, а якщо зміниться ключ,
    // збережена мова стане невидимою для getInitialLocale().
    const src = await readSrc(I18N)
    expect(src).toContain("export const STORAGE_KEY = 'lang'")
    expect(src).toContain('export const setLocale = setI18nLocale')
    const i = src.indexOf('export function setI18nLocale')
    expect(i).toBeGreaterThan(0)
    const body = src.slice(i, i + 400)
    expect(body).toContain('localStorage.setItem(STORAGE_KEY')
    expect(body).toContain("setAttribute('lang'")
  })
})

describe('3 · підпис помічника перекладається', () => {
  it('🔴 у розмітці ключ, а не вшитий текст', async () => {
    const src = await readSrc(TAB)
    expect(src).toContain("$t('users.settings.general.integralyk')")
    expect(src).toContain("$t('users.settings.general.integralykHint')")
    expect(src).not.toContain('>Помічник Інтегралик<')
  })

  it('ключі є в усіх трьох локалях і різні за мовами', () => {
    const g = (o: any) => o.users.settings.general
    for (const loc of [uk, en, ru]) {
      expect(g(loc).integralyk).toBeTruthy()
      expect(g(loc).integralykHint).toBeTruthy()
    }
    // Якщо en дорівнює uk — переклад забули, а тест без цього був би зелений.
    expect(g(en).integralyk).not.toBe(g(uk).integralyk)
    expect(g(ru).integralyk).not.toBe(g(uk).integralyk)
  })
})

describe('прапорець помічника не втрачається', () => {
  it('вимкнений стан читається як вимкнений', async () => {
    // `settings.integralyk_enabled !== false` дає true на undefined — тобто
    // якби бекенд поля не віддавав, вимкнення «поверталось» би саме собою.
    // Поле серіалізатор віддає (serializers_v1_settings.py:120), тож помилки
    // тут немає; тест стереже, щоб її не з'явилось.
    const src = await readSrc(TAB)
    expect(src).toContain('integralyk_enabled: settings.integralyk_enabled !== false')
  })
})

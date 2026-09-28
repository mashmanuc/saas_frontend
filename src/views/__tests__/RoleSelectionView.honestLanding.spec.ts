/**
 * Лендінг /start (сюди веде реклама; власник 2026-09-28 «так на всі»):
 *   • перший екран — увесь урок на одній дошці, не лише математика;
 *   • запис Replay вмикає вчитель — лендінг і превʼю посилання не обіцяють «запис кожного уроку»;
 *   • на телефоні спершу заголовок і кнопка, демо — під ними.
 */
import { describe, it, expect } from 'vitest'
import uk from '@/i18n/locales/uk.json'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'
import landingSource from '../RoleSelectionView.vue?raw'
import indexHtml from '../../../index.html?raw'

function texts(obj: unknown): string[] {
  if (typeof obj === 'string') return [obj]
  if (obj && typeof obj === 'object') return Object.values(obj).flatMap(texts)
  return []
}

// Формулювання «запис є завжди» — неправда: запис вмикає вчитель кнопкою «Записати урок».
const FALSE_RECORDING = [
  /запис кожного уроку/i, /повн\S* (запис|збереження)/i, /зберігається повністю/i, /повністю зберігається/i,
  /full action-level recording/i, /whole lesson is saved/i, /saved in full/i,
  /запись каждого урока/i, /полн\S* (запись|сохранение)/i, /сохраняется полностью/i, /полностью сохраняется/i,
]

describe('лендінг /start: чесний перший екран', () => {
  it('тексти лендінгу (uk, en, ru) не обіцяють запис кожного уроку', () => {
    for (const [locale, messages] of [['uk', uk], ['en', en], ['ru', ru]] as const) {
      const all = texts((messages as Record<string, unknown>).roleSelection)
      for (const pattern of FALSE_RECORDING) {
        expect(all.filter((s) => pattern.test(s)), `${locale}: ${pattern}`).toEqual([])
      }
    }
  })

  it('превʼю посилання (опис сторінки, Telegram) — так само', () => {
    const descriptions = [...indexHtml.matchAll(/<meta (?:name="description"|property="(?:og|twitter):description") content="([^"]*)"/g)]
      .map((m) => m[1])
    expect(descriptions).toHaveLength(3)
    for (const d of descriptions) {
      expect(d).not.toMatch(/повним збереженням/)
      expect(d).toContain('коли він потрібен')
    }
  })

  it('перший екран — урок на одній дошці, математика — приклад', () => {
    const hero = (uk as { roleSelection: { hero: Record<string, string> } }).roleSelection.hero
    expect(hero.title).toBe('Увесь урок —\nна одній дошці')
    expect(hero.subtitle).toContain('з будь-якого предмета')
    expect(hero.subtitle).toContain('Для математики')
  })

  it('на телефоні демо не стоїть над заголовком', () => {
    const mobile = landingSource.slice(landingSource.indexOf('@media (max-width: 767px)'))
    const demoRule = mobile.slice(mobile.indexOf('.hero-demo {'), mobile.indexOf('}', mobile.indexOf('.hero-demo {')))
    expect(demoRule).not.toMatch(/order:\s*-1/)
  })
})

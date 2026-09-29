/**
 * «Допомога» → «Що таке M4SH і як почати» → блок «Що де в меню» (власник 2026-09-29:
 * рукописний гайд «тут я роблю…» біля кожного пункту меню зрозуміліший за довгий текст).
 *
 * Стереже: назви й адреси в блоці — ТІ САМІ, що в бічному меню (`config/menu.js`,
 * `sidebar.item.*`), і в тому самому порядку, обома мовами. Перейменують пункт чи змінять
 * адресу — тест упаде, а не гайд мовчки розійдеться з меню. Блок стоїть перед «Три кроки…»:
 * спершу «що де», потім «як». Назва — посилання: перехід роутером, без перезавантаження.
 */
import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import en from '../../../i18n/locales/en.json'
import ru from '../../../i18n/locales/ru.json'
import { SECTIONED_MENU_BY_ROLE } from '../../../config/menu.js'
import { HELP_SECTIONS } from '../data/helpArticles'
import { HELP_SECTIONS_EN } from '../data/helpArticles.en'
import { HELP_SECTIONS_RU } from '../data/helpArticles.ru'

const push = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { slug: 'vstup' } }),
  useRouter: () => ({ push }),
}))

import HelpView from '../views/HelpView.vue'

const MENU_KEYS = ['schedule', 'myLessons', 'myBoards', 'myReplays', 'materials', 'remote', 'myStudents'] as const

function intro(sections: typeof HELP_SECTIONS) {
  const article = sections[0].articles.find((a) => a.slug === 'vstup')!
  return new DOMParser().parseFromString(article.body, 'text/html')
}

const menuLabels = (locale: unknown) =>
  MENU_KEYS.map((key) => (locale as { sidebar: { item: Record<string, string> } }).sidebar.item[key])

/** Адреси пунктів із самого меню вчителя. */
const menuRoutes = () => {
  const items = (SECTIONED_MENU_BY_ROLE as { tutor: Array<{ items: Array<{ label: string; to: string }> }> })
    .tutor.flatMap((section) => section.items)
  return MENU_KEYS.map((key) => items.find((item) => item.label === `sidebar.item.${key}`)?.to)
}

describe.each([
  ['uk', HELP_SECTIONS, uk, 'Що де в меню', 'Три кроки до першого уроку'],
  ['en', HELP_SECTIONS_EN, en, "What's where in the menu", 'Three steps to your first lesson'],
  ['ru', HELP_SECTIONS_RU, ru, 'Что где в меню', 'Три шага до первого урока'],
] as const)('%s · «Що де в меню»', (_lang, sections, locale, heading, steps) => {
  it('назви пунктів — точно як у бічному меню й у тому самому порядку', () => {
    const doc = intro(sections)
    const names = [...doc.querySelectorAll('dl.help-menu-map dt')].map((dt) => dt.textContent!.trim())
    expect(names).toEqual(menuLabels(locale))
  })

  it('кожна назва веде туди ж, куди пункт меню', () => {
    const doc = intro(sections)
    const hrefs = [...doc.querySelectorAll('dl.help-menu-map dt a')].map((a) => a.getAttribute('href'))
    expect(menuRoutes().every(Boolean)).toBe(true)
    expect(hrefs).toEqual(menuRoutes())
  })

  it('у кожного пункту — пояснення «що я тут роблю»', () => {
    const doc = intro(sections)
    const texts = [...doc.querySelectorAll('dl.help-menu-map dd')].map((dd) => dd.textContent!.trim())
    expect(texts).toHaveLength(MENU_KEYS.length)
    expect(texts.every((t) => t.length > 10)).toBe(true)
  })

  it('блок — під вступом і перед «Три кроки…»', () => {
    const doc = intro(sections)
    const headings = [...doc.querySelectorAll('h3')].map((h) => h.textContent!.trim())
    expect(headings.indexOf(heading)).toBeGreaterThanOrEqual(0)
    expect(headings.indexOf(heading)).toBeLessThan(headings.indexOf(steps))
    const map = doc.querySelector('dl.help-menu-map')!
    expect(map.previousElementSibling?.textContent?.trim()).toBe(heading)
  })
})

it('uk · слова власника з рукописного гайда + два уточнення (запис, пульт)', () => {
  const texts = [...intro(HELP_SECTIONS).querySelectorAll('dl.help-menu-map dd')].map((dd) => dd.textContent!.trim())
  expect(texts).toEqual([
    'тут я зберігаю розклад моїх занять',
    'тут я проводжу уроки та заходи',
    'тут я готуюсь до уроків',
    "тут зберігаю мої записи — вони з'являються, коли на уроці я вмикаю «Записати урок»",
    'тут я додаю і зберігаю матеріали',
    'відкриваю на телефоні, щоб керувати уроком — пульт працює на уроці, а не в Студії',
    'тут я запрошую учнів і з ними спілкуюсь',
  ])
  // Назва кнопки запису — та сама, що на дошці.
  expect(texts[3]).toContain(`«${(uk as { winterboard: { recording: { start: string } } }).winterboard.recording.start}»`)
})

describe('HelpView · перехід з «Що де в меню»', () => {
  const mountHelp = () => mount(HelpView, {
    attachTo: document.body,
    global: {
      plugins: [createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })],
    },
  })

  it('клік по назві — перехід роутером у розділ, без перезавантаження', async () => {
    push.mockClear()
    const w = mountHelp()
    const link = w.find('.help-menu-map a[href="/winterboard/replays"]')
    expect(link.exists()).toBe(true)
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    link.element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(push).toHaveBeenCalledWith('/winterboard/replays')
    w.unmount()
  })

  it('Ctrl-клік (нова вкладка) — як звичайне посилання, роутер не чіпаємо', () => {
    push.mockClear()
    const w = mountHelp()
    const link = w.find('.help-menu-map a[href="/remote"]')
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true })
    link.element.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(push).not.toHaveBeenCalled()
    w.unmount()
  })

  it('ru (власник 2026-09-29) — шапка й статті російською, а не українською', () => {
    const w = mount(HelpView, {
      global: {
        plugins: [createI18n({ legacy: false, locale: 'ru', fallbackLocale: 'uk', messages: { uk, ru } as never })],
      },
    })
    expect(w.text()).toContain('Помощь')
    expect(w.text()).toContain('Что такое M4SH и как начать')
    expect(w.find('.help-menu-map a[href="/remote"]').text()).toBe('Пульт для телефона')
    expect(w.text()).not.toContain('Що таке M4SH і як почати')
    expect(w.text()).not.toContain('Допомога')
    w.unmount()
  })
})

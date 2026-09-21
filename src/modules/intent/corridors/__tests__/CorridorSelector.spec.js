/**
 * CorridorSelector — один компонент для палітри й пульта (ТЗ 2026-09-17 §4.1–4.2).
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../../i18n/locales/uk.json'
import en from '../../../../i18n/locales/en.json'
import CorridorSelector from '../CorridorSelector.vue'

const REGISTRY = {
  subjects: [
    { id: 'general', labels: { uk: 'Загальний', en: 'General' } },
    { id: 'math', labels: { uk: 'Математика', en: 'Mathematics' } },
    { id: 'history', labels: { uk: 'Історія', en: 'History' } },
  ],
  lockable_subjects: ['math', 'history'],
  languages: [{ id: 'uk', labels: { uk: 'Українська', en: 'Ukrainian' } }, { id: 'en', labels: { uk: 'English', en: 'English' } }],
}

const AUTO_SUBJECT = { mode: 'auto', resolved: 'history', locked: null, source: 'lesson' }
const AUTO_LANG = { mode: 'auto', content: 'en', locked: null, source: 'explicit_command' }

function mountSelector(props = {}, locale = 'uk') {
  const i18n = createI18n({ legacy: false, locale, fallbackLocale: 'uk', messages: { uk, en } })
  return mount(CorridorSelector, {
    props: { registry: REGISTRY, subject: AUTO_SUBJECT, language: AUTO_LANG, ...props },
    global: { plugins: [i18n] },
  })
}

describe('CorridorSelector', () => {
  it('«Предмет: Авто · Історія» і «Мова матеріалу: Авто · English»', () => {
    const w = mountSelector()
    expect(w.get('[data-testid="corridor-subject-chip"]').text()).toBe('Предмет: Авто · Історія')
    expect(w.get('[data-testid="corridor-language-chip"]').text()).toBe('Мова матеріалу: Авто · English')
    expect(w.get('[data-testid="corridor-subject-chip"]').attributes('title')).toBe('з уроку')
  })

  it('зафіксований вибір — з 🔒', () => {
    const w = mountSelector({
      subject: { mode: 'locked', resolved: 'history', locked: 'history', source: 'explicit_remote' },
      language: { mode: 'locked', content: 'en', locked: 'en', source: 'explicit_palette' },
    })
    expect(w.get('[data-testid="corridor-subject-value"]').text()).toBe('Історія 🔒')
    expect(w.get('[data-testid="corridor-language-value"]').text()).toBe('English 🔒')
  })

  it('невідомий предмет — «Авто · Загальний», не вигадана назва', () => {
    const w = mountSelector({ subject: { mode: 'auto', resolved: 'astrology', locked: null, source: 'fallback' } })
    expect(w.get('[data-testid="corridor-subject-value"]').text()).toBe('Авто · Загальний')
  })

  it('меню: «Авто» + лише предмети, які можна зафіксувати; мови uk/en', async () => {
    const w = mountSelector()
    await w.get('[data-testid="corridor-subject-chip"]').trigger('click')
    const items = w.findAll('[data-testid="corridor-subject-menu"] button').map(b => b.text())
    expect(items).toEqual(['Авто', 'Математика', 'Історія'])
    await w.get('[data-testid="corridor-language-chip"]').trigger('click')
    const langs = w.findAll('[data-testid="corridor-language-menu"] button').map(b => b.text())
    expect(langs).toEqual(['Авто', 'Українська', 'English'])
  })

  it('вибір лише повідомляється подією — сам компонент нічого не пише', async () => {
    const w = mountSelector()
    await w.get('[data-testid="corridor-subject-chip"]').trigger('click')
    await w.get('[data-testid="corridor-subject-math"]').trigger('click')
    await w.get('[data-testid="corridor-language-chip"]').trigger('click')
    await w.get('[data-testid="corridor-language-auto"]').trigger('click')
    expect(w.emitted('select-subject')).toEqual([['math']])
    expect(w.emitted('select-language')).toEqual([['auto']])
  })

  it('read-only і вимкнений стан не відкривають меню', async () => {
    const w = mountSelector({ readonly: true })
    expect(w.get('[data-testid="corridor-subject-chip"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid="corridor-language-chip"]').attributes('disabled')).toBeDefined()
  })

  it('англійський інтерфейс — ті самі id, англійські підписи', () => {
    const w = mountSelector({}, 'en')
    expect(w.get('[data-testid="corridor-subject-chip"]').text()).toBe('Subject: Auto · History')
    expect(w.get('[data-testid="corridor-language-chip"]').text()).toBe('Material language: Auto · English')
  })

  it('помилку показує словами', () => {
    const w = mountSelector({ errorKey: 'corridorSyncBlocked' })
    expect(w.get('[data-testid="corridor-error"]').text()).toContain('не синхронізована')
  })
})

// ── Предмети вчителя (2026-09-21): профіль ховає предмети зі СПИСКУ, а не з уроку ──
describe('CorridorSelector · прихований профілем предмет', () => {
  // Історик бачить лише «Історію», але разово будує графік → урок у математиці.
  const HISTORIAN = {
    ...REGISTRY,
    subjects: REGISTRY.subjects.filter(s => s.id !== 'math'),
    lockable_subjects: ['history'],
    available_subjects: REGISTRY.subjects,
  }

  it('поточний предмет підписано правдиво, хоч його й немає у списку вибору', () => {
    const w = mountSelector({ registry: HISTORIAN,
      subject: { mode: 'auto', resolved: 'math', locked: null, source: 'phrase' } })
    expect(w.get('[data-testid="corridor-subject-chip"]').text()).toBe('Предмет: Авто · Математика')
  })

  it('у списку вибору прихованого предмета немає', async () => {
    const w = mountSelector({ registry: HISTORIAN })
    await w.get('[data-testid="corridor-subject-chip"]').trigger('click')
    expect(w.find('[data-testid="corridor-subject-math"]').exists()).toBe(false)
    expect(w.find('[data-testid="corridor-subject-history"]').exists()).toBe(true)
  })

  it('без `available_subjects` (старий сервер) — як раніше, з `subjects`', () => {
    const w = mountSelector()
    expect(w.get('[data-testid="corridor-subject-chip"]').text()).toBe('Предмет: Авто · Історія')
  })

  it('джерело «з профілю» має людський підпис українською й англійською', () => {
    const subject = { mode: 'auto', resolved: 'history', locked: null, source: 'teacher_profile' }
    expect(mountSelector({ subject }).get('[data-testid="corridor-subject-chip"]').attributes('title'))
      .toBe('з вашого профілю')
    expect(mountSelector({ subject }, 'en').get('[data-testid="corridor-subject-chip"]').attributes('title'))
      .toBe('from your profile')
  })
})

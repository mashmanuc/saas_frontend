/**
 * Вибір вигляду помічника (ТЗ TZ_INTEGRALYK_INTEGRALKA_VARIANT §1, §3, §5): одне налаштування акаунта
 * для профілю й панелі; застосовується одразу; відмова сервера — попередній вибір і повідомлення;
 * вимикач видимості — окремо. Справжні компонент, Pinia й переклади uk; підмінено лише запит.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'

const api = vi.hoisted(() => ({ updateUserSettings: vi.fn(), getUserSettings: vi.fn() }))
vi.mock('@/api/users', () => api)

import AssistantLookPicker from '../AssistantLookPicker.vue'
import { useProfileStore } from '@/modules/profile/store/profileStore'
import { useAssistantT } from '../assistantLook'
import { defineComponent, h } from 'vue'

let pinia: ReturnType<typeof createPinia>
let i18n: ReturnType<typeof createI18n>

function mountPicker(variant: 'full' | 'compact' = 'full') {
  return mount(AssistantLookPicker, { props: { variant }, global: { plugins: [pinia, i18n] } })
}

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk, en, ru }, missingWarn: false })
  api.updateUserSettings.mockReset()
  api.updateUserSettings.mockImplementation(async (p: Record<string, unknown>) => ({ integralyk_enabled: true, ...p }))
  useProfileStore().settings = { integralyk_enabled: true, integralyk_appearance: 'integralyk' }
})

describe('вибір вигляду в профілі', () => {
  it('два варіанти з прев’ю; поточний позначено', () => {
    const w = mountPicker()
    const opts = w.findAll('[role="radio"]')
    expect(opts.map((o) => o.text())).toEqual(['Інтегралик', 'Інтегралка'])
    expect(opts[0].attributes('aria-checked')).toBe('true')
    expect(opts[1].find('.alp-pic').html()).toContain('itg-bow')
  })

  it('«Інтегралка» — одразу в UI, на сервер — одне поле', async () => {
    const w = mountPicker()
    await w.find('[data-testid="assistant-look-integralka"]').trigger('click')
    expect(useProfileStore().settings.integralyk_appearance).toBe('integralka')   // ще до відповіді
    await flushPromises()
    expect(api.updateUserSettings).toHaveBeenCalledWith({ integralyk_appearance: 'integralka' })
    expect(w.find('[data-testid="assistant-look-integralka"]').attributes('aria-checked')).toBe('true')
  })

  it('відмова сервера: попередній вибір повернуто, причина видна', async () => {
    api.updateUserSettings.mockRejectedValueOnce(new Error('500'))
    const w = mountPicker()
    await w.find('[data-testid="assistant-look-integralka"]').trigger('click')
    await flushPromises()
    expect(useProfileStore().settings.integralyk_appearance).toBe('integralyk')
    expect(w.find('[role="alert"]').text()).toBe(uk.users.settings.general.assistantLook.saveError)
    expect(w.emitted('error')).toHaveLength(1)
  })

  it('вигляд не чіпає вимикач видимості: прихований помічник зберігає вибір', async () => {
    useProfileStore().settings = { integralyk_enabled: false, integralyk_appearance: 'integralyk' }
    const w = mountPicker()
    await w.find('[data-testid="assistant-look-integralka"]').trigger('click')
    await flushPromises()
    expect(useProfileStore().settings).toMatchObject({ integralyk_enabled: false, integralyk_appearance: 'integralka' })
    expect(api.updateUserSettings).toHaveBeenCalledWith({ integralyk_appearance: 'integralka' })
  })
})

describe('у формі (v-model): лише чернетка, зберігає форма', () => {
  it('вибір змінює чернетку й нічого не зберігає', async () => {
    const w = mount(AssistantLookPicker, {
      props: { variant: 'full', modelValue: 'integralyk' },
      global: { plugins: [pinia, i18n] },
    })
    await w.find('[data-testid="assistant-look-integralka"]').trigger('click')
    await flushPromises()
    expect(w.emitted('update:modelValue')).toEqual([['integralka']])
    expect(api.updateUserSettings).not.toHaveBeenCalled()
    expect(useProfileStore().settings.integralyk_appearance).toBe('integralyk')
  })
})

describe('перемикач у панелі й синхронізація', () => {
  it('компактна кнопка показує ІНШИЙ вигляд і перемикає на нього', async () => {
    const w = mountPicker('compact')
    const btn = w.find('[data-testid="assistant-look-switch"]')
    expect(btn.attributes('title')).toBe('Вигляд помічника: перемкнути на «Інтегралка»')
    expect(btn.html()).toContain('itg-bow')
    await btn.trigger('click')
    await flushPromises()
    expect(useProfileStore().settings.integralyk_appearance).toBe('integralka')
    expect(w.find('[data-testid="assistant-look-switch"]').attributes('title'))
      .toBe('Вигляд помічника: перемкнути на «Інтегралик»')
  })

  it('профіль і панель — одне налаштування: зміна в панелі одразу видна в профілі', async () => {
    const profile = mountPicker('full')
    const panel = mountPicker('compact')
    await panel.find('[data-testid="assistant-look-switch"]').trigger('click')
    await flushPromises()
    expect(profile.find('[data-testid="assistant-look-integralka"]').attributes('aria-checked')).toBe('true')
  })
})

describe('рядки про помічника у вибраному вигляді', () => {
  function probe(keys: string[]) {
    return mount(defineComponent({
      setup() {
        const { at } = useAssistantT()
        return () => h('div', keys.map((k) => h('p', at(k))))
      },
    }), { global: { plugins: [pinia, i18n] } })
  }

  it('«Інтегралка прочитала», «Інтегралці — на наступну сторінку…»; інші ключі — без змін', async () => {
    useProfileStore().settings = { integralyk_appearance: 'integralka' }
    const w = probe(['winterboard.imageReading.title', 'winterboard.remote.assistant.placeholder', 'winterboard.imageReading.save'])
    const ps = w.findAll('p').map((p) => p.text())
    expect(ps[0]).toBe('Інтегралка прочитала')
    // Власник 2026-10-18: на пульті мінімальний підпис — текст іде на наступну сторінку.
    expect(ps[1]).toBe('Інтегралці — на наступну сторінку…')
    expect(ps[2]).toBe(uk.winterboard.imageReading.save)
  })

  it('Інтегралик — як і було', () => {
    const w = probe(['winterboard.imageReading.title'])
    expect(w.find('p').text()).toBe('Інтегралик прочитав')
  })

  it('ru без власного рядка збагачення — варіант з uk, як і базовий (без суміші імен)', () => {
    ;(i18n.global.locale as unknown as { value: string }).value = 'ru'
    useProfileStore().settings = { integralyk_appearance: 'integralka' }
    expect(probe(['winterboard.enrich.questionAsk']).find('p').text()).toBe('Спитати Інтегралку')
    expect(probe(['winterboard.remote.assistant.thinking']).find('p').text()).toBe('Интегралка думает…')
  })
})

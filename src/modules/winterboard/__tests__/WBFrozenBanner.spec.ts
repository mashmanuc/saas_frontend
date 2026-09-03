import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import WBFrozenBanner from '../components/replay/WBFrozenBanner.vue'

const i18n = createI18n({
  legacy: false, locale: 'uk',
  messages: { uk: { winterboard: { recording: { frozenBanner: {
    title: 'Запис уроку завершено', hint: 'Нічого не зберігається', action: 'Новий запис',
    busy: 'Запускаю…', readOnlyOnly: 'Лише перегляд',
  } } } } },
})

function mountBanner(props: Record<string, unknown>) {
  return mount(WBFrozenBanner, { props: { visible: true, canRestart: true, ...props }, global: { plugins: [i18n] } })
}

describe('WBFrozenBanner', () => {
  it('невидимий, коли visible=false', () => {
    expect(mountBanner({ visible: false }).find('.wb-frozen-banner').exists()).toBe(false)
  })

  it('учителю: заголовок, підказка і кнопка «Новий запис», що емітить restart', async () => {
    const w = mountBanner({})
    expect(w.text()).toContain('Запис уроку завершено')
    expect(w.text()).toContain('Нічого не зберігається')
    await w.find('.wb-frozen-banner__btn').trigger('click')
    expect(w.emitted('restart')).toHaveLength(1)
  })

  it('busy → кнопка вимкнена і показує «Запускаю…»', () => {
    const w = mountBanner({ busy: true })
    const btn = w.find('.wb-frozen-banner__btn')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    expect(btn.text()).toBe('Запускаю…')
  })

  it('учню (canRestart=false): без кнопки, лише «Лише перегляд»', () => {
    const w = mountBanner({ canRestart: false })
    expect(w.find('.wb-frozen-banner__btn').exists()).toBe(false)
    expect(w.text()).toContain('Лише перегляд')
  })
})

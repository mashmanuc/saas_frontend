// «Зберегти як новий шаблон»: після успіху урок і пульт лишаються відкритими —
// «Відкрити в Моїх уроках» відкриває НОВУ вкладку, а не переходить (ТЗ §1 п. 4).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'

const push = vi.fn()
const resolve = vi.fn(() => ({ href: '/lessons/my' }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push, resolve }) }))

import LessonSavedSuccessModal from '../components/LessonSavedSuccessModal.vue'

function mountModal(kind: 'lesson' | 'template' | 'copy') {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  return mount(LessonSavedSuccessModal, {
    props: { modelValue: true, lessonTitle: 'Урок A — копія', kind },
    global: { plugins: [i18n], stubs: { teleport: true } },
  })
}

let openSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => { push.mockReset(); resolve.mockClear(); openSpy = vi.spyOn(window, 'open').mockImplementation(() => null) })
afterEach(() => { openSpy.mockRestore() })

describe('LessonSavedSuccessModal · kind="copy"', () => {
  it('тексти: «Шаблон збережено», назва, урок і пульт лишаються відкритими', () => {
    const w = mountModal('copy')
    expect(w.find('.lesson-saved-dialog__title').text()).toBe('Шаблон збережено')
    expect(w.find('.lesson-saved-dialog__body').text()).toContain('«Урок A — копія»')
    expect(w.find('[data-testid="saved-hint"]').text()).toBe('Урок і пульт лишаються відкритими.')
    expect(w.find('[data-testid="saved-continue"]').text()).toBe('Продовжити урок')
    expect(w.find('[data-testid="saved-open-list"]').text()).toBe('Відкрити в Моїх уроках')
  })

  it('«Відкрити в Моїх уроках» — нова вкладка; поточна сторінка (урок) не змінюється', async () => {
    const w = mountModal('copy')
    await w.find('[data-testid="saved-open-list"]').trigger('click')
    expect(openSpy).toHaveBeenCalledWith('/lessons/my', '_blank', 'noopener')
    expect(push).not.toHaveBeenCalled()
  })

  it('«Продовжити урок» лише закриває вікно', async () => {
    const w = mountModal('copy')
    await w.find('[data-testid="saved-continue"]').trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([false])
    expect(openSpy).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })
})

describe('LessonSavedSuccessModal · «Зберегти як урок» — як раніше', () => {
  it('«До списку» переходить у тій самій вкладці', async () => {
    const w = mountModal('lesson')
    await w.find('[data-testid="saved-open-list"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'MyLessons' })
    expect(openSpy).not.toHaveBeenCalled()
  })
})

// «Зберегти як новий шаблон» (ТЗ TZ_SAVE_FROM_LIVE_LESSON_AS_TEMPLATE; власник 2026-09-28):
// той самий діалог і API; момент знімка — «Зберегти шаблон»: beforeSave (бар'єр + блок дошки),
// afterSave — завжди; причини відмови словами; подвійний тап — одне збереження.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'

const saveLessonFromSession = vi.fn()
vi.mock('../api/lessonSaveApi', () => ({ lessonSaveApi: { saveLessonFromSession: (...a: any[]) => saveLessonFromSession(...a) } }))

import WBSaveLessonDialog from '../components/WBSaveLessonDialog.vue'

function mountDialog(props: Record<string, unknown> = {}) {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  return mount(WBSaveLessonDialog, {
    props: { modelValue: false, sessionId: 'sid-1', ...props },
    global: { plugins: [i18n], stubs: { teleport: true } },
  })
}
async function open(w: any, defaultTitle?: string) {
  await w.setProps({ modelValue: true, ...(defaultTitle !== undefined ? { defaultTitle } : {}) })
  await nextTick()
}
const saveBtn = (w: any) => w.find('.save-lesson-dialog__btn--save')
const errorText = (w: any) => (w.find('[data-testid="save-lesson-error"]').exists() ? w.find('[data-testid="save-lesson-error"]').text() : '')

beforeEach(() => { saveLessonFromSession.mockReset() })

describe('WBSaveLessonDialog · mode="copy"', () => {
  it('тексти копії й назва «— копія»', async () => {
    const w = mountDialog({ mode: 'copy' })
    await open(w, 'Урок: Нерівності — копія')
    expect(w.find('h2').text()).toBe('Зберегти як новий шаблон')
    expect(saveBtn(w).text()).toBe('Зберегти шаблон')
    expect((w.find('input').element as HTMLInputElement).value).toBe('Урок: Нерівності — копія')
  })

  it('бар’єр відмовив — запиту немає, причина у вікні, блок знято', async () => {
    const afterSave = vi.fn()
    const w = mountDialog({ mode: 'copy', beforeSave: vi.fn(async () => 'Не всі зміни дійшли до сервера'), afterSave })
    await open(w, 'Копія')
    await saveBtn(w).trigger('click')
    await flushPromises()
    expect(saveLessonFromSession).not.toHaveBeenCalled()
    expect(errorText(w)).toBe('Не всі зміни дійшли до сервера')
    expect(afterSave).toHaveBeenCalledTimes(1)
    expect(w.emitted('saved')).toBeUndefined()
  })

  it('успіх: beforeSave → API → afterSave (до «saved»), вікно закривається', async () => {
    const order: string[] = []
    saveLessonFromSession.mockImplementation(async () => { order.push('api'); return { id: 'L2', title: 'Копія' } })
    const w = mountDialog({
      mode: 'copy',
      beforeSave: vi.fn(async () => { order.push('before'); return null }),
      afterSave: vi.fn(() => { order.push('after') }),
    })
    await open(w, 'Копія')
    await saveBtn(w).trigger('click')
    await flushPromises()
    expect(order).toEqual(['before', 'api', 'after'])
    expect(w.emitted('saved')?.[0]).toEqual([{ id: 'L2', title: 'Копія' }])
    const closes = w.emitted('update:modelValue') ?? []
    expect(closes[closes.length - 1]).toEqual([false])
  })

  it.each([
    ['board_state_unavailable', 'Не вдалося підтвердити стан дошки на сервері'],
    ['plan_transfer_failed', 'Не вдалося зберегти план уроку'],
  ])('сервер відмовив (%s) — причина словами, вікно лишається, блок знято', async (code, text) => {
    saveLessonFromSession.mockRejectedValue({ response: { status: 503, data: { error: code } } })
    const afterSave = vi.fn()
    const w = mountDialog({ mode: 'copy', beforeSave: vi.fn(async () => null), afterSave })
    await open(w, 'Копія')
    await saveBtn(w).trigger('click')
    await flushPromises()
    expect(errorText(w)).toContain(text)
    expect(afterSave).toHaveBeenCalledTimes(1)
    expect(w.emitted('saved')).toBeUndefined()
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('немає зв’язку — окремий текст', async () => {
    saveLessonFromSession.mockRejectedValue(new Error('Network Error'))
    const w = mountDialog({ mode: 'copy', beforeSave: vi.fn(async () => null), afterSave: vi.fn() })
    await open(w, 'Копія')
    await saveBtn(w).trigger('click')
    await flushPromises()
    expect(errorText(w)).toContain('Немає зв’язку з сервером')
  })

  it('подвійний тап — одне збереження; посеред збереження вікно не закривається', async () => {
    let resolve!: (v: any) => void
    saveLessonFromSession.mockImplementation(() => new Promise((r) => { resolve = r }))
    const w = mountDialog({ mode: 'copy', beforeSave: vi.fn(async () => null), afterSave: vi.fn() })
    await open(w, 'Копія')
    // той самий тік (два швидкі тапи, повтор Enter): кнопку ще не вимкнено —
    // тримає лише перевірка на початку save()
    saveBtn(w).element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    saveBtn(w).element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    await saveBtn(w).trigger('click')   // а тепер уже вимкнена
    await flushPromises()
    expect(saveLessonFromSession).toHaveBeenCalledTimes(1)
    await w.find('.save-lesson-dialog__btn--cancel').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    resolve({ id: 'L3', title: 'Копія' })
    await flushPromises()
    expect(w.emitted('saved')).toHaveLength(1)
  })
})

describe('WBSaveLessonDialog · «Зберегти як урок» без хуків — як раніше', () => {
  it('тексти уроку, API один раз, afterSave немає', async () => {
    saveLessonFromSession.mockResolvedValue({ id: 'L1', title: 'Урок' })
    const w = mountDialog()
    await open(w, 'Урок')
    expect(w.find('h2').text()).toBe('Зберегти як урок')
    await saveBtn(w).trigger('click')
    await flushPromises()
    expect(saveLessonFromSession).toHaveBeenCalledWith({ session_id: 'sid-1', title: 'Урок' })
    expect(w.emitted('saved')?.[0]).toEqual([{ id: 'L1', title: 'Урок' }])
  })
})

/**
 * Учень без акаунта і «звідки учень» (власник 2026-10-14): «треба і своїх учнів, і учнів з платформи Буки,
 * де я працюю, записувати, щоб в мене графік був».
 * Додати — імʼя обовʼязкове, «з платформи» — назва обовʼязкова; змінити — імʼя лише учня без акаунта;
 * відмова сервера — словами у вікні, нічого не зберігається.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../../i18n/locales/uk.json'
import PlaceholderStudentDialog from '../PlaceholderStudentDialog.vue'

vi.mock('../../../../api/relations', () => ({
  default: { createPlaceholderStudent: vi.fn(), updateRelationDetails: vi.fn() },
}))
import relationsApi from '../../../../api/relations'

const P = (uk as unknown as { dashboard: { tutor: { placeholder: Record<string, any> } } }).dashboard.tutor.placeholder
const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

function dialog(relation: unknown = null) {
  return mount(PlaceholderStudentDialog, {
    props: { open: true, relation },
    global: { plugins: [i18n()], stubs: { teleport: true, transition: false } },
    attachTo: document.body,
  })
}
const save = (w: ReturnType<typeof dialog>) => w.find('[data-testid="placeholder-student-save"]')

describe('PlaceholderStudentDialog', () => {
  beforeEach(() => {
    vi.mocked(relationsApi.createPlaceholderStudent).mockReset()
    vi.mocked(relationsApi.updateRelationDetails).mockReset()
  })

  it('додати: без імені «Зберегти» вимкнено; «з платформи» без назви — теж; зберегли — імʼя, звідки, нотатка', async () => {
    vi.mocked(relationsApi.createPlaceholderStudent).mockResolvedValueOnce({ id: 9 } as never)
    const w = dialog()
    expect(save(w).attributes('disabled')).toBeDefined()
    await w.find('[data-testid="placeholder-student-name"] input, input#placeholder-student-name').setValue('  Оля Коваль ')
    expect(save(w).attributes('disabled')).toBeUndefined()
    await w.find('[data-testid="placeholder-source-platform"]').setValue(true)
    expect(save(w).attributes('disabled')).toBeDefined()           // назва платформи обовʼязкова
    await w.find('input#placeholder-student-platform').setValue('Платформа А')
    await w.find('textarea').setValue('5 клас')
    await save(w).trigger('click')
    await flushPromises()
    expect(relationsApi.createPlaceholderStudent).toHaveBeenCalledWith({ name: 'Оля Коваль', external_platform: 'Платформа А', notes: '5 клас' })
    expect(w.emitted('saved')).toHaveLength(1)
    w.unmount()
  })

  it('«мій учень» — платформа порожня', async () => {
    vi.mocked(relationsApi.createPlaceholderStudent).mockResolvedValueOnce({ id: 9 } as never)
    const w = dialog()
    await w.find('input#placeholder-student-name').setValue('Петро')
    await save(w).trigger('click')
    await flushPromises()
    expect(relationsApi.createPlaceholderStudent).toHaveBeenCalledWith({ name: 'Петро', external_platform: '', notes: '' })
    w.unmount()
  })

  it('змінити учня з акаунтом: імʼя не редагується й не надсилається; звідки й нотатка — так', async () => {
    vi.mocked(relationsApi.updateRelationDetails).mockResolvedValueOnce({ id: 5 } as never)
    const w = dialog({ id: 5, notes: '', external_platform: '', student: { full_name: 'Іван Сидоренко', is_placeholder: false } })
    expect(w.find('input#placeholder-student-name').exists()).toBe(false)
    expect(w.text()).toContain('Іван Сидоренко')
    await w.find('[data-testid="placeholder-source-platform"]').setValue(true)
    await w.find('input#placeholder-student-platform').setValue('Платформа А')
    await save(w).trigger('click')
    await flushPromises()
    expect(relationsApi.updateRelationDetails).toHaveBeenCalledWith(5, { external_platform: 'Платформа А', notes: '' })
    w.unmount()
  })

  it('змінити учня без акаунта: імʼя підставлено й редагується; платформа з картки', async () => {
    vi.mocked(relationsApi.updateRelationDetails).mockResolvedValueOnce({ id: 7 } as never)
    const w = dialog({ id: 7, notes: 'n', external_platform: 'Платформа А', student: { full_name: 'Оля Коваль', is_placeholder: true } })
    const name = w.find('input#placeholder-student-name')
    expect((name.element as HTMLInputElement).value).toBe('Оля Коваль')
    expect((w.find('input#placeholder-student-platform').element as HTMLInputElement).value).toBe('Платформа А')
    await name.setValue('Ольга Коваль')
    await save(w).trigger('click')
    await flushPromises()
    expect(relationsApi.updateRelationDetails).toHaveBeenCalledWith(7, { name: 'Ольга Коваль', external_platform: 'Платформа А', notes: 'n' })
    w.unmount()
  })

  it('сервер відмовив — причина словами у вікні, «збережено» не надіслано', async () => {
    vi.mocked(relationsApi.createPlaceholderStudent).mockRejectedValueOnce({ response: { status: 400, data: { error: 'platform_too_long' } } })
    const w = dialog()
    await w.find('input#placeholder-student-name').setValue('Оля')
    await save(w).trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="placeholder-student-error"]').text()).toBe(P.errors.platform_too_long)
    expect(w.emitted('saved')).toBeUndefined()
    vi.mocked(relationsApi.createPlaceholderStudent).mockRejectedValueOnce(new Error('offline'))
    await save(w).trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="placeholder-student-error"]').text()).toBe(P.errors.failed)
    w.unmount()
  })
})

/**
 * «Архівувати» прибирає учня з розкладу до кінця (власник 2026-10-14, пункт 2): є майбутні уроки — учитель
 * бачить, у кого скільки, і вирішує: скасувати й архівувати / архівувати й лишити / не архівувати.
 * Запит архіву несе прапорець лише тоді, коли вирішено скасувати.
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../../i18n/locales/uk.json'
import ArchiveFutureLessonsDialog from '../ArchiveFutureLessonsDialog.vue'

vi.mock('@/utils/apiClient', () => ({ default: { post: vi.fn(async () => ({})) } }))
vi.mock('../../../../utils/apiClient', () => ({ default: { post: vi.fn(async () => ({})) } }))
import apiClient from '../../../../utils/apiClient'
import relationsApi from '../../../../api/relations'

const A = (uk as unknown as { dashboard: { tutor: { archiveLessons: Record<string, string> } } }).dashboard.tutor.archiveLessons
const fill = (s: string, p: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(p[k]))
const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

describe('ArchiveFutureLessonsDialog', () => {
  it('у кого скільки уроків; три виходи', async () => {
    const w = mount(ArchiveFutureLessonsDialog, {
      props: { open: true, rows: [{ id: 3, name: 'Оля Коваль', future_lessons: 3 }], total: 3 },
      global: { plugins: [i18n()], stubs: { teleport: true, transition: false } },
      attachTo: document.body,
    })
    expect(w.text()).toContain('Оля Коваль')
    expect(w.text()).toContain(fill(A.count, { n: 3 }))
    expect(w.find('[data-testid="archive-lessons-cancel"]').text()).toBe(fill(A.cancel, { n: 3 }))
    await w.find('[data-testid="archive-lessons-cancel"]').trigger('click')
    await w.find('[data-testid="archive-lessons-keep"]').trigger('click')
    await w.find('[data-testid="archive-lessons-abort"]').trigger('click')
    expect(w.emitted('choose')).toEqual([[true], [false]])
    expect(w.emitted('close')).toHaveLength(1)
    w.unmount()
  })
})

describe('relationsApi — архів і майбутні уроки', () => {
  it('прапорець скасування — лише коли вирішено скасувати', async () => {
    await relationsApi.bulkArchiveTutorRelations([1, 2])
    await relationsApi.bulkArchiveTutorRelations([1], { cancelFutureLessons: true })
    await relationsApi.futureLessons([1])
    const calls = vi.mocked(apiClient.post).mock.calls
    expect(calls[0][1]).toEqual({ ids: [1, 2] })
    expect(calls[1][1]).toEqual({ ids: [1], cancel_future_lessons: true })
    expect(String(calls[2][0])).toContain('/tutor/relations/future-lessons/')
    expect(calls[2][1]).toEqual({ ids: [1] })
  })
})

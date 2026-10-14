/**
 * «👤 Видно учню» — рішення власника 2026-10-14: запис уроку з учнем за замовчуванням видно ЦЬОМУ
 * учневі (у кабінеті, не за посиланням); учитель може сховати.
 *
 * Стережемо те, що бачать люди:
 *  - учитель: після запису й у меню картки є режим «👤 Видно учню» лише для уроку з учнем, і в цьому
 *    режимі не показується посилання (воно для учня не відкривається);
 *  - учень: на своїй сторінці бачить розділ «Мої уроки» зі своїми записами й переходом до перегляду.
 *
 * Тексти — з РЕАЛЬНОГО `uk.json`, як у replayAccessHonesty.spec.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

import uk from '@/i18n/locales/uk.json'

const { getReplay, changeReplayVisibility } = vi.hoisted(() => ({
  getReplay: vi.fn(),
  changeReplayVisibility: vi.fn(),
}))

vi.mock('../api/replayLifecycleApi', async () => {
  const actual = await vi.importActual<typeof import('../api/replayLifecycleApi')>('../api/replayLifecycleApi')
  return { getReplay, changeReplayVisibility, isLinkVisibility: actual.isLinkVisibility }
})

import WBRecordingDonePrompt from '../components/replay/WBRecordingDonePrompt.vue'
import ReplayCard from '../components/replay/ReplayCard.vue'
import StudentLessonRecordsSection from '@/modules/dashboard/components/StudentLessonRecordsSection.vue'
import { isLinkVisibility } from '../api/replayLifecycleApi'

const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })
// tests/setup.js глобально глушить router-link голим <a> — перекриваємо заглушкою, що бачить `to`.
const stubs = { 'router-link': RouterLinkStub }

function replayFixture(over: Record<string, unknown> = {}) {
  return {
    id: 'r-1', title: 'Урок', recorded_at: '2026-10-14T10:00:00Z', duration_ms: 60000,
    status: 'active', visibility: 'student', public_token: 'tok-1', folder: null, view_count: 0,
    lesson_student_id: 5, archived_at: null, trashed_at: null,
    ...over,
  }
}

beforeEach(() => {
  getReplay.mockReset()
  changeReplayVisibility.mockReset()
})

describe('isLinkVisibility — дзеркало BE LINK_VISIBILITIES', () => {
  it('за посиланням відкриваються лише «за посиланням» і «відкритий»', () => {
    expect(isLinkVisibility('unlisted')).toBe(true)
    expect(isLinkVisibility('public')).toBe(true)
    expect(isLinkVisibility('student')).toBe(false)
    expect(isLinkVisibility('private')).toBe(false)
  })
})

describe('після запису (WBRecordingDonePrompt)', () => {
  async function mountPrompt(over: Record<string, unknown> = {}) {
    getReplay.mockResolvedValue(replayFixture(over))
    const w = mount(WBRecordingDonePrompt, {
      props: { visible: true, replayId: 'r-1' },
      global: { plugins: [i18n], stubs },
    })
    await flushPromises()
    return w
  }

  it('урок з учнем: режим «👤 Видно учню» обрано, посилання не показано', async () => {
    const w = await mountPrompt()
    const active = w.find('.wb-rec-done__vis-btn--active')
    expect(active.text()).toContain('Видно учню')
    expect(w.find('.wb-rec-done__link').exists()).toBe(false)
  })

  it('дошка без учня: режиму учня немає', async () => {
    const w = await mountPrompt({ visibility: 'private', lesson_student_id: null })
    expect(w.text()).not.toContain('Видно учню')
  })

  it('«за посиланням» — посилання є', async () => {
    const w = await mountPrompt({ visibility: 'unlisted' })
    expect(w.find('.wb-rec-done__link').exists()).toBe(true)
  })
})

describe('картка запису в «Моїх записах» (ReplayCard)', () => {
  function mountCard(over: Record<string, unknown> = {}) {
    return mount(ReplayCard, {
      props: { replay: replayFixture(over) as never, viewMode: 'grid', menuOpen: true, copied: false },
      global: { plugins: [i18n], stubs, directives: { clickOutside: {} } },
    })
  }

  it('позначка «👤 Видно учню» і без кнопки «Поділитися» посиланням', () => {
    const w = mountCard()
    expect(w.find('.replay-card__badge').text()).toContain('Видно учню')
    const shareLabel = (uk as any).winterboard.replayList.actions.share
    expect(w.findAll('.replay-card__btn').some(b => b.text().includes(shareLabel))).toBe(false)
  })

  it('у меню режим учня — лише для уроку з учнем', () => {
    expect(mountCard().findAll('.menu-item-nested').map(li => li.text())).toContain('👤 Видно учню')
    const noStudent = mountCard({ visibility: 'private', lesson_student_id: null })
    expect(noStudent.findAll('.menu-item-nested').map(li => li.text()).join('|')).not.toContain('Видно учню')
  })
})

describe('сторінка учня: «Мої уроки» (StudentLessonRecordsSection)', () => {
  const record = {
    id: 'r-9', title: 'Козацька доба', source_session: 's-1', recorded_at: '2026-10-14T10:00:00Z',
    duration_ms: 45 * 60000, thumbnail_url: '', tutor: { id: 7, name: 'Олена Петрівна' }, viewer_role: 'student' as const,
  }

  it('порожньо — пояснення, що записи з’являться тут', () => {
    const w = mount(StudentLessonRecordsSection, { props: { records: [] }, global: { plugins: [i18n], stubs } })
    expect(w.text()).toContain('Мої уроки')
    expect(w.text()).toContain('Записів уроків поки немає')
  })

  it('запис: назва, учитель, тривалість і перехід до перегляду в кабінеті', () => {
    const w = mount(StudentLessonRecordsSection, { props: { records: [record] }, global: { plugins: [i18n], stubs } })
    const row = w.find('[data-testid="student-lesson-record"]')
    expect(row.text()).toContain('Козацька доба')
    expect(row.text()).toContain('Олена Петрівна')
    expect(row.text()).toContain('45 хв')
    const link = w.findComponent(RouterLinkStub)
    expect(link.props('to')).toEqual({ name: 'winterboard-replay-owner', params: { replayId: 'r-9' } })
    expect(link.text()).toBe('Переглянути')
  })
})

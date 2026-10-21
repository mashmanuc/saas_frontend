import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const { generate, push } = vi.hoisted(() => ({
  generate: vi.fn(async (_body: Record<string, unknown>) => ({ session_id: 'grade-nine-local' })),
  push: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('../api/lessonConstructorApi', async () => ({
  ...await vi.importActual<any>('../api/lessonConstructorApi'), lessonConstructorApi: { generate },
}))
import LessonConstructorPage from '../views/LessonConstructorPage.vue'
import { TOPICS } from '../api/lessonConstructorApi'

const topics = ['inequalities-systems.numeric', 'inequalities-systems.linear',
  'inequalities-systems.systems.linear', 'inequalities-systems.quadratic',
  'linear-quadratic-functions.quadratic.graph-transformations',
  'linear-quadratic-functions.quadratic.properties']

// Дерево тем — вигляд «НМТ»: з 2026-10-21 сторінка спершу пропонує клас учня (TopicGradePicker).
beforeEach(() => { localStorage.setItem('lc.topicView', 'nmt') })
beforeEach(() => { generate.mockClear(); push.mockClear() })

describe('Шість тем нерівностей і парабол у чинній формі', () => {
  it('унікальні topicID, без дублювання наявних лінійних і квадратних нерівностей', () => {
    expect(new Set(TOPICS.map(t => t.value)).size).toBe(TOPICS.length)
    for (const id of topics) expect(TOPICS.filter(t => t.value === id)).toHaveLength(1)
  })
  for (const id of topics) it(`вибір ${id} → правильний запит генератора`, async () => {
    const w = mount(LessonConstructorPage)
    await w.get('.lc-topic-block__head').trigger('click')
    const parts = id.split('.')
    for (let depth = 1; depth < parts.length; depth++) {
      const expand = w.find(`.lc-topic-expand[data-topic="${parts.slice(0, depth).join('.')}"]`)
      if (expand.exists()) await expand.trigger('click')
    }
    const label = TOPICS.find(t => t.value === id)!.label
    const chip = w.findAll('.lc-topic-chip').find(b => b.text().trim() === label)
    expect(chip).toBeDefined(); await chip!.trigger('click')
    await w.get('input[type=range]').setValue(16)
    await w.get('form').trigger('submit'); await flushPromises()
    expect(generate).toHaveBeenCalledTimes(1)
    expect(generate.mock.calls[0][0]).toMatchObject({ topics: [id], task_count: 16, diff_profile: 'balanced' })
    expect(push).toHaveBeenCalledWith({ name: 'winterboard-prepare', params: { id: 'grade-nine-local' } })
    w.unmount()
  })
})

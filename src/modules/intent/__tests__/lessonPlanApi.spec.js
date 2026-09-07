/**
 * План уроку поверх серверного API (Г2-г).
 *
 * Перевіряються ДАНІ й СТАН, не Vue-розмітка (у цьому модулі так заведено):
 * джерело правди — відповідь сервера; 404 = тихе enabled:false; 409 = не тихо;
 * чернетка Інтегралика не зберігається сама; етапи перемикає лише кнопка.
 */
import { describe, it, expect, vi } from 'vitest'
import { useLessonPlan, defaultPlan, draftView, CONFLICT_MESSAGE } from '../lessonPlanApi'

function resp(over = {}) {
  return {
    enabled: true,
    plan: {
      version: 1, objective: 'Мета', subject: 'math',
      stages: [
        { id: 'explain', kind: 'explanation', title: 'Пояснення', goal: '', status: 'active' },
        { id: 'practice', kind: 'practice', title: 'Практика', goal: '', status: 'pending' },
      ],
    },
    active_stage_id: 'explain', next_stage_id: 'practice',
    ...over,
  }
}

function httpError(status, data = {}) {
  const e = new Error(`HTTP ${status}`)
  e.response = { status, data }
  return e
}

function fakeApi(over = {}) {
  return {
    getLessonPlan: vi.fn(async () => resp()),
    putLessonPlan: vi.fn(async (_id, plan) => resp({ plan })),
    postLessonPlanStage: vi.fn(async () => resp({ active_stage_id: 'practice', next_stage_id: null,
      plan: { ...resp().plan, stages: [
        { id: 'explain', kind: 'explanation', title: 'Пояснення', goal: '', status: 'done' },
        { id: 'practice', kind: 'practice', title: 'Практика', goal: '', status: 'active' },
      ] } })),
    deleteLessonPlan: vi.fn(async () => undefined),
    ...over,
  }
}

describe('load', () => {
  it('джерело правди — сервер', async () => {
    const api = fakeApi()
    const lp = useLessonPlan(api)
    await lp.load('b1')
    expect(api.getLessonPlan).toHaveBeenCalledWith('b1')
    expect(lp.enabled.value).toBe(true)
    expect(lp.activeStage.value.id).toBe('explain')
    expect(lp.nextStageId.value).toBe('practice')
  })

  it('404 = прапорець вимкнений: enabled=false, plan=null, БЕЗ помилки', async () => {
    const api = fakeApi({ getLessonPlan: vi.fn(async () => { throw httpError(404) }) })
    const lp = useLessonPlan(api)
    await lp.load('b1')
    expect(lp.enabled.value).toBe(false)
    expect(lp.plan.value).toBeNull()
    expect(lp.error.value).toBe('')
    expect(lp.notice.value).toBe('')
  })

  it('5xx — справжня помилка, не глушиться', async () => {
    const api = fakeApi({ getLessonPlan: vi.fn(async () => { throw httpError(500) }) })
    const lp = useLessonPlan(api)
    await lp.load('b1')
    expect(lp.error.value).not.toBe('')
  })

  it('без дошки — нічого не питає', async () => {
    const api = fakeApi()
    const lp = useLessonPlan(api)
    await lp.load(null)
    expect(api.getLessonPlan).not.toHaveBeenCalled()
    expect(lp.enabled.value).toBe(false)
  })
})

describe('кнопки етапів', () => {
  it('stage(next) — один запит, стан із відповіді', async () => {
    const api = fakeApi()
    const lp = useLessonPlan(api)
    await lp.load('b1')
    await lp.stage('next')
    expect(api.postLessonPlanStage).toHaveBeenCalledWith('b1', 'next')
    expect(lp.activeStageId.value).toBe('practice')
    expect(lp.plan.value.stages[0].status).toBe('done')
  })

  it('409 — НЕ тихо: актуальний план із тіла + повідомлення', async () => {
    const fresh = resp({ active_stage_id: null, next_stage_id: null })
    const api = fakeApi({ postLessonPlanStage: vi.fn(async () => { throw httpError(409, { error: 'CONFLICT', ...fresh }) }) })
    const lp = useLessonPlan(api)
    await lp.load('b1')
    const ok = await lp.stage('next')
    expect(ok).toBe(false)
    expect(lp.notice.value).toBe(CONFLICT_MESSAGE)
    expect(lp.activeStageId.value).toBeNull()
  })

  it('409 без плану в тілі — перечитує GET', async () => {
    const api = fakeApi({ postLessonPlanStage: vi.fn(async () => { throw httpError(409, {}) }) })
    const lp = useLessonPlan(api)
    await lp.load('b1')
    await lp.stage('next')
    expect(api.getLessonPlan).toHaveBeenCalledTimes(2)
    expect(lp.notice.value).toBe(CONFLICT_MESSAGE)
  })

  it('403 — чесна помилка (учень)', async () => {
    const api = fakeApi({ postLessonPlanStage: vi.fn(async () => { throw httpError(403) }) })
    const lp = useLessonPlan(api)
    await lp.load('b1')
    await lp.stage('next')
    expect(lp.error.value).toContain('вчитель')
  })

  it('canPrev / canNext / isCompleted', async () => {
    const lp = useLessonPlan(fakeApi())
    await lp.load('b1')
    expect(lp.canPrev.value).toBe(false)     // перший етап
    expect(lp.canNext.value).toBe(true)
    await lp.stage('next')
    expect(lp.canPrev.value).toBe(true)
    const done = useLessonPlan(fakeApi({ getLessonPlan: vi.fn(async () => resp({
      active_stage_id: null, next_stage_id: null,
      plan: { ...resp().plan, stages: resp().plan.stages.map(s => ({ ...s, status: 'done' })) },
    })) }))
    await done.load('b1')
    expect(done.isCompleted.value).toBe(true)
    expect(done.canNext.value).toBe(false)
    expect(done.canPrev.value).toBe(true)     // завершений урок можна відкрити назад
  })

  it('поки запит іде — другий не стартує', async () => {
    let release
    const api = fakeApi({ postLessonPlanStage: vi.fn(() => new Promise(r => { release = () => r(resp()) })) })
    const lp = useLessonPlan(api)
    await lp.load('b1')
    const first = lp.stage('next')
    const second = await lp.stage('next')
    expect(second).toBe(false)
    release(); await first
    expect(api.postLessonPlanStage).toHaveBeenCalledTimes(1)
  })
})

describe('чернетка Інтегралика', () => {
  const g1 = {
    v: 1, rev: 0, subject: 'math', topic: 'Дроби', goal: 'Додавати дроби', current_stage: 'explanation',
    stages: [
      { id: 'explanation', role: 'explanation', goal: 'пояснити', status: 'active' },
      { id: 'practice', role: 'practice', goal: 'три задачі', status: 'planned' },
    ],
  }

  it('proposeDraft НЕ зберігає на сервер', async () => {
    const api = fakeApi()
    const lp = useLessonPlan(api)
    await lp.load('b1')
    expect(lp.proposeDraft(g1)).toBe(true)
    expect(api.putLessonPlan).not.toHaveBeenCalled()
    expect(lp.draft.value).toEqual(g1)   // ref() загортає в proxy — рівність за вмістом
  })

  it('saveDraft → PUT, чернетка зникає', async () => {
    const api = fakeApi()
    const lp = useLessonPlan(api)
    await lp.load('b1')
    lp.proposeDraft(g1)
    expect(await lp.saveDraft()).toBe(true)
    expect(api.putLessonPlan).toHaveBeenCalledWith('b1', g1)   // формат Г1 як є — адаптер на сервері
    expect(lp.draft.value).toBeNull()
  })

  it('discardDraft — без запитів', async () => {
    const api = fakeApi()
    const lp = useLessonPlan(api)
    lp.proposeDraft(g1); lp.discardDraft()
    expect(lp.draft.value).toBeNull()
    expect(api.putLessonPlan).not.toHaveBeenCalled()
  })

  it('draftView читає обидва формати', () => {
    const v = draftView(g1)
    expect(v.objective).toContain('Додавати')
    expect(v.stages[0]).toMatchObject({ kind: 'explanation', title: 'Пояснення', status: 'active' })
    expect(v.stages[1].status).toBe('pending')
    expect(draftView(resp().plan).stages[0].title).toBe('Пояснення')
    expect(draftView(null)).toBeNull()
  })

  it('сміття — не чернетка', () => {
    const lp = useLessonPlan(fakeApi())
    expect(lp.proposeDraft({ nope: true })).toBe(false)
  })
})

describe('defaultPlan', () => {
  it('п’ять етапів, перший активний, контракт Г2', () => {
    const p = defaultPlan('Мета')
    expect(p.version).toBe(1)
    expect(p.stages.map(s => s.kind)).toEqual(['explanation', 'example', 'practice', 'check', 'summary'])
    expect(p.stages.filter(s => s.status === 'active')).toHaveLength(1)
    expect(p.stages[0].status).toBe('active')
  })
})

describe('remove', () => {
  it('DELETE → плану немає, enabled лишається', async () => {
    const api = fakeApi()
    const lp = useLessonPlan(api)
    await lp.load('b1')
    expect(await lp.remove()).toBe(true)
    expect(api.deleteLessonPlan).toHaveBeenCalledWith('b1')
    expect(lp.plan.value).toBeNull()
    expect(lp.enabled.value).toBe(true)
  })
})

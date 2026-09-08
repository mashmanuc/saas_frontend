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
    // Каркас від типу уроку. Сервер НІЧОГО не зберігає — тому у відповіді
    // `plan` лишається поточним, а `lesson_kind` — це тип ЧЕРНЕТКИ.
    postLessonPlanKind: vi.fn(async (_id, kind) => ({
      ...resp(),
      lesson_kind: kind,
      draft: {
        version: 1, objective: 'Мета', subject: 'math',
        stages: [
          { id: 'brief', kind: 'explanation', title: 'Інструктаж', goal: '', status: 'active' },
          { id: 'work', kind: 'practice', title: 'Самостійна робота', goal: '', status: 'pending' },
        ],
      },
    })),
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
  // Чернетка від Інтегралика — формат Г2 (резолвер lesson_plan_create, Г2-д).
  const g1 = {
    version: 1, subject: 'math', objective: 'Дроби: додавати дроби',
    stages: [
      { id: 'explanation', kind: 'explanation', title: 'Пояснення', goal: 'пояснити', status: 'active' },
      { id: 'practice', kind: 'practice', title: 'Практика', goal: 'три задачі', status: 'pending' },
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
    expect(api.putLessonPlan).toHaveBeenCalledWith('b1', g1)
    expect(lp.draft.value).toBeNull()
  })

  it('discardDraft — без запитів', async () => {
    const api = fakeApi()
    const lp = useLessonPlan(api)
    lp.proposeDraft(g1); lp.discardDraft()
    expect(lp.draft.value).toBeNull()
    expect(api.putLessonPlan).not.toHaveBeenCalled()
  })

  it('draftView читає формат Г2 (і толерантний до старих полів)', () => {
    const v = draftView(g1)
    expect(v.objective).toContain('додавати')
    expect(v.stages[0]).toMatchObject({ kind: 'explanation', title: 'Пояснення', status: 'active' })
    expect(v.stages[1].status).toBe('pending')
    expect(draftView(resp().plan).stages[0].title).toBe('Пояснення')
    expect(draftView(null)).toBeNull()
  })

  it('requestCompose — сигнал «порожня форма», без запитів і без чернетки', async () => {
    const api = fakeApi()
    const lp = useLessonPlan(api)
    await lp.load('b1')
    lp.proposeDraft(g1)
    expect(lp.requestCompose()).toBe(true)
    expect(lp.draft.value).toBeNull()        // чернетка поступається формі
    expect(lp.composeTick.value).toBe(1)
    lp.requestCompose()
    expect(lp.composeTick.value).toBe(2)     // друге прохання теж має спрацювати
    expect(api.putLessonPlan).not.toHaveBeenCalled()
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

describe('тип уроку (Г3, крок 2)', () => {
  it('GET віддає тип — після F5 він на місці', async () => {
    const api = fakeApi({ getLessonPlan: vi.fn(async () => resp({ lesson_kind: 'control' })) })
    const lp = useLessonPlan(api)
    await lp.load('b1')
    expect(lp.lessonKind.value).toBe('control')
  })

  it('старий бекенд без поля — тип просто порожній, план читається', async () => {
    const api = fakeApi()                    // resp() ключа lesson_kind не має
    const lp = useLessonPlan(api)
    await lp.load('b1')
    expect(lp.lessonKind.value).toBeNull()
    expect(lp.plan.value.objective).toBe('Мета')
  })

  it('DELETE не вигадує, ніби тип теж скинувся', async () => {
    // Локальний apply після DELETE ключа не несе — заявлений тип на сервері
    // лишився. Скидати його тут означало б показати вчителю неправду.
    const api = fakeApi({ getLessonPlan: vi.fn(async () => resp({ lesson_kind: 'intro' })) })
    const lp = useLessonPlan(api)
    await lp.load('b1')
    await lp.remove()
    expect(lp.lessonKind.value).toBe('intro')
  })

  it('requestKindDraft: чернетка є, СЕРВЕРНИЙ СТАН не змінився', async () => {
    const api = fakeApi({ getLessonPlan: vi.fn(async () => resp({ lesson_kind: 'intro' })) })
    const lp = useLessonPlan(api)
    await lp.load('b1')

    expect(await lp.requestKindDraft('control', 'Площі фігур')).toBe(true)

    expect(api.postLessonPlanKind).toHaveBeenCalledWith('b1', 'control', 'Площі фігур')
    expect(lp.draft.value.stages[0].title).toBe('Інструктаж')
    expect(lp.draftKind.value).toBe('control')
    // Головне: тип і план ще СТАРІ — нічого не збережено.
    expect(lp.lessonKind.value).toBe('intro')
    expect(lp.plan.value.stages[0].title).toBe('Пояснення')
    expect(api.putLessonPlan).not.toHaveBeenCalled()
  })

  it('відхилив чернетку — жодного запису, стан як був', async () => {
    const api = fakeApi({ getLessonPlan: vi.fn(async () => resp({ lesson_kind: 'intro' })) })
    const lp = useLessonPlan(api)
    await lp.load('b1')
    await lp.requestKindDraft('control')
    lp.discardDraft()

    expect(lp.draft.value).toBeNull()
    expect(lp.draftKind.value).toBeNull()
    expect(lp.lessonKind.value).toBe('intro')
    expect(api.putLessonPlan).not.toHaveBeenCalled()
  })

  it('порожня мета не їде на сервер окремим полем', async () => {
    const api = fakeApi()
    const lp = useLessonPlan(api)
    await lp.load('b1')
    await lp.requestKindDraft('repeat', '   ')
    expect(api.postLessonPlanKind).toHaveBeenCalledWith('b1', 'repeat', undefined)
  })

  it('вигаданий тип — навіть не запит', async () => {
    const api = fakeApi()
    const lp = useLessonPlan(api)
    await lp.load('b1')
    expect(await lp.requestKindDraft('вигадка')).toBe(false)
    expect(api.postLessonPlanKind).not.toHaveBeenCalled()
  })

  it('400 показує пояснення сервера, а не наше загальне', async () => {
    const api = fakeApi({
      postLessonPlanKind: vi.fn(async () => {
        throw httpError(400, { error: 'VALIDATION', detail: 'Мета уроку задовга — до 200 символів.' })
      }),
    })
    const lp = useLessonPlan(api)
    await lp.load('b1')
    expect(await lp.requestKindDraft('intro', 'x')).toBe(false)
    expect(lp.error.value).toContain('задовга')
    expect(lp.draft.value).toBeNull()
  })

  it('403 (учень прямим викликом) — чернетки не з’являється', async () => {
    const api = fakeApi({
      postLessonPlanKind: vi.fn(async () => { throw httpError(403) }),
    })
    const lp = useLessonPlan(api)
    await lp.load('b1')
    expect(await lp.requestKindDraft('control')).toBe(false)
    expect(lp.draft.value).toBeNull()
    expect(lp.error.value).toContain('вчитель')
  })

  it('save з типом → КОНВЕРТ {plan, lesson_kind}', async () => {
    const api = fakeApi()
    const lp = useLessonPlan(api)
    await lp.load('b1')
    const plan = resp().plan

    await lp.save(plan, 'generalize')

    expect(api.putLessonPlan).toHaveBeenCalledWith('b1', { plan, lesson_kind: 'generalize' })
  })

  it('save без типу — голий план, як було: заяву вчителя не чіпаємо', async () => {
    const api = fakeApi()
    const lp = useLessonPlan(api)
    await lp.load('b1')
    const plan = resp().plan

    await lp.save(plan)

    expect(api.putLessonPlan).toHaveBeenCalledWith('b1', plan)
  })

  it('saveDraft після зміни типу шле конверт; після Інтегралика — ні', async () => {
    const api = fakeApi()
    const lp = useLessonPlan(api)
    await lp.load('b1')

    await lp.requestKindDraft('control', 'Площі')
    const draft = lp.draft.value
    await lp.saveDraft()
    expect(api.putLessonPlan).toHaveBeenLastCalledWith('b1', { plan: draft, lesson_kind: 'control' })

    // Інтегралик типу не заявляє — його чернетка їде голим планом.
    const fromAi = { version: 1, objective: 'Дроби', subject: 'math',
      stages: [{ id: 'p', kind: 'practice', title: 'Практика', goal: '', status: 'active' }] }
    lp.proposeDraft(fromAi)
    await lp.saveDraft()
    expect(api.putLessonPlan).toHaveBeenLastCalledWith('b1', fromAi)
  })

  it('після збереження типу перечитування показує його (шлях F5)', async () => {
    let stored = null
    const api = fakeApi({
      putLessonPlan: vi.fn(async (_id, body) => {
        stored = body.lesson_kind ?? null
        return resp({ plan: body.plan ?? body, lesson_kind: stored })
      }),
      getLessonPlan: vi.fn(async () => resp({ lesson_kind: stored })),
    })
    const lp = useLessonPlan(api)
    await lp.load('b1')
    await lp.requestKindDraft('control', 'Площі')
    await lp.saveDraft()
    expect(lp.lessonKind.value).toBe('control')

    const fresh = useLessonPlan(api)         // нова вкладка / F5
    await fresh.load('b1')
    expect(fresh.lessonKind.value).toBe('control')
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

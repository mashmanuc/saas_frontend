/**
 * Панель плану: вибір типу уроку — МОНТАЖНИЙ тест (Г3, крок 2).
 *
 * Чому не самі дані, як у решті модуля: «2152/2152 зелених» уже одного разу
 * означало «жоден компонент не монтувався» — TDZ у `<script setup>` поклав
 * прод на 80 хвилин 2026-09-03. Тому тут саме `mount`: панель має справді
 * зібратись, показати кнопки типів і НЕ писати на сервер до «Зберегти».
 */
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'

import LessonPlanPanel from '../LessonPlanPanel.vue'
import { useLessonPlan } from '../lessonPlanApi'

const PLAN = {
  version: 1, objective: 'Дроби', subject: 'math',
  stages: [
    { id: 'explanation', kind: 'explanation', title: 'Пояснення', goal: '', status: 'active' },
    { id: 'practice', kind: 'practice', title: 'Практика', goal: '', status: 'pending' },
  ],
}

const CONTROL_DRAFT = {
  version: 1, objective: 'Дроби', subject: 'math',
  stages: [
    { id: 'brief', kind: 'explanation', title: 'Інструктаж', goal: '', status: 'active' },
    { id: 'work', kind: 'practice', title: 'Самостійна робота', goal: '', status: 'pending' },
  ],
}

function fakeApi(over = {}) {
  return {
    getLessonPlan: vi.fn(async () => ({
      enabled: true, plan: PLAN, lesson_kind: 'intro',
      active_stage_id: 'explanation', next_stage_id: 'practice',
    })),
    putLessonPlan: vi.fn(async (_id, body) => ({
      enabled: true, plan: body.plan ?? body, lesson_kind: body.lesson_kind ?? 'intro',
      active_stage_id: 'brief', next_stage_id: 'work',
    })),
    postLessonPlanKind: vi.fn(async (_id, kind) => ({
      enabled: true, plan: PLAN, lesson_kind: kind, draft: CONTROL_DRAFT,
      active_stage_id: 'explanation', next_stage_id: 'practice',
    })),
    postLessonPlanStage: vi.fn(),
    deleteLessonPlan: vi.fn(),
    ...over,
  }
}

async function mountWithPlan(api) {
  const lp = reactive(useLessonPlan(api))
  await lp.load('b1')
  const w = mount(LessonPlanPanel, { props: { lp } })
  await nextTick()
  return { w, lp }
}

async function mountEmpty(api) {
  const lp = reactive(useLessonPlan({
    ...api,
    getLessonPlan: vi.fn(async () => ({
      enabled: true, plan: null, lesson_kind: null,
      active_stage_id: null, next_stage_id: null,
    })),
  }))
  await lp.load('b1')
  const w = mount(LessonPlanPanel, { props: { lp } })
  await nextTick()
  return { w, lp }
}

function buttonWith(w, text) {
  return w.findAll('button').find(b => b.text() === text)
}

/** Назви етапів у формі — це <input>, тож `w.text()` їх не бачить. */
function stageTitle(w, i = 1) {
  return w.find(`input[aria-label="Назва етапу ${i}"]`).element.value
}

describe('панель монтується і показує тип', () => {
  it('план є → бейдж типу і кнопка «Змінити тип»', async () => {
    const { w } = await mountWithPlan(fakeApi())
    expect(w.text()).toContain('Вивчення нової теми')
    expect(buttonWith(w, 'Змінити тип')).toBeTruthy()
  })

  it('тип невідомий (стара дошка) → бейджа немає, панель ціла', async () => {
    const api = fakeApi({
      getLessonPlan: vi.fn(async () => ({
        enabled: true, plan: PLAN, active_stage_id: 'explanation', next_stage_id: 'practice',
      })),
    })
    const { w } = await mountWithPlan(api)
    expect(w.text()).not.toContain('Вивчення нової теми')
    expect(w.text()).toContain('План уроку')
    expect(buttonWith(w, 'Змінити тип')).toBeTruthy()
  })
})

describe('новий план: спершу тема і тип', () => {
  it('форма показує п’ять типів, і без вибору каркас не складається', async () => {
    const { w } = await mountEmpty(fakeApi())
    await buttonWith(w, 'Новий план').trigger('click')

    for (const label of ['Вивчення нової теми', 'Закріплення', 'Узагальнення',
                         'Контроль', 'Повторення']) {
      expect(w.text()).toContain(label)
    }
    expect(w.text()).not.toContain('Свій')          // custom не пропонуємо

    // Тема вписана, тип НЕ обраний — кнопка неактивна.
    await w.find('input[aria-label="Тема уроку"]').setValue('Площі фігур')
    expect(buttonWith(w, 'Скласти план').attributes('disabled')).toBeDefined()
  })

  it('тема + тип → каркас із сервера, і НІЧОГО не збережено', async () => {
    const api = fakeApi()
    const { w } = await mountEmpty(api)
    await buttonWith(w, 'Новий план').trigger('click')
    await w.find('input[aria-label="Тема уроку"]').setValue('Площі фігур')
    await buttonWith(w, 'Контроль').trigger('click')

    await buttonWith(w, 'Скласти план').trigger('click')
    await nextTick(); await nextTick()

    expect(api.postLessonPlanKind).toHaveBeenCalledWith('b1', 'control', 'Площі фігур')
    expect(api.putLessonPlan).not.toHaveBeenCalled()
    expect(stageTitle(w)).toBe('Інструктаж')
  })

  it('відхилив каркас — сервер не чіпали', async () => {
    const api = fakeApi()
    const { w, lp } = await mountEmpty(api)
    await buttonWith(w, 'Новий план').trigger('click')
    await w.find('input[aria-label="Тема уроку"]').setValue('Площі')
    await buttonWith(w, 'Повторення').trigger('click')
    await buttonWith(w, 'Скласти план').trigger('click')
    await nextTick(); await nextTick()

    await buttonWith(w, 'Скасувати').trigger('click')

    expect(api.putLessonPlan).not.toHaveBeenCalled()
    expect(lp.plan).toBeNull()
    expect(lp.lessonKind).toBeNull()
  })

  it('«Зберегти план» шле конверт із типом', async () => {
    const api = fakeApi()
    const { w } = await mountEmpty(api)
    await buttonWith(w, 'Новий план').trigger('click')
    await w.find('input[aria-label="Тема уроку"]').setValue('Площі фігур')
    await buttonWith(w, 'Контроль').trigger('click')
    await buttonWith(w, 'Скласти план').trigger('click')
    await nextTick(); await nextTick()

    await buttonWith(w, 'Зберегти план').trigger('click')
    await nextTick(); await nextTick()

    const [, body] = api.putLessonPlan.mock.calls[0]
    expect(body.lesson_kind).toBe('control')
    expect(body.plan.stages[0].title).toBe('Інструктаж')
  })
})

describe('«Змінити тип» у наявному плані', () => {
  it('відкриває вибір і показує каркас, не зберігаючи його', async () => {
    const api = fakeApi()
    const { w, lp } = await mountWithPlan(api)

    await buttonWith(w, 'Змінити тип').trigger('click')
    await buttonWith(w, 'Контроль').trigger('click')
    await nextTick(); await nextTick()

    expect(api.postLessonPlanKind).toHaveBeenCalledWith('b1', 'control', undefined)
    expect(api.putLessonPlan).not.toHaveBeenCalled()
    expect(lp.lessonKind).toBe('intro')          // на сервері ще старий тип
    expect(stageTitle(w)).toBe('Інструктаж')     // а перед очима вже новий каркас
  })

  it('скасував вибір — жодного запиту', async () => {
    const api = fakeApi()
    const { w } = await mountWithPlan(api)
    await buttonWith(w, 'Змінити тип').trigger('click')
    await buttonWith(w, 'Скасувати').trigger('click')

    expect(api.postLessonPlanKind).not.toHaveBeenCalled()
    expect(api.putLessonPlan).not.toHaveBeenCalled()
  })
})

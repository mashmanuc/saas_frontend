/**
 * «Редагувати» посилання на урок у розкладі (власник 2026-10-22: «не працює вкладка Редагувати лінк»).
 * Анкети репетитора (`tutor-profile`) після Marketplace Extraction немає — сторінка не має падати на її кроках.
 */
import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory, type RouteRecordRaw } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { defineComponent, h } from 'vue'
import TutorLessonLinksView from '../TutorLessonLinksView.vue'

const Editor = defineComponent({ name: 'LessonLinksEditor', emits: ['cancel'], setup: () => () => h('div', { class: 'editor-stub' }) })
const Blank = defineComponent({ render: () => h('div') })

async function mountWith(routes: RouteRecordRaw[]) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/tutor/lesson-links')
  await router.isReady()
  const i18n = createI18n({ legacy: false, locale: 'uk', missingWarn: false, fallbackWarn: false, messages: { uk: {} } })
  const wrapper = mount(TutorLessonLinksView, {
    global: { plugins: [router, i18n], stubs: { LessonLinksEditor: Editor } },
  })
  await flushPromises()
  return wrapper
}

const linksRoute: RouteRecordRaw = { path: '/tutor/lesson-links', name: 'tutor-lesson-links', component: Blank }

describe('TutorLessonLinksView', () => {
  it('без анкети репетитора — лише редактор посилання, без кроків анкети і без падіння', async () => {
    const w = await mountWith([linksRoute])
    expect(w.find('.editor-stub').exists()).toBe(true)
    expect(w.find('.lesson-links-tabs').exists()).toBe(false)
    expect(w.findAll('button').length).toBe(0)
  })

  it('коли анкета є — кроки анкети показуються, як раніше', async () => {
    const w = await mountWith([linksRoute, { path: '/tutor/profile', name: 'tutor-profile', component: Blank }])
    expect(w.findAll('.lesson-links-tab').length).toBe(8)
  })
})

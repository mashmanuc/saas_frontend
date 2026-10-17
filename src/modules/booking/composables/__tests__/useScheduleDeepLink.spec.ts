/**
 * Посилання «відкрити урок у розкладі» (?booking=<id>), 2026-10-17: учень зі сповіщення має побачити свій урок
 * підсвіченим. Вада: прибирання ?booking з адреси будило watch з порожнім значенням і зупиняло пошук картки —
 * розклад вантажиться не миттєво, тож підсвічування не спрацьовувало ніколи.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, reactive, nextTick } from 'vue'

const route = reactive({ query: {} as Record<string, string | undefined> })
const replace = vi.fn(async ({ query }: { query: Record<string, string | undefined> }) => { route.query = { ...query } })
vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ replace }) }))

import { useScheduleDeepLink } from '../useScheduleDeepLink'

const Host = defineComponent({ setup() { useScheduleDeepLink(); return () => h('div') } })

describe('useScheduleDeepLink', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
    Element.prototype.scrollIntoView = vi.fn()
    // happy-dom не розбирає CSS-екранування числа, що починається з цифри (`\36 3`); браузер розбирає.
    vi.stubGlobal('CSS', { escape: (v: string) => v })
  })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('картка зʼявилась пізніше (розклад ще вантажився) — однаково підсвічується; ?booking прибрано', async () => {
    route.query = { week: '2026-10-26', booking: '63' }
    mount(Host, { attachTo: document.body })
    await nextTick()
    expect(replace).toHaveBeenCalled()
    expect(route.query.booking).toBeUndefined()           // адресу почищено, а пошук триває

    const card = document.createElement('div')
    card.setAttribute('data-event-id', '63')
    document.body.appendChild(card)
    vi.advanceTimersByTime(450)
    expect(card.classList.contains('schedule-booking--highlight')).toBe(true)
    vi.advanceTimersByTime(2600)
    expect(card.classList.contains('schedule-booking--highlight')).toBe(false)
  })
})

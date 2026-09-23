/**
 * Тур по меню не показує на невидиме (FIRST USER GATE 2026-09-23, крок 1).
 *
 * Коли меню згорнуте (сайдбар за лівим краєм), пункт є в DOM, але людина його
 * не бачить. Раніше підказка висіла посеред Головної й закривала картку під
 * собою. Тепер: меню не видно → туру немає і він НЕ позначається пройденим.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

const dismissHint = vi.fn()
vi.mock('@/composables/useOnboardingHints', () => ({
  TutorHintId: { SIDEBAR_COACHING: 'tutor.sidebar.coaching' },
  useOnboardingHints: () => ({ isHintVisible: () => true, dismissHint }),
}))

import SidebarCoachingMarks from '../SidebarCoachingMarks.vue'

function addMenuLink(href: string, left: number) {
  const a = document.createElement('a')
  a.setAttribute('href', href)
  a.getBoundingClientRect = () =>
    ({ left, right: left + 200, top: 100, bottom: 140, width: 200, height: 40, x: left, y: 100 }) as DOMRect
  document.body.appendChild(a)
}

async function mountAndWait() {
  const w = mount(SidebarCoachingMarks, {
    global: { mocks: { $t: (k: string) => k } },
    attachTo: document.body,
  })
  vi.advanceTimersByTime(900)
  // visible=true → nextTick(positionTooltip) → повторний рендер
  for (let i = 0; i < 4; i++) await nextTick()
  return w
}

describe('SidebarCoachingMarks', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    dismissHint.mockReset()
    document.body.innerHTML = ''
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('меню згорнуте (пункти за лівим краєм) → туру немає і він не позначений пройденим', async () => {
    for (const href of ['/winterboard/boards', '/tutor/schedule', '/knowledge/my-lessons']) {
      addMenuLink(href, -260)
    }
    const w = await mountAndWait()
    expect(document.querySelector('.sidebar-coaching-tooltip')).toBeNull()
    expect(dismissHint).not.toHaveBeenCalled()
    w.unmount()
  })

  it('меню видно → тур показується з першого кроку', async () => {
    for (const href of ['/winterboard/boards', '/tutor/schedule', '/knowledge/my-lessons']) {
      addMenuLink(href, 0)
    }
    const w = await mountAndWait()
    const tip = document.querySelector('.sidebar-coaching-tooltip')
    expect(tip).not.toBeNull()
    expect(tip?.textContent).toContain('1/3')
    expect(tip?.textContent).toContain('sidebarCoaching.step2')
    w.unmount()
  })
})

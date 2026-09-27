/**
 * PublicReplayPlayer на шкалі часу перегляду (REPLAY_MANIFEST v2.3, власник 2026-09-27):
 *   - шкала показує час перегляду, реальна тривалість уроку — окремим підписом;
 *   - «Поділитися моментом» пише в `?t=` ЧАС УРОКУ: так його читають старі посилання,
 *     і відкривач шукає op за реальним часом (findIndexByTimeMs). Якщо сюди потрапить час
 *     перегляду, посилання відкриється раніше, ніж людина дивилась;
 *   - без нових пропсів (сторінка уроку в «Знаннях») — як було: `t` = currentSeconds.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import PublicReplayPlayer from '../components/public/PublicReplayPlayer.vue'

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

let copied: string[] = []

beforeEach(() => {
  copied = []
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn(async (s: string) => { copied.push(s) }) },
  })
  window.history.replaceState(null, '', '/r/tok123?replay=v2')
})
afterEach(() => { vi.restoreAllMocks() })

function mountPlayer(props: Record<string, unknown>) {
  return mount(PublicReplayPlayer, {
    props: { currentSeconds: 0, durationSeconds: 0, isPlaying: false, ...props },
    global: { plugins: [i18n()] },
  })
}

async function shareMoment(w: ReturnType<typeof mountPlayer>): Promise<URL> {
  await w.get('.public-replay-player__share-moment').trigger('click')
  await Promise.resolve()
  expect(copied.length).toBe(1)
  return new URL(copied[0])
}

describe('PublicReplayPlayer — час перегляду і час уроку', () => {
  it('шкала — час перегляду; реальна тривалість уроку — окремим підписом', () => {
    const w = mountPlayer({ currentSeconds: 62, durationSeconds: 125, lessonDurationSeconds: 3725 })
    expect(w.get('.public-replay-player__time').text()).toBe('1:02 / 2:05')
    expect(w.get('.public-replay-player__lesson-duration').text()).toBe('урок тривав 1:02:05')
  })

  it('немає тривалості уроку — підпису немає', () => {
    const w = mountPlayer({ currentSeconds: 1, durationSeconds: 10 })
    expect(w.find('.public-replay-player__lesson-duration').exists()).toBe(false)
  })

  it('«Поділитися моментом» кладе в ?t= час уроку, а не час перегляду; решта адреси — як була', async () => {
    const w = mountPlayer({ currentSeconds: 40, durationSeconds: 125, lessonSeconds: 734.9 })
    const url = await shareMoment(w)
    expect(url.searchParams.get('t')).toBe('734')
    expect(url.pathname).toBe('/r/tok123')
    expect(url.searchParams.get('replay')).toBe('v2')
    expect(w.emitted('share-moment')?.[0]).toEqual([734])
  })

  it('без lessonSeconds (сторінка уроку в «Знаннях») — як раніше: ?t= = currentSeconds', async () => {
    const w = mountPlayer({ currentSeconds: 40.7, durationSeconds: 125 })
    const url = await shareMoment(w)
    expect(url.searchParams.get('t')).toBe('40')
  })
})

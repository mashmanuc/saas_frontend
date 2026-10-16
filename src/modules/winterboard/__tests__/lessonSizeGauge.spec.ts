/**
 * Б-205 (власник 2026-10-16): «Зберегти як урок» має межу 2 МБ, а вчитель дізнавався про неї лише після
 * того, як усе написав. Прод 16.10: 5 сторінок рукопису планшетом = 2 099 514 байт.
 * Смужка «Дошка заповнена на N %» з 75 %, «переповнена» понад межу — рахуємо так само, як сервер.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string, p?: Record<string, unknown>) => (p ? `${key}:${JSON.stringify(p)}` : key) }),
}))

import {
  GAUGE_SHOW_FROM, LESSON_SNAPSHOT_LIMIT_BYTES, MEASURE_INTERVAL_MS,
  boardStateBytes, isBoardTooLargeError, lessonFillPercent, lessonSizeLevel, useLessonSizeGauge,
} from '../board/lessonSizeGauge'
import WBLessonSizeStrip from '../components/dialogs/WBLessonSizeStrip.vue'

const LIMIT = LESSON_SNAPSHOT_LIMIT_BYTES

describe('межа і рівні', () => {
  it('межа — та сама, що на сервері (2 МБ, MAX_LESSON_SNAPSHOT_BYTES)', () => {
    expect(LIMIT).toBe(2 * 1024 * 1024)
  })

  it('розмір — байти компактного JSON (як json.dumps(separators=(",", ":")) на сервері), кирилиця — по 2 байти', () => {
    expect(boardStateBytes({ pages: [] })).toBe('{"pages":[]}'.length)
    expect(boardStateBytes({ n: 'ї' })).toBe('{"n":""}'.length + 2)
  })

  it('до 75 % — нічого; з 75 % — попередження; понад межу — переповнено', () => {
    expect(lessonSizeLevel(LIMIT * GAUGE_SHOW_FROM - 1)).toBe('none')
    expect(lessonSizeLevel(LIMIT * GAUGE_SHOW_FROM)).toBe('warn')
    expect(lessonSizeLevel(LIMIT)).toBe('warn')
    expect(lessonSizeLevel(LIMIT + 1)).toBe('full')
    expect(lessonSizeLevel(2_099_514)).toBe('full') // дошка власника 16.10
    expect(lessonFillPercent(LIMIT * 0.92)).toBe(92)
  })

  it('відповідь сервера board_too_large розпізнається', () => {
    expect(isBoardTooLargeError({ response: { status: 400, data: { error: 'board_too_large' } } })).toBe(true)
    expect(isBoardTooLargeError({ response: { status: 400, data: { error: 'other' } } })).toBe(false)
    expect(isBoardTooLargeError(new Error('x'))).toBe(false)
  })
})

describe('useLessonSizeGauge — рахує після нових дій, не частіше за інтервал', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function harness(enabled = true) {
    const seq = ref(0)
    const state = ref<unknown>({ pages: [] })
    const getState = vi.fn(() => state.value)
    let api!: ReturnType<typeof useLessonSizeGauge>
    const C = defineComponent({
      setup() {
        api = useLessonSizeGauge({ enabled: ref(enabled), seq: () => seq.value, getState })
        return () => h('div')
      },
    })
    const w = mount(C)
    return { w, seq, state, getState, api: () => api }
  }

  it('нова дія → вимір; серія дій за інтервал — один вимір', async () => {
    const hh = harness()
    await vi.advanceTimersByTimeAsync(0)
    expect(hh.getState).toHaveBeenCalledTimes(1)
    for (let i = 1; i <= 5; i++) { hh.seq.value = i; await nextTick() }
    await vi.advanceTimersByTimeAsync(MEASURE_INTERVAL_MS - 1)
    expect(hh.getState).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(hh.getState).toHaveBeenCalledTimes(2)
  })

  it('стан понад межу → «переповнено» з відсотком', async () => {
    const hh = harness()
    hh.state.value = { s: 'x'.repeat(LIMIT + 10) }
    await vi.advanceTimersByTimeAsync(0)
    expect(hh.api().level.value).toBe('full')
    expect(hh.api().percent.value).toBeGreaterThanOrEqual(100)
  })

  it('не власник / гість — не рахує і не показує', async () => {
    const hh = harness(false)
    hh.state.value = { s: 'x'.repeat(LIMIT + 10) }
    await vi.advanceTimersByTimeAsync(MEASURE_INTERVAL_MS * 2)
    expect(hh.getState).not.toHaveBeenCalled()
    expect(hh.api().level.value).toBe('none')
  })
})

describe('смужка', () => {
  it('попередження — відсоток; переповнено — інший текст; «Зрозуміло» шле подію', async () => {
    const warn = mount(WBLessonSizeStrip, { props: { level: 'warn', percent: 82 } })
    expect(warn.text()).toContain('winterboard.lessonSize.warnTitle:{"percent":82}')
    expect(warn.text()).toContain('winterboard.lessonSize.warnHint')
    const full = mount(WBLessonSizeStrip, { props: { level: 'full', percent: 101 } })
    expect(full.text()).toContain('winterboard.lessonSize.fullTitle')
    expect(full.find('[data-testid="lesson-size-strip"]').classes()).toContain('wb-lesson-size--full')
    await full.find('[data-testid="lesson-size-dismiss"]').trigger('click')
    expect(full.emitted('dismiss')).toHaveLength(1)
  })
})

describe('WBSoloRoom підключає смужку й причину', () => {
  const src = readFileSync(resolve(__dirname, '../views/WBSoloRoom.vue'), 'utf-8')
  it('смужка — лише власнику хмарної дошки, за прийнятими діями, зі стану як на сервер', () => {
    expect(src).toMatch(/<WBLessonSizeStrip\s+v-if="showLessonSizeStrip"/)
    expect(src).toMatch(/enabled: computed\(\(\) => !isLocalWorkspace && isSessionOwner\.value && !!sessionId\.value\)/)
    expect(src).toMatch(/seq: \(\) => opsSync\.serverSeq/)
    expect(src).toMatch(/getState: \(\) => store\.serializedStateForSave/)
  })
  it('«Оновити шаблон» на завеликій дошці каже причину', () => {
    expect(src).toMatch(/isBoardTooLargeError\(e\) \? 'winterboard\.lesson\.saveErrorTooLarge'/)
  })
})

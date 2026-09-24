/**
 * P1 перед відео (2026-09-24): завершений запис у ClassRoom — як у Solo.
 *
 * Вчитель: жовтої смуги немає, бейдж «Запис завершено» у шапці, вікно «Як
 * продовжити?» на першу спробу змінити, «Почати новий запис» — одразу, дія
 * виконується після УСПІШНОГО старту, перо — питання ДО штриха.
 * Учень: жовтої смуги немає, лише read-only статус, вікна не бачить.
 *
 * Кімнату в тестах не змонтувати (тягне роутер, WS, ops, Konva), тому:
 *   1. справжня поведінка — через спільний composable `useFrozenEditGuard`
 *      (той самий, що в Solo) у тонкій обгортці з полотном і двома ролями;
 *   2. проводка саме в WBClassroomRoom — контракт вихідного коду (прецедент:
 *      boardObjectStandard.spec) — щоб смуга не повернулась «за звичкою».
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import { useFrozenEditGuard } from '../composables/useFrozenEditGuard'
import type { WBToolType } from '../types/winterboard'
import WBClassroomRecordingControls from '../components/replay/WBClassroomRecordingControls.vue'

// ── 1. Поведінка: вчитель vs учень ─────────────────────────────────────────

function mountRoom(role: 'teacher' | 'student', opts: { startOk?: boolean } = {}) {
  const frozen = ref(true)
  const tool = ref<WBToolType>('select')
  const clearSelection = vi.fn()
  const childDown = vi.fn()
  const startNewRecording = vi.fn(async () => { if (opts.startOk !== false) frozen.value = false })
  let api!: ReturnType<typeof useFrozenEditGuard>

  const Room = defineComponent({
    setup() {
      const canvasEl = ref<HTMLElement | null>(null)
      api = useFrozenEditGuard({
        frozen,
        // як у WBClassroomRoom: лише вчитель може почати новий запис
        active: computed(() => frozen.value && role === 'teacher'),
        currentTool: () => tool.value,
        setTool: (t) => { tool.value = t },
        clearSelection,
        canvasEl,
        startNewRecording,
      })
      return () => h('div', { ref: canvasEl, id: 'wb-canvas' }, [
        h('div', { class: 'card', onPointerdown: childDown }),
      ])
    },
  })
  const w = mount(Room, { attachTo: document.body })
  return { w, api: () => api, frozen, tool, clearSelection, childDown, startNewRecording }
}

function pointerDown(el: Element, init: Partial<PointerEventInit> = {}) {
  const e = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, ...init }) as MouseEvent
  Object.defineProperty(e, 'pointerType', { value: (init as { pointerType?: string }).pointerType ?? 'mouse' })
  Object.defineProperty(e, 'isPrimary', { value: (init as { isPrimary?: boolean }).isPrimary ?? true })
  el.dispatchEvent(e)
}

afterEach(() => { document.body.innerHTML = '' })

describe('ClassRoom · вчитель на дошці з завершеним записом', () => {
  it('перше натискання на полотні → вікно, до картки подія не доходить', () => {
    const r = mountRoom('teacher')
    pointerDown(r.w.find('.card').element)
    expect(r.api().showPrompt.value).toBe(true)
    expect(r.childDown).not.toHaveBeenCalled()
  })

  it('середня кнопка (пан) і другий палець (pinch) — вільні, без вікна', () => {
    const r = mountRoom('teacher')
    pointerDown(r.w.find('.card').element, { button: 1 })
    pointerDown(r.w.find('.card').element, { pointerType: 'touch', isPrimary: false } as never)
    expect(r.api().showPrompt.value).toBe(false)
    expect(r.childDown).toHaveBeenCalledTimes(2)
  })

  it('перо: питання приходить при виборі інструмента — ДО штриха', async () => {
    const r = mountRoom('teacher')
    r.tool.value = 'pen'
    await nextTick()
    expect(r.api().showPrompt.value).toBe(true)
  })

  it('«Скасувати» → інструмент назад у «виділення», дошка не змінюється', async () => {
    const r = mountRoom('teacher')
    r.tool.value = 'pen'
    await nextTick()
    r.api().onCancel()
    expect(r.tool.value).toBe('select')
    expect(r.startNewRecording).not.toHaveBeenCalled()
  })

  it('«Почати новий запис» → старт один раз; дія з кнопки виконується ПІСЛЯ старту', async () => {
    const r = mountRoom('teacher')
    const order: string[] = []
    r.startNewRecording.mockImplementation(async () => { order.push('start'); r.frozen.value = false })
    expect(r.api().guard(() => order.push('action'))).toBe(true)
    await r.api().onStartNew()
    expect(r.startNewRecording).toHaveBeenCalledTimes(1)
    expect(order).toEqual(['start', 'action'])
    expect(r.api().showPrompt.value).toBe(false)
  })

  it('старт не вдався (дошка лишилась замороженою) → дію НЕ виконуємо', async () => {
    const r = mountRoom('teacher', { startOk: false })
    const action = vi.fn()
    r.api().guard(action)
    await r.api().onStartNew()
    expect(action).not.toHaveBeenCalled()
  })

  it('після старту guard вимкнений — дія йде напряму, без вікна', async () => {
    const r = mountRoom('teacher')
    await r.api().onStartNew()
    expect(r.api().guard(() => {})).toBe(false)
    pointerDown(r.w.find('.card').element)
    expect(r.childDown).toHaveBeenCalledTimes(1)
  })

  it('щойно дошка замерзла — виділення знімається', async () => {
    const r = mountRoom('teacher')
    r.frozen.value = false
    await nextTick()
    r.frozen.value = true
    await nextTick()
    expect(r.clearSelection).toHaveBeenCalled()
  })
})

describe('ClassRoom · учень на дошці з завершеним записом', () => {
  it('вікна немає: ні натискання, ні вибір інструмента його не відкривають', async () => {
    const r = mountRoom('student')
    pointerDown(r.w.find('.card').element)
    r.tool.value = 'pen'
    await nextTick()
    expect(r.api().showPrompt.value).toBe(false)
    expect(r.api().guard(() => {})).toBe(false)
    expect(r.startNewRecording).not.toHaveBeenCalled()
  })

  it('його натискання не перехоплюються (read-only робить наявний гейт малювання)', () => {
    const r = mountRoom('student')
    pointerDown(r.w.find('.card').element)
    expect(r.childDown).toHaveBeenCalledTimes(1)
  })
})

// ── 2. Бейдж у панелі запису вчителя ───────────────────────────────────────

describe('WBClassroomRecordingControls · finalized', () => {
  const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

  it('бейдж «Запис завершено» — єдина кнопка, клік → restart', async () => {
    const w = mount(WBClassroomRecordingControls, {
      props: { recordingState: 'finalized', isLoading: false, recordingStartedAt: null },
      global: { plugins: [i18n()] },
    })
    const badge = w.find('button.wb-classroom-recording__frozen')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('Запис завершено')
    expect(w.findAll('button')).toHaveLength(1)
    await badge.trigger('click')
    expect(w.emitted('restart')).toHaveLength(1)
  })
})

// ── 3. Проводка саме в WBClassroomRoom ─────────────────────────────────────

describe('WBClassroomRoom · контракт проводки', () => {
  const src = readFileSync(resolve(__dirname, '../views/WBClassroomRoom.vue'), 'utf-8')

  it('жовтої смуги WBFrozenBanner у кімнаті немає', () => {
    expect(src).not.toMatch(/<WBFrozenBanner/)
    expect(src).not.toMatch(/import WBFrozenBanner/)
  })

  it('вікно «Як продовжити?» — лише для вчителя, спільний механізм із Solo', () => {
    expect(src).toMatch(/useFrozenEditGuard\(/)
    expect(src).toMatch(/active:\s*computed\(\(\)\s*=>\s*isBoardFrozen\.value && classroomRole\.isTeacher\.value\)/)
    expect(src).toMatch(/variant="frozenEdit"/)
  })

  it('учень бачить лише read-only статус «Запис завершено»', () => {
    expect(src).toMatch(/classroomRole\.isStudent\.value && isBoardFrozen/)
    expect(src).toMatch(/wb-rec-indicator--frozen/)
  })

  it('дії, що змінюють дошку, проходять через guard', () => {
    for (const fn of ['handleUndo', 'handleRedo', 'handleClear', 'handlePageAdd', 'handlePageDelete', 'handleYouTubeInsertRequest', 'handleSidebarPlace']) {
      const body = src.slice(src.indexOf(`function ${fn}(`), src.indexOf(`function ${fn}(`) + 400)
      expect(body, fn).toMatch(/guardFrozenEdit\(/)
    }
    expect(src).toMatch(/@drop="onCanvasDrop"/)
  })
})

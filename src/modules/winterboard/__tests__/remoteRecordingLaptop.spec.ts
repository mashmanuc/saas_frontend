// LAW §9 v1.28 (2026-10-12, власник: «Роби»; ТЗ TZ_MIRROR_AUTO_RECORDING §1–§2, §4) — НОУТБУК.
// «Дзеркало дошки» на пульті шле recording.start / recording.stop { source: 'mirror', mirror_run }; ноутбук
// вирішує за станом запису й кличе ТІ САМІ обробники, що кнопки запису. Тут:
//   • адаптер запису: idle / finalized → «Записати урок»; recording → нічого; paused → «Продовжити»;
//     відмова — причина, без повтору; recording.stop — лише свій запуск, через «Завершити запис»;
//     recording_by_mirror_run — лише коли запуск увімкнув або продовжив запис, кінець циклу скидає;
//   • useBoardRemote: команда → адаптер; у кожному remote.state — recording і recording_by_mirror_run,
//     відповідь — recording_result; без адаптера — rejected: unsupported;
//   • WBSoloRoom: адаптер зв'язаний саме з обробниками кнопок; обробники повертають причину (сторож по джерелу).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { reactive, ref, nextTick, defineComponent, h, effectScope } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import fs from 'node:fs'
import path from 'node:path'
import { useBoardRemote } from '../composables/useBoardRemote'
import { createRemoteRecordingAdapter, type RemoteRecordingDeps, type RoomRecordingState } from '../remote/remoteRecordingAdapter'
import { readRecordingRequest } from '../remote/recordingContract'
import type { RecordingRefusalReason } from '../remote/recordingContract'

const RUN = '0c1f7c9e-5b7a-4d1e-9f3a-2b6c8d4e1a90'
const OTHER = '7d2e8f10-1111-4c2d-8e3f-9a0b1c2d3e4f'
const SID = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'

/** Кімната з кнопками запису: стан, як `soloRecordingState`, і обробники, як у WBSoloRoom */
function room(initial: RoomRecordingState = 'idle') {
  const state = ref<RoomRecordingState>(initial)
  const board = ref<string | null>(SID)
  const lesson = ref(true)
  const loading = ref(false)
  const startReason = ref<RecordingRefusalReason | null>(null)
  const resumeReason = ref<RecordingRefusalReason | null>(null)
  const finalizeOutcome = ref<'saved' | 'empty' | RecordingRefusalReason>('saved')
  const deps: RemoteRecordingDeps = {
    state: () => state.value,
    boardId: () => board.value,
    available: () => lesson.value,
    busy: () => loading.value,
    start: vi.fn(async () => { if (!startReason.value) state.value = 'recording'; return startReason.value }),
    resume: vi.fn(async () => { if (!resumeReason.value) state.value = 'recording'; return resumeReason.value }),
    finalize: vi.fn(async () => {
      const out = finalizeOutcome.value
      if (out === 'saved') state.value = 'finalized'
      else if (out === 'empty') state.value = 'idle'
      return out
    }),
  }
  const scope = effectScope()
  const adapter = scope.run(() => createRemoteRecordingAdapter(deps))!
  return { state, board, lesson, loading, startReason, resumeReason, finalizeOutcome, deps, adapter, scope }
}

describe('адаптер запису на ноутбуці — «Почати» Дзеркала', () => {
  it('запис не йде (idle) — той самий шлях, що «Записати урок»; запуск запам\'ятовано', async () => {
    const r = room('idle')
    const res = await r.adapter.start(RUN)
    expect(r.deps.start).toHaveBeenCalledTimes(1)
    expect(r.deps.resume).not.toHaveBeenCalled()
    expect(res).toEqual({ mirror_run: RUN, cmd: 'start', status: 'started' })
    expect(r.adapter.state()).toEqual({ recording: 'recording', recording_by_mirror_run: RUN })
  })

  it('після завершеного запису (finalized) — новий запис тим самим шляхом', async () => {
    const r = room('finalized')
    expect(r.adapter.state()).toEqual({ recording: 'idle', recording_by_mirror_run: null })   // finalized іде як idle
    expect((await r.adapter.start(RUN)).status).toBe('started')
    expect(r.deps.start).toHaveBeenCalledTimes(1)
  })

  it('запис уже йде (учитель увімкнув сам) — нічого не робимо, запис не наш', async () => {
    const r = room('recording')
    const res = await r.adapter.start(RUN)
    expect(res).toEqual({ mirror_run: RUN, cmd: 'start', status: 'already' })
    expect(r.deps.start).not.toHaveBeenCalled()
    expect(r.deps.resume).not.toHaveBeenCalled()
    expect(r.adapter.state()).toEqual({ recording: 'recording', recording_by_mirror_run: null })
  })

  it('запис на паузі — продовжуємо тим самим шляхом, що «Продовжити»; власника продовження не змінює', async () => {
    const r = room('paused')                         // цикл увімкнули кнопкою на ноутбуці, потім пауза
    const res = await r.adapter.start(RUN)
    expect(r.deps.resume).toHaveBeenCalledTimes(1)
    expect(r.deps.start).not.toHaveBeenCalled()
    expect(res.status).toBe('resumed')
    expect(r.adapter.state()).toEqual({ recording: 'recording', recording_by_mirror_run: null })
  })

  it('стенд 12.10: учитель увімкнув кнопкою, поставив на паузу, «Почати» Дзеркала продовжило — «Зупинити» НЕ завершує', async () => {
    const r = room('idle')
    r.state.value = 'recording'                      // «Записати урок» на ноутбуці
    r.state.value = 'paused'                         // «Пауза» на ноутбуці
    await r.adapter.start(RUN)                       // «Почати» Дзеркала → «Продовжити»
    expect(r.deps.resume).toHaveBeenCalledTimes(1)
    expect(await r.adapter.stop(RUN)).toMatchObject({ status: 'skipped' })
    expect(r.deps.finalize).not.toHaveBeenCalled()
  })

  it('цикл увімкнув запуск X, пауза, продовжив запуск Y — власник і далі X: завершує X, не Y', async () => {
    const r = room('idle')
    await r.adapter.start(RUN)                       // X увімкнув
    r.state.value = 'paused'                         // пауза (на ноутбуці) власника не скидає
    expect(r.adapter.state()).toEqual({ recording: 'paused', recording_by_mirror_run: RUN })
    await r.adapter.start(OTHER)                     // Y — «Почати» на паузі
    expect(r.adapter.state()).toEqual({ recording: 'recording', recording_by_mirror_run: RUN })
    expect(await r.adapter.stop(OTHER)).toMatchObject({ status: 'skipped' })
    expect(r.deps.finalize).not.toHaveBeenCalled()
    expect(await r.adapter.stop(RUN)).toMatchObject({ status: 'saved' })
  })

  it('не урок «Провести» — запис не вмикаємо: rejected not_lesson, стан unavailable, обробників не кличемо', async () => {
    for (const initial of ['idle', 'paused', 'recording'] as RoomRecordingState[]) {
      const r = room(initial)
      r.lesson.value = false
      expect(r.adapter.state()).toEqual({ recording: 'unavailable', recording_by_mirror_run: null })
      expect(await r.adapter.start(RUN)).toEqual({ mirror_run: RUN, cmd: 'start', status: 'rejected', reason: 'not_lesson' })
      expect(await r.adapter.stop(RUN)).toMatchObject({ status: 'skipped' })
      expect(r.deps.start).not.toHaveBeenCalled()
      expect(r.deps.resume).not.toHaveBeenCalled()
      expect(r.deps.finalize).not.toHaveBeenCalled()
    }
  })

  it('відмова (SAVE_BLOCKED) — причина у відповіді, один виклик, запуск не запам\'ятовано', async () => {
    const r = room('idle')
    r.startReason.value = 'save_blocked'
    const res = await r.adapter.start(RUN)
    expect(res).toEqual({ mirror_run: RUN, cmd: 'start', status: 'rejected', reason: 'save_blocked' })
    await flushPromises()
    expect(r.deps.start).toHaveBeenCalledTimes(1)   // без повтору (§12)
    expect(r.adapter.state()).toEqual({ recording: 'idle', recording_by_mirror_run: null })
  })

  it('після відмови учитель увімкнув запис кнопкою — запис не Дзеркала, «Зупинити» його не завершить', async () => {
    const r = room('idle')
    r.startReason.value = 'queue'
    await r.adapter.start(RUN)
    r.state.value = 'recording'                      // «Записати урок» на ноутбуці
    expect(r.adapter.state()).toEqual({ recording: 'recording', recording_by_mirror_run: null })
    expect(await r.adapter.stop(RUN)).toMatchObject({ status: 'skipped' })
    expect(r.deps.finalize).not.toHaveBeenCalled()
  })

  it('мережа на «Продовжити» — причина network, запуск не запам\'ятовано', async () => {
    const r = room('paused')
    r.resumeReason.value = 'network'
    expect(await r.adapter.start(RUN)).toEqual({ mirror_run: RUN, cmd: 'start', status: 'rejected', reason: 'network' })
    expect(r.adapter.state()).toEqual({ recording: 'paused', recording_by_mirror_run: null })
  })

  it('кімната саме змінює запис — busy, обробник не кличемо', async () => {
    const r = room('idle')
    r.loading.value = true
    expect(await r.adapter.start(RUN)).toEqual({ mirror_run: RUN, cmd: 'start', status: 'rejected', reason: 'busy' })
    expect(r.deps.start).not.toHaveBeenCalled()
  })
})

describe('адаптер запису на ноутбуці — «Зупинити» Дзеркала', () => {
  it('свій запуск — той самий шлях, що «Завершити запис»; saved', async () => {
    const r = room('idle')
    await r.adapter.start(RUN)
    const res = await r.adapter.stop(RUN)
    expect(r.deps.finalize).toHaveBeenCalledTimes(1)
    expect(res).toEqual({ mirror_run: RUN, cmd: 'stop', status: 'saved' })
    expect(r.adapter.state()).toEqual({ recording: 'idle', recording_by_mirror_run: null })
  })

  it('чужий або порожній mirror_run — нічого не робимо (skipped)', async () => {
    const r = room('idle')
    await r.adapter.start(RUN)
    for (const run of [OTHER, '']) {
      expect(await r.adapter.stop(run)).toEqual({ mirror_run: run, cmd: 'stop', status: 'skipped' })
    }
    expect(r.deps.finalize).not.toHaveBeenCalled()
    expect(r.adapter.state().recording).toBe('recording')
  })

  it('запис увімкнув учитель — Дзеркало його не завершує навіть «своїм» запуском', async () => {
    const r = room('recording')
    await r.adapter.start(RUN)                       // already — не наш
    expect(await r.adapter.stop(RUN)).toMatchObject({ status: 'skipped' })
    expect(r.deps.finalize).not.toHaveBeenCalled()
  })

  it('порожній запис — empty; відмова бар\'єра — причина (timeout), без повтору', async () => {
    const r = room('idle')
    await r.adapter.start(RUN)
    r.finalizeOutcome.value = 'timeout'
    expect(await r.adapter.stop(RUN)).toEqual({ mirror_run: RUN, cmd: 'stop', status: 'rejected', reason: 'timeout' })
    expect(r.deps.finalize).toHaveBeenCalledTimes(1)
    expect(r.adapter.state()).toEqual({ recording: 'recording', recording_by_mirror_run: RUN })   // запис і далі наш
    r.finalizeOutcome.value = 'empty'
    expect((await r.adapter.stop(RUN)).status).toBe('empty')
  })

  it('учитель завершив запис на ноутбуці — поле скинуто; новий запис кнопкою — не Дзеркала', async () => {
    const r = room('idle')
    await r.adapter.start(RUN)
    r.state.value = 'finalized'                      // «Завершити запис» на ноутбуці
    expect(r.adapter.state()).toEqual({ recording: 'idle', recording_by_mirror_run: null })
    r.state.value = 'recording'                      // «Записати урок» на ноутбуці — без жодного стану між ними
    expect(r.adapter.state()).toEqual({ recording: 'recording', recording_by_mirror_run: null })
    expect(await r.adapter.stop(RUN)).toMatchObject({ status: 'skipped' })
    expect(r.deps.finalize).not.toHaveBeenCalled()
  })

  it('пауза й «Продовжити» на ноутбуці цикл не змінюють — запис і далі запуску', async () => {
    const r = room('idle')
    await r.adapter.start(RUN)
    r.state.value = 'paused'
    expect(r.adapter.state()).toEqual({ recording: 'paused', recording_by_mirror_run: RUN })
    r.state.value = 'recording'
    expect(r.adapter.state().recording_by_mirror_run).toBe(RUN)
  })

  it('інша дошка — поле скинуто', async () => {
    const r = room('idle')
    await r.adapter.start(RUN)
    r.board.value = 'board-B'
    expect(r.adapter.state().recording_by_mirror_run).toBeNull()
  })
})

describe('аргументи команди на ноутбуці (не віримо на слово)', () => {
  it('лише { source: "mirror", mirror_run: UUID }', () => {
    expect(readRecordingRequest({ source: 'mirror', mirror_run: RUN })).toEqual({ mirrorRun: RUN })
    for (const bad of [undefined, {}, { source: 'remote', mirror_run: RUN }, { source: 'mirror', mirror_run: 'x' },
      { source: 'mirror', mirror_run: RUN.toUpperCase() }, { source: 'mirror' }]) {
      expect(readRecordingRequest(bad as never)).toBeNull()
    }
  })
})

// ── useBoardRemote ─────────────────────────────────────────────────────────────────────────

const mounted: Array<{ unmount: () => void }> = []
afterEach(() => { while (mounted.length) { try { mounted.pop()!.unmount() } catch { /* noop */ } } })

function remote(withRecording = true, initial: RoomRecordingState = 'idle') {
  const r = room(initial)
  const store = reactive({ currentPageIndex: 0, pageCount: 3, goToPage: vi.fn(), addPage: vi.fn() })
  const sendMessage = vi.fn()
  let api!: ReturnType<typeof useBoardRemote>
  const wrapper = mount(defineComponent({
    setup() {
      api = useBoardRemote({
        sessionId: ref<string | null>(SID), store, undo: vi.fn(), sendMessage, enabled: ref(true),
        ...(withRecording ? { recording: r.adapter } : {}),
      })
      return () => h('div')
    },
  }))
  mounted.push(wrapper)
  const command = (cmd: string, args: Record<string, unknown> = {}) =>
    window.dispatchEvent(new CustomEvent('wb:remote-command', { detail: { userId: 'u', pair: api.pairCode.value, clientId: 'phone', cmd, args } }))
  const states = () => sendMessage.mock.calls.map((c) => c[0]).filter((m: any) => m?.type === 'remote.state')
  const lastState = () => states()[states().length - 1]
  return { ...r, api, command, states, lastState }
}

describe('useBoardRemote v1.28 · команди запису від Дзеркала', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] }) })
  afterEach(() => { vi.useRealTimers() })

  const settle = async () => { await flushPromises(); vi.advanceTimersByTime(200); await flushPromises() }

  it('у кожному стані — recording і recording_by_mirror_run (новий ноутбук)', () => {
    const r = remote()
    r.command('hello')
    expect(r.lastState()).toMatchObject({ recording: 'idle', recording_by_mirror_run: null })
    expect(r.lastState()).not.toHaveProperty('recording_result')
  })

  it('recording.start → адаптер; одразу стан без старої відповіді, далі — відповідь і наш запуск', async () => {
    const r = remote()
    r.command('hello')
    const before = r.states().length
    r.command('recording.start', { source: 'mirror', mirror_run: RUN })
    expect(r.states().length).toBe(before + 1)           // окремий стан ОДРАЗУ, без recording_result
    expect(r.lastState()).not.toHaveProperty('recording_result')
    await settle()
    expect(r.deps.start).toHaveBeenCalledTimes(1)
    expect(r.lastState()).toMatchObject({
      recording: 'recording', recording_by_mirror_run: RUN,
      recording_result: { mirror_run: RUN, cmd: 'start', status: 'started' },
    })
  })

  it('відмова — recording_result rejected з причиною, без повтору', async () => {
    const r = remote()
    r.startReason.value = 'save_blocked'
    r.command('hello')
    r.command('recording.start', { source: 'mirror', mirror_run: RUN })
    await settle()
    vi.advanceTimersByTime(60_000)
    await flushPromises()
    expect(r.deps.start).toHaveBeenCalledTimes(1)
    expect(r.lastState()).toMatchObject({
      recording: 'idle', recording_by_mirror_run: null,
      recording_result: { mirror_run: RUN, cmd: 'start', status: 'rejected', reason: 'save_blocked' },
    })
  })

  it('recording.stop з чужим mirror_run — нічого не завершуємо; зі своїм — завершуємо', async () => {
    const r = remote()
    r.command('hello')
    r.command('recording.start', { source: 'mirror', mirror_run: RUN })
    await settle()
    r.command('recording.stop', { source: 'mirror', mirror_run: OTHER })
    await settle()
    expect(r.deps.finalize).not.toHaveBeenCalled()
    expect(r.lastState()).toMatchObject({ recording: 'recording', recording_result: { mirror_run: OTHER, cmd: 'stop', status: 'skipped' } })
    r.command('recording.stop', { source: 'mirror', mirror_run: RUN })
    await settle()
    expect(r.deps.finalize).toHaveBeenCalledTimes(1)
    expect(r.lastState()).toMatchObject({
      recording: 'idle', recording_by_mirror_run: null,
      recording_result: { mirror_run: RUN, cmd: 'stop', status: 'saved' },
    })
  })

  it('учитель зупинив запис на ноутбуці — новий стан одразу, без поля запуску', async () => {
    const r = remote()
    r.command('hello')
    r.command('recording.start', { source: 'mirror', mirror_run: RUN })
    await settle()
    const before = r.states().length
    r.state.value = 'finalized'
    await nextTick()
    await settle()
    expect(r.states().length).toBeGreaterThan(before)
    expect(r.lastState()).toMatchObject({ recording: 'idle', recording_by_mirror_run: null })
  })

  it('чужі аргументи (не з Дзеркала, без запуску) — команду не виконуємо', async () => {
    const r = remote()
    r.command('hello')
    r.command('recording.start', { source: 'remote', mirror_run: RUN })
    r.command('recording.start', { source: 'mirror' })
    await settle()
    expect(r.deps.start).not.toHaveBeenCalled()
    expect(r.lastState()).not.toHaveProperty('recording_result')
  })

  it('не урок «Провести» — у стані recording: unavailable; recording.start → rejected not_lesson, запису немає', async () => {
    const r = remote()
    r.lesson.value = false
    r.command('hello')
    expect(r.lastState()).toMatchObject({ recording: 'unavailable', recording_by_mirror_run: null })
    r.command('recording.start', { source: 'mirror', mirror_run: RUN })
    await settle()
    expect(r.deps.start).not.toHaveBeenCalled()
    expect(r.lastState()).toMatchObject({
      recording: 'unavailable', recording_by_mirror_run: null,
      recording_result: { mirror_run: RUN, cmd: 'start', status: 'rejected', reason: 'not_lesson' },
    })
  })

  it('ноутбук без адаптера запису (класна кімната) — rejected: unsupported, поля recording немає', async () => {
    const r = remote(false)
    r.command('hello')
    expect(r.lastState()).not.toHaveProperty('recording')
    r.command('recording.start', { source: 'mirror', mirror_run: RUN })
    await settle()
    expect(r.lastState()).toMatchObject({ recording_result: { mirror_run: RUN, cmd: 'start', status: 'rejected', reason: 'unsupported' } })
    expect(r.lastState()).not.toHaveProperty('recording')
  })
})

describe('WBSoloRoom · обв\'язка (сторож по джерелу — кімнату не змонтувати)', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../views/WBSoloRoom.vue'), 'utf-8')
  const between = (from: string, to: string) => {
    const at = src.indexOf(from)
    expect(at, from).toBeGreaterThan(-1)
    return src.slice(at, src.indexOf(to, at))
  }

  it('адаптер кличе саме обробники кнопок запису, стан — той самий, що в кнопки', () => {
    const block = between('recording: createRemoteRecordingAdapter({', '\n  }),')
    expect(block).toContain('state: () => soloRecordingState.value')
    // лише урок «Провести» — та сама умова, що в панелі запису (INV-LESSON-PLAY)
    expect(block).toContain('available: () => isLessonPlay.value')
    expect(src).toMatch(/<WBRecordingBanner\s+v-if="isSessionOwner && isLessonPlay && !constructorMode"/)
    expect(block).toContain('start: () => handleStartRecording()')
    expect(block).toContain('resume: () => handleResumeRecording()')
    expect(block).toContain('finalize: () => handleFinalizeRecording()')
    expect(block).toContain('busy: () => isRecordingLoading.value || _finalizeAttemptInFlight.value')
    // кнопки запису — ті самі обробники
    expect(src).toContain('@start="handleStartRecording"')
    expect(src).toContain('@resume="handleResumeRecording"')
    expect(src).toContain('@finalize="handleFinalizeRecording"')
  })

  it('«Записати урок»: бар\'єр артефакту з тим самим тостом, причина — назад; REST — startRecording', () => {
    const body = between('async function handleStartRecording(): Promise<RecordingRefusalReason | null> {', '\n}\n')
    expect(body).toMatch(/const blocked = await artifactBarrier\(\)\s*if \(blocked\) \{\s*notifyError\(barrierText\(blocked\)\)\s*return blocked\s*\}/)
    expect(body.indexOf('artifactBarrier()')).toBeLessThan(body.indexOf('m.startRecording(sid)'))
    expect(body).toMatch(/return null\s*\} catch \(e\) \{[\s\S]*?return recordingRequestFailure\(e\)/)
  })

  it('«Завершити запис» повертає saved / empty / причину з кожної гілки бар\'єра', () => {
    const body = between('async function _attemptFinalizeWithBarrier(sid: string): Promise<RecordingFinalizeOutcome> {', '\nfunction onFinalizeBarrierRetry')
    expect(body).toMatch(/flashRecordingEmptyNotice\(\)\s*return 'empty'/)
    expect(body).toMatch(/showRecordingDonePrompt\.value = true[\s\S]*?return 'saved'/)
    expect(body).toMatch(/finalizeBarrierState\.value = 'contention'\s*return 'contention'/)
    expect(body).toContain("return 'timeout'")
    expect(body).toMatch(/_handleFinalizeFailureFallback\(sid, err\)\s*return 'server'/)
    expect(between('async function handleFinalizeRecording(): Promise<RecordingFinalizeOutcome> {', '\n}\n'))
      .toContain('return _attemptFinalizeWithBarrier(sid)')
  })
})

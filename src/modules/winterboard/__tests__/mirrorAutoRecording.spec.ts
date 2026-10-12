// LAW §9 v1.28 (2026-10-12, власник: «Роби»; ТЗ TZ_MIRROR_AUTO_RECORDING §1, §2, §4) — ТЕЛЕФОН.
// «Дзеркало дошки»: «Почати» шле recording.start один раз; «Зупинити» (і «×») — recording.stop лише тоді, коли
// запис увімкнув саме цей запуск; стан, журнал і підсумок — словами; старий ноутбук — підказка оновити сторінку.
// Запис веде ноутбук (remoteRecordingLaptop.spec.ts); тут телефон лише просить і показує.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import fs from 'node:fs'
import path from 'node:path'
import uk from '../../../i18n/locales/uk.json'
import en from '../../../i18n/locales/en.json'
import ru from '../../../i18n/locales/ru.json'

vi.mock('../api/library', () => ({ uploadAsset: vi.fn() }))

import RemoteBoardMirror from '../components/remote/RemoteBoardMirror.vue'
import {
  RECORDING_REFUSAL_REASONS, parseRemoteRecording, parseRemoteRecordingResult,
  type RemoteRecordingInfo, type RemoteRecordingResult,
} from '../remote/recordingContract'

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
type Texts = Record<string, string> & { reason: Record<string, string> }
const MIRROR = (uk as unknown as { winterboard: { remote: { mirror: { rec: Texts; log: { rec: Record<string, string> }; stop: string } } } })
  .winterboard.remote.mirror
const REC = MIRROR.rec
const LOG = MIRROR.log.rec
const fill = (s: string, reason: string) => s.replace('{reason}', reason)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const OTHER = '7d2e8f10-1111-4c2d-8e3f-9a0b1c2d3e4f'

let track: { stop: ReturnType<typeof vi.fn>; readyState: string; addEventListener: () => void; removeEventListener: () => void }

beforeEach(() => {
  track = { stop: vi.fn(), readyState: 'live', addEventListener: vi.fn(), removeEventListener: vi.fn() }
  const stream = { getVideoTracks: () => [track], getTracks: () => [track] }
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn().mockResolvedValue(stream) }, configurable: true })
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
    configurable: true,
    get(this: { _src?: unknown }) { return this._src ?? null },
    set(this: { _src?: unknown }, v: unknown) { this._src = v },
  })
  localStorage.removeItem('wb.mirror.quad')
})
afterEach(() => { localStorage.removeItem('wb.mirror.quad') })

const IDLE: RemoteRecordingInfo = { state: 'idle', byMirrorRun: null }

function mirror(over: Record<string, unknown> = {}) {
  const sendRecording = vi.fn((_cmd: string, _run: string) => true)
  const w = mount(RemoteBoardMirror, {
    props: {
      ready: true, pageIndex: 0, result: null, sendBackground: vi.fn(() => true), boardId: 'board-A',
      recording: IDLE, recordingResult: null, sendRecording, ...over,
    },
    global: { plugins: [i18n()] },
    attachTo: document.body,
  })
  return { w, sendRecording: (over.sendRecording as typeof sendRecording | undefined) ?? sendRecording }
}

async function start(w: ReturnType<typeof mirror>['w']) {
  await flushPromises()
  const v = w.find('[data-testid="mirror-video"]').element as HTMLVideoElement
  Object.defineProperty(v, 'videoWidth', { value: 1280, configurable: true })
  Object.defineProperty(v, 'videoHeight', { value: 720, configurable: true })
  v.dispatchEvent(new Event('loadedmetadata'))
  await flushPromises()
  await w.find('[data-testid="mirror-start"]').trigger('click')
  await flushPromises()
  expect(w.find('[data-testid="board-mirror"]').attributes('data-phase')).toBe('running')
}

/** Ноутбук відповів: стан запису і відповідь на команду в одному remote.state */
async function laptop(w: ReturnType<typeof mirror>['w'], recording: RemoteRecordingInfo | null, result: RemoteRecordingResult | null) {
  await w.setProps({ recording, recordingResult: result })
  await flushPromises()
}

const recLine = (w: ReturnType<typeof mirror>['w']) => w.find('[data-testid="mirror-rec"]').text()
const logText = (w: ReturnType<typeof mirror>['w']) => w.find('[data-testid="mirror-log"]').text()
const summary = (w: ReturnType<typeof mirror>['w']) => w.find('[data-testid="mirror-rec-summary"]').text()
const startCalls = (s: ReturnType<typeof vi.fn>) => s.mock.calls.filter((c) => c[0] === 'recording.start')
const stopCalls = (s: ReturnType<typeof vi.fn>) => s.mock.calls.filter((c) => c[0] === 'recording.stop')

describe('«Почати» — запис уроку вмикається сам', () => {
  it('одна команда recording.start з UUID запуску; запис пішов — «● Запис уроку йде», у журналі «Запис уроку ввімкнено»', async () => {
    const { w, sendRecording } = mirror()
    try {
      await start(w)
      expect(sendRecording).toHaveBeenCalledTimes(1)
      const [cmd, run] = sendRecording.mock.calls[0]
      expect(cmd).toBe('recording.start')
      expect(run).toMatch(UUID)
      expect(recLine(w)).toBe(REC.starting)
      await laptop(w, { state: 'recording', byMirrorRun: run }, { mirror_run: run, cmd: 'start', status: 'started' })
      expect(recLine(w)).toBe(REC.on)
      expect(logText(w)).toContain(LOG.started)
      // той самий стан приходить і далі (кожен remote.state) — у журналі один рядок
      await laptop(w, { state: 'recording', byMirrorRun: run }, { mirror_run: run, cmd: 'start', status: 'started' })
      expect(logText(w).split(LOG.started).length - 1).toBe(1)
      expect(sendRecording).toHaveBeenCalledTimes(1)
    } finally { w.unmount() }
  })

  it('свій запис на паузі (учитель натиснув «Пауза») — «Почати» продовжує: «Запис уроку продовжено», «Зупинити» завершує', async () => {
    const { w, sendRecording } = mirror()
    try {
      await start(w)
      const run = sendRecording.mock.calls[0][1]
      await laptop(w, { state: 'recording', byMirrorRun: run }, { mirror_run: run, cmd: 'start', status: 'started' })
      await laptop(w, { state: 'paused', byMirrorRun: run }, { mirror_run: run, cmd: 'start', status: 'started' })
      expect(recLine(w)).toBe(REC.paused)
      await w.find('[data-testid="mirror-recalibrate"]').trigger('click')
      await w.find('[data-testid="mirror-start"]').trigger('click')
      await flushPromises()
      await laptop(w, { state: 'recording', byMirrorRun: run }, { mirror_run: run, cmd: 'start', status: 'resumed' })
      expect(recLine(w)).toBe(REC.on)
      expect(logText(w)).toContain(LOG.resumed)
      await w.find('[data-testid="mirror-stop"]').trigger('click')
      expect(stopCalls(sendRecording)).toEqual([['recording.stop', run]])
    } finally { w.unmount() }
  })

  it('чужий запис на паузі — «Почати» продовжує, але він не наш: «Дзеркало його не вмикало», «Зупинити» не шле', async () => {
    const { w, sendRecording } = mirror({ recording: { state: 'paused', byMirrorRun: null } })
    try {
      await start(w)
      const run = sendRecording.mock.calls[0][1]
      // ноутбук продовжив, власник циклу не змінився (увімкнули кнопкою — власника-Дзеркала немає)
      await laptop(w, { state: 'recording', byMirrorRun: null }, { mirror_run: run, cmd: 'start', status: 'resumed' })
      expect(recLine(w)).toBe(REC.onForeign)
      expect(logText(w)).toContain(LOG.resumedForeign)
      expect(logText(w).split(LOG.resumed).length - 1).toBe(1)    // лише всередині «…не вмикало», не окремим рядком
      await w.find('[data-testid="mirror-stop"]').trigger('click')
      await flushPromises()
      expect(stopCalls(sendRecording)).toHaveLength(0)
      expect(summary(w)).toBe(REC.onForeign)
    } finally { w.unmount() }
  })

  it('не урок «Провести» (recording: unavailable) — команди немає, сказано словами; Дзеркало працює', async () => {
    const { w, sendRecording } = mirror({ recording: { state: 'unavailable', byMirrorRun: null } })
    try {
      await start(w)
      expect(sendRecording).not.toHaveBeenCalled()
      expect(recLine(w)).toBe(REC.notLesson)
      expect(recLine(w)).toBe('На цій дошці запис уроку не ведеться. Щоб записати урок, відкрийте його: «Мої уроки» → «Провести». Знімки на дошку йдуть.')
      expect(recLine(w)).not.toBe(REC.oldLaptop)                  // це не «старий ноутбук»
      expect(logText(w)).toContain(LOG.notLesson)
      expect(w.find('[data-testid="board-mirror"]').attributes('data-phase')).toBe('running')
      await w.find('[data-testid="mirror-stop"]').trigger('click')
      await flushPromises()
      expect(sendRecording).not.toHaveBeenCalled()
      expect(summary(w)).toBe(REC.notLesson)
    } finally { w.unmount() }
  })

  it('відмова (SAVE_BLOCKED) — Дзеркало працює далі, причина словами, без повтору', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { w, sendRecording } = mirror()
    try {
      await start(w)
      const run = sendRecording.mock.calls[0][1]
      await laptop(w, IDLE, { mirror_run: run, cmd: 'start', status: 'rejected', reason: 'save_blocked' })
      expect(w.find('[data-testid="board-mirror"]').attributes('data-phase')).toBe('running')
      expect(recLine(w)).toBe(fill(REC.refused, REC.reason.save_blocked))
      expect(recLine(w)).toContain('Знімки на дошці зберігаються')
      expect(logText(w)).toContain(fill(LOG.refused, REC.reason.save_blocked))
      vi.advanceTimersByTime(60_000)
      await flushPromises()
      expect(sendRecording).toHaveBeenCalledTimes(1)
    } finally { w.unmount(); vi.useRealTimers() }
  })

  it('ноутбук не відповів за 15 с — причина словами, повтору немає', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { w, sendRecording } = mirror()
    try {
      await start(w)
      vi.advanceTimersByTime(14_000)
      await flushPromises()
      expect(recLine(w)).toBe(REC.starting)
      vi.advanceTimersByTime(1_500)
      await flushPromises()
      expect(recLine(w)).toBe(fill(REC.refused, REC.reason.no_answer))
      vi.advanceTimersByTime(60_000)
      await flushPromises()
      expect(sendRecording).toHaveBeenCalledTimes(1)
    } finally { w.unmount(); vi.useRealTimers() }
  })

  it('немає зв\'язку (канал не відправив) — одразу причина словами, Дзеркало працює', async () => {
    const sendRecording = vi.fn(() => false)
    const { w } = mirror({ sendRecording })
    try {
      await start(w)
      expect(sendRecording).toHaveBeenCalledTimes(1)
      expect(recLine(w)).toBe(fill(REC.refused, REC.reason.not_sent))
      expect(w.find('[data-testid="board-mirror"]').attributes('data-phase')).toBe('running')
    } finally { w.unmount() }
  })

  it('запис уже йшов (учитель увімкнув сам) — «Дзеркало його не вмикало», «Зупинити» команди не шле', async () => {
    const { w, sendRecording } = mirror({ recording: { state: 'recording', byMirrorRun: null } })
    try {
      await start(w)
      const run = sendRecording.mock.calls[0][1]
      await laptop(w, { state: 'recording', byMirrorRun: null }, { mirror_run: run, cmd: 'start', status: 'already' })
      expect(recLine(w)).toBe(REC.onForeign)
      expect(logText(w)).toContain(LOG.alreadyForeign)
      await w.find('[data-testid="mirror-stop"]').trigger('click')
      await flushPromises()
      expect(stopCalls(sendRecording)).toHaveLength(0)
      expect(summary(w)).toBe(REC.onForeign)
    } finally { w.unmount() }
  })

  it('старий ноутбук (у стані немає recording) — команди немає, підказка «Оновіть сторінку…»', async () => {
    const { w, sendRecording } = mirror({ recording: null })
    try {
      await start(w)
      expect(sendRecording).not.toHaveBeenCalled()
      expect(recLine(w)).toBe(REC.oldLaptop)
      expect(logText(w)).toContain(LOG.oldLaptop)
      await w.find('[data-testid="mirror-stop"]').trigger('click')
      await flushPromises()
      expect(sendRecording).not.toHaveBeenCalled()
    } finally { w.unmount() }
  })

  it('«Кути» → «Почати» — знову рівно одна команда на натиск, той самий запуск', async () => {
    const { w, sendRecording } = mirror()
    try {
      await start(w)
      const run = sendRecording.mock.calls[0][1]
      await laptop(w, { state: 'recording', byMirrorRun: run }, { mirror_run: run, cmd: 'start', status: 'started' })
      await w.find('[data-testid="mirror-recalibrate"]').trigger('click')
      await w.find('[data-testid="mirror-start"]').trigger('click')
      await flushPromises()
      expect(startCalls(sendRecording)).toEqual([['recording.start', run], ['recording.start', run]])
      await laptop(w, { state: 'recording', byMirrorRun: run }, { mirror_run: run, cmd: 'start', status: 'already' })
      expect(recLine(w)).toBe(REC.on)
    } finally { w.unmount() }
  })
})

describe('«Зупинити» — запис уроку завершується, лише свій', () => {
  it('свій запис — recording.stop того самого запуску; saved — «Урок збережено в «Моїх записах»», журнал «Запис завершено»', async () => {
    const { w, sendRecording } = mirror()
    try {
      await start(w)
      const run = sendRecording.mock.calls[0][1]
      await laptop(w, { state: 'recording', byMirrorRun: run }, { mirror_run: run, cmd: 'start', status: 'started' })
      await w.find('[data-testid="mirror-stop"]').trigger('click')
      await flushPromises()
      expect(stopCalls(sendRecording)).toEqual([['recording.stop', run]])
      expect(summary(w)).toBe(REC.stopping)
      // стан запису міняється раніше за відповідь — це не «завершено на ноутбуці»
      await laptop(w, IDLE, null)
      expect(summary(w)).toBe(REC.stopping)
      await laptop(w, IDLE, { mirror_run: run, cmd: 'stop', status: 'saved' })
      expect(summary(w)).toBe(REC.saved)
      expect(summary(w)).toBe('Урок збережено в «Моїх записах»')
      expect(logText(w)).toContain(LOG.saved)
      expect(logText(w)).not.toContain(LOG.endedOnLaptop)
    } finally { w.unmount() }
  })

  it('порожній запис — не «Урок збережено», а що сталося', async () => {
    const { w, sendRecording } = mirror()
    try {
      await start(w)
      const run = sendRecording.mock.calls[0][1]
      await laptop(w, { state: 'recording', byMirrorRun: run }, { mirror_run: run, cmd: 'start', status: 'started' })
      await w.find('[data-testid="mirror-stop"]').trigger('click')
      await laptop(w, IDLE, { mirror_run: run, cmd: 'stop', status: 'empty' })
      expect(summary(w)).toBe(REC.empty)
      expect(summary(w)).not.toBe(REC.saved)
    } finally { w.unmount() }
  })

  it('завершення не вдалось (бар\'єр) — причина й «Завершити запис» на ноутбуці, без повтору', async () => {
    const { w, sendRecording } = mirror()
    try {
      await start(w)
      const run = sendRecording.mock.calls[0][1]
      await laptop(w, { state: 'recording', byMirrorRun: run }, { mirror_run: run, cmd: 'start', status: 'started' })
      await w.find('[data-testid="mirror-stop"]').trigger('click')
      await laptop(w, { state: 'recording', byMirrorRun: run }, { mirror_run: run, cmd: 'stop', status: 'rejected', reason: 'timeout' })
      expect(summary(w)).toBe(fill(REC.stopRefused, REC.reason.timeout))
      expect(stopCalls(sendRecording)).toHaveLength(1)
    } finally { w.unmount() }
  })

  it('учитель зупинив запис на ноутбуці — «Запис завершено на ноутбуці», «Зупинити» вже нічого не шле', async () => {
    const { w, sendRecording } = mirror()
    try {
      await start(w)
      const run = sendRecording.mock.calls[0][1]
      await laptop(w, { state: 'recording', byMirrorRun: run }, { mirror_run: run, cmd: 'start', status: 'started' })
      await laptop(w, IDLE, { mirror_run: run, cmd: 'start', status: 'started' })
      expect(recLine(w)).toBe(REC.endedOnLaptop)
      expect(logText(w)).toContain(LOG.endedOnLaptop)
      await w.find('[data-testid="mirror-stop"]').trigger('click')
      await flushPromises()
      expect(stopCalls(sendRecording)).toHaveLength(0)
      expect(summary(w)).toBe(REC.endedOnLaptop)
    } finally { w.unmount() }
  })

  it('запис іншого запуску (чужий mirror_run) — «Зупинити» команди не шле', async () => {
    const { w, sendRecording } = mirror()
    try {
      await start(w)
      const run = sendRecording.mock.calls[0][1]
      await laptop(w, { state: 'recording', byMirrorRun: OTHER }, { mirror_run: run, cmd: 'start', status: 'already' })
      await w.find('[data-testid="mirror-stop"]').trigger('click')
      await flushPromises()
      expect(stopCalls(sendRecording)).toHaveLength(0)
    } finally { w.unmount() }
  })

  it('Дзеркало спинилось з причини (камера) — запис не чіпає; «✕» потім завершує свій запис', async () => {
    const { w, sendRecording } = mirror()
    try {
      await start(w)
      const run = sendRecording.mock.calls[0][1]
      await laptop(w, { state: 'recording', byMirrorRun: run }, { mirror_run: run, cmd: 'start', status: 'started' })
      track.readyState = 'ended'
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      ;(navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'NotReadableError' }))
      document.dispatchEvent(new Event('visibilitychange'))
      await flushPromises()
      expect(w.find('[data-testid="board-mirror"]').attributes('data-phase')).toBe('stopped')
      expect(stopCalls(sendRecording)).toHaveLength(0)
      expect(summary(w)).toBe(REC.goesOn)
      await w.find('[data-testid="mirror-close"]').trigger('click')
      expect(stopCalls(sendRecording)).toEqual([['recording.stop', run]])
    } finally { w.unmount() }
  })

  it('«✕» у роботі — той самий stop(\'user\'): одна команда recording.stop', async () => {
    const { w, sendRecording } = mirror()
    try {
      await start(w)
      const run = sendRecording.mock.calls[0][1]
      await laptop(w, { state: 'recording', byMirrorRun: run }, { mirror_run: run, cmd: 'start', status: 'started' })
      await w.find('[data-testid="mirror-close"]').trigger('click')
      expect(stopCalls(sendRecording)).toEqual([['recording.stop', run]])
      expect(w.emitted('close')).toHaveLength(1)
    } finally { w.unmount() }
  })
})

describe('контракт і тексти', () => {
  it('телефон розбирає стан за закритими наборами', () => {
    const RUN = '0c1f7c9e-5b7a-4d1e-9f3a-2b6c8d4e1a90'
    expect(parseRemoteRecording({ recording: 'recording', recording_by_mirror_run: RUN })).toEqual({ state: 'recording', byMirrorRun: RUN })
    expect(parseRemoteRecording({ recording: 'idle', recording_by_mirror_run: null })).toEqual({ state: 'idle', byMirrorRun: null })
    expect(parseRemoteRecording({})).toBeUndefined()                         // старий ноутбук
    expect(parseRemoteRecording({ recording: 'unavailable', recording_by_mirror_run: null }))  // не урок — це поле, не «немає»
      .toEqual({ state: 'unavailable', byMirrorRun: null })
    expect(parseRemoteRecording({ recording: 'finalized' })).toBeUndefined()
    expect(parseRemoteRecordingResult({ mirror_run: RUN, cmd: 'stop', status: 'saved' })).toEqual({ mirror_run: RUN, cmd: 'stop', status: 'saved' })
    expect(parseRemoteRecordingResult({ mirror_run: RUN, cmd: 'start', status: 'rejected', reason: 'busy' })).toMatchObject({ reason: 'busy' })
    for (const bad of [
      { mirror_run: RUN, cmd: 'start', status: 'saved' },
      { mirror_run: RUN, cmd: 'start', status: 'rejected' },
      { mirror_run: RUN, cmd: 'stop', status: 'saved', reason: 'busy' },
      { mirror_run: 'x', cmd: 'start', status: 'started' },
      [RUN], 'started', null,
    ]) expect(parseRemoteRecordingResult(bad)).toBeUndefined()
  })

  it('усі тексти запису є в uk / en / ru, з {reason} там, де причина; кожна причина має слова', () => {
    const phoneOnly = ['not_sent', 'no_answer']
    for (const loc of [uk, en, ru] as unknown as Array<typeof uk>) {
      const m = (loc as unknown as { winterboard: { remote: { mirror: { rec: Texts; log: { rec: Record<string, string> } } } } }).winterboard.remote.mirror
      for (const k of Object.keys(REC)) expect(m.rec[k], k).toBeTruthy()
      for (const k of Object.keys(LOG)) expect(m.log.rec[k], k).toBeTruthy()
      for (const r of [...RECORDING_REFUSAL_REASONS, ...phoneOnly]) expect(m.rec.reason[r], r).toBeTruthy()
      expect(m.rec.refused).toContain('{reason}')
      expect(m.rec.stopRefused).toContain('{reason}')
      expect(m.log.rec.refused).toContain('{reason}')
    }
    // кнопки ноутбука — так, як вони підписані на екрані
    const w = (uk as unknown as { winterboard: { recording: { start: string } } }).winterboard.recording
    expect(REC.refused).toContain(`«${w.start}»`)
  })

  it('пульт: Дзеркало отримує стан запису й шле команду лише з запуском; загальної кнопки запису немає', () => {
    const view = fs.readFileSync(path.resolve(__dirname, '../views/WBRemoteView.vue'), 'utf-8')
    expect(view).toMatch(/<RemoteBoardMirror[\s\S]*?:recording="recording"[\s\S]*?:recording-result="recordingResult"[\s\S]*?:send-recording="sendRecording"/)
    expect(view).toMatch(/function sendRecording\(cmd: RemoteRecordingCmd, mirrorRun: string\): boolean \{\s*return sendCmd\(cmd, \{ source: RECORDING_SOURCE, mirror_run: mirrorRun \}\)/)
    // recording.* шле лише Дзеркало — ніде в розмітці пульта немає власної кнопки запису
    expect(view.match(/recording\.(start|stop)/g) ?? []).toEqual([])
    expect(view.match(/sendRecording\(/g)).toHaveLength(1)
  })
})

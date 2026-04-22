/**
 * Regression test: WBClassroomRoom — Manual Recording wiring.
 *
 * Bug (2026-04-22): Кнопка "Записати урок" у classroom була некликабельна —
 * <WBRecordingBanner> отримував хардкодовано :is-recording="false", а `@start`/
 * `@stop` емітів не слухав ніхто. Компонент WBRecordingBanner коректно робив
 * $emit('start'), але у WBClassroomRoom цей емiт летів у порожнечу.
 *
 * Fix: підключено реактивні refs + handleStartRecording/handleStopRecording
 * (паритет з WBSoloRoom).
 *
 * Цей тест НЕ монтує WBClassroomRoom (занадто багато залежностей), а
 * перевіряє source-level інваріанти — саме ті рядки, які ламалися, і ті,
 * які мають бути присутніми після fix-у. Це дешево, детерміновано, і
 * catches the EXACT regression.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SOURCE = readFileSync(
  resolve(__dirname, '../views/WBClassroomRoom.vue'),
  'utf-8',
)

describe('WBClassroomRoom — WBRecordingBanner wiring', () => {
  it('does NOT hardcode :is-recording="false" (regression guard)', () => {
    // Регресія: банер мав хардкод, через який recording state не реактивний.
    expect(SOURCE).not.toMatch(/:is-recording="false"/)
  })

  it('does NOT hardcode :is-frozen="false" (regression guard)', () => {
    expect(SOURCE).not.toMatch(/:is-frozen="false"/)
  })

  it('WBRecordingBanner отримує реактивний isManualRecording', () => {
    expect(SOURCE).toMatch(/:is-recording="isManualRecording"/)
  })

  it('WBRecordingBanner отримує реактивний isReplayFrozen', () => {
    expect(SOURCE).toMatch(/:is-frozen="isReplayFrozen"/)
  })

  it('WBRecordingBanner має обробник @start → handleStartRecording', () => {
    expect(SOURCE).toMatch(/@start="handleStartRecording"/)
  })

  it('WBRecordingBanner має обробник @stop → handleStopRecording', () => {
    expect(SOURCE).toMatch(/@stop="handleStopRecording"/)
  })

  it('WBRecordingBanner передає is-loading + recording-started-at для UX', () => {
    expect(SOURCE).toMatch(/:is-loading="isRecordingLoading"/)
    expect(SOURCE).toMatch(/:recording-started-at="recordingStartedAt"/)
  })

  it('Всі необхідні refs оголошені у setup', () => {
    expect(SOURCE).toMatch(/const isManualRecording = ref\(false\)/)
    expect(SOURCE).toMatch(/const isReplayFrozen = ref\(false\)/)
    expect(SOURCE).toMatch(/const isRecordingLoading = ref\(false\)/)
    expect(SOURCE).toMatch(/const recordingStartedAt = ref<string \| null>\(null\)/)
  })

  it('handleStartRecording викликає API startRecording з resolvedSessionId', () => {
    expect(SOURCE).toMatch(/async function handleStartRecording/)
    // Використовує api/replay.startRecording (паритет з WBSoloRoom)
    expect(SOURCE).toMatch(/m\.startRecording\(sid\)/)
  })

  it('handleStartRecording викликає autosave.saveNow() перед recording (INV-T)', () => {
    // INV-T: backend робить deepcopy(session.state) у recording_start_state;
    // flush необхідний щоб state на backend був актуальним.
    const handlerBlock = SOURCE.split('async function handleStartRecording')[1]
    expect(handlerBlock).toBeDefined()
    const startHandlerEnd = handlerBlock!.indexOf('async function handleStopRecording')
    const startBody = handlerBlock!.slice(0, startHandlerEnd)
    expect(startBody).toMatch(/autosave\.saveNow\(\)/)
  })

  it('handleStartRecording guard: не стартує при isReplayFrozen або вже recording', () => {
    const handlerBlock = SOURCE.split('async function handleStartRecording')[1]!
    const startBody = handlerBlock.slice(0, handlerBlock.indexOf('async function handleStopRecording'))
    expect(startBody).toMatch(/isManualRecording\.value/)
    expect(startBody).toMatch(/isReplayFrozen\.value/)
  })

  it('handleStopRecording викликає API stopRecording', () => {
    expect(SOURCE).toMatch(/async function handleStopRecording/)
    expect(SOURCE).toMatch(/m\.stopRecording\(sid\)/)
  })

  it('handleStopRecording має local fallback якщо API fail', () => {
    // P0.5 (паритет з Solo): якщо stop-recording API unreachable — ми все
    // одно зупиняємо UI щоб юзер не застряг.
    const stopBlock = SOURCE.split('async function handleStopRecording')[1]!
    expect(stopBlock).toMatch(/Local fallback/i)
    expect(stopBlock).toMatch(/localStorage\.setItem/)
  })

  it('initBoardWithSession hydrate recording state з detail', () => {
    // Після getSession() — підтягнути actual state щоб banner показав
    // правильний REC/frozen одразу, а не порожній "Записати".
    expect(SOURCE).toMatch(/isReplayFrozen\.value = Boolean\(detail\.is_replay_frozen\)/)
    expect(SOURCE).toMatch(/detail\.recording_started_at && !detail\.recording_stopped_at/)
  })

  it('recording banner рендериться тільки для teacher в edit mode', () => {
    // Security / UX: students НЕ бачать кнопки recording.
    expect(SOURCE).toMatch(
      /v-if="mode === 'edit' && classroomRole\.isTeacher\.value"/,
    )
  })
})

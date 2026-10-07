/**
 * Порожній запис не зберігається (рішення власника 2026-10-07: «роби порожній запис не зберігати»).
 *
 * Сервер: «Завершити запис» без жодної дії після «Записати урок» Replay не створює і повертає
 * `recording_empty: true` + `latest_replay_id` (найновіший наявний запис дошки). Кімната показує
 * «Запис не збережено» під кнопкою запису замість віконця «Запис готовий!», а «Поділитися» лишає
 * на найновішому наявному записі. Кімнати в тестах не монтуються — їхня обв'язка тут сторожем по
 * джерелу; панелі запису монтуються.
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import fs from 'node:fs'
import path from 'node:path'

import WBRecordingBanner from '../components/replay/WBRecordingBanner.vue'
import WBClassroomRecordingControls from '../components/replay/WBClassroomRecordingControls.vue'

describe('«Запис не збережено» під кнопкою запису', () => {
  const mountPanel = (kind: 'solo' | 'class', emptyNotice: boolean) => (kind === 'solo'
    ? mount(WBRecordingBanner, { props: { recordingState: 'idle', emptyNotice } })
    : mount(WBClassroomRecordingControls, {
      props: { recordingState: 'idle', recordingStartedAt: null, emptyNotice },
    }))

  for (const [name, kind] of [
    ['соло: WBRecordingBanner', 'solo'],
    ['клас: WBClassroomRecordingControls', 'class'],
  ] as const) {
    it(`${name}: показує повідомлення лише з emptyNotice, × просить сховати`, async () => {
      const off = mountPanel(kind, false)
      expect(off.find('.wb-rec-empty').exists()).toBe(false)

      const on = mountPanel(kind, true)
      const notice = on.find('.wb-rec-empty')
      expect(notice.exists()).toBe(true)
      expect(notice.attributes('role')).toBe('status')
      // Кнопка «Записати урок» лишається — новий запис можна почати одразу.
      expect(on.find('button[class*="--start"]').exists()).toBe(true)
      await notice.find('.wb-rec-empty__close').trigger('click')
      expect(on.emitted('dismiss-empty-notice')).toHaveLength(1)
    })
  }
})

describe('обв’язка кімнат (сторож по джерелу)', () => {
  const read = (f: string) => fs.readFileSync(path.resolve(__dirname, `../views/${f}`), 'utf-8')

  for (const room of ['WBSoloRoom.vue', 'WBClassroomRoom.vue']) {
    const src = read(room)

    it(`${room}: порожній запис — повідомлення під кнопкою, без «Запис готовий!», «Поділитися» — найновіший наявний`, () => {
      const at = src.indexOf('replayApi.finalizeWithBarrier(sid, flushed_last_seq)')
      expect(at).toBeGreaterThan(-1)
      const handler = src.slice(at, src.indexOf('} catch (err: unknown) {', at))
      expect(handler).toMatch(
        /if \(result\.recording_empty\) \{[\s\S]*?activeReplayId\.value = result\.latest_replay_id \?\? null\s*flashRecordingEmptyNotice\(\)/,
      )
      // «Запис готовий!» відкривається лише в гілці справжнього запису.
      const emptyAt = handler.indexOf('if (result.recording_empty)')
      const promptAt = handler.indexOf('showRecordingDonePrompt.value = true')
      expect(promptAt).toBeGreaterThan(emptyAt)
      expect(handler.slice(emptyAt, promptAt)).toMatch(/\} else \{|!result\.recording_empty/)
    })

    it(`${room}: панель запису отримує повідомлення, новий старт його ховає`, () => {
      expect(src).toContain(':empty-notice="showRecordingEmptyNotice"')
      expect(src).toContain('@dismiss-empty-notice="hideRecordingEmptyNotice"')
      const startAt = src.indexOf('async function handleStartRecording')
      const startBody = src.slice(startAt, src.indexOf('\n}\n', startAt))
      expect(startBody).toContain('hideRecordingEmptyNotice()')
    })
  }
})

describe('тексти «Запис не збережено» є в усіх мовах', () => {
  for (const loc of ['uk', 'en', 'ru']) {
    it(loc, () => {
      const json = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../i18n/locales/${loc}.json`), 'utf-8'))
      expect(json.winterboard.replay.recordingEmpty, `${loc}: recordingEmpty`).toBeTruthy()
      expect(json.winterboard.replay.recordingEmptyHint, `${loc}: recordingEmptyHint`).toBeTruthy()
      // Підказка називає кнопки так, як вони підписані на екрані.
      expect(json.winterboard.replay.recordingEmptyHint).toContain(json.winterboard.recording.start)
      expect(json.winterboard.replay.recordingEmptyHint).toContain(json.winterboard.recording.finalize)
      expect(json.winterboard.classroom.endedRecordingEmpty).toContain(json.winterboard.recording.start)
    })
  }
})

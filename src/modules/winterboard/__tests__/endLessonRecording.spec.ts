/**
 * Б-116 (власник 2026-10-04): «Завершити урок» спершу закриває відкритий запис тим самим шляхом,
 * що «Завершити запис», а вчитель на головній бачить «Урок завершено. Запис — у «Мої записи»».
 *
 * Правило — board/endLessonRecording.ts; обв'язка в кімнаті (WBClassroomRoom) — сторожем по
 * джерелу: кімнати в тестах не монтуються.
 */
import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import { closeRecordingBeforeEndLesson } from '../board/endLessonRecording'
import type { FinalizeRecordingResult } from '../api/replay'

const FINALIZED = { recording_state: 'finalized', replay_id: 'r-1' } as unknown as FinalizeRecordingResult

describe('closeRecordingBeforeEndLesson', () => {
  it('усі дії на сервер, потім finalize з seq, прочитаним ПІСЛЯ flushAll', async () => {
    const order: string[] = []
    let seq = 10
    const r = await closeRecordingBeforeEndLesson('sess-1', {
      flushAll: async () => { order.push('flushAll'); seq = 42 },
      serverSeq: () => seq,
      finalizeWithBarrier: async (sid, s) => { order.push(`finalize:${sid}:${s}`); return FINALIZED },
    })
    expect(order).toEqual(['flushAll', 'finalize:sess-1:42'])
    expect(r).toEqual({ outcome: 'saved', result: FINALIZED })
  })

  it('дії не дійшли до сервера (flushAll кинув) → finalize не кличемо, запис закриє сторож', async () => {
    const boom = new Error('PAUSED')
    const finalize = vi.fn()
    const r = await closeRecordingBeforeEndLesson('sess-1', {
      flushAll: async () => { throw boom },
      serverSeq: () => 7,
      finalizeWithBarrier: finalize,
    })
    expect(finalize).not.toHaveBeenCalled()
    expect(r).toEqual({ outcome: 'later', error: boom })
  })

  it('порожній запис сервер не зберіг (recording_empty) → «порожній», а не «запис — у Моїх записах»', async () => {
    // Рішення власника 2026-10-07: «роби порожній запис не зберігати».
    const EMPTY = {
      status: 'discarded', recording_state: 'idle', replay_id: null,
      recording_empty: true, latest_replay_id: null,
    } as unknown as FinalizeRecordingResult
    const r = await closeRecordingBeforeEndLesson('sess-1', {
      flushAll: async () => {},
      serverSeq: () => 5,
      finalizeWithBarrier: async () => EMPTY,
    })
    expect(r).toEqual({ outcome: 'empty', result: EMPTY })
  })

  it('finalize не вдався (бар’єр, мережа) → «згодом», одна спроба без повторів', async () => {
    const timeout = new Error('FINALIZE_BARRIER_TIMEOUT')
    const finalize = vi.fn(async () => { throw timeout })
    const r = await closeRecordingBeforeEndLesson('sess-1', {
      flushAll: async () => {},
      serverSeq: () => 3,
      finalizeWithBarrier: finalize,
    })
    expect(finalize).toHaveBeenCalledTimes(1)
    expect(r).toEqual({ outcome: 'later', error: timeout })
  })
})

describe('сторож обв’язки в WBClassroomRoom', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../views/WBClassroomRoom.vue'), 'utf-8')
  const start = src.indexOf('async function confirmEndSession')
  const body = src.slice(start, src.indexOf('// ─── Handlers: Lesson lifecycle', start))

  it('запис закривається ДО endSession і лише коли він відкритий', () => {
    expect(body).toMatch(
      /if \(isSessionActive\.value && !_finalizeAttemptInFlight\.value\) \{\s*endLessonRecordingOutcome = await finalizeRecordingBeforeEndLesson\(sid\)\s*\}/,
    )
    const finalizeAt = body.indexOf('await finalizeRecordingBeforeEndLesson(sid)')
    const endAt = body.indexOf('winterboardApi.endSession(sid)')
    expect(finalizeAt).toBeGreaterThan(-1)
    expect(endAt).toBeGreaterThan(finalizeAt)
  })

  it('кімната кличе саме перевірену функцію, з flushAll і серверним seq', () => {
    expect(body).toContain('closeRecordingBeforeEndLesson(sid, {')
    expect(body).toContain('flushAll: () => opsSync.flushAll()')
    expect(body).toContain('serverSeq: () => opsSync.serverSeq')
  })

  it('сповіщення про запис — після успішного endSession і до переходу на головну', () => {
    const endAt = body.indexOf('winterboardApi.endSession(sid)')
    const savedAt = body.indexOf("t('winterboard.classroom.endedRecordingSaved')")
    const emptyAt = body.indexOf("t('winterboard.classroom.endedRecordingEmpty')")
    const laterAt = body.indexOf("t('winterboard.classroom.endedRecordingLater')")
    const pushAt = body.indexOf('router.push(dashboardPath.value)')
    expect(savedAt).toBeGreaterThan(endAt)
    expect(emptyAt).toBeGreaterThan(endAt)
    expect(laterAt).toBeGreaterThan(endAt)
    expect(pushAt).toBeGreaterThan(Math.max(savedAt, emptyAt, laterAt))
  })

  it('порожній запис — своє сповіщення, а не «запис — у Моїх записах»', () => {
    expect(body).toMatch(
      /endLessonRecordingOutcome === 'empty'\) \{\s*notifyInfo\(t\('winterboard\.classroom\.endedRecordingEmpty'\)/,
    )
  })
})

describe('тексти Б-116/Б-117 є в усіх мовах', () => {
  const KEYS = [
    'endedRecordingSaved', 'endedRecordingLater', 'endedRecordingEmpty', 'lessonCompletedByTeacher', 'toHome',
  ]
  for (const loc of ['uk', 'en', 'ru']) {
    it(loc, () => {
      const json = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../i18n/locales/${loc}.json`), 'utf-8'))
      for (const k of KEYS) expect(json.winterboard.classroom[k], `${loc}: ${k}`).toBeTruthy()
    })
  }
})

/**
 * INV-LESSON-PLAY (MANIFEST, REPLAY_PIPELINE_SSOT §5.2): у Solo запис — ЛИШЕ в
 * уроці з «Провести урок». 2026-09-24 я показала бейдж запису й на звичайних
 * дошках (`isLessonPlay || стан ≠ idle`) — власник: «в соло немає бути запису».
 * Кімнату не змонтувати, тож контракт вихідного коду (прецедент: boardObjectStandard.spec).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const src = readFileSync(resolve(__dirname, '../views/WBSoloRoom.vue'), 'utf-8')

describe('WBSoloRoom · запис лише в уроці', () => {
  it('бейдж/кнопки запису — тільки isLessonPlay', () => {
    expect(src).toMatch(/<WBRecordingBanner\s+v-if="isSessionOwner && isLessonPlay && !constructorMode"/)
  })

  it('вікно «Почати новий запис» — теж тільки в уроці', () => {
    expect(src).toMatch(/isBoardFrozen\.value && isLessonPlay\.value && isSessionOwner\.value/)
  })
})

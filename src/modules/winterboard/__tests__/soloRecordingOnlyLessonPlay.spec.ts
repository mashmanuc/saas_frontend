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

  it('завершений запис дошку не блокує — ні вікна, ні read-only (INV-23 v3, 2026-09-27)', () => {
    // Новий запис — лише кнопкою запису (вона сама в уроці, див. тест вище).
    expect(src).not.toMatch(/useFrozenEditGuard|isBoardFrozen|WBRecordingRestartConfirmModal/)
    // Друга умова — «Зберегти як новий шаблон» (власник 2026-09-28): 1–3 с, поки сервер
    // знімає стан, дошка не пише. До запису вона не має стосунку; стану запису тут як не було.
    expect(src).toMatch(/const soloEffectiveTool = computed\(\(\) =>\s*\(opsSync\.inputLocked \|\| savingTemplate\.value \? 'select' : store\.currentTool\)\)/)
  })
})

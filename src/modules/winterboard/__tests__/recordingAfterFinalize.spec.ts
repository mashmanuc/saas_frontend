/**
 * INV-23 v3 (рішення власника 2026-09-27): завершений запис дошку НЕ блокує.
 * Новий запис — лише добровільно, звичайною кнопкою запису, з поточного стану;
 * попередній лишається в «Моїх записах».
 *
 * Класну кімнату не змонтувати, тож для неї — контракт вихідного коду
 * (прецедент: soloRecordingOnlyLessonPlay.spec).
 */
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import WBClassroomRecordingControls from '../components/replay/WBClassroomRecordingControls.vue'

const classroom = readFileSync(resolve(__dirname, '../views/WBClassroomRoom.vue'), 'utf-8')

describe('INV-23 v3 · класна кімната після «Завершити запис»', () => {
  it('панель вчителя: finalized → та сама «Записати урок», емітить start', async () => {
    const w = mount(WBClassroomRecordingControls, { props: { recordingState: 'finalized', recordingStartedAt: null } })
    const btn = w.find('button.wb-classroom-recording__btn--start')
    expect(btn.exists()).toBe(true)
    expect(w.findAll('button')).toHaveLength(1)
    await btn.trigger('click')
    expect(w.emitted('start')).toHaveLength(1)
    expect(w.emitted('restart')).toBeUndefined()
  })

  it('кімната не блокує дошку завершеним записом: ні вікна, ні read-only, ні frozen у пульті', () => {
    expect(classroom).not.toMatch(/useFrozenEditGuard|isBoardFrozen|guardFrozenEdit|WBRecordingRestartConfirmModal/)
    expect(classroom).not.toMatch(/frozen: /)
  })

  it('автозавершення сторожем кімната бачить: heartbeat-колбек і розсилка «finalized» для вчителя', () => {
    // Рецензія 2026-09-27: без відмови REPLAY_FROZEN_NO_WRITE кімната лишалась у «REC».
    expect(classroom).toMatch(/useRecordingHeartbeat\(\{[\s\S]*?onRecordingEnded: onRecordingEndedByServer/)
    expect(classroom).toMatch(/classroomRole\.isTeacher\.value && next === 'finalized'/)
    expect(classroom).toMatch(/t\('winterboard\.recording\.autoFinalized'\)/)
  })
})

describe('INV-23 v3 · соло після автозавершення сторожем', () => {
  const solo = readFileSync(resolve(__dirname, '../views/WBSoloRoom.vue'), 'utf-8')

  it('heartbeat-колбек переводить кімнату в «завершено» з тостом', () => {
    expect(solo).toMatch(/useRecordingHeartbeat\(\{[\s\S]*?onRecordingEnded: onRecordingEndedByServer/)
    expect(solo).toMatch(/function onRecordingEndedByServer\(state: string \| null\): void \{[\s\S]*?isManualRecording\.value = false[\s\S]*?t\('winterboard\.recording\.autoFinalized'\)/)
  })
})

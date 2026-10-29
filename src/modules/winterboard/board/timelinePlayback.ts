/**
 * Шкала подій «▶ по черзі» — ефемерний стан ЦЬОГО екрана (LAW §9 v1.75), як стан програвача відео: не ops, не Replay.
 *
 * Власник 2026-10-29: «Розгортати на цілий екран. Переключати події. Або вмикати. Або ставити на паузу». ▶ на картці
 * й ▶ на пульті — один і той самий стан: таймер живе в картці (`TimelineAxisView`), кожен крок — той самий один
 * `asset_update` `active_event_id`, що кнопки картки. Пульт лише вмикає й вимикає його тут (`remoteScenarioAdapter`)
 * і читає для `remote.state.scenario` (`playing`).
 */
import { reactive } from 'vue'

const playing = reactive<Record<string, true>>({})

export function isTimelinePlaying(id: string): boolean {
  return playing[id] === true
}

export function setTimelinePlaying(id: string, on: boolean): void {
  if (on) playing[id] = true
  else delete playing[id]
}

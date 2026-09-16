/**
 * V-D3.1 · що вчитель бачить у капсулі: політика видимих дій і «одна головна дія».
 *
 * Відгук власника: saas_docs/plans/two_apps/lesson_content/19_V-D3_OWNER_REVIEW_2026-09-14.md
 *
 * Програвач (`OverlayPlayer`) уміє все: play/pause/step/restart/setMode. Який набір із цього
 * ВИДНО, задає політика конкретної капсули, а не універсальний контролер. Учительська поверхня
 * в кожний момент має не більше однієї кнопки керування; кнопки прогнозу D/E — педагогічна
 * дія, не навігація, і до цього ліміту не входять.
 *
 * Модуль чистий: без Vue і без DOM, тому правила перевіряються напряму.
 */
import type { OverlayPlayer, PlayerSnapshot } from './overlayPlayer'
import { SceneContractError, type Prediction } from './trianglesOverlayMachine'

export interface ControlPolicy {
  prediction: 'visible' | 'hidden'
  play_pause: 'visible' | 'hidden'
  step: 'visible' | 'hidden'
  restart: 'visible' | 'hidden' | 'shown_as_repeat_after_completion'
  /** `outside_scene` — режим обирає урок-контекст (caller), а не кнопка всередині сцени. */
  mode_switch: 'in_scene' | 'outside_scene'
  diagnostics: 'dev_only' | 'hidden'
}

export interface ResolvedControls {
  prediction: boolean
  playPause: boolean
  /** Окремі кнопки на учительській поверхні (не в діагностиці). */
  step: boolean
  restart: boolean
  repeatAfterCompletion: boolean
  modeSwitchInScene: boolean
  /** Повний набір старих інструментів і SceneEnvelope. */
  diagnostics: boolean
}

export function resolveControls(
  policy: ControlPolicy,
  request: { diagnostics: boolean; isDev: boolean },
): ResolvedControls {
  return {
    prediction: policy.prediction === 'visible',
    playPause: policy.play_pause === 'visible',
    step: policy.step === 'visible',
    restart: policy.restart === 'visible',
    repeatAfterCompletion: policy.restart === 'shown_as_repeat_after_completion',
    modeSwitchInScene: policy.mode_switch === 'in_scene',
    // Діагностику не вмикає сам запит: політика `dev_only` пускає її лише в DEV-збірці.
    diagnostics: policy.diagnostics === 'dev_only' && request.diagnostics === true && request.isDev === true,
  }
}

export type PrimaryAction = 'check' | 'pause' | 'resume' | 'repeat'

/** Стани, у яких учень/учитель ще може обрати чи змінити прогноз. */
export function isPredictionPhase(snapshot: PlayerSnapshot): boolean {
  const { state } = snapshot.envelope
  return snapshot.status !== 'playing' && (state === 'separated' || state === 'predicting')
}

/**
 * Єдина головна дія для поточного моменту (таблиця з відгуку власника):
 *   до прогнозу — жодної кнопки, лише вибір D/E;
 *   прогноз обрано — «Перевірити накладанням»;
 *   анімація йде — «Пауза»; на паузі — «Продовжити»;
 *   завершено — «Повторити».
 */
export function primaryAction(snapshot: PlayerSnapshot, controls: ResolvedControls): PrimaryAction | null {
  const { state, prediction } = snapshot.envelope
  if (snapshot.status === 'finished') return controls.repeatAfterCompletion ? 'repeat' : null
  if (snapshot.status === 'playing') return controls.playPause ? 'pause' : null
  if (state === 'separated' || state === 'predicting') {
    return controls.prediction && prediction !== null ? 'check' : null
  }
  return controls.playPause ? 'resume' : null
}

export function runPrimaryAction(player: OverlayPlayer, action: PrimaryAction): void {
  switch (action) {
    case 'check': {
      const { state, prediction } = player.snapshot.envelope
      if (state !== 'predicting' || prediction === null) {
        throw new SceneContractError(`«Перевірити» без прогнозу або поза predicting (стан «${state}»)`)
      }
      // predicting → overlaying і рух одразу: тими самими методами, що й «крок» + «продовжити».
      player.step()
      player.play()
      return
    }
    case 'pause':
      player.pause()
      return
    case 'resume':
      player.play()
      return
    case 'repeat':
      player.restart()
      return
  }
}

/** Вибір D/E: з `separated` сцена переходить у `predicting` і фіксує прогноз. */
export function choosePrediction(player: OverlayPlayer, choice: Prediction): void {
  if (player.snapshot.envelope.state === 'separated') player.step()
  player.setPrediction(choice)
}

<!--
  V-D3 · DEV-прототип капсули `visual.triangles.congruence.overlay` v1.

  ТЗ: saas_docs/plans/two_apps/lesson_content/17_TZ_FEYA_VD3_TRIANGLE_OVERLAY_SPIKE_2026-09-14.md

  ОБГОРТКА, А НЕ НОВИЙ РЕНДЕРЕР. Малює наявний `Geometry2DRenderer` з пресетом
  `triangles_overlay`; рух — лише нові координати тієї самої твердої фігури в
  `pointsSnapshot` ЛОКАЛЬНОГО асета. Цей асет не належить дошці:
    • жодного `store.updateAsset`, `opsSync`, REST чи WS — кадри живуть лише в пам'яті;
    • `update:asset` від рендерера не слухаємо (він і не емітить: `interactive=false`);
    • конверт сцени (`SceneEnvelope`) — у пам'яті програвача; reload/replay його не
      відновлюють, тому результат НЕ replay-ready (ТЗ §3.2).

  V-D3.1 (відгук власника, 19_V-D3_OWNER_REVIEW): учительська поверхня — вибір D/E і ОДНА
  головна дія (visualCapsules/capsuleControls.ts). Режим задає caller пропом `mode`.
  «Наступний крок», «Спочатку» і SceneEnvelope — лише в явній «Діагностиці» (DEV-збірка).
-->
<template>
  <section
    class="vcap"
    data-testid="visual-capsule"
    :data-visual-id="visualId"
    :data-status="snapshot?.status"
    :data-state="snapshot?.envelope.state"
    :data-mode="snapshot?.envelope.mode"
  >
    <div v-if="loadError" role="alert" class="vcap-error" data-testid="visual-capsule-error">
      {{ t('winterboard.visualCapsule.unknown', { id: visualId, version }) }}
    </div>

    <template v-else-if="player && controls">
      <p class="vcap-notation" data-testid="vcap-notation">ΔABC = ΔEDF</p>

      <div class="vcap-stage" data-testid="vcap-stage">
        <Geometry2DRenderer :asset="asset" :interactive="false" :is-selected="false" />
      </div>

      <!-- До перевірки: вступ і питання разом, щоб вибір D/E не висів без запитання. -->
      <p v-if="predictionPhase" class="vcap-lead" data-testid="vcap-lead">
        {{ t(`winterboard.visualCapsule.trianglesOverlay.prompt.separated.${envelope.mode}`) }}
      </p>
      <p class="vcap-prompt" data-testid="vcap-prompt">
        {{ t(`winterboard.visualCapsule.trianglesOverlay.prompt.${promptState}.${envelope.mode}`) }}
      </p>

      <div
        v-if="controls.prediction && predictionPhase"
        class="vcap-predict"
        role="group"
        :aria-label="t('winterboard.visualCapsule.predictionLabel')"
        data-testid="vcap-predict"
      >
        <button
          v-for="choice in PREDICTIONS"
          :key="choice"
          type="button"
          class="vcap-btn vcap-btn--choice"
          :class="{ 'is-active': envelope.prediction === choice }"
          :aria-pressed="envelope.prediction === choice"
          data-role="prediction"
          :data-testid="`vcap-predict-${choice}`"
          @click="choosePrediction(player, choice)"
        >{{ choice }}</button>
      </div>

      <p v-if="verdictKey" class="vcap-verdict" data-testid="vcap-verdict">
        {{ t(verdictKey, { prediction: envelope.prediction, landed: String(envelope.marks.b_lands_on) }) }}
      </p>

      <ol v-if="envelope.state === 'correspondence'" class="vcap-pairs" data-testid="vcap-pairs">
        <li v-for="line in revealedLines" :key="line">{{ line }}</li>
      </ol>

      <!-- Одне місце — одна головна дія: «Пауза» і «Продовжити» заміняють одна одну тут же. -->
      <div class="vcap-actions" data-testid="vcap-actions">
        <button
          v-if="primary"
          type="button"
          class="vcap-btn vcap-btn--primary"
          data-role="control"
          data-testid="vcap-primary"
          :data-action="primary"
          @click="runPrimaryAction(player, primary)"
        >{{ t(`winterboard.visualCapsule.action.${primary}`) }}</button>
      </div>

      <section v-if="controls.diagnostics" class="vcap-diagnostics" data-testid="vcap-diagnostics">
        <h3 class="vcap-diagnostics__title">{{ t('winterboard.visualCapsule.diagnostics') }}</h3>
        <div class="vcap-diagnostics__controls">
          <span class="vcap-status" data-testid="vcap-status" :data-status="status" :data-state="envelope.state">
            {{ t(`winterboard.visualCapsule.status.${status}`) }} ·
            {{ t(`winterboard.visualCapsule.state.${envelope.state}`) }}
          </span>
          <button
            type="button"
            class="vcap-btn"
            data-role="diagnostic"
            data-testid="vcap-play"
            :disabled="status === 'playing' || status === 'finished'"
            @click="player.play()"
          >{{ t(status === 'idle' ? 'winterboard.visualCapsule.control.play' : 'winterboard.visualCapsule.control.continue') }}</button>
          <button
            type="button"
            class="vcap-btn"
            data-role="diagnostic"
            data-testid="vcap-pause"
            :disabled="status !== 'playing'"
            @click="player.pause()"
          >{{ t('winterboard.visualCapsule.control.pause') }}</button>
          <button
            type="button"
            class="vcap-btn"
            data-role="diagnostic"
            data-testid="vcap-step"
            :disabled="status === 'finished'"
            @click="player.step()"
          >{{ t('winterboard.visualCapsule.control.step') }}</button>
          <button
            type="button"
            class="vcap-btn"
            data-role="diagnostic"
            data-testid="vcap-restart"
            @click="player.restart()"
          >{{ t('winterboard.visualCapsule.control.restart') }}</button>
        </div>
        <pre class="vcap-envelope" data-testid="vcap-envelope">{{ envelopeJson }}</pre>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import Geometry2DRenderer from './Geometry2DRenderer.vue'
import type { Geometry2DV2Asset } from '../../../types/geometry2dV2'
import {
  OverlayPlayer,
  type FrameScheduler,
  type PlayerSnapshot,
} from './visualCapsules/overlayPlayer'
import {
  choosePrediction,
  isPredictionPhase,
  primaryAction,
  resolveControls,
  runPrimaryAction,
} from './visualCapsules/capsuleControls'
import {
  presetFor,
  resolveCapsule,
  UnknownVisualCapsuleError,
  type CapsulePrototype,
} from './visualCapsules/capsuleRegistry'
import type { SceneEnvelope, SceneMode } from './visualCapsules/trianglesOverlayMachine'

const props = withDefaults(
  defineProps<{
    visualId: string
    version: number
    /** Режим задає урок-контекст (caller); перемикача всередині сцени немає (V-D3.1). */
    mode?: SceneMode
    /** Явний режим «Діагностика»: старі інструменти й SceneEnvelope. Лише в DEV-збірці. */
    diagnostics?: boolean
    /** `undefined` — брати з `prefers-reduced-motion`. */
    reducedMotion?: boolean
    scheduler?: FrameScheduler
  }>(),
  { mode: 'full', diagnostics: false, reducedMotion: undefined, scheduler: undefined },
)

const emit = defineEmits<{ envelope: [envelope: SceneEnvelope] }>()

const { t } = useI18n()

const PREDICTIONS = ['D', 'E'] as const

function prefersReducedMotion(): boolean {
  if (props.reducedMotion !== undefined) return props.reducedMotion
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Невідома капсула — видима помилка, а не порожній блок (ТЗ §6, тест 12).
let capsule: CapsulePrototype | null = null
let loadError: UnknownVisualCapsuleError | null = null
try {
  capsule = resolveCapsule(props.visualId, props.version)
} catch (err) {
  if (!(err instanceof UnknownVisualCapsuleError)) throw err
  loadError = err
  console.error('[VisualCapsule]', err.message)
}

const snapshot = shallowRef<PlayerSnapshot | null>(null)

const player: OverlayPlayer | null = capsule
  ? new OverlayPlayer({
      mode: props.mode,
      reducedMotion: prefersReducedMotion(),
      scheduler: props.scheduler,
      onChange: (next) => {
        snapshot.value = next
        emit('envelope', next.envelope)
      },
    })
  : null
if (player) snapshot.value = player.snapshot

const envelope = computed(() => (snapshot.value as PlayerSnapshot).envelope)
const status = computed(() => (snapshot.value as PlayerSnapshot).status)

const controls = computed(() =>
  capsule
    ? resolveControls(capsule.controls, { diagnostics: props.diagnostics, isDev: import.meta.env.DEV === true })
    : null,
)
const predictionPhase = computed(() => isPredictionPhase(snapshot.value as PlayerSnapshot))
const promptState = computed(() => (predictionPhase.value ? 'predicting' : envelope.value.state))
const primary = computed(() =>
  controls.value ? primaryAction(snapshot.value as PlayerSnapshot, controls.value) : null,
)
const envelopeJson = computed(() => JSON.stringify(envelope.value, null, 2))

// Режим приходить від caller: зміна — та сама сцена спочатку, без паралельної анімації.
watch(
  () => props.mode,
  (next) => {
    if (player && next !== player.snapshot.envelope.mode) player.setMode(next)
  },
)

const asset = computed<Geometry2DV2Asset>(() => ({
  id: 'vcap-triangles-overlay',
  type: 'geometry_2d_v2',
  src: '',
  x: 0,
  y: 0,
  w: 720,
  h: 420,
  rotation: 0,
  locked: true,
  data: {
    version: 1,
    // Підсвітка пар — окремий ключ пресета за рівнем із конверта, не data.toggles (ТЗ §3.2).
    preset: presetFor(capsule as CapsulePrototype, envelope.value),
    pointsSnapshot: (capsule as CapsulePrototype).geometry.pointsSnapshot(
      (snapshot.value as PlayerSnapshot).progress,
    ),
  },
}))

const verdictKey = computed(() => {
  const env = envelope.value
  if (env.state !== 'matched' && env.state !== 'correspondence') return ''
  if (env.marks.prediction_refuted) return 'winterboard.visualCapsule.trianglesOverlay.verdict.refuted'
  if (env.marks.prediction_confirmed) return 'winterboard.visualCapsule.trianglesOverlay.verdict.confirmed'
  return 'winterboard.visualCapsule.trianglesOverlay.verdict.none'
})

const revealedLines = computed(() => {
  const marks = envelope.value.marks as {
    pairs?: ReadonlyArray<readonly [string, string]>
    side?: { source: string; target: string; length_cm: number }
    revealed?: number
  }
  const lines = (marks.pairs ?? []).map(([s, d]) => `${s} ↔ ${d}`)
  if (marks.side) {
    lines.push(`${marks.side.source} ↔ ${marks.side.target} = ${marks.side.length_cm} ${t('winterboard.visualCapsule.cm')}`)
  }
  return lines.slice(0, marks.revealed ?? 0)
})

// Початковий конверт — одразу: інакше лабораторія показує порожнечу до першої дії.
onMounted(() => {
  if (player) emit('envelope', player.snapshot.envelope)
})

onBeforeUnmount(() => {
  player?.destroy()
})
</script>

<style scoped>
.vcap {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 760px;
}
.vcap-actions,
.vcap-diagnostics__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.vcap-actions {
  /* Місце головної дії не стрибає, коли кнопки немає (до прогнозу). */
  min-height: 46px;
}
.vcap-notation {
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.vcap-stage {
  height: 420px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
}
.vcap-prompt {
  font-size: 1.1rem;
  min-height: 1.6em;
}
.vcap-lead {
  color: #475569;
}
.vcap-predict {
  display: flex;
  gap: 8px;
}
.vcap-btn {
  padding: 6px 14px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
}
.vcap-btn:disabled {
  opacity: 0.45;
}
.vcap-btn.is-active {
  background: #1e293b;
  color: #fff;
  border-color: #1e293b;
}
.vcap-btn--primary {
  min-width: 220px;
  padding: 10px 20px;
  font-size: 1.05rem;
  font-weight: 600;
  background: #1e293b;
  color: #fff;
  border-color: #1e293b;
}
.vcap-btn--choice {
  min-width: 56px;
  font-size: 1.2rem;
  font-weight: 700;
}
.vcap-verdict {
  font-weight: 600;
}
.vcap-pairs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  font-size: 1.15rem;
  font-weight: 700;
}
.vcap-error {
  padding: 12px;
  border: 1px solid #dc2626;
  border-radius: 6px;
  color: #991b1b;
  background: #fef2f2;
}
.vcap-status {
  font-size: 0.9rem;
  color: #475569;
}
.vcap-diagnostics {
  margin-top: 8px;
  padding: 12px;
  border: 1px dashed #94a3b8;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.vcap-diagnostics__title {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
}
.vcap-envelope {
  background: #0f172a;
  color: #e2e8f0;
  padding: 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  max-height: 320px;
  overflow: auto;
}
</style>

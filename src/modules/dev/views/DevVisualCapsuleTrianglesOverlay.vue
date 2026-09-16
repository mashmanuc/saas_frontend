<!--
  V-D3 · DEV-лабораторія капсули накладання трикутників.
  Лише локально (маршрут існує тільки в DEV). Без імпорту пакета, без БД, без запису.

  V-D3.1 (відгук власника): за замовчуванням сторінка показує МАЙБУТНІЙ учительський вигляд,
  а не пульт лабораторії. Режим уроку й «Діагностика» — параметри перегляду поза сценою:
    ?mode=full|recall    — що в уроці обрав би урок-контекст;
    ?diagnostics=1       — старі інструменти й SceneEnvelope для перевірки.
-->
<template>
  <main class="vcap-lab">
    <header class="vcap-lab__head">
      <p class="vcap-lab__eyebrow">{{ t('devVisualCapsules.eyebrow') }}</p>
      <h1 class="vcap-lab__title">{{ t('devVisualCapsules.title') }}</h1>
      <p class="vcap-lab__note">{{ t('devVisualCapsules.note') }}</p>
    </header>

    <div class="vcap-lab__preview" data-testid="dev-preview-params">
      <span class="vcap-lab__preview-label">{{ t('devVisualCapsules.previewLabel') }}</span>
      <div class="vcap-lab__modes" role="group" :aria-label="t('devVisualCapsules.mode')">
        <button
          v-for="m in MODES"
          :key="m"
          type="button"
          class="vcap-lab__chip"
          :class="{ 'is-active': mode === m }"
          :aria-pressed="mode === m"
          :data-testid="`dev-mode-${m}`"
          @click="setQuery({ mode: m })"
        >{{ t(`winterboard.visualCapsule.mode.${m}`) }}</button>
      </div>
      <label class="vcap-lab__diag">
        <input
          type="checkbox"
          data-testid="dev-diagnostics"
          :checked="diagnostics"
          @change="setQuery({ diagnostics: ($event.target as HTMLInputElement).checked })"
        />
        {{ t('devVisualCapsules.diagnostics') }}
      </label>
    </div>

    <VisualCapsuleTrianglesOverlay
      class="vcap-lab__capsule"
      visual-id="visual.triangles.congruence.overlay"
      :version="1"
      :mode="mode"
      :diagnostics="diagnostics"
    />
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import VisualCapsuleTrianglesOverlay from '@/modules/winterboard/components/board/objects/VisualCapsuleTrianglesOverlay.vue'
import type { SceneMode } from '@/modules/winterboard/components/board/objects/visualCapsules/trianglesOverlayMachine'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const MODES: ReadonlyArray<SceneMode> = ['full', 'recall']

// Невідомий `mode` у адресі — не вгадуємо: показуємо повне пояснення (дефолт уроку).
const mode = computed<SceneMode>(() => (route.query.mode === 'recall' ? 'recall' : 'full'))
const diagnostics = computed(() => route.query.diagnostics === '1')

function setQuery(patch: { mode?: SceneMode; diagnostics?: boolean }): void {
  const next = { ...route.query }
  if (patch.mode) next.mode = patch.mode
  if (patch.diagnostics !== undefined) {
    if (patch.diagnostics) next.diagnostics = '1'
    else delete next.diagnostics
  }
  void router.replace({ query: next })
}
</script>

<style scoped>
.vcap-lab {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #f8fafc;
  min-height: 100vh;
}
.vcap-lab__eyebrow {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #64748b;
}
.vcap-lab__title {
  font-size: 1.6rem;
  font-weight: 700;
}
.vcap-lab__note {
  color: #92400e;
}
/* Параметри перегляду свідомо винесені над сценою й приглушені: це не учительський пульт. */
.vcap-lab__preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  max-width: 760px;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #f1f5f9;
  font-size: 0.85rem;
  color: #475569;
}
.vcap-lab__modes {
  display: flex;
  gap: 4px;
}
.vcap-lab__chip {
  padding: 2px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  background: #fff;
}
.vcap-lab__chip.is-active {
  background: #475569;
  border-color: #475569;
  color: #fff;
}
.vcap-lab__diag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
/* Ширина капсули не залежить від сусіднього тексту: інакше geo2d перераховує камеру
   і нерухомий ΔEDF «пливе» (знайдено живим проходом V-D3). */
.vcap-lab__capsule {
  width: 100%;
  max-width: 760px;
}
</style>

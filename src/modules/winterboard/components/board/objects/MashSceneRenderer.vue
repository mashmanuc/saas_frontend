<!--
  MashSceneRenderer — MASH Live Asset (§3.7.13, A3 2026-07-07, Proposal §8).

  v1 = картка-конверт: сцена GraphMASH 2D/3D/GeoMASH зберігається ПОВНІСТЮ у
  data.scene (жодного мертвого PNG — Proposal §8 Board-first rule), рендер —
  бренд-картка з deep-link «Відкрити у MASH». Нативний live-рендер per-двигун —
  наступні фази (B2/B3): картка «оживе» без міграції даних.

  preview-растр НЕ зберігається в data (ops-recorder стрипає data:-URLs;
  state-bloat freeze) — тому картка, не картинка.

  POINTER-EVENTS MODEL (дзеркало theory_card §3.7.12):
    root pointer-events:none → Konva proxy ловить drag/select/resize;
    кнопки (delete, open) — auto + stop.
-->
<template>
  <div
    ref="rootEl"
    class="mash-scene-card"
    :class="{ 'is-selected': isSelected }"
    :data-testid="`mash-scene-${asset.id}`"
  >
    <header class="msc-header">
      <span class="msc-badge">{{ appLabel }}</span>
      <button
        v-if="!asset.locked && isSelected"
        type="button"
        class="msc-delete"
        :title="t('winterboard.widget.delete')"
        @click.stop="emit('delete')"
        @mousedown.stop
        @pointerdown.stop
      >×</button>
    </header>

    <div class="msc-body" :class="{ 'msc-body--preview': data.previewUrl }">
      <img v-if="data.previewUrl" class="msc-preview" :src="data.previewUrl" alt="" draggable="false" />
      <template v-else>
        <div class="msc-icon" aria-hidden="true">{{ appIcon }}</div>
        <div class="msc-title">{{ data.title || appLabel }}</div>
        <div class="msc-sub">{{ sceneSummary }}</div>
      </template>
    </div>

    <footer class="msc-footer">
      <a
        class="msc-open"
        :href="appHref"
        target="_blank"
        rel="noopener"
        @mousedown.stop
        @pointerdown.stop
        @click.stop
      >{{ t('winterboard.widget.mash.openInMash') }}</a>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBAsset, MashSceneData } from '../../../types/winterboard'
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    asset: WBAsset
    isSelected?: boolean
    interactive?: boolean
  }>(),
  { isSelected: false, interactive: true },
)

const emit = defineEmits<{
  'update:asset': [asset: WBAsset]
  delete: []
}>()

const rootEl = ref<HTMLElement | null>(null)

const data = computed<MashSceneData>(
  () => (props.asset.data as MashSceneData) ?? { version: 1, app: 'g2d', sceneFormat: '', scene: {} },
)

const APP_META: Record<MashSceneData['app'], { label: string; icon: string; dir: string }> = {
  g2d: { label: 'GraphMASH 2D', icon: '∿', dir: 'grapher/index.html' },
  g3d: { label: 'GraphMASH 3D', icon: '△', dir: 'grapher-3d/index.html' },
  geo: { label: 'GeoMASH', icon: '⊙', dir: 'geomash/GeoMASH.html' },
}

const meta = computed(() => APP_META[data.value.app] ?? APP_META.g2d)
const appLabel = computed(() => meta.value.label)
const appIcon = computed(() => meta.value.icon)
/** v1: у сам додаток (same-origin /mash/*); scene-deep-link — коли всі 4 вмітимуть hash-restore. */
const appHref = computed(() => `/mash/${meta.value.dir}`)

/** Короткий зміст сцени без залізання у формат: кількість об'єктів/виразів. */
const sceneSummary = computed(() => {
  const s = data.value.scene as Record<string, unknown>
  const arr =
    (Array.isArray(s.objects) && s.objects) ||
    (Array.isArray(s.expressions) && s.expressions) ||
    (Array.isArray(s.exprs) && s.exprs) ||
    null
  if (arr) return `Обʼєктів у сцені: ${arr.length}`
  return 'Сцена MASH збережена в обʼєкті'
})

// Export capture — як theory_card: картка потрапляє у PNG/PDF-експорт дошки.
useExportCapture(
  () => props.asset?.id,
  (signal) => snapshotElement(rootEl.value, signal),
)
</script>

<style scoped>
.mash-scene-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(160deg, #ffffff 0%, #f2fbf7 100%);
  border: 1px solid rgba(5, 150, 105, 0.35);
  border-radius: 10px;
  overflow: hidden;
  pointer-events: none; /* drag/select — через Konva proxy */
  font-family: system-ui, sans-serif;
  color: #0d4a3e;
  box-shadow: 0 2px 10px rgba(5, 150, 105, 0.12);
}
.mash-scene-card.is-selected { border-color: #047857; }

.msc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(4, 120, 87, 0.08);
}
.msc-badge {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #047857;
}
.msc-delete {
  pointer-events: auto;
  border: none;
  background: none;
  font-size: 16px;
  line-height: 1;
  color: #9ca3af;
  cursor: pointer;
}
.msc-delete:hover { color: #ef4444; }

.msc-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 12px;
  text-align: center;
}
.msc-body--preview { padding: 0; }
.msc-preview {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  background: #ffffff;
}
.msc-icon { font-size: 30px; color: #047857; opacity: 0.85; }
.msc-title {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.msc-sub { font-size: 11px; color: #1f6b5a; opacity: 0.8; }

.msc-footer {
  padding: 8px 10px;
  display: flex;
  justify-content: center;
}
.msc-open {
  pointer-events: auto;
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
  background: #047857;
  border-radius: 7px;
  padding: 6px 14px;
  text-decoration: none;
}
.msc-open:hover { background: #065f46; }
</style>

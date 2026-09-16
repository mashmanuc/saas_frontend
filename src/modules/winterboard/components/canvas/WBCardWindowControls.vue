<!--
  TLV2-05B.2 · спільна група віконних дій картки: «— Згорнути · ⛶ Розгорнути · × Видалити».
  TLV2-05C · та сама панель для текстових карток: «A− · 100% · A+ │ — · ⛶ · ×».
  Масштаб — учительський і спільний (SYSTEM_LAW §9.C): панель лише емітить намір,
  host пише `data.presentationScale` штатним `asset_update`.

  Одна на полотно: host (`WBCanvas`) ставить її у правий верхній кут виділеної або
  розгорнутої картки й вирішує, які дії доступні (`board/windowActions.ts`).
  Тут лише вигляд і події — компонент нічого не пише в дошку.

  Кнопки ловлять pointerdown/mousedown/click і далі їх не пускають: натискання не
  починає drag картки й не доходить до сцени всередині неї (GeoMASH, капсула тощо).
-->
<template>
  <div
    class="wb-card-window-controls"
    data-testid="wb-card-window-controls"
    role="toolbar"
    @pointerdown.stop
    @mousedown.stop
    @click.stop
    @dblclick.stop
    @wheel.stop
  >
    <template v-if="actions.scale">
      <button
        type="button"
        class="wb-card-window-controls__btn wb-card-window-controls__btn--text"
        data-testid="wb-card-window-scale-down"
        :disabled="!canScaleDown"
        :title="t('winterboard.card.scaleDown')"
        :aria-label="t('winterboard.card.scaleDown')"
        @click="emit('scale', -1)"
      >A−</button>
      <button
        type="button"
        class="wb-card-window-controls__btn wb-card-window-controls__btn--label"
        data-testid="wb-card-window-scale-reset"
        :title="t('winterboard.card.scaleReset')"
        :aria-label="t('winterboard.card.scaleReset')"
        @click="emit('scale', 0)"
      >{{ scaleLabel }}</button>
      <button
        type="button"
        class="wb-card-window-controls__btn wb-card-window-controls__btn--text"
        data-testid="wb-card-window-scale-up"
        :disabled="!canScaleUp"
        :title="t('winterboard.card.scaleUp')"
        :aria-label="t('winterboard.card.scaleUp')"
        @click="emit('scale', 1)"
      >A+</button>
      <span
        v-if="actions.minimize || actions.expand || actions.delete"
        class="wb-card-window-controls__divider"
        aria-hidden="true"
      />
    </template>
    <button
      v-if="actions.minimize"
      type="button"
      class="wb-card-window-controls__btn"
      data-testid="wb-card-window-minimize"
      :title="t('winterboard.tray.minimize')"
      :aria-label="t('winterboard.tray.minimize')"
      @click="emit('minimize')"
    >—</button>
    <button
      v-if="actions.expand"
      type="button"
      class="wb-card-window-controls__btn"
      data-testid="wb-card-window-expand"
      :title="isExpanded ? t('winterboard.widget.collapse') : t('winterboard.widget.expand')"
      :aria-label="isExpanded ? t('winterboard.widget.collapse') : t('winterboard.widget.expand')"
      @click="emit('expand')"
    >{{ isExpanded ? '⊠' : '⛶' }}</button>
    <button
      v-if="actions.delete"
      type="button"
      class="wb-card-window-controls__btn wb-card-window-controls__btn--delete"
      data-testid="wb-card-window-delete"
      :title="t('winterboard.widget.delete')"
      :aria-label="t('winterboard.widget.delete')"
      @click="emit('delete')"
    >×</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CardWindowActions } from '../../board/windowActions'
import { nextPresentationScale, presentationScaleLabel } from '../../board/cardPresentation'

const props = withDefaults(
  defineProps<{
    actions: CardWindowActions
    isExpanded: boolean
    /** Поточний спільний масштаб картки (`presentationScaleOf`). */
    scale?: number
  }>(),
  { scale: 1 },
)

const emit = defineEmits<{ minimize: []; expand: []; delete: []; scale: [direction: -1 | 0 | 1] }>()

const scaleLabel = computed(() => presentationScaleLabel(props.scale))
const canScaleDown = computed(() => nextPresentationScale(props.scale, -1) !== null)
const canScaleUp = computed(() => nextPresentationScale(props.scale, 1) !== null)

const { t } = useI18n({ useScope: 'global' })
</script>

<style scoped>
.wb-card-window-controls {
  position: absolute;
  z-index: 55;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
  pointer-events: auto;
}

.wb-card-window-controls__btn {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #475569;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}

.wb-card-window-controls__btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.wb-card-window-controls__btn--text {
  font-weight: 600;
  font-size: 12px;
}

.wb-card-window-controls__btn--label {
  width: auto;
  min-width: 40px;
  padding: 0 4px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.wb-card-window-controls__btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.wb-card-window-controls__divider {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: #e2e8f0;
}

.wb-card-window-controls__btn--delete:hover {
  background: #fee2e2;
  color: #dc2626;
}
</style>

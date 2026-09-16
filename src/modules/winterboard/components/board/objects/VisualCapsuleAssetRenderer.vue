<!--
  TLV2-03 · капсула як об'єкт дошки (`asset.type = 'visual_capsule'`).

  Тонка обгортка над перенесеною без змін V-D3.1 `VisualCapsuleTrianglesOverlay`: з асета
  береться лише адреса капсули (`visual_id`, `capsule_version`) і режим. Сама анімація,
  керування й помилка невідомої капсули — у V-D3.1.

  Що зберігає дошка: сам об'єкт і операцію його додавання (replay покаже капсулу).
  Хід програвання — локальний стан, як і в V-D3.1: учитель запускає його скільки завгодно,
  ops це не породжує; після reload сцена починається спочатку.

  TLV2-05A · СТАНДАРТ КАРТКИ (відгук власника: «анімацію зрушити не можна»).
  Раніше корінь мав `pointer-events: auto` на всю площу — Konva-проксі під карткою не
  отримував ні кліку, ні drag, тому капсула єдина з усіх карток не рухалась і не
  масштабувалась. Тепер модель та сама, що в `theory_card` / GeoMASH:

    корінь               pointer-events: none  → проксі ловить drag/select/resize;
    кнопки шапки (⛶, ×)  auto + stop           → не починають drag картки;
    тіло картки          none                  → картку можна тягнути за будь-яке місце;
    кнопки капсули       auto (`:deep(.vcap-btn)`) → працюють і після переміщення;
    режим малювання      кнопки капсули інертні (як `.theory-card.is-readonly`).

  Можливості типу оголошено в `board/objectStandard.ts` — тут лише вигляд.
-->
<template>
  <div
    class="vcap-card"
    :class="{
      'is-selected': isSelected,
      'is-readonly': !interactive,
      'is-expanded': isExpanded,
    }"
    data-testid="visual-capsule-asset"
    :data-asset-id="asset.id"
  >
    <header class="vcap-card__header">
      <span class="vcap-card__badge">{{ t('winterboard.widget.visualCapsule') }}</span>
      <button
        v-if="capabilities.fullscreen"
        type="button"
        class="vcap-card__btn vcap-card__expand"
        :title="isExpanded ? t('winterboard.widget.collapse') : t('winterboard.widget.expand')"
        @click.stop="emit('expand')"
        @mousedown.stop
        @pointerdown.stop
      >{{ isExpanded ? '⊠' : '⛶' }}</button>
      <button
        v-if="canDelete"
        type="button"
        class="vcap-card__btn vcap-card__delete"
        :title="t('winterboard.widget.delete')"
        @click.stop="emit('delete')"
        @mousedown.stop
        @pointerdown.stop
      >×</button>
    </header>

    <div class="vcap-card__body">
      <VisualCapsuleTrianglesOverlay
        :visual-id="data.visual_id"
        :version="data.capsule_version"
        :mode="data.mode"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { assetCapabilities } from '../../../board/objectStandard'
import type { VisualCapsuleAssetData, WBAsset } from '../../../types/winterboard'
import VisualCapsuleTrianglesOverlay from './VisualCapsuleTrianglesOverlay.vue'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    asset: WBAsset
    isSelected?: boolean
    interactive?: boolean
    isExpanded?: boolean
    /** Лише вчитель видаляє картку зі спільної дошки (T-03, TLV2-03S). */
    isTutor?: boolean
  }>(),
  { isSelected: false, interactive: true, isExpanded: false, isTutor: true },
)

const emit = defineEmits<{ delete: []; expand: [] }>()

const data = computed(() => props.asset.data as VisualCapsuleAssetData)
const capabilities = computed(() => assetCapabilities(props.asset.type))
const canDelete = computed(
  () => capabilities.value.deletable
    && props.isTutor !== false
    && !props.asset.locked
    && props.isSelected,
)
</script>

<style scoped>
.vcap-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-sizing: border-box;
  overflow: hidden;
  pointer-events: none;            /* Konva proxy ловить drag/select/resize */
}

.vcap-card.is-selected {
  border-color: #3b82f6;
}

.vcap-card__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-bottom: 1px solid #eef2f7;
  background: #f8fafc;
  flex: 0 0 auto;
  pointer-events: none;            /* шапка теж тягне картку; живі лише кнопки */
}

.vcap-card__badge {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  letter-spacing: 0.02em;
}

.vcap-card__btn {
  border: none;
  background: transparent;
  cursor: pointer;
  line-height: 1;
  color: #64748b;
  pointer-events: auto;            /* кнопка НЕ починає drag: подія не доходить до проксі */
}

.vcap-card__expand {
  margin-left: auto;
  font-size: 14px;
}

.vcap-card__delete {
  font-size: 18px;
  color: #ef4444;
}

.vcap-card.is-readonly .vcap-card__btn {
  pointer-events: none;
  opacity: 0.4;
}

.vcap-card__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  padding: 8px 12px 12px;
  pointer-events: none;            /* тягнути картку можна за будь-яке місце тіла */
}

/* Власні кнопки капсули (V-D3.1) лишаються живими — і після переміщення й масштабування. */
.vcap-card__body :deep(.vcap-btn) {
  pointer-events: auto;
}

.vcap-card.is-readonly .vcap-card__body :deep(.vcap-btn) {
  pointer-events: none;
  opacity: 0.6;
}
</style>

<!--
  MathSceneRenderer — `math_scene` («Наочна сцена», власник 2026-10-20): готова жива сцена з `public/scenes/…`
  у вікні на дошці.
  ДАНІ: лише `sceneId`. Натискання всередині сцени — вигляд цього екрана: не ops, не запис уроку (погоджено).
  POINTER-EVENTS: корінь і шапка — none (Konva-проксі тягне/виділяє за шапку й рамку); сцена — auto лише на
  ВИДІЛЕНІЙ картці з інструментом «Вибір» (`isSelected && interactive`), як тіла живих карток (WBOverlayLayer,
  INV-OVERLAY-CLICK): натиски всередині вікна дошка не бачить, тож живе вікно невиділеної картки з'їдало б клік,
  призначений картці над ним. Інакше перо малює поверх, а учень/запис лише дивляться.
  МАСШТАБ: тип у ZOOM_SCALED_CARD_TYPES — сцена верстається в пікселях картки й зменшується цілком.
  ⛶ (2026-10-21): кнопку малює спільна група вікна дошки; розгорнута картка займає полотно без масштабу й жива,
  навіть коли виділення знято (Esc на дошці знімає виділення). Esc згортає — як у тригонометричного кола.
  БЕЗПЕКА: `sandbox="allow-scripts"` без same-origin — сцена не бачить ні сховища, ні входу сайту; сайт дозволяє
  показувати у вікні лише `/scenes/*` (public/_headers: X-Frame-Options SAMEORIGIN).
-->
<template>
  <div
    class="msc-card"
    :class="{ 'is-selected': isSelected, 'is-expanded': isExpanded, 'is-live': (isSelected || isExpanded) && interactive && !asset.locked }"
    :data-testid="`math-scene-renderer-${asset.id}`"
  >
    <header class="msc-head" :style="hostControlsReserve ? { paddingRight: `${hostControlsReserve}px` } : undefined">
      <span class="msc-head-title">{{ title }}</span>
    </header>
    <div class="msc-body">
      <iframe
        v-if="src"
        :key="src"
        class="msc-frame"
        :src="src"
        :title="title"
        sandbox="allow-scripts"
        loading="lazy"
        referrerpolicy="no-referrer"
        data-testid="math-scene-frame"
      />
      <p v-else class="msc-missing" data-testid="math-scene-missing">{{ t('winterboard.mathScene.missing') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAssistantLook } from '@/modules/intent/assistantLook'
import { useHostControlsReserve } from '../../../composables/boardWindowControls'
import { isMathSceneId, mathSceneSrc, type MathSceneAsset } from '../../../types/mathScene'

const props = withDefaults(
  defineProps<{
    asset: MathSceneAsset
    isSelected?: boolean
    interactive?: boolean
    isExpanded?: boolean
  }>(),
  { isSelected: false, interactive: true, isExpanded: false },
)

const emit = defineEmits<{
  'update:asset': [asset: MathSceneAsset]
  delete: []
  expand: []
}>()

const { t, locale } = useI18n()
const { look } = useAssistantLook()

const sceneId = computed(() => props.asset.data?.sceneId)
const src = computed(() => mathSceneSrc(sceneId.value, String(locale.value), look.value))
const title = computed(() => isMathSceneId(sceneId.value)
  ? t(`winterboard.mathScene.scenes.${sceneId.value}`)
  : t('winterboard.mathScene.title'))
// Спільна група «— ⛶ ×» полотна сідає в правий край шапки — назва не лягає під неї.
const hostControlsReserve = useHostControlsReserve(() => props.asset.id)

// Esc згортає розгорнуту сцену (натиск усередині вікна сцени сюди не доходить — там лишаються «— ⛶ ×» у шапці).
function onEsc(e: KeyboardEvent) { if (e.key === 'Escape' && props.isExpanded) emit('expand') }
onMounted(() => window.addEventListener('keydown', onEsc))
onUnmounted(() => window.removeEventListener('keydown', onEsc))
</script>

<style scoped>
/* ── Корінь і шапка — pointer-events:none: Konva-проксі нижче ловить тягнення й виділення ── */
.msc-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-radius: 10px;
  border: 1px solid #d6c8b2;
  background: #fffaf0;
  box-shadow: 0 6px 18px rgba(26, 22, 18, 0.12);
  overflow: hidden;
  pointer-events: none;
  box-sizing: border-box;
}
.msc-card.is-selected { border-color: #c4622a; box-shadow: 0 0 0 2px rgba(196, 98, 42, 0.35); }
.msc-head {
  flex: none;
  height: 34px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  background: #f4ede0;
  border-bottom: 1px solid #d6c8b2;
  color: #3a2f24;
  font-size: 14px;
  font-weight: 600;
  pointer-events: none;
}
.msc-head-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.msc-body { position: relative; flex: 1; min-height: 0; }
.msc-frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
  pointer-events: none;
}
/* Розгорнута на всю дошку — без заокруглень і тіні. */
.msc-card.is-expanded { border-radius: 0; box-shadow: none; }
/* Живе лише виділена (або розгорнута) картка в режимі зміни дошки інструментом «Вибір». */
.msc-card.is-live .msc-frame { pointer-events: auto; }
.msc-missing { margin: 16px; color: #6a594a; font-size: 14px; }

[data-theme="dark"] .msc-card { border-color: var(--color-border); }
</style>

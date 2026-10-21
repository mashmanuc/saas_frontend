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

  LAW §9 v1.35 (прохід «очима вчителя 60 років», 19.10): ✍ 💡 ⚠ — кнопки задачі більші (32 px, на дотику 44 px)
  і далеко від «×».
  LAW §9 v1.44 (власник 2026-10-21: «Чому не можна зробити в одну панельку? … третя у нас получилась панель» →
  «Роби»): ОДНА панель. ✍ 💡 ⚠ — зліва в тому ж рядку, що «A− 100% A+ │ — ⛶ ×», не окремою плашкою під ним (вона
  лягала на текст задачі). Є панель виділення над карткою — група стає в неї (`--docked`, composables/cardControlsDock).
-->
<template>
  <div
    class="wb-card-window-controls"
    :class="{ 'wb-card-window-controls--with-task': hasTask }"
    data-testid="wb-card-window-controls"
    role="toolbar"
    @pointerdown.stop
    @mousedown.stop
    @click.stop
    @dblclick.stop
    @wheel.stop
  >
    <div v-if="hasWindowRow" class="wb-card-window-controls__row">
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
          v-if="actions.fitHeight || actions.minimize || actions.expand || actions.delete"
          class="wb-card-window-controls__divider"
          aria-hidden="true"
        />
      </template>
      <!-- Власник 2026-10-18: документ одним натисканням на всю висоту аркуша біля лівого краю. -->
      <button
        v-if="actions.fitHeight"
        type="button"
        class="wb-card-window-controls__btn"
        data-testid="wb-card-window-fit-height"
        :title="t('winterboard.card.fitHeight')"
        :aria-label="t('winterboard.card.fitHeight')"
        @click="emit('fitHeight')"
      >⇕</button>
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
    <div v-if="actions.handwrite || actions.taskHelp" class="wb-card-window-controls__task" data-testid="wb-card-window-task">
      <!-- LAW §9 v1.29: розв'язок задачі рукою. Власник 2026-10-17: «надпису не має бути» — лише значок.
           Власник 19.10: «перевір… чи всі мають підписи» — назва тепер і в спливній підказці (з'являється лише
           під курсором чи пером, на дошці напису немає), як у всіх значків цієї групи. Поки Інтегралик
           розв'язує чи рука пише — значок пульсує й не натискається (етап 1, 18.10).
           Власник 18.10: «додай позначку Інтегралика… стан, коли він думає» — коли розв'язуватиме Інтегралик
           (готового розв'язку немає), у куті значка — Інтегралик; поки він розв'язує й пише — думає (похитується)
           замість пульсу всього значка. -->
      <button
        v-if="actions.handwrite"
        type="button"
        class="wb-card-window-controls__btn wb-card-window-controls__btn--handwrite"
        :class="{
          'wb-card-window-controls__btn--busy': handwriteBusy && !actions.handwriteSolves,
          'wb-card-window-controls__btn--solving': handwriteBusy && actions.handwriteSolves,
        }"
        data-testid="wb-card-window-handwrite"
        :title="t('winterboard.card.handwrite')"
        :aria-label="t('winterboard.card.handwrite')"
        :aria-busy="handwriteBusy ? 'true' : undefined"
        :disabled="handwriteBusy"
        @click="emit('handwrite')"
      >✍<IntegralykThinking
          v-if="actions.handwriteSolves"
          class="wb-card-window-controls__itg"
          :size="12"
          :thinking="handwriteBusy"
        /></button>
      <!-- LAW §9 v1.33 (пакет 3 «один Інтегралик», 19.10): підказка й типова помилка від Інтегралика поруч
           із задачею. Як ✍ — значки без напису, назва в спливній підказці й для читача екрана. Поки Інтегралик
           складає картку, натиснутий значок пульсує, обидва не натискаються. -->
      <template v-if="actions.taskHelp">
        <button
          v-for="kind in TASK_HELP_KINDS"
          :key="kind"
          type="button"
          class="wb-card-window-controls__btn wb-card-window-controls__btn--task-help"
          :class="{ 'wb-card-window-controls__btn--busy': taskHelpBusy === kind }"
          :data-testid="`wb-card-window-task-help-${kind}`"
          :title="t(`winterboard.card.taskHelp.${kind}`)"
          :aria-label="t(`winterboard.card.taskHelp.${kind}`)"
          :aria-busy="taskHelpBusy === kind ? 'true' : undefined"
          :disabled="taskHelpBusy !== null"
          @click="emit('taskHelp', kind)"
        >{{ TASK_HELP_ICONS[kind] }}</button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { CardWindowActions } from '../../board/windowActions'
import IntegralykThinking from '@/modules/intent/IntegralykThinking.vue'
import { nextPresentationScale, presentationScaleLabel } from '../../board/cardPresentation'

const props = withDefaults(
  defineProps<{
    actions: CardWindowActions
    isExpanded: boolean
    /** Поточний спільний масштаб картки (`presentationScaleOf`). */
    scale?: number
    /** Етап 1: Інтегралик розв'язує або рука пише саме цю картку. */
    handwriteBusy?: boolean
    /** LAW §9 v1.33: яку картку Інтегралик складає до цієї задачі зараз (null — жодної). */
    taskHelpBusy?: 'hint' | 'mistake' | null
  }>(),
  { scale: 1, handwriteBusy: false, taskHelpBusy: null },
)

const emit = defineEmits<{
  minimize: []; expand: []; delete: []; handwrite: []; fitHeight: []; scale: [direction: -1 | 0 | 1]
  taskHelp: [kind: 'hint' | 'mistake']
}>()

const TASK_HELP_KINDS = ['hint', 'mistake'] as const
const TASK_HELP_ICONS = { hint: '💡', mistake: '⚠' } as const

const scaleLabel = computed(() => presentationScaleLabel(props.scale))
const hasTask = computed(() => props.actions.handwrite || props.actions.taskHelp)
const hasWindowRow = computed(() => props.actions.scale || props.actions.fitHeight || props.actions.minimize
  || props.actions.expand || props.actions.delete)
const canScaleDown = computed(() => nextPresentationScale(props.scale, -1) !== null)
const canScaleUp = computed(() => nextPresentationScale(props.scale, 1) !== null)

const { t } = useI18n({ useScope: 'global' })
</script>

<style scoped>
.wb-card-window-controls {
  position: absolute;
  z-index: 3;
  display: flex;
  /* LAW §9 v1.44: один рядок; ✍ 💡 ⚠ (у розмітці після рядка вікна) — зліва, «×» — справа, далеко від них.
     Не вміщається в ширину картки (вертикальний планшет, масштаб 0,37) — ✍ 💡 ⚠ переходять нижче, а не за край. */
  flex-direction: row-reverse;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 2px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
  pointer-events: auto;
}

.wb-card-window-controls__row {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* У шапці картки (2026-09-24): без плашки — кнопки як у рядку вікна.
   LAW §9 v1.35: 24 px замість 20 — прохід «очима вчителя» (19.10) назвав 20 px дрібними. */
.wb-card-window-controls--header {
  max-width: calc(100% - 8px);
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}
.wb-card-window-controls--header .wb-card-window-controls__row {
  gap: 0;
}
.wb-card-window-controls--header .wb-card-window-controls__row .wb-card-window-controls__btn {
  width: 24px;
  height: 24px;
  font-size: 14px;
}
.wb-card-window-controls--header .wb-card-window-controls__row .wb-card-window-controls__btn--label {
  width: auto;
}

/* ✍ 💡 ⚠ — кнопки 32 px з проміжком (LAW §9 v1.35), у тому ж рядку, що й вікно (v1.44). */
.wb-card-window-controls__task {
  display: flex;
  align-items: center;
  gap: 4px;
}
/* У шапці картки з кнопками задачі — уся група однією плашкою (не рядок + плашка під ним). */
.wb-card-window-controls--header.wb-card-window-controls--with-task {
  padding: 2px;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
}
.wb-card-window-controls--with-task .wb-card-window-controls__row {
  padding-left: 4px;
  border-left: 1px solid #e2e8f0;
}
.wb-card-window-controls__task .wb-card-window-controls__btn {
  width: 32px;
  height: 32px;
  font-size: 18px;
}

/* Дотик (планшет, велика дошка): палець ширший за курсор — кнопки задачі 44 px, рядок вікна 32 px.
   Рядок 32 px вищий за шапку картки й лягає на її назву — тому на дотику і він на плашці. */
@media (any-pointer: coarse) {
  .wb-card-window-controls--header:not(.wb-card-window-controls--with-task) .wb-card-window-controls__row {
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }
  .wb-card-window-controls__row .wb-card-window-controls__btn,
  .wb-card-window-controls--header .wb-card-window-controls__row .wb-card-window-controls__btn {
    width: 32px;
    height: 32px;
    font-size: 16px;
  }
  .wb-card-window-controls__row .wb-card-window-controls__btn--label,
  .wb-card-window-controls--header .wb-card-window-controls__row .wb-card-window-controls__btn--label {
    width: auto;
  }
  .wb-card-window-controls__task .wb-card-window-controls__btn {
    width: 44px;
    height: 44px;
    font-size: 22px;
  }
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

/* Етап 1: розв'язує / пише — значок пульсує чорнилом рукопису (темно-синім). */
.wb-card-window-controls__btn--busy:disabled {
  opacity: 1;
  color: #1e3a8a;
  animation: wb-handwrite-busy 1.2s ease-in-out infinite;
}

@keyframes wb-handwrite-busy {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@media (prefers-reduced-motion: reduce) {
  .wb-card-window-controls__btn--busy:disabled { animation: none; }
}

/* Позначка Інтегралика в куті ✍ (розв'язуватиме він). */
.wb-card-window-controls__btn--handwrite { position: relative; }
.wb-card-window-controls__itg {
  position: absolute;
  right: -4px;
  bottom: -4px;
  pointer-events: none;
}
/* Розв'язує й пише Інтегралик: значок не блідне — думає сам Інтегралик. */
.wb-card-window-controls__btn--solving:disabled { opacity: 1; color: #1e3a8a; }

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

/* ── У панелі виділення (LAW §9 v1.44): кнопки як у решти панелі — світлі на темному, 32 px; ✍ 💡 ⚠ більші. ── */
.wb-card-window-controls--docked {
  position: static;
  flex-wrap: nowrap;
  padding: 0 0 0 4px;
  margin-left: 2px;
  background: transparent;
  border: none;
  border-left: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 0;
  box-shadow: none;
}
.wb-card-window-controls--docked .wb-card-window-controls__row .wb-card-window-controls__btn {
  width: 32px;
  height: 32px;
  font-size: 15px;
}
.wb-card-window-controls--docked .wb-card-window-controls__row .wb-card-window-controls__btn--label {
  width: auto;
  font-size: 12px;
}
.wb-card-window-controls--docked .wb-card-window-controls__btn {
  color: #e2e8f0;
}
.wb-card-window-controls--docked .wb-card-window-controls__btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
}
.wb-card-window-controls--docked.wb-card-window-controls--with-task .wb-card-window-controls__row {
  border-left-color: rgba(255, 255, 255, 0.18);
}
.wb-card-window-controls--docked .wb-card-window-controls__divider {
  background: rgba(255, 255, 255, 0.18);
}
.wb-card-window-controls--docked .wb-card-window-controls__btn--busy:disabled,
.wb-card-window-controls--docked .wb-card-window-controls__btn--solving:disabled {
  color: #93c5fd;
}

/* ── Темна тема (Б-156, фаза 2): ті самі селектори, що вище, — кольори токенами теми.
   Згенеровано з правил цього файлу; світла й класична не змінюються. ── */
[data-theme="dark"] .wb-card-window-controls {
  background: var(--color-surface);
  border-color: var(--color-border);
}
[data-theme="dark"] .wb-card-window-controls__btn {
  color: var(--color-text-secondary);
}
[data-theme="dark"] .wb-card-window-controls__btn:hover {
  background: var(--color-border);
  color: var(--color-text);
}
@media (any-pointer: coarse) {
  [data-theme="dark"] .wb-card-window-controls--header .wb-card-window-controls__row {
    background: var(--color-surface);
    border-color: var(--color-border);
  }
}
[data-theme="dark"] .wb-card-window-controls--header.wb-card-window-controls--with-task {
  background: var(--color-surface);
  border-color: var(--color-border);
}
[data-theme="dark"] .wb-card-window-controls--docked {
  background: transparent;
}
[data-theme="dark"] .wb-card-window-controls--docked .wb-card-window-controls__btn {
  color: #e2e8f0;
}
[data-theme="dark"] .wb-card-window-controls__divider {
  background: var(--color-border);
}
[data-theme="dark"] .wb-card-window-controls__btn--delete:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
</style>

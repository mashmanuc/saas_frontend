<template>
  <!-- Б-205: заповненість дошки відносно межі «Зберегти як урок» — позначка в зеленій панелі.
       Власник 2026-10-18: жовта смужка над панеллю зʼявлялась і зникала посеред письма й зсувала
       дошку під пером. Панель має сталу висоту, тож позначка в ній нічого не зсуває. Пояснення —
       при наведенні (title) або дотику (перо, планшет): віконце поверх полотна, не в потоці. -->
  <div ref="rootRef" class="wb-size-badge" :class="`wb-size-badge--${level}`" data-testid="lesson-size-badge">
    <button
      type="button"
      class="wb-size-badge__btn"
      :title="`${title}. ${hint}`"
      :aria-expanded="open"
      data-testid="lesson-size-badge-btn"
      @click="open = !open"
    >
      {{ t('winterboard.lessonSize.badge', { percent }) }}
    </button>
    <div v-if="open" class="wb-size-badge__pop" role="status" data-testid="lesson-size-badge-hint">
      <span class="wb-size-badge__pop-title">{{ title }}</span>
      <span class="wb-size-badge__pop-hint">{{ hint }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ level: 'warn' | 'full'; percent: number }>()
const { t } = useI18n()

const open = ref(false)
const rootRef = ref<HTMLElement | null>(null)

const title = computed(() => (props.level === 'full'
  ? t('winterboard.lessonSize.fullTitle')
  : t('winterboard.lessonSize.warnTitle', { percent: props.percent })))
const hint = computed(() => (props.level === 'full'
  ? t('winterboard.lessonSize.fullHint')
  : t('winterboard.lessonSize.warnHint')))

// Дотик поза позначкою закриває пояснення (пером на планшеті наведення немає).
function onOutside(e: PointerEvent): void {
  if (rootRef.value && !rootRef.value.contains(e.target as Node)) open.value = false
}
watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('pointerdown', onOutside, true)
  else document.removeEventListener('pointerdown', onOutside, true)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside, true))
</script>

<style scoped>
.wb-size-badge {
  position: relative;
  display: inline-flex;
}

.wb-size-badge__btn {
  padding: 2px 10px;
  border: 1px solid #fde68a;
  border-radius: 999px;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  cursor: pointer;
}

.wb-size-badge--full .wb-size-badge__btn {
  border-color: #fecaca;
  background: #fee2e2;
  color: #991b1b;
}

.wb-size-badge__pop {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.18);
  font-size: 13px;
  line-height: 1.35;
  white-space: normal;
}

.wb-size-badge__pop-title {
  font-weight: 600;
}

.wb-size-badge__pop-hint {
  color: #475569;
}

/* ── Темна тема (Б-156): кольори токенами теми. ── */
[data-theme="dark"] .wb-size-badge__btn {
  border-color: color-mix(in srgb, var(--color-warning) 40%, transparent);
  background: var(--color-warning-soft);
  color: var(--color-warning);
}
[data-theme="dark"] .wb-size-badge--full .wb-size-badge__btn {
  border-color: color-mix(in srgb, var(--color-danger) 40%, transparent);
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
[data-theme="dark"] .wb-size-badge__pop {
  border-color: var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
}
[data-theme="dark"] .wb-size-badge__pop-hint {
  color: var(--color-text-secondary);
}
</style>

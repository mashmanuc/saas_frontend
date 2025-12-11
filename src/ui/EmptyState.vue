<template>
  <section class="empty-state" role="status" aria-live="polite">
    <div v-if="icon" class="empty-state__icon" aria-hidden="true">
      <span v-if="!isInlineSvg" class="empty-state__icon-text">
        {{ icon }}
      </span>
      <span
        v-else
        class="empty-state__icon-svg"
        v-html="icon"
      />
    </div>

    <div class="empty-state__content">
      <h3 class="empty-state__title">
        {{ displayedTitle }}
      </h3>

      <p v-if="displayedDescription" class="empty-state__description">
        {{ displayedDescription }}
      </p>
    </div>

    <div v-if="hasActions" class="empty-state__actions">
      <slot />
    </div>
  </section>
</template>

<script setup>
import { computed, useSlots } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  icon: {
    type: String,
    default: '',
  },
})

const slots = useSlots()
const { t } = useI18n()

const hasActions = computed(() => Boolean(slots.default))
const isInlineSvg = computed(() => {
  if (!props.icon) return false
  return props.icon.trim().startsWith('<')
})
const displayedTitle = computed(() => props.title || t('ui.emptyState.defaultTitle'))
const displayedDescription = computed(() => props.description || t('ui.emptyState.defaultDescription'))
</script>

<style scoped>
.empty-state {
  width: 100%;
  border-radius: var(--radius-lg, 20px);
  background: var(--surface-muted, #f7f8fb);
  border: 1px dashed rgba(82, 94, 113, 0.2);
  padding: 2.25rem 1.75rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  align-items: center;
  justify-content: center;
}

.empty-state__icon {
  display: inline-flex;
  width: 4.5rem;
  height: 4.5rem;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--surface, #fff);
  box-shadow: 0 12px 30px rgba(18, 28, 45, 0.08);
}

.empty-state__icon-text {
  font-size: 2rem;
  line-height: 1;
}

.empty-state__icon-svg :deep(svg) {
  width: 2.5rem;
  height: 2.5rem;
  display: block;
  color: var(--brand-primary, #2f54eb);
}

.empty-state__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #121c2d);
}

.empty-state__description {
  margin: 0.35rem 0 0;
  font-size: 1rem;
  color: var(--text-secondary, #4f5565);
  max-width: 36rem;
}

.empty-state__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
}
</style>

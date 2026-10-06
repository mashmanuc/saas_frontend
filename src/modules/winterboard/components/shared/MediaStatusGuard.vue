<template>
  <slot v-if="isReady" />
  <div v-else-if="isProcessing" class="media-guard media-guard--processing">
    <span class="media-guard__icon">&#x23F3;</span>
    <span class="media-guard__text">{{ t('winterboard.media.processing') }}</span>
  </div>
  <div v-else-if="isFailed" class="media-guard media-guard--failed">
    <span class="media-guard__icon">&#x274C;</span>
    <span class="media-guard__text">{{ t('winterboard.media.failed') }}</span>
    <button
      v-if="showRetry"
      type="button"
      class="media-guard__retry"
      @click="$emit('retry')"
    >
      {{ t('winterboard.media.retry') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(defineProps<{
  status: string
  showRetry?: boolean
}>(), {
  showRetry: true,
})

defineEmits<{
  retry: []
}>()

const { t } = useI18n()

const isReady = computed(() =>
  !props.status || props.status === 'ready',
)
const isProcessing = computed(() =>
  ['pending', 'processing'].includes(props.status),
)
const isFailed = computed(() =>
  props.status === 'failed',
)
</script>

<style scoped>
.media-guard {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 6px;
  font-size: 13px;
}
.media-guard--processing {
  background: #fef9c3;
  color: #854d0e;
}
.media-guard--failed {
  background: #fef2f2;
  color: #991b1b;
}
.media-guard__icon {
  font-size: 16px;
  flex-shrink: 0;
}
.media-guard__text {
  flex: 1;
}
.media-guard__retry {
  background: none;
  border: 1px solid #fca5a5;
  border-radius: 4px;
  color: #dc2626;
  font-size: 12px;
  cursor: pointer;
  padding: 3px 10px;
  flex-shrink: 0;
}
.media-guard__retry:hover {
  background: #fef2f2;
}

/* ── Темна тема (Б-156, фаза 2): ті самі селектори, що вище, — кольори токенами теми.
   Згенеровано з правил цього файлу; світла й класична не змінюються. ── */
[data-theme="dark"] .media-guard--processing {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}
[data-theme="dark"] .media-guard--failed {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
[data-theme="dark"] .media-guard__retry {
  border-color: color-mix(in srgb, var(--color-danger) 35%, transparent);
  color: var(--color-danger);
}
[data-theme="dark"] .media-guard__retry:hover {
  background: var(--color-danger-soft);
}
</style>

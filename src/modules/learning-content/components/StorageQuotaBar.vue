<template>
  <div class="storage-quota" v-if="quota">
    <div class="storage-quota__info">
      <span class="storage-quota__label">
        {{ t('storage.quotaLabel', { used: usedFormatted, total: totalFormatted }) }}
      </span>
      <span class="storage-quota__percent">{{ quota.usage_percent }}%</span>
    </div>
    <div
      class="storage-quota__track"
      role="progressbar"
      :aria-valuenow="quota.usage_percent"
      :aria-valuemin="0"
      :aria-valuemax="100"
      :aria-label="t('storage.quotaLabel', { used: usedFormatted, total: totalFormatted })"
    >
      <div
        class="storage-quota__bar"
        :class="barColorClass"
        :style="{ width: quota.usage_percent + '%' }"
      />
    </div>
    <p
      v-if="quota.usage_percent > 80"
      class="storage-quota__warning"
      :class="quota.usage_percent > 95 ? 'storage-quota__warning--critical' : 'storage-quota__warning--amber'"
    >
      {{ quota.usage_percent > 95 ? t('storage.quotaCritical') : t('storage.quotaWarning') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatBytes } from '@/utils/formatBytes'
import type { StorageQuota } from '@/modules/learning-content/api/learningContentApi'

const props = defineProps<{
  quota: StorageQuota | null
}>()

const { t } = useI18n()

const usedFormatted = computed(() =>
  props.quota ? formatBytes(props.quota.used_bytes) : '0 B'
)

const totalFormatted = computed(() =>
  props.quota ? formatBytes(props.quota.total_quota_bytes) : '0 B'
)

const barColorClass = computed(() => {
  if (!props.quota) return 'storage-quota__bar--normal'
  if (props.quota.usage_percent > 95) return 'storage-quota__bar--critical'
  if (props.quota.usage_percent > 80) return 'storage-quota__bar--amber'
  return 'storage-quota__bar--normal'
})
</script>

<style scoped>
.storage-quota {
  padding: 8px 12px;
}
.storage-quota__info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}
.storage-quota__label {
  font-size: 11px;
  color: #6b7280;
}
.storage-quota__percent {
  font-size: 11px;
  color: #6b7280;
}
.storage-quota__track {
  width: 100%;
  height: 6px;
  background: #e5e7eb;
  border-radius: 9999px;
  overflow: hidden;
}
.storage-quota__bar {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.3s ease;
}
.storage-quota__bar--normal {
  background: #3b82f6;
}
.storage-quota__bar--amber {
  background: #f59e0b;
}
.storage-quota__bar--critical {
  background: #ef4444;
}
.storage-quota__warning {
  font-size: 11px;
  margin-top: 4px;
  line-height: 1.3;
}
.storage-quota__warning--amber {
  color: #d97706;
}
.storage-quota__warning--critical {
  color: #dc2626;
  font-weight: 500;
}
</style>

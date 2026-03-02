<template>
  <span
    v-if="ownershipType"
    class="lc-ownership-badge"
    :class="[`lc-ownership-${ownershipType.toLowerCase()}`, `lc-ownership-${size}`]"
    :title="label"
    data-test="ownership-badge"
  >
    <span class="lc-ownership-icon" aria-hidden="true">{{ icon }}</span>
    <span class="lc-ownership-label">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { OwnershipType } from '../types/learningContent'

const props = withDefaults(
  defineProps<{
    ownershipType: OwnershipType
    size?: 'sm' | 'md'
  }>(),
  { size: 'sm' },
)

const { t } = useI18n()

const ICON_MAP: Record<OwnershipType, string> = {
  PLATFORM: '\uD83C\uDFE2',
  TUTOR: '\uD83D\uDC64',
  CO_OWNED: '\uD83E\uDD1D',
  LICENSED: '\uD83D\uDCDC',
  THIRD_PARTY: '\uD83C\uDF10',
  USER_GENERATED: '\u270F\uFE0F',
}

const icon = computed(() => ICON_MAP[props.ownershipType] ?? '')
const label = computed(() => t(`learningContent.ownership.${props.ownershipType}`))
</script>

<style scoped>
.lc-ownership-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border-radius: 3px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
  line-height: 1;
}

/* Sizes */
.lc-ownership-sm {
  font-size: 9px;
  padding: 1px 5px;
}
.lc-ownership-md {
  font-size: 11px;
  padding: 2px 7px;
}

.lc-ownership-icon {
  font-size: inherit;
}

/* Variants */
.lc-ownership-platform {
  background: #f3f4f6;
  color: #6b7280;
}
.lc-ownership-tutor {
  background: #dbeafe;
  color: #1e40af;
}
.lc-ownership-co_owned {
  background: #d1fae5;
  color: #065f46;
}
.lc-ownership-licensed {
  background: #fef3c7;
  color: #92400e;
}
.lc-ownership-third_party {
  background: #f3f4f6;
  color: #6b7280;
}
.lc-ownership-user_generated {
  background: #ede9fe;
  color: #6d28d9;
}
</style>

<template>
  <span
    v-if="accessType && accessType !== 'PUBLIC'"
    class="lc-access-icon"
    :class="[`lc-access-${accessType.toLowerCase()}`, `lc-access-${size}`]"
    :title="label"
    data-test="access-lock-icon"
    aria-hidden="true"
  >
    {{ icon }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AccessType } from '../types/learningContent'

const props = withDefaults(
  defineProps<{
    accessType: AccessType
    size?: 'sm' | 'md'
  }>(),
  { size: 'sm' },
)

const { t } = useI18n()

const ICON_MAP: Record<AccessType, string> = {
  PRIVATE: '\uD83D\uDD12',
  PUBLIC: '\uD83C\uDF0D',
  PREVIEW: '\uD83D\uDC41',
  PAID: '\uD83D\uDD12',
  LESSON_BOUND: '\uD83D\uDCDA',
  COURSE_BOUND: '\uD83C\uDF93',
  SUBSCRIPTION: '\u2B50',
  RESTRICTED: '\uD83D\uDEAB',
  ARCHIVED: '\uD83D\uDCE6',
}

const icon = computed(() => ICON_MAP[props.accessType] ?? '')
const label = computed(() => t(`learningContent.access.${props.accessType}`))
</script>

<style scoped>
.lc-access-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 1;
}

/* Sizes */
.lc-access-sm {
  font-size: 10px;
}
.lc-access-md {
  font-size: 14px;
}

/* Variant colors */
.lc-access-preview {
  opacity: 0.7;
}
.lc-access-paid {
  filter: saturate(1.5);
}
.lc-access-restricted {
  filter: saturate(1.2);
}
.lc-access-archived {
  opacity: 0.5;
}
</style>

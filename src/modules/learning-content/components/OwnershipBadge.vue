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
  background: var(--bg-secondary);
  color: var(--text-secondary);
}
.lc-ownership-tutor {
  background: color-mix(in srgb, var(--info-bg) 12%, var(--card-bg));
  color: var(--info-bg);
}
.lc-ownership-co_owned {
  background: color-mix(in srgb, var(--success-bg) 12%, var(--card-bg));
  color: var(--success-bg);
}
.lc-ownership-licensed {
  background: color-mix(in srgb, var(--warning-bg) 15%, var(--card-bg));
  color: var(--warning-bg);
}
.lc-ownership-third_party {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}
.lc-ownership-user_generated {
  background: color-mix(in srgb, #7c3aed 12%, var(--card-bg));
  color: #7c3aed;
}
</style>

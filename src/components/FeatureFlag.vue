<template>
  <slot v-if="shouldRender" />
  <slot v-else-if="$slots.fallback" name="fallback" />
</template>

<script setup>
/**
 * FeatureFlag Component — v0.14.0
 * Conditional rendering based on feature flags
 * 
 * Usage:
 * <FeatureFlag name="chat_reactions">
 *   <ReactionPicker />
 *   <template #fallback>
 *     <span>Coming soon!</span>
 *   </template>
 * </FeatureFlag>
 * 
 * Multiple flags (all must be enabled):
 * <FeatureFlag :names="['chat_reactions', 'chat_threads']">
 *   <ThreadedReactions />
 * </FeatureFlag>
 * 
 * Any flag (at least one must be enabled):
 * <FeatureFlag :names="['ui_dark_mode', 'ui_compact_view']" mode="any">
 *   <ThemeSettings />
 * </FeatureFlag>
 */

import { computed } from 'vue'
import { useFeatureFlag, useFeatureFlags } from '../composables/useFeatureFlag'

const props = defineProps({
  /**
   * Single feature flag name
   */
  name: {
    type: String,
    default: '',
  },
  /**
   * Multiple feature flag names
   */
  names: {
    type: Array,
    default: () => [],
  },
  /**
   * Mode for multiple flags: 'all' or 'any'
   */
  mode: {
    type: String,
    default: 'all',
    validator: (value) => ['all', 'any'].includes(value),
  },
  /**
   * Invert the condition (show when disabled)
   */
  not: {
    type: Boolean,
    default: false,
  },
})

// Single flag check
const singleFlag = props.name ? useFeatureFlag(props.name) : null

// Multiple flags check
const multipleFlags = props.names.length > 0 ? useFeatureFlags(props.names) : null

const shouldRender = computed(() => {
  let result = false
  
  if (singleFlag) {
    result = singleFlag.enabled.value
  } else if (multipleFlags) {
    result = props.mode === 'all' 
      ? multipleFlags.allEnabled.value 
      : multipleFlags.anyEnabled.value
  }
  
  return props.not ? !result : result
})
</script>

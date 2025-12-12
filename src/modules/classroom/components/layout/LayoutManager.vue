<template>
  <div class="layout-manager" :class="`layout-manager--${mode}`">
    <component :is="layoutComponent">
      <template #video>
        <slot name="video"></slot>
      </template>
      <template #board>
        <slot name="board"></slot>
      </template>
    </component>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import type { LayoutMode } from '../../stores/roomStore'

import SideBySide from './SideBySide.vue'
import FloatingPiP from './FloatingPiP.vue'
import MobileCompact from './MobileCompact.vue'

interface Props {
  mode?: LayoutMode
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'side-by-side',
})

const layoutComponent = computed(() => {
  switch (props.mode) {
    case 'side-by-side':
      return SideBySide
    case 'pip':
    case 'video-focus':
      return FloatingPiP
    case 'board-focus':
      return SideBySide // Board takes full width
    default:
      return SideBySide
  }
})
</script>

<style scoped>
.layout-manager {
  width: 100%;
  height: 100%;
  overflow: hidden;
}
</style>

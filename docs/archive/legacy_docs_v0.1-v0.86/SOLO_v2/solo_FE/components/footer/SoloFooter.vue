<template>
  <footer class="solo-footer">
    <div class="solo-footer__left">
      <PageTabs
        :pages="pages"
        :active-page-id="activePageId"
        @switch="(id: string) => $emit('page-switch', id)"
        @add="$emit('page-add')"
        @delete="(id: string) => $emit('page-delete', id)"
        @rename="(id: string, name: string) => $emit('page-rename', id, name)"
      />
    </div>
    <div class="solo-footer__center">
      <div class="solo-zoom-controls">
        <button class="solo-btn solo-btn--small" title="Zoom Out" @click="$emit('zoom-out')">
          −
        </button>
        <span class="solo-zoom-controls__value">{{ Math.round(zoom * 100) }}%</span>
        <button class="solo-btn solo-btn--small" title="Zoom In" @click="$emit('zoom-in')">
          +
        </button>
        <button class="solo-btn solo-btn--small" title="Reset Zoom" @click="$emit('zoom-reset')">
          ⟲
        </button>
      </div>
    </div>
    <div class="solo-footer__right">
      <button
        class="solo-btn solo-btn--small"
        :title="fullscreen ? 'Exit Fullscreen' : 'Fullscreen'"
        @click="$emit('toggle-fullscreen')"
      >
        {{ fullscreen ? '⛶' : '⛶' }}
      </button>
    </div>
  </footer>
</template>

<script setup lang="ts">
import type { PageState } from '../../types/solo'
import PageTabs from '../pages/PageTabs.vue'

defineProps<{
  pages: PageState[]
  activePageId: string
  zoom: number
  fullscreen: boolean
}>()

defineEmits<{
  (e: 'page-switch', pageId: string): void
  (e: 'page-add'): void
  (e: 'page-delete', pageId: string): void
  (e: 'page-rename', pageId: string, name: string): void
  (e: 'zoom-in'): void
  (e: 'zoom-out'): void
  (e: 'zoom-reset'): void
  (e: 'toggle-fullscreen'): void
}>()
</script>

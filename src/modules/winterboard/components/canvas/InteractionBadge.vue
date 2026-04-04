<template>
  <div
    class="wb-interaction-badge"
    :class="{
      'wb-interaction-badge--active': isMenuOpen || isAudioPlaying,
      'wb-interaction-badge--single': totalCount === 1,
    }"
    @click.stop="handleBadgeClick"
  >
    <!-- Single interaction → direct icon -->
    <span v-if="totalCount === 1" class="wb-interaction-badge__icon" :title="singleTitle">
      <template v-if="singleIcon !== null">{{ singleIcon }}</template>
      <svg v-else width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" class="wb-interaction-badge__text-icon">
        <path d="M1.5 3h10M6.5 3v7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    </span>

    <!-- Multiple → lightning icon -->
    <span v-else class="wb-interaction-badge__icon" :title="t('winterboard.interactions.badge')">
      ⚡
    </span>

    <!-- Mini-menu (2+ interactions) -->
    <Transition name="wb-badge-menu">
      <div
        v-if="isMenuOpen && totalCount > 1"
        class="wb-interaction-badge__menu"
        @click.stop
      >
        <!-- Presentation -->
        <button
          v-if="isPresentation"
          type="button"
          class="wb-interaction-badge__menu-item"
          @click="handlePresentation"
        >
          <span class="wb-interaction-badge__menu-icon">▶</span>
          <span>{{ t('winterboard.interactions.openPresentation') }}</span>
        </button>

        <!-- Audio -->
        <button
          v-if="hasAudio"
          type="button"
          class="wb-interaction-badge__menu-item"
          :class="{ 'wb-interaction-badge__menu-item--active': isAudioPlaying }"
          @click="$emit('play-audio')"
        >
          <span class="wb-interaction-badge__menu-icon">{{ isAudioPlaying ? '🔊' : '🔈' }}</span>
          <span>{{ isAudioPlaying ? t('winterboard.interactions.pauseAudio') : t('winterboard.interactions.playAudio') }}</span>
        </button>

        <!-- Text interactions -->
        <button
          v-for="interaction in interactions"
          :key="interaction.id"
          type="button"
          class="wb-interaction-badge__menu-item"
          @click="handleToggle(interaction.id)"
        >
          <span class="wb-interaction-badge__menu-icon wb-interaction-badge__menu-icon--text">T</span>
          <span>{{ interaction.label || t('winterboard.interactions.showText') }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
// WB: InteractionBadge — unified badge for all object interactions
// 1 interaction → direct action (click = toggle/play/open)
// 2+ interactions → click opens mini-menu
// Ref: PLAN.md v2 §1.3.1

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBInteraction } from '../../types/winterboard'

const props = defineProps<{
  objectId: string
  interactions: WBInteraction[]
  hasAudio: boolean
  isPresentation: boolean
  isAudioPlaying: boolean
  readOnly: boolean
}>()

const emit = defineEmits<{
  'toggle-interaction': [interactionId: string]
  'play-audio': []
  'open-presentation': []
}>()

const { t } = useI18n({ useScope: 'global' })

// ── Menu state ─────────────────────────────────────────────────────────────

const isMenuOpen = ref(false)

const totalCount = computed(() => {
  let count = props.interactions.length
  if (props.hasAudio) count++
  if (props.isPresentation) count++
  return count
})

// ── Single interaction helpers ─────────────────────────────────────────────

const singleIcon = computed(() => {
  if (props.isPresentation) return '▶'
  if (props.hasAudio) return props.isAudioPlaying ? '🔊' : '🔈'
  if (props.interactions.length === 1) return null  // rendered as SVG T
  return '⚡'
})

const singleTitle = computed(() => {
  if (props.isPresentation) return t('winterboard.interactions.openPresentation')
  if (props.hasAudio) return props.isAudioPlaying
    ? t('winterboard.interactions.pauseAudio')
    : t('winterboard.interactions.playAudio')
  if (props.interactions.length === 1) {
    return props.interactions[0].label || t('winterboard.interactions.showText')
  }
  return ''
})

// ── Click handling ─────────────────────────────────────────────────────────

function handleBadgeClick() {
  if (totalCount.value === 1) {
    // Direct action
    if (props.isPresentation) {
      emit('open-presentation')
    } else if (props.hasAudio) {
      emit('play-audio')
    } else if (props.interactions.length === 1) {
      emit('toggle-interaction', props.interactions[0].id)
    }
    return
  }

  // Multiple → toggle menu
  isMenuOpen.value = !isMenuOpen.value
}

function handlePresentation() {
  isMenuOpen.value = false
  emit('open-presentation')
}

function handleToggle(interactionId: string) {
  isMenuOpen.value = false
  emit('toggle-interaction', interactionId)
}

// ── Close on click outside ─────────────────────────────────────────────────

function onDocumentClick() {
  if (isMenuOpen.value) {
    isMenuOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick, { capture: true })
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick, { capture: true })
})

</script>

<style scoped>
.wb-interaction-badge {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  pointer-events: auto;
  font-size: 14px;
  transition: transform 0.15s, box-shadow 0.15s, background 0.15s;
  user-select: none;
  position: relative;
}

.wb-interaction-badge:hover {
  transform: scale(1.12);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.22);
}

.wb-interaction-badge--active {
  background: rgba(99, 102, 241, 0.15);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
}

.wb-interaction-badge__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.wb-interaction-badge__text-icon {
  color: #6366f1;
}

.wb-interaction-badge--active .wb-interaction-badge__text-icon {
  color: #818cf8;
}

/* ── Mini-menu ────────────────────────────────────────────────────────── */

.wb-interaction-badge__menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(30, 41, 59, 0.96);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  padding: 4px;
  min-width: 160px;
  z-index: 20;
  pointer-events: auto;
}

.wb-interaction-badge__menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #e2e8f0;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.12s;
  white-space: nowrap;
  text-align: left;
}

.wb-interaction-badge__menu-item:hover {
  background: rgba(255, 255, 255, 0.12);
}

.wb-interaction-badge__menu-item--active {
  background: rgba(99, 102, 241, 0.2);
}

.wb-interaction-badge__menu-icon {
  font-size: 14px;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

.wb-interaction-badge__menu-icon--text {
  font-size: 13px;
  font-weight: 700;
  color: #818cf8;
}

/* ── Menu transition ──────────────────────────────────────────────────── */

.wb-badge-menu-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.wb-badge-menu-leave-active {
  transition: opacity 0.1s ease;
}
.wb-badge-menu-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);
}
.wb-badge-menu-leave-to {
  opacity: 0;
}
</style>

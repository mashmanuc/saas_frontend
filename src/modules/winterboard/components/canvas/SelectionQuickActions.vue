<template>
  <div
    v-if="showToolbar"
    ref="toolbarRef"
    class="wb-selection-quick-actions"
    :class="{
      'wb-selection-quick-actions--recording': isRecording,
      'wb-selection-quick-actions--uploading': isUploading,
    }"
    :style="toolbarPosition"
    @pointerdown.stop
    @mousedown.stop
  >
    <!-- ── Pre-recording: record button + limit hint ── -->
    <template v-if="!hasAudio && !isRecording && !isUploading">
      <button
        class="quick-action-btn quick-action-btn--record"
        :disabled="!recordingSupported"
        :title="recordingSupported
          ? t('winterboard.objectAudio.record')
          : t('winterboard.objectAudio.notSupported')"
        @click="audio.startRecording()"
      >
        🎤
      </button>
      <span class="limit-hint">
        {{ t('winterboard.objectAudio.limitHint', { maxSec: audio.maxDuration, maxMB: audio.maxSizeMB.value }) }}
      </span>
    </template>

    <!-- ── Recording state: blinking indicator + timer + stop ── -->
    <template v-if="isRecording">
      <span
        class="recording-indicator recording-indicator--pulse"
        :class="{ 'recording-indicator--warning': audio.isNearLimit.value }"
      >
        {{ audio.isNearLimit.value ? '⚠️' : '🔴' }}
        {{ audio.formatTime(audio.recordingTime.value) }} / {{ audio.formatTime(audio.maxDuration) }}
      </span>
      <button
        class="quick-action-btn"
        :title="t('winterboard.objectAudio.stop')"
        @click="audio.stopRecording()"
      >
        ⏹
      </button>
    </template>

    <!-- ── Uploading state: progress bar ── -->
    <template v-if="isUploading">
      <span class="upload-indicator">
        ⬆️ {{ uploadProgressLabel }}
      </span>
      <div class="upload-progress-bar">
        <div
          class="upload-progress-bar__fill"
          :style="{ width: `${audio.uploadProgress.value}%` }"
        />
      </div>
    </template>

    <!-- ── Has audio: play/re-record/delete ── -->
    <template v-if="hasAudio && !isRecording && !isUploading">
      <button
        class="quick-action-btn"
        :title="audio.isPlaying.value
          ? t('winterboard.objectAudio.pause')
          : t('winterboard.objectAudio.play')"
        @click="audio.togglePlayback()"
      >
        {{ audio.isPlaying.value ? '⏸' : '▶' }}
      </button>
      <span class="audio-duration">
        {{ audio.formatTime(audioDurationValue) }}
      </span>
      <button
        class="quick-action-btn"
        :title="t('winterboard.objectAudio.reRecord')"
        @click="audio.reRecord()"
      >
        🔄
      </button>
      <button
        class="quick-action-btn quick-action-btn--danger"
        :title="t('winterboard.objectAudio.delete')"
        @click="audio.deleteAudio()"
      >
        🗑
      </button>
    </template>

    <!-- ── Separator + delete selected (always visible when not recording) ── -->
    <template v-if="!isRecording && !isUploading">
      <span class="quick-action-sep" />
      <button
        class="quick-action-btn quick-action-btn--danger"
        :title="t('winterboard.context.deleteSelected')"
        @click="emit('delete-selected')"
      >
        🗑
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
// WB: SelectionQuickActions — floating toolbar above selected object.
// P0: PRIMARY entry point for Object Audio recording/playback.
// Ref: OBJECT_AUDIO_PLAN.md §5.4, §5.6, MANIFEST 3.2.1
//
// Positioning: clamp to viewport (zoom + pan safe).
// Limits UX: limit-hint, isNearLimit warning, upload progress, explainable toasts.

import { ref, computed, toRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useWBStore } from '../../board/state/boardStore'
import { useObjectAudio, isRecordingSupported } from '../../composables/useObjectAudio'
import type { WBStroke, WBAsset } from '../../types/winterboard'

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  sessionId: string
  zoom: number
  isTutor: boolean
  /** Canvas container element — used for viewport clamping */
  canvasContainer: HTMLElement | null
  /** When true, group drag overlay is active — hide toolbar */
  groupDragActive?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'delete-selected': []
  'audio-uploaded': [objectId: string, audioUrl: string, duration: number | null]
  'audio-deleted': [objectId: string]
}>()

const { t } = useI18n()
const wbStore = useWBStore()

// ─── Refs ───────────────────────────────────────────────────────────────────

const toolbarRef = ref<HTMLElement | null>(null)

// D15: Object ID locked during recording — toolbar stays visible even if selection clears
const lockedObjectId = ref<string | null>(null)

// ─── Selected object ────────────────────────────────────────────────────────

const activeObjectId = computed(() => {
  // During recording, use locked ID regardless of selection
  if (lockedObjectId.value) return lockedObjectId.value
  if (wbStore.selectedIds.length !== 1) return ''
  return wbStore.selectedIds[0] ?? ''
})

const selectedObject = computed<(WBStroke | WBAsset) | null>(() => {
  if (!activeObjectId.value) return null
  return wbStore.getObjectById(activeObjectId.value) ?? null
})

const selectedObjectId = computed(() => activeObjectId.value)

const selectedAudioUrl = computed(() => {
  const obj = selectedObject.value
  if (!obj) return undefined
  return (obj as WBStroke).audioUrl ?? (obj as WBAsset).audioUrl
})

const selectedAudioDuration = computed(() => {
  const obj = selectedObject.value
  if (!obj) return undefined
  return (obj as WBStroke).audioDuration ?? (obj as WBAsset).audioDuration
})

const audioDurationValue = computed(() => selectedAudioDuration.value ?? 0)

// ─── Show conditions ────────────────────────────────────────────────────────

const showToolbar = computed(() => {
  if (!props.isTutor) return false
  // D15: Keep toolbar visible during recording even if selection cleared
  if (lockedObjectId.value) return !!selectedObject.value
  if (wbStore.selectedIds.length !== 1) return false
  if (!selectedObject.value) return false
  // Hide during group drag
  if (props.groupDragActive) return false
  return true
})

// ─── Object Audio composable ────────────────────────────────────────────────

const recordingSupported = isRecordingSupported()

const audio = useObjectAudio({
  sessionId: toRef(props, 'sessionId'),
  objectId: selectedObjectId,
  audioUrl: selectedAudioUrl,
  audioDuration: selectedAudioDuration,
  t,
  onAudioUploaded: (audioUrl, duration) => {
    emit('audio-uploaded', selectedObjectId.value, audioUrl, duration)
  },
  onAudioDeleted: () => {
    emit('audio-deleted', selectedObjectId.value)
  },
})

const hasAudio = audio.hasAudio
const isRecording = audio.isRecording
const isUploading = audio.isUploading

// D22: Upload progress in MB/MB (%) format
const uploadProgressLabel = computed(() => {
  const pct = audio.uploadProgress.value
  const maxMB = audio.maxSizeMB.value
  const currentMB = (pct / 100 * maxMB).toFixed(1)
  return `${currentMB} MB / ${maxMB} MB (${pct}%)`
})

// D15: Lock objectId when recording starts, unlock when stops
watch(isRecording, (recording) => {
  if (recording) {
    lockedObjectId.value = activeObjectId.value || null
  } else if (!isUploading.value) {
    lockedObjectId.value = null
  }
})

// D15: Also unlock when upload finishes
watch(isUploading, (uploading) => {
  if (!uploading && !isRecording.value) {
    lockedObjectId.value = null
  }
})

// D16: If object is deleted during recording → auto-stop
watch(selectedObject, (obj) => {
  if (!obj && lockedObjectId.value && isRecording.value) {
    audio.stopRecording()
    lockedObjectId.value = null
  }
})

// ─── Positioning (zoom + pan safe, clamped to viewport) ─────────────────────

const TOOLBAR_HEIGHT = 40
const TOOLBAR_GAP = 8
const VIEWPORT_PADDING = 8

const toolbarPosition = computed(() => {
  const obj = selectedObject.value
  if (!obj) return { display: 'none' }

  const container = props.canvasContainer
  if (!container) return { display: 'none' }

  const zoom = props.zoom

  // Get bbox in canvas coords
  let bx: number, by: number, bw: number, bh: number

  if ('points' in obj && (obj as WBStroke).points) {
    // Stroke — compute from points
    const stroke = obj as WBStroke
    if (stroke.tool === 'rectangle' || stroke.tool === 'circle' || stroke.tool === 'line') {
      const p0 = stroke.points[0]
      bx = p0?.x ?? 0
      by = p0?.y ?? 0
      bw = stroke.width ?? 0
      bh = stroke.height ?? 0
    } else {
      // Freehand — bounding box from points
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const p of stroke.points) {
        if (p.x < minX) minX = p.x
        if (p.y < minY) minY = p.y
        if (p.x > maxX) maxX = p.x
        if (p.y > maxY) maxY = p.y
      }
      bx = minX
      by = minY
      bw = maxX - minX
      bh = maxY - minY
    }
  } else {
    // Asset
    const asset = obj as WBAsset
    bx = asset.x
    by = asset.y
    bw = asset.w
    bh = asset.h
  }

  // Canvas coords → screen coords relative to viewport (fixed positioning)
  const offset = wbStore.canvasOffset
  const canvasRect = container.getBoundingClientRect()

  // Object position in viewport coords
  const screenX = canvasRect.left + bx * zoom + offset.x
  const screenY = canvasRect.top + by * zoom + offset.y
  const screenW = bw * zoom
  const screenH = bh * zoom

  const viewportW = window.innerWidth
  const viewportH = window.innerHeight

  // Center X over bbox
  let left = screenX + screenW / 2
  // Above bbox
  let top = screenY - TOOLBAR_GAP - TOOLBAR_HEIGHT

  // Fallback: below bbox if no space above
  if (top < canvasRect.top + VIEWPORT_PADDING) {
    top = screenY + screenH + TOOLBAR_GAP
  }

  // Clamp X
  const toolbarW = toolbarRef.value?.offsetWidth ?? 200
  left = Math.max(
    canvasRect.left + VIEWPORT_PADDING,
    Math.min(left - toolbarW / 2, Math.min(viewportW, canvasRect.right) - toolbarW - VIEWPORT_PADDING),
  )

  // Clamp Y bottom (within canvas area)
  top = Math.min(top, Math.min(viewportH, canvasRect.bottom) - TOOLBAR_HEIGHT - VIEWPORT_PADDING)

  return {
    position: 'fixed' as const,
    left: `${left}px`,
    top: `${top}px`,
  }
})
</script>

<style scoped>
.wb-selection-quick-actions {
  position: fixed;
  pointer-events: auto;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: 13px;
  user-select: none;
  white-space: nowrap;
  transition: background-color 0.2s, border-color 0.2s;
}

/* Recording state — subtle red tint */
.wb-selection-quick-actions--recording {
  background: #fef2f2;
  border: 1.5px solid #fca5a5;
}

/* Uploading state — subtle blue tint */
.wb-selection-quick-actions--uploading {
  background: #eff6ff;
  border: 1.5px solid #93c5fd;
}

/* ── Buttons ── */

.quick-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  transition: background-color 0.15s;
}

.quick-action-btn:hover {
  background: #f3f4f6;
}

.quick-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.quick-action-btn--danger:hover {
  background: #fef2f2;
}

/* ── Limit hint (MANIFEST 3.2.1: VISIBLE) ── */

.limit-hint {
  font-size: 11px;
  color: #9ca3af;
  white-space: nowrap;
}

/* ── Recording indicator (MANIFEST 3.2.1: PREDICTABLE) ── */

.recording-indicator--pulse {
  animation: recording-pulse 1s ease-in-out infinite;
  color: #ef4444;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.recording-indicator--warning {
  color: #dc2626;
  font-weight: 700;
  animation: recording-pulse 0.5s ease-in-out infinite;
}

@keyframes recording-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* ── Upload progress bar ── */

.upload-indicator {
  font-size: 12px;
  color: #3b82f6;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.upload-progress-bar {
  width: 80px;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
}

.upload-progress-bar__fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 2px;
  transition: width 0.15s ease-out;
}

/* ── Audio duration ── */

.audio-duration {
  font-size: 12px;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}

/* ── Separator ── */

.quick-action-sep {
  width: 1px;
  height: 20px;
  background: #e5e7eb;
  margin: 0 2px;
}
</style>

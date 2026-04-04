<template>
  <Transition name="wb-sel-toolbar">
    <div
      v-if="isVisible"
      ref="toolbarRef"
      class="wb-selection-toolbar"
      :style="positionStyle"
      role="toolbar"
      :aria-label="t('winterboard.selection.toolbar', 'Selection toolbar')"
      @pointerdown.stop
    >
      <!-- ── Text formatting (only for single text object) ── -->
      <template v-if="isTextSelected">
        <!-- Bold -->
        <button
          type="button"
          class="wb-selection-toolbar__btn"
          :class="{ 'wb-selection-toolbar__btn--active': selectedObject?.fontWeight === 700 }"
          :disabled="isLocked"
          title="Bold"
          @click="$emit('text-format', { fontWeight: selectedObject?.fontWeight === 700 ? 400 : 700 })"
        >
          <strong style="font-size: 14px; font-weight: 800;">B</strong>
        </button>

        <!-- Italic -->
        <button
          type="button"
          class="wb-selection-toolbar__btn"
          :class="{ 'wb-selection-toolbar__btn--active': selectedObject?.fontStyle === 'italic' }"
          :disabled="isLocked"
          title="Italic"
          @click="$emit('text-format', { fontStyle: selectedObject?.fontStyle === 'italic' ? 'normal' : 'italic' })"
        >
          <em style="font-size: 14px;">I</em>
        </button>

        <!-- Divider -->
        <span class="wb-selection-toolbar__divider" />

        <!-- Font size dropdown -->
        <div class="wb-selection-toolbar__size-group">
          <button
            type="button"
            class="wb-selection-toolbar__btn"
            :disabled="isLocked"
            title="Зменшити шрифт"
            @click="changeFontSize(-1)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M3 7h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
          <span class="wb-selection-toolbar__size-label">{{ currentFontSize }}</span>
          <button
            type="button"
            class="wb-selection-toolbar__btn"
            :disabled="isLocked"
            title="Збільшити шрифт"
            @click="changeFontSize(1)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- Divider -->
        <span class="wb-selection-toolbar__divider" />

        <!-- Align left -->
        <button
          type="button"
          class="wb-selection-toolbar__btn"
          :class="{ 'wb-selection-toolbar__btn--active': (selectedObject?.textAlign || 'left') === 'left' }"
          :disabled="isLocked"
          title="Вирівняти ліворуч"
          @click="$emit('text-format', { textAlign: 'left' })"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <rect x="2" y="3" width="12" height="1.5" rx="0.5"/>
            <rect x="2" y="6.5" width="8" height="1.5" rx="0.5"/>
            <rect x="2" y="10" width="12" height="1.5" rx="0.5"/>
          </svg>
        </button>

        <!-- Align center -->
        <button
          type="button"
          class="wb-selection-toolbar__btn"
          :class="{ 'wb-selection-toolbar__btn--active': selectedObject?.textAlign === 'center' }"
          :disabled="isLocked"
          title="Вирівняти по центру"
          @click="$emit('text-format', { textAlign: 'center' })"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <rect x="2" y="3" width="12" height="1.5" rx="0.5"/>
            <rect x="4" y="6.5" width="8" height="1.5" rx="0.5"/>
            <rect x="2" y="10" width="12" height="1.5" rx="0.5"/>
          </svg>
        </button>

        <!-- Divider -->
        <span class="wb-selection-toolbar__divider" />
      </template>

      <!-- ── Common actions ── -->

      <!-- Bring to Front -->
      <button
        type="button"
        class="wb-selection-toolbar__btn"
        :title="t('winterboard.selection.bringToFront')"
        @click="$emit('bring-to-front')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 3v10M4 7l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <!-- Send to Back -->
      <button
        type="button"
        class="wb-selection-toolbar__btn"
        :title="t('winterboard.selection.sendToBack')"
        @click="$emit('send-to-back')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 13V3M4 9l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <!-- Duplicate -->
      <button
        type="button"
        class="wb-selection-toolbar__btn"
        :title="t('winterboard.selection.duplicate')"
        :disabled="isLocked"
        @click="$emit('duplicate')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>

      <!-- Lock / Unlock -->
      <button
        v-if="isLocked"
        type="button"
        class="wb-selection-toolbar__btn"
        :title="t('winterboard.selection.unlock')"
        @click="$emit('unlock')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M5 7V5a3 3 0 016 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
      <button
        v-else
        type="button"
        class="wb-selection-toolbar__btn"
        :title="t('winterboard.selection.lock')"
        @click="$emit('lock')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M5 7V5a3 3 0 116 0v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>

      <!-- Delete -->
      <button
        type="button"
        class="wb-selection-toolbar__btn wb-selection-toolbar__btn--danger"
        :title="t('winterboard.selection.delete')"
        :disabled="isLocked"
        @click="$emit('delete')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2 4h12M5.333 4V2.667A.667.667 0 016 2h4a.667.667 0 01.667.667V4M12.667 4v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <!-- ── Text interaction section (single object, tutor only) ── -->
      <template v-if="showTextSection">
        <span class="wb-selection-toolbar__divider wb-selection-toolbar__divider--text" />

        <div
          class="wb-selection-toolbar__text-group"
          :class="{
            'wb-selection-toolbar__text-group--editing': isEditingInteraction,
            'wb-selection-toolbar__text-group--has-text': hasTextInteraction && !isEditingInteraction,
          }"
        >
          <!-- Idle: no text yet -->
          <template v-if="!hasTextInteraction && !isEditingInteraction">
            <button
              type="button"
              class="wb-selection-toolbar__btn wb-selection-toolbar__btn--text"
              :disabled="isLocked"
              :title="t('winterboard.interactions.addText')"
              @click="startAddInteraction"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <path d="M2 3.5h11M7.5 3.5V12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </template>

          <!-- Has text: Show + Edit + Delete -->
          <template v-else-if="hasTextInteraction && !isEditingInteraction">
            <button
              type="button"
              class="wb-selection-toolbar__btn"
              :title="t('winterboard.interactions.showText')"
              @click="$emit('interaction-preview', selectedObjId, textInteraction!.id)"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" stroke-width="1.4"/>
                <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.4"/>
              </svg>
            </button>
            <button
              type="button"
              class="wb-selection-toolbar__btn"
              :disabled="isLocked"
              :title="t('winterboard.interactions.editText')"
              @click="startEditInteraction(textInteraction!)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M9.5 1.5l3 3-8 8H1.5v-3l8-8z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button
              type="button"
              class="wb-selection-toolbar__btn wb-selection-toolbar__btn--danger"
              :disabled="isLocked"
              :title="t('winterboard.interactions.deleteText')"
              @click="handleDeleteInteraction(textInteraction!.id)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 3.5h10M4.667 3.5V2.333A.667.667 0 015.333 1.667h3.334a.667.667 0 01.666.666V3.5M11 3.5v8a1 1 0 01-1 1H4a1 1 0 01-1-1v-8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </template>

          <!-- Editing: active indicator (click to cancel) -->
          <template v-else>
            <button
              type="button"
              class="wb-selection-toolbar__btn wb-selection-toolbar__btn--text wb-selection-toolbar__btn--active"
              :title="t('winterboard.interactions.cancel')"
              @click="cancelEditInteraction"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                <path d="M2 3.5h11M7.5 3.5V12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </template>
        </div>

        <!-- Floating text editor (below toolbar) -->
        <div v-if="isEditingInteraction" class="wb-selection-toolbar__text-editor" @click.stop @pointerdown.stop>
          <textarea
            ref="interactionTextareaRef"
            v-model="editingText"
            class="wb-selection-toolbar__text-textarea"
            :placeholder="t('winterboard.interactions.textPlaceholder')"
            :maxlength="2000"
            rows="3"
            @keydown.ctrl.enter="saveInteraction"
            @keydown.escape="cancelEditInteraction"
          />
          <div class="wb-selection-toolbar__text-editor-footer">
            <span class="wb-selection-toolbar__char-count">{{ editingText.length }} / 2000</span>
            <button
              type="button"
              class="wb-selection-toolbar__btn--cancel"
              @click="cancelEditInteraction"
            >
              {{ t('winterboard.interactions.cancel') }}
            </button>
            <button
              type="button"
              class="wb-selection-toolbar__btn--save"
              :disabled="!editingText.trim()"
              @click="saveInteraction"
            >
              {{ t('winterboard.interactions.save') }}
            </button>
          </div>
        </div>
      </template>

      <!-- ── Audio section (single object, tutor only) ── -->
      <template v-if="showAudioSection">
        <span class="wb-selection-toolbar__divider wb-selection-toolbar__divider--audio" />

        <div
          class="wb-selection-toolbar__audio-group"
          :class="{
            'wb-selection-toolbar__audio-group--recording': audio.isRecording.value,
            'wb-selection-toolbar__audio-group--uploading': audio.isUploading.value,
            'wb-selection-toolbar__audio-group--has-audio': audio.hasAudio.value && !audio.isRecording.value && !audio.isUploading.value,
          }"
        >
          <!-- Idle: Record button -->
          <template v-if="audio.recordingState.value === 'idle' && !audio.hasAudio.value">
            <button
              type="button"
              class="wb-selection-toolbar__btn wb-selection-toolbar__btn--audio"
              :disabled="isLocked"
              title="Записати аудіо"
              @click="audio.startRecording()"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="5.5" y="1" width="5" height="9" rx="2.5" stroke="currentColor" stroke-width="1.5"/>
                <path d="M3 7a5 5 0 0010 0M8 12v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </template>

          <!-- Recording: Timer + Stop -->
          <template v-else-if="audio.isRecording.value">
            <span class="wb-selection-toolbar__rec-indicator" :class="{ 'wb-selection-toolbar__rec-indicator--warn': audio.isNearLimit.value }" />
            <span class="wb-selection-toolbar__rec-time">{{ audio.formatTime(audio.recordingTime.value) }}</span>
            <button
              type="button"
              class="wb-selection-toolbar__btn wb-selection-toolbar__btn--stop"
              title="Зупинити запис"
              @click="audio.stopRecording()"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                <rect x="2" y="2" width="10" height="10" rx="2"/>
              </svg>
            </button>
          </template>

          <!-- Uploading: progress -->
          <template v-else-if="audio.isUploading.value">
            <span class="wb-selection-toolbar__upload-label">{{ Math.round(audio.uploadProgress.value) }}%</span>
          </template>

          <!-- Has audio: Play/Pause, Re-record, Delete -->
          <template v-else-if="audio.hasAudio.value">
            <button
              type="button"
              class="wb-selection-toolbar__btn"
              :title="audio.isPlaying.value ? 'Пауза' : 'Відтворити'"
              @click="audio.togglePlayback()"
            >
              <svg v-if="!audio.isPlaying.value" width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                <path d="M3 1.5v11l9-5.5z"/>
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
                <rect x="2" y="1" width="3.5" height="12" rx="1"/>
                <rect x="8.5" y="1" width="3.5" height="12" rx="1"/>
              </svg>
            </button>
            <span v-if="selectedObjAudioDuration" class="wb-selection-toolbar__audio-duration">
              {{ audio.formatTime(selectedObjAudioDuration) }}
            </span>
            <button
              type="button"
              class="wb-selection-toolbar__btn"
              :disabled="isLocked"
              title="Перезаписати"
              @click="audio.reRecord()"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1.5 7a5.5 5.5 0 019.78-3.44M12.5 7a5.5 5.5 0 01-9.78 3.44" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <path d="M11.28 1v2.56h-2.56M2.72 13v-2.56h2.56" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button
              type="button"
              class="wb-selection-toolbar__btn wb-selection-toolbar__btn--danger"
              :disabled="isLocked"
              title="Видалити аудіо"
              @click="audio.deleteAudio()"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M2 3.5h10M4.667 3.5V2.333A.667.667 0 015.333 1.667h3.334a.667.667 0 01.666.666V3.5M11 3.5v8a1 1 0 01-1 1H4a1 1 0 01-1-1v-8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </template>

          <!-- Requesting mic -->
          <template v-else-if="audio.recordingState.value === 'requesting_mic'">
            <span class="wb-selection-toolbar__upload-label">...</span>
          </template>
        </div>
      </template>
    </div>
  </Transition>
</template>

<script setup lang="ts">
// WBSelectionToolbar — floating toolbar for selected objects (desktop only)
// Text formatting: Bold, Italic, Font Size, Align — shown when text object selected
// Audio recording: Record, Play, Re-record, Delete — shown for single object (tutor only)

import { computed, ref, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDeviceMode } from '../../composables/useDeviceMode'
import { useObjectAudio, isRecordingSupported } from '../../composables/useObjectAudio'
import type { WBStroke, WBAsset, WBInteraction } from '../../types/winterboard'

// ─── Props ──────────────────────────────────────────────────────────────────

export interface SelectionBBox {
  x: number
  y: number
  w: number
  h: number
}

const FONT_SIZES = [12, 16, 20, 24, 32, 48, 64]

const props = defineProps<{
  selectedIds: string[]
  zoom: number
  canvasRect: DOMRect | null
  mode: 'edit' | 'replay'
  isLocked: boolean
  bbox: SelectionBBox | null
  /** Вибраний об'єкт (для text formatting + audio) */
  selectedObject?: WBStroke | null
  /** Вибраний asset (якщо це asset, а не stroke) */
  selectedAsset?: WBAsset | null
  /** Session ID для audio API */
  sessionId?: string
  /** Чи є поточний користувач тьютором */
  isTutor?: boolean
}>()

const emit = defineEmits<{
  'bring-to-front': []
  'send-to-back': []
  duplicate: []
  lock: []
  unlock: []
  delete: []
  'text-format': [updates: Record<string, unknown>]
  'audio-uploaded': [objectId: string, audioUrl: string, duration: number | null]
  'audio-deleted': [objectId: string]
  'interaction-add': [objectId: string, content: string, label?: string]
  'interaction-update': [objectId: string, interactionId: string, content: string, label?: string]
  'interaction-delete': [objectId: string, interactionId: string]
  'interaction-preview': [objectId: string, interactionId: string]
}>()

// ─── i18n & Device mode ─────────────────────────────────────────────────────

const { t } = useI18n({ useScope: 'global' })
const { deviceMode } = useDeviceMode()

const toolbarRef = ref<HTMLElement | null>(null)

// ─── Text detection ─────────────────────────────────────────────────────────

const isTextSelected = computed(() =>
  props.selectedIds.length === 1 &&
  props.selectedObject?.tool === 'text',
)

const currentFontSize = computed(() =>
  props.selectedObject?.size || 16,
)

function changeFontSize(direction: 1 | -1) {
  const current = currentFontSize.value
  const idx = FONT_SIZES.indexOf(current)

  let newSize: number
  if (idx === -1) {
    const closest = FONT_SIZES.reduce((prev, curr) =>
      Math.abs(curr - current) < Math.abs(prev - current) ? curr : prev,
    )
    const closestIdx = FONT_SIZES.indexOf(closest)
    newSize = FONT_SIZES[Math.max(0, Math.min(FONT_SIZES.length - 1, closestIdx + direction))]
  } else {
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= FONT_SIZES.length) return
    newSize = FONT_SIZES[newIdx]
  }

  emit('text-format', { size: newSize })
}

// ─── Audio ──────────────────────────────────────────────────────────────────

const selectedObjId = computed(() =>
  props.selectedIds.length === 1 ? props.selectedIds[0] : '',
)

const selectedAnyObject = computed<(WBStroke | WBAsset) | null>(() =>
  (props.selectedAsset ?? props.selectedObject) as (WBStroke | WBAsset) | null,
)

const selectedObjAudioUrl = computed(() => selectedAnyObject.value?.audioUrl)
const selectedObjAudioDuration = computed(() => selectedAnyObject.value?.audioDuration)

const audioSessionId = computed(() => props.sessionId ?? '')
const audioObjectId = computed(() => selectedObjId.value)
const audioUrlRef = computed(() => selectedObjAudioUrl.value)
const audioDurationRef = computed(() => selectedObjAudioDuration.value)

const showAudioSection = computed(() =>
  props.isTutor !== false &&
  props.selectedIds.length === 1 &&
  selectedAnyObject.value != null &&
  audioSessionId.value !== '' &&
  isRecordingSupported(),
)

const audio = useObjectAudio({
  sessionId: audioSessionId,
  objectId: audioObjectId,
  audioUrl: audioUrlRef,
  audioDuration: audioDurationRef,
  t,
  onAudioUploaded: (audioUrl: string, duration: number | null) => {
    emit('audio-uploaded', audioObjectId.value, audioUrl, duration)
  },
  onAudioDeleted: () => {
    emit('audio-deleted', audioObjectId.value)
  },
})

// ─── Text interactions ───────────────────────────────────────────────────────

const showTextSection = computed(() =>
  props.isTutor !== false &&
  props.selectedIds.length === 1 &&
  selectedAnyObject.value != null,
)

const objectInteractions = computed<WBInteraction[]>(() =>
  selectedAnyObject.value?.interactions ?? [],
)

const hasTextInteraction = computed(() => objectInteractions.value.length > 0)
const textInteraction = computed<WBInteraction | null>(() => objectInteractions.value[0] ?? null)

// Editing state
const isEditingInteraction = ref(false)
const editingInteractionId = ref<string | null>(null) // null = adding new
const editingText = ref('')
const interactionTextareaRef = ref<HTMLTextAreaElement | null>(null)

function startAddInteraction() {
  editingInteractionId.value = null
  editingText.value = ''
  isEditingInteraction.value = true
  nextTick(() => interactionTextareaRef.value?.focus())
}

function startEditInteraction(inter: WBInteraction) {
  editingInteractionId.value = inter.id
  editingText.value = inter.content
  isEditingInteraction.value = true
  nextTick(() => interactionTextareaRef.value?.focus())
}

function cancelEditInteraction() {
  isEditingInteraction.value = false
  editingInteractionId.value = null
  editingText.value = ''
}

function saveInteraction() {
  const text = editingText.value.trim()
  if (!text) return
  const objId = selectedObjId.value
  if (!objId) return

  if (editingInteractionId.value) {
    emit('interaction-update', objId, editingInteractionId.value, text)
  } else {
    emit('interaction-add', objId, text)
  }

  cancelEditInteraction()
}

function handleDeleteInteraction(interactionId: string) {
  const objId = selectedObjId.value
  if (!objId) return
  emit('interaction-delete', objId, interactionId)
}

// Reset editing when selection changes
watch(selectedObjId, () => {
  cancelEditInteraction()
})

// ─── Visibility ─────────────────────────────────────────────────────────────

const isVisible = computed(() =>
  props.selectedIds.length > 0 &&
  props.mode === 'edit' &&
  (deviceMode.value === 'desktop' || deviceMode.value === 'display'),
)

// ─── Positioning ────────────────────────────────────────────────────────────

const TOOLBAR_HEIGHT = 40
const TOOLBAR_GAP = 8

const positionStyle = computed(() => {
  if (!props.bbox || !props.canvasRect) {
    return { display: 'none' }
  }

  const zoom = props.zoom || 1
  const rect = props.canvasRect

  // Canvas-space bbox → screen-space
  const screenCenterX = rect.left + props.bbox.x * zoom + (props.bbox.w * zoom) / 2
  const screenTopY = rect.top + props.bbox.y * zoom
  const screenBottomY = rect.top + (props.bbox.y + props.bbox.h) * zoom

  // Position toolbar ABOVE selection (less likely to overlap content)
  let top = screenTopY - TOOLBAR_HEIGHT - TOOLBAR_GAP
  let left = screenCenterX

  // Fallback: if toolbar goes above canvas, put it below selection
  if (top < rect.top) {
    top = screenBottomY + TOOLBAR_GAP
  }

  // Clamp to canvas bounds
  top = Math.max(rect.top, Math.min(top, rect.bottom - TOOLBAR_HEIGHT))
  left = Math.max(rect.left + 80, Math.min(left, rect.right - 80))

  return {
    position: 'fixed' as const,
    top: `${top}px`,
    left: `${left}px`,
    transform: 'translateX(-50%)',
    zIndex: 50,
  }
})
</script>

<style scoped>
.wb-selection-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: rgba(30, 41, 59, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
}

.wb-selection-toolbar__btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #e2e8f0;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.wb-selection-toolbar__btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.wb-selection-toolbar__btn:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.wb-selection-toolbar__btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.wb-selection-toolbar__btn--active {
  background: rgba(99, 102, 241, 0.6) !important;
  color: #ffffff !important;
}

.wb-selection-toolbar__btn--danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.wb-selection-toolbar__btn--audio {
  color: #a78bfa;
}
.wb-selection-toolbar__btn--audio:hover:not(:disabled) {
  background: rgba(167, 139, 250, 0.2);
  color: #c4b5fd;
}

/* ── Audio group container ──────────────────────────────────────────────── */

.wb-selection-toolbar__audio-group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  border-radius: 6px;
  background: rgba(167, 139, 250, 0.1);
  transition: background 0.2s ease;
}

.wb-selection-toolbar__audio-group--recording {
  background: rgba(239, 68, 68, 0.12);
}

.wb-selection-toolbar__audio-group--uploading {
  background: rgba(96, 165, 250, 0.12);
}

.wb-selection-toolbar__audio-group--has-audio {
  background: rgba(52, 211, 153, 0.1);
}

.wb-selection-toolbar__btn--stop {
  color: #ef4444;
}
.wb-selection-toolbar__btn--stop:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

/* ── Divider ────────────────────────────────────────────────────────────── */

.wb-selection-toolbar__divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 2px;
  flex-shrink: 0;
}

/* ── Font size group ────────────────────────────────────────────────────── */

.wb-selection-toolbar__size-group {
  display: flex;
  align-items: center;
  gap: 0;
}

.wb-selection-toolbar__size-label {
  min-width: 28px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #e2e8f0;
  user-select: none;
}

/* ── Audio recording indicator ──────────────────────────────────────────── */

.wb-selection-toolbar__rec-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  flex-shrink: 0;
  animation: wb-rec-pulse 1s infinite;
}

.wb-selection-toolbar__rec-indicator--warn {
  background: #f59e0b;
  animation: wb-rec-pulse 0.5s infinite;
}

@keyframes wb-rec-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.wb-selection-toolbar__rec-time {
  font-size: 12px;
  font-weight: 600;
  color: #fca5a5;
  font-variant-numeric: tabular-nums;
  min-width: 32px;
  text-align: center;
}

.wb-selection-toolbar__upload-label {
  font-size: 11px;
  font-weight: 600;
  color: #93c5fd;
  min-width: 28px;
  text-align: center;
}

.wb-selection-toolbar__audio-duration {
  font-size: 11px;
  font-weight: 500;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
  min-width: 28px;
  text-align: center;
}

/* ── Divider accent colors ────────────────────────────────────────────────── */

.wb-selection-toolbar__divider--audio {
  background: rgba(167, 139, 250, 0.4);
}

.wb-selection-toolbar__divider--text {
  background: rgba(99, 102, 241, 0.4);
}

/* ── Text group container ─────────────────────────────────────────────────── */

.wb-selection-toolbar__text-group {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  border-radius: 6px;
  background: rgba(99, 102, 241, 0.1);
  transition: background 0.2s ease;
}

.wb-selection-toolbar__text-group--editing {
  background: rgba(99, 102, 241, 0.18);
}

.wb-selection-toolbar__text-group--has-text {
  background: rgba(99, 102, 241, 0.12);
}

.wb-selection-toolbar__btn--text {
  color: #a5b4fc;
}
.wb-selection-toolbar__btn--text:hover:not(:disabled) {
  background: rgba(99, 102, 241, 0.2);
  color: #c7d2fe;
}

/* ── Text floating editor ─────────────────────────────────────────────────── */

.wb-selection-toolbar__text-editor {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(30, 41, 59, 0.97);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  padding: 8px;
  width: 280px;
  z-index: 55;
}

.wb-selection-toolbar__text-textarea {
  width: 100%;
  min-height: 64px;
  max-height: 160px;
  resize: vertical;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: #e2e8f0;
  font-size: 13px;
  line-height: 1.4;
  padding: 8px;
  font-family: inherit;
  box-sizing: border-box;
}

.wb-selection-toolbar__text-textarea::placeholder {
  color: #64748b;
}

.wb-selection-toolbar__text-textarea:focus {
  outline: none;
  border-color: rgba(99, 102, 241, 0.5);
}

.wb-selection-toolbar__text-editor-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 6px;
}

.wb-selection-toolbar__char-count {
  font-size: 11px;
  color: #64748b;
  margin-right: auto;
  font-variant-numeric: tabular-nums;
}

.wb-selection-toolbar__btn--save {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 600;
  background: #6366f1;
  color: #fff;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: background 0.12s;
}
.wb-selection-toolbar__btn--save:hover:not(:disabled) {
  background: #4f46e5;
}
.wb-selection-toolbar__btn--save:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.wb-selection-toolbar__btn--cancel {
  padding: 4px 8px;
  font-size: 12px;
  color: #94a3b8;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 4px;
}
.wb-selection-toolbar__btn--cancel:hover {
  color: #e2e8f0;
  background: rgba(255, 255, 255, 0.08);
}

/* ── Fade transition ──────────────────────────────────────────────────────── */

.wb-sel-toolbar-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.wb-sel-toolbar-leave-active {
  transition: opacity 0.1s ease;
}
.wb-sel-toolbar-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}
.wb-sel-toolbar-leave-to {
  opacity: 0;
}
</style>

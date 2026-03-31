<template>
  <div class="audio-annotation-panel">
    <h4 class="audio-annotation-panel__title">
      {{ t('winterboard.objectAudio.sidebarTitle') }}
    </h4>

    <!-- No audio state -->
    <template v-if="!hasAudio && !isRecording && !isUploading">
      <p class="audio-annotation-panel__empty">
        {{ t('winterboard.objectAudio.noAudio') }}
      </p>
      <button
        class="audio-annotation-panel__btn audio-annotation-panel__btn--primary"
        :disabled="!recordingSupported"
        @click="audio.startRecording()"
      >
        🎤 {{ t('winterboard.objectAudio.record') }}
      </button>
      <span class="audio-annotation-panel__limit-hint">
        {{ t('winterboard.objectAudio.limitHint', { maxSec: audio.maxDuration, maxMB: audio.maxSizeMB.value }) }}
      </span>
    </template>

    <!-- Recording state -->
    <template v-if="isRecording">
      <div class="audio-annotation-panel__recording">
        <span
          class="audio-annotation-panel__timer"
          :class="{ 'audio-annotation-panel__timer--warning': audio.isNearLimit.value }"
        >
          {{ audio.isNearLimit.value ? '⚠️' : '🔴' }}
          {{ audio.formatTime(audio.recordingTime.value) }} / {{ audio.formatTime(audio.maxDuration) }}
        </span>
        <button
          class="audio-annotation-panel__btn"
          @click="audio.stopRecording()"
        >
          ⏹ {{ t('winterboard.objectAudio.stop') }}
        </button>
      </div>
    </template>

    <!-- Uploading state -->
    <template v-if="isUploading">
      <div class="audio-annotation-panel__uploading">
        <span>{{ t('winterboard.objectAudio.uploading') }} {{ audio.uploadProgress.value }}%</span>
        <div class="audio-annotation-panel__progress">
          <div
            class="audio-annotation-panel__progress-fill"
            :style="{ width: `${audio.uploadProgress.value}%` }"
          />
        </div>
      </div>
    </template>

    <!-- Has audio: playback + actions -->
    <template v-if="hasAudio && !isRecording && !isUploading">
      <div class="audio-annotation-panel__playback">
        <button
          class="audio-annotation-panel__btn audio-annotation-panel__btn--play"
          @click="audio.togglePlayback()"
        >
          {{ audio.isPlaying.value ? '⏸' : '▶' }}
        </button>
        <span class="audio-annotation-panel__duration">
          {{ audio.formatTime(audioDurationValue) }}
        </span>
      </div>
      <div class="audio-annotation-panel__actions">
        <button
          class="audio-annotation-panel__btn"
          @click="audio.reRecord()"
        >
          🔄 {{ t('winterboard.objectAudio.reRecord') }}
        </button>
        <button
          class="audio-annotation-panel__btn audio-annotation-panel__btn--danger"
          @click="audio.deleteAudio()"
        >
          🗑 {{ t('winterboard.objectAudio.delete') }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
// WB: AudioAnnotationPanel — sidebar secondary entry point for Object Audio.
// Ref: OBJECT_AUDIO_PLAN.md §5.5
// Shows recording/playback controls in the properties sidebar.

import { computed, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useObjectAudio, isRecordingSupported } from '../../composables/useObjectAudio'
import type { WBStroke, WBAsset } from '../../types/winterboard'

interface Props {
  object: WBStroke | WBAsset
  sessionId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'audio-uploaded': [audioUrl: string, duration: number | null]
  'audio-deleted': []
}>()

const { t } = useI18n()

const objectId = computed(() => props.object.id)

const audioUrl = computed(() =>
  (props.object as WBStroke).audioUrl ?? (props.object as WBAsset).audioUrl,
)

const audioDuration = computed(() =>
  (props.object as WBStroke).audioDuration ?? (props.object as WBAsset).audioDuration,
)

const audioDurationValue = computed(() => audioDuration.value ?? 0)

const recordingSupported = isRecordingSupported()

const audio = useObjectAudio({
  sessionId: toRef(props, 'sessionId'),
  objectId,
  audioUrl,
  audioDuration,
  t: (key: string, params?: Record<string, unknown>) =>
    t(`winterboard.${key}`, params ?? {}),
  onAudioUploaded: (url, dur) => emit('audio-uploaded', url, dur),
  onAudioDeleted: () => emit('audio-deleted'),
})

const hasAudio = audio.hasAudio
const isRecording = audio.isRecording
const isUploading = audio.isUploading
</script>

<style scoped>
.audio-annotation-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
  border-top: 1px solid #e5e7eb;
}

.audio-annotation-panel__title {
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.audio-annotation-panel__empty {
  font-size: 13px;
  color: #9ca3af;
  margin: 0;
}

.audio-annotation-panel__limit-hint {
  font-size: 11px;
  color: #9ca3af;
}

.audio-annotation-panel__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.audio-annotation-panel__btn:hover {
  background: #f9fafb;
}

.audio-annotation-panel__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.audio-annotation-panel__btn--primary {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.audio-annotation-panel__btn--primary:hover {
  background: #2563eb;
}

.audio-annotation-panel__btn--play {
  width: 36px;
  height: 36px;
  padding: 0;
  justify-content: center;
  font-size: 16px;
  border-radius: 50%;
}

.audio-annotation-panel__btn--danger {
  color: #dc2626;
  border-color: #fca5a5;
}

.audio-annotation-panel__btn--danger:hover {
  background: #fef2f2;
}

.audio-annotation-panel__recording {
  display: flex;
  align-items: center;
  gap: 8px;
}

.audio-annotation-panel__timer {
  font-size: 14px;
  font-weight: 600;
  color: #ef4444;
  font-variant-numeric: tabular-nums;
  animation: sidebar-pulse 1s ease-in-out infinite;
}

.audio-annotation-panel__timer--warning {
  color: #dc2626;
  font-weight: 700;
  animation: sidebar-pulse 0.5s ease-in-out infinite;
}

@keyframes sidebar-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.audio-annotation-panel__uploading {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: #3b82f6;
}

.audio-annotation-panel__progress {
  width: 100%;
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
}

.audio-annotation-panel__progress-fill {
  height: 100%;
  background: #3b82f6;
  border-radius: 2px;
  transition: width 0.15s ease-out;
}

.audio-annotation-panel__playback {
  display: flex;
  align-items: center;
  gap: 8px;
}

.audio-annotation-panel__duration {
  font-size: 14px;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
}

.audio-annotation-panel__actions {
  display: flex;
  gap: 6px;
}
</style>

<!--
  WBVideoRecordButton — кнопка запису Winterboard canvas як відео → Publisher.
  Ref: saas_docs/plans/FUTURE_WORK_PLAN_2026-05-30.md Phase 2

  Стани:
    idle      → кнопка "🎥 Записати"
    recording → REC dot + таймер + "Стоп"
    uploading → spinner + "Завантажую…"
    done      → "✅ У Publisher" (посилання)
    error     → "⚠ Помилка" + скинути
-->
<template>
  <!-- idle -->
  <button
    v-if="recording.state.value === 'idle'"
    type="button"
    class="wb-record-btn wb-record-btn--idle"
    title="Записати canvas як відео → Publisher"
    @click="recording.startRecording(captionLabel)"
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.4"/>
      <circle cx="7" cy="7" r="2.5" fill="currentColor"/>
    </svg>
    <span class="wb-record-btn__label">Записати</span>
  </button>

  <!-- recording -->
  <button
    v-else-if="recording.state.value === 'recording'"
    type="button"
    class="wb-record-btn wb-record-btn--recording"
    title="Зупинити запис"
    @click="recording.stopRecording()"
  >
    <span class="wb-record-btn__dot" aria-hidden="true" />
    <span class="wb-record-btn__timer">{{ formattedElapsed }}</span>
    <span class="wb-record-btn__label">Стоп</span>
  </button>

  <!-- uploading -->
  <span
    v-else-if="recording.state.value === 'uploading'"
    class="wb-record-btn wb-record-btn--uploading"
    aria-live="polite"
  >
    <svg class="wb-record-btn__spinner" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.4" stroke-dasharray="20" stroke-dashoffset="7" />
    </svg>
    <span class="wb-record-btn__label">Завантаження…</span>
  </span>

  <!-- done -->
  <a
    v-else-if="recording.state.value === 'done' && recording.result.value"
    :href="recording.result.value.publisherUrl"
    target="_blank"
    rel="noopener noreferrer"
    class="wb-record-btn wb-record-btn--done"
    :title="`Publisher: ${recording.result.value.publisherUrl}`"
    @click.stop
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 7.5l3 3 6-6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span class="wb-record-btn__label">У Publisher</span>
  </a>
  <!-- done: reset back to idle -->
  <button
    v-if="recording.state.value === 'done'"
    type="button"
    class="wb-record-btn wb-record-btn--reset"
    title="Записати ще раз"
    @click="recording.reset()"
  >
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M1 6a5 5 0 1 0 1-2.9M1 2v3h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>

  <!-- error -->
  <button
    v-else-if="recording.state.value === 'error'"
    type="button"
    class="wb-record-btn wb-record-btn--error"
    :title="recording.error.value ?? 'Помилка запису'"
    @click="recording.reset()"
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.4"/>
      <path d="M7 4v4M7 9.5v.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
    </svg>
    <span class="wb-record-btn__label">Помилка</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCanvasRecording } from '../composables/useCanvasRecording'
import type Konva from 'konva'

// ─── Props ───────────────────────────────────────────────────────────────────

const props = withDefaults(defineProps<{
  /** Функція що повертає Konva Stage — з canvasRef.getStage() */
  getStage: () => Konva.Stage | null
  /** Caption для Publisher (необов'язково) */
  caption?: string
}>(), {
  caption: '',
})

// ─── Composable ──────────────────────────────────────────────────────────────

const recording = useCanvasRecording(props.getStage)

// ─── Caption з датою якщо не задано ──────────────────────────────────────────

const captionLabel = computed(() => {
  if (props.caption) return props.caption
  const d = new Date()
  return `Запис Winterboard ${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

// ─── Форматований таймер MM:SS ────────────────────────────────────────────────

const formattedElapsed = computed(() => {
  const s = recording.elapsed.value
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
})
</script>

<style scoped>
/* Базова кнопка — адаптується до .wb-header-btn стилів батька */
.wb-record-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  text-decoration: none;
  transition: background 0.12s, color 0.12s, opacity 0.12s;
  white-space: nowrap;
  line-height: 1;
}

/* ── Idle ── */
.wb-record-btn--idle {
  background: rgba(255, 255, 255, 0.08);
  color: #e2e8f0;
}
.wb-record-btn--idle:hover {
  background: rgba(239, 68, 68, 0.25);
  color: #fca5a5;
}

/* ── Recording ── */
.wb-record-btn--recording {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.4);
}
.wb-record-btn--recording:hover {
  background: rgba(239, 68, 68, 0.35);
  color: #fff;
}

/* REC dot — мигає */
.wb-record-btn__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  animation: wb-rec-blink 1s step-start infinite;
  flex-shrink: 0;
}
@keyframes wb-rec-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.2; }
}

.wb-record-btn__timer {
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  color: #fca5a5;
  min-width: 32px;
}

/* ── Uploading ── */
.wb-record-btn--uploading {
  background: rgba(99, 102, 241, 0.15);
  color: #a5b4fc;
  cursor: default;
  user-select: none;
}

.wb-record-btn__spinner {
  animation: wb-spin 0.8s linear infinite;
}
@keyframes wb-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* ── Done ── */
.wb-record-btn--done {
  background: rgba(16, 185, 129, 0.15);
  color: #6ee7b7;
}
.wb-record-btn--done:hover {
  background: rgba(16, 185, 129, 0.25);
  color: #fff;
}

/* Reset (поруч з done) */
.wb-record-btn--reset {
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
  padding: 5px 7px;
}
.wb-record-btn--reset:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #e2e8f0;
}

/* ── Error ── */
.wb-record-btn--error {
  background: rgba(239, 68, 68, 0.12);
  color: #fca5a5;
}
.wb-record-btn--error:hover {
  background: rgba(239, 68, 68, 0.22);
}

.wb-record-btn__label {
  font-size: 12px;
}
</style>

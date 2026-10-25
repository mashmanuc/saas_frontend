<template>
  <section class="sentence-controls" data-testid="remote-sentence">
    <strong>{{ t('winterboard.remote.sentence.title') }}</strong>
    <div class="sentence-controls__words">
      <button v-for="word in sentence.words" :key="word.id" :data-word-id="word.id" :aria-pressed="selected === word.id"
        :disabled="!ready || !!pending" @click="selected = word.id">{{ word.text }}</button>
    </div>
    <button data-testid="sentence-word" :disabled="!ready || !selected || !!pending" @click="changeWord">
      {{ t(selectedHidden ? 'winterboard.remote.sentence.showWord' : 'winterboard.remote.sentence.hideWord') }}
    </button>
    <button data-testid="sentence-punctuation" :disabled="!ready || !!pending" @click="sendAction({ action: 'set_punctuation', hidden: !sentence.punct })">
      {{ t(sentence.punct ? 'winterboard.remote.sentence.showPunct' : 'winterboard.remote.sentence.hidePunct') }}
    </button>
    <button data-testid="sentence-restore" :disabled="!ready || !!pending" @click="sendAction({ action: 'restore' })">
      {{ t('winterboard.remote.sentence.restore') }}
    </button>
    <p v-if="notice" role="status">{{ notice }}</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RemoteSentence, SentenceRequest, SentenceResult } from '../../remote/dictationLineContract'

type Action = { action: 'set_word'; token_id: string; hidden: boolean } | { action: 'set_punctuation'; hidden: boolean } | { action: 'restore' }
const props = defineProps<{ sentence: RemoteSentence; result: SentenceResult | null; ready: boolean; send: (request: SentenceRequest) => boolean }>()
const { t } = useI18n()
const selected = ref<string | null>(null), pending = ref<string | null>(null), notice = ref('')
let timeout: ReturnType<typeof setTimeout> | null = null
function clearTimer() { if (timeout) clearTimeout(timeout); timeout = null }
const selectedHidden = computed(() => props.sentence.words.find((w) => w.id === selected.value)?.hidden === true)
watch(() => `${props.sentence.page_id}:${props.sentence.object_id}:${props.sentence.source_revision}`, () => { selected.value = null; pending.value = null; notice.value = ''; clearTimer() })
watch(() => props.result, (result) => {
  if (!result || result.request_id !== pending.value) return
  clearTimer(); pending.value = null
  // Відмова — з причиною (маніфест П5 «не тиша»): що сталося і що зробити
  notice.value = result.status === 'done'
    ? t('winterboard.remote.sentence.done')
    : t(`winterboard.remote.sentence.reason.${result.reason ?? 'blocked'}`)
})
function changeWord() {
  if (selected.value) sendAction({ action: 'set_word', token_id: selected.value, hidden: !selectedHidden.value })
}
function sendAction(action: Action) {
  if (!props.ready || pending.value) return
  const request = { ...action, request_id: crypto.randomUUID(), page_id: props.sentence.page_id,
    object_id: props.sentence.object_id, source_revision: props.sentence.source_revision } as SentenceRequest
  pending.value = request.request_id; notice.value = t('winterboard.remote.sentence.working')
  if (!props.send(request)) { pending.value = null; notice.value = t('winterboard.remote.sentence.noConnection'); return }
  // Лише відображення непідтвердженого результату, без повтору запиту/зміни дошки.
  timeout = setTimeout(() => { pending.value = null; notice.value = t('winterboard.remote.sentence.noAnswer') }, 8000)
}
onUnmounted(clearTimer)
</script>

<style scoped>
/* Кольори — з темного пульта (`.wb-remote` у WBRemoteView), як у вікні диктанту; світла панель випадала з пульта */
.sentence-controls { padding: 12px; margin: 10px 0; background: var(--surface, #1e293b); color: var(--text, #f8fafc);
  border: 1px solid var(--line, #334155); border-radius: 12px; }
.sentence-controls__words { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
button { min-height: 42px; margin: 3px; padding: 7px 12px; border: 1px solid var(--line, #334155); border-radius: 10px;
  color: var(--text, #f8fafc); background: var(--surface-2, #334155); font-weight: 600; }
button[aria-pressed="true"] { background: #1e3a8a; border-color: var(--accent, #2563eb); }
button:disabled { opacity: .5; }
p[role="status"] { margin: 8px 0 0; color: var(--muted, #94a3b8); }
</style>

<template>
  <section class="sentence-controls" data-testid="remote-sentence">
    <strong>{{ t('winterboard.remote.sentence.title') }}</strong>
    <!-- v1.76: увесь текст речення; помилку на дошці виправляють тут — дошка переписує речення на тому самому місці -->
    <template v-if="sentence.text !== undefined">
      <p v-if="!editing" class="sentence-controls__text" data-testid="sentence-text">{{ sentence.text }}</p>
      <textarea v-else v-model="draft" class="sentence-controls__draft" data-testid="sentence-draft" rows="4" maxlength="300"
        :readonly="!!pending" />
      <div class="sentence-controls__edit">
        <button v-if="!editing" data-testid="sentence-edit" :disabled="!ready || !!pending" @click="startEdit">
          ✏️ {{ t('winterboard.remote.sentence.edit') }}
        </button>
        <template v-else>
          <button data-testid="sentence-rewrite" :disabled="!ready || !!pending || !draftChanged" @click="rewrite">
            {{ t('winterboard.remote.sentence.rewrite') }}
          </button>
          <button data-testid="sentence-cancel" :disabled="!!pending" @click="editing = false">
            {{ t('winterboard.remote.sentence.cancel') }}
          </button>
        </template>
      </div>
    </template>
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
import { normalizeDictation } from '../../remote/dictationContract'

type Action = { action: 'set_word'; token_id: string; hidden: boolean } | { action: 'set_punctuation'; hidden: boolean } | { action: 'restore' }
  | { action: 'set_text'; text: string }
const props = defineProps<{ sentence: RemoteSentence; result: SentenceResult | null; ready: boolean; send: (request: SentenceRequest) => boolean }>()
const { t } = useI18n()
const selected = ref<string | null>(null), pending = ref<string | null>(null), notice = ref('')
let timeout: ReturnType<typeof setTimeout> | null = null
function clearTimer() { if (timeout) clearTimeout(timeout); timeout = null }
const selectedHidden = computed(() => props.sentence.words.find((w) => w.id === selected.value)?.hidden === true)
// v1.76: виправлення тексту
const editing = ref(false), draft = ref('')
/** Речення, яке переписуємо: його новий стан (інший текст) прийде раніше за відповідь — не скидаємо очікування. */
let rewritingId: string | null = null
const draftChanged = computed(() => !!normalizeDictation(draft.value) && normalizeDictation(draft.value) !== props.sentence.text)
function startEdit() { draft.value = props.sentence.text ?? ''; editing.value = true; notice.value = '' }
function rewrite() { if (draftChanged.value) sendAction({ action: 'set_text', text: normalizeDictation(draft.value) }) }
watch(() => `${props.sentence.page_id}:${props.sentence.object_id}:${props.sentence.source_revision}`, () => {
  if (pending.value && rewritingId === props.sentence.object_id) return
  selected.value = null; pending.value = null; notice.value = ''; editing.value = false; rewritingId = null; clearTimer()
})
watch(() => props.result, (result) => {
  if (!result || result.request_id !== pending.value) return
  clearTimer(); pending.value = null
  if (rewritingId && result.status === 'done') editing.value = false
  rewritingId = null
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
  rewritingId = action.action === 'set_text' ? props.sentence.object_id : null
  if (!props.send(request)) { pending.value = null; rewritingId = null; notice.value = t('winterboard.remote.sentence.noConnection'); return }
  // Лише відображення непідтвердженого результату, без повтору запиту/зміни дошки.
  timeout = setTimeout(() => { pending.value = null; rewritingId = null; notice.value = t('winterboard.remote.sentence.noAnswer') }, 8000)
}
onUnmounted(clearTimer)
</script>

<style scoped>
/* Кольори — з темного пульта (`.wb-remote` у WBRemoteView), як у вікні диктанту; світла панель випадала з пульта */
.sentence-controls { padding: 12px; margin: 10px 0; background: var(--surface, #1e293b); color: var(--text, #f8fafc);
  border: 1px solid var(--line, #334155); border-radius: 12px; }
.sentence-controls__words { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.sentence-controls__text { margin: 8px 0; font-size: 17px; line-height: 1.4; white-space: pre-wrap; }
.sentence-controls__draft { width: 100%; margin: 8px 0 4px; padding: 10px; border: 1px solid var(--line, #334155); border-radius: 10px;
  background: var(--bg, #0f172a); color: var(--text, #f8fafc); font-size: 17px; line-height: 1.4; }
.sentence-controls__edit { display: flex; flex-wrap: wrap; gap: 6px; }
button { min-height: 42px; margin: 3px; padding: 7px 12px; border: 1px solid var(--line, #334155); border-radius: 10px;
  color: var(--text, #f8fafc); background: var(--surface-2, #334155); font-weight: 600; }
button[aria-pressed="true"] { background: #1e3a8a; border-color: var(--accent, #2563eb); }
button:disabled { opacity: .5; }
p[role="status"] { margin: 8px 0 0; color: var(--muted, #94a3b8); }
</style>

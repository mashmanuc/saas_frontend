<template>
  <section class="sentence-controls" data-testid="remote-sentence">
    <strong>Речення — виберіть слово</strong>
    <div class="sentence-controls__words">
      <button v-for="word in sentence.words" :key="word.id" :data-word-id="word.id" :aria-pressed="selected === word.id"
        :disabled="!ready || !!pending" @click="selected = word.id">{{ word.text }}</button>
    </div>
    <button data-testid="sentence-word" :disabled="!ready || !selected || !!pending" @click="changeWord">{{ selectedHidden ? 'Показати слово' : 'Сховати слово' }}</button>
    <button data-testid="sentence-punctuation" :disabled="!ready || !!pending" @click="sendAction({ action: 'set_punctuation', hidden: !sentence.punct })">{{ sentence.punct ? 'Показати пунктуацію' : 'Сховати пунктуацію' }}</button>
    <button data-testid="sentence-restore" :disabled="!ready || !!pending" @click="sendAction({ action: 'restore' })">Повернути оригінал</button>
    <p v-if="notice" role="status">{{ notice }}</p>
  </section>
</template>
<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import type { RemoteSentence, SentenceRequest, SentenceResult } from '../../remote/dictationLineContract'
type Action = { action: 'set_word'; token_id: string; hidden: boolean } | { action: 'set_punctuation'; hidden: boolean } | { action: 'restore' }
const props = defineProps<{ sentence: RemoteSentence; result: SentenceResult | null; ready: boolean; send: (request: SentenceRequest) => boolean }>()
const selected = ref<string | null>(null), pending = ref<string | null>(null), notice = ref('')
let timeout: ReturnType<typeof setTimeout> | null = null
function clearTimer() { if (timeout) clearTimeout(timeout); timeout = null }
const selectedHidden = computed(() => props.sentence.words.find((w) => w.id === selected.value)?.hidden === true)
watch(() => `${props.sentence.page_id}:${props.sentence.object_id}:${props.sentence.source_revision}`, () => { selected.value = null; pending.value = null; notice.value = ''; clearTimer() })
watch(() => props.result, (result) => {
  if (!result || result.request_id !== pending.value) return
  clearTimer(); pending.value = null
  notice.value = result.status === 'done' ? 'Дію виконано.' : 'Дію не виконано. Виберіть речення знову.'
})
function changeWord() {
  if (selected.value) sendAction({ action: 'set_word', token_id: selected.value, hidden: !selectedHidden.value })
}
function sendAction(action: Action) {
  if (!props.ready || pending.value) return
  const request = { ...action, request_id: crypto.randomUUID(), page_id: props.sentence.page_id,
    object_id: props.sentence.object_id, source_revision: props.sentence.source_revision } as SentenceRequest
  pending.value = request.request_id; notice.value = 'Виконуємо…'
  if (!props.send(request)) { pending.value = null; notice.value = 'Немає зв’язку з дошкою.'; return }
  // Лише відображення непідтвердженого результату, без повтору запиту/зміни дошки.
  timeout = setTimeout(() => { pending.value = null; notice.value = 'Відповідь не надійшла. Перевірте зв’язок.' }, 8000)
}
onUnmounted(clearTimer)
</script>
<style scoped>
.sentence-controls { padding: 12px; margin: 10px 0; background: #fff; border: 1px solid #8ecbb8; border-radius: 10px; }
.sentence-controls__words { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
button { min-height: 42px; margin: 3px; padding: 7px 10px; border: 1px solid #94a3b8; border-radius: 6px; color: #065f46; background: #f0fdf4; }
button[aria-pressed="true"] { background: #a7f3d0; border-color: #047857; }
button:disabled { opacity: .5; }
</style>

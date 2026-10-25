<template>
  <section class="language-analysis" data-testid="sentence-analysis">
    <strong>Мовний розбір</strong>
    <div class="language-analysis__buttons">
      <button v-for="(title, kind) in titles" :key="kind" :data-analysis-kind="kind" :disabled="!ready || busy || !!pending" @click="prepare(kind)">{{ title }}</button>
    </div>
    <details>
      <summary>Прибрати позначки без нового аналізу</summary>
      <button v-for="(title, kind) in titles" :key="kind" type="button" :data-clear-kind="kind" :disabled="!ready || busy || !!pending" @click="submit([], kind)">Прибрати: {{ title }}</button>
    </details>
    <p v-if="busy" role="status">Готуємо чернетку. На дошці нічого не змінюється.</p>
    <form v-if="draft" data-testid="analysis-review" @submit.prevent="confirm">
      <strong>Перевірте перед показом класу</strong>
      <p class="language-analysis__text">{{ draft.text }}</p>
      <p>Це пропозиція Інтегралика, не перевірений еталон. Виправте неточності.</p>
      <template v-if="draft.kind === 'orthograms'">
        <div v-for="(item, i) in orthograms" :key="i" class="language-analysis__row">
          <label>Від літери № <input v-model.number="item.start" type="number" min="0" :max="Array.from(draft.text).length - 1" /></label>
          <label>До (не включно) <input v-model.number="item.end" type="number" min="1" :max="Array.from(draft.text).length" /></label>
          <q>{{ Array.from(draft.text).slice(item.start, item.end).join('') }}</q>
          <input v-model="item.rule" aria-label="Правило орфограми" maxlength="200" placeholder="Назва правила" />
          <button type="button" @click="draft.items.splice(i, 1)">Прибрати</button>
        </div>
        <p v-if="!orthograms.length">Орфограм не позначено. Можна додати вручну.</p>
        <button type="button" data-testid="analysis-add" :disabled="orthograms.length >= 40" @click="addOrthogram">Додати орфограму</button>
      </template>
      <div v-else v-for="token in draft.tokens" :key="token.id" class="language-analysis__row">
        <span>{{ token.text }}</span>
        <select v-if="draft.kind === 'basis'" :aria-label="`Роль: ${token.text} (${token.id})`" :value="basis.find(item => item.token_id === token.id)?.role ?? ''" @change="setBasis(token.id, ($event.target as HTMLSelectElement).value)">
          <option value="">Не позначати</option><option value="subject">Підмет — одна риска</option><option value="predicate">Присудок — дві риски</option>
        </select>
        <select v-else :aria-label="`Частина мови: ${token.text} (${token.id})`" :value="parts.find(item => item.token_id === token.id)?.pos" @change="setPart(token.id, ($event.target as HTMLSelectElement).value)">
          <option v-for="(title, key) in partNames" :key="key" :value="key">{{ title }}</option>
        </select>
      </div>
      <div class="language-analysis__buttons">
        <button type="submit" data-testid="analysis-confirm" :disabled="!ready || !!pending">Показати на дошці</button>
        <button type="button" data-testid="analysis-cancel" @click="cancel">Скасувати</button>
        <button type="button" data-testid="analysis-clear" :disabled="!ready || !!pending" @click="submit([])">Прибрати цей шар</button>
      </div>
    </form>
    <button v-if="busy" type="button" @click="cancel">Скасувати очікування</button>
    <p v-if="notice" role="status">{{ notice }}</p>
  </section>
</template>
<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { requestAnalysis, readAnalysisDraft, type AnalysisDraft, type AnalysisTarget } from '../../api/dictationAnalysis'
import { assertAnalysisItems, type AnalysisKind, type AnalysisItem, type Orthogram, type Basis, type Part, type Pos } from '../../board/dictationAnalysis'
import type { RemoteSentence, SentenceRequest, SentenceResult } from '../../remote/dictationLineContract'
const props = defineProps<{ boardId: string; sentence: RemoteSentence; result: SentenceResult | null; ready: boolean;
  send: (request: SentenceRequest) => boolean; request?: (target: AnalysisTarget, signal: AbortSignal) => Promise<AnalysisDraft> }>()
const titles = { orthograms: 'Орфограми', basis: 'Підмет і присудок', parts: 'Частини мови' }
const partNames: Record<Pos, string> = { noun: 'Іменник', adjective: 'Прикметник', numeral: 'Числівник', pronoun: 'Займенник',
  verb: 'Дієслово', adverb: 'Прислівник', preposition: 'Прийменник', conjunction: 'Сполучник', particle: 'Частка', interjection: 'Вигук', unclassified: 'Не визначено' }
const draft = ref<AnalysisDraft | null>(null), busy = ref(false), pending = ref<string | null>(null), notice = ref('')
const orthograms = computed(() => (draft.value?.items ?? []) as Orthogram[])
const basis = computed(() => (draft.value?.items ?? []) as Basis[])
const parts = computed(() => (draft.value?.items ?? []) as Part[])
let generation = 0, controller: AbortController | null = null, timer: ReturnType<typeof setTimeout> | null = null
const address = () => `${props.boardId}:${props.sentence.page_id}:${props.sentence.object_id}:${props.sentence.source_revision}`
function clearTimer() { if (timer) clearTimeout(timer); timer = null }
function cancel() { generation++; controller?.abort(); controller = null; busy.value = false; draft.value = null; notice.value = '' }
watch(address, () => { cancel(); pending.value = null; clearTimer() })
watch(() => props.result, (r) => {
  if (!r || r.request_id !== pending.value) return
  clearTimer(); pending.value = null
  notice.value = r.status === 'done' ? 'Позначки застосовано. Збереження — за індикатором дошки.' : 'Позначки не застосовано. Перевірте вибране речення.'
  if (r.status === 'done') draft.value = null
})
async function prepare(kind: AnalysisKind) {
  if (!props.ready || busy.value || pending.value) return
  const current = ++generation, target = address()
  controller = new AbortController(); busy.value = true; draft.value = null; notice.value = ''
  const request = { board_id: props.boardId, page_id: props.sentence.page_id, object_id: props.sentence.object_id, source_revision: props.sentence.source_revision, kind }
  try {
    const response = await (props.request ?? requestAnalysis)(request, controller.signal)
    if (generation !== current || address() !== target) return
    draft.value = readAnalysisDraft(response, request)
  } catch (error) {
    if (generation === current) {
      console.warn('[WB:analysis] чернетку не отримано', error instanceof Error ? error.name : 'request_failed')
      notice.value = 'Розбір недоступний або не пройшов перевірку. Дошку не змінено.'
    }
  } finally { if (generation === current) busy.value = false }
}
function addOrthogram() {
  const token = draft.value?.tokens[0]
  if (token && draft.value) draft.value.items.push({ start: token.start, end: token.start + 1, rule: '' })
}
function setBasis(token_id: string, role: string) {
  if (!draft.value) return
  draft.value.items = basis.value.filter((i) => i.token_id !== token_id)
  if (role === 'subject' || role === 'predicate') draft.value.items.push({ token_id, role })
}
function setPart(token_id: string, pos: string) {
  const item = parts.value.find((i) => i.token_id === token_id)
  if (item && Object.prototype.hasOwnProperty.call(partNames, pos)) item.pos = pos as Pos
}
function confirm() {
  if (!draft.value) return
  try { assertAnalysisItems(draft.value.kind, draft.value.items, { text: draft.value.text, tokens: draft.value.tokens }, draft.value.kind === 'parts') }
  catch { notice.value = 'Перевірте діапазони, правила й позначки слів.'; return }
  submit(draft.value.items)
}
function submit(items: AnalysisItem[], kind = draft.value?.kind) {
  if (!props.ready || pending.value || !kind || (draft.value && draft.value.source_revision !== props.sentence.source_revision)) return
  const request: SentenceRequest = { action: 'set_analysis', kind, items: JSON.parse(JSON.stringify(items)),
    source_revision: props.sentence.source_revision, page_id: props.sentence.page_id, object_id: props.sentence.object_id, request_id: crypto.randomUUID() }
  pending.value = request.request_id
  if (!props.send(request)) { pending.value = null; notice.value = 'Немає зв’язку з дошкою.'; return }
  notice.value = 'Чекаємо підтвердження дошки…'
  // Лише повідомлення, без повторної відправки.
  timer = setTimeout(() => { pending.value = null; notice.value = 'Застосування не підтверджено. Перевірте дошку.' }, 8000)
}
onUnmounted(() => { cancel(); clearTimer() })
</script>
<style scoped>
.language-analysis { padding: 12px; margin: 10px 0; border: 1px solid #8ecbb8; border-radius: 10px; background: #fff; color: #164e43; }
.language-analysis__buttons { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.language-analysis__text { white-space: pre-wrap; font-size: 17px; }
.language-analysis__row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 9px 0; padding-bottom: 8px; border-bottom: 1px solid #cbd5e1; }
button, select, input { min-height: 42px; padding: 6px; border: 1px solid #94a3b8; border-radius: 6px; background: #f0fdf4; color: #065f46; max-width: 100%; }
input[type=number] { width: 65px; } button:disabled { opacity: .5; } q { font-weight: bold; }
</style>

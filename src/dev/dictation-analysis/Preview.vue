<template>
  <main>
    <h1>Диктант 2.0 — орфограми, основа, частини мови</h1>
    <p class="warning">Локальний перегляд механіки. Приклади розбору задані вручну — це НЕ live AI і не доказ його точності. Почерк — справжній layout сервера.</p>
    <div class="layout">
      <section>
        <h2>Дошка для класу</h2>
        <p>
          <label>Приклад <select v-model="example" data-testid="preview-example" @change="resetExample">
            <option value="plain">Звичайне речення</option>
            <option value="ruled">Лінійка: мала літера 16 px</option>
            <option value="multiline">Два рядки в лінійку</option>
            <option value="short">Короткі слова «в», «у»</option>
          </select></label>
          <label>Масштаб <select v-model.number="zoom" data-testid="preview-zoom"><option :value="1">100%</option><option :value=".68">68% — проєктор</option></select></label>
        </p>
        <div class="board" data-testid="preview-board">
          <div :style="{ position: 'absolute', width: '1920px', height: '1080px', transformOrigin: '0 0', transform: `scale(${zoom})` }">
          <div :style="{ position: 'absolute', left: asset.x + 'px', top: asset.y + 'px', width: asset.w + 'px', height: asset.h + 'px' }">
            <DictationLineRenderer :asset="asset" :interactive="false" />
          </div>
          </div>
        </div>
        <p>До «Показати на дошці» тут нічого не змінюється. Приховане слово ховає і свої позначки.</p>
        <button data-testid="preview-undo" @click="undo">Скасувати дію</button>
        <button data-testid="preview-redo" @click="redo">Повторити дію</button>
        <p data-testid="preview-ops">Операцій: {{ ops.length }} · полотно 1920×1080</p>
      </section>
      <aside>
        <h2>Пульт учителя</h2>
        <label><input v-model="available" type="checkbox" data-testid="preview-available" /> Розбір дозволений сервером (ручна імітація)</label>
        <RemoteSentenceControls :sentence="sentence" :result="result" :ready="true" :send="send" />
        <RemoteSentenceAnalysis v-if="available" board-id="synthetic-preview" :sentence="sentence" :result="result" :ready="true" :send="send" :request="manualExample" :approve="manualApprove" />
      </aside>
    </div>
  </main>
</template>
<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { useWBStore } from '../../modules/winterboard/board/state/boardStore'
import { createDictationLine } from '../../modules/winterboard/board/createDictationLine'
import { assertDictationLine, type DictationLineData } from '../../modules/winterboard/board/dictationLine'
import { flushPendingUpdates } from '../../modules/winterboard/board/state/assetUpdateBatcher'
import { makeRemoteSentenceAdapter } from '../../modules/winterboard/remote/remoteSentenceAdapter'
import type { SentenceRequest, SentenceResult } from '../../modules/winterboard/remote/dictationLineContract'
import type { AnalysisDraft, AnalysisTarget, ApprovedAnalysis } from '../../modules/winterboard/api/dictationAnalysis'
import type { AnalysisItem } from '../../modules/winterboard/board/dictationAnalysis'
import DictationLineRenderer from '../../modules/winterboard/components/board/objects/DictationLineRenderer.vue'
import RemoteSentenceControls from '../../modules/winterboard/components/remote/RemoteSentenceControls.vue'
import RemoteSentenceAnalysis from '../../modules/winterboard/components/remote/RemoteSentenceAnalysis.vue'
import fixture from './sentence.json'
import { exampleData } from './examples'
assertDictationLine(fixture)
const example = ref('plain'), zoom = ref(1), available = ref(true)
const store = useWBStore()
store.workspaceId = 'synthetic-preview'; store.mode = 'edit'
store.pages = [{ id: 'p', name: 'Приклад', width: 1920, height: 1080, assets: [createDictationLine('s', 40, 240, fixture)], strokes: [] }]
store.currentPageIndex = 0; store.selectedIds = ['s']
const ops = ref<string[]>([]), result = shallowRef<SentenceResult | null>(null)
store.onOperation((op) => ops.value.push(op.op_type))
const approved = new Map<string, ApprovedAnalysis>()
const adapter = makeRemoteSentenceAdapter(store, { mode: 'SYNC', inputLocked: false }, async (id) => {
  if (!approved.has(id)) throw new Error('Немає ручного прикладу')
  return JSON.parse(JSON.stringify(approved.get(id)))
})
const sentence = computed(() => adapter.state()!)
const asset = computed(() => store.pages[0].assets[0])
function resetExample() {
  store.pages[0].assets = [createDictationLine('s', 40, 300, exampleData(example.value))]
  store.undoStack = []; store.redoStack = []; ops.value = []; result.value = null
}
function send(request: SentenceRequest) {
  if (request.action === 'apply_analysis') adapter.applyAnalysis!(request).then((answer) => { result.value = answer })
  else if (request.action === 'set_text') adapter.applyText!(request).then((answer) => { result.value = answer })
  else result.value = adapter.apply(request)
  return true
}
async function manualApprove(target: AnalysisTarget, items: AnalysisItem[]) {
  const id = crypto.randomUUID()
  approved.set(id, JSON.parse(JSON.stringify({ ...target, items })))
  return id
}
function undo() { store.undo(); flushPendingUpdates() }
function redo() { store.redo(); flushPendingUpdates() }
async function manualExample(target: AnalysisTarget): Promise<AnalysisDraft> {
  const data = asset.value.data as DictationLineData, words = data.tokens.filter((t) => t.kind === 'word')
  const items = target.kind === 'orthograms' ? words.filter((t) => t.text.includes('’')).map((t) => ({ start: t.start + 1, end: t.start + 2, rule: 'Апостроф після губного п перед є.' }))
    : target.kind === 'basis' ? words.filter((t) => t.text === 'Мама' || t.text === 'п’є').map((t) => ({ token_id: t.id, role: t.text === 'Мама' ? 'subject' : 'predicate' }))
      : words.map((t) => ({ token_id: t.id, pos: t.text === 'п’є' ? 'verb' : t.text === 'в' || t.text === 'у' ? 'preposition' : 'noun' }))
  return JSON.parse(JSON.stringify({ source_revision: data.source.revision, text: data.source.text,
    tokens: words, kind: target.kind, items }))
}
</script>
<style>
* { box-sizing: border-box; } body { margin: 0; background: #edf8f4; color: #164e43; font: 16px system-ui; }
main { max-width: 1480px; margin: auto; padding: 22px; } h1 { font-size: 25px; } h2 { font-size: 19px; }
.warning { padding: 13px; border-radius: 8px; background: #fff5d6; color: #754b0c; }
.layout { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(350px, 1fr); gap: 22px; }
aside { --surface: #fff; --surface-2: #f0fdf4; --text: #164e43; --line: #8ecbb8; --muted: #47675c; }
.board { position: relative; height: 330px; overflow: auto; background: repeating-linear-gradient(white 0px,white 39px,#a8cdd9 40px,white 41px); border: 1px solid #8ecbb8; border-radius: 8px; }
.board::before { content: ''; position: absolute; left: 28px; top: 0; bottom: 0; border-left: 1px solid #e7a6a6; }
button { padding: 9px; margin: 5px 5px 0 0; border-radius: 6px; border: 1px solid #80b8a6; background: white; color: #164e43; }
@media(max-width: 800px) { .layout { display: block; } }
</style>

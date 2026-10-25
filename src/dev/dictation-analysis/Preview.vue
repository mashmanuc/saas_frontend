<template>
  <main>
    <h1>Диктант 2.0 — орфограми, основа, частини мови</h1>
    <p class="warning">Локальний перегляд механіки. Приклади розбору задані вручну — це НЕ live AI і не доказ його точності. Почерк — справжній layout сервера.</p>
    <div class="layout">
      <section>
        <h2>Дошка для класу</h2>
        <div class="board" data-testid="preview-board">
          <div :style="{ position: 'absolute', left: asset.x + 'px', top: asset.y + 'px', width: asset.w + 'px', height: asset.h + 'px' }">
            <DictationLineRenderer :asset="asset" :interactive="false" />
          </div>
        </div>
        <p>До «Показати на дошці» тут нічого не змінюється. Приховане слово ховає і свої позначки.</p>
        <button data-testid="preview-undo" @click="undo">Скасувати дію</button>
        <button data-testid="preview-redo" @click="redo">Повторити дію</button>
        <p data-testid="preview-ops">Операцій: {{ ops.length }} · полотно 1920×1080</p>
      </section>
      <aside>
        <h2>Пульт учителя</h2>
        <RemoteSentenceControls :sentence="sentence" :result="result" :ready="true" :send="send" />
        <RemoteSentenceAnalysis board-id="synthetic-preview" :sentence="sentence" :result="result" :ready="true" :send="send" :request="manualExample" />
      </aside>
    </div>
  </main>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useWBStore } from '../../modules/winterboard/board/state/boardStore'
import { createDictationLine } from '../../modules/winterboard/board/createDictationLine'
import { assertDictationLine } from '../../modules/winterboard/board/dictationLine'
import { flushPendingUpdates } from '../../modules/winterboard/board/state/assetUpdateBatcher'
import { makeRemoteSentenceAdapter } from '../../modules/winterboard/remote/remoteSentenceAdapter'
import type { SentenceRequest, SentenceResult } from '../../modules/winterboard/remote/dictationLineContract'
import type { AnalysisDraft, AnalysisTarget } from '../../modules/winterboard/api/dictationAnalysis'
import DictationLineRenderer from '../../modules/winterboard/components/board/objects/DictationLineRenderer.vue'
import RemoteSentenceControls from '../../modules/winterboard/components/remote/RemoteSentenceControls.vue'
import RemoteSentenceAnalysis from '../../modules/winterboard/components/remote/RemoteSentenceAnalysis.vue'
import fixture from './sentence.json'
assertDictationLine(fixture)
const store = useWBStore()
store.workspaceId = 'synthetic-preview'; store.mode = 'edit'
store.pages = [{ id: 'p', name: 'Приклад', width: 1920, height: 1080, assets: [createDictationLine('s', 40, 70, fixture)], strokes: [] }]
store.currentPageIndex = 0; store.selectedIds = ['s']
const ops = ref<string[]>([]), result = ref<SentenceResult | null>(null)
store.onOperation((op) => ops.value.push(op.op_type))
const adapter = makeRemoteSentenceAdapter(store, { mode: 'SYNC', inputLocked: false })
const sentence = computed(() => adapter.state()!)
const asset = computed(() => store.pages[0].assets[0])
function send(request: SentenceRequest) { result.value = adapter.apply(request); return true }
function undo() { store.undo(); flushPendingUpdates() }
function redo() { store.redo(); flushPendingUpdates() }
async function manualExample(target: AnalysisTarget): Promise<AnalysisDraft> {
  const items = target.kind === 'orthograms' ? [{ start: 6, end: 7, rule: 'Апостроф після губного п перед є.' }]
    : target.kind === 'basis' ? [{ token_id: 'w0', role: 'subject' }, { token_id: 'w1', role: 'predicate' }]
      : [{ token_id: 'w0', pos: 'noun' }, { token_id: 'w1', pos: 'verb' }, { token_id: 'w2', pos: 'noun' }]
  return JSON.parse(JSON.stringify({ source_revision: fixture.source.revision, text: fixture.source.text,
    tokens: fixture.tokens.filter((t) => t.kind === 'word'), kind: target.kind, items }))
}
</script>
<style>
* { box-sizing: border-box; } body { margin: 0; background: #edf8f4; color: #164e43; font: 16px system-ui; }
main { max-width: 1480px; margin: auto; padding: 22px; } h1 { font-size: 25px; } h2 { font-size: 19px; }
.warning { padding: 13px; border-radius: 8px; background: #fff5d6; color: #754b0c; }
.layout { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(350px, 1fr); gap: 22px; }
.board { position: relative; height: 330px; overflow: auto; background: repeating-linear-gradient(white 0px,white 39px,#a8cdd9 40px,white 41px); border: 1px solid #8ecbb8; border-radius: 8px; }
.board::before { content: ''; position: absolute; left: 28px; top: 0; bottom: 0; border-left: 1px solid #e7a6a6; }
button { padding: 9px; margin: 5px 5px 0 0; border-radius: 6px; border: 1px solid #80b8a6; background: white; color: #164e43; }
@media(max-width: 800px) { .layout { display: block; } }
</style>

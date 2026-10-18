<script setup lang="ts">
import { computed, ref } from 'vue'
import NmtTaskRenderer from '@/modules/winterboard/components/board/objects/NmtTaskRenderer.vue'
import type { WBAsset } from '@/modules/winterboard/types/winterboard'
import type { NmtTaskAsset } from '@/modules/winterboard/types/nmtTask'
import { provideHostWindowControls } from '@/modules/winterboard/composables/boardWindowControls'
import raw from './preview-data.json'

type Page = { id: string; assets: NmtTaskAsset[] }
type Layout = { pages: Page[]; source_problem_ids: string[] }
const layouts = ref(structuredClone(raw.layouts) as unknown as Record<string, Record<string, Layout>>)
const count = ref('16'), perPage = ref('2'), page = ref(0)
const allPages = ref(false), expanded = ref(false)
const layout = computed(() => layouts.value[count.value][perPage.value])
const visible = computed(() => allPages.value ? layout.value.pages : [layout.value.pages[page.value]])
const tasks = raw.tasks as Record<string, { stage: number; family: string }>
const stageOf = (asset: NmtTaskAsset) => tasks[String(asset.data.externalId)].stage
const familyLabels = raw.stages.map(stage => stage.family_labels as Record<string, string>)
const familyOf = (asset: NmtTaskAsset) => familyLabels[stageOf(asset) - 1][tasks[String(asset.data.externalId)].family]
const numberOf = (asset: NmtTaskAsset) => layout.value.source_problem_ids.indexOf(String(asset.data.externalId)) + 1
const stageCount = (stage: number) => layout.value.source_problem_ids.filter(id => tasks[id].stage === stage).length
const taskNoun = (n: number) => n % 100 >= 11 && n % 100 <= 14 ? 'задач' : n % 10 === 1 ? 'задача' : n % 10 >= 2 && n % 10 <= 4 ? 'задачі' : 'задач'
provideHostWindowControls(() => true)
function changeCount(value: string) { count.value = value; page.value = 0 }
function changeLayout(value: string) {
  const first = page.value * Number(perPage.value)
  perPage.value = value
  page.value = Math.min(Math.floor(first / Number(value)), layout.value.pages.length - 1)
}
function updateAsset(target: Page, changed: WBAsset) {
  // Лише копія в пам'яті автономного прев'ю, не записувач стану дошки.
  const index = target.assets.findIndex(asset => asset.id === changed.id)
  if (index >= 0 && changed.type === 'nmt_task') target.assets[index] = changed as NmtTaskAsset
}
function revealAll() {
  expanded.value = !expanded.value
  for (const counts of Object.values(layouts.value)) for (const current of Object.values(counts)) {
    for (const target of current.pages) for (const asset of target.assets) {
      asset.data = { ...asset.data, showAnswer: expanded.value, showSolution: expanded.value }
    }
  }
}
</script>

<template>
  <main>
    <header>
      <span class="eyebrow">ЛОКАЛЬНИЙ ПЕРЕГЛЯД · ПРОД НЕ ЗМІНЕНО</span>
      <h1>Від умови.<br />До рівняння й відповіді.</h1>
      <p>Числа, сторони прямокутника, рух і спільна робота. Складіть модель, знайдіть корені й перевірте, який із них відповідає змісту.</p>
      <div class="route" aria-label="Навчальні кроки">
        <span v-for="stage in raw.stages" :key="stage.id"><b>{{ stage.id }}</b>{{ stage.label }}<small>{{ stageCount(stage.id) }} {{ taskNoun(stageCount(stage.id)) }}</small></span>
      </div>
    </header>
    <section class="controls" aria-label="Перегляд уроку">
      <div class="count-switch"><span>Задач:</span><button v-for="value in ['16', '30']" :key="value" :aria-pressed="count === value" @click="changeCount(value)">{{ value }}</button></div>
      <div class="layout-switch"><span>На сторінці:</span><button v-for="value in ['1', '2', '5']" :key="value" :aria-pressed="perPage === value" @click="changeLayout(value)">{{ value }}</button></div>
      <label><input v-model="allPages" type="checkbox" /> Усі задачі</label>
      <button class="reveal" @click="revealAll">{{ expanded ? 'Сховати всі розбори' : 'Відкрити всі розбори' }}</button>
      <nav v-if="!allPages" aria-label="Сторінки"><button :disabled="page === 0" @click="page--">← Назад</button><span>{{ page + 1 }} / {{ layout.pages.length }}</span><button :disabled="page === layout.pages.length - 1" @click="page++">Далі →</button></nav>
    </section>
    <section v-for="target in visible" :key="`${count}-${perPage}-${target.id}`" class="page" :aria-label="`Сторінка ${layout.pages.indexOf(target) + 1}`">
      <h2>Сторінка {{ layout.pages.indexOf(target) + 1 }}</h2>
      <div class="cards">
        <article v-for="asset in target.assets" :key="asset.id">
          <div class="caption"><strong>Задача {{ numberOf(asset) }}</strong><span>Крок {{ stageOf(asset) }} · {{ familyOf(asset) }}</span></div>
          <div class="real-card"><NmtTaskRenderer :asset="asset" :is-selected="false" :interactive="true" :is-tutor="true" :can-fit="false" @update:asset="updateAsset(target, $event)" /></div>
        </article>
      </div>
    </section>
    <footer>
      <p>Це чинні картки зі справді створених і повторно прочитаних локальних уроків. Кнопки відповідей і розборів працюють. Розкладки 1/2/5 не змінюють добір задач.</p>
      <p>Банк: 60 нових задач, три навчальні кроки й шість різновидів. Старі уроки не змінено. Математику перевірено; перегляд учителем і калібрування на результатах учнів — окремі етапи.</p>
      <details><summary>Походження</summary><code>{{ raw.edition }}<br />SHA256 {{ raw.bundle_sha256 }}<br />{{ layout.source_problem_ids.join('\n') }}</code></details>
    </footer>
  </main>
</template>

<style>
* { box-sizing: border-box; }
body { margin: 0; background: #f1f5f4; color: #17352d; font-family: system-ui, sans-serif; }
main { max-width: 1400px; margin: auto; padding: 36px 28px; }
.eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .09em; color: #397765; }
h1 { font-size: clamp(27px,3.3vw,42px); line-height: 1.2; letter-spacing: -.035em; margin: 18px 0; }
header > p { max-width: 850px; color: #52645d; line-height: 1.6; }
.route { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin: 25px 0; }
.route > span { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 13px; background: white; border: 1px solid #d4e1db; border-radius: 9px; font-size: 13px; }
.route b { border-radius: 50%; padding: 3px 8px; background: #dfefe8; color: #176246; }
.route small { color: #66776e; margin-left: auto; }
.controls { display: flex; align-items: center; flex-wrap: wrap; gap: 13px; position: sticky; top: 0; z-index: 10; padding: 13px 0; background: #f1f5f4f5; border-bottom: 1px solid #d4e1db; font-size: 13px; }
.count-switch,.layout-switch,nav { display: flex; align-items: center; gap: 6px; }
button { border: 1px solid #c4d5cb; color: #204f3a; background: white; padding: 8px 12px; border-radius: 7px; cursor: pointer; font: inherit; }
button[aria-pressed="true"] { background: #176246; color: white; border-color: #176246; }
button:disabled { opacity: .4; cursor: default; }
button:focus-visible,input:focus-visible { outline: 3px solid #0a9680; outline-offset: 2px; }
label { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; }
.page { margin: 24px 0 32px; }
h2 { font-size: 13px; font-weight: 500; color: #6e8076; }
.cards { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 24px; }
.caption { display: flex; flex-wrap: wrap; gap: 6px 14px; padding-bottom: 10px; font-size: 12px; }
.caption > span { color: #61766a; }
.real-card { height: 520px; }
footer { color: #61766a; font-size: 12px; line-height: 1.65; border-top: 1px solid #d4e1db; padding-top: 10px; }
code { display: block; white-space: pre-wrap; overflow-wrap: anywhere; padding-top: 15px; font-size: 11px; }
@media(max-width:850px) { main { padding: 24px 16px; } .cards,.route { grid-template-columns: 1fr; } .controls { gap: 9px; } }
</style>

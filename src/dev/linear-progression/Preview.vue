<script setup lang="ts">
import { computed, ref } from 'vue'
import NmtTaskRenderer from '@/modules/winterboard/components/board/objects/NmtTaskRenderer.vue'
import type { WBAsset } from '@/modules/winterboard/types/winterboard'
import type { NmtTaskAsset } from '@/modules/winterboard/types/nmtTask'
import { provideHostWindowControls } from '@/modules/winterboard/composables/boardWindowControls'
import raw from './preview-data.json'

type Page = { id: string; assets: NmtTaskAsset[] }
type Layout = { pages: Page[]; source_problem_ids: string[] }
const layouts = ref(structuredClone(raw.layouts) as unknown as Record<string, Layout>)
const perPage = ref('2')
const page = ref(0)
const allPages = ref(false)
const expanded = ref(false)
const layout = computed(() => layouts.value[perPage.value])
const visible = computed(() => allPages.value ? layout.value.pages : [layout.value.pages[page.value]])
const tasks = raw.tasks as Record<string, { stage: number; family: string }>
const numberOf = (asset: NmtTaskAsset) => layout.value.source_problem_ids.indexOf(String(asset.data.externalId)) + 1
const stageOf = (asset: NmtTaskAsset) => tasks[String(asset.data.externalId)].stage
provideHostWindowControls(() => true)

function setLayout(value: string) {
  const firstTask = page.value * Number(perPage.value)
  perPage.value = value
  page.value = Math.min(Math.floor(firstTask / Number(value)), layout.value.pages.length - 1)
}

function updateAsset(target: Page, changed: WBAsset) {
  // Лише стан автономного прев'ю в пам'яті. Це НЕ новий записувач дошки.
  const index = target.assets.findIndex(asset => asset.id === changed.id)
  if (changed.type !== 'nmt_task') throw new Error('У цьому перегляді дозволені лише картки задач.')
  if (index >= 0) target.assets[index] = changed as NmtTaskAsset
}

function revealAll() {
  expanded.value = !expanded.value
  for (const current of Object.values(layouts.value)) {
    for (const target of current.pages) {
      for (const asset of target.assets) {
        asset.data = { ...asset.data, showAnswer: expanded.value, showSolution: expanded.value }
      }
    }
  }
}
</script>

<template>
  <main>
    <header>
      <span class="eyebrow">ЛОКАЛЬНА ЧЕРНЕТКА · НА САЙТІ НІЧОГО НЕ ЗМІНЕНО</span>
      <h1>Не просто інші числа.<br />Наступний крок — інше вміння.</h1>
      <p>16 рівнянь: від однієї дії до дужок і дробів разом. Картки взято зі справді створеного й повторно прочитаного локального уроку.</p>
      <div class="route" aria-label="Навчальні кроки">
        <span v-for="(stage, index) in raw.stages" :key="stage.id">
          <b>{{ stage.id }}</b> {{ stage.label }} <small>{{ [3, 3, 3, 3, 2, 2][index] }} задачі</small>
        </span>
      </div>
    </header>

    <section class="controls" aria-label="Перегляд уроку">
      <div class="layout-switch">
        <span>На сторінці:</span>
        <button v-for="value in ['1', '2', '5']" :key="value" :aria-pressed="perPage === value" @click="setLayout(value)">{{ value }}</button>
      </div>
      <label><input v-model="allPages" type="checkbox" /> Усі 16 задач</label>
      <button @click="revealAll">{{ expanded ? 'Сховати всі розбори' : 'Відкрити всі розбори' }}</button>
      <nav v-if="!allPages" aria-label="Сторінки">
        <button :disabled="page === 0" @click="page--">← Назад</button>
        <span>{{ page + 1 }} / {{ layout.pages.length }}</span>
        <button :disabled="page === layout.pages.length - 1" @click="page++">Далі →</button>
      </nav>
    </section>

    <section v-for="target in visible" :key="`${perPage}-${target.id}`" class="page" :aria-label="`Сторінка ${layout.pages.indexOf(target) + 1}`">
      <h2>Сторінка {{ layout.pages.indexOf(target) + 1 }}</h2>
      <div class="cards">
        <article v-for="asset in target.assets" :key="asset.id">
          <div class="caption"><strong>Задача {{ numberOf(asset) }}</strong><span>Крок {{ stageOf(asset) }} · {{ raw.stages[stageOf(asset) - 1].label }}</span></div>
          <div class="real-card">
            <NmtTaskRenderer :asset="asset" :is-selected="false" :interactive="true" :is-tutor="true" :can-fit="false" @update:asset="updateAsset(target, $event)" />
          </div>
        </article>
      </div>
    </section>

    <footer>
      <p>Можна обирати відповіді й відкривати розбір штатними кнопками картки. Зміни тут живуть лише до оновлення сторінки.</p>
      <p>Це предметно побудований маршрут, ще не калібрований на результатах учнів і не прийнятий учителем. Перегляд не перевіряє спільний урок, undo чи Replay.</p>
      <details><summary>Походження добору</summary><code>{{ raw.edition }}<br />SHA256 {{ raw.bundle_sha256 }}<br />{{ layout.source_problem_ids.join('\n') }}</code></details>
    </footer>
  </main>
</template>

<style>
* { box-sizing: border-box; }
body { margin: 0; background: #f1f5f4; color: #17352d; font-family: system-ui, sans-serif; }
main { max-width: 1460px; margin: auto; padding: 42px 34px; }
header { max-width: 1100px; }
.eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .1em; color: #397765; }
h1 { font-size: clamp(27px, 3.3vw, 43px); line-height: 1.2; letter-spacing: -.035em; margin: 18px 0; }
header > p { color: #52645d; max-width: 760px; line-height: 1.65; }
.route { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 28px 0; }
.route > span { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; padding: 12px; border: 1px solid #d4e1db; border-radius: 9px; font-size: 13px; background: #fff; }
.route b { border-radius: 50%; padding: 3px 8px; background: #dfefe8; color: #176246; }
.route small { color: #66776e; margin-left: auto; }
.controls { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; position: sticky; top: 0; z-index: 10; padding: 14px 0; background: #f1f5f4f5; border-bottom: 1px solid #d4e1db; font-size: 13px; }
.layout-switch, nav { display: flex; gap: 7px; align-items: center; }
nav { margin-left: auto; }
button { border: 1px solid #c4d5cb; color: #204f3a; background: white; padding: 9px 13px; border-radius: 7px; cursor: pointer; font: inherit; }
button[aria-pressed="true"] { background: #176246; color: white; border-color: #176246; }
button:disabled { opacity: .4; cursor: default; }
button:focus-visible, input:focus-visible { outline: 3px solid #0a9680; outline-offset: 2px; }
label { display: inline-flex; gap: 7px; align-items: center; cursor: pointer; }
.page { margin: 26px 0 38px; }
h2 { font-size: 13px; font-weight: 500; color: #6e8076; }
.cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
.caption { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 0 0 10px; font-size: 12px; }
.caption > span { color: #61766a; }
.real-card { height: 430px; }
footer { color: #61766a; font-size: 12px; line-height: 1.65; border-top: 1px solid #d4e1db; padding-top: 10px; }
code { display: block; white-space: pre-wrap; overflow-wrap: anywhere; padding-top: 15px; font-size: 11px; }
@media (max-width: 850px) { main { padding: 25px 16px; } .cards { grid-template-columns: 1fr; } .route { grid-template-columns: repeat(2, 1fr); } .controls { gap: 10px; } nav { margin-left: 0; } }
@media (max-width: 500px) { .route { grid-template-columns: 1fr; } }
</style>

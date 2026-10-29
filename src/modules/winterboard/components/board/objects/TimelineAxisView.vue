<!--
  TimelineAxisView — шкала «вісь» за макетом дизайнера (власник 2026-10-29: «Роби за макетом дизайнера, лише для
  мене»; макет `DATA/ПОЛА/іст_карта.zip`). Частина TimelineCardRenderer, не окремий тип: `data.view === 'axis'`.

  ЩО З МАКЕТА: етапи кольором (межі — дати джерела), вісь у справжньому масштабі часу, події точками, періоди
  смужками, рядок фішок, картка події (велика дата, вид, текст статті, учасники), «Попередня / Наступна»,
  «Подія N з M», «Перевір себе», «▶ розповідати по черзі». ЧОГО НЕМАЄ: графіка площі й «Наслідку» — їх немає
  в джерелі, а вигадувати значення заборонено (H1).

  ЗАПИС: вибір події — той самий один `asset_update` (`active_event_id`) через батька, що й у списку; «▶» — це
  те саме «Наступна» раз на 4,5 с. «Перевір себе» (сховані дати, відповіді, рахунок) живе лише на цьому
  екрані й операцій не породжує (LAW §9 v1.71).

  ДЕТЕРМІНОВАНИЙ РЕНДЕР: усе з пропсів, мережі немає (Replay, PDF).
-->
<template>
  <div class="tl-axis" :class="{ 'is-quiz': quiz }" :style="accentStyle(activeEra)" data-testid="timeline-axis">
    <div v-if="interactive" class="tl-axis__bar">
      <span v-if="quiz" class="tl-axis__score" data-testid="timeline-axis-score">{{ scoreText }}</span>
      <div class="tl-axis__seg" role="group">
        <button
          type="button" :class="{ on: !quiz }" data-testid="timeline-axis-learn"
          @click.stop="setQuiz(false)" @mousedown.stop @pointerdown.stop
        >{{ labels.learn }}</button>
        <button
          type="button" :class="{ on: quiz }" data-testid="timeline-axis-quiz"
          @click.stop="setQuiz(true)" @mousedown.stop @pointerdown.stop
        >{{ labels.quiz }}</button>
      </div>
      <button
        type="button" class="tl-axis__play" :class="{ on: playing }"
        :title="playing ? labels.pause : labels.play" data-testid="timeline-axis-play"
        @click.stop="togglePlay" @mousedown.stop @pointerdown.stop
      >{{ playing ? '❚❚' : '▶' }}</button>
    </div>

    <div class="tl-axis__overview">
      <div v-if="eras.length" class="tl-axis__eras">
        <button
          v-for="(seg, k) in eraSegments" :key="k" type="button" class="tl-axis__era"
          :class="{ dim: activeEra !== null && activeEra !== k }"
          :style="{ left: `${seg.left}%`, width: `${seg.width}%`, background: ERA_BG[k], color: ERA_COLOR[k] }"
          :title="`${seg.name}: ${eras[k].from}–${eras[k].to}`" :data-testid="`timeline-axis-era-${k}`"
          @click.stop="selectEra(k)" @mousedown.stop @pointerdown.stop
        >{{ seg.name }}</button>
      </div>
      <div class="tl-axis__track">
        <div class="tl-axis__line">
          <span v-for="t in ticks" :key="t" class="tl-axis__tick" :style="{ left: `${pos(t)}%` }">{{ t }}</span>
        </div>
        <div
          v-for="r in ranges" :key="`r-${r.id}`" class="tl-axis__range"
          :style="{ left: `${r.left}%`, width: `${r.width}%`, color: colorOf(r.era) }"
        />
        <button
          v-for="(ev, i) in events" :key="ev.id" type="button" class="tl-axis__dot"
          :class="{ on: ev.id === activeId, done: !!answers[ev.id] }"
          :style="{ left: `${pos(startYear(ev))}%`, color: colorOf(ev.era), '--lv': levels[i] }"
          :title="quiz && !answers[ev.id] ? masked(ev) : `${bigDate(ev)} — ${ev.label}`"
          :data-testid="`timeline-axis-dot-${i}`"
          @click.stop="emit('select', ev.id)" @mousedown.stop @pointerdown.stop
        />
        <div v-if="active" class="tl-axis__cursor" :style="{ left: `${pos(startYear(active))}%` }" />
        <span v-if="active && !quiz" class="tl-axis__curlab" :style="{ left: `${pos(startYear(active))}%` }">
          {{ bigDate(active) }}
        </span>
      </div>
    </div>

    <div ref="chipsEl" class="tl-axis__chips">
      <button
        v-for="(ev, i) in events" :key="ev.id" type="button" class="tl-axis__chip"
        :class="{ on: ev.id === activeId, ok: quiz && answers[ev.id] === 'ok', bad: quiz && answers[ev.id] === 'bad' }"
        :style="accentStyle(eraIndex(ev))" :data-testid="`timeline-axis-chip-${i}`"
        @click.stop="emit('select', ev.id)" @mousedown.stop @pointerdown.stop
      >
        <b>{{ quiz && !answers[ev.id] ? '????' : bigDate(ev) }}</b>
        <span>{{ masked(ev) }}</span>
      </button>
    </div>

    <section v-if="active" class="tl-axis__detail">
      <div class="tl-axis__main">
        <div class="tl-axis__tags">
          <span v-if="activeEra !== null" class="tl-axis__tag is-era">{{ eras[activeEra].name }}</span>
          <span v-if="active.kind" class="tl-axis__tag">{{ active.kind }}</span>
        </div>
        <div v-if="showAnswer" class="tl-axis__big" data-testid="timeline-axis-big">{{ bigDate(active) }}</div>
        <h2 class="tl-axis__title">{{ masked(active) }}</h2>
        <p v-if="showAnswer && fullDate" class="tl-axis__full">{{ fullDate }}</p>
        <!-- «… далі»: увесь вступ статті по натиску — лише цей екран, без запису (власник 2026-10-29) -->
        <p v-if="showAnswer && active.description" class="tl-axis__text"
           :class="{ 'is-full': fullOpen, 'is-more': !!active.description_full }" data-testid="timeline-axis-text"
           @click.stop="active.description_full && (fullOpen = !fullOpen)" @mousedown.stop @pointerdown.stop>{{ fullOpen && active.description_full ? active.description_full : active.description }}</p>
        <button
          v-if="showAnswer && active.description_full" type="button" class="tl-axis__more"
          data-testid="timeline-axis-more" @click.stop="fullOpen = !fullOpen" @mousedown.stop @pointerdown.stop
        >{{ fullOpen ? labels.less : `… ${labels.more}` }}</button>
        <p v-if="showAnswer && active.description_lang && active.description_lang !== language"
           class="tl-axis__lang" data-testid="timeline-axis-lang">{{ labels.articleLang[active.description_lang] }}</p>
        <div v-if="active.participants?.length" class="tl-axis__who">
          {{ labels.participants }}:
          <span v-for="p in active.participants" :key="p">{{ p }}</span>
        </div>
        <div v-if="quiz" class="tl-axis__quiz">
          <div class="tl-axis__opts">
            <button
              v-for="o in options" :key="o" type="button" class="tl-axis__opt"
              :class="{ good: !!answers[active.id] && o === bigDate(active), bad: picked === o && o !== bigDate(active) }"
              :data-testid="`timeline-axis-opt-${o}`"
              @click.stop="answer(o)" @mousedown.stop @pointerdown.stop
            >{{ o }}</button>
          </div>
          <div class="tl-axis__qmsg">{{ quizMessage }}</div>
        </div>
        <SourceList v-if="showAnswer" :sources="active.sources" :language="language" />
      </div>
      <aside class="tl-axis__side">
        <div v-if="activeEra !== null" class="tl-axis__meter">
          <h3>{{ labels.stage }}</h3>
          <div class="tl-axis__row"><span>{{ eras[activeEra].name }}</span><b>{{ eraYears(eras[activeEra]) }}</b></div>
        </div>
        <div class="tl-axis__nav">
          <button
            type="button" :disabled="activeIndex <= 0" data-testid="timeline-axis-prev"
            @click.stop="step(-1)" @mousedown.stop @pointerdown.stop
          >← {{ labels.prev }}</button>
          <button
            type="button" :disabled="activeIndex >= events.length - 1" data-testid="timeline-axis-next"
            @click.stop="step(1)" @mousedown.stop @pointerdown.stop
          >{{ labels.next }} →</button>
        </div>
        <div class="tl-axis__prog">{{ progressText }}</div>
      </aside>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { WBTimelineEra, WBTimelineEvent } from '../../../types/winterboard'
import { TIMELINE_LABELS, formatTimelineDate, type MaterialLanguage } from '../../../board/timelinePresentation'
import SourceList from './SourceList.vue'

const props = withDefaults(defineProps<{
  events: WBTimelineEvent[]
  eras?: WBTimelineEra[]
  activeId: string | null
  interactive?: boolean
  language?: MaterialLanguage
}>(), { eras: () => [], interactive: true, language: 'uk' })

const emit = defineEmits<{ select: [id: string] }>()

// Кольори етапів — з макета (e1…e4) + п'ятий; без етапу — колір картки.
const ERA_COLOR = ['#2563eb', '#059669', '#d97706', '#b91c1c', '#7c3aed']
const ERA_BG = ['#dbeafe', '#d1fae5', '#fef3c7', '#fee2e2', '#ede9fe']
const NEUTRAL = '#047857'
const NEUTRAL_BG = '#e3f5ee'
const PLAY_STEP_MS = 4500

const labels = computed(() => TIMELINE_LABELS[props.language])
const eras = computed(() => props.eras ?? [])
const activeIndex = computed(() => props.events.findIndex(e => e.id === props.activeId))
const active = computed(() => (activeIndex.value >= 0 ? props.events[activeIndex.value] : null))

const startYear = (ev: WBTimelineEvent) => ev.date_start.year
const endYear = (ev: WBTimelineEvent) => (ev.date_end && ev.date_end.year > ev.date_start.year ? ev.date_end.year : null)
/** Велика дата макета: рік або «1648–1657». Повна дата з днем — окремим рядком у картці події. */
const bigDate = (ev: WBTimelineEvent) => (endYear(ev) ? `${startYear(ev)}–${endYear(ev)}` : String(startYear(ev)))
const fullDate = computed(() => {
  const ev = active.value
  if (!ev) return ''
  const full = formatTimelineDate(ev.date_start, ev.date_end, props.language)
  return full === bigDate(ev) ? '' : full
})

// ── Масштаб осі ─────────────────────────────────────────────────────────────
const domain = computed(() => {
  const years = props.events.flatMap(e => [startYear(e), endYear(e) ?? startYear(e)])
  const lo = Math.min(...years)
  const hi = Math.max(...years)
  const pad = Math.max(1, Math.round((hi - lo) * 0.04))
  return { y0: lo - pad, y1: hi === lo ? hi + pad + 1 : hi + pad }
})
const pos = (year: number) => ((year - domain.value.y0) / (domain.value.y1 - domain.value.y0)) * 100
const ticks = computed(() => {
  const { y0, y1 } = domain.value
  const raw = (y1 - y0) / 8
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find(s => s >= raw) ?? 1000
  const out: number[] = []
  for (let t = Math.ceil(y0 / step) * step; t <= y1; t += step) out.push(t)
  return out
})
/** Близькі точки стають одна над одною (макет: ближче ~18 px на 1000 px ширини). */
const levels = computed(() => {
  const span = domain.value.y1 - domain.value.y0
  const lv: number[] = []
  props.events.forEach((e, i) => {
    let level = 0
    for (let j = 0; j < i; j++) {
      if (Math.abs(startYear(props.events[j]) - startYear(e)) * (1000 / span) < 18 && lv[j] >= level) level = lv[j] + 1
    }
    lv[i] = Math.min(level, 4)
  })
  return lv
})
const ranges = computed(() => props.events.filter(e => endYear(e)).map(e => ({
  id: e.id, era: e.era, left: pos(startYear(e)), width: Math.max(0.6, pos(endYear(e) as number) - pos(startYear(e))),
})))

// ── Етапи ───────────────────────────────────────────────────────────────────
const eraIndex = (ev: WBTimelineEvent): number | null =>
  (Number.isInteger(ev.era) && (ev.era as number) < eras.value.length ? (ev.era as number) : null)
const activeEra = computed(() => (active.value ? eraIndex(active.value) : null))
const colorOf = (era: number | undefined) => (Number.isInteger(era) && (era as number) < eras.value.length
  ? ERA_COLOR[era as number] : NEUTRAL)
const accentStyle = (era: number | null) => ({
  '--tl-c': era === null ? NEUTRAL : ERA_COLOR[era],
  '--tl-cb': era === null ? NEUTRAL_BG : ERA_BG[era],
})
/** Смужка етапів суцільна: етап — від свого початку до початку наступного (межі з дат джерела). */
const eraSegments = computed(() => eras.value.map((era, k) => {
  const end = k + 1 < eras.value.length ? eras.value[k + 1].from : era.to
  const left = pos(era.from)
  return { name: era.name, left, width: Math.max(2, pos(Math.max(end, era.from + 1)) - left) }
}))

const eraYears = (era: WBTimelineEra) => (era.from === era.to ? String(era.from) : `${era.from}–${era.to}`)

function selectEra(k: number): void {
  const first = props.events.find(e => e.era === k)
  if (first) emit('select', first.id)
}

function step(delta: number): void {
  const target = props.events[activeIndex.value + delta]
  if (target) emit('select', target.id)
}

// ── «Перевір себе»: лише цей екран, без операцій ───────────────────────────
const quiz = ref(false)
const answers = ref<Record<string, 'ok' | 'bad'>>({})
const picked = ref<string | null>(null)
const showAnswer = computed(() => !quiz.value || (!!active.value && !!answers.value[active.value.id]))
/** Рік у назві — підказка («Синопська битва (1853)»): у перевірці ховаємо до відповіді, як і дату. */
const YEARS_IN_TEXT = /\d{3,4}(\s*[–—-]\s*\d{2,4})?/g
const masked = (ev: WBTimelineEvent) =>
  (quiz.value && !answers.value[ev.id] ? ev.label.replace(YEARS_IN_TEXT, '…') : ev.label)

function setQuiz(on: boolean): void {
  quiz.value = on
  answers.value = {}
  picked.value = null
}

/** Правильна дата + три найближчі інші дати шкали; порядок стабільний для події (не стрибає при перемальовці). */
const options = computed(() => {
  const ev = active.value
  if (!ev) return []
  const right = bigDate(ev)
  const pool = [...new Set(props.events.filter(e => e !== ev).map(bigDate))].filter(d => d !== right)
  const near = pool.sort((a, b) => Math.abs(parseInt(a, 10) - startYear(ev)) - Math.abs(parseInt(b, 10) - startYear(ev)))
    .slice(0, 3)
  let seed = activeIndex.value * 9301 + 49297
  const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
  return [right, ...near].map(d => ({ d, k: rnd() })).sort((a, b) => a.k - b.k).map(x => x.d)
})

function answer(option: string): void {
  const ev = active.value
  if (!ev || answers.value[ev.id]) return
  picked.value = option
  answers.value = { ...answers.value, [ev.id]: option === bigDate(ev) ? 'ok' : 'bad' }
}
watch(() => props.activeId, () => { picked.value = null; fullOpen.value = false })
const fullOpen = ref(false)

const quizMessage = computed(() => {
  const ev = active.value
  if (!ev) return ''
  const got = answers.value[ev.id]
  if (!got) return labels.value.question
  return got === 'ok' ? labels.value.right : labels.value.answer.replace('{d}', bigDate(ev))
})
const scoreText = computed(() => {
  const all = Object.values(answers.value)
  return labels.value.score.replace('{ok}', String(all.filter(a => a === 'ok').length)).replace('{all}', String(all.length))
})
const progressText = computed(() =>
  labels.value.progress.replace('{n}', String(activeIndex.value + 1)).replace('{m}', String(props.events.length)))

// ── «▶»: те саме «Наступна» раз на 4,5 с, до кінця шкали ──────────────────
const playing = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

function stopPlay(): void {
  if (timer) clearInterval(timer)
  timer = null
  playing.value = false
}

function togglePlay(): void {
  if (playing.value) { stopPlay(); return }
  if (!props.events.length) return
  playing.value = true
  if (activeIndex.value < 0 || activeIndex.value >= props.events.length - 1) emit('select', props.events[0].id)
  timer = setInterval(() => {
    if (activeIndex.value >= props.events.length - 1) { stopPlay(); return }
    step(1)
  }, PLAY_STEP_MS)
}
onBeforeUnmount(stopPlay)

// Активна фішка — у полі зору рядка (макет: прокрутка до неї).
const chipsEl = ref<HTMLElement | null>(null)
watch(() => props.activeId, () => {
  const box = chipsEl.value
  const chip = box?.querySelector<HTMLElement>('.tl-axis__chip.on')
  if (box && chip && typeof box.scrollTo === 'function') {
    box.scrollTo({ left: chip.offsetLeft - box.clientWidth / 2 + chip.offsetWidth / 2, behavior: 'smooth' })
  }
}, { flush: 'post' })
</script>

<style scoped>
.tl-axis {
  --tl-ink: #0d4a3e; --tl-ink2: #1f6b5a; --tl-ink3: #5f8379; --tl-line: rgba(5, 150, 105, 0.16);
  color: var(--tl-ink); font-size: calc(14px * var(--wb-card-text-scale, 1)); line-height: 1.5;
}
.tl-axis button { font: inherit; color: inherit; cursor: pointer; pointer-events: auto; }
.tl-axis__bar { display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 0 4px 8px; }
.tl-axis__seg { display: inline-flex; background: #f1f5f4; border-radius: 10px; padding: 3px; }
.tl-axis__seg button {
  border: 0; background: none; padding: 5px 12px; border-radius: 8px; font-weight: 600; color: var(--tl-ink3);
  font-size: calc(13px * var(--wb-card-text-scale, 1)); white-space: nowrap;
}
.tl-axis__seg button.on { background: #fff; color: var(--tl-ink); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08); }
.tl-axis__play {
  width: 34px; height: 34px; border-radius: 10px; border: 1.5px solid var(--tl-line); background: #fff;
  display: grid; place-items: center; color: var(--tl-ink2);
}
.tl-axis__play.on { background: #047857; border-color: #047857; color: #fff; }
.tl-axis__score {
  font-weight: 700; color: #047857; background: #e3f5ee; border-radius: 999px; padding: 3px 12px;
  font-size: calc(13px * var(--wb-card-text-scale, 1));
}

.tl-axis__overview { padding: 6px 8px 0; user-select: none; }
.tl-axis__eras { position: relative; height: 30px; }
.tl-axis__era {
  position: absolute; top: 0; height: 30px; border: 0; padding: 0 6px; border-radius: 9px; overflow: hidden;
  white-space: nowrap; text-overflow: ellipsis; font-weight: 700; font-size: calc(12px * var(--wb-card-text-scale, 1));
}
.tl-axis__era.dim { opacity: 0.35; }
.tl-axis__track { position: relative; height: 110px; margin: 6px 0 26px; }
.tl-axis__line { position: absolute; left: 0; right: 0; bottom: 0; height: 26px; border-top: 1.5px solid var(--tl-ink); }
.tl-axis__tick {
  position: absolute; top: 0; transform: translateX(-50%); padding-top: 6px; color: var(--tl-ink3);
  font-size: calc(11px * var(--wb-card-text-scale, 1)); font-variant-numeric: tabular-nums;
}
.tl-axis__tick::before { content: ''; position: absolute; left: 50%; top: -1px; width: 1px; height: 5px; background: var(--tl-ink); }
.tl-axis__dot {
  position: absolute; bottom: calc(20px + var(--lv, 0) * 17px); transform: translateX(-50%); width: 14px; height: 14px;
  border-radius: 50%; border: 2.5px solid #fff; box-shadow: 0 0 0 1.5px currentColor; background: currentColor;
  padding: 0; z-index: 2;
}
.tl-axis__dot::after {
  content: ''; position: absolute; left: 50%; top: 100%; width: 1px; height: calc(var(--lv, 0) * 17px + 1px);
  background: currentColor; opacity: 0.5;
}
.tl-axis__dot.on { transform: translateX(-50%) scale(1.45); z-index: 3; }
.is-quiz .tl-axis__dot:not(.done) { background: #cbd5d1; color: #cbd5d1 !important; }
.tl-axis__range { position: absolute; bottom: 25px; height: 5px; border-radius: 3px; background: currentColor; opacity: 0.45; }
.tl-axis__cursor {
  position: absolute; top: 0; bottom: 20px; width: 2px; background: var(--tl-ink); opacity: 0.5;
  transform: translateX(-1px); pointer-events: none; z-index: 1;
}
.tl-axis__curlab {
  position: absolute; bottom: -22px; transform: translateX(-50%); background: var(--tl-ink); color: #fff;
  font-weight: 700; padding: 2px 7px; border-radius: 6px; white-space: nowrap; pointer-events: none; z-index: 4;
  font-size: calc(11px * var(--wb-card-text-scale, 1));
}

.tl-axis__chips { display: flex; gap: 8px; overflow-x: auto; padding: 4px 8px 12px; scrollbar-width: thin; }
.tl-axis__chip {
  flex: 0 0 auto; border: 1.5px solid var(--tl-line); background: #fff; border-radius: 12px; padding: 6px 12px;
  text-align: left; min-width: 110px; max-width: 200px;
}
.tl-axis__chip b {
  display: block; color: var(--tl-c); font-variant-numeric: tabular-nums; font-size: calc(13px * var(--wb-card-text-scale, 1));
}
.tl-axis__chip span {
  display: block; color: var(--tl-ink2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  line-height: 1.3; font-size: calc(12.5px * var(--wb-card-text-scale, 1));
}
.tl-axis__chip.on { background: var(--tl-cb); border-color: var(--tl-c); }
.tl-axis__chip.ok b::after { content: ' ✓'; color: #059669; }
.tl-axis__chip.bad b::after { content: ' ✕'; color: #b91c1c; }

.tl-axis__detail {
  display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); border-top: 1px solid var(--tl-line);
}
.tl-axis__main { padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; min-height: 230px; }
.tl-axis__tags { display: flex; gap: 6px; flex-wrap: wrap; }
.tl-axis__tag {
  font-weight: 700; border-radius: 999px; padding: 2px 10px; background: #f1f5f4; color: var(--tl-ink2);
  font-size: calc(11.5px * var(--wb-card-text-scale, 1));
}
.tl-axis__tag.is-era { background: var(--tl-cb); color: var(--tl-c); }
.tl-axis__big {
  font-weight: 800; line-height: 1; letter-spacing: -0.03em; color: var(--tl-c); font-variant-numeric: tabular-nums;
  font-size: calc(44px * var(--wb-card-text-scale, 1));
}
.tl-axis__title { margin: 0; line-height: 1.2; font-size: calc(22px * var(--wb-card-text-scale, 1)); }
.tl-axis__full { margin: 0; color: var(--tl-ink3); font-size: calc(13px * var(--wb-card-text-scale, 1)); }
.tl-axis__text { margin: 0; color: var(--tl-ink2); max-width: 60ch; font-size: calc(15.5px * var(--wb-card-text-scale, 1)); }
.tl-axis__text.is-more { cursor: pointer; pointer-events: auto; }
.tl-axis__text.is-full { white-space: pre-line; max-height: calc(15em * var(--wb-card-text-scale, 1)); overflow-y: auto; }
.tl-axis__more {
  align-self: flex-start; border: 0; background: none; padding: 0; color: var(--tl-c); font-weight: 600;
  font-size: calc(13px * var(--wb-card-text-scale, 1));
}
.tl-axis__lang { margin: 0; color: var(--tl-ink3); font-style: italic; font-size: calc(12px * var(--wb-card-text-scale, 1)); }
.tl-axis__who {
  display: flex; gap: 6px; flex-wrap: wrap; align-items: center; color: var(--tl-ink3);
  font-size: calc(12.5px * var(--wb-card-text-scale, 1));
}
.tl-axis__who span { border: 1px solid var(--tl-line); border-radius: 8px; padding: 1px 8px; color: var(--tl-ink); }
.tl-axis__quiz { display: flex; flex-direction: column; gap: 8px; }
.tl-axis__opts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.tl-axis__opt {
  border: 1.5px solid var(--tl-line); background: #fff; border-radius: 12px; padding: 10px 6px; font-weight: 800;
  font-variant-numeric: tabular-nums; font-size: calc(19px * var(--wb-card-text-scale, 1));
}
.tl-axis__opt.good { background: #d1fae5; border-color: #059669; color: #059669; }
.tl-axis__opt.bad { background: #fee2e2; border-color: #b91c1c; color: #b91c1c; }
.tl-axis__qmsg { font-weight: 600; min-height: 21px; }
.tl-axis__side {
  border-left: 1px solid var(--tl-line); padding: 16px 18px; display: flex; flex-direction: column; gap: 14px;
  background: #fbfdfc;
}
.tl-axis__meter h3 {
  margin: 0 0 4px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--tl-ink3);
  font-size: calc(11px * var(--wb-card-text-scale, 1));
}
.tl-axis__row { display: flex; justify-content: space-between; gap: 8px; font-size: calc(13px * var(--wb-card-text-scale, 1)); }
.tl-axis__row b { font-variant-numeric: tabular-nums; }
.tl-axis__nav { display: flex; gap: 8px; margin-top: auto; }
.tl-axis__nav button {
  flex: 1; border: 1.5px solid var(--tl-line); background: #fff; border-radius: 10px; padding: 8px; font-weight: 600;
  color: var(--tl-ink2); font-size: calc(13px * var(--wb-card-text-scale, 1));
}
.tl-axis__nav button:disabled { opacity: 0.4; cursor: default; }
.tl-axis__prog { text-align: center; color: var(--tl-ink3); font-size: calc(12px * var(--wb-card-text-scale, 1)); }
</style>

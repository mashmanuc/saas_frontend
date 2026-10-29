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
      <!-- Низ картки за макетом дизайнера («Стрічка часу — низ картки», DATA/ПОЛА/істор.zip): велика дата поруч із
           назвою, етап з крапками, проміжок від попередньої події, лід крупніше й решта під «Читати далі», учасники
           фішками, сусідні події в кнопках, смужка прогресу. Усе — з полів подій, нічого не вигадано. -->
      <div class="tl-axis__top">
        <div
          v-if="showAnswer" :key="`big-${active.id}`" class="tl-axis__big" :class="{ 'is-range': !!endYear(active) }"
          data-testid="timeline-axis-big"
        >{{ bigDate(active) }}</div>
        <div class="tl-axis__meta">
          <span v-if="activeEra !== null" class="tl-axis__pill" data-testid="timeline-axis-era-pill">
            <span class="tl-axis__estep"><i v-for="i in eraEventIndexes" :key="i" :class="{ on: i === activeIndex }" /></span>
            {{ eras[activeEra].name }} · {{ eraYears(eras[activeEra]) }}
          </span>
          <span v-if="showAnswer && gapText" class="tl-axis__gap" data-testid="timeline-axis-gap">{{ gapText }}</span>
          <span v-if="showAnswer && fullDate" class="tl-axis__full">{{ fullDate }}</span>
        </div>
        <h2 class="tl-axis__title">{{ masked(active) }}</h2>
      </div>

      <div class="tl-axis__mid" :class="{ 'has-facts': hasFacts }">
        <div class="tl-axis__story">
          <template v-if="showAnswer && active.description">
            <!-- «Читати далі»: увесь вступ статті — лише цей екран, без запису (власник 2026-10-29) -->
            <p v-if="!(fullOpen && story.replace)" class="tl-axis__text" data-testid="timeline-axis-text">{{ story.lead }}</p>
            <p
              v-if="story.rest" class="tl-axis__rest" :class="{ open: fullOpen }" data-testid="timeline-axis-rest"
              @click.stop="fullOpen = !fullOpen" @mousedown.stop @pointerdown.stop
            >{{ story.rest }}</p>
            <button
              v-if="story.rest" type="button" class="tl-axis__more" data-testid="timeline-axis-more"
              @click.stop="fullOpen = !fullOpen" @mousedown.stop @pointerdown.stop
            >{{ fullOpen ? labels.less : labels.more }}</button>
            <p v-if="active.description_lang && active.description_lang !== language"
               class="tl-axis__lang" data-testid="timeline-axis-lang">{{ labels.articleLang[active.description_lang] }}</p>
          </template>
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
        </div>
        <aside v-if="hasFacts" class="tl-axis__facts">
          <div v-if="active.participants?.length" class="tl-axis__who">
            <h3>{{ labels.participants }}</h3>
            <div class="tl-axis__ppl">
              <span v-for="p in active.participants" :key="p"><i>{{ initials(p) }}</i>{{ p }}</span>
            </div>
          </div>
          <div v-if="active.kind">
            <h3>{{ labels.kind }}</h3>
            <span class="tl-axis__kind" data-testid="timeline-axis-kind">{{ active.kind }}</span>
          </div>
        </aside>
      </div>

      <div class="tl-axis__nb">
        <button
          v-for="side in neighbours" :key="side.dir" type="button" :disabled="!side.ev"
          :class="side.dir < 0 ? 'is-prev' : 'is-next'" :style="side.ev ? accentStyle(eraIndex(side.ev)) : undefined"
          :data-testid="side.dir < 0 ? 'timeline-axis-prev' : 'timeline-axis-next'"
          @click.stop="step(side.dir)" @mousedown.stop @pointerdown.stop
        >
          <span v-if="side.dir < 0" class="tl-axis__ar" aria-hidden="true">←</span>
          <span class="tl-axis__nbtx">
            <small>{{ side.small }}</small>
            <b><em v-if="side.date">{{ side.date }}</em>{{ side.title }}</b>
          </span>
          <span v-if="side.dir > 0" class="tl-axis__ar" aria-hidden="true">→</span>
        </button>
      </div>

      <div class="tl-axis__foot">
        <SourceList v-if="showAnswer" :sources="active.sources" :language="language" />
        <span v-else />
        <span class="tl-axis__prog" role="img" :aria-label="progressText" :title="progressText" data-testid="timeline-axis-prog">
          <i v-for="(ev, i) in events" :key="ev.id" :class="{ on: i === activeIndex, past: i < activeIndex }" />
        </span>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { WBTimelineEra, WBTimelineEvent } from '../../../types/winterboard'
import { TIMELINE_LABELS, formatTimelineDate, yearsText, type MaterialLanguage } from '../../../board/timelinePresentation'
import { isTimelinePlaying, setTimelinePlaying } from '../../../board/timelinePlayback'
import SourceList from './SourceList.vue'

const props = withDefaults(defineProps<{
  events: WBTimelineEvent[]
  eras?: WBTimelineEra[]
  activeId: string | null
  interactive?: boolean
  language?: MaterialLanguage
  /** Id картки: «▶ по черзі» — спільний стан екрана з пультом (LAW §9 v1.75). Без нього — лише цей екземпляр. */
  assetId?: string
}>(), { eras: () => [], interactive: true, language: 'uk', assetId: '' })

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
// ── Низ картки (макет дизайнера «низ картки») ─────────────────────────────
/** Події етапу активної — крапки «яка подія в етапі». */
const eraEventIndexes = computed(() => {
  const era = activeEra.value
  return era === null ? [] : props.events.map((e, i) => (eraIndex(e) === era ? i : -1)).filter(i => i >= 0)
})
/** Кінець події для проміжків: період — його кінець, точка — її рік. */
const lastYear = (ev: WBTimelineEvent) => endYear(ev) ?? startYear(ev)
const gapText = computed(() => {
  const prev = props.events[activeIndex.value - 1]
  const ev = active.value
  if (!ev || !prev) return ''
  const n = startYear(ev) - lastYear(prev)
  return n > 0 ? labels.value.after.replace('{n}', yearsText(n, props.language)).replace('{e}', prev.label) : ''
})
/** Сусідні події в кнопках: що було перед цією і що буде далі. У «Перевір себе» дат сусідів не видно. */
const neighbours = computed(() => {
  const ev = active.value
  return ([-1, 1] as const).map((dir) => {
    const other = ev ? props.events[activeIndex.value + dir] : undefined
    if (!ev || !other) {
      return { dir, ev: null, small: dir < 0 ? labels.value.first : labels.value.last,
               title: dir < 0 ? labels.value.start : labels.value.end, date: '' }
    }
    const word = dir < 0 ? labels.value.prev : labels.value.next
    if (quiz.value) return { dir, ev: other, small: word, title: masked(other), date: answers.value[other.id] ? bigDate(other) : '' }
    const n = dir < 0 ? startYear(ev) - lastYear(other) : startYear(other) - lastYear(ev)
    const when = n <= 0 ? labels.value.same
      : (dir < 0 ? labels.value.earlier : labels.value.later).replace('{n}', yearsText(n, props.language))
    return { dir, ev: other, small: `${word} · ${when}`, title: other.label, date: bigDate(other) }
  })
})
const hasFacts = computed(() => !!(active.value?.participants?.length || active.value?.kind))
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()

/**
 * Лід і решта: `description` — початок статті (1–2 речення, «…» в кінці, якщо урізано), `description_full` — увесь
 * вступ. Решта — те, що йде в повному тексті після ліду (пробіли й абзаци не враховуємо); не збіглось — під «Читати
 * далі» увесь вступ замість ліду.
 */
function restAfter(full: string, lead: string): string | null {
  let i = 0
  for (const ch of lead) {
    if (/\s/.test(ch)) continue
    while (i < full.length && /\s/.test(full[i])) i++
    if (full[i] !== ch) return null
    i++
  }
  return full.slice(i).trim()
}
const story = computed(() => {
  const ev = active.value
  const short = (ev?.description ?? '').trim()
  const full = (ev?.description_full ?? '').trim()
  if (!full) return { lead: short, rest: '', replace: false }
  const core = short.replace(/\s*…$/, '')
  const rest = restAfter(full, core)
  return rest === null ? { lead: short, rest: full, replace: true } : { lead: core, rest, replace: false }
})

const progressText = computed(() =>
  labels.value.progress.replace('{n}', String(activeIndex.value + 1)).replace('{m}', String(props.events.length)))

// ── «▶»: те саме «Наступна» раз на 4,5 с, до кінця шкали ──────────────────
// «Грає» — спільний стан екрана (`board/timelinePlayback`): ▶ на пульті вмикає саме цей таймер (LAW §9 v1.75).
const playKey = props.assetId || `timeline-local-${Math.random().toString(36).slice(2)}`
const playing = computed(() => isTimelinePlaying(playKey))
let timer: ReturnType<typeof setInterval> | null = null

function clearTimer(): void {
  if (timer) clearInterval(timer)
  timer = null
}

function stopPlay(): void {
  setTimelinePlaying(playKey, false)
}

function startTimer(): void {
  clearTimer()
  if (!props.events.length) { stopPlay(); return }
  if (activeIndex.value < 0 || activeIndex.value >= props.events.length - 1) emit('select', props.events[0].id)
  timer = setInterval(() => {
    if (activeIndex.value >= props.events.length - 1) { stopPlay(); return }
    step(1)
  }, PLAY_STEP_MS)
}

function togglePlay(): void {
  setTimelinePlaying(playKey, !playing.value)
}
watch(playing, (on) => (on ? startTimer() : clearTimer()), { immediate: true })
onBeforeUnmount(() => { clearTimer(); stopPlay() })

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
  /* Колонка: на всю дошку низ картки тягнеться до низу екрана, кнопки сусідів — унизу, а не посередині білого */
  display: flex; flex-direction: column;
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

.tl-axis__detail { border-top: 1px solid var(--tl-line); display: flex; flex-direction: column; flex: 1; }
/* Колір етапу — смуга згори й м'яке тло під датою й назвою (власник 2026-10-29: «кольорове, щоб запам'ятовувалось») */
.tl-axis__top {
  display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 22px; align-items: end; padding: 22px 22px 16px;
  background:
    linear-gradient(var(--tl-c), var(--tl-c)) top / 100% 5px no-repeat,
    linear-gradient(180deg, var(--tl-cb), rgba(255, 255, 255, 0) 92%);
}
.tl-axis__big {
  grid-row: span 2; font-weight: 800; line-height: 0.86; letter-spacing: -0.045em; color: var(--tl-c);
  font-variant-numeric: tabular-nums; font-size: calc(84px * var(--wb-card-text-scale, 1));
  animation: tl-pop 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2);
}
.tl-axis__big.is-range { font-size: calc(60px * var(--wb-card-text-scale, 1)); }
@keyframes tl-pop { from { opacity: 0; transform: translateY(10px) scale(0.96); } }
@media (prefers-reduced-motion: reduce) { .tl-axis__big { animation: none; } }
.tl-axis__meta {
  display: flex; gap: 8px; flex-wrap: wrap; align-items: center; color: var(--tl-ink3);
  font-size: calc(12.5px * var(--wb-card-text-scale, 1));
}
.tl-axis__pill {
  display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px 3px 8px; border-radius: 999px;
  background: var(--tl-cb); color: var(--tl-c); font-weight: 700; font-size: calc(12px * var(--wb-card-text-scale, 1));
}
.tl-axis__estep { display: inline-flex; gap: 3px; }
.tl-axis__estep i { width: 7px; height: 7px; border-radius: 50%; background: currentColor; opacity: 0.3; }
.tl-axis__estep i.on { opacity: 1; }
.tl-axis__gap { font-weight: 600; color: var(--tl-ink2); }
.tl-axis__full { color: var(--tl-ink3); }
.tl-axis__title {
  margin: 0; font-weight: 700; line-height: 1.1; letter-spacing: -0.015em; text-wrap: balance;
  font-size: calc(30px * var(--wb-card-text-scale, 1));
}
.tl-axis__mid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; padding: 4px 22px 18px; flex: 1; align-content: start; }
.tl-axis__mid.has-facts { grid-template-columns: minmax(0, 1fr) calc(240px * var(--wb-card-text-scale, 1)); }
.tl-axis__story { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; }
.tl-axis__text {
  margin: 0; color: var(--tl-ink); font-weight: 500; line-height: 1.45; max-width: 62ch; text-wrap: pretty;
  font-size: calc(19px * var(--wb-card-text-scale, 1));
}
.tl-axis__rest {
  position: relative; margin: 10px 0 0; color: var(--tl-ink2); max-width: 62ch; text-wrap: pretty; white-space: pre-line;
  max-height: 4.6em; overflow: hidden; cursor: pointer; pointer-events: auto;
  font-size: calc(15.5px * var(--wb-card-text-scale, 1));
}
.tl-axis__rest::after {
  content: ''; position: absolute; inset: auto 0 0 0; height: 2.4em; pointer-events: none;
  background: linear-gradient(rgba(255, 255, 255, 0), #fff);
}
.tl-axis__rest.open { max-height: 15em; overflow-y: auto; }
.tl-axis__rest.open::after { display: none; }
/* «Читати далі / Згорнути» — видно, що це кнопка: колір етапу, рамка. Подвійний клас — сильніше за загальне
   `.tl-axis button { color: inherit; font: inherit }`, через яке «згорнути» було схоже на звичайний текст. */
.tl-axis .tl-axis__more {
  margin-top: 10px; border: 1.5px solid var(--tl-c); background: #fff; border-radius: 999px; padding: 4px 14px;
  color: var(--tl-c); font-weight: 700; font-size: calc(13.5px * var(--wb-card-text-scale, 1));
}
.tl-axis .tl-axis__more:hover { background: var(--tl-cb); }
.tl-axis__lang { margin: 6px 0 0; color: var(--tl-ink3); font-style: italic; font-size: calc(12px * var(--wb-card-text-scale, 1)); }
.tl-axis__facts { display: flex; flex-direction: column; gap: 14px; }
.tl-axis__facts h3 {
  margin: 0 0 6px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--tl-ink3);
  font-size: calc(11px * var(--wb-card-text-scale, 1));
}
.tl-axis__ppl { display: flex; flex-wrap: wrap; gap: 6px; }
.tl-axis__ppl span {
  display: inline-flex; align-items: center; gap: 7px; padding: 4px 10px 4px 4px; border-radius: 999px;
  background: #f3f7f6; font-weight: 600; font-size: calc(13px * var(--wb-card-text-scale, 1));
}
.tl-axis__ppl i {
  width: 24px; height: 24px; border-radius: 50%; background: var(--tl-cb); color: var(--tl-c); display: grid;
  place-items: center; font-style: normal; font-weight: 800; font-size: calc(11px * var(--wb-card-text-scale, 1));
}
.tl-axis__kind {
  display: inline-flex; padding: 4px 12px; border-radius: 999px; border: 1.5px solid var(--tl-line); font-weight: 600;
  color: var(--tl-ink2); font-size: calc(13px * var(--wb-card-text-scale, 1));
}
.tl-axis__quiz { display: flex; flex-direction: column; gap: 8px; align-self: stretch; }
.tl-axis__opts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.tl-axis__opt {
  border: 1.5px solid var(--tl-line); background: #fff; border-radius: 12px; padding: 10px 6px; font-weight: 800;
  font-variant-numeric: tabular-nums; font-size: calc(19px * var(--wb-card-text-scale, 1));
}
.tl-axis__opt.good { background: #d1fae5; border-color: #059669; color: #059669; }
.tl-axis__opt.bad { background: #fee2e2; border-color: #b91c1c; color: #b91c1c; }
.tl-axis__qmsg { font-weight: 600; min-height: 21px; }
.tl-axis__nb { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--tl-line); }
.tl-axis__nb button {
  display: flex; align-items: center; gap: 14px; border: 0; background: #fbfdfc; padding: 14px 22px; text-align: left;
  min-width: 0; transition: background 0.15s;
}
.tl-axis__nb button.is-next { border-left: 1px solid var(--tl-line); justify-content: flex-end; text-align: right; }
.tl-axis__nb button:hover:not(:disabled) { background: var(--tl-cb); }
.tl-axis__nb button:disabled { cursor: default; opacity: 0.45; }
.tl-axis__ar {
  flex: 0 0 40px; width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid var(--tl-line); display: grid;
  place-items: center; color: var(--tl-ink2); background: #fff; transition: border-color 0.15s, color 0.15s, transform 0.15s;
  font-size: calc(17px * var(--wb-card-text-scale, 1));
}
.tl-axis__nb button:hover:not(:disabled) .tl-axis__ar { border-color: var(--tl-c); color: var(--tl-c); }
.tl-axis__nb button.is-prev:hover:not(:disabled) .tl-axis__ar { transform: translateX(-3px); }
.tl-axis__nb button.is-next:hover:not(:disabled) .tl-axis__ar { transform: translateX(3px); }
.tl-axis__nbtx { min-width: 0; display: flex; flex-direction: column; }
.tl-axis__nbtx small { color: var(--tl-ink3); font-weight: 600; font-size: calc(11.5px * var(--wb-card-text-scale, 1)); }
.tl-axis__nbtx b {
  color: var(--tl-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  font-size: calc(15px * var(--wb-card-text-scale, 1));
}
.tl-axis__nbtx em { font-style: normal; color: var(--tl-c); font-variant-numeric: tabular-nums; margin-right: 6px; }
.tl-axis__foot {
  display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 22px;
  border-top: 1px solid var(--tl-line); color: var(--tl-ink3); font-size: calc(12.5px * var(--wb-card-text-scale, 1));
}
.tl-axis__prog { display: flex; gap: 3px; align-items: center; }
.tl-axis__prog i { width: 16px; height: 4px; border-radius: 2px; background: #dfe7e4; }
.tl-axis__prog i.past { background: color-mix(in oklch, var(--tl-c) 40%, #dfe7e4); }
.tl-axis__prog i.on { background: var(--tl-c); }
</style>

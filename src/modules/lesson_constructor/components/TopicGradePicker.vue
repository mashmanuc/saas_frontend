<!--
  TopicGradePicker — вибір теми «За класом» (власник 2026-10-21; макет дизайнера «Вибір теми», варіант D).

  Рядок класів 5–11 і «НМТ». Клас → пошук у класі й розділи програми по курсах, у порядку календарних планів
  (`curriculum.ts`). Розділ з однією темою обирає її одразу; розділ з кількома розкривається: «Про що саме урок?».
  «НМТ» лише перемикає вигляд — дерево тем і пошук по ньому малює сторінка конструктора, як і раніше.
  Компонент нічого не пише сам: обрану тему віддає подією `pick`.
-->
<template>
  <div class="tgp">
    <div class="tgp-grades" role="group" aria-label="Клас учня">
      <button
        v-for="g in GRADES"
        :key="g"
        type="button"
        class="tgp-grade"
        :class="{ 'tgp-grade--on': view === g }"
        :aria-pressed="view === g"
        :data-testid="`topic-grade-${g}`"
        @click="choose(g)"
      >{{ g }}<small>клас</small></button>
      <span class="tgp-sep" aria-hidden="true" />
      <button
        type="button"
        class="tgp-grade"
        :class="{ 'tgp-grade--on': view === 'nmt' }"
        :aria-pressed="view === 'nmt'"
        data-testid="topic-grade-nmt"
        @click="choose('nmt')"
      >НМТ<small>усі теми</small></button>
    </div>

    <p v-if="view === null" class="tgp-note">Оберіть клас учня — побачите лише теми його програми.</p>

    <template v-else-if="view !== 'nmt'">
      <label class="tgp-search">
        <span aria-hidden="true">🔍</span>
        <input v-model="query" type="search" :placeholder="`Пошук у ${view} класі…`" data-testid="topic-grade-search">
      </label>
      <div class="tgp-tracks" :class="{ 'tgp-tracks--one': tracks.length === 1 }">
        <div v-for="t in tracks" :key="t.track" class="tgp-track">
          <h3 class="tgp-track__head"><span>{{ t.label }}</span><span>{{ t.units.length }} {{ topicWord(t.units.length) }}</span></h3>
          <template v-for="u in shown(t)" :key="u.no">
            <button
              type="button"
              class="tgp-unit"
              :class="{ 'tgp-unit--on': unitPicked(u), 'tgp-unit--open': isOpen(t.track, u) }"
              :aria-expanded="u.topics.length > 1 ? isOpen(t.track, u) : undefined"
              :data-testid="`topic-unit-${t.track}-${u.no}`"
              @click="clickUnit(t, u)"
            >
              <span class="tgp-unit__no">{{ u.no }}</span>
              <span class="tgp-unit__title">{{ u.title }}</span>
              <span v-if="u.topics.length > 1" class="tgp-unit__more">{{ isOpen(t.track, u) ? '▾' : '▸' }}</span>
            </button>
            <div v-if="u.topics.length > 1 && isOpen(t.track, u)" class="tgp-refine">
              <p class="tgp-refine__q">Про що саме урок?</p>
              <button
                v-for="id in u.topics"
                :key="id"
                type="button"
                class="tgp-chip"
                :class="{ 'tgp-chip--on': selected.includes(id) }"
                :data-testid="`topic-refine-${id}`"
                @click="emit('pick', id)"
              >{{ labels[id] }}</button>
            </div>
          </template>
          <p v-if="!shown(t).length" class="tgp-note">Немає збігів.</p>
        </div>
      </div>
      <p class="tgp-note">Розділи — у порядку шкільної програми, з ваших календарних планів.</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { GRADES } from '../curriculum'
import { filterUnits, gradeTracks, type GradeTrack, type GradeUnit, type TopicView } from '../topicByGrade'

const props = defineProps<{
  view: TopicView | null
  /** Обрані теми конструктора (id). */
  selected: readonly string[]
  /** Назви тем конструктора за id (з `TOPICS`). */
  labels: Readonly<Record<string, string>>
}>()

const emit = defineEmits<{
  'update:view': [view: TopicView]
  /** Тема конструктора, про яку буде урок. */
  pick: [topicId: string]
}>()

const query = ref('')
const openKey = ref<string | null>(null)

const tracks = computed<GradeTrack[]>(() =>
  typeof props.view === 'number' ? gradeTracks(props.view, props.labels) : [])

watch(() => props.view, () => { query.value = ''; openKey.value = null })

function choose(view: TopicView) {
  emit('update:view', view)
}

function shown(t: GradeTrack): GradeUnit[] {
  return filterUnits(t.units, query.value, props.labels)
}

const keyOf = (track: string, u: GradeUnit) => `${track}:${u.no}`
function isOpen(track: string, u: GradeUnit): boolean {
  // Під час пошуку розділ зі збігом у назві теми розкритий одразу — інакше збіг не видно.
  return openKey.value === keyOf(track, u) || (!!query.value.trim() && u.topics.length > 1
    && u.topics.some((id) => (props.labels[id] ?? '').toLowerCase().includes(query.value.trim().toLowerCase())))
}

function unitPicked(u: GradeUnit): boolean {
  return u.topics.some((id) => props.selected.includes(id))
}

function clickUnit(t: GradeTrack, u: GradeUnit) {
  if (u.topics.length === 1) {
    emit('pick', u.topics[0])
    return
  }
  const key = keyOf(t.track, u)
  openKey.value = openKey.value === key ? null : key
}

function topicWord(n: number): string {
  const d = n % 10, h = n % 100
  if (d === 1 && h !== 11) return 'розділ'
  return d >= 2 && d <= 4 && (h < 10 || h >= 20) ? 'розділи' : 'розділів'
}
</script>

<style scoped>
/* Кольори — ті самі, що в чипів тем сторінки конструктора (`--accent`), темна тема — блоком нижче. */
.tgp { display: flex; flex-direction: column; gap: 0.9rem; }

.tgp-grades { display: flex; flex-wrap: wrap; gap: 6px; }
.tgp-grade {
  min-width: 54px;
  display: flex; flex-direction: column; align-items: center;
  padding: 0.55rem 0.7rem;
  border: 1.5px solid #cbd5e1; border-radius: 12px;
  background: #fff; color: #334155;
  font-size: 1rem; font-weight: 700; line-height: 1.1;
  cursor: pointer;
}
.tgp-grade small { margin-top: 3px; font-size: 0.66rem; font-weight: 600; color: #64748b; }
.tgp-grade:hover { border-color: var(--accent); color: var(--accent); }
.tgp-grade--on, .tgp-grade--on:hover { background: var(--accent); border-color: var(--accent); color: var(--color-on-accent); }
.tgp-grade--on small { color: inherit; opacity: 0.85; }
.tgp-sep { width: 1px; margin: 4px; background: #e2e8f0; }

.tgp-search {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.6rem 0.8rem;
  border: 1.5px solid #cbd5e1; border-radius: 12px;
  background: #fff;
}
.tgp-search:focus-within { border-color: var(--accent); }
.tgp-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; color: inherit; }

.tgp-tracks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.1rem; }
.tgp-tracks--one { grid-template-columns: minmax(0, 1fr); }
@media (max-width: 760px) { .tgp-tracks { grid-template-columns: minmax(0, 1fr); } }
.tgp-track { min-width: 0; }
.tgp-track__head {
  display: flex; justify-content: space-between;
  margin: 0 0 0.5rem;
  font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
  color: #64748b;
}

.tgp-unit {
  display: flex; align-items: center; gap: 0.7rem;
  width: 100%;
  margin-bottom: 6px; padding: 0.6rem 0.75rem;
  border: 1px solid #e2e8f0; border-radius: 10px;
  background: #fff; color: #1e293b;
  text-align: left; font: inherit; font-size: 0.9rem; line-height: 1.3;
  cursor: pointer;
}
.tgp-unit:hover { border-color: var(--accent); }
.tgp-unit--on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, #fff); }
.tgp-unit__no {
  flex: none; display: grid; place-items: center;
  width: 24px; height: 24px; border-radius: 7px;
  background: color-mix(in srgb, var(--accent) 12%, #fff); color: var(--accent);
  font-size: 0.75rem; font-weight: 800;
}
.tgp-unit--on .tgp-unit__no { background: var(--accent); color: var(--color-on-accent); }
.tgp-unit__title { flex: 1; min-width: 0; }
.tgp-unit__more { color: #64748b; }

.tgp-refine {
  display: flex; flex-wrap: wrap; gap: 6px;
  margin: -2px 0 10px; padding: 0.55rem 0.75rem 0.65rem 2.6rem;
}
.tgp-refine__q { flex-basis: 100%; margin: 0 0 2px; font-size: 0.78rem; color: #64748b; }
.tgp-chip {
  max-width: 100%;
  padding: 0.35rem 0.85rem;
  border: 1.5px solid #cbd5e1; border-radius: 999px;
  background: #f8fafc; color: #475569;
  font: inherit; font-size: 0.85rem; white-space: normal; text-align: left;
  cursor: pointer;
}
.tgp-chip:hover { border-color: var(--accent); color: var(--accent); }
.tgp-chip--on, .tgp-chip--on:hover { background: var(--accent); border-color: var(--accent); color: var(--color-on-accent); }

.tgp-note { margin: 0; font-size: 0.85rem; color: #64748b; }

/* ── Темна тема — лише токени, світла тема вище не змінюється ── */
[data-theme="dark"] .tgp-grade,
[data-theme="dark"] .tgp-search,
[data-theme="dark"] .tgp-unit {
  background: var(--color-surface-sunken); border-color: var(--color-border-strong); color: var(--color-text-primary);
}
[data-theme="dark"] .tgp-grade small,
[data-theme="dark"] .tgp-track__head,
[data-theme="dark"] .tgp-unit__more,
[data-theme="dark"] .tgp-refine__q,
[data-theme="dark"] .tgp-note { color: var(--color-text-secondary); }
[data-theme="dark"] .tgp-sep { background: var(--color-border); }
[data-theme="dark"] .tgp-chip {
  background: var(--color-surface-sunken); border-color: var(--color-border-strong); color: var(--color-text-secondary);
}
[data-theme="dark"] .tgp-unit--on { background: var(--color-accent-soft); border-color: var(--color-accent); }
[data-theme="dark"] .tgp-unit__no { background: var(--color-accent-soft); color: var(--color-accent); }
[data-theme="dark"] .tgp-grade--on,
[data-theme="dark"] .tgp-chip--on,
[data-theme="dark"] .tgp-unit--on .tgp-unit__no {
  background: var(--color-accent); border-color: var(--color-accent); color: var(--color-on-accent);
}
</style>

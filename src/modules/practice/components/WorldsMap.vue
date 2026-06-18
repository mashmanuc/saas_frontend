<!--
  WorldsMap — F2 мапа світів (порт дизайну клод-дизайн → Vue).
  Дизайн: design_handoff/from_designer/worlds.html. Дані: props.worlds (/worlds/).
  Тему ([data-theme]) і шрифти надає застосунок; локальні helper-токени — нижче у <style>.
-->
<template>
  <div class="wm">
    <div class="summary">
      <div class="summary__ring" :style="{ '--p': donePct }"><span>{{ donePct }}%</span></div>
      <div class="summary__txt">
        <b>{{ t('practice.progress.summaryWorlds', { done: doneCount, total: worlds.length }) }}</b>
        <p>{{ artsCount ? t('practice.progress.summaryArts', { count: artsCount }) : t('practice.progress.summaryArtsZero') }}</p>
      </div>
    </div>

    <div class="journey" ref="journeyEl">
      <svg class="journey__path" ref="svgEl" aria-hidden="true" preserveAspectRatio="none">
        <path class="track" ref="trackEl" d="" />
        <path class="track-dash" ref="dashEl" d="" />
        <path class="lit" ref="litEl" d="" />
      </svg>

      <div
        v-for="(w, i) in worlds"
        :key="w.id"
        class="world"
        :class="`world--${w.status}`"
        :data-world="w.id"
        :data-biome="w.theme"
      >
        <div class="world__node">
          <svg v-if="w.status === 'done'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7" /></svg>
          <template v-else-if="w.status === 'active'">
            <span class="ring" :style="{ '--np': pct(w) }" />
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          </template>
          <template v-else>{{ i + 1 }}</template>
        </div>

        <div class="world__card">
          <div class="world__head">
            <span class="biome-tag">{{ biomeLabel(w.theme) }}</span>
            <span class="state-tag"><span class="dot" />{{ statusLabel(w.status) }}</span>
          </div>
          <h2 class="world__title">{{ w.title }}</h2>
          <p class="world__meta">{{ metaText(w) }}</p>
          <div class="world__bar"><div class="world__fill" :style="{ width: pct(w) + '%' }" /></div>

          <div v-if="w.artifact" class="reward" :class="{ 'reward--locked': !w.artifact_unlocked }">
            <div class="reward__thumb">
              <img
                :src="artUrl(w.artifact.preview)"
                :alt="w.artifact_unlocked ? w.artifact.title : t('practice.progress.hiddenArtifact')"
                loading="lazy"
              />
              <span v-if="!w.artifact_unlocked" class="reward__lock">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
              </span>
            </div>
            <div class="reward__info">
              <p class="reward__label">{{ w.artifact_unlocked ? t('practice.progress.rewardLabel') : t('practice.progress.rewardLabelLocked') }}</p>
              <p class="reward__name">{{ w.artifact_unlocked ? w.artifact.title : '? ? ?' }}</p>
            </div>
            <span class="reward__badge">
              <span class="artifact" :class="w.artifact_unlocked ? 'artifact--unlocked' : 'artifact--locked'">
                <svg v-if="w.artifact_unlocked" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9z" /><path d="M2 9h20" /></svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                {{ w.artifact_unlocked ? t('practice.progress.badgeEarned') : t('practice.progress.badgeReward') }}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="legend">
      <span><i style="background:var(--success-bg)" /> {{ t('practice.progress.status.done') }}</span>
      <span><i style="background:var(--warning-bg)" /> {{ t('practice.progress.status.active') }}</span>
      <span><i style="background:var(--track-dot)" /> {{ t('practice.progress.ahead') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { World } from '../api/practiceApi'

const props = defineProps<{ worlds: World[] }>()
const { t } = useI18n()

const journeyEl = ref<HTMLElement>()
const svgEl = ref<SVGSVGElement>()
const trackEl = ref<SVGPathElement>()
const dashEl = ref<SVGPathElement>()
const litEl = ref<SVGPathElement>()

const doneCount = computed(() => props.worlds.filter((w) => w.status === 'done').length)
const artsCount = computed(() => props.worlds.filter((w) => w.artifact_unlocked).length)
const donePct = computed(() => (props.worlds.length ? Math.round((doneCount.value / props.worlds.length) * 100) : 0))

function pct(w: World): number {
  return w.total ? Math.round((w.completed_count / w.total) * 100) : 0
}
function statusLabel(s: World['status']): string {
  return t(`practice.progress.status.${s}`)
}
function biomeLabel(theme: string): string {
  return t(`practice.progress.biome.${theme}`)
}
function metaText(w: World): string {
  if (w.status === 'done') return t('practice.progress.allMastered', { total: w.total })
  return `${t('practice.progress.topicsProgress', { done: w.completed_count, total: w.total })} · ${statusLabel(w.status)}`
}
function artUrl(preview: string | null | undefined): string {
  return preview ? `/practice/artifacts/${preview}` : ''
}

function buildPath(arr: number[][]): string {
  if (arr.length < 2) return ''
  let s = `M ${arr[0][0]} ${arr[0][1]}`
  for (let i = 1; i < arr.length; i++) {
    const [x0, y0] = arr[i - 1]
    const [x1, y1] = arr[i]
    const my = (y0 + y1) / 2
    s += ` C ${x0} ${my} ${x1} ${my} ${x1} ${y1}`
  }
  return s
}

function drawPath(): void {
  const journey = journeyEl.value
  if (!journey || !svgEl.value || !trackEl.value || !dashEl.value || !litEl.value) return
  const nodes = [...journey.querySelectorAll('.world__node')]
  if (!nodes.length) return
  const jb = journey.getBoundingClientRect()
  svgEl.value.setAttribute('viewBox', `0 0 ${jb.width} ${jb.height}`)
  const pts = nodes.map((n) => {
    const b = n.getBoundingClientRect()
    return [b.left - jb.left + b.width / 2, b.top - jb.top + b.height / 2]
  })
  const full = buildPath(pts)
  trackEl.value.setAttribute('d', full)
  dashEl.value.setAttribute('d', full)

  let frontier = -1
  props.worlds.forEach((w, i) => {
    if (w.status !== 'new') frontier = i
  })
  litEl.value.setAttribute('d', frontier >= 0 ? buildPath(pts.slice(0, frontier + 1)) : '')
}

let ro: ResizeObserver | null = null
onMounted(() => {
  drawPath()
  ro = new ResizeObserver(drawPath)
  if (journeyEl.value) ro.observe(journeyEl.value)
  window.addEventListener('resize', drawPath)
  if (document.fonts?.ready) document.fonts.ready.then(drawPath)
  setTimeout(drawPath, 300)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('resize', drawPath)
})
watch(() => props.worlds, () => nextTick(drawPath), { deep: true })
</script>

<style scoped>
.wm {
  --accent-soft: rgba(4, 120, 87, 0.12);
  --track: rgba(5, 150, 105, 0.22);
  --track-dot: rgba(5, 150, 105, 0.35);
  --art-bg: #05070d;
  --font-display: 'Space Grotesk', var(--font-sans, system-ui, sans-serif);
  --shadow-sm: 0 1px 2px rgba(6, 30, 24, 0.06);
  --shadow-md: 0 4px 14px rgba(6, 30, 24, 0.10);
}
[data-theme="dark"] .wm {
  --accent-soft: rgba(56, 189, 248, 0.14);
  --track: rgba(56, 189, 248, 0.20);
  --track-dot: rgba(56, 189, 248, 0.34);
  --art-bg: #03050a;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 6px 18px rgba(0, 0, 0, 0.45);
}

.world[data-biome="foundations"]    { --bh: 322; }
.world[data-biome="algebra"]        { --bh: 190; }
.world[data-biome="analysis"]       { --bh: 150; }
.world[data-biome="plane-geometry"] { --bh: 42; }
.world[data-biome="solid-geometry"] { --bh: 210; }
.world[data-biome="vectors"]        { --bh: 278; }
.world[data-biome="probability"]    { --bh: 14; }
.world { --biome: hsl(var(--bh) 70% 42%); --biome-soft: hsl(var(--bh) 72% 46% / 0.12); --biome-ring: hsl(var(--bh) 75% 50% / 0.35); }
[data-theme="dark"] .world { --biome: hsl(var(--bh) 80% 66%); --biome-soft: hsl(var(--bh) 80% 60% / 0.16); --biome-ring: hsl(var(--bh) 85% 62% / 0.40); }

.summary { display: flex; align-items: center; gap: 14px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: var(--radius-xl, 16px); padding: 14px 16px; margin: 4px 0 26px; box-shadow: var(--shadow-sm); }
.summary__ring { width: 50px; height: 50px; flex-shrink: 0; border-radius: 9999px; display: grid; place-items: center; background: conic-gradient(var(--accent) calc(var(--p) * 1%), var(--track) 0); }
.summary__ring span { width: 40px; height: 40px; border-radius: 9999px; background: var(--card-bg); display: grid; place-items: center; font: 700 0.8rem var(--font-display); color: var(--accent); }
.summary__txt b { font-size: 0.95rem; }
.summary__txt p { margin: 2px 0 0; font-size: 0.8rem; color: var(--text-secondary); }

.journey { position: relative; display: flex; flex-direction: column; gap: 26px; }
.journey__path { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; overflow: visible; }
.journey__path .track { fill: none; stroke: var(--track); stroke-width: 14; stroke-linecap: round; }
.journey__path .track-dash { fill: none; stroke: var(--track-dot); stroke-width: 2.5; stroke-linecap: round; stroke-dasharray: 1 13; opacity: 0.8; }
.journey__path .lit { fill: none; stroke: var(--accent); stroke-width: 6; stroke-linecap: round; opacity: 0.9; filter: drop-shadow(0 0 6px var(--accent-soft)); }

.world { position: relative; z-index: 1; display: flex; align-items: center; gap: 16px; }
.world:nth-child(even) { flex-direction: row-reverse; }
.world__node { position: relative; width: 64px; height: 64px; flex: 0 0 64px; border-radius: 9999px; display: grid; place-items: center; font: 700 1.1rem var(--font-display); background: var(--bg-secondary); color: var(--text-secondary); border: 2.5px solid var(--track); box-shadow: var(--shadow-md); }
.world__node::after { content: ""; position: absolute; inset: -9px; border-radius: 9999px; border: 2px dashed var(--track-dot); opacity: 0.5; }
.world__node svg { width: 26px; height: 26px; }
.world--active .world__node { color: #fff; background: var(--biome); border-color: transparent; box-shadow: 0 0 0 5px var(--biome-ring), var(--shadow-md); }
.world--active .world__node::after { display: none; }
.world--done .world__node { color: #fff; background: var(--biome); border-color: transparent; box-shadow: 0 0 0 5px var(--biome-ring), 0 0 22px var(--biome-ring), var(--shadow-md); }
.world--done .world__node::after { border-color: var(--biome); opacity: 0.55; }
.world__node .ring { position: absolute; inset: -9px; border-radius: 9999px; background: conic-gradient(var(--biome) calc(var(--np) * 1%), transparent 0); -webkit-mask: radial-gradient(circle, transparent 30px, #000 31px); mask: radial-gradient(circle, transparent 30px, #000 31px); }

.world__card { flex: 1; min-width: 0; position: relative; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: var(--radius-xl, 16px); padding: 14px 15px; box-shadow: var(--shadow-sm); overflow: hidden; }
.world__card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--biome); opacity: 0.85; }
.world:nth-child(even) .world__card::before { left: auto; right: 0; }
.world--new .world__card { opacity: 0.92; }
.world--new .world__card::before { opacity: 0.4; }
.world__head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.biome-tag { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--biome); background: var(--biome-soft); padding: 3px 8px; border-radius: 9999px; }
.state-tag { margin-left: auto; font-size: 0.68rem; font-weight: 600; color: var(--text-secondary); display: inline-flex; align-items: center; gap: 4px; }
.state-tag .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--track-dot); }
.world--active .state-tag .dot { background: var(--warning-bg); }
.world--done .state-tag .dot { background: var(--success-bg); }
.world__title { font-family: var(--font-display); font-weight: 600; font-size: 1.02rem; margin: 7px 0 0; letter-spacing: -0.01em; }
.world__meta { font-size: 0.78rem; color: var(--text-secondary); margin: 3px 0 0; }
.world__bar { position: relative; height: 7px; background: var(--accent-soft); border-radius: 9999px; overflow: hidden; margin: 10px 0 0; }
.world__fill { height: 100%; border-radius: 9999px; background: var(--biome); transition: width 0.3s; }
.world--done .world__fill { background: var(--success-bg); }

.reward { display: flex; align-items: center; gap: 10px; margin-top: 12px; padding: 9px; border-radius: var(--radius-lg, 12px); border: 1px solid var(--border-color); }
.reward__thumb { position: relative; width: 46px; height: 46px; flex-shrink: 0; border-radius: var(--radius-md, 8px); overflow: hidden; background: var(--art-bg); }
.reward__thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.reward__info { min-width: 0; }
.reward__label { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-secondary); margin: 0; }
.reward__name { font-size: 0.82rem; font-weight: 600; margin: 2px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.reward__badge { margin-left: auto; flex-shrink: 0; }
.artifact { display: inline-flex; align-items: center; gap: 5px; font-size: 0.66rem; font-weight: 700; padding: 5px 9px; border-radius: 9999px; white-space: nowrap; }
.artifact svg { width: 13px; height: 13px; }
.artifact--unlocked { color: #fff; background: var(--biome); box-shadow: 0 0 14px var(--biome-ring); }
.artifact--locked { color: var(--text-secondary); background: transparent; border: 1px solid var(--border-color); }
.reward--locked .reward__thumb img { filter: grayscale(1) brightness(0.5) contrast(0.9); opacity: 0.55; }
.reward--locked .reward__thumb::after { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 50% 45%, transparent 30%, var(--art-bg) 95%); }
.reward--locked .reward__lock { position: absolute; inset: 0; display: grid; place-items: center; color: #fff; opacity: 0.85; }
.reward--locked .reward__lock svg { width: 18px; height: 18px; }

.legend { display: flex; flex-wrap: wrap; gap: 14px; margin: 30px 0 0; padding-top: 18px; border-top: 1px solid var(--border-color); font-size: 0.74rem; color: var(--text-secondary); }
.legend span { display: inline-flex; align-items: center; gap: 6px; }
.legend i { width: 11px; height: 11px; border-radius: 50%; }

@media (max-width: 420px) {
  .world { gap: 11px; }
  .world__node { width: 56px; height: 56px; flex-basis: 56px; font-size: 1rem; }
  .world__card { padding: 12px 13px; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>

<!--
  ArtifactCollection — F2 «трофейна кімната» (порт дизайну → Vue).
  Дизайн: design_handoff/from_designer/collection.html. Дані: /collection/ (повний каталог 9).
  Hue — суто FE-стайлінг (підсвітка). Тему/шрифти надає застосунок.
  Celebration-модалку (демо в дизайні) відкладено — спрацьовуватиме на submit.unlocked (наступний крок).
-->
<template>
  <div class="ac">
    <div class="counter">
      <div class="counter__ring" :style="{ '--p': pct }"><b>{{ pct }}%</b></div>
      <div>
        <p class="count">{{ t('practice.progress.collectionCount', { have: collection.unlocked_count, total: collection.total_artifacts }) }}</p>
        <p class="counter__sub">{{ t('practice.progress.collectionSub') }}</p>
      </div>
    </div>
    <p class="hint">{{ t('practice.progress.collectionHint') }}</p>

    <div class="grid">
      <div
        v-for="a in collection.artifacts"
        :key="a.id"
        class="art"
        :class="{ 'art--locked': !a.unlocked }"
        :data-artifact="a.id"
        data-hue
        :style="{ '--h': ARTIFACT_HUE[a.id] ?? 200 }"
      >
        <div class="art__media">
          <img
            class="art__img"
            :src="artUrl(a.preview)"
            :alt="a.unlocked ? a.title : t('practice.progress.hiddenArtifact')"
            :aria-hidden="!a.unlocked"
            loading="lazy"
          />
          <div v-if="!a.unlocked" class="art__lock">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            <small>{{ t('practice.progress.locked') }}</small>
          </div>
        </div>
        <div class="art__body">
          <p class="art__title">{{ a.unlocked ? a.title : '? ? ?' }}</p>
          <span class="art__src">
            <svg v-if="a.unlocked && a.source && a.source.startsWith('world:')" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 2.5 15 0 18M12 3c-2.5 2.7-2.5 15 0 18" /></svg>
            <svg v-else-if="a.unlocked" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2H22l-6 4.4 2.3 7.2L12 16.4 5.7 20.8 8 13.6 2 9.2h7.6z" /></svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            <span>{{ a.unlocked ? sourceLabel(a.source) : t('practice.progress.ahead') }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Collection, World } from '../api/practiceApi'
import { ARTIFACT_HUE } from '../constants'

const props = defineProps<{ collection: Collection; worlds: World[] }>()
const { t } = useI18n()

const pct = computed(() => {
  const t2 = props.collection.total_artifacts
  return t2 ? Math.round((props.collection.unlocked_count / t2) * 100) : 0
})

function artUrl(preview: string | null): string {
  return preview ? `/practice/artifacts/${preview}` : ''
}

function sourceLabel(source: string | null): string {
  if (!source) return ''
  if (source.startsWith('world:')) {
    const slug = source.slice(6)
    const w = props.worlds.find((x) => x.id === slug)
    return t('practice.progress.sourceWorld', { world: w?.title ?? slug })
  }
  if (source.startsWith('xp:')) return t('practice.progress.sourceXp', { n: source.slice(3) })
  if (source.startsWith('streak:')) return t('practice.progress.sourceStreak', { n: source.slice(7) })
  return source
}
</script>

<style scoped>
.ac {
  --accent-soft: rgba(4, 120, 87, 0.12);
  --art-bg: #05070d;
  --font-display: 'Space Grotesk', var(--font-sans, system-ui, sans-serif);
  --shadow-sm: 0 1px 2px rgba(6, 30, 24, 0.06);
}
[data-theme="dark"] .ac {
  --accent-soft: rgba(56, 189, 248, 0.14);
  --art-bg: #03050a;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
}
.art[data-hue] { --bc: hsl(var(--h) 75% 50%); --bc-soft: hsl(var(--h) 80% 55% / 0.22); }
[data-theme="dark"] .art[data-hue] { --bc: hsl(var(--h) 85% 64%); --bc-soft: hsl(var(--h) 85% 62% / 0.30); }

.counter { display: flex; align-items: center; gap: 14px; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: var(--radius-xl, 16px); padding: 14px 16px; margin: 4px 0 8px; box-shadow: var(--shadow-sm); }
.counter__ring { width: 54px; height: 54px; flex-shrink: 0; border-radius: 9999px; display: grid; place-items: center; background: conic-gradient(var(--accent) calc(var(--p) * 1%), var(--accent-soft) 0); }
.counter__ring b { width: 42px; height: 42px; border-radius: 9999px; background: var(--card-bg); display: grid; place-items: center; font: 700 0.82rem var(--font-display); color: var(--accent); }
.count { font-family: var(--font-display); font-weight: 600; font-size: 1rem; margin: 0; }
.counter__sub { font-size: 0.8rem; color: var(--text-secondary); margin: 3px 0 0; }
.hint { font-size: 0.78rem; color: var(--text-secondary); margin: 0 0 18px; opacity: 0.85; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
@media (max-width: 380px) { .grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 11px; } }

.art { position: relative; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: var(--radius-lg, 12px); overflow: hidden; display: flex; flex-direction: column; box-shadow: var(--shadow-sm); transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s; }
.art:not(.art--locked):hover { transform: translateY(-3px); border-color: var(--bc); box-shadow: 0 10px 30px var(--bc-soft); }
.art__media { position: relative; aspect-ratio: 1; background: var(--art-bg); overflow: hidden; }
.art__img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s; }
.art:not(.art--locked):hover .art__img { transform: scale(1.05); }
.art__media::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(120% 80% at 50% 120%, var(--bc-soft), transparent 60%); mix-blend-mode: screen; }
.art__body { padding: 10px 11px 12px; }
.art__title { font-family: var(--font-display); font-size: 0.86rem; font-weight: 600; margin: 0; line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.art__src { display: inline-flex; align-items: center; gap: 5px; font-size: 0.68rem; font-weight: 600; color: var(--bc); background: var(--bc-soft); padding: 3px 8px; border-radius: 9999px; margin: 7px 0 0; max-width: 100%; }
.art__src svg { width: 11px; height: 11px; flex-shrink: 0; }
.art__src span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.art--locked { border-style: dashed; }
.art--locked .art__img { filter: grayscale(1) brightness(0.42) contrast(0.95); transform: scale(1.02); }
.art--locked .art__media::before { content: ""; position: absolute; inset: 0; z-index: 1; background: radial-gradient(circle at 50% 42%, transparent 18%, var(--art-bg) 92%); }
.art__lock { position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--text-secondary); }
.art__lock svg { width: 24px; height: 24px; opacity: 0.9; }
.art__lock small { font-size: 0.62rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.8; }
.art--locked .art__title { color: var(--text-secondary); }

@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>

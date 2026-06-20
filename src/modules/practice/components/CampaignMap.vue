<!--
  CampaignMap — F3 World-System ізо-карта (порт worlds-iso-dd.html, iteration 2.3).
  DATA-DRIVEN: будується ВИКЛЮЧНО з props.campaign (worlds[]/steps/state) — без зашитих
  кількостей (INV-WORLD-16). Арт-артефакти — через props.manifest (asset_key → URL, INV-WORLD-18).
  Структура: зони-світи · кроки · фортеця (бос) · цитадель (фінал) · стежка · вісь часу.

  F3.2.1 = структурна карта. F3.2.2 (далі): генеративні relics, декор-цивілізація, parallax,
  dark-режим, fog-перемикач «приховане майбутнє».
-->
<template>
  <div class="cmap" :data-theme="'light'">
    <header class="cmap__top">
      <h1>{{ campaign.title }}</h1>
    </header>

    <div class="cmap__scene">
      <div ref="mapEl" class="cmap__map"></div>
    </div>

    <nav class="cmap__bot">
      <div class="cmap__prog">
        <div class="cmap__prog-top">
          <span>{{ t('practice.title') }}</span>
          <b>{{ progLabel }}</b>
        </div>
        <div class="cmap__track">
          <span
            v-for="w in campaign.worlds"
            :key="w.level"
            class="cmap__seg"
            :class="{ done: w.level < campaign.current_world, active: w.level === campaign.current_world }"
          ></span>
        </div>
      </div>
      <button type="button" class="cmap__cta" @click="scrollToCurrent(true)">
        {{ t('practice.continue') }}
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AssetManifest, CampaignState, CampaignWorld } from '../api/practiceApi'

const props = defineProps<{ campaign: CampaignState; manifest: AssetManifest }>()
const { t } = useI18n()
const mapEl = ref<HTMLElement | null>(null)

const progLabel = computed(() => {
  const w = props.campaign.worlds.find((x) => x.level === props.campaign.current_world)
  return `${props.campaign.current_world}/${props.campaign.worlds.length} · ${w ? w.material : ''}`
})

// ── Палітра матеріалів (placeholder-візуал; майбутнє → visual_pack, INV-WORLD-18) ──
const MATERIALS: Record<string, any> = {
  wood:    { band: ['#dcbd8e', '#c69a60'], face: ['#cd9d5f', '#ab773c'], side: '#7c5526', ink: '#5e3f1c', hue: 32 },
  glass:   { band: ['#d2f0f4', '#a6dbe6'], face: ['#bce9f0', '#8acdd9'], side: '#4f8a96', ink: '#1f5a64', hue: 188 },
  copper:  { band: ['#f1c79c', '#e0a067'], face: ['#e2995b', '#c2703a'], side: '#8a4a22', ink: '#6e3a18', hue: 24 },
  silver:  { band: ['#e2e8ee', '#c4ced9'], face: ['#d6dde5', '#aeb9c6'], side: '#6f7c89', ink: '#3c4751', hue: 210 },
  gold:    { band: ['#f6e1a2', '#ecc856'], face: ['#f1d266', '#d9a92e'], side: '#9c7414', ink: '#6e5210', hue: 44 },
  crystal: { band: ['#e0cdf4', '#c4a8ec'], face: ['#d5baf1', '#b58fe5'], side: '#6f4caa', ink: '#4a2f74', hue: 270 },
  sky:     { band: ['#c3d0f2', '#90a8e8'], face: ['#a6bbf0', '#6f8fe0'], side: '#3f5aa8', ink: '#26356e', hue: 224 },
}
const FOG = { band: ['#dff3ef', '#c4cfcd'], face: ['#9fb0ad', '#7d8e8b'], side: '#7d8e8b', ink: '#3a4543', hue: 0 }

const ICON = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l2.5 6.1 6.5.5-5 4.2 1.6 6.4L12 17.3 5.9 20.7 7.5 14.3l-5-4.2 6.5-.5z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  q: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 9a3 3 0 1 1 4 2.8c-.9.5-1.5 1-1.5 2.2"/><circle cx="11.6" cy="18" r=".4" fill="currentColor" stroke-width="2"/></svg>',
  gem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10l6 6 6-6"/></svg>',
}
const FORTRESS_SVG = `<svg viewBox="0 0 150 158"><ellipse cx="75" cy="143" rx="48" ry="11" fill="rgba(0,0,0,.18)"/><polygon points="75,52 128,80 75,108 22,80" fill="var(--ft)"/><polygon points="22,80 75,108 75,143 22,115" fill="var(--fs)"/><polygon points="128,80 75,108 75,143 128,115" fill="var(--fm)"/><polygon points="75,22 104,38 75,54 46,38" fill="var(--ft)"/><polygon points="46,38 75,54 75,95 46,79" fill="var(--fs)"/><polygon points="104,38 75,54 75,95 104,79" fill="var(--fm)"/></svg>`
const CITADEL_SVG = `<svg viewBox="0 0 210 232"><ellipse cx="105" cy="208" rx="74" ry="14" fill="rgba(0,0,0,.18)"/><polygon points="55,112 80,126 55,140 30,126" fill="var(--ft)"/><polygon points="30,126 55,140 55,178 30,164" fill="var(--fs)"/><polygon points="80,126 55,140 55,178 80,164" fill="var(--fm)"/><polygon points="155,112 180,126 155,140 130,126" fill="var(--ft)"/><polygon points="130,126 155,140 155,178 130,164" fill="var(--fs)"/><polygon points="180,126 155,140 155,178 180,164" fill="var(--fm)"/><polygon points="105,98 168,132 105,166 42,132" fill="var(--ft)"/><polygon points="42,132 105,166 105,208 42,174" fill="var(--fs)"/><polygon points="168,132 105,166 105,208 168,174" fill="var(--fm)"/><polygon points="105,40 142,60 105,80 68,60" fill="var(--ft)"/><polygon points="68,60 105,80 105,136 68,116" fill="var(--fs)"/><polygon points="142,60 105,80 105,136 142,116" fill="var(--fm)"/><circle cx="40" cy="74" r="2.4" fill="#fff" opacity=".85"/><circle cx="176" cy="86" r="2" fill="#fff" opacity=".7"/></svg>`

// ── Layout ──
const ROW = 96, PAD_TOP = 210, PAD_BOT = 80, FREQ = 0.8
// W / CX / AMP — адаптивні (з реальної ширини контейнера), обчислюються в build()

type MapNode = { type: 'step' | 'fortress' | 'citadel'; w: CampaignWorld; s?: number }

let currentIdx = -1
let positions: { x: number; y: number }[] = []

function buildNodes(): MapNode[] {
  const out: MapNode[] = []
  const worlds = props.campaign.worlds
  worlds.forEach((w) => {
    for (let s = 0; s < w.steps; s++) out.push({ type: 'step', w, s })
    out.push({ type: 'fortress', w })
  })
  out.push({ type: 'citadel', w: worlds[worlds.length - 1] })
  return out
}

function stepStatus(w: CampaignWorld, s: number): 'done' | 'current' | 'open' | 'fog' {
  if (w.state === 'done') return 'done'
  if (w.state === 'active') {
    if (s < props.campaign.current_step) return 'done'
    return s === props.campaign.current_step ? 'current' : 'open'
  }
  if (w.state === 'fog') return 'fog'
  return 'open' // next
}

function pathD(arr: { x: number; y: number }[]): string {
  if (arr.length < 2) return ''
  let s = `M ${arr[0].x} ${arr[0].y}`
  for (let i = 1; i < arr.length; i++) {
    const p0 = arr[i - 1], p1 = arr[i], mx = (p0.x + p1.x) / 2
    s += ` C ${mx} ${p0.y} ${mx} ${p1.y} ${p1.x} ${p1.y}`
  }
  return s
}

function mat(material: string, state: string) {
  return state === 'fog' ? FOG : MATERIALS[material] || FOG
}

function build() {
  const map = mapEl.value
  if (!map) return
  const W = map.clientWidth || 375           // адаптивно під реальну ширину (mobile-first)
  const CX = W / 2
  const AMP = Math.min(132, W * 0.22)
  const nodes = buildNodes()
  const N = nodes.length
  const mapH = PAD_TOP + (N - 1) * ROW + PAD_BOT
  positions = nodes.map((_, i) => ({ x: CX + AMP * Math.sin(i * FREQ), y: PAD_TOP + (N - 1 - i) * ROW }))
  currentIdx = nodes.findIndex((n) => n.type === 'step' && stepStatus(n.w, n.s!) === 'current')
  map.style.height = mapH + 'px'

  // index-діапазони кожного світу (кроки + фортеця)
  const range: Record<number, { a: number; b: number }> = {}
  nodes.forEach((n, i) => {
    if (n.type === 'citadel') return
    const k = n.w.level
    if (!(k in range)) range[k] = { a: i, b: i }
    range[k].b = i
  })

  let html = `<svg class="cmap__trail" preserveAspectRatio="none" viewBox="0 0 ${W} ${mapH}"><path class="dim" d="${pathD(positions)}"/><path class="lit" d="${pathD(positions.slice(0, Math.max(0, currentIdx) + 1))}"/></svg>`

  // біом-смуги (зони-світи)
  props.campaign.worlds.forEach((w) => {
    const r = range[w.level]
    const topY = (positions[r.b].y + positions[r.b + 1].y) / 2 // r.b+1 завжди валідний (фортеця→крок/цитадель)
    const bottomY = w.level === 1 ? mapH : (positions[r.a].y + positions[r.a - 1].y) / 2
    const m = mat(w.material, w.state)
    const label =
      w.state === 'fog'
        ? `<span class="lvl">${t('practice.worldWord')}</span> ${ICON.lock} <span class="mt">?</span>`
        : `<span class="lvl">${w.level}</span> · <span class="mt">${esc(w.title)}</span>`
    html += `<div class="cmap__biome" style="top:${Math.max(0, topY)}px;height:${bottomY - Math.max(0, topY)}px;background:linear-gradient(165deg,${m.band[0]},${m.band[1]})"><span class="cmap__biome-l">${label}</span></div>`

    // landmark-артефакт (через манифест, INV-WORLD-18)
    if (w.state !== 'fog') {
      const midY = (positions[r.a].y + positions[r.b].y) / 2
      const sideRight = positions[Math.round((r.a + r.b) / 2)].x < CX
      const lx = Math.max(86, Math.min(W - 86, sideRight ? CX + AMP + 78 : CX - AMP - 78))
      const url = (props.manifest[w.artifact.asset_key] as string) || ''
      const cap = w.artifact.unlocked
        ? `<span class="art">${ICON.gem}</span><span>${esc(w.artifact.title)}</span>`
        : `<span class="art lock">${ICON.lock}</span><span>${t('practice.reward')}</span>`
      html += `<div class="cmap__lm ${w.artifact.unlocked ? 'on' : 'off'}" style="left:${lx}px;top:${midY}px"><div class="cmap__lm-art"><img src="${esc(url)}" alt="${esc(w.artifact.title)}" loading="lazy"/>${w.artifact.unlocked ? '' : `<span class="cmap__lm-lock">${ICON.lock}</span>`}</div><span class="cmap__lm-cap">${cap}</span></div>`
    }
  })

  // вузли (кроки / фортеці / цитадель)
  nodes.forEach((n, i) => {
    const p = positions[i]
    if (n.type === 'citadel') {
      const m = mat(n.w.material, 'final')
      html += `<button type="button" class="cmap__fort cmap__citadel" style="left:${p.x}px;top:${p.y}px;--ft:${m.face[0]};--fm:${m.face[1]};--fs:${m.side}" aria-label="${t('practice.final')}"><span class="cmap__halo"></span>${CITADEL_SVG}<span class="cmap__tag">${t('practice.final')}</span></button>`
      return
    }
    if (n.type === 'fortress') {
      const goal = n.w.level === props.campaign.current_world
      const fog = n.w.state === 'fog'
      const m = mat(n.w.material, n.w.state)
      html += `<button type="button" class="cmap__fort ${goal ? 'goal' : ''} ${fog ? 'fog' : ''}" style="left:${p.x}px;top:${p.y}px;--ft:${m.face[0]};--fm:${m.face[1]};--fs:${m.side}" aria-label="${esc(n.w.title)}">${goal ? '<span class="cmap__halo"></span>' : ''}${FORTRESS_SVG}${goal ? `<span class="cmap__tag">${t('practice.worldGoal')}</span>` : ''}</button>`
      return
    }
    const st = stepStatus(n.w, n.s!)
    const m = mat(n.w.material, n.w.state)
    let inner = String(n.s! + 1)
    if (st === 'done') inner = ICON.check
    else if (st === 'current') inner = ICON.star
    else if (st === 'fog') inner = ICON.q
    html += `<button type="button" class="cmap__tile ${st}" style="left:${p.x}px;top:${p.y}px;--mf0:${m.face[0]};--mf1:${m.face[1]};--ms:${m.side};--mi:${m.ink}" aria-label="${t('practice.step')} ${n.s! + 1}"><span class="cmap__side"></span><span class="cmap__face"></span><span class="cmap__lbl">${inner}</span></button>`
  })

  // підписи осі часу (INV-WORLD-12)
  html += `<div class="cmap__edge" style="top:14px">${ICON.up}<span>${t('practice.future')}</span></div>`
  html += `<div class="cmap__edge" style="top:${mapH - 34}px"><span>${t('practice.history')}</span>${ICON.down}</div>`

  map.innerHTML = html
}

function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
}

function scrollToCurrent(smooth: boolean) {
  if (currentIdx < 0) return
  const y = positions[currentIdx].y - window.innerHeight / 2 + 40
  window.scrollTo({ top: Math.max(0, y), behavior: smooth ? 'smooth' : 'auto' })
}

onMounted(() => {
  build()
  scrollToCurrent(false)
})
onBeforeUnmount(() => {
  if (mapEl.value) mapEl.value.innerHTML = ''
})
</script>

<!-- НЕ scoped: карта будується через innerHTML (onMounted), scoped-data-v не потрапляє
     на ін'єктований контент. Усі селектори з префіксом .cmap__ → не протікають. -->
<style>
.cmap { --tile-w: 108px; --tile-h: 62px; --depth: 12px; background: #dff3ef; color: #0d4a3e; }
.cmap__top { position: sticky; top: 0; z-index: 30; height: 52px; display: flex; align-items: center; justify-content: center; background: #19222b; color: #fff; }
.cmap__top h1 { font: 700 1.1rem system-ui, sans-serif; margin: 0; }
.cmap__scene { position: relative; padding-bottom: 96px; }
.cmap__map { position: relative; margin: 0 auto; max-width: 600px; }

.cmap__trail { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 3; overflow: visible; }
.cmap__trail .dim { fill: none; stroke: rgba(5,150,105,.28); stroke-width: 4; stroke-linecap: round; stroke-dasharray: 1 16; opacity: .7; }
.cmap__trail .lit { fill: none; stroke: #5da827; stroke-width: 7; stroke-linecap: round; opacity: .9; }

.cmap__biome { position: absolute; left: 0; right: 0; overflow: hidden; }
.cmap__biome-l { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); z-index: 6; display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; border-radius: 9999px; background: rgba(0,0,0,.28); color: #fff; font: 700 .76rem system-ui, sans-serif; backdrop-filter: blur(4px); white-space: nowrap; }
.cmap__biome-l .lvl { font-size: .64rem; letter-spacing: .1em; text-transform: uppercase; opacity: .75; }
.cmap__biome-l svg { width: 14px; height: 14px; }

.cmap__tile { position: absolute; width: var(--tile-w); height: var(--tile-h); transform: translate(-50%,-50%); padding: 0; border: none; background: none; cursor: pointer; z-index: 4; filter: drop-shadow(0 8px 7px rgba(0,0,0,.28)); }
.cmap__side, .cmap__face { position: absolute; inset: 0; clip-path: polygon(50% 0,100% 50%,50% 100%,0 50%); }
.cmap__side { transform: translateY(var(--depth)); }
.cmap__lbl { position: absolute; inset: 0; display: grid; place-items: center; z-index: 2; font: 800 1.05rem system-ui, sans-serif; pointer-events: none; }
.cmap__lbl svg { width: 30px; height: 30px; }
.cmap__tile.done .cmap__face { background: linear-gradient(160deg,#86d23f,#5da827); } .cmap__tile.done .cmap__side { background: #3c7517; } .cmap__tile.done .cmap__lbl { color: #fff; }
.cmap__tile.current .cmap__face { background: linear-gradient(160deg,#ffd24a,#f5a623); } .cmap__tile.current .cmap__side { background: #b9760d; } .cmap__tile.current .cmap__lbl { color: #7a4a05; }
.cmap__tile.open .cmap__face { background: linear-gradient(160deg,var(--mf0),var(--mf1)); filter: saturate(.85) brightness(.97); } .cmap__tile.open .cmap__side { background: var(--ms); } .cmap__tile.open .cmap__lbl { color: var(--mi); }
.cmap__tile.fog { opacity: .6; } .cmap__tile.fog .cmap__face { background: linear-gradient(160deg,#9fb0ad,#6b7a77); } .cmap__tile.fog .cmap__side { background: #7d8e8b; } .cmap__tile.fog .cmap__lbl { color: #3a4543; }

.cmap__fort { position: absolute; transform: translate(-50%,-78%); z-index: 6; width: 150px; height: 158px; padding: 0; border: none; background: none; cursor: pointer; filter: drop-shadow(0 12px 12px rgba(0,0,0,.28)); }
.cmap__fort svg { width: 100%; height: 100%; display: block; overflow: visible; }
.cmap__fort.fog { opacity: .58; }
.cmap__citadel { width: 212px; height: 232px; transform: translate(-50%,-72%); z-index: 8; }
.cmap__halo { position: absolute; left: 50%; top: 60%; width: 180px; height: 180px; transform: translate(-50%,-50%); border-radius: 50%; z-index: -1; background: radial-gradient(circle, rgba(255,210,90,.5), transparent 62%); }
.cmap__citadel .cmap__halo { width: 252px; height: 252px; background: radial-gradient(circle, rgba(150,140,255,.5), transparent 62%); }
.cmap__tag { position: absolute; left: 50%; top: -4px; transform: translateX(-50%); z-index: 2; font: 700 .58rem system-ui, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #fff; background: rgba(0,0,0,.42); padding: 3px 9px; border-radius: 9999px; white-space: nowrap; }
.cmap__citadel .cmap__tag { top: auto; bottom: 10px; background: linear-gradient(90deg,#5e6fd6,#9b7be8); }

.cmap__lm { position: absolute; transform: translate(-50%,-50%); z-index: 5; width: 140px; text-align: center; pointer-events: none; }
.cmap__lm-art { position: relative; width: 104px; height: 104px; margin: 0 auto; border-radius: 18px; overflow: hidden; background: #05070d; box-shadow: 0 10px 26px rgba(0,0,0,.34); }
.cmap__lm-art img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cmap__lm.off .cmap__lm-art img { filter: grayscale(1) brightness(.42); }
.cmap__lm-lock { position: absolute; inset: 0; display: grid; place-items: center; color: #fff; }
.cmap__lm-lock svg { width: 26px; height: 26px; }
.cmap__lm-cap { margin-top: 8px; display: inline-flex; align-items: center; gap: 5px; padding: 5px 11px; border-radius: 9999px; background: rgba(255,255,255,.96); border: 1px solid rgba(5,150,105,.3); font: 700 .72rem system-ui, sans-serif; max-width: 138px; }
.cmap__lm-cap span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmap__lm-cap .art svg { width: 12px; height: 12px; }

.cmap__edge { position: absolute; left: 50%; transform: translateX(-50%); z-index: 11; display: flex; flex-direction: column; align-items: center; gap: 2px; font: 600 .76rem system-ui, sans-serif; color: #1f6b5a; opacity: .72; white-space: nowrap; pointer-events: none; }
.cmap__edge svg { width: 20px; height: 20px; opacity: .6; }

.cmap__bot { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; background: rgba(255,255,255,.96); border-top: 1px solid rgba(5,150,105,.3); padding: 12px 16px; box-shadow: 0 -4px 18px rgba(6,30,24,.1); }
.cmap__prog, .cmap__bot { box-sizing: border-box; }
.cmap__bot { display: flex; align-items: center; gap: 12px; max-width: 600px; margin: 0 auto; }
.cmap__prog { flex: 1; min-width: 0; }
.cmap__prog-top { display: flex; justify-content: space-between; font-size: .74rem; color: #1f6b5a; margin-bottom: 5px; }
.cmap__prog-top b { color: #0d4a3e; }
.cmap__track { height: 9px; border-radius: 9999px; display: flex; gap: 3px; }
.cmap__seg { flex: 1; border-radius: 9999px; background: rgba(4,120,87,.12); }
.cmap__seg.done { background: linear-gradient(90deg,#5da827,#86d23f); }
.cmap__seg.active { background: linear-gradient(90deg,#f5a623,#ffd24a); }
.cmap__cta { flex-shrink: 0; border: none; cursor: pointer; background: linear-gradient(180deg,#1f8a3b,#15692c); color: #fff; font: 800 .92rem system-ui, sans-serif; padding: 12px 20px; border-radius: 12px; box-shadow: 0 4px 0 #15692c; }
.cmap__cta:active { transform: translateY(3px); box-shadow: 0 1px 0 #15692c; }
</style>

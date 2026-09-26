<template>
  <div ref="wrapRef" class="eye-player">
    <!-- EyePlayer v1.1 — живе око з жмурінням, lerp-трекінгом, touch.
         Кліки ловить цей div (svg пропускає їх крізь себе), тому class і @click
         батька падають сюди. Коментар — УСЕРЕДИНІ кореня: перед ним він робив би
         з компонента фрагмент у dev-збірці. -->
    <svg
      ref="svgRef"
      viewBox="0 0 360 240"
      class="eye-player__svg"
      aria-hidden="true"
    >
      <defs>
        <radialGradient :id="svgId('irisG')" cx="42%" cy="38%" r="58%">
          <stop offset="0%" stop-color="#7ee8c8" />
          <stop offset="25%" stop-color="#2db88a" />
          <stop offset="55%" stop-color="#0f7a58" />
          <stop offset="85%" stop-color="#085041" />
          <stop offset="100%" stop-color="#043028" />
        </radialGradient>
        <radialGradient :id="svgId('pupilG')" cx="38%" cy="32%" r="62%">
          <stop offset="0%" stop-color="#4a4a4a" />
          <stop offset="40%" stop-color="#1a1a1a" />
          <stop offset="100%" stop-color="#000" />
        </radialGradient>
        <radialGradient :id="svgId('scleraG')" cx="50%" cy="42%" r="55%">
          <stop offset="0%" stop-color="#ffffff" />
          <stop offset="65%" stop-color="#f2f0ec" />
          <stop offset="100%" stop-color="#ddd8d0" />
        </radialGradient>
        <linearGradient :id="svgId('lidSkinG')" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#c8956a" />
          <stop offset="55%" stop-color="#d4a882" />
          <stop offset="100%" stop-color="#b8896a" />
        </linearGradient>
        <radialGradient :id="svgId('shadowG')" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#1D9E75" stop-opacity="0.2" />
          <stop offset="100%" stop-color="#1D9E75" stop-opacity="0" />
        </radialGradient>
        <radialGradient :id="svgId('glintG')" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#fff" stop-opacity="0.95" />
          <stop offset="100%" stop-color="#fff" stop-opacity="0" />
        </radialGradient>
        <clipPath :id="svgId('eyeClip')">
          <path d="M16 120 Q88 22 180 22 Q272 22 344 120 Q272 218 180 218 Q88 218 16 120 Z" />
        </clipPath>
        <clipPath :id="svgId('irisClip')">
          <circle ref="epIrisClipCRef" cx="180" cy="120" r="60" />
        </clipPath>
      </defs>

      <!-- Тінь під оком -->
      <ellipse cx="180" cy="150" rx="155" ry="26" :fill="svgUrl('shadowG')" opacity="0.9" />

      <g class="eye-player-glow">
        <!-- Білок -->
        <path d="M16 120 Q88 22 180 22 Q272 22 344 120 Q272 218 180 218 Q88 218 16 120 Z"
              :fill="svgUrl('scleraG')" />

        <!-- Прожилки -->
        <g :clip-path="svgUrl('eyeClip')" opacity="0.15">
          <line x1="85" y1="92" x2="138" y2="114" stroke="#c0392b" stroke-width="0.7" stroke-linecap="round" />
          <line x1="80" y1="110" x2="126" y2="120" stroke="#c0392b" stroke-width="0.5" stroke-linecap="round" />
          <line x1="258" y1="96" x2="218" y2="114" stroke="#c0392b" stroke-width="0.7" stroke-linecap="round" />
          <line x1="264" y1="114" x2="224" y2="122" stroke="#c0392b" stroke-width="0.5" stroke-linecap="round" />
        </g>

        <!-- Яблучко -->
        <g>
          <circle ref="epIrisRef" cx="180" cy="120" r="60" :fill="svgUrl('irisG')" :clip-path="svgUrl('eyeClip')" />
          <g ref="epIrisRaysRef" :clip-path="svgUrl('irisClip')" opacity="0.55" />
          <circle ref="epLimbusRef" cx="180" cy="120" r="59.5" fill="none" stroke="#032018" stroke-width="2.5" opacity="0.7" />
          <circle ref="epIrisRingRef" cx="180" cy="120" r="42" fill="none" stroke="#085041" stroke-width="1" opacity="0.4" />
          <circle ref="epPupilRef" cx="180" cy="120" r="22" :fill="svgUrl('pupilG')" />
          <polygon ref="epPlayRef" points="171,108 171,132 195,120" fill="white" opacity="0.9" />
          <ellipse ref="epGlint1Ref" cx="164" cy="103" rx="11" ry="7"
                   :fill="svgUrl('glintG')" opacity="0.88" transform="rotate(-22 164 103)" />
          <ellipse ref="epGlint2Ref" cx="192" cy="134" rx="4.5" ry="2.8"
                   fill="white" opacity="0.3" transform="rotate(-15 192 134)" />
        </g>

        <!-- Верхнє повіко -->
        <path ref="epLidSkinRef"
              d="M16 120 Q88 22 180 22 Q272 22 344 120 Q272 22 180 22 Q88 22 16 120 Z"
              :fill="svgUrl('lidSkinG')" :clip-path="svgUrl('eyeClip')" />

        <!-- Складка повіка -->
        <path ref="epLidFoldRef" d="M40 120 Q180 22 320 120"
              fill="none" stroke="#9a6040" stroke-width="1.4"
              stroke-linecap="round" opacity="0" />

        <!-- Контур ока -->
        <path d="M16 120 Q88 22 180 22 Q272 22 344 120 Q272 218 180 218 Q88 218 16 120 Z"
              fill="none" stroke="#1a1a1a" stroke-width="3.2" stroke-linecap="round" />

        <!-- Складка шкіри -->
        <path d="M38 98 Q180 8 322 98" fill="none" stroke="#555" stroke-width="1.3" opacity="0.2" stroke-linecap="round" />

        <!-- Вії верхні (рухаються з повіком) -->
        <g ref="epLashGroupRef">
          <g stroke="#1a1a1a" stroke-linecap="round">
            <line x1="66"  y1="55" x2="52"  y2="36" stroke-width="2.5" />
            <line x1="98"  y1="38" x2="90"  y2="18" stroke-width="2.4" />
            <line x1="134" y1="27" x2="130" y2="7"  stroke-width="2.3" />
            <line x1="170" y1="22" x2="169" y2="2"  stroke-width="2.3" />
            <line x1="206" y1="23" x2="208" y2="3"  stroke-width="2.3" />
            <line x1="242" y1="30" x2="248" y2="10" stroke-width="2.4" />
            <line x1="272" y1="46" x2="286" y2="28" stroke-width="2.5" />
            <line x1="82"  y1="45" x2="72"  y2="26" stroke-width="1.6" opacity="0.6" />
            <line x1="116" y1="30" x2="112" y2="10" stroke-width="1.6" opacity="0.6" />
            <line x1="152" y1="23" x2="151" y2="3"  stroke-width="1.6" opacity="0.6" />
            <line x1="188" y1="23" x2="190" y2="3"  stroke-width="1.6" opacity="0.6" />
            <line x1="224" y1="27" x2="228" y2="7"  stroke-width="1.6" opacity="0.6" />
            <line x1="258" y1="38" x2="268" y2="20" stroke-width="1.6" opacity="0.6" />
          </g>
        </g>

        <!-- Вії нижні -->
        <g stroke="#1a1a1a" stroke-linecap="round" opacity="0.65">
          <line x1="82"  y1="186" x2="68"  y2="202" stroke-width="2.0" />
          <line x1="118" y1="202" x2="111" y2="218" stroke-width="1.9" />
          <line x1="156" y1="212" x2="155" y2="229" stroke-width="1.9" />
          <line x1="180" y1="217" x2="180" y2="234" stroke-width="1.9" />
          <line x1="204" y1="212" x2="206" y2="229" stroke-width="1.9" />
          <line x1="240" y1="202" x2="248" y2="218" stroke-width="1.9" />
          <line x1="276" y1="186" x2="290" y2="201" stroke-width="2.0" />
        </g>

        <!-- Брова -->
        <path ref="epBrowRef" d="M58 18 Q180 -10 302 18"
              fill="none" stroke="#1a1a1a" stroke-width="5" stroke-linecap="round" opacity="0.8" />
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
/**
 * EyePlayer v1.1 — живе око M4SH: стежить за вказівником (lerp), жмуриться в спокої,
 * «дихає» зіницею, розширює її під мишею.
 *
 * 2026-09-27 (власник: «я думав там у вікні зразу буде наше око з реплея»): винесено з
 * WBPublicView (кнопка старту публічного реплею), щоб те саме око стояло і на лендингу —
 * у рамці секції «Перегляньте, як проходив урок». Малюнок і рух перенесено без змін.
 * Нове лише те, чого вимагає друге місце:
 *   • `captureTouch` — палець на ВСЬОМУ документі з preventDefault (сторінка під оком не
 *     гортається). Реплей — так, як і було: це повноекранний застосунок. Лендинг — ні:
 *     інакше на телефоні сторінку не прогорнути.
 *   • `active` — живе око чи нерухоме відкрите. Реплей монтує око лише поки видно
 *     стартовий екран, тож живе з монтування, як і раніше; лендинг гасить його, коли
 *     рамка поза екраном або людина просила менше руху.
 *   • Старт — після монтування. У в'юсі старт ішов через watch+nextTick і міг випередити
 *     розмітку: промінці райдужки не будувались, слухачі наведення не чіплялись (на проді
 *     промінців 0, перевірено 2026-09-27). Промінці тепер будуються один раз — тут.
 */
import { onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

const props = withDefaults(defineProps<{
  active?: boolean
  captureTouch?: boolean
}>(), { active: true, captureTouch: false })

// Id у SVG — свої для кожного ока (Vue useId). З однаковими id друге око на сторінці брало б
// градієнти першого, а його промінці обрізав би РУХОМИЙ clipPath райдужки першого ока.
const uid = useId()
const svgId = (name: string): string => `ep-${name}-${uid}`
const svgUrl = (name: string): string => `url(#${svgId(name)})`

const wrapRef = ref<HTMLElement | null>(null)
const svgRef = ref<SVGSVGElement | null>(null)
const epIrisRef = ref<SVGCircleElement | null>(null)
const epLimbusRef = ref<SVGCircleElement | null>(null)
const epIrisRingRef = ref<SVGCircleElement | null>(null)
const epIrisClipCRef = ref<SVGCircleElement | null>(null)
const epPupilRef = ref<SVGCircleElement | null>(null)
const epPlayRef = ref<SVGPolygonElement | null>(null)
const epGlint1Ref = ref<SVGEllipseElement | null>(null)
const epGlint2Ref = ref<SVGEllipseElement | null>(null)
const epLidSkinRef = ref<SVGPathElement | null>(null)
const epLidFoldRef = ref<SVGPathElement | null>(null)
const epLashGroupRef = ref<SVGGElement | null>(null)
const epBrowRef = ref<SVGPathElement | null>(null)
const epIrisRaysRef = ref<SVGGElement | null>(null)

const EP_CX = 180, EP_CY = 120, EP_MAX = 26
let _epCurX = EP_CX, _epCurY = EP_CY, _epTargetX = EP_CX, _epTargetY = EP_CY
let _epPupilR = 22, _epBasePupilR = 22, _epBreathT = 0
let _epMouseIdle = true, _epIdleTimer: ReturnType<typeof setTimeout> | null = null
let _epIdleSeqTimer: ReturnType<typeof setTimeout> | null = null
let _epIsSquinting = false, _epSquintFrame: number | null = null, _epSquintProgress = 0
let _epDestroyed = false, _epLoopRaf = 0

const _lerp = (a: number, b: number, t: number) => a + (b - a) * t
const _eio = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
const _rand = (a: number, b: number) => a + Math.random() * (b - a)

/** Промінці райдужки — генеруються один раз при mount */
function _epBuildIrisRays(): void {
  const g = epIrisRaysRef.value
  if (!g) return
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2
    const r0 = 26 + Math.random() * 7, r1 = 48 + Math.random() * 12
    const sp = 0.018 + Math.random() * 0.022
    const x0 = EP_CX + Math.cos(a) * r0, y0 = EP_CY + Math.sin(a) * r0
    const x1 = EP_CX + Math.cos(a - sp) * r1, y1 = EP_CY + Math.sin(a - sp) * r1
    const x2 = EP_CX + Math.cos(a + sp) * r1, y2 = EP_CY + Math.sin(a + sp) * r1
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    p.setAttribute('d', `M${x0},${y0} L${x1},${y1} L${x2},${y2} Z`)
    p.setAttribute('fill', Math.random() > 0.5 ? '#9ee8cc' : '#032018')
    p.setAttribute('opacity', (0.10 + Math.random() * 0.24).toFixed(2))
    g.appendChild(p)
  }
}

/** Позиція яблучка */
function _epSetEyeball(nx: number, ny: number, pr: number): void {
  const s = String
  ;[epIrisRef, epLimbusRef, epIrisRingRef, epIrisClipCRef].forEach(r => {
    r.value?.setAttribute('cx', s(nx))
    r.value?.setAttribute('cy', s(ny))
  })
  epPupilRef.value?.setAttribute('cx', s(nx))
  epPupilRef.value?.setAttribute('cy', s(ny))
  epPupilRef.value?.setAttribute('r', s(Math.max(15, pr)))
  epIrisRaysRef.value?.setAttribute('transform', `translate(${nx - EP_CX},${ny - EP_CY})`)
  const px = nx - 9, py = ny - 12
  epPlayRef.value?.setAttribute('points', `${px},${py} ${px},${py + 24} ${px + 24},${py + 12}`)
  epGlint1Ref.value?.setAttribute('cx', s(nx - 16))
  epGlint1Ref.value?.setAttribute('cy', s(ny - 17))
  epGlint2Ref.value?.setAttribute('cx', s(nx + 12))
  epGlint2Ref.value?.setAttribute('cy', s(ny + 14))
}

/** Повіко: p=0 → відкрито, p=1 → жмуриться */
function _epUpdateLid(p: number): void {
  _epSquintProgress = p
  if (p < 0.005) {
    epLidSkinRef.value?.setAttribute('d', 'M16 120 Q88 22 180 22 Q272 22 344 120 Q272 22 180 22 Q88 22 16 120 Z')
    epLidFoldRef.value?.setAttribute('opacity', '0')
    epLashGroupRef.value?.setAttribute('transform', 'translate(0,0)')
    epBrowRef.value?.setAttribute('d', 'M58 18 Q180 -10 302 18')
    return
  }
  const lowY = _lerp(22, 112, p)
  epLidSkinRef.value?.setAttribute('d',
    `M16 120 Q88 22 180 22 Q272 22 344 120 Q272 ${lowY} 180 ${lowY} Q88 ${lowY} 16 120 Z`)
  const foldY = _lerp(22, 72, p)
  epLidFoldRef.value?.setAttribute('d', `M40 120 Q180 ${foldY} 320 120`)
  epLidFoldRef.value?.setAttribute('opacity', String(p * 0.45))
  epLashGroupRef.value?.setAttribute('transform', `translate(0,${p * 22})`)
  epBrowRef.value?.setAttribute('d',
    `M58 ${_lerp(18, 10, p)} Q180 ${_lerp(-10, -24, p)} 302 ${_lerp(18, 10, p)}`)
}

/** Жмуріння (анімація) */
function _epSquint(on: boolean, cb?: () => void): void {
  if (_epIsSquinting === on) { cb?.(); return }
  _epIsSquinting = on
  if (_epSquintFrame) cancelAnimationFrame(_epSquintFrame)
  const startP = _epSquintProgress, endP = on ? 1 : 0
  const steps = 16
  let s = 0
  function run() {
    _epUpdateLid(startP + (endP - startP) * _eio(s / steps))
    s++
    if (s <= steps) _epSquintFrame = requestAnimationFrame(run)
    else { _epSquintFrame = null; cb?.() }
  }
  _epSquintFrame = requestAnimationFrame(run)
}

/** Idle-послідовність: рандомний погляд + іноді жмуріння */
function _epScheduleIdle(): void {
  if (_epDestroyed || !_epMouseIdle) return
  _epIdleSeqTimer = setTimeout(() => {
    if (!_epMouseIdle) return
    const a = Math.random() * Math.PI * 2
    _epTargetX = EP_CX + Math.cos(a) * _rand(8, 20)
    _epTargetY = EP_CY + Math.sin(a) * _rand(5, 12)
    if (Math.random() > 0.45) {
      _epSquint(true, () => {
        if (!_epMouseIdle) { _epSquint(false); return }
        _epIdleSeqTimer = setTimeout(() => {
          _epSquint(false, () => _epScheduleIdle())
        }, _rand(500, 1100))
      })
    } else {
      _epScheduleIdle()
    }
  }, _rand(900, 1800))
}

/** Pointer tracking (mouse + touch) */
function _epHandlePointer(cx: number, cy: number): void {
  const svg = svgRef.value
  if (!svg) return
  const rect = svg.getBoundingClientRect()
  if (rect.width === 0) return
  _epTargetX = (cx - rect.left) * (360 / rect.width)
  _epTargetY = (cy - rect.top) * (240 / rect.height)
  if (_epMouseIdle) {
    _epMouseIdle = false
    if (_epIdleSeqTimer) clearTimeout(_epIdleSeqTimer)
    _epSquint(false)
  }
  if (_epIdleTimer) clearTimeout(_epIdleTimer)
  _epIdleTimer = setTimeout(() => { _epMouseIdle = true; _epScheduleIdle() }, 2000)
}

function _epOnMouseMove(e: MouseEvent): void { _epHandlePointer(e.clientX, e.clientY) }
function _epOnTouchMove(e: TouchEvent): void {
  e.preventDefault()
  _epHandlePointer(e.touches[0].clientX, e.touches[0].clientY)
}
function _epOnSvgEnter(): void { _epBasePupilR = 30 }
function _epOnSvgLeave(): void { _epBasePupilR = 22 }

/** Головний цикл (lerp + breathing) */
function _epLoop(): void {
  if (_epDestroyed) return
  _epCurX = _lerp(_epCurX, _epTargetX, 0.07)
  _epCurY = _lerp(_epCurY, _epTargetY, 0.07)
  const dx = _epCurX - EP_CX, dy = _epCurY - EP_CY
  const lim = Math.min(Math.sqrt(dx * dx + dy * dy), EP_MAX)
  const ang = Math.atan2(dy, dx)
  _epBreathT += 0.022
  _epPupilR = _lerp(_epPupilR, _epBasePupilR + Math.sin(_epBreathT) * 1.8, 0.06)
  _epSetEyeball(EP_CX + Math.cos(ang) * lim, EP_CY + Math.sin(ang) * lim, _epPupilR)
  _epLoopRaf = requestAnimationFrame(_epLoop)
}

let _epRunning = false

function _epStart(): void {
  if (_epRunning) return
  _epRunning = true
  _epDestroyed = false
  _epIsSquinting = false
  _epUpdateLid(0)
  document.addEventListener('mousemove', _epOnMouseMove)
  if (props.captureTouch) {
    document.addEventListener('touchmove', _epOnTouchMove, { passive: false } as AddEventListenerOptions)
  }
  wrapRef.value?.addEventListener('mouseenter', _epOnSvgEnter)
  wrapRef.value?.addEventListener('mouseleave', _epOnSvgLeave)
  _epLoopRaf = requestAnimationFrame(_epLoop)
  _epIdleTimer = setTimeout(() => { _epMouseIdle = true; _epScheduleIdle() }, 2000)
}

function _epStop(): void {
  if (!_epRunning) return
  _epRunning = false
  _epDestroyed = true
  document.removeEventListener('mousemove', _epOnMouseMove)
  document.removeEventListener('touchmove', _epOnTouchMove)
  wrapRef.value?.removeEventListener('mouseenter', _epOnSvgEnter)
  wrapRef.value?.removeEventListener('mouseleave', _epOnSvgLeave)
  cancelAnimationFrame(_epLoopRaf)
  if (_epSquintFrame) cancelAnimationFrame(_epSquintFrame)
  if (_epIdleTimer) clearTimeout(_epIdleTimer)
  if (_epIdleSeqTimer) clearTimeout(_epIdleSeqTimer)
}

onMounted(() => {
  _epBuildIrisRays()
  if (props.active) _epStart()
})
watch(() => props.active, (on) => (on ? _epStart() : _epStop()))
onBeforeUnmount(_epStop)
</script>

<style scoped>
.eye-player__svg {
  width: 100%;
  height: auto;
  overflow: visible;
  pointer-events: none; /* кліки проходять до обгортки */
}

/* Світіння ока; батьки підсилюють його на hover своєї області через :deep(.eye-player-glow) */
.eye-player-glow {
  filter: drop-shadow(0 4px 12px var(--shadow, rgba(5, 150, 105, 0.2)));
  transition: filter 0.35s ease;
}
</style>

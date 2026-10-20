<template>
  <span
    class="itg-loader"
    :style="{ width: `${width}px` }"
    role="status"
    aria-busy="true"
    data-testid="integralyk-loader"
    v-html="svg"
  />
</template>

<script setup lang="ts">
/**
 * Великий лодер «Інтегралик думає» — сцена «хмарка думок» з вихідника дизайнера
 * (`DATA/integral/integral_думає.zip` → `assistant-loader.js`, варіант `cloud`; власник 2026-10-20: «підбери нового
 * лодера — інтегралик думає»): Інтегралик дивиться вгору, з'являються бульбашки й хмарка, у ній по черзі фігури,
 * наприкінці спалахує лампочка. Персонаж — НАШ (`previewMascotSvg`), вигляд — вибраний користувачем (Інтегралик /
 * Інтегралка), кольори сцени — під вигляд, як у вихіднику (`character=boy|girl`).
 * Для місць, де чекають довго (генерація уроку, добір домашки). Маленький значок у кнопках лишається
 * `IntegralykThinking` — сцена в 20 px не читається.
 */
import { computed } from 'vue'
import { useAssistantLook } from './assistantLook'
import { previewMascotSvg, type IntegralykLook } from './integralykMascotSvg'

withDefaults(defineProps<{
  /** Ширина сцени в пікселях (висота — за пропорцією). */
  width?: number
}>(), { width: 180 })

const SCENE_COLORS: Record<IntegralykLook, { fx: string; ink: string }> = {
  integralyk: { fx: '#0d9488', ink: '#0f5f57' },
  integralka: { fx: '#f9738d', ink: '#7a2d45' },
}

function sceneSvg(look: IntegralykLook): string {
  const { fx, ink } = SCENE_COLORS[look]
  // Персонаж — вкладений <svg> у лівому нижньому куті сцени (як у вихіднику: x=20 y=70, 120×120).
  const mascot = previewMascotSvg(look).replace(
    '<svg viewBox="0 0 100 100"',
    '<svg class="itl-mascot" x="20" y="70" width="120" height="120" viewBox="0 0 100 100" overflow="visible"',
  )
  return '<svg viewBox="10 5 280 195" aria-hidden="true">'
    + mascot
    + `<circle class="itl-dot1" cx="128" cy="72" r="5" fill="#fff" stroke="${fx}" stroke-width="2"></circle>`
    + `<circle class="itl-dot2" cx="146" cy="56" r="8" fill="#fff" stroke="${fx}" stroke-width="2"></circle>`
    + '<path class="itl-cloud" d="M170 66 C150 66 150 38 172 38 C174 18 204 14 214 30 C226 12 262 18 260 40 C284 40 286 70 262 72'
    + ` C258 92 222 92 216 78 C206 94 172 90 170 66 Z" fill="#fff" stroke="${fx}" stroke-width="2.5"></path>`
    + `<g fill="${ink}">`
    + '<circle class="itl-sym" cx="216" cy="54" r="11" style="animation-delay:.7s"></circle>'
    + '<path class="itl-sym" d="M216 41 L229 64 L203 64 Z" style="animation-delay:1.6s"></path>'
    + '<rect class="itl-sym" x="205" y="43" width="22" height="22" rx="3" style="animation-delay:2.5s"></rect>'
    + '<path class="itl-sym" d="M216 66 C196 52 202 38 212 42 C214 43 216 46 216 46 C216 46 218 43 220 42 C230 38 236 52 216 66 Z"'
    + ' style="animation-delay:3.4s"></path>'
    + '</g>'
    + '<g class="itl-rays" stroke="#f5b83d" stroke-width="2.5" stroke-linecap="round">'
    + '<line x1="216" y1="22" x2="216" y2="14"></line><line x1="190" y1="32" x2="184" y2="26"></line>'
    + '<line x1="242" y1="32" x2="248" y2="26"></line></g>'
    + '<g class="itl-bulb"><path d="M216 30 C202 30 198 46 206 54 C209 57 210 60 210 63 L222 63 C222 60 223 57 226 54'
    + ' C234 46 230 30 216 30 Z" fill="#fde68a" stroke="#b7791f" stroke-width="2"></path>'
    + '<rect x="210" y="64" width="12" height="7" rx="2" fill="#94a3b8"></rect></g>'
    + '</svg>'
}

const { look } = useAssistantLook()
const svg = computed(() => sceneSvg(look.value))
</script>

<style scoped>
.itg-loader {
  display: inline-block;
  flex: none;
  max-width: 100%;
  line-height: 0;
}
.itg-loader :deep(svg) { width: 100%; height: auto; display: block; overflow: visible; }

/* Рух — з вихідника дизайнера (варіант `cloud`), один цикл 6 с. */
.itg-loader :deep(.itg-pupil) { transform-box: view-box; animation: itl-lookup 6s infinite; }
@keyframes itl-lookup {
  0%, 15% { transform: none; }
  25%, 85% { transform: translate(1.5px, -2.5px); }
  100% { transform: none; }
}
.itg-loader :deep(.itl-dot1),
.itg-loader :deep(.itl-dot2),
.itg-loader :deep(.itl-cloud) {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center;
  animation: itl-pop 6s infinite;
}
.itg-loader :deep(.itl-dot2) { animation-delay: .25s; }
.itg-loader :deep(.itl-cloud) { animation-delay: .5s; }
@keyframes itl-pop {
  0% { opacity: 0; transform: scale(.3); }
  6%, 88% { opacity: 1; transform: scale(1); }
  96%, 100% { opacity: 0; transform: scale(.6); }
}
.itg-loader :deep(.itl-sym) { opacity: 0; animation: itl-sym 6s infinite; }
@keyframes itl-sym {
  0% { opacity: 0; transform: translateY(6px); }
  4%, 14% { opacity: 1; transform: none; }
  18%, 100% { opacity: 0; transform: translateY(-6px); }
}
.itg-loader :deep(.itl-bulb) {
  opacity: 0;
  transform-box: fill-box;
  transform-origin: center bottom;
  animation: itl-bulb 6s infinite;
}
@keyframes itl-bulb {
  0%, 64% { opacity: 0; transform: scale(.4); }
  70% { opacity: 1; transform: scale(1.15); }
  74%, 90% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; }
}
.itg-loader :deep(.itl-rays) { opacity: 0; animation: itl-rays 6s infinite; }
@keyframes itl-rays {
  0%, 70% { opacity: 0; }
  74%, 90% { opacity: 1; }
  100% { opacity: 0; }
}

/* Без руху: нерухома сцена — бульбашки, хмарка й лампочка видно одразу. */
@media (prefers-reduced-motion: reduce) {
  .itg-loader :deep(*) { animation: none !important; }
  .itg-loader :deep(.itl-dot1),
  .itg-loader :deep(.itl-dot2),
  .itg-loader :deep(.itl-cloud),
  .itg-loader :deep(.itl-bulb),
  .itg-loader :deep(.itl-rays) { opacity: 1; transform: none; }
}
</style>

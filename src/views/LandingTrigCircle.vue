<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { TrigCircleInstance } from '@/modules/winterboard/vendor/trig'

const stageRef = ref<HTMLElement | null>(null)
let trig: TrigCircleInstance | null = null

onMounted(async () => {
  if (!stageRef.value) return
  await import('@/modules/winterboard/vendor/trig')
  if (!stageRef.value) return
  const W = window as unknown as {
    TrigCircle: new (el: HTMLElement, o: object) => TrigCircleInstance
  }

  // На вузьких екранах (< 700px) прибираємо labels/points/graph —
  // vendor все одно не покаже dual-panel (потрібно >= 600px CSS-width),
  // а мітки тільки засмічують малий canvas.
  const mobile = window.innerWidth < 700

  trig = new W.TrigCircle(stageRef.value, {
    theta:             Math.PI / 4,
    showSin:           true,
    showCos:           true,
    showTan:           false,
    showCot:           false,
    showSpecialPoints: !mobile,  // прибираємо помаранчеві крапки на мобільному
    showRefLabels:     !mobile,  // прибираємо "sin θ = …" / "cos θ = …" на мобільному
    showDeg:           !mobile,  // прибираємо 30°/60°… навколо кола
    showRad:           false,    // π-мітки завжди вимкнені — надто дрібно
    showExactGrid:     false,
    showInscribed:     false,
    showGraphs:        !mobile,  // синусоїда тільки на desktop (потребує >= 600px)
    snapPi12:          false,
    animate:           true,
    speed:             0.6,
    partialCurves:     true,
  })
})

onUnmounted(() => {
  trig?.destroy()
  trig = null
})
</script>

<template>
  <div class="ltc-wrap">
    <div ref="stageRef" class="ltc-stage" />
  </div>
</template>

<style scoped>
.ltc-wrap {
  width: 100%;
  border-radius: 16px;
  overflow: hidden;
  /* touch-action:none на контейнері — iOS Safari не перехоплює scroll
     під час drag по canvas (canvas вже має touch-action:none від vendor,
     але батьківський div теж повинен блокувати) */
  touch-action: none;
  box-shadow:
    0 2px 8px rgba(43,33,24,0.08),
    0 8px 32px rgba(43,33,24,0.10),
    0 0 0 1px rgba(43,33,24,0.08);
}

.ltc-stage {
  /*
    TrigCircle dual-panel (коло + синусоїда) тільки при w >= 600px (CSS).
    aspect-ratio 16/9 на desktop; на мобільному (< 700px) — 1/1 (квадрат),
    щоб коло не обрізалось і виглядало повноцінно.
    position:relative обов'язковий — vendor canvas має position:absolute;inset:0.
  */
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  min-width: 0;
}

@media (max-width: 700px) {
  .ltc-stage {
    aspect-ratio: 1 / 1;
  }
}

/* Картка з θ/sin/cos/tg/ctg — прибираємо на мобільному.
   На desktop вона корисна для інтерактиву; на мобільному перекриває коло. */
@media (max-width: 700px) {
  .ltc-stage :deep(.calc-hud) {
    display: none !important;
  }
}
</style>

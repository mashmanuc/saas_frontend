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
  trig = new W.TrigCircle(stageRef.value, {
    theta:             Math.PI / 4,
    showSin:           true,
    showCos:           true,
    showTan:           false,
    showCot:           false,
    showSpecialPoints: true,
    showRefLabels:     true,
    showDeg:           true,
    showRad:           false,   // π-мітки завжди вимкнені — надто дрібно
    showExactGrid:     false,
    showInscribed:     false,
    showGraphs:        true,
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
  /* overflow:hidden вирішує два завдання:
     1) клепає 660px stage до ширини екрану на мобільному
     2) приховує calc-hud що може виходити за межі */
  overflow: hidden;
  /* touch-action:none — iOS Safari не перехоплює scroll
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
    Desktop: width:100%, aspect-ratio 16/9.
    Vendor вмикає dual-panel (коло + синусоїда) коли w >= 600px CSS.
    position:relative обов'язковий — vendor canvas має position:absolute;inset:0.
  */
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  min-width: 0;
}

/* ── Мобільний hack для синусоїди ───────────────────────────────────────
   На вузьких екранах vendor не активує dual-panel (потребує >= 600px CSS-width).
   Рішення: примусово встановити stage 660px — vendor бачить 660 >= 600 і
   малює коло + синусоїду. .ltc-wrap (overflow:hidden) обрізає до ширини
   екрану: коло виходить повністю (займає ліві ~50%), синусоїда — перші хвилі.
   Координати pointer-events коректні бо vendor читає canvas.getBoundingClientRect()
   (повну 660px ширину), а клік в лівій половині = взаємодія з колом. ✓
*/
@media (max-width: 699px) {
  .ltc-stage {
    width: 660px;
    aspect-ratio: 16 / 9;   /* висота: 660 × 9/16 = 371px — компактно */
  }
}

/* HUD (картка з θ/sin/cos значеннями) — прибираємо на мобільному.
   На desktop корисна; на мобільному перекриває коло. */
@media (max-width: 699px) {
  .ltc-stage :deep(.calc-hud) {
    display: none !important;
  }
}
</style>

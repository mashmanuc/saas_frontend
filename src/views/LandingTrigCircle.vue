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
    showRad:           true,
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
  overflow: hidden;
  box-shadow:
    0 2px 8px rgba(43,33,24,0.08),
    0 8px 32px rgba(43,33,24,0.10),
    0 0 0 1px rgba(43,33,24,0.08);
}

.ltc-stage {
  /*
    TrigCircle вмикає dual-panel (коло + синусоїда) тільки коли w >= 600px (CSS).
    aspect-ratio 16/9 дає достатню висоту при будь-якій ширині >= 600px.
    position:relative обов'язковий — vendor canvas має position:absolute;inset:0.
  */
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  min-width: 0;
}
</style>

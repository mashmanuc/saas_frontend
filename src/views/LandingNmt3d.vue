<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { Nmt3dWorkspace } from '@/modules/winterboard/vendor/nmt3d'

const stageRef = ref<HTMLElement | null>(null)
let ws: Nmt3dWorkspace | null = null

onMounted(async () => {
  if (!stageRef.value) return
  await import('@/modules/winterboard/vendor/nmt3d')
  if (!stageRef.value) return
  const W = window as unknown as {
    NMT3D: { Workspace: new (el: HTMLElement, key: string) => Nmt3dWorkspace }
  }
  ws = new W.NMT3D.Workspace(stageRef.value, 'trapPyramid')
  ws.setParams({ a: 2.2, b: 1.2, d: 1.8, s: 0, h: 2.0, x: 0, z: 0 })
  ws.setOpt('axBD', true)   // діагональний переріз SBD
  ws.setAutoOrbit(true)
})

onUnmounted(() => {
  ws?.destroy()
  ws = null
})
</script>

<template>
  <div class="lnmt-wrap">
    <div ref="stageRef" class="lnmt-stage" />
  </div>
</template>

<style scoped>
.lnmt-wrap {
  width: 100%;
  border-radius: 16px;
  overflow: hidden;
  background: #fffaf0;
  box-shadow:
    0 2px 8px rgba(43,33,24,0.08),
    0 8px 32px rgba(43,33,24,0.10),
    0 0 0 1px rgba(43,33,24,0.08);
}

.lnmt-stage {
  /*
    NMT3D Workspace використовує position:absolute;inset:0 для canvas.
    aspect-ratio 4/3 дає достатню висоту для 3D-сцени.
  */
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  min-width: 0;
}
</style>

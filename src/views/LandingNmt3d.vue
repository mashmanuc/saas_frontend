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
  /* touch-action:none — iOS Safari не перехоплює scroll під час orbit-drag */
  touch-action: none;
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
  touch-action: none;
  /* Фікс 2026-09-01 (той самий, що в Nmt3dRenderer.vue, коміт a6857c27):
     підписи вершин — SVG <text> (`nmt-3d.js:3184`), і при orbit-drag браузер
     виділяє їх як звичайний текст — вершини підсвічуються синім.
     `touch-action` цього не покриває: воно про жести, не про виділення.

     Чому лендінг пропустили в серпні: там перевірили сусідні віджети ДОШКИ
     (Graphmash3d, Geomash — підписи на canvas, виділяти нічого), але той
     самий вендор живе ще й тут, поза winterboard. Баг було не видно, бо
     лендінг крутить фігуру сам (`setAutoOrbit`) — та вендор вішає
     `pointerdown` (`nmt-3d.js:3236`), тож перетягнути її мишею можна. */
  user-select: none;
  -webkit-user-select: none;
}
</style>

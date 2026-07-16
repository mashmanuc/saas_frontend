<!--
  Geo2dInspector — contextual sidebar panel for selected geometry_2d_v2 asset.

  Shown by GroupContentSidebar when geo2dInspectorState.bridge !== null.
  На відміну від решти інспекторів, панель НЕ малює власні контроли:
  vendor-тулбар (makeGeoToolbar, button.tool елементи з live listeners)
  ТЕЛЕПОРТУЄТЬСЯ сюди з картки через appendChild — і повертається назад
  renderer-ом при знятті виділення (watch(isSelected) у Geometry2DRenderer).

  Стилі button.tool продубльовано з Geometry2DRenderer (там вони scoped під
  .geo2dv2-toolbar-host і при переміщенні DOM злітають) — але тут кнопки
  розкладаються сіткою-обгорткою (сайдбар вузький і вертикальний).
-->
<template>
  <div class="g2d-insp">
    <div class="g2d-insp__header">
      <span class="g2d-insp__title">{{ b.label }}</span>
      <span class="g2d-insp__subtitle">Геометрія · побудови</span>
    </div>
    <div ref="hostEl" class="g2d-insp__host" />
  </div>
</template>

<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { geo2dInspectorState } from '../../board/state/geo2dInspectorState'

// bridge гарантовано не null: GroupContentSidebar рендерить компонент лише
// коли geo2dInspectorState.bridge задано (v-else-if ланцюг).
const b = geo2dInspectorState.bridge!

const hostEl = ref<HTMLElement | null>(null)

// Телепорт vendor-тулбара: appendChild ПЕРЕМІЩУЄ вузол (listeners живі).
// watchEffect: host з'являється після mount; bridge реактивний (зміна картки).
watchEffect(() => {
  const host = hostEl.value
  const el = geo2dInspectorState.bridge?.toolbarEl
  if (host && el && el.parentElement !== host) host.appendChild(el)
})
</script>

<style scoped>
.g2d-insp {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px;
}

.g2d-insp__header {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.g2d-insp__title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.g2d-insp__subtitle {
  font-size: 11px;
  color: #64748b;
}

/* Стилі vendor-кнопок — дубль з Geometry2DRenderer (scoped там не діє після
   переміщення DOM). Відмінність: flex-wrap (вертикальний сайдбар, не рядок). */
.g2d-insp__host :deep(.toolbar) {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.g2d-insp__host :deep(button.tool) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  height: 30px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid rgba(148, 163, 184, 0.45);
  background: #f8fafc;
  color: #1e293b;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.1s, border-color 0.1s;
}

.g2d-insp__host :deep(button.tool:hover) {
  background: #e2e8f0;
  border-color: #94a3b8;
}

.g2d-insp__host :deep(button.tool.active) {
  background: rgba(37, 99, 235, 0.12);
  border-color: rgba(37, 99, 235, 0.4);
  color: #1d4ed8;
  font-weight: 500;
}

.g2d-insp__host :deep(.tool-icon) {
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.g2d-insp__host :deep(.tool-label) {
  font-size: 12px;
}
</style>

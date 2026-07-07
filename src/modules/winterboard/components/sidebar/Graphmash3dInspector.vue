<!--
  Graphmash3dInspector — правий сайдбар для вибраної GraphMASH 3D-поверхні (§3.7.15, B4).
  Показується GroupContentSidebar коли graphmash3dInspectorState.bridge !== null.
  v1: навігація — список виразів-поверхонь (колір+кольормапа) + deep-link редагування.
-->
<template>
  <div class="gm3d-inspector" data-testid="graphmash3d-inspector">
    <header class="gm3d-inspector__head">
      <span class="gm3d-inspector__icon">△</span>
      <span class="gm3d-inspector__title">GraphMASH 3D</span>
      <span class="gm3d-inspector__count">{{ expressions.length }}</span>
    </header>

    <p class="gm3d-inspector__sub">Поверхні</p>

    <ul v-if="expressions.length" class="gm3d-inspector__list">
      <li v-for="e in expressions" :key="e.id" class="gm3d-inspector__item">
        <span class="gm3d-inspector__swatch" :style="{ background: e.color }" />
        <span class="gm3d-inspector__src">{{ e.src }}</span>
        <span class="gm3d-inspector__cm">{{ e.colorMap }}</span>
      </li>
    </ul>
    <p v-else class="gm3d-inspector__empty">Порожня сцена</p>

    <a class="gm3d-inspector__edit" href="/mash/grapher-3d/index.html" target="_blank" rel="noopener">
      Редагувати у GraphMASH 3D ↗
    </a>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { graphmash3dInspectorState } from '../../board/state/graphmash3dInspectorState'
import type { Gm3dExprEntry } from '../../board/state/graphmash3dInspectorState'

const expressions = computed<Gm3dExprEntry[]>(() => graphmash3dInspectorState.bridge?.expressions ?? [])
</script>

<style scoped>
.gm3d-inspector {
  padding: 12px 14px;
  font-family: system-ui, sans-serif;
  color: var(--text-primary, #16324a);
}
.gm3d-inspector__head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.gm3d-inspector__icon { font-size: 18px; color: #2d70b3; }
.gm3d-inspector__title { font-weight: 700; font-size: 14px; flex: 1; }
.gm3d-inspector__count {
  font-size: 11px; font-weight: 600; color: #2d70b3;
  background: rgba(45, 112, 179, 0.1); border-radius: 10px; padding: 1px 8px;
}
.gm3d-inspector__sub {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--text-secondary, #4a6a86); margin: 8px 0 6px;
}
.gm3d-inspector__list { list-style: none; margin: 0; padding: 0; max-height: 50vh; overflow-y: auto; }
.gm3d-inspector__item {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 6px; border-radius: 6px; font-size: 13px;
}
.gm3d-inspector__item:nth-child(odd) { background: rgba(45, 112, 179, 0.04); }
.gm3d-inspector__swatch { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
.gm3d-inspector__src { flex: 1; font-family: ui-monospace, monospace; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gm3d-inspector__cm { font-size: 10px; color: var(--text-secondary, #4a6a86); }
.gm3d-inspector__empty { font-size: 13px; color: var(--text-secondary, #4a6a86); }
.gm3d-inspector__edit {
  display: inline-block; margin-top: 12px; font-size: 12px; font-weight: 600;
  color: #fff; background: #2d70b3; border-radius: 7px; padding: 6px 14px; text-decoration: none;
}
.gm3d-inspector__edit:hover { background: #22597f; }
</style>

<!--
  GeomashInspector — правий сайдбар для вибраного GeoMASH-об'єкта (§3.7.14, B3).
  Показується GroupContentSidebar коли geomashInspectorState.bridge !== null.
  v1: навігація — список геометричних об'єктів сцени + deep-link редагування.
-->
<template>
  <div class="geo-inspector" data-testid="geomash-inspector">
    <header class="geo-inspector__head">
      <span class="geo-inspector__icon">⊙</span>
      <span class="geo-inspector__title">GeoMASH</span>
      <span class="geo-inspector__count">{{ objects.length }}</span>
    </header>

    <p class="geo-inspector__sub">Об'єкти сцени</p>

    <ul v-if="objects.length" class="geo-inspector__list">
      <li v-for="o in objects" :key="o.id" class="geo-inspector__item">
        <span class="geo-inspector__type" :title="o.type">{{ typeLabel(o.type) }}</span>
        <span class="geo-inspector__name">{{ objLabel(o) }}</span>
      </li>
    </ul>
    <p v-else class="geo-inspector__empty">Порожня сцена</p>

    <a class="geo-inspector__edit" href="/mash/geomash/GeoMASH.html" target="_blank" rel="noopener">
      Редагувати у GeoMASH ↗
    </a>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { geomashInspectorState } from '../../board/state/geomashInspectorState'
import type { GeoObject } from '../../vendor/geomash'

const objects = computed<GeoObject[]>(() => geomashInspectorState.bridge?.objects ?? [])

const TYPE_LABELS: Record<string, string> = {
  point: 'Точка', segment: 'Відрізок', line: 'Пряма', ray: 'Промінь',
  vector: 'Вектор', polyline: 'Ламана', polygon: 'Многокутник',
  circle: 'Коло', circle3: 'Коло', arc: 'Дуга', semicircle: 'Півколо',
  dline: 'Пряма', angle: 'Кут', distance: 'Відстань', slider: 'Повзунок',
}
function typeLabel(t: string): string {
  return TYPE_LABELS[t] ?? t
}
function objLabel(o: GeoObject): string {
  const name = (o.name ?? o.label ?? o.text) as string | undefined
  if (typeof name === 'string' && name) return name
  return o.id
}
</script>

<style scoped>
.geo-inspector {
  padding: 12px 14px;
  font-family: system-ui, sans-serif;
  color: var(--text-primary, #0d4a3e);
}
.geo-inspector__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.geo-inspector__icon { font-size: 18px; color: #1a5c38; }
.geo-inspector__title { font-weight: 700; font-size: 14px; flex: 1; }
.geo-inspector__count {
  font-size: 11px;
  font-weight: 600;
  color: #1a5c38;
  background: rgba(26, 92, 56, 0.1);
  border-radius: 10px;
  padding: 1px 8px;
}
.geo-inspector__sub {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-secondary, #1f6b5a);
  margin: 8px 0 6px;
}
.geo-inspector__list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 50vh;
  overflow-y: auto;
}
.geo-inspector__item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 6px;
  font-size: 13px;
}
.geo-inspector__item:nth-child(odd) { background: rgba(26, 92, 56, 0.04); }
.geo-inspector__type {
  font-size: 11px;
  color: var(--text-secondary, #1f6b5a);
  min-width: 74px;
}
.geo-inspector__name { font-weight: 600; }
.geo-inspector__empty { font-size: 13px; color: var(--text-secondary, #1f6b5a); }
.geo-inspector__edit {
  display: inline-block;
  margin-top: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: #1a5c38;
  border-radius: 7px;
  padding: 6px 14px;
  text-decoration: none;
}
.geo-inspector__edit:hover { background: #124028; }
</style>

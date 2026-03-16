<!-- Phase 16 INT-45: Knowledge network mini-graph — SVG tree of lessons with forks/clones counts.
     Simplified tree view: central node (tutor) → lesson nodes → fork/clone indicators.
     Ref: AGENT_A_FE_CORE.md Day 8 -->
<template>
  <section class="knowledge-graph" :aria-label="$t('knowledge.analytics.networkTitle')">
    <h3 class="knowledge-graph__title">{{ $t('knowledge.analytics.networkTitle') }}</h3>

    <div v-if="lessons.length === 0" class="knowledge-graph__empty">
      Недостатньо даних для побудови графу
    </div>

    <div v-else class="knowledge-graph__container" ref="containerRef">
      <svg
        :width="svgWidth"
        :height="svgHeight"
        :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
        class="knowledge-graph__svg"
        role="img"
        :aria-label="$t('knowledge.analytics.networkTitle')"
      >
        <!-- Lines from center to lesson nodes -->
        <line
          v-for="(node, i) in lessonNodes"
          :key="'line-' + i"
          :x1="centerX"
          :y1="centerY"
          :x2="node.x"
          :y2="node.y"
          class="knowledge-graph__edge"
        />

        <!-- Fork/clone indicators (small lines from lesson nodes) -->
        <template v-for="(node, i) in lessonNodes" :key="'forks-' + i">
          <line
            v-if="node.forks > 0"
            :x1="node.x"
            :y1="node.y"
            :x2="node.forkX"
            :y2="node.forkY"
            class="knowledge-graph__edge knowledge-graph__edge--fork"
          />
        </template>

        <!-- Center node (tutor) -->
        <circle
          :cx="centerX"
          :cy="centerY"
          r="24"
          class="knowledge-graph__node knowledge-graph__node--center"
        />
        <text
          :x="centerX"
          :y="centerY + 4"
          text-anchor="middle"
          class="knowledge-graph__label knowledge-graph__label--center"
        >📚</text>

        <!-- Lesson nodes -->
        <g v-for="(node, i) in lessonNodes" :key="'node-' + i">
          <circle
            :cx="node.x"
            :cy="node.y"
            :r="node.radius"
            class="knowledge-graph__node knowledge-graph__node--lesson"
          />
          <text
            :x="node.x"
            :y="node.y - node.radius - 6"
            text-anchor="middle"
            class="knowledge-graph__label knowledge-graph__label--title"
          >{{ truncate(node.title, 16) }}</text>
          <text
            :x="node.x"
            :y="node.y + 4"
            text-anchor="middle"
            class="knowledge-graph__label knowledge-graph__label--views"
          >{{ node.views }}</text>

          <!-- Fork indicator -->
          <g v-if="node.forks > 0">
            <circle
              :cx="node.forkX"
              :cy="node.forkY"
              r="10"
              class="knowledge-graph__node knowledge-graph__node--fork"
            />
            <text
              :x="node.forkX"
              :y="node.forkY + 4"
              text-anchor="middle"
              class="knowledge-graph__label knowledge-graph__label--fork"
            >{{ node.forks }}</text>
          </g>
        </g>
      </svg>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface LessonNode {
  id: string
  title: string
  views: number
  forks: number
}

const props = defineProps<{
  lessons: LessonNode[]
}>()

const containerRef = ref<HTMLDivElement | null>(null)

const svgWidth = 600
const svgHeight = 400
const centerX = svgWidth / 2
const centerY = svgHeight / 2

const lessonNodes = computed(() => {
  const count = Math.min(props.lessons.length, 8)
  const maxViews = Math.max(...props.lessons.slice(0, count).map(l => l.views), 1)
  const radius = Math.min(svgWidth, svgHeight) * 0.35

  return props.lessons.slice(0, count).map((lesson, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2
    const x = centerX + radius * Math.cos(angle)
    const y = centerY + radius * Math.sin(angle)
    const nodeRadius = 12 + (lesson.views / maxViews) * 10

    // Fork indicator offset
    const forkAngle = angle
    const forkDist = nodeRadius + 28
    const forkX = x + forkDist * Math.cos(forkAngle)
    const forkY = y + forkDist * Math.sin(forkAngle)

    return {
      ...lesson,
      x: Math.round(x),
      y: Math.round(y),
      radius: Math.round(nodeRadius),
      forkX: Math.round(forkX),
      forkY: Math.round(forkY),
    }
  })
})

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}
</script>

<style scoped>
.knowledge-graph {
  margin-top: 24px;
}

.knowledge-graph__title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary, #0f172a);
  margin: 0 0 12px;
}

.knowledge-graph__empty {
  font-size: 13px;
  color: #94a3b8;
  text-align: center;
  padding: 24px;
}

.knowledge-graph__container {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.knowledge-graph__svg {
  display: block;
  max-width: 100%;
  height: auto;
}

/* ── Edges ──────────────────────────────────────────────── */
.knowledge-graph__edge {
  stroke: #cbd5e1;
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
}

.knowledge-graph__edge--fork {
  stroke: #a78bfa;
  stroke-width: 1;
  stroke-dasharray: 2 2;
}

/* ── Nodes ──────────────────────────────────────────────── */
.knowledge-graph__node {
  transition: fill 0.15s;
}

.knowledge-graph__node--center {
  fill: #6366f1;
  stroke: #4f46e5;
  stroke-width: 2;
}

.knowledge-graph__node--lesson {
  fill: #e0e7ff;
  stroke: #818cf8;
  stroke-width: 1.5;
}

.knowledge-graph__node--lesson:hover {
  fill: #c7d2fe;
}

.knowledge-graph__node--fork {
  fill: #f5f3ff;
  stroke: #a78bfa;
  stroke-width: 1;
}

/* ── Labels ─────────────────────────────────────────────── */
.knowledge-graph__label {
  font-family: inherit;
  pointer-events: none;
}

.knowledge-graph__label--center {
  font-size: 16px;
}

.knowledge-graph__label--title {
  font-size: 11px;
  font-weight: 600;
  fill: #334155;
}

.knowledge-graph__label--views {
  font-size: 11px;
  font-weight: 700;
  fill: #6366f1;
}

.knowledge-graph__label--fork {
  font-size: 9px;
  font-weight: 600;
  fill: #7c3aed;
}

/* ── Dark mode ──────────────────────────────────────────── */
@media (prefers-color-scheme: dark) {
  .knowledge-graph__edge { stroke: #475569; }
  .knowledge-graph__edge--fork { stroke: #7c3aed; }
  .knowledge-graph__node--center { fill: #4f46e5; stroke: #6366f1; }
  .knowledge-graph__node--lesson { fill: #312e81; stroke: #6366f1; }
  .knowledge-graph__node--fork { fill: #2e1065; stroke: #7c3aed; }
  .knowledge-graph__label--title { fill: #e2e8f0; }
  .knowledge-graph__label--views { fill: #a5b4fc; }
  .knowledge-graph__label--fork { fill: #c4b5fd; }
  .knowledge-graph__empty { color: #64748b; }
  .knowledge-graph__title { color: #f1f5f9; }
}
</style>

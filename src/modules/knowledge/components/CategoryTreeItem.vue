<!-- Knowledge: Category tree item — recursive tree node with expand/collapse
     Ref: Phase 15 B2.3 -->
<template>
  <li role="treeitem" :aria-expanded="hasChildren ? expanded : undefined" :aria-level="depth + 1">
    <button
      :class="['category-tree-item flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-sm transition-colors',
        isActive ? 'bg-primary-100 text-primary-700 font-medium' : 'text-gray-700 hover:bg-gray-100']"
      @click="handleClick"
      @keydown.enter.prevent="handleClick"
      @keydown.space.prevent="handleClick"
      @keydown.right.prevent="expand"
      @keydown.left.prevent="collapse"
    >
      <!-- Expand/collapse arrow -->
      <ChevronRight
        v-if="hasChildren"
        :size="14"
        :class="['transition-transform shrink-0', expanded ? 'rotate-90' : '']"
      />
      <span v-else class="w-3.5 shrink-0" />

      <!-- Icon (if category has one) -->
      <component v-if="iconComponent" :is="iconComponent" :size="14" class="text-gray-400 shrink-0" />

      <!-- Name + count -->
      <span class="truncate">{{ category.name }}</span>
      <span class="text-xs text-gray-400 ml-auto shrink-0">({{ category.lesson_count }})</span>
    </button>

    <!-- Children (recursive) -->
    <Transition name="slide-down">
      <ul v-if="hasChildren && expanded" role="group" class="ml-3">
        <CategoryTreeItem
          v-for="child in category.children"
          :key="child.id"
          :category="child"
          :depth="depth + 1"
          :active-category="activeCategory"
          @select="$emit('select', $event)"
        />
      </ul>
    </Transition>
  </li>
</template>

<script setup lang="ts">
import { ref, computed, type Component } from 'vue'
import { ChevronRight, Calculator, Atom, FlaskConical, Leaf, BookText, Globe2, Laptop, Languages, Clock } from 'lucide-vue-next'

defineOptions({ name: 'CategoryTreeItem' })

export interface SubjectCategory {
  id: string
  name: string
  slug: string
  icon: string
  lesson_count: number
  children: SubjectCategory[]
}

const props = withDefaults(defineProps<{
  category: SubjectCategory
  depth?: number
  activeCategory?: string | null
}>(), {
  depth: 0,
  activeCategory: null,
})

const emit = defineEmits<{
  select: [categorySlug: string]
}>()

const expanded = ref(props.depth < 1)

const hasChildren = computed(() => props.category.children?.length > 0)
const isActive = computed(() => props.activeCategory === props.category.slug)

const ICON_MAP: Record<string, Component> = {
  calculator: Calculator,
  atom: Atom,
  'flask-conical': FlaskConical,
  leaf: Leaf,
  'book-text': BookText,
  globe2: Globe2,
  globe: Globe2,
  laptop: Laptop,
  languages: Languages,
  clock: Clock,
}

const iconComponent = computed(() =>
  props.category.icon ? (ICON_MAP[props.category.icon] || null) : null
)

function handleClick(): void {
  if (hasChildren.value) {
    expanded.value = !expanded.value
  }
  emit('select', props.category.slug)
}

function expand(): void {
  if (hasChildren.value) expanded.value = true
}

function collapse(): void {
  if (hasChildren.value) expanded.value = false
}
</script>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  max-height: 0;
}
.slide-down-enter-to,
.slide-down-leave-from {
  opacity: 1;
  max-height: 1000px;
}
</style>

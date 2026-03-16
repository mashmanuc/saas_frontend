<!-- Knowledge: Subject badge — shared component with icon + i18n name
     Ref: Phase 15 B2.4 -->
<template>
  <span :class="['inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium',
    size === 'sm' ? 'text-xs' : 'text-sm',
    'bg-blue-100 text-blue-700']">
    <component v-if="iconComponent" :is="iconComponent" :size="size === 'sm' ? 10 : 12" />
    {{ displayName }}
  </span>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { Calculator, Atom, FlaskConical, Leaf, BookText, Globe2, Laptop, Languages } from 'lucide-vue-next'

const KNOWN_SUBJECTS = [
  'math', 'physics', 'english', 'ukrainian', 'chemistry',
  'biology', 'history', 'geography', 'informatics', 'other',
] as const

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
}

const props = withDefaults(defineProps<{
  categoryName: string
  categoryIcon?: string
  size?: 'sm' | 'md'
}>(), {
  categoryIcon: '',
  size: 'sm',
})

const { t, te } = useI18n()

const displayName = computed(() => {
  if ((KNOWN_SUBJECTS as readonly string[]).includes(props.categoryName)) {
    return t(`subject.${props.categoryName}`)
  }
  if (te(`subject.${props.categoryName}`)) {
    return t(`subject.${props.categoryName}`)
  }
  return props.categoryName
})

const iconComponent = computed(() =>
  props.categoryIcon ? (ICON_MAP[props.categoryIcon] || null) : null
)
</script>

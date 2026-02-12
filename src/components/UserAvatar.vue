<template>
  <div
    class="user-avatar"
    :style="{ backgroundColor: bgColor, color: textColor }"
    :title="name"
  >
    {{ initial }}
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  name: {
    type: String,
    default: ''
  },
  userId: {
    type: [String, Number],
    default: null
  },
  size: {
    type: String,
    default: 'md' // sm, md, lg
  }
})

// Google-style pastel colors (soft and gentle)
const GOOGLE_COLORS = [
  { bg: '#E8F0FE', text: '#1A73E8' }, // Soft blue
  { bg: '#FCE8E6', text: '#D93025' }, // Soft red
  { bg: '#E6F4EA', text: '#188038' }, // Soft green
  { bg: '#FEF7E0', text: '#F9AB00' }, // Soft yellow
  { bg: '#F3E8FD', text: '#9334E6' }, // Soft purple
  { bg: '#E0F7FA', text: '#0097A7' }, // Soft cyan
  { bg: '#FFF3E0', text: '#F57C00' }, // Soft orange
  { bg: '#F3E5F5', text: '#7B1FA2' }, // Soft magenta
  { bg: '#E8F5E9', text: '#388E3C' }, // Soft teal
  { bg: '#E3F2FD', text: '#1976D2' }, // Soft light blue
  { bg: '#FBE9E7', text: '#D84315' }, // Soft deep orange
  { bg: '#E0F2F1', text: '#00796B' }, // Soft mint
]

// Deterministic hash for consistent colors
const getColorIndex = () => {
  const seed = String(props.userId || props.name || 'unknown')
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash) % GOOGLE_COLORS.length
}

const colorSet = computed(() => GOOGLE_COLORS[getColorIndex()])
const bgColor = computed(() => colorSet.value.bg)
const textColor = computed(() => colorSet.value.text)

const initial = computed(() => {
  if (!props.name) return '?'
  return props.name.charAt(0).toUpperCase()
})

const sizeClass = computed(() => `user-avatar--${props.size}`)
</script>

<style scoped>
.user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: 600;
  flex-shrink: 0;
  user-select: none;
}

.user-avatar--sm {
  width: 32px;
  height: 32px;
  font-size: 14px;
}

.user-avatar--md {
  width: 40px;
  height: 40px;
  font-size: 16px;
}

.user-avatar--lg {
  width: 48px;
  height: 48px;
  font-size: 18px;
}
</style>

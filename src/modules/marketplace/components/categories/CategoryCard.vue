<script setup lang="ts">
// TASK F13: CategoryCard component
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, Code, Music, Palette, Calculator, Globe, Dumbbell, Briefcase } from 'lucide-vue-next'
import type { Category } from '../../api/marketplace'

const props = defineProps<{
  category: Category
}>()

const router = useRouter()

// Map icon names to components
const iconMap: Record<string, any> = {
  BookOpen,
  Code,
  Music,
  Palette,
  Calculator,
  Globe,
  Dumbbell,
  Briefcase,
}

const IconComponent = computed(() => {
  return iconMap[props.category.icon] || BookOpen
})

const handleClick = () => {
  router.push(`/tutors/category/${props.category.slug}`)
}
</script>

<template>
  <div
    class="category-card"
    :style="{ '--category-color': category.color }"
    @click="handleClick"
  >
    <div class="card-icon">
      <component :is="IconComponent" :size="28" />
    </div>
    <h3 class="card-title">{{ category.name }}</h3>
    <p class="card-count">{{ category.tutor_count }} tutors</p>
    <span v-if="category.is_featured" class="featured-badge">Featured</span>
  </div>
</template>

<style scoped>
.category-card {
  background: var(--color-bg-primary, white);
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  border: 1px solid var(--color-border, #e5e7eb);
}

.category-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  border-color: var(--category-color, #3b82f6);
}

.card-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--category-color, #3b82f6) 15%, transparent);
  color: var(--category-color, #3b82f6);
  border-radius: 12px;
  margin-bottom: 12px;
}

.card-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 4px;
  color: var(--color-text-primary, #111827);
}

.card-count {
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
  margin: 0;
}

.featured-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 8px;
  background: var(--color-warning-light, #fef3c7);
  color: var(--color-warning-dark, #92400e);
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  text-transform: uppercase;
}
</style>

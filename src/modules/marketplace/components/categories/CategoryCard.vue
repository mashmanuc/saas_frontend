<script setup lang="ts">
// TASK F13: CategoryCard component
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, Code, Music, Palette, Calculator, Globe, Dumbbell, Briefcase } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'
import type { Category } from '../../api/marketplace'

const props = defineProps<{
  category: Category
}>()

const router = useRouter()

const { t } = useI18n()

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
  router.push(`/marketplace/categories/${props.category.slug}`)
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
    <p class="card-count">{{ category.tutor_count }} {{ t('marketplace.search.tutorsPlural') }}</p>
    <span v-if="category.is_featured" class="featured-badge">{{ t('marketplace.categories.featuredBadge') }}</span>
  </div>
</template>

<style scoped>
.category-card {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  border: 1px solid var(--border-color);
}

.category-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
  border-color: var(--category-color, var(--accent-primary));
}

.card-icon {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--category-color, var(--accent-primary)) 15%, transparent);
  color: var(--category-color, var(--accent-primary));
  border-radius: var(--radius-lg);
  margin-bottom: 12px;
}

.card-title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 4px;
  color: var(--text-primary);
}

.card-count {
  font-size: 0.875rem;
  color: var(--text-muted);
  margin: 0;
}

.featured-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 8px;
  background: color-mix(in srgb, var(--warning-bg) 16%, transparent);
  color: color-mix(in srgb, var(--warning-bg) 72%, var(--text-primary));
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  text-transform: uppercase;
}
</style>

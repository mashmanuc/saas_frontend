<script setup lang="ts">
import { ref } from 'vue'
import { X, Search } from 'lucide-vue-next'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'apply', slug: string): void
}>()

const searchQuery = ref('')

const categories = [
  { id: 'all', name: 'All' },
  { id: 'education', name: 'Education' },
  { id: 'brainstorm', name: 'Brainstorm' },
  { id: 'planning', name: 'Planning' },
  { id: 'diagrams', name: 'Diagrams' },
]

const templates = [
  { slug: 'blank', name: 'Blank Canvas', category: 'all', thumbnail: '' },
  { slug: 'lesson-plan', name: 'Lesson Plan', category: 'education', thumbnail: '' },
  { slug: 'mind-map', name: 'Mind Map', category: 'brainstorm', thumbnail: '' },
  { slug: 'kanban', name: 'Kanban Board', category: 'planning', thumbnail: '' },
  { slug: 'flowchart', name: 'Flowchart', category: 'diagrams', thumbnail: '' },
  { slug: 'timeline', name: 'Timeline', category: 'planning', thumbnail: '' },
  { slug: 'swot', name: 'SWOT Analysis', category: 'brainstorm', thumbnail: '' },
  { slug: 'wireframe', name: 'Wireframe', category: 'diagrams', thumbnail: '' },
]

const activeCategory = ref('all')

const filteredTemplates = computed(() => {
  let result = templates

  if (activeCategory.value !== 'all') {
    result = result.filter((t) => t.category === activeCategory.value)
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter((t) => t.name.toLowerCase().includes(query))
  }

  return result
})

import { computed } from 'vue'
</script>

<template>
  <div class="template-gallery-overlay" @click.self="emit('close')">
    <div class="template-gallery">
      <div class="gallery-header">
        <h2>Templates</h2>
        <button class="close-btn" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>

      <div class="gallery-search">
        <Search :size="18" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search templates..."
          class="search-input"
        />
      </div>

      <div class="gallery-categories">
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="category-btn"
          :class="{ active: activeCategory === cat.id }"
          @click="activeCategory = cat.id"
        >
          {{ cat.name }}
        </button>
      </div>

      <div class="gallery-grid">
        <div
          v-for="template in filteredTemplates"
          :key="template.slug"
          class="template-card"
          @click="emit('apply', template.slug)"
        >
          <div class="template-thumbnail">
            <div v-if="!template.thumbnail" class="placeholder">
              {{ template.name.charAt(0) }}
            </div>
            <img v-else :src="template.thumbnail" :alt="template.name" />
          </div>
          <div class="template-name">{{ template.name }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.template-gallery-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.template-gallery {
  background: white;
  border-radius: 16px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.gallery-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #e0e0e0;
}

.gallery-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  color: #666;
}

.close-btn:hover {
  background: #f0f0f0;
}

.gallery-search {
  position: relative;
  padding: 1rem 1.5rem;
}

.search-icon {
  position: absolute;
  left: 2rem;
  top: 50%;
  transform: translateY(-50%);
  color: #999;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 0.875rem;
}

.search-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.gallery-categories {
  display: flex;
  gap: 0.5rem;
  padding: 0 1.5rem 1rem;
  overflow-x: auto;
}

.category-btn {
  padding: 0.5rem 1rem;
  border: none;
  background: #f0f0f0;
  border-radius: 20px;
  font-size: 0.875rem;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
}

.category-btn:hover {
  background: #e0e0e0;
}

.category-btn.active {
  background: #3b82f6;
  color: white;
}

.gallery-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
  padding: 1rem 1.5rem 1.5rem;
  overflow-y: auto;
}

.template-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.template-card:hover {
  transform: translateY(-4px);
}

.template-thumbnail {
  aspect-ratio: 4/3;
  background: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.template-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder {
  font-size: 2rem;
  font-weight: 600;
  color: #ccc;
}

.template-name {
  margin-top: 0.5rem;
  font-size: 0.875rem;
  text-align: center;
}
</style>

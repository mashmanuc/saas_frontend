<template>
  <div class="page-vertical-stack" ref="stackRef">
    <div
      v-for="page in pages"
      :key="page.id"
      :ref="el => setPageRef(page.id, el as HTMLElement)"
      :data-page-id="page.id"
      class="page-stack__item"
      :class="{
        'page-stack__item--active': page.id === activePageId,
        'page-stack__item--presenter': followMode && page.id === presenterPageId,
        'page-stack__item--visible': visiblePages.has(page.id)
      }"
    >
      <div class="page-stack__header">
        <h3 class="page-stack__title">{{ page.title }}</h3>
        <span class="page-stack__index">{{ page.index + 1 }}</span>
      </div>
      <div class="page-stack__content">
        <div v-if="visiblePages.has(page.id)" class="page-stack__canvas">
          <p class="page-stack__placeholder">Page {{ page.index + 1 }} content</p>
        </div>
        <div v-else class="page-stack__skeleton">
          <div class="skeleton-loader"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import type { WhiteboardPage } from '../../types/whiteboard'

interface Props {
  pages: WhiteboardPage[]
  activePageId: string | null
  followMode: boolean
  presenterPageId: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  pageVisible: [pageId: string]
  scrollToPage: [pageId: string]
}>()

const stackRef = ref<HTMLElement | null>(null)
const pageRefs = new Map<string, HTMLElement>()
const visiblePages = ref<Set<string>>(new Set())
let observer: IntersectionObserver | null = null

function setPageRef(pageId: string, el: HTMLElement | null) {
  if (el) {
    pageRefs.set(pageId, el)
  } else {
    pageRefs.delete(pageId)
  }
}

function setupIntersectionObserver() {
  if (!stackRef.value) return

  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const pageId = (entry.target as HTMLElement).dataset.pageId
        if (!pageId) return

        if (entry.isIntersecting) {
          visiblePages.value.add(pageId)
          emit('pageVisible', pageId)
        } else {
          visiblePages.value.delete(pageId)
        }
      })
    },
    {
      root: stackRef.value,
      rootMargin: '200px 0px',
      threshold: 0.1
    }
  )

  pageRefs.forEach((el) => {
    observer?.observe(el)
  })
}

function scrollToPage(pageId: string) {
  const el = pageRefs.get(pageId)
  if (!el || !stackRef.value) return

  el.scrollIntoView({
    behavior: 'smooth',
    block: 'start'
  })
}

watch(() => props.presenterPageId, (newPageId) => {
  if (props.followMode && newPageId) {
    nextTick(() => {
      scrollToPage(newPageId)
    })
  }
})

watch(() => props.pages.length, () => {
  nextTick(() => {
    if (observer) {
      observer.disconnect()
    }
    setupIntersectionObserver()
  })
})

onMounted(() => {
  nextTick(() => {
    setupIntersectionObserver()
  })
})

onUnmounted(() => {
  if (observer) {
    observer.disconnect()
    observer = null
  }
  pageRefs.clear()
})
</script>

<style scoped>
.page-vertical-stack {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 2rem;
  overflow-y: auto;
  flex: 1;
}

.page-stack__item {
  min-height: 600px;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  background: white;
  transition: box-shadow 0.2s;
}

.page-stack__item--active {
  box-shadow: 0 0 0 2px var(--color-primary, #3b82f6);
}

.page-stack__item--presenter {
  box-shadow: 0 0 0 2px var(--color-warning, #f59e0b);
}

.page-stack__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.page-stack__title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.page-stack__index {
  font-size: 0.875rem;
  color: var(--color-text-secondary, #6b7280);
}

.page-stack__content {
  padding: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 500px;
}

.page-stack__placeholder {
  color: var(--color-text-tertiary, #9ca3af);
  font-size: 0.875rem;
}

.page-stack__canvas {
  width: 100%;
  height: 100%;
}

.page-stack__skeleton {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.skeleton-loader {
  width: 80%;
  height: 80%;
  background: linear-gradient(
    90deg,
    #f0f0f0 25%,
    #e0e0e0 50%,
    #f0f0f0 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s ease-in-out infinite;
  border-radius: 4px;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.page-stack__item--visible {
  opacity: 1;
}
</style>

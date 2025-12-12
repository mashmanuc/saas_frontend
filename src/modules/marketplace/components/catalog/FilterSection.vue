<script setup lang="ts">
// FilterSection - collapsible filter section
import { ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    title: string
    defaultOpen?: boolean
  }>(),
  {
    defaultOpen: true,
  }
)

const isOpen = ref(props.defaultOpen)

const toggle = () => {
  isOpen.value = !isOpen.value
}
</script>

<template>
  <div class="filter-section" :class="{ 'is-open': isOpen }">
    <button class="section-header" type="button" @click="toggle">
      <span class="section-title">{{ title }}</span>
      <ChevronDown :size="18" class="chevron" />
    </button>
    <Transition name="collapse">
      <div v-if="isOpen" class="section-content">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.filter-section {
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  padding-bottom: 16px;
  margin-bottom: 16px;
}

.filter-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.chevron {
  color: var(--color-text-secondary, #6b7280);
  transition: transform 0.2s ease;
}

.filter-section.is-open .chevron {
  transform: rotate(180deg);
}

.section-content {
  margin-top: 12px;
}

/* Collapse transition */
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 500px;
}
</style>

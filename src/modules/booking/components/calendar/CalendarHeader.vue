<script setup lang="ts">
// F12: Calendar Header Component
import { computed } from 'vue'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-vue-next'

const props = defineProps<{
  date: Date
  viewMode: 'week' | 'month'
}>()

const emit = defineEmits<{
  prev: []
  next: []
  today: []
  'view-change': [mode: 'week' | 'month']
}>()

const dateRange = computed(() => {
  if (props.viewMode === 'month') {
    return props.date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })
  }

  // Week view - show week range
  const start = new Date(props.date)
  const day = start.getDay()
  const diff = start.getDate() - day + (day === 0 ? -6 : 1)
  start.setDate(diff)

  const end = new Date(start)
  end.setDate(end.getDate() + 6)

  const startStr = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  const endStr = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  return `${startStr} - ${endStr}`
})

const isToday = computed(() => {
  const today = new Date()
  return (
    props.date.getDate() === today.getDate() &&
    props.date.getMonth() === today.getMonth() &&
    props.date.getFullYear() === today.getFullYear()
  )
})
</script>

<template>
  <div class="calendar-header">
    <div class="header-left">
      <button class="nav-btn" @click="emit('prev')">
        <ChevronLeft :size="20" />
      </button>
      <button class="nav-btn" @click="emit('next')">
        <ChevronRight :size="20" />
      </button>
      <h2 class="date-range">{{ dateRange }}</h2>
    </div>

    <div class="header-right">
      <button
        class="today-btn"
        :class="{ active: isToday }"
        @click="emit('today')"
      >
        <Calendar :size="16" />
        Today
      </button>

      <div class="view-toggle">
        <button
          class="toggle-btn"
          :class="{ active: viewMode === 'week' }"
          @click="emit('view-change', 'week')"
        >
          Week
        </button>
        <button
          class="toggle-btn"
          :class="{ active: viewMode === 'month' }"
          @click="emit('view-change', 'month')"
        >
          Month
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--color-bg-primary, white);
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: none;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  cursor: pointer;
  color: var(--color-text-secondary, #6b7280);
  transition: all 0.15s;
}

.nav-btn:hover {
  background: var(--color-bg-secondary, #f5f5f5);
  color: var(--color-text-primary, #111827);
}

.date-range {
  margin: 0 0 0 8px;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.today-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: none;
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.15s;
}

.today-btn:hover {
  background: var(--color-bg-secondary, #f5f5f5);
  color: var(--color-text-primary, #111827);
}

.today-btn.active {
  background: var(--color-primary-light, #eff6ff);
  border-color: var(--color-primary, #3b82f6);
  color: var(--color-primary, #3b82f6);
}

.view-toggle {
  display: flex;
  background: var(--color-bg-secondary, #f5f5f5);
  border-radius: 8px;
  padding: 4px;
}

.toggle-btn {
  padding: 6px 12px;
  background: none;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.15s;
}

.toggle-btn:hover {
  color: var(--color-text-primary, #111827);
}

.toggle-btn.active {
  background: var(--color-bg-primary, white);
  color: var(--color-text-primary, #111827);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

@media (max-width: 640px) {
  .calendar-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .header-left,
  .header-right {
    justify-content: center;
  }

  .date-range {
    font-size: 1rem;
  }
}
</style>

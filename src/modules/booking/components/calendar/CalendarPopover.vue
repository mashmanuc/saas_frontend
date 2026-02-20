<template>
  <Teleport to="body">
    <div
      v-if="isVisible"
      ref="popoverRef"
      class="calendar-popover"
      :style="popoverStyle"
      @click.stop
    >
      <div class="popover-arrow" :style="arrowStyle" />
      <div class="popover-content">
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

interface Props {
  isVisible: boolean
  targetElement?: HTMLElement | null
  position?: 'top' | 'bottom' | 'left' | 'right'
  offset?: number
}

const props = withDefaults(defineProps<Props>(), {
  targetElement: null,
  position: 'bottom',
  offset: 8,
})

const emit = defineEmits<{
  close: []
}>()

const popoverRef = ref<HTMLElement | null>(null)
const popoverPosition = ref({ top: 0, left: 0 })

const popoverStyle = computed(() => ({
  top: `${popoverPosition.value.top}px`,
  left: `${popoverPosition.value.left}px`,
}))

const arrowStyle = computed(() => {
  const position = props.position
  if (position === 'bottom') {
    return { top: '-6px', left: '50%', transform: 'translateX(-50%) rotate(45deg)' }
  } else if (position === 'top') {
    return { bottom: '-6px', left: '50%', transform: 'translateX(-50%) rotate(45deg)' }
  } else if (position === 'right') {
    return { left: '-6px', top: '50%', transform: 'translateY(-50%) rotate(45deg)' }
  } else {
    return { right: '-6px', top: '50%', transform: 'translateY(-50%) rotate(45deg)' }
  }
})

function calculatePosition() {
  if (!props.targetElement || !popoverRef.value) return

  const target = props.targetElement.getBoundingClientRect()
  const popover = popoverRef.value.getBoundingClientRect()
  const offset = props.offset

  let top = 0
  let left = 0

  switch (props.position) {
    case 'bottom':
      top = target.bottom + offset
      left = target.left + (target.width / 2) - (popover.width / 2)
      break
    case 'top':
      top = target.top - popover.height - offset
      left = target.left + (target.width / 2) - (popover.width / 2)
      break
    case 'right':
      top = target.top + (target.height / 2) - (popover.height / 2)
      left = target.right + offset
      break
    case 'left':
      top = target.top + (target.height / 2) - (popover.height / 2)
      left = target.left - popover.width - offset
      break
  }

  // Keep within viewport
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  if (left < 0) left = 8
  if (left + popover.width > viewportWidth) left = viewportWidth - popover.width - 8
  if (top < 0) top = 8
  if (top + popover.height > viewportHeight) top = viewportHeight - popover.height - 8

  popoverPosition.value = { top, left }
}

function handleClickOutside(event: MouseEvent) {
  if (popoverRef.value && !popoverRef.value.contains(event.target as Node)) {
    emit('close')
  }
}

watch(() => props.isVisible, (visible) => {
  if (visible) {
    setTimeout(calculatePosition, 0)
  }
})

watch(() => props.targetElement, () => {
  if (props.isVisible) {
    calculatePosition()
  }
})

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('resize', calculatePosition)
  window.addEventListener('scroll', calculatePosition, true)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', calculatePosition)
  window.removeEventListener('scroll', calculatePosition, true)
})
</script>

<style scoped>
.calendar-popover {
  position: fixed;
  z-index: 9999;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  max-width: 320px;
  min-width: 200px;
}

.popover-arrow {
  position: absolute;
  width: 12px;
  height: 12px;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-right: none;
  border-bottom: none;
}

.popover-content {
  padding: 12px;
}
</style>

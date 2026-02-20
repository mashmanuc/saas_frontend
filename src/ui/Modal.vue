<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="modal-overlay"
        @click.self="handleOverlayClick"
        @keydown.esc="handleEsc"
      >
        <div
          ref="contentRef"
          :class="['modal-content', sizeClass]"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="title ? titleId : undefined"
          tabindex="-1"
          @keydown="handleKeydown"
        >
          <!-- Header -->
          <div class="modal-header">
            <slot name="header">
              <h3 v-if="title" :id="titleId" class="modal-title">{{ title }}</h3>
            </slot>
            <button
              class="modal-close"
              @click="$emit('close')"
              aria-label="Закрити"
              type="button"
            >
              &#x2715;
            </button>
          </div>
          <!-- Body -->
          <div class="modal-body">
            <slot />
          </div>
          <!-- Footer -->
          <div v-if="$slots.footer" class="modal-footer">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount, computed } from 'vue'

const props = defineProps({
  open: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg', 'full'].includes(v),
  },
  closeOnOverlay: {
    type: Boolean,
    default: true,
  },
  closeOnEsc: {
    type: Boolean,
    default: true,
  },
  persistent: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close'])

const contentRef = ref(null)
let previouslyFocusedElement = null

const titleId = computed(() => {
  return 'modal-title-' + Math.random().toString(36).slice(2)
})

const sizeClass = computed(() => {
  return 'modal-content--' + props.size
})

function handleOverlayClick() {
  if (props.persistent) return
  if (props.closeOnOverlay) {
    emit('close')
  }
}

function handleEsc() {
  if (props.persistent) return
  if (props.closeOnEsc) {
    emit('close')
  }
}

function getFocusableElements() {
  if (!contentRef.value) return []
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ]
  return Array.from(contentRef.value.querySelectorAll(selectors.join(',')))
}

function handleKeydown(event) {
  if (event.key !== 'Tab') return

  const focusable = getFocusableElements()
  if (focusable.length === 0) {
    event.preventDefault()
    return
  }

  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault()
      last.focus()
    }
  } else {
    if (document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
}

function lockBodyScroll() {
  document.body.style.overflow = 'hidden'
}

function unlockBodyScroll() {
  document.body.style.overflow = ''
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      previouslyFocusedElement = document.activeElement
      lockBodyScroll()
      await nextTick()
      if (contentRef.value) {
        contentRef.value.focus()
      }
    } else {
      unlockBodyScroll()
      if (previouslyFocusedElement && typeof previouslyFocusedElement.focus === 'function') {
        previouslyFocusedElement.focus()
        previouslyFocusedElement = null
      }
    }
  },
)

onBeforeUnmount(() => {
  unlockBodyScroll()
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay);
  background: var(--color-overlay);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-md);
}
.modal-content {
  position: relative;
  z-index: var(--z-modal);
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  width: 100%;
  outline: none;
}
.modal-content--sm  { max-width: 24rem; }
.modal-content--md  { max-width: 32rem; }
.modal-content--lg  { max-width: 48rem; }
.modal-content--full { max-width: calc(100vw - 2rem); }

.modal-header {
  padding: var(--space-lg) var(--space-lg) var(--space-sm);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-color);
}
.modal-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}
.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  background: none;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: var(--transition-fast);
  font-size: 1rem;
  line-height: 1;
}
.modal-close:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}
.modal-body {
  padding: var(--space-md) var(--space-lg);
}
.modal-footer {
  padding: var(--space-sm) var(--space-lg) var(--space-lg);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-xs);
  border-top: 1px solid var(--border-color);
}

/* Animations */
.modal-enter-active,
.modal-leave-active {
  transition: opacity var(--transition-base);
}
.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform var(--transition-base), opacity var(--transition-base);
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal-content {
  transform: translateY(16px);
  opacity: 0;
}
.modal-leave-to .modal-content {
  transform: translateY(8px);
  opacity: 0;
}

/* Mobile */
@media (max-width: 640px) {
  .modal-content {
    max-width: 100% !important;
    max-height: calc(100vh - 1rem);
    margin: 0.5rem;
  }
}
</style>

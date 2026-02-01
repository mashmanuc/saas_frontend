<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { Teleport } from 'vue';

export type ModalType = 'confirm' | 'form' | 'info';
export type ModalSize = 'sm' | 'md' | 'lg' | 'fullscreen';
export type FooterAlign = 'left' | 'center' | 'right' | 'space-between';

export interface ModalProps {
  modelValue: boolean;
  title?: string;
  type?: ModalType;
  size?: ModalSize;
  showCloseButton?: boolean;
  closeOnOverlay?: boolean;
  closeOnEsc?: boolean;
  footerAlign?: FooterAlign;
  teleportTo?: string;
}

const props = withDefaults(defineProps<ModalProps>(), {
  type: 'info',
  size: 'md',
  showCloseButton: true,
  closeOnOverlay: true,
  closeOnEsc: true,
  footerAlign: 'right',
  teleportTo: 'body',
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  close: [];
}>();

const modalRef = ref<HTMLDivElement | null>(null);
const previousFocus = ref<HTMLElement | null>(null);

const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const close = () => {
  emit('update:modelValue', false);
  emit('close');
};

const handleOverlayClick = () => {
  if (props.closeOnOverlay) close();
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.closeOnEsc) {
    close();
    return;
  }

  if (e.key === 'Tab' && modalRef.value) {
    const focusable = modalRef.value.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
};

const footerAlignClass = computed(() => ({
  left: 'footerLeft',
  center: 'footerCenter',
  right: '',
  'space-between': 'footerSpaceBetween',
})[props.footerAlign]);

watch(() => props.modelValue, async (isOpen) => {
  if (isOpen) {
    previousFocus.value = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';
    await nextTick();
    const firstFocusable = modalRef.value?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    firstFocusable?.focus();
  } else {
    document.body.style.overflow = '';
    previousFocus.value?.focus();
  }
});

onUnmounted(() => {
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport :to="teleportTo">
    <div
      v-if="modelValue"
      :class="$style.overlay"
      @click.self="handleOverlayClick"
      @keydown="handleKeyDown"
    >
      <div
        ref="modalRef"
        :class="[$style.modal, $style[size], $style[type]]"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="title ? 'modal-title' : undefined"
      >
        <!-- Header -->
        <div v-if="title || showCloseButton" :class="$style.header">
          <h2 v-if="title" id="modal-title" :class="$style.title">{{ title }}</h2>
          <button
            v-if="showCloseButton"
            type="button"
            :class="$style.closeButton"
            aria-label="Закрити"
            @click="close"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div :class="$style.body">
          <slot />
        </div>

        <!-- Footer -->
        <div v-if="$slots.footer" :class="[$style.footer, $style[footerAlignClass]]">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style module>
.overlay {
  position: fixed;
  inset: 0;
  background-color: var(--ui-overlay-bg, rgba(0, 0, 0, 0.5));
  backdrop-filter: blur(4px);
  z-index: var(--ui-z-modal-backdrop, 200);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--ui-space-lg, 1rem);
  animation: fadeIn var(--ui-transition-fast, 150ms) ease-out;
}

.modal {
  position: relative;
  background-color: var(--ui-color-card, rgba(255, 255, 255, 0.9));
  border: 1px solid var(--ui-color-border, rgba(5, 150, 105, 0.2));
  border-radius: var(--ui-radius-xl, 1rem);
  box-shadow: var(--ui-shadow-xl, 0 20px 25px rgba(0, 0, 0, 0.15));
  z-index: var(--ui-z-modal, 210);
  max-height: calc(100vh - 2rem);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: slideUp var(--ui-transition-normal, 250ms) ease-out;
}

/* Sizes */
.sm { width: var(--ui-modal-width-sm, 24rem); }
.md { width: var(--ui-modal-width-md, 32rem); }
.lg { width: var(--ui-modal-width-lg, 48rem); }
.fullscreen { width: 100%; height: 100%; max-height: 100vh; border-radius: 0; }

/* Types */
.confirm { max-width: var(--ui-modal-width-sm, 24rem); }
.form { max-width: var(--ui-modal-width-md, 32rem); }
.info { max-width: var(--ui-modal-width-md, 32rem); }

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--ui-space-lg, 1rem) var(--ui-space-xl, 1.5rem);
  border-bottom: 1px solid var(--ui-color-border, rgba(5, 150, 105, 0.2));
}

.title {
  font-size: var(--ui-font-size-lg, 1.125rem);
  font-weight: var(--ui-font-weight-semibold, 600);
  color: var(--ui-color-text, #0d4a3e);
  margin: 0;
}

.closeButton {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: none;
  background: transparent;
  color: var(--ui-color-text-muted, #1f6b5a);
  border-radius: var(--ui-radius-md, 0.5rem);
  cursor: pointer;
  transition: all var(--ui-transition-fast, 150ms);
}
.closeButton:hover { background-color: color-mix(in srgb, var(--ui-color-danger, #ef4444) 10%, transparent); color: var(--ui-color-danger, #ef4444); }
.closeButton:focus-visible { outline: 2px solid var(--ui-color-primary, #059669); outline-offset: 2px; }

.body {
  padding: var(--ui-space-xl, 1.5rem);
  overflow-y: auto;
  flex: 1;
  color: var(--ui-color-text, #0d4a3e);
}

.footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--ui-space-sm, 0.5rem);
  padding: var(--ui-space-lg, 1rem) var(--ui-space-xl, 1.5rem);
  border-top: 1px solid var(--ui-color-border, rgba(5, 150, 105, 0.2));
}
.footerLeft { justify-content: flex-start; }
.footerCenter { justify-content: center; }
.footerSpaceBetween { justify-content: space-between; }

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(1rem) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
</style>

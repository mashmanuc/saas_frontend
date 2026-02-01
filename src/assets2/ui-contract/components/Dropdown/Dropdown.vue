<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

export type DropdownPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: string;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
}

export type DropdownItemType = DropdownItem | 'divider' | { header: string };

export interface DropdownProps {
  items: DropdownItemType[];
  position?: DropdownPosition;
  closeOnSelect?: boolean;
  disabled?: boolean;
}

const props = withDefaults(defineProps<DropdownProps>(), {
  position: 'bottom-left',
  closeOnSelect: true,
  disabled: false,
});

const emit = defineEmits<{
  select: [item: DropdownItem];
}>();

const isOpen = ref(false);
const highlightedIndex = ref(-1);
const containerRef = ref<HTMLDivElement | null>(null);

const positionClass = computed(() => ({
  'bottom-left': 'bottomLeft',
  'bottom-right': 'bottomRight',
  'top-left': 'topLeft',
  'top-right': 'topRight',
})[props.position]);

const actionItems = computed(() =>
  props.items.filter((item): item is DropdownItem =>
    typeof item === 'object' && 'id' in item && !item.disabled
  )
);

const handleToggle = () => {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
  highlightedIndex.value = -1;
};

const handleClose = () => {
  isOpen.value = false;
  highlightedIndex.value = -1;
};

const handleItemClick = (item: DropdownItem) => {
  if (item.disabled) return;
  emit('select', item);
  if (props.closeOnSelect) handleClose();
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (!isOpen.value) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      handleToggle();
    }
    return;
  }

  switch (e.key) {
    case 'Escape':
      e.preventDefault();
      handleClose();
      break;
    case 'ArrowDown':
      e.preventDefault();
      highlightedIndex.value = Math.min(highlightedIndex.value + 1, actionItems.value.length - 1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
      break;
    case 'Enter':
      e.preventDefault();
      if (highlightedIndex.value >= 0 && actionItems.value[highlightedIndex.value]) {
        handleItemClick(actionItems.value[highlightedIndex.value]);
      }
      break;
    case 'Tab':
      handleClose();
      break;
  }
};

const isItemType = (item: DropdownItemType): item is DropdownItem => {
  return typeof item === 'object' && 'id' in item;
};

const isHeader = (item: DropdownItemType): item is { header: string } => {
  return typeof item === 'object' && 'header' in item;
};

// Outside click
const handleOutsideClick = (e: MouseEvent) => {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    handleClose();
  }
};

onMounted(() => {
  document.addEventListener('mousedown', handleOutsideClick);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleOutsideClick);
});
</script>

<template>
  <div ref="containerRef" :class="$style.container" @keydown="handleKeyDown">
    <div
      :class="$style.trigger"
      role="button"
      aria-haspopup="menu"
      :aria-expanded="isOpen"
      :tabindex="disabled ? -1 : 0"
      @click="handleToggle"
    >
      <slot name="trigger" />
    </div>

    <div v-if="isOpen" :class="[$style.menu, $style[positionClass]]" role="menu">
      <template v-for="(item, index) in items" :key="index">
        <div v-if="item === 'divider'" :class="$style.divider" role="separator" />

        <div v-else-if="isHeader(item)" :class="$style.header">
          {{ item.header }}
        </div>

        <button
          v-else-if="isItemType(item)"
          type="button"
          :class="[$style.item, {
            [$style.disabled]: item.disabled,
            [$style.danger]: item.danger,
            [$style.highlighted]: actionItems.indexOf(item) === highlightedIndex
          }]"
          :disabled="item.disabled"
          role="menuitem"
          @click="handleItemClick(item)"
        >
          <span v-if="item.icon" :class="$style.itemIcon">{{ item.icon }}</span>
          {{ item.label }}
          <span v-if="item.shortcut" :class="$style.itemShortcut">{{ item.shortcut }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<style module>
.container { position: relative; display: inline-block; }

.trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--ui-space-xs, 0.25rem);
  cursor: pointer;
  user-select: none;
}

.menu {
  position: absolute;
  min-width: 10rem;
  padding: var(--ui-space-xs, 0.25rem) 0;
  background-color: var(--ui-color-card, rgba(255, 255, 255, 0.9));
  border: 1px solid var(--ui-color-border, rgba(5, 150, 105, 0.2));
  border-radius: var(--ui-radius-md, 0.5rem);
  box-shadow: var(--ui-shadow-lg, 0 10px 15px rgba(0, 0, 0, 0.1));
  z-index: var(--ui-z-dropdown, 100);
  animation: menuSlide var(--ui-transition-fast, 150ms) ease-out;
}

.bottomLeft { top: 100%; left: 0; margin-top: var(--ui-space-xs, 0.25rem); }
.bottomRight { top: 100%; right: 0; margin-top: var(--ui-space-xs, 0.25rem); }
.topLeft { bottom: 100%; left: 0; margin-bottom: var(--ui-space-xs, 0.25rem); }
.topRight { bottom: 100%; right: 0; margin-bottom: var(--ui-space-xs, 0.25rem); }

.item {
  display: flex;
  align-items: center;
  gap: var(--ui-space-sm, 0.5rem);
  width: 100%;
  padding: var(--ui-space-sm, 0.5rem) var(--ui-space-md, 0.75rem);
  border: none;
  background: transparent;
  color: var(--ui-color-text, #0d4a3e);
  font-size: var(--ui-font-size-sm, 0.875rem);
  text-align: left;
  cursor: pointer;
  transition: background-color var(--ui-transition-fast, 150ms);
}
.item:hover, .item.highlighted { background-color: color-mix(in srgb, var(--ui-color-primary, #059669) 10%, transparent); }
.item:focus { outline: none; background-color: color-mix(in srgb, var(--ui-color-primary, #059669) 10%, transparent); }
.item.disabled { opacity: 0.5; cursor: not-allowed; }
.item.danger { color: var(--ui-color-danger, #ef4444); }
.item.danger:hover { background-color: color-mix(in srgb, var(--ui-color-danger, #ef4444) 10%, transparent); }

.itemIcon { width: 1rem; flex-shrink: 0; }
.itemShortcut { margin-left: auto; font-size: var(--ui-font-size-xs, 0.75rem); color: var(--ui-color-text-muted, #1f6b5a); }

.divider { height: 1px; margin: var(--ui-space-xs, 0.25rem) 0; background-color: var(--ui-color-border, rgba(5, 150, 105, 0.2)); }

.header {
  padding: var(--ui-space-sm, 0.5rem) var(--ui-space-md, 0.75rem);
  font-size: var(--ui-font-size-xs, 0.75rem);
  font-weight: var(--ui-font-weight-semibold, 600);
  color: var(--ui-color-text-muted, #1f6b5a);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

@keyframes menuSlide { from { opacity: 0; transform: translateY(-0.25rem); } to { opacity: 1; transform: translateY(0); } }
</style>

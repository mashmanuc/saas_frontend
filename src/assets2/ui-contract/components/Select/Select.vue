<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  disabled?: boolean;
  group?: string;
}

export interface SelectProps<T = string> {
  modelValue?: T | null;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  loading?: boolean;
  searchable?: boolean;
  searchThreshold?: number;
  clearable?: boolean;
  emptyMessage?: string;
  loadingMessage?: string;
  name?: string;
}

const props = withDefaults(defineProps<SelectProps>(), {
  modelValue: null,
  placeholder: 'Оберіть...',
  disabled: false,
  error: false,
  loading: false,
  searchable: false,
  searchThreshold: 5,
  clearable: false,
  emptyMessage: 'Нічого не знайдено',
  loadingMessage: 'Завантаження...',
});

const emit = defineEmits<{
  'update:modelValue': [value: unknown];
}>();

const isOpen = ref(false);
const search = ref('');
const highlightedIndex = ref(-1);
const containerRef = ref<HTMLDivElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);

const showSearch = computed(() => props.searchable || props.options.length > props.searchThreshold);

const filteredOptions = computed(() => {
  if (!search.value) return props.options;
  const lower = search.value.toLowerCase();
  return props.options.filter((o) => o.label.toLowerCase().includes(lower));
});

const selectedOption = computed(() => props.options.find((o) => o.value === props.modelValue));

const groupedOptions = computed(() => {
  const groups: { label: string | null; options: SelectOption[] }[] = [];
  filteredOptions.value.forEach((opt) => {
    const groupLabel = opt.group || null;
    let group = groups.find((g) => g.label === groupLabel);
    if (!group) {
      group = { label: groupLabel, options: [] };
      groups.push(group);
    }
    group.options.push(opt);
  });
  return groups;
});

const handleOpen = () => {
  if (props.disabled || props.loading) return;
  isOpen.value = true;
  highlightedIndex.value = -1;
  setTimeout(() => searchInputRef.value?.focus(), 0);
};

const handleClose = () => {
  isOpen.value = false;
  search.value = '';
  highlightedIndex.value = -1;
};

const handleSelect = (opt: SelectOption) => {
  if (opt.disabled) return;
  emit('update:modelValue', opt.value);
  handleClose();
};

const handleClear = (e: Event) => {
  e.stopPropagation();
  emit('update:modelValue', null);
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (!isOpen.value) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
      e.preventDefault();
      handleOpen();
    }
    return;
  }

  const flatOptions = filteredOptions.value.filter((o) => !o.disabled);

  switch (e.key) {
    case 'Escape':
      e.preventDefault();
      handleClose();
      break;
    case 'ArrowDown':
      e.preventDefault();
      highlightedIndex.value = Math.min(highlightedIndex.value + 1, flatOptions.length - 1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
      break;
    case 'Enter':
      e.preventDefault();
      if (highlightedIndex.value >= 0 && flatOptions[highlightedIndex.value]) {
        handleSelect(flatOptions[highlightedIndex.value]);
      }
      break;
  }
};

// Close on outside click
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
    <input type="hidden" :name="name" :value="modelValue != null ? String(modelValue) : ''" />

    <button
      type="button"
      :class="[$style.trigger, { [$style.open]: isOpen, [$style.disabled]: disabled, [$style.error]: error }]"
      :disabled="disabled"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      @click="isOpen ? handleClose() : handleOpen()"
    >
      <span :class="[$style.value, { [$style.placeholder]: !selectedOption }]">
        {{ selectedOption?.label || placeholder }}
      </span>

      <span v-if="clearable && selectedOption && !disabled" :class="$style.clearBtn" @click="handleClear">
        ✕
      </span>

      <svg :class="[$style.chevron, { [$style.rotated]: isOpen }]" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </button>

    <div v-if="isOpen" :class="$style.dropdown" role="listbox">
      <div v-if="showSearch" :class="$style.searchWrapper">
        <input
          ref="searchInputRef"
          v-model="search"
          type="text"
          :class="$style.searchInput"
          placeholder="Пошук..."
        />
      </div>

      <div v-if="loading" :class="$style.loading">
        <div :class="$style.loadingSpinner" />
        {{ loadingMessage }}
      </div>

      <div v-else-if="filteredOptions.length === 0" :class="$style.empty">
        {{ emptyMessage }}
      </div>

      <ul v-else :class="$style.optionsList">
        <template v-for="(group, gi) in groupedOptions" :key="group.label || gi">
          <li v-if="group.label" :class="$style.groupLabel">{{ group.label }}</li>
          <li
            v-for="opt in group.options"
            :key="String(opt.value)"
            :class="[$style.option, {
              [$style.selected]: opt.value === modelValue,
              [$style.disabled]: opt.disabled,
              [$style.highlighted]: filteredOptions.indexOf(opt) === highlightedIndex
            }]"
            role="option"
            :aria-selected="opt.value === modelValue"
            @click="handleSelect(opt)"
          >
            <svg v-if="opt.value === modelValue" :class="$style.optionCheck" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            {{ opt.label }}
          </li>
        </template>
      </ul>
    </div>
  </div>
</template>

<style module>
.container { position: relative; width: 100%; }

.trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: var(--ui-input-height, 2.5rem);
  padding: 0 var(--ui-space-md, 0.75rem);
  background-color: var(--ui-color-surface, rgba(255, 255, 255, 0.9));
  border: 1px solid var(--ui-color-border, rgba(5, 150, 105, 0.2));
  border-radius: var(--ui-radius-md, 0.5rem);
  color: var(--ui-color-text, #0d4a3e);
  font-size: var(--ui-font-size-md, 1rem);
  cursor: pointer;
  transition: all var(--ui-transition-fast, 150ms);
  outline: none;
}
.trigger:hover { border-color: var(--ui-color-primary, #059669); }
.trigger:focus { border-color: var(--ui-color-primary, #059669); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary, #059669) 20%, transparent); }
.trigger.open { border-color: var(--ui-color-primary, #059669); border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
.trigger.disabled { opacity: 0.6; cursor: not-allowed; }
.trigger.error { border-color: var(--ui-color-danger, #ef4444); }

.value { flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.placeholder { color: var(--ui-color-text-muted, #1f6b5a); }

.clearBtn { margin-right: 0.25rem; cursor: pointer; color: var(--ui-color-text-muted, #1f6b5a); }
.clearBtn:hover { color: var(--ui-color-danger, #ef4444); }

.chevron {
  width: 1.25rem;
  height: 1.25rem;
  color: var(--ui-color-text-muted, #1f6b5a);
  transition: transform var(--ui-transition-fast, 150ms);
  flex-shrink: 0;
}
.chevron.rotated { transform: rotate(180deg); }

.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 15rem;
  overflow-y: auto;
  background-color: var(--ui-color-card, rgba(255, 255, 255, 0.9));
  border: 1px solid var(--ui-color-primary, #059669);
  border-top: none;
  border-bottom-left-radius: var(--ui-radius-md, 0.5rem);
  border-bottom-right-radius: var(--ui-radius-md, 0.5rem);
  box-shadow: var(--ui-shadow-lg, 0 10px 15px rgba(0, 0, 0, 0.1));
  z-index: var(--ui-z-dropdown, 100);
  animation: dropdownSlide var(--ui-transition-fast, 150ms) ease-out;
}

.searchWrapper { padding: var(--ui-space-sm, 0.5rem); border-bottom: 1px solid var(--ui-color-border, rgba(5, 150, 105, 0.2)); }
.searchInput {
  width: 100%;
  height: 2rem;
  padding: 0 var(--ui-space-sm, 0.5rem);
  border: 1px solid var(--ui-color-border, rgba(5, 150, 105, 0.2));
  border-radius: var(--ui-radius-sm, 0.375rem);
  font-size: var(--ui-font-size-sm, 0.875rem);
  outline: none;
  background-color: var(--ui-color-surface, rgba(255, 255, 255, 0.9));
  color: var(--ui-color-text, #0d4a3e);
}
.searchInput:focus { border-color: var(--ui-color-primary, #059669); }

.optionsList { list-style: none; margin: 0; padding: var(--ui-space-xs, 0.25rem) 0; }

.option {
  display: flex;
  align-items: center;
  padding: var(--ui-space-sm, 0.5rem) var(--ui-space-md, 0.75rem);
  cursor: pointer;
  transition: background-color var(--ui-transition-fast, 150ms);
  color: var(--ui-color-text, #0d4a3e);
}
.option:hover, .option.highlighted { background-color: color-mix(in srgb, var(--ui-color-primary, #059669) 10%, transparent); }
.option.selected { background-color: color-mix(in srgb, var(--ui-color-primary, #059669) 15%, transparent); color: var(--ui-color-primary, #059669); font-weight: var(--ui-font-weight-medium, 500); }
.option.disabled { opacity: 0.5; cursor: not-allowed; }

.optionCheck { width: 1rem; height: 1rem; margin-right: var(--ui-space-sm, 0.5rem); color: var(--ui-color-primary, #059669); }

.loading, .empty { padding: var(--ui-space-lg, 1rem); text-align: center; color: var(--ui-color-text-muted, #1f6b5a); font-size: var(--ui-font-size-sm, 0.875rem); }
.loadingSpinner {
  width: 1.5rem;
  height: 1.5rem;
  margin: 0 auto var(--ui-space-sm, 0.5rem);
  border: 2px solid var(--ui-color-border, rgba(5, 150, 105, 0.2));
  border-top-color: var(--ui-color-primary, #059669);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.groupLabel {
  padding: var(--ui-space-sm, 0.5rem) var(--ui-space-md, 0.75rem);
  font-size: var(--ui-font-size-xs, 0.75rem);
  font-weight: var(--ui-font-weight-semibold, 600);
  color: var(--ui-color-text-muted, #1f6b5a);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

@keyframes dropdownSlide { from { opacity: 0; transform: translateY(-0.5rem); } to { opacity: 1; transform: translateY(0); } }
@keyframes spin { to { transform: rotate(360deg); } }
</style>

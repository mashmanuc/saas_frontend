<template>
  <div class="sort-dropdown" ref="dropdownRef">
    <button type="button" class="sort-dropdown__button" @click="toggle">
      <span class="sort-dropdown__label">Сортування</span>
      <span class="sort-dropdown__value">{{ activeLabel }}</span>
      <span class="sort-dropdown__chevron" :class="{ 'is-open': open }">⌄</span>
    </button>

    <transition name="scale-fade">
      <ul v-if="open" class="sort-dropdown__menu">
        <li v-for="option in options" :key="option.value" class="sort-dropdown__item">
          <button
            type="button"
            :class="['sort-dropdown__option', { 'is-active': option.value === modelValue }]"
            @click="select(option.value)"
          >
            <span>{{ option.label }}</span>
          </button>
        </li>
      </ul>
    </transition>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: 'relevance',
  },
  options: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['update:modelValue'])
const open = ref(false)
const dropdownRef = ref(null)

const activeLabel = computed(() => {
  const match = props.options.find((option) => option.value === props.modelValue)
  return match?.label || 'За замовчуванням'
})

function toggle() {
  open.value = !open.value
}

function select(value) {
  emit('update:modelValue', value)
  open.value = false
}

function handleClickOutside(event) {
  if (!dropdownRef.value) return
  if (!dropdownRef.value.contains(event.target)) {
    open.value = false
  }
}

onMounted(() => {
  window.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  window.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.sort-dropdown {
  position: relative;
}

.sort-dropdown__button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  border-radius: var(--radius-full);
  border: 1px solid hsla(223, 13%, 35%, 0.2);
  padding: 0.45rem 0.85rem;
  background: var(--surface-card);
  cursor: pointer;
  font: 500 0.95rem/1.3 var(--font-sans, 'Inter', system-ui, sans-serif);
}

.sort-dropdown__label {
  color: var(--text-subtle);
  text-transform: uppercase;
  font: var(--font-eyebrow);
  letter-spacing: 0.08em;
}

.sort-dropdown__value {
  color: var(--text-primary);
}

.sort-dropdown__chevron {
  font-size: 0.85rem;
  transition: transform 0.2s ease;
}

.sort-dropdown__chevron.is-open {
  transform: rotate(180deg);
}

.sort-dropdown__menu {
  position: absolute;
  right: 0;
  margin-top: 0.4rem;
  min-width: 220px;
  background: var(--surface-card);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  padding: 0.35rem;
  z-index: 15;
}

.sort-dropdown__item + .sort-dropdown__item {
  margin-top: 0.2rem;
}

.sort-dropdown__option {
  width: 100%;
  text-align: left;
  border: none;
  background: transparent;
  padding: 0.65rem 0.75rem;
  border-radius: var(--radius-sm);
  font: inherit;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.2s ease;
}

.sort-dropdown__option:hover {
  background: var(--accent-muted);
}

.sort-dropdown__option.is-active {
  background: var(--accent-muted);
  color: var(--accent-primary-strong);
}

.scale-fade-enter-active,
.scale-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.scale-fade-enter-from,
.scale-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>

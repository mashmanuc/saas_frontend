<template>
  <div class="tutor-search-box">
    <label class="tutor-search-box__field">
      <span class="tutor-search-box__icon" aria-hidden="true">
        🔍
      </span>
      <input
        ref="inputRef"
        type="text"
        :value="modelValue"
        :placeholder="placeholder"
        @input="onInput"
        @focus="isFocused = true"
        @blur="handleBlur"
      />
      <button
        v-if="modelValue"
        type="button"
        class="tutor-search-box__clear"
        @mousedown.prevent
        @click="clear"
        aria-label="Очистити пошук"
      >
        ✕
      </button>
    </label>

    <transition name="fade">
      <div v-if="showPresets" class="tutor-search-box__presets">
        <p>Популярні запити:</p>
        <div class="preset-chips">
          <button
            v-for="preset in presets"
            :key="preset"
            type="button"
            @click="applyPreset(preset)"
          >
            {{ preset }}
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: "Введіть ім'я або предмет",
  },
  presets: {
    type: Array,
    default: () => ['STEM', 'ЗНО', 'IB Diploma', 'English B2'],
  },
})

const emit = defineEmits(['update:modelValue', 'preset'])

const isFocused = ref(false)
const inputRef = ref(null)

const showPresets = computed(() => isFocused.value && !props.modelValue)

function onInput(event) {
  emit('update:modelValue', event.target.value)
}

function clear() {
  emit('update:modelValue', '')
  inputRef.value?.focus()
}

function applyPreset(value) {
  emit('update:modelValue', value)
  emit('preset', value)
}

function handleBlur() {
  // Delay to let preset buttons receive click
  window.setTimeout(() => {
    isFocused.value = false
  }, 120)
}
</script>

<style scoped>
.tutor-search-box {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.tutor-search-box__field {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 0.9rem 1.15rem;
  border-radius: var(--radius-full);
  background: var(--surface-card);
  border: 1px solid hsla(223, 28%, 45%, 0.15);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
}

.tutor-search-box__field input {
  flex: 1;
  border: none;
  background: transparent;
  font: 500 1rem/1.4 var(--font-sans, 'Inter', system-ui, sans-serif);
  color: var(--text-primary);
}

.tutor-search-box__field input::placeholder {
  color: var(--text-subtle);
}

.tutor-search-box__field input:focus {
  outline: none;
}

.tutor-search-box__icon {
  font-size: 1.1rem;
}

.tutor-search-box__clear {
  border: none;
  background: none;
  font-size: 0.85rem;
  color: var(--text-subtle);
  cursor: pointer;
}

.tutor-search-box__presets {
  background: var(--surface-card);
  border-radius: var(--radius-lg);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid hsla(223, 28%, 45%, 0.08);
  font-size: 0.85rem;
  color: var(--text-muted);
}

.tutor-search-box__presets p {
  margin: 0 0 var(--space-xs);
  font-weight: 500;
}

.preset-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs);
}

.preset-chips button {
  border: none;
  border-radius: var(--radius-full);
  padding: 0.25rem 0.75rem;
  background: var(--surface-elevated);
  color: var(--text-primary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.preset-chips button:hover {
  background: var(--accent-muted);
  transform: translateY(-1px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

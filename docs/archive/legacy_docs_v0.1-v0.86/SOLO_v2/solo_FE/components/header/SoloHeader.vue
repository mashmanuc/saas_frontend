<template>
  <header class="solo-header">
    <div class="solo-header__left">
      <span class="solo-header__logo">📝</span>
      <input
        class="solo-header__title"
        :value="name"
        @input="$emit('update:name', ($event.target as HTMLInputElement).value)"
        @blur="$emit('save')"
      />
    </div>
    <div class="solo-header__right">
      <span v-if="lastSaved" class="solo-header__saved">
        Saved {{ formatTime(lastSaved) }}
      </span>
      <button class="solo-btn" title="Save (Ctrl+S)" @click="$emit('save')">
        💾
      </button>
      <button class="solo-btn" title="Export PNG" @click="$emit('export-png')">
        🖼️
      </button>
      <button class="solo-btn" title="Export JSON" @click="$emit('export-json')">
        📄
      </button>
      <button class="solo-btn solo-btn--danger" title="Exit" @click="$emit('exit')">
        ✕
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  name: string
  lastSaved: Date | null
}>()

defineEmits<{
  'update:name': [name: string]
  save: []
  'export-png': []
  'export-json': []
  exit: []
}>()

function formatTime(date: Date): string {
  return date.toLocaleTimeString()
}
</script>

<style scoped>
.solo-header__logo {
  font-size: 20px;
}

.solo-header__title {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  padding: 4px 8px;
  color: var(--solo-text);
  font-size: 14px;
  font-weight: 600;
}

.solo-header__title:hover {
  border-color: var(--solo-border);
}

.solo-header__title:focus {
  outline: none;
  border-color: var(--solo-accent);
}

.solo-header__saved {
  font-size: 12px;
  color: var(--solo-text-muted);
}
</style>

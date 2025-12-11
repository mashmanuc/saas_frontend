<template>
  <div class="rounded-2xl border border-border-subtle bg-surface-soft/60 px-4 py-3 space-y-3 text-sm text-muted">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs uppercase tracking-wide text-muted">{{ $t('board.toolbar.tools') }}</span>
      <button
        v-for="toolOption in toolOptions"
        :key="toolOption.value"
        type="button"
        class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition"
        :class="tool === toolOption.value ? 'bg-accent text-white border-accent' : 'border-border-subtle text-body'"
        @click="$emit('update:tool', toolOption.value)"
      >
        {{ toolOption.label }}
      </button>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs uppercase tracking-wide text-muted">{{ $t('board.toolbar.colors') }}</span>
      <button
        v-for="colorOption in colors"
        :key="colorOption"
        type="button"
        class="h-6 w-6 rounded-full border-2 border-white shadow-inner focus:outline-none focus:ring-2 focus:ring-accent"
        :style="{ backgroundColor: colorOption }"
        :class="color === colorOption ? 'ring-2 ring-accent' : 'border-border-subtle'"
        @click="$emit('update:color', colorOption)"
      ></button>
      <label class="flex items-center gap-2 text-xs font-semibold text-muted ml-auto">
        {{ $t('board.toolbar.thickness') }}
        <input
          type="range"
          min="1"
          max="12"
          step="1"
          :value="thickness"
          class="accent-accent h-1 rounded-full bg-border-subtle"
          @input="$emit('update:thickness', Number($event.target.value))"
        />
        <span class="text-body w-6 text-right">{{ thickness }}px</span>
      </label>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        class="rounded-full border border-border-subtle px-4 py-1 text-xs font-semibold text-body transition hover:bg-border-subtle/30 disabled:opacity-50"
        :disabled="!canUndo"
        @click="$emit('undo')"
      >
        {{ $t('board.toolbar.undo') }}
      </button>
      <button
        type="button"
        class="rounded-full border border-border-subtle px-4 py-1 text-xs font-semibold text-body transition hover:bg-border-subtle/30 disabled:opacity-50"
        :disabled="!canRedo"
        @click="$emit('redo')"
      >
        {{ $t('board.toolbar.redo') }}
      </button>
      <button
        type="button"
        class="rounded-full border border-danger/30 px-4 py-1 text-xs font-semibold text-danger transition hover:bg-danger/10"
        @click="$emit('clear')"
      >
        {{ $t('board.toolbar.clear') }}
      </button>

      <span class="ml-auto text-xs flex items-center gap-2" :class="saving ? 'text-accent' : 'text-muted'">
        <span class="h-2 w-2 rounded-full" :class="saving ? 'bg-accent animate-pulse' : 'bg-success'"></span>
        {{ saving ? $t('board.status.saving') : $t('board.status.saved') }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  tool: {
    type: String,
    default: 'pencil',
  },
  color: {
    type: String,
    default: '#111827',
  },
  thickness: {
    type: Number,
    default: 3,
  },
  colors: {
    type: Array,
    default: () => ['#111827', '#dc2626', '#2563eb', '#16a34a', '#f97316', '#d946ef'],
  },
  canUndo: {
    type: Boolean,
    default: false,
  },
  canRedo: {
    type: Boolean,
    default: false,
  },
  saving: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:tool', 'update:color', 'update:thickness', 'undo', 'redo', 'clear'])

const { t } = useI18n()

const toolOptions = computed(() => [
  { value: 'pencil', label: `✏️ ${t('board.tools.pencil')}` },
  { value: 'eraser', label: `🩹 ${t('board.tools.eraser')}` },
])
</script>

<style scoped>
.bg-surface-soft {
  background-color: rgba(7, 15, 30, 0.04);
}
.border-border-subtle {
  border-color: rgba(7, 15, 30, 0.08);
}
.text-body {
  color: rgba(7, 15, 30, 0.9);
}
.text-muted {
  color: rgba(7, 15, 30, 0.55);
}
.bg-danger {
  background: #dc2626;
}
.border-danger {
  border-color: #dc2626;
}
.bg-success {
  background: #16a34a;
}
.text-danger {
  color: #dc2626;
}
.accent-accent {
  accent-color: #4f46e5;
}
</style>

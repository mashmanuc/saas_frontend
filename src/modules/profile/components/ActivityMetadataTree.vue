<template>
  <div class="metadata-tree">
    <details v-if="isExpandable" :open="depth < 1">
      <summary>
        <span v-if="label" class="metadata-key">{{ label }}</span>
        <span class="metadata-type">{{ typeLabel }}</span>
      </summary>
      <div class="metadata-children">
        <ActivityMetadataTree
          v-for="([childKey, childValue], index) in entries"
          :key="`${childKey}-${index}`"
          :label="childKeyLabel(childKey, index)"
          :data="childValue"
          :depth="depth + 1"
        />
      </div>
    </details>
    <div v-else class="metadata-leaf">
      <span v-if="label" class="metadata-key">{{ label }}:</span>
      <span class="metadata-value">{{ formattedValue }}</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ActivityMetadataTree',
  props: {
    data: {
      type: [Object, Array, String, Number, Boolean, null],
      default: null,
    },
    label: {
      type: String,
      default: '',
    },
    depth: {
      type: Number,
      default: 0,
    },
  },
  computed: {
    isExpandable() {
      return typeof this.data === 'object' && this.data !== null
    },
    entries() {
      if (!this.isExpandable) return []
      if (Array.isArray(this.data)) {
        return this.data.map((value, index) => [String(index), value])
      }
      return Object.entries(this.data)
    },
    formattedValue() {
      if (typeof this.data === 'boolean') return this.data ? 'true' : 'false'
      if (this.data === null || this.data === undefined) return 'null'
      return String(this.data)
    },
    typeLabel() {
      if (Array.isArray(this.data)) {
        return `[${this.data.length}]`
      }
      return '{…}'
    },
  },
  methods: {
    childKeyLabel(key, index) {
      if (key === null || key === undefined || key === '') {
        return String(index)
      }
      return key
    },
  },
}
</script>

<style scoped>
.metadata-tree {
  font-size: 0.85rem;
  color: var(--text-muted, rgba(15, 23, 42, 0.7));
}

details {
  border-left: 2px solid rgba(15, 23, 42, 0.12);
  margin-left: var(--space-2xs, 0.35rem);
  padding-left: var(--space-2xs, 0.35rem);
}

summary {
  cursor: pointer;
  list-style: none;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--text-primary, #0f172a);
}

summary::-webkit-details-marker {
  display: none;
}

.metadata-key {
  font-weight: 600;
}

.metadata-type {
  font-size: 0.75rem;
  color: var(--text-subtle, rgba(15, 23, 42, 0.6));
}

.metadata-leaf {
  display: flex;
  gap: 0.35rem;
  padding-left: var(--space-xs, 0.55rem);
}

.metadata-value {
  color: var(--text-primary, #0f172a);
}

.metadata-children {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.35rem;
}
</style>

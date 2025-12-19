<script setup lang="ts">
interface Props {
  title?: string
  description?: string
}

defineProps<Props>()
</script>

<template>
  <section class="not-found" role="status" aria-live="polite">
    <h1 class="title">{{ title || 'Not found' }}</h1>
    <p v-if="description" class="description">{{ description }}</p>
    <div class="actions">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.not-found {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
  background: var(--color-bg-primary, white);
  border: 1px solid var(--color-border, #e5e7eb);
  border-radius: 12px;
}

.title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.description {
  margin: 0.75rem 0 0;
  color: var(--color-text-secondary, #6b7280);
}

.actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: center;
}
</style>

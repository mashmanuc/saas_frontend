<template>
  <div class="session-card" @click="$emit('open', session)">
    <!-- Thumbnail -->
    <div class="session-card__thumbnail">
      <img
        v-if="session.thumbnail_url"
        :src="session.thumbnail_url"
        :alt="session.name"
      />
      <div v-else class="session-card__placeholder">
        <span class="icon">📝</span>
      </div>

      <!-- Shared badge -->
      <span v-if="session.is_shared" class="session-card__badge">
        🔗 {{ $t('solo.shared') }}
      </span>
    </div>

    <!-- Info -->
    <div class="session-card__info">
      <h3 class="session-card__name">{{ session.name }}</h3>
      <p class="session-card__meta">
        {{ session.page_count }} {{ $t('solo.pages') }} •
        {{ formatDate(session.updated_at) }}
      </p>
    </div>

    <!-- Actions -->
    <div class="session-card__actions" @click.stop>
      <button
        class="action-btn"
        @click="$emit('share', session)"
        :title="$t('solo.share')"
      >
        🔗
      </button>
      <button
        class="action-btn"
        @click="$emit('duplicate', session)"
        :title="$t('solo.duplicate')"
      >
        📋
      </button>
      <button
        class="action-btn action-btn--danger"
        @click="$emit('delete', session)"
        :title="$t('solo.delete')"
      >
        🗑️
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SoloSession } from '../../types/solo'

defineProps<{
  session: SoloSession
}>()

defineEmits<{
  (e: 'open', session: SoloSession): void
  (e: 'share', session: SoloSession): void
  (e: 'duplicate', session: SoloSession): void
  (e: 'delete', session: SoloSession): void
}>()

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString()
}
</script>

<style scoped>
.session-card {
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.session-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.session-card__thumbnail {
  position: relative;
  aspect-ratio: 4/3;
  background: var(--bg-secondary, #f3f4f6);
}

.session-card__thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.session-card__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 3rem;
  opacity: 0.3;
}

.session-card__badge {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  padding: 0.25rem 0.5rem;
  background: var(--accent-color, #3b82f6);
  color: white;
  border-radius: 4px;
  font-size: 0.75rem;
}

.session-card__info {
  padding: 1rem;
}

.session-card__name {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 600;
}

.session-card__meta {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
}

.session-card__actions {
  display: flex;
  gap: 0.5rem;
  padding: 0 1rem 1rem;
}

.action-btn {
  padding: 0.5rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}

.action-btn:hover {
  background: var(--hover-bg, #f3f4f6);
}

.action-btn--danger:hover {
  background: var(--danger-bg, #fef2f2);
}
</style>

<template>
  <div class="gone-page">
    <div class="gone-page__card">
      <div class="gone-page__icon">🪦</div>
      <h1 class="gone-page__title">
        {{ $t('winterboard.publicGone.title') }}
      </h1>
      <p class="gone-page__subtitle">
        {{ $t('winterboard.publicGone.subtitle') }}
      </p>
      <div class="gone-page__actions">
        <button type="button" class="gone-page__btn" @click="goHome">
          {{ $t('winterboard.publicGone.home') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goHome() {
  router.push('/')
}
</script>

<style scoped>
.gone-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--bg-primary, #f9fafb);
}

.gone-page__card {
  max-width: 460px;
  width: 100%;
  text-align: center;
  padding: 48px 32px;
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: var(--radius-lg, 12px);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
}

.gone-page__icon {
  font-size: 4rem;
  margin-bottom: 16px;
  opacity: 0.9;
}

.gone-page__title {
  margin: 0 0 8px;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.gone-page__subtitle {
  margin: 0 0 24px;
  color: var(--text-secondary);
  line-height: 1.55;
}

.gone-page__actions {
  display: flex;
  justify-content: center;
}

.gone-page__btn {
  padding: 10px 24px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 0.9375rem;
  font-weight: 600;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: background 0.15s;
}

.gone-page__btn:hover {
  background: color-mix(in srgb, var(--accent) 88%, #000);
}
</style>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div class="stat-bar">
    <div class="stat-item">
      <div class="stat-val">847</div>
      <div class="stat-ctx">{{ t('marketplace.profileV3.statBar.activeStudents') }}</div>
      <div class="stat-meaning">{{ t('marketplace.profileV3.statBar.platformAlive') }}</div>
    </div>
    <div class="stat-item">
      <div class="stat-val">4.9 ★</div>
      <div class="stat-ctx">{{ t('marketplace.profileV3.statBar.avgRating') }}</div>
      <div class="stat-meaning">{{ t('marketplace.profileV3.statBar.strictSelection') }}</div>
    </div>
    <div class="stat-item">
      <div class="stat-val">98%</div>
      <div class="stat-ctx">{{ t('marketplace.profileV3.statBar.continueAfterFirst') }}</div>
      <div class="stat-meaning">{{ t('marketplace.profileV3.statBar.minimalRisk') }}</div>
    </div>
  </div>
</template>

<style scoped>
.stat-bar {
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  padding: 0.875rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 1.25rem;
  box-shadow: var(--shadow-sm, 0 1px 8px rgba(0,0,0,0.06));
  animation: fadeUp 0.35s ease 0.1s both;
}

.stat-item {
  flex: 1;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}
.stat-item + .stat-item {
  border-left: 1px solid var(--border-color);
}

.stat-val {
  font-size: 1.0625rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1;
}
.stat-ctx {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--text-secondary);
  line-height: 1.3;
}
.stat-meaning {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--accent);
}

@media (max-width: 600px) {
  .stat-bar {
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
  }
  .stat-item + .stat-item {
    border-left: none;
    border-top: 1px solid var(--border-color);
    padding-top: 0.75rem;
  }
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>

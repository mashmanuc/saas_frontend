<template>
  <div class="blocked-users-view">
    <div class="view-header">
      <h1>{{ $t('trust.blocked.title') }}</h1>
      <p class="subtitle">{{ $t('trust.blocked.subtitle') }}</p>
    </div>
    
    <BlockedUsersList />
  </div>
</template>

<script setup>
import BlockedUsersList from '../components/BlockedUsersList.vue'
</script>

<style scoped>
.blocked-users-view {
  max-width: 800px;
  margin: 0 auto;
  padding: var(--spacing-xl);
}

.view-header {
  margin-bottom: var(--spacing-xl);
}

.view-header h1 {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  margin: 0 0 var(--spacing-sm);
}

.subtitle {
  color: var(--color-text-secondary);
  margin: 0;
}
</style>

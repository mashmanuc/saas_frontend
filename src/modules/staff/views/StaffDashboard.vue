<template>
  <div class="staff-dashboard" data-testid="staff-dashboard">
    <div class="dashboard-header">
      <h1 class="dashboard-title">{{ $t('staff.dashboard.title') }}</h1>
    </div>

    <div class="dashboard-tiles">
      <router-link
        to="/staff/tutor-activity"
        class="dashboard-tile"
        data-testid="tile-tutor-activity"
      >
        <div class="tile-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <div class="tile-content">
          <h2 class="tile-title">{{ $t('staff.dashboard.tiles.tutorActivity') }}</h2>
          <p class="tile-description">{{ $t('staff.dashboard.tiles.tutorActivityDesc') }}</p>
        </div>
      </router-link>
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
.staff-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-xl);
}

.dashboard-header {
  margin-bottom: var(--space-xl);
}

.dashboard-title {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.dashboard-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-lg);
}

.dashboard-tile {
  display: flex;
  align-items: flex-start;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  text-decoration: none;
  color: inherit;
  transition: all var(--transition-base);
}

.dashboard-tile:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.tile-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-radius: var(--radius-md);
  color: var(--accent);
}

.tile-content {
  flex: 1;
}

.tile-title {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-xs) 0;
}

.tile-description {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0;
}

@media (max-width: 768px) {
  .staff-dashboard {
    padding: var(--space-md);
  }

  .dashboard-title {
    font-size: var(--text-xl);
  }

  .dashboard-tiles {
    grid-template-columns: 1fr;
  }
}
</style>

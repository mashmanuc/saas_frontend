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
  padding: 2rem;
}

.dashboard-header {
  margin-bottom: 2rem;
}

.dashboard-title {
  font-size: 2rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0;
}

.dashboard-tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.dashboard-tile {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.5rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;
}

.dashboard-tile:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.tile-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eff6ff;
  border-radius: 0.5rem;
  color: #3b82f6;
}

.tile-content {
  flex: 1;
}

.tile-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1a202c;
  margin: 0 0 0.5rem 0;
}

.tile-description {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0;
}

@media (max-width: 768px) {
  .staff-dashboard {
    padding: 1rem;
  }

  .dashboard-title {
    font-size: 1.5rem;
  }

  .dashboard-tiles {
    grid-template-columns: 1fr;
  }
}
</style>

<template>
  <div class="calendar-skeleton">
    <div class="skeleton-header">
      <div class="skeleton-bar" style="width: 200px; height: 24px;" />
      <div class="skeleton-bar" style="width: 150px; height: 24px;" />
    </div>
    
    <div class="skeleton-grid">
      <div
        v-for="i in 336"
        :key="i"
        class="skeleton-cell"
      />
    </div>
  </div>
</template>

<style scoped>
.calendar-skeleton {
  width: 100%;
}

.skeleton-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  margin-bottom: 16px;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background-color: #e5e7eb;
}

.skeleton-cell {
  height: 40px;
  background: linear-gradient(
    90deg,
    #f3f4f6 25%,
    #e5e7eb 50%,
    #f3f4f6 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

.skeleton-bar {
  background: linear-gradient(
    90deg,
    #f3f4f6 25%,
    #e5e7eb 50%,
    #f3f4f6 75%
  );
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
  border-radius: 4px;
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>

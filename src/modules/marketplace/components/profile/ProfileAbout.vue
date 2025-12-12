<script setup lang="ts">
interface Props {
  bio: string
}

defineProps<Props>()
</script>

<template>
  <section class="profile-about">
    <h2>About</h2>
    <div class="bio" v-html="bio" />
  </section>
</template>

<style scoped>
.profile-about {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 1rem;
  color: #111827;
}

.bio {
  font-size: 0.9375rem;
  line-height: 1.7;
  color: #374151;
}

.bio :deep(p) {
  margin: 0 0 1rem;
}

.bio :deep(p:last-child) {
  margin-bottom: 0;
}
</style>

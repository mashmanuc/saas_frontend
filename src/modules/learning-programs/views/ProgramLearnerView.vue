<template>
  <div class="lplv">
    <LearnerProgramPanel :program-id="String(route.params.id)" />
  </div>
</template>

<script setup lang="ts">
/** Окрема сторінка безпечного показу (ТЗ §5.4) — відкривається з «Показати учневі» в новій вкладці. */
import { useRoute } from 'vue-router'
import LearnerProgramPanel from '../components/LearnerProgramPanel.vue'

const route = useRoute()
</script>

<style scoped>
.lplv { padding: 24px 0; }
</style>

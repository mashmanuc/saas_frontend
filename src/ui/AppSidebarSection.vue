<template>
  <div class="nav-section" role="group" :aria-label="section.label ? $t(section.label) : undefined">
    <span v-if="!collapsed && section.label" class="nav-section-label">
      {{ $t(section.label) }}
    </span>
    <AppSidebarItem
      v-for="item in section.items"
      :key="item.to"
      :item="item"
      :collapsed="collapsed"
    />
  </div>
</template>

<script setup lang="ts">
import AppSidebarItem from './AppSidebarItem.vue'
import type { SidebarSection } from './sidebar.types'

defineProps<{
  section: SidebarSection
  collapsed: boolean
}>()
</script>

<style scoped>
.nav-section {
  padding: var(--space-xs) 0;
}

.nav-section + .nav-section {
  border-top: 1px solid var(--border-color);
  margin-top: var(--space-xs);
  padding-top: var(--space-sm);
}

.nav-section-label {
  display: block;
  padding: var(--space-xs) var(--space-md);
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted, var(--text-secondary));
  opacity: 0.7;
}
/* Ноутбук (низький екран) з мишею: меню має вміститись цілком. На 1280×800
   п'ять груп на 11 пунктів давали 869 px при ~730 px місця — останню групу
   «Профіль» зрізало нижньою межею, і під нею з'являвся власний скрол, якого
   не видно (візуальний огляд 2026-09-22, п.0; власник дозволив чіпати меню
   саме через цю проблему). Тач лишається з 44 px — правило тільки для
   `pointer: fine`. */
@media (max-height: 900px) and (pointer: fine) {
  .nav-section {
    padding: 0;
  }

  .nav-section + .nav-section {
    margin-top: 2px;
    padding-top: 4px;
  }

  .nav-section-label {
    padding-top: 2px;
    padding-bottom: 2px;
  }
}
</style>

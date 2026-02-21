<template>
  <nav v-if="crumbs.length > 1" class="staff-breadcrumbs" aria-label="Breadcrumb">
    <ol class="crumb-list">
      <li v-for="(crumb, i) in crumbs" :key="crumb.path" class="crumb-item">
        <span v-if="i > 0" class="crumb-separator">/</span>
        <router-link
          v-if="i < crumbs.length - 1"
          :to="crumb.path"
          class="crumb-link"
        >
          {{ crumb.label }}
        </router-link>
        <span v-else class="crumb-current" aria-current="page">
          {{ crumb.label }}
        </span>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { t } = useI18n()

interface Crumb {
  label: string
  path: string
}

const LABEL_MAP: Record<string, string> = {
  'staff-dashboard': 'staff.breadcrumbs.dashboard',
  'staff-users': 'staff.breadcrumbs.users',
  'staff-user-overview': 'staff.breadcrumbs.userDetail',
  'staff-reports': 'staff.breadcrumbs.reports',
  'staff-tutor-activity': 'staff.breadcrumbs.tutorActivity',
  'staff-billing': 'staff.breadcrumbs.billing',
  'staff-health': 'staff.breadcrumbs.health',
}

const crumbs = computed<Crumb[]>(() => {
  const result: Crumb[] = [
    { label: t('staff.breadcrumbs.staff'), path: '/staff' },
  ]

  const name = route.name as string | undefined
  if (!name || name === 'staff-dashboard') return result

  const labelKey = LABEL_MAP[name]
  if (labelKey) {
    result.push({
      label: t(labelKey),
      path: route.path,
    })
  }

  return result
})
</script>

<style scoped>
.staff-breadcrumbs {
  padding: 0 0 var(--space-md) 0;
}

.crumb-list {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: var(--text-sm);
}

.crumb-separator {
  color: var(--text-muted, var(--text-secondary));
  opacity: 0.5;
}

.crumb-link {
  color: var(--text-secondary);
  text-decoration: none;
  transition: color var(--transition-base);
}

.crumb-link:hover {
  color: var(--accent);
}

.crumb-current {
  color: var(--text-primary);
  font-weight: 500;
}
</style>

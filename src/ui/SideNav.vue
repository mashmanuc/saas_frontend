<template>
  <aside
    class="hidden md:block w-64 nav-surface text-secondary border-r border-default/80 min-h-screen p-4"
    role="navigation"
    :aria-label="$t('nav.side')"
  >
    <nav v-if="menu.length" class="space-y-1">
      <MenuItem
        v-for="item in menu"
        :key="item.to"
        :item="item"
      />
    </nav>
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '../modules/auth/store/authStore'
import { getMenuByRole } from '../config/menu'
import MenuItem from './MenuItem.vue'

const auth = useAuthStore()

const menu = computed(() => getMenuByRole(auth.user?.role))
</script>

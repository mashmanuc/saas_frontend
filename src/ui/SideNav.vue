<template>
  <aside
    class="hidden md:block w-64 min-h-screen p-4"
    style="background-color: var(--nav-bg); color: var(--text-secondary); border-right: 1px solid var(--border-color); backdrop-filter: blur(10px);"
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

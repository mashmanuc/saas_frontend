<template>
  <div class="space-y-6">
    <Card>
      <Heading :level="1">
        {{ $t('users.settings.title') }}
      </Heading>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ $t('users.settings.description') }}
      </p>
    </Card>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-4">
      <nav class="space-y-1">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition"
          :class="activeTab === tab.id 
            ? 'bg-primary text-primary-foreground' 
            : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'"
          @click="activeTab = tab.id"
        >
          <component :is="tab.icon" class="h-4 w-4" />
          {{ $t(tab.label) }}
        </button>
      </nav>

      <div class="lg:col-span-3">
        <Card class="space-y-6">
          <component :is="activeTabComponent" />
        </Card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, h } from 'vue'
import { useAuthStore } from '@/stores/authStore'
import Card from '@/ui/Card.vue'
import Heading from '@/ui/Heading.vue'
import GeneralSettingsTab from '../components/settings/GeneralSettingsTab.vue'
import ProfileSettingsTab from '../components/settings/ProfileSettingsTab.vue'
import ContactsSettingsTab from '../components/settings/ContactsSettingsTab.vue'
import NotificationsSettingsTab from '../components/settings/NotificationsSettingsTab.vue'
import PrivacySettingsTab from '../components/settings/PrivacySettingsTab.vue'
import SecuritySettingsTab from '../components/settings/SecuritySettingsTab.vue'
import AccountSettingsTab from '../components/settings/AccountSettingsTab.vue'

const activeTab = ref('general')
const authStore = useAuthStore()
const userRole = computed(() => authStore.user?.role)

const allTabs = [
  { 
    id: 'general', 
    label: 'users.settings.tabs.general',
    icon: () => h('svg', { class: 'h-4 w-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }),
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' })
    ])
  },
  { 
    id: 'profile', 
    label: 'users.settings.tabs.profile',
    icon: () => h('svg', { class: 'h-4 w-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' })
    ])
  },
  { 
    id: 'contacts', 
    label: 'users.settings.tabs.contacts',
    icon: () => h('svg', { class: 'h-4 w-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' })
    ])
  },
  { 
    id: 'notifications', 
    label: 'users.settings.tabs.notifications',
    icon: () => h('svg', { class: 'h-4 w-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' })
    ])
  },
  { 
    id: 'privacy', 
    label: 'users.settings.tabs.privacy',
    icon: () => h('svg', { class: 'h-4 w-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' })
    ])
  },
  { 
    id: 'security', 
    label: 'users.settings.tabs.security',
    icon: () => h('svg', { class: 'h-4 w-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.37A7.5 7.5 0 0012 17.5a7.5 7.5 0 008.618-11.186z' })
    ])
  },
  { 
    id: 'account', 
    label: 'menu.account',
    icon: () => h('svg', { class: 'h-4 w-4', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' }, [
      h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '2', d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' })
    ])
  }
]

const tabs = computed(() => {
  // Для тьютора показуємо вкладку Account замість Profile
  if (userRole.value === 'tutor') {
    return allTabs.filter(tab => tab.id !== 'profile')
  }
  // Для студента прибираємо вкладку Profile (він має окремий профіль)
  return allTabs.filter(tab => tab.id !== 'profile')
})

const activeTabComponent = computed(() => {
  switch (activeTab.value) {
    case 'general':
      return GeneralSettingsTab
    case 'profile':
      return ProfileSettingsTab
    case 'contacts':
      return ContactsSettingsTab
    case 'notifications':
      return NotificationsSettingsTab
    case 'privacy':
      return PrivacySettingsTab
    case 'security':
      return SecuritySettingsTab
    case 'account':
      return AccountSettingsTab
    default:
      return GeneralSettingsTab
  }
})
</script>

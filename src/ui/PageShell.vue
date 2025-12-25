<template>
  <div class="min-h-screen flex bg-page text-body">

    <!-- Side navigation -->
    <SideNav />

    <!-- Main area -->
    <div class="flex-1 flex flex-col">
      <TopNav />

      <main class="p-6 max-w-6xl mx-auto w-full">
        <router-view />
      </main>
    </div>

    <!-- Toasts & Loader overlay -->
    <ToastContainer class="z-50" />
    <GlobalLoader />
    
    <!-- Session Revoked Banner -->
    <SessionRevokedBanner
      :show="authStore.showSessionRevokedBanner"
      :request-id="authStore.sessionRevokedRequestId"
      @close="authStore.showSessionRevokedBanner = false"
    />
  </div>
</template>

<script setup>
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import SideNav from './SideNav.vue'
import TopNav from './TopNav.vue'
import ToastContainer from './ToastContainer.vue'
import GlobalLoader from './GlobalLoader.vue'
import SessionRevokedBanner from '../components/SessionRevokedBanner.vue'
import { useAuthStore } from '../modules/auth/store/authStore'

const router = useRouter()
const authStore = useAuthStore()

watch(
  () => authStore.showSessionRevokedBanner,
  (show) => {
    if (show) {
      router.push('/auth/login')
    }
  }
)
</script>

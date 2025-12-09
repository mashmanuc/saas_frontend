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
  </div>
</template>

<script setup>
import SideNav from './SideNav.vue'
import TopNav from './TopNav.vue'
import ToastContainer from './ToastContainer.vue'
import GlobalLoader from './GlobalLoader.vue'
</script>

<template>
  <main
    class="min-h-screen flex items-center justify-center"
    style="background: var(--bg-gradient);"
    :aria-label="$t('auth.layout.ariaLabel')"
  >
    <div class="w-full max-w-md p-6">
      <router-view />
    </div>
  </main>
</template>

<template>
  <div class="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
    <div class="flex items-start gap-3">
      <div class="shrink-0">
        <svg class="h-5 w-5 text-amber-600 dark:text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <div class="flex-1">
        <h3 class="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {{ $t('inquiry.contactRequired.title') }}
        </h3>
        <p class="mt-1 text-sm text-amber-800 dark:text-amber-300">
          {{ $t('inquiry.contactRequired.description') }}
        </p>
        <div class="mt-3">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600"
            @click="$emit('go-to-profile')"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {{ $t('inquiry.contactRequired.goToProfile') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineEmits(['go-to-profile'])
</script>

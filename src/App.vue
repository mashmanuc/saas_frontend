<script setup>
import { ref, onMounted } from 'vue'

const isDark = ref(false)

const applyTheme = (themeIsDark) => {
  const root = document.documentElement
  if (themeIsDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

const toggleTheme = () => {
  isDark.value = !isDark.value
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
  applyTheme(isDark.value)
}

onMounted(() => {
  const storedTheme = localStorage.getItem('theme')
  isDark.value = storedTheme === 'dark'
  applyTheme(isDark.value)
})
</script>

<template>
  <main class="min-h-screen bg-gray-50 px-4 py-12 text-gray-900 dark:bg-neutral-900 dark:text-gray-100">
    <div class="mx-auto max-w-2xl space-y-8">
      <header class="space-y-3 text-center">
        <p class="text-sm uppercase tracking-wide text-indigo-600">m4sh platform</p>
        <h1 class="text-3xl font-semibold">Tailwind + Vue стартова конфігурація</h1>
        <p class="text-gray-600 dark:text-gray-300">
          Далі будемо будувати реальні екрани: auth, dashboard тьютора та учня.
        </p>
      </header>

      <section class="space-y-6">
        <div class="card space-y-4">
          <h2 class="text-xl font-semibold">Приклади UI-класів</h2>
          <div class="grid gap-4 md:grid-cols-2">
            <button class="btn-primary">Primary button</button>
            <input class="input" placeholder="Інпут із темним режимом" />
          </div>
        </div>

        <div class="card flex items-center justify-between gap-4">
          <div>
            <h3 class="text-lg font-semibold">Тема інтерфейсу</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">Перемикай dark/light через кореневий клас.</p>
          </div>
          <button class="btn-primary" @click="toggleTheme">
            {{ isDark ? 'Dark' : 'Light' }} mode
          </button>
        </div>
      </section>
    </div>
  </main>
</template>

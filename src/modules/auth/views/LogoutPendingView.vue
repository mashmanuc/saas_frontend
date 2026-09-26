<!--
  Екран блокування: вихід не підтверджено сервером (ТЗ спільного екрана, R6).

  Сторінка без даних користувача й без спільного layout: сюди веде повне
  перезавантаження, тож кімната дошки й стори розмонтовані. Поки маркер
  «вихід не завершено» стоїть, роутер не відкриває жодної іншої сторінки, крім
  входу іншим акаунтом (нові cookie замінюють старі).

  Чесно про межу: без зв'язку серверне відкликання гарантувати неможливо — тому
  підказка про завершення сесії з телефона.
-->
<template>
  <main class="logout-pending" data-testid="logout-pending">
    <div class="logout-pending__card">
      <h1 class="logout-pending__title">{{ t('auth.logoutPending.title') }}</h1>
      <p class="logout-pending__text">{{ t('auth.logoutPending.text') }}</p>

      <button
        type="button"
        class="logout-pending__retry"
        data-testid="logout-pending-retry"
        :disabled="busy"
        @click="retry"
      >{{ busy ? t('auth.logoutPending.retrying') : t('auth.logoutPending.retry') }}</button>

      <p v-if="failed" class="logout-pending__failed">{{ t('auth.logoutPending.failed') }}</p>

      <p class="logout-pending__phone">{{ t('auth.logoutPending.phoneHint') }}</p>

      <router-link
        class="logout-pending__switch"
        data-testid="logout-pending-switch"
        :to="{ path: '/auth/login', query: { switch: '1' } }"
      >{{ t('auth.logoutPending.switchAccount') }}</router-link>
    </div>
  </main>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '../store/authStore'

const { t } = useI18n()
const auth = useAuthStore()

const busy = ref(false)
const failed = ref(false)

async function retry() {
  if (busy.value) return
  busy.value = true
  try {
    const confirmed = await auth.retryPendingLogout()
    failed.value = !confirmed
  } finally {
    busy.value = false
  }
}

// Одна спроба при відкритті й одна — коли повернувся зв'язок. Жодних таймерів і циклів.
function onOnline() {
  void retry()
}

onMounted(() => {
  window.addEventListener('online', onOnline)
  void retry()
})

onBeforeUnmount(() => {
  window.removeEventListener('online', onOnline)
})
</script>

<style scoped>
.logout-pending {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: #f1f5f9;
}
.logout-pending__card {
  width: min(92vw, 440px);
  padding: 28px;
  border-radius: 16px;
  background: #fff;
  color: #0f172a;
  box-shadow: 0 10px 40px rgba(15, 23, 42, 0.12);
}
.logout-pending__title { margin: 0 0 8px; font-size: 20px; font-weight: 700; }
.logout-pending__text { margin: 0 0 18px; font-size: 15px; color: #334155; }
.logout-pending__retry {
  width: 100%; padding: 10px 14px; border: none; border-radius: 10px;
  background: #0f172a; color: #fff; font-weight: 600; cursor: pointer;
}
.logout-pending__retry:disabled { opacity: 0.6; cursor: default; }
.logout-pending__failed { margin: 10px 0 0; font-size: 14px; color: #b91c1c; }
.logout-pending__phone { margin: 16px 0 12px; font-size: 14px; color: #475569; }
.logout-pending__switch { font-size: 14px; color: #0f766e; text-decoration: underline; }
</style>

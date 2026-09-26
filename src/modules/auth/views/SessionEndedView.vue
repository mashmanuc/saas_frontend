<!--
  Нейтральна сторінка замість вмісту, коли сесію в цій вкладці завершено
  (`modules/auth/logout/sessionEndedView.ts`). Без даних акаунта: дошка й решта
  сторінки вже розмонтовані. Зазвичай її видно мить — одразу йде перехід на вхід або
  на екран блокування; лишається, лише якщо перехід скасовано.
-->
<template>
  <main class="session-ended" data-testid="session-ended">
    <div class="session-ended__card">
      <h1 class="session-ended__title">{{ t('auth.sessionEnded.title') }}</h1>
      <p class="session-ended__text">{{ t('auth.sessionEnded.text') }}</p>
      <button type="button" class="session-ended__login" data-testid="session-ended-login" @click="goToStart">
        {{ t('auth.sessionEnded.login') }}
      </button>
    </div>
  </main>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

function goToStart() {
  // Повне перезавантаження: чистий застосунок без стану попереднього акаунта.
  window.location.href = '/start'
}
</script>

<style scoped>
.session-ended {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: #f1f5f9;
}
.session-ended__card {
  width: min(92vw, 420px);
  padding: 28px;
  border-radius: 16px;
  background: #fff;
  color: #0f172a;
  box-shadow: 0 10px 40px rgba(15, 23, 42, 0.12);
}
.session-ended__title { margin: 0 0 8px; font-size: 20px; font-weight: 700; }
.session-ended__text { margin: 0 0 18px; font-size: 15px; color: #334155; }
.session-ended__login {
  width: 100%; padding: 10px 14px; border: none; border-radius: 10px;
  background: #0f172a; color: #fff; font-weight: 600; cursor: pointer;
}
</style>

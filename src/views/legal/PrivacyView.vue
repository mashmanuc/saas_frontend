<template>
  <div class="container mx-auto max-w-4xl px-4 py-12">
    <div class="space-y-8">
      <div>
        <h1 class="text-3xl font-bold text-foreground">{{ $t('legal.privacy.title') }}</h1>
        <p class="mt-2 text-sm text-muted-foreground">
          {{ $t('legal.privacy.lastUpdated', { date: lastUpdated }) }}
        </p>
      </div>

      <div class="prose prose-slate max-w-none dark:prose-invert">
        <section>
          <h2>1. Загальна інформація</h2>
          <p>
            Ця Політика конфіденційності описує, як M4SH збирає, використовує та захищає
            вашу персональну інформацію при використанні Платформи.
          </p>
        </section>

        <section>
          <h2>2. Які дані ми збираємо</h2>
          <p>Ми можемо збирати наступну інформацію:</p>
          <ul>
            <li>Ім'я, прізвище та контактні дані (email, телефон)</li>
            <li>Інформацію про ваш обліковий запис та профіль</li>
            <li>Дані про використання Платформи (логи, аналітика)</li>
            <li>Платіжну інформацію (обробляється платіжними системами)</li>
            <li>Повідомлення та комунікації через Платформу</li>
          </ul>
        </section>

        <section>
          <h2>3. Як ми використовуємо ваші дані</h2>
          <p>Ваші персональні дані використовуються для:</p>
          <ul>
            <li>Надання та покращення наших послуг</li>
            <li>Обробки платежів та підписок</li>
            <li>Зв'язку з вами щодо вашого облікового запису</li>
            <li>Відправки важливих повідомлень та оновлень</li>
            <li>Аналізу та покращення функціоналу Платформи</li>
            <li>Дотримання законодавчих вимог</li>
          </ul>
        </section>

        <section>
          <h2>4. Захист даних</h2>
          <p>
            Ми вживаємо відповідних технічних та організаційних заходів для захисту ваших
            персональних даних від несанкціонованого доступу, втрати або розголошення.
          </p>
          <p>
            Платіжна інформація обробляється безпосередньо платіжними системами (LiqPay, Stripe)
            та не зберігається на наших серверах.
          </p>
        </section>

        <section>
          <h2>5. Передача даних третім особам</h2>
          <p>Ми можемо передавати ваші дані:</p>
          <ul>
            <li>Платіжним системам для обробки платежів</li>
            <li>Постачальникам послуг, які допомагають нам надавати сервіс</li>
            <li>Правоохоронним органам за їх законним запитом</li>
          </ul>
          <p>
            Ми не продаємо та не передаємо ваші персональні дані третім особам для їх
            маркетингових цілей.
          </p>
        </section>

        <section>
          <h2>6. Ваші права</h2>
          <p>Ви маєте право:</p>
          <ul>
            <li>Отримати доступ до своїх персональних даних</li>
            <li>Виправити неточні дані</li>
            <li>Видалити свої дані (право на забуття)</li>
            <li>Обмежити обробку ваших даних</li>
            <li>Заперечити проти обробки даних</li>
            <li>Отримати копію своїх даних</li>
          </ul>
        </section>

        <section>
          <h2>7. Cookies та аналітика</h2>
          <p>
            Ми використовуємо cookies та подібні технології для покращення роботи Платформи
            та аналізу її використання. Ви можете керувати налаштуваннями cookies у своєму
            браузері.
          </p>
        </section>

        <section>
          <h2>8. Зміни в Політиці</h2>
          <p>
            Ми можемо оновлювати цю Політику конфіденційності. Зміни набувають чинності з
            моменту публікації на Платформі.
          </p>
        </section>

        <section>
          <h2>9. Контакти</h2>
          <p>
            З питань щодо обробки персональних даних звертайтесь:
          </p>
          <p>
            Email: <a href="mailto:privacy@m4sh.com">privacy@m4sh.com</a>
          </p>
        </section>
      </div>

      <div class="flex justify-center pt-8">
        <Button variant="outline" @click="$router.back()">
          Повернутися назад
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import Button from '@/ui/Button.vue'

const lastUpdated = computed(() => '13.01.2026')
</script>

<style scoped>
.prose {
  color: var(--color-text-primary);
}

.prose h2 {
  margin-top: 2rem;
  margin-bottom: 1rem;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.prose p {
  margin-bottom: 1rem;
  line-height: 1.75;
}

.prose ul {
  margin-top: 0.5rem;
  margin-bottom: 1rem;
  padding-left: 1.5rem;
}

.prose li {
  margin-bottom: 0.5rem;
}

.prose a {
  color: var(--color-primary);
  text-decoration: underline;
}

.prose a:hover {
  color: var(--color-primary-dark);
}
</style>

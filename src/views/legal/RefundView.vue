<template>
  <div class="container mx-auto max-w-4xl px-4 py-12">
    <div class="space-y-8">
      <div>
        <h1 class="text-3xl font-bold text-foreground">{{ $t('legal.refund.title') }}</h1>
        <p class="mt-2 text-sm text-muted-foreground">
          {{ $t('legal.refund.lastUpdated', { date: lastUpdated }) }}
        </p>
      </div>

      <div class="prose prose-slate max-w-none dark:prose-invert">
        <section>
          <h2>1. Загальні положення</h2>
          <p>
            Ця Політика повернення коштів описує умови, за яких ви можете отримати повернення
            коштів за оплачені послуги Платформи M4SH.
          </p>
        </section>

        <section>
          <h2>2. Період повернення коштів</h2>
          <p>
            Ви маєте право на повернення коштів протягом <strong>14 днів</strong> з моменту
            першої оплати підписки, якщо:
          </p>
          <ul>
            <li>Ви не використовували платні функції Платформи</li>
            <li>Ви не порушували Угоду користувача</li>
            <li>Запит на повернення коштів подано в межах зазначеного терміну</li>
          </ul>
        </section>

        <section>
          <h2>3. Умови повернення</h2>
          <p>
            Повернення коштів <strong>не здійснюється</strong> в наступних випадках:
          </p>
          <ul>
            <li>Минуло більше 14 днів з моменту оплати</li>
            <li>Ви активно використовували платні функції</li>
            <li>Підписка була скасована після автоматичного продовження</li>
            <li>Ви порушили Угоду користувача</li>
            <li>Запит подано для продовження підписки (не першої оплати)</li>
          </ul>
        </section>

        <section>
          <h2>4. Як подати запит на повернення</h2>
          <p>
            Для отримання повернення коштів:
          </p>
          <ol>
            <li>Зв'яжіться з нашою службою підтримки на <a href="mailto:refund@m4sh.com">refund@m4sh.com</a></li>
            <li>Вкажіть причину повернення та деталі оплати</li>
            <li>Дочекайтесь розгляду вашого запиту (до 5 робочих днів)</li>
          </ol>
        </section>

        <section>
          <h2>5. Процес повернення</h2>
          <p>
            Після схвалення запиту на повернення:
          </p>
          <ul>
            <li>Кошти повертаються на картку, з якої була здійснена оплата</li>
            <li>Термін повернення: 5-14 робочих днів (залежить від банку)</li>
            <li>Ви отримаєте email-підтвердження про повернення</li>
            <li>Доступ до платних функцій буде припинено</li>
          </ul>
        </section>

        <section>
          <h2>6. Часткове повернення</h2>
          <p>
            У виняткових випадках може бути здійснено часткове повернення коштів:
          </p>
          <ul>
            <li>Технічні проблеми з боку Платформи</li>
            <li>Неможливість надання послуг з нашої вини</li>
            <li>Інші обставини на розсуд адміністрації</li>
          </ul>
          <p>
            Сума часткового повернення розраховується пропорційно невикористаному періоду
            підписки.
          </p>
        </section>

        <section>
          <h2>7. Відмова у поверненні</h2>
          <p>
            Ми залишаємо за собою право відмовити у поверненні коштів, якщо:
          </p>
          <ul>
            <li>Запит не відповідає умовам цієї Політики</li>
            <li>Виявлено зловживання або шахрайство</li>
            <li>Надано неповну або неправдиву інформацію</li>
          </ul>
        </section>

        <section>
          <h2>8. Скасування підписки</h2>
          <p>
            Скасування підписки <strong>не є</strong> поверненням коштів. При скасуванні:
          </p>
          <ul>
            <li>Доступ до платних функцій зберігається до кінця оплаченого періоду</li>
            <li>Автоматичне продовження припиняється</li>
            <li>Кошти за поточний період не повертаються</li>
          </ul>
        </section>

        <section>
          <h2>9. Контакти</h2>
          <p>
            З питань повернення коштів звертайтесь:
          </p>
          <p>
            Email: <a href="mailto:refund@m4sh.com">refund@m4sh.com</a><br>
            Час відповіді: до 5 робочих днів
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

.prose ul, .prose ol {
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

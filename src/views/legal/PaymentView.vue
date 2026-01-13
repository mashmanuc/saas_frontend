<template>
  <div class="container mx-auto max-w-4xl px-4 py-12">
    <div class="space-y-8">
      <div>
        <h1 class="text-3xl font-bold text-foreground">{{ $t('legal.payment.title') }}</h1>
        <p class="mt-2 text-sm text-muted-foreground">
          {{ $t('legal.payment.lastUpdated', { date: lastUpdated }) }}
        </p>
      </div>

      <div class="prose prose-slate max-w-none dark:prose-invert">
        <section>
          <h2>1. Загальні умови оплати</h2>
          <p>
            Ці Умови оплати регулюють порядок здійснення платежів за використання платних
            послуг Платформи M4SH.
          </p>
        </section>

        <section>
          <h2>2. Тарифні плани</h2>
          <p>
            Платформа пропонує різні тарифні плани з різним функціоналом. Актуальні ціни
            та умови вказані на сторінці підписок.
          </p>
          <p>
            Ціни вказані в гривнях (UAH) або доларах США (USD) залежно від обраного способу
            оплати.
          </p>
        </section>

        <section>
          <h2>3. Способи оплати</h2>
          <p>Ми приймаємо оплату через наступні платіжні системи:</p>
          <ul>
            <li><strong>LiqPay</strong> — для оплати картками українських банків</li>
            <li><strong>Stripe</strong> — для міжнародних платежів</li>
          </ul>
          <p>
            При здійсненні оплати ви погоджуєтесь з умовами обраної платіжної системи.
          </p>
        </section>

        <section>
          <h2>4. Автоматичне продовження підписки</h2>
          <p>
            Підписки автоматично продовжуються в кінці кожного платіжного періоду (місяць або рік).
            Оплата списується автоматично з вашої картки.
          </p>
          <p>
            Ви можете скасувати автоматичне продовження в будь-який момент у налаштуваннях
            підписки. Скасування набуває чинності з кінця поточного оплаченого періоду.
          </p>
        </section>

        <section>
          <h2>5. Зміна тарифного плану</h2>
          <p>
            Ви можете змінити свій тарифний план в будь-який момент:
          </p>
          <ul>
            <li><strong>Оновлення до вищого плану</strong> — зміни набувають чинності негайно,
            різниця в оплаті розраховується пропорційно</li>
            <li><strong>Перехід на нижчий план</strong> — зміни набувають чинності з наступного
            платіжного періоду</li>
          </ul>
        </section>

        <section>
          <h2>6. Безпека платежів</h2>
          <p>
            Всі платежі обробляються через захищені платіжні системи з використанням
            шифрування SSL/TLS.
          </p>
          <p>
            Ми не зберігаємо повні дані вашої платіжної картки на наших серверах. Вся
            платіжна інформація обробляється безпосередньо платіжними системами.
          </p>
        </section>

        <section>
          <h2>7. Податки</h2>
          <p>
            Всі ціни вказані з урахуванням ПДВ (якщо застосовується). Додаткові податки
            можуть застосовуватися залежно від вашої юрисдикції.
          </p>
        </section>

        <section>
          <h2>8. Інформація про продавця</h2>
          <p>
            <strong>Найменування:</strong> [Назва компанії]<br>
            <strong>Адреса:</strong> [Адреса]<br>
            <strong>ЄДРПОУ:</strong> [Код]<br>
            <strong>Email:</strong> <a href="mailto:billing@m4sh.com">billing@m4sh.com</a>
          </p>
        </section>

        <section>
          <h2>9. Контакти</h2>
          <p>
            З питань оплати звертайтесь:
          </p>
          <p>
            Email: <a href="mailto:billing@m4sh.com">billing@m4sh.com</a>
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

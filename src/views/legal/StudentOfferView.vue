<template>
  <div class="container mx-auto max-w-4xl px-4 py-12">
    <div class="space-y-8">
      <div>
        <h1 class="text-3xl font-bold text-foreground">{{ $t('legal.studentOffer.title') }}</h1>
        <p class="mt-2 text-sm text-muted-foreground">
          {{ $t('legal.studentOffer.lastUpdated', { date: lastUpdated }) }}
        </p>
      </div>

      <div class="prose prose-slate max-w-none dark:prose-invert">

        <section>
          <h2>Коротко про головне</h2>
          <p>
            M4SH — технологічна платформа, а не освітня установа. Ми надаємо інструменти для
            пошуку тьютора та проведення занять. Тьютор — незалежний фахівець, що визначає
            умови роботи самостійно. M4SH не є стороною угоди між вами та тьютором і не
            посередником у фінансових розрахунках.
          </p>
        </section>

        <section>
          <h2>І. Визначення</h2>
          <p>
            <strong>Платформа</strong> — сукупність програмних інструментів M4SH (m4sh.org):
            пошук тьюторів, система бронювання, відеокімната та навчальна дошка.<br>
            <strong>Адміністратор</strong> — ФОП Машнюк Д.С., Україна.<br>
            <strong>Учень</strong> — повнолітня особа або батько/опікун неповнолітнього,
            що акцептував цю Оферту реєстрацією.<br>
            <strong>Тьютор</strong> — незалежний фахівець, зареєстрований на умовах
            <a href="/legal/tutor-offer">Оферти для Тьютора</a>.<br>
            <strong>Replay</strong> — збережена послідовність дій на навчальній дошці під
            час заняття (не є аудіо- або відеозаписом).
          </p>
        </section>

        <section>
          <h2>ІІ. Акцепт Оферти</h2>
          <p>
            Реєстрація облікового запису на m4sh.org є повним акцептом цієї Оферти та
            <a href="/legal/privacy">Політики конфіденційності</a>.
          </p>
          <p>
            Для осіб молодше 14 років реєстрація здійснюється виключно через батьківський
            або опікунський обліковий запис (ст.32 ЦКУ). Батьки/опікуни несуть повну
            відповідальність за використання Платформи неповнолітнім.
          </p>
        </section>

        <section>
          <h2>ІІА. Роль Платформи — важливо</h2>
          <p><strong>M4SH НЕ є та НЕ виступає:</strong></p>
          <ul>
            <li><strong>Стороною договору між Учнем та Тьютором</strong> — умови навчання,
              ціну та формат визначають виключно Учень і Тьютор між собою.</li>
            <li><strong>Платіжним посередником</strong> — Платформа не приймає і не передає
              кошти за освітні послуги.</li>
            <li><strong>Освітньою установою</strong> — M4SH не видає документів про освіту
              та не відповідає за педагогічну кваліфікацію тьюторів.</li>
            <li><strong>Гарантом результатів навчання</strong> — прогрес залежить від зусиль
              Учня та методики Тьютора.</li>
            <li><strong>Відповідальним за дії Тьютора</strong> — за якість уроків та
              дотримання домовленостей відповідає Тьютор.</li>
          </ul>
        </section>

        <section>
          <h2>V. Оплата та фінансові питання</h2>
          <p>
            <strong>Оплата освітніх послуг</strong> здійснюється безпосередньо між Учнем
            та Тьютором і не проходить через M4SH. Фінансові спори вирішуються виключно
            між Учнем та Тьютором без участі Адміністратора.
          </p>
          <p>
            Платні функції Платформи (якщо є) оплачуються через LiqPay на адресу M4SH
            і регулюються окремо.
          </p>
        </section>

        <section>
          <h2>VI. Replay — хід заняття на дошці</h2>
          <p>
            Тьютор може активувати збереження послідовності дій на навчальній дошці (Replay).
            <strong>Replay не є аудіо- або відеозаписом.</strong> Зберігаються дії на дошці
            (малювання, текст, файли), а не зовнішній вигляд чи голос учасників.
            Це схоже на «Історію версій» у Google Docs.
          </p>
          <p>
            Якщо тьютор активував Replay — Платформа відображає вам інформаційне повідомлення
            протягом заняття.
          </p>
          <p>
            Тьютор визначає рівень доступу до Replay: приватний (лише тьютор), за посиланням
            або публічний. Якщо ви хочете видалити Replay у якому брали участь —
            зверніться на <a href="mailto:privacy@m4sh.org">privacy@m4sh.org</a>.
          </p>
          <p>
            Дані Replay не використовуються для навчання AI без окремої явної згоди учасників.
          </p>
        </section>

        <section>
          <h2>VII. Захист неповнолітніх</h2>
          <p><strong>Вік реєстрації:</strong></p>
          <ul>
            <li>18 і старше — самостійна реєстрація</li>
            <li>14–17 років — самостійна реєстрація; батьки/опікуни мають бути поінформовані</li>
            <li>До 14 років — реєстрація виключно через батьківський/опікунський обліковий запис</li>
          </ul>
          <p>
            M4SH не збирає персональні дані дітей до 14 років без підтвердженої батьківської
            або опікунської згоди. Батьки та опікуни можуть звернутись на
            <a href="mailto:privacy@m4sh.org">privacy@m4sh.org</a> для перегляду, оновлення
            або видалення даних дитини.
          </p>
          <p>
            Якщо ви або ваша дитина зіткнулись з неприйнятною поведінкою тьютора —
            негайно повідомте через <a href="mailto:support@m4sh.org">support@m4sh.org</a>.
          </p>
        </section>

        <section>
          <h2>VIII. Права та обов'язки Учня</h2>
          <p><strong>Учень зобов'язується:</strong> надавати достовірні дані при реєстрації;
            не порушувати авторські права на матеріали тьютора; не поширювати Replay без
            явної письмової згоди тьютора; не використовувати Платформу для незаконних цілей.</p>
          <p><strong>Учень має право:</strong> отримати копію своїх персональних даних
            (Налаштування → Експорт даних); видалити обліковий запис з усіма даними
            (Налаштування → Видалити акаунт); поскаржитись на тьютора через службу підтримки.</p>
        </section>

        <section>
          <h2>XII. Персональні дані та XIII. Вирішення спорів</h2>
          <p>
            Обробка персональних даних регулюється
            <a href="/legal/privacy">Політикою конфіденційності</a>.
            Запити: <a href="mailto:privacy@m4sh.org">privacy@m4sh.org</a> (відповідь до 30 днів).
          </p>
          <p>
            Претензія до M4SH: <a href="mailto:support@m4sh.org">support@m4sh.org</a>,
            термін розгляду — 30 днів. Права споживача за ЗУ «Про захист прав споживачів»
            мають пріоритет над умовами цієї Оферти. Право України.
          </p>
        </section>

      </div>

      <div class="flex justify-center pt-8">
        <Button variant="outline" @click="closeOrBack">
          {{ isNewTab ? 'Закрити' : 'Повернутися назад' }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Button from '@/ui/Button.vue'

const router = useRouter()
const lastUpdated = computed(() => '24.05.2026')

const isNewTab = computed(() => window.history.length <= 1 || !!window.opener)

function closeOrBack() {
  if (isNewTab.value) {
    window.close()
  } else {
    router.back()
  }
}
</script>

<style scoped>
.prose { color: var(--color-text-primary); }
.prose h2 { margin-top: 2rem; margin-bottom: 1rem; font-size: 1.5rem; font-weight: 600; color: var(--color-text-primary); }
.prose p { margin-bottom: 1rem; line-height: 1.75; }
.prose ul, .prose ol { margin-top: 0.5rem; margin-bottom: 1rem; padding-left: 1.5rem; }
.prose li { margin-bottom: 0.5rem; }
.prose a { color: var(--color-primary); text-decoration: underline; }
.prose a:hover { color: var(--color-primary-dark); }
.prose strong { color: var(--color-text-primary); }
</style>

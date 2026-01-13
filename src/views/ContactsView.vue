<template>
  <div class="container mx-auto max-w-4xl px-4 py-12">
    <div class="space-y-8">
      <div>
        <h1 class="text-3xl font-bold text-foreground">{{ $t('contacts.title') }}</h1>
        <p class="mt-2 text-muted-foreground">
          {{ $t('contacts.subtitle') }}
        </p>
      </div>

      <div class="grid gap-8 md:grid-cols-2">
        <!-- Contact Information -->
        <Card class="p-6">
          <h2 class="mb-4 text-xl font-semibold text-foreground">
            {{ $t('contacts.title') }}
          </h2>
          <div class="space-y-4">
            <div class="flex items-start gap-3">
              <svg class="mt-1 h-5 w-5 flex-shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div>
                <p class="text-sm font-medium text-foreground">{{ $t('contacts.email') }}</p>
                <a href="mailto:support@m4sh.com" class="text-sm text-primary hover:underline">
                  support@m4sh.com
                </a>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <svg class="mt-1 h-5 w-5 flex-shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <div>
                <p class="text-sm font-medium text-foreground">{{ $t('contacts.phone') }}</p>
                <a href="tel:+380123456789" class="text-sm text-primary hover:underline">
                  +380 (12) 345-67-89
                </a>
              </div>
            </div>

            <div class="flex items-start gap-3">
              <svg class="mt-1 h-5 w-5 flex-shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div>
                <p class="text-sm font-medium text-foreground">{{ $t('contacts.address') }}</p>
                <p class="text-sm text-muted-foreground">
                  вул. Хрещатик, 1<br>
                  Київ, 01001<br>
                  Україна
                </p>
              </div>
            </div>
          </div>
        </Card>

        <!-- Seller Information (LiqPay requirement) -->
        <Card class="p-6">
          <h2 class="mb-4 text-xl font-semibold text-foreground">
            {{ $t('contacts.sellerInfo') }}
          </h2>
          <div class="space-y-3 text-sm">
            <div>
              <p class="font-medium text-foreground">Найменування:</p>
              <p class="text-muted-foreground">ТОВ "М4Ш"</p>
            </div>
            <div>
              <p class="font-medium text-foreground">ЄДРПОУ:</p>
              <p class="text-muted-foreground">12345678</p>
            </div>
            <div>
              <p class="font-medium text-foreground">Юридична адреса:</p>
              <p class="text-muted-foreground">
                01001, м. Київ, вул. Хрещатик, буд. 1
              </p>
            </div>
            <div>
              <p class="font-medium text-foreground">ІПН:</p>
              <p class="text-muted-foreground">123456789012</p>
            </div>
            <div>
              <p class="font-medium text-foreground">Банківські реквізити:</p>
              <p class="text-muted-foreground">
                р/р UA123456789012345678901234567<br>
                в АТ "ПриватБанк", МФО 305299
              </p>
            </div>
          </div>
        </Card>
      </div>

      <!-- Working Hours -->
      <Card class="p-6">
        <h2 class="mb-4 text-xl font-semibold text-foreground">
          Години роботи служби підтримки
        </h2>
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <p class="text-sm font-medium text-foreground">Понеділок - П'ятниця</p>
            <p class="text-sm text-muted-foreground">09:00 - 18:00 (за київським часом)</p>
          </div>
          <div>
            <p class="text-sm font-medium text-foreground">Субота - Неділя</p>
            <p class="text-sm text-muted-foreground">Вихідний</p>
          </div>
        </div>
        <p class="mt-4 text-sm text-muted-foreground">
          * Email запити обробляються протягом 24 годин у робочі дні
        </p>
      </Card>

      <div class="flex justify-center pt-8">
        <Button variant="outline" @click="$router.back()">
          Повернутися назад
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup>
import Card from '@/ui/Card.vue'
import Button from '@/ui/Button.vue'
</script>

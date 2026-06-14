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
                <a href="mailto:support@m4sh.org" class="text-sm text-primary hover:underline">
                  support@m4sh.org
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
                  Україна, Волинська обл.,<br>
                  Ковельський р-н, с. Мокрець,<br>
                  вул. Т.Г. Шевченка, буд. 52
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
              <p class="font-medium text-foreground">Продавець:</p>
              <p class="text-muted-foreground">Фізична особа-підприємець Машманюк Олександр Васильович</p>
            </div>
            <div>
              <p class="font-medium text-foreground">РНОКПП:</p>
              <p class="text-muted-foreground">2955707673</p>
            </div>
            <div>
              <p class="font-medium text-foreground">Адреса реєстрації:</p>
              <p class="text-muted-foreground">
                Україна, Волинська обл., Ковельський р-н,<br>
                с. Мокрець, вул. Т.Г. Шевченка, буд. 52
              </p>
            </div>
            <div>
              <p class="font-medium text-foreground">Система оподаткування:</p>
              <p class="text-muted-foreground">Єдиний податок, 3-тя група (5%, не платник ПДВ)</p>
            </div>
            <div>
              <p class="font-medium text-foreground">Банківські реквізити:</p>
              <p class="text-muted-foreground">
                IBAN: UA433220010000026001380015117<br>
                АТ «УНІВЕРСАЛ БАНК», МФО 322001
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

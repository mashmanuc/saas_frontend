<template>
  <div class="user-errors">
    <div v-if="loading" class="state"><LoadingSpinner /></div>
    <div v-else-if="loadFailed" class="state state--error" role="alert">{{ t('staff.insight.errors.loadFailed') }}</div>
    <div v-else-if="!data || (data.frontend.length === 0 && data.events.length === 0)" class="state">
      {{ t('staff.insight.errors.empty') }}
    </div>
    <template v-else>
      <section v-if="data.frontend.length" class="block">
        <h3 class="block-title">
          {{ t('staff.insight.errors.pageErrors') }}
          <span class="count">{{ data.frontend_count }}</span>
        </h3>
        <ul class="err-list">
          <li v-for="e in data.frontend" :key="`fe-${e.id}`" class="err-item">
            <div class="err-head">
              <Badge :variant="e.severity === 'error' ? 'danger' : 'warning'" size="sm">
                {{ t(`staff.insight.errors.severity.${e.severity}`, e.severity) }}
              </Badge>
              <span class="err-time">{{ fmt(e.timestamp) }}</span>
              <span v-if="e.page" class="err-page mono">{{ e.page }}</span>
            </div>
            <div class="err-msg mono">{{ e.message }}</div>
            <div class="err-meta">
              <!-- Пристрій — розбір бекенда з сирого UA (бачить WebView Telegram/Instagram);
                   старі записи без UA — рукописний розбір фронту -->
              <span v-if="e.device">{{ [t(`staff.insight.devices.kind.${e.device.kind}`), e.device.os, e.device.browser].filter(Boolean).join(' · ') }}</span>
              <template v-else>
                <span v-if="e.browser || e.platform">{{ [e.browser, e.platform].filter(Boolean).join(' · ') }}</span>
                <span v-if="e.device_kind">{{ t(`staff.insight.devices.kind.${e.device_kind}`, e.device_kind) }}</span>
              </template>
              <span v-if="e.component && e.component !== 'Unknown'">{{ t('staff.insight.errors.component') }}: {{ e.component }}</span>
              <span v-if="e.resource_url" class="mono">{{ e.resource_url }}</span>
              <span v-if="e.app_version">{{ t('staff.insight.errors.version') }}: {{ e.app_version }}</span>
            </div>
          </li>
        </ul>
        <p v-if="data.frontend_count > data.frontend.length" class="shown-of">
          {{ t('staff.insight.shownOf', { shown: data.frontend.length, total: data.frontend_count }) }}
        </p>
      </section>

      <section v-if="data.events.length" class="block">
        <h3 class="block-title">
          {{ t('staff.insight.errors.failures') }}
          <span class="count">{{ data.events_count }}</span>
        </h3>
        <ul class="err-list">
          <li v-for="ev in data.events" :key="`ev-${ev.id}`" class="err-item">
            <div class="err-head">
              <span class="err-event">{{ eventLabel(ev.event_type) }}</span>
              <span class="err-time">{{ fmt(ev.timestamp) }}</span>
            </div>
            <div class="err-meta">
              <span class="mono">{{ ev.event_type }}</span>
              <span v-for="(value, key) in ev.details" :key="key" class="mono">{{ key }}: {{ value }}</span>
            </div>
          </li>
        </ul>
        <p v-if="data.events_count > data.events.length" class="shown-of">
          {{ t('staff.insight.shownOf', { shown: data.events.length, total: data.events_count }) }}
        </p>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Помилки користувача: падіння на сторінках (diagnostics) і збої з телеметрії
 * (дошка не зберегла, вхід не оновився…). Власник 2026-09-26 перед рекламою:
 * «які помилки в нього вийшли — це треба моніторити».
 */
import { ref, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { getUserErrors, type StaffUserErrorsResponse } from '@/api/staff'
import Badge from '@/ui/Badge.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import { activeLocale } from '@/utils/i18nDate'

const props = defineProps<{ userId: string | number }>()
const { t, te } = useI18n()

const data = ref<StaffUserErrorsResponse | null>(null)
const loading = ref(false)
const loadFailed = ref(false)

function eventLabel(type: string): string {
  // Ключ без крапок: vue-i18n читає «.» як вкладеність.
  const key = `staff.insight.errors.events.${type.replace(/\./g, '_')}`
  return te(key) ? t(key) : type
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(activeLocale(), {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

async function load(): Promise<void> {
  loading.value = true
  loadFailed.value = false
  try {
    data.value = await getUserErrors(String(props.userId), { limit: 20 })
  } catch (e) {
    // Не мовчимо: інакше збій завантаження виглядав би як «помилок немає».
    console.error('[staff] user errors load failed', e)
    loadFailed.value = true
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.userId, load)
</script>

<style scoped>
.state { padding: 12px 0; color: var(--text-secondary, #64748b); font-size: 14px; }
.state--error { color: var(--danger, #dc2626); }
.block + .block { margin-top: 16px; }
.block-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; margin: 0 0 8px; }
.count { font-weight: 500; font-size: 12px; padding: 1px 8px; border-radius: 999px; background: var(--surface-muted, #f1f5f9); }
.err-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.err-item { padding: 10px 12px; border: 1px solid var(--border-color, #e2e8f0); border-radius: 10px; }
.err-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; font-size: 12px; }
.err-time { color: var(--text-secondary, #64748b); }
.err-page { color: var(--text-secondary, #64748b); overflow-wrap: anywhere; }
.err-event { font-weight: 600; font-size: 14px; }
.err-msg {
  margin-top: 6px; font-size: 13px; overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 4; line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
}
.err-meta { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 4px; font-size: 12px; color: var(--text-secondary, #64748b); }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.shown-of { margin: 8px 0 0; font-size: 12px; color: var(--text-secondary, #64748b); }
</style>

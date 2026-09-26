<template>
  <div class="user-devices">
    <div v-if="loading" class="state"><LoadingSpinner /></div>
    <div v-else-if="loadFailed" class="state state--error" role="alert">{{ t('staff.insight.devices.loadFailed') }}</div>
    <div v-else-if="sessions.length === 0" class="state">{{ t('staff.insight.devices.empty') }}</div>
    <template v-else>
      <ul class="device-list">
        <li v-for="s in sessions" :key="s.id" class="device-item" :title="s.user_agent">
          <component :is="kindIcon(s.device.kind)" :size="20" class="device-icon" aria-hidden="true" />
          <div class="device-body">
            <div class="device-name">
              {{ deviceLabel(s) }}
              <span v-if="s.device.model" class="device-model">· {{ s.device.model }}</span>
            </div>
            <div class="device-meta">
              <span>{{ t('staff.insight.devices.signedIn') }}: {{ fmt(s.created_at) }}</span>
              <span v-if="s.last_active_at">{{ t('staff.insight.devices.lastActive') }}: {{ fmt(s.last_active_at) }}</span>
              <!-- Без емодзі-прапорця: Windows їх не малює, виходило «UA UA» (2026-09-26) -->
              <span v-if="s.country">{{ t('staff.insight.devices.country') }}: {{ s.country }}</span>
            </div>
          </div>
          <!-- Стан рахує бекенд: «не завершена» — чесніше за «активна», бо вихід до пакета A
               спільного екрана revoked_at не ставить (рев'ю 2026-09-26) -->
          <Badge v-if="s.status === 'ended'" variant="muted" size="sm">
            {{ t('staff.insight.devices.status.ended') }}{{ s.revocation_reason ? ` · ${reasonLabel(s.revocation_reason)}` : '' }}
          </Badge>
          <Badge v-else-if="s.status === 'expired'" variant="muted" size="sm">{{ t('staff.insight.devices.status.expired') }}</Badge>
          <Badge v-else variant="accent" size="sm">{{ t('staff.insight.devices.status.open') }}</Badge>
        </li>
      </ul>
      <p v-if="total > sessions.length" class="shown-of">
        {{ t('staff.insight.shownOf', { shown: sessions.length, total }) }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * Входи користувача з пристроєм: «Телефон · Android 14 · Chrome Mobile 153».
 * Власник 2026-09-26 перед рекламою: «з якого гаджета зайшов вчитель».
 * Сирий user-agent — у підказці рядка (для розбору помилок).
 */
import { ref, watch, onMounted, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { Smartphone, Tablet, Monitor, Bot, HelpCircle } from 'lucide-vue-next'
import { getUserSessions, type StaffUserSession, type StaffDeviceInfo } from '@/api/staff'
import Badge from '@/ui/Badge.vue'
import LoadingSpinner from '@/ui/LoadingSpinner.vue'
import { activeLocale } from '@/utils/i18nDate'

const props = defineProps<{ userId: string | number }>()
const { t, te } = useI18n()

function reasonLabel(reason: string): string {
  const key = `staff.insight.devices.reasons.${reason}`
  return te(key) ? t(key) : reason
}

const sessions = ref<StaffUserSession[]>([])
const total = ref(0)
const loading = ref(false)
const loadFailed = ref(false)

const ICONS: Record<StaffDeviceInfo['kind'], Component> = {
  phone: Smartphone,
  tablet: Tablet,
  computer: Monitor,
  bot: Bot,
  unknown: HelpCircle,
}

function kindIcon(kind: StaffDeviceInfo['kind']): Component {
  return ICONS[kind] ?? HelpCircle
}

function deviceLabel(s: StaffUserSession): string {
  const parts = [t(`staff.insight.devices.kind.${s.device.kind}`), s.device.os, s.device.browser].filter(Boolean)
  return parts.join(' · ')
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(activeLocale(), {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

async function load(): Promise<void> {
  loading.value = true
  loadFailed.value = false
  try {
    const res = await getUserSessions(String(props.userId), { limit: 20 })
    sessions.value = res.results
    total.value = res.count
  } catch (e) {
    // Не мовчимо: панель показує, що дані не завантажились, а не «входів не було».
    console.error('[staff] user sessions load failed', e)
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
.device-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.device-item {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px;
  border: 1px solid var(--border-color, #e2e8f0); border-radius: 10px;
}
.device-icon { flex-shrink: 0; color: var(--text-secondary, #64748b); }
.device-body { flex: 1; min-width: 0; }
.device-name { font-weight: 600; font-size: 14px; }
.device-model { font-weight: 400; color: var(--text-secondary, #64748b); }
.device-meta { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12px; color: var(--text-secondary, #64748b); margin-top: 2px; }
.shown-of { margin: 8px 0 0; font-size: 12px; color: var(--text-secondary, #64748b); }
</style>

<template>
  <div v-if="isVisible" class="paywall-modal-overlay" @click="handleOverlayClick">
    <div class="paywall-modal" @click.stop>
      <div class="paywall-header">
        <h2>{{ $t('whiteboard.paywall.title') }}</h2>
        <button class="close-btn" @click="close" aria-label="Close">
          <span>&times;</span>
        </button>
      </div>
      
      <div class="paywall-content">
        <div class="limit-info">
          <p class="limit-message">
            {{ getLimitMessage() }}
          </p>
          
          <div v-if="limitData" class="limit-details">
            <div class="detail-row">
              <span class="label">{{ $t('whiteboard.paywall.currentPlan') }}:</span>
              <span class="value">{{ getCurrentPlan() }}</span>
            </div>
            <div class="detail-row">
              <span class="label">{{ $t('whiteboard.paywall.currentUsage') }}:</span>
              <span class="value">{{ limitData.current }} / {{ limitData.limit }}</span>
            </div>
            <div class="detail-row">
              <span class="label">{{ $t('whiteboard.paywall.requiredPlan') }}:</span>
              <span class="value upgrade">{{ getRequiredPlan() }}</span>
            </div>
          </div>
        </div>
        
        <div class="upgrade-benefits">
          <h3>{{ $t('whiteboard.paywall.upgradeTitle') }}</h3>
          <ul>
            <li v-for="benefit in getBenefits()" :key="benefit">{{ benefit }}</li>
          </ul>
        </div>
      </div>
      
      <div class="paywall-actions">
        <button class="btn-secondary" @click="close">
          {{ $t('common.cancel') }}
        </button>
        <button class="btn-primary" @click="handleUpgrade">
          {{ $t('whiteboard.paywall.upgradeButton') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

interface LimitData {
  code: string
  limit_type: string
  limit: number
  current: number
  required_plan: string
}

interface Props {
  limitData?: LimitData | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const router = useRouter()
const isVisible = ref(true)

const getCurrentPlan = () => {
  if (!props.limitData) return 'Free'
  
  const current = props.limitData.current
  const limit = props.limitData.limit
  
  if (limit === 2) return 'Free'
  if (limit === 10) return 'Pro'
  if (limit === 50) return 'Business'
  
  return 'Free'
}

const getRequiredPlan = () => {
  if (!props.limitData) return 'Pro'
  
  const plan = props.limitData.required_plan
  return plan.charAt(0).toUpperCase() + plan.slice(1)
}

const getLimitMessage = () => {
  if (!props.limitData) {
    return t('whiteboard.paywall.genericMessage')
  }
  
  return t('whiteboard.paywall.limitReached', {
    limit: props.limitData.limit,
    plan: getRequiredPlan(),
  })
}

const getBenefits = () => {
  const requiredPlan = props.limitData?.required_plan || 'pro'
  
  if (requiredPlan === 'pro') {
    return [
      t('whiteboard.paywall.benefits.pro.pages'),
      t('whiteboard.paywall.benefits.pro.storage'),
      t('whiteboard.paywall.benefits.pro.support'),
    ]
  }
  
  if (requiredPlan === 'business') {
    return [
      t('whiteboard.paywall.benefits.business.pages'),
      t('whiteboard.paywall.benefits.business.storage'),
      t('whiteboard.paywall.benefits.business.priority'),
      t('whiteboard.paywall.benefits.business.team'),
    ]
  }
  
  return []
}

const handleOverlayClick = () => {
  close()
}

const close = () => {
  isVisible.value = false
  emit('close')
}

const handleUpgrade = () => {
  close()
  router.push('/billing')
}
</script>

<style scoped>
.paywall-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.paywall-modal {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.paywall-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #e5e7eb;
}

.paywall-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  color: #111827;
}

.close-btn {
  background: none;
  border: none;
  font-size: 32px;
  color: #6b7280;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f3f4f6;
  color: #111827;
}

.paywall-content {
  padding: 24px;
}

.limit-info {
  margin-bottom: 24px;
}

.limit-message {
  font-size: 16px;
  color: #374151;
  margin-bottom: 16px;
  line-height: 1.6;
}

.limit-details {
  background: #f9fafb;
  border-radius: 8px;
  padding: 16px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
}

.detail-row:not(:last-child) {
  border-bottom: 1px solid #e5e7eb;
}

.detail-row .label {
  color: #6b7280;
  font-size: 14px;
}

.detail-row .value {
  color: #111827;
  font-weight: 500;
  font-size: 14px;
}

.detail-row .value.upgrade {
  color: #059669;
  font-weight: 600;
}

.upgrade-benefits {
  margin-top: 24px;
}

.upgrade-benefits h3 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin-bottom: 12px;
}

.upgrade-benefits ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.upgrade-benefits li {
  padding: 8px 0;
  padding-left: 24px;
  position: relative;
  color: #374151;
  font-size: 14px;
}

.upgrade-benefits li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #059669;
  font-weight: bold;
}

.paywall-actions {
  display: flex;
  gap: 12px;
  padding: 24px;
  border-top: 1px solid #e5e7eb;
}

.btn-secondary,
.btn-primary {
  flex: 1;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.btn-secondary:hover {
  background: #e5e7eb;
}

.btn-primary {
  background: #059669;
  color: white;
}

.btn-primary:hover {
  background: #047857;
}
</style>

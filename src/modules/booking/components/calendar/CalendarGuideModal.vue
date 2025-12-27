<template>
  <div class="guide-overlay" @click.self="$emit('close')" data-testid="guide-overlay">
    <div class="guide-modal" role="dialog" aria-labelledby="guide-title">
      <div class="guide-header">
        <h3 id="guide-title">{{ t('calendar.guide.title') }}</h3>
        <button class="close-btn" @click="$emit('close')" :aria-label="t('common.close')">
          <XIcon :size="20" />
        </button>
      </div>

      <div class="guide-content">
        <section class="guide-section intro">
          <p class="intro-text">{{ t('calendar.guide.intro') }}</p>
        </section>

        <section class="guide-section">
          <h4>{{ t('calendar.guide.colors') }}</h4>
          <ul class="legend-list">
            <li>
              <span class="dot yellow"></span>
              <span>{{ t('calendar.guide.availableSlot') }}</span>
            </li>
            <li>
              <span class="dot green"></span>
              <span>{{ t('calendar.guide.bookedLesson') }}</span>
            </li>
            <li>
              <span class="dot gray"></span>
              <span>{{ t('calendar.guide.blockedSlot') }}</span>
            </li>
          </ul>
        </section>

        <section class="guide-section">
          <h4>{{ t('calendar.guide.howToCreate') }}</h4>
          <p>{{ t('calendar.guide.createSlotDesc') }}</p>
        </section>

        <section class="guide-section">
          <h4>{{ t('calendar.guide.howToEdit') }}</h4>
          <p>{{ t('calendar.guide.editSlotDesc') }}</p>
        </section>

        <section class="guide-section">
          <h4>{{ t('calendar.guide.checkboxes') }}</h4>
          <ul>
            <li>{{ t('calendar.guide.checkboxLessons') }}</li>
            <li>{{ t('calendar.guide.checkboxAvailability') }}</li>
          </ul>
        </section>

        <section class="guide-section">
          <h4>{{ t('calendar.guide.navigation') }}</h4>
          <p>{{ t('calendar.guide.navigationDesc') }}</p>
        </section>

        <section class="guide-section">
          <h4>{{ t('calendar.guide.setupButton') }}</h4>
          <p>{{ t('calendar.guide.setupButtonDesc') }}</p>
        </section>

        <section class="guide-section">
          <h4>{{ t('calendar.guide.limits') }}</h4>
          <ul>
            <li>{{ t('calendar.guide.maxDuration') }}</li>
            <li>{{ t('calendar.guide.noDuplicates') }}</li>
            <li>{{ t('calendar.guide.noOverlap') }}</li>
          </ul>
        </section>

        <section class="guide-section">
          <h4>{{ t('calendar.guide.helpIcon') }}</h4>
          <p>{{ t('calendar.guide.helpIconDesc') }}</p>
        </section>
      </div>

      <div class="guide-footer">
        <button class="btn-primary" @click="$emit('close')">
          {{ t('common.understood') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { X as XIcon } from 'lucide-vue-next'

defineEmits<{
  close: []
}>()

const { t } = useI18n()
</script>

<style scoped>
.guide-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
}

.guide-modal {
  background: var(--color-bg-primary, white);
  border-radius: 12px;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.guide-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.guide-header h3 {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
  margin: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  border-radius: 6px;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.15s;
}

.close-btn:hover {
  background: var(--color-bg-secondary, #f3f4f6);
  color: var(--color-text-primary, #111827);
}

.guide-content {
  padding: 24px;
}

.guide-section {
  margin-bottom: 24px;
}

.guide-section:last-child {
  margin-bottom: 0;
}

.guide-section.intro {
  background: var(--color-bg-secondary, #f9fafb);
  padding: 16px;
  border-radius: 8px;
  border-left: 4px solid var(--color-primary, #3b82f6);
}

.intro-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-primary, #374151);
  margin: 0;
  font-weight: 500;
}

.guide-section h4 {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
  margin: 0 0 12px 0;
}

.guide-section p {
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-secondary, #6b7280);
  margin: 0;
}

.guide-section ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.guide-section ul li {
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-text-secondary, #6b7280);
  margin-bottom: 8px;
  padding-left: 20px;
  position: relative;
}

.guide-section ul li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--color-primary, #3b82f6);
}

.legend-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.legend-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-left: 0;
}

.legend-list li::before {
  display: none;
}

.dot {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  flex-shrink: 0;
}

.dot.yellow {
  background: #fbbf24;
}

.dot.green {
  background: #10b981;
}

.dot.gray {
  background: #9ca3af;
}

.guide-footer {
  padding: 16px 24px;
  border-top: 1px solid var(--color-border, #e5e7eb);
  display: flex;
  justify-content: flex-end;
}

.btn-primary {
  padding: 10px 20px;
  background: var(--color-primary, #3b82f6);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary:hover {
  background: var(--color-primary-dark, #2563eb);
}
</style>

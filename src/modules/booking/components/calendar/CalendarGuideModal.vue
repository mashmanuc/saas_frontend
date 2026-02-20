<template>
  <Modal :open="true" :title="t('calendar.guide.title')" size="md" @close="$emit('close')">
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

    <template #footer>
      <Button variant="primary" @click="$emit('close')">
        {{ t('common.understood') }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Modal from '@/ui/Modal.vue'
import Button from '@/ui/Button.vue'

defineEmits<{
  close: []
}>()

const { t } = useI18n()
</script>

<style scoped>
.guide-content {
  padding: 0;
}

.guide-section {
  margin-bottom: 24px;
}

.guide-section:last-child {
  margin-bottom: 0;
}

.guide-section.intro {
  background: var(--bg-secondary);
  padding: 16px;
  border-radius: var(--radius-md);
  border-left: 4px solid var(--accent);
}

.intro-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  margin: 0;
  font-weight: 500;
}

.guide-section h4 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px 0;
}

.guide-section p {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-secondary);
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
  color: var(--text-secondary);
  margin-bottom: 8px;
  padding-left: 20px;
  position: relative;
}

.guide-section ul li::before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--accent);
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
  background: var(--warning, #fbbf24);
}

.dot.green {
  background: var(--success, #10b981);
}

.dot.gray {
  background: var(--text-muted, #9ca3af);
}

</style>

/**
 * practiceCampaignStore — F3 World-System стан (кампанія + асет-манифест).
 * Контракти: /campaign/ + /campaign/manifest/. Окремо від F1 practiceStore і F2 worldsStore.
 * 404 = прогресія вимкнена прапором (FEATURE_PRACTICE_PROGRESSION) → status 'unavailable'.
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

import {
  practiceApi,
  type AssetManifest,
  type CampaignState,
  type CampaignSubmitResult,
} from '../api/practiceApi'

type Status = 'idle' | 'loading' | 'ready' | 'unavailable' | 'error'

function is404(e: any): boolean {
  return e?.response?.status === 404 || e?.status === 404
}

export const usePracticeCampaignStore = defineStore('practiceCampaign', () => {
  const campaign = ref<CampaignState | null>(null)
  const manifest = ref<AssetManifest>({})
  const status = ref<Status>('idle')
  const error = ref<string | null>(null)

  async function load(campaignId?: string): Promise<void> {
    status.value = 'loading'
    error.value = null
    try {
      const res = await practiceApi.getCampaign(campaignId)
      campaign.value = res.campaign
      manifest.value = await practiceApi.getManifest(campaignId)
      status.value = 'ready'
    } catch (e: any) {
      if (is404(e)) {
        status.value = 'unavailable'
      } else {
        status.value = 'error'
        error.value = e?.detail || e?.response?.data?.detail || e?.message || 'Помилка'
      }
    }
  }

  async function submitChallenge(
    world: number,
    step: number,
    problemExternalId: string,
    answer: Record<string, any>,
  ): Promise<CampaignSubmitResult> {
    // НЕ оновлюємо campaign тут — хост застосує applyCampaign ПІСЛЯ закриття вікна,
    // щоб пішак повільно «доїхав» до нової сходинки на видимій карті (не за оверлеєм).
    return practiceApi.submitStep(world, step, problemExternalId, answer, campaign.value?.id)
  }

  function applyCampaign(c: CampaignState): void {
    campaign.value = c // тригерить watcher карти → пішак ковзає на нову сходинку
  }

  return { campaign, manifest, status, error, load, submitChallenge, applyCampaign }
})

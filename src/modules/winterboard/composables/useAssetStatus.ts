// WB: useAssetStatus — render cross-reference для asset upload станів.
//
// ASSET_LIFECYCLE_SSOT INV-ASSET-3 (render resolution order):
//   1. op asset.src непорожній і remote (http/https) → рендер
//   2. інакше WBAsset(asset_id).status='confirmed' → рендер cdn_url (рятує F6:
//      confirm пройшов, але asset_update op з CDN-url загубився)
//   3. інакше — роль-залежний placeholder:
//        АВТОР: ⚠ "Зображення не потрапило в урок"
//        УЧЕНЬ / REPLAY-ГЛЯДАЧ: не рендерити (тихо відсутній)
//
// Стан береться з БД (GET /sessions/{id}/assets/), НЕ з op payload —
// бо recorder стрипає src(blob/data)+status, тому op сам по собі не знає
// "чому src порожній". БД WBAsset.status — source of truth (INV-ASSET-1).

import { ref } from 'vue'
import { winterboardApi } from '../api/winterboardApi'

export type AssetStatus = 'pending' | 'confirmed' | 'failed' | 'deleted'
export interface AssetStatusEntry {
  status: AssetStatus
  cdn_url: string
}
export type AssetRenderMode = 'image' | 'broken' | 'hidden'

/**
 * Чи src придатний для завантаження браузером.
 * Renderable: http(s)://, відносний /media/..., data: — будь-що непорожнє.
 * НЕ renderable: порожній рядок та blob: (живий blob обробляється окремо
 * через freshBlob — після reload blob мертвий, але рядок міг лишитись).
 */
export function isRenderableSrc(src: string | undefined | null): boolean {
  if (!src) return false
  return !src.startsWith('blob:')
}

/**
 * Резолвить ефективний src для asset (pure).
 * @param opSrc      asset.src з op/state (може бути '' / blob: / http / /media)
 * @param entry      WBAsset запис з БД (status + cdn_url), якщо є
 * Повертає завантажуваний URL для рендеру, або '' якщо не resolvable.
 */
export function resolveAssetSrc(
  opSrc: string | undefined | null,
  entry?: AssetStatusEntry,
): string {
  // 1. op.src вже придатний (confirmed asset з URL у state: http або /media)
  if (isRenderableSrc(opSrc)) return opSrc as string
  // 2. fallback: WBAsset confirmed з cdn_url (F6 recovery — op.src порожній)
  if (entry && entry.status === 'confirmed' && isRenderableSrc(entry.cdn_url)) {
    return entry.cdn_url
  }
  return ''
}

/**
 * Визначає режим рендеру asset (pure) — INV-ASSET-3.
 * @param opSrc    asset.src з op/state
 * @param entry    WBAsset запис з БД (якщо є)
 * @param isAuthor чи поточний глядач — автор дошки (може діяти)
 * @param freshBlob чи є живий локальний blob (жива сесія, ще вантажиться) —
 *                  для автора у grace-вікні показуємо саму картинку, не ⚠
 */
export function getAssetRenderMode(
  opSrc: string | undefined | null,
  entry: AssetStatusEntry | undefined,
  isAuthor: boolean,
  freshBlob = false,
): AssetRenderMode {
  // resolvable remote src → нормальний рендер
  if (resolveAssetSrc(opSrc, entry)) return 'image'
  // живий blob у поточній вкладці (optimistic, ще вантажиться) → рендеримо як image
  if (freshBlob && (opSrc ?? '').startsWith('blob:')) return 'image'
  // не resolvable: автор бачить ⚠, пасивний глядач — нічого (INV-ASSET-0, INV-ASSET-8)
  return isAuthor ? 'broken' : 'hidden'
}

/**
 * Composable: тримає map asset_id → {status, cdn_url} з БД.
 * Завантажується при відкритті session/replay; render cross-reference.
 */
export function useAssetStatus() {
  const statusMap = ref<Map<string, AssetStatusEntry>>(new Map())
  const loaded = ref(false)

  async function load(sessionId: string): Promise<void> {
    if (!sessionId) return
    try {
      const resp = await winterboardApi.getSessionAssets(sessionId)
      const next = new Map<string, AssetStatusEntry>()
      for (const a of resp.assets ?? []) {
        next.set(a.id, { status: a.status as AssetStatus, cdn_url: a.cdn_url ?? '' })
      }
      statusMap.value = next
      loaded.value = true
    } catch (err) {
      // Не критично: без map render деградує до op.src-only (INV-ASSET-3 крок 1).
      // НЕ глушимо мовчки — лог для діагностики.
      console.warn('[WB:assetStatus] load failed, render falls back to op.src only', err)
    }
  }

  function getEntry(assetId: string): AssetStatusEntry | undefined {
    return statusMap.value.get(assetId)
  }

  return { statusMap, loaded, load, getEntry }
}

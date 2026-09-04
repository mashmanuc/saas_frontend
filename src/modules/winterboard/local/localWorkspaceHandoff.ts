// Local Workspace Phase 3 — синтетичні ops для handoff (ТЗ §5).
//
// Локальний стан → послідовність ops ЧЕРЕЗ ШТАТНИЙ write-шлях
// (opsSync.record() → POST /replay/batch/ → OpsApplyService). Жодних прямих
// записів state — LAW §2 (single write path) дотримано за побудовою.
//
// Форма ops дзеркалить boardStore._emitPageAddDecomposed 1:1:
//   1. page_add — METADATA only (малий payload, влазить у per-op cap);
//   2. stroke_add — по одному на штрих;
//   3. asset_add — по одному на об'єкт (document_viewer.pages та data:/blob:
//      src стріпаються — як у serializedStateForSave/recorder). Переглядачі
//      без запису в бекенді сюди не потрапляють узагалі — див. isTransferable.
// Один op = одна сутність → жоден op не перевищує payload-ліміт (S6.1 frozen —
// ліміти НЕ чіпаємо, підлаштовуємось під наявні).

import type { WBWorkspaceState, WBAsset } from '../types/winterboard'
import type { LocalHandoffOp } from './localWorkspaceStorage'

function opId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `ho-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Чи має сенс везти цей об'єкт у хмару.
 *
 * `document_viewer` малюється зі сторінок, які бере за `content_ref.content_id`
 * з бекенду. У переглядача демо-вітрини такого запису НЕМА — його сторінки це
 * статичні файли, вказані в самому об'єкті, а `pages[]` в ops не їдуть
 * (payload-інваріант). Тож у хмарі він став би порожньою рамкою: об'єкт є,
 * показати нічого. Краще не везти зовсім, ніж привезти биту рамку.
 *
 * Це стосується ЛИШЕ вітрини: власні документи людина завантажує вже після
 * входу, там працює справжній імпорт і `content_id` є. Її штрихи й решта
 * об'єктів їдуть як раніше.
 */
function isTransferable(asset: WBAsset): boolean {
  if (asset.type !== 'document_viewer') return true
  return Boolean(asset.content_ref?.content_id)
}

/** Гігієна asset-а перед відправкою (дзеркало serializedStateForSave). */
function sanitizeAsset(asset: WBAsset): WBAsset {
  let clean = asset
  // document_viewer: pages[] не персистяться (fetch on demand за content_id)
  if (clean.type === 'document_viewer' && clean.pages) {
    const { pages: _p, ...rest } = clean
    clean = rest as WBAsset
  }
  // data:/blob: URLs — локальні, на сервер не шлються (роздули б payload)
  if (typeof clean.src === 'string' && (clean.src.startsWith('data:') || clean.src.startsWith('blob:'))) {
    clean = { ...clean, src: '', _localOnly: true } as WBAsset
  }
  return clean
}

/**
 * Побудувати ops-послідовність для повного відтворення локального стану
 * у свіжій хмарній сесії. Генерується ОДИН раз і персиститься у handoff-буфер
 * (op_id стабільні між retry → BE-дедуплікація за INV-IDEMPOTENCY).
 */
export function buildHandoffOps(state: WBWorkspaceState): LocalHandoffOp[] {
  const ops: LocalHandoffOp[] = []

  for (const page of state.pages) {
    // 1. page_add — metadata only
    ops.push({
      op_id: opId(),
      op_type: 'page_add',
      page_id: page.id,
      payload: {
        page: {
          id: page.id,
          name: page.name,
          background: page.background,
          backgroundColor: page.backgroundColor,
          width: page.width,
          height: page.height,
          grid: page.grid,
        },
      },
    })

    // 2. stroke_add per stroke
    for (const stroke of page.strokes) {
      ops.push({
        op_id: opId(),
        op_type: 'stroke_add',
        page_id: page.id,
        payload: { stroke: stroke as unknown as Record<string, unknown> },
      })
    }

    // 3. asset_add per asset (крім тих, що в хмарі показати нічим)
    for (const asset of page.assets) {
      if (!isTransferable(asset)) continue
      ops.push({
        op_id: opId(),
        op_type: 'asset_add',
        page_id: page.id,
        payload: { asset: sanitizeAsset(asset) as unknown as Record<string, unknown> },
      })
    }
  }

  return ops
}

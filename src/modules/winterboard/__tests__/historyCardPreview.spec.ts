/**
 * Тимчасовий превʼю: рендерить три картки з РЕАЛЬНИМИ пайлоадами в HTML-файл,
 * щоб подивитись очима. Не перевірка — показ.
 *
 * Запуск: HISTORY_CARD_PREVIEW=1 npx vitest run src/modules/winterboard/__tests__/historyCardPreview.spec.ts
 * Результат: DATA/knowledge_probe/CARD_CONTRACT/board_payloads/preview.html
 *
 * Лише на явний запит: у звичайному прогоні він читав `../DATA` поза будь-яким
 * git (у CI і воркtree — падіння) і ПИСАВ файл при кожному запуску тестів.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { mount } from '@vue/test-utils'
import { describe, it } from 'vitest'

import HistoryCardRenderer from '../components/board/objects/HistoryCardRenderer.vue'
import type { WBAsset } from '../types/winterboard'

const ROOT = resolve(__dirname, '../../../..')
const DATA = resolve(ROOT, '../DATA/knowledge_probe/CARD_CONTRACT/board_payloads')
const SFC = resolve(__dirname, '../components/board/objects/HistoryCardRenderer.vue')

describe.runIf(process.env.HISTORY_CARD_PREVIEW === '1')('HistoryCard · превʼю (HISTORY_CARD_PREVIEW=1)', () => {
  it('рендерить три картки в preview.html', () => {
    const payloads = JSON.parse(readFileSync(resolve(DATA, 'all.json'), 'utf-8'))
    // Стилі беремо з самого SFC — те саме, що побачить дошка.
    const sfc = readFileSync(SFC, 'utf-8')
    const css = (sfc.match(/<style scoped>([\s\S]*?)<\/style>/) || ['', ''])[1]

    const cards = payloads.map((p: Record<string, unknown>, i: number) => {
      const asset = {
        id: `hc${i}`, type: 'history_card', src: '', x: 0, y: 0, w: 520, h: 380,
        rotation: 0, locked: false,
        data: {
          version: 1,
          variant: p.variant,
          title: p.title,
          subtitle: p.subtitle || undefined,
          image: p.image,
          primary: p.primary,
          secondary: p.secondary,
          expanded: false,
          sources: p.sources,
          content_language: 'uk',
        },
      } as unknown as WBAsset
      const w = mount(HistoryCardRenderer, {
        props: { asset, interactive: true },
        global: { mocks: { $t: (k: string) => k }, stubs: { 'i18n-t': true } },
      })
      return `<div class="slot"><div class="label">${p._note ?? p.variant}</div>
        <div class="card-box">${w.html()}</div></div>`
    })

    const html = `<!DOCTYPE html>
<html lang="uk"><head><meta charset="utf-8">
<title>HistoryCard — реальні дані</title>
<style>
  body { margin:0; padding:32px; background:#f1f5f9; font-family:system-ui,-apple-system,'Segoe UI',sans-serif; }
  h1 { font-size:20px; margin:0 0 4px; color:#0f172a; }
  .sub { color:#64748b; font-size:14px; margin-bottom:28px; }
  .row { display:flex; gap:28px; align-items:flex-start; flex-wrap:wrap; }
  .slot { }
  .label { font:600 11px/1 monospace; color:#64748b; text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px; }
  /* Картка на дошці має фіксовану ширину 520 і авто-висоту. */
  .card-box { width:520px; }
  .card-box > div { position:relative; height:auto !important; }
  ${css}
  /* На дошці pointer-events ловить Konva-проксі; у превʼю дозволяємо кліки. */
  .history-card { pointer-events:auto !important; }
</style></head>
<body>
<h1>HistoryCard — шість живих прикладів</h1>
<div class="sub">Шість карток із ПРОДУКТОВОГО бекенду. Ширина 520 як у theory_card. Дії вимкнені — кімната їх ще не слухає.</div>
<div class="row">${cards.join('\n')}</div>
</body></html>`
    writeFileSync(resolve(DATA, 'preview.html'), html, 'utf-8')
  })
})

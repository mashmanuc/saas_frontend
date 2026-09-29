/**
 * Б-84 (2026-09-29): код із src/ не зводиться примусово в доменні чанки. Раніше `manualChunks` клав усе з
 * /modules/winterboard/ у chunk-winterboard (і так само booking/chat/marketplace/knowledge/board), а одного
 * маленького імпорту на шляху входу (роутер → winterboard/config/featureFlags) вистачало, щоб index.html
 * передзавантажував увесь домен: /start тягнув 5,8 МБ JS (прод). Вендорні чанки лишаються — стабільний кеш.
 * Живий доказ — локальна прод-збірка: /start 5,76 → 2,41 МБ, /workspace 5,74 → 4,59 МБ.
 */
import { describe, it, expect } from 'vitest'
import config from '../../../vite.config.js'

type ManualChunks = (id: string) => string | undefined
const manualChunks = (config as unknown as { build: { rollupOptions: { output: { manualChunks: ManualChunks } } } })
  .build.rollupOptions.output.manualChunks

describe('Б-84: розбиття збірки на чанки', () => {
  it('код застосунку (src/) не зводиться в доменні чанки — Rollup ділить його за лінивими маршрутами', () => {
    for (const id of [
      'D:/app/src/modules/winterboard/config/featureFlags.ts',
      'D:/app/src/modules/winterboard/views/WBSoloRoom.vue',
      'D:/app/src/modules/booking/api/booking.ts',
      'D:/app/src/modules/chat/views/ChatView.vue',
      'D:/app/src/modules/marketplace/index.ts',
      'D:/app/src/modules/knowledge/KnowledgeLibrary.vue',
      'D:/app/src/modules/board/index.ts',
      'D:/app/src/stores/chatStore.js',
    ]) {
      expect(manualChunks(id), id).toBeUndefined()
    }
  })

  it('вендорні чанки лишаються (стабільний кеш між релізами)', () => {
    expect(manualChunks('D:/app/node_modules/vue/dist/vue.runtime.esm-bundler.js')).toBe('vendor-vue')
    expect(manualChunks('D:/app/node_modules/konva/lib/Core.js')).toBe('vendor-konva')
    expect(manualChunks('D:/app/node_modules/three/build/three.module.js')).toBe('vendor-three')
    expect(manualChunks('D:/app/node_modules/vue-i18n/dist/vue-i18n.mjs')).toBe('vendor-i18n')
  })
})

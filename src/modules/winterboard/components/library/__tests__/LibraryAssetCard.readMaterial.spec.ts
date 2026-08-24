// Ф6-4: кнопка «прочитати матеріал» існує лише коли СЕРВЕР сказав, що
// читання ввімкнене. Раніше вона показувалась завжди і на клік чесно
// відповідала «вимкнено на цьому сервері» — тобто існувала, щоб відмовити
// (знайдено при звірці прода перед пушем 2026-08-24).
//
// Прапорець один — серверний (`MATERIAL_EXTRACT_ENABLED` → `materialsApi
// .status()`). FE-дубліката тут немає навмисно: два вимикачі розійшлися б.
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import uk from '@/i18n/locales/uk.json'
import LibraryAssetCard from '../LibraryAssetCard.vue'
import type { LibraryAsset } from '../../../types/library'

const i18n = createI18n({ legacy: false, locale: 'uk', messages: { uk } })

const asset: LibraryAsset = {
  id: 1,
  name: 'Капіносов, стор. 20.pdf',
  storage_key: 'k',
  cdn_url: '',
  thumbnail_url: '',
  content_type: 'application/pdf',
  size_bytes: 1024,
  status: 'active',
  folder: null,
  is_favorite: false,
  last_used_at: null,
  tags: [],
  created_at: '2026-08-19T00:00:00Z',
  updated_at: '2026-08-19T00:00:00Z',
}

const mountCard = (props: Record<string, unknown> = {}) =>
  mount(LibraryAssetCard, {
    props: { asset, ...props },
    global: { plugins: [i18n] },
  })

const readBtn = (w: ReturnType<typeof mountCard>) =>
  w.findAll('.library-asset-card__action-btn')
    .find(b => b.text().includes('📖'))

describe('LibraryAssetCard · «прочитати матеріал» за станом сервера', () => {
  it('прапорець вимкнено (дефолт) — кнопки НЕМАЄ', () => {
    expect(readBtn(mountCard())).toBeUndefined()
  })

  it('явне false — кнопки немає', () => {
    expect(readBtn(mountCard({ canReadMaterial: false }))).toBeUndefined()
  })

  it('сервер сказав true — кнопка є і емітить подію', async () => {
    const w = mountCard({ canReadMaterial: true })
    const btn = readBtn(w)
    expect(btn).toBeDefined()
    await btn!.trigger('click')
    expect(w.emitted('read-material')).toHaveLength(1)
  })

  it('решта дій картки не залежить від прапорця', () => {
    // Улюблене/перейменувати/видалити мають лишатись на місці — інакше
    // «сховати кнопку» тихо забрало б і сусідні.
    const off = mountCard().findAll('.library-asset-card__action-btn').length
    const on = mountCard({ canReadMaterial: true })
      .findAll('.library-asset-card__action-btn').length
    expect(on - off).toBe(1)
  })
})

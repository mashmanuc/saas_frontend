// Ф6-4: кнопка «прочитати матеріал» існує лише коли СЕРВЕР сказав, що
// читання ввімкнене. Раніше вона показувалась завжди і на клік чесно
// відповідала «вимкнено на цьому сервері» — тобто існувала, щоб відмовити
// (знайдено при звірці прода перед пушем 2026-08-24).
//
// Прапорець один — серверний (`MATERIAL_EXTRACT_ENABLED` → `materialsApi
// .status()`). FE-дубліката тут немає навмисно: два вимикачі розійшлися б.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

// Межа з рев'ю Феї (2026-08-24, §2.2): поле `ocr` у статусі є, але FE НЕ
// має починати ним щось показувати чи ховати, доки немає рішення власника
// про гроші — інакше ми винесемо в інтерфейс цінове рішення раніше за нього.
// (6-1b: раніше відхилені сторінки були безкоштовні, тепер коштують виклик.)
// Правильний стан поля сьогодні — невживане. Цей тест валиться, щойно воно
// почне керувати виглядом.
describe('межа: `ocr` зі статусу не керує інтерфейсом', () => {
  it('жоден FE-файл бібліотеки не читає status().ocr', () => {
    const NL = String.fromCharCode(10)
    const files = [
      '../../../views/WBLibrary.vue',
      '../LibraryAssetCard.vue',
      '../MaterialExtractPanel.vue',
    ]
    for (const rel of files) {
      const src = readFileSync(resolve(__dirname, rel), 'utf8')
      const code = src
        .split(NL)
        .filter(l => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
        .join(NL)
      expect(code).not.toMatch(/\.ocr/)
      expect(code).not.toMatch(/materialsOcr|ocrEnabled/)
    }
  })
})

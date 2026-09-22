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
import { afterEach, describe, expect, it } from 'vitest'
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
    attachTo: document.body,
  })

// Дії картки — у меню «…» (візуальний розбір «Матеріалів» 2026-09-22, п. 4),
// меню телепортоване в body. Відкриваємо його і читаємо пункти звідти.
async function menuItems(w: ReturnType<typeof mountCard>): Promise<HTMLElement[]> {
  await w.find('[data-testid="asset-menu-trigger"]').trigger('click')
  return [...document.querySelectorAll<HTMLElement>('.lib-asset-menu [data-action]')]
}
const readItem = (items: HTMLElement[]) => items.find(b => b.dataset.action === 'read-material')

describe('LibraryAssetCard · «прочитати матеріал» за станом сервера', () => {
  afterEach(() => { document.body.innerHTML = '' })

  it('прапорець вимкнено (дефолт) — пункту НЕМАЄ', async () => {
    expect(readItem(await menuItems(mountCard()))).toBeUndefined()
  })

  it('явне false — пункту немає', async () => {
    expect(readItem(await menuItems(mountCard({ canReadMaterial: false })))).toBeUndefined()
  })

  it('сервер сказав true — пункт є і емітить подію', async () => {
    const w = mountCard({ canReadMaterial: true })
    const item = readItem(await menuItems(w))
    expect(item).toBeDefined()
    item!.click()
    expect(w.emitted('read-material')).toHaveLength(1)
  })

  it('решта дій картки не залежить від прапорця', async () => {
    // Улюблене/перейменувати/перемістити/в архів мають лишатись на місці —
    // інакше «сховати пункт» тихо забрало б і сусідні.
    const off = (await menuItems(mountCard())).length
    document.body.innerHTML = ''
    const on = (await menuItems(mountCard({ canReadMaterial: true }))).length
    expect(on - off).toBe(1)
    expect(off).toBe(4)
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
      // Межа слова навмисно НЕ через регекс-мітку "межа слова": попередня
      // редакція мала замість двох символів (backslash + b) один керуючий
      // байт 0x08 (BACKSPACE) — heredoc-запис файлу з'їв екранування. Тест
      // був зелений і не міг впасти НІКОЛИ (byte-level знахідка рев'ю Феї,
      // 2026-08-24: `od -c` на цьому рядку). Негативний lookahead — той
      // самий намір без ризику невидимого байта.
      expect(code).not.toMatch(/\.ocr(?![_A-Za-z0-9])/)
      expect(code).not.toMatch(/materialsOcr|ocrEnabled/)
    }
  })
})

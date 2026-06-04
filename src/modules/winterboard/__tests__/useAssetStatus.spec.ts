import { describe, it, expect } from 'vitest'
import {
  isRenderableSrc,
  resolveAssetSrc,
  getAssetRenderMode,
  type AssetStatusEntry,
} from '../composables/useAssetStatus'

describe('isRenderableSrc', () => {
  it('true для http/https', () => {
    expect(isRenderableSrc('https://cdn/x.png')).toBe(true)
    expect(isRenderableSrc('http://cdn/x.png')).toBe(true)
  })
  it('true для відносного /media/ (regression: НЕ broken!)', () => {
    expect(isRenderableSrc('/media/winterboard/abc.png')).toBe(true)
  })
  it('true для data: URL', () => {
    expect(isRenderableSrc('data:image/png;base64,xxx')).toBe(true)
  })
  it('false для blob/порожнього (live blob — окремо через freshBlob)', () => {
    expect(isRenderableSrc('blob:abc')).toBe(false)
    expect(isRenderableSrc('')).toBe(false)
    expect(isRenderableSrc(undefined)).toBe(false)
    expect(isRenderableSrc(null)).toBe(false)
  })
})

describe('resolveAssetSrc (INV-ASSET-3)', () => {
  it('крок 1: op.src remote → використати напряму', () => {
    expect(resolveAssetSrc('https://cdn/a.png')).toBe('https://cdn/a.png')
  })

  it('крок 1 regression: відносний /media/ src → рендериться (НЕ broken)', () => {
    expect(resolveAssetSrc('/media/winterboard/x.png')).toBe('/media/winterboard/x.png')
  })

  it('крок 1: data: src → рендериться', () => {
    expect(resolveAssetSrc('data:image/png;base64,xxx')).toBe('data:image/png;base64,xxx')
  })

  it('крок 2: op.src порожній + WBAsset confirmed → cdn_url (F6 recovery)', () => {
    const entry: AssetStatusEntry = { status: 'confirmed', cdn_url: 'https://cdn/b.png' }
    expect(resolveAssetSrc('', entry)).toBe('https://cdn/b.png')
  })

  it('failed asset → порожній (не resolvable)', () => {
    const entry: AssetStatusEntry = { status: 'failed', cdn_url: '' }
    expect(resolveAssetSrc('', entry)).toBe('')
  })

  it('pending asset → порожній (cdn ще не готовий)', () => {
    const entry: AssetStatusEntry = { status: 'pending', cdn_url: '' }
    expect(resolveAssetSrc('', entry)).toBe('')
  })

  it('blob: src без entry → порожній', () => {
    expect(resolveAssetSrc('blob:xyz')).toBe('')
  })

  it('confirmed але cdn_url не remote → порожній (захист)', () => {
    const entry: AssetStatusEntry = { status: 'confirmed', cdn_url: '' }
    expect(resolveAssetSrc('', entry)).toBe('')
  })
})

describe('getAssetRenderMode (INV-ASSET-3 / INV-ASSET-8)', () => {
  const confirmed: AssetStatusEntry = { status: 'confirmed', cdn_url: 'https://cdn/ok.png' }
  const failed: AssetStatusEntry = { status: 'failed', cdn_url: '' }

  it('resolvable src → image (для всіх ролей)', () => {
    expect(getAssetRenderMode('https://cdn/a.png', undefined, true)).toBe('image')
    expect(getAssetRenderMode('https://cdn/a.png', undefined, false)).toBe('image')
    expect(getAssetRenderMode('', confirmed, false)).toBe('image')
  })

  it('failed + автор → broken (⚠)', () => {
    expect(getAssetRenderMode('', failed, true)).toBe('broken')
  })

  it('failed + учень/replay → hidden (тихо відсутній)', () => {
    expect(getAssetRenderMode('', failed, false)).toBe('hidden')
  })

  it('немає entry + автор → broken; учень → hidden', () => {
    expect(getAssetRenderMode('', undefined, true)).toBe('broken')
    expect(getAssetRenderMode('', undefined, false)).toBe('hidden')
  })

  it('живий blob у автора (grace, ще вантажиться) → image, не ⚠', () => {
    expect(getAssetRenderMode('blob:xyz', undefined, true, true)).toBe('image')
  })

  it('blob без freshBlob прапорця (після reload) + автор → broken', () => {
    expect(getAssetRenderMode('blob:xyz', undefined, true, false)).toBe('broken')
  })

  it('blob без freshBlob + учень → hidden', () => {
    expect(getAssetRenderMode('blob:xyz', undefined, false, false)).toBe('hidden')
  })
})

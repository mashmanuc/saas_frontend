import { describe, expect, it } from 'vitest'
import { nativeAssetsAboveOverlays } from '../board/nativeAssetLayerOrder'

describe('PDF і HTML-картка: спільний порядок шарів', () => {
  const pdf = { type: 'document_viewer' }
  const geometry = { type: 'geometry_solid' }

  it('PDF ззаду картки: нативний canvas лишається ззаду', () => {
    expect(nativeAssetsAboveOverlays([pdf, geometry])).toBe(false)
  })

  it('↑ переносить PDF перед карткою: нативний canvas стає спереду', () => {
    expect(nativeAssetsAboveOverlays([geometry, pdf])).toBe(true)
  })

  it('↓ повертає PDF за картку', () => {
    const page = [geometry, pdf]
    const moved = [page[1], page[0]]
    expect(nativeAssetsAboveOverlays(moved)).toBe(false)
  })

  it('не піднімає весь Konva canvas, якщо нативні асети перемішані з HTML', () => {
    expect(nativeAssetsAboveOverlays([pdf, geometry, { type: 'image' }])).toBe(false)
  })

  it('не піднімає canvas над медіаплеєром', () => {
    expect(nativeAssetsAboveOverlays([geometry, { type: 'video_player' }, pdf])).toBe(false)
  })
})

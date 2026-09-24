import { assetStandard, isMinimizedOnBoard } from './objectStandard'

/**
 * Konva малює нативні асети на одному canvas, а HTML-картки — окремо.
 * Переставити цей canvas над HTML можна лише тоді, коли ВСІ видимі нативні
 * асети стоять після ВСІХ HTML-карток. У змішаному порядку це було б брехнею.
 */
export function nativeAssetsAboveOverlays(assets: readonly { type: string; minimized?: boolean }[]): boolean {
  let lastOverlay = -1
  let firstNative = Infinity
  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]
    if (isMinimizedOnBoard(asset)) continue
    const render = assetStandard(asset.type)?.render
    if (render === 'media') return false
    if (render === 'overlay') lastOverlay = i
    if (render === 'konva') firstNative = Math.min(firstNative, i)
  }
  return lastOverlay >= 0 && firstNative < Infinity && firstNative > lastOverlay
}

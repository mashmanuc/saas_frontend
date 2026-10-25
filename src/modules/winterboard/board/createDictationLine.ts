/** Створює лише дані для штатного addAsset, не пише стан і не викликає handwriting. */
import { assertDictationLine, type DictationLineData } from './dictationLine'
import type { WBAsset } from '../types/winterboard'
import { SERVER_PAYLOAD_LIMIT_BYTES, serverPayloadBytes } from '../services/opsPayloadSize'

export function createDictationLine(id: string, x: number, y: number, data: DictationLineData): WBAsset {
  assertDictationLine(data)
  if (!id || id.length > 128 || !Number.isFinite(x) || !Number.isFinite(y)
    || x < 0 || y < 0 || x + data.layout.width > 1920 || y + data.layout.height > 1080) {
    throw new Error('dictation_invalid_placement')
  }
  const asset: WBAsset = { id, type: 'dictation_line', src: '', x, y, w: data.layout.width,
    h: data.layout.height, rotation: 0, locked: false, data: JSON.parse(JSON.stringify(data)) }
  // Залишаємо 1KB для службових полів operation payload; ліміт протоколу не змінюємо.
  if (serverPayloadBytes({ asset }) > SERVER_PAYLOAD_LIMIT_BYTES - 1024) throw new Error('dictation_payload_too_large')
  return asset
}

/**
 * Розмір payload операції РІВНО так, як його рахує сервер (рев'ю P0, 2026-09-24).
 *
 * Сервер (`ops_apply_service.py`, `WBBoardOperationCreateSerializer.validate_payload`):
 *   len(json.dumps(payload, separators=(',', ':')).encode('utf-8')) > 64 * 1024
 * `ensure_ascii=True` за замовчуванням: кожен не-ASCII символ стає `\uXXXX` —
 * 6 байт, а не 2–3 байти UTF-8. Картка з 11 000 літер «І»: UTF-8 рахує ~22 KB,
 * сервер — ~66 KB і відхиляє увесь пакет.
 *
 * JSON.stringify уже дає ті самі компактні роздільники й ті самі escape для
 * керівних символів; лишається порахувати не-ASCII як Python: 6 байт на кожну
 * UTF-16 одиницю (пара сурогатів → 12, як `😀`; U+2028/2029 → 6).
 *
 * Відома дрібна розбіжність: експонента дробових чисел (JS `1e-7`, Python `1e-07`)
 * — на байт довше на сервері. Тому ліміт рекордера має запас (див. MAX_PAYLOAD_BYTES).
 */
export function serverPayloadBytes(payload: unknown): number {
  const s = JSON.stringify(payload ?? {})
  if (s === undefined) return 0
  let bytes = 0
  for (let i = 0; i < s.length; i++) {
    bytes += s.charCodeAt(i) < 0x80 ? 1 : 6
  }
  return bytes
}

/** Серверний ліміт однієї операції. */
export const SERVER_PAYLOAD_LIMIT_BYTES = 64 * 1024

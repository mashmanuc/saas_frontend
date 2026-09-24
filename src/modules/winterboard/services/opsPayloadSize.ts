/**
 * Розмір payload операції РІВНО так, як його рахує сервер (рев'ю P0, 2026-09-24).
 *
 * Сервер (`ops_apply_service.py`, `WBBoardOperationCreateSerializer.validate_payload`):
 *   len(json.dumps(payload, separators=(',', ':')).encode('utf-8')) > 64 * 1024
 * де payload — результат json.loads тіла, яке надіслав фронт. Відтворюємо Python:
 *
 *  - рядки: `ensure_ascii=True` — усе поза ' '..'~' стає `\uXXXX` (6 байт), зокрема
 *    не-ASCII (кожна UTF-16 одиниця; пара сурогатів = 12) і DEL 0x7F, який JS
 *    лишає як є; керівні символи — ті самі escape, що в JS (`\n`, `\u0001`…);
 *  - числа: токен JS без `.`/`e` Python читає як int — ті самі цифри; інакше float,
 *    і Python друкує його `repr`: наукова форма при десятковому порядку < -4 або ≥ 16
 *    (JS: < -7 або ≥ 21), експонента зі знаком і щонайменше двома цифрами
 *    (`1e-07`, `1e+16`), ціле значення з `.0`;
 *  - роздільники компактні — як JSON.stringify; порядок ключів той самий.
 *
 * Звірено з CPython диференційним прогоном (див. тест `opsPayloadSize.spec.ts`).
 */

function strBytes(s: string): number {
  const j = JSON.stringify(s)
  let n = 0
  for (let i = 0; i < j.length; i++) {
    const c = j.charCodeAt(i)
    n += c >= 0x20 && c < 0x7f ? 1 : 6
  }
  return n
}

/** Python `repr(float)` для скінченного числа, яке JSON-токен JS записав як float. */
export function pyFloatRepr(x: number): string {
  if (x === 0) return Object.is(x, -0) ? '-0.0' : '0.0'
  const sign = x < 0 ? '-' : ''
  const [mant, expStr] = Math.abs(x).toExponential().split('e')  // найкоротші цифри
  const digits = mant.replace('.', '')
  const e = Number(expStr)
  if (e < -4 || e >= 16) {
    const m = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits
    const ee = Math.abs(e) < 10 ? `0${Math.abs(e)}` : String(Math.abs(e))
    return `${sign}${m}e${e < 0 ? '-' : '+'}${ee}`
  }
  if (e < 0) return `${sign}0.${'0'.repeat(-e - 1)}${digits}`
  const intLen = e + 1
  if (digits.length <= intLen) return `${sign}${digits}${'0'.repeat(intLen - digits.length)}.0`
  return `${sign}${digits.slice(0, intLen)}.${digits.slice(intLen)}`
}

function numBytes(x: number): number {
  const tok = JSON.stringify(x)  // NaN/Infinity → 'null', як і в тілі запиту
  if (tok === 'null') return 4
  if (!/[.eE]/.test(tok)) return tok.length  // Python int — ті самі цифри
  return pyFloatRepr(x).length
}

function valueBytes(v: unknown): number {
  if (v === null) return 4
  switch (typeof v) {
    case 'string': return strBytes(v)
    case 'number': return numBytes(v)
    case 'boolean': return v ? 4 : 5
    case 'object': {
      if (Array.isArray(v)) {
        let n = 2 + Math.max(0, v.length - 1)
        for (const item of v) n += valueBytes(item)
        return n
      }
      const entries = Object.entries(v as Record<string, unknown>)
      let n = 2 + Math.max(0, entries.length - 1)
      for (const [k, item] of entries) n += strBytes(k) + 1 + valueBytes(item)
      return n
    }
    default: return 4
  }
}

export function serverPayloadBytes(payload: unknown): number {
  const text = JSON.stringify(payload ?? {})
  if (text === undefined) return 2
  // Те, що реально піде в тілі (undefined/функції відкинуто, toJSON застосовано).
  return valueBytes(JSON.parse(text))
}

/** Серверний ліміт однієї операції. */
export const SERVER_PAYLOAD_LIMIT_BYTES = 64 * 1024

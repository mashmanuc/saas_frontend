/**
 * Realtime Transport — v0.16.0
 * Binary Protocol (MessagePack) підтримка, JSON/Binary детектор
 */

/**
 * Message format types
 */
export const MESSAGE_FORMAT = {
  JSON: 'json',
  MSGPACK: 'msgpack',
  AUTO: 'auto',
}

/**
 * MessagePack encoder/decoder
 * Lightweight implementation without external dependencies
 */
class MessagePackCodec {
  /**
   * Encode value to MessagePack binary format
   */
  encode(value) {
    const parts = []
    this.encodeValue(value, parts)
    return new Uint8Array(parts)
  }

  /**
   * Decode MessagePack binary to value
   */
  decode(buffer) {
    const view = new DataView(buffer.buffer || buffer)
    const result = this.decodeValue(view, { offset: 0 })
    return result.value
  }

  /**
   * Encode single value
   */
  encodeValue(value, parts) {
    if (value === null) {
      parts.push(0xc0)
      return
    }

    if (value === undefined) {
      parts.push(0xc0) // Treat undefined as null
      return
    }

    if (typeof value === 'boolean') {
      parts.push(value ? 0xc3 : 0xc2)
      return
    }

    if (typeof value === 'number') {
      this.encodeNumber(value, parts)
      return
    }

    if (typeof value === 'string') {
      this.encodeString(value, parts)
      return
    }

    if (Array.isArray(value)) {
      this.encodeArray(value, parts)
      return
    }

    if (value instanceof Uint8Array) {
      this.encodeBinary(value, parts)
      return
    }

    if (typeof value === 'object') {
      this.encodeObject(value, parts)
      return
    }

    throw new Error(`Unsupported type: ${typeof value}`)
  }

  /**
   * Encode number
   */
  encodeNumber(num, parts) {
    if (Number.isInteger(num)) {
      if (num >= 0) {
        if (num < 128) {
          parts.push(num)
        } else if (num < 256) {
          parts.push(0xcc, num)
        } else if (num < 65536) {
          parts.push(0xcd, num >> 8, num & 0xff)
        } else if (num < 4294967296) {
          parts.push(0xce, num >> 24, (num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff)
        } else {
          // Use float64 for large numbers
          this.encodeFloat64(num, parts)
        }
      } else {
        if (num >= -32) {
          parts.push(0xe0 | (num + 32))
        } else if (num >= -128) {
          parts.push(0xd0, num & 0xff)
        } else if (num >= -32768) {
          parts.push(0xd1, (num >> 8) & 0xff, num & 0xff)
        } else if (num >= -2147483648) {
          parts.push(0xd2, (num >> 24) & 0xff, (num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff)
        } else {
          this.encodeFloat64(num, parts)
        }
      }
    } else {
      this.encodeFloat64(num, parts)
    }
  }

  /**
   * Encode float64
   */
  encodeFloat64(num, parts) {
    parts.push(0xcb)
    const buffer = new ArrayBuffer(8)
    const view = new DataView(buffer)
    view.setFloat64(0, num, false)
    for (let i = 0; i < 8; i++) {
      parts.push(view.getUint8(i))
    }
  }

  /**
   * Encode string
   */
  encodeString(str, parts) {
    const bytes = new TextEncoder().encode(str)
    const len = bytes.length

    if (len < 32) {
      parts.push(0xa0 | len)
    } else if (len < 256) {
      parts.push(0xd9, len)
    } else if (len < 65536) {
      parts.push(0xda, len >> 8, len & 0xff)
    } else {
      parts.push(0xdb, len >> 24, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff)
    }

    for (const byte of bytes) {
      parts.push(byte)
    }
  }

  /**
   * Encode array
   */
  encodeArray(arr, parts) {
    const len = arr.length

    if (len < 16) {
      parts.push(0x90 | len)
    } else if (len < 65536) {
      parts.push(0xdc, len >> 8, len & 0xff)
    } else {
      parts.push(0xdd, len >> 24, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff)
    }

    for (const item of arr) {
      this.encodeValue(item, parts)
    }
  }

  /**
   * Encode object
   */
  encodeObject(obj, parts) {
    const keys = Object.keys(obj)
    const len = keys.length

    if (len < 16) {
      parts.push(0x80 | len)
    } else if (len < 65536) {
      parts.push(0xde, len >> 8, len & 0xff)
    } else {
      parts.push(0xdf, len >> 24, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff)
    }

    for (const key of keys) {
      this.encodeString(key, parts)
      this.encodeValue(obj[key], parts)
    }
  }

  /**
   * Encode binary
   */
  encodeBinary(bytes, parts) {
    const len = bytes.length

    if (len < 256) {
      parts.push(0xc4, len)
    } else if (len < 65536) {
      parts.push(0xc5, len >> 8, len & 0xff)
    } else {
      parts.push(0xc6, len >> 24, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff)
    }

    for (const byte of bytes) {
      parts.push(byte)
    }
  }

  /**
   * Decode value from DataView
   */
  decodeValue(view, state) {
    const byte = view.getUint8(state.offset++)

    // Positive fixint (0x00 - 0x7f)
    if (byte < 0x80) {
      return { value: byte }
    }

    // Fixmap (0x80 - 0x8f)
    if ((byte & 0xf0) === 0x80) {
      return this.decodeMap(view, state, byte & 0x0f)
    }

    // Fixarray (0x90 - 0x9f)
    if ((byte & 0xf0) === 0x90) {
      return this.decodeArray(view, state, byte & 0x0f)
    }

    // Fixstr (0xa0 - 0xbf)
    if ((byte & 0xe0) === 0xa0) {
      return this.decodeString(view, state, byte & 0x1f)
    }

    // Negative fixint (0xe0 - 0xff)
    if (byte >= 0xe0) {
      return { value: byte - 256 }
    }

    switch (byte) {
      case 0xc0: return { value: null }
      case 0xc2: return { value: false }
      case 0xc3: return { value: true }

      // Binary
      case 0xc4: return this.decodeBinary(view, state, view.getUint8(state.offset++))
      case 0xc5: return this.decodeBinary(view, state, view.getUint16(state.offset, false), state.offset += 2)
      case 0xc6: return this.decodeBinary(view, state, view.getUint32(state.offset, false), state.offset += 4)

      // Float
      case 0xca: {
        const value = view.getFloat32(state.offset, false)
        state.offset += 4
        return { value }
      }
      case 0xcb: {
        const value = view.getFloat64(state.offset, false)
        state.offset += 8
        return { value }
      }

      // Unsigned int
      case 0xcc: return { value: view.getUint8(state.offset++) }
      case 0xcd: {
        const value = view.getUint16(state.offset, false)
        state.offset += 2
        return { value }
      }
      case 0xce: {
        const value = view.getUint32(state.offset, false)
        state.offset += 4
        return { value }
      }

      // Signed int
      case 0xd0: return { value: view.getInt8(state.offset++) }
      case 0xd1: {
        const value = view.getInt16(state.offset, false)
        state.offset += 2
        return { value }
      }
      case 0xd2: {
        const value = view.getInt32(state.offset, false)
        state.offset += 4
        return { value }
      }

      // String
      case 0xd9: return this.decodeString(view, state, view.getUint8(state.offset++))
      case 0xda: {
        const len = view.getUint16(state.offset, false)
        state.offset += 2
        return this.decodeString(view, state, len)
      }
      case 0xdb: {
        const len = view.getUint32(state.offset, false)
        state.offset += 4
        return this.decodeString(view, state, len)
      }

      // Array
      case 0xdc: {
        const len = view.getUint16(state.offset, false)
        state.offset += 2
        return this.decodeArray(view, state, len)
      }
      case 0xdd: {
        const len = view.getUint32(state.offset, false)
        state.offset += 4
        return this.decodeArray(view, state, len)
      }

      // Map
      case 0xde: {
        const len = view.getUint16(state.offset, false)
        state.offset += 2
        return this.decodeMap(view, state, len)
      }
      case 0xdf: {
        const len = view.getUint32(state.offset, false)
        state.offset += 4
        return this.decodeMap(view, state, len)
      }

      default:
        throw new Error(`Unknown MessagePack type: 0x${byte.toString(16)}`)
    }
  }

  decodeString(view, state, len) {
    const bytes = new Uint8Array(view.buffer, state.offset, len)
    state.offset += len
    return { value: new TextDecoder().decode(bytes) }
  }

  decodeArray(view, state, len) {
    const arr = []
    for (let i = 0; i < len; i++) {
      arr.push(this.decodeValue(view, state).value)
    }
    return { value: arr }
  }

  decodeMap(view, state, len) {
    const obj = {}
    for (let i = 0; i < len; i++) {
      const key = this.decodeValue(view, state).value
      const value = this.decodeValue(view, state).value
      obj[key] = value
    }
    return { value: obj }
  }

  decodeBinary(view, state, len) {
    const bytes = new Uint8Array(view.buffer, state.offset, len)
    state.offset += len
    return { value: bytes.slice() }
  }
}

/**
 * Singleton codec instance
 */
const msgpackCodec = new MessagePackCodec()

/**
 * Detect message format
 */
export function detectFormat(data) {
  if (typeof data === 'string') {
    return MESSAGE_FORMAT.JSON
  }
  
  if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
    return MESSAGE_FORMAT.MSGPACK
  }
  
  if (data instanceof Blob) {
    return MESSAGE_FORMAT.MSGPACK
  }
  
  return MESSAGE_FORMAT.JSON
}

/**
 * Encode message
 */
export function encode(data, format = MESSAGE_FORMAT.AUTO) {
  if (format === MESSAGE_FORMAT.AUTO) {
    format = MESSAGE_FORMAT.MSGPACK
  }
  
  if (format === MESSAGE_FORMAT.JSON) {
    return JSON.stringify(data)
  }
  
  return msgpackCodec.encode(data)
}

/**
 * Decode message
 */
export function decode(data, format = MESSAGE_FORMAT.AUTO) {
  if (format === MESSAGE_FORMAT.AUTO) {
    format = detectFormat(data)
  }
  
  if (format === MESSAGE_FORMAT.JSON) {
    return typeof data === 'string' ? JSON.parse(data) : JSON.parse(new TextDecoder().decode(data))
  }
  
  if (data instanceof ArrayBuffer) {
    return msgpackCodec.decode(new Uint8Array(data))
  }
  
  if (data instanceof Uint8Array) {
    return msgpackCodec.decode(data)
  }
  
  throw new Error('Unsupported data type for decoding')
}

/**
 * Benchmark payload size reduction
 */
export function benchmark(data, iterations = 100) {
  const jsonStr = JSON.stringify(data)
  const jsonSize = new TextEncoder().encode(jsonStr).length
  
  const msgpackData = encode(data, MESSAGE_FORMAT.MSGPACK)
  const msgpackSize = msgpackData.length
  
  const reduction = ((jsonSize - msgpackSize) / jsonSize * 100).toFixed(2)
  
  // Benchmark encoding speed
  const jsonStart = performance.now()
  for (let i = 0; i < iterations; i++) {
    JSON.stringify(data)
  }
  const jsonEncodeTime = performance.now() - jsonStart
  
  const msgpackStart = performance.now()
  for (let i = 0; i < iterations; i++) {
    encode(data, MESSAGE_FORMAT.MSGPACK)
  }
  const msgpackEncodeTime = performance.now() - msgpackStart
  
  // Benchmark decoding speed
  const jsonDecodeStart = performance.now()
  for (let i = 0; i < iterations; i++) {
    JSON.parse(jsonStr)
  }
  const jsonDecodeTime = performance.now() - jsonDecodeStart
  
  const msgpackDecodeStart = performance.now()
  for (let i = 0; i < iterations; i++) {
    decode(msgpackData, MESSAGE_FORMAT.MSGPACK)
  }
  const msgpackDecodeTime = performance.now() - msgpackDecodeStart
  
  return {
    jsonSize,
    msgpackSize,
    reduction: `${reduction}%`,
    jsonEncodeTime: `${jsonEncodeTime.toFixed(2)}ms`,
    msgpackEncodeTime: `${msgpackEncodeTime.toFixed(2)}ms`,
    jsonDecodeTime: `${jsonDecodeTime.toFixed(2)}ms`,
    msgpackDecodeTime: `${msgpackDecodeTime.toFixed(2)}ms`,
    iterations,
  }
}

/**
 * Transport wrapper for WebSocket
 */
export class BinaryTransport {
  constructor(options = {}) {
    this.format = options.format || MESSAGE_FORMAT.AUTO
    this.preferBinary = options.preferBinary !== false
  }

  /**
   * Encode message for sending
   */
  encodeMessage(message) {
    if (this.preferBinary) {
      return encode(message, MESSAGE_FORMAT.MSGPACK)
    }
    return encode(message, MESSAGE_FORMAT.JSON)
  }

  /**
   * Decode received message
   */
  decodeMessage(data) {
    return decode(data, this.format)
  }

  /**
   * Get WebSocket binary type
   */
  getBinaryType() {
    return this.preferBinary ? 'arraybuffer' : 'blob'
  }
}

export default {
  MESSAGE_FORMAT,
  encode,
  decode,
  detectFormat,
  benchmark,
  BinaryTransport,
  MessagePackCodec,
}

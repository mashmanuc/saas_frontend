import { describe, it, expect } from 'vitest'
import {
  MESSAGE_FORMAT,
  encode,
  decode,
  detectFormat,
  benchmark,
  BinaryTransport,
} from '../../src/core/realtime/transport'

describe('Realtime Transport', () => {
  describe('MESSAGE_FORMAT', () => {
    it('has format types', () => {
      expect(MESSAGE_FORMAT.JSON).toBe('json')
      expect(MESSAGE_FORMAT.MSGPACK).toBe('msgpack')
      expect(MESSAGE_FORMAT.AUTO).toBe('auto')
    })
  })

  describe('detectFormat', () => {
    it('detects JSON for strings', () => {
      expect(detectFormat('{"test": 1}')).toBe(MESSAGE_FORMAT.JSON)
    })

    it('detects MSGPACK for ArrayBuffer', () => {
      expect(detectFormat(new ArrayBuffer(10))).toBe(MESSAGE_FORMAT.MSGPACK)
    })

    it('detects MSGPACK for Uint8Array', () => {
      expect(detectFormat(new Uint8Array(10))).toBe(MESSAGE_FORMAT.MSGPACK)
    })
  })

  describe('encode/decode JSON', () => {
    it('encodes and decodes simple object', () => {
      const data = { name: 'test', value: 123 }
      const encoded = encode(data, MESSAGE_FORMAT.JSON)
      const decoded = decode(encoded, MESSAGE_FORMAT.JSON)
      
      expect(decoded).toEqual(data)
    })

    it('encodes and decodes array', () => {
      const data = [1, 2, 3, 'test']
      const encoded = encode(data, MESSAGE_FORMAT.JSON)
      const decoded = decode(encoded, MESSAGE_FORMAT.JSON)
      
      expect(decoded).toEqual(data)
    })
  })

  describe('encode/decode MessagePack', () => {
    it('encodes and decodes null', () => {
      const encoded = encode(null, MESSAGE_FORMAT.MSGPACK)
      const decoded = decode(encoded, MESSAGE_FORMAT.MSGPACK)
      
      expect(decoded).toBeNull()
    })

    it('encodes and decodes boolean', () => {
      expect(decode(encode(true, MESSAGE_FORMAT.MSGPACK), MESSAGE_FORMAT.MSGPACK)).toBe(true)
      expect(decode(encode(false, MESSAGE_FORMAT.MSGPACK), MESSAGE_FORMAT.MSGPACK)).toBe(false)
    })

    it('encodes and decodes positive integers', () => {
      expect(decode(encode(0, MESSAGE_FORMAT.MSGPACK), MESSAGE_FORMAT.MSGPACK)).toBe(0)
      expect(decode(encode(127, MESSAGE_FORMAT.MSGPACK), MESSAGE_FORMAT.MSGPACK)).toBe(127)
      expect(decode(encode(255, MESSAGE_FORMAT.MSGPACK), MESSAGE_FORMAT.MSGPACK)).toBe(255)
      expect(decode(encode(65535, MESSAGE_FORMAT.MSGPACK), MESSAGE_FORMAT.MSGPACK)).toBe(65535)
    })

    it('encodes and decodes negative integers', () => {
      expect(decode(encode(-1, MESSAGE_FORMAT.MSGPACK), MESSAGE_FORMAT.MSGPACK)).toBe(-1)
      expect(decode(encode(-32, MESSAGE_FORMAT.MSGPACK), MESSAGE_FORMAT.MSGPACK)).toBe(-32)
      expect(decode(encode(-128, MESSAGE_FORMAT.MSGPACK), MESSAGE_FORMAT.MSGPACK)).toBe(-128)
    })

    it('encodes and decodes floats', () => {
      const value = 3.14159
      const decoded = decode(encode(value, MESSAGE_FORMAT.MSGPACK), MESSAGE_FORMAT.MSGPACK)
      expect(decoded).toBeCloseTo(value, 5)
    })

    it('encodes and decodes strings', () => {
      expect(decode(encode('hello', MESSAGE_FORMAT.MSGPACK), MESSAGE_FORMAT.MSGPACK)).toBe('hello')
      expect(decode(encode('', MESSAGE_FORMAT.MSGPACK), MESSAGE_FORMAT.MSGPACK)).toBe('')
      
      const longString = 'a'.repeat(1000)
      expect(decode(encode(longString, MESSAGE_FORMAT.MSGPACK), MESSAGE_FORMAT.MSGPACK)).toBe(longString)
    })

    it('encodes and decodes arrays', () => {
      const data = [1, 2, 3, 'test', true, null]
      const decoded = decode(encode(data, MESSAGE_FORMAT.MSGPACK), MESSAGE_FORMAT.MSGPACK)
      
      expect(decoded).toEqual(data)
    })

    it('encodes and decodes objects', () => {
      const data = {
        name: 'test',
        value: 123,
        nested: { a: 1, b: 2 },
        array: [1, 2, 3],
      }
      const decoded = decode(encode(data, MESSAGE_FORMAT.MSGPACK), MESSAGE_FORMAT.MSGPACK)
      
      expect(decoded).toEqual(data)
    })

    it('encodes and decodes complex nested structure', () => {
      const data = {
        users: [
          { id: 1, name: 'Alice', active: true },
          { id: 2, name: 'Bob', active: false },
        ],
        metadata: {
          total: 2,
          page: 1,
        },
      }
      const decoded = decode(encode(data, MESSAGE_FORMAT.MSGPACK), MESSAGE_FORMAT.MSGPACK)
      
      expect(decoded).toEqual(data)
    })
  })

  describe('benchmark', () => {
    it('returns benchmark results', () => {
      const data = {
        type: 'message',
        payload: { text: 'Hello world', timestamp: Date.now() },
      }
      
      const result = benchmark(data, 10)
      
      expect(result.jsonSize).toBeGreaterThan(0)
      expect(result.msgpackSize).toBeGreaterThan(0)
      expect(result.reduction).toMatch(/%$/)
      expect(result.iterations).toBe(10)
    })

    it('shows size reduction for typical message', () => {
      const data = {
        channel: 'chat',
        event: 'message',
        payload: {
          id: 12345,
          text: 'Hello, this is a test message',
          userId: 'user-123',
          timestamp: Date.now(),
        },
      }
      
      const result = benchmark(data, 1)
      
      // MessagePack should be smaller
      expect(result.msgpackSize).toBeLessThanOrEqual(result.jsonSize)
    })
  })

  describe('BinaryTransport', () => {
    it('creates transport with default options', () => {
      const transport = new BinaryTransport()
      
      expect(transport.preferBinary).toBe(true)
      expect(transport.getBinaryType()).toBe('arraybuffer')
    })

    it('creates transport with JSON preference', () => {
      const transport = new BinaryTransport({ preferBinary: false })
      
      expect(transport.preferBinary).toBe(false)
      expect(transport.getBinaryType()).toBe('blob')
    })

    it('encodes message as binary', () => {
      const transport = new BinaryTransport()
      const message = { type: 'test', data: 123 }
      
      const encoded = transport.encodeMessage(message)
      
      expect(encoded instanceof Uint8Array).toBe(true)
    })

    it('encodes message as JSON when preferBinary is false', () => {
      const transport = new BinaryTransport({ preferBinary: false })
      const message = { type: 'test', data: 123 }
      
      const encoded = transport.encodeMessage(message)
      
      expect(typeof encoded).toBe('string')
    })

    it('decodes binary message', () => {
      const transport = new BinaryTransport()
      const message = { type: 'test', data: 123 }
      
      const encoded = transport.encodeMessage(message)
      const decoded = transport.decodeMessage(encoded)
      
      expect(decoded).toEqual(message)
    })
  })
})

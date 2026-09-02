import { describe, it, expect } from 'vitest'
import { derivePair } from '../remote/remotePair'

describe('remotePair.derivePair — стабільний код дошки', () => {
  it('останні 6 символів id без дефісів; той самий id → той самий код', () => {
    const id = '4ba7fff3-9452-4c42-9ff9-04415ff25d90'
    expect(derivePair(id)).toBe('f25d90')
    expect(derivePair(id)).toBe(derivePair(id))
  })

  it('різні дошки → різні коди', () => {
    expect(derivePair('4ba7fff3-9452-4c42-9ff9-04415ff25d90'))
      .not.toBe(derivePair('e16e5e94-8a17-4867-a016-34d321604245'))
  })

  it('порожній id → безпечний плейсхолдер, не виняток', () => {
    expect(derivePair('')).toBe('000000')
    expect(derivePair(undefined as unknown as string)).toBe('000000')
  })

  it('не довший за REMOTE_PAIR_MAX_LEN бекенду (16)', () => {
    expect(derivePair('x'.repeat(100)).length).toBeLessThanOrEqual(16)
  })
})

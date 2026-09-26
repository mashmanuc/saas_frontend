/**
 * Збирач помилок фронту: пристрій, ОС, браузер і версія збірки в кожному записі.
 *
 * До 2026-09-26 на проді: Android записувався як «Linux» (першим перевірявся
 * `navigator.platform` = «Linux armv8l»), iPad — як «macOS», Edge і Samsung — як
 * «Chrome», а версія збірки губилась (`appVersion` замість `app_version`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../api/diagnostics', () => ({ diagnosticsApi: { queueError: vi.fn(), flush: vi.fn() } }))

import { diagnosticsApi } from '../api/diagnostics'
import { createErrorCollector, getBrowserInfo, getDeviceKind, getPlatform } from '../plugins/errorCollector'

const UA = {
  pixel: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipadAsMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
  win: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
}

describe('getPlatform', () => {
  it('Android — це Android, хоч navigator.platform каже «Linux armv8l»', () => {
    expect(getPlatform(UA.pixel, 'Linux armv8l', 5)).toBe('Android')
  })
  it('iPhone — iOS', () => {
    expect(getPlatform(UA.iphone, 'iPhone', 5)).toBe('iOS')
  })
  it('iPad, що представляється як Mac, розпізнається за сенсором', () => {
    expect(getPlatform(UA.ipadAsMac, 'MacIntel', 5)).toBe('iPadOS')
    expect(getPlatform(UA.ipadAsMac, 'MacIntel', 0)).toBe('macOS')
  })
  it('Windows', () => {
    expect(getPlatform(UA.win, 'Win32', 0)).toBe('Windows')
  })
})

describe('getBrowserInfo', () => {
  it.each([
    [UA.edge, 'Edge 128'],
    [UA.samsung, 'Samsung Internet 25'],
    [UA.pixel, 'Chrome 153'],
    [UA.iphone, 'Safari 17'],
    [UA.win, 'Chrome 152'],
  ])('%s → %s', (ua, expected) => {
    expect(getBrowserInfo(ua)).toBe(expected)
  })
})

describe('getDeviceKind', () => {
  it.each([
    [UA.pixel, 0, 'phone'],
    [UA.iphone, 5, 'phone'],
    [UA.androidTablet, 5, 'tablet'],
    [UA.ipadAsMac, 5, 'tablet'],
    [UA.win, 0, 'computer'],
  ])('%s', (ua, touch, expected) => {
    expect(getDeviceKind(ua as string, touch as number)).toBe(expected)
  })
})

describe('запис помилки', () => {
  beforeEach(() => {
    vi.mocked(diagnosticsApi.queueError).mockClear()
    vi.mocked(diagnosticsApi.flush).mockClear()
  })

  it('версія збірки йде під іменем, яке чекає бекенд, і є пристрій та екран', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const collector = createErrorCollector({ mode: 'console+remote' })
    collector.handleError('error', 'boom')

    const payload = vi.mocked(diagnosticsApi.queueError).mock.calls[0][0] as Record<string, any>
    expect(payload).toHaveProperty('app_version')
    expect(payload).not.toHaveProperty('appVersion')
    expect(payload.context.client).toMatchObject({ kind: expect.any(String), viewport: expect.stringMatching(/^\d+x\d+$/) })
    expect(payload.context.client.ua).toBe(navigator.userAgent.slice(0, 400))
  })

  it('помилка йде на бекенд одразу, попередження — пачкою за таймером', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Час останнього негайного відправлення живе на рівні модуля — беремо момент
    // гарантовано пізніший за будь-який попередній тест.
    const later = Date.now() + 1_000_000_000
    vi.spyOn(Date, 'now').mockReturnValue(later)
    const collector = createErrorCollector({ mode: 'console+remote' })

    collector.handleError('warning', 'шум')
    expect(diagnosticsApi.flush).not.toHaveBeenCalled()
    collector.handleError('error', 'краш')
    expect(diagnosticsApi.flush).toHaveBeenCalledTimes(1)
    collector.handleError('error', 'ще краш у ту ж секунду')
    expect(diagnosticsApi.flush).toHaveBeenCalledTimes(1)
    vi.mocked(Date.now).mockRestore()
  })

  it('ім\'я компонента з <script setup> (__name) доходить у звіт', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const collector = createErrorCollector({ mode: 'console+remote' })
    const app = { config: {} as any, version: '3', use: vi.fn() } as any
    app.config.globalProperties = {}
    collector.install(app)
    app.config.errorHandler(new Error('boom'), { $options: { __name: 'WBCanvas' } }, 'render')

    const calls = vi.mocked(diagnosticsApi.queueError).mock.calls
    const payload = calls[calls.length - 1][0] as Record<string, any>
    expect(payload.context.vue_component).toBe('WBCanvas')
  })
})

// Б-58 (2026-09-27): вбудований браузер застосунку — за явними ознаками user agent.
// Google блокує в таких браузерах вхід через Google (`403 disallowed_useragent`).

import { describe, expect, it } from 'vitest'
import { chromeIntentUrl, isAndroid, isEmbeddedBrowser } from '../embeddedBrowser'

const EMBEDDED = {
  // Вбудований браузер Telegram на Android (aqtronix, 2026)
  telegramAndroid: 'Mozilla/5.0 (Linux; Android 10; K) Telegram-Android/11.7.3 (Samsung SM-A750F; Android 10; SDK 29; LOW)',
  androidWebView: 'Mozilla/5.0 (Linux; Android 13; SM-S911B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/116.0.0.0 Mobile Safari/537.36',
  instagramIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 305.0.0.20.110 (iPhone14,2; iOS 17_0; uk_UA; uk; scale=3.00; 1170x2532; 527421046)',
  facebookIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/437.0.0.30.109;FBBV/555;FBDV/iPhone14,2;FBMD/iPhone;FBSN/iOS;FBSV/17.0;FBSS/3;FBID/phone;FBLC/uk_UA;FBOP/5]',
  lineAndroid: 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36 Line/13.21.0',
}

const REAL_BROWSERS = {
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  safariIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  chromeIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/118.0.5993.92 Mobile/15E148 Safari/604.1',
  samsungInternet: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36',
  desktopChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  pipelineTool: 'Mozilla/5.0 (X11; Linux x86_64) Pipeline/2.0',   // «line/» усередині слова — не Line
}

describe('Б-58 · вбудований браузер застосунку', () => {
  it.each(Object.entries(EMBEDDED))('%s — вбудований', (_name, ua) => {
    expect(isEmbeddedBrowser(ua)).toBe(true)
  })

  it.each(Object.entries(REAL_BROWSERS))('%s — справжній браузер, підказки нема', (_name, ua) => {
    expect(isEmbeddedBrowser(ua)).toBe(false)
  })

  it('Android розпізнається для кнопки «Відкрити в Chrome»', () => {
    expect(isAndroid(EMBEDDED.telegramAndroid)).toBe(true)
    expect(isAndroid(EMBEDDED.instagramIos)).toBe(false)
  })

  it('intent веде на ту саму адресу в Chrome, без Chrome — на неї ж у браузері за замовчуванням', () => {
    expect(chromeIntentUrl('https://m4sh.org/start?utm_source=tg')).toBe(
      'intent://m4sh.org/start?utm_source=tg#Intent;scheme=https;package=com.android.chrome;'
      + 'S.browser_fallback_url=https%3A%2F%2Fm4sh.org%2Fstart%3Futm_source%3Dtg;end')
  })
})

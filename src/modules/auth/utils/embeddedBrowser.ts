/**
 * Б-58 (2026-09-27): вбудований браузер застосунку (Telegram, Instagram, Facebook…).
 *
 * Google свідомо блокує в них вхід через Google (`403 disallowed_useragent`; для
 * вбудованих WebView — з 2021-09-30): кнопка або мовчить, або веде на сторінку помилки
 * Google без дороги назад. Реклама йде в Telegram, і людина відкриває `m4sh.org/start`
 * саме у вбудованому браузері, тож їй треба пояснити, що робити, до натискання.
 *
 * Лише явні ознаки, без евристик «схоже на WebView»: хибне спрацювання показало б зайву
 * підказку (кнопку Google ми не ховаємо), але вгадувати не будемо.
 *  - маркери застосунків у user agent: Telegram (`Telegram-Android/…`), Facebook і
 *    Messenger (`FBAN`, `FBAV`, `FB_IAB`), Instagram, Line, WeChat (`MicroMessenger`),
 *    TikTok (`musical_ly`, `BytedanceWebview`);
 *  - стандартна позначка Android WebView `; wv)` — її ставить сам WebView, а Chrome
 *    Custom Tabs (дозволені Google) — ні.
 */
const APP_MARKERS = /Telegram|FBAN|FBAV|FB_IAB|Instagram|\bLine\/|MicroMessenger|musical_ly|BytedanceWebview/i
const ANDROID_WEBVIEW = /Android[^)]*; wv\)/

export function isEmbeddedBrowser(userAgent: string): boolean {
  return APP_MARKERS.test(userAgent) || ANDROID_WEBVIEW.test(userAgent)
}

export function isAndroid(userAgent: string): boolean {
  return /Android/i.test(userAgent)
}

/**
 * Посилання «відкрити цю сторінку в Chrome» для Android (intent). Немає Chrome — Android
 * відкриє `S.browser_fallback_url`, тобто ту саму адресу у браузері за замовчуванням.
 */
export function chromeIntentUrl(href: string): string {
  const url = new URL(href)
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.replace(':', '')};`
    + `package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`
}

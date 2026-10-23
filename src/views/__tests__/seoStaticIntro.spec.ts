/**
 * Що вміє M4SH — для пошуковиків і ШІ-помічників (власник 2026-10-24). Gemini на питання «які мінуси m4sh.org»
 * вигадав «немає розкладу, домашки, потрібен Zoom»: без запуску програми сайт віддавав лише назву й два речення
 * опису. Тепер у самій сторінці — перелік можливостей (звичайним текстом і структурованими даними), людям у
 * браузері цей текст не показується; карта сайту без каталогу репетиторів, якого немає з червня.
 */
import { describe, it, expect } from 'vitest'
import indexHtml from '../../../index.html?raw'
import sitemap from '../../../public/sitemap.xml?raw'
import robots from '../../../public/robots.txt?raw'

const FEATURES = [
  'PDF і підручники гортаються прямо на дошці',
  'Пульт з телефона',
  'Сценарій уроку',
  'Інтегралик',
  'Конструктор уроків',
  'Дошка для уроку',
  'Запис уроку, коли він потрібен',
  'Розклад',
]

describe('сторінка для пошуковиків і ШІ', () => {
  it('перелік можливостей — у самій сторінці, всередині #app (програма замінює його при запуску)', () => {
    const app = indexHtml.slice(indexHtml.indexOf('<div id="app">'), indexHtml.indexOf('<script type="module"'))
    expect(app).toContain('<main class="seo-intro" lang="uk">')
    expect([...app.matchAll(/<h2>([^<]+)<\/h2>/g)].map((m) => m[1])).toEqual(FEATURES)
  })

  it('людям у браузері блок не показується: прапорець js ставиться до малювання сторінки', () => {
    const head = indexHtml.slice(0, indexHtml.indexOf('</head>'))
    expect(head).toContain("<script>document.documentElement.classList.add('js')</script>")
    expect(head).toContain('.js .seo-intro{display:none}')
  })

  it('структуровані дані — той самий перелік, українською', () => {
    const raw = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]
    const ld = JSON.parse(raw)
    expect([ld['@type'], ld.inLanguage, ld.url]).toEqual(['SoftwareApplication', 'uk', 'https://m4sh.org/'])
    expect(ld.featureList.map((f: string) => f.split('. ')[0])).toEqual(FEATURES)
  })

  it('опис сторінки згадує PDF на дошці, пульт і Інтегралика; запис — чесно, «коли він потрібен»', () => {
    const desc = indexHtml.match(/<meta name="description" content="([^"]*)"/)![1]
    for (const word of ['PDF', 'пульт з телефона', 'Інтегралик', 'коли він потрібен']) expect(desc).toContain(word)
  })

  it('карта сайту й правила: без каталогу репетиторів, з лендінгом /start', () => {
    expect(sitemap).not.toMatch(/<loc>[^<]*marketplace/)
    expect(sitemap).toContain('<loc>https://m4sh.org/start</loc>')
    expect(robots).not.toMatch(/^Allow: \/marketplace/m)
    expect(robots).toMatch(/^Allow: \/start$/m)
  })
})

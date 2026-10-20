/**
 * «Наочна сцена» (`math_scene`, власник 2026-10-20: «одну річ замість сімнадцяти»; «А як будемо тоді з мовою
 * англійську, теж туди поставимо? Якщо так, то роби. І поки будемо включати його для ID40»).
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'
import { MATH_SCENE_IDS, mathSceneSrc, mathSceneLang } from '../types/mathScene'
import { buildMathSceneAsset, DEFAULT_MATH_SCENE_W, DEFAULT_MATH_SCENE_H } from '../constants/mathSceneDefaults'
import { allInserts, MASH_APPS, visibleApps, visibleInserts } from '../components/sidebar/insertRegistry'

const look = ref<'integralyk' | 'integralka'>('integralyk')
vi.mock('@/modules/intent/assistantLook', () => ({ useAssistantLook: () => ({ look }) }))

const ROOT = resolve(__dirname, '../../../..')
const PUBLIC = resolve(ROOT, 'public/scenes')

describe('адреса сцени — мова сайту й вигляд помічника', () => {
  it('англійський сайт — англійська сцена; український і російський — українська', () => {
    expect(mathSceneLang('en')).toBe('en')
    expect(mathSceneLang('uk')).toBe('uk')
    expect(mathSceneLang('ru')).toBe('uk')
    expect(mathSceneSrc('percent', 'en', 'integralka')).toBe('/scenes/en/percent.html?look=integralka')
    expect(mathSceneSrc('percent', 'uk', 'integralyk')).toBe('/scenes/uk/percent.html?look=integralyk')
  })

  it('невідома сцена — жодної адреси (картка каже «сцени немає», а не порожнє вікно)', () => {
    expect(mathSceneSrc('../../evil', 'uk', 'integralyk')).toBeNull()
    expect(mathSceneSrc(undefined, 'uk', 'integralyk')).toBeNull()
  })

  it('новий асет: тип, розмір, дані — лише sceneId', () => {
    const a = buildMathSceneAsset({ x: 960, y: 540 }, 'pythagoras', 'm1')
    expect(a).toMatchObject({ id: 'm1', type: 'math_scene', src: '', w: DEFAULT_MATH_SCENE_W, h: DEFAULT_MATH_SCENE_H,
      data: { version: 1, sceneId: 'pythagoras' } })
    expect(a.x).toBe(960 - DEFAULT_MATH_SCENE_W / 2)
  })
})

describe('«Інструменти» — лише пілоту math_scenes', () => {
  it('без пілота немає ні картки, ні плиток; з пілотом — картка й 16 плиток', () => {
    expect(visibleApps({ evidence: true }).some(a => a.app === 'scenes')).toBe(false)
    expect(visibleInserts({ evidence: true }).some(e => e.family === 'scenes')).toBe(false)
    expect(visibleApps({ evidence: false, scenes: true }).some(a => a.app === 'scenes')).toBe(true)
    const tiles = visibleInserts({ evidence: false, scenes: true }).filter(e => e.family === 'scenes')
    expect(tiles.map(e => JSON.parse(e.payload).sceneId)).toEqual([...MATH_SCENE_IDS])
  })

  it('Інтегралик сцен не бачить і не вставляє — його перелік інструментів такий, як до сцен', async () => {
    const { buildToolCatalog, runBoardAction, KIND_LABELS } = await import('@/modules/intent/boardActions')
    const tools = await buildToolCatalog()
    expect(tools.some((t: { id: string }) => t.id.startsWith('scenes.'))).toBe(false)
    await expect(runBoardAction({ kind: 'add_tool', payload: { insert_id: 'scenes.pythagoras' } }))
      .rejects.toThrow('Такого інструмента поки немає на дошці.')
    expect(KIND_LABELS.math_scene).toBe('наочна сцена')
  })

  it('картка й плитки мають назви трьома мовами', () => {
    const app = MASH_APPS.find(a => a.app === 'scenes')!
    for (const loc of [uk, en, ru] as unknown as { winterboard: Record<string, any> }[]) {
      expect(loc.winterboard.contentSidebar.apps.scenes).toBeTruthy()
      for (const id of MATH_SCENE_IDS) expect(loc.winterboard.mathScene.scenes[id], id).toBeTruthy()
    }
    expect(app.labelKey).toBe('winterboard.contentSidebar.apps.scenes')
    for (const e of allInserts().filter(x => x.family === 'scenes')) {
      expect(e.labelKey).toMatch(/^winterboard\.mathScene\.scenes\./)
    }
  })
})

describe('файли сцен — обидві мови, без чужих серверів', () => {
  it('для кожної сцени є uk і en; в англійській — жодної кириличної літери', () => {
    for (const id of MATH_SCENE_IDS) {
      const ukHtml = readFileSync(resolve(PUBLIC, 'uk', `${id}.html`), 'utf8')
      const enHtml = readFileSync(resolve(PUBLIC, 'en', `${id}.html`), 'utf8')
      expect(ukHtml).toContain('<html lang="uk"')
      expect(enHtml).toContain('<html lang="en"')
      expect(enHtml, id).not.toMatch(/[А-Яа-яІіЇїЄєҐґ]/)
    }
    expect(readFileSync(resolve(PUBLIC, 'en', 'vectors.js'), 'utf8')).not.toMatch(/[А-Яа-яІіЇїЄєҐґ]/)
  })

  it('жодна сцена й спільний код не тягнуть нічого з інших сайтів (шрифти, скрипти)', () => {
    const files: string[] = []
    for (const dir of ['uk', 'en', 'shared', 'shared/vectors']) {
      for (const f of readdirSync(resolve(PUBLIC, dir))) {
        if (/\.(html|js|css)$/.test(f)) files.push(resolve(PUBLIC, dir, f))
      }
    }
    for (const f of files) {
      const text = readFileSync(f, 'utf8').replace(/http:\/\/www\.w3\.org\/[^"' ]*/g, '')
      expect(text, f).not.toMatch(/https?:\/\//)
    }
  })

  it('сайт дозволяє показувати у вікні лише /scenes/* (решта — DENY, як було)', () => {
    const headers = readFileSync(resolve(ROOT, 'public/_headers'), 'utf8')
    expect(headers).toMatch(/\/scenes\/\*\n {2}! X-Frame-Options\n {2}X-Frame-Options: SAMEORIGIN/)
    expect(headers).toMatch(/\/\*\n {2}X-Frame-Options: DENY/)
  })
})

describe('картка на дошці', () => {
  async function mountScene(sceneId: string, locale: 'uk' | 'en', interactive = true, isSelected = true) {
    const Renderer = (await import('../components/board/objects/MathSceneRenderer.vue')).default
    const i18n = createI18n({ legacy: false, locale, fallbackLocale: 'uk', messages: { uk, en } as never })
    const asset = { ...buildMathSceneAsset({ x: 0, y: 0 }, 'percent', 'm1'), data: { version: 1, sceneId } }
    return mount(Renderer, { props: { asset, interactive, isSelected } as never, global: { plugins: [i18n] } })
  }

  it('сцена мовою сайту, у пісочниці без доступу до сайту; живе лише виділена картка в режимі «Вибір»', async () => {
    look.value = 'integralka'
    const w = await mountScene('percent', 'en')
    const frame = w.get('[data-testid="math-scene-frame"]')
    expect(frame.attributes('src')).toBe('/scenes/en/percent.html?look=integralka')
    expect(frame.attributes('sandbox')).toBe('allow-scripts')
    expect(w.text()).toContain('Percent')
    expect(w.classes()).toContain('is-live')
    const still = await mountScene('percent', 'uk', false)
    expect(still.classes()).not.toContain('is-live')
    expect(still.text()).toContain('Відсотки')
    // невиділена під виділеною: її живе вікно з'їдало б клік, призначений картці зверху
    expect((await mountScene('percent', 'uk', true, false)).classes()).not.toContain('is-live')
    look.value = 'integralyk'
  })

  it('невідома сцена — «Цієї сцени немає», без вікна', async () => {
    const w = await mountScene('nope', 'uk')
    expect(w.find('[data-testid="math-scene-frame"]').exists()).toBe(false)
    expect(w.get('[data-testid="math-scene-missing"]').text()).toBe('Цієї сцени немає.')
  })
})

// ⚠️ Phase 2.5 — Board Action Registry: Інтегралик діє НА відкритій дошці.
//
// SYSTEM_LAW: НУЛЬ нових write-шляхів. Кожен виконавець кличе ті САМІ санкціоновані
// store-actions, що перо/тулбар/сайдбар (addStroke/addAsset = Command-pattern →
// ops emit через useReplayRecorder → /replay/batch/ single-writer). Undo/replay — з коробки.
//
// IPC-5: форми об'єктів — ДЗЕРКАЛО продуктових будівельників:
//   add_text    → WBCanvas.createTextAtPosition / templatePresets (WBStroke tool:'text')
//   add_formula → WBSoloRoom.handleFormulaSubmit (asset type:'formula_card')
//   add_graph   → useContentDrop GRAPH_CALCULATOR_MIME-гілка (asset type:'graph_calculator')
//
// Розширення: нова дія на дошці = +1 tool у BE tooling.py + 1 запис у HANDLERS тут.

function _uuid() {
  return (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// Каскад, щоб послідовні вставки не лягали одна на одну.
let _cascade = 0
function _center(page) {
  const n = (_cascade++ % 8)
  return {
    cx: Math.round((page.width ?? 1920) / 2 + n * 28),
    cy: Math.round((page.height ?? 1080) / 2 + n * 28),
  }
}

async function _store() {
  const { useWBStore } = await import('@/modules/winterboard/board/state/boardStore')
  const store = useWBStore()
  const page = store.currentPage
  if (!page) throw new Error('Дошка ще не завантажилась — спробуйте за мить.')
  return { store, page }
}

const HANDLERS = {
  // Дзеркало createTextAtPosition/templatePresets: текст = WBStroke tool:'text' → addStroke
  async add_text({ text }) {
    const { store, page } = await _store()
    const { cx, cy } = _center(page)
    store.addStroke({
      id: _uuid(),
      tool: 'text',
      color: '#1e293b',
      size: 22,
      opacity: 1,
      text,
      points: [{ x: cx - 160, y: cy - 16 }],
      width: 320,
      fontWeight: 400,
      fontStyle: 'normal',
      textAlign: 'left',
    })
  },

  // Дзеркало WBSoloRoom.handleFormulaSubmit (нова formula_card по центру)
  async add_formula({ latex }) {
    const { store, page } = await _store()
    const { cx, cy } = _center(page)
    store.addAsset({
      id: _uuid(),
      type: 'formula_card',
      src: '',
      x: cx - 190,
      y: cy - 55,
      w: 380,
      h: 110,
      rotation: 0,
      locked: false,
      data: { version: 1, formula: latex, fontSize: 22, color: '#1e293b', bg: '#f8fafc' },
    }, page.id ?? '')
  },

  // theory_card (TheoryCardRenderer): текст із $LaTeX$ рендериться KaTeX —
  // для розв'язків/пояснень (гарна картка замість голого текстового поля).
  async add_card({ title, body, badge }) {
    const { store, page } = await _store()
    const { cx, cy } = _center(page)
    store.addAsset({
      id: _uuid(),
      type: 'theory_card',
      src: '',
      x: cx - 260,
      y: cy - 190,
      w: 520,
      h: 380,
      rotation: 0,
      locked: false,
      // badge — підпис у шапці. BE дає «Розв'язок» за замовчуванням для цього
      // шляху: модель кладе сюди переважно розв'язки, а не теорію.
      data: { version: 1, badge: badge || '', title: title || '', body: body || '', formulas: [] },
    }, page.id ?? '')
  },

  // Дзеркало usePageManagement.addPage() → store.addPageUndoable() — та сама дія,
  // що й кнопка «+ Додати сторінку» в сайдбарі. Стелю (50) пильнує сам стор:
  // повертає '' при досягненні — тут просто чесно кажемо про це, а не мовчимо.
  async add_page({ name, card }) {
    const { store } = await _store()
    const newId = store.addPageUndoable({ name: name || undefined })
    if (!newId) throw new Error('Дошка вже має максимум сторінок (50) — більше додати не можу.')
    if (card && (card.title || card.body)) {
      const page = store.currentPage
      const { cx, cy } = _center(page)
      store.addAsset({
        id: _uuid(),
        type: 'theory_card',
        src: '',
        x: cx - 260,
        y: cy - 190,
        w: 520,
        h: 380,
        rotation: 0,
        locked: false,
        data: { version: 1, title: card.title || '', body: card.body || '', formulas: [] },
      }, page.id ?? '')
    }
  },

  // Дзеркало useContentDrop (graph_calculator) + вираз одразу в expressions
  // Крок 4 (2026-07-31): БУЛО — один вираз, `params:{}` хардкодом. Рушій
  // (GraphCalculatorState) від початку вміє масив кривих і слайдери; BE тепер
  // їх присилає (`expressions[]` + `params{}`), тож просто передаємо наскрізь.
  // Зворотна сумісність зі старим payload `{expression}` лишається — на випадок
  // старої вкладки FE проти нового BE (і навпаки: BE теж приймає обидва).
  async add_graph({ expressions, expression, params }) {
    const { store, page } = await _store()
    const { cx, cy } = _center(page)
    const W = 480; const H = 360
    // «y=sin(x)» → src «sin(x)» (голий вираз рендериться як y=f(x))
    const strip = (s) => String(s ?? '').replace(/^\s*y\s*=\s*/i, '').trim()

    const list = Array.isArray(expressions) && expressions.length
      ? expressions
      : (expression ? [{ src: expression }] : [])
    // Кольори по колу — щоб криві на одному полі візуально розрізнялись.
    const COLORS = ['#dc2626', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2']
    const built = list
      .map((e, i) => ({
        id: `e-${_uuid().slice(0, 8)}`,
        src: strip(typeof e === 'string' ? e : e?.src),
        color: COLORS[i % COLORS.length],
        hidden: false,
      }))
      .filter((e) => e.src)
    if (!built.length) throw new Error('Не зрозумів вираз функції.')

    const assetId = `gc-${_uuid()}`
    store.addAsset({
      id: assetId,
      type: 'graph_calculator',
      src: '',
      x: cx - W / 2,
      y: cy - H / 2,
      w: W,
      h: H,
      rotation: 0,
      locked: false,
      data: {
        version: 1,
        state: {
          expressions: built,
          // BE вже провалідував діапазони (min<max, step>0, ім'я по регексу).
          params: (params && typeof params === 'object') ? params : {},
          viewport: { cx: 0, cy: 0, scale: 38 },
        },
        meta: { last_snapshot_seq: 0 },
      },
    }, page.id ?? '')

    // Підсвітка: об'єкт з'явився не від кліку юзера, а від фрази — око його не
    // «веде», тож виділяємо, щоб було видно, ЩО саме додалось.
    // `selectItems` — офіційний selection-action стора (boardStore.ts:3644).
    // try/catch — підсвітка не варта того, щоб через неї впала сама вставка.
    try { store.selectItems?.([assetId]) } catch { /* підсвітка не критична */ }
  },
}

// ── Phase 2.7: вставка мат-інструментів за смислом (planimetry/trig/3d/…) ──
// Каталог = ЖИВИЙ insertRegistry (той самий, що сайдбар); Інтегралик обирає id,
// вставка йде через САНКЦІОНОВАНИЙ addAtPosition (міст-подія m4sh:wb-insert →
// WBSoloRoom) — нуль нових write-шляхів. Нова плитка в продукті = авто в каталозі.
// family → людський «вид» (щоб модель не плутала 2D-трикутник з 3D-тетраедром)
const FAMILY_KIND = {
  planimetry: 'планіметрія 2D',
  stereo: 'стереометрія 3D',
  '3d': 'стереометрія 3D',
  trig: 'тригонометрія',
  analysis: 'графік/аналіз',
  quadratic: 'квадратична',
  geomash: 'жива геометрія',
}

async function _allInserts() {
  // Примусово вантажимо geo2d-вендор → window.GEO_PRESETS (планіметрія), інакше на
  // свіжій дошці каталог без 2D-фігур і модель бере найближче 3D/триго (owner-баг).
  try { await import('@/modules/winterboard/vendor/geo2d') } catch { /* без планіметрії — не блокуємо */ }
  const mod = await import('@/modules/winterboard/components/sidebar/insertRegistry')
  return typeof mod.allInserts === 'function' ? mod.allInserts() : []
}

/** Компактний каталог доступних інструментів дошки для parse-контексту (id+label+desc). */
export async function buildToolCatalog() {
  const items = await _allInserts()
  return items.map((e) => {
    const kind = FAMILY_KIND[e.family] || ''
    const tail = [e.sublabel, ...(e.keywords || [])].filter(Boolean).join(' · ')
    return {
      id: e.id,
      label: e.labelFallback || e.id,
      desc: (kind ? `[${kind}] ` : '') + tail.slice(0, 90),
    }
  }).slice(0, 80)
}

// ── Phase 2.8: редагування параметра ІСНУЮЧОГО об'єкта (через updateAsset) ──
// BE резолвить object_id (Закон C), сюди приходить готовий id + що змінити.
HANDLERS.set_param = async function set_param({ object_id, type, value, name }) {
  const { store } = await _store()
  const page = store.currentPage
  const asset = (page.assets || []).find((a) => a.id === object_id)
  if (!asset) throw new Error('Не знайшов цей об’єкт на дошці.')
  const data = JSON.parse(JSON.stringify(asset.data || {}))
  if (type === 'graph_expression') {
    // Міняємо вираз ПЕРШОГО графіка (data.state.expressions[0].src)
    if (!data.state) data.state = { expressions: [], params: {}, viewport: { cx: 0, cy: 0, scale: 38 } }
    const src = String(value).replace(/^\s*y\s*=\s*/i, '').trim()
    if (data.state.expressions?.length) {
      data.state.expressions[0] = { ...data.state.expressions[0], src }
    } else {
      data.state.expressions = [{ id: `e-${_uuid().slice(0, 8)}`, src, color: '#dc2626', hidden: false }]
    }
  } else if (type === 'graph_param') {
    // Phase 1 Block B1 (2026-08-01): «зроби a=3» — точкова зміна ОДНОГО параметра.
    // Clamp у [min,max] — той самий інваріант, що в _clean_graph_params на BE.
    if (!data.state) data.state = { expressions: [], params: {}, viewport: { cx: 0, cy: 0, scale: 38 } }
    const paramKey = String(name)
    const cfg = data.state.params?.[paramKey]
    if (!cfg) throw new Error(`Параметра «${paramKey}» немає на цьому графіку — скажіть «побудуй ... з a», і я додам повзунок.`)
    const num = Number(value)
    if (!Number.isFinite(num)) throw new Error('Не зрозумів нове значення параметра.')
    data.state.params = {
      ...(data.state.params || {}),
      [paramKey]: { ...cfg, value: Math.min(Math.max(num, cfg.min), cfg.max) },
    }
  } else if (type === 'formula') {
    data.formula = String(value)
  } else {
    throw new Error('Цей тип зміни поки не підтримується.')  // fail-closed
  }
  store.updateAsset({ ...asset, data })
}

// Phase 2.9: маніпуляції об'єктами (move/resize/delete) — усе через санкц. store-actions.
async function _assetById(object_id) {
  const { store } = await _store()
  const page = store.currentPage
  const asset = (page.assets || []).find((a) => a.id === object_id)
  if (!asset) throw new Error('Не знайшов цей об’єкт на дошці.')
  return { store, asset }
}

HANDLERS.move_object = async function move_object({ object_id, dx, dy }) {
  const { store, asset } = await _assetById(object_id)
  store.updateAsset({ ...asset, x: (asset.x || 0) + (dx || 0), y: (asset.y || 0) + (dy || 0) })
}

HANDLERS.resize_object = async function resize_object({ object_id, factor }) {
  const { store, asset } = await _assetById(object_id)
  const k = Number(factor) || 1
  const w = Math.max(40, Math.round((asset.w || 200) * k))   // clamp min 40px (store min=20)
  const h = Math.max(40, Math.round((asset.h || 150) * k))
  store.updateAsset({ ...asset, w, h })
}

HANDLERS.delete_object = async function delete_object({ object_id }) {
  const { store } = await _assetById(object_id)   // валідує існування
  store.deleteAsset(object_id)                    // Command-pattern → undo працює
}

// ── Phase 1 Block B2 (2026-08-01): «домалюй дотичну» — ДОДАТИ криву в існуючий графік.
// Не замінити (це set_graph_expression): push у data.state.expressions. Стелю
// MAX_GRAPH_EXPRESSIONS=6 пильнуємо ТУТ (BE не бачить кількість кривих — рев'ю 2026-08-01).
const MAX_GRAPH_EXPRESSIONS = 6
const GRAPH_COLORS = ['#dc2626', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2']
HANDLERS.graph_add_expression = async function graph_add_expression({ object_id, src, label }) {
  const { store, asset } = await _assetById(object_id)
  if (asset.type !== 'graph_calculator') throw new Error('Це не графік — додати криву можна лише в графічний калькулятор.')
  const data = JSON.parse(JSON.stringify(asset.data || {}))
  if (!data.state) data.state = { expressions: [], params: {}, viewport: { cx: 0, cy: 0, scale: 38 } }
  const srcClean = String(src).replace(/^\s*y\s*=\s*/i, '').trim()
  if (!srcClean) throw new Error('Не зрозумів вираз нової кривої.')
  const exprs = data.state.expressions || []
  if (exprs.length >= MAX_GRAPH_EXPRESSIONS) {
    throw new Error(`Графік уже має ${MAX_GRAPH_EXPRESSIONS} кривих — більше на одному полі нечитабельно. Скажіть «заміни ... на ${srcClean}», і я оновлю одну з них.`)
  }
  data.state.expressions = [
    ...exprs,
    { id: `e-${_uuid().slice(0, 8)}`, src: srcClean, color: GRAPH_COLORS[exprs.length % GRAPH_COLORS.length], hidden: false, label: label || undefined },
  ]
  store.updateAsset({ ...asset, data })
}

// Phase 1 Block B3 (2026-08-01): перенос об'єкта на іншу сторінку.
// ОДИН compound WBCommand (вимога рев'ю №002, зразок reorderPages):
// apply() = delete з джерела + add на ціль, revert() = навпаки.
// Ctrl+Z вертає ЦІЛИЙ перенос — не два кроки, не частковий стан.
HANDLERS.move_object_to_page = async function move_object_to_page({ object_id, page }) {
  const { store } = await _store()
  const pageIndex = Number(page) - 1   // 1-based «друга сторінка» → індекс 1
  if (pageIndex < 0 || pageIndex >= (store.pages || []).length) {
    throw new Error('Сторінки з таким номером на дошці немає.')
  }
  // Знайти об'єкт по ВСІХ сторінках (джерело може бути не поточна).
  let sourcePage = null
  let asset = null
  for (const p of store.pages || []) {
    const a = (p.assets || []).find(x => x.id === object_id)
    if (a) { sourcePage = p; asset = a; break }
  }
  if (!sourcePage) throw new Error('Об\'єкта не знайдено на дошці.')
  const targetPage = store.pages[pageIndex]
  if (sourcePage.id === targetPage.id) return   // no-op (BE вже відсіяв)

  // compound WBCommand — ОДИН запис в undoStack.
  const cmd = {
    apply: () => {
      store.deleteAssetFromPage(sourcePage.id, object_id, { skipHistory: true })
      store.addAsset({ ...asset }, targetPage.id, { skipHistory: true })
    },
    revert: () => {
      store.deleteAssetFromPage(targetPage.id, object_id, { skipHistory: true })
      store.addAsset({ ...asset }, sourcePage.id, { skipHistory: true })
    },
  }
  cmd.apply()
  // trimStack за зразком інших store-дій (deleteAsset/addAsset).
  const MAX = 100
  const trim = (s) => s.length > MAX ? s.slice(s.length - MAX) : s
  store.undoStack = trim([...store.undoStack, cmd])
  store.redoStack = []
}


// Phase 2.11: геометричні побудови = toggles планіметрії (описане/вписане коло, медіани…)
HANDLERS.set_geometry = async function set_geometry({ object_id, feature, on }) {
  const { store, asset } = await _assetById(object_id)
  if (asset.type !== 'geometry_2d_v2') throw new Error('Це не геометрична фігура.')
  const toggles = { ...(asset.data?.toggles || {}), [feature]: on !== false }
  store.updateAsset({ ...asset, data: { ...asset.data, toggles } })
}

HANDLERS.add_tool = async function add_tool({ insert_id }) {
  const items = await _allInserts()
  const e = items.find((x) => x.id === insert_id)
  if (!e) throw new Error('Такого інструмента поки немає на дошці.')  // fail-closed
  // WBSoloRoom слухає й вставляє через addAtPosition (той самий шлях, що click-insert)
  window.dispatchEvent(new CustomEvent('m4sh:wb-insert', {
    detail: { mime: e.dragMime, payload: e.payload },
  }))
}

/** Виконати дію Інтегралика на дошці. Кидає Error з людським повідомленням. */
export async function runBoardAction(action) {
  const handler = HANDLERS[action?.kind]
  if (!handler) throw new Error('Ця дія на дошці ще не підтримується.')  // fail-closed
  await handler(action.payload || {})
}

// ── Phase 2.6 «зір»: read-only стан дошки → компактний summary для parse-контексту ──
// Тільки читання store (жодних мутацій); лише власна відкрита дошка тьютора.
const KIND_LABELS = {
  graph_calculator: 'графік',
  formula_card: 'формула',
  image: 'зображення',
  youtube: 'відео',
  geometry_solid: 'стереометрія',
  geometry_2d_v2: 'планіметрія',
  nmt_3d: '3D-сцена',
}

export async function buildBoardSummary() {
  const { useWBStore } = await import('@/modules/winterboard/board/state/boardStore')
  const store = useWBStore()
  const pages = store.pages || []
  const currentPage = (store.currentPageIndex ?? 0) + 1   // 1-based: сторінка, яку бачить юзер
  const items = []
  pages.forEach((page, idx) => {
    const p = idx + 1
    let penStrokes = 0
    for (const s of page.strokes || []) {
      if (s.tool === 'text' && (s.text || '').trim()) {
        items.push({ page: p, kind: 'текст', label: s.text.trim().slice(0, 120) })
      } else if (s.tool !== 'text') penStrokes++
    }
    if (penStrokes > 0) items.push({ page: p, kind: 'малюнок', label: `${penStrokes} штрихів` })
    for (const a of page.assets || []) {
      let label = ''
      let kind = KIND_LABELS[a.type] || a.type
      if (a.type === 'graph_calculator') {
        label = (a.data?.state?.expressions || []).map((e) => e.src).filter(Boolean).join(' ; ')
      } else if (a.type === 'formula_card') {
        label = a.data?.formula || ''
      } else if (a.type === 'theory_card') {
        kind = 'картка'
        label = a.data?.title || String(a.data?.body || '').slice(0, 80)
      } else if (a.type === 'geometry_2d_v2') {
        // Назва пресета (Трикутник/Коло…) — щоб Інтегралик міг адресувати планіметрію
        kind = 'планіметрія'
        const preset = a.data?.preset
        const meta = (typeof window !== 'undefined' ? window.GEO_PRESETS : null) || []
        label = (meta.find((m) => m.type === preset)?.full) || preset || 'фігура'
      } else if (a.type === 'nmt_task') {
        // Умова задачі (data.question, LaTeX/HTML → плоский текст) + відповідь:
        // Інтегралик може РОЗВ'ЯЗУВАТИ задачі з дошки. Контент тьютора, не PII учнів.
        kind = 'NMT-задача'
        const q = String(a.data?.question || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
        const ans = String(a.data?.correctAnswer || '').trim().slice(0, 40)
        label = q + (ans ? ` [відповідь: ${ans}]` : '')
      }
      // id — для Resolution об'єкта на BE (Phase 2.8 set_param). LLM його НЕ бачить
      // (у промпт іде лише kind+label; Закон C: навігацію робить Runtime, не модель).
      items.push({ page: p, kind, label: String(label).slice(0, 240), id: a.id })
    }
    for (const t of page.testObjects || []) {
      // Умова задачі (label, LaTeX/HTML → плоский текст) + відповідь: Інтегралик
      // може РОЗВ'ЯЗУВАТИ задачі з дошки. Це контент тьютора (не дані учнів).
      const cond = String(t.label || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
      const ans = String(t.correctAnswer || '').trim().slice(0, 40)
      items.push({ page: p, kind: 'NMT-задача', label: (cond + (ans ? ` [відповідь: ${ans}]` : '')).slice(0, 240) })
    }
  })
  return { pages: pages.length, currentPage, items: items.slice(0, 60) }
}

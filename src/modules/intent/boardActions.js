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
  async add_card({ title, body }) {
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
      data: { version: 1, title: title || '', body: body || '', formulas: [] },
    }, page.id ?? '')
  },

  // Дзеркало useContentDrop (graph_calculator) + вираз одразу в expressions
  async add_graph({ expression }) {
    const { store, page } = await _store()
    const { cx, cy } = _center(page)
    const W = 480; const H = 360
    // «y=sin(x)» → src «sin(x)» (голий вираз рендериться як y=f(x))
    const src = String(expression).replace(/^\s*y\s*=\s*/i, '').trim()
    store.addAsset({
      id: `gc-${_uuid()}`,
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
          expressions: [{ id: `e-${_uuid().slice(0, 8)}`, src, color: '#dc2626', hidden: false }],
          params: {},
          viewport: { cx: 0, cy: 0, scale: 38 },
        },
        meta: { last_snapshot_seq: 0 },
      },
    }, page.id ?? '')
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
      } else if (a.type === 'nmt_task') {
        // Умова задачі (data.question, LaTeX/HTML → плоский текст) + відповідь:
        // Інтегралик може РОЗВ'ЯЗУВАТИ задачі з дошки. Контент тьютора, не PII учнів.
        kind = 'NMT-задача'
        const q = String(a.data?.question || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
        const ans = String(a.data?.correctAnswer || '').trim().slice(0, 40)
        label = q + (ans ? ` [відповідь: ${ans}]` : '')
      }
      items.push({ page: p, kind, label: String(label).slice(0, 240) })
    }
    for (const t of page.testObjects || []) {
      // Умова задачі (label, LaTeX/HTML → плоский текст) + відповідь: Інтегралик
      // може РОЗВ'ЯЗУВАТИ задачі з дошки. Це контент тьютора (не дані учнів).
      const cond = String(t.label || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200)
      const ans = String(t.correctAnswer || '').trim().slice(0, 40)
      items.push({ page: p, kind: 'NMT-задача', label: (cond + (ans ? ` [відповідь: ${ans}]` : '')).slice(0, 240) })
    }
  })
  return { pages: pages.length, items: items.slice(0, 60) }
}

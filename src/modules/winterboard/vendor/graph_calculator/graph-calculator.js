// Graph Calculator — engine: parser, evaluator, canvas renderer
// Supports: y = f(x), x = f(y), implicit equations f(x,y) = g(x,y),
//           parameters with sliders (a = 1), points (2, 3),
//           bare expressions without '=' (x^2 → y = x^2; 2026-07-15, classify).
// Drawn on HTMLCanvas. Marching squares for implicit curves.
//
// Phase G (winterboard integration 2026-05-05):
// — ESM exports замість IIFE/window
// — Engine НЕ генерує expression IDs (per FE-RULE-3); store передає UUID externally.
//   addExpression(src, id) і addParameterFor(name, beforeId, value, id) — id REQUIRED.
// — destroy() також cancel-ить _animRaf (memory leak fix).
// — setState({expressions, params, viewport}) — full replace для props sync (FE-RULE-2).
// — getState() — повертає JSON-серіалізабельний snapshot для emit.
// — opts.disableAnimation: true — disable rAF animation loop у replay (inv-21.13).
// Per OPS_SYNC_SSOT.md INV-21 + FE Architecture Rules.
//
// LICENSE: внутрішнє використання у m4sh winterboard.

const __GC = (function () {
  // ---------- Parser: GraphMASH «CORE-ARITH v1» (adopted 2026-07) --------------
  // Замінює попередній vendored-парсер. ТІЛЬКИ tokenize+parse; evaluator/classify/
  // renderer/state нижче — БЕЗ ЗМІН. Профіль звужено до старого синтаксису:
  //   - AST: 7 вузлів (num/ident/unary/binop/call/tuple/eq) — поля 1:1 зі старим.
  //   - -x^2 = -(x²) (унарний мінус нижчий за ^), --x = x (стек знаків).
  //   - Неявне множення 2x/2(x+1)/x y. Права асоц. ^.
  //   - Вимкнено (throw / plain-call): ! % { } < > надрядкові, mandelbrot()→call.
  // Специфікація+верифікація: GRAPHMASH_PARSER_COMPAT_REQUIREMENTS.md (repo root).
  const T_NUM   = 'NUM';
  const T_IDENT = 'IDENT';
  const T_PLUS  = '+';
  const T_MINUS = '-';
  const T_STAR  = '*';
  const T_SLASH = '/';
  const T_CARET = '^';
  const T_LP    = '(';
  const T_RP    = ')';
  const T_COMMA = ',';
  const T_EQ    = '=';
  const T_END   = 'END';

  function tokenize(src) {
    // R9: normalise pretty math glyphs (optional, safe — §4.9)
    src = src
      .replace(/[·×∙⋅]/g, '*')   // ·×∙⋅ → *
      .replace(/÷/g, '/')                         // ÷ → /
      .replace(/[−–—]/g, '-');          // −–— → -

    const tokens = [];
    let i = 0;

    while (i < src.length) {
      const c = src[i];

      // whitespace — skip
      if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }

      // number: [0-9.]+
      if ((c >= '0' && c <= '9') || c === '.') {
        let j = i;
        while (j < src.length && ((src[j] >= '0' && src[j] <= '9') || src[j] === '.')) j++;
        tokens.push({ t: T_NUM, v: parseFloat(src.slice(i, j)) });
        i = j;
        continue;
      }

      // identifier: [A-Za-z α-ω А-Яа-я π τ _][A-Za-z α-ω А-Яа-я 0-9 _]*
      if (/[A-Za-zα-ωА-Яа-яπτ_]/.test(c)) {
        let j = i;
        while (j < src.length && /[A-Za-zα-ωА-Яа-я0-9_]/.test(src[j])) j++;
        tokens.push({ t: T_IDENT, v: src.slice(i, j) });
        i = j;
        continue;
      }

      // single-char tokens in the allowed set (§4.1)
      if (c === '(') { tokens.push({ t: T_LP    }); i++; continue; }
      if (c === ')') { tokens.push({ t: T_RP    }); i++; continue; }
      if (c === ',') { tokens.push({ t: T_COMMA }); i++; continue; }
      if (c === '=') { tokens.push({ t: T_EQ    }); i++; continue; }
      if (c === '+') { tokens.push({ t: T_PLUS  }); i++; continue; }
      if (c === '-') { tokens.push({ t: T_MINUS }); i++; continue; }
      if (c === '*') { tokens.push({ t: T_STAR  }); i++; continue; }
      if (c === '/') { tokens.push({ t: T_SLASH }); i++; continue; }
      if (c === '^') { tokens.push({ t: T_CARET }); i++; continue; }

      // §4.1: everything else → throw (R5)
      throw new Error('Невідомий символ «' + c + '» на позиції ' + (i + 1));
    }

    tokens.push({ t: T_END });
    return tokens;
  }

  // Grammar (§4.2):
  //   top    := expr ('=' expr)? END
  //   expr   := term (('+' | '-') term)*               left-assoc
  //   term   := unary (('*' | '/' | implicit) unary)*  left-assoc
  //   unary  := '-' unary | '+' unary | pow            stacked signs (R-STACK); '+' absorbed
  //   pow    := atom ('^' unary)?                       right-assoc (R8)
  //   atom   := NUM | '(' expr ')' | '(' expr ',' expr ')' | IDENT ['(' args ')']
  function parse(src) {
    const toks = tokenize(src);
    let p = 0;

    function peek()  { return toks[p]; }
    function peekT() { return toks[p].t; }
    function eat(expected) {
      const tk = toks[p];
      if (tk.t !== expected) {
        throw new Error('Очікувалось «' + expected + '», отримано «' + (tk.v !== undefined ? tk.v : tk.t) + '»');
      }
      p++;
      return tk;
    }

    // top
    const lhs = expr();
    if (peekT() === T_EQ) {
      p++;
      const rhs = expr();
      if (peekT() === T_EQ) throw new Error('Подвійний знак рівності заборонено (§4.5)');
      if (peekT() !== T_END) throw new Error('Зайві токени після виразу');
      return { kind: 'eq', lhs, rhs };
    }
    if (peekT() !== T_END) throw new Error('Зайві токени після виразу');
    return lhs;

    // expr := term (('+' | '-') term)*
    function expr() {
      let left = term();
      for (;;) {
        const t = peekT();
        if (t !== T_PLUS && t !== T_MINUS) break;
        const op = t === T_PLUS ? '+' : '-';
        p++;
        left = { kind: 'binop', op, left, right: term() };
      }
      return left;
    }

    // term := unary (('*' | '/' | implicit-mul) unary)*
    function term() {
      let left = unary();
      for (;;) {
        const t = peekT();
        if (t === T_STAR)  { p++; left = { kind: 'binop', op: '*', left, right: unary() }; }
        else if (t === T_SLASH) { p++; left = { kind: 'binop', op: '/', left, right: unary() }; }
        else if (t === T_NUM || t === T_IDENT || t === T_LP) {
          // R7: implicit multiplication (§4.6)
          left = { kind: 'binop', op: '*', left, right: unary() };
        }
        else break;
      }
      return left;
    }

    // unary := '-' unary | '+' unary | pow   (R-STACK: stacked signs, e.g. --x = x)
    function unary() {
      if (peekT() === T_MINUS) { p++; return { kind: 'unary', op: '-', arg: unary() }; }
      if (peekT() === T_PLUS)  { p++; return unary(); }  // unary + absorbed (§4.3)
      return pow();
    }

    // pow := atom ('^' unary)?   — right-assoc because rhs calls unary (not pow)
    function pow() {
      const base = atom();
      if (peekT() === T_CARET) {
        p++;
        return { kind: 'binop', op: '^', left: base, right: unary() };
      }
      return base;
    }

    // atom := NUM | '(' ... ')' | IDENT ['(' args ')']
    function atom() {
      const tk = peek();

      if (tk.t === T_NUM) {
        p++;
        return { kind: 'num', v: tk.v };
      }

      if (tk.t === T_LP) {
        p++;
        const first = expr();
        if (peekT() === T_COMMA) {
          // tuple — exactly 2 elements (§4.5)
          p++;
          const second = expr();
          if (peekT() === T_COMMA) throw new Error('Кортеж може мати рівно 2 елементи (§4.5)');
          eat(T_RP);
          return { kind: 'tuple', items: [first, second] };
        }
        eat(T_RP);
        return first;
      }

      if (tk.t === T_IDENT) {
        p++;
        if (peekT() === T_LP) {
          // function call — ALL names are plain call, no special-casing (§4.4)
          p++;
          const args = [];
          if (peekT() !== T_RP) {
            args.push(expr());
            while (peekT() === T_COMMA) { p++; args.push(expr()); }
          }
          eat(T_RP);
          return { kind: 'call', name: tk.v, args };
        }
        return { kind: 'ident', name: tk.v };
      }

      throw new Error('Неочікуваний токен «' + (tk.v !== undefined ? tk.v : tk.t) + '»');
    }
  }

  // ---------- Evaluator ----------------------------------------------------
  const FUNCS = {
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
    asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
    ln: Math.log,
    log: function(x, a) { var num = Math.log(x); return a !== undefined ? num / Math.log(a) : (Math.log10 ? Math.log10(x) : num / Math.LN10); },
    // Бекенд перетворює `\lg` і `\log_{10}` саме на `log10`
    // (enrich_fingerprints.py:267,290). Без цих імен рушій мовчки не малював
    // нічого: вираз у панелі виглядав правильним, а полотно лишалось порожнім
    // (живий прогін 2026-08-06, `y = lg(x^2-6x+8)`).
    log10: function(x) { return Math.log10 ? Math.log10(x) : Math.log(x) / Math.LN10; },
    lg: function(x) { return Math.log10 ? Math.log10(x) : Math.log(x) / Math.LN10; },
    exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round,
    sign: Math.sign, max: Math.max, min: Math.min, mod: (a,b) => ((a%b)+b)%b,
  };
  const CONSTS = { pi: Math.PI, π: Math.PI, e: Math.E, tau: Math.PI*2, τ: Math.PI*2 };

  function evalAst(node, env) {
    switch (node.kind) {
      case 'num': return node.v;
      case 'ident':
        if (node.name in env) return env[node.name];
        if (node.name in CONSTS) return CONSTS[node.name];
        throw new Error(`Невідома змінна: ${node.name}`);
      case 'unary': return -evalAst(node.arg, env);
      case 'binop': {
        const a = evalAst(node.left, env), b = evalAst(node.right, env);
        switch (node.op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return a / b;
          case '^': return Math.pow(a, b);
        }
        throw new Error('op?');
      }
      case 'call': {
        const fn = FUNCS[node.name];
        if (!fn) throw new Error(`Невідома функція: ${node.name}`);
        return fn(...node.args.map((a) => evalAst(a, env)));
      }
      case 'tuple': return node.items.map((it) => evalAst(it, env));
    }
    throw new Error('ast?');
  }

  // Find which free variables an AST uses (filtered against env keys)
  function freeVars(node, ignore = new Set()) {
    const out = new Set();
    (function walk(n) {
      switch (n.kind) {
        case 'ident':
          if (!(n.name in CONSTS) && !ignore.has(n.name)) out.add(n.name);
          break;
        case 'unary': walk(n.arg); break;
        case 'binop': walk(n.left); walk(n.right); break;
        case 'call': n.args.forEach(walk); break;
        case 'tuple': n.items.forEach(walk); break;
      }
    })(node);
    return out;
  }

  // ---------- Expression model --------------------------------------------
  // Categorize a parsed source into: param | explicitY | explicitX | implicit | point | invalid
  function _hasInvalidCall(node) {
    if (typeof node !== 'object' || !node) return false
    if (node.kind === 'call') {
      if (!FUNCS[node.name]) return true
      return (node.args || []).some(_hasInvalidCall)
    }
    for (const k of ['arg','left','right','lhs','rhs','items']) {
      if (node[k]) { if (Array.isArray(node[k])) { if (node[k].some(_hasInvalidCall)) return true } else if (_hasInvalidCall(node[k])) return true }
    }
    return false
  }
  function classify(src, paramNames) {
    let ast;
    try { ast = parse(src); } catch (err) { return { kind: 'invalid', error: err.message, src }; }

    // K-3: невідома функція — помилка, а не мовчазна нісенітниця.
    // ⚠️ Перевірка мусить стояти ДО розгалуження на рівняння: раніше вона
    // була нижче, і гілка `eq` виходила раніше з `explicitY`. Через це гейт
    // покривав лише голі вирази (`log10(x)`), а реальні — з `y=` — проходили
    // повз: `y = lg(...)` давав порожнє полотно замість повідомлення
    // (живий прогін 2026-08-06).
    if (_hasInvalidCall(ast)) {
      return { kind: 'invalid', error: 'Невідома функція', src }
    }

    const known = new Set([...Object.keys(CONSTS), ...paramNames]);

    // Single tuple → point
    if (ast.kind === 'tuple') {
      const fv = new Set([...freeVars(ast.items[0]), ...freeVars(ast.items[1])]);
      const unknown = [];
      for (const v of fv) if (!known.has(v)) unknown.push(v);
      if (unknown.length) return { kind: 'needsParam', unknown, src, ast };
      return { kind: 'point', ast, src };
    }

    if (ast.kind === 'eq') {
      // a = <expr>  (param)
      if (ast.lhs.kind === 'ident') {
        const name = ast.lhs.name;
        // If rhs depends on x or y → it's a function definition (treat as explicit)
        const rhsFree = freeVars(ast.rhs);
        const hasX = rhsFree.has('x'), hasY = rhsFree.has('y');
        if (name === 'y' && !hasY) {
          const unknown = [];
          for (const v of rhsFree) if (v !== 'x' && !known.has(v)) unknown.push(v);
          if (unknown.length) return { kind: 'needsParam', unknown, src, ast: ast.rhs, target: 'y' };
          return { kind: 'explicitY', ast: ast.rhs, src };
        }
        if (name === 'x' && !hasX) {
          const unknown = [];
          for (const v of rhsFree) if (v !== 'y' && !known.has(v)) unknown.push(v);
          if (unknown.length) return { kind: 'needsParam', unknown, src, ast: ast.rhs, target: 'x' };
          return { kind: 'explicitX', ast: ast.rhs, src };
        }
        // Param: rhs may not depend on x/y; otherwise treat as implicit
        if (!hasX && !hasY) {
          const unknown = [];
          for (const v of rhsFree) if (!known.has(v) && v !== name) unknown.push(v);
          if (unknown.length) return { kind: 'needsParam', unknown, src, paramName: name, ast: ast.rhs };
          return { kind: 'param', name, ast: ast.rhs, src };
        }
      }
      // Otherwise implicit: lhs - rhs = 0
      const fv = new Set([...freeVars(ast.lhs), ...freeVars(ast.rhs)]);
      const unknown = [];
      for (const v of fv) if (v !== 'x' && v !== 'y' && !known.has(v)) unknown.push(v);
      if (unknown.length) return { kind: 'needsParam', unknown, src, lhs: ast.lhs, rhs: ast.rhs, isEq: true };
      return { kind: 'implicit', lhs: ast.lhs, rhs: ast.rhs, src };
    }
    // Bare expression без '=' (наприклад `x^2`) → трактуємо як `y = <вираз>`
    // (Desmos-style). src користувача НЕ переписуємо — класифікація derived
    // з того самого рядка, тож ops/replay детерміновані. Вирази з `y` у
    // вільних змінних лишаються invalid: без '=' немає що розв'язувати.
    {
      const fv = freeVars(ast);
      if (!fv.has('y')) {
        const unknown = [];
        for (const v of fv) if (v !== 'x' && !known.has(v)) unknown.push(v);
        if (unknown.length) return { kind: 'needsParam', unknown, src, ast, target: 'y' };
        return { kind: 'explicitY', ast, src };
      }
    }
    return { kind: 'invalid', error: 'Очікується рівняння або точка', src };
  }

  // Detect unknown variables in an explicit/point expression and offer them as params
  function _classifyExplicit(src, paramNames) {
    try {
      const ast = parse(src);
      const known = new Set([...Object.keys(CONSTS), ...paramNames]);
      if (ast.kind === 'eq' && ast.lhs.kind === 'ident') {
        const name = ast.lhs.name;
        const rhsFree = freeVars(ast.rhs);
        const hasX = rhsFree.has('x'), hasY = rhsFree.has('y');
        if (name === 'y' && !hasY) {
          const unknown = [];
          for (const v of rhsFree) if (v !== 'x' && !known.has(v)) unknown.push(v);
          if (unknown.length) return { kind: 'needsParam', unknown, src, ast: ast.rhs, target: 'y' };
        }
      }
    } catch (_) {}
    return null;
  }

  // ---------- Renderer ----------------------------------------------------
  // Math coords ↔ pixel coords helpers held in viewport state.
  class GraphCalculator {
    constructor(container, opts = {}) {
      this.container = container;
      // P0 refactor (2026-05-08): палітра читається з CSS-vars (`--gc-*`),
      // визначених у tokens.css. Fallback дорівнює legacy hardcoded значенню,
      // тож standalone-використання vendor (без WB-cascade) працює як раніше.
      const _cs = (typeof window !== 'undefined' && container && container.ownerDocument)
        ? window.getComputedStyle(container) : null;
      const _v = (name, fallback) => {
        if (!_cs) return fallback;
        const raw = _cs.getPropertyValue(name);
        return (raw && raw.trim()) || fallback;
      };
      this.opts = Object.assign({
        bg:        _v('--gc-paper',      '#fffaf0'),
        gridMinor: _v('--gc-grid-minor', 'rgba(43,33,24,0.07)'),
        gridMajor: _v('--gc-grid-major', 'rgba(43,33,24,0.16)'),
        axis:      _v('--gc-axis',       '#2b2118'),
        axisLabel: _v('--gc-ink-2',      '#5a4a3a'),
        labelFont: '11px JetBrains Mono, monospace',
      }, opts);
      this.expressions = []; // {id, src, color, hidden, classified, paramValue?, paramRange?}
      this.params = {}; // name -> {value, min, max, step}
      this.points = {}; // Phase G2: id -> {x, y, mode, curveExprId?}
      this.onPointDrag = null; // (id, x, y) callback (Vue renderer wires)
      this.onPointDragEnd = null; // (id, x, y) callback (drag release)
      this._dragParamTargetExprId = null; // Phase G3 v1.1: highlight target during drag
      this.viewport = { cx: 0, cy: 0, scale: 38 }; // px per math unit
      this.palette = [
        _v('--gc-series-1', '#c4622a'),
        _v('--gc-series-2', '#3b7b9b'),
        _v('--gc-series-3', '#7a8b3a'),
        _v('--gc-series-4', '#a83a5b'),
        _v('--gc-series-5', '#5a4a8a'),
        _v('--gc-series-6', '#2b6e58'),
        _v('--gc-series-7', '#c08820'),
      ];
      this._nextId = 1;
      this._buildDom();
      this._bindInteraction();
      this._scheduleRender();
    }

    _buildDom() {
      this.container.classList.add('gc-root');
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'gc-canvas';
      this.container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');

      // Floating zoom controls
      this.zoomBox = document.createElement('div');
      this.zoomBox.className = 'gc-zoom';
      this.zoomBox.innerHTML = `
        <button class="gc-zb" data-z="in" title="Збільшити">+</button>
        <button class="gc-zb" data-z="out" title="Зменшити">−</button>
        <button class="gc-zb" data-z="home" title="До початку">⌂</button>
      `;
      this.container.appendChild(this.zoomBox);
      this.zoomBox.addEventListener('click', (e) => {
        const z = e.target.dataset.z;
        if (z === 'in') this._zoomAt(this.canvas.width/2, this.canvas.height/2, 1.4);
        else if (z === 'out') this._zoomAt(this.canvas.width/2, this.canvas.height/2, 1/1.4);
        else if (z === 'home') { this.viewport = { cx: 0, cy: 0, scale: 38 }; this._scheduleRender(); }
      });

      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(this.container);
      // schedule once on next tick (ResizeObserver may not fire if size is stable)
      requestAnimationFrame(() => this._resize());
    }

    _resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = this.container.getBoundingClientRect();
      const w = Math.max(40, r.width), h = Math.max(40, r.height);
      this.canvas.width = w * dpr; this.canvas.height = h * dpr;
      this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
      this._dpr = dpr;
      this._scheduleRender();
    }

    _bindInteraction() {
      let mode = null; // null | 'pan' | 'point' | 'param'
      let lx = 0, ly = 0;
      let draggingPointId = null;
      let paramDragInfo = null; // { paramName, ast, exprId } when mode='param'

      this.canvas.addEventListener('pointerdown', (e) => {
        // Phase G3 v1 (2026-05-06): Shift+drag → drag-param mode.
        // Strict v1: enabled only if exactly 1 param exists AND used by some
        // explicit-Y curve. Else falls through to point/pan.
        const forcePan = !!e.altKey || e.button === 2;
        // Phase G4 (2026-05-06): toggle button у Vue layer sets opts.interactionMode
        // = 'param'. Either Shift held OR toggle on activates drag-param mode.
        // g4_inv_3: Shift wins у conflict (both → still 'param'; effectively same).
        const paramModeActive = e.shiftKey || this.opts.interactionMode === 'param';
        if (paramModeActive && !forcePan) {
          // Phase G3 v1.1 polish: pass cursor coords для activation zone +
          // closest-curve picker (when multiple expressions share param).
          const r0 = this.canvas.getBoundingClientRect();
          const px0 = (e.clientX - r0.left) * (this._dpr || 1);
          const py0 = (e.clientY - r0.top) * (this._dpr || 1);
          const m0 = this._pxToMath(px0, py0);
          const candidate = this._findParamDragCandidate(m0.x, m0.y);
          if (candidate) {
            mode = 'param';
            paramDragInfo = candidate;
            // Phase G3 v1.1 polish: track which curve is being controlled —
            // _render highlights it (thicker + glow). Cleared on pointerup.
            this._dragParamTargetExprId = candidate.exprId;
            this._scheduleRender();
            try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
            this.canvas.style.cursor = 'ns-resize';
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }
        // Phase G2 review #4: Alt-key forces pan, skipping point hit-test.
        if (!forcePan) {
          const r = this.canvas.getBoundingClientRect();
          const px = (e.clientX - r.left) * (this._dpr || 1);
          const py = (e.clientY - r.top) * (this._dpr || 1);
          const hitId = this._hitTestPoint(px, py);
          if (hitId) {
            mode = 'point';
            draggingPointId = hitId;
            try { this.canvas.setPointerCapture(e.pointerId); } catch(_) {}
            this.canvas.style.cursor = 'grabbing';
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }
        // Otherwise pan
        mode = 'pan';
        lx = e.clientX; ly = e.clientY;
        try { this.canvas.setPointerCapture(e.pointerId); } catch(_) {}
        this.canvas.style.cursor = 'grabbing';
      });
      this.canvas.addEventListener('pointermove', (e) => {
        // dp_inv_7 (Phase G3 v1 review 2026-05-06): mode='param' DOES NOT
        // invoke `_snapToCurve`. Snap і drag-param ніколи не conflict —
        // drag-param shifts the curve via param value while keeping cursor's
        // (x, y) as solver target. Mixing snap (which shifts cursor toward
        // curve) into drag-param would create chaotic feedback loop.
        if (mode === 'param' && paramDragInfo) {
          const r = this.canvas.getBoundingClientRect();
          const px = (e.clientX - r.left) * (this._dpr || 1);
          const py = (e.clientY - r.top) * (this._dpr || 1);
          const m = this._pxToMath(px, py);
          const cur = this.params[paramDragInfo.paramName];
          const initial = (cur && typeof cur === 'object' && Number.isFinite(cur.value))
            ? cur.value : (typeof cur === 'number' ? cur : 1);
          // Нев'язку дає сам кандидат (явна або неявна крива) — розв'язувач
          // про тип кривої не знає. `explicit` — щоб dp_inv_1 (x→0) діяв
          // лише там, де він має сенс.
          const newA = this._solveParam(
            paramDragInfo.residual, paramDragInfo.paramName, m.x, m.y, initial,
            5, { explicit: !!paramDragInfo.yAt },
          );
          if (Number.isFinite(newA) && this.onParamDrag) {
            // Clamp до param range (HARD INV: stay у [min, max]).
            const min = (cur && typeof cur === 'object' && Number.isFinite(cur.min))
              ? cur.min : -10;
            const max = (cur && typeof cur === 'object' && Number.isFinite(cur.max))
              ? cur.max : 10;
            const clamped = Math.min(Math.max(newA, min), max);
            try { this.onParamDrag(paramDragInfo.paramName, clamped); } catch (_) {}
          }
          return;
        }
        if (mode === 'point' && draggingPointId) {
          const r = this.canvas.getBoundingClientRect();
          const px = (e.clientX - r.left) * (this._dpr || 1);
          const py = (e.clientY - r.top) * (this._dpr || 1);
          const m = this._pxToMath(px, py);
          if (this.onPointDrag) {
            try { this.onPointDrag(draggingPointId, m.x, m.y); } catch (_) {}
          }
          return;
        }
        if (mode !== 'pan') return;
        const dx = (e.clientX - lx) * (this._dpr || 1);
        const dy = (e.clientY - ly) * (this._dpr || 1);
        this.viewport.cx -= dx / this.viewport.scale;
        this.viewport.cy += dy / this.viewport.scale;
        lx = e.clientX; ly = e.clientY;
        this._scheduleRender();
      });
      const up = (e) => {
        if (mode === 'param' && paramDragInfo) {
          if (this.onParamDragEnd) {
            try { this.onParamDragEnd(paramDragInfo.paramName); } catch (_) {}
          }
        }
        if (mode === 'point' && draggingPointId) {
          // Final emit for point release (flush pending throttle).
          if (this.onPointDragEnd) {
            const r = this.canvas.getBoundingClientRect();
            const px = (e.clientX - r.left) * (this._dpr || 1);
            const py = (e.clientY - r.top) * (this._dpr || 1);
            const m = this._pxToMath(px, py);
            try { this.onPointDragEnd(draggingPointId, m.x, m.y); } catch (_) {}
          }
        }
        mode = null;
        draggingPointId = null;
        paramDragInfo = null;
        // Phase G3 v1.1: clear target highlight on release
        if (this._dragParamTargetExprId) {
          this._dragParamTargetExprId = null;
          this._scheduleRender();
        }
        this.canvas.style.cursor = 'grab';
        try { this.canvas.releasePointerCapture(e.pointerId); } catch(_) {}
      };
      this.canvas.addEventListener('pointerup', up);
      this.canvas.addEventListener('pointercancel', up);
      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const r = this.canvas.getBoundingClientRect();
        const px = (e.clientX - r.left) * (this._dpr || 1);
        const py = (e.clientY - r.top) * (this._dpr || 1);
        const factor = Math.exp(-e.deltaY * 0.0015);
        this._zoomAt(px, py, factor);
      }, { passive: false });
      this.canvas.style.cursor = 'grab';
      this.canvas.style.touchAction = 'none';
    }

    _zoomAt(px, py, factor) {
      // keep the math point under cursor fixed
      const before = this._pxToMath(px, py);
      this.viewport.scale = Math.max(2, Math.min(800, this.viewport.scale * factor));
      const after = this._pxToMath(px, py);
      this.viewport.cx += before.x - after.x;
      this.viewport.cy += before.y - after.y;
      this._scheduleRender();
    }

    _pxToMath(px, py) {
      const w = this.canvas.width, h = this.canvas.height;
      return {
        x: this.viewport.cx + (px - w/2) / this.viewport.scale,
        y: this.viewport.cy - (py - h/2) / this.viewport.scale,
      };
    }
    _mathToPx(x, y) {
      const w = this.canvas.width, h = this.canvas.height;
      return {
        x: w/2 + (x - this.viewport.cx) * this.viewport.scale,
        y: h/2 - (y - this.viewport.cy) * this.viewport.scale,
      };
    }

    // ---------- Expression API --------------------------------------------
    // Phase G FE-RULE-3: id MUST be provided externally (store assigns UUID).
    // Engine no longer auto-generates IDs — passing undefined throws.
    addExpression(src, id) {
      if (!id || typeof id !== 'string') {
        throw new Error('graph_calculator.addExpression: id (string) required (FE-RULE-3 / inv-21.6)');
      }
      const expr = {
        id, src,
        color: this.palette[this.expressions.length % this.palette.length],
        hidden: false,
        classified: null,
        paramRange: { min: -10, max: 10, step: 0.01 },
      };
      this.expressions.push(expr);
      this._reclassifyAll();
      this._scheduleRender();
      return expr;
    }
    updateExpression(id, src) {
      const e = this.expressions.find((x) => x.id === id);
      if (!e) return;
      e.src = src;
      this._reclassifyAll();
      this._scheduleRender();
    }
    removeExpression(id) {
      this.expressions = this.expressions.filter((x) => x.id !== id);
      this._reclassifyAll();
      this._scheduleRender();
    }
    setHidden(id, hidden) {
      const e = this.expressions.find((x) => x.id === id);
      if (e) {
        e.hidden = hidden;
        this._scheduleRender();
        // Phase G fix (2026-05-06): fire onChange so Vue wrapper bumps
        // displayExpressions та emits asset_update snapshot. Без цього
        // toggle hidden mutates engine, але store + UI з ним розходяться,
        // повторний toggle "не дає ефекту" (state desync).
        if (this.onChange) this.onChange();
      }
    }
    setColor(id, color) {
      const e = this.expressions.find((x) => x.id === id);
      if (e) {
        e.color = color;
        this._scheduleRender();
        // Phase G fix: same — onChange so store/UI reflect color change.
        if (this.onChange) this.onChange();
      }
    }
    // Phase G2: points API (mutation only — emits handled by Vue renderer).
    addPoint(id, point) {
      if (!id) return;
      this.points[id] = {
        x: Number(point && point.x) || 0,
        y: Number(point && point.y) || 0,
        mode: point && point.mode === 'onCurve' ? 'onCurve' : 'free',
        ...(point && point.curveExprId ? { curveExprId: point.curveExprId } : {}),
      };
      this._scheduleRender();
    }
    setPoint(id, x, y) {
      const p = this.points[id];
      if (p) { p.x = x; p.y = y; this._scheduleRender(); }
    }
    deletePoint(id) {
      if (this.points[id]) { delete this.points[id]; this._scheduleRender(); }
    }

    setParamValue(name, value) {
      // HARD SPEC: params є Record<name, {value, min, max, step}>.
      // Mutate ONLY .value field. If entry missing — initialize з defaults
      // (defensive — store зазвичай постачає entry через setState).
      const cur = this.params[name];
      if (cur && typeof cur === 'object') {
        cur.value = value;
      } else {
        this.params[name] = { value, min: -10, max: 10, step: 0.1 };
      }
      this._scheduleRender();
    }
    // Insert a parameter definition `name = value` BEFORE the expression with id `beforeId`.
    // Phase G FE-RULE-3: id MUST be provided externally.
    addParameterFor(name, beforeId, value = 1, id) {
      if (!id || typeof id !== 'string') {
        throw new Error('graph_calculator.addParameterFor: id (string) required (FE-RULE-3 / inv-21.6)');
      }
      const expr = {
        id, src: `${name} = ${value}`,
        color: this.palette[(this.expressions.length) % this.palette.length],
        hidden: false, classified: null,
        paramRange: { min: -10, max: 10, step: 0.01 },
        animating: false, animDir: 1,
      };
      const idx = this.expressions.findIndex((x) => x.id === beforeId);
      if (idx < 0) this.expressions.push(expr);
      else this.expressions.splice(idx, 0, expr);
      this.params[name] = value;
      this._reclassifyAll();
      this._scheduleRender();
      return expr;
    }
    setParamAnimating(id, on) {
      const e = this.expressions.find((x) => x.id === id);
      if (!e || e.classified?.kind !== 'param') return;
      e.animating = on;
      // Phase G inv-21.13: у replay mode animation rAF DISABLED — replay
      // applies discrete graph_param_set stream напряму. Live emits
      // through onChange при кожному tick.
      if (on && !this.opts.disableAnimation) this._kickAnimLoop();
    }

    // ---------- Phase G state I/O (FE-RULE-1, FE-RULE-2) -----------------
    // Full-state replace per inv-21 snapshot schema. Caller (Vue renderer)
    // must guard self-echo via isApplyingExternalState flag (FE-RULE-4).
    setState(state) {
      if (!state || typeof state !== 'object') return;
      const { expressions, params, viewport } = state;
      // 1. Stop in-progress animation rAF (avoid stale ticks against new state)
      if (this._animRaf) {
        cancelAnimationFrame(this._animRaf);
        this._animRaf = null;
      }
      // 2. Replace expressions (preserve ID + src + color + hidden + paramRange)
      if (Array.isArray(expressions)) {
        this.expressions = expressions.map((e) => ({
          id: e.id,
          src: e.src,
          color: e.color || this.palette[0],
          hidden: !!e.hidden,
          classified: null,  // re-derived by _reclassifyAll
          paramRange: e.paramRange
            ? { min: e.paramRange.min, max: e.paramRange.max, step: e.paramRange.step }
            : { min: -10, max: 10, step: 0.01 },
          animating: false,  // ephemeral runtime flag, not persisted
          animDir: 1,
        }));
      }
      // 3. Replace params (full replace; remove keys not present)
      if (params && typeof params === 'object') {
        this.params = { ...params };
      }
      // 4. Replace viewport
      if (viewport && typeof viewport === 'object') {
        this.viewport = {
          cx: Number(viewport.cx) || 0,
          cy: Number(viewport.cy) || 0,
          scale: Number(viewport.scale) || 38,
        };
      }
      // 5. Phase G2: replace points (full replace)
      if (state.points && typeof state.points === 'object') {
        const next = {};
        for (const [id, p] of Object.entries(state.points)) {
          if (p && typeof p === 'object') {
            next[id] = {
              x: Number(p.x) || 0,
              y: Number(p.y) || 0,
              mode: p.mode === 'onCurve' ? 'onCurve' : 'free',
              ...(p.curveExprId ? { curveExprId: p.curveExprId } : {}),
            };
          }
        }
        this.points = next;
      } else if (state.points === undefined) {
        // absent → keep current; some incoming snapshots may omit points field.
      }
      this._reclassifyAll();
      this._scheduleRender();
    }

    // Snapshot for emit (per inv-21 schema). NOT includes ephemeral flags
    // (classified ast, animating, animDir) — only persisted fields.
    getState() {
      const pointsOut = {};
      for (const [id, p] of Object.entries(this.points)) {
        pointsOut[id] = {
          x: p.x, y: p.y, mode: p.mode,
          ...(p.curveExprId ? { curveExprId: p.curveExprId } : {}),
        };
      }
      return {
        expressions: this.expressions.map((e) => ({
          id: e.id,
          src: e.src,
          color: e.color,
          hidden: !!e.hidden,
          // include paramRange only якщо classified як param (slider config)
          ...(e.classified && e.classified.kind === 'param'
            ? { paramRange: { ...e.paramRange } }
            : {}),
        })),
        params: { ...this.params },
        viewport: { ...this.viewport },
        points: pointsOut,
      };
    }

    _kickAnimLoop() {
      if (this._animRaf) return;
      const tick = () => {
        this._animRaf = null;
        let any = false;
        for (const e of this.expressions) {
          if (e.classified?.kind === 'param' && e.animating) {
            any = true;
            const name = e.classified.name;
            const { min, max, step } = e.paramRange;
            const span = Math.max(1e-9, max - min);
            const dx = (step || 0.01) * 4 * (e.animDir || 1);
            let v = (this.params[name] ?? 0) + dx;
            if (v > max) { v = max; e.animDir = -1; }
            if (v < min) { v = min; e.animDir = 1; }
            // Phase G: route через setParamValue щоб Vue renderer override
            // міг intercept ці mutations (param-set emit при animation).
            this.setParamValue(name, v);
          }
        }
        if (any) {
          this._scheduleRender();
          if (this.onChange) this.onChange();
          this._animRaf = requestAnimationFrame(tick);
        }
      };
      this._animRaf = requestAnimationFrame(tick);
    }

    _reclassifyAll() {
      // HARD SPEC: paramNames = Object.keys(this.params).
      // Engine НЕ створює, НЕ видаляє params — вони керуються store через setState.
      const paramNames = new Set(Object.keys(this.params || {}));
      for (const e of this.expressions) {
        try {
          const ast = parse(e.src);
          if (ast.kind === 'eq' && ast.lhs.kind === 'ident' && ast.lhs.name !== 'y' && ast.lhs.name !== 'x') {
            const fv = freeVars(ast.rhs);
            if (!fv.has('x') && !fv.has('y')) paramNames.add(ast.lhs.name);
          }
        } catch (_) {}
      }
      for (const e of this.expressions) {
        e.classified = classify(e.src, paramNames);
      }
      // env = { ...CONSTS, ...paramValues } — paramValues extracted from
      // {value, min, max, step} structure (HARD SPEC schema).
      const env = { ...CONSTS };
      for (const k of Object.keys(this.params)) {
        const p = this.params[k];
        if (p && typeof p === 'object' && Number.isFinite(p.value)) {
          env[k] = p.value;
        } else if (typeof p === 'number' && Number.isFinite(p)) {
          // legacy fallback (defensive — old snapshot з flat number)
          env[k] = p;
        }
      }
      // Notify listener
      if (this.onChange) this.onChange();
    }

    // ---------- Rendering -------------------------------------------------
    _scheduleRender() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => { this._raf = null; this._render(); });
    }

    _render() {
      const ctx = this.ctx;
      const w = this.canvas.width, h = this.canvas.height;
      ctx.fillStyle = this.opts.bg;
      ctx.fillRect(0, 0, w, h);
      this._drawGrid();
      this._drawAxes();

      // HARD SPEC: env = consts + extracted param.value (params is
      // Record<name, {value, min, max, step}>).
      const env = { ...CONSTS };
      for (const k of Object.keys(this.params)) {
        const p = this.params[k];
        if (p && typeof p === 'object' && Number.isFinite(p.value)) {
          env[k] = p.value;
        } else if (typeof p === 'number' && Number.isFinite(p)) {
          env[k] = p;
        }
      }
      // Phase G2: render interactive points AFTER curves so вони над лініями.
      const pointsToDraw = Object.entries(this.points || {});
      for (const e of this.expressions) {
        if (e.hidden || !e.classified || e.classified.kind === 'invalid' || e.classified.kind === 'param') continue;
        const isHighlighted = this._dragParamTargetExprId === e.id;
        if (isHighlighted) {
          ctx.save();
          ctx.shadowColor = e.color;
          ctx.shadowBlur = 8 * (this._dpr || 1);
          ctx.lineWidth = (ctx.lineWidth || 1.5) * 1.8;
        }
        try {
          if (e.classified.kind === 'explicitY') this._drawExplicitY(e.classified.ast, env, e.color);
          else if (e.classified.kind === 'explicitX') this._drawExplicitX(e.classified.ast, env, e.color);
          else if (e.classified.kind === 'implicit') this._drawImplicit(e.classified.lhs, e.classified.rhs, env, e.color);
          else if (e.classified.kind === 'point') this._drawPoint(e.classified.ast, env, e.color);
        } catch (err) { /* skip render errors */ }
        if (isHighlighted) ctx.restore();
      }
      // Phase G3 (2026-05-06): intersections = derived render layer.
      // Compute ON each render — NO state, NO ops.
      try { this._drawIntersections(env); } catch (_) {}

      // Phase G2: render interactive points. mode='onCurve' Y is DERIVED at
      // render time from curveExprId expression (NOT stored у state).
      for (const [id, p] of pointsToDraw) {
        try { this._drawInteractivePoint(id, p, env); } catch (_) {}
      }
    }

    /**
     * Phase G3 — Intersections of explicit-Y pairs.
     * Pure render layer. NOT persisted у state. NOT op-emitting.
     *
     * Phase G3 review (2026-05-06):
     * - **Cache by signature** (expressions src + params + viewport range).
     *   Re-render same scene → reuse cached roots, no recompute.
     *   Slider drag → params change → signature change → recompute (expected).
     * - **Root dedup**: epsilon=1e-3 у math units (для `x^2 = 0` boundary scan).
     * Limitation: only `kind:'explicitY'` curves; implicit skipped.
     */
    _intersectionsSignature(env) {
      const w = this.canvas.width;
      const scale = this.viewport.scale;
      const minX = (this.viewport.cx - (w / 2) / scale).toFixed(2);
      const maxX = (this.viewport.cx + (w / 2) / scale).toFixed(2);
      const exprPart = this.expressions
        .filter((e) => !e.hidden && e.classified && e.classified.kind === 'explicitY')
        .map((e) => `${e.id}:${e.src}`)
        .join('|');
      const paramKeys = Object.keys(env).sort();
      const paramPart = paramKeys.map((k) => `${k}=${env[k]}`).join(',');
      return `${exprPart}#${paramPart}#${minX},${maxX}`;
    }

    _computeIntersections(env) {
      const curves = this.expressions.filter(
        (e) => !e.hidden && e.classified && e.classified.kind === 'explicitY',
      );
      if (curves.length < 2) return [];
      const w = this.canvas.width;
      const scale = this.viewport.scale;
      const dpr = this._dpr || 1;
      const minMathX = this.viewport.cx - (w / 2) / scale;
      const maxMathX = this.viewport.cx + (w / 2) / scale;
      const stepPx = 4 * dpr;
      const stepMath = stepPx / scale;
      const MAX_ROOTS = 100;
      const DEDUP_EPS = 1e-3;
      const out = [];
      let rootCount = 0;

      for (let i = 0; i < curves.length && rootCount < MAX_ROOTS; i++) {
        for (let j = i + 1; j < curves.length && rootCount < MAX_ROOTS; j++) {
          const cA = curves[i].classified.ast;
          const cB = curves[j].classified.ast;
          const f = (x) => evalAst(cA, { ...env, x });
          const g = (x) => evalAst(cB, { ...env, x });
          let prevDiff = NaN;
          let prevX = NaN;
          let lastRootX = -Infinity;
          for (let x = minMathX; x <= maxMathX && rootCount < MAX_ROOTS; x += stepMath) {
            let yA, yB;
            try { yA = f(x); yB = g(x); } catch (_) { prevDiff = NaN; continue; }
            if (!Number.isFinite(yA) || !Number.isFinite(yB)) {
              prevDiff = NaN;
              continue;
            }
            const diff = yA - yB;
            let foundRoot = null;
            if (Number.isFinite(prevDiff) && diff === 0) {
              foundRoot = x;
            } else if (Number.isFinite(prevDiff) && Math.sign(diff) !== Math.sign(prevDiff)
              && diff !== 0 && prevDiff !== 0) {
              foundRoot = this._bisectIntersection(f, g, prevX, x);
            }
            if (foundRoot !== null && Number.isFinite(foundRoot)) {
              // Root dedup: skip якщо within epsilon of previous root
              if (Math.abs(foundRoot - lastRootX) < DEDUP_EPS) {
                prevDiff = diff; prevX = x; continue;
              }
              let yIn;
              try { yIn = f(foundRoot); } catch (_) { yIn = NaN; }
              if (Number.isFinite(yIn)) {
                out.push({ x: foundRoot, y: yIn });
                lastRootX = foundRoot;
                rootCount++;
              }
            }
            prevDiff = diff;
            prevX = x;
          }
        }
      }
      return out;
    }

    _drawIntersections(env) {
      const sig = this._intersectionsSignature(env);
      if (!this._intersectionsCache || this._intersectionsCache.signature !== sig) {
        this._intersectionsCache = {
          signature: sig,
          points: this._computeIntersections(env),
        };
      }
      for (const p of this._intersectionsCache.points) {
        this._drawIntersectionMarker(p.x, p.y);
      }
    }

    _bisectIntersection(f, g, a, b, iters = 12) {
      let fa, fb;
      try { fa = f(a) - g(a); fb = f(b) - g(b); } catch (_) { return null; }
      if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
      if (Math.sign(fa) === Math.sign(fb) || fa === 0 || fb === 0) {
        // Already at root or no sign change — return whichever has smaller |f|.
        return Math.abs(fa) < Math.abs(fb) ? a : b;
      }
      for (let i = 0; i < iters; i++) {
        const mid = (a + b) / 2;
        let fm;
        try { fm = f(mid) - g(mid); } catch (_) { return null; }
        if (!Number.isFinite(fm)) return null;
        if (fm === 0) return mid;
        if (Math.sign(fm) === Math.sign(fa)) { a = mid; fa = fm; }
        else { b = mid; fb = fm; }
      }
      return (a + b) / 2;
    }

    _drawIntersectionMarker(mathX, mathY) {
      const ctx = this.ctx;
      const px = this._mathToPx(mathX, mathY);
      const r = 5 * (this._dpr || 1);
      ctx.save();
      ctx.strokeStyle = '#5a4a3a';
      ctx.lineWidth = 1.5 * (this._dpr || 1);
      ctx.beginPath();
      // × marker (diagonal cross)
      ctx.moveTo(px.x - r, px.y - r);
      ctx.lineTo(px.x + r, px.y + r);
      ctx.moveTo(px.x + r, px.y - r);
      ctx.lineTo(px.x - r, px.y + r);
      ctx.stroke();
      ctx.restore();
    }

    // Phase G3 (2026-05-06): build env from CONSTS + params (used by hit-test,
    // snap, intersections, render). Centralized.
    _buildEnv() {
      const env = { ...CONSTS };
      for (const k of Object.keys(this.params)) {
        const p = this.params[k];
        if (p && typeof p === 'object' && Number.isFinite(p.value)) env[k] = p.value;
        else if (typeof p === 'number' && Number.isFinite(p)) env[k] = p;
      }
      return env;
    }

    /**
     * Phase G3 — Snap to curve (UX-only, no state mutation).
     *
     * Phase G3 review (2026-05-06):
     * - **Dynamic threshold**: zoom-in → 5px, zoom-out → 12px (default scale=38
     *   → 8px). Compensates: high zoom = curve fine-grained, less tolerance
     *   needed; low zoom = coarse, more tolerance.
     * - **Magnetic lerp**: closer to curve → stronger pull. Distant within
     *   threshold lerps gently; on-curve fully snaps. Returns interpolated
     *   {x, y} based on `strength = 1 - distance/threshold`.
     */
    _snapToCurve(mathX, mathY, baseThresholdPx) {
      const env = this._buildEnv();
      const dpr = this._dpr || 1;
      const cursorPx = this._mathToPx(mathX, mathY);
      const scale = this.viewport.scale;
      // Dynamic threshold: scale=38 → 8, scale>=80 → 5, scale<=20 → 12.
      // Smooth interpolation за viewport.scale.
      let threshold = baseThresholdPx;
      if (typeof baseThresholdPx !== 'number') {
        if (scale >= 80) threshold = 5;
        else if (scale <= 20) threshold = 12;
        else threshold = 12 - ((scale - 20) / 60) * 7;  // 20→12, 80→5
      }
      let best = null;
      let minDistSq = Infinity;
      const sampleRangePx = 20 * dpr;
      const sampleStepPx = 1 * dpr;
      for (const e of this.expressions) {
        if (e.hidden || !e.classified || e.classified.kind !== 'explicitY') continue;
        const ast = e.classified.ast;
        for (let dPx = -sampleRangePx; dPx <= sampleRangePx; dPx += sampleStepPx) {
          const sampleMathX = mathX + (dPx / scale);
          let sampleMathY;
          try { sampleMathY = evalAst(ast, { ...env, x: sampleMathX }); }
          catch (_) { continue; }
          if (!Number.isFinite(sampleMathY)) continue;
          const samplePx = this._mathToPx(sampleMathX, sampleMathY);
          const dxPx = samplePx.x - cursorPx.x;
          const dyPx = samplePx.y - cursorPx.y;
          const distSq = dxPx * dxPx + dyPx * dyPx;
          if (distSq < minDistSq) {
            minDistSq = distSq;
            best = { x: sampleMathX, y: sampleMathY, curveId: e.id };
          }
        }
      }
      const tPx = threshold * dpr;
      const tSq = tPx * tPx;
      if (minDistSq >= tSq || !best) return null;
      // Magnetic lerp: distance closer to curve → stronger pull
      const dist = Math.sqrt(minDistSq);
      const strength = 1 - dist / tPx;     // 0..1
      // Lerp from cursor toward snap target. strength=1 → exactly on curve.
      // strength=0 (at threshold edge) → no shift.
      const lerpedX = mathX + (best.x - mathX) * strength;
      const lerpedY = mathY + (best.y - mathY) * strength;
      return { x: lerpedX, y: lerpedY, curveId: best.curveId, strength };
    }

    /**
     * Phase G3 v1 + polish (2026-05-06) — drag-param candidate finder.
     *
     * Refinements (Phase G3 v1.1 polish):
     *   - **Activation zone**: drag-param активний ТIЛЬКИ якщо cursor близько
     *     до curve (zoom-aware threshold). Раніше Shift+drag triggered
     *     anywhere → "висаджування" param при random click.
     *   - **Closest curve picker**: якщо декілька visible explicit-Y
     *     expressions використовують той самий param → обираємо ту, яка
     *     ближче до cursor (intuitive).
     *
     * Args (всі optional):
     *   cursorMathX, cursorMathY — cursor у math coords. Якщо undefined,
     *     fallback to "first visible" (legacy / pointerdown-без-pos behaviour).
     *
     * Returns {paramName, exprId, ast, residual, yAt} or null:
     *  - null якщо жодна крива не залежить РІВНО від одного параметра
     *  - null якщо cursor ПОЗА activation zone (для cursor-aware call)
     *
     * 2026-08-16 (живий прогін власника: «працює, але коли два і більше
     * параметрів — ні»): тут стояло `if (params.length !== 1) return null` —
     * запобіжник від двозначності «яка з двох повзунків керує кривою?». Але
     * він гасив і всі ОДНОЗНАЧНІ випадки: на дошці a та b, а парабола
     * залежить лише від a — тягнути нема чого сумніватись, а рушій казав
     * «ні». Однозначність вирішує КРИВА, не лічильник повзунків: кандидат
     * — крива, що залежить рівно від одного параметра; він і є її ім'ям.
     * Крива з двома параметрами (y = a*x + b) кандидатом не стає — тут
     * двозначність справжня, і повзунок лишається єдиним чесним способом.
     */
    _findParamDragCandidate(cursorMathX, cursorMathY) {
      const paramSet = new Set(Object.keys(this.params));
      if (paramSet.size === 0) return null;
      /** Єдиний параметр кривої або null, якщо їх 0 чи ≥2. */
      const soleParamOf = (freeVarSet) => {
        let found = null;
        for (const v of freeVarSet) {
          if (!paramSet.has(v)) continue;
          if (found !== null) return null;   // другий параметр → двозначно
          found = v;
        }
        return found;
      };

      // Build candidate list: visible curves depending on exactly one param.
      //
      // 2026-08-16: було ЛИШЕ `explicitY`. Живий прогін власника: після того,
      // як Інтегралик перестав розбивати рівняння на функції (07e2c1f),
      // коло й парабола на дошці стали НЕЯВНИМИ (`(x-1)^2+y^2=9`,
      // `y+(x-1)^2=a+3`) — кандидатів нуль → Shift+drag мовчки ставав паном.
      // Регресія була в цьому фільтрі, не в розв'язувачі: Ньютон нижче
      // розв'язує F(·, a) = 0 за a і йому байдуже, звідки F. Тому кожен
      // кандидат несе власну нев'язку `residual(x, y, a)`:
      //   explicitY : f(x, a) − y
      //   implicit  : lhs(x, y, a) − rhs(x, y, a)
      // — і далі один код для обох.
      const candidates = [];
      const baseEnv = this._buildEnv();
      for (const e of this.expressions) {
        if (e.hidden || !e.classified) continue;
        const c = e.classified;
        try {
          if (c.kind === 'explicitY') {
            const paramName = soleParamOf(freeVars(c.ast));
            if (!paramName) continue;
            const ast = c.ast;
            candidates.push({
              paramName, exprId: e.id, ast,
              residual: (x, y, a) => evalAst(ast, { ...baseEnv, x, [paramName]: a }) - y,
              // Для activation-зони: y кривої при даному x (є лише в явних).
              yAt: (x, a) => evalAst(ast, { ...baseEnv, x, [paramName]: a }),
            });
          } else if (c.kind === 'implicit') {
            const fv = new Set([...freeVars(c.lhs), ...freeVars(c.rhs)]);
            const paramName = soleParamOf(fv);
            if (!paramName) continue;
            const { lhs, rhs } = c;
            candidates.push({
              paramName, exprId: e.id, ast: null,
              residual: (x, y, a) => {
                const env = { ...baseEnv, x, y, [paramName]: a };
                return evalAst(lhs, env) - evalAst(rhs, env);
              },
              yAt: null,
            });
          }
        } catch (_) { /* skip invalid */ }
      }
      if (candidates.length === 0) return null;
      if (cursorMathX === undefined || cursorMathY === undefined) {
        return candidates[0]; // legacy fallback (no-cursor caller)
      }
      // Cursor-aware: distance check applies even для 1 candidate
      // (activation zone gates random Shift+drag clicks far from any curve).

      // Cursor-aware: pick closest curve to cursor у pixel space.
      // Activation zone threshold: zoom-aware (similar до snap threshold).
      const env = this._buildEnv();
      const dpr = this._dpr || 1;
      const scale = this.viewport.scale;
      // Activation threshold: ~50px при scale=38 → wider ніж snap (8px) бо
      // user явно invoked drag-param через Shift, не випадково.
      let thresholdPx = 50;
      if (scale >= 80) thresholdPx = 30;
      else if (scale <= 20) thresholdPx = 80;
      else thresholdPx = 80 - ((scale - 20) / 60) * 50;
      const tPx = thresholdPx * dpr;
      const cursorPx = this._mathToPx(cursorMathX, cursorMathY);

      // Поточне значення параметра КОНКРЕТНОЇ кривої — потрібне, щоб оцінити
      // відстань до неї «як вона зараз намальована». У різних кандидатів
      // параметри можуть бути різні (a у параболи, b у прямої).
      const valueOf = (name) => {
        const cur = this.params[name];
        return (cur && typeof cur === 'object' && Number.isFinite(cur.value))
          ? cur.value : (typeof cur === 'number' ? cur : 1);
      };

      let best = null;
      let minDistSq = tPx * tPx;
      for (const c of candidates) {
        const aNow = valueOf(c.paramName);
        let distSq;
        try {
          if (c.yAt) {
            // Явна крива: вертикальна відстань до y(x) у пікселях — як було.
            const yAtCursor = c.yAt(cursorMathX, aNow);
            if (!Number.isFinite(yAtCursor)) continue;
            const curvePx = this._mathToPx(cursorMathX, yAtCursor);
            const dxPx = curvePx.x - cursorPx.x;
            const dyPx = curvePx.y - cursorPx.y;
            distSq = dxPx * dxPx + dyPx * dyPx;
          } else {
            // Неявна крива F(x,y)=0: аналітичної «y при x» немає, тож
            // відстань — нев'язка, нормована на градієнт (Sampson):
            //   d ≈ |F(x,y)| / ‖∇F(x,y)‖
            // — перший порядок відстані до нульової множини, у math-одиницях;
            // переводимо в пікселі через scale. Градієнт — скінченна різниця.
            const h = 1e-4;
            const F0 = c.residual(cursorMathX, cursorMathY, aNow);
            const Fx = (c.residual(cursorMathX + h, cursorMathY, aNow) - F0) / h;
            const Fy = (c.residual(cursorMathX, cursorMathY + h, aNow) - F0) / h;
            const gradN = Math.hypot(Fx, Fy);
            if (!Number.isFinite(F0) || !Number.isFinite(gradN) || gradN < 1e-9) continue;
            const distMath = Math.abs(F0) / gradN;
            const distPx = distMath * scale * dpr;
            distSq = distPx * distPx;
          }
        } catch (_) { continue; }
        if (distSq < minDistSq) {
          minDistSq = distSq;
          best = c;
        }
      }
      return best; // null якщо всі candidates поза activation zone
    }

    /**
     * Newton-Raphson solve for `param` such that f(x, param) = y.
     * Strict v1 + Phase G3 v1 review (2026-05-06):
     *   - max 5 iterations, central difference derivative
     *   - dp_inv_1: |mathX| < X_UNSTABLE → return NaN (skip — signals caller
     *     to NOT emit). Захищає `y = a*x` тощо від `a = y/x → ∞`.
     *   - dp_inv_2: |derivative| < D_THRESHOLD (1e-5) → break + return NaN.
     *     Низька derivative означає param has minimal influence at this x —
     *     update був би нестабільним. Caller skips emit (preserves last value).
     *   - dp_inv_5: NaN/Infinity → return NaN (caller MUST skip).
     */
    _solveParam(residualOrAst, paramName, mathX, mathY, initial, iters = 5, opts = {}) {
      const X_UNSTABLE = 1e-6;
      const EPS = 1e-3;
      const D_THRESHOLD = 1e-5;
      const MAX_STEP = 1e6; // dp_inv_6: divergence guard
      if (!Number.isFinite(mathX) || !Number.isFinite(mathY)) return NaN;
      const baseEnv = this._buildEnv();
      // 2026-08-16: приймає або функцію нев'язки (x, y, a) → число (так шле
      // _findParamDragCandidate — і для явних, і для неявних кривих), або, для
      // сумісності зі старими викликами, AST явної кривої y = f(x, a).
      const fromAst = typeof residualOrAst !== 'function';
      const residual = fromAst
        ? (x, y, aa) => evalAst(residualOrAst, { ...baseEnv, x, [paramName]: aa }) - y
        : residualOrAst;
      // dp_inv_1: refuse to solve у unstable X-zone (param dominates: a = y/x → ∞).
      // Стосується ЯВНИХ y = f(x, a): при x→0 параметр не визначений. Для
      // неявних F(x,y,a)=0 точка x=0 звичайна (коло, парабола) — не відмовляємо;
      // їхню стійкість стереже D_THRESHOLD на похідній по a нижче. Явність —
      // властивість КРИВОЇ (opts.explicit від кандидата), не типу аргументу.
      const explicit = fromAst || opts.explicit === true;
      if (explicit && Math.abs(mathX) < X_UNSTABLE) return NaN;
      let a = Number.isFinite(initial) ? initial : 1;
      for (let i = 0; i < iters; i++) {
        let f0, f1;
        try {
          f0 = residual(mathX, mathY, a);
          f1 = residual(mathX, mathY, a + EPS);
        } catch (_) { return NaN; }
        // dp_inv_6: non-smooth / undefined evaluation (e.g. floor, abs at
        // discontinuity) → caller MUST skip. f0/f1 not finite → NaN signal.
        if (!Number.isFinite(f0) || !Number.isFinite(f1)) return NaN;
        const d = (f1 - f0) / EPS;
        // dp_inv_2: low derivative → caller skips emit (NaN signal)
        if (!Number.isFinite(d) || Math.abs(d) < D_THRESHOLD) {
          return NaN;
        }
        const step = f0 / d;
        // dp_inv_6: divergence guard — Newton step exploded (e.g. derivative
        // spike at discontinuity, near-singular point). NaN signal stops emit.
        if (!Number.isFinite(step) || Math.abs(step) > MAX_STEP) return NaN;
        const next = a - step;
        if (!Number.isFinite(next)) return NaN;
        a = next;
      }
      return Number.isFinite(a) ? a : NaN;
    }

    _hitTestPoint(px, py) {
      // Reverse iterate so that visually top-most point wins ties.
      const ids = Object.keys(this.points);
      const r2 = (10 * (this._dpr || 1)) ** 2; // 10px radius hit area
      // Build env for onCurve y-derivation.
      const env = { ...CONSTS };
      for (const k of Object.keys(this.params)) {
        const pp = this.params[k];
        if (pp && typeof pp === 'object' && Number.isFinite(pp.value)) env[k] = pp.value;
        else if (typeof pp === 'number' && Number.isFinite(pp)) env[k] = pp;
      }
      for (let i = ids.length - 1; i >= 0; i--) {
        const id = ids[i];
        const p = this.points[id];
        if (!p || !Number.isFinite(p.x)) continue;
        let y = p.y;
        if (p.mode === 'onCurve' && p.curveExprId) {
          const expr = this.expressions.find((e) => e.id === p.curveExprId);
          if (expr && expr.classified && expr.classified.kind === 'explicitY') {
            try { y = evalAst(expr.classified.ast, { ...env, x: p.x }); }
            catch (_) { continue; }
          } else continue;
        }
        if (!Number.isFinite(y)) continue;
        const m = this._mathToPx(p.x, y);
        const dx = m.x - px, dy = m.y - py;
        if (dx * dx + dy * dy <= r2) return id;
      }
      return null;
    }

    _drawInteractivePoint(id, p, env) {
      const ctx = this.ctx;
      if (!Number.isFinite(p.x)) return;
      let y = p.y;
      // mode='onCurve': Y derived from curveExprId at render time.
      // NEVER read p.y for onCurve (per HARD review: y NOT stored).
      if (p.mode === 'onCurve' && p.curveExprId) {
        const expr = this.expressions.find((e) => e.id === p.curveExprId);
        if (expr && expr.classified && expr.classified.kind === 'explicitY') {
          try {
            y = evalAst(expr.classified.ast, { ...env, x: p.x });
          } catch (_) { return; }  // eval fail (param missing etc.) → skip
        } else {
          return;  // curve missing or not explicitY — point unrenderable
        }
      }
      if (!Number.isFinite(y)) return;
      const px = this._mathToPx(p.x, y);
      const r = 7 * (this._dpr || 1);
      ctx.save();
      ctx.beginPath();
      ctx.arc(px.x, px.y, r, 0, Math.PI * 2);
      ctx.fillStyle = p.mode === 'onCurve' ? '#3b7b9b' : '#c4622a';
      ctx.strokeStyle = '#fffaf0';
      ctx.lineWidth = 2 * (this._dpr || 1);
      ctx.fill();
      ctx.stroke();
      // Coordinate label
      ctx.fillStyle = '#2b2118';
      ctx.font = `${11 * (this._dpr || 1)}px JetBrains Mono, monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      const fmt = (n) => Math.abs(n) < 1e-10 ? '0' : (Math.round(n * 100) / 100).toString();
      ctx.fillText(`(${fmt(p.x)}, ${fmt(y)})`,
        px.x + r + 3 * (this._dpr || 1), px.y - r);
      ctx.restore();
    }

    _niceStep(rangeUnits) {
      // Choose a "nice" step for grid based on units visible across canvas
      const target = rangeUnits / 10; // ~10 major lines
      const exp = Math.floor(Math.log10(target));
      const f = target / Math.pow(10, exp);
      let nice;
      if (f < 1.5) nice = 1;
      else if (f < 3.5) nice = 2;
      else if (f < 7.5) nice = 5;
      else nice = 10;
      return nice * Math.pow(10, exp);
    }

    _drawGrid() {
      const ctx = this.ctx;
      const w = this.canvas.width, h = this.canvas.height;
      const view = this.viewport;
      const xRange = w / view.scale, yRange = h / view.scale;
      const step = this._niceStep(xRange);
      const minor = step / 5;
      const x0 = this.viewport.cx - xRange/2, x1 = this.viewport.cx + xRange/2;
      const y0 = this.viewport.cy - yRange/2, y1 = this.viewport.cy + yRange/2;

      // Minor
      ctx.strokeStyle = this.opts.gridMinor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const startMx = Math.ceil(x0/minor)*minor, endMx = Math.floor(x1/minor)*minor;
      for (let x = startMx; x <= endMx + 1e-9; x += minor) {
        const px = this._mathToPx(x, 0).x;
        ctx.moveTo(px, 0); ctx.lineTo(px, h);
      }
      const startMy = Math.ceil(y0/minor)*minor, endMy = Math.floor(y1/minor)*minor;
      for (let y = startMy; y <= endMy + 1e-9; y += minor) {
        const py = this._mathToPx(0, y).y;
        ctx.moveTo(0, py); ctx.lineTo(w, py);
      }
      ctx.stroke();

      // Major
      ctx.strokeStyle = this.opts.gridMajor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const startX = Math.ceil(x0/step)*step, endX = Math.floor(x1/step)*step;
      for (let x = startX; x <= endX + 1e-9; x += step) {
        const px = this._mathToPx(x, 0).x;
        ctx.moveTo(px, 0); ctx.lineTo(px, h);
      }
      const startY = Math.ceil(y0/step)*step, endY = Math.floor(y1/step)*step;
      for (let y = startY; y <= endY + 1e-9; y += step) {
        const py = this._mathToPx(0, y).y;
        ctx.moveTo(0, py); ctx.lineTo(w, py);
      }
      ctx.stroke();

      this._gridStep = step;
    }

    _drawAxes() {
      const ctx = this.ctx;
      const w = this.canvas.width, h = this.canvas.height;
      const o = this._mathToPx(0, 0);
      ctx.strokeStyle = this.opts.axis;
      // P1 (2026-05-08): 1.5*dpr → 1.0*dpr — axis is hierarchy-2, not -1.
      ctx.lineWidth = 1.0 * (this._dpr || 1);
      ctx.beginPath();
      ctx.moveTo(0, o.y); ctx.lineTo(w, o.y);
      ctx.moveTo(o.x, 0); ctx.lineTo(o.x, h);
      ctx.stroke();

      // Tick labels
      ctx.fillStyle = this.opts.axisLabel;
      ctx.font = `${11*(this._dpr||1)}px JetBrains Mono, monospace`;
      ctx.textBaseline = 'top';
      const step = this._gridStep || 1;
      const xRange = w / this.viewport.scale, yRange = h / this.viewport.scale;
      const x0 = this.viewport.cx - xRange/2, x1 = this.viewport.cx + xRange/2;
      const y0 = this.viewport.cy - yRange/2, y1 = this.viewport.cy + yRange/2;
      const fmt = (n) => {
        const r = Math.round(n / step) * step;
        return Math.abs(r) < 1e-10 ? '' : (Math.abs(r) >= 1000 || (Math.abs(r) < 0.01 && r !== 0) ? r.toExponential(1) : r.toString().replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, ''));
      };
      ctx.textAlign = 'center';
      const startX = Math.ceil(x0/step)*step, endX = Math.floor(x1/step)*step;
      for (let x = startX; x <= endX + 1e-9; x += step) {
        if (Math.abs(x) < 1e-10) continue;
        const px = this._mathToPx(x, 0).x;
        const py = Math.max(2, Math.min(h - 14*(this._dpr||1), o.y + 4*(this._dpr||1)));
        ctx.fillText(fmt(x), px, py);
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const startY = Math.ceil(y0/step)*step, endY = Math.floor(y1/step)*step;
      for (let y = startY; y <= endY + 1e-9; y += step) {
        if (Math.abs(y) < 1e-10) continue;
        const py = this._mathToPx(0, y).y;
        const px = Math.max(20*(this._dpr||1), Math.min(w - 4*(this._dpr||1), o.x - 4*(this._dpr||1)));
        ctx.fillText(fmt(y), px, py);
      }
      // Origin label
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText('0', o.x - 4*(this._dpr||1), o.y + 4*(this._dpr||1));
    }

    _drawExplicitY(ast, env, color) {
      const ctx = this.ctx;
      const w = this.canvas.width;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * (this._dpr || 1);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      let prev = null;
      const samples = Math.max(200, Math.floor(w / (this._dpr || 1)));
      for (let i = 0; i <= samples; i++) {
        const px = (i / samples) * w;
        const m = this._pxToMath(px, 0);
        let y;
        try { y = evalAst(ast, { ...env, x: m.x }); } catch (_) { y = NaN; }
        if (!Number.isFinite(y)) { prev = null; continue; }
        const p = this._mathToPx(m.x, y);
        // Skip wild jumps (e.g., tan asymptote): if dy >> visible height, break
        if (prev && Math.abs(p.y - prev.y) > this.canvas.height * 0.6) {
          ctx.moveTo(p.x, p.y);
        } else if (!prev) {
          ctx.moveTo(p.x, p.y);
        } else {
          ctx.lineTo(p.x, p.y);
        }
        prev = p;
      }
      ctx.stroke();
    }
    _drawExplicitX(ast, env, color) {
      const ctx = this.ctx;
      const h = this.canvas.height;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * (this._dpr || 1);
      ctx.beginPath();
      let prev = null;
      const samples = Math.max(200, Math.floor(h / (this._dpr || 1)));
      for (let i = 0; i <= samples; i++) {
        const py = (i / samples) * h;
        const m = this._pxToMath(0, py);
        let x;
        try { x = evalAst(ast, { ...env, y: m.y }); } catch (_) { x = NaN; }
        if (!Number.isFinite(x)) { prev = null; continue; }
        const p = this._mathToPx(x, m.y);
        if (prev && Math.abs(p.x - prev.x) > this.canvas.width * 0.6) ctx.moveTo(p.x, p.y);
        else if (!prev) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        prev = p;
      }
      ctx.stroke();
    }

    // Marching squares for f(x,y)=0
    _drawImplicit(lhs, rhs, env, color) {
      const ctx = this.ctx;
      const w = this.canvas.width, h = this.canvas.height;
      const cellPx = 8 * (this._dpr || 1); // grid cell size in pixels
      const cols = Math.ceil(w / cellPx) + 1;
      const rows = Math.ceil(h / cellPx) + 1;
      const f = new Float32Array(cols * rows);
      const evalF = (x, y) => {
        const e = { ...env, x, y };
        try {
          const a = evalAst(lhs, e), b = evalAst(rhs, e);
          if (!Number.isFinite(a) || !Number.isFinite(b)) return NaN;
          return a - b;
        } catch (_) { return NaN; }
      };
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const px = i * cellPx, py = j * cellPx;
          const m = this._pxToMath(px, py);
          f[j*cols + i] = evalF(m.x, m.y);
        }
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * (this._dpr || 1);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();

      const interp = (px1, py1, v1, px2, py2, v2) => {
        const t = v1 / (v1 - v2);
        return [px1 + (px2 - px1) * t, py1 + (py2 - py1) * t];
      };

      for (let j = 0; j < rows - 1; j++) {
        for (let i = 0; i < cols - 1; i++) {
          const tl = f[j*cols + i];
          const tr = f[j*cols + i + 1];
          const br = f[(j+1)*cols + i + 1];
          const bl = f[(j+1)*cols + i];
          if (!Number.isFinite(tl) || !Number.isFinite(tr) || !Number.isFinite(br) || !Number.isFinite(bl)) continue;
          // Skip cells where the range is too large (likely crossing a discontinuity, not a zero)
          const maxAbs = Math.max(Math.abs(tl), Math.abs(tr), Math.abs(br), Math.abs(bl));
          const minAbs = Math.min(Math.abs(tl), Math.abs(tr), Math.abs(br), Math.abs(bl));
          if (maxAbs > 1e6) continue;
          let mask = 0;
          if (tl > 0) mask |= 1;
          if (tr > 0) mask |= 2;
          if (br > 0) mask |= 4;
          if (bl > 0) mask |= 8;
          if (mask === 0 || mask === 15) continue;
          const x0 = i*cellPx, y0 = j*cellPx, x1 = (i+1)*cellPx, y1 = (j+1)*cellPx;
          // Edge midpoints (linear interp)
          const eTop = () => interp(x0, y0, tl, x1, y0, tr);
          const eRight = () => interp(x1, y0, tr, x1, y1, br);
          const eBottom = () => interp(x0, y1, bl, x1, y1, br);
          const eLeft = () => interp(x0, y0, tl, x0, y1, bl);
          const seg = (a, b) => { ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); };
          switch (mask) {
            case 1: case 14: seg(eLeft(), eTop()); break;
            case 2: case 13: seg(eTop(), eRight()); break;
            case 3: case 12: seg(eLeft(), eRight()); break;
            case 4: case 11: seg(eRight(), eBottom()); break;
            case 5: { // ambiguous
              const center = (tl + tr + br + bl) / 4;
              if (center > 0) { seg(eLeft(), eTop()); seg(eRight(), eBottom()); }
              else { seg(eLeft(), eBottom()); seg(eTop(), eRight()); }
              break;
            }
            case 6: case 9: seg(eTop(), eBottom()); break;
            case 7: case 8: seg(eLeft(), eBottom()); break;
            case 10: {
              const center = (tl + tr + br + bl) / 4;
              if (center > 0) { seg(eTop(), eRight()); seg(eLeft(), eBottom()); }
              else { seg(eLeft(), eTop()); seg(eRight(), eBottom()); }
              break;
            }
          }
        }
      }
      ctx.stroke();
    }

    _drawPoint(ast, env, color) {
      const ctx = this.ctx;
      const [mx, my] = evalAst(ast, env);
      if (!Number.isFinite(mx) || !Number.isFinite(my)) return;
      const p = this._mathToPx(mx, my);
      const r = 5 * (this._dpr || 1);
      ctx.fillStyle = color;
      ctx.strokeStyle = '#fffaf0';
      ctx.lineWidth = 2 * (this._dpr || 1);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      // Coordinate label
      ctx.fillStyle = '#2b2118';
      ctx.font = `${11*(this._dpr||1)}px JetBrains Mono, monospace`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      const fmt = (n) => Math.abs(n) < 1e-10 ? '0' : (Math.round(n*100)/100).toString();
      ctx.fillText(`(${fmt(mx)}, ${fmt(my)})`, p.x + r + 3*(this._dpr||1), p.y - r);
    }

    destroy() {
      try { this._ro && this._ro.disconnect(); } catch(_) {}
      if (this._raf) cancelAnimationFrame(this._raf);
      // Phase G fix: also cancel animation rAF (memory leak)
      if (this._animRaf) cancelAnimationFrame(this._animRaf);
      this._raf = null;
      this._animRaf = null;
      this.container.innerHTML = '';
    }
  }

  // Phase G: ESM exports + backward-compat window globals (for vanilla
  // demo / card.js that uses `new window.GraphCalculator(plot)`).
  if (typeof window !== 'undefined') {
    window.GraphCalculator = GraphCalculator;
    window.GraphCalc = { parse, classify, evalAst, freeVars, FUNCS, CONSTS };
  }
  return { GraphCalculator, GraphCalc: { parse, classify, evalAst, freeVars, FUNCS, CONSTS } };
})();

export const GraphCalculator = __GC.GraphCalculator;
export const GraphCalc = __GC.GraphCalc;
export default GraphCalculator;

// Graph Calculator — engine: parser, evaluator, canvas renderer
// Supports: y = f(x), x = f(y), bare expressions (x^2 → y = x^2),
//           implicit equations f(x,y) = g(x,y),
//           parameters with sliders (a = 1), points (2, 3).
// Drawn on HTMLCanvas. Marching squares for implicit curves.
(function () {
  // ---------- Tokenizer ----------------------------------------------------
  const TOKENS = {
    NUM: 'NUM', IDENT: 'IDENT', OP: 'OP', LP: 'LP', RP: 'RP',
    COMMA: 'COMMA', COLON: 'COLON', EQ: 'EQ', REL: 'REL', LBRACE: 'LBRACE', RBRACE: 'RBRACE', LBRACK: 'LBRACK', RBRACK: 'RBRACK', LOGIC: 'LOGIC', END: 'END', STR: 'STR',
  };
  const SUPER = { '\u2070':'0','\u00b9':'1','\u00b2':'2','\u00b3':'3','\u2074':'4','\u2075':'5','\u2076':'6','\u2077':'7','\u2078':'8','\u2079':'9' };
  const MAX_SUM_ITERATIONS = 5000;
  const MAX_RECURSION_DEPTH = 1000;
  // Edge §8: reserved JS property names — must not be used as param/variable names
  const _RESERVED = new Set(['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', '__defineGetter__', '__defineSetter__']);
  function tokenize(src) {
    // normalise common unicode math glyphs so users can paste pretty formulas
    src = src.replace(/[\u00b7\u00d7\u2219\u22c5]/g, '*').replace(/\u00f7/g, '/').replace(/[\u2212\u2013\u2014]/g, '-');
    src = src.replace(/\u03a3/g, 'sum').replace(/\u03a0/g, 'product');
    const out = []; let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (SUPER[c]) {
        let j = i, s = '';
        while (j < src.length && SUPER[src[j]]) { s += SUPER[src[j]]; j++; }
        out.push({ t: TOKENS.OP, v: '^' }); out.push({ t: TOKENS.NUM, v: parseFloat(s) }); i = j; continue;
      }
      if (/[0-9.]/.test(c)) {
        let j = i; while (j < src.length && /[0-9.]/.test(src[j])) j++;
        out.push({ t: TOKENS.NUM, v: parseFloat(src.slice(i, j)) }); i = j; continue;
      }
      if (/[a-zA-Zα-ωА-Яа-яπτ_]/.test(c)) {
        let j = i; while (j < src.length && /[a-zA-Zα-ωА-Яа-я0-9_]/.test(src[j])) j++;
        const w = src.slice(i, j); i = j;
        if (w === 'and' || w === 'or' || w === 'not') out.push({ t: TOKENS.LOGIC, v: w });
        else out.push({ t: TOKENS.IDENT, v: w });
        continue;
      }
      if (c === '(') { out.push({ t: TOKENS.LP }); i++; continue; }
      if (c === ')') { out.push({ t: TOKENS.RP }); i++; continue; }
      if (c === '{') { out.push({ t: TOKENS.LBRACE }); i++; continue; }
      if (c === '}') { out.push({ t: TOKENS.RBRACE }); i++; continue; }
      if (c === ',') { out.push({ t: TOKENS.COMMA }); i++; continue; }
      if (c === ':') { out.push({ t: TOKENS.COLON }); i++; continue; }
      if (c === '&' || c === '∧') { out.push({ t: TOKENS.LOGIC, v: 'and' }); i++; continue; }
      if (c === '|' || c === '∨') { out.push({ t: TOKENS.LOGIC, v: 'or' }); i++; continue; }
      if (c === '¬') { out.push({ t: TOKENS.LOGIC, v: 'not' }); i++; continue; }
      if (c === '≤') { out.push({ t: TOKENS.REL, v: '<=' }); i++; continue; }
      if (c === '≥') { out.push({ t: TOKENS.REL, v: '>=' }); i++; continue; }
      if (c === '<' || c === '>') {
        if (src[i + 1] === '=') { out.push({ t: TOKENS.REL, v: c + '=' }); i += 2; }
        else { out.push({ t: TOKENS.REL, v: c }); i++; }
        continue;
      }
      if (c === '=') { out.push({ t: TOKENS.EQ }); i++; continue; }
      if ('+-*/^!%'.includes(c)) { out.push({ t: TOKENS.OP, v: c }); i++; continue; }
      if (c === "'" && out.length && (out[out.length - 1].t === TOKENS.IDENT || (out[out.length - 1].t === TOKENS.OP && out[out.length - 1].v === "'"))) { out.push({ t: TOKENS.OP, v: "'" }); i++; continue; }
      if (c === '[') { out.push({ t: TOKENS.LBRACK }); i++; continue; }
      if (c === ']') { out.push({ t: TOKENS.RBRACK }); i++; continue; }
      if (c === '"' || c === "'") {
        const q = c; let s = ''; i++;
        while (i < src.length && src[i] !== q) s += src[i++];
        if (i < src.length) i++;
        out.push({ t: TOKENS.STR, v: s }); continue;
      }
      throw new Error(`Невідомий символ \u00ab${c}\u00bb на позиції ${i + 1}`);
    }
    out.push({ t: TOKENS.END }); return out;
  }

  // ---------- Parser (Pratt-style) ----------------------------------------
  // Grammar:
  //   stmt    := assign | implicit
  //   assign  := IDENT '=' expr      (param or function — disambiguated later)
  //   implicit:= expr '=' expr  | expr
  //   expr    := term (('+'|'-') term)*
  //   term    := factor (('*'|'/'|implicit-mult) factor)*
  //   factor  := unary ('^' factor)?
  //   unary   := '-' unary | atom
  //   atom    := NUM | IDENT '(' args ')' | IDENT | '(' expr ')'
  function parse(src) {
    const toks = tokenize(src);
    let p = 0;
    const peek = (k=0) => toks[p+k];
    const eat = (t, v) => {
      const tk = toks[p];
      if (tk.t !== t || (v !== undefined && tk.v !== v)) {
        throw new Error(`Очікувалось ${t}${v?'='+v:''}, отримано ${tk.t}=${tk.v}`);
      }
      p++; return tk;
    };

    function parseExpr() {
      let left = parseTerm();
      while (peek().t === TOKENS.OP && (peek().v === '+' || peek().v === '-')) {
        const op = eat(TOKENS.OP).v;
        const right = parseTerm();
        left = { kind: 'binop', op, left, right };
      }
      return left;
    }
    function parseTerm() {
      let left = parseUnary();
      while (true) {
        const tk = peek();
        if (tk.t === TOKENS.OP && (tk.v === '*' || tk.v === '/' || tk.v === '%')) {
          const op = eat(TOKENS.OP).v;
          const right = parseUnary();
          left = { kind: 'binop', op, left, right };
        } else if (
          // implicit multiplication: 2x, 2(x+1), )(  , x y, )x, x[1,2]
          (tk.t === TOKENS.NUM) ||
          (tk.t === TOKENS.IDENT) ||
          (tk.t === TOKENS.LP) ||
          (tk.t === TOKENS.LBRACK)
        ) {
          // only allow implicit mul if previous token was something that ends a value
          const right = parseUnary();
          left = { kind: 'binop', op: '*', left, right };
        } else break;
      }
      return left;
    }
    function parseUnary() {
      if (peek().t === TOKENS.OP && peek().v === '-') {
        eat(TOKENS.OP); const u = parseUnary();
        return { kind: 'unary', op: '-', arg: u };
      }
      if (peek().t === TOKENS.OP && peek().v === '+') { eat(TOKENS.OP); return parseUnary(); }
      return parseFactor();
    }
    function parseFactor() {
      // power: exponent binds tighter than unary minus, so -x^2 = -(x^2).
      // Right side is parseUnary so 2^-3 and right-associative 2^3^2 both work.
      let base = parsePostfix();
      if (peek().t === TOKENS.OP && peek().v === '^') {
        eat(TOKENS.OP); const exp = parseUnary();
        return { kind: 'binop', op: '^', left: base, right: exp };
      }
      return base;
    }
    function parsePostfix() {
      let node = parseAtom();
      while (peek().t === TOKENS.OP && peek().v === '!') { eat(TOKENS.OP); node = { kind: 'unary', op: '!', arg: node }; }
      return node;
    }
    function parsePiecewise() {
      eat(TOKENS.LBRACE);
      const pieces = []; let elseNode = null;
      const tryCond = () => {
        const save = p;
        if (peek().t === TOKENS.LOGIC && peek().v === 'not') return parseBoolFrom(parseBoolFactor(), false);
        const e = parseExpr();
        if (peek().t === TOKENS.REL) {
          const operands = [e]; const ops = [];
          while (peek().t === TOKENS.REL) { ops.push(eat(TOKENS.REL).v); operands.push(parseExpr()); }
          return parseBoolFrom({ kind: 'cmp', operands, ops }, false);
        }
        p = save; return null;
      };
      do {
        if (peek().t === TOKENS.RBRACE) break;
        const cond = tryCond();
        if (cond) {
          if (peek().t === TOKENS.COLON) { eat(TOKENS.COLON); pieces.push({ cond, val: parseExpr() }); }
          else pieces.push({ cond, val: { kind: 'num', v: 1 } });
        } else {
          elseNode = parseExpr();
        }
      } while (peek().t === TOKENS.COMMA && eat(TOKENS.COMMA));
      eat(TOKENS.RBRACE);
      return { kind: 'piecewise', pieces, elseNode };
    }
    function parseAtom() {
      const tk = peek();
      if (tk.t === TOKENS.LBRACE) return parsePiecewise();
      if (tk.t === TOKENS.LBRACK) {
        eat(TOKENS.LBRACK);
        const items = [];
        if (peek().t !== TOKENS.RBRACK) {
          items.push(parseExpr());
          while (peek().t === TOKENS.COMMA) { eat(TOKENS.COMMA); items.push(parseExpr()); }
        }
        eat(TOKENS.RBRACK);
        return { kind: 'list', items };
      }
      if (tk.t === TOKENS.NUM) { eat(TOKENS.NUM); return { kind: 'num', v: tk.v }; }
      if (tk.t === TOKENS.STR) { eat(TOKENS.STR); return { kind: 'str', v: tk.v }; }
      if (tk.t === TOKENS.IDENT) {
        eat(TOKENS.IDENT);
        let name = tk.v;
        // Σ / Π : sum(i, a, b, expr) / product(i, a, b, expr)
        if ((name === 'sum' || name === 'product') && peek().t === TOKENS.LP) {
          eat(TOKENS.LP);
          const vtk = eat(TOKENS.IDENT);
          eat(TOKENS.COMMA); const start = parseExpr();
          eat(TOKENS.COMMA); const end = parseExpr();
          eat(TOKENS.COMMA); const body = parseExpr();
          eat(TOKENS.RP);
          return { kind: name === 'sum' ? 'sum' : 'product', varName: vtk.v, start, end, body };
        }
        // plot(expr, var, start, end) — графік рекурентної послідовності (точки)
        // integral(f(x), x, a, b) — визначений інтеграл (Сімпсон)
        if (name === 'integral' && peek().t === TOKENS.LP) {
          eat(TOKENS.LP);
          const body = parseExpr(); eat(TOKENS.COMMA);
          const vtk = eat(TOKENS.IDENT);
          eat(TOKENS.COMMA); const start = parseExpr();
          eat(TOKENS.COMMA); const end = parseExpr();
          eat(TOKENS.RP);
          return { kind: 'integral', varName: vtk.v, start, end, body };
        }
        if (name === 'plot' && peek().t === TOKENS.LP) {
          eat(TOKENS.LP);
          const body = parseExpr();
          eat(TOKENS.COMMA); const vtk = eat(TOKENS.IDENT);
          eat(TOKENS.COMMA); const start = parseExpr();
          eat(TOKENS.COMMA); const end = parseExpr();
          eat(TOKENS.RP);
          return { kind: 'sequencePlot', varName: vtk.v, start, end, body };
        }
        // mandelbrot() / mandelbrot(cx,cy,zoom) — множина Мандельброта
        if (name === 'mandelbrot' && peek().t === TOKENS.LP) {
          eat(TOKENS.LP);
          const args = [];
          if (peek().t !== TOKENS.RP) { args.push(parseExpr()); while (peek().t === TOKENS.COMMA) { eat(TOKENS.COMMA); args.push(parseExpr()); } }
          eat(TOKENS.RP);
          return { kind: 'mandelbrot', args };
        }
        // julia(cx, cy) — множина Юлії з параметром c=(cx,cy)
        if (name === 'julia' && peek().t === TOKENS.LP) {
          eat(TOKENS.LP);
          const args = [];
          if (peek().t !== TOKENS.RP) { args.push(parseExpr()); while (peek().t === TOKENS.COMMA) { eat(TOKENS.COMMA); args.push(parseExpr()); } }
          eat(TOKENS.RP);
          return { kind: 'julia', args };
        }
        // burningship() — множина Burning Ship
        if (name === 'burningship' && peek().t === TOKENS.LP) {
          eat(TOKENS.LP); eat(TOKENS.RP);
          return { kind: 'burningship', args: [] };
        }
        // tricorn() — Tricorn (Mandelbar)
        if (name === 'tricorn' && peek().t === TOKENS.LP) {
          eat(TOKENS.LP); eat(TOKENS.RP);
          return { kind: 'tricorn', args: [] };
        }
        // multibrot(n) — Multibrot степеня n
        if (name === 'multibrot' && peek().t === TOKENS.LP) {
          eat(TOKENS.LP);
          const args = [peek().t !== TOKENS.RP ? parseExpr() : { kind: 'num', v: 3 }];
          eat(TOKENS.RP); // L-01: removed spurious eat(COMMA) that silently dropped 2nd arg
          return { kind: 'multibrot', args };
        }
        // lsystem("аксіома", "правило", n[, angle[, startAngle]]) — L-система
        if (name === 'lsystem' && peek().t === TOKENS.LP) {
          eat(TOKENS.LP);
          const axiomNode = parseExpr(); eat(TOKENS.COMMA);
          const rulesNode = parseExpr(); eat(TOKENS.COMMA);
          const itersNode = parseExpr();
          let angleNode = { kind: 'num', v: 90 }, startAngleNode = null;
          if (peek().t === TOKENS.COMMA) { eat(TOKENS.COMMA); angleNode = parseExpr(); }
          if (peek().t === TOKENS.COMMA) { eat(TOKENS.COMMA); startAngleNode = parseExpr(); }
          eat(TOKENS.RP);
          return { kind: 'lsystem', axiomNode, rulesNode, itersNode, angleNode, startAngleNode };
        }
        // koch(n) — крива Коха (60°)
        if (name === 'koch' && peek().t === TOKENS.LP) {
          eat(TOKENS.LP); const itersNode = parseExpr(); eat(TOKENS.RP);
          return { kind:'lsystem', axiomNode:{kind:'str',v:'F'}, rulesNode:{kind:'str',v:'F->F+F--F+F'}, itersNode, angleNode:{kind:'num',v:60}, startAngleNode:null };
        }
        // dragon(n) — дракон Гайвея (90°)
        if (name === 'dragon' && peek().t === TOKENS.LP) {
          eat(TOKENS.LP); const itersNode = parseExpr(); eat(TOKENS.RP);
          return { kind:'lsystem', axiomNode:{kind:'str',v:'FX'}, rulesNode:{kind:'str',v:'X->X+YF+;Y->-FX-Y'}, itersNode, angleNode:{kind:'num',v:90}, startAngleNode:null };
        }
        // sierpinski(n) — Трикутник Серпінського (120°)
        if (name === 'sierpinski' && peek().t === TOKENS.LP) {
          eat(TOKENS.LP); const itersNode = parseExpr(); eat(TOKENS.RP);
          return { kind:'lsystem', axiomNode:{kind:'str',v:'F-G-G'}, rulesNode:{kind:'str',v:'F->F-G+F+G-F;G->GG'}, itersNode, angleNode:{kind:'num',v:120}, startAngleNode:null };
        }
        // hilbert(n) — крива Гільберта (90°)
        if (name === 'hilbert' && peek().t === TOKENS.LP) {
          eat(TOKENS.LP); const itersNode = parseExpr(); eat(TOKENS.RP);
          return { kind:'lsystem', axiomNode:{kind:'str',v:'A'}, rulesNode:{kind:'str',v:'A->-BF+AFA+FB-;B->+AF-BFB-FA+'}, itersNode, angleNode:{kind:'num',v:90}, startAngleNode:null };
        }
        // plant(n) — фрактальна рослина (25°, старт вгору)
        if (name === 'plant' && peek().t === TOKENS.LP) {
          eat(TOKENS.LP); const itersNode = parseExpr(); eat(TOKENS.RP);
          return { kind:'lsystem', axiomNode:{kind:'str',v:'X'}, rulesNode:{kind:'str',v:'X->F+[[X]-X]-F[-FX]+X;F->FF'}, itersNode, angleNode:{kind:'num',v:25}, startAngleNode:{kind:'num',v:90} };
        }
        // logarithm with base: log_2, log_10, log_a  → call log(arg, base)
        let logBase = null;
        const lm = /^log_(.+)$/.exec(name);
        if (lm) {
          name = 'log';
          logBase = /^[0-9.]+$/.test(lm[1]) ? { kind: 'num', v: parseFloat(lm[1]) } : { kind: 'ident', name: lm[1] };
        }
        // f'(x), f''(x) — числова похідна користувацької функції
        if (peek().t === TOKENS.OP && peek().v === "'") {
          let order = 0;
          while (peek().t === TOKENS.OP && peek().v === "'") { eat(TOKENS.OP); order++; }
          eat(TOKENS.LP); const darg = parseExpr(); eat(TOKENS.RP);
          return { kind: 'deriv', name, order: Math.min(order, 3), arg: darg };
        }
        if (peek().t === TOKENS.LP) {
          eat(TOKENS.LP);
          const args = [];
          if (peek().t !== TOKENS.RP) {
            args.push(parseExpr());
            while (peek().t === TOKENS.COMMA) { eat(TOKENS.COMMA); args.push(parseExpr()); }
          }
          eat(TOKENS.RP);
          if (logBase) args.push(logBase);
          return { kind: 'call', name, args };
        }
        // log_2 x  — без дужок: застосовується до наступного множника
        if (logBase) return { kind: 'call', name, args: [parseAtom(), logBase] };
        return { kind: 'ident', name: tk.v };
      }
      if (tk.t === TOKENS.LP) {
        eat(TOKENS.LP);
        // Detect tuple (point): (a, b)
        const first = parseExpr();
        if (peek().t === TOKENS.COMMA) {
          eat(TOKENS.COMMA); const second = parseExpr(); eat(TOKENS.RP);
          return { kind: 'tuple', items: [first, second] };
        }
        eat(TOKENS.RP);
        return first;
      }
      throw new Error(`Несподіваний токен: ${tk.t} ${tk.v ?? ''}`);
    }

    // ---- boolean layer: comparisons joined by not / and / or ----
    // A comparison: expr REL expr (REL expr)*  → {kind:'cmp', operands, ops}
    function parseBoolFactor() {
      if (peek().t === TOKENS.LOGIC && peek().v === 'not') { eat(TOKENS.LOGIC); return { kind: 'logic', op: 'not', arg: parseBoolFactor() }; }
      const operands = [parseExpr()]; const ops = [];
      while (peek().t === TOKENS.REL) { ops.push(eat(TOKENS.REL).v); operands.push(parseExpr()); }
      if (!ops.length) throw new Error('Очікувалось порівняння (напр. x > 0)');
      return { kind: 'cmp', operands, ops };
    }
    // 'and' binds tighter than 'or'; inside braces a comma also means 'and'
    function parseAndChain(left, allowComma) {
      const isAnd = () => (peek().t === TOKENS.LOGIC && peek().v === 'and') || (allowComma && peek().t === TOKENS.COMMA);
      while (isAnd()) { if (peek().t === TOKENS.COMMA) eat(TOKENS.COMMA); else eat(TOKENS.LOGIC); const right = parseBoolFactor(); left = { kind: 'logic', op: 'and', left, right }; }
      return left;
    }
    function parseBoolFrom(firstCmp, allowComma) {
      let left = parseAndChain(firstCmp, allowComma);
      while (peek().t === TOKENS.LOGIC && peek().v === 'or') { eat(TOKENS.LOGIC); const right = parseAndChain(parseBoolFactor(), allowComma); left = { kind: 'logic', op: 'or', left, right }; }
      return left;
    }

    // optional trailing domain restrictions: {x>0}{0<y<2}{x<0 or x>2}...
    function parseRestrictions() {
      const list = [];
      while (peek().t === TOKENS.LBRACE) {
        eat(TOKENS.LBRACE);
        const test = parseBoolFrom(parseBoolFactor(), true);
        eat(TOKENS.RBRACE);
        list.push({ test });
      }
      return list;
    }

    const lhs = parseExpr();
    let node;
    if (peek().t === TOKENS.EQ) {
      eat(TOKENS.EQ);
      const rhs = parseExpr();
      node = { kind: 'eq', lhs, rhs };
    } else if (peek().t === TOKENS.REL) {
      // start a comparison chain from lhs, then allow and/or
      const operands = [lhs]; const ops = [];
      while (peek().t === TOKENS.REL) { ops.push(eat(TOKENS.REL).v); operands.push(parseExpr()); }
      const cmp = { kind: 'cmp', operands, ops };
      node = parseBoolFrom(cmp, false);
    } else {
      node = lhs;
    }
    const restrictions = parseRestrictions();
    if (restrictions.length) node.restrictions = restrictions;
    if (peek().t !== TOKENS.END) throw new Error('Залишок після виразу');
    return node;
  }

  // hex (#rrggbb) → rgba(...) string
  function hexRgba(hex, a) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    if (!m) return hex;
    return `rgba(${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)},${a})`;
  }

  // ---------- Evaluator ----------------------------------------------------
  // №13: кутовий режим. 1 = радіани; π/180 = градуси.
  let ANGLE_K = 1;
  function setAngleMode(mode) { ANGLE_K = mode === 'deg' ? Math.PI / 180 : 1; }
  function getAngleMode() { return ANGLE_K === 1 ? 'rad' : 'deg'; }
  const FUNCS = {
    sin: (x) => Math.sin(x * ANGLE_K), cos: (x) => Math.cos(x * ANGLE_K), tan: (x) => Math.tan(x * ANGLE_K),
    sec: (x) => 1 / Math.cos(x * ANGLE_K), csc: (x) => 1 / Math.sin(x * ANGLE_K), cot: (x) => 1 / Math.tan(x * ANGLE_K),
    asin: (x) => Math.asin(x) / ANGLE_K, acos: (x) => Math.acos(x) / ANGLE_K, atan: (x) => Math.atan(x) / ANGLE_K,
    atan2: (y, x) => Math.atan2(y, x) / ANGLE_K,
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs,
    ln: Math.log,
    log: (x, b) => {
      const l10 = Math.log10 ? Math.log10(x) : Math.log(x) / Math.LN10;
      return b === undefined ? l10 : Math.log(x) / Math.log(b);
    },
    log2: (x) => Math.log(x) / Math.LN2,
    exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round,
    sign: Math.sign, max: Math.max, min: Math.min, mod: (a,b) => ((a%b)+b)%b,
    // №5 Статистика (працюють над списками)
    mean:   (L) => Array.isArray(L) ? L.reduce((a,b)=>a+b,0) / L.length : L,
    total:  (L) => Array.isArray(L) ? L.reduce((a,b)=>a+b,0) : L,
    length: (L) => Array.isArray(L) ? L.length : 1,
    median: (L) => {
      if (!Array.isArray(L)) return L;
      const s = [...L].sort((a,b)=>a-b), n = s.length;
      return n % 2 ? s[(n-1)/2] : (s[n/2-1] + s[n/2]) / 2;
    },
    stdev: (L) => {
      if (!Array.isArray(L) || L.length < 2) return 0;
      const m = L.reduce((a,b)=>a+b,0) / L.length;
      return Math.sqrt(L.reduce((a,x)=>a+(x-m)*(x-m),0) / (L.length - 1));
    },
    stdevp: (L) => {
      if (!Array.isArray(L) || !L.length) return 0;
      const m = L.reduce((a,b)=>a+b,0) / L.length;
      return Math.sqrt(L.reduce((a,x)=>a+(x-m)*(x-m),0) / L.length);
    },
    quantile: (L, p) => {
      if (!Array.isArray(L) || !L.length) return NaN;
      const s = [...L].sort((a,b)=>a-b);
      const idx = Math.max(0, Math.min(s.length - 1, p * (s.length - 1)));
      const lo = Math.floor(idx), hi = Math.ceil(idx);
      return s[lo] + (s[hi] - s[lo]) * (idx - lo);
    },
    sort: (L) => Array.isArray(L) ? [...L].sort((a,b)=>a-b) : L,
    normalpdf: (x, mu = 0, s = 1) => Math.exp(-((x-mu)*(x-mu)) / (2*s*s)) / (s * Math.sqrt(2*Math.PI)),
    normaldist: (x, mu = 0, s = 1) => Math.exp(-((x-mu)*(x-mu)) / (2*s*s)) / (s * Math.sqrt(2*Math.PI)),
    normalcdf: (x, mu = 0, s = 1) => {
      // Абрамовіц–Стіган erf-апроксимація (точність ~1e-7)
      const z = (x - mu) / (s * Math.SQRT2);
      const t = 1 / (1 + 0.3275911 * Math.abs(z));
      const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
      return 0.5 * (1 + (z < 0 ? -y : y));
    },
  };
  // Функції, що СПОЖИВАЮТЬ списки цілком (без поелементного broadcast)
  const LIST_FN = new Set(['mean','total','length','median','stdev','stdevp','quantile','sort','min','max']);
  // random: стабільний між рендерами кеш за AST-вузлом
  const RAND_CACHE = new WeakMap();
  const CONSTS = { pi: Math.PI, π: Math.PI, e: Math.E, tau: Math.PI*2, τ: Math.PI*2, NaN, Infinity, Inf: Infinity }; // Edge §8: NaN/Infinity usable in expressions

  // ---------- Least-squares regression ----------
  function solveLinear(A, b) {
    const n = b.length;
    const M = A.map((row, i) => row.concat(b[i]));
    for (let col = 0; col < n; col++) {
      let piv = col;
      for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
      if (Math.abs(M[piv][col]) < 1e-12) return null;
      [M[col], M[piv]] = [M[piv], M[col]];
      for (let r = 0; r < n; r++) {
        if (r === col) continue;
        const f = M[r][col] / M[col][col];
        for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
      }
    }
    return M.map((row, i) => row[n] / row[i]);
  }
  function polyFit(pts, deg) {
    const n = deg + 1;
    const A = Array.from({ length: n }, () => new Array(n).fill(0));
    const b = new Array(n).fill(0);
    for (const [x, y] of pts) {
      const pw = [1];
      for (let k = 1; k <= 2 * deg; k++) pw[k] = pw[k - 1] * x;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) A[i][j] += pw[i + j];
        b[i] += pw[i] * y;
      }
    }
    return solveLinear(A, b); // coeffs[0] + coeffs[1] x + ...
  }
  function rSquared(pts, predict) {
    const ys = pts.map((p) => p[1]);
    const mean = ys.reduce((s, v) => s + v, 0) / ys.length;
    let ssRes = 0, ssTot = 0;
    for (const [x, y] of pts) {
      const yh = predict(x);
      if (!Number.isFinite(yh)) return NaN;
      ssRes += (y - yh) ** 2;
      ssTot += (y - mean) ** 2;
    }
    return ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  }
  function fmtC(v) {
    if (!Number.isFinite(v)) return '?';
    const a = Math.abs(v);
    let s = (a >= 1e4 || (a < 1e-3 && a > 0)) ? v.toExponential(3) : (Math.round(v * 10000) / 10000).toString();
    return s;
  }
  // type: linear|quadratic|cubic|exponential|logarithmic|power
  function fitRegression(type, rawPts) {
    const pts = rawPts.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (pts.length < 2) return null;
    const sup = (n) => ('' + n).replace(/[-0-9]/g, (d) => ({ '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }[d]));
    let predict, label;
    if (type === 'linear' || type === 'quadratic' || type === 'cubic') {
      const deg = type === 'linear' ? 1 : type === 'quadratic' ? 2 : 3;
      if (pts.length < deg + 1) return null;
      const c = polyFit(pts, deg);
      if (!c) return null;
      predict = (x) => c.reduce((s, ck, k) => s + ck * Math.pow(x, k), 0);
      const terms = [];
      for (let k = c.length - 1; k >= 0; k--) {
        if (k === 0) terms.push(fmtC(c[0]));
        else if (k === 1) terms.push(`${fmtC(c[1])}x`);
        else terms.push(`${fmtC(c[k])}x${sup(k)}`);
      }
      label = 'y = ' + terms.join(' + ').replace(/\+ -/g, '− ');
    } else if (type === 'exponential') {
      // y = a e^{b x}, fit ln y = ln a + b x  (needs y>0)
      const f = pts.filter((p) => p[1] > 0);
      if (f.length < 2) return null;
      const c = polyFit(f.map(([x, y]) => [x, Math.log(y)]), 1);
      if (!c) return null;
      const a = Math.exp(c[0]), b = c[1];
      predict = (x) => a * Math.exp(b * x);
      label = `y = ${fmtC(a)}·e^(${fmtC(b)}x)`;
    } else if (type === 'logarithmic') {
      // y = a + b ln x  (needs x>0)
      const f = pts.filter((p) => p[0] > 0);
      if (f.length < 2) return null;
      const c = polyFit(f.map(([x, y]) => [Math.log(x), y]), 1);
      if (!c) return null;
      predict = (x) => x > 0 ? c[0] + c[1] * Math.log(x) : NaN;
      label = `y = ${fmtC(c[0])} + ${fmtC(c[1])}·ln(x)`.replace(/\+ -/g, '− ');
    } else if (type === 'power') {
      // y = a x^b, fit ln y = ln a + b ln x  (needs x>0, y>0)
      const f = pts.filter((p) => p[0] > 0 && p[1] > 0);
      if (f.length < 2) return null;
      const c = polyFit(f.map(([x, y]) => [Math.log(x), Math.log(y)]), 1);
      if (!c) return null;
      const a = Math.exp(c[0]), b = c[1];
      predict = (x) => x > 0 ? a * Math.pow(x, b) : NaN;
      label = `y = ${fmtC(a)}·x^(${fmtC(b)})`;
    } else {
      return null;
    }
    return { predict, label, r2: rSquared(pts, predict) };
  }

  // Gamma (Lanczos) so factorial works for non-integers too: x! = Г(x+1)
  function gammaFn(z) {
    const g = 7;
    const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaFn(1 - z));
    z -= 1; let x = c[0];
    for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
    const t = z + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
  }
  function factorial(x) {
    if (!Number.isFinite(x)) return NaN;
    if (x >= 0 && Math.abs(x - Math.round(x)) < 1e-9) {
      let r = 1; const n = Math.round(x); for (let k = 2; k <= n; k++) r *= k; return r;
    }
    return gammaFn(x + 1);
  }

  // Extract an integer literal from a node (handles unary minus). null if not an int literal.
  function intLiteral(node) {
    if (!node) return null;
    if (node.kind === 'num' && Number.isFinite(node.v) && Math.abs(node.v - Math.round(node.v)) < 1e-9) return Math.round(node.v);
    if (node.kind === 'unary' && node.op === '-' && node.arg && node.arg.kind === 'num') {
      const v = -node.arg.v; if (Math.abs(v - Math.round(v)) < 1e-9) return Math.round(v);
    }
    return null;
  }

  // Evaluate a recursive-sequence call name(arg) with base cases + memoized general body.
  function evalSeq(seq, name, arg, env) {
    const k = Math.round(arg);
    if (!Number.isFinite(k)) return NaN;
    let caches = env.__seqCache;
    if (!caches) caches = env.__seqCache = {};
    let cache = caches[name];
    if (!cache) cache = caches[name] = new Map();
    if (cache.has(k)) return cache.get(k);
    const depth = env.__seqDepth || 0;
    if (depth > MAX_RECURSION_DEPTH) throw new Error(`Забагато рекурсії (>${MAX_RECURSION_DEPTH})`);
    let val;
    if (seq.bases.has(k)) {
      val = evalAst(seq.bases.get(k), env);
    } else if (seq.body) {
      const child = Object.assign({}, env);
      child[seq.param] = k;
      child.__seqDepth = depth + 1;
      val = evalAst(seq.body, child);
    } else {
      val = NaN;
    }
    cache.set(k, val);
    return val;
  }

  // Broadcasting для списків (Desmos-style): скаляр⊕список → список поелементно
  function __bc1(v, f) { return Array.isArray(v) ? v.map(f) : f(v); }
  function __bc2(a, b, f) {
    const la = Array.isArray(a), lb = Array.isArray(b);
    if (!la && !lb) return f(a, b);
    const n = la && lb ? Math.min(a.length, b.length) : (la ? a.length : b.length);
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = f(la ? a[i] : a, lb ? b[i] : b);
    return out;
  }

  function evalAst(node, env) {
    switch (node.kind) {
      case 'num': return node.v;
      case 'ident':
        if (Object.prototype.hasOwnProperty.call(env, node.name)) return env[node.name]; // Edge §8: no inherited-property access
        if (node.name in CONSTS) return CONSTS[node.name];
        throw new Error(`Невідома змінна: ${node.name}`);
      case 'unary': {
        const uv = evalAst(node.arg, env);
        if (node.op === '!') return __bc1(uv, factorial);
        return __bc1(uv, (x) => -x);
      }
      case 'binop': {
        const a = evalAst(node.left, env), b = evalAst(node.right, env);
        switch (node.op) {
          case '+': return __bc2(a, b, (p, q) => p + q);
          case '-': return __bc2(a, b, (p, q) => p - q);
          case '*': return __bc2(a, b, (p, q) => p * q);
          case '/': return __bc2(a, b, (p, q) => p / q);
          case '^': return __bc2(a, b, (p, q) => Math.pow(p, q));
          case '%': return __bc2(a, b, (p, q) => ((p % q) + q) % q);
        }
        throw new Error('op?');
      }
      case 'list': return node.items.map((it) => evalAst(it, env));
      case 'deriv': {
        const x0 = evalAst(node.arg, env);
        const callF = (x) => evalAst({ kind: 'call', name: node.name, args: [{ kind: 'num', v: x }] }, env);
        const h = 1e-4;
        const d1 = (x) => (callF(x + h) - callF(x - h)) / (2 * h);
        const d2 = (x) => (callF(x + h) - 2 * callF(x) + callF(x - h)) / (h * h);
        const d3 = (x) => (d2(x + h) - d2(x - h)) / (2 * h);
        const dfn = node.order === 1 ? d1 : node.order === 2 ? d2 : d3;
        return __bc1(x0, dfn);
      }
      case 'integral': {
        const ia = evalAst(node.start, env), ib = evalAst(node.end, env);
        if (!Number.isFinite(ia) || !Number.isFinite(ib)) return NaN;
        const n = 200, hh = (ib - ia) / n;
        if (hh === 0) return 0;
        const child = Object.assign({}, env);
        let s = 0;
        for (let i = 0; i <= n; i++) {
          child[node.varName] = ia + hh * i;
          let v; try { v = evalAst(node.body, child); } catch (_) { v = NaN; }
          const w = (i === 0 || i === n) ? 1 : (i % 2 ? 4 : 2);
          if (Number.isFinite(v)) s += w * v;
        }
        return s * hh / 3;
      }
      case 'call': {
        // random() / random(n) / random(n, a, b) — стабільний до наступної правки виразу
        if (node.name === 'random') {
          const vals = node.args.map((a) => evalAst(a, env));
          const key = JSON.stringify(vals);
          let entry = RAND_CACHE.get(node);
          if (!entry || entry.key !== key) {
            const n = vals[0];
            const lo = vals.length > 1 ? vals[1] : 0;
            const hi = vals.length > 2 ? vals[2] : 1;
            const gen = () => lo + Math.random() * (hi - lo);
            entry = { key, val: (n === undefined) ? gen() : Array.from({length: Math.max(0, Math.min(10000, Math.round(n)))}, gen) };
            RAND_CACHE.set(node, entry);
          }
          return Array.isArray(entry.val) ? entry.val.slice() : entry.val;
        }
        const fn = FUNCS[node.name];
        if (fn && LIST_FN.has(node.name) && node.args.length &&
            node.args.some(a => { const v = evalAst(a, env); return Array.isArray(v); })) {
          return fn(...node.args.map((a) => evalAst(a, env)));
        }
        if (fn) {
          const vals = node.args.map((a) => evalAst(a, env));
          if (vals.some(Array.isArray)) {
            const n = Math.min(...vals.filter(Array.isArray).map((v) => v.length));
            const out = new Array(n);
            for (let i = 0; i < n; i++) out[i] = fn(...vals.map((v) => (Array.isArray(v) ? v[i] : v)));
            return out;
          }
          return fn(...vals);
        }
        const seq = env.__seqs && env.__seqs[node.name];
        if (seq) return evalSeq(seq, node.name, node.args[0] !== undefined ? evalAst(node.args[0], env) : NaN, env);
        const uf = env.__funcs && env.__funcs[node.name];
        if (uf) {
          if ((env.__depth || 0) > 200) throw new Error('Забагато рекурсії');
          const child = Object.assign({}, env);
          child.__depth = (env.__depth || 0) + 1;
          for (let k = 0; k < uf.params.length; k++) child[uf.params[k]] = node.args[k] !== undefined ? evalAst(node.args[k], env) : NaN;
          return evalAst(uf.body, child);
        }
        throw new Error(`Невідома функція: ${node.name}`);
      }
      case 'piecewise': {
        for (const pc of node.pieces) {
          let ok = false;
          try { ok = boolEval(pc.cond, env); } catch (_) { ok = false; }
          if (ok) return evalAst(pc.val, env);
        }
        return node.elseNode != null ? evalAst(node.elseNode, env) : NaN;
      }
      case 'tuple': return node.items.map((it) => evalAst(it, env));
      case 'sum':
      case 'product': {
        const lo = Math.round(evalAst(node.start, env));
        const hi = Math.round(evalAst(node.end, env));
        if (!Number.isFinite(lo) || !Number.isFinite(hi)) return NaN;
        if (hi - lo + 1 > MAX_SUM_ITERATIONS) throw new Error(`Забагато ітерацій (>${MAX_SUM_ITERATIONS})`); // Edge §8: fix off-by-one
        let acc = node.kind === 'sum' ? 0 : 1;
        const child = Object.assign({}, env);
        for (let i = lo; i <= hi; i++) {
          child[node.varName] = i;
          const v = evalAst(node.body, child);
          if (node.kind === 'sum') acc += v; else acc *= v;
        }
        return acc;
      }
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
        case 'list': n.items.forEach(walk); break;
        case 'deriv': walk(n.arg); break;
        case 'sum':
        case 'product':
        case 'integral':
        case 'sequencePlot': {
          walk(n.start); walk(n.end);
          // body's bound variable is local to the sum/product/plot
          freeVars(n.body, new Set([...ignore, n.varName])).forEach((v) => { if (!(v in CONSTS)) out.add(v); });
          break;
        }
        case 'mandelbrot':
        case 'julia':
        case 'burningship':
        case 'tricorn':
        case 'multibrot':
          if (n.args) n.args.forEach(walk);
          break;
        case 'lsystem':
          if (n.itersNode) walk(n.itersNode);
          if (n.angleNode) walk(n.angleNode);
          if (n.startAngleNode) walk(n.startAngleNode);
          break;
        case 'piecewise':
          n.pieces.forEach((pc) => { boolFreeVars(pc.cond).forEach((v) => { if (!(v in CONSTS) && !ignore.has(v)) out.add(v); }); walk(pc.val); });
          if (n.elseNode) walk(n.elseNode);
          break;
      }
    })(node);
    return out;
  }

  // ---------- Complex arithmetic (№ Desmos-gap 6) ----------
  // Значення: { re, im }. Окремий evaluator — не чіпає реальний evalAst.
  const C = {
    of: (re, im) => ({ re, im: im || 0 }),
    add: (a, b) => ({ re: a.re + b.re, im: a.im + b.im }),
    sub: (a, b) => ({ re: a.re - b.re, im: a.im - b.im }),
    mul: (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }),
    div: (a, b) => {
      const d = b.re * b.re + b.im * b.im;
      return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
    },
    abs: (a) => Math.hypot(a.re, a.im),
    arg: (a) => Math.atan2(a.im, a.re),
    exp: (a) => { const r = Math.exp(a.re); return { re: r * Math.cos(a.im), im: r * Math.sin(a.im) }; },
    ln:  (a) => ({ re: Math.log(Math.hypot(a.re, a.im)), im: Math.atan2(a.im, a.re) }),
    pow: (a, b) => {
      if (a.re === 0 && a.im === 0) return (b.re === 0 && b.im === 0) ? C.of(1) : C.of(0);
      return C.exp(C.mul(b, C.ln(a)));
    },
    sin: (a) => ({ re: Math.sin(a.re) * Math.cosh(a.im), im: Math.cos(a.re) * Math.sinh(a.im) }),
    cos: (a) => ({ re: Math.cos(a.re) * Math.cosh(a.im), im: -Math.sin(a.re) * Math.sinh(a.im) }),
    tan: (a) => C.div(C.sin(a), C.cos(a)),
    sinh: (a) => ({ re: Math.sinh(a.re) * Math.cos(a.im), im: Math.cosh(a.re) * Math.sin(a.im) }),
    cosh: (a) => ({ re: Math.cosh(a.re) * Math.cos(a.im), im: Math.sinh(a.re) * Math.sin(a.im) }),
    tanh: (a) => C.div(C.sinh(a), C.cosh(a)),
    sqrt: (a) => C.pow(a, C.of(0.5)),
  };
  const C_FUNCS = {
    exp: C.exp, ln: C.ln, log: C.ln, sqrt: C.sqrt,
    sin: C.sin, cos: C.cos, tan: C.tan, sinh: C.sinh, cosh: C.cosh, tanh: C.tanh,
    abs: (a) => C.of(C.abs(a)), arg: (a) => C.of(C.arg(a)),
    re: (a) => C.of(a.re), im: (a) => C.of(a.im), conj: (a) => C.of(a.re, -a.im),
  };
  function evalComplex(node, env) {
    switch (node.kind) {
      case 'num': return C.of(node.v);
      case 'ident': {
        if (node.name === 'i') return C.of(0, 1);
        if (node.name === 'z' && env.__z) return env.__z;
        if (node.name in CONSTS) return C.of(CONSTS[node.name]);
        if (Object.prototype.hasOwnProperty.call(env, node.name)) {
          const v = env[node.name];
          return (v && typeof v === 'object' && 're' in v) ? v : C.of(v);
        }
        throw new Error('Невідома змінна: ' + node.name);
      }
      case 'unary': {
        const a = evalComplex(node.arg, env);
        if (node.op === '!') throw new Error('n! недоступний для комплексних');
        return C.of(-a.re, -a.im);
      }
      case 'binop': {
        const a = evalComplex(node.left, env), b = evalComplex(node.right, env);
        switch (node.op) {
          case '+': return C.add(a, b);
          case '-': return C.sub(a, b);
          case '*': return C.mul(a, b);
          case '/': return C.div(a, b);
          case '^': return C.pow(a, b);
        }
        throw new Error('op?');
      }
      case 'call': {
        const f = C_FUNCS[node.name];
        if (f) return f(evalComplex(node.args[0], env));
        throw new Error('Функція ' + node.name + ' недоступна для комплексних');
      }
    }
    throw new Error('Комплексний вираз: непідтримувана конструкція');
  }

  // ---------- Formula regression (Desmos-style y ~ f(x, params)) ----------
  // Nelder-Mead мінімізація SSE; повертає { params: {name:val}, r2 }
  function fitFormula(rhsAst, paramNames, pts, baseEnv) {
    const data = pts.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (!data.length || !paramNames.length) return null;
    const n = paramNames.length;
    const sse = (vec) => {
      const env = Object.assign({}, baseEnv);
      for (let i = 0; i < n; i++) env[paramNames[i]] = vec[i];
      let s = 0;
      for (const [px, py] of data) {
        env.x = px;
        let v; try { v = evalAst(rhsAst, env); } catch (_) { return Infinity; }
        if (!Number.isFinite(v)) return Infinity;
        const d = v - py; s += d * d;
      }
      return s;
    };
    // Кілька стартів — формули з exp/степенями чутливі до init
    const starts = [1, 0.1, -1, 5];
    let best = null;
    for (const s0 of starts) {
      const res = nelderMead(sse, new Array(n).fill(s0));
      if (res && (best === null || res.f < best.f)) best = res;
      if (best && best.f < 1e-12) break;
    }
    if (!best || !Number.isFinite(best.f)) return null;
    const mean = data.reduce((a, p) => a + p[1], 0) / data.length;
    const ssTot = data.reduce((a, p) => a + (p[1] - mean) ** 2, 0);
    const r2 = ssTot > 0 ? 1 - best.f / ssTot : (best.f < 1e-9 ? 1 : 0);
    const params = {};
    for (let i = 0; i < n; i++) params[paramNames[i]] = best.x[i];
    return { params, r2, sse: best.f };
  }

  function nelderMead(f, x0, maxIter) {
    const n = x0.length;
    maxIter = maxIter || 250 * n;
    const alpha = 1, gamma = 2, rho = 0.5, sigma = 0.5;
    let simplex = [x0.slice()];
    for (let i = 0; i < n; i++) {
      const p = x0.slice();
      p[i] = p[i] !== 0 ? p[i] * 1.1 : 0.05;
      simplex.push(p);
    }
    let fv = simplex.map(f);
    for (let it = 0; it < maxIter; it++) {
      const ord = fv.map((v, i) => i).sort((a, b) => fv[a] - fv[b]);
      simplex = ord.map((i) => simplex[i]);
      fv = ord.map((i) => fv[i]);
      if (Math.abs(fv[n] - fv[0]) < 1e-12 * (1 + Math.abs(fv[0]))) break;
      const cen = new Array(n).fill(0);
      for (let i = 0; i < n; i++) for (let d = 0; d < n; d++) cen[d] += simplex[i][d] / n;
      const xr = cen.map((c, d) => c + alpha * (c - simplex[n][d]));
      const fr = f(xr);
      if (fr < fv[0]) {
        const xe = cen.map((c, d) => c + gamma * (c - simplex[n][d]));
        const fe = f(xe);
        if (fe < fr) { simplex[n] = xe; fv[n] = fe; } else { simplex[n] = xr; fv[n] = fr; }
      } else if (fr < fv[n - 1]) {
        simplex[n] = xr; fv[n] = fr;
      } else {
        const xc = cen.map((c, d) => c + rho * (simplex[n][d] - c));
        const fc = f(xc);
        if (fc < fv[n]) { simplex[n] = xc; fv[n] = fc; }
        else {
          for (let i = 1; i <= n; i++) {
            simplex[i] = simplex[i].map((v, d) => simplex[0][d] + sigma * (v - simplex[0][d]));
            fv[i] = f(simplex[i]);
          }
        }
      }
    }
    let bi = 0;
    for (let i = 1; i <= n; i++) if (fv[i] < fv[bi]) bi = i;
    return { x: simplex[bi], f: fv[bi] };
  }

  // ---------- Expression model --------------------------------------------
  // Categorize a parsed source into: param | explicitY | explicitX | implicit | point | invalid
  function classifyCore(src, paramNames = []) {
    // Нормалізація: приймаємо масив, Set або об'єкт параметрів
    if (!Array.isArray(paramNames))
      paramNames = paramNames instanceof Set ? [...paramNames] : Object.keys(paramNames || {});
    // № 6: підпис точки — (x, y) "Текст"
    {
      const lm = src.match(/^\s*(\([\s\S]*\))\s*"([^"]*)"\s*$/);
      if (lm) {
        const inner = classifyCore(lm[1], paramNames);
        if (inner.kind === 'point') { inner.label = lm[2]; inner.src = src; return inner; }
        if (inner.kind === 'needsParam') { inner.src = src; inner.pointLabel = lm[2]; return inner; }
      }
    }
    // №10: дія — "a -> вираз" (кілька через кому; одночасне присвоєння)
    {
      let d10 = 0, hasArrow = false;
      for (let i = 0; i < src.length - 1; i++) {
        const ch = src[i];
        if ('([{'.includes(ch)) d10++;
        else if (')]}'.includes(ch)) d10--;
        else if (ch === '-' && src[i + 1] === '>' && d10 === 0) { hasArrow = true; break; }
      }
      if (hasArrow) {
        const parts = [];
        {
          let depth = 0, cur = '';
          for (let i = 0; i < src.length; i++) {
            const ch = src[i];
            if ('([{'.includes(ch)) depth++;
            else if (')]}'.includes(ch)) depth--;
            if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
          }
          parts.push(cur);
        }
        const assigns = [];
        for (const p of parts) {
          const ai = p.indexOf('->');
          if (ai < 0) return { kind: 'invalid', error: 'Дія: очікується name -> вираз', src };
          const name = p.slice(0, ai).trim();
          if (!/^[a-zA-Zα-ω]\w*$/.test(name)) return { kind: 'invalid', error: 'Дія: некоректне ім\'я ' + name, src };
          let rhsA;
          try { rhsA = parse(p.slice(ai + 2).trim()); } catch (err) { return { kind: 'invalid', error: err.message, src }; }
          assigns.push({ name, ast: rhsA });
        }
        return { kind: 'action', assigns, src };
      }
    }
    // №5: histogram(list, binWidth?) / boxplot(list, y?)
    {
      const hm = src.match(/^\s*(histogram|boxplot)\s*\(/);
      if (hm) {
        const oi = src.indexOf('(');
        let ast5;
        try { ast5 = parse(src.slice(oi)); } catch (err) { return { kind: 'invalid', error: err.message, src }; }
        const items = ast5.kind === 'tuple' ? ast5.items : [ast5];
        const fv5 = items.flatMap((a) => [...freeVars(a)]).filter((v) => !paramNames.includes(v));
        if (fv5.length) return { kind: 'needsParam', unknown: [...new Set(fv5)], src, ast: ast5 };
        return { kind: hm[1], args: items, src };
      }
    }
    // domaincolor(f(z)) — розфарбування області комплексної функції
    if (/^\s*(domaincolor|dc)\s*\(/.test(src)) {
      const oi = src.indexOf('(');
      const body = src.slice(oi + 1, src.lastIndexOf(')'));
      let ast2;
      try { ast2 = parse(body); } catch (err) { return { kind: 'invalid', error: err.message, src }; }
      const fv2 = [...freeVars(ast2)].filter((v) => v !== 'z' && v !== 'i' && !paramNames.includes(v));
      if (fv2.length) return { kind: 'needsParam', unknown: fv2, src, ast: ast2, isDomainColor: true };
      return { kind: 'domainColor', ast: ast2, src };
    }
    // Комплексна точка-літерал: 2+3i, (1+i)^2, exp(i pi/4) — без '=' і без x/y
    {
      const hasEq = (() => {
        let d = 0;
        for (let k = 0; k < src.length; k++) {
          const ch = src[k];
          if ('([{'.includes(ch)) d++;
          else if (')]}'.includes(ch)) d--;
          else if (ch === '=' && d === 0 && src[k+1] !== '=' && !'<>!'.includes(src[k-1] || '')) return true;
          else if (ch === '~' && d === 0) return true;
        }
        return false;
      })();
      if (!hasEq && !src.trim().startsWith('(')) {
        let astC = null;
        try { astC = parse(src); } catch (_) {}
        if (astC && astC.kind !== 'tuple') {
          const fvAll = [...freeVars(astC)];
          if (fvAll.includes('i')) {
            const fvC = fvAll.filter((v) => v !== 'i' && !paramNames.includes(v));
            if (!fvC.length) {
              try {
                evalComplex(astC, {}); // перевірка обчислюваності
                return { kind: 'complexPoint', ast: astC, src };
              } catch (_) {}
            }
          }
        }
      }
    }
    // Desmos-style regression: y ~ f(x, params). '~' лише на верхньому рівні.
    {
      let depth = 0, ti = -1;
      for (let i = 0; i < src.length; i++) {
        const ch = src[i];
        if ('([{'.includes(ch)) depth++;
        else if (')]}'.includes(ch)) depth--;
        else if (ch === '~' && depth === 0) { ti = i; break; }
      }
      if (ti >= 0) {
        const lhsS = src.slice(0, ti).trim();
        const rhsS = src.slice(ti + 1).trim();
        if (lhsS !== 'y') return { kind: 'invalid', error: 'Регресія: очікується y ~ формула', src };
        let rhsAst;
        try { rhsAst = parse(rhsS); } catch (err) { return { kind: 'invalid', error: err.message, src }; }
        const known = new Set(paramNames);
        const fitParams = [...freeVars(rhsAst)].filter((v) => v !== 'x' && !known.has(v));
        if (!fitParams.length) return { kind: 'invalid', error: 'Регресія: немає параметрів для підгонки (напр. y ~ a x + b)', src };
        if (fitParams.length > 6) return { kind: 'invalid', error: 'Регресія: занадто багато параметрів (макс 6)', src };
        return { kind: 'fitExpr', ast: rhsAst, fitParams, src };
      }
    }
    let ast;
    try { ast = parse(src); } catch (err) { return { kind: 'invalid', error: err.message, src }; }
    const known = new Set([...Object.keys(CONSTS), ...paramNames]);

    // plot(expr, n, a, b) → графік послідовності
    if (ast.kind === 'sequencePlot') {
      const fv = freeVars(ast.body, new Set([ast.varName]));
      const unknown = [];
      for (const v of fv) if (!known.has(v)) unknown.push(v);
      if (unknown.length) return { kind: 'needsParam', unknown, src, ast };
      return { kind: 'sequencePlot', body: ast.body, varName: ast.varName, start: ast.start, end: ast.end, src };
    }

    // Фрактали: mandelbrot() / julia(cx, cy) / burningship() / tricorn() / multibrot(n)
    if (ast.kind === 'mandelbrot' || ast.kind === 'julia' || ast.kind === 'burningship' || ast.kind === 'tricorn' || ast.kind === 'multibrot') {
      const unknown = [];
      (ast.args || []).forEach((a) => { for (const v of freeVars(a)) if (!known.has(v)) unknown.push(v); });
      if (unknown.length) return { kind: 'needsParam', unknown, src, ast };
      return { kind: 'fractal', type: ast.kind, args: ast.args || [], src };
    }

    // L-системи
    if (ast.kind === 'lsystem') {
      if (ast.axiomNode.kind !== 'str' || ast.rulesNode.kind !== 'str')
        return { kind: 'invalid', error: 'Аксіома і правила — рядки у лапках', src };
      const unknown = [];
      [ast.itersNode, ast.angleNode, ast.startAngleNode].filter(Boolean).forEach((node) => {
        for (const v of freeVars(node)) if (!known.has(v)) unknown.push(v);
      });
      if (unknown.length) return { kind: 'needsParam', unknown, src, ast };
      return { kind: 'lsystem', axiom: ast.axiomNode.v, rules: ast.rulesNode.v,
        itersNode: ast.itersNode, angleNode: ast.angleNode, startAngleNode: ast.startAngleNode || null, src };
    }

    // Single tuple → point  OR  parametric curve (if it depends on t)
    if (ast.kind === 'tuple') {
      const fv = new Set([...freeVars(ast.items[0]), ...freeVars(ast.items[1])]);
      if (fv.has('t')) {
        const unknown = [];
        for (const v of fv) if (v !== 't' && !known.has(v)) unknown.push(v);
        if (unknown.length) return { kind: 'needsParam', unknown, src, ast, parametric: true };
        return { kind: 'parametric', astX: ast.items[0], astY: ast.items[1], src };
      }
      const unknown = [];
      for (const v of fv) if (!known.has(v)) unknown.push(v);
      if (unknown.length) return { kind: 'needsParam', unknown, src, ast };
      return { kind: 'point', ast, src };
    }

    if (ast.kind === 'eq') {
      // f(x) = <expr>  → user-defined function
      if (ast.lhs.kind === 'call') {
        const name = ast.lhs.name;
        // name(<int>) = expr  → base case of a recursive sequence
        if (ast.lhs.args.length === 1) {
          const idx = intLiteral(ast.lhs.args[0]);
          if (idx !== null) {
            const bodyFree = freeVars(ast.rhs);
            const unknown = [];
            for (const v of bodyFree) if (!known.has(v)) unknown.push(v);
            if (unknown.length) return { kind: 'needsParam', unknown, src, ast: ast.rhs, seqName: name, index: idx };
            return { kind: 'seqBase', name, index: idx, ast: ast.rhs, src };
          }
        }
        const params = ast.lhs.args.filter((a) => a.kind === 'ident').map((a) => a.name);
        const bodyFree = freeVars(ast.rhs, new Set(params));
        const unknown = [];
        for (const v of bodyFree) if (!known.has(v)) unknown.push(v);
        if (unknown.length) return { kind: 'needsParam', unknown, src, ast: ast.rhs, funcName: name, funcParams: params };
        return { kind: 'funcDef', name, params, ast: ast.rhs, src };
      }
      // a = <expr>  (param)
      if (ast.lhs.kind === 'ident') {
        const name = ast.lhs.name;
        // If rhs depends on x or y → it's a function definition (treat as explicit)
        const rhsFree = freeVars(ast.rhs);
        const hasX = rhsFree.has('x'), hasY = rhsFree.has('y');
        // Polar: r = f(θ)
        if (name === 'r' || name === 'ρ') {
          const unknown = [];
          for (const v of rhsFree) if (v !== 'θ' && v !== 'theta' && !known.has(v)) unknown.push(v);
          if (unknown.length) return { kind: 'needsParam', unknown, src, ast: ast.rhs, polar: true };
          return { kind: 'polar', ast: ast.rhs, src };
        }
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
          if (_RESERVED.has(name)) return { kind: 'invalid', error: `Зарезервоване ім\'\u044f: ${name}`, src }; // Edge §8: __proto__=1 safe
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
    if (ast.kind === 'cmp' || ast.kind === 'logic') {
      const fv = boolFreeVars(ast);
      const unknown = [];
      for (const v of fv) if (v !== 'x' && v !== 'y' && !known.has(v)) unknown.push(v);
      if (unknown.length) return { kind: 'needsParam', unknown, src, test: ast, isIneq: true };
      // single simple comparison keeps lhs/rhs/op so we can draw a crisp boundary
      if (ast.kind === 'cmp' && ast.ops.length === 1) {
        return { kind: 'inequality', op: ast.ops[0], lhs: ast.operands[0], rhs: ast.operands[1], src };
      }
      return { kind: 'inequality', test: ast, src };
    }
    // Голий вираз без '=' (наприклад `x^2`) → трактуємо як `y = <вираз>`
    // (Desmos-style; те саме у board graph_calculator, 2026-07-15). src НЕ
    // переписуємо. Лише обчислювані вузли; `y` (нема що розв'язувати) та
    // `i` (уявна одиниця — complexPoint-гілка вище) лишаються invalid.
    if (['num', 'ident', 'unary', 'binop', 'call'].includes(ast.kind)) {
      const fv = freeVars(ast);
      if (!fv.has('y') && !fv.has('i')) {
        const unknown = [];
        for (const v of fv) if (v !== 'x' && !known.has(v)) unknown.push(v);
        if (unknown.length) return { kind: 'needsParam', unknown, src, ast, target: 'y' };
        return { kind: 'explicitY', ast, src };
      }
    }
    return { kind: 'invalid', error: 'Очікується рівняння або точка', src };
  }

  // Detect unknown variables in an explicit/point expression and offer them as params
  function _classifyExplicit(src, paramNames = []) {
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

  // P-01: quick structural check — does src define a param/func/seq that affects other expressions?
  function _isStructuralSrc(src) {
    try {
      const ast = parse(src);
      if (ast.kind !== 'eq') return false;
      const lhs = ast.lhs;
      if (lhs.kind === 'call') return true; // funcDef or seqBase
      if (lhs.kind === 'ident') {
        const nm = lhs.name;
        if (nm === 'y' || nm === 'x' || nm === 'r' || nm === 'ρ') return false;
        const rf = freeVars(ast.rhs);
        return !rf.has('x') && !rf.has('y'); // param
      }
      return false;
    } catch (_) { return false; }
  }

  // ---------- EventEmitter (§15) -----------------------------------------
  class EventEmitter {
    constructor() { this._evHandlers = Object.create(null); }
    on(event, fn) {
      (this._evHandlers[event] || (this._evHandlers[event] = [])).push(fn);
      return this;
    }
    off(event, fn) {
      const h = this._evHandlers[event];
      if (h) this._evHandlers[event] = h.filter((f) => f !== fn);
      return this;
    }
    emit(event, data) {
      (this._evHandlers[event] || []).slice().forEach((fn) => { try { fn(data); } catch (_) {} });
      return this;
    }
    once(event, fn) { const w = (d) => { this.off(event, w); fn(d); }; return this.on(event, w); }
  }

  // ---------- Renderer ----------------------------------------------------
  // Math coords ↔ pixel coords helpers held in viewport state.
  class GraphCalculator extends EventEmitter {
    constructor(container, opts = {}) {
      super(); // EventEmitter
      this.container = container;
      this.opts = Object.assign({
        bg: '#ffffff',
        gridMinor: 'rgba(0,0,0,0.06)',
        gridMajor: 'rgba(0,0,0,0.13)',
        axis: '#3c3c3c',
        axisLabel: '#7a7a7a',
        pointHalo: '#ffffff',
        pointLabel: '#3c3c3c',
        labelFont: '12px "Helvetica Neue", Arial, sans-serif',
      }, opts);
      this.expressions = []; // {id, src, color, hidden, classified, paramValue?, paramRange?}
      this.params = {}; // name -> value
      this.userFuncs = {}; // name -> {params, body}
      this.userSeqs = {}; // name -> {param, body, bases:Map<int,ast>}
      this.viewport = { cx: 0, cy: 0, scale: 38 }; // px per math unit
      // Desmos-like curve palette
      this.palette = opts.palette || ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19', '#000000', '#cf5283'];
      this._nextId = 1;
      if (opts.canvas) {
        // §15: OffscreenCanvas or pre-existing canvas — skip DOM/interaction
        this.canvas = opts.canvas;
        this.ctx = this.canvas.getContext('2d');
      } else {
        this._buildDom();
        this._bindInteraction();
      }
      this._scheduleRender();
    }

    // §15: unified notify — fires EventEmitter + backward-compat onChange
    _notify(event) {
      this.emit('change', event);
      if (typeof this.onChange === 'function') this.onChange(event);
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
      // Синхронний resize лише коли контейнер вже має реальний розмір;
      // далі перші ~600мс звіряємо canvas із фактичним розміром контейнера і доганяємо
      if (this.container.clientWidth >= 50 && this.container.clientHeight >= 50) this._resize();
      requestAnimationFrame(() => this._resize());
      let tries = 0;
      const chase = () => {
        if (!this.container.isConnected) return;
        const dpr = this._dpr || 1;
        const wantW = Math.round(this.container.clientWidth * dpr);
        const wantH = Math.round(this.container.clientHeight * dpr);
        if (wantW >= 50 && (Math.abs(this.canvas.width - wantW) > 2 || Math.abs(this.canvas.height - wantH) > 2)) {
          this._resize();
          this._scheduleRender();
        }
        if (++tries < 12) setTimeout(chase, 50);
      };
      setTimeout(chase, 50);
    }

    _resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = this.container.getBoundingClientRect();
      const w = Math.max(40, r.width), h = Math.max(40, r.height);
      this.canvas.width = w * dpr; this.canvas.height = h * dpr;
      this.canvas.style.width = w + 'px'; this.canvas.style.height = h + 'px';
      this._dpr = dpr;
      if (window.FractalRenderer) FractalRenderer.clearCache();
      this._scheduleRender();
    }

    _bindInteraction() {
      this._ac = new AbortController(); // C-02
      const sig = this._ac.signal;

      // §13: detect whether addEventListener supports the `signal` option (Safari < 15 does not)
      let _supportsSignal = false;
      try {
        const _probe = document.createElement('div');
        _probe.addEventListener('_probe', null, { get signal() { _supportsSignal = true; return sig; } });
      } catch (_) {}

      // §13: unified addEventListener wrapper — uses signal when supported, else manual tracking
      this._manualListeners = [];
      const _on = (el, type, fn, opts) => {
        if (_supportsSignal) {
          el.addEventListener(type, fn, { ...(opts || {}), signal: sig });
        } else {
          el.addEventListener(type, fn, opts || {});
          this._manualListeners.push({ el, type, fn });
        }
      };
      // Drain manual listeners on abort (Safari < 15 path)
      sig.addEventListener('abort', () => {
        if (!_supportsSignal) {
          (this._manualListeners || []).forEach(({ el, type, fn }) => el.removeEventListener(type, fn));
          this._manualListeners = [];
        }
      });

      let dragging = false, lx = 0, ly = 0;
      let paramDrag = null; // { expr, name } when Ctrl-dragging a curve

      // §13: detect PointerEvents (Safari < 13 does not support them)
      const hasPointer = typeof window.PointerEvent !== 'undefined';

      if (hasPointer) {
        // ── Modern path: Pointer Events ──────────────────────────────────
        _on(this.canvas, 'pointerdown', (e) => {
          const r = this.canvas.getBoundingClientRect();
          const px = (e.clientX - r.left) * (this._dpr || 1);
          const py = (e.clientY - r.top) * (this._dpr || 1);
          if (e.ctrlKey || e.metaKey) {
            paramDrag = this._pickParamCurve(px, py);
            if (paramDrag) {
              dragging = false;
              try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
              this.canvas.style.cursor = 'ns-resize';
              e.preventDefault();
              return;
            }
          }
          // №12: drag/resize картинки (пріоритет над pan)
          const ihit = this._imageAt(px, py);
          if (ihit) {
            this._imgDrag = { ...ihit, last: this._pxToMath(px, py) };
            this._imgActive = ihit.rec.id;
            dragging = false;
            try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
            this.canvas.style.cursor = ihit.mode === 'resize' ? 'nwse-resize' : 'move';
            this._scheduleRender();
            e.preventDefault();
            return;
          }
          if (this._imgActive) { this._imgActive = null; this._scheduleRender(); }
          dragging = true; lx = e.clientX; ly = e.clientY;
          this._isPanning = true;
          try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
          this.canvas.style.cursor = 'grabbing';
        });
        _on(this.canvas, 'pointermove', (e) => {
          if (this._imgDrag) {
            const r2 = this.canvas.getBoundingClientRect();
            const m = this._pxToMath((e.clientX - r2.left) * (this._dpr || 1), (e.clientY - r2.top) * (this._dpr || 1));
            const d = this._imgDrag;
            if (d.mode === 'move') {
              d.rec.cx += m.x - d.last.x;
              d.rec.cy += m.y - d.last.y;
            } else {
              const nw = Math.max(0.05, 2 * (m.x - d.rec.cx));
              const ratio = d.rec.h / d.rec.w;
              d.rec.w = nw;
              d.rec.h = nw * ratio;
            }
            d.last = m;
            this._scheduleRender();
            return;
          }
          if (paramDrag) {
            const r = this.canvas.getBoundingClientRect();
            const px = (e.clientX - r.left) * (this._dpr || 1);
            const py = (e.clientY - r.top) * (this._dpr || 1);
            this._solveParamAt(paramDrag, this._pxToMath(px, py).x, this._pxToMath(px, py).y);
            return;
          }
          if (!dragging) {
            if (e.ctrlKey || e.metaKey) {
              const r = this.canvas.getBoundingClientRect();
              const hit = this._pickParamCurve((e.clientX - r.left) * (this._dpr || 1), (e.clientY - r.top) * (this._dpr || 1));
              this.canvas.style.cursor = hit ? 'ns-resize' : 'grab';
            } else if (this.canvas.style.cursor === 'ns-resize') {
              this.canvas.style.cursor = 'grab';
            }
            return;
          }
          const dx = (e.clientX - lx) * (this._dpr || 1);
          const dy = (e.clientY - ly) * (this._dpr || 1);
          this.viewport.cx -= dx / this.viewport.scale;
          this.viewport.cy += dy / this.viewport.scale;
          lx = e.clientX; ly = e.clientY;
          this._scheduleRender();
        });
        const _up = (e) => {
          if (this._imgDrag) {
            this._imgDrag = null;
            if (this.onImageChange) this.onImageChange();
          }
          if (dragging) { this._isPanning = false; this._scheduleRender(); }
          if (paramDrag) { this._notify({ reason: 'param' }); } // H-03
          dragging = false; paramDrag = null; this.canvas.style.cursor = 'grab';
          try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        };
        _on(this.canvas, 'pointerup', _up);
        _on(this.canvas, 'pointercancel', _up);
      } else {
        // ── §13 Fallback path: Touch Events (Safari < 13) ────────────────
        let _pinchDist = null; // null = no pinch, number = last dist
        const _touchPt = (t) => {
          const r = this.canvas.getBoundingClientRect();
          return { clientX: t.clientX, clientY: t.clientY,
            px: (t.clientX - r.left) * (this._dpr || 1),
            py: (t.clientY - r.top)  * (this._dpr || 1) };
        };
        _on(this.canvas, 'touchstart', (e) => {
          e.preventDefault();
          if (e.touches.length === 1) {
            const pt = _touchPt(e.touches[0]);
            dragging = true; lx = pt.clientX; ly = pt.clientY;
            this._isPanning = true;
            _pinchDist = null;
          } else if (e.touches.length === 2) {
            dragging = false; _pinchDist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY);
          }
        }, { passive: false });
        _on(this.canvas, 'touchmove', (e) => {
          e.preventDefault();
          if (e.touches.length === 2 && _pinchDist !== null) {
            // Pinch-to-zoom
            const dist = Math.hypot(
              e.touches[0].clientX - e.touches[1].clientX,
              e.touches[0].clientY - e.touches[1].clientY);
            const factor = dist / _pinchDist;
            const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const r = this.canvas.getBoundingClientRect();
            this._zoomAt((mx - r.left) * (this._dpr || 1), (my - r.top) * (this._dpr || 1), factor);
            _pinchDist = dist;
          } else if (e.touches.length === 1 && dragging) {
            const pt = _touchPt(e.touches[0]);
            const dx = (pt.clientX - lx) * (this._dpr || 1);
            const dy = (pt.clientY - ly) * (this._dpr || 1);
            this.viewport.cx -= dx / this.viewport.scale;
            this.viewport.cy += dy / this.viewport.scale;
            lx = pt.clientX; ly = pt.clientY;
            this._scheduleRender();
          }
        }, { passive: false });
        const _touchUp = () => {
          if (dragging) { this._isPanning = false; this._scheduleRender(); }
          dragging = false; _pinchDist = null;
        };
        _on(this.canvas, 'touchend', _touchUp, { passive: true });
        _on(this.canvas, 'touchcancel', _touchUp, { passive: true });
      }

      // Wheel zoom — passive:false required to prevent page scroll
      _on(this.canvas, 'wheel', (e) => {
        e.preventDefault();
        const r = this.canvas.getBoundingClientRect();
        const px = (e.clientX - r.left) * (this._dpr || 1);
        const py = (e.clientY - r.top)  * (this._dpr || 1);
        this._zoomAt(px, py, Math.exp(-e.deltaY * 0.0015));
      }, { passive: false });

      this.canvas.style.cursor = 'grab';
      this.canvas.style.touchAction = 'none';
    }

    _zoomAt(px, py, factor) {
      // keep the math point under cursor fixed
      const before = this._pxToMath(px, py);
      const maxZoom = this._hasFractal ? 1e12 : 1e6; // M-09: cached in _reclassifyAll
      this.viewport.scale = Math.max(2, Math.min(maxZoom, this.viewport.scale * factor));
      const after = this._pxToMath(px, py);
      this.viewport.cx += before.x - after.x;
      this.viewport.cy += before.y - after.y;
      this._scheduleRender();
    }

    // №10: виконати дію — одночасне присвоєння параметрів
    runAction(id) {
      const e = this.expressions.find((x) => x.id === id);
      if (!e || e.classified?.kind !== 'action') return false;
      const env = this._env ? this._env() : { ...CONSTS, ...this.params, __funcs: this.userFuncs || {}, __seqs: this.userSeqs || {}, __seqCache: {} };
      const newVals = [];
      for (const a of e.classified.assigns) {
        let v;
        try { v = evalAst(a.ast, env); } catch (_) { return false; }
        if (!Number.isFinite(v) && !Array.isArray(v)) return false;
        newVals.push([a.name, v]);
      }
      newVals.forEach(([n, v]) => { this.params[n] = v; });
      this._scheduleRender();
      this._notify({ reason: 'param' });
      return true;
    }

    // №12: картинка на графіку — {id, img, cx, cy, w, h, opacity}
    addImage(dataURL, opts = {}) {
      if (!this.images) this.images = [];
      const id = 'img' + (++this._imgSeq || (this._imgSeq = 1));
      const rec = { id, dataURL, img: null, cx: opts.cx ?? this.viewport.cx, cy: opts.cy ?? this.viewport.cy,
                    w: opts.w || 0, h: opts.h || 0, opacity: opts.opacity ?? 1 };
      const im = new Image();
      im.onload = () => {
        rec.img = im;
        if (!rec.w || !rec.h) {
          const vw = this.canvas.width / this.viewport.scale;
          rec.w = vw * 0.6;
          rec.h = rec.w * im.naturalHeight / im.naturalWidth;
        }
        this._scheduleRender();
      };
      im.src = dataURL;
      this.images.push(rec);
      return rec;
    }
    removeImage(id) {
      if (!this.images) return;
      this.images = this.images.filter((r) => r.id !== id);
      if (this._imgActive === id) this._imgActive = null;
      this._scheduleRender();
    }
    _imageAt(px, py) {
      if (!this.images) return null;
      const m = this._pxToMath(px, py);
      for (let i = this.images.length - 1; i >= 0; i--) {
        const r = this.images[i];
        if (!r.img) continue;
        const corner = this._mathToPx(r.cx + r.w / 2, r.cy - r.h / 2);
        if (Math.hypot(px - corner.x, py - corner.y) < 16 * (this._dpr || 1))
          return { rec: r, mode: 'resize' };
        if (Math.abs(m.x - r.cx) <= r.w / 2 && Math.abs(m.y - r.cy) <= r.h / 2)
          return { rec: r, mode: 'move' };
      }
      return null;
    }
    _drawImages(ctx) {
      if (!this.images || !this.images.length) return;
      for (const r of this.images) {
        if (!r.img) continue;
        const a = this._mathToPx(r.cx - r.w / 2, r.cy + r.h / 2);
        const b = this._mathToPx(r.cx + r.w / 2, r.cy - r.h / 2);
        ctx.save();
        ctx.globalAlpha = r.opacity;
        ctx.drawImage(r.img, a.x, a.y, b.x - a.x, b.y - a.y);
        ctx.restore();
        if (this._imgActive === r.id) {
          ctx.strokeStyle = 'rgba(45,112,179,0.85)';
          ctx.lineWidth = 1.5 * (this._dpr || 1);
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
          ctx.setLineDash([]);
          ctx.fillStyle = '#2d70b3';
          ctx.beginPath();
          ctx.arc(b.x, b.y, 6 * (this._dpr || 1), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // №14: межі осей вручну
    setBounds(xmin, xmax, ymin, ymax) {
      if (![xmin, xmax, ymin, ymax].every(Number.isFinite) || xmin >= xmax || ymin >= ymax) return false;
      const w = this.canvas.width, h = this.canvas.height;
      this.viewport.cx = (xmin + xmax) / 2;
      this.viewport.cy = (ymin + ymax) / 2;
      // scale спільний для осей — вписуємо обидва діапазони
      this.viewport.scale = Math.min(w / (xmax - xmin), h / (ymax - ymin));
      this._scheduleRender();
      return true;
    }
    getBounds() {
      const w = this.canvas.width, h = this.canvas.height, v = this.viewport;
      return { xmin: v.cx - w / 2 / v.scale, xmax: v.cx + w / 2 / v.scale,
               ymin: v.cy - h / 2 / v.scale, ymax: v.cy + h / 2 / v.scale };
    }
    setAxisNames(xName, yName) {
      this.axisNames = { x: xName || '', y: yName || '' };
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

    // Params (with sliders) a visible curve depends on
    _curveParams(e) {
      const c = e.classified;
      if (!c) return [];
      let fv;
      if (c.kind === 'explicitY' || c.kind === 'explicitX' || c.kind === 'polar') fv = freeVars(c.ast);
      else if (c.kind === 'implicit') fv = new Set([...freeVars(c.lhs), ...freeVars(c.rhs)]);
      else return [];
      return [...fv].filter((v) => v in this.params);
    }
    _curveResidual(e, name, p, mx, my) {
      const c = e.classified;
      const env = { ...CONSTS, ...this.params, __funcs: this.userFuncs || {}, __seqs: this.userSeqs || {}, __seqCache: {} }; // H-02
      env[name] = p;
      try {
        if (c.kind === 'explicitY') { env.x = mx; return evalAst(c.ast, env) - my; }
        if (c.kind === 'explicitX') { env.y = my; return evalAst(c.ast, env) - mx; }
        if (c.kind === 'implicit') { env.x = mx; env.y = my; return evalAst(c.lhs, env) - evalAst(c.rhs, env); }
        if (c.kind === 'polar') { const th = Math.atan2(my, mx); env['θ'] = th; env.theta = th; return evalAst(c.ast, env) - Math.hypot(mx, my); }
      } catch (_) { return NaN; }
      return NaN;
    }
    // Approx pixel distance from pointer (math mx,my) to a curve, for hit-testing
    _curvePixelDist(e, mx, my) {
      const c = e.classified, sc = this.viewport.scale;
      const env = { ...CONSTS, ...this.params, __funcs: this.userFuncs || {}, __seqs: this.userSeqs || {}, __seqCache: {} }; // H-02
      const ev = (ast, extra) => { try { return evalAst(ast, { ...env, ...extra }); } catch (_) { return NaN; } };
      if (c.kind === 'explicitY') { const v = ev(c.ast, { x: mx }); return Number.isFinite(v) ? Math.abs(v - my) * sc : Infinity; }
      if (c.kind === 'explicitX') { const v = ev(c.ast, { y: my }); return Number.isFinite(v) ? Math.abs(v - mx) * sc : Infinity; }
      if (c.kind === 'polar') { const th = Math.atan2(my, mx); const v = ev(c.ast, { 'θ': th, theta: th }); return Number.isFinite(v) ? Math.abs(v - Math.hypot(mx, my)) * sc : Infinity; }
      if (c.kind === 'implicit') {
        const F = (x, y) => ev(c.lhs, { x, y }) - ev(c.rhs, { x, y });
        const f0 = F(mx, my); if (!Number.isFinite(f0)) return Infinity;
        const dh = 1 / sc;
        const gx = (F(mx + dh, my) - F(mx - dh, my)) / (2 * dh);
        const gy = (F(mx, my + dh) - F(mx, my - dh)) / (2 * dh);
        const g = Math.hypot(gx, gy);
        return g > 1e-9 ? (Math.abs(f0) / g) * sc : Infinity;
      }
      return Infinity;
    }
    _pickParamCurve(px, py) {
      const m = this._pxToMath(px, py);
      const tol = 16 * (this._dpr || 1);
      let best = null, bestD = tol;
      for (const e of this.expressions) {
        if (e.hidden || !e.classified) continue;
        const names = this._curveParams(e);
        if (!names.length) continue;
        const d = this._curvePixelDist(e, m.x, m.y);
        if (d < bestD) { bestD = d; best = e; }
      }
      if (!best) return null;
      // choose the parameter that moves the curve most at the grab point
      const names = this._curveParams(best);
      let pick = names[0], bestSens = -1;
      for (const nm of names) {
        const p = this.params[nm];
        const h = Math.max(1e-3, Math.abs(p) * 1e-3);
        const g1 = this._curveResidual(best, nm, p + h, m.x, m.y);
        const g0 = this._curveResidual(best, nm, p - h, m.x, m.y);
        const sens = Number.isFinite(g1) && Number.isFinite(g0) ? Math.abs((g1 - g0) / (2 * h)) : 0;
        if (sens > bestSens) { bestSens = sens; pick = nm; }
      }
      return { expr: best, name: pick };
    }
    _paramRangeFor(name) {
      const pe = this.expressions.find((e) => e.classified && e.classified.kind === 'param' && e.classified.name === name);
      return (pe && pe.paramRange) || { min: -100, max: 100 };
    }
    // Solve curve(param) to pass through pointer (mx,my); update the param
    _solveParamAt(drag, mx, my) {
      const { expr, name } = drag;
      const rng = this._paramRangeFor(name);
      const lo = Math.min(rng.min, rng.max), hi = Math.max(rng.min, rng.max);
      const g = (p) => this._curveResidual(expr, name, p, mx, my);
      // scan for a sign change across the slider range
      const N = 200; let prevP = lo, prevG = g(lo), found = null;
      for (let i = 1; i <= N; i++) {
        const p = lo + (hi - lo) * (i / N), gv = g(p);
        if (Number.isFinite(prevG) && Number.isFinite(gv) && prevG * gv <= 0) {
          // bisection between prevP and p
          let a = prevP, b = p, ga = prevG;
          for (let k = 0; k < 40; k++) {
            const mid = (a + b) / 2, gm = g(mid);
            if (!Number.isFinite(gm)) break;
            if (ga * gm <= 0) b = mid; else { a = mid; ga = gm; }
          }
          found = (a + b) / 2; break;
        }
        prevP = p; prevG = gv;
      }
      if (found == null) return; // no solution in range — leave param unchanged
      const val = Math.max(lo, Math.min(hi, found));
      this.params[name] = val;
      this._seqCache = {};
      this._scheduleRender();
      this._notify({ reason: 'param' }); // A-04
    }

    // ---------- Expression API --------------------------------------------
    addExpression(src) {
      const id = this._nextId++;
      const expr = {
        id, src, color: this.palette[(id-1) % this.palette.length],
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
      // P-01: skip full reclassify when the changed expression is non-structural
      const wasStructural = e.classified &&
        (e.classified.kind === 'param' || e.classified.kind === 'funcDef' || e.classified.kind === 'seqBase');
      const isStructural = _isStructuralSrc(src);
      if (wasStructural || isStructural) {
        this._reclassifyAll();
      } else {
        const paramNames = new Set();
        for (const ex of this.expressions)
          if (ex.classified && ex.classified.kind === 'param') paramNames.add(ex.classified.name);
        e.classified = classify(src, paramNames);
        this._hasFractal = this.expressions.some(
          (ex) => !ex.hidden && ex.classified && ex.classified.kind === 'fractal');
        this._notify({ reason: 'expression' });
      }
      this._scheduleRender();
    }
    // ----- Data tables -----
    addTable(data) {
      const id = this._nextId++;
      const expr = {
        id, src: '', color: this.palette[(id - 1) % this.palette.length],
        hidden: false, classified: { kind: 'table' },
        isTable: true,
        table: data || { head: ['x', 'y'], rows: [['', ''], ['', ''], ['', '']] },
        tableStyle: { points: true, line: false },
        paramRange: { min: -10, max: 10, step: 0.01 },
      };
      this.expressions.push(expr);
      this._reclassifyAll();
      this._scheduleRender();
      return expr;
    }
    updateTable(id, table, style) {
      const e = this.expressions.find((x) => x.id === id);
      if (!e || !e.isTable) return;
      if (table) e.table = table;
      if (style) e.tableStyle = Object.assign({}, e.tableStyle, style);
      this._computeRegression(e);
      this._scheduleRender();
    }
    setRegression(id, type) {
      const e = this.expressions.find((x) => x.id === id);
      if (!e || !e.isTable) return;
      e.regression = type && type !== 'none' ? type : null;
      this._computeRegression(e);
      this._scheduleRender();
      this._notify({ reason: 'expression' }); // A-04
    }
    _computeRegression(e) {
      if (!e.regression) { e.regFit = null; return; }
      try { e.regFit = fitRegression(e.regression, this.tableData(e.id)); }
      catch (_) { e.regFit = null; }
    }

    // №5: histogram(list, binWidth?) — стовпчики частот від y=0
    _drawHistogram(expr, env) {
      const c = expr.classified;
      let data;
      try { data = evalAst(c.args[0], env); } catch (_) { return; }
      if (!Array.isArray(data)) return;
      data = data.filter(Number.isFinite);
      if (!data.length) return;
      let bw = null;
      if (c.args[1]) { try { bw = evalAst(c.args[1], env); } catch (_) {} }
      const lo = Math.min(...data), hi = Math.max(...data);
      if (!Number.isFinite(bw) || bw <= 0) {
        // Фрідман–Діаконіс, округлено до "гарного" кроку
        const s = [...data].sort((a,b)=>a-b);
        const iqr = s[Math.floor(s.length*0.75)] - s[Math.floor(s.length*0.25)];
        const raw = iqr > 0 ? 2 * iqr / Math.cbrt(data.length) : (hi - lo) / 10 || 1;
        const p = Math.pow(10, Math.floor(Math.log10(raw)));
        bw = [1,2,5,10].map(m=>m*p).find(v => v >= raw) || p * 10;
      }
      const start = Math.floor(lo / bw) * bw;
      const nb = Math.max(1, Math.min(500, Math.ceil((hi - start) / bw + 1e-9) || 1));
      const bins = new Array(nb).fill(0);
      data.forEach((v) => {
        let bi = Math.floor((v - start) / bw);
        if (bi >= nb) bi = nb - 1;
        if (bi >= 0) bins[bi]++;
      });
      const ctx = this.ctx;
      ctx.fillStyle = hexRgba(expr.color, 0.45);
      ctx.strokeStyle = expr.color;
      ctx.lineWidth = 1.5 * (this._dpr || 1);
      for (let i = 0; i < nb; i++) {
        if (!bins[i]) continue;
        const p1 = this._mathToPx(start + i * bw, bins[i]);
        const p2 = this._mathToPx(start + (i + 1) * bw, 0);
        ctx.fillRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
        ctx.strokeRect(p1.x, p1.y, p2.x - p1.x, p2.y - p1.y);
      }
    }

    // №5: boxplot(list, y?) — «вуса», центрований на y (default 1)
    _drawBoxplot(expr, env) {
      const c = expr.classified;
      let data;
      try { data = evalAst(c.args[0], env); } catch (_) { return; }
      if (!Array.isArray(data)) return;
      data = data.filter(Number.isFinite);
      if (data.length < 2) return;
      let yc = 1;
      if (c.args[1]) { try { const v = evalAst(c.args[1], env); if (Number.isFinite(v)) yc = v; } catch (_) {} }
      const s = [...data].sort((a,b)=>a-b);
      const q = (p) => {
        const idx = p * (s.length - 1), lo2 = Math.floor(idx), hi2 = Math.ceil(idx);
        return s[lo2] + (s[hi2] - s[lo2]) * (idx - lo2);
      };
      const q1 = q(0.25), med = q(0.5), q3 = q(0.75);
      const iqr = q3 - q1;
      const wLo = Math.min(...s.filter(v => v >= q1 - 1.5 * iqr));
      const wHi = Math.max(...s.filter(v => v <= q3 + 1.5 * iqr));
      const outliers = s.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr);
      const hh = 0.35;
      const ctx = this.ctx;
      const P = (x, y) => this._mathToPx(x, y);
      ctx.strokeStyle = expr.color;
      ctx.fillStyle = hexRgba(expr.color, 0.25);
      ctx.lineWidth = 2 * (this._dpr || 1);
      // box
      const a = P(q1, yc + hh), b = P(q3, yc - hh);
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.beginPath();
      // median
      const m1 = P(med, yc + hh), m2 = P(med, yc - hh);
      ctx.moveTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y);
      // whiskers
      const c1 = P(wLo, yc), c2 = P(q1, yc);
      ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y);
      const c3 = P(q3, yc), c4 = P(wHi, yc);
      ctx.moveTo(c3.x, c3.y); ctx.lineTo(c4.x, c4.y);
      const t1 = P(wLo, yc + hh * 0.6), t2 = P(wLo, yc - hh * 0.6);
      ctx.moveTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y);
      const t3 = P(wHi, yc + hh * 0.6), t4 = P(wHi, yc - hh * 0.6);
      ctx.moveTo(t3.x, t3.y); ctx.lineTo(t4.x, t4.y);
      ctx.stroke();
      // outliers
      ctx.fillStyle = expr.color;
      outliers.forEach((v) => {
        const p = P(v, yc);
        ctx.beginPath(); ctx.arc(p.x, p.y, 3 * (this._dpr || 1), 0, Math.PI * 2); ctx.fill();
      });
    }

    // domaincolor(f(z)): відтінок = аргумент, яскравість = модуль, кільця |f| (№ 6)
    _drawDomainColor(ast, env) {
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      const step = Math.max(2, Math.round((this._dpr || 1) * 1.5));
      const iw = Math.ceil(w / step), ih = Math.ceil(h / step);
      const img = ctx.createImageData(iw, ih);
      const d = img.data;
      const cenv = Object.assign({}, this.params);
      for (const k in cenv) if (typeof cenv[k] === 'number') cenv[k] = { re: cenv[k], im: 0 };
      for (let py = 0; py < ih; py++) {
        for (let px = 0; px < iw; px++) {
          const m = this._pxToMath(px * step, py * step);
          cenv.__z = { re: m.x, im: m.y };
          let f;
          try { f = evalComplex(ast, cenv); } catch (_) { f = null; }
          const o = (py * iw + px) * 4;
          if (!f || !Number.isFinite(f.re) || !Number.isFinite(f.im)) {
            d[o] = d[o+1] = d[o+2] = 255; d[o+3] = 255; continue;
          }
          const mag = Math.hypot(f.re, f.im);
          const hue = (Math.atan2(f.im, f.re) / (2 * Math.PI) + 1) % 1;
          let light = 0.35 + 0.45 * (mag / (mag + 1));
          const ring = ((Math.log2(mag + 1e-12) % 1) + 1) % 1;
          light += (ring - 0.5) * 0.07;
          light = Math.max(0.05, Math.min(0.95, light));
          const s = 0.9;
          const q = light < 0.5 ? light * (1 + s) : light + s - light * s;
          const p = 2 * light - q;
          const h2r = (t) => {
            t = ((t % 1) + 1) % 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
          };
          d[o]   = Math.round(h2r(hue + 1/3) * 255);
          d[o+1] = Math.round(h2r(hue) * 255);
          d[o+2] = Math.round(h2r(hue - 1/3) * 255);
          d[o+3] = 235;
        }
      }
      const oc = document.createElement('canvas');
      oc.width = iw; oc.height = ih;
      oc.getContext('2d').putImageData(img, 0, 0);
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(oc, 0, 0, w, h);
      ctx.restore();
    }

    // Комплексна точка: 2+3i → точка (2, 3) з підписом
    _drawComplexPoint(ast, env, color, label) {
      const cenv = Object.assign({}, this.params);
      for (const k in cenv) if (typeof cenv[k] === 'number') cenv[k] = { re: cenv[k], im: 0 };
      let v;
      try { v = evalComplex(ast, cenv); } catch (_) { return; }
      if (!Number.isFinite(v.re) || !Number.isFinite(v.im)) return;
      const ctx = this.ctx;
      const p = this._mathToPx(v.re, v.im);
      const dpr = this._dpr || 1, r = 5 * dpr;
      ctx.fillStyle = color;
      ctx.strokeStyle = this.opts.pointHalo;
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const fmt = (n) => String(parseFloat(n.toPrecision(4)));
      const text = label || (fmt(v.re) + (v.im >= 0 ? ' + ' : ' − ') + fmt(Math.abs(v.im)) + 'i');
      ctx.fillStyle = color;
      ctx.font = '600 ' + (12 * dpr) + 'px "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(text, p.x + r + 3 * dpr, p.y - r);
    }

    // y ~ f(x, params): підгонка до даних першої видимої таблиці
    _drawFitExpr(expr, env) {
      const c = expr.classified;
      const tbl = this.expressions.find((t) => t.isTable && !t.hidden);
      const pts = tbl ? this.tableData(tbl.id) : [];
      if (!pts.length) { expr.fitResult = { error: 'Потрібна таблиця з даними' }; return; }
      // Кеш: формула + дані + значення params
      const key = c.src + '|' + JSON.stringify(pts) + '|' + JSON.stringify(this.params);
      if (!expr._fitCache || expr._fitCache.key !== key) {
        const fit = fitFormula(c.ast, c.fitParams, pts, env);
        expr._fitCache = { key, fit };
        expr.fitResult = fit ? { params: fit.params, r2: fit.r2 } : { error: 'Не вдалося підігнати' };
      }
      const fit = expr._fitCache.fit;
      if (!fit) return;
      const fitEnv = Object.assign({}, env, fit.params);
      this._drawExplicit(c.ast, fitEnv, expr.color, c.restrictions, 'y');
    }
    // Numeric (x,y) rows of a table (skips blank/invalid rows)
    tableData(id) {
      const e = this.expressions.find((x) => x.id === id);
      if (!e || !e.isTable) return [];
      return e.table.rows
        .map((r) => [parseFloat(r[0]), parseFloat(r[1])])
        .filter((r) => Number.isFinite(r[0]) && Number.isFinite(r[1]));
    }
    moveExpression(id, toIndex) {
      const from = this.expressions.findIndex((x) => x.id === id);
      if (from < 0) return;
      const [e] = this.expressions.splice(from, 1);
      const to = Math.max(0, Math.min(toIndex, this.expressions.length));
      this.expressions.splice(to, 0, e);
      this._reclassifyAll();
      this._scheduleRender();
    }

    removeExpression(id) {
      // H-04: clear FractalRenderer cache when a fractal expression is removed
      const _removing = this.expressions.find((x) => x.id === id);
      if (_removing && _removing.classified && _removing.classified.kind === 'fractal' && window.FractalRenderer) FractalRenderer.clearCache();
      this.expressions = this.expressions.filter((x) => x.id !== id);
      this._reclassifyAll();
      this._scheduleRender();
    }
    setHidden(id, hidden) {
      const e = this.expressions.find((x) => x.id === id);
      if (e) { e.hidden = hidden; this._scheduleRender(); }
    }
    setColor(id, color) {
      const e = this.expressions.find((x) => x.id === id);
      if (e) { e.color = color; this._scheduleRender(); }
    }
    setParamValue(name, value) {
      this.params[name] = value;
      this._seqCache = {}; // M-03: params changed → sequences may differ
      this._scheduleRender();
    }
    // A-02: safe public param accessors
    setParam(name, value) {
      if (!Object.prototype.hasOwnProperty.call(this.params, name)) return;
      this.params[name] = value;
      this._seqCache = {};
      this._scheduleRender();
      this._notify({ reason: 'param' });
    }
    getParam(name) { return this.params[name]; }
    // A-03: execute fn() with single reclassify/render at the end
    batch(fn) {
      if (this._suppressReclassify) { fn(); return; } // nested — outer handles cleanup
      this._suppressReclassify = true;
      let _batchErr;
      try { fn(); } catch (e) { _batchErr = e; }
      this._suppressReclassify = false;
      this._reclassifyAll();
      if (_batchErr) throw _batchErr;
    }
    // Serialization §12: v2 state snapshot (viewport + colors + hidden + tRange)
    getState() {
      return {
        version: 2,
        viewport: { ...this.viewport },
        expressions: this.expressions.map((e) => e.isTable
          ? { isTable: true, table: JSON.parse(JSON.stringify(e.table)),
              tableStyle: { ...(e.tableStyle || {}) }, regression: e.regression || null,
              color: e.color, hidden: !!e.hidden }
          : { src: e.src, color: e.color, hidden: !!e.hidden,
              tRange: e.tRange ? { ...e.tRange } : null, fractalPalette: e._fractalPalette || null }),
        params: { ...this.params },
      };
    }
    setState(state) {
      this.batch(() => {
        this.expressions.slice().forEach((ex) => this.removeExpression(ex.id));
        const items = state.expressions || state.items || [];
        items.forEach((it) => {
          if (it.isTable) {
            const t = this.addTable(JSON.parse(JSON.stringify(it.table)));
            if (it.tableStyle) t.tableStyle = { ...it.tableStyle };
            if (it.color) this.setColor(t.id, it.color);
            if (it.hidden) this.setHidden(t.id, true);
            if (it.regression) this.setRegression(t.id, it.regression);
          } else {
            const e = this.addExpression(it.src || '');
            if (it.color) this.setColor(e.id, it.color);
            if (it.hidden) this.setHidden(e.id, true);
            if (it.tRange) this.setTRange(e.id, it.tRange.min, it.tRange.max);
            if (it.fractalPalette) e._fractalPalette = it.fractalPalette;
          }
        });
        if (state.viewport) this.viewport = { ...state.viewport };
      });
    }
    // Insert a parameter definition `name = value` BEFORE the expression with id `beforeId`.
    addParameterFor(name, beforeId, value = 1) {
      const id = this._nextId++;
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
      if (on) this._kickAnimLoop();
    }
    setTRange(id, min, max) {
      const e = this.expressions.find((x) => x.id === id);
      if (!e) return;
      e.tRange = e.tRange || { min: 0, max: Math.PI * 2 };
      if (Number.isFinite(min)) e.tRange.min = min;
      if (Number.isFinite(max)) e.tRange.max = max;
      this._scheduleRender();
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
            this.params[name] = v;
          }
        }
        if (any) {
          this._scheduleRender();
          this._notify({ reason: 'animate' }); // A-04
          this._animRaf = requestAnimationFrame(tick);
        }
      };
      this._animRaf = requestAnimationFrame(tick);
    }

    _reclassifyAll() {
      if (this._suppressReclassify) return; // H-01: batch update support
      // First pass: collect param NAMES (regardless of order)
      const paramNames = new Set();
      for (const e of this.expressions) {
        try {
          const ast = parse(e.src);
          if (ast.kind === 'eq' && ast.lhs.kind === 'ident' && ast.lhs.name !== 'y' && ast.lhs.name !== 'x') {
            const fv = freeVars(ast.rhs);
            if (!fv.has('x') && !fv.has('y')) paramNames.add(ast.lhs.name);
          }
        } catch (_) {}
      }
      // Second pass: classify each
      for (const e of this.expressions) {
        if (e.isTable) { e.classified = { kind: 'table' }; continue; }
        e.classified = classify(e.src, paramNames);
      }
      // Collect user-defined functions: name -> { params, body }
      this.userFuncs = {};
      for (const e of this.expressions) {
        if (e.classified.kind === 'funcDef') this.userFuncs[e.classified.name] = { params: e.classified.params, body: e.classified.ast };
      }
      // Collect recursive sequences: a name is a sequence if it has ≥1 base case.
      this.userSeqs = {};
      for (const e of this.expressions) {
        const c = e.classified;
        if (c.kind === 'seqBase') {
          const s = this.userSeqs[c.name] || (this.userSeqs[c.name] = { param: 'n', body: null, bases: new Map() });
          s.bases.set(c.index, c.ast);
        }
      }
      // Attach the general recurrence (a funcDef with the same name) to its sequence.
      for (const e of this.expressions) {
        const c = e.classified;
        if (c.kind === 'funcDef' && c.params.length === 1 && this.userSeqs[c.name]) {
          this.userSeqs[c.name].body = c.ast;
          this.userSeqs[c.name].param = c.params[0];
          c.isSeqGeneral = true;
        }
      }
      // Evaluate parameter values (in order) — params can depend on prior params/consts/functions
      const env = { ...CONSTS, __funcs: this.userFuncs, __seqs: this.userSeqs, __seqCache: {} };
      for (const e of this.expressions) {
        if (e.classified.kind === 'param') {
          // If user already moved the slider, keep the current value
          if (this.params[e.classified.name] === undefined) {
            try { this.params[e.classified.name] = evalAst(e.classified.ast, env); }
            catch (_) { this.params[e.classified.name] = 1; }
          }
          env[e.classified.name] = this.params[e.classified.name];
        }
      }
      // Default t-range for parametric curves
      for (const e of this.expressions) {
        if (e.classified.kind === 'parametric' && !e.tRange) e.tRange = { min: 0, max: Math.round(Math.PI * 2 * 1000) / 1000 };
      }
      // Drop param values that no longer correspond to any expression
      const liveNames = new Set();
      for (const e of this.expressions) if (e.classified.kind === 'param') liveNames.add(e.classified.name);
      for (const k of Object.keys(this.params)) if (!liveNames.has(k)) delete this.params[k];
      // Cache fractal flag for _zoomAt (M-09) — avoids linear scan on every wheel event
      this._hasFractal = this.expressions.some((e) => !e.hidden && e.classified && e.classified.kind === 'fractal');
      this._seqCache = {}; // M-03: invalidate cross-frame sequence cache
      // Notify listener (A-04)
      this._notify({ reason: 'reclassify' });
    }

    // ---------- Rendering -------------------------------------------------
    _scheduleRender() {
      if (this._destroyed || this._raf) return; // C-03
      this._raf = requestAnimationFrame(() => { this._raf = null; clearTimeout(this._rafFallback); this._render(); });
      // rAF може не доставитись (прихований/щойно створений iframe) — страховка через setTimeout
      clearTimeout(this._rafFallback);
      this._rafFallback = setTimeout(() => {
        if (this._raf !== null && !this._destroyed) {
          cancelAnimationFrame(this._raf);
          this._raf = null;
          this._render();
        }
      }, 120);
    }

    _render() {
      const ctx = this.ctx;
      const w = this.canvas.width, h = this.canvas.height;
      const env = { ...CONSTS, ...this.params, __funcs: this.userFuncs || {}, __seqs: this.userSeqs || {}, __seqCache: this._seqCache || (this._seqCache = {}) }; // M-03

      // Фрактали заповнюють полотно — малюємо їх до grid/axes
      const fractalExprs = this.expressions.filter((e) => !e.hidden && e.classified && e.classified.kind === 'fractal');
      const hasFractal = fractalExprs.length > 0;

      ctx.fillStyle = hasFractal ? '#000' : this.opts.bg;
      ctx.fillRect(0, 0, w, h);

      if (hasFractal) {
        for (const e of fractalExprs) {
          try { this._drawFractal(e.classified, env, e); } catch (_) {}
        }
      }
      this._drawGrid(hasFractal);
      this._drawImages(ctx); // №12: над сіткою, під кривими й осями
      this._drawAxes(hasFractal);

      for (const e of this.expressions) {
        if (e.hidden || !e.classified || e.classified.kind === 'invalid' || e.classified.kind === 'param' || e.classified.kind === 'funcDef' || e.classified.kind === 'seqBase' || e.classified.kind === 'fractal') continue;
        try {
          if (e.classified.kind === 'histogram') this._drawHistogram(e, env);
          else if (e.classified.kind === 'boxplot') this._drawBoxplot(e, env);
          else if (e.classified.kind === 'domainColor') this._drawDomainColor(e.classified.ast, env);
          else if (e.classified.kind === 'complexPoint') this._drawComplexPoint(e.classified.ast, env, e.color, e.classified.label);
          else if (e.classified.kind === 'fitExpr') this._drawFitExpr(e, env);
          else if (e.classified.kind === 'explicitY') this._drawExplicit(e.classified.ast, env, e.color, e.classified.restrictions, 'y'); // P-04
          else if (e.classified.kind === 'explicitX') this._drawExplicit(e.classified.ast, env, e.color, e.classified.restrictions, 'x'); // P-04
          else if (e.classified.kind === 'implicit') this._drawImplicit(e.classified.lhs, e.classified.rhs, env, e.color, e.classified.restrictions);
          else if (e.classified.kind === 'inequality') this._drawInequality(e.classified, env, e.color);
          else if (e.classified.kind === 'polar') this._drawPolar(e.classified.ast, env, e.color, e.classified.restrictions);
          else if (e.classified.kind === 'parametric') this._drawParametric(e.classified.astX, e.classified.astY, env, e.color, e.classified.restrictions, e.tRange);
          else if (e.classified.kind === 'table') this._drawTable(e);
          else if (e.classified.kind === 'sequencePlot') this._drawSequencePlot(e.classified, env, e.color);
          else if (e.classified.kind === 'lsystem') this._drawLSystem(e.classified, env, e.color);
          else if (e.classified.kind === 'point') this._drawPoint(e.classified.ast, env, e.color, e.classified.restrictions, e.classified.label);
        } catch (err) { /* skip render errors */ }
      }
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

    _drawLSystem(c, env, color) {
      const ctx = this.ctx;
      const W = this.canvas.width, H = this.canvas.height;
      const dpr = this._dpr || 1;
      let iters = 3, angleDeg = 90, startAngleDeg = 0;
      try { iters = Math.max(0, Math.min(12, Math.round(evalAst(c.itersNode, env)))); } catch (_) {}
      try { angleDeg = evalAst(c.angleNode, env); } catch (_) {}
      try { if (c.startAngleNode) startAngleDeg = evalAst(c.startAngleNode, env); } catch (_) {}
      // L-05: angle=0 → all turns are no-ops; warn developer
      if (Math.abs(angleDeg) < 1e-9) console.warn('[GraphCalc] L-system: angle=0 — усі повороти нульові, перевірте аргумент');
      const angle = angleDeg * Math.PI / 180;
      const th0 = startAngleDeg * Math.PI / 180;
      const rules = Object.create(null);
      c.rules.split(';').forEach((r) => { const a = r.indexOf('->'); if (a >= 0) rules[r.slice(0, a).trim()] = r.slice(a + 2).trim(); });
      const MAX_LEN = 200000;
      // H-05: cache expanded string on classified object; auto-invalidated on updateExpression
      const _lsCacheKey = `${c.axiom}|${c.rules}|${iters}`;
      let str;
      if (c._lsCache && c._lsCache.key === _lsCacheKey) {
        str = c._lsCache.str;
      } else {
        str = c.axiom;
        for (let step = 0; step < iters; step++) {
          let next = '';
          for (let j = 0; j < str.length; j++) {
            const sub = rules[str[j]] || str[j];
            if (next.length + sub.length > MAX_LEN) { next += sub.slice(0, MAX_LEN - next.length); break; }
            next += sub;
          }
          str = next; if (str.length >= MAX_LEN) break;
        }
        c._lsCache = { key: _lsCacheKey, str };
      }
      if (!str.length) return;
      let tx = 0, ty = 0, th = th0;
      let minX = 0, maxX = 0, minY = 0, maxY = 0;
      const stk = [];
      for (let j = 0; j < str.length; j++) {
        const ch = str[j];
        if (ch === 'F' || ch === 'G') {
          tx += Math.cos(th); ty += Math.sin(th);
          if (tx < minX) minX = tx; if (tx > maxX) maxX = tx;
          if (ty < minY) minY = ty; if (ty > maxY) maxY = ty;
        } else if (ch === 'f') { tx += Math.cos(th); ty += Math.sin(th); }
        else if (ch === '+') { th += angle; } else if (ch === '-') { th -= angle; } else if (ch === '|') { th += Math.PI; }
        else if (ch === '[') { stk.push(tx, ty, th); }
        else if (ch === ']') { if (stk.length >= 3) { th = stk.pop(); ty = stk.pop(); tx = stk.pop(); } }
      }
      minX = Math.min(minX, 0); maxX = Math.max(maxX, 0);
      minY = Math.min(minY, 0); maxY = Math.max(maxY, 0);
      const bw = Math.max(maxX - minX, 1e-6), bh = Math.max(maxY - minY, 1e-6);
      // Прив'язка до координатної площини: L-система ~5 математичних одиниць
      const mathScale = 5 / Math.max(bw, bh);
      const cTX = (maxX + minX) / 2, cTY = (maxY + minY) / 2;
      tx = 0; ty = 0; th = th0; stk.length = 0;
      let penDown = false;
      ctx.save(); // M-07
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5 * dpr;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      for (let j = 0; j < str.length; j++) {
        const ch = str[j];
        if (ch === 'F' || ch === 'G') {
          const nx = tx + Math.cos(th), ny = ty + Math.sin(th);
          if (!penDown) {
            const p = this._mathToPx((tx - cTX) * mathScale, (ty - cTY) * mathScale);
            ctx.moveTo(p.x, p.y); penDown = true;
          }
          const p = this._mathToPx((nx - cTX) * mathScale, (ny - cTY) * mathScale);
          ctx.lineTo(p.x, p.y);
          tx = nx; ty = ny;
        } else if (ch === 'f') { tx += Math.cos(th); ty += Math.sin(th); penDown = false; }
        else if (ch === '+') { th += angle; } else if (ch === '-') { th -= angle; } else if (ch === '|') { th += Math.PI; }
        else if (ch === '[') { stk.push(tx, ty, th); }
        else if (ch === ']') { if (stk.length >= 3) { th = stk.pop(); ty = stk.pop(); tx = stk.pop(); } penDown = false; }
      }
      ctx.stroke();
      ctx.restore(); // M-07
    }

    _drawFractal(c, env, expr) {
      if (!window.FractalRenderer) return;
      const juliaC = [0, 0];
      if (c.type === 'julia' && c.args.length >= 2) {
        try { juliaC[0] = evalAst(c.args[0], env); juliaC[1] = evalAst(c.args[1], env); } catch (_) {}
      }
      let fractalPower = 2;
      if (c.type === 'multibrot' && c.args.length >= 1) {
        try { fractalPower = Math.max(2, Math.round(evalAst(c.args[0], env))); } catch (_) {}
      }
      FractalRenderer.render({
        ctx: this.ctx,
        canvas: this.canvas,
        viewport: this.viewport,
        type: c.type,
        juliaC,
        fractalPower,
        paletteId: expr._fractalPalette || 'smooth',
        isPanning: !!this._isPanning,
        onRepaint: () => { if (!this._destroyed) this._scheduleRender(); }, // C-03: guard post-destroy callback
      });
    }

    _drawGrid(overlay = false) {
      const ctx = this.ctx;
      const w = this.canvas.width, h = this.canvas.height;
      const view = this.viewport;
      const xRange = w / view.scale, yRange = h / view.scale;
      const step = this._niceStep(xRange);
      const minor = step / 5;
      const x0 = this.viewport.cx - xRange/2, x1 = this.viewport.cx + xRange/2;
      const y0 = this.viewport.cy - yRange/2, y1 = this.viewport.cy + yRange/2;

      // Minor
      ctx.strokeStyle = overlay ? 'rgba(255,255,255,0.06)' : this.opts.gridMinor;
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
      ctx.strokeStyle = overlay ? 'rgba(255,255,255,0.15)' : this.opts.gridMajor;
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

    _drawAxes(overlay = false) {
      const ctx = this.ctx;
      const w = this.canvas.width, h = this.canvas.height;
      const o = this._mathToPx(0, 0);
      ctx.strokeStyle = overlay ? 'rgba(255,255,255,0.5)' : this.opts.axis;
      ctx.lineWidth = 1.5 * (this._dpr || 1);
      ctx.beginPath();
      ctx.moveTo(0, o.y); ctx.lineTo(w, o.y);
      ctx.moveTo(o.x, 0); ctx.lineTo(o.x, h);
      ctx.stroke();

      // Tick labels
      ctx.fillStyle = overlay ? 'rgba(255,255,255,0.65)' : this.opts.axisLabel;
      ctx.font = `${11*(this._dpr||1)}px "Helvetica Neue", Arial, sans-serif`;
      ctx.textBaseline = 'top';
      const step = this._gridStep || 1;
      const xRange = w / this.viewport.scale, yRange = h / this.viewport.scale;
      const x0 = this.viewport.cx - xRange/2, x1 = this.viewport.cx + xRange/2;
      const y0 = this.viewport.cy - yRange/2, y1 = this.viewport.cy + yRange/2;
      const fmt = (n) => {
        const r = parseFloat((Math.round(n / step) * step).toPrecision(10));
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
      // Origin label — overlay colour (L-03); skip when near/outside canvas edge (M-04)
      const _lm = 18 * (this._dpr || 1);
      if (o.x > _lm && o.x < w - _lm && o.y > _lm && o.y < h - _lm) {
        ctx.fillStyle = overlay ? 'rgba(255,255,255,0.65)' : this.opts.axisLabel;
        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText('0', o.x - 4*(this._dpr||1), o.y + 4*(this._dpr||1));
      }
      // №14: користувацькі підписи осей
      if (this.axisNames && (this.axisNames.x || this.axisNames.y)) {
        const dpr = this._dpr || 1;
        ctx.font = 'italic 600 ' + (13 * dpr) + 'px Georgia, serif';
        ctx.fillStyle = overlay ? 'rgba(255,255,255,0.8)' : '#444';
        if (this.axisNames.x) {
          ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
          const yy = Math.max(16 * dpr, Math.min(h - 6 * dpr, o.y - 6 * dpr));
          ctx.fillText(this.axisNames.x, w - 8 * dpr, yy);
        }
        if (this.axisNames.y) {
          ctx.textAlign = 'left'; ctx.textBaseline = 'top';
          const xx = Math.max(6 * dpr, Math.min(w - 60 * dpr, o.x + 8 * dpr));
          ctx.fillText(this.axisNames.y, xx, 6 * dpr);
        }
      }
    }

    // P-04: unified explicit renderer (replaces separate _drawExplicitY / _drawExplicitX)
    _drawExplicit(ast, env, color, restr, mode = 'y') {
      const ctx = this.ctx;
      const isY = mode !== 'x';
      const dim = isY ? this.canvas.width : this.canvas.height;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * (this._dpr || 1);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      // Списки → сімейство кривих: кожен елемент — окрема гілка (Path2D)
      const samples = Math.max(200, Math.floor(dim / (this._dpr || 1)));
      const paths = [], prevs = [];
      const jumpLimit = (isY ? this.canvas.height : this.canvas.width) * 0.6;
      for (let i = 0; i <= samples; i++) {
        const t = (i / samples) * dim;
        const m = this._pxToMath(isY ? t : 0, isY ? 0 : t);
        let v;
        try { v = evalAst(ast, { ...env, [isY ? 'x' : 'y']: isY ? m.x : m.y }); } catch (_) { v = NaN; }
        const vals = Array.isArray(v) ? v : [v];
        for (let k = 0; k < vals.length; k++) {
          if (!paths[k]) { paths[k] = new Path2D(); prevs[k] = null; }
          const val = vals[k];
          if (!Number.isFinite(val)) { prevs[k] = null; continue; }
          const mx = isY ? m.x : val, my = isY ? val : m.y;
          if (restr && restr.length && !passRestrict(restr, env, mx, my)) { prevs[k] = null; continue; }
          const p = this._mathToPx(mx, my);
          if (!prevs[k]) paths[k].moveTo(p.x, p.y);
          else if ((isY ? Math.abs(p.y - prevs[k].y) : Math.abs(p.x - prevs[k].x)) > jumpLimit) paths[k].moveTo(p.x, p.y);
          else paths[k].lineTo(p.x, p.y);
          prevs[k] = p;
        }
      }
      paths.forEach((p) => ctx.stroke(p));
    }

    // Marching squares for f(x,y)=0
    _drawImplicit(lhs, rhs, env, color, restr) {
      const ctx = this.ctx;
      const w = this.canvas.width, h = this.canvas.height;
      const cellPx = (this._isPanning ? 16 : 8) * (this._dpr || 1); // P-02: coarser grid during pan
      const cols = Math.ceil(w / cellPx) + 1;
      const rows = Math.ceil(h / cellPx) + 1;
      const f = new Float32Array(cols * rows);
      const evalF = (x, y) => {
        if (restr && restr.length && !passRestrict(restr, env, x, y)) return NaN;
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

    // Shade region where (lhs op rhs) holds, plus boundary curve.
    // Shade region where the (possibly compound) condition holds, plus boundary for a single comparison.
    _drawInequality(c, env, color) {
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      const restr = c.restrictions;
      let holds;
      if (c.test) {
        holds = (x, y) => { try { return boolEval(c.test, { ...env, x, y }); } catch (_) { return false; } };
      } else {
        const lhs = c.lhs, rhs = c.rhs, less = (c.op === '<' || c.op === '<=');
        holds = (x, y) => {
          const e = { ...env, x, y };
          try { const a = evalAst(lhs, e), b = evalAst(rhs, e); if (!Number.isFinite(a) || !Number.isFinite(b)) return false; return less ? a - b < 0 : a - b > 0; }
          catch (_) { return false; }
        };
      }
      ctx.save(); // L-10: protect fillStyle from leaking
      ctx.fillStyle = hexRgba(color, 0.20);
      const cell = (this._isPanning ? 10 : 5) * (this._dpr || 1); // P-02: coarser fill during pan
      for (let py = 0; py < h; py += cell) {
        for (let px = 0; px < w; px += cell) {
          const m = this._pxToMath(px + cell / 2, py + cell / 2);
          if (holds(m.x, m.y) && passRestrict(restr, env, m.x, m.y)) ctx.fillRect(px, py, cell + 1, cell + 1);
        }
      }
      // crisp boundary only for a single comparison a<b / a>b
      if (c.lhs) {
        ctx.save();
        if (c.op === '<' || c.op === '>') ctx.setLineDash([7 * (this._dpr || 1), 5 * (this._dpr || 1)]);
        this._drawImplicit(c.lhs, c.rhs, env, color, restr);
        ctx.restore();
      }
      ctx.restore(); // L-10
    }

    _drawPolar(ast, env, color, restr) {
      const ctx = this.ctx;
      const TWO = Math.PI * 2, N = 1440;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * (this._dpr || 1);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      let prev = null;
      for (let i = 0; i <= N; i++) {
        const th = (i / N) * TWO;
        const e = { ...env, 'θ': th, theta: th };
        let r; try { r = evalAst(ast, e); } catch (_) { r = NaN; }
        if (!Number.isFinite(r)) { prev = null; continue; }
        const x = r * Math.cos(th), y = r * Math.sin(th);
        if (restr && restr.length && !passRestrict(restr, e, x, y)) { prev = null; continue; }
        const p = this._mathToPx(x, y);
        if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > this.canvas.height * 0.6) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        prev = p;
      }
      ctx.stroke();
    }

    _drawParametric(astX, astY, env, color, restr, tRange) {
      const ctx = this.ctx;
      const tMin = tRange ? tRange.min : 0;
      const tMax = tRange ? tRange.max : Math.PI * 2;
      const N = 2000;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * (this._dpr || 1);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      let prev = null;
      for (let i = 0; i <= N; i++) {
        const t = tMin + (i / N) * (tMax - tMin);
        const e = { ...env, t };
        let x, y;
        try { x = evalAst(astX, e); y = evalAst(astY, e); } catch (_) { x = NaN; }
        if (!Number.isFinite(x) || !Number.isFinite(y)) { prev = null; continue; }
        if (restr && restr.length && !passRestrict(restr, e, x, y)) { prev = null; continue; }
        const p = this._mathToPx(x, y);
        if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > this.canvas.height * 0.6) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        prev = p;
      }
      ctx.stroke();
    }

    _drawTable(expr) {
      const ctx = this.ctx;
      const pts = this.tableData(expr.id);
      const dpr = this._dpr || 1;
      const style = expr.tableStyle || { points: true, line: false };
      // regression fit curve (across the visible x-range)
      if (expr.regFit && expr.regFit.predict) {
        const w = this.canvas.width;
        ctx.save();
        try { // M-02: ensure restore() even on error
        ctx.strokeStyle = expr.color;
        ctx.lineWidth = 2.2 * dpr;
        ctx.setLineDash([7 * dpr, 5 * dpr]);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath();
        let started = false, prevY = null;
        for (let px = 0; px <= w; px += 2) {
          const mx = this.viewport.cx + (px - w / 2) / this.viewport.scale;
          const my = expr.regFit.predict(mx);
          if (!Number.isFinite(my)) { started = false; continue; }
          const p = this._mathToPx(mx, my);
          if (prevY != null && Math.abs(p.y - prevY) > this.canvas.height * 2) { started = false; }
          if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
          prevY = p.y;
        }
        ctx.stroke();
        ctx.setLineDash([]); // L-04: reset dash
        } finally { ctx.restore(); } // M-02
      }
      if (!pts.length) return;
      // connecting line
      if (style.line) {
        ctx.strokeStyle = expr.color;
        ctx.lineWidth = 2 * dpr;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath();
        pts.forEach(([mx, my], i) => {
          const p = this._mathToPx(mx, my);
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      }
      // points
      if (style.points !== false) {
        const r = 4.5 * dpr;
        ctx.fillStyle = expr.color;
        ctx.strokeStyle = this.opts.pointHalo;
        ctx.lineWidth = 2 * dpr;
        for (const [mx, my] of pts) {
          const p = this._mathToPx(mx, my);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
        }
      }
    }

    _drawSequencePlot(c, env, color) {
      const ctx = this.ctx;
      const lo = Math.round(evalAst(c.start, env));
      const hi = Math.round(evalAst(c.end, env));
      if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return;
      if (hi - lo > MAX_SUM_ITERATIONS) throw new Error(`Забагато точок (>${MAX_SUM_ITERATIONS})`);
      const child = Object.assign({}, env);
      const pts = [];
      for (let n = lo; n <= hi; n++) {
        child[c.varName] = n;
        let v;
        try { v = evalAst(c.body, child); } catch (_) { continue; }
        if (Number.isFinite(v)) pts.push([n, v]);
      }
      if (!pts.length) return;
      const dpr = this._dpr || 1;
      ctx.save(); // M-08
      // stems from the x-axis up to each point
      const y0 = this._mathToPx(0, 0).y;
      ctx.strokeStyle = hexRgba(color, 0.4);
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      for (const [mx, my] of pts) {
        const p = this._mathToPx(mx, my);
        ctx.moveTo(p.x, y0); ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      // points
      const r = 4 * dpr;
      ctx.fillStyle = color;
      ctx.strokeStyle = this.opts.pointHalo;
      ctx.lineWidth = 2 * dpr;
      for (const [mx, my] of pts) {
        const p = this._mathToPx(mx, my);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }
      ctx.restore(); // M-08
    }

    _drawPoint(ast, env, color, restr, label) {
      const ctx = this.ctx;
      const [rawX, rawY] = evalAst(ast, env);
      const xs = Array.isArray(rawX) ? rawX : [rawX];
      const ys = Array.isArray(rawY) ? rawY : [rawY];
      const cnt = Math.max(xs.length, ys.length);
      const single = cnt === 1;
      for (let pi = 0; pi < cnt; pi++) {
      const mx = xs[pi % xs.length], my = ys[pi % ys.length];
      if (!Number.isFinite(mx) || !Number.isFinite(my)) continue;
      if (restr && restr.length && !passRestrict(restr, env, mx, my)) continue;
      const p = this._mathToPx(mx, my);
      const r = 5 * (this._dpr || 1);
      ctx.fillStyle = color;
      ctx.strokeStyle = this.opts.pointHalo;
      ctx.lineWidth = 2 * (this._dpr || 1);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI*2);
      ctx.fill(); ctx.stroke();
      const dpr = this._dpr || 1;
      if (label) {
        // № 6: кастомний підпис — на плашці, кольором точки
        ctx.font = `600 ${12.5*dpr}px "Helvetica Neue", Arial, sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        const tx = p.x + r + 4*dpr, ty = p.y - r - 2*dpr;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(255,255,255,0.82)';
        ctx.fillRect(tx - 3*dpr, ty - 14.5*dpr, tw + 6*dpr, 17*dpr);
        ctx.fillStyle = color;
        ctx.fillText(label, tx, ty);
      } else if (single) {
        // Coordinate label — лише для одиночної точки (сім'ї без підписів, щоб не захаращувати)
        ctx.fillStyle = this.opts.pointLabel;
        ctx.font = `${11*dpr}px "Helvetica Neue", Arial, sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        const fmt = (n) => Math.abs(n) < 1e-10 ? '0' : String(parseFloat(n.toPrecision(6))); // M-01/M-06
        ctx.fillText(`(${fmt(mx)}, ${fmt(my)})`, p.x + r + 3*dpr, p.y - r);
      }
      }
    }

    destroy() {
      this._destroyed = true;                                   // C-03: guard post-destroy callbacks
      try { this._ro && this._ro.disconnect(); } catch (_) {}
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._animRaf) cancelAnimationFrame(this._animRaf);  // C-01: stop animation RAF
      if (this._ac) this._ac.abort();                          // C-02: remove all canvas listeners
      if (this.container) this.container.innerHTML = '';       // §15: guard for OffscreenCanvas path (container=null)
    }
  }

  // ---- boolean evaluation (comparisons joined by and/or/not) ----
  function boolFreeVars(node) {
    const out = new Set();
    (function w(n) {
      if (!n) return;
      if (n.kind === 'cmp') { n.operands.forEach((o) => freeVars(o).forEach((v) => out.add(v))); }
      else if (n.kind === 'logic') { w(n.arg); w(n.left); w(n.right); }
    })(node);
    return out;
  }
  function boolEval(node, env) {
    if (node.kind === 'cmp') {
      for (let k = 0; k < node.ops.length; k++) {
        const a = evalAst(node.operands[k], env), b = evalAst(node.operands[k + 1], env);
        if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
        const op = node.ops[k];
        if (op === '<' && !(a < b)) return false;
        if (op === '<=' && !(a <= b)) return false;
        if (op === '>' && !(a > b)) return false;
        if (op === '>=' && !(a >= b)) return false;
      }
      return true;
    }
    if (node.kind === 'logic') {
      if (node.op === 'not') return !boolEval(node.arg, env);
      if (node.op === 'and') return boolEval(node.left, env) && boolEval(node.right, env);
      if (node.op === 'or') return boolEval(node.left, env) || boolEval(node.right, env);
    }
    return false;
  }

  // Does point (x,y) satisfy all trailing domain restrictions?
  function passRestrict(restrictions, baseEnv, x, y) {
    if (!restrictions || !restrictions.length) return true;
    const env = { ...baseEnv, x, y };
    for (const r of restrictions) {
      try { if (!boolEval(r.test, env)) return false; }
      catch (_) { return false; }
    }
    return true;
  }

  // Wrap classifyCore: attach any trailing {..} domain restrictions to the result.
  function classify(src, paramNames = []) {
    const r = classifyCore(src, paramNames);
    if (r && r.kind !== 'invalid') {
      try { const ast = parse(src); r.restrictions = ast.restrictions || []; }
      catch (_) { r.restrictions = []; }
    }
    return r;
  }

  window.GraphCalculator = GraphCalculator;
  window.GraphCalc = { parse, classify, evalAst, evalComplex, freeVars, FUNCS, CONSTS, hexRgba, passRestrict, boolEval, fitRegression, setAngleMode, getAngleMode };
  // A-01: unified namespace for M4SH integration; keeps existing globals for back-compat
  window.MathEngine = { GraphCalculator, GraphCalc: window.GraphCalc, EventEmitter };
})();
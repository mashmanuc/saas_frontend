// trig-equations.js — Solving elementary trig equations on the unit circle.
// Visualizes sin x = a, cos x = a, tg x = a, ctg x = a simultaneously on the
// unit circle (left) and the corresponding function graph (right). Drag the
// reference line (a slider on the graph side, or directly on the circle) to
// change `a` and watch every solution move continuously. Snap to special
// table values to get exact π-fraction answers.

(function () {
  const PAL = {
    bg:        '#fffaf0',
    gridMinor: 'rgba(43,33,24,0.07)',
    gridMajor: 'rgba(43,33,24,0.16)',
    axis:      '#2b2118',
    axisLab:   '#5a4a3a',
    circle:    '#2b2118',
    sin:       '#a83a5b',
    cos:       '#3b7b9b',
    tan:       '#3a8a4f',
    cot:       '#7b6193',
    famA:      '#c4622a',  // first solution family
    famB:      '#3a8a4f',  // second solution family (sin/cos)
    famAdim:   'rgba(196,98,42,0.45)',
    famBdim:   'rgba(58,138,79,0.45)',
    refLine:   '#2b2118',
    refDot:    '#bba040',
    noSol:     '#a83a5b',
    paper:     '#fffaf0',
  };
  const TAU = Math.PI * 2;
  const HPI = Math.PI / 2;
  const ROOT3 = Math.sqrt(3);

  // ===== Exact-value tables ==============================================
  const SPECIAL_SIN_COS = [
    { v: 0,                lab: '0' },
    { v: 0.5,              lab: '½' },
    { v: Math.SQRT2 / 2,   lab: '√2/2' },
    { v: ROOT3 / 2,        lab: '√3/2' },
    { v: 1,                lab: '1' },
  ];
  const SPECIAL_TG_CTG = [
    { v: 0,        lab: '0' },
    { v: 1/ROOT3,  lab: '√3/3' },
    { v: 1,        lab: '1' },
    { v: ROOT3,    lab: '√3' },
  ];

  function piLab(num, den) {
    if (num === 0) return '0';
    const sign = num < 0 ? '−' : '';
    const n = Math.abs(num);
    if (den === 1 && n === 1) return sign + 'π';
    if (den === 1) return sign + n + 'π';
    if (n === 1) return sign + 'π/' + den;
    return sign + n + 'π/' + den;
  }

  // map(label, type) → π-fraction parts for the principal angle
  const ALPHA_LAB = {
    sin: { '0':[0,1],   '½':[1,6],   '−½':[-1,6],   '√2/2':[1,4],   '−√2/2':[-1,4],   '√3/2':[1,3],   '−√3/2':[-1,3],   '1':[1,2],   '−1':[-1,2] },
    cos: { '0':[1,2],   '½':[1,3],   '−½':[2,3],    '√2/2':[1,4],   '−√2/2':[3,4],    '√3/2':[1,6],   '−√3/2':[5,6],    '1':[0,1],   '−1':[1,1]  },
    tan: { '0':[0,1],   '√3/3':[1,6],'−√3/3':[-1,6],'1':[1,4],      '−1':[-1,4],      '√3':[1,3],     '−√3':[-1,3] },
    cot: { '0':[1,2],   '√3/3':[1,3],'−√3/3':[2,3], '1':[1,4],      '−1':[3,4],       '√3':[1,6],     '−√3':[5,6] },
  };

  // Pretty fmt numbers
  const fmt = (n, d = 3) => {
    if (!Number.isFinite(n)) return '∞';
    const k = Math.pow(10, d);
    const r = Math.round(n * k) / k;
    return (Math.abs(r) < 1e-9 ? 0 : r).toString().replace('.', ',');
  };

  function analyze(a, type) {
    const out = { match: false, aLab: fmt(a, 3), hasSolution: true, alpha: 0, alphaLab: null };
    if (type === 'sin' || type === 'cos') {
      if (Math.abs(a) > 1.0001) { out.hasSolution = false; return out; }
    }
    // numeric -> label
    const sign = a < 0 ? -1 : 1;
    const av = Math.abs(a);
    const table = (type === 'tan' || type === 'cot') ? SPECIAL_TG_CTG : SPECIAL_SIN_COS;
    for (const s of table) {
      if (Math.abs(av - s.v) < 0.0035) {
        out.match = true;
        out.aLab = (sign < 0 && s.lab !== '0') ? '−' + s.lab : s.lab;
        break;
      }
    }
    // principal angle
    if (type === 'sin') out.alpha = Math.asin(a);                 // [-π/2, π/2]
    if (type === 'cos') out.alpha = Math.acos(a);                 // [0, π]
    if (type === 'tan') out.alpha = Math.atan(a);                 // (-π/2, π/2)
    if (type === 'cot') out.alpha = HPI - Math.atan(a);           // (0, π)
    // exact label
    if (out.match) {
      const v = ALPHA_LAB[type][out.aLab];
      if (v) out.alphaLab = piLab(v[0], v[1]);
    }
    return out;
  }

  // Return solutions in [xMin, xMax] for one fundamental shape.
  function allSolutions(a, type, xMin, xMax) {
    const info = analyze(a, type);
    if (!info.hasSolution) return [];
    const out = [];
    const alpha = info.alpha;
    const push = (x, fam) => { if (x >= xMin - 1e-3 && x <= xMax + 1e-3) out.push({ x, fam }); };
    if (type === 'sin') {
      const nMin = Math.floor((xMin - alpha) / TAU) - 1;
      const nMax = Math.ceil((xMax - alpha) / TAU)  + 1;
      for (let n = nMin; n <= nMax; n++) {
        push(alpha + TAU * n, 'A');
        push(Math.PI - alpha + TAU * n, 'B');
      }
    } else if (type === 'cos') {
      const nMin = Math.floor((xMin - alpha) / TAU) - 1;
      const nMax = Math.ceil((xMax - alpha) / TAU)  + 1;
      for (let n = nMin; n <= nMax; n++) {
        push(alpha + TAU * n, 'A');
        if (Math.abs(alpha) > 1e-6 && Math.abs(alpha - Math.PI) > 1e-6) push(-alpha + TAU * n, 'B');
      }
    } else {
      const nMin = Math.floor((xMin - alpha) / Math.PI) - 1;
      const nMax = Math.ceil((xMax - alpha) / Math.PI)  + 1;
      for (let n = nMin; n <= nMax; n++) push(alpha + Math.PI * n, 'A');
    }
    out.sort((a, b) => a.x - b.x);
    return out;
  }

  // ===== Inequality helpers ==============================================
  function parsePiLab(lab) {
    if (lab === '0') return { num: 0, den: 1 };
    let s = lab, sign = 1;
    if (s.startsWith('−')) { sign = -1; s = s.slice(1); }
    const m = s.match(/^(\d+)?π(\/(\d+))?$/);
    if (!m) return null;
    const n = m[1] ? parseInt(m[1], 10) : 1;
    const d = m[3] ? parseInt(m[3], 10) : 1;
    return { num: sign * n, den: d };
  }
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
  function piFracReduce(num, den) {
    const g = gcd(num, den);
    return piLab(num / g, den / g);
  }

  // For given (type, a, rel), return the base solution interval (one period).
  // kind: 'normal'|'empty'|'all'|'point'
  function intervalFor(type, a, rel) {
    const info = analyze(a, type);
    const closed = (rel === '>=' || rel === '<=');
    if ((type === 'sin' || type === 'cos') && Math.abs(a) > 1.0001) {
      const above = (rel === '>' || rel === '>=');
      const allOrNone = above ? (a < -1 ? 'all' : 'empty') : (a > 1 ? 'all' : 'empty');
      return { kind: allOrNone, period: TAU };
    }
    const alpha = info.alpha;
    let x0, x1, cL = closed, cR = closed, period = TAU;
    if (type === 'sin') {
      if (rel === '>' || rel === '>=') { x0 = alpha; x1 = Math.PI - alpha; }
      else                              { x0 = Math.PI - alpha; x1 = TAU + alpha; }
    } else if (type === 'cos') {
      if (rel === '>' || rel === '>=') { x0 = -alpha; x1 = alpha; }
      else                              { x0 = alpha;  x1 = TAU - alpha; }
    } else if (type === 'tan') {
      period = Math.PI;
      if (rel === '>' || rel === '>=') { x0 = alpha;  x1 = HPI;    cR = false; }
      else                              { x0 = -HPI;   x1 = alpha; cL = false; }
    } else if (type === 'cot') {
      period = Math.PI;
      if (rel === '>' || rel === '>=') { x0 = 0;       x1 = alpha; cL = false; }
      else                              { x0 = alpha;  x1 = Math.PI; cR = false; }
    }
    if (Math.abs(x1 - x0) < 1e-6) {
      if (cL && cR) return { x0, x1: x0, closed: [true, true], period, kind: 'point' };
      return { kind: 'empty', period };
    }
    if (Math.abs((x1 - x0) - period) < 1e-6 && cL && cR) {
      return { kind: 'all', period };
    }
    return { x0, x1, closed: [cL, cR], period, kind: 'normal' };
  }

  function intervalCopies(base, xMin, xMax) {
    if (base.kind === 'empty') return [];
    if (base.kind === 'all') return [{ x0: xMin - 1, x1: xMax + 1, closed: [true, true], primary: true, kind: 'all' }];
    const { x0, x1, closed, period } = base;
    const out = [];
    const nMin = Math.floor((xMin - x0) / period) - 1;
    const nMax = Math.ceil ((xMax - x0) / period) + 1;
    for (let n = nMin; n <= nMax; n++) {
      const a0 = x0 + period * n;
      const a1 = x1 + period * n;
      if (a1 < xMin - 0.05 || a0 > xMax + 0.05) continue;
      out.push({ x0: a0, x1: a1, closed: [closed[0], closed[1]], primary: (n === 0), kind: base.kind });
    }
    return out;
  }

  // Polyline points along an arc from math angle θ1 to θ2 (CCW).
  function arcPolyline(cx, cy, r, theta1, theta2, N = 80) {
    let t2 = theta2;
    while (t2 < theta1) t2 += TAU;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = theta1 + (t2 - theta1) * (i / N);
      pts.push({ x: cx + r * Math.cos(t), y: cy - r * Math.sin(t) });
    }
    return pts;
  }

  // Build symbolic endpoint strings for the HUD interval display.
  function endpointStrs(type, rel, info) {
    const inv = type === 'sin' ? 'arcsin' : type === 'cos' ? 'arccos' : type === 'tan' ? 'arctg' : 'arcctg';
    const aLab = info.aLab;
    const alphaLab = info.alphaLab;
    const p = alphaLab ? parsePiLab(alphaLab) : null;
    const isGe = (rel === '>' || rel === '>=');
    if (type === 'sin') {
      if (isGe) {
        if (p) return { L: piFracReduce(p.num, p.den), R: piFracReduce(p.den - p.num, p.den), period: '2πn' };
        return { L: `${inv}\u00a0${aLab}`, R: `π − ${inv}\u00a0${aLab}`, period: '2πn' };
      } else {
        if (p) return { L: piFracReduce(p.den - p.num, p.den), R: piFracReduce(2 * p.den + p.num, p.den), period: '2πn' };
        return { L: `π − ${inv}\u00a0${aLab}`, R: `2π + ${inv}\u00a0${aLab}`, period: '2πn' };
      }
    }
    if (type === 'cos') {
      if (isGe) {
        if (p) return { L: piFracReduce(-p.num, p.den), R: piFracReduce(p.num, p.den), period: '2πn' };
        return { L: `− ${inv}\u00a0${aLab}`, R: `${inv}\u00a0${aLab}`, period: '2πn' };
      } else {
        if (p) return { L: piFracReduce(p.num, p.den), R: piFracReduce(2 * p.den - p.num, p.den), period: '2πn' };
        return { L: `${inv}\u00a0${aLab}`, R: `2π − ${inv}\u00a0${aLab}`, period: '2πn' };
      }
    }
    if (type === 'tan') {
      if (isGe) {
        const Lstr = p ? piFracReduce(p.num, p.den) : `${inv}\u00a0${aLab}`;
        return { L: Lstr, R: 'π/2', period: 'πn' };
      } else {
        const Rstr = p ? piFracReduce(p.num, p.den) : `${inv}\u00a0${aLab}`;
        return { L: '−π/2', R: Rstr, period: 'πn' };
      }
    }
    if (type === 'cot') {
      if (isGe) {
        const Rstr = p ? piFracReduce(p.num, p.den) : `${inv}\u00a0${aLab}`;
        return { L: '0', R: Rstr, period: 'πn' };
      } else {
        const Lstr = p ? piFracReduce(p.num, p.den) : `${inv}\u00a0${aLab}`;
        return { L: Lstr, R: 'π', period: 'πn' };
      }
    }
    return null;
  }

  class TrigEquation {
    constructor(container, opts = {}) {
      this.container = container;
      this.opts = Object.assign({
        type: 'sin',            // 'sin' | 'cos' | 'tan' | 'cot'
        rel:  '=',              // '=' | '>' | '<' | '>=' | '<='
        a:    0.5,
        showDeg: false,
        showRad: true,
        showSpecialPoints: true, // 16 yellow dots
        showRefLabels: true,    // numeric labels on circle
        snapSpecial: false,     // snap `a` to special values
        showAllSolutions: true, // periodic copies (faint)
        showGraph: true,
      }, opts);
      this._build();
      this._bindInteraction();
      this._pollTimers = [0, 50, 200, 500].map((ms) => setTimeout(() => this._render(), ms));
    }

    setOption(k, v) { this.opts[k] = v; this._render(); this.onChange && this.onChange(); }
    setA(a) {
      a = Math.max(this._aRange()[0], Math.min(this._aRange()[1], a));
      if (this.opts.snapSpecial) a = this._snap(a);
      this.opts.a = a;
      this._render();
      this.onChange && this.onChange();
    }
    setType(t) {
      this.opts.type = t;
      const [lo, hi] = this._aRange();
      this.opts.a = Math.max(lo, Math.min(hi, this.opts.a));
      this._render();
      this.onChange && this.onChange();
    }
    setRel(rel) {
      this.opts.rel = rel;
      this._render();
      this.onChange && this.onChange();
    }
    _isIneq() { return this.opts.rel && this.opts.rel !== '='; }

    _aRange() { return (this.opts.type === 'tan' || this.opts.type === 'cot') ? [-5, 5] : [-1.5, 1.5]; }
    _snap(a) {
      const table = (this.opts.type === 'tan' || this.opts.type === 'cot') ? SPECIAL_TG_CTG : SPECIAL_SIN_COS;
      const sign = a < 0 ? -1 : 1;
      const av = Math.abs(a);
      let best = av, bestD = Infinity;
      for (const s of table) {
        const d = Math.abs(av - s.v);
        if (d < bestD) { bestD = d; best = s.v; }
      }
      // also allow snapping to negative-of-zero range: also snap to ±values
      return bestD < 0.08 ? sign * best : a;
    }

    _build() {
      const c = this.container;
      c.classList.add('trig-root', 'trig-eq-root');
      c.style.position = 'relative';
      c.style.background = PAL.bg;
      this.canvas = document.createElement('canvas');
      this.canvas.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%;touch-action:none;user-select:none;cursor:grab;';
      c.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.hud = document.createElement('div');
      this.hud.className = 'calc-hud calc-hud-eq';
      c.appendChild(this.hud);
      this._ro = new ResizeObserver(() => this._render());
      this._ro.observe(c);
      this._onWinResize = () => this._render();
      window.addEventListener('resize', this._onWinResize);
    }

    _resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = this.container.getBoundingClientRect();
      const w = Math.max(40, r.width), h = Math.max(40, r.height);
      const nw = w * dpr, nh = h * dpr;
      if (this.canvas.width !== nw || this.canvas.height !== nh) {
        this.canvas.width = nw; this.canvas.height = nh;
      }
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this._dpr = dpr;
    }

    // ==== layout =========================================================
    _layout() {
      const w = this.canvas.width, h = this.canvas.height;
      const dpr = this._dpr || 1;
      const pad = 24 * dpr;
      if (!this.opts.showGraph || w < 600 * dpr) {
        const size = Math.min(w, h) - pad * 2;
        return { dual: false, circle: { cx: w/2, cy: h/2, r: size/2 - 44*dpr } };
      }
      const labelMargin = 40 * dpr;
      const circleColW = w * 0.46 - pad * 2;
      const maxR_byWidth  = circleColW / 2 - labelMargin;
      const maxR_byHeight = h / 2 - pad - 14 * dpr - labelMargin / 2;
      const cR = Math.max(40 * dpr, Math.min(maxR_byWidth, maxR_byHeight));
      const cx = pad + labelMargin + cR;
      const cy = h / 2;
      const gx0 = cx + cR + labelMargin + 16 * dpr;
      const gx1 = w - pad - 28 * dpr; // leave room for `a` label on right
      const gMid = h / 2;
      const gHalfBox = cR + 14 * dpr;
      return {
        dual: true,
        circle: { cx, cy, r: cR },
        graph:  { x0: gx0, y0: gMid - gHalfBox, x1: gx1, y1: gMid + gHalfBox, mid: gMid },
      };
    }

    // Map graph-x (radians) to canvas px (in current layout)
    _gx(t)  { const G = this._layout().graph; return G.x0 + ((t - this._gMin()) / (this._gMax() - this._gMin())) * (G.x1 - G.x0); }
    _gMin() { return -Math.PI; }
    _gMax() { return Math.PI * 3; }
    // For graph y-value mapping
    _gY(v)  {
      const G = this._layout().graph;
      const half = (G.y1 - G.y0) / 2 - 14 * (this._dpr || 1);
      // Clamp the visible y window. Sin/cos use ±1.5, tg/ctg use ±3
      const yScale = (this.opts.type === 'tan' || this.opts.type === 'cot') ? 3.5 : 1.5;
      return G.mid - (v / yScale) * half;
    }
    _gYScale() { return (this.opts.type === 'tan' || this.opts.type === 'cot') ? 3.5 : 1.5; }

    // ==== interaction ====================================================
    _bindInteraction() {
      let dragging = null;
      const setFromXY = (clientX, clientY) => {
        const r = this.canvas.getBoundingClientRect();
        const dpr = this._dpr || 1;
        const px = (clientX - r.left) * dpr;
        const py = (clientY - r.top) * dpr;
        const L = this._layout();
        let newA = this.opts.a;
        if (L.dual && px > L.graph.x0 - 12) {
          // dragging on graph: y position → a
          const half = (L.graph.y1 - L.graph.y0) / 2 - 14 * dpr;
          const v = -(py - L.graph.mid) / half * this._gYScale();
          newA = v;
        } else {
          // on circle: depends on type
          const dx = (px - L.circle.cx) / L.circle.r;
          const dy = -(py - L.circle.cy) / L.circle.r;
          if (this.opts.type === 'sin') newA = dy;
          else if (this.opts.type === 'cos') newA = dx;
          else if (this.opts.type === 'tan') {
            // drag on right tangent line: vertical position relative to (1,0)
            newA = dy; // (1, a) where a = y/x; for x=1, a = y
            if (Math.abs(dx) > 0.1) newA = dy / Math.max(0.1, dx);
          }
          else if (this.opts.type === 'cot') {
            newA = dx; // (a, 1) where a = x/y for y=1
            if (Math.abs(dy) > 0.1) newA = dx / Math.max(0.1, dy);
          }
        }
        this.setA(newA);
      };
      this.canvas.addEventListener('pointerdown', (e) => {
        dragging = true;
        try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
        this.canvas.style.cursor = 'grabbing';
        setFromXY(e.clientX, e.clientY);
      });
      this.canvas.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        setFromXY(e.clientX, e.clientY);
      });
      const up = (e) => {
        if (!dragging) return;
        dragging = false;
        this.canvas.style.cursor = 'grab';
        try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      };
      this.canvas.addEventListener('pointerup', up);
      this.canvas.addEventListener('pointercancel', up);
    }

    // ==== render =========================================================
    _render() {
      this._resize();
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, w, h);
      const L = this._layout();
      this._drawCircle(L);
      if (L.dual) this._drawGraph(L);
      this._renderHud();
    }

    _fnColor() {
      return this.opts.type === 'sin' ? PAL.sin :
             this.opts.type === 'cos' ? PAL.cos :
             this.opts.type === 'tan' ? PAL.tan : PAL.cot;
    }

    // ==== CIRCLE side ====================================================
    _drawCircle(L) {
      const ctx = this.ctx, dpr = this._dpr || 1;
      const { cx, cy, r } = L.circle;
      const a = this.opts.a;
      const info = analyze(a, this.opts.type);
      const fnColor = this._fnColor();

      // axes
      ctx.strokeStyle = PAL.axis;
      ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath();
      ctx.moveTo(cx - r - 22*dpr, cy); ctx.lineTo(cx + r + 22*dpr, cy);
      ctx.moveTo(cx, cy - r - 22*dpr); ctx.lineTo(cx, cy + r + 22*dpr);
      ctx.stroke();

      // axis arrows (tiny)
      ctx.fillStyle = PAL.axis;
      ctx.beginPath(); ctx.moveTo(cx + r + 22*dpr, cy); ctx.lineTo(cx + r + 16*dpr, cy - 3*dpr); ctx.lineTo(cx + r + 16*dpr, cy + 3*dpr); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx, cy - r - 22*dpr); ctx.lineTo(cx - 3*dpr, cy - r - 16*dpr); ctx.lineTo(cx + 3*dpr, cy - r - 16*dpr); ctx.closePath(); ctx.fill();

      // axis labels x, y
      ctx.fillStyle = PAL.axisLab;
      ctx.font = `${11*dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('x', cx + r + 24*dpr, cy + 8*dpr);
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText('y', cx - 9*dpr, cy - r - 22*dpr);

      // the circle itself
      ctx.strokeStyle = PAL.circle;
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();

      // ----- reference structure based on equation type -----
      const drawDottedSeg = (x0, y0, x1, y1, color) => {
        ctx.strokeStyle = color; ctx.setLineDash([5*dpr, 4*dpr]); ctx.lineWidth = 1.4*dpr;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.setLineDash([]);
      };

      if (this.opts.type === 'sin') {
        // horizontal line y = a (across circle)
        const yA = cy - a * r;
        ctx.strokeStyle = fnColor; ctx.lineWidth = 2 * dpr; ctx.setLineDash([7*dpr, 5*dpr]);
        ctx.beginPath();
        ctx.moveTo(cx - r - 16*dpr, yA);
        ctx.lineTo(cx + r + 16*dpr, yA);
        ctx.stroke();
        ctx.setLineDash([]);
        // mark `a` on y-axis
        const aDot = { x: cx, y: yA };
        ctx.fillStyle = fnColor;
        ctx.beginPath(); ctx.arc(aDot.x, aDot.y, 4.5*dpr, 0, TAU); ctx.fill();
        // value label
        ctx.fillStyle = fnColor;
        ctx.font = `600 ${12*dpr}px JetBrains Mono, monospace`;
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText('a = ' + info.aLab, cx - 8*dpr, yA);
      } else if (this.opts.type === 'cos') {
        // vertical line x = a
        const xA = cx + a * r;
        ctx.strokeStyle = fnColor; ctx.lineWidth = 2 * dpr; ctx.setLineDash([7*dpr, 5*dpr]);
        ctx.beginPath();
        ctx.moveTo(xA, cy - r - 16*dpr);
        ctx.lineTo(xA, cy + r + 16*dpr);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = fnColor;
        ctx.beginPath(); ctx.arc(xA, cy, 4.5*dpr, 0, TAU); ctx.fill();
        ctx.font = `600 ${12*dpr}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText('a = ' + info.aLab, xA, cy + 6*dpr);
      } else if (this.opts.type === 'tan') {
        // tangent line at x = 1, mark point (1, a)
        const lineX = cx + r;
        ctx.strokeStyle = fnColor; ctx.lineWidth = 1.4 * dpr; ctx.setLineDash([5*dpr, 4*dpr]);
        const aClamped = Math.max(-2, Math.min(2, a));
        ctx.beginPath();
        ctx.moveTo(lineX, cy - r * 1.6);
        ctx.lineTo(lineX, cy + r * 1.6);
        ctx.stroke();
        ctx.setLineDash([]);
        // label "вісь тангенсів"
        ctx.fillStyle = fnColor;
        ctx.font = `${10*dpr}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.save();
        ctx.translate(lineX + 12*dpr, cy + r * 1.7);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('вісь tg', 0, 0);
        ctx.restore();
        // point (1, a)
        const aY = cy - aClamped * r;
        ctx.fillStyle = fnColor;
        ctx.beginPath(); ctx.arc(lineX, aY, 5*dpr, 0, TAU); ctx.fill();
        ctx.font = `600 ${12*dpr}px JetBrains Mono, monospace`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('a = ' + info.aLab, lineX + 8*dpr, aY);
      } else if (this.opts.type === 'cot') {
        // cotangent line at y = 1, mark point (a, 1)
        const lineY = cy - r;
        ctx.strokeStyle = fnColor; ctx.lineWidth = 1.4 * dpr; ctx.setLineDash([5*dpr, 4*dpr]);
        ctx.beginPath();
        ctx.moveTo(cx - r * 1.6, lineY);
        ctx.lineTo(cx + r * 1.6, lineY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = fnColor;
        ctx.font = `${10*dpr}px JetBrains Mono, monospace`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText('вісь ctg', cx + r * 1.05, lineY - 4*dpr);
        // point (a, 1)
        const aClamped = Math.max(-2, Math.min(2, a));
        const aX = cx + aClamped * r;
        ctx.fillStyle = fnColor;
        ctx.beginPath(); ctx.arc(aX, lineY, 5*dpr, 0, TAU); ctx.fill();
        ctx.font = `600 ${12*dpr}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText('a = ' + info.aLab, aX, lineY - 8*dpr);
      }

      // ----- inequality branch: hand off to _drawCircleIneq -----
      if (this._isIneq()) {
        this._drawCircleIneq(L, info);
        // origin
        ctx.fillStyle = '#2b2118';
        ctx.beginPath(); ctx.arc(cx, cy, 3 * dpr, 0, TAU); ctx.fill();
        ctx.fillStyle = PAL.axisLab;
        ctx.font = `${10*dpr}px JetBrains Mono, monospace`;
        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText('O', cx - 5*dpr, cy + 4*dpr);
        return;
      }

      // ----- no solution case for sin/cos when |a| > 1 -----
      if (!info.hasSolution) {
        ctx.fillStyle = PAL.noSol;
        ctx.font = `bold ${14*dpr}px Inter, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('|a| > 1  →  розв\u0027язків немає', cx, cy + r + 36*dpr);
        // origin
        ctx.fillStyle = '#2b2118';
        ctx.beginPath(); ctx.arc(cx, cy, 3*dpr, 0, TAU); ctx.fill();
        return;
      }

      // ----- solutions on circle -----
      // Get the two principal points (or one for tg/ctg)
      const principal = this._principalCirclePoints(info);
      // Draw dropped construction line + ray for each principal point
      principal.forEach((sol) => {
        const col = sol.fam === 'A' ? PAL.famA : PAL.famB;
        const cosT = Math.cos(sol.x), sinT = Math.sin(sol.x);
        const px = cx + r * cosT, py = cy - r * sinT;
        // radius ray from origin to point (orange / green)
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.6 * dpr;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
        // for tg / ctg: extend ray to the tangent line so the geometry is clear
        if (this.opts.type === 'tan' && Math.abs(cosT) > 0.04) {
          const tipX = cx + r;
          const tipY = cy - (sinT / cosT) * r;
          ctx.strokeStyle = col;
          ctx.setLineDash([3*dpr, 5*dpr]); ctx.lineWidth = 1.4*dpr;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tipX, tipY); ctx.stroke();
          ctx.setLineDash([]);
        }
        if (this.opts.type === 'cot' && Math.abs(sinT) > 0.04) {
          const tipY = cy - r;
          const tipX = cx + (cosT / sinT) * r;
          ctx.strokeStyle = col;
          ctx.setLineDash([3*dpr, 5*dpr]); ctx.lineWidth = 1.4*dpr;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tipX, tipY); ctx.stroke();
          ctx.setLineDash([]);
        }
        // sweep arc indicator (small)
        ctx.strokeStyle = col;
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        // angle from 0 to sol.x (positive direction CCW)
        ctx.arc(cx, cy, r * 0.18, 0, -sol.x, true);
        ctx.stroke();
        // dot
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.22;
        ctx.beginPath(); ctx.arc(px, py, 12*dpr, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(px, py, 7*dpr, 0, TAU); ctx.fill();
        ctx.strokeStyle = PAL.paper; ctx.lineWidth = 2*dpr; ctx.stroke();
        // angle label  e.g. "π/6" placed outside circle
        ctx.fillStyle = col;
        ctx.font = `bold ${12*dpr}px JetBrains Mono, monospace`;
        // Skip overflow labels (e.g. "arctg a + π") past the panel edge -- HUD has them anyway
        const labelOk = sol.label.length <= 10;
        if (labelOk) {
          const lx = cx + (r + 18*dpr) * cosT;
          const ly = cy - (r + 18*dpr) * sinT;
          ctx.textAlign = cosT > 0.2 ? 'left' : (cosT < -0.2 ? 'right' : 'center');
          ctx.textBaseline = sinT > 0.2 ? 'bottom' : (sinT < -0.2 ? 'top' : 'middle');
          ctx.fillText(sol.label, lx, ly);
        }
      });

      // origin
      ctx.fillStyle = '#2b2118';
      ctx.beginPath(); ctx.arc(cx, cy, 3 * dpr, 0, TAU); ctx.fill();
      ctx.fillStyle = PAL.axisLab;
      ctx.font = `${10*dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText('O', cx - 5*dpr, cy + 4*dpr);
    }

    // ==== CIRCLE inequality drawing ======================================
    _drawCircleIneq(L, info) {
      const ctx = this.ctx, dpr = this._dpr || 1;
      const { cx, cy, r } = L.circle;
      const a = this.opts.a;
      const t = this.opts.type;
      const rel = this.opts.rel;
      const base = intervalFor(t, a, rel);

      // empty case
      if (base.kind === 'empty') {
        ctx.fillStyle = PAL.noSol;
        ctx.font = `bold ${14*dpr}px Inter, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('\u2205\u00a0\u00a0\u0440\u043e\u0437\u0432\u0027\u044f\u0437\u043a\u0456\u0432 \u043d\u0435\u043c\u0430\u0454', cx, cy + r + 36*dpr);
        return;
      }
      // all reals
      if (base.kind === 'all') {
        // shade entire disk + thick ring
        ctx.fillStyle = 'rgba(196,98,42,0.14)';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
        ctx.strokeStyle = PAL.famA; ctx.lineWidth = 5 * dpr; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.fillStyle = PAL.famA;
        ctx.font = `600 ${12*dpr}px Inter, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('x \u2208 \u211d', cx, cy + r + 36*dpr);
        return;
      }
      // single-point case (degenerate equality-like)
      if (base.kind === 'point') {
        const px = cx + r * Math.cos(base.x0), py = cy - r * Math.sin(base.x0);
        ctx.strokeStyle = PAL.famA; ctx.lineWidth = 2.6*dpr;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
        ctx.fillStyle = PAL.famA;
        ctx.globalAlpha = 0.22; ctx.beginPath(); ctx.arc(px, py, 12*dpr, 0, TAU); ctx.fill();
        ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(px, py, 7*dpr, 0, TAU); ctx.fill();
        ctx.strokeStyle = PAL.paper; ctx.lineWidth = 2*dpr; ctx.stroke();
        return;
      }

      // normal case — compute arc pieces visible on the unit circle.
      // For sin/cos: one arc (period 2π). For tg/ctg: two arcs (period π).
      const arcs = [{ x0: base.x0, x1: base.x1 }];
      if (t === 'tan' || t === 'cot') {
        arcs.push({ x0: base.x0 + Math.PI, x1: base.x1 + Math.PI });
      }

      // Disk segment fill for sin/cos (chord region where condition holds)
      if (t === 'sin' || t === 'cos') {
        const pts = arcPolyline(cx, cy, r, base.x0, base.x1, 90);
        ctx.beginPath();
        pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
        ctx.closePath();
        ctx.fillStyle = 'rgba(196,98,42,0.16)';
        ctx.fill();
      } else {
        // For tg/ctg, fill the wedge from origin bounded by the two radii through endpoints + arc
        arcs.forEach(({ x0, x1 }) => {
          const pts = arcPolyline(cx, cy, r, x0, x1, 60);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          pts.forEach((p) => ctx.lineTo(p.x, p.y));
          ctx.closePath();
          ctx.fillStyle = 'rgba(196,98,42,0.10)';
          ctx.fill();
        });
      }

      // Thick highlighted arc(s) along the circle
      ctx.lineCap = 'round';
      arcs.forEach(({ x0, x1 }) => {
        const pts = arcPolyline(cx, cy, r, x0, x1, 90);
        ctx.strokeStyle = PAL.famA;
        ctx.lineWidth = 5.2 * dpr;
        ctx.beginPath();
        pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
        ctx.stroke();
      });
      ctx.lineCap = 'butt';

      // Endpoint markers (open/closed)
      const drawEndpoint = (theta, isClosed) => {
        const px = cx + r * Math.cos(theta);
        const py = cy - r * Math.sin(theta);
        ctx.beginPath(); ctx.arc(px, py, 7*dpr, 0, TAU);
        if (isClosed) {
          ctx.fillStyle = PAL.famA; ctx.fill();
          ctx.strokeStyle = PAL.paper; ctx.lineWidth = 2*dpr; ctx.stroke();
        } else {
          ctx.fillStyle = PAL.paper; ctx.fill();
          ctx.strokeStyle = PAL.famA; ctx.lineWidth = 2.5*dpr; ctx.stroke();
        }
      };
      arcs.forEach(({ x0, x1 }, idx) => {
        drawEndpoint(x0, base.closed[0]);
        drawEndpoint(x1, base.closed[1]);
      });

      // Angle labels at boundary points (mirrors equation-mode label style)
      if (this.opts.showRefLabels !== false) {
        const pts = this._principalCirclePoints(info);
        ctx.font = `bold ${12*dpr}px JetBrains Mono, monospace`;
        pts.forEach(pt => {
          if (pt.label.length > 10) return;
          const cosT = Math.cos(pt.x), sinT = Math.sin(pt.x);
          const lx = cx + (r + 18*dpr) * cosT;
          const ly = cy - (r + 18*dpr) * sinT;
          ctx.fillStyle = pt.fam === 'A' ? PAL.famA : PAL.famB;
          ctx.textAlign = cosT > 0.2 ? 'left' : (cosT < -0.2 ? 'right' : 'center');
          ctx.textBaseline = sinT > 0.2 ? 'bottom' : (sinT < -0.2 ? 'top' : 'middle');
          ctx.fillText(pt.label, lx, ly);
        });
      }
    }

    // returns array of {x: angle, fam: 'A'|'B', label: ' principal-form '}
    _principalCirclePoints(info) {
      const a = this.opts.a;
      const out = [];
      const norm = (x) => { let r = x % TAU; if (r < 0) r += TAU; return r; };
      const piLabel = (numerator, denominator) => piLab(numerator, denominator);
      if (this.opts.type === 'sin') {
        const x1 = norm(info.alpha);              // arcsin(a)
        const x2 = norm(Math.PI - info.alpha);    // π − arcsin(a)
        const lab1 = info.alphaLab ? info.alphaLab : 'arcsin a';
        const lab2 = info.alphaLab ? this._piMinus(info.alphaLab, info.alpha) : 'π − arcsin a';
        out.push({ x: x1, fam: 'A', label: lab1 });
        if (Math.abs(x1 - x2) > 1e-3) out.push({ x: x2, fam: 'B', label: lab2 });
      } else if (this.opts.type === 'cos') {
        const x1 = norm(info.alpha);              // arccos(a)
        const x2 = norm(-info.alpha);             // − arccos(a)
        const lab1 = info.alphaLab ? info.alphaLab : 'arccos a';
        const lab2 = info.alphaLab ? this._negLab(info.alphaLab) : '− arccos a';
        out.push({ x: x1, fam: 'A', label: lab1 });
        if (Math.abs(x1 - x2) > 1e-3) out.push({ x: x2, fam: 'B', label: lab2 });
      } else if (this.opts.type === 'tan') {
        const x1 = norm(info.alpha);
        const x2 = norm(info.alpha + Math.PI);
        const lab1 = info.alphaLab ? info.alphaLab : 'arctg a';
        const lab2 = info.alphaLab ? this._addPi(info.alphaLab) : 'arctg a + π';
        out.push({ x: x1, fam: 'A', label: lab1 });
        out.push({ x: x2, fam: 'A', label: lab2 });
      } else if (this.opts.type === 'cot') {
        const x1 = norm(info.alpha);
        const x2 = norm(info.alpha + Math.PI);
        const lab1 = info.alphaLab ? info.alphaLab : 'arcctg a';
        const lab2 = info.alphaLab ? this._addPi(info.alphaLab) : 'arcctg a + π';
        out.push({ x: x1, fam: 'A', label: lab1 });
        out.push({ x: x2, fam: 'A', label: lab2 });
      }
      return out;
    }

    // small label helpers -- best-effort π-fraction arithmetic
    _negLab(lab) { return lab.startsWith('−') ? lab.slice(1) : (lab === '0' ? '0' : '−' + lab); }
    _addPi(lab) {
      // lab is a label like 'π/6' or '−π/4' or '2π/3' or 'π' or '0'
      // Add π and re-emit nicely. Reuse piLab.
      const p = this._parsePiLab(lab);
      if (!p) return lab + ' + π';
      // p = {num, den}. add π = (den, den).
      const num = p.num + p.den;
      return piLab(num, p.den);
    }
    _piMinus(lab, alpha) {
      // π − lab.  parse lab and compute den, num.
      const p = this._parsePiLab(lab);
      if (!p) return 'π − ' + lab;
      const num = p.den - p.num;
      return piLab(num, p.den);
    }
    _parsePiLab(lab) {
      // returns {num, den} where label = num/den * π. Examples: '0' → {0,1}, 'π' → {1,1}, '−π' → {-1,1}, 'π/6' → {1,6}, '5π/6' → {5,6}, '−π/4' → {-1,4}
      if (lab === '0') return { num: 0, den: 1 };
      let s = lab;
      let sign = 1;
      if (s.startsWith('−')) { sign = -1; s = s.slice(1); }
      // shapes: "π", "nπ", "π/d", "nπ/d"
      const m = s.match(/^(\d+)?π(\/(\d+))?$/);
      if (!m) return null;
      const n = m[1] ? parseInt(m[1], 10) : 1;
      const d = m[3] ? parseInt(m[3], 10) : 1;
      return { num: sign * n, den: d };
    }

    // ==== GRAPH side =====================================================
    _drawGraph(L) {
      const ctx = this.ctx, dpr = this._dpr || 1;
      const G = L.graph;
      const a = this.opts.a;
      const info = analyze(a, this.opts.type);
      const fnColor = this._fnColor();
      const yScale = this._gYScale();
      const half = (G.y1 - G.y0) / 2 - 14 * dpr;
      const toY = (v) => G.mid - (v / yScale) * half;

      // frame
      ctx.strokeStyle = PAL.gridMajor; ctx.lineWidth = 1 * dpr;
      ctx.strokeRect(G.x0, G.y0, G.x1 - G.x0, G.y1 - G.y0);
      // horizontal mid axis
      ctx.strokeStyle = PAL.axis; ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath(); ctx.moveTo(G.x0, G.mid); ctx.lineTo(G.x1, G.mid); ctx.stroke();

      // vertical gridlines at π/6 multiples + labels at π/2 multiples
      const xMin = this._gMin(), xMax = this._gMax();
      ctx.strokeStyle = PAL.gridMinor; ctx.lineWidth = 1 * dpr;
      const stepFine = Math.PI / 6;
      for (let i = Math.ceil(xMin / stepFine); i * stepFine <= xMax; i++) {
        const x = this._gx(i * stepFine);
        ctx.beginPath(); ctx.moveTo(x, G.y0); ctx.lineTo(x, G.y1); ctx.stroke();
      }
      // major labels at multiples of π/2
      ctx.fillStyle = PAL.axisLab;
      ctx.font = `${10*dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const xMajorLabels = [
        { v: -Math.PI,       lab: '−π' },
        { v: -Math.PI/2,     lab: '−π/2' },
        { v: 0,              lab: '0' },
        { v: Math.PI/2,      lab: 'π/2' },
        { v: Math.PI,        lab: 'π' },
        { v: 3*Math.PI/2,    lab: '3π/2' },
        { v: 2*Math.PI,      lab: '2π' },
        { v: 5*Math.PI/2,    lab: '5π/2' },
        { v: 3*Math.PI,      lab: '3π' },
      ];
      for (const l of xMajorLabels) {
        if (l.v < xMin || l.v > xMax) continue;
        const x = this._gx(l.v);
        ctx.strokeStyle = PAL.gridMajor; ctx.lineWidth = 1*dpr;
        ctx.beginPath(); ctx.moveTo(x, G.y0); ctx.lineTo(x, G.y1); ctx.stroke();
        ctx.fillText(l.lab, x, G.y1 + 4*dpr);
      }

      // horizontal gridlines at ±½, ±1 etc.
      const yMarks = (this.opts.type === 'tan' || this.opts.type === 'cot')
        ? [{ v: 1, lab: '1' }, { v: -1, lab: '−1' }, { v: 2, lab: '2' }, { v: -2, lab: '−2' }, { v: 3, lab: '3' }, { v: -3, lab: '−3' }]
        : [{ v: 0.5, lab: '½' }, { v: -0.5, lab: '−½' }, { v: 1, lab: '1' }, { v: -1, lab: '−1' }];
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (const m of yMarks) {
        if (Math.abs(m.v) > yScale + 0.01) continue;
        const y = toY(m.v);
        ctx.strokeStyle = PAL.gridMinor; ctx.lineWidth = 1*dpr;
        ctx.beginPath(); ctx.moveTo(G.x0, y); ctx.lineTo(G.x1, y); ctx.stroke();
        ctx.fillStyle = PAL.axisLab;
        ctx.fillText(m.lab, G.x0 - 4*dpr, y);
      }

      // -- draw the function curve --
      const t = this.opts.type;
      const N = 400;
      ctx.strokeStyle = fnColor; ctx.lineWidth = 2.4 * dpr;
      if (t === 'sin' || t === 'cos') {
        const fn = t === 'sin' ? Math.sin : Math.cos;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const tt = xMin + (i / N) * (xMax - xMin);
          const v = fn(tt);
          const x = this._gx(tt), y = toY(v);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        // tg/ctg: piecewise across asymptotes
        const isTan = t === 'tan';
        const asymTest = isTan ? (x) => Math.abs(Math.cos(x)) < 0.05 : (x) => Math.abs(Math.sin(x)) < 0.05;
        const fn = isTan ? Math.tan : (x) => 1 / Math.tan(x);
        let started = false;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const tt = xMin + (i / N) * (xMax - xMin);
          if (asymTest(tt)) { started = false; continue; }
          let v = fn(tt);
          // skip out-of-range
          if (!Number.isFinite(v) || Math.abs(v) > yScale * 1.4) { started = false; continue; }
          const x = this._gx(tt), y = toY(v);
          if (!started) { ctx.moveTo(x, y); started = true; }
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        // draw asymptotes as faint dashed verticals
        ctx.strokeStyle = PAL.gridMajor; ctx.lineWidth = 1*dpr; ctx.setLineDash([3*dpr, 5*dpr]);
        const periodAsym = isTan ? HPI : 0;
        for (let k = -3; k <= 6; k++) {
          const xv = periodAsym + k * Math.PI;
          if (xv < xMin || xv > xMax) continue;
          const x = this._gx(xv);
          ctx.beginPath(); ctx.moveTo(x, G.y0); ctx.lineTo(x, G.y1); ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      // -- horizontal "y = a" line --
      if (info.hasSolution || (t === 'sin' || t === 'cos')) {
        const yA = toY(a);
        // clamp into box
        const yClamped = Math.max(G.y0, Math.min(G.y1, yA));
        ctx.strokeStyle = PAL.refLine;
        ctx.setLineDash([7*dpr, 5*dpr]); ctx.lineWidth = 1.6*dpr;
        ctx.beginPath(); ctx.moveTo(G.x0, yClamped); ctx.lineTo(G.x1, yClamped); ctx.stroke();
        ctx.setLineDash([]);
        // a-label on right side
        ctx.fillStyle = PAL.refLine;
        ctx.font = `600 ${12*dpr}px JetBrains Mono, monospace`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText('y = ' + info.aLab, G.x1 + 6*dpr, yClamped);
        // drag handle dot
        ctx.fillStyle = PAL.refLine;
        ctx.beginPath(); ctx.arc(G.x0 - 6*dpr, yClamped, 5*dpr, 0, TAU); ctx.fill();
      }

      // -- mark all solutions in the window --
      if (this._isIneq()) {
        this._drawGraphIneq(L, info);
        return;
      }
      if (info.hasSolution) {
        const sols = allSolutions(a, t, xMin, xMax);
        const showA = this._principalCirclePoints(info);
        const isPrincipal = (x) => {
          for (const p of showA) {
            // bring p.x and x to same normalized form within ±π tolerance
            const diff = ((x - p.x) % TAU + TAU) % TAU;
            if (Math.abs(diff) < 1e-3 || Math.abs(diff - TAU) < 1e-3) return p.fam;
          }
          return null;
        };
        sols.forEach((sol) => {
          const x = this._gx(sol.x);
          const y = toY(a);
          const isPri = isPrincipal(sol.x);
          const col = (sol.fam === 'A' ? PAL.famA : PAL.famB);
          const dim = isPri ? false : true;
          // vertical drop line from y=a to x-axis at sol.x
          ctx.strokeStyle = dim ? (sol.fam === 'A' ? PAL.famAdim : PAL.famBdim) : col;
          ctx.setLineDash([3*dpr, 4*dpr]); ctx.lineWidth = 1.2 * dpr;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, G.mid); ctx.stroke();
          ctx.setLineDash([]);
          // dot at intersection
          ctx.fillStyle = dim ? (sol.fam === 'A' ? PAL.famAdim : PAL.famBdim) : col;
          ctx.beginPath(); ctx.arc(x, y, dim ? 4*dpr : 6*dpr, 0, TAU); ctx.fill();
          ctx.strokeStyle = PAL.paper; ctx.lineWidth = 1.5*dpr; ctx.stroke();
          // mark on x-axis
          ctx.fillStyle = dim ? (sol.fam === 'A' ? PAL.famAdim : PAL.famBdim) : col;
          ctx.beginPath(); ctx.arc(x, G.mid, dim ? 3*dpr : 4*dpr, 0, TAU); ctx.fill();
        });
      } else {
        // sin/cos no solution: explicit text
        ctx.fillStyle = PAL.noSol;
        ctx.font = `600 ${13*dpr}px Inter, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('|a| > 1 — пряма не перетинає графік', (G.x0 + G.x1) / 2, G.y0 + 22*dpr);
      }
    }

    // ==== GRAPH inequality drawing =======================================
    _drawGraphIneq(L, info) {
      const ctx = this.ctx, dpr = this._dpr || 1;
      const G = L.graph;
      const t = this.opts.type;
      const a = this.opts.a;
      const rel = this.opts.rel;
      const xMin = this._gMin(), xMax = this._gMax();
      const yScale = this._gYScale();
      const half = (G.y1 - G.y0) / 2 - 14 * dpr;
      const toY = (v) => G.mid - (v / yScale) * half;
      const base = intervalFor(t, a, rel);
      const copies = intervalCopies(base, xMin, xMax);
      const yA = Math.max(G.y0, Math.min(G.y1, toY(a)));

      // empty case
      if (base.kind === 'empty') {
        ctx.fillStyle = PAL.noSol;
        ctx.font = `600 ${13*dpr}px Inter, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('\u2205\u00a0\u00a0\u0440\u043e\u0437\u0432\u0027\u044f\u0437\u043a\u0456\u0432 \u043d\u0435\u043c\u0430\u0454', (G.x0 + G.x1) / 2, G.y0 + 22*dpr);
        return;
      }
      // all reals — shade the whole graph
      if (base.kind === 'all') {
        ctx.fillStyle = 'rgba(196,98,42,0.12)';
        ctx.fillRect(G.x0, G.y0, G.x1 - G.x0, G.y1 - G.y0);
        ctx.strokeStyle = PAL.famA;
        ctx.lineWidth = 4 * dpr;
        ctx.beginPath(); ctx.moveTo(G.x0, G.mid); ctx.lineTo(G.x1, G.mid); ctx.stroke();
        ctx.fillStyle = PAL.famA;
        ctx.font = `600 ${12*dpr}px Inter, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('x \u2208 \u211d', (G.x0 + G.x1) / 2, G.y0 + 22*dpr);
        return;
      }

      // normal: shade vertical strips + thick bar on x-axis + endpoint markers
      copies.forEach((iv) => {
        const px0 = this._gx(iv.x0);
        const px1 = this._gx(iv.x1);
        const lx = Math.max(G.x0, px0);
        const rx = Math.min(G.x1, px1);
        if (rx <= lx) return;
        // shading
        ctx.fillStyle = iv.primary ? 'rgba(196,98,42,0.18)' : 'rgba(196,98,42,0.09)';
        ctx.fillRect(lx, G.y0, rx - lx, G.y1 - G.y0);
        // thick bar on x-axis
        ctx.strokeStyle = PAL.famA;
        ctx.lineWidth = iv.primary ? 4.6 * dpr : 3 * dpr;
        ctx.globalAlpha = iv.primary ? 1 : 0.55;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(lx, G.mid); ctx.lineTo(rx, G.mid); ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.globalAlpha = 1;
      });

      // Endpoint markers on x-axis
      copies.forEach((iv) => {
        [[iv.x0, iv.closed[0]], [iv.x1, iv.closed[1]]].forEach(([xVal, isClosed]) => {
          const px = this._gx(xVal);
          if (px < G.x0 - 6*dpr || px > G.x1 + 6*dpr) return;
          ctx.beginPath();
          ctx.arc(px, G.mid, iv.primary ? 6*dpr : 4*dpr, 0, TAU);
          if (isClosed) {
            ctx.fillStyle = PAL.famA;
            ctx.globalAlpha = iv.primary ? 1 : 0.55;
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.strokeStyle = PAL.paper; ctx.lineWidth = 1.5*dpr; ctx.stroke();
          } else {
            ctx.fillStyle = PAL.paper;
            ctx.fill();
            ctx.strokeStyle = PAL.famA;
            ctx.globalAlpha = iv.primary ? 1 : 0.55;
            ctx.lineWidth = 2.2 * dpr;
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        });
      });

      // For sin/cos: also shade the curve-vs-line region between y=a and the curve where condition holds.
      // (Pedagogical: visually shows where sin/cos lies above or below the threshold.)
      if (t === 'sin' || t === 'cos') {
        const fn = t === 'sin' ? Math.sin : Math.cos;
        const isGe = (rel === '>' || rel === '>=');
        copies.forEach((iv) => {
          const px0 = Math.max(G.x0, this._gx(iv.x0));
          const px1 = Math.min(G.x1, this._gx(iv.x1));
          if (px1 <= px0) return;
          const N = 64;
          ctx.beginPath();
          ctx.moveTo(px0, yA);
          for (let i = 0; i <= N; i++) {
            const tt = iv.x0 + (iv.x1 - iv.x0) * (i / N);
            const x = this._gx(tt);
            if (x < G.x0 - 2 || x > G.x1 + 2) continue;
            const y = toY(fn(tt));
            ctx.lineTo(x, y);
          }
          ctx.lineTo(px1, yA);
          ctx.closePath();
          ctx.fillStyle = iv.primary ? 'rgba(58,138,79,0.10)' : 'rgba(58,138,79,0.05)';
          ctx.fill();
        });
      }
    }

    // ==== HUD ============================================================
    _renderHud() {
      const a = this.opts.a;
      const t = this.opts.type;
      const rel = this.opts.rel || '=';
      const info = analyze(a, t);
      const fnText = t === 'sin' ? 'sin' : t === 'cos' ? 'cos' : t === 'tan' ? 'tg' : 'ctg';
      const inverseText = t === 'sin' ? 'arcsin' : t === 'cos' ? 'arccos' : t === 'tan' ? 'arctg' : 'arcctg';
      const relSym = rel === '=' ? '=' : rel === '>' ? '&gt;' : rel === '<' ? '&lt;' : rel === '>=' ? '≥' : '≤';
      const lines = [];
      const colorTxt = (txt, col) => `<span style="color:${col}">${txt}</span>`;

      lines.push(`<div class="calc-line key"><span>рівняння:</span> ${fnText}&nbsp;x ${relSym} ${info.aLab}</div>`);

      // ----- INEQUALITY branch -----
      if (rel !== '=') {
        const base = intervalFor(t, a, rel);
        if (base.kind === 'empty') {
          lines.push(`<div class="calc-line err">∅ розв'язків немає</div>`);
        } else if (base.kind === 'all') {
          lines.push(`<div class="calc-line">x ∈ ℝ</div>`);
        } else if (base.kind === 'point') {
          // degenerate (sin x ≥ 1 ⇒ single point)
          const alphaTxt = info.alphaLab ? info.alphaLab : `${inverseText}(${info.aLab})`;
          const period = (t === 'tan' || t === 'cot') ? 'πn' : '2πn';
          lines.push(`<div class="calc-line">x = ${colorTxt(alphaTxt, PAL.famA)} + ${period},&nbsp; n ∈ ℤ</div>`);
        } else {
          const ep = endpointStrs(t, rel, info);
          const lBr = base.closed[0] ? '[' : '(';
          const rBr = base.closed[1] ? ']' : ')';
          const L = colorTxt(ep.L, PAL.famA);
          const R = colorTxt(ep.R, PAL.famA);
          lines.push(`<div class="calc-line">x ∈ ${lBr}${L} + ${ep.period};&nbsp; ${R} + ${ep.period}${rBr}</div>`);
          lines.push(`<div class="calc-line sec">n ∈ ℤ</div>`);
        }
        this.hud.innerHTML = lines.join('');
        return;
      }

      // ----- EQUATION branch (rel = '=') -----
      if (!info.hasSolution) {
        lines.push(`<div class="calc-line err">|a| &gt; 1 → розв'язків немає</div>`);
      } else {
        // principal angle
        const alphaTxt = info.alphaLab ? info.alphaLab : `${inverseText}(${info.aLab})`;
        if (t === 'sin') {
          const second = info.alphaLab ? this._piMinus(info.alphaLab, info.alpha) : `π − ${inverseText}&nbsp;a`;
          lines.push(`<div class="calc-line"><span>x₀ =</span> ${colorTxt(alphaTxt, PAL.famA)}</div>`);
          lines.push(`<div class="calc-line"><span>x₀ =</span> ${colorTxt(second, PAL.famB)}</div>`);
          lines.push(`<div class="calc-line sec">x = ${colorTxt(alphaTxt, PAL.famA)} + 2πn</div>`);
          lines.push(`<div class="calc-line sec">x = ${colorTxt(second, PAL.famB)} + 2πn,&nbsp; n ∈ ℤ</div>`);
          if (info.alphaLab) {
            lines.push(`<div class="calc-line sub">≡ x = (−1)ⁿ · ${alphaTxt} + πn</div>`);
          }
        } else if (t === 'cos') {
          lines.push(`<div class="calc-line"><span>x₀ = ±</span>${colorTxt(alphaTxt, PAL.famA)}</div>`);
          lines.push(`<div class="calc-line sec">x = ${colorTxt(alphaTxt, PAL.famA)} + 2πn</div>`);
          lines.push(`<div class="calc-line sec">x = ${colorTxt(this._negLab(alphaTxt), PAL.famB)} + 2πn,&nbsp; n ∈ ℤ</div>`);
          lines.push(`<div class="calc-line sub">≡ x = ± ${alphaTxt} + 2πn</div>`);
        } else if (t === 'tan' || t === 'cot') {
          lines.push(`<div class="calc-line"><span>x₀ =</span> ${colorTxt(alphaTxt, PAL.famA)}</div>`);
          lines.push(`<div class="calc-line sec">x = ${colorTxt(alphaTxt, PAL.famA)} + πn,&nbsp; n ∈ ℤ</div>`);
        }
      }
      this.hud.innerHTML = lines.join('');
    }

    destroy() {
      this._destroyed = true;
      try { this._ro && this._ro.disconnect(); } catch (_) {}
      if (this._onWinResize) window.removeEventListener('resize', this._onWinResize);
      if (this._pollTimers) this._pollTimers.forEach(clearTimeout);
      this.container.innerHTML = '';
    }
  }

  window.TrigEquation = TrigEquation;
})();

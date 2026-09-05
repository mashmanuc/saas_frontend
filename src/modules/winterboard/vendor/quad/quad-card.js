// quad-card.js — Quadratic inequality visualizer.
// ax²+bx+c [sign] 0: parabola, discriminant, interval method.
// sign: '=' | '<' | '<=' | '>' | '>='
// Standalone IIFE, no external dependencies.
(function () {
  'use strict';

  const PALETTE = {
    bg:         '#fffaf0',
    gridMinor:  'rgba(43,33,24,0.07)',
    gridMajor:  'rgba(43,33,24,0.16)',
    axis:       '#2b2118',
    axisLab:    '#5a4a3a',
    parabola:   '#c4622a',
    vertex:     '#c4622a',
    arm:        '#3b7b9b',
    solColor:   '#3b7b9b',   // solution intervals — blue
    negColor:   '#a83a5b',   // negative region — red
    solFill:    'rgba(59,123,155,0.14)',
    negFill:    'rgba(168,58,91,0.12)',
    rootDot:    '#3b7b9b',
    symAxis:    'rgba(90,74,58,0.30)',
    plusSign:   '#3b7b9b',
    minusSign:  '#a83a5b',
  };

  const fmt = (n, d = 2) => {
    if (!Number.isFinite(n)) return '—';
    const k = Math.pow(10, d);
    const r = Math.round(n * k) / k;
    return (Math.abs(r) < 1e-9 ? 0 : r).toString().replace('.', ',');
  };

  // ── Запис многочлена ──────────────────────────────────────────────────────
  // ⚠️ У математиці не пишуть ні коефіцієнт 1, ні доданок з нулем: треба
  // `x² − x − 6 = 0`, а не `1x² − 1x − 6 = 0`. Друге саме й показувала
  // демо-дошка лендингу. Той самий клас дефекту за 2026-09-04 знайшовся
  // у восьми темах банку задач — щоразу тому, що кожне місце винаходило
  // запис многочлена заново.
  //
  // ⚠️ ЦЕ ДУБЛЬ `src/modules/winterboard/utils/polyText.ts` — свідомий.
  // Файл є самодостатнім IIFE без жодного імпорту (так він і задуманий),
  // тому взяти спільний помічник не може. Правиш тут — виправ і там.
  const term = (coef, varPart, first) => {
    if (Math.abs(coef) < 1e-9) return '';
    const abs = Math.abs(coef);
    // Одиницю перед ЗМІННОЮ не пишуть, перед вільним членом — пишуть.
    const body = varPart
      ? (Math.abs(abs - 1) < 1e-9 ? varPart : fmt(abs, 2) + varPart)
      : fmt(abs, 2);
    if (first) return coef < 0 ? '−' + body : body;
    return coef < 0 ? ' − ' + body : ' + ' + body;
  };

  const poly = (terms) => {
    let out = '';
    for (const [coef, varPart] of terms) {
      out += term(coef, varPart, out === '');
    }
    return out || '0';
  };

  const ARM_DX = 1.5;

  class QuadraticCard {
    constructor(container, opts) {
      this.container = container;
      this.opts = Object.assign({
        a: 1, b: -1, c: -6,
        sign:       '=',
        showVertex: true,
        showAxis:   true,
        showRoots:  true,
      }, opts);
      this.viewport = { cx: 0, cy: 0, scale: 50 };
      this._build();
      this._bindInteraction();
      this._resize();
      this._render();
    }

    // ── Math ──────────────────────────────────────────────────────────────────
    _fn(x)  { const { a, b, c } = this.opts; return a*x*x + b*x + c; }
    _xv()   { return -this.opts.b / (2 * this.opts.a); }
    _yv()   { return this._fn(this._xv()); }
    _disc() { const { a, b, c } = this.opts; return b*b - 4*a*c; }

    /**
     * Compute solution set for ax²+bx+c [sign] 0.
     * Returns {
     *   intervals: [[x1,x2],...] (may include ±Infinity),
     *   roots: [x1, x2] | [x0] | [],
     *   includeEnds: bool,
     *   empty: bool,
     *   allReals: bool,
     *   D: number,
     * }
     */
    _computeSolution() {
      const { a, sign } = this.opts;
      if (!sign) return null;

      const D          = this._disc();
      const b          = this.opts.b;
      const isEq       = sign === '=';
      const wantPos    = sign === '>' || sign === '>=';
      const wantNeg    = sign === '<' || sign === '<=';
      const inclEnds   = sign === '>=' || sign === '<=';

      if (isEq) {
        // Solution = roots only
        const roots = [];
        if (D > 1e-9) {
          const sq = Math.sqrt(D);
          roots.push((-b - sq) / (2*a), (-b + sq) / (2*a));
          roots.sort((p, q) => p - q);
        } else if (Math.abs(D) < 1e-9) {
          roots.push(this._xv());
        }
        return { isEq: true, roots, D };
      }

      // Determine which SIDE of x-axis parabola is on outside vs inside roots:
      // a>0: outside roots → positive; a<0: outside roots → negative
      const outsidePositive = a > 0;

      if (D > 1e-9) {
        const sq = Math.sqrt(D);
        const r1 = (-b - sq) / (2*a);
        const r2 = (-b + sq) / (2*a);
        const x1 = Math.min(r1, r2), x2 = Math.max(r1, r2);
        const roots = [x1, x2];

        let intervals;
        if ((wantPos && outsidePositive) || (wantNeg && !outsidePositive)) {
          intervals = [[-Infinity, x1], [x2, Infinity]];
        } else {
          intervals = [[x1, x2]];
        }
        return { intervals, roots, includeEnds: inclEnds, D };

      } else if (Math.abs(D) < 1e-9) {
        const x0 = this._xv();
        const roots = [x0];

        // At x0: value = 0. Everywhere else: sign of a
        if ((wantPos && outsidePositive) || (wantNeg && !outsidePositive)) {
          // Solution: ℝ\{x0} (or ℝ with inclEnds)
          if (inclEnds) return { intervals: [[-Infinity, Infinity]], roots, includeEnds: true, D, allReals: true };
          return { intervals: [[-Infinity, x0], [x0, Infinity]], roots, includeEnds: false, D };
        } else {
          // Solution: {x0} if inclEnds, else ∅
          if (inclEnds) return { singlePoint: x0, roots, includeEnds: true, D };
          return { empty: true, roots, D };
        }

      } else {
        // D < 0: no roots; parabola always same sign
        const roots = [];
        const alwaysPos = a > 0;
        if ((wantPos && alwaysPos) || (wantNeg && !alwaysPos)) {
          return { intervals: [[-Infinity, Infinity]], roots, D, allReals: true };
        } else {
          return { empty: true, roots, D };
        }
      }
    }

    // ── Build DOM ─────────────────────────────────────────────────────────────
    _build() {
      const c = this.container;
      c.classList.add('quad-root');
      c.style.position = 'relative';
      c.style.background = PALETTE.bg;

      this.canvas = document.createElement('canvas');
      this.canvas.style.cssText =
        'display:block;position:absolute;inset:0;width:100%;height:100%;' +
        'cursor:grab;touch-action:none;user-select:none;';
      c.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');

      this.hud = document.createElement('div');
      this.hud.className = 'quad-hud';
      c.appendChild(this.hud);

      const z = document.createElement('div');
      z.className = 'quad-zoom';
      z.innerHTML =
        '<button data-z="in"  title="Збільшити">+</button>' +
        '<button data-z="out" title="Зменшити">−</button>' +
        '<button data-z="home" title="До початку">⌂</button>';
      c.appendChild(z);
      z.addEventListener('click', (e) => {
        const k = e.target.dataset.z;
        if (k === 'in')   this._zoomAt(this.canvas.width/2, this.canvas.height/2, 1.4);
        if (k === 'out')  this._zoomAt(this.canvas.width/2, this.canvas.height/2, 1/1.4);
        if (k === 'home') { this.viewport = { cx: 0, cy: 0, scale: 50 }; this._scheduleRender(); }
      });

      this._ro = new ResizeObserver(() => { this._render(); });
      this._ro.observe(c);
      this._onWinResize = () => this._render();
      window.addEventListener('resize', this._onWinResize);
      this._pollTimers = [];
      [50, 150, 400, 800].forEach(ms => this._pollTimers.push(setTimeout(() => this._render(), ms)));
    }

    _resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = this.container.getBoundingClientRect();
      const w = Math.max(40, r.width), h = Math.max(40, r.height);
      const nw = w*dpr, nh = h*dpr;
      if (this.canvas.width !== nw || this.canvas.height !== nh) {
        this.canvas.width = nw; this.canvas.height = nh;
      }
      this.canvas.style.width = w+'px'; this.canvas.style.height = h+'px';
      this._dpr = dpr;
    }

    // ── Interaction ───────────────────────────────────────────────────────────
    _bindInteraction() {
      let dragging = null;
      let lx = 0, ly = 0;

      const handleHit = (px, py) => {
        const xv = this._xv(), yv = this._yv();
        const pV = this._mathToPx(xv, yv);
        const pA = this._mathToPx(xv + ARM_DX, this._fn(xv + ARM_DX));
        const tol = 16 * (this._dpr || 1);
        let best = null, bestD = tol*tol;
        for (const [name, p] of [['vertex', pV], ['arm', pA]]) {
          const d2 = (p.x-px)**2 + (p.y-py)**2;
          if (d2 < bestD) { bestD = d2; best = name; }
        }
        return best;
      };

      this.canvas.addEventListener('pointerdown', (e) => {
        const r = this.canvas.getBoundingClientRect();
        const px = (e.clientX - r.left)*(this._dpr||1);
        const py = (e.clientY - r.top) *(this._dpr||1);
        dragging = handleHit(px, py) || 'pan';
        lx = e.clientX; ly = e.clientY;
        try { this.canvas.setPointerCapture(e.pointerId); } catch(_) {}
        this.canvas.style.cursor = dragging === 'pan' ? 'grabbing' : 'crosshair';
      });

      this.canvas.addEventListener('pointermove', (e) => {
        if (!dragging) {
          const r = this.canvas.getBoundingClientRect();
          const px = (e.clientX - r.left)*(this._dpr||1);
          const py = (e.clientY - r.top) *(this._dpr||1);
          this.canvas.style.cursor = handleHit(px, py) ? 'crosshair' : 'grab';
          return;
        }
        const r = this.canvas.getBoundingClientRect();
        const px = (e.clientX - r.left)*(this._dpr||1);
        const py = (e.clientY - r.top) *(this._dpr||1);
        const m = this._pxToMath(px, py);

        if (dragging === 'pan') {
          this.viewport.cx -= (e.clientX - lx)*(this._dpr||1) / this.viewport.scale;
          this.viewport.cy += (e.clientY - ly)*(this._dpr||1) / this.viewport.scale;
        } else if (dragging === 'vertex') {
          const a = this.opts.a;
          this.opts.b = -2 * a * m.x;
          this.opts.c = m.y + a * m.x * m.x;
          if (this.onChange) this.onChange();
        } else if (dragging === 'arm') {
          const xv = this._xv(), yv = this._yv();
          let newA = (m.y - yv) / (ARM_DX * ARM_DX);
          if (Math.abs(newA) < 0.02) newA = newA >= 0 ? 0.02 : -0.02;
          this.opts.a = newA;
          this.opts.b = -2 * newA * xv;
          this.opts.c = yv + newA * xv * xv;
          if (this.onChange) this.onChange();
        }
        lx = e.clientX; ly = e.clientY;
        this._scheduleRender();
      });

      const up = (e) => {
        if (!dragging) return;
        dragging = null; this.canvas.style.cursor = 'grab';
        try { this.canvas.releasePointerCapture(e.pointerId); } catch(_) {}
      };
      this.canvas.addEventListener('pointerup', up);
      this.canvas.addEventListener('pointercancel', up);
      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const r = this.canvas.getBoundingClientRect();
        this._zoomAt((e.clientX-r.left)*(this._dpr||1), (e.clientY-r.top)*(this._dpr||1), Math.exp(-e.deltaY*0.0015));
      }, { passive: false });
    }

    _zoomAt(px, py, f) {
      const b = this._pxToMath(px, py);
      this.viewport.scale = Math.max(4, Math.min(400, this.viewport.scale*f));
      const a = this._pxToMath(px, py);
      this.viewport.cx += b.x - a.x; this.viewport.cy += b.y - a.y;
      this._scheduleRender();
    }

    _pxToMath(px, py) {
      const w = this.canvas.width, h = this.canvas.height;
      return { x: this.viewport.cx + (px-w/2)/this.viewport.scale,
               y: this.viewport.cy - (py-h/2)/this.viewport.scale };
    }
    _mathToPx(x, y) {
      const w = this.canvas.width, h = this.canvas.height;
      return { x: w/2 + (x-this.viewport.cx)*this.viewport.scale,
               y: h/2 - (y-this.viewport.cy)*this.viewport.scale };
    }

    setOption(k, v) {
      this.opts[k] = v;
      this._scheduleRender();
      if (this.onChange) this.onChange();
    }

    _scheduleRender() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => { this._raf = null; this._render(); });
    }

    // ── Main render ───────────────────────────────────────────────────────────
    _render() {
      this._resize();
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      ctx.fillStyle = PALETTE.bg; ctx.fillRect(0, 0, w, h);
      this._drawGrid();
      this._drawAxes();

      const sol = this._computeSolution();

      // 1. Fill interval regions (plane coloring)
      if (sol && !sol.isEq) this._renderIntervalFill(sol);

      // 2. Parabola curve (on top of fill)
      this._renderParabola();

      // 3. Roots, axis of symmetry, +/- signs
      this._renderOverlay(sol);

      // 4. Solution on x-axis (thick colored segments)
      if (sol && !sol.isEq) this._renderAxisSolution(sol);

      // 5. Handles
      this._renderHandles();

      // 6. HUD
      this._renderHud(sol);
    }

    // ── Grid + Axes ───────────────────────────────────────────────────────────
    _niceStep(ru) {
      const t = ru / 10;
      const e = Math.floor(Math.log10(Math.max(t, 1e-10)));
      const f = t / Math.pow(10, e);
      return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * Math.pow(10, e);
    }

    _drawGrid() {
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      const xR = w/this.viewport.scale, yR = h/this.viewport.scale;
      const step = this._niceStep(xR); const minor = step/5;
      this._gridStep = step;
      const x0 = this.viewport.cx-xR/2, x1 = this.viewport.cx+xR/2;
      const y0 = this.viewport.cy-yR/2, y1 = this.viewport.cy+yR/2;
      ctx.strokeStyle = PALETTE.gridMinor; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = Math.ceil(x0/minor)*minor; x <= x1+1e-9; x += minor) { const px = this._mathToPx(x,0).x; ctx.moveTo(px,0); ctx.lineTo(px,h); }
      for (let y = Math.ceil(y0/minor)*minor; y <= y1+1e-9; y += minor) { const py = this._mathToPx(0,y).y; ctx.moveTo(0,py); ctx.lineTo(w,py); }
      ctx.stroke();
      ctx.strokeStyle = PALETTE.gridMajor; ctx.beginPath();
      for (let x = Math.ceil(x0/step)*step; x <= x1+1e-9; x += step) { const px = this._mathToPx(x,0).x; ctx.moveTo(px,0); ctx.lineTo(px,h); }
      for (let y = Math.ceil(y0/step)*step; y <= y1+1e-9; y += step) { const py = this._mathToPx(0,y).y; ctx.moveTo(0,py); ctx.lineTo(w,py); }
      ctx.stroke();
    }

    _drawAxes() {
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      const o = this._mathToPx(0,0);
      ctx.strokeStyle = PALETTE.axis; ctx.lineWidth = 1.5*(this._dpr||1);
      ctx.beginPath(); ctx.moveTo(0,o.y); ctx.lineTo(w,o.y); ctx.moveTo(o.x,0); ctx.lineTo(o.x,h); ctx.stroke();
      const step = this._gridStep||1;
      const xR = w/this.viewport.scale, yR = h/this.viewport.scale;
      const x0 = this.viewport.cx-xR/2, x1 = this.viewport.cx+xR/2;
      const y0 = this.viewport.cy-yR/2, y1 = this.viewport.cy+yR/2;
      ctx.fillStyle = PALETTE.axisLab;
      ctx.font = `${11*(this._dpr||1)}px JetBrains Mono, monospace`;
      const fmtT = n => Math.abs(n)<1e-10 ? '' : (Math.round(n*1000)/1000).toString().replace(/(\.\d*?)0+$/,'$1').replace(/\.$/,'');
      ctx.textAlign='center'; ctx.textBaseline='top';
      for (let x = Math.ceil(x0/step)*step; x <= x1+1e-9; x += step) {
        if (Math.abs(x)<1e-10) continue;
        const px = this._mathToPx(x,0).x;
        ctx.fillText(fmtT(x), px, Math.max(2, Math.min(h-14, o.y+4)));
      }
      ctx.textAlign='right'; ctx.textBaseline='middle';
      for (let y = Math.ceil(y0/step)*step; y <= y1+1e-9; y += step) {
        if (Math.abs(y)<1e-10) continue;
        const py = this._mathToPx(0,y).y;
        ctx.fillText(fmtT(y), Math.max(20, Math.min(w-4, o.x-4)), py);
      }
    }

    // ── Parabola ──────────────────────────────────────────────────────────────
    _renderParabola() {
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      ctx.strokeStyle = PALETTE.parabola;
      ctx.lineWidth = 2.4*(this._dpr||1); ctx.lineJoin='round'; ctx.lineCap='round';
      ctx.beginPath();
      let prev = null;
      const samples = Math.max(300, Math.floor(w/(this._dpr||1)));
      for (let i = 0; i <= samples; i++) {
        const px = (i/samples)*w;
        const mx = this._pxToMath(px, 0).x;
        const y = this._fn(mx);
        if (!Number.isFinite(y)) { prev=null; continue; }
        const p = this._mathToPx(mx, y);
        if (p.y < -h*3 || p.y > h*4) { prev=null; continue; }
        if (!prev || Math.abs(p.y-prev.y) > h*0.5) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        prev = p;
      }
      ctx.stroke();
    }

    // ── Interval fill (colored plane regions) ─────────────────────────────────
    _renderIntervalFill(sol) {
      if (!sol || sol.empty || !sol.intervals) return;
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      const dpr = this._dpr||1;
      const sign = this.opts.sign;

      // Determine fill color based on sign: are we looking for positive or negative region?
      const wantPos = sign === '>' || sign === '>=';
      ctx.fillStyle = wantPos ? PALETTE.solFill : PALETTE.negFill;

      const xLeft = this._pxToMath(0, 0).x;
      const xRight = this._pxToMath(w, 0).x;

      for (const [lo, hi] of sol.intervals) {
        const xStart = lo === -Infinity ? xLeft - (xRight-xLeft)*0.05 : lo;
        const xEnd   = hi === Infinity  ? xRight + (xRight-xLeft)*0.05 : hi;

        // Fill area between parabola and x-axis in this interval
        const samples = Math.max(80, Math.floor((xEnd - xStart) / (xRight - xLeft) * 300));

        ctx.beginPath();
        const p0 = this._mathToPx(xStart, 0);
        ctx.moveTo(p0.x, p0.y);
        for (let i = 0; i <= samples; i++) {
          const x = xStart + (xEnd - xStart) * i / samples;
          const y = this._fn(x);
          if (!Number.isFinite(y)) continue;
          const p = this._mathToPx(x, y);
          // Clamp extreme y values
          ctx.lineTo(p.x, Math.max(-h*0.5, Math.min(h*1.5, p.y)));
        }
        const pEnd = this._mathToPx(xEnd, 0);
        ctx.lineTo(pEnd.x, pEnd.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    // ── Solution on x-axis (thick colored segments + endpoints) ───────────────
    _renderAxisSolution(sol) {
      if (!sol || sol.empty) return;
      const ctx = this.ctx, w = this.canvas.width;
      const dpr = this._dpr||1;
      const oy = this._mathToPx(0, 0).y;
      const xLeft  = this._pxToMath(0, 0).x;
      const xRight = this._pxToMath(w, 0).x;
      const margin = (xRight - xLeft) * 0.04;

      if (sol.singlePoint !== undefined) {
        // Just a filled dot at the single point
        const px = this._mathToPx(sol.singlePoint, 0).x;
        ctx.fillStyle = PALETTE.solColor;
        ctx.beginPath(); ctx.arc(px, oy, 6*dpr, 0, Math.PI*2); ctx.fill();
        return;
      }

      if (!sol.intervals) return;

      ctx.strokeStyle = PALETTE.solColor;
      ctx.lineWidth = 4*dpr;
      ctx.lineCap = 'round';

      for (const [lo, hi] of sol.intervals) {
        const isLeftInf  = lo === -Infinity;
        const isRightInf = hi === Infinity;
        const lPx = isLeftInf  ? this._mathToPx(xLeft  - margin, 0).x : this._mathToPx(lo, 0).x;
        const rPx = isRightInf ? this._mathToPx(xRight + margin, 0).x : this._mathToPx(hi, 0).x;

        ctx.beginPath(); ctx.moveTo(lPx, oy); ctx.lineTo(rPx, oy); ctx.stroke();

        // Arrowhead for infinite ends
        if (isLeftInf)  this._arrowHead(lPx, oy, -1, dpr);
        if (isRightInf) this._arrowHead(rPx, oy,  1, dpr);

        // Endpoint markers: open circle (strict) or filled (inclusive)
        if (!isLeftInf)  this._endpoint(this._mathToPx(lo, 0).x, oy, !sol.includeEnds, dpr);
        if (!isRightInf) this._endpoint(this._mathToPx(hi, 0).x, oy, !sol.includeEnds, dpr);
      }
    }

    _arrowHead(px, py, dir, dpr) {
      const ctx = this.ctx;
      const sz = 8*dpr;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + dir*sz, py - sz*0.45);
      ctx.lineTo(px + dir*sz, py + sz*0.45);
      ctx.closePath();
      ctx.fillStyle = PALETTE.solColor;
      ctx.fill();
    }

    _endpoint(px, py, open, dpr) {
      const ctx = this.ctx;
      const r = 5*dpr;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2);
      if (open) {
        ctx.fillStyle = PALETTE.bg; ctx.fill();
        ctx.strokeStyle = PALETTE.solColor; ctx.lineWidth = 2*dpr; ctx.stroke();
      } else {
        ctx.fillStyle = PALETTE.solColor; ctx.fill();
      }
    }

    // ── Overlay: roots, axis of symmetry, +/- signs ───────────────────────────
    _renderOverlay(sol) {
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      const dpr = this._dpr||1;
      const xv = this._xv();
      const D  = this._disc();
      const oy = this._mathToPx(0, 0).y;

      // Axis of symmetry
      if (this.opts.showAxis) {
        const px = this._mathToPx(xv, 0).x;
        ctx.strokeStyle = PALETTE.symAxis;
        ctx.lineWidth = 1.2*dpr;
        ctx.setLineDash([4*dpr, 5*dpr]);
        ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = PALETTE.symAxis;
        ctx.font = `${10*dpr}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(`x₀=${fmt(xv,2)}`, px, Math.max(2, oy+4));
      }

      // Roots dots
      const roots = sol ? sol.roots : [];
      if (this.opts.showRoots && roots && roots.length) {
        for (const xr of roots) {
          const pr = this._mathToPx(xr, 0);
          ctx.fillStyle = '#2b2118';
          ctx.beginPath(); ctx.arc(pr.x, pr.y, 4*dpr, 0, Math.PI*2); ctx.fill();
          // Label
          ctx.fillStyle = '#2b2118';
          ctx.font = `bold ${11*dpr}px JetBrains Mono, monospace`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.fillText(fmt(xr, 2), pr.x, pr.y - 6*dpr);
        }
      }

      // +/− signs in each interval (for inequality mode)
      if (sol && !sol.isEq && !sol.empty) {
        this._renderSignLabels(sol);
      }
    }

    /**
     * Draw "+" or "−" above x-axis in each region between roots.
     * Based on interval method: sign of polynomial in each interval.
     */
    _renderSignLabels(sol) {
      const ctx = this.ctx, w = this.canvas.width;
      const dpr = this._dpr||1;
      const a = this.opts.a;
      const oy = this._mathToPx(0, 0).y;
      const xLeft  = this._pxToMath(0, 0).x;
      const xRight = this._pxToMath(w, 0).x;

      // Build breakpoints: edges of canvas + roots
      const roots = (sol.roots || []).filter(Number.isFinite);
      const breaks = [xLeft, ...roots.sort((p,q)=>p-q), xRight];

      const labelY = oy - 22*dpr;
      ctx.font = `bold ${16*dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

      for (let i = 0; i < breaks.length - 1; i++) {
        const mid = (breaks[i] + breaks[i+1]) / 2;
        const val = this._fn(mid);
        const isPos = val > 0;
        ctx.fillStyle = isPos ? PALETTE.plusSign : PALETTE.minusSign;
        ctx.fillText(isPos ? '+' : '−', this._mathToPx(mid, 0).x, labelY);
      }
    }

    // ── Drag handles ──────────────────────────────────────────────────────────
    _renderHandles() {
      const xv = this._xv(), yv = this._yv();
      const pVs = this._mathToPx(xv, yv);
      const pAs = this._mathToPx(xv + ARM_DX, this._fn(xv + ARM_DX));

      // Dashed line vertex → arm
      const ctx = this.ctx, dpr = this._dpr||1;
      ctx.strokeStyle = PALETTE.arm;
      ctx.lineWidth = 1.2*dpr;
      ctx.globalAlpha = 0.45;
      ctx.setLineDash([3*dpr, 4*dpr]);
      ctx.beginPath(); ctx.moveTo(pVs.x, pVs.y); ctx.lineTo(pAs.x, pAs.y); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;

      this._drawHandle(pAs.x, pAs.y, PALETTE.arm, 'a');
      if (this.opts.showVertex) this._drawHandle(pVs.x, pVs.y, PALETTE.vertex, 'V');
    }

    _drawHandle(x, y, color, label) {
      const ctx = this.ctx, r = 7*(this._dpr||1);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.22;
      ctx.beginPath(); ctx.arc(x, y, r+5*(this._dpr||1), 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 2*(this._dpr||1); ctx.stroke();
      if (label) {
        ctx.fillStyle = '#2b2118';
        ctx.font = `bold ${13*(this._dpr||1)}px Inter, sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(label, x+r+4, y-r);
      }
    }

    // ── HUD ───────────────────────────────────────────────────────────────────
    _renderHud(sol) {
      const { a, b, c, sign } = this.opts;
      const D   = sol ? sol.D : this._disc();
      const xv  = this._xv(), yv = this._yv();

      // Build equation string (див. `poly` вище: без коефіцієнта 1 і нулів)
      const eq = poly([[a, 'x²'], [b, 'x'], [c, '']]);
      const signStr = { '=':'= 0', '<':'< 0', '<=':'≤ 0', '>':'> 0', '>=':'≥ 0' }[sign] || '= 0';

      const out = [];
      out.push(`<div class="quad-line"><span>f(x)</span> = ${eq}</div>`);
      out.push(`<div class="quad-line expr">${eq} ${signStr}</div>`);

      const dColor = D > 1e-9 ? '#3b7b9b' : D < -1e-9 ? '#a83a5b' : '#7a8b3a';
      out.push(`<div class="quad-line key" style="color:${dColor}"><span>D</span> = ${fmt(D,2)}</div>`);
      out.push(`<div class="quad-line sub">вершина: (${fmt(xv,2)}; ${fmt(yv,2)})</div>`);

      // Solution set
      if (sol) {
        if (sol.isEq) {
          if (sol.roots.length === 0) out.push(`<div class="quad-line sol">x ∈ ∅</div>`);
          else if (sol.roots.length === 1) out.push(`<div class="quad-line sol">x = ${fmt(sol.roots[0],2)}</div>`);
          else out.push(`<div class="quad-line sol">x₁=${fmt(sol.roots[0],2)}, x₂=${fmt(sol.roots[1],2)}</div>`);
        } else if (sol.empty) {
          out.push(`<div class="quad-line sol empty">x ∈ ∅</div>`);
        } else if (sol.allReals) {
          out.push(`<div class="quad-line sol">x ∈ ℝ</div>`);
        } else if (sol.singlePoint !== undefined) {
          out.push(`<div class="quad-line sol">x = ${fmt(sol.singlePoint,2)}</div>`);
        } else if (sol.intervals) {
          const iStr = sol.intervals.map(([lo, hi]) => {
            const lBr = sol.includeEnds && lo !== -Infinity ? '[' : '(';
            const rBr = sol.includeEnds && hi !== Infinity  ? ']' : ')';
            const lS  = lo === -Infinity ? '−∞' : fmt(lo, 2);
            const rS  = hi === Infinity  ? '+∞' : fmt(hi, 2);
            return `${lBr}${lS}; ${rS}${rBr}`;
          }).join(' ∪ ');
          out.push(`<div class="quad-line sol">x ∈ ${iStr}</div>`);
        }
      }

      this.hud.innerHTML = out.join('');
    }

    // ── Destroy ───────────────────────────────────────────────────────────────
    destroy() {
      try { if (this._ro) this._ro.disconnect(); } catch(_) {}
      if (this._onWinResize) window.removeEventListener('resize', this._onWinResize);
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._pollTimers) this._pollTimers.forEach(clearTimeout);
      this.container.innerHTML = '';
    }
  }

  window.QuadraticCard = QuadraticCard;
})();

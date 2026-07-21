// calculus.js — Interactive visualizations for derivative and antiderivative.
// Reuses the parser/evaluator from graph-calculator.js (window.GraphCalc).
(function () {
  const { parse, evalAst, freeVars, CONSTS } = window.GraphCalc;
  const PALETTE = {
    bg:        '#fffaf0',
    gridMinor: 'rgba(43,33,24,0.07)',
    gridMajor: 'rgba(43,33,24,0.16)',
    axis:      '#2b2118',
    axisLab:   '#5a4a3a',
    fn:        '#c4622a',
    tan:       '#3b7b9b',
    sec:       '#a83a5b',
    deriv:     '#7a8b3a',
    area:      'rgba(196,98,42,0.18)',
    rect:      'rgba(59,123,155,0.18)',
    rectEdge:  '#3b7b9b',
    handle:    '#c4622a',
    handle2:   '#3b7b9b',
    Fcurve:    '#5a4a8a',
  };

  // numerical derivative (central difference)
  function numDeriv(fn, x, h = 1e-4) {
    return (fn(x + h) - fn(x - h)) / (2 * h);
  }
  // adaptive composite Simpson's rule on [a, b]
  function simpson(fn, a, b, n = 200) {
    if (a === b) return 0;
    if (a > b) return -simpson(fn, b, a, n);
    if (n % 2) n += 1;
    const h = (b - a) / n;
    let s = fn(a) + fn(b);
    for (let i = 1; i < n; i++) {
      const x = a + i * h;
      const w = (i % 2 === 0) ? 2 : 4;
      const y = fn(x);
      if (!Number.isFinite(y)) return NaN;
      s += w * y;
    }
    return (h / 3) * s;
  }
  const fmt = (n, d = 3) => {
    if (!Number.isFinite(n)) return '—';
    const k = Math.pow(10, d);
    const r = Math.round(n * k) / k;
    return (Math.abs(r) < 1e-9 ? 0 : r).toString().replace('.', ',');
  };

  // ---------------------------------------------------------------------------
  // CalculusCard — base canvas component with grid+axes, function plot, drag handles
  // ---------------------------------------------------------------------------
  class CalculusCard {
    constructor(container, opts) {
      this.container = container;
      this.opts = Object.assign({
        mode: 'derivative',
        expr: 'x^2',
        // Derivative-specific
        x0: 1.0,
        showSecant: false,
        h: 0.5,
        showDerivTrace: false,
        // Integral-specific
        a: -1.5, b: 1.5,
        riemann: 'off', // 'off' | 'left' | 'right' | 'mid'
        N: 12,
        showF: false,
      }, opts);
      this.viewport = { cx: 0, cy: 0, scale: 50 };
      this._derivTrail = []; // pts [{x, y}]
      this._fnAst = null;
      this._fnFn = (x) => NaN;
      this._setExpr(this.opts.expr);
      this._build();
      this._bindInteraction();
      // Force one synchronous resize + render so the canvas isn't blank when
      // the page is loaded inside an off-screen iframe (ResizeObserver may not
      // fire until the iframe becomes visible).
      this._resize();
      this._render();
    }

    _setExpr(src) {
      this.opts.expr = src;
      this._derivTrail.length = 0;
      try {
        const ast = parse(src);
        let body;
        if (ast.kind === 'eq' && ast.lhs.kind === 'ident' && ast.lhs.name === 'y') body = ast.rhs;
        else if (ast.kind === 'eq') throw new Error('Очікується y = f(x) або просто f(x)');
        else body = ast;
        // Validate free vars: only x allowed
        const fv = freeVars(body);
        for (const v of fv) if (v !== 'x' && !(v in CONSTS)) throw new Error('Невідома змінна ' + v);
        this._fnAst = body;
        this._fnErr = null;
        this._fnFn = (x) => {
          try { return evalAst(body, { ...CONSTS, x }); } catch (_) { return NaN; }
        };
      } catch (err) {
        this._fnErr = err.message;
        this._fnFn = () => NaN;
      }
      this._scheduleRender && this._scheduleRender();
      if (this.onChange) this.onChange();
    }

    _build() {
      const c = this.container;
      c.classList.add('calc-root');
      c.style.position = 'relative';
      c.style.background = PALETTE.bg;
      this.canvas = document.createElement('canvas');
      this.canvas.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%;cursor:grab;touch-action:none;user-select:none;';
      c.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');

      // HUD label (top-left)
      this.hud = document.createElement('div');
      this.hud.className = 'calc-hud';
      c.appendChild(this.hud);

      // zoom buttons
      const z = document.createElement('div');
      z.className = 'calc-zoom';
      z.innerHTML = `
        <button data-z="in"  title="Збільшити">+</button>
        <button data-z="out" title="Зменшити">−</button>
        <button data-z="home" title="До початку">⌂</button>`;
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
      // setTimeout works regardless of tab visibility, unlike requestAnimationFrame —
      // ensures the canvas catches its real size even if the preview is currently hidden.
      this._pollTimers = [];
      [50, 150, 400, 800].forEach((ms) => {
        this._pollTimers.push(setTimeout(() => this._render(), ms));
      });
    }

    _resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = this.container.getBoundingClientRect();
      const w = Math.max(40, r.width), h = Math.max(40, r.height);
      const newW = w * dpr, newH = h * dpr;
      if (this.canvas.width !== newW || this.canvas.height !== newH) {
        this.canvas.width = newW;
        this.canvas.height = newH;
      }
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this._dpr = dpr;
    }

    _bindInteraction() {
      let dragging = null; // 'pan' | 'x0' | 'a' | 'b'
      let lx = 0, ly = 0;
      const handleHit = (px, py) => {
        // Pick the closest handle on screen within 14px
        const cand = [];
        if (this.opts.mode === 'derivative') {
          const p = this._mathToPx(this.opts.x0, this._fnFn(this.opts.x0));
          cand.push({ name: 'x0', p });
        } else {
          const ya = this._fnFn(this.opts.a), yb = this._fnFn(this.opts.b);
          cand.push({ name: 'a', p: this._mathToPx(this.opts.a, 0) });
          cand.push({ name: 'b', p: this._mathToPx(this.opts.b, 0) });
          if (Number.isFinite(ya)) cand.push({ name: 'a', p: this._mathToPx(this.opts.a, ya) });
          if (Number.isFinite(yb)) cand.push({ name: 'b', p: this._mathToPx(this.opts.b, yb) });
        }
        const tol = 16 * (this._dpr || 1);
        let best = null, bestD = tol * tol;
        for (const c of cand) {
          const d2 = (c.p.x - px) ** 2 + (c.p.y - py) ** 2;
          if (d2 < bestD) { bestD = d2; best = c.name; }
        }
        return best;
      };

      this.canvas.addEventListener('pointerdown', (e) => {
        const r = this.canvas.getBoundingClientRect();
        const px = (e.clientX - r.left) * (this._dpr || 1);
        const py = (e.clientY - r.top)  * (this._dpr || 1);
        const which = handleHit(px, py);
        dragging = which || 'pan';
        lx = e.clientX; ly = e.clientY;
        try { this.canvas.setPointerCapture(e.pointerId); } catch(_) {}
        this.canvas.style.cursor = dragging === 'pan' ? 'grabbing' : 'ew-resize';
        if (this.opts.showDerivTrace) this._derivTrail.length = 0;
      });
      this.canvas.addEventListener('pointermove', (e) => {
        if (!dragging) {
          // cursor hint on hover
          const r = this.canvas.getBoundingClientRect();
          const px = (e.clientX - r.left) * (this._dpr || 1);
          const py = (e.clientY - r.top)  * (this._dpr || 1);
          this.canvas.style.cursor = handleHit(px, py) ? 'ew-resize' : 'grab';
          return;
        }
        if (dragging === 'pan') {
          const dx = (e.clientX - lx) * (this._dpr || 1);
          const dy = (e.clientY - ly) * (this._dpr || 1);
          this.viewport.cx -= dx / this.viewport.scale;
          this.viewport.cy += dy / this.viewport.scale;
        } else {
          const r = this.canvas.getBoundingClientRect();
          const px = (e.clientX - r.left) * (this._dpr || 1);
          const m = this._pxToMath(px, 0);
          // Снап меж інтегрування до 0.01: інфо-бокс показує a/b з 2 знаками,
          // тож «сира» перетягнута межа (2.0069) виглядала як 2, а інтеграл
          // чесно рахував 2.021 — розбіжність збивала учнів. x0 лишаємо
          // плавним (по ньому малюється трейл похідної).
          this.opts[dragging] = (dragging === 'a' || dragging === 'b')
            ? Math.round(m.x * 100) / 100
            : m.x;
          // Record derivative trail
          if (dragging === 'x0' && this.opts.showDerivTrace) {
            this._derivTrail.push({ x: m.x, y: numDeriv(this._fnFn, m.x) });
            if (this._derivTrail.length > 4000) this._derivTrail.shift();
          }
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
        const px = (e.clientX - r.left) * (this._dpr || 1);
        const py = (e.clientY - r.top) * (this._dpr || 1);
        this._zoomAt(px, py, Math.exp(-e.deltaY * 0.0015));
      }, { passive: false });
    }

    _zoomAt(px, py, factor) {
      const before = this._pxToMath(px, py);
      this.viewport.scale = Math.max(4, Math.min(400, this.viewport.scale * factor));
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

    setOption(k, v) {
      this.opts[k] = v;
      if (k === 'showDerivTrace' && !v) this._derivTrail.length = 0;
      this._scheduleRender();
      if (this.onChange) this.onChange();
    }
    setExpression(src) { this._setExpr(src); }

    _scheduleRender() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => { this._raf = null; this._render(); });
    }

    _render() {
      // Make sure canvas bitmap matches container size BEFORE we draw — this
      // is the most robust way to handle initial layout in any host environment.
      this._resize();
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      ctx.fillStyle = PALETTE.bg; ctx.fillRect(0, 0, w, h);
      this._drawGrid();
      this._drawAxes();
      if (this.opts.mode === 'derivative') this._renderDerivative();
      else this._renderIntegral();
      this._drawFunction();
      if (this.opts.mode === 'derivative') this._renderDerivativeOverlay();
      else this._renderIntegralOverlay();
      this._renderHud();
    }

    // --- grid ---------------------------------------------------------------
    _niceStep(rangeUnits) {
      const target = rangeUnits / 10;
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
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      const xRange = w / this.viewport.scale, yRange = h / this.viewport.scale;
      const step = this._niceStep(xRange);
      const minor = step / 5;
      this._gridStep = step;
      const x0 = this.viewport.cx - xRange/2, x1 = this.viewport.cx + xRange/2;
      const y0 = this.viewport.cy - yRange/2, y1 = this.viewport.cy + yRange/2;
      ctx.strokeStyle = PALETTE.gridMinor; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = Math.ceil(x0/minor)*minor; x <= x1 + 1e-9; x += minor) {
        const px = this._mathToPx(x, 0).x; ctx.moveTo(px, 0); ctx.lineTo(px, h);
      }
      for (let y = Math.ceil(y0/minor)*minor; y <= y1 + 1e-9; y += minor) {
        const py = this._mathToPx(0, y).y; ctx.moveTo(0, py); ctx.lineTo(w, py);
      }
      ctx.stroke();
      ctx.strokeStyle = PALETTE.gridMajor; ctx.beginPath();
      for (let x = Math.ceil(x0/step)*step; x <= x1 + 1e-9; x += step) {
        const px = this._mathToPx(x, 0).x; ctx.moveTo(px, 0); ctx.lineTo(px, h);
      }
      for (let y = Math.ceil(y0/step)*step; y <= y1 + 1e-9; y += step) {
        const py = this._mathToPx(0, y).y; ctx.moveTo(0, py); ctx.lineTo(w, py);
      }
      ctx.stroke();
    }
    _drawAxes() {
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      const o = this._mathToPx(0, 0);
      ctx.strokeStyle = PALETTE.axis; ctx.lineWidth = 1.4 * (this._dpr || 1);
      ctx.beginPath();
      ctx.moveTo(0, o.y); ctx.lineTo(w, o.y);
      ctx.moveTo(o.x, 0); ctx.lineTo(o.x, h);
      ctx.stroke();
      // labels
      const step = this._gridStep || 1;
      const xR = w/this.viewport.scale, yR = h/this.viewport.scale;
      const x0 = this.viewport.cx - xR/2, x1 = this.viewport.cx + xR/2;
      const y0 = this.viewport.cy - yR/2, y1 = this.viewport.cy + yR/2;
      ctx.fillStyle = PALETTE.axisLab;
      ctx.font = `${11*(this._dpr||1)}px JetBrains Mono, monospace`;
      const fmtT = (n) => Math.abs(n) < 1e-10 ? '' : (Math.round(n*1000)/1000).toString().replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let x = Math.ceil(x0/step)*step; x <= x1 + 1e-9; x += step) {
        if (Math.abs(x) < 1e-10) continue;
        const px = this._mathToPx(x, 0).x;
        ctx.fillText(fmtT(x), px, Math.max(2, Math.min(h - 14, o.y + 4)));
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let y = Math.ceil(y0/step)*step; y <= y1 + 1e-9; y += step) {
        if (Math.abs(y) < 1e-10) continue;
        const py = this._mathToPx(0, y).y;
        ctx.fillText(fmtT(y), Math.max(20, Math.min(w - 4, o.x - 4)), py);
      }
    }

    _drawFunction() {
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      ctx.strokeStyle = PALETTE.fn;
      ctx.lineWidth = 2.4 * (this._dpr || 1);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      let prev = null;
      const samples = Math.max(240, Math.floor(w / (this._dpr || 1)));
      for (let i = 0; i <= samples; i++) {
        const px = (i / samples) * w;
        const m = this._pxToMath(px, 0);
        const y = this._fnFn(m.x);
        if (!Number.isFinite(y)) { prev = null; continue; }
        const p = this._mathToPx(m.x, y);
        if (!prev || Math.abs(p.y - prev.y) > h * 0.6) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        prev = p;
      }
      ctx.stroke();
    }

    // ============ DERIVATIVE mode ============
    _renderDerivative() {
      // background overlays before function (none here)
    }
    _renderDerivativeOverlay() {
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      const x0 = this.opts.x0;
      const y0 = this._fnFn(x0);
      if (!Number.isFinite(y0)) return;
      const k = numDeriv(this._fnFn, x0);

      // Tangent line — extend across viewport
      if (Number.isFinite(k)) {
        const xL = this._pxToMath(0, 0).x, xR = this._pxToMath(w, 0).x;
        const yL = y0 + k * (xL - x0), yR = y0 + k * (xR - x0);
        const pL = this._mathToPx(xL, yL), pR = this._mathToPx(xR, yR);
        ctx.strokeStyle = PALETTE.tan;
        ctx.lineWidth = 2 * (this._dpr || 1);
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.moveTo(pL.x, pL.y); ctx.lineTo(pR.x, pR.y); ctx.stroke();
        // Tangent segment emphasis around P (a horizontal-pixel window)
        const dxView = 60 * (this._dpr || 1) / this.viewport.scale;
        const pA = this._mathToPx(x0 - dxView, y0 - k * dxView);
        const pB = this._mathToPx(x0 + dxView, y0 + k * dxView);
        ctx.lineWidth = 4 * (this._dpr || 1);
        ctx.beginPath(); ctx.moveTo(pA.x, pA.y); ctx.lineTo(pB.x, pB.y); ctx.stroke();
      }

      // Secant line through (x0-h, f(x0-h)) and (x0+h, f(x0+h))
      if (this.opts.showSecant) {
        const hh = this.opts.h;
        const x1 = x0 - hh, x2 = x0 + hh;
        const y1 = this._fnFn(x1), y2 = this._fnFn(x2);
        if (Number.isFinite(y1) && Number.isFinite(y2)) {
          const kS = (y2 - y1) / (x2 - x1);
          const xL = this._pxToMath(0, 0).x, xR = this._pxToMath(w, 0).x;
          const yL = y1 + kS * (xL - x1), yR = y1 + kS * (xR - x1);
          const pL = this._mathToPx(xL, yL), pR = this._mathToPx(xR, yR);
          ctx.strokeStyle = PALETTE.sec;
          ctx.lineWidth = 1.6 * (this._dpr || 1);
          ctx.setLineDash([6 * (this._dpr || 1), 5 * (this._dpr || 1)]);
          ctx.beginPath(); ctx.moveTo(pL.x, pL.y); ctx.lineTo(pR.x, pR.y); ctx.stroke();
          ctx.setLineDash([]);
          // Endpoints + small dots
          const p1 = this._mathToPx(x1, y1), p2 = this._mathToPx(x2, y2);
          ctx.fillStyle = PALETTE.sec;
          for (const p of [p1, p2]) {
            ctx.beginPath(); ctx.arc(p.x, p.y, 4 * (this._dpr || 1), 0, Math.PI*2); ctx.fill();
          }
          // delta x / delta y indicator: dashed L-shape
          ctx.strokeStyle = PALETTE.sec; ctx.globalAlpha = 0.5;
          ctx.lineWidth = 1.2 * (this._dpr || 1);
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          ctx.setLineDash([]); ctx.globalAlpha = 1;
          // Labels Δx and Δy
          ctx.fillStyle = PALETTE.sec;
          ctx.font = `${12*(this._dpr||1)}px JetBrains Mono, monospace`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          ctx.fillText('Δx', (p1.x + p2.x) / 2, p1.y + 4);
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.fillText('Δy', p2.x + 6, (p1.y + p2.y) / 2);
        }
      }

      // Derivative trace — built up as user drags
      if (this.opts.showDerivTrace) {
        // sample full trace from current view
        const samples = Math.max(240, Math.floor(w / (this._dpr || 1)));
        ctx.strokeStyle = PALETTE.deriv;
        ctx.lineWidth = 2 * (this._dpr || 1);
        ctx.setLineDash([2 * (this._dpr || 1), 4 * (this._dpr || 1)]);
        ctx.beginPath();
        let prev = null;
        for (let i = 0; i <= samples; i++) {
          const px = (i / samples) * w;
          const xm = this._pxToMath(px, 0).x;
          const yp = numDeriv(this._fnFn, xm);
          if (!Number.isFinite(yp)) { prev = null; continue; }
          const p = this._mathToPx(xm, yp);
          if (!prev || Math.abs(p.y - prev.y) > h * 0.6) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
          prev = p;
        }
        ctx.stroke();
        ctx.setLineDash([]);
        // ghost-trail dots (where user's drag has been)
        ctx.fillStyle = PALETTE.deriv;
        for (const pt of this._derivTrail) {
          const p = this._mathToPx(pt.x, pt.y);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.5 * (this._dpr || 1), 0, Math.PI*2);
          ctx.fill();
        }
      }

      // Drop-down x-axis line to mark x₀
      const px0 = this._mathToPx(x0, y0);
      const pax = this._mathToPx(x0, 0);
      ctx.strokeStyle = 'rgba(196,98,42,0.4)';
      ctx.setLineDash([3 * (this._dpr || 1), 4 * (this._dpr || 1)]);
      ctx.lineWidth = 1 * (this._dpr || 1);
      ctx.beginPath(); ctx.moveTo(px0.x, px0.y); ctx.lineTo(pax.x, pax.y); ctx.stroke();
      ctx.setLineDash([]);

      // Handle point P on curve
      this._drawHandle(px0.x, px0.y, PALETTE.handle, 'P');
      // label "x₀" on x-axis
      ctx.fillStyle = PALETTE.handle;
      ctx.font = `${12*(this._dpr||1)}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText('x₀', pax.x, pax.y + 6);
    }

    // ============ INTEGRAL mode ============
    _renderIntegral() {
      const ctx = this.ctx;
      const a = Math.min(this.opts.a, this.opts.b);
      const b = Math.max(this.opts.a, this.opts.b);
      // Area under curve — fill between f(x) and 0 from a to b
      ctx.fillStyle = PALETTE.area;
      ctx.beginPath();
      const pa = this._mathToPx(a, 0);
      ctx.moveTo(pa.x, pa.y);
      const samples = Math.max(80, Math.floor((this._mathToPx(b, 0).x - pa.x) * 2));
      for (let i = 0; i <= samples; i++) {
        const xm = a + (b - a) * i / samples;
        const y = this._fnFn(xm);
        if (!Number.isFinite(y)) continue;
        const p = this._mathToPx(xm, y);
        ctx.lineTo(p.x, p.y);
      }
      const pb = this._mathToPx(b, 0);
      ctx.lineTo(pb.x, pb.y);
      ctx.closePath();
      ctx.fill();

      // Riemann rectangles
      if (this.opts.riemann !== 'off') {
        const N = Math.max(1, Math.floor(this.opts.N));
        const dx = (b - a) / N;
        ctx.fillStyle = PALETTE.rect;
        ctx.strokeStyle = PALETTE.rectEdge;
        ctx.lineWidth = 1 * (this._dpr || 1);
        for (let i = 0; i < N; i++) {
          const xl = a + i * dx, xr = a + (i + 1) * dx;
          let xs;
          if (this.opts.riemann === 'left')   xs = xl;
          else if (this.opts.riemann === 'right') xs = xr;
          else /* mid */                       xs = (xl + xr) / 2;
          const ys = this._fnFn(xs);
          if (!Number.isFinite(ys)) continue;
          const tl = this._mathToPx(xl, ys);
          const br = this._mathToPx(xr, 0);
          const x = Math.min(tl.x, br.x), y = Math.min(tl.y, br.y);
          const w = Math.abs(br.x - tl.x), h = Math.abs(br.y - tl.y);
          ctx.fillRect(x, y, w, h);
          ctx.strokeRect(x, y, w, h);
        }
      }
    }

    _renderIntegralOverlay() {
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      // Antiderivative curve F(x) (numerical, F(a) = 0)
      if (this.opts.showF) {
        const a = this.opts.a;
        // sample F(x) by composite Simpson on small intervals
        const xL = this._pxToMath(0, 0).x, xR = this._pxToMath(w, 0).x;
        const samples = 240;
        const step = (xR - xL) / samples;
        // Build accumulation in both directions from a, then offset so F(a)=0
        const xs = [], Fs = [];
        // forward pass from a → xR
        let cur = 0;
        let lastX = a;
        const sampleX = [a];
        for (let x = a + step; x <= xR + 1e-9; x += step) sampleX.push(x);
        for (let i = 1; i < sampleX.length; i++) {
          cur += simpson(this._fnFn, sampleX[i-1], sampleX[i], 4);
          xs.push(sampleX[i]); Fs.push(cur);
        }
        // backward from a → xL
        cur = 0;
        const backX = [a];
        for (let x = a - step; x >= xL - 1e-9; x -= step) backX.push(x);
        for (let i = 1; i < backX.length; i++) {
          cur += simpson(this._fnFn, backX[i-1], backX[i], 4);
          xs.unshift(backX[i]); Fs.unshift(cur);
        }
        // include a itself
        xs.splice(xs.findIndex(x => x >= a) || xs.length, 0, a);
        // draw F(x)
        ctx.strokeStyle = PALETTE.Fcurve;
        ctx.lineWidth = 2 * (this._dpr || 1);
        ctx.setLineDash([6 * (this._dpr || 1), 4 * (this._dpr || 1)]);
        ctx.beginPath();
        let prev = null;
        for (let i = 0; i < xs.length; i++) {
          if (!Number.isFinite(Fs[i])) { prev = null; continue; }
          const p = this._mathToPx(xs[i], Fs[i]);
          if (!prev) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          prev = p;
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // vertical guides at a and b
      for (const k of ['a', 'b']) {
        const x = this.opts[k];
        const y = this._fnFn(x);
        const px = this._mathToPx(x, 0).x;
        ctx.strokeStyle = k === 'a' ? PALETTE.handle : PALETTE.handle2;
        ctx.lineWidth = 1.4 * (this._dpr || 1);
        ctx.setLineDash([4 * (this._dpr || 1), 4 * (this._dpr || 1)]);
        ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
        ctx.setLineDash([]);
        // axis handle on x-axis
        const py = this._mathToPx(x, 0).y;
        this._drawHandle(px, py, k === 'a' ? PALETTE.handle : PALETTE.handle2, k);
        // also small dot on curve
        if (Number.isFinite(y)) {
          const pCurve = this._mathToPx(x, y);
          ctx.fillStyle = k === 'a' ? PALETTE.handle : PALETTE.handle2;
          ctx.beginPath();
          ctx.arc(pCurve.x, pCurve.y, 4 * (this._dpr || 1), 0, Math.PI*2);
          ctx.fill();
        }
      }
    }

    _drawHandle(x, y, color, label) {
      const ctx = this.ctx;
      const r = 7 * (this._dpr || 1);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.22;
      ctx.beginPath(); ctx.arc(x, y, r + 5 * (this._dpr || 1), 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 2 * (this._dpr || 1);
      ctx.stroke();
      if (label) {
        ctx.fillStyle = '#2b2118';
        ctx.font = `bold ${13*(this._dpr||1)}px Inter, sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(label, x + r + 4, y - r);
      }
    }

    _renderHud() {
      if (this._fnErr) {
        this.hud.innerHTML = '<div class="calc-line err">помилка: ' + this._fnErr + '</div>';
        return;
      }
      const out = [];
      if (this.opts.mode === 'derivative') {
        const x = this.opts.x0;
        const y = this._fnFn(x);
        const k = numDeriv(this._fnFn, x);
        const ang = Math.atan(k) * 180 / Math.PI;
        out.push(`<div class="calc-line"><span>P</span> = (${fmt(x, 2)}, ${fmt(y, 2)})</div>`);
        out.push(`<div class="calc-line key"><span>f ′(x₀)</span> = ${fmt(k, 3)}</div>`);
        out.push(`<div class="calc-line sub">кут нахилу дотичної: ${fmt(ang, 1)}°</div>`);
        if (this.opts.showSecant) {
          const h = this.opts.h;
          const ks = (this._fnFn(x + h) - this._fnFn(x - h)) / (2 * h);
          out.push(`<div class="calc-line sec">січна (h=${fmt(h, 2)}): k = ${fmt(ks, 3)}</div>`);
        }
      } else {
        const a = Math.min(this.opts.a, this.opts.b);
        const b = Math.max(this.opts.a, this.opts.b);
        const S = simpson(this._fnFn, a, b, 200);
        out.push(`<div class="calc-line"><span>a</span> = ${fmt(a, 2)} &nbsp; <span>b</span> = ${fmt(b, 2)}</div>`);
        out.push(`<div class="calc-line key"><span>∫<sup>b</sup><sub>a</sub>&nbsp;f(x)dx</span> = ${fmt(S, 3)}</div>`);
        if (this.opts.riemann !== 'off') {
          const N = Math.max(1, Math.floor(this.opts.N));
          const dx = (b - a) / N;
          let R = 0;
          for (let i = 0; i < N; i++) {
            const xl = a + i * dx, xr = a + (i + 1) * dx;
            const xs = this.opts.riemann === 'left' ? xl : (this.opts.riemann === 'right' ? xr : (xl + xr) / 2);
            const v = this._fnFn(xs);
            if (Number.isFinite(v)) R += v * dx;
          }
          const lab = this.opts.riemann === 'left' ? 'L' : (this.opts.riemann === 'right' ? 'R' : 'M');
          out.push(`<div class="calc-line sec">Σ${lab}(N=${N}) = ${fmt(R, 3)} &nbsp; <small>помилка ${fmt(R - S, 3)}</small></div>`);
        }
      }
      this.hud.innerHTML = out.join('');
    }

    destroy() {
      try { this._ro && this._ro.disconnect(); } catch(_) {}
      if (this._onWinResize) window.removeEventListener('resize', this._onWinResize);
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._pollTimers) this._pollTimers.forEach(clearTimeout);
      this.container.innerHTML = '';
    }
  }

  window.CalculusCard = CalculusCard;
})();

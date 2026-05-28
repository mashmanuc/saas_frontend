// quad-card.js — Interactive quadratic equation visualizer.
// ax² + bx + c: паrabola, discriminant, roots, vertex.
// Standalone IIFE, no external dependencies.
(function () {
  'use strict';

  const PALETTE = {
    bg:        '#fffaf0',
    gridMinor: 'rgba(43,33,24,0.07)',
    gridMajor: 'rgba(43,33,24,0.16)',
    axis:      '#2b2118',
    axisLab:   '#5a4a3a',
    parabola:  '#c4622a',
    vertex:    '#c4622a',
    arm:       '#3b7b9b',
    rootPos:   '#3b7b9b',
    rootZero:  '#7a8b3a',
    symAxis:   'rgba(90,74,58,0.32)',
  };

  const fmt = (n, d = 2) => {
    if (!Number.isFinite(n)) return '—';
    const k = Math.pow(10, d);
    const r = Math.round(n * k) / k;
    return (Math.abs(r) < 1e-9 ? 0 : r).toString().replace('.', ',');
  };

  // arm handle is always at xv + ARM_DX in math units.
  // fn(xv + ARM_DX) = yv + a * ARM_DX² → a = (arm_y - yv) / ARM_DX²
  const ARM_DX = 1.5;

  class QuadraticCard {
    constructor(container, opts) {
      this.container = container;
      this.opts = Object.assign({
        a: 1, b: -2, c: -3,
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

    // ── Math helpers ──────────────────────────────────────────────────────────
    _fn(x) { const { a, b, c } = this.opts; return a * x * x + b * x + c; }
    _xv()  { return -this.opts.b / (2 * this.opts.a); }
    _yv()  { return this._fn(this._xv()); }
    _disc(){ const { a, b, c } = this.opts; return b * b - 4 * a * c; }

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
        if (k === 'in')   this._zoomAt(this.canvas.width / 2, this.canvas.height / 2, 1.4);
        if (k === 'out')  this._zoomAt(this.canvas.width / 2, this.canvas.height / 2, 1 / 1.4);
        if (k === 'home') { this.viewport = { cx: 0, cy: 0, scale: 50 }; this._scheduleRender(); }
      });

      this._ro = new ResizeObserver(() => { this._render(); });
      this._ro.observe(c);
      this._onWinResize = () => this._render();
      window.addEventListener('resize', this._onWinResize);
      this._pollTimers = [];
      [50, 150, 400, 800].forEach((ms) => {
        this._pollTimers.push(setTimeout(() => this._render(), ms));
      });
    }

    // ── Resize ────────────────────────────────────────────────────────────────
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

    // ── Interaction ───────────────────────────────────────────────────────────
    _bindInteraction() {
      let dragging = null; // 'vertex' | 'arm' | 'pan'
      let lx = 0, ly = 0;

      const handleHit = (px, py) => {
        const xv = this._xv(), yv = this._yv();
        const pV = this._mathToPx(xv, yv);
        const pA = this._mathToPx(xv + ARM_DX, this._fn(xv + ARM_DX));
        const tol = 16 * (this._dpr || 1);
        let best = null, bestD = tol * tol;
        for (const [name, p] of [['vertex', pV], ['arm', pA]]) {
          const d2 = (p.x - px) ** 2 + (p.y - py) ** 2;
          if (d2 < bestD) { bestD = d2; best = name; }
        }
        return best;
      };

      this.canvas.addEventListener('pointerdown', (e) => {
        const r = this.canvas.getBoundingClientRect();
        const px = (e.clientX - r.left) * (this._dpr || 1);
        const py = (e.clientY - r.top)  * (this._dpr || 1);
        dragging = handleHit(px, py) || 'pan';
        lx = e.clientX; ly = e.clientY;
        try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
        this.canvas.style.cursor = dragging === 'pan' ? 'grabbing' : 'crosshair';
      });

      this.canvas.addEventListener('pointermove', (e) => {
        if (!dragging) {
          const r = this.canvas.getBoundingClientRect();
          const px = (e.clientX - r.left) * (this._dpr || 1);
          const py = (e.clientY - r.top)  * (this._dpr || 1);
          this.canvas.style.cursor = handleHit(px, py) ? 'crosshair' : 'grab';
          return;
        }

        const r = this.canvas.getBoundingClientRect();
        const px = (e.clientX - r.left) * (this._dpr || 1);
        const py = (e.clientY - r.top)  * (this._dpr || 1);
        const m = this._pxToMath(px, py);

        if (dragging === 'pan') {
          const dx = (e.clientX - lx) * (this._dpr || 1);
          const dy = (e.clientY - ly) * (this._dpr || 1);
          this.viewport.cx -= dx / this.viewport.scale;
          this.viewport.cy += dy / this.viewport.scale;

        } else if (dragging === 'vertex') {
          // Move vertex to m — update b and c, keep a fixed.
          // yv = a*xv² + b*xv + c → b = -2a*xv, c = yv + a*xv²
          const a = this.opts.a;
          this.opts.b = -2 * a * m.x;
          this.opts.c = m.y + a * m.x * m.x;
          if (this.onChange) this.onChange();

        } else if (dragging === 'arm') {
          // Arm is at (xv + ARM_DX, yv + a*ARM_DX²).
          // New y of arm → new a = (arm_y - yv) / ARM_DX²
          // Keep vertex (xv, yv) fixed while changing a.
          const xv = this._xv(), yv = this._yv();
          let newA = (m.y - yv) / (ARM_DX * ARM_DX);
          // Guard: prevent near-zero a (degenerate parabola → line)
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
        dragging = null;
        this.canvas.style.cursor = 'grab';
        try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      };
      this.canvas.addEventListener('pointerup', up);
      this.canvas.addEventListener('pointercancel', up);

      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const r = this.canvas.getBoundingClientRect();
        const px = (e.clientX - r.left) * (this._dpr || 1);
        const py = (e.clientY - r.top)  * (this._dpr || 1);
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
        x: this.viewport.cx + (px - w / 2) / this.viewport.scale,
        y: this.viewport.cy - (py - h / 2) / this.viewport.scale,
      };
    }

    _mathToPx(x, y) {
      const w = this.canvas.width, h = this.canvas.height;
      return {
        x: w / 2 + (x - this.viewport.cx) * this.viewport.scale,
        y: h / 2 - (y - this.viewport.cy) * this.viewport.scale,
      };
    }

    // ── Public API ────────────────────────────────────────────────────────────
    setOption(k, v) {
      this.opts[k] = v;
      this._scheduleRender();
      if (this.onChange) this.onChange();
    }

    // ── Render scheduling ─────────────────────────────────────────────────────
    _scheduleRender() {
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => { this._raf = null; this._render(); });
    }

    // ── Full render ───────────────────────────────────────────────────────────
    _render() {
      this._resize();
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      ctx.fillStyle = PALETTE.bg;
      ctx.fillRect(0, 0, w, h);
      this._drawGrid();
      this._drawAxes();
      this._renderParabola();
      this._renderOverlay();
      this._renderHud();
    }

    // ── Grid ──────────────────────────────────────────────────────────────────
    _niceStep(rangeUnits) {
      const target = rangeUnits / 10;
      const exp = Math.floor(Math.log10(Math.max(target, 1e-10)));
      const f = target / Math.pow(10, exp);
      let nice = f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10;
      return nice * Math.pow(10, exp);
    }

    _drawGrid() {
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      const xRange = w / this.viewport.scale, yRange = h / this.viewport.scale;
      const step = this._niceStep(xRange);
      const minor = step / 5;
      this._gridStep = step;
      const x0 = this.viewport.cx - xRange / 2, x1 = this.viewport.cx + xRange / 2;
      const y0 = this.viewport.cy - yRange / 2, y1 = this.viewport.cy + yRange / 2;
      ctx.strokeStyle = PALETTE.gridMinor; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = Math.ceil(x0 / minor) * minor; x <= x1 + 1e-9; x += minor) {
        const px = this._mathToPx(x, 0).x; ctx.moveTo(px, 0); ctx.lineTo(px, h);
      }
      for (let y = Math.ceil(y0 / minor) * minor; y <= y1 + 1e-9; y += minor) {
        const py = this._mathToPx(0, y).y; ctx.moveTo(0, py); ctx.lineTo(w, py);
      }
      ctx.stroke();
      ctx.strokeStyle = PALETTE.gridMajor; ctx.beginPath();
      for (let x = Math.ceil(x0 / step) * step; x <= x1 + 1e-9; x += step) {
        const px = this._mathToPx(x, 0).x; ctx.moveTo(px, 0); ctx.lineTo(px, h);
      }
      for (let y = Math.ceil(y0 / step) * step; y <= y1 + 1e-9; y += step) {
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
      // Tick labels
      const step = this._gridStep || 1;
      const xR = w / this.viewport.scale, yR = h / this.viewport.scale;
      const x0 = this.viewport.cx - xR / 2, x1 = this.viewport.cx + xR / 2;
      const y0 = this.viewport.cy - yR / 2, y1 = this.viewport.cy + yR / 2;
      ctx.fillStyle = PALETTE.axisLab;
      ctx.font = `${11 * (this._dpr || 1)}px JetBrains Mono, monospace`;
      const fmtT = (n) => Math.abs(n) < 1e-10 ? ''
        : (Math.round(n * 1000) / 1000).toString().replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let x = Math.ceil(x0 / step) * step; x <= x1 + 1e-9; x += step) {
        if (Math.abs(x) < 1e-10) continue;
        const px = this._mathToPx(x, 0).x;
        ctx.fillText(fmtT(x), px, Math.max(2, Math.min(h - 14, o.y + 4)));
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let y = Math.ceil(y0 / step) * step; y <= y1 + 1e-9; y += step) {
        if (Math.abs(y) < 1e-10) continue;
        const py = this._mathToPx(0, y).y;
        ctx.fillText(fmtT(y), Math.max(20, Math.min(w - 4, o.x - 4)), py);
      }
    }

    // ── Parabola curve ────────────────────────────────────────────────────────
    _renderParabola() {
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      ctx.strokeStyle = PALETTE.parabola;
      ctx.lineWidth = 2.4 * (this._dpr || 1);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath();
      let prev = null;
      const samples = Math.max(300, Math.floor(w / (this._dpr || 1)));
      for (let i = 0; i <= samples; i++) {
        const px = (i / samples) * w;
        const mx = this._pxToMath(px, 0).x;
        const y = this._fn(mx);
        if (!Number.isFinite(y)) { prev = null; continue; }
        const p = this._mathToPx(mx, y);
        // Clip values far off-screen to avoid degenerate paths
        if (p.y < -h * 3 || p.y > h * 4) { prev = null; continue; }
        if (!prev || Math.abs(p.y - prev.y) > h * 0.5) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
        prev = p;
      }
      ctx.stroke();
    }

    // ── Overlay: handles, roots, axis ─────────────────────────────────────────
    _renderOverlay() {
      const ctx = this.ctx, h = this.canvas.height;
      const D = this._disc();
      const xv = this._xv(), yv = this._yv();
      const dpr = this._dpr || 1;

      // Axis of symmetry: dashed vertical through xv
      if (this.opts.showAxis) {
        const px = this._mathToPx(xv, 0).x;
        const oy = this._mathToPx(0, 0).y;
        ctx.strokeStyle = PALETTE.symAxis;
        ctx.lineWidth = 1.2 * dpr;
        ctx.setLineDash([4 * dpr, 5 * dpr]);
        ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
        ctx.setLineDash([]);
        // x = xv label near x-axis
        ctx.fillStyle = PALETTE.symAxis;
        ctx.font = `${10 * dpr}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(`x₀=${fmt(xv, 2)}`, px, Math.max(2, oy + 4));
      }

      // Real roots on x-axis
      if (this.opts.showRoots) {
        if (D > 1e-9) {
          const sqrtD = Math.sqrt(D);
          const x1 = (-this.opts.b - sqrtD) / (2 * this.opts.a);
          const x2 = (-this.opts.b + sqrtD) / (2 * this.opts.a);
          for (const xr of [x1, x2]) {
            const pr = this._mathToPx(xr, 0);
            // Halo
            ctx.fillStyle = PALETTE.rootPos;
            ctx.globalAlpha = 0.18;
            ctx.beginPath(); ctx.arc(pr.x, pr.y, 10 * dpr, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 1;
            // Dot
            ctx.beginPath(); ctx.arc(pr.x, pr.y, 5 * dpr, 0, Math.PI * 2); ctx.fill();
            // Tick
            ctx.strokeStyle = PALETTE.rootPos;
            ctx.lineWidth = 2 * dpr;
            ctx.beginPath();
            ctx.moveTo(pr.x, pr.y - 8 * dpr); ctx.lineTo(pr.x, pr.y + 8 * dpr);
            ctx.stroke();
          }
        } else if (Math.abs(D) < 1e-9) {
          // D = 0: single root at vertex (touches x-axis)
          const pr = this._mathToPx(xv, 0);
          ctx.fillStyle = PALETTE.rootZero;
          ctx.globalAlpha = 0.25;
          ctx.beginPath(); ctx.arc(pr.x, pr.y, 11 * dpr, 0, Math.PI * 2); ctx.fill();
          ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.arc(pr.x, pr.y, 5 * dpr, 0, Math.PI * 2); ctx.fill();
        }
        // D < 0: no roots, shown only in HUD
      }

      // ARM handle (curvature control — blue, always visible)
      const armX = xv + ARM_DX;
      const armY = this._fn(armX); // = yv + a * ARM_DX²
      const pVs = this._mathToPx(xv, yv);
      const pAs = this._mathToPx(armX, armY);
      // Dashed line from vertex to arm
      ctx.strokeStyle = PALETTE.arm;
      ctx.lineWidth = 1.2 * dpr;
      ctx.globalAlpha = 0.45;
      ctx.setLineDash([3 * dpr, 4 * dpr]);
      ctx.beginPath(); ctx.moveTo(pVs.x, pVs.y); ctx.lineTo(pAs.x, pAs.y); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      this._drawHandle(pAs.x, pAs.y, PALETTE.arm, 'a');

      // VERTEX handle (orange — always on top)
      if (this.opts.showVertex) {
        this._drawHandle(pVs.x, pVs.y, PALETTE.vertex, 'V');
      }
    }

    _drawHandle(x, y, color, label) {
      const ctx = this.ctx;
      const r = 7 * (this._dpr || 1);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.22;
      ctx.beginPath(); ctx.arc(x, y, r + 5 * (this._dpr || 1), 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 2 * (this._dpr || 1); ctx.stroke();
      if (label) {
        ctx.fillStyle = '#2b2118';
        ctx.font = `bold ${13 * (this._dpr || 1)}px Inter, sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(label, x + r + 4, y - r);
      }
    }

    // ── HUD ───────────────────────────────────────────────────────────────────
    _renderHud() {
      const D = this._disc();
      const { a, b, c } = this.opts;
      const xv = this._xv(), yv = this._yv();
      const out = [];

      // Equation: ax² ± |b|x ± |c|
      const bSign = b >= 0 ? '+' : '−';
      const cSign = c >= 0 ? '+' : '−';
      const bAbs  = Math.abs(b), cAbs = Math.abs(c);
      let eqStr = `${fmt(a, 2)}x²`;
      if (bAbs > 1e-9) eqStr += ` ${bSign} ${fmt(bAbs, 2)}x`;
      if (cAbs > 1e-9) eqStr += ` ${cSign} ${fmt(cAbs, 2)}`;
      out.push(`<div class="quad-line"><span>f(x)</span> = ${eqStr}</div>`);

      // Discriminant (colored)
      const dColor = D > 1e-9 ? '#3b7b9b' : D < -1e-9 ? '#a83a5b' : '#7a8b3a';
      out.push(
        `<div class="quad-line key" style="color:${dColor}">` +
          `<span>D</span> = ${fmt(D, 2)}</div>`,
      );

      // Vertex
      out.push(`<div class="quad-line sub">вершина: (${fmt(xv, 2)}; ${fmt(yv, 2)})</div>`);

      // Roots
      if (D > 1e-9) {
        const sqrtD = Math.sqrt(D);
        const x1 = (-b - sqrtD) / (2 * a);
        const x2 = (-b + sqrtD) / (2 * a);
        out.push(
          `<div class="quad-line root">` +
            `x₁=${fmt(Math.min(x1, x2), 2)}, x₂=${fmt(Math.max(x1, x2), 2)}` +
          `</div>`,
        );
      } else if (Math.abs(D) < 1e-9) {
        out.push(`<div class="quad-line root zero">x₀ = ${fmt(xv, 2)}</div>`);
      } else {
        out.push(`<div class="quad-line root neg">коренів немає</div>`);
      }

      this.hud.innerHTML = out.join('');
    }

    // ── Destroy ───────────────────────────────────────────────────────────────
    destroy() {
      try { if (this._ro) this._ro.disconnect(); } catch (_) {}
      if (this._onWinResize) window.removeEventListener('resize', this._onWinResize);
      if (this._raf) cancelAnimationFrame(this._raf);
      if (this._pollTimers) this._pollTimers.forEach(clearTimeout);
      this.container.innerHTML = '';
    }
  }

  window.QuadraticCard = QuadraticCard;
})();

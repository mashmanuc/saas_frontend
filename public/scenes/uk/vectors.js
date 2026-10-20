// vectors.js — Interactive vector-teaching cards.
// Canvas-based, drag-and-recompute. Five modes:
//   'components'   — single vector, see (x, y), |v|, angle
//   'sum'          — a + b, triangle or parallelogram rule (+ optional a − b)
//   'scalar'       — kv slider, show direction flip at k<0
//   'dot'          — scalar product, projection of a on b, angle between
//   'basis'        — decomposition v = α·e1 + β·e2 in chosen basis
(function () {
  const PAL = {
    bg:        '#fffaf0',
    gridMinor: 'rgba(43,33,24,0.07)',
    gridMajor: 'rgba(43,33,24,0.16)',
    axis:      '#2b2118',
    axisLab:   '#5a4a3a',
    vec:       '#c4622a',   // primary vector a
    vecB:      '#3b7b9b',   // secondary vector b
    sum:       '#7a8b3a',   // a + b
    diff:      '#a83a5b',   // a − b
    scaled:    '#5a4a8a',
    proj:      '#3b7b9b',
    angle:     '#a83a5b',
    handle:    '#c4622a',
    handle2:   '#3b7b9b',
    handle3:   '#7a8b3a',
    ghost:     'rgba(43,33,24,0.30)',
  };

  const fmt = (n, d = 2) => {
    if (!Number.isFinite(n)) return '—';
    const k = Math.pow(10, d);
    const r = Math.round(n * k) / k;
    return (Math.abs(r) < 1e-9 ? 0 : r).toString().replace('.', ',');
  };

  class VectorCard {
    constructor(container, opts) {
      this.container = container;
      this.opts = Object.assign({
        mode: 'components',
        // shared geometry, all in math coords. origin at (0,0).
        // single vector v (modes: components, scalar)
        v:   { x: 3, y: 2 },
        // two vectors (modes: sum, dot)
        a:   { x: 3, y: 1 },
        b:   { x: 1, y: 2.5 },
        // scalar multiplier
        k: 1.5,
        // sum rule
        rule: 'triangle', // 'triangle' | 'parallelogram'
        showDiff: false,
        // dot product extras
        showProj: true,
        // basis decomposition
        e1: { x: 2, y: 0.5 },
        e2: { x: -0.6, y: 1.8 },
        // toggles
        showComponents: true,
        showLength: true,
        showAngle: true,
      }, opts);
      this.viewport = { cx: 0, cy: 0, scale: 50 };
      this._build();
      this._bindInteraction();
      // Render after layout settles (handles hidden-tab/iframe case)
      this._pollTimers = [];
      [0, 50, 200, 500].forEach((ms) => this._pollTimers.push(setTimeout(() => this._render(), ms)));
    }

    _build() {
      const c = this.container;
      c.classList.add('vec-root');
      c.style.position = 'relative';
      c.style.background = PAL.bg;
      this.canvas = document.createElement('canvas');
      this.canvas.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%;cursor:grab;touch-action:none;user-select:none;';
      c.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');

      this.hud = document.createElement('div');
      this.hud.className = 'calc-hud';
      c.appendChild(this.hud);

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
        if (k === 'home') { this.viewport = { cx: 0, cy: 0, scale: 50 }; this._render(); }
      });

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

    setOption(k, v) {
      this.opts[k] = v;
      this._render();
      if (this.onChange) this.onChange();
    }
    setPoint(name, x, y) {
      const p = this.opts[name];
      if (p) { p.x = x; p.y = y; this._render(); if (this.onChange) this.onChange(); }
    }

    // ---- interaction ------------------------------------------------------
    _handles() {
      // Returns list of {name, p (math)} describing draggable tips.
      // Tails are always (0,0) in these scenes for clarity.
      const m = this.opts.mode;
      if (m === 'components')    return [{ name: 'v', p: this.opts.v }];
      if (m === 'scalar')        return [{ name: 'v', p: this.opts.v }];
      if (m === 'sum' || m === 'dot') return [{ name: 'a', p: this.opts.a }, { name: 'b', p: this.opts.b }];
      if (m === 'basis')         return [
        { name: 'e1', p: this.opts.e1 },
        { name: 'e2', p: this.opts.e2 },
        { name: 'v',  p: this.opts.v  },
      ];
      return [];
    }

    _bindInteraction() {
      let drag = null, lx = 0, ly = 0;
      const pick = (px, py) => {
        const tol = 18 * (this._dpr || 1);
        let best = null, bestD = tol * tol;
        for (const h of this._handles()) {
          const s = this._m2s(h.p.x, h.p.y);
          const d2 = (s.x - px) ** 2 + (s.y - py) ** 2;
          if (d2 < bestD) { bestD = d2; best = h.name; }
        }
        return best;
      };
      this.canvas.addEventListener('pointerdown', (e) => {
        const r = this.canvas.getBoundingClientRect();
        const px = (e.clientX - r.left) * (this._dpr || 1);
        const py = (e.clientY - r.top) * (this._dpr || 1);
        const which = pick(px, py);
        drag = which || 'pan';
        lx = e.clientX; ly = e.clientY;
        try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
        this.canvas.style.cursor = drag === 'pan' ? 'grabbing' : 'move';
      });
      this.canvas.addEventListener('pointermove', (e) => {
        if (!drag) {
          const r = this.canvas.getBoundingClientRect();
          const px = (e.clientX - r.left) * (this._dpr || 1);
          const py = (e.clientY - r.top) * (this._dpr || 1);
          this.canvas.style.cursor = pick(px, py) ? 'move' : 'grab';
          return;
        }
        if (drag === 'pan') {
          const dx = (e.clientX - lx) * (this._dpr || 1);
          const dy = (e.clientY - ly) * (this._dpr || 1);
          this.viewport.cx -= dx / this.viewport.scale;
          this.viewport.cy += dy / this.viewport.scale;
        } else {
          const r = this.canvas.getBoundingClientRect();
          const px = (e.clientX - r.left) * (this._dpr || 1);
          const py = (e.clientY - r.top) * (this._dpr || 1);
          const m = this._s2m(px, py);
          const target = this.opts[drag];
          if (target) { target.x = m.x; target.y = m.y; }
          if (this.onChange) this.onChange();
        }
        lx = e.clientX; ly = e.clientY;
        this._render();
      });
      const up = (e) => {
        drag = null; this.canvas.style.cursor = 'grab';
        try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
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
      const before = this._s2m(px, py);
      this.viewport.scale = Math.max(8, Math.min(400, this.viewport.scale * factor));
      const after = this._s2m(px, py);
      this.viewport.cx += before.x - after.x;
      this.viewport.cy += before.y - after.y;
      this._render();
    }

    _s2m(px, py) {
      const w = this.canvas.width, h = this.canvas.height;
      return {
        x: this.viewport.cx + (px - w/2) / this.viewport.scale,
        y: this.viewport.cy - (py - h/2) / this.viewport.scale,
      };
    }
    _m2s(x, y) {
      const w = this.canvas.width, h = this.canvas.height;
      return {
        x: w/2 + (x - this.viewport.cx) * this.viewport.scale,
        y: h/2 - (y - this.viewport.cy) * this.viewport.scale,
      };
    }

    // ---- render -----------------------------------------------------------
    _render() {
      this._resize();
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, w, h);
      this._drawGrid();
      this._drawAxes();
      const m = this.opts.mode;
      if (m === 'components') this._renderComponents();
      else if (m === 'scalar') this._renderScalar();
      else if (m === 'sum') this._renderSum();
      else if (m === 'dot') this._renderDot();
      else if (m === 'basis') this._renderBasis();
      this._renderHud();
    }

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
      const xR = w / this.viewport.scale;
      const step = this._niceStep(xR);
      const minor = step / 5;
      this._gridStep = step;
      const x0 = this.viewport.cx - xR/2, x1 = this.viewport.cx + xR/2;
      const yR = h / this.viewport.scale;
      const y0 = this.viewport.cy - yR/2, y1 = this.viewport.cy + yR/2;
      ctx.strokeStyle = PAL.gridMinor; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = Math.ceil(x0/minor)*minor; x <= x1 + 1e-9; x += minor) {
        const px = this._m2s(x, 0).x; ctx.moveTo(px, 0); ctx.lineTo(px, h);
      }
      for (let y = Math.ceil(y0/minor)*minor; y <= y1 + 1e-9; y += minor) {
        const py = this._m2s(0, y).y; ctx.moveTo(0, py); ctx.lineTo(w, py);
      }
      ctx.stroke();
      ctx.strokeStyle = PAL.gridMajor; ctx.beginPath();
      for (let x = Math.ceil(x0/step)*step; x <= x1 + 1e-9; x += step) {
        const px = this._m2s(x, 0).x; ctx.moveTo(px, 0); ctx.lineTo(px, h);
      }
      for (let y = Math.ceil(y0/step)*step; y <= y1 + 1e-9; y += step) {
        const py = this._m2s(0, y).y; ctx.moveTo(0, py); ctx.lineTo(w, py);
      }
      ctx.stroke();
    }
    _drawAxes() {
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      const o = this._m2s(0, 0);
      ctx.strokeStyle = PAL.axis; ctx.lineWidth = 1.4 * (this._dpr || 1);
      ctx.beginPath();
      ctx.moveTo(0, o.y); ctx.lineTo(w, o.y);
      ctx.moveTo(o.x, 0); ctx.lineTo(o.x, h);
      ctx.stroke();
      const step = this._gridStep || 1;
      const xR = w/this.viewport.scale, yR = h/this.viewport.scale;
      const x0 = this.viewport.cx - xR/2, x1 = this.viewport.cx + xR/2;
      const y0 = this.viewport.cy - yR/2, y1 = this.viewport.cy + yR/2;
      ctx.fillStyle = PAL.axisLab;
      ctx.font = `${11*(this._dpr||1)}px JetBrains Mono, monospace`;
      const t = (n) => Math.abs(n) < 1e-10 ? '' : (Math.round(n*1000)/1000).toString().replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let x = Math.ceil(x0/step)*step; x <= x1 + 1e-9; x += step) {
        if (Math.abs(x) < 1e-10) continue;
        const px = this._m2s(x, 0).x;
        ctx.fillText(t(x), px, Math.max(2, Math.min(h - 14, o.y + 4)));
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let y = Math.ceil(y0/step)*step; y <= y1 + 1e-9; y += step) {
        if (Math.abs(y) < 1e-10) continue;
        const py = this._m2s(0, y).y;
        ctx.fillText(t(y), Math.max(20, Math.min(w - 4, o.x - 4)), py);
      }
    }

    // Draw vector from (mathTailX, mathTailY) to (mathTipX, mathTipY) with arrow.
    _drawArrow(tail, tip, color, opts = {}) {
      const ctx = this.ctx;
      const a = this._m2s(tail.x, tail.y);
      const b = this._m2s(tip.x, tip.y);
      const dx = b.x - a.x, dy = b.y - a.y;
      const L = Math.hypot(dx, dy);
      if (L < 1) return;
      const w = (opts.width || 2.4) * (this._dpr || 1);
      const headLen = Math.min(14 * (this._dpr || 1), L * 0.4);
      const headW   = headLen * 0.6;
      const ux = dx / L, uy = dy / L;
      const baseX = b.x - ux * headLen, baseY = b.y - uy * headLen;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.lineWidth = w;
      if (opts.dash) ctx.setLineDash(opts.dash); else ctx.setLineDash([]);
      ctx.globalAlpha = opts.alpha != null ? opts.alpha : 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(baseX, baseY);
      ctx.stroke();
      ctx.setLineDash([]);
      // head
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(baseX - uy * headW, baseY + ux * headW);
      ctx.lineTo(baseX + uy * headW, baseY - ux * headW);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    _drawHandle(mathPt, color, label) {
      const ctx = this.ctx;
      const p = this._m2s(mathPt.x, mathPt.y);
      const r = 7 * (this._dpr || 1);
      ctx.fillStyle = color; ctx.globalAlpha = 0.22;
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 5 * (this._dpr || 1), 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 2 * (this._dpr || 1); ctx.stroke();
      if (label) {
        ctx.fillStyle = '#2b2118';
        ctx.font = `bold ${13*(this._dpr||1)}px Inter, sans-serif`;
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(label, p.x + r + 4, p.y - r);
      }
    }
    _drawOrigin(label) {
      const ctx = this.ctx;
      const p = this._m2s(0, 0);
      ctx.fillStyle = '#2b2118';
      ctx.beginPath(); ctx.arc(p.x, p.y, 4 * (this._dpr || 1), 0, Math.PI*2); ctx.fill();
      if (label) {
        ctx.font = `${12*(this._dpr||1)}px JetBrains Mono, monospace`;
        ctx.fillStyle = '#5a4a3a';
        ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillText(label, p.x - 5, p.y - 5);
      }
    }
    _drawAngleArc(vertex, fromVec, toVec, color, label) {
      const ctx = this.ctx;
      const v = this._m2s(vertex.x, vertex.y);
      const a1 = Math.atan2(-fromVec.y, fromVec.x);
      const a2 = Math.atan2(-toVec.y, toVec.x);
      let d = a2 - a1; while (d > Math.PI) d -= 2*Math.PI; while (d < -Math.PI) d += 2*Math.PI;
      const rPx = 28 * (this._dpr || 1);
      const start = { x: v.x + rPx*Math.cos(a1), y: v.y + rPx*Math.sin(a1) };
      const end   = { x: v.x + rPx*Math.cos(a1 + d), y: v.y + rPx*Math.sin(a1 + d) };
      const large = Math.abs(d) > Math.PI ? 1 : 0;
      const sweep = d > 0 ? 1 : 0;
      ctx.strokeStyle = color; ctx.lineWidth = 1.6 * (this._dpr || 1);
      const path = new Path2D(`M ${start.x} ${start.y} A ${rPx} ${rPx} 0 ${large} ${sweep} ${end.x} ${end.y}`);
      ctx.stroke(path);
      if (label) {
        const mid = a1 + d / 2;
        const lx = v.x + (rPx + 14) * Math.cos(mid);
        const ly = v.y + (rPx + 14) * Math.sin(mid);
        ctx.fillStyle = color;
        ctx.font = `600 ${12*(this._dpr||1)}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(label, lx, ly);
      }
    }

    // ---------- MODES ----------
    _renderComponents() {
      const v = this.opts.v;
      const O = { x: 0, y: 0 };
      // dashed projection lines to axes
      if (this.opts.showComponents) {
        const ctx = this.ctx;
        ctx.strokeStyle = PAL.proj;
        ctx.lineWidth = 1.2 * (this._dpr || 1);
        ctx.setLineDash([4 * (this._dpr || 1), 4 * (this._dpr || 1)]);
        const p = this._m2s(v.x, v.y);
        const x0 = this._m2s(v.x, 0);
        const y0 = this._m2s(0, v.y);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y); ctx.lineTo(x0.x, x0.y);
        ctx.moveTo(p.x, p.y); ctx.lineTo(y0.x, y0.y);
        ctx.stroke();
        ctx.setLineDash([]);
        // component arrows on axes — short, semi-transparent
        this._drawArrow(O, { x: v.x, y: 0 }, PAL.proj, { width: 1.8, alpha: 0.55 });
        this._drawArrow(O, { x: 0, y: v.y }, PAL.proj, { width: 1.8, alpha: 0.55 });
        // x_v, y_v labels at tips
        ctx.fillStyle = PAL.proj;
        ctx.font = `${12*(this._dpr||1)}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(`x = ${fmt(v.x)}`, x0.x, x0.y + 6);
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillText(`y = ${fmt(v.y)}`, y0.x - 6, y0.y);
      }
      if (this.opts.showAngle) {
        this._drawAngleArc(O, { x: 1, y: 0 }, v, PAL.angle, 'α');
      }
      this._drawOrigin('O');
      this._drawArrow(O, v, PAL.vec, { width: 2.8 });
      this._drawHandle(v, PAL.handle, 'v');
    }

    _renderScalar() {
      const v = this.opts.v;
      const k = this.opts.k;
      const O = { x: 0, y: 0 };
      const kv = { x: v.x * k, y: v.y * k };
      // scaled vector first (faded if same direction, distinct color)
      this._drawArrow(O, kv, PAL.scaled, { width: 3.2 });
      // original vector on top
      this._drawArrow(O, v, PAL.vec, { width: 2.2, alpha: 0.85 });
      this._drawOrigin('O');
      this._drawHandle(v, PAL.handle, 'v');
      // also a handle at kv tip (read-only feel, but draggable too — keeps direction by scaling v)
      const ctx = this.ctx;
      const p = this._m2s(kv.x, kv.y);
      ctx.fillStyle = PAL.scaled;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5 * (this._dpr || 1), 0, Math.PI*2); ctx.fill();
      ctx.font = `bold ${13*(this._dpr||1)}px Inter, sans-serif`;
      ctx.fillStyle = '#2b2118';
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText(`${fmt(k)} · v`, p.x + 7, p.y - 7);
    }

    _renderSum() {
      const a = this.opts.a, b = this.opts.b;
      const O = { x: 0, y: 0 };
      const sum = { x: a.x + b.x, y: a.y + b.y };
      const ctx = this.ctx;
      if (this.opts.rule === 'parallelogram') {
        // draw faint copies: a from b's tip, b from a's tip → form parallelogram
        this._drawArrow(b, sum, PAL.vec, { width: 1.6, dash: [5, 4], alpha: 0.5 });
        this._drawArrow(a, sum, PAL.vecB, { width: 1.6, dash: [5, 4], alpha: 0.5 });
      } else {
        // triangle rule: b tail = a tip
        this._drawArrow(a, sum, PAL.vecB, { width: 1.6, dash: [5, 4], alpha: 0.6 });
      }
      // primary vectors
      this._drawArrow(O, a, PAL.vec,  { width: 2.6 });
      this._drawArrow(O, b, PAL.vecB, { width: 2.6 });
      // sum
      this._drawArrow(O, sum, PAL.sum, { width: 3 });
      // optional difference a − b
      if (this.opts.showDiff) {
        const diff = { x: a.x - b.x, y: a.y - b.y };
        // draw as arrow from b's tip to a's tip (geometric: a − b)
        this._drawArrow(b, a, PAL.diff, { width: 2.2, dash: [3, 4] });
        // and also from O for clarity
        this._drawArrow(O, diff, PAL.diff, { width: 2.6, alpha: 0.85 });
      }
      this._drawOrigin('O');
      this._drawHandle(a, PAL.handle,  'a');
      this._drawHandle(b, PAL.handle2, 'b');
      // small sum-tip dot
      const ps = this._m2s(sum.x, sum.y);
      ctx.fillStyle = PAL.sum;
      ctx.beginPath(); ctx.arc(ps.x, ps.y, 5 * (this._dpr || 1), 0, Math.PI*2); ctx.fill();
      ctx.font = `bold ${13*(this._dpr||1)}px Inter, sans-serif`;
      ctx.fillStyle = '#2b2118'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('a + b', ps.x + 6, ps.y - 6);
    }

    _renderDot() {
      const a = this.opts.a, b = this.opts.b;
      const O = { x: 0, y: 0 };
      // projection of a onto b
      const bb = b.x * b.x + b.y * b.y;
      let projPt = O;
      if (bb > 1e-9) {
        const t = (a.x * b.x + a.y * b.y) / bb;
        projPt = { x: b.x * t, y: b.y * t };
      }
      if (this.opts.showProj) {
        // dashed perpendicular from a tip to projection point
        const ctx = this.ctx;
        ctx.strokeStyle = PAL.proj;
        ctx.lineWidth = 1.2 * (this._dpr || 1);
        ctx.setLineDash([4 * (this._dpr || 1), 4 * (this._dpr || 1)]);
        const pa = this._m2s(a.x, a.y);
        const pp = this._m2s(projPt.x, projPt.y);
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pp.x, pp.y); ctx.stroke();
        ctx.setLineDash([]);
        // projection vector (along b) thicker
        this._drawArrow(O, projPt, PAL.proj, { width: 3.4, alpha: 0.85 });
        // right-angle mark at foot
        const sa = this._m2s(a.x, a.y);
        const sb = this._m2s(b.x, b.y);
        const sp = this._m2s(projPt.x, projPt.y);
        const u1 = { x: sa.x - sp.x, y: sa.y - sp.y };
        const u2 = { x: sb.x - sp.x, y: sb.y - sp.y };
        const n1 = Math.hypot(u1.x, u1.y), n2 = Math.hypot(u2.x, u2.y);
        if (n1 > 1 && n2 > 1) {
          u1.x /= n1; u1.y /= n1; u2.x /= n2; u2.y /= n2;
          const s = 11 * (this._dpr || 1);
          ctx.strokeStyle = PAL.proj;
          ctx.lineWidth = 1.2 * (this._dpr || 1);
          ctx.beginPath();
          ctx.moveTo(sp.x + u1.x * s, sp.y + u1.y * s);
          ctx.lineTo(sp.x + (u1.x + u2.x) * s, sp.y + (u1.y + u2.y) * s);
          ctx.lineTo(sp.x + u2.x * s, sp.y + u2.y * s);
          ctx.stroke();
        }
      }
      // angle between a and b
      if (this.opts.showAngle) {
        this._drawAngleArc(O, b, a, PAL.angle, 'φ');
      }
      this._drawArrow(O, b, PAL.vecB, { width: 2.6 });
      this._drawArrow(O, a, PAL.vec,  { width: 2.6 });
      this._drawOrigin('O');
      this._drawHandle(a, PAL.handle,  'a');
      this._drawHandle(b, PAL.handle2, 'b');
    }

    _renderBasis() {
      const e1 = this.opts.e1, e2 = this.opts.e2, v = this.opts.v;
      const O = { x: 0, y: 0 };
      // Solve v = α·e1 + β·e2  →  matrix [e1 e2] · [α β]ᵀ = v
      const det = e1.x * e2.y - e1.y * e2.x;
      let alpha = NaN, beta = NaN, validBasis = Math.abs(det) > 1e-6;
      if (validBasis) {
        alpha = (v.x * e2.y - v.y * e2.x) / det;
        beta  = (e1.x * v.y - e1.y * v.x) / det;
      }
      // shaded parallelogram via α·e1 and β·e2
      if (validBasis) {
        const ae = { x: alpha * e1.x, y: alpha * e1.y };
        const be = { x: beta  * e2.x, y: beta  * e2.y };
        const ctx = this.ctx;
        const p0 = this._m2s(0, 0);
        const p1 = this._m2s(ae.x, ae.y);
        const p2 = this._m2s(v.x, v.y);
        const p3 = this._m2s(be.x, be.y);
        ctx.fillStyle = 'rgba(122,139,58,0.10)';
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.closePath(); ctx.fill();
        // dashed guides from ae and be to v
        ctx.strokeStyle = PAL.sum;
        ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2 * (this._dpr || 1);
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        ctx.moveTo(p3.x, p3.y); ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.setLineDash([]);
        // α·e1 and β·e2 arrows
        this._drawArrow(O, ae, PAL.sum, { width: 2.4, alpha: 0.85 });
        this._drawArrow(O, be, PAL.sum, { width: 2.4, alpha: 0.85 });
      }
      // basis vectors
      this._drawArrow(O, e1, PAL.vec,  { width: 2.4 });
      this._drawArrow(O, e2, PAL.vecB, { width: 2.4 });
      // target vector v
      this._drawArrow(O, v, PAL.scaled, { width: 2.8 });
      this._drawOrigin('O');
      this._drawHandle(e1, PAL.handle,  'e₁');
      this._drawHandle(e2, PAL.handle2, 'e₂');
      this._drawHandle(v,  PAL.handle3, 'v');
    }

    // ---- HUD --------------------------------------------------------------
    _renderHud() {
      const lines = [];
      const m = this.opts.mode;
      if (m === 'components') {
        const v = this.opts.v;
        const L = Math.hypot(v.x, v.y);
        let ang = Math.atan2(v.y, v.x) * 180 / Math.PI;
        if (ang < 0) ang += 360;
        lines.push(`<div class="calc-line key"><span>v</span> = (${fmt(v.x)}, ${fmt(v.y)})</div>`);
        lines.push(`<div class="calc-line"><span>|v|</span> = √(${fmt(v.x*v.x, 2)} + ${fmt(v.y*v.y, 2)}) = ${fmt(L, 3)}</div>`);
        lines.push(`<div class="calc-line"><span>α</span> = ${fmt(ang, 1)}°</div>`);
      } else if (m === 'scalar') {
        const v = this.opts.v, k = this.opts.k;
        const kv = { x: v.x*k, y: v.y*k };
        const L = Math.hypot(v.x, v.y), Lk = Math.hypot(kv.x, kv.y);
        lines.push(`<div class="calc-line"><span>v</span> = (${fmt(v.x)}, ${fmt(v.y)}) &nbsp; <span>|v|</span> = ${fmt(L, 2)}</div>`);
        lines.push(`<div class="calc-line key"><span>k·v</span> = (${fmt(kv.x)}, ${fmt(kv.y)})</div>`);
        lines.push(`<div class="calc-line"><span>|k·v|</span> = |k|·|v| = ${fmt(Math.abs(k))} · ${fmt(L, 2)} = ${fmt(Lk, 2)}</div>`);
        if (k < 0) lines.push(`<div class="calc-line sec">k &lt; 0  →  напрям протилежний</div>`);
      } else if (m === 'sum') {
        const a = this.opts.a, b = this.opts.b;
        const s = { x: a.x + b.x, y: a.y + b.y };
        const La = Math.hypot(a.x, a.y), Lb = Math.hypot(b.x, b.y), Ls = Math.hypot(s.x, s.y);
        lines.push(`<div class="calc-line"><span>a</span> = (${fmt(a.x)}, ${fmt(a.y)}) &nbsp; <span>|a|</span> = ${fmt(La, 2)}</div>`);
        lines.push(`<div class="calc-line"><span>b</span> = (${fmt(b.x)}, ${fmt(b.y)}) &nbsp; <span>|b|</span> = ${fmt(Lb, 2)}</div>`);
        lines.push(`<div class="calc-line key"><span>a + b</span> = (${fmt(s.x)}, ${fmt(s.y)}) &nbsp; <span>|a+b|</span> = ${fmt(Ls, 2)}</div>`);
        if (this.opts.showDiff) {
          const d = { x: a.x - b.x, y: a.y - b.y };
          const Ld = Math.hypot(d.x, d.y);
          lines.push(`<div class="calc-line sec"><span>a − b</span> = (${fmt(d.x)}, ${fmt(d.y)}) &nbsp; <span>|a−b|</span> = ${fmt(Ld, 2)}</div>`);
        }
      } else if (m === 'dot') {
        const a = this.opts.a, b = this.opts.b;
        const La = Math.hypot(a.x, a.y), Lb = Math.hypot(b.x, b.y);
        const dot = a.x * b.x + a.y * b.y;
        const cosA = (La > 1e-9 && Lb > 1e-9) ? dot / (La * Lb) : NaN;
        const ang = Math.acos(Math.max(-1, Math.min(1, cosA))) * 180 / Math.PI;
        lines.push(`<div class="calc-line"><span>a</span> = (${fmt(a.x)}, ${fmt(a.y)})  <span>b</span> = (${fmt(b.x)}, ${fmt(b.y)})</div>`);
        lines.push(`<div class="calc-line key"><span>a · b</span> = ${fmt(a.x)}·${fmt(b.x)} + ${fmt(a.y)}·${fmt(b.y)} = ${fmt(dot, 3)}</div>`);
        lines.push(`<div class="calc-line"><span>cos φ</span> = ${fmt(cosA, 3)} &nbsp; <span>φ</span> = ${fmt(ang, 1)}°</div>`);
        if (Math.abs(dot) < 0.05) lines.push(`<div class="calc-line sec">a · b ≈ 0  →  a ⊥ b</div>`);
        else if (Math.abs(Math.abs(cosA) - 1) < 0.005) lines.push(`<div class="calc-line sec">|cos φ| ≈ 1  →  a ∥ b</div>`);
      } else if (m === 'basis') {
        const e1 = this.opts.e1, e2 = this.opts.e2, v = this.opts.v;
        const det = e1.x * e2.y - e1.y * e2.x;
        if (Math.abs(det) < 1e-6) {
          lines.push(`<div class="calc-line err">e₁ ∥ e₂  →  не базис</div>`);
        } else {
          const alpha = (v.x * e2.y - v.y * e2.x) / det;
          const beta  = (e1.x * v.y - e1.y * v.x) / det;
          lines.push(`<div class="calc-line"><span>e₁</span> = (${fmt(e1.x)}, ${fmt(e1.y)}) &nbsp; <span>e₂</span> = (${fmt(e2.x)}, ${fmt(e2.y)})</div>`);
          lines.push(`<div class="calc-line"><span>v</span> = (${fmt(v.x)}, ${fmt(v.y)})</div>`);
          lines.push(`<div class="calc-line key"><span>v</span> = ${fmt(alpha, 2)} · e₁ + ${fmt(beta, 2)} · e₂</div>`);
        }
      }
      this.hud.innerHTML = lines.join('');
    }

    destroy() {
      try { this._ro && this._ro.disconnect(); } catch (_) {}
      if (this._onWinResize) window.removeEventListener('resize', this._onWinResize);
      if (this._pollTimers) this._pollTimers.forEach(clearTimeout);
      this.container.innerHTML = '';
    }
  }

  window.VectorCard = VectorCard;
})();

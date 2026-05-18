// trig-circle.js — Unit circle ↔ sin/cos graph, synchronized.
// Drag the point P on the circle (or scrub angle) — sin(θ), cos(θ) trace out
// alongside. Optional reference grid of special angles with exact fractional
// labels (√3/2, √2/2, 1/2, etc.).
(function () {
  const PAL = {
    bg:        '#fffaf0',
    gridMinor: 'rgba(43,33,24,0.07)',
    gridMajor: 'rgba(43,33,24,0.16)',
    axis:      '#2b2118',
    axisLab:   '#5a4a3a',
    circle:    '#2b2118',
    radius:    '#c4622a',
    sin:       '#a83a5b',
    cos:       '#3b7b9b',
    tan:       '#3a8a4f',
    cot:       '#7b6193',
    handle:    '#c4622a',
    deg:       '#a83a5b',
    rad:       '#3b7b9b',
    refSquare: '#3b7b9b',
    refOct:    '#c4622a',
    refTri:    '#3a8a4f',
    refDot:    '#bba040',
    pt:        '#2b2118',
  };

  const TAU = Math.PI * 2;

  // ===== Reference data for special angles =====
  // 16 special angles, with exact label data (degrees, radian fraction, sin, cos)
  // Stored as: { deg, num, den (for π fraction), sinLabel, cosLabel }
  // We provide both positive and "negative" labels (e.g. 30°/-330°, 330°/-30°)
  const SPECIAL_ANGLES = (() => {
    const items = [
      // [deg, numerator, denominator]
      [0,   0, 1], [30,  1, 6], [45,  1, 4], [60,  1, 3],
      [90,  1, 2], [120, 2, 3], [135, 3, 4], [150, 5, 6],
      [180, 1, 1], [210, 7, 6], [225, 5, 4], [240, 4, 3],
      [270, 3, 2], [300, 5, 3], [315, 7, 4], [330, 11,6],
    ];
    const out = [];
    for (const [deg, num, den] of items) {
      const rad = (deg / 180) * Math.PI;
      const sn = Math.sin(rad), cs = Math.cos(rad);
      out.push({ deg, num, den, rad, sin: sn, cos: cs });
    }
    return out;
  })();

  // Pretty-print sin/cos value with exact root expressions when close to special
  function exactLabel(value) {
    const T = 0.005;
    if (Math.abs(value) < T) return '0';
    if (Math.abs(Math.abs(value) - 1) < T) return value > 0 ? '1' : '−1';
    if (Math.abs(Math.abs(value) - 0.5) < T) return (value > 0 ? '' : '−') + '½';
    if (Math.abs(Math.abs(value) - Math.SQRT2/2) < T) return (value > 0 ? '' : '−') + '√2/2';
    if (Math.abs(Math.abs(value) - Math.sqrt(3)/2) < T) return (value > 0 ? '' : '−') + '√3/2';
    return value.toFixed(2).replace('.', ',');
  }

  // Pretty pi-fraction label, e.g. (1,6) → "π/6", (2,3) → "2π/3", (0,1) → "0", (1,1) → "π"
  function piFractionLabel(num, den) {
    if (num === 0) return '0';
    const sign = num < 0 ? '−' : '';
    const n = Math.abs(num);
    if (den === 1 && n === 1) return sign + 'π';
    if (den === 1) return sign + n + 'π';
    if (n === 1) return sign + 'π/' + den;
    return sign + n + 'π/' + den;
  }
  function piFractionNeg(num, den) {
    // "negative angle" alias e.g. 330° → −π/6 mirror. For deg, deg - 360.
    if (num === 0) return null;
    const negNum = num - 2 * den;
    if (negNum === 0) return null;
    return piFractionLabel(negNum, den);
  }

  const fmt = (n, d = 3) => {
    if (!Number.isFinite(n)) return '—';
    const k = Math.pow(10, d);
    const r = Math.round(n * k) / k;
    return (Math.abs(r) < 1e-9 ? 0 : r).toString().replace('.', ',');
  };

  class TrigCircle {
    constructor(container, opts = {}) {
      this.container = container;
      this.opts = Object.assign({
        theta: Math.PI / 3,        // current angle (rad)
        showSin: true,
        showCos: true,
        showTan: false,
        showCot: false,
        showSpecialPoints: true,   // 16 yellow dots on the circle
        showRefLabels: true,       // numeric labels for x and y of P
        showDeg: true,
        showRad: true,
        showExactGrid: false,      // full reference overlay like screenshot
        showInscribed: false,      // inscribed square/hex/triangle from special angles
        showGraphs: true,          // sin and cos vs theta side panel
        snapPi12: false,           // snap to multiples of π/12
        animate: false,
        speed: 0.6,                // rad / sec for ▶ animation
        partialCurves: false,      // "draw sine" mode — only paint curve up to current θ
      }, opts);
      this._build();
      this._bindInteraction();
      this._pollTimers = [];
      [0, 50, 200, 500].forEach((ms) => this._pollTimers.push(setTimeout(() => this._render(), ms)));
      this._tickAnim = this._tickAnim.bind(this);
    }

    setOption(k, v) {
      this.opts[k] = v;
      if (k === 'animate') {
        if (v) { this._animLast = performance.now(); requestAnimationFrame(this._tickAnim); }
      }
      // snap π/12 enabled → immediately snap current theta to nearest multiple
      if (k === 'snapPi12' && v) {
        this.opts.theta = Math.round(this.opts.theta / (Math.PI / 12)) * (Math.PI / 12);
      }
      this._render();
      if (this.onChange) this.onChange();
    }
    setTheta(t) {
      this.opts.theta = t;
      this._render();
      if (this.onChange) this.onChange();
    }

    _tickAnim(now) {
      if (!this.opts.animate || this._destroyed) return;
      const dt = (now - (this._animLast || now)) / 1000;
      this._animLast = now;
      this.opts.theta += dt * (this.opts.speed || 0.6);
      if (this.opts.theta > TAU) this.opts.theta -= TAU;
      this._render();
      if (this.onChange) this.onChange();
      requestAnimationFrame(this._tickAnim);
    }

    _build() {
      const c = this.container;
      c.classList.add('trig-root');
      c.style.position = 'relative';
      c.style.background = PAL.bg;
      this.canvas = document.createElement('canvas');
      this.canvas.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%;touch-action:none;user-select:none;cursor:grab;';
      c.appendChild(this.canvas);
      this.ctx = this.canvas.getContext('2d');
      this.hud = document.createElement('div');
      this.hud.className = 'calc-hud';
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
    // Two panels side-by-side: left = unit circle, right = sin/cos graph
    // Layout in device pixels (after _resize)
    _layout() {
      const w = this.canvas.width, h = this.canvas.height;
      const dpr = this._dpr || 1;
      const pad = 24 * dpr;
      if (!this.opts.showGraphs || w < 600 * dpr) {
        // single-panel: just the circle, centered
        const size = Math.max(0, Math.min(w, h) - pad * 2);
        return {
          dual: false,
          circle: {
            cx: w / 2,
            cy: h / 2,
            r: Math.max(1, size / 2 - 40 * dpr),
          },
        };
      }
      // dual: circle on left, graph on right — make their amplitudes match
      // (graph "half" height == circle radius)
      const circleColW = w * 0.5 - pad * 2;
      const labelMargin = 36 * dpr;
      const maxR_byWidth  = circleColW / 2 - labelMargin;
      const maxR_byHeight = h / 2 - pad - 14 * dpr - labelMargin / 2;
      const cR = Math.max(40 * dpr, Math.min(maxR_byWidth, maxR_byHeight));
      const circleCx = pad + labelMargin + cR;
      const circleCy = h / 2;
      const graphLeft  = circleCx + cR + labelMargin;
      const graphRight = w - pad;
      // Graph vertical box so that (y1 - y0)/2 - 14*dpr == cR  →  y1 - y0 = 2*cR + 28*dpr
      const graphMid = h / 2;
      const graphHalfBox = cR + 14 * dpr;
      const graphTop = graphMid - graphHalfBox;
      const graphBot = graphMid + graphHalfBox;
      return {
        dual: true,
        circle: { cx: circleCx, cy: circleCy, r: cR },
        graph:  { x0: graphLeft, y0: graphTop, x1: graphRight, y1: graphBot },
      };
    }

    _circlePt(theta) {
      const L = this._layout().circle;
      return { x: L.cx + L.r * Math.cos(theta), y: L.cy - L.r * Math.sin(theta) };
    }
    _graphMap(theta, value) {
      const G = this._layout().graph;
      if (!G) return null;
      const t = theta / TAU; // 0..1 across full revolution
      const x = G.x0 + t * (G.x1 - G.x0);
      const mid = (G.y0 + G.y1) / 2;
      const half = (G.y1 - G.y0) / 2 - 14 * (this._dpr || 1);
      const y = mid - value * half;
      return { x, y, mid, half };
    }

    // ==== interaction ====================================================
    _bindInteraction() {
      let dragging = false;
      const setFromXY = (clientX, clientY) => {
        const r = this.canvas.getBoundingClientRect();
        const dpr = this._dpr || 1;
        const px = (clientX - r.left) * dpr;
        const py = (clientY - r.top) * dpr;
        const L = this._layout();
        // If inside circle area, pick angle by atan2 around its center
        const dxC = px - L.circle.cx, dyC = py - L.circle.cy;
        let theta;
        if (L.dual && px > L.graph.x0 - 8) {
          // inside the graph area: scrub by x position
          const t = (px - L.graph.x0) / (L.graph.x1 - L.graph.x0);
          theta = Math.max(0, Math.min(1, t)) * TAU;
        } else {
          theta = Math.atan2(-dyC, dxC);
          if (theta < 0) theta += TAU;
        }
        if (this.opts.snapPi12) {
          theta = Math.round(theta / (Math.PI / 12)) * (Math.PI / 12);
        }
        this.opts.theta = theta;
        if (this.onChange) this.onChange();
        this._render();
      };
      this.canvas.addEventListener('pointerdown', (e) => {
        dragging = true;
        try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
        this.canvas.style.cursor = 'grabbing';
        // pause auto-animation while user drags
        this._userPaused = this.opts.animate;
        this.opts.animate = false;
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
        if (this._userPaused) {
          this._userPaused = false;
          this.opts.animate = true;
          this._animLast = performance.now();
          requestAnimationFrame(this._tickAnim);
        }
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
      if (L.dual) this._drawGraphs(L);
      this._renderHud();
    }

    _drawCircle(L) {
      const ctx = this.ctx, dpr = this._dpr || 1;
      const { cx, cy, r } = L.circle;
      if (r <= 1) return; // container too small — skip render to avoid arc() errors
      const theta = this.opts.theta;
      const P = this._circlePt(theta);

      // axes through circle center
      ctx.strokeStyle = PAL.axis;
      ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath();
      ctx.moveTo(cx - r - 20*dpr, cy); ctx.lineTo(cx + r + 20*dpr, cy);
      ctx.moveTo(cx, cy - r - 20*dpr); ctx.lineTo(cx, cy + r + 20*dpr);
      ctx.stroke();

      // axis ticks at ±1, ±√2/2, ±√3/2, ±1/2
      if (this.opts.showExactGrid) {
        ctx.strokeStyle = PAL.gridMajor;
        ctx.lineWidth = 1 * dpr;
        const ticks = [
          { v: 0.5,         lab: '½',    sign: 1 },
          { v: Math.SQRT2/2, lab: '√2/2', sign: 1 },
          { v: Math.sqrt(3)/2, lab: '√3/2', sign: 1 },
          { v: 1,           lab: '1',    sign: 1 },
        ];
        ctx.fillStyle = PAL.axisLab;
        ctx.font = `${13*dpr}px JetBrains Mono, monospace`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        for (const t of ticks) {
          for (const s of [-1, 1]) {
            const dx = r * t.v * s;
            ctx.beginPath();
            ctx.moveTo(cx + dx, cy - 4*dpr);
            ctx.lineTo(cx + dx, cy + 4*dpr);
            ctx.stroke();
            ctx.fillText(s < 0 ? '−' + t.lab : t.lab, cx + dx, cy + 8*dpr);
          }
        }
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        for (const t of ticks) {
          for (const s of [-1, 1]) {
            const dy = -r * t.v * s; // up positive
            ctx.beginPath();
            ctx.moveTo(cx - 4*dpr, cy + dy);
            ctx.lineTo(cx + 4*dpr, cy + dy);
            ctx.stroke();
            ctx.fillText(s < 0 ? '−' + t.lab : t.lab, cx - 8*dpr, cy + dy);
          }
        }
        // inscribed shapes (square, hex, equilateral pair) using special angle dots
        this._drawInscribedShapes(cx, cy, r);
      } else if (this.opts.showInscribed) {
        this._drawInscribedShapes(cx, cy, r);
      }

      // the circle
      ctx.strokeStyle = PAL.circle;
      ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();

      // special-angle yellow dots
      if (this.opts.showSpecialPoints) {
        ctx.fillStyle = PAL.refDot;
        for (const a of SPECIAL_ANGLES) {
          const px = cx + r * Math.cos(a.rad), py = cy - r * Math.sin(a.rad);
          ctx.beginPath(); ctx.arc(px, py, 4 * dpr, 0, TAU); ctx.fill();
        }
      }

      // special-angle labels (deg / rad)
      if (this.opts.showDeg || this.opts.showRad) {
        ctx.font = `600 ${14*dpr}px JetBrains Mono, monospace`;
        for (const a of SPECIAL_ANGLES) {
          const off = 22 * dpr;
          const lx = cx + (r + off) * Math.cos(a.rad);
          const ly = cy - (r + off) * Math.sin(a.rad);
          // text-align based on quadrant
          const cosA = Math.cos(a.rad), sinA = Math.sin(a.rad);
          ctx.textAlign = cosA > 0.2 ? 'left' : (cosA < -0.2 ? 'right' : 'center');
          ctx.textBaseline = sinA > 0.2 ? 'bottom' : (sinA < -0.2 ? 'top' : 'middle');
          const degTxt = a.deg + '°';
          const radTxt = piFractionLabel(a.num, a.den);
          // stack lines
          const lh = 16 * dpr;
          if (this.opts.showDeg && this.opts.showRad) {
            ctx.fillStyle = PAL.rad;
            ctx.fillText(radTxt, lx, ly);
            ctx.fillStyle = PAL.deg;
            ctx.fillText(degTxt, lx, ly + (sinA < 0 ? lh : -lh));
          } else if (this.opts.showDeg) {
            ctx.fillStyle = PAL.deg;
            ctx.fillText(degTxt, lx, ly);
          } else {
            ctx.fillStyle = PAL.rad;
            ctx.fillText(radTxt, lx, ly);
          }
        }
      }

      // sweep arc (from 0° to current θ) — angle indicator
      ctx.strokeStyle = PAL.handle;
      ctx.lineWidth = 2.2 * dpr;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.18, 0, -theta, true);
      ctx.stroke();

      // radius OP (dashed)
      ctx.strokeStyle = PAL.radius;
      ctx.setLineDash([6*dpr, 4*dpr]); ctx.lineWidth = 1.4 * dpr;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(P.x, P.y); ctx.stroke();
      ctx.setLineDash([]);

      // sin segment — vertical from (cosθ,0) to P  (red)
      if (this.opts.showSin) {
        ctx.strokeStyle = PAL.sin; ctx.lineWidth = 3.5 * dpr;
        const foot = { x: P.x, y: cy };
        ctx.beginPath(); ctx.moveTo(foot.x, foot.y); ctx.lineTo(P.x, P.y); ctx.stroke();
        // small label
        if (this.opts.showRefLabels) {
          const value = Math.sin(theta);
          ctx.fillStyle = PAL.sin;
          ctx.font = `600 ${14*dpr}px JetBrains Mono, monospace`;
          ctx.textAlign = P.x > cx ? 'left' : 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText('sin θ = ' + exactLabel(value), P.x + (P.x > cx ? 10*dpr : -10*dpr), (foot.y + P.y) / 2);
        }
      }
      // cos segment — horizontal from O to (cosθ,0)  (blue)
      if (this.opts.showCos) {
        ctx.strokeStyle = PAL.cos; ctx.lineWidth = 3.5 * dpr;
        const foot = { x: P.x, y: cy };
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(foot.x, foot.y); ctx.stroke();
        if (this.opts.showRefLabels) {
          const value = Math.cos(theta);
          ctx.fillStyle = PAL.cos;
          ctx.font = `600 ${14*dpr}px JetBrains Mono, monospace`;
          ctx.textAlign = 'center'; ctx.textBaseline = P.y > cy ? 'top' : 'bottom';
          const off = P.y > cy ? 10*dpr : -10*dpr;
          ctx.fillText('cos θ = ' + exactLabel(value), (cx + P.x) / 2, cy + off);
        }
      }

      // tangent (vertical line x=1) and ctg (horizontal y=1) — optional
      if (this.opts.showTan) {
        ctx.strokeStyle = PAL.tan;
        ctx.setLineDash([3*dpr, 4*dpr]); ctx.lineWidth = 1 * dpr;
        ctx.beginPath(); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.stroke();
        ctx.setLineDash([]);
        const tanV = Math.tan(theta);
        if (Math.abs(Math.cos(theta)) > 0.02) {
          const tipY = cy - Math.max(-r*2, Math.min(r*2, tanV * r));
          ctx.strokeStyle = PAL.tan; ctx.lineWidth = 3 * dpr;
          ctx.beginPath(); ctx.moveTo(cx + r, cy); ctx.lineTo(cx + r, tipY); ctx.stroke();
          // extend dotted OP
          ctx.strokeStyle = PAL.radius;
          ctx.setLineDash([2*dpr, 4*dpr]); ctx.lineWidth = 1 * dpr;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + r, tipY); ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      if (this.opts.showCot) {
        ctx.strokeStyle = PAL.cot;
        ctx.setLineDash([3*dpr, 4*dpr]); ctx.lineWidth = 1 * dpr;
        ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy - r); ctx.stroke();
        ctx.setLineDash([]);
        const cotV = 1 / Math.tan(theta);
        if (Math.abs(Math.sin(theta)) > 0.02) {
          const tipX = cx + Math.max(-r*2, Math.min(r*2, cotV * r));
          ctx.strokeStyle = PAL.cot; ctx.lineWidth = 3 * dpr;
          ctx.beginPath(); ctx.moveTo(cx, cy - r); ctx.lineTo(tipX, cy - r); ctx.stroke();
          ctx.strokeStyle = PAL.radius;
          ctx.setLineDash([2*dpr, 4*dpr]); ctx.lineWidth = 1 * dpr;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tipX, cy - r); ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // origin point
      ctx.fillStyle = '#2b2118';
      ctx.beginPath(); ctx.arc(cx, cy, 3 * dpr, 0, TAU); ctx.fill();
      ctx.fillStyle = PAL.axisLab;
      ctx.font = `${13*dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText('O', cx - 5*dpr, cy + 4*dpr);

      // moving point P — big orange handle
      ctx.fillStyle = PAL.handle;
      ctx.globalAlpha = 0.22;
      ctx.beginPath(); ctx.arc(P.x, P.y, 12 * dpr, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(P.x, P.y, 7 * dpr, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 2 * dpr; ctx.stroke();
      ctx.fillStyle = '#2b2118';
      ctx.font = `bold ${14*dpr}px Inter, sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('P', P.x + 11*dpr, P.y - 11*dpr);
    }

    _drawInscribedShapes(cx, cy, r) {
      const ctx = this.ctx, dpr = this._dpr || 1;
      ctx.lineWidth = 1.2 * dpr;
      // helper: connect angles
      const drawPoly = (degs, color, dashed) => {
        ctx.strokeStyle = color;
        if (dashed) ctx.setLineDash([5*dpr, 4*dpr]); else ctx.setLineDash([]);
        ctx.beginPath();
        degs.forEach((d, i) => {
          const a = d * Math.PI / 180;
          const x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath(); ctx.stroke();
        ctx.setLineDash([]);
      };
      // square — 45° rotated (vertices at 45°, 135°, 225°, 315°)
      drawPoly([45, 135, 225, 315], PAL.refSquare, false);
      // octagon-ish — 30° step pattern from screenshot? we'll connect 30/60/120/150/210/240/300/330
      drawPoly([30, 60, 120, 150, 210, 240, 300, 330], PAL.refOct, false);
      // equilateral triangle pair
      drawPoly([90, 210, 330], PAL.refTri, true);
      drawPoly([270, 30, 150], PAL.refTri, true);
    }

    _drawGraphs(L) {
      const ctx = this.ctx, dpr = this._dpr || 1;
      const G = L.graph;
      const theta = this.opts.theta;
      const mid = (G.y0 + G.y1) / 2;
      const half = (G.y1 - G.y0) / 2 - 14 * dpr;

      // frame
      ctx.strokeStyle = PAL.gridMajor; ctx.lineWidth = 1 * dpr;
      ctx.strokeRect(G.x0, G.y0, G.x1 - G.x0, G.y1 - G.y0);
      // horizontal mid axis
      ctx.strokeStyle = PAL.axis; ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath(); ctx.moveTo(G.x0, mid); ctx.lineTo(G.x1, mid); ctx.stroke();
      // gridlines at sin/cos values ±½, ±√2/2, ±√3/2, ±1
      ctx.strokeStyle = PAL.gridMinor; ctx.lineWidth = 1 * dpr;
      ctx.fillStyle = PAL.axisLab;
      ctx.font = `${13*dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const vals = [
        { v: 0.5, lab: '½' },
        { v: Math.SQRT2/2, lab: '√2/2' },
        { v: Math.sqrt(3)/2, lab: '√3/2' },
        { v: 1, lab: '1' },
      ];
      for (const t of vals) {
        for (const s of [-1, 1]) {
          const y = mid - s * t.v * half;
          ctx.beginPath(); ctx.moveTo(G.x0, y); ctx.lineTo(G.x1, y); ctx.stroke();
          ctx.fillStyle = PAL.axisLab;
          ctx.fillText(s < 0 ? '−' + t.lab : t.lab, G.x0 - 6 * dpr, y);
        }
      }
      // vertical gridlines + π-fraction labels along x
      ctx.font = `${10*dpr}px JetBrains Mono, monospace`;
      const labels = [
        { t: 0, lab: '0' },
        { t: 1/12, lab: 'π/6' },
        { t: 1/8, lab: 'π/4' },
        { t: 1/6, lab: 'π/3' },
        { t: 1/4, lab: 'π/2' },
        { t: 1/3, lab: '2π/3' },
        { t: 3/8, lab: '3π/4' },
        { t: 5/12, lab: '5π/6' },
        { t: 1/2, lab: 'π' },
        { t: 7/12, lab: '7π/6' },
        { t: 5/8, lab: '5π/4' },
        { t: 2/3, lab: '4π/3' },
        { t: 3/4, lab: '3π/2' },
        { t: 5/6, lab: '5π/3' },
        { t: 7/8, lab: '7π/4' },
        { t: 11/12, lab: '11π/6' },
        { t: 1, lab: '2π' },
      ];
      ctx.strokeStyle = PAL.gridMinor;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (const l of labels) {
        const x = G.x0 + l.t * (G.x1 - G.x0);
        ctx.beginPath(); ctx.moveTo(x, G.y0); ctx.lineTo(x, G.y1); ctx.stroke();
        ctx.fillStyle = PAL.rad;
        ctx.fillText(l.lab, x, G.y1 + 4 * dpr);
      }

      // sin curve
      const partial = this.opts.partialCurves;
      const curMax = partial ? theta : TAU;
      if (this.opts.showSin) {
        ctx.strokeStyle = PAL.sin; ctx.lineWidth = 2.6 * dpr; ctx.beginPath();
        const N = 200;
        for (let i = 0; i <= N; i++) {
          const tt = i / N * curMax;
          const x = G.x0 + (tt / TAU) * (G.x1 - G.x0);
          const y = mid - Math.sin(tt) * half;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      if (this.opts.showCos) {
        ctx.strokeStyle = PAL.cos; ctx.lineWidth = 2.6 * dpr; ctx.beginPath();
        const N = 200;
        for (let i = 0; i <= N; i++) {
          const tt = i / N * curMax;
          const x = G.x0 + (tt / TAU) * (G.x1 - G.x0);
          const y = mid - Math.cos(tt) * half;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // current theta marker — vertical line
      const xT = G.x0 + (theta / TAU) * (G.x1 - G.x0);
      ctx.strokeStyle = PAL.handle;
      ctx.setLineDash([4*dpr, 4*dpr]); ctx.lineWidth = 1.4 * dpr;
      ctx.beginPath(); ctx.moveTo(xT, G.y0); ctx.lineTo(xT, G.y1); ctx.stroke();
      ctx.setLineDash([]);

      // sync ribbons: a horizontal red dashed line from sin(θ) on circle to sin curve dot
      if (this.opts.showSin) {
        const P = this._circlePt(theta);
        const ySin = mid - Math.sin(theta) * half;
        ctx.strokeStyle = PAL.sin;
        ctx.setLineDash([3*dpr, 4*dpr]); ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(xT, ySin); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = PAL.sin;
        ctx.beginPath(); ctx.arc(xT, ySin, 5 * dpr, 0, TAU); ctx.fill();
      }
      if (this.opts.showCos) {
        const L = this._layout();
        const Lc = L.circle;
        const foot = { x: Lc.cx + Lc.r * Math.cos(theta), y: Lc.cy };
        const yCos = mid - Math.cos(theta) * half;
        ctx.strokeStyle = PAL.cos;
        ctx.setLineDash([3*dpr, 4*dpr]); ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath(); ctx.moveTo(foot.x, foot.y); ctx.lineTo(xT, yCos); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = PAL.cos;
        ctx.beginPath(); ctx.arc(xT, yCos, 5 * dpr, 0, TAU); ctx.fill();
      }
    }

    _renderHud() {
      const t = this.opts.theta;
      const sn = Math.sin(t), cs = Math.cos(t);
      const deg = (t * 180 / Math.PI);
      const lines = [];
      lines.push(`<div class="calc-line key"><span>θ</span> = ${fmt(deg, 1)}°  &nbsp; (${fmt(t, 3)} рад)</div>`);
      lines.push(`<div class="calc-line"><span>sin θ</span> = ${exactLabel(sn)} <small>(${fmt(sn, 3)})</small></div>`);
      lines.push(`<div class="calc-line"><span>cos θ</span> = ${exactLabel(cs)} <small>(${fmt(cs, 3)})</small></div>`);
      if (Math.abs(cs) > 0.01)  lines.push(`<div class="calc-line"><span>tg θ</span> = <small>${fmt(sn / cs, 3)}</small></div>`);
      else                      lines.push(`<div class="calc-line"><span>tg θ</span> = ∞</div>`);
      if (Math.abs(sn) > 0.01)  lines.push(`<div class="calc-line"><span>ctg θ</span> = <small>${fmt(cs / sn, 3)}</small></div>`);
      else                      lines.push(`<div class="calc-line"><span>ctg θ</span> = ∞</div>`);
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

  window.TrigCircle = TrigCircle;
})();

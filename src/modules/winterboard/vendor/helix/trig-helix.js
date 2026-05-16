// trig-helix.js — 3D helix view of (θ, sin θ, cos θ).
// Shows sin and cos as orthogonal projections of a single 3D helix curve,
// together with the unit circle as the projection along the θ-axis.
// Camera rotates: phi=0 → view from θ-end (unit circle); phi=90° → side
// view (sin wave); pitch≈90° from there → top-down (cos wave).
(function () {
  const TAU = Math.PI * 2;

  const PAL = {
    bg:           '#fffaf0',
    ink:          '#2b2118',
    axis:         '#2b2118',
    axisLab:      '#5a4a3a',
    wall:         'rgba(43,33,24,0.045)',
    wallEdge:     'rgba(43,33,24,0.22)',
    gridMinor:    'rgba(43,33,24,0.08)',
    gridMajor:    'rgba(43,33,24,0.18)',
    helix:        '#c4622a',
    helixBack:    'rgba(196,98,42,0.30)',
    sin:          '#a83a5b',
    sinDim:       'rgba(168,58,91,0.55)',
    cos:          '#3b7b9b',
    cosDim:       'rgba(59,123,155,0.55)',
    circle:       '#2b2118',
    circleDim:    'rgba(43,33,24,0.45)',
    point:        '#c4622a',
    drop:         'rgba(43,33,24,0.40)',
    shadowPt:     'rgba(43,33,24,0.6)',
  };

  const fmt = (n, d = 3) => {
    if (!Number.isFinite(n)) return '—';
    const k = Math.pow(10, d);
    const r = Math.round(n * k) / k;
    return (Math.abs(r) < 1e-9 ? 0 : r).toString().replace('.', ',');
  };

  function exactLabel(value) {
    const T = 0.005;
    if (Math.abs(value) < T) return '0';
    if (Math.abs(Math.abs(value) - 1) < T) return value > 0 ? '1' : '−1';
    if (Math.abs(Math.abs(value) - 0.5) < T) return (value > 0 ? '' : '−') + '½';
    if (Math.abs(Math.abs(value) - Math.SQRT2/2) < T) return (value > 0 ? '' : '−') + '√2/2';
    if (Math.abs(Math.abs(value) - Math.sqrt(3)/2) < T) return (value > 0 ? '' : '−') + '√3/2';
    return value.toFixed(2).replace('.', ',');
  }

  // θ-axis tick labels for one full cycle
  const TICKS = [
    { t: 0,        lab: '0' },
    { t: Math.PI/2,  lab: 'π/2' },
    { t: Math.PI,    lab: 'π' },
    { t: 3*Math.PI/2,lab: '3π/2' },
    { t: TAU,        lab: '2π' },
  ];

  class HelixView {
    constructor(container, opts = {}) {
      this.container = container;
      this.opts = Object.assign({
        theta:        Math.PI / 3,
        phi:          50,   // yaw (deg) — 0 = end-on (unit circle), 90 = side (sin wave)
        pitch:        18,   // tilt (deg) — small downward tilt for 3D look
        showHelix:    true,
        showSin:      true, // projection onto back wall
        showCos:      true, // projection onto floor
        showCircle:   true, // projection on end-cap (unit circle)
        showWalls:    true, // faint reference walls
        showDropLines:true, // dashed lines from P to each projection
        showAxisLabels:true,
        showPointTrail:false,
        animate:      false,
        animateCamera:false,
        speed:        0.6,
        camSpeed:     12,   // deg / sec for camera orbit
        // ===== emit mode =====
        // false: static helix θ∈[0,2π], point P scrubs along it
        // true:  P stays on the unit circle at u=0 and rotates; the helix is
        //        the wave's HISTORY, parametrized as (u, sin(θ−u), cos(θ−u)).
        //        As θ advances, the whole wave streams toward u=0 (into P).
        emitMode:     false,
      }, opts);
      this._build();
      this._bindInteraction();
      this._timers = [0, 50, 200, 500].map((ms) => setTimeout(() => this._render(), ms));
      this._tickAnim = this._tickAnim.bind(this);
    }

    setOption(k, v) {
      this.opts[k] = v;
      if (k === 'emitMode' && v) {
        // make sense: emit mode does nothing without θ advancing
        if (!this.opts.animate) {
          this.opts.animate = true;
          this._animLast = performance.now();
          requestAnimationFrame(this._tickAnim);
        }
      }
      if ((k === 'animate' || k === 'animateCamera') && v) {
        this._animLast = performance.now();
        requestAnimationFrame(this._tickAnim);
      }
      this._render();
      if (this.onChange) this.onChange();
    }
    setTheta(t) { this.opts.theta = t; this._render(); if (this.onChange) this.onChange(); }
    setView(name) {
      const presets = {
        '3d':      { phi: 50,  pitch: 18 },
        // sin view: see (U, V) plane — look along W axis (cos axis goes into screen)
        'sin':     { phi: 0,   pitch: 0  },
        // cos view: see (U, W) plane — look along V axis (sin goes into screen)
        'cos':     { phi: 0,   pitch: 90 },
        // unit circle view: see (V, W) plane — look along U axis (θ goes into screen)
        'circle':  { phi: 90,  pitch: 0  },
        'iso':     { phi: 38,  pitch: 26 },
      };
      const p = presets[name];
      if (!p) return;
      this._animateTo(p.phi, p.pitch, 600);
    }

    _animateTo(toPhi, toPitch, ms) {
      const fromPhi = this.opts.phi, fromPitch = this.opts.pitch;
      const t0 = performance.now();
      const step = (now) => {
        if (this._destroyed) return;
        const k = Math.min(1, (now - t0) / ms);
        const e = k < 0.5 ? 2*k*k : 1 - Math.pow(-2*k+2, 2)/2;
        this.opts.phi   = fromPhi   + (toPhi   - fromPhi)   * e;
        this.opts.pitch = fromPitch + (toPitch - fromPitch) * e;
        this._render();
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    _tickAnim(now) {
      if ((!this.opts.animate && !this.opts.animateCamera) || this._destroyed) return;
      const dt = (now - (this._animLast || now)) / 1000;
      this._animLast = now;
      if (this.opts.animate) {
        this.opts.theta += dt * (this.opts.speed || 0.6);
        if (this.opts.theta > TAU) this.opts.theta -= TAU;
      }
      if (this.opts.animateCamera) {
        this.opts.phi += dt * (this.opts.camSpeed || 12);
        if (this.opts.phi > 90) this.opts.phi = 0;
      }
      this._render();
      if (this.onChange) this.onChange();
      requestAnimationFrame(this._tickAnim);
    }

    _build() {
      const c = this.container;
      c.classList.add('helix-root');
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

    // ===== world bounds =====
    // U axis along θ direction (length = TAU world units)
    // V axis along sin direction (range -1..1)
    // W axis along cos direction (range -1..1)
    // Helix point: u = θ (in world units), v = sin θ, w = cos θ
    // Squash V/W to make the visualization wider (helix not too "tight")
    _W() {
      // world span
      return { uMin: 0, uMax: TAU, rad: 1 }; // radius for circle proj
    }

    // ===== wave-mode helpers =====
    // Helix point at parameter u (in world units along θ-axis)
    _hv(u) { return this.opts.emitMode ? Math.sin(this.opts.theta - u) : Math.sin(u); }
    _hw(u) { return this.opts.emitMode ? Math.cos(this.opts.theta - u) : Math.cos(u); }
    // 3D position of point P
    _Ppos() {
      const t = this.opts.theta;
      if (this.opts.emitMode) return { u: 0, v: Math.sin(t), w: Math.cos(t) };
      return { u: t, v: Math.sin(t), w: Math.cos(t) };
    }
    // u where the "current" dot on each wave sits
    _waveDotU() { return this.opts.emitMode ? 0 : this.opts.theta; }
    // u of the unit-circle plane
    _circleU() {
      if (this.opts.emitMode) return 0;
      return this._back ? this._back.u : 0;
    }

    // ===== camera projection =====
    _project(u, v, w) {
      const phi = this.opts.phi * Math.PI / 180;
      const pit = this.opts.pitch * Math.PI / 180;
      const cp = Math.cos(phi), sp = Math.sin(phi);
      const ct = Math.cos(pit), st = Math.sin(pit);
      // 1) yaw around V-axis: rotates U into W
      let u1 = u * cp - w * sp;
      let w1 = u * sp + w * cp;
      let v1 = v;
      // 2) pitch around new U-axis: rotates V into W
      let v2 = v1 * ct - w1 * st;
      let w2 = v1 * st + w1 * ct;
      // Orthographic: x screen = u1, y screen = -v2; depth = w2
      return { sx: u1, sy: -v2, depth: w2 };
    }

    // Auto-fit: project the 8 corners of the bounding box, scale to fit canvas
    _layout() {
      if (this._cachedLayout && this._cachedLayoutKey === this._layoutKey()) return this._cachedLayout;
      const w = this.canvas.width, h = this.canvas.height;
      const dpr = this._dpr || 1;
      const pad = 56 * dpr;
      const W = this._W();
      const corners = [];
      for (const u of [W.uMin, W.uMax]) for (const v of [-1, 1]) for (const wc of [-1, 1]) {
        corners.push(this._project(u, v, wc));
      }
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const c of corners) {
        if (c.sx < minX) minX = c.sx;
        if (c.sx > maxX) maxX = c.sx;
        if (c.sy < minY) minY = c.sy;
        if (c.sy > maxY) maxY = c.sy;
      }
      const boxW = Math.max(0.0001, maxX - minX);
      const boxH = Math.max(0.0001, maxY - minY);
      const scale = Math.min((w - 2*pad) / boxW, (h - 2*pad) / boxH);
      const cx = w / 2, cy = h / 2;
      const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
      const out = { scale, cx, cy, midX, midY };
      this._cachedLayout = out;
      this._cachedLayoutKey = this._layoutKey();
      return out;
    }
    _layoutKey() {
      return `${this.canvas.width}x${this.canvas.height}|${this.opts.phi.toFixed(2)}|${this.opts.pitch.toFixed(2)}`;
    }

    _xy(u, v, w) {
      const p = this._project(u, v, w);
      const L = this._layout();
      return { x: L.cx + (p.sx - L.midX) * L.scale, y: L.cy + (p.sy - L.midY) * L.scale, depth: p.depth };
    }

    // ===== interaction =====
    _bindInteraction() {
      let mode = null; // 'cam' or 'theta'
      let lastX = 0, lastY = 0, downX = 0, downY = 0;
      const setThetaFromClick = (clientX, clientY) => {
        // Find theta whose helix point is closest to the click (in screen space)
        const r = this.canvas.getBoundingClientRect();
        const dpr = this._dpr || 1;
        const px = (clientX - r.left) * dpr;
        const py = (clientY - r.top) * dpr;
        let best = this.opts.theta, bd = Infinity;
        const N = 240;
        for (let i = 0; i <= N; i++) {
          const t = i / N * TAU;
          const p = this._xy(t, Math.sin(t), Math.cos(t));
          const d = (p.x - px)*(p.x - px) + (p.y - py)*(p.y - py);
          if (d < bd) { bd = d; best = t; }
        }
        this.opts.theta = best;
        this._render();
        if (this.onChange) this.onChange();
      };
      this.canvas.addEventListener('pointerdown', (e) => {
        try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
        downX = e.clientX; downY = e.clientY;
        lastX = e.clientX; lastY = e.clientY;
        mode = e.shiftKey ? 'theta' : 'cam';
        if (mode === 'cam') {
          this.canvas.style.cursor = 'grabbing';
          this._wasCamAnim = this.opts.animateCamera;
          this.opts.animateCamera = false;
        }
      });
      this.canvas.addEventListener('pointermove', (e) => {
        if (mode === null) return;
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        if (mode === 'cam') {
          this.opts.phi   = Math.max(-180, Math.min(180, this.opts.phi   + dx * 0.5));
          this.opts.pitch = Math.max(-90,  Math.min(90,  this.opts.pitch + dy * 0.4));
          this._render();
        }
      });
      const up = (e) => {
        if (mode === null) return;
        const mx = e.clientX - downX, my = e.clientY - downY;
        const moved = (mx*mx + my*my) > 16;
        if (mode === 'cam' && !moved && !this.opts.emitMode) {
          setThetaFromClick(e.clientX, e.clientY);
        }
        mode = null;
        this.canvas.style.cursor = 'grab';
        try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        if (this._wasCamAnim) {
          this._wasCamAnim = false;
          this.opts.animateCamera = true;
          this._animLast = performance.now();
          requestAnimationFrame(this._tickAnim);
        }
      };
      this.canvas.addEventListener('pointerup', up);
      this.canvas.addEventListener('pointercancel', up);
    }

    // ===== render =====
    _render() {
      this._resize();
      // invalidate cached layout since pitch/phi may have changed
      this._cachedLayout = null;
      const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
      ctx.fillStyle = PAL.bg;
      ctx.fillRect(0, 0, w, h);

      // Decide which walls are "back" — we want sin proj on back wall (w = +1 OR -1
      // whichever is farther). The back is wherever w_screen-depth is largest.
      // Project the wall centers to choose.
      const backW = this._project(Math.PI, 0,  1).depth >
                    this._project(Math.PI, 0, -1).depth ? 1 : -1;
      const backV = this._project(Math.PI,  1, 0).depth >
                    this._project(Math.PI, -1, 0).depth ? 1 : -1;
      const backU = this._project(TAU, 0, 0).depth > this._project(0, 0, 0).depth ? TAU : 0;
      this._back = { w: backW, v: backV, u: backU };

      if (this.opts.showWalls) this._drawWalls();
      if (this.opts.showAxisLabels) this._drawAxisTicks();
      // projections drawn on walls (so they sit under helix when helix is in front)
      if (this.opts.showSin) this._drawSinProjection();
      if (this.opts.showCos) this._drawCosProjection();
      if (this.opts.showCircle) this._drawCircleProjection();
      this._drawHelix();
      if (this.opts.showDropLines) this._drawDropLines();
      this._drawPoint();
      this._renderHud();
    }

    _drawWalls() {
      const ctx = this.ctx, dpr = this._dpr || 1;
      const { w: backW, v: backV, u: backU } = this._back;
      // Back wall (V-U plane, at w = backW): rectangle through corners
      const wall = (corners, fill, edge) => {
        ctx.beginPath();
        corners.forEach((c, i) => { const p = this._xy(c[0], c[1], c[2]); i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y); });
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();
      };
      // back wall (sin plane): u∈[0,TAU], v∈[-1,1], w=backW
      wall([[0,-1,backW],[TAU,-1,backW],[TAU,1,backW],[0,1,backW]], PAL.wall, PAL.wallEdge);
      // floor (cos plane): u∈[0,TAU], w∈[-1,1], v=backV
      wall([[0,backV,-1],[TAU,backV,-1],[TAU,backV,1],[0,backV,1]], PAL.wall, PAL.wallEdge);
      // end cap (circle plane): v∈[-1,1], w∈[-1,1], u=backU
      wall([[backU,-1,-1],[backU,1,-1],[backU,1,1],[backU,-1,1]], PAL.wall, PAL.wallEdge);

      // Grid on back wall: vertical lines at each θ-tick, horizontal at sin gridlines
      ctx.strokeStyle = PAL.gridMinor;
      ctx.lineWidth = 1 * dpr;
      for (const tk of TICKS) {
        const p0 = this._xy(tk.t, -1, backW), p1 = this._xy(tk.t, 1, backW);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
      for (const vv of [-1, -0.5, 0, 0.5, 1]) {
        const p0 = this._xy(0, vv, backW), p1 = this._xy(TAU, vv, backW);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
        ctx.strokeStyle = (Math.abs(vv) < 0.01) ? PAL.gridMajor : PAL.gridMinor;
        ctx.stroke();
      }
      // Grid on floor (cos plane)
      for (const tk of TICKS) {
        const p0 = this._xy(tk.t, backV, -1), p1 = this._xy(tk.t, backV, 1);
        ctx.strokeStyle = PAL.gridMinor;
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
      for (const ww of [-1, -0.5, 0, 0.5, 1]) {
        const p0 = this._xy(0, backV, ww), p1 = this._xy(TAU, backV, ww);
        ctx.strokeStyle = (Math.abs(ww) < 0.01) ? PAL.gridMajor : PAL.gridMinor;
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      }
      // Cross on end-cap (unit circle plane): axes + concentric guide
      const eu = backU;
      ctx.strokeStyle = PAL.gridMajor; ctx.lineWidth = 1.2 * dpr;
      let p0 = this._xy(eu, 0, -1), p1 = this._xy(eu, 0, 1);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      p0 = this._xy(eu, -1, 0); p1 = this._xy(eu, 1, 0);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();

      // 3D-axis arrows: drawn from origin (0, backV, backW)
      // U-axis (θ): along +U
      this._drawArrow3D([0, backV, backW], [TAU * 1.05, backV, backW], PAL.axis, 'θ');
      // V-axis (sin): along +V, at u=backU corner
      this._drawArrow3D([backU, backV, backW], [backU, 1.1, backW], PAL.sin, 'sin θ');
      // W-axis (cos): along +W, at u=backU corner
      this._drawArrow3D([backU, backV, backW], [backU, backV, -backW * 1.1 * Math.sign(backW || 1)], PAL.cos, 'cos θ');
    }

    _drawArrow3D(a, b, color, label) {
      const ctx = this.ctx, dpr = this._dpr || 1;
      const A = this._xy(a[0], a[1], a[2]);
      const B = this._xy(b[0], b[1], b[2]);
      ctx.strokeStyle = color; ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
      // arrowhead
      const dx = B.x - A.x, dy = B.y - A.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const ah = 8 * dpr;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(B.x, B.y);
      ctx.lineTo(B.x - ux*ah - uy*ah*0.5, B.y - uy*ah + ux*ah*0.5);
      ctx.lineTo(B.x - ux*ah + uy*ah*0.5, B.y - uy*ah - ux*ah*0.5);
      ctx.closePath(); ctx.fill();
      // label
      ctx.fillStyle = color;
      ctx.font = `600 ${12*dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(label, B.x + ux*8*dpr + 4*dpr, B.y + uy*8*dpr);
    }

    _drawAxisTicks() {
      const ctx = this.ctx, dpr = this._dpr || 1;
      const { v: backV, w: backW } = this._back;
      // θ-axis ticks along the origin axis (v=backV, w=backW)
      ctx.fillStyle = PAL.axisLab;
      ctx.font = `${11*dpr}px JetBrains Mono, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (const tk of TICKS) {
        const p = this._xy(tk.t, backV, backW);
        ctx.fillStyle = PAL.axisLab;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5*dpr, 0, TAU); ctx.fill();
        ctx.fillText(tk.lab, p.x, p.y + 6*dpr);
      }
    }

    // Sine wave projected onto back wall (w = backW)
    _drawSinProjection() {
      const ctx = this.ctx, dpr = this._dpr || 1;
      const backW = this._back.w;
      const N = 220;
      const emit = this.opts.emitMode;
      ctx.strokeStyle = PAL.sin; ctx.lineWidth = 2.6 * dpr;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const u = i/N * TAU;
        const p = this._xy(u, this._hv(u), backW);
        if (emit) {
          // fade older part of wave to imply motion
          ctx.stroke();
          ctx.strokeStyle = `rgba(168,58,91,${(1 - u/TAU * 0.75).toFixed(3)})`;
          ctx.beginPath();
          if (i > 0) {
            const prev = this._xy((i-1)/N * TAU, this._hv((i-1)/N * TAU), backW);
            ctx.moveTo(prev.x, prev.y);
          } else {
            ctx.moveTo(p.x, p.y);
          }
          ctx.lineTo(p.x, p.y);
        } else {
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
      }
      ctx.stroke();
      // current point
      const u0 = this._waveDotU();
      const p = this._xy(u0, this._hv(u0), backW);
      ctx.fillStyle = PAL.sin;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5*dpr, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2*dpr, 0, TAU); ctx.fill();
    }

    // Cosine wave projected onto floor (v = backV)
    _drawCosProjection() {
      const ctx = this.ctx, dpr = this._dpr || 1;
      const backV = this._back.v;
      const N = 220;
      const emit = this.opts.emitMode;
      if (!emit) {
        ctx.strokeStyle = PAL.cos; ctx.lineWidth = 2.6 * dpr;
        ctx.beginPath();
        for (let i = 0; i <= N; i++) {
          const u = i/N * TAU;
          const p = this._xy(u, backV, this._hw(u));
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      } else {
        ctx.lineWidth = 2.6 * dpr;
        let prev = this._xy(0, backV, this._hw(0));
        for (let i = 1; i <= N; i++) {
          const u = i/N * TAU;
          const p = this._xy(u, backV, this._hw(u));
          ctx.strokeStyle = `rgba(59,123,155,${(1 - u/TAU * 0.75).toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
          prev = p;
        }
      }
      const u0 = this._waveDotU();
      const p = this._xy(u0, backV, this._hw(u0));
      ctx.fillStyle = PAL.cos;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5*dpr, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2*dpr, 0, TAU); ctx.fill();
    }

    // Unit circle on end cap (u = backU, OR u=0 in emit mode)
    _drawCircleProjection() {
      const ctx = this.ctx, dpr = this._dpr || 1;
      const u0 = this._circleU();
      const N = 160;
      ctx.strokeStyle = PAL.circle; ctx.lineWidth = 2 * dpr;
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const t = i/N * TAU;
        const p = this._xy(u0, Math.sin(t), Math.cos(t));
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      // mark current P projection on the circle
      const t = this.opts.theta;
      const p = this._xy(u0, Math.sin(t), Math.cos(t));
      ctx.fillStyle = PAL.circle;
      ctx.beginPath(); ctx.arc(p.x, p.y, 5*dpr, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fffaf0';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2*dpr, 0, TAU); ctx.fill();
      // radius from origin to point (on circle plane)
      const origin = this._xy(u0, 0, 0);
      ctx.strokeStyle = PAL.point;
      ctx.setLineDash([4*dpr, 4*dpr]); ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      ctx.setLineDash([]);
    }

    // The helix itself: (u, sin u, cos u) or in emit mode (u, sin(θ−u), cos(θ−u))
    _drawHelix() {
      if (!this.opts.showHelix) return;
      const ctx = this.ctx, dpr = this._dpr || 1;
      const N = 280;
      const emit = this.opts.emitMode;
      const pts = [];
      for (let i = 0; i <= N; i++) {
        const u = i/N * TAU;
        const p = this._xy(u, this._hv(u), this._hw(u));
        pts.push({ p, u });
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      if (!emit) {
        // Back pass (depth < 0)
        ctx.strokeStyle = PAL.helixBack;
        ctx.lineWidth = 2.0 * dpr;
        ctx.beginPath();
        let moving = true;
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i].p, b = pts[i+1].p;
          const mid = (a.depth + b.depth) / 2;
          if (mid < 0) {
            if (moving) { ctx.moveTo(a.x, a.y); moving = false; }
            ctx.lineTo(b.x, b.y);
          } else { moving = true; }
        }
        ctx.stroke();
        // Front pass (depth >= 0)
        ctx.strokeStyle = PAL.helix;
        ctx.lineWidth = 3.0 * dpr;
        ctx.beginPath();
        moving = true;
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i].p, b = pts[i+1].p;
          const mid = (a.depth + b.depth) / 2;
          if (mid >= 0) {
            if (moving) { ctx.moveTo(a.x, a.y); moving = false; }
            ctx.lineTo(b.x, b.y);
          } else { moving = true; }
        }
        ctx.stroke();
      } else {
        // Emit mode: fade with u so the wave's TRAIL feels like history
        ctx.lineWidth = 3.0 * dpr;
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i].p, b = pts[i+1].p;
          const u = pts[i].u;
          const fadeFront = 1 - u / TAU * 0.85;
          const mid = (a.depth + b.depth) / 2;
          const depthFactor = mid >= 0 ? 1 : 0.5;
          const alpha = (fadeFront * depthFactor).toFixed(3);
          ctx.strokeStyle = `rgba(196,98,42,${alpha})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Dashed drop-lines from point P to each projection
    _drawDropLines() {
      const ctx = this.ctx, dpr = this._dpr || 1;
      const Pp = this._Ppos();
      const P = this._xy(Pp.u, Pp.v, Pp.w);
      const { w: backW, v: backV } = this._back;
      const cU = this._circleU();
      ctx.setLineDash([3*dpr, 4*dpr]);
      ctx.lineWidth = 1.2 * dpr;
      // to sin wall
      if (this.opts.showSin) {
        const s = this._xy(Pp.u, Pp.v, backW);
        ctx.strokeStyle = PAL.sinDim;
        ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(s.x, s.y); ctx.stroke();
      }
      // to cos floor
      if (this.opts.showCos) {
        const c = this._xy(Pp.u, backV, Pp.w);
        ctx.strokeStyle = PAL.cosDim;
        ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(c.x, c.y); ctx.stroke();
      }
      // to circle end (in emit mode P is ON the circle, so skip)
      if (this.opts.showCircle && !this.opts.emitMode) {
        const e = this._xy(cU, Pp.v, Pp.w);
        ctx.strokeStyle = PAL.circleDim;
        ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(e.x, e.y); ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    _drawPoint() {
      const ctx = this.ctx, dpr = this._dpr || 1;
      const Pp = this._Ppos();
      const P = this._xy(Pp.u, Pp.v, Pp.w);
      // halo
      ctx.fillStyle = PAL.point;
      ctx.globalAlpha = 0.22;
      ctx.beginPath(); ctx.arc(P.x, P.y, 13*dpr, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(P.x, P.y, 8*dpr, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 2.2*dpr; ctx.stroke();
      ctx.fillStyle = '#2b2118';
      ctx.font = `bold ${14*dpr}px Inter, sans-serif`;
      ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
      ctx.fillText('P', P.x + 11*dpr, P.y - 11*dpr);
    }

    _renderHud() {
      const t = this.opts.theta;
      const sn = Math.sin(t), cs = Math.cos(t);
      const deg = (t * 180 / Math.PI);
      const lines = [];
      lines.push(`<div class="calc-line key"><span>θ</span> = ${fmt(deg, 1)}°  &nbsp;(${fmt(t, 3)} рад)</div>`);
      lines.push(`<div class="calc-line"><span>sin θ</span> = ${exactLabel(sn)}</div>`);
      lines.push(`<div class="calc-line"><span>cos θ</span> = ${exactLabel(cs)}</div>`);
      lines.push(`<div class="calc-line"><small style="opacity:0.7">P = (θ, sin θ, cos θ)</small></div>`);
      lines.push(`<div class="calc-line"><small style="opacity:0.7">камера: φ ${fmt(this.opts.phi,0)}° · ${fmt(this.opts.pitch,0)}°</small></div>`);
      this.hud.innerHTML = lines.join('');
    }

    destroy() {
      this._destroyed = true;
      try { this._ro && this._ro.disconnect(); } catch (_) {}
      if (this._onWinResize) window.removeEventListener('resize', this._onWinResize);
      if (this._timers) this._timers.forEach(clearTimeout);
      this.container.innerHTML = '';
    }
  }

  window.HelixView = HelixView;
})();

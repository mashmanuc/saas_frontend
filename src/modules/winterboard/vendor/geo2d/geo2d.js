// geo2d.js — Dynamic 2D geometry engine (GeoGebra-style)
// Free + derived points · lines/segments/rays · circles · polygons · live measurements.
// Drag a free point → the whole dependency graph recomputes and re-renders.
(function () {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const TAU = Math.PI * 2;
  const EPS = 1e-9;

  // ===========================================================================
  // math helpers (math coords: y is "up" — caller of renderer flips for screen)
  // ===========================================================================
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
  const scl = (a, s) => ({ x: a.x * s, y: a.y * s });
  const len = (a) => Math.hypot(a.x, a.y);
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const cross = (a, b) => a.x * b.y - a.y * b.x;
  const norm = (a) => { const L = len(a); return L < EPS ? { x: 0, y: 0 } : { x: a.x / L, y: a.y / L }; };
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const perp = (a) => ({ x: -a.y, y: a.x });

  function lineLineIntersect(p1, d1, p2, d2) {
    const den = cross(d1, d2);
    if (Math.abs(den) < EPS) return null;
    const t = cross(sub(p2, p1), d2) / den;
    return { x: p1.x + d1.x * t, y: p1.y + d1.y * t };
  }
  function linesIntersect(A, B, C, D) {
    return lineLineIntersect(A, sub(B, A), C, sub(D, C));
  }
  function footOnLine(P, A, B) {
    const d = sub(B, A); const L2 = dot(d, d);
    if (L2 < EPS) return { x: A.x, y: A.y };
    const t = dot(sub(P, A), d) / L2;
    return { x: A.x + d.x * t, y: A.y + d.y * t };
  }
  function reflectAcrossLine(P, A, B) {
    const F = footOnLine(P, A, B);
    return { x: 2 * F.x - P.x, y: 2 * F.y - P.y };
  }
  function lineCircleIntersect(A, B, C, r) {
    const d = sub(B, A); const f = sub(A, C);
    const a = dot(d, d), bq = 2 * dot(f, d), c2 = dot(f, f) - r * r;
    let disc = bq * bq - 4 * a * c2;
    if (disc < 0) return [];
    disc = Math.sqrt(disc);
    const t1 = (-bq - disc) / (2 * a), t2 = (-bq + disc) / (2 * a);
    return [
      { x: A.x + d.x * t1, y: A.y + d.y * t1 },
      { x: A.x + d.x * t2, y: A.y + d.y * t2 },
    ];
  }
  function circleCircleIntersect(C1, r1, C2, r2) {
    const D = dist(C1, C2);
    if (D < EPS || D > r1 + r2 + EPS || D < Math.abs(r1 - r2) - EPS) return [];
    const a = (r1 * r1 - r2 * r2 + D * D) / (2 * D);
    const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    const ux = (C2.x - C1.x) / D, uy = (C2.y - C1.y) / D;
    const mx = C1.x + a * ux, my = C1.y + a * uy;
    return [
      { x: mx - h * uy, y: my + h * ux },
      { x: mx + h * uy, y: my - h * ux },
    ];
  }
  function centroidT(A, B, C) { return { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 }; }
  function circumcenterT(A, B, C) {
    const ax = A.x, ay = A.y, bx = B.x, by = B.y, cx = C.x, cy = C.y;
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < EPS) return centroidT(A, B, C);
    const aa = ax * ax + ay * ay, bb = bx * bx + by * by, cc = cx * cx + cy * cy;
    return {
      x: (aa * (by - cy) + bb * (cy - ay) + cc * (ay - by)) / d,
      y: (aa * (cx - bx) + bb * (ax - cx) + cc * (bx - ax)) / d,
    };
  }
  function incenterT(A, B, C) {
    const a = dist(B, C), b = dist(C, A), c = dist(A, B), s = a + b + c;
    if (s < EPS) return A;
    return { x: (a * A.x + b * B.x + c * C.x) / s, y: (a * A.y + b * B.y + c * C.y) / s };
  }
  function inradiusT(A, B, C) {
    const a = dist(B, C), b = dist(C, A), c = dist(A, B);
    const s = (a + b + c) / 2;
    const ar = Math.abs(polygonArea([A, B, C]));
    return s < EPS ? 0 : ar / s;
  }
  function orthocenterT(A, B, C) {
    const O = circumcenterT(A, B, C);
    return { x: A.x + B.x + C.x - 2 * O.x, y: A.y + B.y + C.y - 2 * O.y };
  }
  function polygonArea(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      s += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    return s / 2;
  }
  function angleBetween(A, B, C) {
    // angle at B in [0..π]
    const u = norm(sub(A, B)), v = norm(sub(C, B));
    return Math.acos(Math.max(-1, Math.min(1, dot(u, v))));
  }

  const fmt = (n, d = 2) => {
    if (!isFinite(n)) return '—';
    const k = Math.pow(10, d);
    const r = Math.round(n * k) / k;
    return (Math.abs(r) < 1e-9 ? 0 : r).toString().replace('.', ',');
  };

  // ===========================================================================
  // Object factories — every object is a plain record with: id, kind, deps,
  // compute(reg), and (for points) x/y. Drawables also carry a `draw(ctx)`.
  // ===========================================================================
  function pt(id, opts = {}) {
    return Object.assign({
      id, kind: 'point', deps: [], x: 0, y: 0, movable: false,
      label: null, style: 'free', size: 5,
    }, opts);
  }
  function curve(id, kind, opts = {}) {
    return Object.assign({
      id, kind, deps: [], style: 'solid', color: 'ink', width: 1.6,
      hidden: false, fill: null,
    }, opts);
  }

  const G = {};

  // ---- POINTS --------------------------------------------------------------
  G.free = (id, x, y, opts = {}) =>
    Object.assign(pt(id, { kind: 'free_point', movable: true, style: 'free', ...opts }), { x, y, setTo(mx, my) { this.x = mx; this.y = my; } });

  G.onLine = (id, a, b, t = 0.5, opts = {}) => ({
    ...pt(id, { kind: 'on_line', movable: true, style: 'free', ...opts }),
    deps: [a, b], a, b, t,
    compute(reg) {
      const A = reg.get(this.a), B = reg.get(this.b);
      this.x = A.x + (B.x - A.x) * this.t;
      this.y = A.y + (B.y - A.y) * this.t;
    },
    setTo(mx, my, reg) {
      const A = reg.get(this.a), B = reg.get(this.b);
      const d = sub(B, A); const L2 = dot(d, d);
      if (L2 < EPS) return;
      this.t = dot(sub({ x: mx, y: my }, A), d) / L2;
    },
  });

  G.onCircle = (id, cId, theta = 0, opts = {}) => ({
    ...pt(id, { kind: 'on_circle', movable: true, style: 'free', ...opts }),
    deps: [cId], c: cId, theta,
    compute(reg) {
      const C = reg.get(this.c);
      this.x = C.cx + C.r * Math.cos(this.theta);
      this.y = C.cy + C.r * Math.sin(this.theta);
    },
    setTo(mx, my, reg) {
      const C = reg.get(this.c);
      this.theta = Math.atan2(my - C.cy, mx - C.cx);
    },
  });

  G.onAxis = (id, x = 0, y = 0, axis = 'x', opts = {}) => ({
    ...pt(id, { kind: 'on_axis', movable: true, style: 'free', ...opts }),
    axis, x, y,
    setTo(mx, my) {
      if (this.axis === 'x') { this.x = mx; this.y = 0; }
      else { this.x = 0; this.y = my; }
    },
  });

  G.midpoint = (id, a, b, opts = {}) => ({
    ...pt(id, { kind: 'midpoint', style: 'derived', ...opts }),
    deps: [a, b], a, b,
    compute(reg) { const A = reg.get(this.a), B = reg.get(this.b); this.x = (A.x + B.x) / 2; this.y = (A.y + B.y) / 2; },
  });

  G.intersectLL = (id, l1, l2, opts = {}) => ({
    ...pt(id, { kind: 'intersect_ll', style: 'derived', ...opts }),
    deps: [l1, l2], l1, l2,
    compute(reg) {
      const a = reg.get(this.l1), b = reg.get(this.l2);
      const getEnds = (c) => {
        if (c.cache && c.cache.A && c.cache.B) return [c.cache.A, c.cache.B];
        if (c.kind === 'segment' || c.kind === 'line' || c.kind === 'ray') {
          return [reg.get(c.deps[0]), reg.get(c.deps[1])];
        }
        return null;
      };
      const ea = getEnds(a), eb = getEnds(b);
      if (!ea || !eb) return;
      const I = linesIntersect(ea[0], ea[1], eb[0], eb[1]);
      if (I) { this.x = I.x; this.y = I.y; }
    },
  });

  G.foot = (id, p, l, opts = {}) => ({
    ...pt(id, { kind: 'foot', style: 'derived', ...opts }),
    deps: [p, l], p, l,
    compute(reg) {
      const P = reg.get(this.p), L = reg.get(this.l);
      const A = reg.get(L.deps[0]), B = reg.get(L.deps[1]);
      const F = footOnLine(P, A, B);
      this.x = F.x; this.y = F.y;
    },
  });

  G.centroid = (id, a, b, c, opts = {}) => ({
    ...pt(id, { kind: 'centroid', style: 'derived', ...opts }),
    deps: [a, b, c], a, b, c,
    compute(reg) { const A = reg.get(this.a), B = reg.get(this.b), C = reg.get(this.c); const P = centroidT(A, B, C); this.x = P.x; this.y = P.y; },
  });
  G.circumcenter = (id, a, b, c, opts = {}) => ({
    ...pt(id, { kind: 'circumcenter', style: 'derived', ...opts }),
    deps: [a, b, c], a, b, c,
    compute(reg) { const P = circumcenterT(reg.get(this.a), reg.get(this.b), reg.get(this.c)); this.x = P.x; this.y = P.y; },
  });
  G.incenter = (id, a, b, c, opts = {}) => ({
    ...pt(id, { kind: 'incenter', style: 'derived', ...opts }),
    deps: [a, b, c], a, b, c,
    compute(reg) { const P = incenterT(reg.get(this.a), reg.get(this.b), reg.get(this.c)); this.x = P.x; this.y = P.y; },
  });
  G.orthocenter = (id, a, b, c, opts = {}) => ({
    ...pt(id, { kind: 'orthocenter', style: 'derived', ...opts }),
    deps: [a, b, c], a, b, c,
    compute(reg) { const P = orthocenterT(reg.get(this.a), reg.get(this.b), reg.get(this.c)); this.x = P.x; this.y = P.y; },
  });
  // generic derived point — formula `fn(reg) → {x, y}` runs each frame.
  G.derived = (id, depIds, fn, opts = {}) => ({
    ...pt(id, { kind: 'derived', style: 'derived', ...opts }),
    deps: depIds, fn,
    compute(reg) { const p = this.fn(reg); this.x = p.x; this.y = p.y; },
  });

  // ---- CURVES --------------------------------------------------------------
  G.segment = (id, a, b, opts = {}) => ({
    ...curve(id, 'segment', opts),
    deps: [a, b], a, b,
  });
  G.line = (id, a, b, opts = {}) => ({
    ...curve(id, 'line', opts),
    deps: [a, b], a, b,
  });
  G.ray = (id, a, b, opts = {}) => ({
    ...curve(id, 'ray', opts),
    deps: [a, b], a, b,
  });
  // perpendicular line: through P, perpendicular to segment/line ref
  G.perpLine = (id, p, refLine, opts = {}) => ({
    ...curve(id, 'line', { style: 'dashed-accent', ...opts }),
    deps: [p, refLine], p, refLine,
    compute(reg) {
      const P = reg.get(this.p), L = reg.get(this.refLine);
      const A = reg.get(L.deps[0]), B = reg.get(L.deps[1]);
      const d = sub(B, A); const n = perp(norm(d));
      // store endpoints in cache for drawing
      this.cache = { A: P, B: { x: P.x + n.x, y: P.y + n.y } };
    },
  });
  G.parLine = (id, p, refLine, opts = {}) => ({
    ...curve(id, 'line', { style: 'dashed', ...opts }),
    deps: [p, refLine], p, refLine,
    compute(reg) {
      const P = reg.get(this.p), L = reg.get(this.refLine);
      const A = reg.get(L.deps[0]), B = reg.get(L.deps[1]);
      const d = norm(sub(B, A));
      this.cache = { A: P, B: { x: P.x + d.x, y: P.y + d.y } };
    },
  });
  G.perpBisector = (id, a, b, opts = {}) => ({
    ...curve(id, 'line', { style: 'dashed-accent', ...opts }),
    deps: [a, b], a, b,
    compute(reg) {
      const A = reg.get(this.a), B = reg.get(this.b);
      const M = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
      const n = perp(norm(sub(B, A)));
      this.cache = { A: M, B: { x: M.x + n.x, y: M.y + n.y } };
    },
  });
  G.angleBisector = (id, a, b, c, opts = {}) => ({
    ...curve(id, 'ray', { style: 'dashed-accent', ...opts }),
    deps: [a, b, c], a, b, c,
    compute(reg) {
      const A = reg.get(this.a), B = reg.get(this.b), C = reg.get(this.c);
      const u = norm(sub(A, B)), v = norm(sub(C, B));
      const bis = norm(add(u, v));
      this.cache = { A: B, B: { x: B.x + bis.x, y: B.y + bis.y } };
    },
  });
  G.median = (id, vertex, opp1, opp2, opts = {}) => ({
    ...curve(id, 'segment', { style: 'dashed-accent', ...opts }),
    deps: [vertex, opp1, opp2], vertex, opp1, opp2,
    compute(reg) {
      const V = reg.get(this.vertex), A = reg.get(this.opp1), B = reg.get(this.opp2);
      this.cache = { A: V, B: { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 } };
    },
  });
  G.altitude = (id, vertex, oppA, oppB, opts = {}) => ({
    ...curve(id, 'segment', { style: 'dashed-accent', ...opts }),
    deps: [vertex, oppA, oppB], vertex, oppA, oppB,
    compute(reg) {
      const V = reg.get(this.vertex), A = reg.get(this.oppA), B = reg.get(this.oppB);
      const F = footOnLine(V, A, B);
      this.cache = { A: V, B: F };
    },
  });

  // Circle by center + point on circle
  G.circle = (id, center, ptOn, opts = {}) => ({
    ...curve(id, 'circle', opts),
    deps: [center, ptOn], center, ptOn,
    compute(reg) {
      const C = reg.get(this.center), P = reg.get(this.ptOn);
      this.cx = C.x; this.cy = C.y; this.r = dist(C, P);
    },
  });
  // Circle by center + numeric/dynamic radius (radius via a function on reg)
  G.circleR = (id, center, radiusFn, opts = {}) => ({
    ...curve(id, 'circle', opts),
    deps: [center], center, radiusFn,
    compute(reg) {
      const C = reg.get(this.center);
      this.cx = C.x; this.cy = C.y; this.r = this.radiusFn(reg);
    },
  });
  // Incircle of triangle
  G.incircle = (id, a, b, c, opts = {}) => ({
    ...curve(id, 'circle', opts),
    deps: [a, b, c], a, b, c,
    compute(reg) {
      const A = reg.get(this.a), B = reg.get(this.b), C = reg.get(this.c);
      const I = incenterT(A, B, C); this.cx = I.x; this.cy = I.y; this.r = inradiusT(A, B, C);
    },
  });
  // Circumcircle
  G.circumcircle = (id, a, b, c, opts = {}) => ({
    ...curve(id, 'circle', opts),
    deps: [a, b, c], a, b, c,
    compute(reg) {
      const A = reg.get(this.a), B = reg.get(this.b), C = reg.get(this.c);
      const O = circumcenterT(A, B, C); this.cx = O.x; this.cy = O.y; this.r = dist(O, A);
    },
  });

  G.polygon = (id, ids, opts = {}) => ({
    ...curve(id, 'polygon', { fill: opts.fill || 'face', ...opts }),
    deps: ids, pts: ids,
  });

  // ---- DECORATIONS ---------------------------------------------------------
  G.angleArc = (id, a, b, c, opts = {}) => ({
    ...curve(id, 'angle_arc', { style: 'angle', ...opts }),
    deps: [a, b, c], a, b, c, rPx: opts.rPx || 22, label: opts.label !== false,
  });
  G.rightAngle = (id, a, b, c, opts = {}) => ({
    ...curve(id, 'right_angle', { style: 'angle', ...opts }),
    deps: [a, b, c], a, b, c, sizePx: opts.sizePx || 14,
  });
  G.lengthLabel = (id, seg, opts = {}) => ({
    ...curve(id, 'length_label', opts),
    deps: [seg], seg, prefix: opts.prefix || '', suffix: opts.suffix || '',
  });
  G.areaLabel = (id, polyId, opts = {}) => ({
    ...curve(id, 'area_label', opts),
    deps: [polyId], poly: polyId, prefix: opts.prefix || 'S = ', suffix: opts.suffix || '',
  });
  G.formula = (id, fn, opts = {}) => ({
    ...curve(id, 'formula', opts),
    deps: opts.deps || [], fn, ax: opts.ax || 0, ay: opts.ay || 0, anchor: opts.anchor || 'tl',
    // i18n (2026-08-19): підказки всередині полотна писались літералом
    // українською і лишались українськими при ENG. Ключ опційний — без нього
    // поведінка та сама, що й була (fn() як єдине джерело тексту).
    i18nKey: opts.i18nKey || null,
  });
  G.distanceLine = (id, a, b, opts = {}) => ({
    ...curve(id, 'distance_line', { style: 'distance', ...opts }),
    deps: [a, b], a, b, prefix: opts.prefix || '',
  });

  // Mini-squares (for Pythagoras): square built outwards from segment a→b
  G.squareOut = (id, a, b, opts = {}) => ({
    ...curve(id, 'square_out', { fill: 'face', ...opts }),
    deps: [a, b], a, b,
    compute(reg) {
      const A = reg.get(this.a), B = reg.get(this.b);
      const d = sub(B, A); const n = { x: d.y, y: -d.x }; // rotate -90° → outward for CCW triangle
      this.pts = [A, B, { x: B.x + n.x, y: B.y + n.y }, { x: A.x + n.x, y: A.y + n.y }];
      this.area = dot(d, d);
    },
  });

  // ===========================================================================
  // Construction — owns objects, recomputes them in declaration order.
  // ===========================================================================
  class Construction {
    constructor() {
      this.objects = []; // ordered
      this.byId = new Map();
      this.tags = new Map(); // id -> Set<tag>
    }
    add(o, tags = []) {
      if (this.byId.has(o.id)) {
        // re-add overwrites for hot-toggle preset reconfigure
        const i = this.objects.findIndex((x) => x.id === o.id);
        if (i >= 0) this.objects.splice(i, 1);
      }
      this.objects.push(o);
      this.byId.set(o.id, o);
      this.tags.set(o.id, new Set(tags));
      return o;
    }
    remove(id) {
      const i = this.objects.findIndex((x) => x.id === id);
      if (i >= 0) this.objects.splice(i, 1);
      this.byId.delete(id);
      this.tags.delete(id);
    }
    removeByTag(tag) {
      [...this.objects].forEach((o) => {
        if (this.tags.get(o.id)?.has(tag)) this.remove(o.id);
      });
    }
    has(id) { return this.byId.has(id); }
    get(id) { return this.byId.get(id); }
    reg() { return this; }
    recompute() {
      // declaration order is sufficient since deps must be added first
      for (const o of this.objects) {
        if (typeof o.compute === 'function') o.compute(this);
      }
    }
  }

  // ===========================================================================
  // Renderer — one SVG per construction. math→screen, redraw, drag.
  // ===========================================================================
  const STYLE = {
    palette: {
      ink: '#2b2118', ink2: '#5a4a3a', ink3: '#8a7860',
      free: '#c4622a', derived: '#3b7b9b', angle: '#a83a5b',
      face: 'rgba(196,98,42,0.10)', cFill: 'rgba(59,123,155,0.07)',
      grid: 'rgba(43,33,24,0.07)', axis: 'rgba(43,33,24,0.22)',
      dist: '#8a7860', highlight: '#d4a052',
    },
  };

  class Renderer {
    constructor(container, construction, opts = {}) {
      this.container = container;
      this.con = construction;
      this.opts = Object.assign({
        showGrid: true, showAxes: false,
        viewMargin: 1.4, snap: 0, // grid snap math-units (0 = off)
      }, opts);
      this.elems = new Map(); // id → svg element(s)
      this.view = { cx: 0, cy: 0, scale: 40 }; // pixels per math unit
      this._buildSvg();
      this._bindDrag();
      this._fitToContent();
      this.render();
      this._ro = new ResizeObserver(() => { this._fitToContent(); this.render(); });
      this._ro.observe(this.container);
      // Defensive: if container had zero width at construction (e.g. created inside
      // a hidden overlay), re-fit once the next frame lands so lines extend properly.
      requestAnimationFrame(() => {
        const r = this.container.getBoundingClientRect();
        if ((r.width && r.width !== this.w) || (r.height && r.height !== this.h)) {
          this._fitToContent();
          this.render();
        }
      });
    }

    _buildSvg() {
      const c = this.container;
      c.style.position = c.style.position || 'relative';
      c.style.touchAction = 'none';
      c.style.userSelect = 'none';
      this.svg = document.createElementNS(SVG_NS, 'svg');
      this.svg.setAttribute('width', '100%');
      this.svg.setAttribute('height', '100%');
      this.svg.style.cssText = 'display:block;width:100%;height:100%;cursor:default;';
      c.appendChild(this.svg);
      // groups by zorder
      this.gBg = document.createElementNS(SVG_NS, 'g'); this.svg.appendChild(this.gBg);
      this.gFills = document.createElementNS(SVG_NS, 'g'); this.svg.appendChild(this.gFills);
      this.gCurves = document.createElementNS(SVG_NS, 'g'); this.svg.appendChild(this.gCurves);
      this.gAngles = document.createElementNS(SVG_NS, 'g'); this.svg.appendChild(this.gAngles);
      this.gPoints = document.createElementNS(SVG_NS, 'g'); this.svg.appendChild(this.gPoints);
      this.gLabels = document.createElementNS(SVG_NS, 'g'); this.svg.appendChild(this.gLabels);

      // Tooltip layer (HTML)
      this.tip = document.createElement('div');
      this.tip.style.cssText = 'position:absolute;pointer-events:none;opacity:0;transition:opacity 0.1s;background:#2b2118;color:#fffaf0;padding:3px 7px;border-radius:6px;font:11px/1.2 "JetBrains Mono",monospace;white-space:nowrap;z-index:2;transform:translate(-50%,calc(-100% - 8px));';
      c.appendChild(this.tip);
    }

    setOption(k, v) {
      this.opts[k] = v;
      if (k === 'showGrid' || k === 'showAxes') this._drawGrid();
    }

    _fitToContent() {
      const r = this.container.getBoundingClientRect();
      this.w = r.width || 320; this.h = r.height || 320;
      // compute math bounds from current free points
      const pts = this.con.objects.filter((o) => o.kind === 'point' || o.x !== undefined && o.y !== undefined && typeof o.compute !== 'function' ? true : (o.x !== undefined && o.y !== undefined && o.kind !== 'circle' && o.kind !== 'segment' && o.kind !== 'line'));
      const onlyPts = this.con.objects.filter((o) => typeof o.x === 'number' && typeof o.y === 'number' && o.kind.includes('point') === false ? true : o.x !== undefined);
      // safer: just iterate true point-like
      let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity, any = false;
      for (const o of this.con.objects) {
        if (typeof o.x === 'number' && typeof o.y === 'number' && o.kind !== 'segment' && o.kind !== 'line' && o.kind !== 'ray' && o.kind !== 'circle' && o.kind !== 'polygon' && !o.kind.endsWith('label') && o.kind !== 'angle_arc' && o.kind !== 'right_angle' && o.kind !== 'distance_line' && o.kind !== 'square_out' && o.kind !== 'formula') {
          xmin = Math.min(xmin, o.x); xmax = Math.max(xmax, o.x);
          ymin = Math.min(ymin, o.y); ymax = Math.max(ymax, o.y);
          any = true;
        }
        if (o.kind === 'circle') {
          xmin = Math.min(xmin, o.cx - o.r); xmax = Math.max(xmax, o.cx + o.r);
          ymin = Math.min(ymin, o.cy - o.r); ymax = Math.max(ymax, o.cy + o.r);
          any = true;
        }
        // Pythagoras: квадрати на сторонах (square_out) виходять за межі трикутника.
        // Без цих bounds viewport підраховувався тільки по вершинам трикутника →
        // квадрати малюються поза SVG → візуально вилазили. Включаємо 4 вершини
        // кожного square_out у розрахунок.
        if (o.kind === 'square_out' && Array.isArray(o.pts)) {
          for (const p of o.pts) {
            if (typeof p.x === 'number' && typeof p.y === 'number') {
              xmin = Math.min(xmin, p.x); xmax = Math.max(xmax, p.x);
              ymin = Math.min(ymin, p.y); ymax = Math.max(ymax, p.y);
              any = true;
            }
          }
        }
      }
      if (!any) { xmin = -5; xmax = 5; ymin = -5; ymax = 5; }
      const m = this.opts.viewMargin;
      const wM = (xmax - xmin) * m, hM = (ymax - ymin) * m;
      const padX = wM === 0 ? 4 : 0, padY = hM === 0 ? 4 : 0;
      const dx = wM + padX, dy = hM + padY;
      const sx = this.w / Math.max(dx, 1e-3);
      const sy = this.h / Math.max(dy, 1e-3);
      this.view.scale = Math.min(sx, sy);
      this.view.cx = (xmin + xmax) / 2;
      this.view.cy = (ymin + ymax) / 2;
    }

    m2s(p) { return { x: this.w / 2 + (p.x - this.view.cx) * this.view.scale, y: this.h / 2 - (p.y - this.view.cy) * this.view.scale }; }
    s2m(p) { return { x: this.view.cx + (p.x - this.w / 2) / this.view.scale, y: this.view.cy - (p.y - this.h / 2) / this.view.scale }; }

    _drawGrid() {
      this.gBg.innerHTML = '';
      if (!this.opts.showGrid && !this.opts.showAxes) return;
      const v = this.view;
      // step ~ between 40 and 80 px
      const target = 60;
      let step = Math.pow(10, Math.round(Math.log10(target / v.scale)));
      while (step * v.scale < 24) step *= 2;
      while (step * v.scale > 120) step /= 2;
      const halfW = this.w / 2 / v.scale, halfH = this.h / 2 / v.scale;
      const x0 = v.cx - halfW, x1 = v.cx + halfW;
      const y0 = v.cy - halfH, y1 = v.cy + halfH;
      if (this.opts.showGrid) {
        const startX = Math.ceil(x0 / step) * step, startY = Math.ceil(y0 / step) * step;
        for (let x = startX; x <= x1 + EPS; x += step) {
          const s = this.m2s({ x, y: 0 });
          const l = document.createElementNS(SVG_NS, 'line');
          l.setAttribute('x1', s.x); l.setAttribute('x2', s.x); l.setAttribute('y1', 0); l.setAttribute('y2', this.h);
          l.setAttribute('stroke', STYLE.palette.grid); l.setAttribute('stroke-width', 1);
          this.gBg.appendChild(l);
        }
        for (let y = startY; y <= y1 + EPS; y += step) {
          const s = this.m2s({ x: 0, y });
          const l = document.createElementNS(SVG_NS, 'line');
          l.setAttribute('y1', s.y); l.setAttribute('y2', s.y); l.setAttribute('x1', 0); l.setAttribute('x2', this.w);
          l.setAttribute('stroke', STYLE.palette.grid); l.setAttribute('stroke-width', 1);
          this.gBg.appendChild(l);
        }
      }
      if (this.opts.showAxes) {
        const o = this.m2s({ x: 0, y: 0 });
        for (const [x1v, y1v, x2v, y2v] of [[0, o.y, this.w, o.y], [o.x, 0, o.x, this.h]]) {
          const l = document.createElementNS(SVG_NS, 'line');
          l.setAttribute('x1', x1v); l.setAttribute('y1', y1v); l.setAttribute('x2', x2v); l.setAttribute('y2', y2v);
          l.setAttribute('stroke', STYLE.palette.axis); l.setAttribute('stroke-width', 1);
          this.gBg.appendChild(l);
        }
      }
    }

    // Extend a line to fill viewport (returns two screen points)
    _extendLine(A, B) {
      const a = this.m2s(A), b = this.m2s(B);
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) return [a, b];
      const W = this.w, H = this.h;
      let tmin = -Infinity, tmax = Infinity;
      if (Math.abs(dx) > EPS) {
        const t1 = -a.x / dx, t2 = (W - a.x) / dx;
        tmin = Math.max(tmin, Math.min(t1, t2));
        tmax = Math.min(tmax, Math.max(t1, t2));
      } else if (a.x < 0 || a.x > W) {
        return [a, b];
      }
      if (Math.abs(dy) > EPS) {
        const t1 = -a.y / dy, t2 = (H - a.y) / dy;
        tmin = Math.max(tmin, Math.min(t1, t2));
        tmax = Math.min(tmax, Math.max(t1, t2));
      } else if (a.y < 0 || a.y > H) {
        return [a, b];
      }
      if (tmin > tmax) return [a, b];
      return [
        { x: a.x + dx * tmin, y: a.y + dy * tmin },
        { x: a.x + dx * tmax, y: a.y + dy * tmax },
      ];
    }
    _extendRay(A, B) {
      const a = this.m2s(A), b = this.m2s(B);
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) < EPS && Math.abs(dy) < EPS) return [a, b];
      const W = this.w, H = this.h;
      let tmin = 0, tmax = Infinity;
      if (Math.abs(dx) > EPS) {
        const t1 = -a.x / dx, t2 = (W - a.x) / dx;
        tmin = Math.max(tmin, Math.min(t1, t2));
        tmax = Math.min(tmax, Math.max(t1, t2));
      } else if (a.x < 0 || a.x > W) {
        return [a, a];
      }
      if (Math.abs(dy) > EPS) {
        const t1 = -a.y / dy, t2 = (H - a.y) / dy;
        tmin = Math.max(tmin, Math.min(t1, t2));
        tmax = Math.min(tmax, Math.max(t1, t2));
      } else if (a.y < 0 || a.y > H) {
        return [a, a];
      }
      if (tmin > tmax) return [a, a];
      return [
        { x: a.x + dx * tmin, y: a.y + dy * tmin },
        { x: a.x + dx * tmax, y: a.y + dy * tmax },
      ];
    }

    render() {
      this.con.recompute();
      // Skip viewport refit + grid redraw під час drag:
      //  - _fitToContent() rescales view коли точка виходить за bounds → ВСЯ
      //    конструкція раптом стискається/розтягується → візуальний стрибок.
      //  - _drawGrid() рекрейтить сотні line nodes — дорого, а сітка не залежить
      //    від положення точок. На pointerup ми робимо повний render() щоб
      //    остаточно віцентрувати + перемалювати grid.
      if (!this._isDragging) {
        this._fitToContent();
        this._drawGrid();
      }
      this.gFills.innerHTML = '';
      this.gCurves.innerHTML = '';
      this.gAngles.innerHTML = '';
      this.gPoints.innerHTML = '';
      this.gLabels.innerHTML = '';
      this.elems.clear();

      // helper to make element
      const mk = (g, tag, attrs) => {
        const el = document.createElementNS(SVG_NS, tag);
        for (const k in attrs) el.setAttribute(k, attrs[k]);
        g.appendChild(el);
        return el;
      };

      for (const o of this.con.objects) {
        if (o.hidden) continue;
        try { this._renderOne(o, mk); } catch (e) { /* swallow */ }
      }
    }

    _renderOne(o, mk) {
      const v = this.view, P = STYLE.palette;
      const styleStroke = (st, override) => {
        const dash = st.startsWith('dashed') ? '6 5' : (st === 'dotted' ? '2 4' : null);
        let color = st.includes('accent') ? P.free : (st === 'angle' ? P.angle : (st === 'distance' ? P.dist : P.ink));
        if (typeof override === 'string' && override.startsWith('#')) color = override;
        const op = st === 'dashed' ? 0.55 : 0.9;
        return { dash, color, op };
      };

      if (o.kind === 'segment') {
        let A, B;
        if (o.cache) { A = this.m2s(o.cache.A); B = this.m2s(o.cache.B); }
        else { A = this.m2s(this.con.get(o.a)); B = this.m2s(this.con.get(o.b)); }
        const s = styleStroke(o.style, o.color);
        const el = mk(this.gCurves, 'line', { x1: A.x, y1: A.y, x2: B.x, y2: B.y, stroke: s.color, 'stroke-width': o.width, 'stroke-opacity': s.op, 'stroke-linecap': 'round' });
        if (s.dash) el.setAttribute('stroke-dasharray', s.dash);
      } else if (o.kind === 'line') {
        let A, B;
        if (o.cache) { A = o.cache.A; B = o.cache.B; }
        else { A = this.con.get(o.a); B = this.con.get(o.b); }
        const [sa, sb] = this._extendLine(A, B);
        const s = styleStroke(o.style, o.color);
        const el = mk(this.gCurves, 'line', { x1: sa.x, y1: sa.y, x2: sb.x, y2: sb.y, stroke: s.color, 'stroke-width': o.width, 'stroke-opacity': s.op });
        if (s.dash) el.setAttribute('stroke-dasharray', s.dash);
      } else if (o.kind === 'ray') {
        let A, B;
        if (o.cache) { A = o.cache.A; B = o.cache.B; }
        else { A = this.con.get(o.a); B = this.con.get(o.b); }
        const [sa, sb] = this._extendRay(A, B);
        const s = styleStroke(o.style, o.color);
        const el = mk(this.gCurves, 'line', { x1: sa.x, y1: sa.y, x2: sb.x, y2: sb.y, stroke: s.color, 'stroke-width': o.width, 'stroke-opacity': s.op });
        if (s.dash) el.setAttribute('stroke-dasharray', s.dash);
      } else if (o.kind === 'circle') {
        const c = this.m2s({ x: o.cx, y: o.cy });
        const rPx = o.r * this.view.scale;
        const fillColor = o.fill === 'face' ? P.face : (o.fill === 'circle' ? P.cFill : 'none');
        const s = styleStroke(o.style || 'solid', o.color);
        const el = mk(this.gCurves, 'circle', { cx: c.x, cy: c.y, r: rPx, stroke: s.color, 'stroke-width': o.width || 1.6, 'stroke-opacity': s.op, fill: fillColor });
        if (s.dash) el.setAttribute('stroke-dasharray', s.dash);
      } else if (o.kind === 'polygon') {
        const pts = o.pts.map((id) => this.m2s(this.con.get(id)));
        const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ' ' + p.y).join(' ') + ' Z';
        mk(this.gFills, 'path', { d, fill: P.face, stroke: 'none' });
      } else if (o.kind === 'square_out') {
        const pts = o.pts.map((p) => this.m2s(p));
        const d = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ' ' + p.y).join(' ') + ' Z';
        const col = o.color === 'a' ? '#3b7b9b' : (o.color === 'b' ? '#7b6193' : '#c4622a');
        mk(this.gFills, 'path', { d, fill: col + '24', stroke: col, 'stroke-width': 1.4, 'stroke-opacity': 0.7 });
        // area label inside
        const c = pts.reduce((s, p) => ({ x: s.x + p.x / 4, y: s.y + p.y / 4 }), { x: 0, y: 0 });
        const t = mk(this.gLabels, 'text', { x: c.x, y: c.y + 4, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace', 'font-size': 11, fill: col });
        t.textContent = fmt(o.area, 2);
      } else if (o.kind === 'angle_arc') {
        const A = this.con.get(o.a), B = this.con.get(o.b), C = this.con.get(o.c);
        const Bp = this.m2s(B);
        const u = norm(sub(A, B)), w = norm(sub(C, B));
        if (len(u) < EPS || len(w) < EPS) return;
        // determine angles in screen space (y flipped)
        const a1 = Math.atan2(-u.y, u.x), a2 = Math.atan2(-w.y, w.x);
        let d = a2 - a1; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        const rPx = o.rPx;
        const start = { x: Bp.x + rPx * Math.cos(a1), y: Bp.y + rPx * Math.sin(a1) };
        const end = { x: Bp.x + rPx * Math.cos(a1 + d), y: Bp.y + rPx * Math.sin(a1 + d) };
        const large = Math.abs(d) > Math.PI ? 1 : 0;
        const sweep = d > 0 ? 1 : 0;
        const path = `M ${start.x} ${start.y} A ${rPx} ${rPx} 0 ${large} ${sweep} ${end.x} ${end.y}`;
        mk(this.gAngles, 'path', { d: path, fill: 'none', stroke: P.angle, 'stroke-width': 1.4, 'stroke-opacity': 0.85 });
        if (o.label) {
          const mid = a1 + d / 2;
          const lp = { x: Bp.x + (rPx + 14) * Math.cos(mid), y: Bp.y + (rPx + 14) * Math.sin(mid) };
          const ang = Math.abs(d) * 180 / Math.PI;
          const t = mk(this.gLabels, 'text', { x: lp.x, y: lp.y + 3, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace', 'font-size': 11, fill: P.angle, 'font-weight': 600 });
          t.textContent = (typeof o.label === 'string' ? (o.label + ' ') : '') + fmt(ang, 1) + '°';
        }
      } else if (o.kind === 'right_angle') {
        const A = this.con.get(o.a), B = this.con.get(o.b), C = this.con.get(o.c);
        const Bp = this.m2s(B);
        const ua = norm(sub(this.m2s(A), Bp));
        const uc = norm(sub(this.m2s(C), Bp));
        const sz = o.sizePx;
        const p1 = { x: Bp.x + ua.x * sz, y: Bp.y + ua.y * sz };
        const p3 = { x: Bp.x + uc.x * sz, y: Bp.y + uc.y * sz };
        const p2 = { x: Bp.x + (ua.x + uc.x) * sz, y: Bp.y + (ua.y + uc.y) * sz };
        const path = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y}`;
        mk(this.gAngles, 'path', { d: path, fill: 'none', stroke: P.angle, 'stroke-width': 1.2, 'stroke-opacity': 0.85 });
      } else if (o.kind === 'length_label') {
        const seg = this.con.get(o.seg);
        const A = this.con.get(seg.a), B = this.con.get(seg.b);
        const M = this.m2s({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 });
        // offset perpendicular to segment in screen space, pixels
        const a = this.m2s(A), b = this.m2s(B);
        const n = perp(norm(sub(b, a)));
        const off = 14;
        const pos = { x: M.x + n.x * off, y: M.y + n.y * off };
        const t = mk(this.gLabels, 'text', { x: pos.x, y: pos.y + 3, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace', 'font-size': 11, fill: P.dist });
        t.textContent = o.prefix + fmt(dist(A, B), 2) + o.suffix;
      } else if (o.kind === 'area_label') {
        const poly = this.con.get(o.poly);
        const pts = poly.pts.map((id) => this.con.get(id));
        const c = pts.reduce((s, p) => ({ x: s.x + p.x / pts.length, y: s.y + p.y / pts.length }), { x: 0, y: 0 });
        const cs = this.m2s(c);
        const t = mk(this.gLabels, 'text', { x: cs.x, y: cs.y + 4, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace', 'font-size': 12, fill: P.ink2 });
        t.textContent = o.prefix + fmt(Math.abs(polygonArea(pts)), 2) + o.suffix;
      } else if (o.kind === 'formula') {
        // Переклад має пріоритет над літералом, але лише якщо він СПРАВДІ є:
        // порожній результат означає «ключа немає в локалі» → лишаємо
        // авторський текст, а не порожню плашку.
        const translated = (o.i18nKey && typeof this.opts.i18n === 'function')
          ? this.opts.i18n(o.i18nKey) : null;
        const txt = translated || o.fn(this.con);
        const lines = ('' + txt).split('\n');
        let x, y, anchor;
        if (o.anchor === 'tl') { x = 12; y = 18; anchor = 'start'; }
        else if (o.anchor === 'tr') { x = this.w - 12; y = 18; anchor = 'end'; }
        else if (o.anchor === 'bl') { x = 12; y = this.h - 12 - (lines.length - 1) * 16; anchor = 'start'; }
        else if (o.anchor === 'br') { x = this.w - 12; y = this.h - 12 - (lines.length - 1) * 16; anchor = 'end'; }
        else { x = this.w / 2; y = 18; anchor = 'middle'; }
        // background pill
        const bg = mk(this.gLabels, 'rect', { fill: 'rgba(255,250,240,0.85)', stroke: 'rgba(43,33,24,0.12)', rx: 6, ry: 6 });
        const tg = mk(this.gLabels, 'g', {});
        // Плашки-накладки НЕ йдуть у знімок для експорту (issue власника
        // 2026-08-09). Це стосується ВСІХ formula-міток, бо всі вони —
        // службовий шар поверх креслення:
        //   • підказки драга («Drag A/B/D · C = D + (B−A) авто») пояснюють
        //     дію, якої в статичній картинці не існує;
        //   • панелі вимірів («a = 5,4 b = 3,09 S = 15,12») показують стан
        //     фігури ПІСЛЯ того, як її потягали, — на слайді ці числа вже
        //     суперечать умові задачі (4 і 5 см проти 5,4 і 3,09).
        // Саме креслення (мітки точок, підписи сторін, кути) — інші типи
        // об'єктів, їх не чіпаємо: вони частина фігури, а не накладка.
        // Жива дошка не змінюється — атрибут читає лише знімок.
        bg.setAttribute('data-export-hide', '');
        tg.setAttribute('data-export-hide', '');
        lines.forEach((line, i) => {
          const t = document.createElementNS(SVG_NS, 'text');
          t.setAttribute('x', x); t.setAttribute('y', y + i * 16);
          t.setAttribute('text-anchor', anchor);
          t.setAttribute('font-family', 'JetBrains Mono, monospace');
          t.setAttribute('font-size', 12);
          t.setAttribute('fill', P.ink);
          t.textContent = line; tg.appendChild(t);
        });
        // size bg after measure
        requestAnimationFrame(() => {
          try {
            const bb = tg.getBBox();
            bg.setAttribute('x', bb.x - 6); bg.setAttribute('y', bb.y - 3);
            bg.setAttribute('width', bb.width + 12); bg.setAttribute('height', bb.height + 6);
          } catch (_) {}
        });
      } else if (o.kind === 'distance_line') {
        const A = this.con.get(o.a), B = this.con.get(o.b);
        const Sa = this.m2s(A), Sb = this.m2s(B);
        // draw dashed segment with arrowheads + label
        const path = `M ${Sa.x} ${Sa.y} L ${Sb.x} ${Sb.y}`;
        mk(this.gCurves, 'path', { d: path, stroke: P.dist, 'stroke-width': 1, 'stroke-opacity': 0.7, 'stroke-dasharray': '4 4', fill: 'none' });
        // ticks at ends
        const u = norm(sub(Sb, Sa)); const n = perp(u); const tk = 5;
        for (const [x, y] of [[Sa.x, Sa.y], [Sb.x, Sb.y]]) {
          mk(this.gCurves, 'line', { x1: x + n.x * tk, y1: y + n.y * tk, x2: x - n.x * tk, y2: y - n.y * tk, stroke: P.dist, 'stroke-width': 1, 'stroke-opacity': 0.7 });
        }
        const M = { x: (Sa.x + Sb.x) / 2, y: (Sa.y + Sb.y) / 2 };
        const lp = { x: M.x + n.x * 12, y: M.y + n.y * 12 };
        const t = mk(this.gLabels, 'text', { x: lp.x, y: lp.y + 3, 'text-anchor': 'middle', 'font-family': 'JetBrains Mono, monospace', 'font-size': 11, fill: P.dist });
        t.textContent = o.prefix + fmt(dist(A, B), 2);
      } else if (o.kind === 'point' || o.kind === 'free_point' || o.kind === 'on_line' || o.kind === 'on_circle' || o.kind === 'on_axis' || o.kind === 'midpoint' || o.kind === 'intersect_ll' || o.kind === 'foot' || o.kind === 'centroid' || o.kind === 'circumcenter' || o.kind === 'incenter' || o.kind === 'orthocenter' || o.kind === 'derived') {
        const s = this.m2s({ x: o.x, y: o.y });
        const isFree = o.movable;
        let color = isFree ? P.free : P.derived;
        if (typeof o.color === 'string' && o.color.startsWith('#')) color = o.color;
        const ring = mk(this.gPoints, 'circle', { cx: s.x, cy: s.y, r: o.size + 3, fill: color, 'fill-opacity': isFree ? 0.18 : 0.1, stroke: 'none' });
        const dot = mk(this.gPoints, 'circle', { cx: s.x, cy: s.y, r: o.size, fill: color, stroke: '#fffaf0', 'stroke-width': 1.5, style: isFree ? 'cursor:grab' : 'cursor:default' });
        dot.dataset.ptId = o.id;
        dot.classList.add('geo-pt');
        if (isFree) dot.classList.add('geo-free');
        this.elems.set(o.id, { dot, ring });
        if (o.label) {
          const off = o.labelOffset || { x: 10, y: -10 };
          const t = mk(this.gLabels, 'text', { x: s.x + off.x, y: s.y + off.y, 'font-family': 'Inter, sans-serif', 'font-size': 13, 'font-weight': 600, fill: P.ink });
          t.textContent = o.label;
        }
      }
    }

    _bindDrag() {
      let drag = null;
      const px2math = (e) => {
        const r = this.svg.getBoundingClientRect();
        return this.s2m({ x: e.clientX - r.left, y: e.clientY - r.top });
      };
      this.svg.addEventListener('pointerdown', (e) => {
        const t = e.target;
        const id = t.dataset && t.dataset.ptId;
        if (!id) return;
        const o = this.con.get(id);
        if (!o || !o.movable) return;
        drag = { id, pid: e.pointerId };
        // Enable smoothing mode у render() — skip _fitToContent + _drawGrid.
        // Усуває "скачуть" при viewport rescale на dragging point exit-із bounds.
        this._isDragging = true;
        this.svg.setPointerCapture(e.pointerId);
        t.style.cursor = 'grabbing';
        e.preventDefault();
      });
      this.svg.addEventListener('pointermove', (e) => {
        // hover label updates
        if (!drag) {
          const t = e.target; const id = t.dataset && t.dataset.ptId;
          if (id) {
            const o = this.con.get(id);
            const r = this.container.getBoundingClientRect();
            this.tip.style.left = (e.clientX - r.left) + 'px';
            this.tip.style.top = (e.clientY - r.top) + 'px';
            this.tip.textContent = (o.label ? o.label + ' ' : '') + '(' + fmt(o.x, 2) + ', ' + fmt(o.y, 2) + ')';
            this.tip.style.opacity = '1';
          } else {
            this.tip.style.opacity = '0';
          }
          return;
        }
        const o = this.con.get(drag.id);
        const m = px2math(e);
        let mx = m.x, my = m.y;
        if (this.opts.snap > 0) { mx = Math.round(mx / this.opts.snap) * this.opts.snap; my = Math.round(my / this.opts.snap) * this.opts.snap; }
        o.setTo(mx, my, this.con);
        // rAF coalesce — render at most 1× per animation frame (60Hz),
        // not at pointermove rate (120Hz+). Eliminates "scakуть" stutter on
        // dense constructions (Pythagoras, Thales). Original used per-event
        // render() which doubled work on high-refresh trackpads.
        if (!this._dragRAF) {
          this._dragRAF = requestAnimationFrame(() => {
            this._dragRAF = null;
            this.render();
            if (this.onChange) this.onChange();
          });
        }
      });
      const end = (e) => {
        if (!drag) return;
        const o = this.con.get(drag.id);
        const dot = this.elems.get(o.id)?.dot;
        if (dot) dot.style.cursor = 'grab';
        try { this.svg.releasePointerCapture(drag.pid); } catch (_) {}
        drag = null;
        // Flush pending drag-render frame, потім один FULL render (з refit + grid)
        // щоб переmaluvати у фінальній view-bounds.
        this._isDragging = false;
        if (this._dragRAF) { cancelAnimationFrame(this._dragRAF); this._dragRAF = null; }
        this.render();
        if (this.onChange) this.onChange();
      };
      this.svg.addEventListener('pointerup', end);
      this.svg.addEventListener('pointercancel', end);
      this.svg.addEventListener('pointerleave', () => { this.tip.style.opacity = '0'; });
    }

    destroy() {
      this._ro.disconnect();
      this.container.innerHTML = '';
    }
  }

  // ===========================================================================
  // export
  // ===========================================================================
  window.Geo2D = {
    Construction, Renderer, G,
    util: { sub, add, scl, len, dot, cross, norm, dist, perp, linesIntersect, footOnLine, lineCircleIntersect, circleCircleIntersect, centroidT, circumcenterT, incenterT, orthocenterT, polygonArea, angleBetween, fmt, reflectAcrossLine },
  };
})();

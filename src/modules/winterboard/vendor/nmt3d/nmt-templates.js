// nmt-templates.js — Library of NMT/ZNO-style stereometry templates.
// Each template produces a clean, labeled 2D figure in cabinet projection
// (α=30°, y-axis compressed by 0.5), with hidden edges dashed and standard
// auxiliary lines (heights, apothems, axial sections) toggleable per task.
(function () {
  const D2R = Math.PI / 180;

  // ===== Cabinet projection helper =====
  // World axes: X horizontal-right, Y depth-into-screen, Z vertical-up.
  // Conventional NMT/ZNO axonometry: back of the solid (positive Y) appears
  // UP-RIGHT on screen (looking from front-above).
  // CABINET mode: Y contributes to BOTH screen x and y.
  //   x = X + 0.5·Y·cos(α);   y = -Z - 0.5·Y·sin(α)
  // VERTICAL mode (for round bodies, gives horizontal ellipses):
  //   x = X;                  y = -Z - 0.4·Y
  function mkProj(scale, angleDeg, yCompress, mode) {
    const a = angleDeg * D2R;
    if (mode === 'vertical') {
      return (X, Y, Z) => ({
        x: X * scale,
        y: -Z * scale - (yCompress || 0.4) * Y * scale,
      });
    }
    return (X, Y, Z) => ({
      x: X * scale + (yCompress || 0.5) * Y * scale * Math.cos(a),
      y: -Z * scale - (yCompress || 0.5) * Y * scale * Math.sin(a),
    });
  }

  // ===== Figure builder =====
  class Builder {
    constructor(opts = {}) {
      this.scale = opts.scale || 80;
      this.angle = opts.angle || 30;
      this.yc = opts.yCompress != null ? opts.yCompress : 0.5;
      this.mode = opts.mode || 'cabinet';
      this.proj = mkProj(this.scale, this.angle, this.yc, this.mode);
      this.visible = [];
      this.hidden = [];
      this.aux = [];      // {d, color, w, dash}
      this.labels = [];   // {x, y, t, size}
      this.dots = [];
      this.marks = [];    // small right-angle markers etc.
      this.allPts = [];   // for bbox
    }
    P(X, Y, Z) {
      const p = this.proj(X, Y, Z);
      this.allPts.push(p);
      return p;
    }
    edge(a, b, kind = 'vis') {
      const s = `M${a.x.toFixed(2)},${a.y.toFixed(2)} L${b.x.toFixed(2)},${b.y.toFixed(2)}`;
      if (kind === 'vis') this.visible.push(s);
      else if (kind === 'hid') this.hidden.push(s);
    }
    auxLine(a, b, opts = {}) {
      const s = `M${a.x.toFixed(2)},${a.y.toFixed(2)} L${b.x.toFixed(2)},${b.y.toFixed(2)}`;
      this.aux.push({ d: s, color: opts.color || '#c4622a', w: opts.w || 1.4, dash: opts.dash || '' });
    }
    auxPath(d, opts = {}) {
      this.aux.push({ d, color: opts.color || '#c4622a', w: opts.w || 1.4, dash: opts.dash || '' });
    }
    label(p, text, dx = 0, dy = 0, size) {
      this.labels.push({ x: p.x + dx, y: p.y + dy, t: text, size: size || 17 });
      this.allPts.push({ x: p.x + dx + 8, y: p.y + dy });
      this.allPts.push({ x: p.x + dx - 8, y: p.y + dy - 14 });
    }
    dot(p) { this.dots.push({ x: p.x, y: p.y }); }
    rightAngleMark(corner, dir1, dir2, size = 8) {
      // small square indicating right angle. dir1, dir2 are unit-ish direction vectors from corner.
      const n1 = norm(dir1), n2 = norm(dir2);
      const p1 = { x: corner.x + n1.x * size, y: corner.y + n1.y * size };
      const p2 = { x: corner.x + n1.x * size + n2.x * size, y: corner.y + n1.y * size + n2.y * size };
      const p3 = { x: corner.x + n2.x * size, y: corner.y + n2.y * size };
      const d = `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} L${p2.x.toFixed(1)},${p2.y.toFixed(1)} L${p3.x.toFixed(1)},${p3.y.toFixed(1)}`;
      this.marks.push({ d });
    }
    // Ellipse helper for circular cross-sections (cylinder / cone / sphere).
    // center at world (cx, cy, cz). axis = direction of the circle's normal (here always Z).
    // r = radius. visiblePart: 'full', 'front', 'back', 'frontDashed'
    ellipseZ(cx, cy, cz, r, mode = 'full') {
      // The ellipse in screen-space is a rotated/squashed circle.
      // Compute 4 key points on the circle (theta = 0, π/2, π, 3π/2) in world,
      // project, then derive ellipse rx, ry, rotation.
      const E = [];
      const N = 80;
      for (let i = 0; i <= N; i++) {
        const t = i / N * Math.PI * 2;
        const X = cx + r * Math.cos(t);
        const Y = cy + r * Math.sin(t);
        E.push(this.proj(X, Y, cz));
      }
      this.allPts.push(...E);
      // Find the back/front halves: in cabinet projection with y going up-right,
      // back half = points with larger world Y. The transition happens where t=π/2 and t=3π/2 (Y = cy ± r).
      // Simpler: front half = t ∈ [-π/2, π/2]+offset; but to be precise, the silhouette in cabinet projection
      // is where the world tangent is parallel to the view direction.
      // For cabinet projection (no perspective), the silhouette is at points where the circle's tangent
      // matches the projection direction. Since cabinet is just a linear transformation, the projected
      // ellipse silhouette is just its leftmost/rightmost extreme — i.e. the screen-x extreme.
      // For our purposes: split the ellipse into "back" half (max-y of world) and "front" half (min-y).
      // World Y range: cy-r..cy+r. Threshold: cy.
      // i.e. front = points with Y < cy, back = Y >= cy.
      // Note: Y = cy + r sin t; so front (Y < cy) ↔ sin t < 0 ↔ t ∈ (π, 2π).
      // We'll emit two paths.
      const front = [], back = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N * Math.PI * 2;
        if (Math.sin(t) <= 1e-6) front.push(E[i]);
        else back.push(E[i]);
      }
      const toPath = (pts) => pts.length ? 'M' + pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L') : '';
      const fd = toPath(front);
      const bd = toPath(back);
      if (mode === 'full') {
        if (fd) this.visible.push(fd);
        if (bd) this.hidden.push(bd);
      } else if (mode === 'frontOnly') {
        if (fd) this.visible.push(fd);
      } else if (mode === 'allSolid') {
        if (fd) this.visible.push(fd);
        if (bd) this.visible.push(bd);
      }
      return E;
    }
    bbox() {
      if (this.allPts.length === 0) return { minX: 0, maxX: 1, minY: 0, maxY: 1 };
      const xs = this.allPts.map(p => p.x), ys = this.allPts.map(p => p.y);
      return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
    }
    toSvg(extraPad = 18) {
      const b = this.bbox();
      const pad = extraPad;
      const w = b.maxX - b.minX + 2 * pad;
      const h = b.maxY - b.minY + 2 * pad;
      const tx = pad - b.minX;
      const ty = pad - b.minY;
      let s = `<svg viewBox="0 0 ${w.toFixed(1)} ${h.toFixed(1)}" xmlns="http://www.w3.org/2000/svg" class="nmt-fig" preserveAspectRatio="xMidYMid meet">`;
      s += `<g transform="translate(${tx.toFixed(1)},${ty.toFixed(1)})">`;
      for (const e of this.hidden) s += `<path d="${e}" fill="none" stroke="#7a6b56" stroke-width="1" stroke-dasharray="4 3" stroke-linecap="round"/>`;
      for (const a of this.aux) {
        s += `<path d="${a.d}" fill="none" stroke="${a.color}" stroke-width="${a.w}" ${a.dash ? `stroke-dasharray="${a.dash}"` : ''} stroke-linecap="round"/>`;
      }
      for (const e of this.visible) s += `<path d="${e}" fill="none" stroke="#1a1612" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
      for (const m of this.marks) s += `<path d="${m.d}" fill="none" stroke="#1a1612" stroke-width="1.2"/>`;
      for (const d of this.dots) s += `<circle cx="${d.x.toFixed(2)}" cy="${d.y.toFixed(2)}" r="2.6" fill="#1a1612"/>`;
      for (const l of this.labels) s += `<text x="${l.x.toFixed(2)}" y="${l.y.toFixed(2)}" font-family="'Times New Roman', 'STIX Two Text', serif" font-style="italic" font-size="${l.size}" fill="#1a1612">${l.t}</text>`;
      s += '</g></svg>';
      return s;
    }
  }
  function norm(v) {
    const L = Math.hypot(v.x, v.y) || 1;
    return { x: v.x / L, y: v.y / L };
  }
  function midp(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  // ===== Templates =====
  const TPL = {};

  // 1) Куб ABCDA₁B₁C₁D₁
  TPL.cube = {
    name: 'Куб',
    full: 'ABCDA₁B₁C₁D₁',
    options: [
      { key: 'bodyDiag',  label: 'діагональ AC₁' },
      { key: 'faceDiag',  label: 'діагональ грані' },
      { key: 'diagSect',  label: 'переріз AB₁C₁D' },
      { key: 'center',    label: 'центр O' },
    ],
    render(opts = {}) {
      const b = new Builder({ scale: 80 });
      const A = b.P(0,0,0), B = b.P(1,0,0), C = b.P(1,1,0), D = b.P(0,1,0);
      const A1 = b.P(0,0,1), B1 = b.P(1,0,1), C1 = b.P(1,1,1), D1 = b.P(0,1,1);
      // visible
      [[A,B],[B,C],[A1,B1],[B1,C1],[C1,D1],[D1,A1],[A,A1],[B,B1],[C,C1]].forEach(([p,q]) => b.edge(p,q));
      // hidden
      [[A,D],[D,C],[D,D1]].forEach(([p,q]) => b.edge(p,q,'hid'));
      if (opts.bodyDiag) {
        b.auxLine(A, C1, { color: '#c4622a', w: 1.5 });
      }
      if (opts.faceDiag) {
        b.auxLine(A1, C1, { color: '#7b6193', w: 1.3, dash: '4 3' });
      }
      if (opts.diagSect) {
        // Diagonal cross-section AB₁C₁D — a rectangle through opposite edges
        b.auxLine(A, B1, { color: '#3b7b9b', w: 1.7 });
        b.auxLine(B1, C1, { color: '#3b7b9b', w: 1.7 });
        b.auxLine(C1, D,  { color: '#3b7b9b', w: 1.7 });
        b.auxLine(D, A,   { color: '#3b7b9b', w: 1.5, dash: '5 3' });
      }
      if (opts.center) {
        const O = b.P(0.5, 0.5, 0.5);
        b.dot(O);
        b.label(O, 'O', 6, 4);
      }
      b.label(A, 'A',  -14, 14);
      b.label(B, 'B',   4, 14);
      b.label(C, 'C',   6, 10);
      b.label(D, 'D', -10, 14);
      b.label(A1, 'A₁', -18, -6);
      b.label(B1, 'B₁',  4, -6);
      b.label(C1, 'C₁',  6, -4);
      b.label(D1, 'D₁', -22, -4);
      return b.toSvg();
    },
  };

  // 2) Прямокутний паралелепіпед
  TPL.cuboid = {
    name: 'Прямокутний паралелепіпед',
    full: 'ABCDA₁B₁C₁D₁',
    options: [
      { key: 'bodyDiag', label: 'діагональ AC₁' },
      { key: 'diagSect', label: 'переріз AB₁C₁D' },
      { key: 'sides',    label: 'позначити a, b, c' },
    ],
    render(opts = {}) {
      const b = new Builder({ scale: 72 });
      const a = 1.5, w = 0.85, h = 1.1;
      const A = b.P(0,0,0), B = b.P(a,0,0), C = b.P(a,w,0), D = b.P(0,w,0);
      const A1 = b.P(0,0,h), B1 = b.P(a,0,h), C1 = b.P(a,w,h), D1 = b.P(0,w,h);
      [[A,B],[B,C],[A1,B1],[B1,C1],[C1,D1],[D1,A1],[A,A1],[B,B1],[C,C1]].forEach(([p,q]) => b.edge(p,q));
      [[A,D],[D,C],[D,D1]].forEach(([p,q]) => b.edge(p,q,'hid'));
      if (opts.bodyDiag) {
        b.auxLine(A, C1, { color: '#c4622a', w: 1.5 });
      }
      if (opts.diagSect) {
        b.auxLine(A, B1, { color: '#3b7b9b', w: 1.7 });
        b.auxLine(B1, C1, { color: '#3b7b9b', w: 1.7 });
        b.auxLine(C1, D,  { color: '#3b7b9b', w: 1.7 });
        b.auxLine(D, A,   { color: '#3b7b9b', w: 1.5, dash: '5 3' });
      }
      if (opts.sides) {
        const mAB = midp(A, B); b.label({x: mAB.x - 4, y: mAB.y + 18}, 'a', 0, 0, 14);
        const mBC = midp(B, C); b.label({x: mBC.x + 4, y: mBC.y + 14}, 'b', 0, 0, 14);
        const mAA1 = midp(A, A1); b.label({x: mAA1.x - 14, y: mAA1.y + 4}, 'c', 0, 0, 14);
      }
      b.label(A, 'A',  -14, 14);
      b.label(B, 'B',   4, 14);
      b.label(C, 'C',   6, 10);
      b.label(D, 'D', -10, 14);
      b.label(A1, 'A₁', -18, -6);
      b.label(B1, 'B₁',  4, -6);
      b.label(C1, 'C₁',  6, -4);
      b.label(D1, 'D₁', -22, -4);
      return b.toSvg();
    },
  };

  // 3) Правильна чотирикутна піраміда SABCD
  TPL.pyramid4 = {
    name: 'Правильна 4-кутна піраміда',
    full: 'SABCD',
    options: [
      { key: 'height',   label: 'висота SO' },
      { key: 'apothem',  label: 'апофема SM' },
      { key: 'diags',    label: 'діагоналі основи' },
      { key: 'axSect',   label: 'осьовий переріз SAC' },
    ],
    render(opts = {}) {
      const b = new Builder({ scale: 84 });
      const A = b.P(0,0,0), B = b.P(1,0,0), C = b.P(1,1,0), D = b.P(0,1,0);
      const O = b.P(0.5, 0.5, 0);
      const S = b.P(0.5, 0.5, 1.35);
      // base
      [[A,B],[B,C],[C,D],[D,A]].forEach(([p,q]) => b.edge(p,q));
      // slants
      [[S,A],[S,B],[S,C]].forEach(([p,q]) => b.edge(p,q));
      b.edge(S, D, 'hid');
      if (opts.axSect) {
        // Axial cross-section SAC — a triangle through apex and diagonal AC
        b.auxLine(A, C, { color: '#3b7b9b', w: 1.7 });
        b.auxLine(S, A, { color: '#3b7b9b', w: 1.7 });
        b.auxLine(S, C, { color: '#3b7b9b', w: 1.7 });
      }
      if (opts.height) {
        b.auxLine(S, O, { color: '#c4622a', w: 1.4, dash: '8 3 1 3' });
        b.dot(O); b.label(O, 'O', 4, 14);
        // small right-angle mark at O
        const dirOS = norm({ x: S.x - O.x, y: S.y - O.y });
        const dirOC = norm({ x: C.x - O.x, y: C.y - O.y });
        b.rightAngleMark(O, dirOS, dirOC, 9);
      }
      if (opts.apothem) {
        const M = b.P(0.5, 0, 0); // midpoint of AB
        b.auxLine(S, M, { color: '#3b7b9b', w: 1.5 });
        b.dot(M); b.label(M, 'M', -10, 16);
      }
      if (opts.diags) {
        b.auxLine(A, C, { color: '#7b6193', w: 1.0, dash: '3 3' });
        b.auxLine(B, D, { color: '#7b6193', w: 1.0, dash: '3 3' });
      }
      b.label(A, 'A',  -14, 14);
      b.label(B, 'B',   4, 14);
      b.label(C, 'C',   6, 10);
      b.label(D, 'D', -10, 14);
      b.label(S, 'S',   6, -4);
      return b.toSvg();
    },
  };

  // 4) Правильна трикутна піраміда SABC
  TPL.pyramid3 = {
    name: 'Правильна 3-кутна піраміда',
    full: 'SABC',
    options: [
      { key: 'height',   label: 'висота SO' },
      { key: 'apothem',  label: 'апофема SM' },
      { key: 'median',   label: 'медіана основи' },
      { key: 'axSect',   label: 'осьовий переріз SAM' },
    ],
    render(opts = {}) {
      const b = new Builder({ scale: 88 });
      const sqrt3 = Math.sqrt(3);
      // Equilateral base in (X, Y) plane, side = 1.
      // Place so that we can see the back vertex C clearly.
      const A = b.P(0, 0, 0);
      const B = b.P(1, 0, 0);
      const C = b.P(0.5, sqrt3 / 2, 0);
      const O = b.P(0.5, sqrt3 / 6, 0);  // centroid
      const S = b.P(0.5, sqrt3 / 6, 1.3);
      [[A,B],[B,C],[C,A]].forEach(([p,q]) => b.edge(p,q));
      [[S,A],[S,B]].forEach(([p,q]) => b.edge(p,q));
      b.edge(S, C, 'hid');
      if (opts.axSect) {
        // Axial cross-section through apex + base median CM (where M is midpoint of AB)
        const M = b.P(0.5, 0, 0);
        b.auxLine(C, M, { color: '#3b7b9b', w: 1.7 });
        b.auxLine(S, C, { color: '#3b7b9b', w: 1.4, dash: '5 3' }); // hidden side coincides with slant SC
        b.auxLine(S, M, { color: '#3b7b9b', w: 1.7 });
        b.dot(M); b.label(M, 'M', -10, 16);
      }
      if (opts.height) {
        b.auxLine(S, O, { color: '#c4622a', w: 1.4, dash: '8 3 1 3' });
        b.dot(O); b.label(O, 'O', 6, 14);
        const dirOS = norm({ x: S.x - O.x, y: S.y - O.y });
        const dirOA = norm({ x: A.x - O.x, y: A.y - O.y });
        b.rightAngleMark(O, dirOS, dirOA, 9);
      }
      if (opts.apothem) {
        const M = b.P(0.5, 0, 0);
        b.auxLine(S, M, { color: '#3b7b9b', w: 1.5 });
        b.dot(M); b.label(M, 'M', -10, 16);
      }
      if (opts.median && !opts.apothem) {
        const M = b.P(0.5, 0, 0);
        b.auxLine(C, M, { color: '#7b6193', w: 1, dash: '3 3' });
        b.dot(M); b.label(M, 'M', -10, 16);
      }
      b.label(A, 'A',  -14, 14);
      b.label(B, 'B',   4, 14);
      b.label(C, 'C',   8, 0);
      b.label(S, 'S',   6, -4);
      return b.toSvg();
    },
  };

  // 5) Тетраедр (правильний)
  TPL.tetrahedron = {
    name: 'Правильний тетраедр',
    full: 'ABCD',
    options: [
      { key: 'height',  label: 'висота DO' },
      { key: 'apothem', label: 'апофема DM' },
    ],
    render(opts = {}) {
      const b = new Builder({ scale: 92 });
      const sqrt3 = Math.sqrt(3);
      const A = b.P(0, 0, 0);
      const B = b.P(1, 0, 0);
      const C = b.P(0.5, sqrt3 / 2, 0);
      const O = b.P(0.5, sqrt3 / 6, 0);
      // height of regular tetrahedron = √(2/3) ≈ 0.816
      const Hd = Math.sqrt(2/3);
      const D = b.P(0.5, sqrt3 / 6, Hd);
      [[A,B],[B,C],[C,A]].forEach(([p,q]) => b.edge(p,q));
      [[D,A],[D,B]].forEach(([p,q]) => b.edge(p,q));
      b.edge(D, C, 'hid');
      if (opts.height) {
        b.auxLine(D, O, { color: '#c4622a', w: 1.4, dash: '8 3 1 3' });
        b.dot(O); b.label(O, 'O', 6, 14);
      }
      if (opts.apothem) {
        const M = b.P(0.5, 0, 0);
        b.auxLine(D, M, { color: '#3b7b9b', w: 1.5 });
        b.dot(M); b.label(M, 'M', -10, 16);
      }
      b.label(A, 'A',  -14, 14);
      b.label(B, 'B',   4, 14);
      b.label(C, 'C',   8, 0);
      b.label(D, 'D',   6, -4);
      return b.toSvg();
    },
  };

  // 6) Правильна трикутна призма ABCA₁B₁C₁
  TPL.prism3 = {
    name: 'Правильна 3-кутна призма',
    full: 'ABCA₁B₁C₁',
    options: [
      { key: 'height', label: 'висота' },
      { key: 'median', label: 'медіана' },
      { key: 'diagSect', label: 'переріз ABC₁' },
    ],
    render(opts = {}) {
      const b = new Builder({ scale: 82 });
      const sqrt3 = Math.sqrt(3);
      const h = 1.5;
      const A = b.P(0, 0, 0), B = b.P(1, 0, 0), C = b.P(0.5, sqrt3/2, 0);
      const A1 = b.P(0, 0, h), B1 = b.P(1, 0, h), C1 = b.P(0.5, sqrt3/2, h);
      [[A,B],[A1,B1],[B1,C1],[C1,A1],[A,A1],[B,B1],[C,C1]].forEach(([p,q]) => b.edge(p,q));
      [[B,C],[C,A]].forEach(([p,q]) => b.edge(p,q));
      if (opts.diagSect) {
        // Triangular diagonal section ABC₁ (front edge + opposite top vertex)
        b.auxLine(A, C1, { color: '#3b7b9b', w: 1.7 });
        b.auxLine(B, C1, { color: '#3b7b9b', w: 1.7 });
      }
      // Actually: for triangular prism with C at back, edges BC, CA at base are on the floor — visible.
      // Edge CC1 is on the back-corner — might be ambiguous. By convention drawing, it's visible (silhouette).
      // The hidden edges of a triangular prism: none on a "standard" front view because all 9 edges hit silhouette
      // EXCEPT in our orientation, the back-floor edges BC and CA might actually be partially hidden by the
      // body. Typical Ukrainian textbook draws BC and CA SOLID (since they're on the floor and we look from above).
      // No truly hidden edges here.
      if (opts.height) {
        const O = b.P(0.5, sqrt3/6, 0), O1 = b.P(0.5, sqrt3/6, h);
        b.auxLine(O, O1, { color: '#c4622a', w: 1.4, dash: '8 3 1 3' });
        b.dot(O); b.dot(O1);
        b.label(O, 'O', 4, 14);
        b.label(O1, 'O₁', 4, -4);
      }
      if (opts.median) {
        const M = b.P(0.5, 0, 0);
        b.auxLine(C, M, { color: '#7b6193', w: 1, dash: '3 3' });
        b.dot(M); b.label(M, 'M', -10, 16);
      }
      b.label(A, 'A',  -14, 14);
      b.label(B, 'B',   4, 14);
      b.label(C, 'C',   8, 0);
      b.label(A1, 'A₁', -18, -6);
      b.label(B1, 'B₁',  4, -6);
      b.label(C1, 'C₁',  6, -6);
      return b.toSvg();
    },
  };

  // 7) Правильна шестикутна призма ABCDEFA₁B₁...
  TPL.prism6 = {
    name: 'Правильна 6-кутна призма',
    full: 'ABCDEFA₁…F₁',
    options: [
      { key: 'height',   label: 'висота' },
      { key: 'longDiag', label: 'велика діагональ' },
      { key: 'axSect',   label: 'осьовий переріз AA₁DD₁' },
    ],
    render(opts = {}) {
      const b = new Builder({ scale: 64 });
      const h = 1.6;
      const r1 = 0.866, r2 = 0.5;
      // Hexagon vertex (X, Y) positions, counterclockwise starting at front (Y=−1)
      const xy = [
        [0,   -1 ],  // A — front
        [ r1, -r2],  // B — front-right
        [ r1,  r2],  // C — back-right
        [0,    1 ],  // D — back
        [-r1,  r2],  // E — back-left
        [-r1, -r2],  // F — front-left
      ];
      const vs = xy.map(([X, Y]) => b.P(X, Y, 0));
      const us = xy.map(([X, Y]) => b.P(X, Y, h));
      // Bottom edges: AB, BC visible; CD, DE hidden (back); EF, FA visible
      for (let i = 0; i < 6; i++) {
        const next = (i + 1) % 6;
        const isHidden = (i === 2 || i === 3);
        b.edge(vs[i], vs[next], isHidden ? 'hid' : 'vis');
      }
      // Top edges: all visible
      for (let i = 0; i < 6; i++) b.edge(us[i], us[(i+1) % 6]);
      // Vertical edges: only DD₁ is hidden (most back)
      for (let i = 0; i < 6; i++) {
        b.edge(vs[i], us[i], i === 3 ? 'hid' : 'vis');
      }
      if (opts.height) {
        const O = b.P(0, 0, 0), O1 = b.P(0, 0, h);
        b.auxLine(O, O1, { color: '#c4622a', w: 1.4, dash: '8 3 1 3' });
        b.dot(O); b.dot(O1);
        b.label(O, 'O', 4, 14);
        b.label(O1, 'O₁', 4, -4);
      }
      if (opts.longDiag) {
        b.auxLine(vs[0], vs[3], { color: '#7b6193', w: 1.1, dash: '3 3' });
      }
      if (opts.axSect) {
        // Axial cross-section AA₁D₁D (rectangle through opposite vertices through axis)
        b.auxLine(vs[0], us[0], { color: '#3b7b9b', w: 1.7 });
        b.auxLine(us[0], us[3], { color: '#3b7b9b', w: 1.7 });
        b.auxLine(us[3], vs[3], { color: '#3b7b9b', w: 1.4, dash: '5 3' });
        b.auxLine(vs[3], vs[0], { color: '#3b7b9b', w: 1.7 });
      }
      const letters = ['A','B','C','D','E','F'];
      const offsetsBot = [[-4,18],[8,14],[8,8],[8,-2],[-18,-2],[-18,8]];
      const offsetsTop = [[-4,-6],[8,-6],[8,-4],[8,-4],[-22,-4],[-22,-4]];
      for (let i = 0; i < 6; i++) {
        b.label(vs[i], letters[i], offsetsBot[i][0], offsetsBot[i][1]);
        b.label(us[i], letters[i] + '₁', offsetsTop[i][0], offsetsTop[i][1]);
      }
      return b.toSvg();
    },
  };

  // 8) Циліндр
  TPL.cylinder = {
    name: 'Циліндр',
    full: 'O₁ABO',
    options: [
      { key: 'axis',       label: 'вісь' },
      { key: 'axialSect',  label: 'осьовий переріз' },
      { key: 'generator',  label: 'твірна AA₁' },
    ],
    render(opts = {}) {
      const b = new Builder({ scale: 70, mode: 'vertical', yCompress: 0.32 });
      const r = 1, h = 1.7;
      // Top and bottom ellipses
      const Obot = b.P(0, 0, 0);
      const Otop = b.P(0, 0, h);
      b.ellipseZ(0, 0, h, r, 'allSolid');  // top — fully visible
      b.ellipseZ(0, 0, 0, r, 'full');      // bottom — front solid, back dashed
      // Vertical generators (silhouette lines): left and right
      // In cabinet projection with y going +up-right, silhouette is at world X = ±r (since proj is linear in X only horizontally affected by Y).
      // Actually the projected ellipse has extreme x at world (X=±r, Y=0). So silhouette generators are at (X=±r, Y=0).
      const Aleft  = b.P(-r, 0, 0);
      const Aright = b.P( r, 0, 0);
      const Bleft  = b.P(-r, 0, h);
      const Bright = b.P( r, 0, h);
      b.edge(Aleft,  Bleft);
      b.edge(Aright, Bright);
      if (opts.axis) {
        b.auxLine(Obot, Otop, { color: '#c4622a', w: 1.4, dash: '8 3 1 3' });
        b.dot(Obot); b.dot(Otop);
        b.label(Obot, 'O', 6, 14);
        b.label(Otop, 'O₁', 6, -4);
      }
      if (opts.generator) {
        // mark the right generator as "twirna"
        const M = midp(Aright, Bright);
        b.label({x: M.x + 10, y: M.y + 4}, 'ℓ', 0, 0, 14);
      }
      if (opts.axialSect) {
        // axial section = rectangle through axis. Take the front-back rectangle going through (X=0, Y=-r..r).
        const P1 = b.P(0, -r, 0);
        const P2 = b.P(0,  r, 0);
        const P3 = b.P(0,  r, h);
        const P4 = b.P(0, -r, h);
        b.auxLine(P1, P2, { color: '#3b7b9b', w: 1.5 });
        b.auxLine(P2, P3, { color: '#3b7b9b', w: 1.5 });
        b.auxLine(P3, P4, { color: '#3b7b9b', w: 1.5 });
        b.auxLine(P4, P1, { color: '#3b7b9b', w: 1.5 });
      }
      b.label(Aleft,  'A', -16, 14);
      b.label(Aright, 'B',   6, 14);
      b.label(Bleft,  'A₁', -22, -4);
      b.label(Bright, 'B₁',   6, -4);
      return b.toSvg();
    },
  };

  // 9) Конус
  TPL.cone = {
    name: 'Конус',
    full: 'SABO',
    options: [
      { key: 'height',     label: 'висота SO' },
      { key: 'axialSect',  label: 'осьовий переріз' },
      { key: 'radius',     label: 'радіус OA' },
    ],
    render(opts = {}) {
      const b = new Builder({ scale: 72, mode: 'vertical', yCompress: 0.32 });
      const r = 1, h = 1.8;
      const O = b.P(0, 0, 0);
      const S = b.P(0, 0, h);
      b.ellipseZ(0, 0, 0, r, 'full');
      const Aleft  = b.P(-r, 0, 0);
      const Aright = b.P( r, 0, 0);
      b.edge(Aleft,  S);
      b.edge(Aright, S);
      if (opts.height) {
        b.auxLine(S, O, { color: '#c4622a', w: 1.4, dash: '8 3 1 3' });
        b.dot(O); b.label(O, 'O', 6, 14);
        // Right-angle mark at O
        const dirOS = norm({ x: S.x - O.x, y: S.y - O.y });
        const dirOA = norm({ x: Aright.x - O.x, y: Aright.y - O.y });
        b.rightAngleMark(O, dirOS, dirOA, 9);
      }
      if (opts.radius) {
        b.auxLine(O, Aright, { color: '#3b7b9b', w: 1.4 });
      }
      if (opts.axialSect) {
        // axial section through (X=0): isoceles triangle (Aback, S, Afront)
        const Aback  = b.P(0,  r, 0);
        const Afront = b.P(0, -r, 0);
        b.auxLine(Aback,  S, { color: '#3b7b9b', w: 1.5 });
        b.auxLine(Afront, S, { color: '#3b7b9b', w: 1.5 });
        b.auxLine(Aback,  Afront, { color: '#3b7b9b', w: 1.5 });
      }
      b.label(Aleft,  'A', -16, 14);
      b.label(Aright, 'B',   6, 14);
      b.label(S,      'S',   6, -4);
      return b.toSvg();
    },
  };

  // 10) Куля з великим колом
  TPL.sphere = {
    name: 'Куля',
    full: 'O · R',
    options: [
      { key: 'equator',    label: 'екватор' },
      { key: 'meridian',   label: 'меридіан' },
      { key: 'radius',     label: 'радіус OA' },
      { key: 'diameter',   label: 'діаметр AB' },
      { key: 'crossSect',  label: 'переріз площиною' },
    ],
    render(opts = {}) {
      const b = new Builder({ scale: 86, mode: 'vertical', yCompress: 0.36 });
      const r = 1;
      const O = b.P(0, 0, 0);
      // The "silhouette" of a sphere is a circle of radius r in screen space.
      // We add it as a SVG arc path (full circle) into the visible stroke set.
      b.visible.push(`M${(O.x - r*b.scale).toFixed(2)},${O.y.toFixed(2)} A${(r*b.scale).toFixed(2)},${(r*b.scale).toFixed(2)} 0 0 1 ${(O.x + r*b.scale).toFixed(2)},${O.y.toFixed(2)} A${(r*b.scale).toFixed(2)},${(r*b.scale).toFixed(2)} 0 0 1 ${(O.x - r*b.scale).toFixed(2)},${O.y.toFixed(2)}`);
      // include silhouette extremes in bbox
      b.allPts.push({ x: O.x - r*b.scale, y: O.y });
      b.allPts.push({ x: O.x + r*b.scale, y: O.y });
      b.allPts.push({ x: O.x, y: O.y - r*b.scale });
      b.allPts.push({ x: O.x, y: O.y + r*b.scale });

      if (opts.equator !== false) {
        // equator = circle in the XY-plane, projected as a flat ellipse.
        b.ellipseZ(0, 0, 0, r, 'full');
      }
      if (opts.meridian) {
        // meridian = circle in the XZ-plane (Y=0). In our projection, this is a true circle but with X scaled and Z scaled — actually it IS a circle in screen space because Y is in/out of screen.
        // Wait: the meridian is in plane Y=0, parametrized as (r*cos θ, 0, r*sin θ). Projection: (r cos θ, -r sin θ). So in screen it's a circle of radius r. But that's the same as the sphere's silhouette! So a meridian in plane Y=0 coincides with the silhouette.
        // Use a meridian in plane X=0 instead: (0, r cos θ, r sin θ). Projection: (yc * r cos θ * cos α, -r sin θ + yc * r cos θ * sin α). This is a tilted ellipse.
        const N = 80;
        const pts = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N * Math.PI * 2;
          pts.push(b.proj(0, r * Math.cos(t), r * Math.sin(t)));
        }
        // back half (cos t < 0 ↔ Y < 0 is FRONT in our convention... wait Y>0 is back)
        // For a meridian in plane X=0 with parameter t: Y = r cos t.
        // Y > 0 (cos t > 0) → BACK → dashed.
        // Y < 0 (cos t < 0) → FRONT → solid.
        const front = [], back = [];
        for (let i = 0; i <= N; i++) {
          const t = i / N * Math.PI * 2;
          if (Math.cos(t) <= 0) front.push(pts[i]); else back.push(pts[i]);
        }
        const toPath = (P) => P.length ? 'M' + P.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L') : '';
        const fd = toPath(front), bd = toPath(back);
        if (fd) b.visible.push(fd);
        if (bd) b.hidden.push(bd);
        b.allPts.push(...pts);
      }
      if (opts.radius || opts.diameter) {
        // Draw radius from O to a point on surface. Pick point at (r, 0, 0) (right equator).
        const A = b.P(r, 0, 0);
        b.auxLine(O, A, { color: '#c4622a', w: 1.4 });
        b.dot(A); b.label(A, 'A', 6, 14);
      }
      if (opts.diameter) {
        const Aleft = b.P(-r, 0, 0);
        b.auxLine(O, Aleft, { color: '#c4622a', w: 1.4 });
        b.dot(Aleft); b.label(Aleft, 'B', -14, 14);
      }
      if (opts.crossSect) {
        // Horizontal cross-section at z = r/2 — a circle of radius r·√3/2
        const zSec = r * 0.5;
        const rSec = r * Math.sqrt(3) / 2;
        b.ellipseZ(0, 0, zSec, rSec, 'full');
        // Mark the section's plane radius
        const Asec = b.P(rSec, 0, zSec);
        const Osec = b.P(0, 0, zSec);
        b.dot(Osec); b.label(Osec, "O'", 6, -4);
      }
      b.dot(O); b.label(O, 'O', 5, -4);
      return b.toSvg();
    },
  };

  // 11) Зрізаний конус
  TPL.truncCone = {
    name: 'Зрізаний конус',
    full: 'O₁O · r, R',
    options: [
      { key: 'axis',      label: 'вісь OO₁' },
      { key: 'axialSect', label: 'осьовий переріз' },
    ],
    render(opts = {}) {
      const b = new Builder({ scale: 72, mode: 'vertical', yCompress: 0.32 });
      const R = 1, r = 0.5, h = 1.4;
      const O = b.P(0, 0, 0);
      const O1 = b.P(0, 0, h);
      // Top and bottom circles
      b.ellipseZ(0, 0, 0, R, 'full');
      b.ellipseZ(0, 0, h, r, 'allSolid');
      // Lateral generators on silhouette (X=±R bottom, X=±r top, BUT silhouette is a straight line tangent to both circles in screen)
      // For cabinet projection (no perspective), the silhouette generator goes from (-R, 0, 0) to (-r, 0, h) and similarly on the right. These ARE the world-extreme points on each circle projected.
      const Abot_left  = b.P(-R, 0, 0);
      const Abot_right = b.P( R, 0, 0);
      const Atop_left  = b.P(-r, 0, h);
      const Atop_right = b.P( r, 0, h);
      b.edge(Abot_left, Atop_left);
      b.edge(Abot_right, Atop_right);
      if (opts.axis) {
        b.auxLine(O, O1, { color: '#c4622a', w: 1.4, dash: '8 3 1 3' });
        b.dot(O); b.dot(O1);
        b.label(O, 'O', 6, 14);
        b.label(O1, 'O₁', 6, -4);
      }
      if (opts.axialSect) {
        const Bf = b.P(0, -R, 0), Bb = b.P(0, R, 0);
        const Tf = b.P(0, -r, h), Tb = b.P(0, r, h);
        b.auxLine(Bf, Tf, { color: '#3b7b9b', w: 1.5 });
        b.auxLine(Bb, Tb, { color: '#3b7b9b', w: 1.5 });
        b.auxLine(Tf, Tb, { color: '#3b7b9b', w: 1.5 });
        b.auxLine(Bf, Bb, { color: '#3b7b9b', w: 1.5 });
      }
      b.label(Abot_left,  'A', -16, 14);
      b.label(Abot_right, 'B',   6, 14);
      b.label(Atop_left,  'A₁', -22, -4);
      b.label(Atop_right, 'B₁',   6, -4);
      return b.toSvg();
    },
  };

  // 12) Правильна 4-кутна призма (квадрат в основі, інший від куба за пропорцією)
  TPL.prism4 = {
    name: 'Правильна 4-кутна призма',
    full: 'ABCDA₁B₁C₁D₁',
    options: [
      { key: 'height',  label: 'висота' },
      { key: 'sectional', label: 'діагональний переріз' },
    ],
    render(opts = {}) {
      const b = new Builder({ scale: 80 });
      const a = 1, h = 1.6;
      const A = b.P(0,0,0), B = b.P(a,0,0), C = b.P(a,a,0), D = b.P(0,a,0);
      const A1 = b.P(0,0,h), B1 = b.P(a,0,h), C1 = b.P(a,a,h), D1 = b.P(0,a,h);
      [[A,B],[B,C],[A1,B1],[B1,C1],[C1,D1],[D1,A1],[A,A1],[B,B1],[C,C1]].forEach(([p,q]) => b.edge(p,q));
      [[A,D],[D,C],[D,D1]].forEach(([p,q]) => b.edge(p,q,'hid'));
      if (opts.height) {
        const Ob = b.P(a/2, a/2, 0), Ot = b.P(a/2, a/2, h);
        b.auxLine(Ob, Ot, { color: '#c4622a', w: 1.4, dash: '8 3 1 3' });
        b.dot(Ob); b.dot(Ot);
        b.label(Ob, 'O', 4, 14);
        b.label(Ot, 'O₁', 4, -4);
      }
      if (opts.sectional) {
        // Diagonal cross-section AB₁C₁D (a rectangle through opposite edges)
        b.auxLine(A, C1, { color: '#3b7b9b', w: 1.4 });
        b.auxLine(A, B1, { color: '#3b7b9b', w: 1, dash: '3 3' });
        b.auxLine(B1, C1, { color: '#3b7b9b', w: 1, dash: '3 3' });
      }
      b.label(A, 'A',  -14, 14);
      b.label(B, 'B',   4, 14);
      b.label(C, 'C',   6, 10);
      b.label(D, 'D', -10, 14);
      b.label(A1, 'A₁', -18, -6);
      b.label(B1, 'B₁',  4, -6);
      b.label(C1, 'C₁',  6, -4);
      b.label(D1, 'D₁', -22, -4);
      return b.toSvg();
    },
  };

  window.NMT_TEMPLATES = TPL;
})();

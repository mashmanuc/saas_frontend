// nmt-3d.js — 3D NMT stereometry templates with parametric handles and a drawing layer.
//
// Architecture:
//   - Pure SVG renderer (keeps NMT/ZNO paper aesthetic — thin black solid edges,
//     dashed hidden edges, italic serif labels — but with a real 3D camera).
//   - Orbit camera (yaw, pitch, distance), orthographic projection.
//   - Each template defines parameters (a, b, c, h, r…), vertices/faces/edges as
//     functions of those parameters, and a list of drag-handles.
//   - Handles are constrained to *gradients* in world space — e.g. the apex of a
//     regular pyramid only moves vertically, a base corner only moves along its
//     horizontal diagonal — so the shape stays "natural" (правильна піраміда
//     лишається правильною; куб лишається кубом).
//   - Two modes:
//       'adapt' — handles visible, orbit + drag handles enabled
//       'draw'  — handles hidden, shape frozen, pen layer captures strokes
//
// Public API: window.NMT3D = { TEMPLATES, Workspace }
(function () {
  // ========== vector math ==========
  function v3(x, y, z) { return { x, y, z }; }
  function add(a, b) { return v3(a.x + b.x, a.y + b.y, a.z + b.z); }
  function sub(a, b) { return v3(a.x - b.x, a.y - b.y, a.z - b.z); }
  function scl(a, s) { return v3(a.x * s, a.y * s, a.z * s); }
  function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
  function cross(a, b) {
    return v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  }
  function len(a) { return Math.hypot(a.x, a.y, a.z); }
  function nrm(a) { const L = len(a) || 1; return v3(a.x / L, a.y / L, a.z / L); }
  function lerp(a, b, t) { return v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t); }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

  // Rotate point `p` around axis going through `axisPt` with direction `axisDir`, by `angle` rad.
  // Rodrigues' rotation formula. Right-hand rule.
  function rotAxis(p, axisPt, axisDir, angle) {
    const k = nrm(axisDir);
    const v = sub(p, axisPt);
    const cs = Math.cos(angle), sn = Math.sin(angle);
    const t1 = scl(v, cs);
    const t2 = scl(cross(k, v), sn);
    const t3 = scl(k, dot(k, v) * (1 - cs));
    return add(axisPt, add(t1, add(t2, t3)));
  }

  // Push edges of a closed polygon into the edges accumulator.
  function polyEdges(pts, edges) {
    for (let i = 0; i < pts.length; i++) {
      edges.push([pts[i], pts[(i + 1) % pts.length]]);
    }
  }
  // Unfold an n-gonal regular pyramid: triangles hinge around base edges.
  // Returns { edges, apexAt }. apexAt = list of unfolded apex positions per face.
  function unfoldNgonalPyramid(baseRing, apex, t, r_in) {
    const edges = [];
    polyEdges(baseRing, edges);
    const n = baseRing.length;
    const target = Math.PI - Math.atan2(apex.y, r_in);
    const ang = t * target;
    const apexAt = [];
    for (let i = 0; i < n; i++) {
      const P1 = baseRing[i], P2 = baseRing[(i + 1) % n];
      const Sf = rotAxis(apex, P1, sub(P2, P1), ang);
      edges.push([P1, Sf]);
      edges.push([P2, Sf]);
      apexAt.push(Sf);
    }
    return { edges, apexAt };
  }
  // Unfold an n-gonal regular prism: lateral rectangles hinge around base edges,
  // top n-gon hinges from one chosen lateral's top edge.
  function unfoldNgonalPrism(baseRing, h, t) {
    const edges = [];
    const n = baseRing.length;
    polyEdges(baseRing, edges);
    const topOrig = baseRing.map(p => v3(p.x, p.y + h, p.z));
    const Phi = t * Math.PI / 2;
    for (let i = 0; i < n; i++) {
      const A = baseRing[i], B = baseRing[(i + 1) % n];
      const A1 = topOrig[i], B1 = topOrig[(i + 1) % n];
      const A1p = rotAxis(A1, A, sub(B, A), Phi);
      const B1p = rotAxis(B1, A, sub(B, A), Phi);
      polyEdges([A, B, B1p, A1p], edges);
    }
    // Top n-gon attached to lateral 0; double-rotation
    const A0 = baseRing[0], B0 = baseRing[1];
    const phase1 = topOrig.map(p => rotAxis(p, A0, sub(B0, A0), Phi));
    const hA = phase1[0], hB = phase1[1];
    const topFinal = phase1.map(p => rotAxis(p, hA, sub(hB, hA), Phi));
    polyEdges(topFinal, edges);
    return { edges, topFinal };
  }

  // Plane ∩ cube → ordered polygon vertices.
  // V — vertex dict {A, B, C, D, A1, B1, C1, D1}, planePts — 3 points defining the plane.
  function computeCubeSection(V, planePts) {
    const edges = [
      ['A','B'],['B','C'],['C','D'],['D','A'],
      ['A1','B1'],['B1','C1'],['C1','D1'],['D1','A1'],
      ['A','A1'],['B','B1'],['C','C1'],['D','D1'],
    ];
    const P0 = planePts[0];
    const n = cross(sub(planePts[1], P0), sub(planePts[2], P0));
    if (Math.hypot(n.x, n.y, n.z) < 1e-9) return planePts.slice();
    const dP = dot(n, P0);
    const ints = [];
    for (const [a, b] of edges) {
      const A = V[a], B = V[b];
      const denom = dot(n, sub(B, A));
      if (Math.abs(denom) < 1e-9) continue;
      const t = (dP - dot(n, A)) / denom;
      if (t < -1e-6 || t > 1 + 1e-6) continue;
      const tc = Math.max(0, Math.min(1, t));
      ints.push({
        x: A.x + tc * (B.x - A.x),
        y: A.y + tc * (B.y - A.y),
        z: A.z + tc * (B.z - A.z),
      });
    }
    // dedup
    const dedup = [];
    for (const p of ints) {
      if (!dedup.some(q =>
        Math.abs(q.x - p.x) < 1e-4 &&
        Math.abs(q.y - p.y) < 1e-4 &&
        Math.abs(q.z - p.z) < 1e-4
      )) dedup.push(p);
    }
    if (dedup.length < 3) return dedup;
    // Sort by angle around centroid in plane
    let cx = 0, cy = 0, cz = 0;
    for (const p of dedup) { cx += p.x; cy += p.y; cz += p.z; }
    cx /= dedup.length; cy /= dedup.length; cz /= dedup.length;
    const centroid = v3(cx, cy, cz);
    const nU = nrm(n);
    const uRaw = sub(dedup[0], centroid);
    const npp = dot(uRaw, nU);
    const u = nrm(v3(uRaw.x - nU.x * npp, uRaw.y - nU.y * npp, uRaw.z - nU.z * npp));
    const w = cross(nU, u);
    dedup.sort((p1, p2) => {
      const d1 = sub(p1, centroid), d2 = sub(p2, centroid);
      return Math.atan2(dot(d1, w), dot(d1, u)) - Math.atan2(dot(d2, w), dot(d2, u));
    });
    return dedup;
  }

  // ========== camera / projection ==========
  // World axes: X right, Y up, Z out of screen.
  // Camera orbit: yaw (around Y), pitch (around X). Orthographic projection.
  function project(P, cam) {
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const x1 =  P.x * cy + P.z * sy;
    const y1 =  P.y;
    const z1 = -P.x * sy + P.z * cy;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const x2 =  x1;
    const y2 =  y1 * cp - z1 * sp;
    const z2 =  y1 * sp + z1 * cp;
    return { x: x2 * cam.scale, y: -y2 * cam.scale, z: z2 };
  }
  // Rotate a direction by camera angles (same as project, without scaling).
  function rotateByCam(d, cam) {
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const x1 =  d.x * cy + d.z * sy;
    const y1 =  d.y;
    const z1 = -d.x * sy + d.z * cy;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const x2 =  x1;
    const y2 =  y1 * cp - z1 * sp;
    const z2 =  y1 * sp + z1 * cp;
    return v3(x2, y2, z2);
  }

  // ========== curved-body silhouette helpers ==========
  // Project a circle in a horizontal plane (XZ at height y) — returns a sampled polyline.
  function projectHorizCircle(cy_, r, y_, cam, N = 64) {
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2;
      const P = v3(r * Math.cos(t), y_, r * Math.sin(t));
      pts.push(project(P, cam));
    }
    return pts;
  }
  // Split a closed projected curve into "front" (visible) and "back" (hidden) parts.
  // For curves on a horizontal plane, the silhouette divider is the pair of points
  // where the tangent to the projected ellipse is vertical — i.e. extremes of x.
  // Simpler: a point on the circle is visible if its projected z-depth is *less* than
  // the depth of the body's opposite point at the same screen-x. For a thin horizontal
  // ring, the visible half is just whichever half is in front (smaller world-Z after camera rotation).
  function frontBackOfRing(ringPts) {
    // Find indices where consecutive points cross the silhouette (max/min screen-x).
    // We'll compute screen-x extremes:
    let iMin = 0, iMax = 0;
    for (let i = 1; i < ringPts.length; i++) {
      if (ringPts[i].x < ringPts[iMin].x) iMin = i;
      if (ringPts[i].x > ringPts[iMax].x) iMax = i;
    }
    // The visible (front) arc is the one with smaller depths (closer to camera, smaller z after rotation).
    // After rotation, the "closer" side has the LARGER z (in our convention camera looks toward -Z and z2 is the rotated depth; bigger z2 = closer? Actually we defined z2 as world-after-rotation; camera fixed at +Z so larger z2 = closer to camera).
    const lo = Math.min(iMin, iMax), hi = Math.max(iMin, iMax);
    const arcA = ringPts.slice(lo, hi + 1);
    const arcB = ringPts.slice(hi).concat(ringPts.slice(0, lo + 1));
    const meanZ = (arr) => arr.reduce((s, p) => s + p.z, 0) / arr.length;
    const aFront = meanZ(arcA) > meanZ(arcB);
    return { front: aFront ? arcA : arcB, back: aFront ? arcB : arcA, splitA: ringPts[iMin], splitB: ringPts[iMax] };
  }
  function polylineToPath(pts) {
    if (!pts.length) return '';
    return 'M' + pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' L');
  }

  // Radially-outward label offset for procedural n-gon templates.
  // 'isTop' shifts up for the top ring of a prism.
  function _ngonLabelOff(x, z, r, isTop) {
    const nx = r > 1e-9 ? x / r : 0;
    const nz = r > 1e-9 ? z / r : 0;
    return {
      x: Math.round(nx * 18),
      y: isTop ? Math.round(-nz * 10 - 8) : Math.round(nz * 14 + 6),
    };
  }

  // ========== TEMPLATES ==========
  // Each template:
  //   key, name, full (formal label like ABCDA₁B₁C₁D₁)
  //   params: { key: { value, min, max, label } }
  //   aux:    [{ key, label }]  — toggles for height / apothem / cross-sections
  //   build(p, opts) -> {
  //     kind: 'poly' | 'cylinder' | 'cone' | 'sphere',
  //     V: { name → world Vec3 },                — named vertices
  //     E: [[name, name], ...],                  — edges (poly only)
  //     F: [[name, name, name, ...], ...],       — faces (poly only, CCW outward)
  //     labels: [{ pos, text, dot?, offset? }],  — letters to draw
  //     handles: [{ id, worldPos, axis, paramKey, factor?, hint }],
  //     aux:    [{ kind:'line'|'poly'|'arc', ..., style }],
  //     curved: { ... }                           — extras for cyl/cone/sphere
  //   }
  const TEMPLATES = {};

  // ---- 1) Куб ----
  TEMPLATES.cube = {
    key: 'cube',
    name: 'Куб',
    full: 'ABCDA₁B₁C₁D₁',
    params: { a: { value: 1.6, min: 0.6, max: 2.6, label: 'a' } },
    aux: [
      { key: 'bodyDiag',  label: 'діагональ AC₁' },
      { key: 'faceDiag',  label: 'діагональ грані A₁C₁' },
      { key: 'diagSect',  label: 'переріз AB₁C₁D' },
      { key: 'center',    label: 'центр O' },
      { key: 'baseInc',   label: 'вписане коло основи' },
      { key: 'baseCirc',  label: 'описане коло основи' },
    ],
    build(p, opts = {}) {
      const h = p.a / 2;
      const V = {
        A:  v3(-h, -h,  h), B:  v3( h, -h,  h), C:  v3( h, -h, -h), D:  v3(-h, -h, -h),
        A1: v3(-h,  h,  h), B1: v3( h,  h,  h), C1: v3( h,  h, -h), D1: v3(-h,  h, -h),
      };
      const E = [
        ['A','B'],['B','C'],['C','D'],['D','A'],
        ['A1','B1'],['B1','C1'],['C1','D1'],['D1','A1'],
        ['A','A1'],['B','B1'],['C','C1'],['D','D1'],
      ];
      const F = [
        ['A','B','C','D'],          // bottom (normal -Y)
        ['A1','D1','C1','B1'],      // top    (normal +Y)
        ['A','A1','B1','B'],        // front  (normal +Z)
        ['D','C','C1','D1'],        // back   (normal -Z)
        ['B','B1','C1','C'],        // right  (normal +X)
        ['A','D','D1','A1'],        // left   (normal -X)
      ];
      const labels = [
        { pos: V.A, text: 'A', off: { x: -8, y: 18 } },
        { pos: V.B, text: 'B', off: { x: 10, y: 18 } },
        { pos: V.C, text: 'C', off: { x: 12, y: 14 } },
        { pos: V.D, text: 'D', off: { x: -12, y: 14 } },
        { pos: V.A1, text: 'A₁', off: { x: -18, y: -8 } },
        { pos: V.B1, text: 'B₁', off: { x: 10, y: -8 } },
        { pos: V.C1, text: 'C₁', off: { x: 12, y: -6 } },
        { pos: V.D1, text: 'D₁', off: { x: -22, y: -6 } },
      ];
      // single handle at corner B1 — drags along the body diagonal (uniform scale)
      const handles = [
        {
          id: 'size', paramKey: 'a',
          worldPos: V.B1,
          // d(corner)/d(a) at B1 = (1/2, 1/2, -1/2)... wait B1 = (h, h, h) with h=a/2 → gradient = (0.5, 0.5, 0.5)
          // Actually B1 = (h, h, h)? No — A1=(-h,-h,h), B1=(h,h,h)? Let me recheck.
          // Bottom: A(-h,-h,h), B(h,-h,h), C(h,-h,-h), D(-h,-h,-h)
          // Top:    A1(-h,h,h), B1(h,h,h), C1(h,h,-h), D1(-h,h,-h)
          // So B1=(h,h,h), and d(B1)/d(a) = (1/2, 1/2, 1/2). Good.
          gradient: v3(0.5, 0.5, 0.5),
          hint: 'тягни — ребро a',
        },
      ];
      const aux = [];
      if (opts.bodyDiag) aux.push({ kind: 'line', from: V.A, to: V.C1, color: '#c4622a', w: 2 });
      if (opts.faceDiag) aux.push({ kind: 'line', from: V.A1, to: V.C1, color: '#7b6193', w: 1.6, dash: '5 3' });
      if (opts.diagSect) {
        aux.push({ kind: 'poly', pts: [V.A, V.B1, V.C1, V.D], color: '#3b7b9b', fill: '#3b7b9b', fillOpacity: 0.13, w: 1.8 });
      }
      if (opts.center) {
        const O = v3(0, 0, 0);
        labels.push({ pos: O, text: 'O', off: { x: 6, y: 4 }, dot: true });
      }
      if (opts.baseInc) aux.push({ kind: 'horizCircle', y: -h, radius: h, color: '#7b6193', w: 1.4, dash: '3 3' });
      if (opts.baseCirc) aux.push({ kind: 'horizCircle', y: -h, radius: h * Math.SQRT2, color: '#3a8a4f', w: 1.4 });
      return { kind: 'poly', V, E, F, labels, handles, aux };
    },
  };

  // ---- 2) Прямокутний паралелепіпед ----
  TEMPLATES.cube.buildUnfolded = function (p, t) {
    const a = p.a;
    const h = a / 2;
    const ring = [
      v3(-h, -h,  h), v3( h, -h,  h),
      v3( h, -h, -h), v3(-h, -h, -h),
    ];
    const result = unfoldNgonalPrism(ring, a, t);
    return {
      kind: 'unfolded',
      edges: result.edges,
      labels: [],
      preferredView: { yaw: 0, pitch: Math.PI/2 - 0.001 },
    };
  };


  TEMPLATES.cuboid = {
    key: 'cuboid',
    name: 'Прямокутний паралелепіпед',
    full: 'ABCDA₁B₁C₁D₁',
    params: {
      a: { value: 2.0, min: 0.6, max: 3.0, label: 'a' },
      b: { value: 1.3, min: 0.6, max: 3.0, label: 'b' },
      c: { value: 1.6, min: 0.6, max: 3.0, label: 'c' },
    },
    aux: [
      { key: 'bodyDiag', label: 'діагональ AC₁' },
      { key: 'diagSect', label: 'переріз AB₁C₁D' },
      { key: 'sides',    label: 'позначити a, b, c' },
      { key: 'baseCirc', label: 'описане коло основи' },
    ],
    build(p, opts = {}) {
      const a = p.a / 2, b = p.b / 2, c = p.c / 2;
      // X = a, Z = b (depth), Y = c (height)
      const V = {
        A:  v3(-a, -c,  b), B:  v3( a, -c,  b), C:  v3( a, -c, -b), D:  v3(-a, -c, -b),
        A1: v3(-a,  c,  b), B1: v3( a,  c,  b), C1: v3( a,  c, -b), D1: v3(-a,  c, -b),
      };
      const E = [
        ['A','B'],['B','C'],['C','D'],['D','A'],
        ['A1','B1'],['B1','C1'],['C1','D1'],['D1','A1'],
        ['A','A1'],['B','B1'],['C','C1'],['D','D1'],
      ];
      const F = [
        ['A','B','C','D'],
        ['A1','D1','C1','B1'],
        ['A','A1','B1','B'],
        ['D','C','C1','D1'],
        ['B','B1','C1','C'],
        ['A','D','D1','A1'],
      ];
      const labels = [
        { pos: V.A, text: 'A', off: { x: -8, y: 18 } },
        { pos: V.B, text: 'B', off: { x: 10, y: 18 } },
        { pos: V.C, text: 'C', off: { x: 12, y: 14 } },
        { pos: V.D, text: 'D', off: { x: -12, y: 14 } },
        { pos: V.A1, text: 'A₁', off: { x: -18, y: -8 } },
        { pos: V.B1, text: 'B₁', off: { x: 10, y: -8 } },
        { pos: V.C1, text: 'C₁', off: { x: 12, y: -6 } },
        { pos: V.D1, text: 'D₁', off: { x: -22, y: -6 } },
      ];
      // 3 handles, each on a midpoint of an edge along its axis
      const handles = [
        // a — midpoint of AB → moves along +X
        { id: 'a', paramKey: 'a', worldPos: v3(a, -c, b), gradient: v3(0.5, 0, 0), hint: 'a' },
        // b — midpoint of BC → moves along -Z (B is at z=b, C at z=-b, midpoint at z=0; but we want depth control → use back-right edge midpoint)
        // Better: midpoint of B-C is at (a, -c, 0) — moves along Z when b changes? d(midpoint)/d(b) = (0, 0, 0). No.
        // Let's use vertex C: C=(a, -c, -b). d(C)/d(b) = (0, 0, -0.5). Drag C along -Z.
        // Even cleaner — midpoint of CB edge gives (a, -c, 0) with no dependency. Use C corner.
        { id: 'b', paramKey: 'b', worldPos: v3(a, -c, -b), gradient: v3(0, 0, -0.5), hint: 'b' },
        // c — midpoint of AA1 → (-a, 0, b), d/dc = (0, 0.5, 0)... we want top of A1 to grow upward
        // Use top corner of edge — let's use midpoint of edge BB1 → (a, 0, b), d/dc = (0, 0.5, 0). Good.
        { id: 'c', paramKey: 'c', worldPos: v3(a, 0, b), gradient: v3(0, 0.5, 0), hint: 'c' },
      ];
      const aux = [];
      if (opts.bodyDiag) aux.push({ kind: 'line', from: V.A, to: V.C1, color: '#c4622a', w: 2 });
      if (opts.diagSect) aux.push({ kind: 'poly', pts: [V.A, V.B1, V.C1, V.D], color: '#3b7b9b', fill: '#3b7b9b', fillOpacity: 0.13, w: 1.8 });
      if (opts.sides) {
        labels.push({ pos: lerp(V.A, V.B, 0.5), text: 'a', off: { x: 0, y: 22 }, italic: true });
        labels.push({ pos: lerp(V.B, V.C, 0.5), text: 'b', off: { x: 16, y: 12 }, italic: true });
        labels.push({ pos: lerp(V.B, V.B1, 0.5), text: 'c', off: { x: 14, y: 4 }, italic: true });
      }
      if (opts.baseCirc) {
        const rOut = Math.hypot(p.a, p.b) / 2;
        aux.push({ kind: 'horizCircle', y: -c, radius: rOut, color: '#3a8a4f', w: 1.4 });
      }
      return { kind: 'poly', V, E, F, labels, handles, aux };
    },
  };

  // ---- 3) Правильна 4-кутна піраміда ----
  TEMPLATES.cuboid.buildUnfolded = function (p, t) {
    const ax = p.a / 2, by = p.c / 2, cz = p.b / 2;
    const ring = [
      v3(-ax, -by,  cz), v3( ax, -by,  cz),
      v3( ax, -by, -cz), v3(-ax, -by, -cz),
    ];
    const result = unfoldNgonalPrism(ring, p.c, t);
    return {
      kind: 'unfolded',
      edges: result.edges,
      labels: [],
      preferredView: { yaw: 0, pitch: Math.PI/2 - 0.001 },
    };
  };


  // Coordinates: base at y=0, apex at y=h (so apex worldPos depends linearly on h
  //   → handle gradient is simple (0,1,0), drag feels 1:1).
  TEMPLATES.pyramid4 = {
    key: 'pyramid4',
    name: 'Правильна 4-кутна піраміда',
    full: 'SABCD',
    params: {
      a: { value: 1.8, min: 0.6, max: 2.8, label: 'a' },
      h: { value: 1.8, min: 0.4, max: 3.2, label: 'h' },
    },
    aux: [
      { key: 'height',  label: 'висота SO' },
      { key: 'apothem', label: 'апофема SM' },
      { key: 'diags',   label: 'діагоналі основи' },
      { key: 'axSect',  label: 'осьовий переріз SAC' },
      { key: 'baseInc',  label: 'вписане коло основи' },
      { key: 'baseCirc', label: 'описане коло основи' },
    ],
  };
  TEMPLATES.pyramid4.build = function (p, opts = {}) {
    const a = p.a / 2;
    const V = {
      A:  v3(-a, 0,  a),
      B:  v3( a, 0,  a),
      C:  v3( a, 0, -a),
      D:  v3(-a, 0, -a),
      S:  v3( 0, p.h,  0),
      O:  v3( 0, 0,  0),
    };
    const E = [
      ['A','B'],['B','C'],['C','D'],['D','A'],
      ['S','A'],['S','B'],['S','C'],['S','D'],
    ];
    const F = [
      ['A','B','C','D'],
      ['S','B','A'],
      ['S','C','B'],
      ['S','D','C'],
      ['S','A','D'],
    ];
    const labels = [
      { pos: V.A, text: 'A', off: { x: -8, y: 18 } },
      { pos: V.B, text: 'B', off: { x: 10, y: 18 } },
      { pos: V.C, text: 'C', off: { x: 12, y: 14 } },
      { pos: V.D, text: 'D', off: { x: -12, y: 14 } },
      { pos: V.S, text: 'S', off: { x: 8, y: -6 } },
    ];
    const handles = [
      // apex S — moves vertically only, controls h
      { id: 'h', paramKey: 'h', worldPos: V.S, gradient: v3(0, 1, 0), hint: 'висота h' },
      // base corner B — moves along base-diagonal (regular pyramid stays regular). B=(a,0,a) so dB/da = (0.5, 0, 0.5)
      { id: 'a', paramKey: 'a', worldPos: V.B, gradient: v3(0.5, 0, 0.5), hint: 'ребро a' },
    ];
    const aux = [];
    if (opts.axSect) {
      aux.push({ kind: 'poly', pts: [V.A, V.C, V.S], color: '#3b7b9b', fill: '#3b7b9b', fillOpacity: 0.13, w: 1.8 });
    }
    if (opts.height) {
      aux.push({ kind: 'line', from: V.S, to: V.O, color: '#c4622a', w: 1.6, dash: '7 3 1 3' });
      labels.push({ pos: V.O, text: 'O', off: { x: 6, y: 14 }, dot: true });
      aux.push({ kind: 'rightAngle', at: V.O, dir1: v3(0,1,0), dir2: v3(1,0,0), size: 0.18 });
    }
    if (opts.apothem) {
      const M = v3(0, 0, a);  // midpoint of AB
      aux.push({ kind: 'line', from: V.S, to: M, color: '#3b7b9b', w: 1.6 });
      labels.push({ pos: M, text: 'M', off: { x: -10, y: 16 }, dot: true });
    }
    if (opts.diags) {
      aux.push({ kind: 'line', from: V.A, to: V.C, color: '#7b6193', w: 1.1, dash: '3 3' });
      aux.push({ kind: 'line', from: V.B, to: V.D, color: '#7b6193', w: 1.1, dash: '3 3' });
    }
    if (opts.baseInc) aux.push({ kind: 'horizCircle', y: 0, radius: p.a / 2, color: '#7b6193', w: 1.4, dash: '3 3' });
    if (opts.baseCirc) aux.push({ kind: 'horizCircle', y: 0, radius: p.a * Math.SQRT2 / 2, color: '#3a8a4f', w: 1.4 });
    return { kind: 'poly', V, E, F, labels, handles, aux };
  };

  // Net unfolding for pyramid4 — each lateral face rotates about its base edge.
  // t ∈ [0, 1]. At t=1, all 4 lateral triangles lie flat in the base plane.
  TEMPLATES.pyramid4.buildUnfolded = function (p, t) {
    const a = p.a / 2;
    const r_in = a;  // perpendicular distance from base center to base edge midpoint
    const targetAngle = Math.PI - Math.atan2(p.h, r_in);
    const ang = t * targetAngle;

    const A = v3(-a, 0,  a), B = v3( a, 0,  a);
    const C = v3( a, 0, -a), D = v3(-a, 0, -a);
    const S = v3( 0, p.h, 0);

    // For each base edge → unfolded apex position. Hinge direction matters:
    // we need rotation that moves apex AWAY from the base center. CCW base
    // ordering when viewed from below the apex makes this work.
    const S_front = rotAxis(S, A, sub(B, A), ang);  // front edge A→B
    const S_right = rotAxis(S, B, sub(C, B), ang);  // right edge B→C
    const S_back  = rotAxis(S, C, sub(D, C), ang);  // back  edge C→D
    const S_left  = rotAxis(S, D, sub(A, D), ang);  // left  edge D→A

    // Edges to draw (each face contributes 2 outer edges + 1 base edge,
    // but base edges are shared with the base square).
    const edges = [
      // base
      [A, B], [B, C], [C, D], [D, A],
      // front face
      [A, S_front], [B, S_front],
      // right face
      [B, S_right], [C, S_right],
      // back face
      [C, S_back],  [D, S_back],
      // left face
      [D, S_left],  [A, S_left],
    ];
    // Apex labels — only show when nearly fully unfolded (less clutter mid-anim)
    const labels = [];
    if (t > 0.85) {
      labels.push({ pos: S_front, text: 'S', off: { x: 0, y: -8 } });
      labels.push({ pos: S_right, text: 'S', off: { x: 10, y: 4 } });
      labels.push({ pos: S_back,  text: 'S', off: { x: 0, y: 16 } });
      labels.push({ pos: S_left,  text: 'S', off: { x: -14, y: 4 } });
    } else if (t < 0.15) {
      // near-closed: show original labels
      labels.push({ pos: A, text: 'A', off: { x: -8, y: 18 } });
      labels.push({ pos: B, text: 'B', off: { x: 10, y: 18 } });
      labels.push({ pos: C, text: 'C', off: { x: 12, y: 14 } });
      labels.push({ pos: D, text: 'D', off: { x: -12, y: 14 } });
      labels.push({ pos: S, text: 'S', off: { x: 8, y: -6 } });
    }
    // For depth-sorting / hidden-line in unfolded mode, just draw all edges as visible.
    // This is acceptable since the unfolded shape is flat.
    return { kind: 'unfolded', edges, labels };
  };

  // ---- 4) Правильна 3-кутна піраміда ----
  TEMPLATES.pyramid3 = {
    key: 'pyramid3',
    name: 'Правильна 3-кутна піраміда',
    full: 'SABC',
    params: {
      a: { value: 1.8, min: 0.6, max: 2.6, label: 'a' },
      h: { value: 1.7, min: 0.4, max: 3.0, label: 'h' },
    },
    aux: [
      { key: 'height',  label: 'висота SO' },
      { key: 'apothem', label: 'апофема SM' },
      { key: 'median',  label: 'медіана CM' },
      { key: 'axSect',  label: 'осьовий переріз SCM' },
      { key: 'baseInc',  label: 'вписане коло основи' },
      { key: 'baseCirc', label: 'описане коло основи' },
    ],
    build(p, opts = {}) {
      const a = p.a;
      const sqrt3 = Math.sqrt(3);
      // equilateral base centered at origin in XZ plane
      // vertices A(-a/2, 0, a√3/6), B(a/2, 0, a√3/6), C(0, 0, -a√3/3)
      const r_in = a * sqrt3 / 6;       // distance from centroid to edge midpoint
      const r_out = a * sqrt3 / 3;      // distance from centroid to vertex
      const A = v3(-a/2, 0,  r_in);
      const B = v3( a/2, 0,  r_in);
      const C = v3( 0,   0, -r_out);
      const S = v3( 0, p.h, 0);
      const O = v3( 0, 0, 0);
      const V = { A, B, C, S, O };
      const E = [['A','B'],['B','C'],['C','A'], ['S','A'],['S','B'],['S','C']];
      const F = [
        ['A','B','C'],
        ['S','B','A'],
        ['S','C','B'],
        ['S','A','C'],
      ];
      const labels = [
        { pos: A, text: 'A', off: { x: -10, y: 16 } },
        { pos: B, text: 'B', off: { x: 8, y: 16 } },
        { pos: C, text: 'C', off: { x: 10, y: 4 } },
        { pos: S, text: 'S', off: { x: 8, y: -6 } },
      ];
      const handles = [
        { id: 'h', paramKey: 'h', worldPos: S, gradient: v3(0, 1, 0), hint: 'висота h' },
        // vertex A moves along its own radial direction in base plane: d(A)/d(a) = (-0.5, 0, √3/6)
        { id: 'a', paramKey: 'a', worldPos: A, gradient: v3(-0.5, 0, sqrt3/6), hint: 'ребро a' },
      ];
      const aux = [];
      const M = v3(0, 0, r_in);  // midpoint of AB
      if (opts.axSect) {
        aux.push({ kind: 'poly', pts: [C, M, S], color: '#3b7b9b', fill: '#3b7b9b', fillOpacity: 0.13, w: 1.8 });
        labels.push({ pos: M, text: 'M', off: { x: -10, y: 16 }, dot: true });
      }
      if (opts.height) {
        aux.push({ kind: 'line', from: S, to: O, color: '#c4622a', w: 1.6, dash: '7 3 1 3' });
        labels.push({ pos: O, text: 'O', off: { x: 6, y: 14 }, dot: true });
      }
      if (opts.apothem) {
        aux.push({ kind: 'line', from: S, to: M, color: '#3b7b9b', w: 1.6 });
        if (!opts.axSect) labels.push({ pos: M, text: 'M', off: { x: -10, y: 16 }, dot: true });
      }
      if (opts.median && !opts.apothem && !opts.axSect) {
        aux.push({ kind: 'line', from: C, to: M, color: '#7b6193', w: 1.1, dash: '3 3' });
        labels.push({ pos: M, text: 'M', off: { x: -10, y: 16 }, dot: true });
      }
      if (opts.baseInc) aux.push({ kind: 'horizCircle', y: 0, radius: p.a * Math.sqrt(3) / 6, color: '#7b6193', w: 1.4, dash: '3 3' });
      if (opts.baseCirc) aux.push({ kind: 'horizCircle', y: 0, radius: p.a * Math.sqrt(3) / 3, color: '#3a8a4f', w: 1.4 });
      return { kind: 'poly', V, E, F, labels, handles, aux };
    },
  };

  // ---- 5) Правильна 4-кутна призма ----
  TEMPLATES.pyramid3.buildUnfolded = function (p, t) {
    const a = p.a;
    const sq3 = Math.sqrt(3);
    const r_in = a * sq3 / 6;
    const r_out = a * sq3 / 3;
    const A = v3(-a/2, 0,  r_in);
    const B = v3( a/2, 0,  r_in);
    const C = v3( 0,   0, -r_out);
    const S = v3(0, p.h, 0);
    const result = unfoldNgonalPyramid([A, B, C], S, t, r_in);
    const labels = [];
    if (t < 0.15) {
      labels.push({ pos: A, text: 'A', off: { x: -10, y: 16 } });
      labels.push({ pos: B, text: 'B', off: { x: 8, y: 16 } });
      labels.push({ pos: C, text: 'C', off: { x: 10, y: 4 } });
      labels.push({ pos: S, text: 'S', off: { x: 8, y: -6 } });
    } else if (t > 0.85) {
      result.apexAt.forEach((s) => labels.push({ pos: s, text: 'S', off: { x: 0, y: 0 } }));
    }
    return {
      kind: 'unfolded',
      edges: result.edges,
      labels,
      preferredView: { yaw: 0, pitch: Math.PI/2 - 0.001 },
    };
  };


  TEMPLATES.prism4 = {
    key: 'prism4',
    name: 'Правильна 4-кутна призма',
    full: 'ABCDA₁B₁C₁D₁',
    params: {
      a: { value: 1.5, min: 0.6, max: 2.6, label: 'a' },
      h: { value: 2.0, min: 0.6, max: 3.4, label: 'h' },
    },
    aux: [
      { key: 'bodyDiag', label: 'діагональ AC₁' },
      { key: 'diagSect', label: 'переріз AB₁C₁D' },
      { key: 'sides',    label: 'позначити a, h' },
      { key: 'baseInc',  label: 'вписане коло основи' },
      { key: 'baseCirc', label: 'описане коло основи' },
    ],
    build(p, opts = {}) {
      const a = p.a / 2;
      const V = {
        A:  v3(-a, 0,  a), B:  v3( a, 0,  a), C:  v3( a, 0, -a), D:  v3(-a, 0, -a),
        A1: v3(-a, p.h,  a), B1: v3( a, p.h,  a), C1: v3( a, p.h, -a), D1: v3(-a, p.h, -a),
      };
      const E = [
        ['A','B'],['B','C'],['C','D'],['D','A'],
        ['A1','B1'],['B1','C1'],['C1','D1'],['D1','A1'],
        ['A','A1'],['B','B1'],['C','C1'],['D','D1'],
      ];
      const F = [
        ['A','B','C','D'], ['A1','D1','C1','B1'],
        ['A','A1','B1','B'], ['D','C','C1','D1'],
        ['B','B1','C1','C'], ['A','D','D1','A1'],
      ];
      const labels = [
        { pos: V.A, text: 'A', off: { x: -8, y: 18 } },
        { pos: V.B, text: 'B', off: { x: 10, y: 18 } },
        { pos: V.C, text: 'C', off: { x: 12, y: 14 } },
        { pos: V.D, text: 'D', off: { x: -12, y: 14 } },
        { pos: V.A1, text: 'A₁', off: { x: -18, y: -8 } },
        { pos: V.B1, text: 'B₁', off: { x: 10, y: -8 } },
        { pos: V.C1, text: 'C₁', off: { x: 12, y: -6 } },
        { pos: V.D1, text: 'D₁', off: { x: -22, y: -6 } },
      ];
      const handles = [
        // height — top center moves only vertically
        { id: 'h', paramKey: 'h', worldPos: v3(0, p.h, 0), gradient: v3(0, 1, 0), hint: 'h' },
        // base corner B1 — moves along base-diagonal direction (keeps square)
        { id: 'a', paramKey: 'a', worldPos: V.B, gradient: v3(0.5, 0, 0.5), hint: 'a' },
      ];
      const aux = [];
      if (opts.bodyDiag) aux.push({ kind: 'line', from: V.A, to: V.C1, color: '#c4622a', w: 2 });
      if (opts.diagSect) aux.push({ kind: 'poly', pts: [V.A, V.B1, V.C1, V.D], color: '#3b7b9b', fill: '#3b7b9b', fillOpacity: 0.13, w: 1.8 });
      if (opts.sides) {
        labels.push({ pos: lerp(V.A, V.B, 0.5), text: 'a', off: { x: 0, y: 22 }, italic: true });
        labels.push({ pos: lerp(V.B, V.B1, 0.5), text: 'h', off: { x: 14, y: 4 }, italic: true });
      }
      if (opts.baseInc) aux.push({ kind: 'horizCircle', y: 0, radius: p.a / 2, color: '#7b6193', w: 1.4, dash: '3 3' });
      if (opts.baseCirc) aux.push({ kind: 'horizCircle', y: 0, radius: p.a * Math.SQRT2 / 2, color: '#3a8a4f', w: 1.4 });
      return { kind: 'poly', V, E, F, labels, handles, aux };
    },
  };

  // ---- 6) Циліндр ----
  TEMPLATES.prism4.buildUnfolded = function (p, t) {
    const a = p.a / 2;
    const ring = [
      v3(-a, 0,  a), v3( a, 0,  a),
      v3( a, 0, -a), v3(-a, 0, -a),
    ];
    const result = unfoldNgonalPrism(ring, p.h, t);
    return {
      kind: 'unfolded',
      edges: result.edges,
      labels: [],
      preferredView: { yaw: 0, pitch: Math.PI/2 - 0.001 },
    };
  };


  TEMPLATES.cylinder = {
    key: 'cylinder',
    name: 'Циліндр',
    full: '',
    params: {
      r: { value: 1.0, min: 0.4, max: 2.0, label: 'r' },
      h: { value: 2.2, min: 0.6, max: 3.6, label: 'h' },
    },
    aux: [
      { key: 'height',  label: 'висота OO₁' },
      { key: 'axSect',  label: 'осьовий переріз' },
      { key: 'radius',  label: 'радіус' },
    ],
    build(p, opts = {}) {
      return {
        kind: 'cylinder',
        r: p.r,
        h: p.h,
        labels: [
          { pos: v3(0, 0, 0), text: 'O', off: { x: 6, y: 14 }, dot: true },
          { pos: v3(0, p.h, 0), text: 'O₁', off: { x: 8, y: -8 }, dot: true },
        ],
        handles: [
          // height — top center moves vertically
          { id: 'h', paramKey: 'h', worldPos: v3(0, p.h, 0), gradient: v3(0, 1, 0), hint: 'h' },
          // radius — top rim point at (r, h, 0) moves outward in X
          { id: 'r', paramKey: 'r', worldPos: v3(p.r, p.h, 0), gradient: v3(1, 0, 0), hint: 'r' },
        ],
        opts,
      };
    },
  };

  // Net unfolding for cylinder — lateral surface uncurls into a rectangle
  // of dimensions 2πR × h, attached at the back-most generator of the cylinder.
  // Mathematical model: a point at angular position θ on the original cylinder
  // currently sits on a circle of radius R/k(t) (where k=1-t), swept through
  // angle k·θ. As t→1, the radius grows to ∞ and the curve flattens — but
  // the arc length of any segment is preserved (so the unrolled rectangle
  // really has width 2πR at the end).
  TEMPLATES.cylinder.buildUnfolded = function (p, t) {
    const R = p.r, h = p.h;
    const k = Math.max(1 - t, 0.0005);
    const r_curr = R / k;
    const cx = R - r_curr;
    function unroll(theta, y) {
      const tc = theta * k;
      return v3(cx + r_curr * Math.cos(tc), y, r_curr * Math.sin(tc));
    }
    const N = 64;
    const edges = [];
    // Top and bottom rings (as polylines)
    let prevTop = null, prevBot = null;
    for (let i = 0; i <= N; i++) {
      const theta = (i / N) * 2 * Math.PI;
      const top = unroll(theta, h);
      const bot = unroll(theta, 0);
      if (prevTop) { edges.push([prevTop, top]); edges.push([prevBot, bot]); }
      prevTop = top; prevBot = bot;
    }
    // Anchor seam at θ=0 (vertical line where the cut starts)
    edges.push([unroll(0, 0), unroll(0, h)]);
    // Free edge at θ=2π (the cut line going the other way)
    edges.push([unroll(2 * Math.PI, 0), unroll(2 * Math.PI, h)]);
    // Three intermediate ribs to help visualize the curl at intermediate t
    for (let i = 1; i < 4; i++) {
      const theta = i * Math.PI / 2;
      edges.push([unroll(theta, 0), unroll(theta, h)]);
    }
    // Two cap circles. They animate from their original horizontal position
    // (coinciding with the lateral rings at t=0) to a flat vertical position
    // tangent to the rectangle's bottom/top edges at the seam (z=0).
    //   bottom cap: rotates by +α around axis (0,0,1) through (R, 0, 0)
    //   top cap:    rotates by -α around axis (0,0,1) through (R, h, 0)
    // where α = t · π/2.
    const alpha = t * Math.PI / 2;
    const cosA = Math.cos(alpha), sinA = Math.sin(alpha);
    function botCap(theta) {
      const X = R * Math.cos(theta), Z = R * Math.sin(theta);
      return v3(R + (X - R) * cosA, (X - R) * sinA, Z);
    }
    function topCap(theta) {
      const X = R * Math.cos(theta), Z = R * Math.sin(theta);
      // rotate by -α
      return v3(R + (X - R) * cosA, h - (X - R) * sinA, Z);
    }
    const M = 48;
    let prevBotCap = null, prevTopCap = null;
    for (let i = 0; i <= M; i++) {
      const theta = (i / M) * 2 * Math.PI;
      const bc = botCap(theta);
      const tc = topCap(theta);
      if (prevBotCap) edges.push([prevBotCap, bc]);
      if (prevTopCap) edges.push([prevTopCap, tc]);
      prevBotCap = bc;
      prevTopCap = tc;
    }
    // Labels showing key measurements at fully unfolded state
    const labels = [];
    if (t > 0.85) {
      const midTop = unroll(Math.PI, h);
      const farMid = unroll(2 * Math.PI, h / 2);
      labels.push({ pos: midTop, text: '2πR', off: { x: -16, y: -8 }, italic: true });
      labels.push({ pos: farMid, text: 'h',   off: { x: 14, y: 4 },  italic: true });
      // Radii from cap centers
      labels.push({ pos: botCap(0), text: 'R', off: { x: -6, y: -14 }, italic: true });
      labels.push({ pos: topCap(0), text: 'R', off: { x: -6, y: 18 },  italic: true });
    }
    return {
      kind: 'unfolded',
      edges,
      labels,
      // best camera for cylinder unfolding: side view (looking along -X axis)
      preferredView: { yaw: Math.PI / 2, pitch: 0 },
    };
  };

  // ---- 7) Конус ----
  TEMPLATES.cone = {
    key: 'cone',
    name: 'Конус',
    full: '',
    params: {
      r: { value: 1.1, min: 0.4, max: 2.0, label: 'r' },
      h: { value: 2.2, min: 0.6, max: 3.6, label: 'h' },
    },
    aux: [
      { key: 'height',   label: 'висота SO' },
      { key: 'slant',    label: 'твірна SA' },
      { key: 'axSect',   label: 'осьовий переріз' },
    ],
    build(p, opts = {}) {
      return {
        kind: 'cone',
        r: p.r,
        h: p.h,
        labels: [
          { pos: v3(0, 0, 0), text: 'O', off: { x: 6, y: 14 }, dot: true },
          { pos: v3(0, p.h, 0), text: 'S', off: { x: 8, y: -6 } },
        ],
        handles: [
          { id: 'h', paramKey: 'h', worldPos: v3(0, p.h, 0), gradient: v3(0, 1, 0), hint: 'h' },
          { id: 'r', paramKey: 'r', worldPos: v3(p.r, 0, 0), gradient: v3(1, 0, 0), hint: 'r' },
        ],
        opts,
      };
    },
  };

  // Net unfolding for cone — lateral surface uncurls into a circular sector
  // of radius L (slant height) and arc length 2πR, so sector angle θ = 2πR/L.
  // Apex stays at (0, h, 0). Sector lies in the XY plane (z=0).
  // Base circle morphs from horizontal (in XZ plane) to a flat circle in the
  // XY plane below the sector, so the full net is visible in one view.
  TEMPLATES.cone.buildUnfolded = function (p, t) {
    const R = p.r, h = p.h;
    const L = Math.sqrt(R * R + h * h);
    const apex = v3(0, h, 0);
    // Seam unit direction in unfolded plane (apex → seam endpoint at (R, 0, 0))
    const seamDir = { x: R / L, y: -h / L };  // 2D in XY plane (z=0)
    // 3D cone surface position (closed cone): (φ, τ) where τ∈[0,1] is fraction
    // from apex to base, φ is angular position on cone.
    function conePos(phi, tau) {
      return v3(R * tau * Math.cos(phi), h * (1 - tau), R * tau * Math.sin(phi));
    }
    // 2D-flat sector position: at angle β=φ·R/L from seam, radius L·τ from apex.
    function flatPos(phi, tau) {
      const beta = phi * R / L;
      const cb = Math.cos(beta), sb = Math.sin(beta);
      // rotate seamDir by beta CCW in XY plane
      const dx = seamDir.x * cb - seamDir.y * sb;
      const dy = seamDir.x * sb + seamDir.y * cb;
      return v3(L * tau * dx, h + L * tau * dy, 0);
    }
    // Linear interpolation between cone and flat (t=0 → cone, t=1 → flat)
    function morph(phi, tau) {
      const a = conePos(phi, tau);
      const b = flatPos(phi, tau);
      return v3(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y), a.z + t * (b.z - a.z));
    }

    const N = 80;
    const edges = [];
    // Base arc (τ=1)
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const phi = (i / N) * 2 * Math.PI;
      const pp = morph(phi, 1);
      if (prev) edges.push([prev, pp]);
      prev = pp;
    }
    // Seam at φ=0 (anchor): apex → base seam point
    edges.push([apex, morph(0, 1)]);
    // Free edge at φ=2π (the other side of the cut)
    edges.push([apex, morph(2 * Math.PI, 1)]);
    // A few intermediate generators (every 60°)
    for (let i = 1; i < 6; i++) {
      const phi = i * Math.PI / 3;
      edges.push([apex, morph(phi, 1)]);
    }

    // Separate base cap circle: at t=0 it's the horizontal base ring (so it
    // coincides with the lateral's bottom ring above); at t=1 it's a flat
    // circle in the XY plane below the cone, attached to the unfolded scene.
    // Rotation: rotates around X axis (which passes through cone's central
    // axis foot) by t·π/2 from horizontal to vertical (XY plane), then
    // translates downward by t·(R+0.4) so it sits below the original cone.
    const alpha = t * Math.PI / 2;
    const sinA = Math.sin(alpha), cosA = Math.cos(alpha);
    const drop = t * (R + 0.5);
    const M = 48;
    let prevCap = null;
    for (let i = 0; i <= M; i++) {
      const theta = (i / M) * 2 * Math.PI;
      // original cap: (R cos θ, 0, R sin θ). Rotate around X axis by alpha,
      // then translate y by -drop.
      const x = R * Math.cos(theta);
      const y0 = 0, z0 = R * Math.sin(theta);
      const y = y0 * cosA - z0 * sinA - drop;
      const z = y0 * sinA + z0 * cosA;
      const pt = v3(x, y, z);
      if (prevCap) edges.push([prevCap, pt]);
      prevCap = pt;
    }

    const labels = [];
    if (t > 0.85) {
      // Label L on a generator and R on the base cap
      const midGen = morph(Math.PI / 6, 0.55);
      labels.push({ pos: midGen, text: 'L', off: { x: 10, y: 2 }, italic: true });
      labels.push({ pos: apex, text: 'S', off: { x: 8, y: -6 } });
      labels.push({ pos: v3(R, -R - 0.5, 0), text: 'R', off: { x: -10, y: 4 }, italic: true });
    } else if (t < 0.15) {
      labels.push({ pos: apex, text: 'S', off: { x: 8, y: -6 } });
      labels.push({ pos: v3(0, 0, 0), text: 'O', off: { x: 6, y: 14 }, dot: true });
    }
    return {
      kind: 'unfolded',
      edges,
      labels,
      // Front view: looking along -Z, sees XY plane face-on (sector visible).
      preferredView: { yaw: 0, pitch: 0 },
    };
  };

  // ---- 8) Куля ----
  TEMPLATES.sphere = {
    key: 'sphere',
    name: 'Куля',
    full: '',
    params: {
      r: { value: 1.2, min: 0.5, max: 2.2, label: 'R' },
    },
    aux: [
      { key: 'equator', label: 'екватор' },
      { key: 'axis',    label: 'вісь NS' },
      { key: 'radius',  label: 'радіус OA' },
    ],
    build(p, opts = {}) {
      return {
        kind: 'sphere',
        r: p.r,
        labels: [
          { pos: v3(0, 0, 0), text: 'O', off: { x: 6, y: 14 }, dot: true },
        ],
        handles: [
          { id: 'r', paramKey: 'r', worldPos: v3(p.r, 0, 0), gradient: v3(1, 0, 0), hint: 'R' },
        ],
        opts,
      };
    },
  };

  // ---- 9) Піраміда з трапецією в основі (максимум свободи) ----
  // Базова трапеція в площині XZ:
  //   передня основа AB (паралельна осі X, z = +d/2), довжина a
  //   задня основа DC (паралельна осі X, z = -d/2), довжина b
  //   зсув s — задня основа може зсуватись уздовж X (тоді трапеція стає
  //   довільною, а не рівнобедреною)
  //   d — глибина (відстань між паралельними сторонами)
  // Апекс має ТРИ ступеня свободи: висота h + зсув sx по X + зсув sz по Z.
  TEMPLATES.trapPyramid = {
    key: 'trapPyramid',
    name: 'Піраміда — трапеція в основі',
    full: 'SABCD',
    params: {
      a:  { value: 2.2, min: 0.6, max: 3.2, label: 'a' },
      b:  { value: 1.2, min: 0.4, max: 3.2, label: 'b' },
      d:  { value: 1.8, min: 0.6, max: 3.0, label: 'd' },
      s:  { value: 0.0, min: -1.0, max: 1.0, label: 's' },
      h:  { value: 2.0, min: 0.5, max: 3.4, label: 'h' },
      sx: { value: 0.0, min: -2.0, max: 2.0, label: 'x' },
      sz: { value: 0.0, min: -2.0, max: 2.0, label: 'z' },
    },
    aux: [
      { key: 'height',    label: 'висота SO ⊥ основи' },
      { key: 'axMid',     label: 'переріз через серед. AB і CD' },
      { key: 'axAC',      label: 'переріз SAC' },
      { key: 'axBD',      label: 'переріз SBD' },
      { key: 'baseDiags', label: 'діагоналі основи' },
      { key: 'midSect',   label: 'переріз на висоті h/2' },
      { key: 'sides',     label: 'позначити a, b, d' },
    ],
    build(p, opts = {}) {
      const A = v3(-p.a / 2, 0,  p.d / 2);
      const B = v3( p.a / 2, 0,  p.d / 2);
      const C = v3( p.b / 2 + p.s, 0, -p.d / 2);
      const D = v3(-p.b / 2 + p.s, 0, -p.d / 2);
      const S = v3(p.sx, p.h, p.sz);
      const O = v3(p.sx, 0, p.sz);
      const V = { A, B, C, D, S, O };
      const E = [
        ['A','B'],['B','C'],['C','D'],['D','A'],
        ['S','A'],['S','B'],['S','C'],['S','D'],
      ];
      const F = [
        ['A','B','C','D'],  // base
        ['S','B','A'],
        ['S','C','B'],
        ['S','D','C'],
        ['S','A','D'],
      ];
      const labels = [
        { pos: A, text: 'A', off: { x: -10, y: 18 } },
        { pos: B, text: 'B', off: { x:  10, y: 18 } },
        { pos: C, text: 'C', off: { x:  12, y: 12 } },
        { pos: D, text: 'D', off: { x: -14, y: 12 } },
        { pos: S, text: 'S', off: { x:   8, y:  -6 } },
      ];
      // ---- HANDLES (high degree of freedom) ----
      const M_AB = v3(0, 0, p.d / 2);             // midpoint of front base — controls d
      const M_CD = v3(p.s, 0, -p.d / 2);          // midpoint of back base — controls s (skew)
      const handles = [
        // B corner — drag along +X, controls a
        { id: 'a',  paramKey: 'a',  worldPos: B,    gradient: v3( 0.5, 0, 0), hint: 'a — передня основа' },
        // C corner — drag along +X, controls b
        { id: 'b',  paramKey: 'b',  worldPos: C,    gradient: v3( 0.5, 0, 0), hint: 'b — задня основа' },
        // mid-AB — drag forward (+Z), controls depth d
        { id: 'd',  paramKey: 'd',  worldPos: M_AB, gradient: v3( 0, 0,  0.5), hint: 'd — глибина' },
        // mid-CD — drag along X, controls skew s (асиметрія трапеції)
        { id: 's',  paramKey: 's',  worldPos: M_CD, gradient: v3( 1, 0, 0),    hint: 's — зсув задньої основи' },
        // apex — vertical only, controls h
        { id: 'h',  paramKey: 'h',  worldPos: S,    gradient: v3( 0, 1, 0),    hint: 'h — висота' },
        // FOOT of apex perpendicular — 2D handle in base plane, controls sx & sz
        // Square handle visually (kind: 'square') distinguishes it from 1D handles.
        { id: 'O',  paramKeys: ['sx', 'sz'], gradients: [v3(1, 0, 0), v3(0, 0, 1)],
          worldPos: O, hint: 'O — основа висоти (тягни в площині основи)', shape: 'square' },
      ];
      // ---- AUX (cross-sections) ----
      const aux = [];
      // foot of apex perpendicular = O = (sx, 0, sz)
      const Mab = v3(0, 0, p.d / 2);
      const Mcd = v3(p.s, 0, -p.d / 2);

      if (opts.height) {
        aux.push({ kind: 'line', from: S, to: O, color: '#c4622a', w: 1.6, dash: '7 3 1 3' });
        labels.push({ pos: O, text: 'O', off: { x: 6, y: 14 }, dot: true });
        aux.push({ kind: 'rightAngle', at: O, dir1: v3(0, 1, 0), dir2: v3(1, 0, 0), size: 0.18 });
      }
      if (opts.axMid) {
        aux.push({ kind: 'poly', pts: [Mab, Mcd, S], color: '#3b7b9b', fill: '#3b7b9b', fillOpacity: 0.13, w: 1.8 });
        labels.push({ pos: Mab, text: 'M', off: { x: -2, y: 18 }, dot: true });
        labels.push({ pos: Mcd, text: 'N', off: { x:  6, y: 12 }, dot: true });
      }
      if (opts.axAC) {
        aux.push({ kind: 'poly', pts: [A, C, S], color: '#a83a5b', fill: '#a83a5b', fillOpacity: 0.12, w: 1.7 });
      }
      if (opts.axBD) {
        aux.push({ kind: 'poly', pts: [B, D, S], color: '#3a8a4f', fill: '#3a8a4f', fillOpacity: 0.12, w: 1.7 });
      }
      if (opts.baseDiags) {
        aux.push({ kind: 'line', from: A, to: C, color: '#7b6193', w: 1.1, dash: '3 3' });
        aux.push({ kind: 'line', from: B, to: D, color: '#7b6193', w: 1.1, dash: '3 3' });
      }
      if (opts.midSect) {
        // cross-section parallel to base at y = h/2 — midpoints of lateral edges
        const t = 0.5;
        const A2 = lerp(A, S, t), B2 = lerp(B, S, t);
        const C2 = lerp(C, S, t), D2 = lerp(D, S, t);
        aux.push({ kind: 'poly', pts: [A2, B2, C2, D2], color: '#c4622a', fill: '#c4622a', fillOpacity: 0.10, w: 1.5, dash: '5 3' });
      }
      if (opts.sides) {
        labels.push({ pos: lerp(A, B, 0.5), text: 'a', off: { x: 0, y: 22 }, italic: true });
        labels.push({ pos: lerp(D, C, 0.5), text: 'b', off: { x: 0, y: -10 }, italic: true });
        labels.push({ pos: lerp(Mab, Mcd, 0.5), text: 'd', off: { x: 14, y: 4 }, italic: true });
      }
      return { kind: 'poly', V, E, F, labels, handles, aux };
    },
  };

  // ---- 10) Правильна 6-кутна призма ----
  TEMPLATES.prism6 = {
    key: 'prism6',
    name: 'Правильна 6-кутна призма',
    full: 'ABCDEFA₁B₁C₁D₁E₁F₁',
    params: {
      a: { value: 0.95, min: 0.35, max: 1.7, label: 'a' },
      h: { value: 2.0, min: 0.6, max: 3.4, label: 'h' },
    },
    aux: [
      { key: 'smallDiag', label: 'мала діагональ AC' },
      { key: 'bigDiag',   label: 'велика діагональ AD' },
      { key: 'bodyDiag',  label: 'діагональ AD₁' },
      { key: 'apothem',   label: 'апофема основи OM' },
      { key: 'diagSect',  label: 'діаг. переріз AD D₁A₁' },
      { key: 'sides',     label: 'позначити a, h' },
      { key: 'baseInc',   label: 'вписане коло основи' },
      { key: 'baseCirc',  label: 'описане коло основи' },
    ],
    build(p, opts = {}) {
      const r = p.a;
      const sq3 = Math.sqrt(3);
      // Vertices A..F on hexagon, going CCW (viewed from above with my world convention)
      // A is front-left; B front; C front-right; D back-right; E back; F back-left.
      const ring = [
        ['A', -r * sq3 / 2,  r / 2],
        ['B',  0,            r],
        ['C',  r * sq3 / 2,  r / 2],
        ['D',  r * sq3 / 2, -r / 2],
        ['E',  0,           -r],
        ['F', -r * sq3 / 2, -r / 2],
      ];
      const V = {};
      for (const [n, x, z] of ring) {
        V[n] = v3(x, 0, z);
        V[n + '1'] = v3(x, p.h, z);
      }
      const names = ['A','B','C','D','E','F'];
      const E = [];
      for (let i = 0; i < 6; i++) {
        const a = names[i], b = names[(i + 1) % 6];
        E.push([a, b]);
        E.push([a + '1', b + '1']);
        E.push([a, a + '1']);
      }
      // Faces — inward-normal winding convention.
      const F = [
        ['A','B','C','D','E','F'],       // bottom
        ['A1','F1','E1','D1','C1','B1'], // top
      ];
      for (let i = 0; i < 6; i++) {
        const a = names[i], b = names[(i + 1) % 6];
        F.push([a, a + '1', b + '1', b]);
      }
      const labels = [
        { pos: V.A,  text: 'A',  off: { x: -16, y: 12 } },
        { pos: V.B,  text: 'B',  off: { x: -4,  y: 18 } },
        { pos: V.C,  text: 'C',  off: { x: 12,  y: 14 } },
        { pos: V.D,  text: 'D',  off: { x: 14,  y: 6 } },
        { pos: V.E,  text: 'E',  off: { x: 8,   y: -4 } },
        { pos: V.F,  text: 'F',  off: { x: -18, y: 0 } },
        { pos: V.A1, text: 'A₁', off: { x: -22, y: -6 } },
        { pos: V.B1, text: 'B₁', off: { x: -6,  y: -8 } },
        { pos: V.C1, text: 'C₁', off: { x: 12,  y: -6 } },
        { pos: V.D1, text: 'D₁', off: { x: 14,  y: -10 } },
        { pos: V.E1, text: 'E₁', off: { x: 8,   y: -18 } },
        { pos: V.F1, text: 'F₁', off: { x: -24, y: -14 } },
      ];
      const handles = [
        // C corner — drag radially outward → scales hexagon (a)
        { id: 'a', paramKey: 'a', worldPos: V.C, gradient: v3(sq3 / 2, 0, 1/2), hint: 'a' },
        // top center — drag vertically → h
        { id: 'h', paramKey: 'h', worldPos: v3(0, p.h, 0), gradient: v3(0, 1, 0), hint: 'h' },
      ];
      const aux = [];
      if (opts.smallDiag) aux.push({ kind: 'line', from: V.A, to: V.C, color: '#7b6193', w: 1.4, dash: '5 3' });
      if (opts.bigDiag)   aux.push({ kind: 'line', from: V.A, to: V.D, color: '#3a8a4f', w: 1.4, dash: '5 3' });
      if (opts.bodyDiag)  aux.push({ kind: 'line', from: V.A, to: V.D1, color: '#c4622a', w: 1.7 });
      if (opts.apothem) {
        const M = lerp(V.A, V.B, 0.5);
        const O = v3(0, 0, 0);
        aux.push({ kind: 'line', from: O, to: M, color: '#3b7b9b', w: 1.5 });
        labels.push({ pos: M, text: 'M', off: { x: -8, y: 18 }, dot: true });
        labels.push({ pos: O, text: 'O', off: { x: 6, y: 14 }, dot: true });
        const toA = nrm(v3(V.A.x - M.x, 0, V.A.z - M.z));
        const toO = nrm(v3(-M.x, 0, -M.z));
        aux.push({ kind: 'rightAngle', at: M, dir1: toA, dir2: toO, size: 0.14 });
      }
      if (opts.diagSect) {
        aux.push({ kind: 'poly', pts: [V.A, V.D, V.D1, V.A1], color: '#3b7b9b', fill: '#3b7b9b', fillOpacity: 0.13, w: 1.8 });
      }
      if (opts.sides) {
        labels.push({ pos: lerp(V.A, V.B, 0.5), text: 'a', off: { x: -6, y: 22 }, italic: true });
        labels.push({ pos: lerp(V.D, V.D1, 0.5), text: 'h', off: { x: 14, y: 4 }, italic: true });
      }
      if (opts.baseInc) aux.push({ kind: 'horizCircle', y: 0, radius: r * sq3 / 2, color: '#7b6193', w: 1.4, dash: '3 3' });
      if (opts.baseCirc) aux.push({ kind: 'horizCircle', y: 0, radius: r, color: '#3a8a4f', w: 1.4 });
      return { kind: 'poly', V, E, F, labels, handles, aux };
    },
  };

  // ---- 11) Правильна 6-кутна піраміда ----
  TEMPLATES.prism6.buildUnfolded = function (p, t) {
    const r = p.a;
    const sq3 = Math.sqrt(3);
    const ring = [
      v3(-r * sq3 / 2,  0,  r / 2),
      v3( 0,            0,  r),
      v3( r * sq3 / 2,  0,  r / 2),
      v3( r * sq3 / 2,  0, -r / 2),
      v3( 0,            0, -r),
      v3(-r * sq3 / 2,  0, -r / 2),
    ];
    const result = unfoldNgonalPrism(ring, p.h, t);
    return {
      kind: 'unfolded',
      edges: result.edges,
      labels: [],
      preferredView: { yaw: 0, pitch: Math.PI/2 - 0.001 },
    };
  };


  TEMPLATES.pyramid6 = {
    key: 'pyramid6',
    name: 'Правильна 6-кутна піраміда',
    full: 'SABCDEF',
    params: {
      a: { value: 1.05, min: 0.4, max: 1.8, label: 'a' },
      h: { value: 2.3, min: 0.6, max: 3.6, label: 'h' },
    },
    aux: [
      { key: 'height',   label: 'висота SO' },
      { key: 'apothem',  label: 'апофема SM' },
      { key: 'bigDiag',  label: 'діагональ основи AD' },
      { key: 'axSect',   label: 'осьовий переріз SAD' },
      { key: 'sides',    label: 'позначити a, h' },
      { key: 'baseInc',  label: 'вписане коло основи' },
      { key: 'baseCirc', label: 'описане коло основи' },
    ],
    build(p, opts = {}) {
      const r = p.a;
      const sq3 = Math.sqrt(3);
      const ring = [
        ['A', -r * sq3 / 2,  r / 2],
        ['B',  0,            r],
        ['C',  r * sq3 / 2,  r / 2],
        ['D',  r * sq3 / 2, -r / 2],
        ['E',  0,           -r],
        ['F', -r * sq3 / 2, -r / 2],
      ];
      const V = { S: v3(0, p.h, 0), O: v3(0, 0, 0) };
      for (const [n, x, z] of ring) V[n] = v3(x, 0, z);
      const names = ['A','B','C','D','E','F'];
      const E = [];
      for (let i = 0; i < 6; i++) {
        E.push([names[i], names[(i + 1) % 6]]);
        E.push(['S', names[i]]);
      }
      const F = [['A','B','C','D','E','F']];
      for (let i = 0; i < 6; i++) {
        F.push(['S', names[(i + 1) % 6], names[i]]);
      }
      const labels = [
        { pos: V.A, text: 'A', off: { x: -16, y: 12 } },
        { pos: V.B, text: 'B', off: { x: -4,  y: 18 } },
        { pos: V.C, text: 'C', off: { x: 12,  y: 14 } },
        { pos: V.D, text: 'D', off: { x: 14,  y: 6 } },
        { pos: V.E, text: 'E', off: { x: 8,   y: -4 } },
        { pos: V.F, text: 'F', off: { x: -18, y: 0 } },
        { pos: V.S, text: 'S', off: { x: 8,   y: -6 } },
      ];
      const handles = [
        { id: 'a', paramKey: 'a', worldPos: V.C, gradient: v3(sq3 / 2, 0, 1/2), hint: 'a' },
        { id: 'h', paramKey: 'h', worldPos: V.S, gradient: v3(0, 1, 0),         hint: 'h' },
      ];
      const aux = [];
      const M = lerp(V.A, V.B, 0.5);
      if (opts.height) {
        aux.push({ kind: 'line', from: V.S, to: V.O, color: '#c4622a', w: 1.6, dash: '7 3 1 3' });
        labels.push({ pos: V.O, text: 'O', off: { x: 6, y: 14 }, dot: true });
        aux.push({ kind: 'rightAngle', at: V.O, dir1: v3(0, 1, 0), dir2: v3(1, 0, 0), size: 0.18 });
      }
      if (opts.apothem) {
        aux.push({ kind: 'line', from: V.S, to: M, color: '#3b7b9b', w: 1.6 });
        labels.push({ pos: M, text: 'M', off: { x: -8, y: 18 }, dot: true });
      }
      if (opts.bigDiag) {
        aux.push({ kind: 'line', from: V.A, to: V.D, color: '#7b6193', w: 1.1, dash: '3 3' });
      }
      if (opts.axSect) {
        aux.push({ kind: 'poly', pts: [V.A, V.D, V.S], color: '#3b7b9b', fill: '#3b7b9b', fillOpacity: 0.13, w: 1.8 });
      }
      if (opts.sides) {
        labels.push({ pos: lerp(V.A, V.B, 0.5), text: 'a', off: { x: -6, y: 22 }, italic: true });
      }
      if (opts.baseInc) aux.push({ kind: 'horizCircle', y: 0, radius: r * sq3 / 2, color: '#7b6193', w: 1.4, dash: '3 3' });
      if (opts.baseCirc) aux.push({ kind: 'horizCircle', y: 0, radius: r, color: '#3a8a4f', w: 1.4 });
      return { kind: 'poly', V, E, F, labels, handles, aux };
    },
  };

  // ---- 12) Правильний тетраедр ----
  TEMPLATES.pyramid6.buildUnfolded = function (p, t) {
    const r = p.a;
    const sq3 = Math.sqrt(3);
    const r_in = r * sq3 / 2;
    const ring = [
      v3(-r * sq3 / 2,  0,  r / 2),
      v3( 0,            0,  r),
      v3( r * sq3 / 2,  0,  r / 2),
      v3( r * sq3 / 2,  0, -r / 2),
      v3( 0,            0, -r),
      v3(-r * sq3 / 2,  0, -r / 2),
    ];
    const S = v3(0, p.h, 0);
    const result = unfoldNgonalPyramid(ring, S, t, r_in);
    return {
      kind: 'unfolded',
      edges: result.edges,
      labels: [],
      preferredView: { yaw: 0, pitch: Math.PI/2 - 0.001 },
    };
  };

  // ════════════════════════════════════════════════════════════════════════
  // PROCEDURAL SUBSYSTEM — regular n-gonal pyramid
  //
  // param n (integer 3–8) controls number of base sides at runtime.
  // Old hand-crafted pyramid3/pyramid4/pyramid6 are NOT affected.
  // unfoldNgonalPyramid() is already generic — reused as-is.
  // ════════════════════════════════════════════════════════════════════════
  TEMPLATES.ngonPyramid = {
    key: 'ngonPyramid',
    name: 'Правильна n-кутна піраміда',
    full: 'S + n-кут',
    params: {
      n: { value: 5, min: 3, max: 8, step: 1, label: 'n' },
      a: { value: 1.4, min: 0.4, max: 2.6, label: 'a' },
      h: { value: 2.0, min: 0.4, max: 3.6, label: 'h' },
    },
    aux: [
      { key: 'height',   label: 'висота SO' },
      { key: 'apothem',  label: 'апофема SM' },
      { key: 'axSect',   label: 'осьовий переріз' },
      { key: 'baseInc',  label: 'вписане коло основи' },
      { key: 'baseCirc', label: 'описане коло основи' },
    ],
  };

  TEMPLATES.ngonPyramid.build = function (p, opts = {}) {
    const n = Math.max(3, Math.min(8, Math.round(p.n)));
    const a = p.a;
    const PI = Math.PI;
    const r_out = a / (2 * Math.sin(PI / n));
    const r_in  = a / (2 * Math.tan(PI / n));
    // startOff = -π/2: vertex A points left; front-right vertices are visible & draggable.
    const startOff = -PI / 2;

    const names = ['A','B','C','D','E','F','G','H'].slice(0, n);
    const ring = names.map((nm, k) => {
      const ang = 2 * PI * k / n + startOff;
      return { nm, x: r_out * Math.sin(ang), z: r_out * Math.cos(ang) };
    });

    const V = { S: v3(0, p.h, 0), O: v3(0, 0, 0) };
    for (const { nm, x, z } of ring) V[nm] = v3(x, 0, z);

    const E = [];
    for (let i = 0; i < n; i++) {
      E.push([names[i], names[(i + 1) % n]]);
      E.push(['S', names[i]]);
    }
    // base CCW from above + lateral triangles CCW outward
    const F = [names.slice()];
    for (let i = 0; i < n; i++) F.push(['S', names[(i + 1) % n], names[i]]);

    const labels = ring.map(({ nm, x, z }) => ({
      pos: v3(x, 0, z), text: nm, off: _ngonLabelOff(x, z, r_out, false),
    }));
    labels.push({ pos: V.S, text: 'S', off: { x: 8, y: -6 } });

    // Handle for 'a': vertex with max (x + 0.3·z) — front-right, always visible.
    let hIdx = 0, hScore = -Infinity;
    for (let k = 0; k < n; k++) {
      const s = ring[k].x + 0.3 * ring[k].z;
      if (s > hScore) { hScore = s; hIdx = k; }
    }
    const hv = ring[hIdx];
    const handles = [
      { id: 'a', paramKey: 'a', worldPos: V[hv.nm], gradient: nrm(v3(hv.x, 0, hv.z)), hint: 'ребро a' },
      { id: 'h', paramKey: 'h', worldPos: V.S,       gradient: v3(0, 1, 0),            hint: 'висота h' },
    ];

    const aux = [];
    const M = lerp(V[names[0]], V[names[1]], 0.5); // apothem foot (midpoint of edge AB)
    if (opts.height) {
      aux.push({ kind: 'line', from: V.S, to: V.O, color: '#c4622a', w: 1.6, dash: '7 3 1 3' });
      labels.push({ pos: V.O, text: 'O', off: { x: 6, y: 14 }, dot: true });
      aux.push({ kind: 'rightAngle', at: V.O, dir1: v3(0, 1, 0), dir2: v3(1, 0, 0), size: 0.18 });
    }
    if (opts.apothem) {
      aux.push({ kind: 'line', from: V.S, to: M, color: '#3b7b9b', w: 1.6 });
      labels.push({ pos: M, text: 'M', off: { x: -8, y: 18 }, dot: true });
    }
    if (opts.axSect) {
      const opp = V[names[Math.floor(n / 2)]]; // roughly opposite vertex to A
      aux.push({ kind: 'poly', pts: [V[names[0]], opp, V.S],
        color: '#3b7b9b', fill: '#3b7b9b', fillOpacity: 0.13, w: 1.8 });
    }
    if (opts.baseInc)  aux.push({ kind: 'horizCircle', y: 0, radius: r_in,  color: '#7b6193', w: 1.4, dash: '3 3' });
    if (opts.baseCirc) aux.push({ kind: 'horizCircle', y: 0, radius: r_out, color: '#3a8a4f', w: 1.4 });

    return { kind: 'poly', V, E, F, labels, handles, aux };
  };

  TEMPLATES.ngonPyramid.buildUnfolded = function (p, t) {
    const n = Math.max(3, Math.min(8, Math.round(p.n)));
    const r_out = p.a / (2 * Math.sin(Math.PI / n));
    const r_in  = p.a / (2 * Math.tan(Math.PI / n));
    const startOff = -Math.PI / 2;
    const ring = Array.from({ length: n }, (_, k) => {
      const ang = 2 * Math.PI * k / n + startOff;
      return v3(r_out * Math.sin(ang), 0, r_out * Math.cos(ang));
    });
    const result = unfoldNgonalPyramid(ring, v3(0, p.h, 0), t, r_in);
    return { kind: 'unfolded', edges: result.edges, labels: [],
      preferredView: { yaw: 0, pitch: Math.PI / 2 - 0.001 } };
  };

  // ════════════════════════════════════════════════════════════════════════
  // PROCEDURAL SUBSYSTEM — regular n-gonal prism
  //
  // param n (integer 3–8) controls number of base sides at runtime.
  // Old hand-crafted prism4/prism6 are NOT affected.
  // unfoldNgonalPrism() is already generic — reused as-is.
  // ════════════════════════════════════════════════════════════════════════
  TEMPLATES.ngonPrism = {
    key: 'ngonPrism',
    name: 'Правильна n-кутна призма',
    full: 'n-кут + n-кут',
    params: {
      n: { value: 5, min: 3, max: 8, step: 1, label: 'n' },
      a: { value: 1.2, min: 0.4, max: 2.4, label: 'a' },
      h: { value: 2.0, min: 0.6, max: 3.6, label: 'h' },
    },
    aux: [
      { key: 'bodyDiag', label: 'діагональ тіла' },
      { key: 'apothem',  label: 'апофема основи OM' },
      { key: 'sides',    label: 'позначити a, h' },
      { key: 'baseInc',  label: 'вписане коло основи' },
      { key: 'baseCirc', label: 'описане коло основи' },
    ],
  };

  TEMPLATES.ngonPrism.build = function (p, opts = {}) {
    const n = Math.max(3, Math.min(8, Math.round(p.n)));
    const a = p.a;
    const PI = Math.PI;
    const r_out = a / (2 * Math.sin(PI / n));
    const r_in  = a / (2 * Math.tan(PI / n));
    const startOff = -PI / 2;

    const names = ['A','B','C','D','E','F','G','H'].slice(0, n);
    const ring = names.map((nm, k) => {
      const ang = 2 * PI * k / n + startOff;
      return { nm, x: r_out * Math.sin(ang), z: r_out * Math.cos(ang) };
    });

    const V = {};
    for (const { nm, x, z } of ring) {
      V[nm]       = v3(x, 0,    z);
      V[nm + '1'] = v3(x, p.h, z);
    }

    const E = [];
    for (let i = 0; i < n; i++) {
      const a0 = names[i], b0 = names[(i + 1) % n];
      E.push([a0, b0]);
      E.push([a0 + '1', b0 + '1']);
      E.push([a0, a0 + '1']);
    }
    // bottom CCW from above + top (reversed) + lateral quads CCW outward
    const F = [
      names.slice(),
      [...names].reverse().map(nm => nm + '1'),
    ];
    for (let i = 0; i < n; i++) {
      const a0 = names[i], b0 = names[(i + 1) % n];
      F.push([a0, a0 + '1', b0 + '1', b0]);
    }

    const labels = [];
    for (const { nm, x, z } of ring) {
      labels.push({ pos: V[nm],       text: nm,       off: _ngonLabelOff(x, z, r_out, false) });
      labels.push({ pos: V[nm + '1'], text: nm + '₁', off: _ngonLabelOff(x, z, r_out, true)  });
    }

    let hIdx = 0, hScore = -Infinity;
    for (let k = 0; k < n; k++) {
      const s = ring[k].x + 0.3 * ring[k].z;
      if (s > hScore) { hScore = s; hIdx = k; }
    }
    const hv = ring[hIdx];
    const handles = [
      { id: 'a', paramKey: 'a', worldPos: V[hv.nm],    gradient: nrm(v3(hv.x, 0, hv.z)), hint: 'ребро a' },
      { id: 'h', paramKey: 'h', worldPos: v3(0, p.h, 0), gradient: v3(0, 1, 0),           hint: 'висота h' },
    ];

    const aux = [];
    if (opts.bodyDiag) {
      const oppNm = names[Math.floor(n / 2)];
      aux.push({ kind: 'line', from: V[names[0]], to: V[oppNm + '1'], color: '#c4622a', w: 1.7 });
    }
    if (opts.apothem) {
      const M = lerp(V[names[0]], V[names[1]], 0.5);
      const O = v3(0, 0, 0);
      aux.push({ kind: 'line', from: O, to: M, color: '#3b7b9b', w: 1.5 });
      labels.push({ pos: M, text: 'M', off: { x: -8, y: 18 }, dot: true });
      labels.push({ pos: O, text: 'O', off: { x: 6,  y: 14 }, dot: true });
    }
    if (opts.sides) {
      labels.push({ pos: lerp(V[names[0]], V[names[1]], 0.5), text: 'a', off: { x: -6, y: 22 }, italic: true });
      const lastNm = names[n - 1];
      labels.push({ pos: lerp(V[lastNm], V[lastNm + '1'], 0.5), text: 'h', off: { x: 14, y: 4 }, italic: true });
    }
    if (opts.baseInc)  aux.push({ kind: 'horizCircle', y: 0, radius: r_in,  color: '#7b6193', w: 1.4, dash: '3 3' });
    if (opts.baseCirc) aux.push({ kind: 'horizCircle', y: 0, radius: r_out, color: '#3a8a4f', w: 1.4 });

    return { kind: 'poly', V, E, F, labels, handles, aux };
  };

  TEMPLATES.ngonPrism.buildUnfolded = function (p, t) {
    const n = Math.max(3, Math.min(8, Math.round(p.n)));
    const r_out = p.a / (2 * Math.sin(Math.PI / n));
    const startOff = -Math.PI / 2;
    const ring = Array.from({ length: n }, (_, k) => {
      const ang = 2 * Math.PI * k / n + startOff;
      return v3(r_out * Math.sin(ang), 0, r_out * Math.cos(ang));
    });
    const result = unfoldNgonalPrism(ring, p.h, t);
    return { kind: 'unfolded', edges: result.edges, labels: [],
      preferredView: { yaw: 0, pitch: Math.PI / 2 - 0.001 } };
  };

  TEMPLATES.tetrahedron = {
    key: 'tetrahedron',
    name: 'Правильний тетраедр',
    full: 'DABC',
    params: {
      a: { value: 1.7, min: 0.5, max: 2.6, label: 'a' },
    },
    aux: [
      { key: 'height',  label: 'висота DO' },
      { key: 'apothem', label: 'апофема DM' },
      { key: 'median',  label: 'медіана CM' },
      { key: 'axSect',  label: 'осьовий переріз DCM' },
      { key: 'baseInc',  label: 'вписане коло основи' },
      { key: 'baseCirc', label: 'описане коло основи' },
    ],
    build(p, opts = {}) {
      const a = p.a;
      const sq3 = Math.sqrt(3);
      const h = a * Math.sqrt(2 / 3);  // tetrahedron height
      const A = v3(-a / 2, 0,  a * sq3 / 6);
      const B = v3( a / 2, 0,  a * sq3 / 6);
      const C = v3( 0,     0, -a * sq3 / 3);
      const D = v3( 0,     h,  0);
      const O = v3( 0,     0,  0);
      const V = { A, B, C, D, O };
      const E = [['A','B'],['B','C'],['C','A'],['D','A'],['D','B'],['D','C']];
      const F = [
        ['A','B','C'],
        ['D','B','A'],
        ['D','C','B'],
        ['D','A','C'],
      ];
      const labels = [
        { pos: A, text: 'A', off: { x: -12, y: 16 } },
        { pos: B, text: 'B', off: { x: 8,   y: 16 } },
        { pos: C, text: 'C', off: { x: 10,  y: 4 } },
        { pos: D, text: 'D', off: { x: 8,   y: -6 } },
      ];
      const handles = [
        { id: 'a', paramKey: 'a', worldPos: B, gradient: v3(0.5, 0, sq3 / 6), hint: 'ребро a' },
      ];
      const aux = [];
      const M = lerp(A, B, 0.5);
      if (opts.height) {
        aux.push({ kind: 'line', from: D, to: O, color: '#c4622a', w: 1.6, dash: '7 3 1 3' });
        labels.push({ pos: O, text: 'O', off: { x: 6, y: 14 }, dot: true });
      }
      if (opts.apothem) {
        aux.push({ kind: 'line', from: D, to: M, color: '#3b7b9b', w: 1.6 });
        labels.push({ pos: M, text: 'M', off: { x: -10, y: 16 }, dot: true });
      }
      if (opts.median && !opts.apothem && !opts.axSect) {
        aux.push({ kind: 'line', from: C, to: M, color: '#7b6193', w: 1.2, dash: '3 3' });
        labels.push({ pos: M, text: 'M', off: { x: -10, y: 16 }, dot: true });
      }
      if (opts.axSect) {
        aux.push({ kind: 'poly', pts: [D, C, M], color: '#3b7b9b', fill: '#3b7b9b', fillOpacity: 0.13, w: 1.8 });
        if (!opts.apothem) labels.push({ pos: M, text: 'M', off: { x: -10, y: 16 }, dot: true });
      }
      if (opts.baseInc) aux.push({ kind: 'horizCircle', y: 0, radius: a * sq3 / 6, color: '#7b6193', w: 1.4, dash: '3 3' });
      if (opts.baseCirc) aux.push({ kind: 'horizCircle', y: 0, radius: a * sq3 / 3, color: '#3a8a4f', w: 1.4 });
      return { kind: 'poly', V, E, F, labels, handles, aux };
    },
  };

  // ---- 13) Зрізана 4-кутна піраміда (frustum) ----
  TEMPLATES.tetrahedron.buildUnfolded = function (p, t) {
    const a = p.a;
    const sq3 = Math.sqrt(3);
    const r_in = a * sq3 / 6;
    const r_out = a * sq3 / 3;
    const h = a * Math.sqrt(2/3);
    const A = v3(-a/2, 0,  r_in);
    const B = v3( a/2, 0,  r_in);
    const C = v3( 0,   0, -r_out);
    const D = v3(0, h, 0);
    const result = unfoldNgonalPyramid([A, B, C], D, t, r_in);
    return {
      kind: 'unfolded',
      edges: result.edges,
      labels: [],
      preferredView: { yaw: 0, pitch: Math.PI/2 - 0.001 },
    };
  };


  TEMPLATES.frustumPyramid4 = {
    key: 'frustumPyramid4',
    name: 'Зрізана 4-кутна піраміда',
    full: 'ABCDA₁B₁C₁D₁',
    params: {
      a: { value: 2.0, min: 0.8, max: 3.0, label: 'a' },
      b: { value: 1.0, min: 0.2, max: 2.4, label: 'b' },
      h: { value: 1.7, min: 0.4, max: 3.0, label: 'h' },
    },
    aux: [
      { key: 'height',  label: 'висота OO₁' },
      { key: 'apothem', label: 'апофема MM₁' },
      { key: 'axSect',  label: 'осьовий переріз ACC₁A₁' },
      { key: 'sides',   label: 'позначити a, b, h' },
      { key: 'baseIncBot',  label: 'вписане коло нижньої основи' },
      { key: 'baseCircBot', label: 'описане коло нижньої основи' },
      { key: 'baseIncTop',  label: 'вписане коло верхньої основи' },
      { key: 'baseCircTop', label: 'описане коло верхньої основи' },
    ],
    build(p, opts = {}) {
      const a = p.a / 2, b = p.b / 2;
      const V = {
        A:  v3(-a, 0,  a),   B:  v3( a, 0,  a),
        C:  v3( a, 0, -a),   D:  v3(-a, 0, -a),
        A1: v3(-b, p.h,  b), B1: v3( b, p.h,  b),
        C1: v3( b, p.h, -b), D1: v3(-b, p.h, -b),
        O:  v3( 0, 0, 0),    O1: v3( 0, p.h, 0),
      };
      const E = [
        ['A','B'],['B','C'],['C','D'],['D','A'],
        ['A1','B1'],['B1','C1'],['C1','D1'],['D1','A1'],
        ['A','A1'],['B','B1'],['C','C1'],['D','D1'],
      ];
      const F = [
        ['A','B','C','D'],
        ['A1','D1','C1','B1'],
        ['A','A1','B1','B'],
        ['B','B1','C1','C'],
        ['C','C1','D1','D'],
        ['D','D1','A1','A'],
      ];
      const labels = [
        { pos: V.A, text: 'A', off: { x: -8, y: 18 } },
        { pos: V.B, text: 'B', off: { x: 10, y: 18 } },
        { pos: V.C, text: 'C', off: { x: 12, y: 14 } },
        { pos: V.D, text: 'D', off: { x: -12, y: 14 } },
        { pos: V.A1, text: 'A₁', off: { x: -22, y: 0 } },
        { pos: V.B1, text: 'B₁', off: { x: 10, y: -2 } },
        { pos: V.C1, text: 'C₁', off: { x: 12, y: -6 } },
        { pos: V.D1, text: 'D₁', off: { x: -24, y: -6 } },
      ];
      const handles = [
        // bottom corner B for a
        { id: 'a', paramKey: 'a', worldPos: V.B, gradient: v3(0.5, 0, 0.5), hint: 'нижня основа a' },
        // top corner B1 for b
        { id: 'b', paramKey: 'b', worldPos: V.B1, gradient: v3(0.5, 0, 0.5), hint: 'верхня основа b' },
        // top center for h
        { id: 'h', paramKey: 'h', worldPos: V.O1, gradient: v3(0, 1, 0), hint: 'висота h' },
      ];
      const aux = [];
      if (opts.height) {
        aux.push({ kind: 'line', from: V.O, to: V.O1, color: '#c4622a', w: 1.6, dash: '7 3 1 3' });
        labels.push({ pos: V.O,  text: 'O',  off: { x: 6, y: 14 }, dot: true });
        labels.push({ pos: V.O1, text: 'O₁', off: { x: 8, y: -8 }, dot: true });
      }
      if (opts.apothem) {
        const M  = v3(0, 0,    a);   // midpoint of AB
        const M1 = v3(0, p.h,  b);   // midpoint of A1B1
        aux.push({ kind: 'line', from: M, to: M1, color: '#3b7b9b', w: 1.6 });
        labels.push({ pos: M,  text: 'M',  off: { x: -10, y: 16 }, dot: true });
        labels.push({ pos: M1, text: 'M₁', off: { x: -6,  y: -6 }, dot: true });
      }
      if (opts.axSect) {
        aux.push({ kind: 'poly', pts: [V.A, V.C, V.C1, V.A1], color: '#3b7b9b', fill: '#3b7b9b', fillOpacity: 0.13, w: 1.8 });
      }
      if (opts.sides) {
        labels.push({ pos: lerp(V.A, V.B, 0.5),   text: 'a', off: { x: 0, y: 22 }, italic: true });
        labels.push({ pos: lerp(V.A1, V.B1, 0.5), text: 'b', off: { x: 0, y: -10 }, italic: true });
        labels.push({ pos: lerp(V.B, V.B1, 0.5),  text: 'h', off: { x: 14, y: 4 }, italic: true });
      }
      if (opts.baseIncBot)  aux.push({ kind: 'horizCircle', y: 0,   radius: p.a / 2, color: '#7b6193', w: 1.4, dash: '3 3' });
      if (opts.baseCircBot) aux.push({ kind: 'horizCircle', y: 0,   radius: p.a * Math.SQRT2 / 2, color: '#3a8a4f', w: 1.4 });
      if (opts.baseIncTop)  aux.push({ kind: 'horizCircle', y: p.h, radius: p.b / 2, color: '#7b6193', w: 1.4, dash: '3 3' });
      if (opts.baseCircTop) aux.push({ kind: 'horizCircle', y: p.h, radius: p.b * Math.SQRT2 / 2, color: '#3a8a4f', w: 1.4 });
      return { kind: 'poly', V, E, F, labels, handles, aux };
    },
  };

  TEMPLATES.frustumPyramid4.buildUnfolded = function (p, t) {
    const a = p.a / 2, b = p.b / 2, h = p.h;
    const A = v3(-a, 0,  a), B = v3( a, 0,  a);
    const C = v3( a, 0, -a), D = v3(-a, 0, -a);
    const A1 = v3(-b, h,  b), B1 = v3( b, h,  b);
    const C1 = v3( b, h, -b), D1 = v3(-b, h, -b);
    const base = [A, B, C, D];
    const top  = [A1, B1, C1, D1];
    // Trapezoidal face leans inward at angle atan((a-b)/h) from vertical.
    // Rotate by π/2 + atan((a-b)/h) outward to lay flat.
    const tilt = Math.atan2(a - b, h);
    const target = Math.PI / 2 + tilt;
    const ang = t * target;
    const edges = [];
    polyEdges(base, edges);
    const tops = [];
    for (let i = 0; i < 4; i++) {
      const P1 = base[i], P2 = base[(i + 1) % 4];
      const Q1 = top[i],  Q2 = top[(i + 1) % 4];
      const Q1p = rotAxis(Q1, P1, sub(P2, P1), ang);
      const Q2p = rotAxis(Q2, P1, sub(P2, P1), ang);
      polyEdges([P1, P2, Q2p, Q1p], edges);
      tops.push([Q1p, Q2p]);
    }
    // Top square attached to trapezoid 0
    const hA = tops[0][0], hB = tops[0][1];
    const phase1 = top.map(q => rotAxis(q, base[0], sub(base[1], base[0]), ang));
    const finalTop = phase1.map(q => rotAxis(q, hA, sub(hB, hA), ang));
    polyEdges(finalTop, edges);
    return {
      kind: 'unfolded',
      edges,
      labels: [],
      preferredView: { yaw: 0, pitch: Math.PI/2 - 0.001 },
    };
  };


  // ---- 14) Похила 4-кутна призма ----
  TEMPLATES.obliquePrism4 = {
    key: 'obliquePrism4',
    name: 'Похила 4-кутна призма',
    full: 'ABCDA₁B₁C₁D₁',
    params: {
      a:  { value: 1.5, min: 0.6, max: 2.6, label: 'a' },
      h:  { value: 2.0, min: 0.5, max: 3.4, label: 'h' },
      tx: { value: 0.7, min: -1.6, max: 1.6, label: 'Δx' },
      tz: { value: 0.3, min: -1.6, max: 1.6, label: 'Δz' },
    },
    aux: [
      { key: 'height',   label: 'висота A₁H (⊥ до основи)' },
      { key: 'lateral',  label: 'бічне ребро AA₁' },
      { key: 'diagSect', label: 'переріз AB₁C₁D' },
      { key: 'sides',    label: 'позначити a, h' },
      { key: 'baseInc',  label: 'вписане коло основи' },
      { key: 'baseCirc', label: 'описане коло основи' },
    ],
    build(p, opts = {}) {
      const a = p.a / 2;
      const V = {
        A:  v3(-a, 0,  a),  B:  v3( a, 0,  a),  C:  v3( a, 0, -a),  D:  v3(-a, 0, -a),
        A1: v3(-a + p.tx, p.h,  a + p.tz),
        B1: v3( a + p.tx, p.h,  a + p.tz),
        C1: v3( a + p.tx, p.h, -a + p.tz),
        D1: v3(-a + p.tx, p.h, -a + p.tz),
      };
      const E = [
        ['A','B'],['B','C'],['C','D'],['D','A'],
        ['A1','B1'],['B1','C1'],['C1','D1'],['D1','A1'],
        ['A','A1'],['B','B1'],['C','C1'],['D','D1'],
      ];
      const F = [
        ['A','B','C','D'],
        ['A1','D1','C1','B1'],
        ['A','A1','B1','B'],
        ['B','B1','C1','C'],
        ['C','C1','D1','D'],
        ['D','D1','A1','A'],
      ];
      const labels = [
        { pos: V.A, text: 'A', off: { x: -8, y: 18 } },
        { pos: V.B, text: 'B', off: { x: 10, y: 18 } },
        { pos: V.C, text: 'C', off: { x: 12, y: 14 } },
        { pos: V.D, text: 'D', off: { x: -12, y: 14 } },
        { pos: V.A1, text: 'A₁', off: { x: -18, y: -6 } },
        { pos: V.B1, text: 'B₁', off: { x: 10, y: -6 } },
        { pos: V.C1, text: 'C₁', off: { x: 12, y: -6 } },
        { pos: V.D1, text: 'D₁', off: { x: -22, y: -4 } },
      ];
      const handles = [
        { id: 'a', paramKey: 'a', worldPos: V.B, gradient: v3(0.5, 0, 0.5), hint: 'ребро a' },
        // Top vertex A1: drag to control h (vertical) and shift (tx, tz)
        // Three handles, all at A1, but separated by gradient direction.
        // Easier: drag A1 freely (h, tx, tz) with a 2D handle for (tx, tz) and a separate vertical handle for h. But 3D drag is non-trivial.
        // Use: top corner B1 for h (vertical only), and a separate skew-handle at top-center for (tx, tz).
        { id: 'h', paramKey: 'h', worldPos: V.B1, gradient: v3(0, 1, 0), hint: 'висота h' },
        // top center — 2D handle controlling (tx, tz)
        { id: 'shift', paramKeys: ['tx', 'tz'], gradients: [v3(1, 0, 0), v3(0, 0, 1)],
          worldPos: v3(p.tx, p.h, p.tz), hint: 'нахил верху', shape: 'square' },
      ];
      const aux = [];
      if (opts.height) {
        // Perpendicular from A1 down to base plane (y=0). Foot H = (A1.x, 0, A1.z).
        const H = v3(V.A1.x, 0, V.A1.z);
        aux.push({ kind: 'line', from: V.A1, to: H, color: '#c4622a', w: 1.6, dash: '7 3 1 3' });
        labels.push({ pos: H, text: 'H', off: { x: 6, y: 16 }, dot: true });
        aux.push({ kind: 'rightAngle', at: H, dir1: v3(0, 1, 0), dir2: v3(1, 0, 0), size: 0.16 });
      }
      if (opts.lateral) {
        // emphasize a single lateral edge (AA1) — re-draw in accent
        aux.push({ kind: 'line', from: V.A, to: V.A1, color: '#3b7b9b', w: 2.2 });
      }
      if (opts.diagSect) {
        aux.push({ kind: 'poly', pts: [V.A, V.B1, V.C1, V.D], color: '#3b7b9b', fill: '#3b7b9b', fillOpacity: 0.13, w: 1.8 });
      }
      if (opts.sides) {
        labels.push({ pos: lerp(V.A, V.B, 0.5), text: 'a', off: { x: 0, y: 22 }, italic: true });
        labels.push({ pos: lerp(V.A, V.A1, 0.5), text: 'ℓ', off: { x: -16, y: 4 }, italic: true });
      }
      if (opts.baseInc) aux.push({ kind: 'horizCircle', y: 0, radius: p.a / 2, color: '#7b6193', w: 1.4, dash: '3 3' });
      if (opts.baseCirc) aux.push({ kind: 'horizCircle', y: 0, radius: p.a * Math.SQRT2 / 2, color: '#3a8a4f', w: 1.4 });
      return { kind: 'poly', V, E, F, labels, handles, aux };
    },
  };

  // Net unfolding for obliquePrism4.
  // Each lateral parallelogram face rotates around its base edge by the exact
  // dihedral angle needed to lie flat (y=0). The angle is computed analytically
  // for each face, so it adapts to any combination of tx/tz slant.
  TEMPLATES.obliquePrism4.buildUnfolded = function (p, t) {
    const a = p.a / 2;
    const base = [
      v3(-a, 0,  a), // A
      v3( a, 0,  a), // B
      v3( a, 0, -a), // C
      v3(-a, 0, -a), // D
    ];
    const offset = v3(p.tx, p.h, p.tz);
    const top = base.map(v => add(v, offset)); // A1, B1, C1, D1

    // Exact rotation angle around edge p0→p1 to bring p0t to y = 0.
    // Solves v_perp.y·cos θ + cv.y·sin θ = 0 → θ = π − atan2(v_perp.y, cv.y).
    function flattenAngle(p0, p1, p0t) {
      const axis = nrm(sub(p1, p0));
      const v    = sub(p0t, p0);
      const vpar = scl(axis, dot(v, axis));
      const vperp = sub(v, vpar);
      const cv = cross(axis, vperp);
      return Math.PI - Math.atan2(vperp.y, cv.y);
    }

    const n = 4;
    const edges = [];
    polyEdges(base, edges); // base square

    for (let i = 0; i < n; i++) {
      const p0 = base[i], p1 = base[(i + 1) % n];
      const p0t = top[i],  p1t = top[(i + 1) % n];
      const axis = nrm(sub(p1, p0));
      const phi  = t * flattenAngle(p0, p1, p0t);
      // Both top vertices rotate rigidly around the same hinge (through p0)
      const p0r = rotAxis(p0t, p0, axis, phi);
      const p1r = rotAxis(p1t, p0, axis, phi);
      polyEdges([p0, p1, p1r, p0r], edges);
    }

    // Top face: double-rotation — first around base edge A→B (phase 1),
    // then around the unfolded top edge A₁→B₁ (phase 2).
    // Second angle is computed from the fully-unfolded phase1 positions.
    const axis0 = nrm(sub(base[1], base[0]));
    const ang0  = flattenAngle(base[0], base[1], top[0]);
    const phase1Full = top.map(v => rotAxis(v, base[0], axis0, ang0));
    const hAf = phase1Full[0], hBf = phase1Full[1];
    const ang2 = flattenAngle(hAf, hBf, phase1Full[2]);

    const phi0   = t * ang0;
    const phase1 = top.map(v => rotAxis(v, base[0], axis0, phi0));
    const hA = phase1[0], hB = phase1[1];
    const topFinal = phase1.map(v => rotAxis(v, hA, nrm(sub(hB, hA)), t * ang2));
    polyEdges(topFinal, edges);

    return {
      kind: 'unfolded',
      edges,
      labels: [],
      preferredView: { yaw: 0, pitch: Math.PI / 2 - 0.001 },
    };
  };

  // ---- 15) Зрізаний конус ----
  TEMPLATES.frustumCone = {
    key: 'frustumCone',
    name: 'Зрізаний конус',
    full: '',
    params: {
      r1: { value: 1.3, min: 0.4, max: 2.0, label: 'R' },
      r2: { value: 0.6, min: 0.1, max: 1.8, label: 'r' },
      h:  { value: 1.8, min: 0.5, max: 3.2, label: 'h' },
    },
    aux: [
      { key: 'height',  label: 'висота OO₁' },
      { key: 'slant',   label: 'твірна AA₁' },
      { key: 'axSect',  label: 'осьовий переріз' },
    ],
    build(p, opts = {}) {
      return {
        kind: 'frustumCone',
        r1: p.r1, r2: p.r2, h: p.h,
        labels: [
          { pos: v3(0, 0, 0),    text: 'O',  off: { x: 6, y: 14 }, dot: true },
          { pos: v3(0, p.h, 0),  text: 'O₁', off: { x: 8, y: -8 }, dot: true },
          { pos: v3(p.r1, 0, 0), text: 'A',  off: { x: 8, y: 18 }, dot: false },
          { pos: v3(p.r2, p.h, 0), text: 'A₁', off: { x: 8, y: -6 }, dot: false },
        ],
        handles: [
          { id: 'h',  paramKey: 'h',  worldPos: v3(0, p.h, 0),     gradient: v3(0, 1, 0), hint: 'h' },
          { id: 'r1', paramKey: 'r1', worldPos: v3(p.r1, 0, 0),    gradient: v3(1, 0, 0), hint: 'R' },
          { id: 'r2', paramKey: 'r2', worldPos: v3(p.r2, p.h, 0),  gradient: v3(1, 0, 0), hint: 'r' },
        ],
        opts,
      };
    },
  };

  // Net unfolding for frustumCone (truncated cone).
  // Lateral surface → annular sector; two circular caps fold out separately.
  //
  // Virtual full-cone apex is at height h·R/(R−r) above the frustum base.
  // L_out = R·l/(R−r)  — radius of outer arc (bottom circle)
  // L_in  = r·l/(R−r)  — radius of inner arc (top circle)
  // sector angle θ = 2π·R/L_out = 2π·(R−r)/l
  // seam direction (from virtual apex): ((R−r)/l, −h/l) in XY plane.
  TEMPLATES.frustumCone.buildUnfolded = function (p, t) {
    const R = p.r1, r = p.r2, h = p.h;
    // Degenerate: R ≈ r (almost cylinder — no useful net)
    if (Math.abs(R - r) < 0.01) return { kind: 'unfolded', edges: [], labels: [],
      preferredView: { yaw: Math.PI / 2, pitch: 0 } };

    const l    = Math.sqrt((R - r) * (R - r) + h * h); // slant height of frustum
    const Lout = R * l / (R - r);                        // outer radius of annular sector
    const Lin  = r * l / (R - r);                        // inner radius

    // Virtual apex (fixed in space)
    const Avx = 0, Avy = h * R / (R - r);              // (x, y) in XZ world coordinates
    // Seam direction (from apex toward outer arc at φ=0)
    const sdx = (R - r) / l, sdy = -h / l;             // unit vector in XY plane (z=0)

    function flatPos(phi, tau) {
      const rr   = Lout - tau * l;                      // radius in annular sector
      const beta = phi * (R - r) / l;                   // angle in flat sector
      const cb   = Math.cos(beta), sb = Math.sin(beta);
      const dx   = sdx * cb - sdy * sb;
      const dy   = sdx * sb + sdy * cb;
      return v3(Avx + rr * dx, Avy + rr * dy, 0);
    }
    function frustPos(phi, tau) {
      const rho = R + (r - R) * tau;
      return v3(rho * Math.cos(phi), h * tau, rho * Math.sin(phi));
    }
    function morph(phi, tau) {
      const a = frustPos(phi, tau), b = flatPos(phi, tau);
      return v3(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y), a.z + t * (b.z - a.z));
    }

    const N = 72, M = 48;
    const edges = [];
    let prevBot = null, prevTop = null;
    for (let i = 0; i <= N; i++) {
      const phi = (i / N) * 2 * Math.PI;
      const pb = morph(phi, 0), pt = morph(phi, 1);
      if (prevBot) edges.push([prevBot, pb]);
      if (prevTop) edges.push([prevTop, pt]);
      prevBot = pb; prevTop = pt;
    }
    // Seam edges (two sides of the lateral cut)
    edges.push([morph(0, 0), morph(0, 1)]);
    edges.push([morph(2 * Math.PI, 0), morph(2 * Math.PI, 1)]);
    // Intermediate generators (every 60°)
    for (let i = 1; i < 6; i++) {
      const phi = i * Math.PI / 3;
      edges.push([morph(phi, 0), morph(phi, 1)]);
    }

    // Bottom cap (radius R): rotates around X-axis from horizontal to vertical, then drops
    const alpha = t * Math.PI / 2;
    const sinA = Math.sin(alpha), cosA = Math.cos(alpha);
    const dropB = t * (R + 0.4);
    let prevBotCap = null;
    for (let i = 0; i <= M; i++) {
      const theta = (i / M) * 2 * Math.PI;
      const x = R * Math.cos(theta), z0 = R * Math.sin(theta);
      const pt = v3(x, -z0 * sinA - dropB, z0 * cosA);
      if (prevBotCap) edges.push([prevBotCap, pt]);
      prevBotCap = pt;
    }
    // Top cap (radius r): rotates upward from the top of the flat sector
    const dropT = t * (r + 0.4);
    let prevTopCap = null;
    for (let i = 0; i <= M; i++) {
      const theta = (i / M) * 2 * Math.PI;
      const x = r * Math.cos(theta), z0 = r * Math.sin(theta);
      const pt = v3(x, h + z0 * sinA + dropT, z0 * cosA);
      if (prevTopCap) edges.push([prevTopCap, pt]);
      prevTopCap = pt;
    }

    const labels = [];
    if (t > 0.85) {
      labels.push({ pos: morph(Math.PI / 6, 0.5), text: 'ℓ', off: { x: 10, y: 2 }, italic: true });
      labels.push({ pos: morph(0, 0), text: 'A',  off: { x: 8,  y: 18 } });
      labels.push({ pos: morph(0, 1), text: 'A₁', off: { x: 8,  y: -8 } });
    } else if (t < 0.15) {
      labels.push({ pos: v3(R, 0, 0), text: 'A',  off: { x: 8, y: 18 } });
      labels.push({ pos: v3(r, h, 0), text: 'A₁', off: { x: 8, y: -8 } });
    }
    return {
      kind: 'unfolded',
      edges,
      labels,
      preferredView: { yaw: Math.PI / 2, pitch: 0 }, // side view like cylinder
    };
  };

  // =========================================================================
  // COMPOSITE & SECTION TEMPLATES (inscribed bodies and dynamic cross-sections)
  // =========================================================================

  // Helper — build the standard cube vertex dict.
  function cubeV(a) {
    const h = a / 2;
    return {
      A:  v3(-h, -h,  h), B:  v3( h, -h,  h), C:  v3( h, -h, -h), D:  v3(-h, -h, -h),
      A1: v3(-h,  h,  h), B1: v3( h,  h,  h), C1: v3( h,  h, -h), D1: v3(-h,  h, -h),
    };
  }
  const CUBE_E = [
    ['A','B'],['B','C'],['C','D'],['D','A'],
    ['A1','B1'],['B1','C1'],['C1','D1'],['D1','A1'],
    ['A','A1'],['B','B1'],['C','C1'],['D','D1'],
  ];
  const CUBE_F = [
    ['A','B','C','D'],['A1','D1','C1','B1'],
    ['A','A1','B1','B'],['D','C','C1','D1'],
    ['B','B1','C1','C'],['A','D','D1','A1'],
  ];
  function cubeLabels(V) {
    return [
      { pos: V.A, text: 'A', off: { x: -8, y: 18 } },
      { pos: V.B, text: 'B', off: { x: 10, y: 18 } },
      { pos: V.C, text: 'C', off: { x: 12, y: 14 } },
      { pos: V.D, text: 'D', off: { x: -12, y: 14 } },
      { pos: V.A1, text: 'A₁', off: { x: -18, y: -6 } },
      { pos: V.B1, text: 'B₁', off: { x: 10, y: -6 } },
      { pos: V.C1, text: 'C₁', off: { x: 12, y: -4 } },
      { pos: V.D1, text: 'D₁', off: { x: -22, y: -4 } },
    ];
  }

  // ---- 16) Куля, вписана в куб ----
  TEMPLATES.cubeInscribedSphere = {
    key: 'cubeInscribedSphere',
    name: 'Куля, вписана в куб',
    full: 'R = a/2',
    params: { a: { value: 1.8, min: 0.6, max: 2.8, label: 'a' } },
    aux: [
      { key: 'centerLabel', label: 'центр O' },
      { key: 'radius',      label: 'радіус OM' },
      { key: 'cubeDiag',    label: 'діагональ куба AC₁' },
      { key: 'tangents',    label: 'точки дотику' },
    ],
    build(p, opts = {}) {
      const a = p.a, h = a / 2;
      const V = cubeV(a);
      const O = v3(0, 0, 0);
      const labels = cubeLabels(V);
      const handles = [
        { id: 'a', paramKey: 'a', worldPos: V.B1, gradient: v3(0.5, 0.5, 0.5), hint: 'a' },
      ];
      const aux = [
        { kind: 'sphereWire', center: O, radius: h, color: '#3b7b9b', w: 1.5, equator: true },
      ];
      if (opts.centerLabel || opts.radius) {
        labels.push({ pos: O, text: 'O', off: { x: 6, y: 14 }, dot: true });
      }
      if (opts.radius) {
        const M = v3(0, 0, h);
        aux.push({ kind: 'line', from: O, to: M, color: '#c4622a', w: 1.6 });
        labels.push({ pos: M, text: 'M', off: { x: 8, y: 14 }, dot: true });
      }
      if (opts.cubeDiag) {
        aux.push({ kind: 'line', from: V.A, to: V.C1, color: '#7b6193', w: 1.5, dash: '5 3' });
      }
      if (opts.tangents) {
        // 6 tangent points — centres of each face
        const tangentPts = [
          v3(0, 0,  h), v3(0, 0, -h),
          v3( h, 0, 0), v3(-h, 0, 0),
          v3(0,  h, 0), v3(0, -h, 0),
        ];
        for (const pt of tangentPts) labels.push({ pos: pt, text: '', off: { x: 0, y: 0 }, dot: true });
      }
      return { kind: 'poly', V, E: CUBE_E, F: CUBE_F, labels, handles, aux };
    },
  };

  // ---- 17) Куля, описана навколо куба ----
  TEMPLATES.cubeCircumSphere = {
    key: 'cubeCircumSphere',
    name: 'Куля, описана навколо куба',
    full: 'R = a√3 / 2',
    params: { a: { value: 1.5, min: 0.6, max: 2.4, label: 'a' } },
    aux: [
      { key: 'centerLabel', label: 'центр O' },
      { key: 'radius',      label: 'радіус OA' },
      { key: 'cubeDiag',    label: 'діагональ куба AC₁ = 2R' },
    ],
    build(p, opts = {}) {
      const a = p.a, h = a / 2;
      const V = cubeV(a);
      const O = v3(0, 0, 0);
      const R = h * Math.sqrt(3);
      const labels = cubeLabels(V);
      const handles = [
        { id: 'a', paramKey: 'a', worldPos: V.B1, gradient: v3(0.5, 0.5, 0.5), hint: 'a' },
      ];
      const aux = [
        { kind: 'sphereWire', center: O, radius: R, color: '#3b7b9b', w: 1.5, equator: true },
      ];
      if (opts.centerLabel || opts.radius) {
        labels.push({ pos: O, text: 'O', off: { x: 6, y: 14 }, dot: true });
      }
      if (opts.radius) {
        aux.push({ kind: 'line', from: O, to: V.A, color: '#c4622a', w: 1.6 });
      }
      if (opts.cubeDiag) {
        aux.push({ kind: 'line', from: V.A, to: V.C1, color: '#7b6193', w: 1.5, dash: '5 3' });
      }
      return { kind: 'poly', V, E: CUBE_E, F: CUBE_F, labels, handles, aux };
    },
  };

  // ---- 18) Куля, вписана в циліндр ----
  TEMPLATES.cylinderInscribedSphere = {
    key: 'cylinderInscribedSphere',
    name: 'Куля, вписана в циліндр',
    full: 'h = 2R',
    params: {
      r: { value: 1.1, min: 0.4, max: 2.0, label: 'R' },
    },
    aux: [
      { key: 'sphereCenter', label: 'центр O' },
      { key: 'radius',       label: 'радіус кулі' },
      { key: 'height',       label: 'висота циліндра 2R' },
      { key: 'axSect',       label: 'осьовий переріз' },
    ],
    build(p, opts = {}) {
      const R = p.r, H = 2 * R;
      const O = v3(0, R, 0);
      const labels = [];
      if (opts.sphereCenter || opts.radius) {
        labels.push({ pos: O, text: 'O', off: { x: 8, y: 4 }, dot: true });
      }
      const aux = [
        { kind: 'sphereWire', center: O, radius: R, color: '#3b7b9b', w: 1.5, equator: true },
      ];
      if (opts.radius) {
        aux.push({ kind: 'line', from: O, to: v3(R, R, 0), color: '#c4622a', w: 1.6 });
      }
      return {
        kind: 'cylinder',
        r: R,
        h: H,
        labels,
        handles: [
          { id: 'r', paramKey: 'r', worldPos: v3(R, H, 0), gradient: v3(1, 0, 0), hint: 'R' },
        ],
        opts: { height: opts.height, axSect: opts.axSect },
        aux,
      };
    },
  };

  // ---- 19) Конус, вписаний у кулю ----
  TEMPLATES.sphereInscribedCone = {
    key: 'sphereInscribedCone',
    name: 'Конус, вписаний у кулю',
    full: 'апекс і обід — на кулі',
    params: {
      R:  { value: 1.4, min: 0.5, max: 2.0, label: 'R' },
      hc: { value: 2.0, min: 0.2, max: 3.95, label: 'h' },
    },
    aux: [
      { key: 'sphereCenter', label: 'центр O' },
      { key: 'coneHeight',   label: 'висота конуса' },
      { key: 'coneRadius',   label: 'радіус основи конуса' },
      { key: 'sphereEquator', label: 'екватор кулі' },
    ],
    build(p, opts = {}) {
      const R = p.R;
      const hc = Math.min(p.hc, 2 * R - 0.01);
      const yApex = R;
      const yBase = R - hc;
      const rc = Math.sqrt(Math.max(0, hc * (2 * R - hc)));
      const apex = v3(0, yApex, 0);
      const baseCenter = v3(0, yBase, 0);
      const labels = [];
      if (opts.sphereCenter) {
        labels.push({ pos: v3(0, 0, 0), text: 'O', off: { x: 6, y: 14 }, dot: true });
      }
      labels.push({ pos: apex, text: 'S', off: { x: 8, y: -6 } });
      const aux = [
        { kind: 'coneWire', apex: apex, r: rc, ybase: yBase, color: '#3a8a4f', w: 1.6 },
      ];
      if (opts.coneHeight) {
        aux.push({ kind: 'line', from: apex, to: baseCenter, color: '#c4622a', w: 1.5, dash: '7 3 1 3' });
        labels.push({ pos: baseCenter, text: 'O′', off: { x: 6, y: 14 }, dot: true });
      }
      if (opts.coneRadius) {
        const rim = v3(rc, yBase, 0);
        aux.push({ kind: 'line', from: baseCenter, to: rim, color: '#c4622a', w: 1.5 });
      }
      return {
        kind: 'sphere',
        r: R,
        labels,
        handles: [
          { id: 'R',  paramKey: 'R',  worldPos: v3(R, 0, 0),    gradient: v3(1, 0, 0),  hint: 'R' },
          // hc — drag the cone base center vertically (down = ↑hc)
          { id: 'hc', paramKey: 'hc', worldPos: baseCenter,     gradient: v3(0, -1, 0), hint: 'h' },
        ],
        opts: { equator: opts.sphereEquator },
        aux,
      };
    },
  };

  // ---- 20) Циліндр, вписаний у конус ----
  TEMPLATES.coneInscribedCylinder = {
    key: 'coneInscribedCylinder',
    name: 'Циліндр, вписаний у конус',
    full: 'верхній обід — на бічній поверхні конуса',
    params: {
      R:  { value: 1.4, min: 0.5, max: 2.0, label: 'R' },
      H:  { value: 2.4, min: 0.8, max: 3.6, label: 'H' },
      rc: { value: 0.75, min: 0.1, max: 1.95, label: 'r' },
    },
    aux: [
      { key: 'cylHeight', label: 'висота циліндра' },
      { key: 'cylRadius', label: 'радіус циліндра' },
      { key: 'coneHeight', label: 'висота конуса' },
    ],
    build(p, opts = {}) {
      const R = p.R, H = p.H;
      const rc = Math.min(p.rc, R * 0.99);
      const hc = H * (1 - rc / R);
      const labels = [
        { pos: v3(0, 0, 0), text: 'O', off: { x: 6, y: 14 }, dot: true },
        { pos: v3(0, H, 0), text: 'S', off: { x: 8, y: -6 } },
      ];
      const aux = [
        { kind: 'cylinderWire', r: rc, h: hc, ybottom: 0, color: '#3a8a4f', w: 1.5 },
      ];
      if (opts.cylHeight) {
        aux.push({ kind: 'line', from: v3(0, 0, 0), to: v3(0, hc, 0), color: '#c4622a', w: 1.5, dash: '7 3 1 3' });
      }
      if (opts.cylRadius) {
        aux.push({ kind: 'line', from: v3(0, hc, 0), to: v3(rc, hc, 0), color: '#c4622a', w: 1.5 });
      }
      return {
        kind: 'cone',
        r: R,
        h: H,
        labels,
        handles: [
          { id: 'H',  paramKey: 'H',  worldPos: v3(0, H, 0),    gradient: v3(0, 1, 0),  hint: 'H' },
          { id: 'R',  paramKey: 'R',  worldPos: v3(R, 0, 0),    gradient: v3(1, 0, 0),  hint: 'R' },
          // rc — drag top edge of cylinder. Top corner = (rc, hc, 0) where hc = H(1 - rc/R).
          // d(corner)/d(rc) = (1, -H/R, 0). Drag direction stays on cone slant naturally.
          { id: 'rc', paramKey: 'rc', worldPos: v3(rc, hc, 0), gradient: v3(1, -H/R, 0), hint: 'r' },
        ],
        opts: { height: opts.coneHeight },
        aux,
      };
    },
  };

  // ---- 21) Куб з перерізом через 3 точки ----
  TEMPLATES.cubeSection3 = {
    key: 'cubeSection3',
    name: 'Куб з перерізом через 3 точки',
    full: 'P ∈ AB · Q ∈ CC₁ · R ∈ D₁A₁',
    params: {
      a:  { value: 1.8, min: 0.6, max: 2.6, label: 'a' },
      t1: { value: 0.5, min: 0.02, max: 0.98, label: 'P' },
      t2: { value: 0.5, min: 0.02, max: 0.98, label: 'Q' },
      t3: { value: 0.5, min: 0.02, max: 0.98, label: 'R' },
    },
    aux: [
      { key: 'fill',     label: 'заливка перерізу' },
      { key: 'verticesLabel', label: 'позначити вершини перерізу' },
      { key: 'normal',   label: 'нормаль до перерізу' },
    ],
    build(p, opts = {}) {
      const a = p.a;
      const V = cubeV(a);
      const P = lerp(V.A, V.B, p.t1);
      const Q = lerp(V.C, V.C1, p.t2);
      const R = lerp(V.D1, V.A1, p.t3);
      const sectPts = computeCubeSection(V, [P, Q, R]);
      const labels = cubeLabels(V);
      labels.push({ pos: P, text: 'P', off: { x: -4, y: 22 }, dot: true });
      labels.push({ pos: Q, text: 'Q', off: { x: 14, y: 4 }, dot: true });
      labels.push({ pos: R, text: 'R', off: { x: -8, y: -10 }, dot: true });
      if (opts.verticesLabel) {
        // Label any extra section vertex (besides P, Q, R) with small numbered tags.
        let k = 1;
        for (const sp of sectPts) {
          const close = [P, Q, R].some(t => Math.hypot(t.x-sp.x, t.y-sp.y, t.z-sp.z) < 1e-3);
          if (close) continue;
          labels.push({ pos: sp, text: 'K' + k, off: { x: 6, y: -4 }, dot: true });
          k++;
        }
      }
      const handles = [
        { id: 'a',  paramKey: 'a',  worldPos: V.B1, gradient: v3(0.5, 0.5, 0.5), hint: 'a' },
        { id: 't1', paramKey: 't1', worldPos: P,    gradient: v3(a, 0, 0), hint: 'P' },
        { id: 't2', paramKey: 't2', worldPos: Q,    gradient: v3(0, a, 0), hint: 'Q' },
        { id: 't3', paramKey: 't3', worldPos: R,    gradient: v3(0, 0, a), hint: 'R' },
      ];
      const aux = [];
      if (sectPts.length >= 3) {
        aux.push({
          kind: 'poly', pts: sectPts,
          color: '#c4622a',
          fill: '#c4622a',
          fillOpacity: opts.fill ? 0.32 : 0.14,
          w: 2,
        });
        if (opts.normal) {
          let cx = 0, cy = 0, cz = 0;
          for (const sp of sectPts) { cx += sp.x; cy += sp.y; cz += sp.z; }
          cx /= sectPts.length; cy /= sectPts.length; cz /= sectPts.length;
          const cnt = v3(cx, cy, cz);
          const nVec = nrm(cross(sub(sectPts[1], sectPts[0]), sub(sectPts[2], sectPts[0])));
          const tip = v3(cnt.x + nVec.x * 0.45, cnt.y + nVec.y * 0.45, cnt.z + nVec.z * 0.45);
          aux.push({ kind: 'line', from: cnt, to: tip, color: '#3a8a4f', w: 1.6 });
        }
      }
      return { kind: 'poly', V, E: CUBE_E, F: CUBE_F, labels, handles, aux };
    },
  };

  // ========== WORKSPACE ==========
  class Workspace {
    constructor(host, templateKey) {
      this.host = host;
      this.templateKey = templateKey;
      const tpl = TEMPLATES[templateKey];
      this.template = tpl;
      // params (copy defaults)
      this.params = {};
      for (const k in tpl.params) this.params[k] = tpl.params[k].value;
      // aux toggles
      this.opts = {};
      for (const a of tpl.aux) this.opts[a.key] = false;
      // camera
      this.cam = {
        yaw: -0.5,
        pitch: 0.28,
        scale: 110,
      };
      // mode
      this.mode = 'adapt';
      // drawing strokes (SVG path strings)
      this.strokes = [];
      this.pen = { color: '#c4622a', width: 3, tool: 'pen' };
      this._needsFit = true;
      this.unfoldT = 0;
      this.autoOrbit = false;
      this._build();
      this._render();
      this._initInteraction();
      this._initResize();
    }

    setMode(m) {
      this.mode = m;
      this.host.classList.toggle('nmt3-draw', m === 'draw');
      this.host.classList.toggle('nmt3-adapt', m === 'adapt');
      this._render();
    }

    setOpt(key, v) {
      this.opts[key] = v;
      this._build();
      this._needsFit = true;
      this._render();
    }

    setParam(key, v) {
      const meta = this.template.params[key];
      this.params[key] = clamp(v, meta.min, meta.max);
      this._build();
      this._needsFit = true;
      this._render();
    }

    setParams(dict) {
      for (const k in dict) {
        const meta = this.template.params[k];
        if (!meta) continue;
        this.params[k] = clamp(dict[k], meta.min, meta.max);
      }
      this._build();
      this._needsFit = true;
      this._render();
    }

    clearStrokes() {
      this.strokes = [];
      this._render();
    }

    resetView() {
      this._animateCam(-0.5, 0.28, 450);
    }

    setView(name) {
      const PRESETS = {
        '3d':      { yaw: -0.5,        pitch:  0.28 },
        'iso':     { yaw: -Math.PI/4,  pitch:  Math.atan(Math.SQRT1_2) },  // ≈35.26°
        'front':   { yaw:  0,          pitch:  0    },
        'back':    { yaw:  Math.PI,    pitch:  0    },
        'side':    { yaw:  Math.PI/2,  pitch:  0    },
        'sideL':   { yaw: -Math.PI/2,  pitch:  0    },
        'top':     { yaw:  0,          pitch:  Math.PI/2 - 0.001 },
        'bottom':  { yaw:  0,          pitch: -Math.PI/2 + 0.001 },
      };
      const p = PRESETS[name];
      if (!p) return;
      // If auto-orbit was on, stop it for the transition.
      this._wasAutoOrbit = this.autoOrbit;
      this.autoOrbit = false;
      this._animateCam(p.yaw, p.pitch, 600, () => {
        if (this._wasAutoOrbit) {
          this.autoOrbit = true;
          this._tickOrbit();
        }
      });
    }

    _animateCam(toYaw, toPitch, ms, done) {
      const fromYaw = this.cam.yaw, fromPitch = this.cam.pitch;
      let dYaw = toYaw - fromYaw;
      while (dYaw >  Math.PI) dYaw -= 2 * Math.PI;
      while (dYaw < -Math.PI) dYaw += 2 * Math.PI;
      const t0 = performance.now();
      this._needsFit = true;
      const tick = () => {
        const now = performance.now();
        const k = Math.min(1, (now - t0) / ms);
        const e = k < 0.5 ? 4*k*k*k : 1 - Math.pow(-2*k+2, 3)/2;
        this.cam.yaw   = fromYaw   + dYaw * e;
        this.cam.pitch = fromPitch + (toPitch - fromPitch) * e;
        this._needsFit = true;
        this._render();
        if (k < 1) {
          this._camAnimTimer = setTimeout(tick, 16);
        } else {
          this._camAnimTimer = null;
          if (done) done();
        }
      };
      if (this._camAnimTimer) clearTimeout(this._camAnimTimer);
      tick();
    }

    setAutoOrbit(on, speedDegPerSec) {
      this.autoOrbit = !!on;
      if (typeof speedDegPerSec === 'number') this.autoOrbitSpeed = speedDegPerSec;
      if (this._orbitTimer) { clearTimeout(this._orbitTimer); this._orbitTimer = null; }
      if (this.autoOrbit) {
        this._orbitLast = performance.now();
        this._tickOrbit();
      }
    }

    // Animate net-unfold to target t ∈ [0, 1].
    animateUnfold(targetT, ms) {
      if (!this.template.buildUnfolded) return;
      const fromT = this.unfoldT || 0;
      const t0 = performance.now();
      if (this._unfoldTimer) clearTimeout(this._unfoldTimer);
      // When opening the net — animate camera to the template's preferred view
      // (defaults to top-down for polyhedra; cylinder/cone prefer side view).
      if (targetT > 0.5) {
        if (this._preUnfoldCam == null) {
          this._preUnfoldCam = { yaw: this.cam.yaw, pitch: this.cam.pitch };
        }
        // Probe the unfolded geometry at t=1 to find preferredView.
        let pref = null;
        if (this.template.buildUnfolded) {
          const g = this.template.buildUnfolded(this.params, 1);
          pref = g.preferredView;
        }
        const targetCam = pref || { yaw: 0, pitch: Math.PI/2 - 0.001 };
        this._animateCam(targetCam.yaw, targetCam.pitch, ms || 900);
      } else {
        const restore = this._preUnfoldCam || { yaw: -0.5, pitch: 0.28 };
        this._preUnfoldCam = null;
        this._animateCam(restore.yaw, restore.pitch, ms || 900);
      }
      const tick = () => {
        if (this._destroyed) return;
        const now = performance.now();
        const k = Math.min(1, (now - t0) / (ms || 900));
        // ease-in-out cubic
        const e = k < 0.5 ? 4*k*k*k : 1 - Math.pow(-2*k+2, 3)/2;
        this.unfoldT = fromT + (targetT - fromT) * e;
        this._build();
        this._needsFit = true;
        this._render();
        if (k < 1) {
          this._unfoldTimer = setTimeout(tick, 16);
        } else {
          this._unfoldTimer = null;
          this.unfoldT = targetT;
        }
      };
      tick();
    }

    toggleUnfold() {
      const target = (this.unfoldT > 0.5) ? 0 : 1;
      this.animateUnfold(target, 900);
    }

    destroy() {
      this._destroyed = true;
      this.autoOrbit = false;
      if (this._orbitTimer) { clearTimeout(this._orbitTimer); this._orbitTimer = null; }
      if (this._camAnimTimer) { clearTimeout(this._camAnimTimer); this._camAnimTimer = null; }
      if (this._unfoldTimer) { clearTimeout(this._unfoldTimer); this._unfoldTimer = null; }
      if (this._ro) { try { this._ro.disconnect(); } catch (_) {} this._ro = null; }
    }

    _tickOrbit() {
      if (!this.autoOrbit || this._destroyed) return;
      const now = performance.now();
      const dt = (now - (this._orbitLast || now)) / 1000;
      this._orbitLast = now;
      const speed = (this.autoOrbitSpeed || 25) * Math.PI / 180;
      this.cam.yaw += dt * speed;
      while (this.cam.yaw >  Math.PI) this.cam.yaw -= 2 * Math.PI;
      while (this.cam.yaw < -Math.PI) this.cam.yaw += 2 * Math.PI;
      this._needsFit = true;
      this._render();
      this._orbitTimer = setTimeout(() => this._tickOrbit(), 33);
    }

    _build() {
      if (this.unfoldT > 0.001 && this.template.buildUnfolded) {
        this.geom = this.template.buildUnfolded(this.params, this.unfoldT);
      } else {
        this.geom = this.template.build(this.params, this.opts);
      }
    }

    _autoFit() {
      // Determine center offset + optionally scale so the geometry fits in the stage.
      const rect = this.host.getBoundingClientRect();
      const W = rect.width, H = rect.height;
      if (W < 10 || H < 10) return false;
      const probe = { yaw: this.cam.yaw, pitch: this.cam.pitch, scale: 1 };
      const pts = this._collectAllPoints();
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (const p of pts) {
        const q = project(p, probe);
        if (q.x < minX) minX = q.x;
        if (q.x > maxX) maxX = q.x;
        if (q.y < minY) minY = q.y;
        if (q.y > maxY) maxY = q.y;
      }
      if (this._needsFit) {
        const bw = maxX - minX, bh = maxY - minY;
        const pad = 56;
        const s = Math.min((W - pad * 2) / Math.max(bw, 0.01), (H - pad * 2) / Math.max(bh, 0.01));
        this.cam.scale = Math.max(40, Math.min(220, s * 0.92));
      }
      // Always re-center the bbox (so shape doesn't drift off-screen during rotation)
      const bcx = (minX + maxX) / 2;
      const bcy = (minY + maxY) / 2;
      this.cam.offsetX = -bcx * this.cam.scale;
      this.cam.offsetY = -bcy * this.cam.scale;
      return true;
    }

    _collectAllPoints() {
      const G = this.geom;
      const pts = [];
      if (G.kind === 'poly') {
        for (const k in G.V) pts.push(G.V[k]);
      } else if (G.kind === 'unfolded') {
        for (const [a, b] of G.edges) { pts.push(a); pts.push(b); }
      } else if (G.kind === 'cylinder' || G.kind === 'cone') {
        pts.push(v3(-G.r, 0, 0), v3(G.r, 0, 0), v3(0, 0, -G.r), v3(0, 0, G.r));
        if (G.kind === 'cylinder') pts.push(v3(-G.r, G.h, 0), v3(G.r, G.h, 0), v3(0, G.h, -G.r), v3(0, G.h, G.r));
        else pts.push(v3(0, G.h, 0));
      } else if (G.kind === 'sphere') {
        pts.push(v3(-G.r, 0, 0), v3(G.r, 0, 0), v3(0, -G.r, 0), v3(0, G.r, 0), v3(0, 0, -G.r), v3(0, 0, G.r));
      } else if (G.kind === 'frustumCone') {
        pts.push(v3(-G.r1, 0, 0), v3(G.r1, 0, 0), v3(0, 0, -G.r1), v3(0, 0, G.r1));
        pts.push(v3(-G.r2, G.h, 0), v3(G.r2, G.h, 0), v3(0, G.h, -G.r2), v3(0, G.h, G.r2));
      }
      return pts;
    }

    _render() {
      this._autoFit();
      if (this._needsFit) this._needsFit = false;
      const rect = this.host.getBoundingClientRect();
      const W = rect.width, H = rect.height;
      const cx = W / 2, cy = H / 2;
      const cam = this.cam;
      const G = this.geom;
      const visiblePaths = [];
      const hiddenPaths = [];
      const auxPaths = [];
      const fillPaths = [];
      const dotEls = [];
      const labelEls = [];

      const proj = (P) => {
        const q = project(P, cam);
        return { x: q.x + cx + (cam.offsetX || 0), y: q.y + cy + (cam.offsetY || 0), z: q.z };
      };

      // --- build figure paths
      if (G.kind === 'poly') {
        // Compute face front/back
        const faceFront = {};
        for (let fi = 0; fi < G.F.length; fi++) {
          const f = G.F[fi];
          // normal: (v1-v0) × (v2-v0). The face windings throughout this file are
          // CCW viewed from INSIDE the solid (so cross gives the *inward* normal).
          // Therefore "front-facing for camera" ⇔ normal points AWAY from camera
          // in camera-space, i.e. nCam.z < 0.
          const v0 = G.V[f[0]], v1 = G.V[f[1]], v2 = G.V[f[2]];
          const n = cross(sub(v1, v0), sub(v2, v0));
          const nCam = rotateByCam(n, cam);
          faceFront[fi] = nCam.z < 0;
        }
        // For each edge, find adjacent faces and decide visibility
        const edgeFaces = new Map();
        const edgeKey = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
        for (let fi = 0; fi < G.F.length; fi++) {
          const f = G.F[fi];
          for (let i = 0; i < f.length; i++) {
            const a = f[i], b = f[(i + 1) % f.length];
            const k = edgeKey(a, b);
            if (!edgeFaces.has(k)) edgeFaces.set(k, []);
            edgeFaces.get(k).push(fi);
          }
        }
        for (const [a, b] of G.E) {
          const k = edgeKey(a, b);
          const faces = edgeFaces.get(k) || [];
          const visible = faces.some(fi => faceFront[fi]);
          const pA = proj(G.V[a]);
          const pB = proj(G.V[b]);
          const d = `M${pA.x.toFixed(1)},${pA.y.toFixed(1)} L${pB.x.toFixed(1)},${pB.y.toFixed(1)}`;
          (visible ? visiblePaths : hiddenPaths).push(d);
        }
      } else if (G.kind === 'unfolded') {
        // Net unfolding — flat geometry, all edges visible.
        for (const [a, b] of G.edges) {
          const pA = proj(a), pB = proj(b);
          visiblePaths.push(`M${pA.x.toFixed(1)},${pA.y.toFixed(1)} L${pB.x.toFixed(1)},${pB.y.toFixed(1)}`);
        }
      } else if (G.kind === 'cylinder') {
        const r = G.r, h = G.h;
        const topRing = projectHorizCircle(0, r, h, cam);
        const botRing = projectHorizCircle(0, r, 0, cam);
        const ox = cx + (cam.offsetX || 0), oy = cy + (cam.offsetY || 0);
        topRing.forEach(p => { p.x += ox; p.y += oy; });
        botRing.forEach(p => { p.x += ox; p.y += oy; });
        // top ring fully visible
        visiblePaths.push(polylineToPath(topRing));
        // bottom: front half visible, back half hidden
        const split = frontBackOfRing(botRing);
        visiblePaths.push(polylineToPath(split.front));
        hiddenPaths.push(polylineToPath(split.back));
        // silhouette generators: vertical lines from bottom split points to top split points
        // Find equivalent splits on the top ring at same screen-x extremes:
        const topSplit = frontBackOfRing(topRing);
        // Connect lower split A → upper split A, lower split B → upper split B
        visiblePaths.push(`M${split.splitA.x.toFixed(1)},${split.splitA.y.toFixed(1)} L${topSplit.splitA.x.toFixed(1)},${topSplit.splitA.y.toFixed(1)}`);
        visiblePaths.push(`M${split.splitB.x.toFixed(1)},${split.splitB.y.toFixed(1)} L${topSplit.splitB.x.toFixed(1)},${topSplit.splitB.y.toFixed(1)}`);

        // aux
        if (G.opts.height) {
          const o0 = proj(v3(0, 0, 0)), o1 = proj(v3(0, h, 0));
          auxPaths.push({ d: `M${o0.x.toFixed(1)},${o0.y.toFixed(1)} L${o1.x.toFixed(1)},${o1.y.toFixed(1)}`, color: '#c4622a', w: 1.6, dash: '7 3 1 3' });
        }
        if (G.opts.axSect) {
          const A = proj(v3(-r, 0, 0)), B = proj(v3(r, 0, 0));
          const A1 = proj(v3(-r, h, 0)), B1 = proj(v3(r, h, 0));
          const d = `M${A.x.toFixed(1)},${A.y.toFixed(1)} L${B.x.toFixed(1)},${B.y.toFixed(1)} L${B1.x.toFixed(1)},${B1.y.toFixed(1)} L${A1.x.toFixed(1)},${A1.y.toFixed(1)} Z`;
          fillPaths.push({ d, color: '#3b7b9b', fillOpacity: 0.13 });
          auxPaths.push({ d, color: '#3b7b9b', w: 1.6 });
        }
        if (G.opts.radius) {
          const O = proj(v3(0, 0, 0)), A = proj(v3(r, 0, 0));
          auxPaths.push({ d: `M${O.x.toFixed(1)},${O.y.toFixed(1)} L${A.x.toFixed(1)},${A.y.toFixed(1)}`, color: '#3b7b9b', w: 1.5 });
          labelEls.push({ x: A.x + 8, y: A.y + 18, text: 'A' });
        }
      } else if (G.kind === 'cone') {
        const r = G.r, h = G.h;
        const botRing = projectHorizCircle(0, r, 0, cam);
        const ox = cx + (cam.offsetX || 0), oy = cy + (cam.offsetY || 0);
        botRing.forEach(p => { p.x += ox; p.y += oy; });
        const split = frontBackOfRing(botRing);
        visiblePaths.push(polylineToPath(split.front));
        hiddenPaths.push(polylineToPath(split.back));
        // Apex
        const S = proj(v3(0, h, 0));
        // Generators to tangent points (split A and B)
        visiblePaths.push(`M${split.splitA.x.toFixed(1)},${split.splitA.y.toFixed(1)} L${S.x.toFixed(1)},${S.y.toFixed(1)}`);
        visiblePaths.push(`M${split.splitB.x.toFixed(1)},${split.splitB.y.toFixed(1)} L${S.x.toFixed(1)},${S.y.toFixed(1)}`);

        if (G.opts.height) {
          const O = proj(v3(0, 0, 0));
          auxPaths.push({ d: `M${O.x.toFixed(1)},${O.y.toFixed(1)} L${S.x.toFixed(1)},${S.y.toFixed(1)}`, color: '#c4622a', w: 1.6, dash: '7 3 1 3' });
        }
        if (G.opts.slant) {
          const A = proj(v3(r, 0, 0));
          auxPaths.push({ d: `M${A.x.toFixed(1)},${A.y.toFixed(1)} L${S.x.toFixed(1)},${S.y.toFixed(1)}`, color: '#3b7b9b', w: 1.6 });
          labelEls.push({ x: A.x + 8, y: A.y + 18, text: 'A' });
        }
        if (G.opts.axSect) {
          const A = proj(v3(-r, 0, 0)), B = proj(v3(r, 0, 0));
          const d = `M${A.x.toFixed(1)},${A.y.toFixed(1)} L${B.x.toFixed(1)},${B.y.toFixed(1)} L${S.x.toFixed(1)},${S.y.toFixed(1)} Z`;
          fillPaths.push({ d, color: '#3b7b9b', fillOpacity: 0.13 });
          auxPaths.push({ d, color: '#3b7b9b', w: 1.6 });
        }
      } else if (G.kind === 'frustumCone') {
        const r1 = G.r1, r2 = G.r2, h = G.h;
        const botRing = projectHorizCircle(0, r1, 0, cam);
        const topRing = projectHorizCircle(0, r2, h, cam);
        const ox = cx + (cam.offsetX || 0), oy = cy + (cam.offsetY || 0);
        botRing.forEach(p => { p.x += ox; p.y += oy; });
        topRing.forEach(p => { p.x += ox; p.y += oy; });
        visiblePaths.push(polylineToPath(topRing));
        const splitBot = frontBackOfRing(botRing);
        visiblePaths.push(polylineToPath(splitBot.front));
        hiddenPaths.push(polylineToPath(splitBot.back));
        const splitTop = frontBackOfRing(topRing);
        visiblePaths.push(`M${splitBot.splitA.x.toFixed(1)},${splitBot.splitA.y.toFixed(1)} L${splitTop.splitA.x.toFixed(1)},${splitTop.splitA.y.toFixed(1)}`);
        visiblePaths.push(`M${splitBot.splitB.x.toFixed(1)},${splitBot.splitB.y.toFixed(1)} L${splitTop.splitB.x.toFixed(1)},${splitTop.splitB.y.toFixed(1)}`);
        if (G.opts.height) {
          const o0 = proj(v3(0, 0, 0)), o1 = proj(v3(0, h, 0));
          auxPaths.push({ d: `M${o0.x.toFixed(1)},${o0.y.toFixed(1)} L${o1.x.toFixed(1)},${o1.y.toFixed(1)}`, color: '#c4622a', w: 1.6, dash: '7 3 1 3' });
        }
        if (G.opts.slant) {
          const A = proj(v3(r1, 0, 0)), A1 = proj(v3(r2, h, 0));
          auxPaths.push({ d: `M${A.x.toFixed(1)},${A.y.toFixed(1)} L${A1.x.toFixed(1)},${A1.y.toFixed(1)}`, color: '#3b7b9b', w: 1.6 });
        }
        if (G.opts.axSect) {
          const a = proj(v3(-r1, 0, 0)), b = proj(v3(r1, 0, 0));
          const c2 = proj(v3(r2, h, 0)), d2 = proj(v3(-r2, h, 0));
          const dstr = `M${a.x.toFixed(1)},${a.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)} L${c2.x.toFixed(1)},${c2.y.toFixed(1)} L${d2.x.toFixed(1)},${d2.y.toFixed(1)} Z`;
          fillPaths.push({ d: dstr, color: '#3b7b9b', fillOpacity: 0.13 });
          auxPaths.push({ d: dstr, color: '#3b7b9b', w: 1.6 });
        }
      } else if (G.kind === 'sphere') {
        const r = G.r;
        // Sphere silhouette in orthographic = a circle of radius r*scale around projected center
        const c = proj(v3(0, 0, 0));
        const sr = r * cam.scale;
        visiblePaths.push(`M${c.x - sr},${c.y} A${sr},${sr} 0 1 0 ${c.x + sr},${c.y} A${sr},${sr} 0 1 0 ${c.x - sr},${c.y} Z`);
        if (G.opts.equator) {
          const ring = projectHorizCircle(0, r, 0, cam);
          const ox = cx + (cam.offsetX || 0), oy = cy + (cam.offsetY || 0);
          ring.forEach(p => { p.x += ox; p.y += oy; });
          const sp = frontBackOfRing(ring);
          auxPaths.push({ d: polylineToPath(sp.front), color: '#3b7b9b', w: 1.6 });
          auxPaths.push({ d: polylineToPath(sp.back), color: '#7a6b56', w: 1, dash: '4 3' });
        }
        if (G.opts.axis) {
          const N = proj(v3(0, r, 0)), S = proj(v3(0, -r, 0));
          auxPaths.push({ d: `M${N.x.toFixed(1)},${N.y.toFixed(1)} L${S.x.toFixed(1)},${S.y.toFixed(1)}`, color: '#c4622a', w: 1.5, dash: '6 3' });
          labelEls.push({ x: N.x + 6, y: N.y - 4, text: 'N' });
          labelEls.push({ x: S.x + 6, y: S.y + 16, text: 'S' });
        }
        if (G.opts.radius) {
          const A = proj(v3(r, 0, 0)), O = proj(v3(0, 0, 0));
          auxPaths.push({ d: `M${O.x.toFixed(1)},${O.y.toFixed(1)} L${A.x.toFixed(1)},${A.y.toFixed(1)}`, color: '#3b7b9b', w: 1.5 });
          labelEls.push({ x: A.x + 8, y: A.y + 18, text: 'A' });
        }
      }

      // --- aux (line / poly / rightAngle / sphereWire / cylinderWire / coneWire)
      if (G.aux) {
        for (const a of G.aux) {
          if (a.kind === 'line') {
            const p = proj(a.from), q = proj(a.to);
            auxPaths.push({ d: `M${p.x.toFixed(1)},${p.y.toFixed(1)} L${q.x.toFixed(1)},${q.y.toFixed(1)}`, color: a.color, w: a.w || 1.6, dash: a.dash || '' });
          } else if (a.kind === 'poly') {
            const proj_ = a.pts.map(proj);
            const d = 'M' + proj_.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L') + ' Z';
            if (a.fill) fillPaths.push({ d, color: a.fill, fillOpacity: a.fillOpacity || 0.13 });
            auxPaths.push({ d, color: a.color, w: a.w || 1.6, dash: a.dash || '' });
          } else if (a.kind === 'rightAngle') {
            const c = a.at;
            const e1 = scl(a.dir1, a.size);
            const e2 = scl(a.dir2, a.size);
            const p1 = proj(add(c, e1));
            const p2 = proj(add(c, add(e1, e2)));
            const p3 = proj(add(c, e2));
            auxPaths.push({ d: `M${p1.x.toFixed(1)},${p1.y.toFixed(1)} L${p2.x.toFixed(1)},${p2.y.toFixed(1)} L${p3.x.toFixed(1)},${p3.y.toFixed(1)}`, color: '#1a1612', w: 1.1, fill: 'none' });
          } else if (a.kind === 'sphereWire') {
            // Sphere with center & radius. Always draws full silhouette circle.
            // Optionally draws equator (front visible, back dashed).
            const C = proj(a.center);
            const sr = a.radius * cam.scale;
            const silh = `M${(C.x - sr).toFixed(1)},${C.y.toFixed(1)} A${sr.toFixed(1)},${sr.toFixed(1)} 0 1 0 ${(C.x + sr).toFixed(1)},${C.y.toFixed(1)} A${sr.toFixed(1)},${sr.toFixed(1)} 0 1 0 ${(C.x - sr).toFixed(1)},${C.y.toFixed(1)} Z`;
            const col = a.color || '#3b7b9b';
            auxPaths.push({ d: silh, color: col, w: a.w || 1.5, dash: a.dash || '' });
            if (a.equator !== false) {
              const ring = projectHorizCircle(0, a.radius, a.center.y, cam, 60);
              const ox = cx + (cam.offsetX || 0), oy = cy + (cam.offsetY || 0);
              ring.forEach(p => { p.x += ox; p.y += oy; });
              const sp = frontBackOfRing(ring);
              auxPaths.push({ d: polylineToPath(sp.front), color: col, w: 1.1 });
              auxPaths.push({ d: polylineToPath(sp.back),  color: '#7a6b56', w: 1, dash: '4 3' });
            }
          } else if (a.kind === 'cylinderWire') {
            const r = a.r, h = a.h, yBot = a.ybottom || 0;
            const ox = cx + (cam.offsetX || 0), oy = cy + (cam.offsetY || 0);
            const topRing = projectHorizCircle(0, r, yBot + h, cam);
            const botRing = projectHorizCircle(0, r, yBot,     cam);
            topRing.forEach(p => { p.x += ox; p.y += oy; });
            botRing.forEach(p => { p.x += ox; p.y += oy; });
            const col = a.color || '#3a8a4f';
            auxPaths.push({ d: polylineToPath(topRing), color: col, w: a.w || 1.4 });
            const split = frontBackOfRing(botRing);
            auxPaths.push({ d: polylineToPath(split.front), color: col, w: a.w || 1.4 });
            auxPaths.push({ d: polylineToPath(split.back),  color: '#7a6b56', w: 1, dash: '4 3' });
            const topSplit = frontBackOfRing(topRing);
            auxPaths.push({ d: `M${split.splitA.x.toFixed(1)},${split.splitA.y.toFixed(1)} L${topSplit.splitA.x.toFixed(1)},${topSplit.splitA.y.toFixed(1)}`, color: col, w: a.w || 1.4 });
            auxPaths.push({ d: `M${split.splitB.x.toFixed(1)},${split.splitB.y.toFixed(1)} L${topSplit.splitB.x.toFixed(1)},${topSplit.splitB.y.toFixed(1)}`, color: col, w: a.w || 1.4 });
          } else if (a.kind === 'coneWire') {
            const r = a.r, ybase = a.ybase != null ? a.ybase : 0;
            const apex = a.apex;
            const ox = cx + (cam.offsetX || 0), oy = cy + (cam.offsetY || 0);
            const botRing = projectHorizCircle(0, r, ybase, cam);
            botRing.forEach(p => { p.x += ox; p.y += oy; });
            const split = frontBackOfRing(botRing);
            const col = a.color || '#3a8a4f';
            auxPaths.push({ d: polylineToPath(split.front), color: col, w: a.w || 1.4 });
            auxPaths.push({ d: polylineToPath(split.back),  color: '#7a6b56', w: 1, dash: '4 3' });
            const S = proj(apex);
            auxPaths.push({ d: `M${split.splitA.x.toFixed(1)},${split.splitA.y.toFixed(1)} L${S.x.toFixed(1)},${S.y.toFixed(1)}`, color: col, w: a.w || 1.4 });
            auxPaths.push({ d: `M${split.splitB.x.toFixed(1)},${split.splitB.y.toFixed(1)} L${S.x.toFixed(1)},${S.y.toFixed(1)}`, color: col, w: a.w || 1.4 });
          } else if (a.kind === 'horizCircle') {
            // Horizontal circle in plane y = a.y, centered on axis. Front half visible, back half dashed.
            const ring = projectHorizCircle(0, a.radius, a.y || 0, cam, 60);
            const ox = cx + (cam.offsetX || 0), oy = cy + (cam.offsetY || 0);
            ring.forEach(p => { p.x += ox; p.y += oy; });
            const sp = frontBackOfRing(ring);
            const col = a.color || '#3b7b9b';
            auxPaths.push({ d: polylineToPath(sp.front), color: col, w: a.w || 1.4, dash: a.dash || '' });
            auxPaths.push({ d: polylineToPath(sp.back),  color: '#7a6b56', w: 1, dash: '4 3' });
          }
        }
      }

      // --- labels & dots (from geom)
      for (const lab of (G.labels || [])) {
        const p = proj(lab.pos);
        if (lab.dot) dotEls.push({ x: p.x, y: p.y });
        labelEls.push({ x: p.x + (lab.off ? lab.off.x : 0), y: p.y + (lab.off ? lab.off.y : 0), text: lab.text, italic: lab.italic !== false });
      }

      // --- handles (only in adapt mode)
      const handleEls = [];
      if (this.mode === 'adapt' && G.handles) {
        for (const h of G.handles) {
          const p = proj(h.worldPos);
          handleEls.push({ x: p.x, y: p.y, id: h.id, hint: h.hint, shape: h.shape });
        }
      }

      // ===== compose SVG =====
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="nmt3-svg">`;
      // fills first
      for (const f of fillPaths) svg += `<path d="${f.d}" fill="${f.color}" fill-opacity="${f.fillOpacity}" stroke="none"/>`;
      // hidden edges
      for (const d of hiddenPaths) svg += `<path d="${d}" fill="none" stroke="#7a6b56" stroke-width="1" stroke-dasharray="4 3" stroke-linecap="round" stroke-linejoin="round"/>`;
      // aux
      for (const a of auxPaths) svg += `<path d="${a.d}" fill="none" stroke="${a.color}" stroke-width="${a.w}" ${a.dash ? `stroke-dasharray="${a.dash}"` : ''} stroke-linecap="round" stroke-linejoin="round"/>`;
      // visible edges
      for (const d of visiblePaths) svg += `<path d="${d}" fill="none" stroke="#1a1612" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
      // dots
      for (const d of dotEls) svg += `<circle cx="${d.x.toFixed(1)}" cy="${d.y.toFixed(1)}" r="2.6" fill="#1a1612"/>`;
      // labels
      for (const l of labelEls) svg += `<text x="${l.x.toFixed(1)}" y="${l.y.toFixed(1)}" font-family="'Times New Roman','STIX Two Text',serif" font-style="${l.italic === false ? 'normal' : 'italic'}" font-size="18" fill="#1a1612">${l.text}</text>`;
      // user pen strokes (drawn ABOVE figure, in both modes)
      for (const s of this.strokes) svg += `<path d="${s.d}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
      // handles last (top)
      for (const h of handleEls) {
        svg += `<g class="nmt3-handle" data-handle="${h.id}">`;
        if (h.shape === 'square') {
          // 2D handle — square outline + cross hairs
          const s = 9;
          svg += `<rect x="${(h.x - s - 4).toFixed(1)}" y="${(h.y - s - 4).toFixed(1)}" width="${(s * 2 + 8).toFixed(1)}" height="${(s * 2 + 8).toFixed(1)}" fill="rgba(196,98,42,0.15)" stroke="none" rx="3"/>`;
          svg += `<rect x="${(h.x - s).toFixed(1)}" y="${(h.y - s).toFixed(1)}" width="${(s * 2).toFixed(1)}" height="${(s * 2).toFixed(1)}" fill="#fffaf0" stroke="#c4622a" stroke-width="2" rx="2"/>`;
          svg += `<path d="M${(h.x - 4).toFixed(1)},${h.y.toFixed(1)} L${(h.x + 4).toFixed(1)},${h.y.toFixed(1)} M${h.x.toFixed(1)},${(h.y - 4).toFixed(1)} L${h.x.toFixed(1)},${(h.y + 4).toFixed(1)}" stroke="#c4622a" stroke-width="1.6" stroke-linecap="round"/>`;
        } else {
          svg += `<circle cx="${h.x.toFixed(1)}" cy="${h.y.toFixed(1)}" r="11" fill="rgba(196,98,42,0.15)" stroke="none"/>`;
          svg += `<circle cx="${h.x.toFixed(1)}" cy="${h.y.toFixed(1)}" r="6.5" fill="#fffaf0" stroke="#c4622a" stroke-width="2"/>`;
          svg += `<circle cx="${h.x.toFixed(1)}" cy="${h.y.toFixed(1)}" r="2.2" fill="#c4622a"/>`;
        }
        svg += `</g>`;
      }
      svg += '</svg>';
      // Render into a dedicated layer so we don't wipe the hint/mini-mode overlays
      let layer = this.host.querySelector(':scope > .nmt3-svg-layer');
      if (!layer) {
        layer = document.createElement('div');
        layer.className = 'nmt3-svg-layer';
        layer.style.cssText = 'position:absolute;inset:0;';
        this.host.insertBefore(layer, this.host.firstChild);
      }
      layer.innerHTML = svg;

      // Update sidebar param readout only when params actually changed
      // (not on every orbit/render tick — re-rendering the panel kills click handlers).
      const sig = JSON.stringify(this.params);
      if (this.onParamsChanged && sig !== this._lastParamsSig) {
        this._lastParamsSig = sig;
        this.onParamsChanged(this.params);
      }
    }

    _initInteraction() {
      let dragMode = null;  // 'orbit' | 'handle' | 'pen' | 'erase'
      let dragHandle = null;
      let dragScreenAxes = null;   // [{sx,sy}, ...] — one per param (1 or 2)
      let last = { x: 0, y: 0 };
      let penCurPath = null;

      const ptFromEvt = (e) => {
        const r = this.host.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      };

      this.host.addEventListener('pointerdown', (e) => {
        this.host.setPointerCapture(e.pointerId);
        const p = ptFromEvt(e);
        last = p;

        if (this.mode === 'draw') {
          if (this.pen.tool === 'pen') {
            dragMode = 'pen';
            penCurPath = { d: `M${p.x.toFixed(1)},${p.y.toFixed(1)}`, pts: [p], color: this.pen.color, width: this.pen.width };
            this.strokes.push(penCurPath);
            this._render();
          } else if (this.pen.tool === 'erase') {
            dragMode = 'erase';
            this._eraseAt(p);
          }
          return;
        }

        // adapt mode: hit-test handles
        const target = e.target.closest('.nmt3-handle');
        if (target) {
          const hid = target.getAttribute('data-handle');
          const handle = this.geom.handles.find(h => h.id === hid);
          if (handle) {
            dragMode = 'handle';
            dragHandle = handle;
            // Compute screen-space gradient(s).
            const w0 = handle.worldPos;
            const q0 = project(w0, this.cam);
            const grads = handle.gradients || [handle.gradient];
            dragScreenAxes = grads.map(g => {
              const q1 = project(add(w0, g), this.cam);
              return { sx: q1.x - q0.x, sy: q1.y - q0.y };
            });
            this.host.style.cursor = 'grabbing';
            return;
          }
        }
        // empty space → orbit
        dragMode = 'orbit';
        if (this.autoOrbit) { this._wasAutoOrbit = true; this.autoOrbit = false; }
        this.host.style.cursor = 'grabbing';
      });

      this.host.addEventListener('pointermove', (e) => {
        const p = ptFromEvt(e);
        if (!dragMode) {
          // hover handle? cursor feedback in adapt mode
          if (this.mode === 'adapt') {
            const target = e.target.closest('.nmt3-handle');
            this.host.style.cursor = target ? 'grab' : 'grab';
          }
          return;
        }
        const dx = p.x - last.x, dy = p.y - last.y;
        if (dragMode === 'orbit') {
          this.cam.yaw   += dx * 0.012;
          this.cam.pitch  = clamp(this.cam.pitch + dy * 0.012, -1.2, 1.2);
          this._render();
        } else if (dragMode === 'handle' && dragHandle) {
          const dx2 = p.x - last.x, dy2 = p.y - last.y;
          const keys = dragHandle.paramKeys || [dragHandle.paramKey];
          if (keys.length === 1) {
            // 1-D handle: project screen delta onto handle screen-axis.
            const ax = dragScreenAxes[0];
            const lenSq = ax.sx * ax.sx + ax.sy * ax.sy;
            if (lenSq < 1) return;
            const d = (dx2 * ax.sx + dy2 * ax.sy) / lenSq;
            this.setParam(keys[0], this.params[keys[0]] + d);
          } else {
            // 2-D handle: solve [ax bx][d1]   [dx]
            //                   [ay by][d2] = [dy]
            const A = dragScreenAxes[0], B = dragScreenAxes[1];
            const det = A.sx * B.sy - A.sy * B.sx;
            if (Math.abs(det) < 0.5) return;
            const d1 = ( dx2 * B.sy - dy2 * B.sx) / det;
            const d2 = (-dx2 * A.sy + dy2 * A.sx) / det;
            const upd = {};
            upd[keys[0]] = this.params[keys[0]] + d1;
            upd[keys[1]] = this.params[keys[1]] + d2;
            this.setParams(upd);
          }
        } else if (dragMode === 'pen' && penCurPath) {
          penCurPath.pts.push(p);
          penCurPath.d += ` L${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          this._render();
        } else if (dragMode === 'erase') {
          this._eraseAt(p);
        }
        last = p;
      });

      const endDrag = () => {
        dragMode = null;
        dragHandle = null;
        penCurPath = null;
        this.host.style.cursor = '';
      };
      this.host.addEventListener('pointerup', endDrag);
      this.host.addEventListener('pointercancel', endDrag);
      this.host.addEventListener('wheel', (e) => {
        e.preventDefault();
        const factor = Math.exp(-e.deltaY * 0.001);
        this.cam.scale = clamp(this.cam.scale * factor, 30, 280);
        this._render();
      }, { passive: false });
    }

    _eraseAt(p) {
      const R2 = 14 * 14;
      this.strokes = this.strokes.filter(s => {
        return !s.pts.some(pp => {
          const dx = pp.x - p.x, dy = pp.y - p.y;
          return dx * dx + dy * dy < R2;
        });
      });
      this._render();
    }

    _initResize() {
      if (window.ResizeObserver) {
        this._ro = new ResizeObserver(() => { this._needsFit = true; this._render(); });
        this._ro.observe(this.host);
      } else {
        window.addEventListener('resize', () => { this._needsFit = true; this._render(); });
      }
    }
  }

  // Export
  window.NMT3D = { TEMPLATES, Workspace };
})();

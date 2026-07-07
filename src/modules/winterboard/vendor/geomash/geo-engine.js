/* ═══════════════════════════════════════════════════════════
   GeoEngine — headless-ядро GeoMASH (без dc-runtime, без DOM)
   Гайд §2.8: логіка об'єктів — тут; UI-шар (тулбар/панелі) — окремо.

   Модель: об'єкти — плоскі JS-обʼєкти у Map(id → obj), 15 типів
   (див. README handoff). Координати: wx/wy — світові.
   cs (координатна система) передається явно:
     { ox, oy, sc, S(wx,wy)→[sx,sy], W(sx,sy)→[wx,wy] }

   API (усі функції чисті — приймають objects/cs, нічого не мутують,
   крім updateDeps, який за контрактом мутує похідні точки in-place):
     GeoEngine.circum(a, b, c)                 → [cx,cy] | null
     GeoEngine.regPolyPts(A, B, n)             → [[x,y],…]
     GeoEngine.arcFrom(cs, A, M, B)            → {cx,cy,r,sa,ea,ccw} | null (екранні)
     GeoEngine.arcParams(objects, cs, o)       → те саме для arc/semicircle
     GeoEngine.lineDef(objects, o)             → {x,y,dx,dy} | null (світові)
     GeoEngine.dlineDef(objects, o)            → те саме для похідних прямих
     GeoEngine.circleDefW(objects, o)          → {cx,cy,r} | null (світові)
     GeoEngine.lineClamp(objects, o)           → {x,y,dx,dy,t0,t1} | null
     GeoEngine.intersectObjs(objects, aId, bId)→ [pt|null, pt|null] | null
     GeoEngine.collectPts(objects, id)         → [pointId,…] (рекурсивно)
     GeoEngine.updateDeps(objects, changedId)  → мутує похідні (midOf/regOf/intOf)
     GeoEngine.nextId(objects, type)           → вільний id ('point'|'angle'|'fn'|інше)
     GeoEngine.renameRefs(objects, id, name)   → нова Map з оновленими посиланнями
     GeoEngine.cloneClosure(objects, ids)      → {entries:[[nid,obj]…], map:{old→new}}
     GeoEngine.serialize(objects, cs)          → {format,version,objects[],cs}
     GeoEngine.deserialize(scene)              → {objects:Map, cs:{ox,oy,sc}|null}
   ═══════════════════════════════════════════════════════════ */
(function (global) {

  function circum(a, b, c) {
    const d = 2 * (a.wx * (b.wy - c.wy) + b.wx * (c.wy - a.wy) + c.wx * (a.wy - b.wy));
    if (Math.abs(d) < 1e-12) return null;
    const A2 = a.wx * a.wx + a.wy * a.wy, B2 = b.wx * b.wx + b.wy * b.wy, C2 = c.wx * c.wx + c.wy * c.wy;
    return [
      (A2 * (b.wy - c.wy) + B2 * (c.wy - a.wy) + C2 * (a.wy - b.wy)) / d,
      (A2 * (c.wx - b.wx) + B2 * (a.wx - c.wx) + C2 * (b.wx - a.wx)) / d,
    ];
  }

  function regPolyPts(A, B, n) {
    const dx = B.wx - A.wx, dy = B.wy - A.wy;
    const d = Math.hypot(dx, dy) || 1e-9;
    const h = d / (2 * Math.tan(Math.PI / n));
    const cx = (A.wx + B.wx) / 2 - dy / d * h;
    const cy = (A.wy + B.wy) / 2 + dx / d * h;
    const a0 = Math.atan2(A.wy - cy, A.wx - cx);
    const R = Math.hypot(A.wx - cx, A.wy - cy);
    const pts = [];
    for (let k = 0; k < n; k++) {
      const a = a0 + k * 2 * Math.PI / n;
      pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]);
    }
    return pts;
  }

  function arcFrom(cs, A, M, B) {
    const cc = circum(A, M, B);
    if (!cc) return null;
    const [cx, cy] = cs.S(cc[0], cc[1]);
    const r = Math.hypot(A.wx - cc[0], A.wy - cc[1]) * cs.sc;
    const [ax, ay] = cs.S(A.wx, A.wy);
    const [mx, my] = cs.S(M.wx, M.wy);
    const [bx, by] = cs.S(B.wx, B.wy);
    const sa = Math.atan2(ay - cy, ax - cx);
    const am = Math.atan2(my - cy, mx - cx);
    const ea = Math.atan2(by - cy, bx - cx);
    const T2 = Math.PI * 2;
    const cwM = ((am - sa) % T2 + T2) % T2, cwB = ((ea - sa) % T2 + T2) % T2;
    return { cx, cy, r, sa, ea, ccw: !(cwM <= cwB) };
  }

  function arcParams(objects, cs, o) {
    if (o.type === 'semicircle') {
      const A = objects.get(o.p1), B = objects.get(o.p2);
      if (!A || !B) return null;
      const dx = B.wx - A.wx, dy = B.wy - A.wy;
      if (Math.hypot(dx, dy) < 1e-9) return null;
      const T = { wx: (A.wx + B.wx) / 2 - dy / 2, wy: (A.wy + B.wy) / 2 + dx / 2 };
      return arcFrom(cs, A, T, B);
    }
    const A = objects.get(o.p1), M = objects.get(o.p2), B = objects.get(o.p3);
    if (!A || !M || !B) return null;
    return arcFrom(cs, A, M, B);
  }

  function lineDef(objects, o) {
    if (o.type === 'dline') return dlineDef(objects, o);
    const p1 = objects.get(o.p1), p2 = objects.get(o.p2);
    if (!p1 || !p2) return null;
    return { x: p1.wx, y: p1.wy, dx: p2.wx - p1.wx, dy: p2.wy - p1.wy };
  }

  function dlineDef(objects, o) {
    if (o.sub === 'perp' || o.sub === 'para') {
      const P = objects.get(o.pid), L = objects.get(o.lid);
      const ld = P && L && lineDef(objects, L);
      if (!ld) return null;
      return o.sub === 'perp'
        ? { x: P.wx, y: P.wy, dx: -ld.dy, dy: ld.dx }
        : { x: P.wx, y: P.wy, dx: ld.dx,  dy: ld.dy };
    }
    if (o.sub === 'perpbis') {
      const A = objects.get(o.p1), B = objects.get(o.p2);
      if (!A || !B) return null;
      return { x: (A.wx + B.wx) / 2, y: (A.wy + B.wy) / 2, dx: -(B.wy - A.wy), dy: B.wx - A.wx };
    }
    if (o.sub === 'angbis') {
      const A = objects.get(o.p1), B = objects.get(o.p2), C = objects.get(o.p3);
      if (!A || !B || !C) return null;
      const m1 = Math.hypot(A.wx - B.wx, A.wy - B.wy) || 1e-9;
      const m2 = Math.hypot(C.wx - B.wx, C.wy - B.wy) || 1e-9;
      let dx = (A.wx - B.wx) / m1 + (C.wx - B.wx) / m2;
      let dy = (A.wy - B.wy) / m1 + (C.wy - B.wy) / m2;
      if (Math.hypot(dx, dy) < 1e-9) { dx = -(A.wy - B.wy) / m1; dy = (A.wx - B.wx) / m1; }
      return { x: B.wx, y: B.wy, dx, dy };
    }
    if (o.sub === 'tangent') {
      const P = objects.get(o.pid), C = objects.get(o.lid);
      const cd = P && C && circleDefW(objects, C);
      if (!cd) return null;
      const dx = P.wx - cd.cx, dy = P.wy - cd.cy, d = Math.hypot(dx, dy);
      if (d <= cd.r + 1e-12) return null;
      const base = Math.atan2(dy, dx), a = Math.acos(cd.r / d);
      const ang = base + (o.branch ? -a : a);
      const tx = cd.cx + cd.r * Math.cos(ang), ty = cd.cy + cd.r * Math.sin(ang);
      return { x: P.wx, y: P.wy, dx: tx - P.wx, dy: ty - P.wy };
    }
    return null;
  }

  function circleDefW(objects, o) {
    if (o.type === 'circle') {
      const c = objects.get(o.cid); if (!c) return null;
      const rp = objects.get(o.rid);
      return { cx: c.wx, cy: c.wy, r: rp ? Math.hypot(c.wx - rp.wx, c.wy - rp.wy) : (o.r || 1) };
    }
    if (o.type === 'circle3') {
      const a = objects.get(o.p1), b = objects.get(o.p2), c = objects.get(o.p3);
      if (!a || !b || !c) return null;
      const cc = circum(a, b, c); if (!cc) return null;
      return { cx: cc[0], cy: cc[1], r: Math.hypot(a.wx - cc[0], a.wy - cc[1]) };
    }
    return null;
  }

  function lineClamp(objects, o) {
    const ld = lineDef(objects, o); if (!ld) return null;
    const inf = (o.type === 'line' || o.type === 'dline');
    return { ...ld, t0: inf ? -Infinity : 0, t1: (inf || o.type === 'ray') ? Infinity : 1 };
  }

  function intersectObjs(objects, aId, bId) {
    const A = objects.get(aId), B = objects.get(bId);
    if (!A || !B) return null;
    const LT = ['segment', 'line', 'ray', 'vector', 'dline'];
    const isLA = LT.includes(A.type), isLB = LT.includes(B.type);
    const la = isLA ? lineClamp(objects, A) : null, lb = isLB ? lineClamp(objects, B) : null;
    const ca = !isLA ? circleDefW(objects, A) : null, cb = !isLB ? circleDefW(objects, B) : null;
    const EPS = 1e-12, TOL = 1e-9;
    if (la && lb) {
      const den = la.dx * lb.dy - la.dy * lb.dx;
      if (Math.abs(den) < EPS) return [null, null];
      const t = ((lb.x - la.x) * lb.dy - (lb.y - la.y) * lb.dx) / den;
      const s = ((lb.x - la.x) * la.dy - (lb.y - la.y) * la.dx) / den;
      if (t < la.t0 - TOL || t > la.t1 + TOL || s < lb.t0 - TOL || s > lb.t1 + TOL) return [null, null];
      return [[la.x + t * la.dx, la.y + t * la.dy], null];
    }
    if ((la && cb) || (lb && ca)) {
      const L = la || lb, C = ca || cb;
      if (!L || !C) return null;
      const a = L.dx * L.dx + L.dy * L.dy;
      const b2 = 2 * (L.dx * (L.x - C.cx) + L.dy * (L.y - C.cy));
      const c2 = (L.x - C.cx) ** 2 + (L.y - C.cy) ** 2 - C.r * C.r;
      const disc = b2 * b2 - 4 * a * c2;
      if (disc < 0 || a < EPS) return [null, null];
      const sd = Math.sqrt(disc);
      return [(-b2 - sd) / (2 * a), (-b2 + sd) / (2 * a)]
        .map(t => (t < L.t0 - TOL || t > L.t1 + TOL) ? null : [L.x + t * L.dx, L.y + t * L.dy]);
    }
    if (ca && cb) {
      const dx = cb.cx - ca.cx, dy = cb.cy - ca.cy, d = Math.hypot(dx, dy);
      if (d < EPS || d > ca.r + cb.r || d < Math.abs(ca.r - cb.r)) return [null, null];
      const a = (ca.r * ca.r - cb.r * cb.r + d * d) / (2 * d);
      const h = Math.sqrt(Math.max(0, ca.r * ca.r - a * a));
      const mx = ca.cx + a * dx / d, my = ca.cy + a * dy / d;
      return [[mx + h * dy / d, my - h * dx / d], [mx - h * dy / d, my + h * dx / d]];
    }
    return null;
  }

  function collectPts(objects, id, seen = new Set()) {
    const o = objects.get(id);
    if (!o || seen.has(id)) return [];
    seen.add(id);
    const refs = [o.p1, o.p2, o.p3, o.cid, o.rid, o.pid, o.lid, ...(o.vids || [])].filter(Boolean);
    const out = [];
    for (const r of refs) {
      const ro = objects.get(r);
      if (!ro) continue;
      if (ro.type === 'point') out.push(r);
      out.push(...collectPts(objects, r, seen));
    }
    return out;
  }

  // Мутує похідні точки (midOf/regOf/intOf) після зміни changedId — контракт як у UI
  function updateDeps(objects, changedId) {
    for (const o of objects.values()) {
      if (!(o.deps || []).includes(changedId)) continue;
      if (o.midOf) {
        const p1 = objects.get(o.midOf[0]), p2 = objects.get(o.midOf[1]);
        if (p1 && p2) {
          o.wx = (p1.wx + p2.wx) / 2;
          o.wy = (p1.wy + p2.wy) / 2;
          updateDeps(objects, o.id);
        }
      }
      if (o.regOf) {
        const [aId, bId, n, k] = o.regOf;
        const A = objects.get(aId), B = objects.get(bId);
        if (A && B) {
          const pts = regPolyPts(A, B, n);
          o.wx = pts[k][0]; o.wy = pts[k][1];
          updateDeps(objects, o.id);
        }
      }
      if (o.intOf) {
        const ipts = intersectObjs(objects, o.intOf[0], o.intOf[1]);
        const p = ipts && ipts[o.intOf[2]];
        if (p) {
          o.visible = true;
          if (o.wx !== p[0] || o.wy !== p[1]) {
            o.wx = p[0]; o.wy = p[1];
            updateDeps(objects, o.id);
          }
        } else {
          o.visible = false;
        }
      }
    }
  }

  function nextId(m, type) {
    if (type === 'point') {
      for (let c = 65; c <= 90; c++) { const id = String.fromCharCode(c); if (!m.has(id)) return id; }
      for (let i = 1;; i++) { const id = 'A' + i; if (!m.has(id)) return id; }
    }
    if (type === 'angle') {
      for (const ch of ['α','β','γ','δ','ε','ζ','η','θ']) { if (!m.has(ch)) return ch; }
      for (let i = 1;; i++) { const id = 'α' + i; if (!m.has(id)) return id; }
    }
    if (type === 'fn') {
      for (const ch of ['f','g','h','p','q']) { if (!m.has(ch)) return ch; }
      for (let i = 1;; i++) { const id = 'f' + i; if (!m.has(id)) return id; }
    }
    for (const ch of ['a','b','c','d','e','i','j','k','l','m','n']) { if (!m.has(ch)) return ch; }
    for (let i = 1;; i++) { const id = 'a' + i; if (!m.has(id)) return id; }
  }

  function renameRefs(objects, id, name) {
    const fix = v => v === id ? name : v;
    const m = new Map();
    for (const o of objects.values()) {
      const n = { ...o };
      for (const f of ['p1', 'p2', 'p3', 'cid', 'rid', 'pid', 'lid']) if (n[f]) n[f] = fix(n[f]);
      if (n.vids)  n.vids  = n.vids.map(fix);
      if (n.deps)  n.deps  = n.deps.map(fix);
      if (n.midOf) n.midOf = n.midOf.map(fix);
      if (n.regOf) n.regOf = [fix(n.regOf[0]), fix(n.regOf[1]), n.regOf[2], n.regOf[3]];
      if (n.intOf) n.intOf = [fix(n.intOf[0]), fix(n.intOf[1]), n.intOf[2]];
      n.id = fix(n.id);
      m.set(n.id, n);
    }
    return m;
  }

  // Замикання залежностей для copy/paste/duplicate: повертає нові обʼєкти зі зсувом
  function cloneClosure(objects, ids, offset = { dx: 0.5, dy: -0.5 }) {
    const seen = new Set(), closure = [];
    const visit = (oid) => {
      if (seen.has(oid)) return; seen.add(oid);
      const o = objects.get(oid); if (!o) return;
      [o.p1, o.p2, o.p3, o.cid, o.rid, o.pid, o.lid, ...(o.vids || [])].filter(Boolean).forEach(visit);
      closure.push(o);
    };
    ids.forEach(visit);
    const taken = new Set(objects.keys()), map = {}, entries = [];
    for (const o of closure) {
      let nid = o.id + '′'; while (taken.has(nid)) nid += '′';
      taken.add(nid);
      map[o.id] = nid;
      const n = { ...o, id: nid };
      for (const f of ['p1', 'p2', 'p3', 'cid', 'rid', 'pid', 'lid']) if (n[f] && map[n[f]]) n[f] = map[n[f]];
      if (n.vids)  n.vids  = n.vids.map(v => map[v] || v);
      if (n.deps)  n.deps  = n.deps.map(v => map[v] || v);
      if (n.midOf) n.midOf = n.midOf.map(v => map[v] || v);
      if (n.regOf) n.regOf = [map[n.regOf[0]] || n.regOf[0], map[n.regOf[1]] || n.regOf[1], n.regOf[2], n.regOf[3]];
      if (n.intOf) n.intOf = [map[n.intOf[0]] || n.intOf[0], map[n.intOf[1]] || n.intOf[1], n.intOf[2]];
      if (typeof n.wx === 'number') { n.wx += offset.dx; n.wy += offset.dy; }
      entries.push([nid, n]);
    }
    return { entries, map };
  }

  function serialize(objects, cs) {
    return { format: 'geomash-scene', version: 1,
      objects: [...objects.values()],
      cs: cs ? { ox: cs.ox, oy: cs.oy, sc: cs.sc } : undefined };
  }

  function deserialize(scene) {
    if (!scene || !Array.isArray(scene.objects)) return { objects: new Map(), cs: null };
    return {
      objects: new Map(scene.objects.map(o => [o.id, { ...o }])),
      cs: scene.cs ? { ox: scene.cs.ox, oy: scene.cs.oy, sc: scene.cs.sc } : null,
    };
  }

  const GeoEngine = {
    circum, regPolyPts, arcFrom, arcParams,
    lineDef, dlineDef, circleDefW, lineClamp,
    intersectObjs, collectPts, updateDeps, nextId,
    renameRefs, cloneClosure, serialize, deserialize,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GeoEngine;
  else global.GeoEngine = GeoEngine;

})(typeof window !== 'undefined' ? window : globalThis);

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

     Stage 2 (§2.8 headless-конструктор, без UI/canvas/React) — секція ── КОНСТРУКТОР ──:
     GeoEngine.construct(objects, cs, cmd)     → {objects:Map, created:string[]} | {error}
     GeoEngine.move(objects, cs, id, wx, wy)   → {objects:Map, moved:string[]} | {error}
     GeoEngine.remove(objects, id, opts?)      → {objects:Map, removed:string[]} | {error}
     GeoEngine.restyle(objects, id, patch)     → {objects:Map} | {error}
     GeoEngine.toolSpec()                      → [{op,labelKey,category,inputs[]}]
     GeoEngine.canConstruct(objects, cmd)      → {ok:true} | {ok:false, reason}
     GeoEngine.getValue(objects, id)           → string (алгебра-рядок, опційно)
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
      // point-on (stage 2 §3.1 'point-on'): перерахувати позицію за збереженим param,
      // коли базовий об'єкт (пряма/коло) змінився
      if (o.onObj && o.onKind) {
        const p = positionFromParam(objects, o.onObj, o.onParam, o.onKind);
        if (p && (o.wx !== p.wx || o.wy !== p.wy)) {
          o.wx = p.wx; o.wy = p.wy;
          updateDeps(objects, o.id);
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

  // ── КОНСТРУКТОР ──────────────────────────────────────────────
  // Stage 2 (§2.8 headless-конструктор): construct / move / remove / restyle
  // + toolSpec / canConstruct. Дзеркало §4 (рендерер): чисті функції,
  // нуль document./addEventListener/RAF/localStorage/React.
  // Це — headless-винесення execute-сторони твого Command Pattern
  // (AddObjectCmd/MovePointCmd/DeleteObjectCmd/ChangeStyleCmd з GeoEngine Docs):
  // undo-стек та batching-drag залишаються на боці хоста (дошки) —
  // ці функції віддають лише атомарний execute.
  // ───────────────────────────────────────────────────────────

  const DEF_COLOR = '#1a5c38', DEF_LW = 2;
  const LINE_LIKE = ['segment', 'line', 'ray', 'vector', 'dline'];
  const CIRCLE_LIKE = ['circle', 'circle3'];

  function style_(cmd) {
    return { color: cmd.color || DEF_COLOR, lw: (cmd.lw != null ? cmd.lw : DEF_LW) };
  }
  function base_(id, type, extra, cmd) {
    return Object.assign({ id, type, labelMode: 'none', visible: true, locked: false }, style_(cmd || {}), extra);
  }
  function isPoint(objects, id) { const o = objects.get(id); return !!o && o.type === 'point'; }
  function typeOf(objects, id) { const o = objects.get(id); return o ? o.type : null; }

  // Проєкція точки на прямий/круговий об'єкт (для point-on) — повертає {wx,wy,param} | null
  function projectOnObject(objects, onId, wx, wy) {
    const t = typeOf(objects, onId);
    if (!t) return null;
    if (LINE_LIKE.includes(t)) {
      const o = objects.get(onId);
      const ld = lineClamp(objects, o);
      if (!ld) return null;
      const len2 = ld.dx * ld.dx + ld.dy * ld.dy || 1e-12;
      let param = ((wx - ld.x) * ld.dx + (wy - ld.y) * ld.dy) / len2;
      param = Math.max(ld.t0, Math.min(ld.t1, param));
      return { wx: ld.x + param * ld.dx, wy: ld.y + param * ld.dy, param, kind: 'line' };
    }
    if (CIRCLE_LIKE.includes(t)) {
      const o = objects.get(onId);
      const cd = circleDefW(objects, o);
      if (!cd || cd.r <= 1e-12) return null;
      const param = Math.atan2(wy - cd.cy, wx - cd.cx);
      return { wx: cd.cx + cd.r * Math.cos(param), wy: cd.cy + cd.r * Math.sin(param), param, kind: 'circle' };
    }
    return null;
  }
  function positionFromParam(objects, onId, param, kind) {
    const o = objects.get(onId);
    if (kind === 'line') {
      const ld = lineClamp(objects, o);
      if (!ld) return null;
      const t = Math.max(ld.t0, Math.min(ld.t1, param));
      return { wx: ld.x + t * ld.dx, wy: ld.y + t * ld.dy };
    }
    if (kind === 'circle') {
      const cd = circleDefW(objects, o);
      if (!cd) return null;
      return { wx: cd.cx + cd.r * Math.cos(param), wy: cd.cy + cd.r * Math.sin(param) };
    }
    return null;
  }

  /**
   * Створити об'єкт із декларативної команди (§3.1).
   * Повертає { objects: НОВА Map, created: string[] } | { error }.
   * Похідні (updateDeps) виконуються за потреби — контракт як у існуючого updateDeps.
   */
  function construct(objects, cs, cmd) {
    if (!cmd || !cmd.op) return { error: 'no-op' };
    const chk = canConstruct(objects, cmd);
    if (!chk.ok) return { error: chk.reason };
    const m = new Map(objects);
    const created = [];
    const add = (o) => { m.set(o.id, o); created.push(o.id); return o.id; };

    switch (cmd.op) {
      case 'point': {
        const id = cmd.id || nextId(m, 'point');
        add(base_(id, 'point', { wx: cmd.wx, wy: cmd.wy, deps: [] }, cmd));
        break;
      }
      case 'point-on': {
        const proj = projectOnObject(m, cmd.on, cmd.wx, cmd.wy);
        if (!proj) return { error: 'projection-failed' };
        const id = nextId(m, 'point');
        add(base_(id, 'point', {
          wx: proj.wx, wy: proj.wy, onObj: cmd.on, onParam: proj.param, onKind: proj.kind,
          deps: [cmd.on, ...collectPts(m, cmd.on)], locked: false, labelMode: 'name',
        }, cmd));
        break;
      }
      case 'midpoint': {
        const p1 = m.get(cmd.a), p2 = m.get(cmd.b);
        const id = nextId(m, 'point');
        add(base_(id, 'point', {
          wx: (p1.wx + p2.wx) / 2, wy: (p1.wy + p2.wy) / 2,
          midOf: [cmd.a, cmd.b], deps: [cmd.a, cmd.b], locked: true, labelMode: 'name',
        }, cmd));
        break;
      }
      case 'intersect': {
        const pts = intersectObjs(m, cmd.a, cmd.b);
        if (!pts) return { error: 'not-intersectable' };
        const deps = [cmd.a, cmd.b, ...collectPts(m, cmd.a), ...collectPts(m, cmd.b)];
        pts.forEach((p, i) => {
          if (!p) return;
          const id = nextId(m, 'point');
          add(base_(id, 'point', { wx: p[0], wy: p[1], intOf: [cmd.a, cmd.b, i], deps, locked: true, labelMode: 'name' }, cmd));
        });
        if (!created.length) return { error: 'no-intersection' };
        break;
      }
      case 'segment': case 'line': case 'ray': case 'vector': {
        const id = nextId(m, cmd.op);
        add(base_(id, cmd.op, { p1: cmd.a, p2: cmd.b, deps: [cmd.a, cmd.b] }, cmd));
        break;
      }
      case 'perp': case 'para': {
        const id = nextId(m, 'line');
        add(base_(id, 'dline', { sub: cmd.op === 'perp' ? 'perp' : 'para', pid: cmd.through, lid: cmd.to, deps: [cmd.through, cmd.to] }, cmd));
        break;
      }
      case 'perpbis': {
        const id = nextId(m, 'line');
        add(base_(id, 'dline', { sub: 'perpbis', p1: cmd.a, p2: cmd.b, deps: [cmd.a, cmd.b] }, cmd));
        break;
      }
      case 'angbis': {
        const id = nextId(m, 'line');
        add(base_(id, 'dline', { sub: 'angbis', p1: cmd.a, p2: cmd.vertex, p3: cmd.b, deps: [cmd.a, cmd.vertex, cmd.b] }, cmd));
        break;
      }
      case 'tangent': {
        for (const branch of [0, 1]) {
          const id = nextId(m, 'line');
          add(base_(id, 'dline', { sub: 'tangent', pid: cmd.through, lid: cmd.to, branch, deps: [cmd.through, cmd.to] }, cmd));
        }
        break;
      }
      case 'circle': {
        const id = nextId(m, 'circle');
        if (cmd.through) add(base_(id, 'circle', { cid: cmd.center, rid: cmd.through, deps: [cmd.center, cmd.through] }, cmd));
        else add(base_(id, 'circle', { cid: cmd.center, r: cmd.r, deps: [cmd.center] }, cmd));
        break;
      }
      case 'circle3': {
        const id = nextId(m, 'circle');
        add(base_(id, 'circle3', { p1: cmd.a, p2: cmd.b, p3: cmd.c, deps: [cmd.a, cmd.b, cmd.c] }, cmd));
        break;
      }
      case 'semicircle': {
        const id = nextId(m, 'arc');
        add(base_(id, 'semicircle', { p1: cmd.a, p2: cmd.b, deps: [cmd.a, cmd.b] }, cmd));
        break;
      }
      case 'arc': {
        const id = nextId(m, 'arc');
        add(base_(id, 'arc', { p1: cmd.a, p2: cmd.m, p3: cmd.b, deps: [cmd.a, cmd.m, cmd.b] }, cmd));
        break;
      }
      case 'polygon': {
        const id = nextId(m, 'polygon');
        add(base_(id, 'polygon', { vids: [...cmd.pts], deps: [...cmd.pts] }, cmd));
        break;
      }
      case 'polygon-reg': {
        const A = m.get(cmd.a), B = m.get(cmd.b), n = cmd.n | 0;
        const pts = regPolyPts(A, B, n);
        const vids = [cmd.a, cmd.b];
        for (let k = 2; k < n; k++) {
          const pid = nextId(m, 'point');
          add(base_(pid, 'point', { wx: pts[k][0], wy: pts[k][1], regOf: [cmd.a, cmd.b, n, k], deps: [cmd.a, cmd.b], locked: true, labelMode: 'name' }, cmd));
        }
        const polyId = nextId(m, 'polygon');
        add(base_(polyId, 'polygon', { vids, deps: [...vids] }, cmd));
        break;
      }
      case 'polyline': {
        const id = nextId(m, 'polyline');
        add(base_(id, 'polyline', { vids: [...cmd.pts], deps: [...cmd.pts] }, cmd));
        break;
      }
      case 'angle': {
        const id = nextId(m, 'angle');
        add(base_(id, 'angle', { p1: cmd.a, p2: cmd.vertex, p3: cmd.b, deps: [cmd.a, cmd.vertex, cmd.b] }, cmd));
        break;
      }
      case 'distance': {
        const id = nextId(m, 'dist');
        add(base_(id, 'distance', { p1: cmd.a, p2: cmd.b, deps: [cmd.a, cmd.b] }, cmd));
        break;
      }
      case 'function': {
        const id = cmd.id || nextId(m, 'fn');
        add({ id, type: 'function', expr: cmd.expr, fn: cmd.fn, labelMode: 'name', visible: true, locked: false, color: cmd.color || '#e03030', lw: (cmd.lw != null ? cmd.lw : 2), deps: [] });
        break;
      }
      case 'slider': {
        const id = nextId(m, 'slider');
        add(base_(id, 'slider', {
          wx: cmd.wx, wy: cmd.wy,
          min: cmd.min != null ? cmd.min : 0, max: cmd.max != null ? cmd.max : 5,
          step: cmd.step != null ? cmd.step : 0.1, val: cmd.value != null ? cmd.value : 1,
          deps: [],
        }, cmd));
        break;
      }
      default:
        return { error: 'unknown-op' };
    }
    return { objects: m, created };
  }

  /** Посунути вільну/constrained точку чи повзунок у нові світові координати (§3.2). */
  function move(objects, cs, id, wx, wy) {
    const o = objects.get(id);
    if (!o) return { error: 'not-found' };
    if (o.midOf || o.regOf || o.intOf) return { error: 'derived' };
    if (typeof o.wx !== 'number') return { error: 'not-movable' };
    const m = new Map(objects);
    let nx = wx, ny = wy;
    if (o.onObj) {
      const p = positionFromParam(m, o.onObj, (function () {
        const proj = projectOnObject(m, o.onObj, wx, wy);
        return proj ? proj.param : o.onParam;
      })(), o.onKind);
      if (!p) return { error: 'projection-failed' };
      nx = p.wx; ny = p.wy;
      const proj2 = projectOnObject(m, o.onObj, wx, wy);
      m.set(id, { ...o, wx: nx, wy: ny, onParam: proj2 ? proj2.param : o.onParam });
    } else {
      m.set(id, { ...o, wx: nx, wy: ny });
    }
    updateDeps(m, id);
    const moved = [id];
    for (const other of m.values()) {
      if (other.id !== id && (other.deps || []).includes(id)) moved.push(other.id);
    }
    return { objects: m, moved };
  }

  /** Видалити об'єкт (+ залежний каскад за .deps — той самий алгоритм, що й у воронці) (§3.3). */
  function remove(objects, id, opts) {
    opts = opts || {};
    const withDependents = opts.withDependents !== false;
    if (!objects.has(id)) return { error: 'not-found' };
    const toKill = [id];
    for (const o of objects.values()) {
      if ((o.deps || []).includes(id) && !toKill.includes(o.id)) toKill.push(o.id);
    }
    if (toKill.length > 1 && !withDependents) {
      return { error: 'has-dependents', dependents: toKill.slice(1) };
    }
    const m = new Map(objects);
    toKill.forEach(k => m.delete(k));
    return { objects: m, removed: toKill };
  }

  /** Декларативний маніфест інструментів — дошка рендерить панель без хардкоду (§3.4). */
  function toolSpec() {
    const P = ['point'];
    return [
      { op: 'point',       labelKey: 'mash.geo.tools.POINT',     category: 'point',   inputs: [] },
      { op: 'point-on',    labelKey: 'mash.geo.tools.POINT_ON',  category: 'point',   inputs: [{ role: 'on', accepts: [...LINE_LIKE, ...CIRCLE_LIKE, 'semicircle', 'arc'] }] },
      { op: 'midpoint',    labelKey: 'mash.geo.tools.MIDPOINT',  category: 'point',   inputs: [{ role: 'a', accepts: P }, { role: 'b', accepts: P }] },
      { op: 'intersect',   labelKey: 'mash.geo.tools.INTERSECT', category: 'point',   inputs: [{ role: 'a', accepts: [...LINE_LIKE, ...CIRCLE_LIKE] }, { role: 'b', accepts: [...LINE_LIKE, ...CIRCLE_LIKE] }] },
      { op: 'segment',     labelKey: 'mash.geo.tools.SEGMENT',   category: 'line',    inputs: [{ role: 'a', accepts: P }, { role: 'b', accepts: P }] },
      { op: 'line',        labelKey: 'mash.geo.tools.LINE',      category: 'line',    inputs: [{ role: 'a', accepts: P }, { role: 'b', accepts: P }] },
      { op: 'ray',         labelKey: 'mash.geo.tools.RAY',       category: 'line',    inputs: [{ role: 'a', accepts: P }, { role: 'b', accepts: P }] },
      { op: 'vector',      labelKey: 'mash.geo.tools.VECTOR',    category: 'line',    inputs: [{ role: 'a', accepts: P }, { role: 'b', accepts: P }] },
      { op: 'perp',        labelKey: 'mash.geo.tools.PERP',      category: 'line',    inputs: [{ role: 'through', accepts: P }, { role: 'to', accepts: LINE_LIKE }] },
      { op: 'para',        labelKey: 'mash.geo.tools.PARALLEL',  category: 'line',    inputs: [{ role: 'through', accepts: P }, { role: 'to', accepts: LINE_LIKE }] },
      { op: 'perpbis',     labelKey: 'mash.geo.tools.PERPBIS',   category: 'line',    inputs: [{ role: 'a', accepts: P }, { role: 'b', accepts: P }] },
      { op: 'angbis',      labelKey: 'mash.geo.tools.ANGBIS',    category: 'line',    inputs: [{ role: 'a', accepts: P }, { role: 'vertex', accepts: P }, { role: 'b', accepts: P }] },
      { op: 'tangent',     labelKey: 'mash.geo.tools.TANGENT',   category: 'line',    inputs: [{ role: 'through', accepts: P }, { role: 'to', accepts: CIRCLE_LIKE }] },
      { op: 'circle',      labelKey: 'mash.geo.tools.CIRCLE',    category: 'circle',  inputs: [{ role: 'center', accepts: P }, { role: 'through', accepts: P }] },
      { op: 'circle',      labelKey: 'mash.geo.tools.CIRCLER',   category: 'circle',  inputs: [{ role: 'center', accepts: P }] },
      { op: 'circle3',     labelKey: 'mash.geo.tools.CIRCLE3',   category: 'circle',  inputs: [{ role: 'a', accepts: P }, { role: 'b', accepts: P }, { role: 'c', accepts: P }] },
      { op: 'semicircle',  labelKey: 'mash.geo.tools.SEMICIRCLE',category: 'circle',  inputs: [{ role: 'a', accepts: P }, { role: 'b', accepts: P }] },
      { op: 'arc',         labelKey: 'mash.geo.tools.ARC',       category: 'circle',  inputs: [{ role: 'a', accepts: P }, { role: 'm', accepts: P }, { role: 'b', accepts: P }] },
      { op: 'polygon',     labelKey: 'mash.geo.tools.POLYGON',   category: 'polygon', inputs: [{ role: 'pts', accepts: P, multi: true }] },
      { op: 'polygon-reg', labelKey: 'mash.geo.tools.REGPOLY',   category: 'polygon', inputs: [{ role: 'a', accepts: P }, { role: 'b', accepts: P }] },
      { op: 'polyline',    labelKey: 'mash.geo.tools.POLYLINE',  category: 'line',    inputs: [{ role: 'pts', accepts: P, multi: true }] },
      { op: 'angle',       labelKey: 'mash.geo.tools.ANGLE',     category: 'measure', inputs: [{ role: 'a', accepts: P }, { role: 'vertex', accepts: P }, { role: 'b', accepts: P }] },
      { op: 'distance',    labelKey: 'mash.geo.tools.DISTANCE',  category: 'measure', inputs: [{ role: 'a', accepts: P }, { role: 'b', accepts: P }] },
      { op: 'function',    labelKey: 'mash.geo.tools.FUNCTION',  category: 'line',    inputs: [] },
      { op: 'slider',      labelKey: 'mash.geo.tools.SLIDER',    category: 'point',   inputs: [] },
    ];
  }

  /** Валідація команди на поточній сцені — для enable/disable кнопок (§3.6). */
  function canConstruct(objects, cmd) {
    if (!cmd || !cmd.op) return { ok: false, reason: 'no-op' };
    const pt = (id) => isPoint(objects, id);
    const exists = (id) => objects.has(id);
    const distinct = (...ids) => new Set(ids).size === ids.length;

    switch (cmd.op) {
      case 'point':
        return (isFinite(cmd.wx) && isFinite(cmd.wy)) ? { ok: true } : { ok: false, reason: 'bad-coords' };
      case 'point-on': {
        if (!exists(cmd.on)) return { ok: false, reason: 'not-found' };
        const t = typeOf(objects, cmd.on);
        if (!LINE_LIKE.includes(t) && !CIRCLE_LIKE.includes(t) && t !== 'semicircle' && t !== 'arc') return { ok: false, reason: 'unsupported-on-type' };
        return { ok: true };
      }
      case 'midpoint': case 'segment': case 'line': case 'ray': case 'vector': case 'perpbis': case 'distance':
        if (!exists(cmd.a) || !exists(cmd.b)) return { ok: false, reason: 'not-found' };
        if (!pt(cmd.a) || !pt(cmd.b)) return { ok: false, reason: 'not-a-point' };
        if (!distinct(cmd.a, cmd.b)) return { ok: false, reason: 'same-point' };
        return { ok: true };
      case 'intersect': {
        if (!exists(cmd.a) || !exists(cmd.b)) return { ok: false, reason: 'not-found' };
        if (!distinct(cmd.a, cmd.b)) return { ok: false, reason: 'same-object' };
        const ta = typeOf(objects, cmd.a), tb = typeOf(objects, cmd.b);
        const isConstructible = (t) => LINE_LIKE.includes(t) || CIRCLE_LIKE.includes(t);
        if (!isConstructible(ta) || !isConstructible(tb)) return { ok: false, reason: 'not-intersectable-type' };
        return { ok: true };
      }
      case 'perp': case 'para': {
        if (!exists(cmd.through) || !exists(cmd.to)) return { ok: false, reason: 'not-found' };
        if (!pt(cmd.through)) return { ok: false, reason: 'not-a-point' };
        if (!LINE_LIKE.includes(typeOf(objects, cmd.to))) return { ok: false, reason: 'not-a-line' };
        return { ok: true };
      }
      case 'angbis': case 'angle':
        if (!exists(cmd.a) || !exists(cmd.vertex) || !exists(cmd.b)) return { ok: false, reason: 'not-found' };
        if (!pt(cmd.a) || !pt(cmd.vertex) || !pt(cmd.b)) return { ok: false, reason: 'not-a-point' };
        if (!distinct(cmd.a, cmd.vertex, cmd.b)) return { ok: false, reason: 'same-point' };
        return { ok: true };
      case 'tangent': {
        if (!exists(cmd.through) || !exists(cmd.to)) return { ok: false, reason: 'not-found' };
        if (!pt(cmd.through)) return { ok: false, reason: 'not-a-point' };
        if (!CIRCLE_LIKE.includes(typeOf(objects, cmd.to))) return { ok: false, reason: 'not-a-circle' };
        const P = objects.get(cmd.through), cd = circleDefW(objects, objects.get(cmd.to));
        if (!cd) return { ok: false, reason: 'degenerate-circle' };
        if (Math.hypot(P.wx - cd.cx, P.wy - cd.cy) <= cd.r + 1e-9) return { ok: false, reason: 'point-inside-circle' };
        return { ok: true };
      }
      case 'circle': {
        if (!exists(cmd.center) || !pt(cmd.center)) return { ok: false, reason: 'not-a-point' };
        if (cmd.through) { if (!exists(cmd.through) || !pt(cmd.through)) return { ok: false, reason: 'not-a-point' }; }
        else if (!(cmd.r > 0)) return { ok: false, reason: 'bad-radius' };
        return { ok: true };
      }
      case 'circle3': {
        if (!exists(cmd.a) || !exists(cmd.b) || !exists(cmd.c)) return { ok: false, reason: 'not-found' };
        if (!pt(cmd.a) || !pt(cmd.b) || !pt(cmd.c)) return { ok: false, reason: 'not-a-point' };
        if (!distinct(cmd.a, cmd.b, cmd.c)) return { ok: false, reason: 'same-point' };
        if (!circum(objects.get(cmd.a), objects.get(cmd.b), objects.get(cmd.c))) return { ok: false, reason: 'collinear' };
        return { ok: true };
      }
      case 'semicircle':
        if (!exists(cmd.a) || !exists(cmd.b)) return { ok: false, reason: 'not-found' };
        if (!pt(cmd.a) || !pt(cmd.b)) return { ok: false, reason: 'not-a-point' };
        if (!distinct(cmd.a, cmd.b)) return { ok: false, reason: 'same-point' };
        return { ok: true };
      case 'arc':
        if (!exists(cmd.a) || !exists(cmd.m) || !exists(cmd.b)) return { ok: false, reason: 'not-found' };
        if (!pt(cmd.a) || !pt(cmd.m) || !pt(cmd.b)) return { ok: false, reason: 'not-a-point' };
        if (!distinct(cmd.a, cmd.m, cmd.b)) return { ok: false, reason: 'same-point' };
        if (!circum(objects.get(cmd.a), objects.get(cmd.m), objects.get(cmd.b))) return { ok: false, reason: 'collinear' };
        return { ok: true };
      case 'polygon':
        if (!Array.isArray(cmd.pts) || cmd.pts.length < 3) return { ok: false, reason: 'need-3-points' };
        if (!cmd.pts.every(exists) || !cmd.pts.every(pt)) return { ok: false, reason: 'not-a-point' };
        if (!distinct(...cmd.pts)) return { ok: false, reason: 'duplicate-points' };
        return { ok: true };
      case 'polygon-reg':
        if (!exists(cmd.a) || !exists(cmd.b)) return { ok: false, reason: 'not-found' };
        if (!pt(cmd.a) || !pt(cmd.b)) return { ok: false, reason: 'not-a-point' };
        if (!distinct(cmd.a, cmd.b)) return { ok: false, reason: 'same-point' };
        if (!(Number.isInteger(cmd.n) && cmd.n >= 3)) return { ok: false, reason: 'bad-n' };
        return { ok: true };
      case 'polyline':
        if (!Array.isArray(cmd.pts) || cmd.pts.length < 2) return { ok: false, reason: 'need-2-points' };
        if (!cmd.pts.every(exists) || !cmd.pts.every(pt)) return { ok: false, reason: 'not-a-point' };
        return { ok: true };
      case 'function':
        return (typeof cmd.expr === 'string' && cmd.expr.trim()) ? { ok: true } : { ok: false, reason: 'bad-expr' };
      case 'slider':
        return (isFinite(cmd.wx) && isFinite(cmd.wy)) ? { ok: true } : { ok: false, reason: 'bad-coords' };
      default:
        return { ok: false, reason: 'unknown-op' };
    }
  }

  const RESTYLE_KEYS = ['color', 'opacity', 'lineWidth', 'lw', 'labelMode', 'visible', 'locked', 'caption'];

  /** Патч стилю/підпису/стану = ChangeStyleCmd/ChangeLabelModeCmd headless (§3.4). */
  function restyle(objects, id, patch) {
    if (!objects.has(id)) return { error: 'not-found' };
    if (!patch || typeof patch !== 'object') return { error: 'bad-patch' };
    const keys = Object.keys(patch).filter(k => RESTYLE_KEYS.includes(k));
    if (!keys.length) return { error: 'no-valid-keys' };
    const m = new Map(objects);
    const cur = m.get(id);
    const next = { ...cur };
    for (const k of keys) next[k] = patch[k];
    // lineWidth — аліас до внутрішнього lw, щоб не дублювати схему draw()
    if ('lineWidth' in patch) next.lw = patch.lineWidth;
    m.set(id, next);
    return { objects: m };
  }

  /** Текстове значення об'єкта для алгебра-рядка (§3.7, опційно). */
  function getValue(objects, id) {
    const o = objects.get(id);
    if (!o) return '';
    switch (o.type) {
      case 'point':
        return `${o.id} = (${o.wx.toFixed(2)}, ${o.wy.toFixed(2)})`;
      case 'slider':
        return `${o.id} = ${o.val}`;
      case 'distance': {
        const p1 = objects.get(o.p1), p2 = objects.get(o.p2);
        if (!p1 || !p2) return `${o.id} = ?`;
        return `${o.id} = ${Math.hypot(p1.wx - p2.wx, p1.wy - p2.wy).toFixed(3)}`;
      }
      case 'angle': {
        const A = objects.get(o.p1), V = objects.get(o.p2), B = objects.get(o.p3);
        if (!A || !V || !B) return `${o.id} = ?`;
        const a1 = Math.atan2(A.wy - V.wy, A.wx - V.wx), a2 = Math.atan2(B.wy - V.wy, B.wx - V.wx);
        let d = Math.abs(a2 - a1) * 180 / Math.PI;
        if (d > 180) d = 360 - d;
        return `${o.id} = ${d.toFixed(1)}\u00b0`;
      }
      case 'circle': {
        const cd = circleDefW(objects, o);
        return cd ? `${o.id}: r = ${cd.r.toFixed(3)}` : `${o.id} = ?`;
      }
      case 'function':
        return `${o.id}: ${o.expr}`;
      default:
        return o.id;
    }
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
    construct, move, remove, restyle, toolSpec, canConstruct, getValue,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GeoEngine;
  else global.GeoEngine = GeoEngine;

})(typeof window !== 'undefined' ? window : globalThis);

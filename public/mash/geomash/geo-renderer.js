/* ═══════════════════════════════════════════════════════════
   GeoRenderer — stateless canvas-рендерер GeoMASH (гайд §4)
   Контракт:
     createGeoRenderer(canvas, { engine, theme, fonts }) →
       { draw(scene, view, ui), hitTest(scene, view, sx, sy, tol),
         objectAABB(scene, view, id), resize(w, h, dpr),
         setTheme(partial), destroy() }
   Принципи (§4.1): без RAF, без addEventListener, без localStorage,
   без document.* — стан сцени веде хост; selection/hover/preview —
   аргументи draw; кольори/шрифти — theme. Два draw() з тими самими
   аргументами → ідентичний кадр.
   ui (усі поля опційні): { selection:Set, hover:id, preview:GeoObject,
     pendingIds:[id], rubber:{sx,sy,ex,ey}, showGrid, gridMode:'lines'|'polar',
     showAxes, showLabels }
   Статичні хелпери: GeoRenderer.extLine/extRay/fmt/objVal/DEFAULT_THEME.
   ═══════════════════════════════════════════════════════════ */
(function (global) {

  const DEFAULT_THEME = {
    bg: '#ffffff',
    gridSub: '#f0f2f0', grid: '#e8eee8',
    axis: '#9aada0', axisName: '#778a80',
    object: '#1a5c38',
    objectHover: '#3b82f6', objectSelected: '#2060c8',
    pendingRing: '#e07040',
    sliderTrack: '#c8d4cc', measureText: '#2a3a30',
    rubberFill: 'rgba(32,96,200,.08)', rubberStroke: '#2060c8',
  };
  const DEFAULT_FONTS = {
    label: 'italic 14px Georgia, serif',
    measure: '12px IBM Plex Mono, monospace',
    axis: '10px IBM Plex Mono, monospace',
    axisName: 'italic 13px Georgia, serif',
  };

  function fmt(n) {
    if (Number.isInteger(n)) return String(n);
    if (Math.abs(n) >= 10) return n.toFixed(0);
    if (Math.abs(n) >= 1)  return n.toFixed(1);
    return n.toFixed(2);
  }

  function makeCS(view) {
    return {
      ox: view.ox, oy: view.oy, sc: view.sc,
      S(wx, wy) { return [this.ox + wx * this.sc, this.oy - wy * this.sc]; },
      W(sx, sy) { return [(sx - this.ox) / this.sc, (this.oy - sy) / this.sc]; },
    };
  }

  function extLine(cs, x1, y1, x2, y2, W, H) {
    const [xa] = cs.W(0, 0), [xb] = cs.W(W, 0);
    const [, yb] = cs.W(0, H), [, ya] = cs.W(0, 0);
    const dx = x2 - x1, dy = y2 - y1;
    let t0 = -1e9, t1 = 1e9;
    if (Math.abs(dx) > 1e-9) {
      const a = (xa - x1) / dx, b = (xb - x1) / dx;
      t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
    } else if (x1 < xa || x1 > xb) return null;
    if (Math.abs(dy) > 1e-9) {
      const a = (yb - y1) / dy, b = (ya - y1) / dy;
      t0 = Math.max(t0, Math.min(a, b)); t1 = Math.min(t1, Math.max(a, b));
    } else if (y1 < yb || y1 > ya) return null;
    if (t0 > t1) return null;
    return [...cs.S(x1 + t0 * dx, y1 + t0 * dy), ...cs.S(x1 + t1 * dx, y1 + t1 * dy)];
  }

  function extRay(cs, x1, y1, x2, y2, W, H) {
    const [xa] = cs.W(0, 0), [xb] = cs.W(W, 0);
    const [, yb] = cs.W(0, H), [, ya] = cs.W(0, 0);
    const dx = x2 - x1, dy = y2 - y1;
    let t1 = 1e9;
    if (Math.abs(dx) > 1e-9) t1 = Math.min(t1, dx > 0 ? (xb - x1) / dx : (xa - x1) / dx);
    if (Math.abs(dy) > 1e-9) t1 = Math.min(t1, dy > 0 ? (ya - y1) / dy : (yb - y1) / dy);
    if (!isFinite(t1) || t1 < 0) return null;
    return [...cs.S(x1, y1), ...cs.S(x1 + t1 * dx, y1 + t1 * dy)];
  }

  function objVal(engine, s, o) {
    if (o.type === 'point')   return `(${o.wx.toFixed(2)}, ${o.wy.toFixed(2)})`;
    if (o.type === 'segment' || o.type === 'distance') {
      const p1 = s.get(o.p1), p2 = s.get(o.p2);
      return p1 && p2 ? Math.hypot(p1.wx - p2.wx, p1.wy - p2.wy).toFixed(3) : '?';
    }
    if (o.type === 'circle') {
      const c = s.get(o.cid), r = s.get(o.rid);
      if (c && !r && o.r) return 'r = ' + (+o.r).toFixed(3);
      return c && r ? 'r = ' + Math.hypot(c.wx - r.wx, c.wy - r.wy).toFixed(3) : '?';
    }
    if (o.type === 'polygon') {
      const vs = (o.vids || []).map(id => s.get(id)).filter(Boolean);
      if (vs.length < 3) return '?';
      let area = 0;
      for (let i = 0; i < vs.length; i++) {
        const j = (i + 1) % vs.length;
        area += vs[i].wx * vs[j].wy - vs[j].wx * vs[i].wy;
      }
      return 'S = ' + (Math.abs(area) / 2).toFixed(3);
    }
    if (['circle3', 'arc', 'semicircle'].includes(o.type)) {
      const a = s.get(o.p1), b = s.get(o.p2);
      if (!a || !b) return '?';
      if (o.type === 'semicircle') return 'r = ' + (Math.hypot(a.wx - b.wx, a.wy - b.wy) / 2).toFixed(3);
      const c = s.get(o.p3); if (!c) return '?';
      const cc = engine.circum(a, b, c);
      return cc ? 'r = ' + Math.hypot(a.wx - cc[0], a.wy - cc[1]).toFixed(3) : '?';
    }
    if (o.type === 'angle') {
      const A = s.get(o.p1), B = s.get(o.p2), C = s.get(o.p3);
      if (!A || !B || !C) return '?';
      let sw = Math.atan2(C.wy - B.wy, C.wx - B.wx) - Math.atan2(A.wy - B.wy, A.wx - B.wx);
      while (sw < 0) sw += Math.PI * 2;
      if (sw > Math.PI) sw = Math.PI * 2 - sw;
      return (sw * 180 / Math.PI).toFixed(1) + '°';
    }
    if (o.type === 'slider') return (+o.val).toFixed(2);
    return '';
  }

  function createGeoRenderer(canvas, opts = {}) {
    const engine = opts.engine || global.GeoEngine;
    if (!engine) throw new Error('GeoRenderer: engine is required (pass opts.engine or load geo-engine.js)');
    let theme = { ...DEFAULT_THEME, ...(opts.theme || {}) };
    let fonts = { ...DEFAULT_FONTS, ...(opts.fonts || {}) };
    let destroyed = false;

    const ctx = canvas ? canvas.getContext('2d') : null;
    // Внутрішній hit-canvas (color picking) — офскрін, без document.*
    const hitCv = canvas ? canvas.ownerDocument.createElement('canvas') : null;
    const hx = hitCv ? hitCv.getContext('2d', { willReadFrequently: true }) : null;
    const hitMap = new Map();   // "r,g,b" → id
    let hitScene = null, hitViewKey = '';

    const viewKey = v => `${v.ox}|${v.oy}|${v.sc}|${v.w}|${v.h}`;

    // ── grid + axes ──────────────────────────────────────
    function drawGrid(c, cs, W, H, mode) {
      const sc = cs.sc;
      const step    = sc >= 150 ? 0.5 : sc >= 60 ? 1 : sc >= 30 ? 2 : sc >= 15 ? 5 : 10;
      const subStep = step / 5;
      const [xMin] = cs.W(0, 0), [xMax] = cs.W(W, 0);
      const [, yMin] = cs.W(0, H), [, yMax] = cs.W(0, 0);

      if (mode === 'polar') {
        const [ox0, oy0] = cs.S(0, 0);
        const maxR = Math.max(
          Math.hypot(ox0, oy0), Math.hypot(W - ox0, oy0),
          Math.hypot(ox0, H - oy0), Math.hypot(W - ox0, H - oy0));
        c.save();
        c.strokeStyle = theme.grid; c.lineWidth = 0.8;
        c.beginPath();
        const stepPx = step * sc;
        for (let r = stepPx; r <= maxR; r += stepPx) { c.moveTo(ox0 + r, oy0); c.arc(ox0, oy0, r, 0, Math.PI * 2); }
        for (let a = 0; a < 360; a += 15) {
          const rad = a * Math.PI / 180;
          c.moveTo(ox0, oy0); c.lineTo(ox0 + maxR * Math.cos(rad), oy0 + maxR * Math.sin(rad));
        }
        c.stroke(); c.restore();
        return;
      }

      c.save();
      if (sc > 40) {
        c.strokeStyle = theme.gridSub; c.lineWidth = 0.5;
        c.beginPath();
        for (let x = Math.floor(xMin / subStep) * subStep; x <= xMax + subStep; x += subStep) {
          const [sx] = cs.S(x, 0); c.moveTo(sx, 0); c.lineTo(sx, H);
        }
        for (let y = Math.floor(yMin / subStep) * subStep; y <= yMax + subStep; y += subStep) {
          const [, sy] = cs.S(0, y); c.moveTo(0, sy); c.lineTo(W, sy);
        }
        c.stroke();
      }
      c.strokeStyle = theme.grid; c.lineWidth = 0.8;
      c.beginPath();
      for (let x = Math.floor(xMin / step) * step; x <= xMax + step; x += step) {
        const [sx] = cs.S(x, 0); c.moveTo(sx, 0); c.lineTo(sx, H);
      }
      for (let y = Math.floor(yMin / step) * step; y <= yMax + step; y += step) {
        const [, sy] = cs.S(0, y); c.moveTo(0, sy); c.lineTo(W, sy);
      }
      c.stroke(); c.restore();
    }

    function drawAxes(c, cs, W, H) {
      const sc = cs.sc;
      const step = sc >= 150 ? 0.5 : sc >= 60 ? 1 : sc >= 30 ? 2 : sc >= 15 ? 5 : 10;
      const [ox, oy] = cs.S(0, 0);
      const [xMin] = cs.W(0, 0), [xMax] = cs.W(W, 0);
      const [, yMin] = cs.W(0, H), [, yMax] = cs.W(0, 0);
      c.save();
      c.strokeStyle = theme.axis; c.lineWidth = 1.3;
      c.beginPath(); c.moveTo(0, oy); c.lineTo(W, oy); c.moveTo(ox, 0); c.lineTo(ox, H); c.stroke();
      c.fillStyle = theme.axis;
      const A = 6;
      c.beginPath(); c.moveTo(W, oy); c.lineTo(W - A, oy - 3); c.lineTo(W - A, oy + 3); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(ox, 0); c.lineTo(ox - 3, A); c.lineTo(ox + 3, A); c.closePath(); c.fill();
      c.font = fonts.axisName; c.fillStyle = theme.axisName;
      c.fillText('x', W - 14, oy - 7); c.fillText('y', ox + 7, 12);
      c.font = fonts.axis; c.fillStyle = theme.axis; c.textAlign = 'center';
      for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
        if (Math.abs(x) < 1e-9) continue;
        const [sx] = cs.S(x, 0);
        c.beginPath(); c.moveTo(sx, oy - 3); c.lineTo(sx, oy + 3);
        c.strokeStyle = theme.axis; c.lineWidth = 1; c.stroke();
        if (sc >= 20) c.fillText(fmt(x), sx, oy + 13);
      }
      c.textAlign = 'right';
      for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) {
        if (Math.abs(y) < 1e-9) continue;
        const [, sy] = cs.S(0, y);
        c.beginPath(); c.moveTo(ox - 3, sy); c.lineTo(ox + 3, sy);
        c.strokeStyle = theme.axis; c.lineWidth = 1; c.stroke();
        if (sc >= 20) c.fillText(fmt(y), ox - 7, sy + 4);
      }
      if (sc >= 30) { c.textAlign = 'right'; c.fillText('0', ox - 5, oy + 13); }
      c.restore();
    }

    function drawArrow(c, x1, y1, x2, y2, color) {
      const ang = Math.atan2(y2 - y1, x2 - x1), L = 12;
      c.save(); c.fillStyle = color;
      c.beginPath();
      c.moveTo(x2, y2);
      c.lineTo(x2 - L * Math.cos(ang - 0.38), y2 - L * Math.sin(ang - 0.38));
      c.lineTo(x2 - L * Math.cos(ang + 0.38), y2 - L * Math.sin(ang + 0.38));
      c.closePath(); c.fill(); c.restore();
    }

    // ── один об'єкт: mode 'main' | 'hit' ─────────────────
    function paintObj(c, cs, objs, o, W, H, isHit, hcColor, ui) {
      const baseColor = o.color || theme.object;
      const color = isHit ? hcColor : baseColor;
      const isHov = !isHit && ui.hover === o.id;
      const isSel = !isHit && ui.selection && ui.selection.has(o.id);
      const strokeFor = () => !isHit && (isHov || isSel) ? (isHov ? theme.objectHover : theme.objectSelected) : color;
      c.save();

      if (o.type === 'point') {
        const [sx, sy] = cs.S(o.wx, o.wy);
        const r = isHit ? 12 : (isSel || isHov ? 6.5 : 5);
        if (!isHit && isHov) {
          c.fillStyle = theme.objectHover;
          c.beginPath(); c.arc(sx, sy, r + 2, 0, Math.PI * 2); c.fill();
        }
        c.fillStyle = color;
        c.beginPath(); c.arc(sx, sy, r, 0, Math.PI * 2); c.fill();
        if (!isHit && isSel) {
          c.strokeStyle = theme.objectSelected; c.lineWidth = 2;
          c.beginPath(); c.arc(sx, sy, r + 4, 0, Math.PI * 2); c.stroke();
        }
      }
      else if (o.type === 'polyline') {
        const vpts = (o.vids || []).map(id => objs.get(id)).filter(Boolean);
        if (vpts.length < 2) { c.restore(); return; }
        c.strokeStyle = strokeFor();
        c.lineWidth = isHit ? 14 : (isHov ? (o.lw || 2) + 1 : (o.lw || 2));
        c.beginPath();
        vpts.forEach((p, i) => { const [px, py] = cs.S(p.wx, p.wy); i ? c.lineTo(px, py) : c.moveTo(px, py); });
        c.stroke();
      }
      else if (o.type === 'segment' || o.type === 'vector') {
        const p1 = objs.get(o.p1), p2 = objs.get(o.p2);
        if (!p1 || !p2) { c.restore(); return; }
        const [x1, y1] = cs.S(p1.wx, p1.wy), [x2, y2] = cs.S(p2.wx, p2.wy);
        c.strokeStyle = strokeFor();
        c.lineWidth = isHit ? 14 : (isHov ? (o.lw || 2) + 1 : (o.lw || 2));
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
        if (!isHit && o.type === 'vector') drawArrow(c, x1, y1, x2, y2, isHov ? theme.objectHover : color);
      }
      else if (o.type === 'line' || o.type === 'ray') {
        const p1 = objs.get(o.p1), p2 = objs.get(o.p2);
        if (!p1 || !p2) { c.restore(); return; }
        const pts = (o.type === 'line' ? extLine : extRay)(cs, p1.wx, p1.wy, p2.wx, p2.wy, W, H);
        if (!pts) { c.restore(); return; }
        c.strokeStyle = strokeFor();
        c.lineWidth = isHit ? 14 : (o.lw || 2);
        c.beginPath(); c.moveTo(pts[0], pts[1]); c.lineTo(pts[2], pts[3]); c.stroke();
      }
      else if (o.type === 'circle') {
        const cc = objs.get(o.cid), rp = objs.get(o.rid);
        if (!cc) { c.restore(); return; }
        const [cx, cy] = cs.S(cc.wx, cc.wy);
        const r = (rp ? Math.hypot(cc.wx - rp.wx, cc.wy - rp.wy) : (o.r || 1)) * cs.sc;
        c.strokeStyle = strokeFor();
        c.lineWidth = isHit ? 14 : (o.lw || 2);
        c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
      }
      else if (o.type === 'polygon') {
        const vs = (o.vids || []).map(id => objs.get(id)).filter(Boolean);
        if (vs.length < 2) { c.restore(); return; }
        c.beginPath();
        const [fx, fy] = cs.S(vs[0].wx, vs[0].wy); c.moveTo(fx, fy);
        for (let i = 1; i < vs.length; i++) { const [vx, vy] = cs.S(vs[i].wx, vs[i].wy); c.lineTo(vx, vy); }
        c.closePath();
        if (isHit) { c.fillStyle = color; c.fill(); }
        else {
          c.fillStyle = color + '22'; c.fill();
          c.strokeStyle = isHov ? theme.objectHover : color;
          c.lineWidth = o.lw || 2; c.stroke();
        }
      }
      else if (o.type === 'dline') {
        const def = engine.dlineDef(objs, o);
        if (!def) { c.restore(); return; }
        const dpts = extLine(cs, def.x, def.y, def.x + def.dx, def.y + def.dy, W, H);
        if (!dpts) { c.restore(); return; }
        c.strokeStyle = strokeFor();
        c.lineWidth = isHit ? 14 : (o.lw || 2);
        c.beginPath(); c.moveTo(dpts[0], dpts[1]); c.lineTo(dpts[2], dpts[3]); c.stroke();
      }
      else if (o.type === 'circle3') {
        const a = objs.get(o.p1), b = objs.get(o.p2), c3 = objs.get(o.p3);
        if (!a || !b || !c3) { c.restore(); return; }
        const cc = engine.circum(a, b, c3);
        if (!cc) { c.restore(); return; }
        const [cx, cy] = cs.S(cc[0], cc[1]);
        const r = Math.hypot(a.wx - cc[0], a.wy - cc[1]) * cs.sc;
        c.strokeStyle = strokeFor();
        c.lineWidth = isHit ? 14 : (o.lw || 2);
        c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
      }
      else if (o.type === 'arc' || o.type === 'semicircle') {
        const prm = engine.arcParams(objs, cs, o);
        if (!prm) { c.restore(); return; }
        c.strokeStyle = strokeFor();
        c.lineWidth = isHit ? 14 : (o.lw || 2);
        c.beginPath(); c.arc(prm.cx, prm.cy, prm.r, prm.sa, prm.ea, prm.ccw); c.stroke();
      }
      else if (o.type === 'angle') {
        const A = objs.get(o.p1), B = objs.get(o.p2), C = objs.get(o.p3);
        if (!A || !B || !C) { c.restore(); return; }
        const [bx, by] = cs.S(B.wx, B.wy);
        let wa1 = Math.atan2(A.wy - B.wy, A.wx - B.wx);
        let wa2 = Math.atan2(C.wy - B.wy, C.wx - B.wx);
        let sweep = wa2 - wa1; while (sweep < 0) sweep += Math.PI * 2;
        if (sweep > Math.PI) { const tmp = wa1; wa1 = wa2; wa2 = tmp; sweep = Math.PI * 2 - sweep; }
        const deg = sweep * 180 / Math.PI;
        const R = isHit ? 34 : 26;
        c.beginPath(); c.moveTo(bx, by);
        if (Math.abs(deg - 90) < 0.5) {
          const u = [Math.cos(wa1), Math.sin(wa1)], v = [Math.cos(wa2), Math.sin(wa2)], q = R * 0.7 / cs.sc;
          const s1 = cs.S(B.wx + u[0] * q, B.wy + u[1] * q);
          const s2 = cs.S(B.wx + (u[0] + v[0]) * q, B.wy + (u[1] + v[1]) * q);
          const s3 = cs.S(B.wx + v[0] * q, B.wy + v[1] * q);
          c.lineTo(s1[0], s1[1]); c.lineTo(s2[0], s2[1]); c.lineTo(s3[0], s3[1]);
        } else {
          c.arc(bx, by, R, -wa1, -wa2, true);
        }
        c.closePath();
        if (isHit) { c.fillStyle = color; c.fill(); }
        else {
          c.fillStyle = (isHov ? theme.objectHover : color) + '33'; c.fill();
          c.strokeStyle = isHov ? theme.objectHover : color; c.lineWidth = o.lw || 2; c.stroke();
          const mid = wa1 + sweep / 2;
          c.font = fonts.measure; c.fillStyle = color; c.textAlign = 'center';
          c.fillText(deg.toFixed(1) + '°', bx + Math.cos(-mid) * (R + 16), by + Math.sin(-mid) * (R + 16) + 4);
        }
      }
      else if (o.type === 'distance') {
        const p1 = objs.get(o.p1), p2 = objs.get(o.p2);
        if (!p1 || !p2) { c.restore(); return; }
        const [x1, y1] = cs.S(p1.wx, p1.wy), [x2, y2] = cs.S(p2.wx, p2.wy);
        c.strokeStyle = strokeFor();
        c.lineWidth = isHit ? 14 : 1.5;
        if (!isHit) c.setLineDash([5, 4]);
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
        c.setLineDash([]);
        if (!isHit) {
          const d = Math.hypot(p1.wx - p2.wx, p1.wy - p2.wy);
          c.font = fonts.measure; c.fillStyle = color; c.textAlign = 'center';
          c.fillText(d.toFixed(2), (x1 + x2) / 2, (y1 + y2) / 2 - 8);
        }
      }
      else if (o.type === 'slider') {
        const [ax, ay] = cs.S(o.wx, o.wy);
        const L = 140;
        const t = Math.max(0, Math.min(1, (o.val - o.min) / ((o.max - o.min) || 1)));
        c.lineCap = 'round';
        c.strokeStyle = isHit ? color : theme.sliderTrack;
        c.lineWidth = isHit ? 16 : 4;
        c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + L, ay); c.stroke();
        if (!isHit) {
          c.strokeStyle = baseColor; c.lineWidth = 4;
          c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + L * t, ay); c.stroke();
          c.fillStyle = isHov ? theme.objectHover : baseColor;
          c.beginPath(); c.arc(ax + L * t, ay, 8, 0, Math.PI * 2); c.fill();
          c.font = fonts.measure; c.fillStyle = theme.measureText; c.textAlign = 'left';
          c.fillText(o.id + ' = ' + (+o.val).toFixed(o.step < 1 ? 1 : 0), ax, ay - 14);
        }
      }
      else if (o.type === 'function' && o.fn) {
        const [xMin] = cs.W(0, 0), [xMax] = cs.W(W, 0);
        c.strokeStyle = strokeFor();
        c.lineWidth = o.lw || 2;
        c.beginPath(); let pen = false;
        for (let i = 0; i <= 600; i++) {
          const wx = xMin + (xMax - xMin) * i / 600;
          try {
            const wy = o.fn(wx);
            if (!isFinite(wy) || Math.abs(wy) > 1e7) { pen = false; continue; }
            const [sx, sy] = cs.S(wx, wy);
            pen ? c.lineTo(sx, sy) : c.moveTo(sx, sy);
            pen = true;
          } catch (e) { pen = false; }
        }
        c.stroke();
      }

      c.restore();
    }

    function drawObjects(c, cs, objs, W, H, ui) {
      const arr = [...objs.values()];
      for (const o of arr) if (o.visible && o.type !== 'point') paintObj(c, cs, objs, o, W, H, false, null, ui);
      for (const o of arr) if (o.visible && o.type === 'point') paintObj(c, cs, objs, o, W, H, false, null, ui);
    }

    function drawLabels(c, cs, objs, W, H) {
      for (const o of objs.values()) {
        if (!o.visible || o.labelMode === 'none' || !o.labelMode) continue;
        let sx, sy, text = '';
        const val = objVal(engine, objs, o);
        if (o.labelMode === 'name')            text = o.id;
        else if (o.labelMode === 'nameValue')  text = o.id + ' = ' + val;
        else if (o.labelMode === 'value')      text = val;

        if (o.type === 'point') {
          [sx, sy] = cs.S(o.wx, o.wy); sx += 8; sy -= 7;
        } else if (['segment', 'vector', 'line', 'ray'].includes(o.type)) {
          const p1 = objs.get(o.p1), p2 = objs.get(o.p2);
          if (!p1 || !p2) continue;
          const [x1, y1] = cs.S(p1.wx, p1.wy), [x2, y2] = cs.S(p2.wx, p2.wy);
          sx = (x1 + x2) / 2 + 6; sy = (y1 + y2) / 2 - 6;
        } else if (o.type === 'circle') {
          const cc = objs.get(o.cid); if (!cc) continue;
          [sx, sy] = cs.S(cc.wx, cc.wy); sx += 6; sy -= 6;
        } else if (['circle3', 'arc', 'semicircle'].includes(o.type)) {
          const a = objs.get(o.p1); if (!a) continue;
          [sx, sy] = cs.S(a.wx, a.wy); sx += 10; sy -= 10;
        } else if (o.type === 'function') {
          try {
            const mx = (cs.W(0, 0)[0] + cs.W(W, 0)[0]) / 2;
            const wy = o.fn(mx); if (!isFinite(wy)) continue;
            [sx, sy] = cs.S(mx, wy); sx += 8; sy -= 4;
          } catch (e) { continue; }
        } else continue;

        c.save();
        c.font = fonts.label;
        c.fillStyle = o.color || theme.object;
        c.fillText(text, sx, sy);
        c.restore();
      }
    }

    function drawSelectionDash(c, cs, objs, W, H, selection) {
      if (!selection) return;
      for (const id of selection) {
        const o = objs.get(id);
        if (!o || !o.visible) continue;
        c.save();
        c.strokeStyle = theme.objectSelected;
        c.lineWidth = 2;
        c.setLineDash([5, 3]);
        if (o.type === 'point') {
          const [sx, sy] = cs.S(o.wx, o.wy);
          c.beginPath(); c.arc(sx, sy, 12, 0, Math.PI * 2); c.stroke();
        } else if (['segment', 'vector', 'line', 'ray'].includes(o.type)) {
          const p1 = objs.get(o.p1), p2 = objs.get(o.p2);
          if (!p1 || !p2) { c.restore(); continue; }
          let pts;
          if (o.type === 'segment' || o.type === 'vector') {
            const [x1, y1] = cs.S(p1.wx, p1.wy), [x2, y2] = cs.S(p2.wx, p2.wy);
            pts = [x1, y1, x2, y2];
          } else if (o.type === 'line') pts = extLine(cs, p1.wx, p1.wy, p2.wx, p2.wy, W, H);
          else pts = extRay(cs, p1.wx, p1.wy, p2.wx, p2.wy, W, H);
          if (pts) { c.beginPath(); c.moveTo(pts[0], pts[1]); c.lineTo(pts[2], pts[3]); c.stroke(); }
        } else if (o.type === 'circle') {
          const cc = objs.get(o.cid), rp = objs.get(o.rid);
          if (!cc) { c.restore(); continue; }
          const [cx, cy] = cs.S(cc.wx, cc.wy);
          const r = (rp ? Math.hypot(cc.wx - rp.wx, cc.wy - rp.wy) : (o.r || 1)) * cs.sc;
          c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
        } else if (['circle3', 'arc', 'semicircle'].includes(o.type)) {
          const prm = engine.arcParams(objs, cs, o.type === 'circle3' ? { ...o, type: 'arc' } : o);
          if (!prm) { c.restore(); continue; }
          c.beginPath();
          if (o.type === 'circle3') c.arc(prm.cx, prm.cy, prm.r, 0, Math.PI * 2);
          else c.arc(prm.cx, prm.cy, prm.r, prm.sa, prm.ea, prm.ccw);
          c.stroke();
        }
        c.restore();
      }
    }

    function drawPendingRings(c, cs, objs, ids) {
      if (!ids || !ids.length) return;
      c.save();
      c.strokeStyle = theme.pendingRing;
      c.lineWidth = 2;
      for (const id of ids) {
        const p = objs.get(id);
        if (!p || p.type !== 'point') continue;
        const [px, py] = cs.S(p.wx, p.wy);
        c.beginPath(); c.arc(px, py, 9, 0, Math.PI * 2); c.stroke();
      }
      c.restore();
    }

    function drawRubber(c, rubber) {
      if (!rubber) return;
      const { sx, sy, ex, ey } = rubber;
      const x = Math.min(sx, ex), y = Math.min(sy, ey);
      const w = Math.abs(ex - sx), h = Math.abs(ey - sy);
      c.save();
      c.fillStyle = theme.rubberFill;
      c.strokeStyle = theme.rubberStroke;
      c.lineWidth = 1;
      c.setLineDash([4, 3]);
      c.fillRect(x, y, w, h);
      c.strokeRect(x, y, w, h);
      c.restore();
    }

    // ── hit-canvas ───────────────────────────────────────
    function rebuildHit(scene, view) {
      if (!hx) return;
      const W = view.w, H = view.h;
      if (hitCv.width !== W || hitCv.height !== H) { hitCv.width = W; hitCv.height = H; }
      hx.clearRect(0, 0, W, H);
      hitMap.clear();
      const cs = makeCS(view);
      const objs = scene.objects;
      let n = 1;
      const colorOf = new Map();
      for (const o of objs.values()) {
        const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
        colorOf.set(o.id, `rgb(${r},${g},${b})`);
        hitMap.set(`${r},${g},${b}`, o.id);
        n++;
      }
      const arr = [...objs.values()];
      const noUi = {};
      for (const o of arr) if (o.visible && o.type !== 'point') paintObj(hx, cs, objs, o, W, H, true, colorOf.get(o.id), noUi);
      for (const o of arr) if (o.visible && o.type === 'point') paintObj(hx, cs, objs, o, W, H, true, colorOf.get(o.id), noUi);
      hitScene = scene.objects;
      hitViewKey = viewKey(view);
    }

    function readHit(sx, sy) {
      const d = hx.getImageData(Math.round(sx), Math.round(sy), 1, 1).data;
      if (d[3] < 10) return null;
      return hitMap.get(`${d[0]},${d[1]},${d[2]}`) || null;
    }

    // ── API ──────────────────────────────────────────────
    return {
      draw(scene, view, ui = {}) {
        if (destroyed || !ctx) return;
        const dpr = view.dpr || 1;
        const W = view.w, H = view.h;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const cs = makeCS(view);
        const objs = scene.objects;
        ctx.fillStyle = theme.bg;
        ctx.fillRect(0, 0, W, H);
        if (ui.showGrid !== false && ui.gridMode !== 'none') drawGrid(ctx, cs, W, H, ui.gridMode || 'lines');
        if (ui.showAxes !== false) drawAxes(ctx, cs, W, H);
        drawObjects(ctx, cs, objs, W, H, ui);
        if (ui.showLabels !== false) drawLabels(ctx, cs, objs, W, H);
        drawSelectionDash(ctx, cs, objs, W, H, ui.selection);
        drawPendingRings(ctx, cs, objs, ui.pendingIds);
        if (ui.preview && ui.preview.type) {
          ctx.save(); ctx.globalAlpha = 0.55;
          paintObj(ctx, cs, objs, ui.preview, W, H, false, null, {});
          ctx.restore();
        }
        drawRubber(ctx, ui.rubber);
        rebuildHit(scene, view);
      },

      hitTest(scene, view, sx, sy, tol = 0) {
        if (destroyed || !hx) return null;
        if (hitScene !== scene.objects || hitViewKey !== viewKey(view)) rebuildHit(scene, view);
        let id = readHit(sx, sy);
        if (!id && tol > 0) {
          for (const [dx, dy] of [[tol, 0], [-tol, 0], [0, tol], [0, -tol]]) {
            id = readHit(sx + dx, sy + dy);
            if (id) break;
          }
        }
        return id;
      },

      objectAABB(scene, view, id) {
        if (destroyed) return null;
        const objs = scene.objects;
        const o = objs.get(id);
        if (!o) return null;
        const cs = makeCS(view);
        const pts = [];
        const push = (wx, wy) => pts.push(cs.S(wx, wy));
        if (o.type === 'point') { push(o.wx, o.wy); }
        else if (['segment', 'vector', 'distance'].includes(o.type)) {
          const p1 = objs.get(o.p1), p2 = objs.get(o.p2);
          if (p1) push(p1.wx, p1.wy); if (p2) push(p2.wx, p2.wy);
        }
        else if (o.type === 'line' || o.type === 'ray') {
          const p1 = objs.get(o.p1), p2 = objs.get(o.p2);
          if (p1 && p2) {
            const e = (o.type === 'line' ? extLine : extRay)(cs, p1.wx, p1.wy, p2.wx, p2.wy, view.w, view.h);
            if (e) { pts.push([e[0], e[1]], [e[2], e[3]]); }
          }
        }
        else if (o.type === 'dline') {
          const def = engine.dlineDef(objs, o);
          if (def) {
            const e = extLine(cs, def.x, def.y, def.x + def.dx, def.y + def.dy, view.w, view.h);
            if (e) pts.push([e[0], e[1]], [e[2], e[3]]);
          }
        }
        else if (['circle', 'circle3'].includes(o.type)) {
          const cd = engine.circleDefW(objs, o);
          if (cd) {
            const [cx, cy] = cs.S(cd.cx, cd.cy);
            const r = cd.r * cs.sc;
            pts.push([cx - r, cy - r], [cx + r, cy + r]);
          }
        }
        else if (['arc', 'semicircle'].includes(o.type)) {
          const prm = engine.arcParams(objs, cs, o);
          if (prm) pts.push([prm.cx - prm.r, prm.cy - prm.r], [prm.cx + prm.r, prm.cy + prm.r]);
        }
        else if (['polygon', 'polyline'].includes(o.type)) {
          for (const vid of (o.vids || [])) { const p = objs.get(vid); if (p) push(p.wx, p.wy); }
        }
        else if (o.type === 'angle') {
          const B = objs.get(o.p2);
          if (B) { const [bx, by] = cs.S(B.wx, B.wy); pts.push([bx - 42, by - 42], [bx + 42, by + 42]); }
        }
        else if (o.type === 'slider') {
          const [ax, ay] = cs.S(o.wx, o.wy);
          pts.push([ax - 8, ay - 26], [ax + 148, ay + 10]);
        }
        if (!pts.length) return null;
        const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
        const pad = o.type === 'point' ? 8 : 4;
        const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
        return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
      },

      resize(w, h, dpr = 1) {
        if (destroyed || !canvas) return;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        if (hitCv) { hitCv.width = w; hitCv.height = h; hitScene = null; }
      },

      setTheme(partial) {
        if (destroyed) return;
        if (partial && partial.theme) { theme = { ...theme, ...partial.theme }; }
        else theme = { ...theme, ...(partial || {}) };
        if (partial && partial.fonts) fonts = { ...fonts, ...partial.fonts };
        hitScene = null;
      },

      destroy() {
        destroyed = true;
        hitMap.clear();
        hitScene = null;
      },
    };
  }

  const GeoRenderer = {
    create: createGeoRenderer,
    extLine, extRay, fmt, objVal,
    DEFAULT_THEME, DEFAULT_FONTS,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GeoRenderer;
    module.exports.createGeoRenderer = createGeoRenderer;
  } else {
    global.GeoRenderer = GeoRenderer;
    global.createGeoRenderer = createGeoRenderer;
  }

})(typeof window !== 'undefined' ? window : globalThis);

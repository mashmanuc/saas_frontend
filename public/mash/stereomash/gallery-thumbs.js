/* ═══════════════════════════════════════════════════════════
   StereoMASH — gallery-thumbs.js (ТЗ v2 §5)
   Арт-мініатюри всіх 23 фігур у єдиному стилі (SVG, iso-проєкція,
   скляні грані з shade + приховані ребра пунктиром — узгоджено
   з rich-стилем stereo-renderer). window.StereoThumbs[key].render()
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Єдина колірна мова (стиль rich)
  const C = {
    hue: 258, sat: 44, lMin: 42, lMax: 88,
    aFront: 0.85, aBack: 0.28,
    edge: '#3f3260', hidden: '#a99cc9',
    accent: '#7c3aed', accentFill: 'rgba(124,58,237,.15)',
    teal: '#0d9488',
  };
  const W = 80, H = 64;
  const LIGHT = norm([-0.45, 0.85, -0.35]);
  const VIEWD = norm([1, 0.82, 1]); // напрямок «углиб» iso-проєкції

  function norm(v) { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  function project(verts) {
    // iso: px=(x−z)·a, py=(x+z)·b − y; нормування у 80×64 з полями
    const raw = verts.map(v => [(v[0] - v[2]) * 0.82, (v[0] + v[2]) * 0.41 - v[1]]);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, y] of raw) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const s = Math.min((W - 14) / (x1 - x0 || 1), (H - 12) / (y1 - y0 || 1));
    const ox = (W - (x1 - x0) * s) / 2 - x0 * s, oy = (H - (y1 - y0) * s) / 2 - y0 * s;
    return raw.map(([x, y]) => [Math.round((x * s + ox) * 10) / 10, Math.round((y * s + oy) * 10) / 10]);
  }

  function meshSvg(verts, faces, extra) {
    const P = project(verts);
    const withN = faces.map(f => {
      const a = verts[f[0]], b = verts[f[1]], c = verts[f[2]];
      const n = norm(cross(sub(b, a), sub(c, a)));
      const front = dot(n, VIEWD) > 0.02;
      const shade = Math.max(0, Math.min(1, 0.35 + 0.65 * Math.max(0, dot(n, LIGHT))));
      const depth = f.reduce((s2, i) => s2 + dot(verts[i], VIEWD), 0) / f.length;
      return { f, front, shade, depth };
    });
    withN.sort((a, b) => a.depth - b.depth); // далекі перші
    // ребра: visible якщо межує з front-гранню
    const edges = new Map();
    for (const { f, front } of withN) {
      for (let i = 0; i < f.length; i++) {
        const a = f[i], b = f[(i + 1) % f.length];
        const k = a < b ? a + '-' + b : b + '-' + a;
        const e = edges.get(k) || { a, b, front: false };
        e.front = e.front || front;
        edges.set(k, e);
      }
    }
    let s = '';
    for (const e of edges.values()) {
      if (e.front) continue;
      s += `<line x1="${P[e.a][0]}" y1="${P[e.a][1]}" x2="${P[e.b][0]}" y2="${P[e.b][1]}" stroke="${C.hidden}" stroke-width="1" stroke-dasharray="3 2.5"></line>`;
    }
    for (const { f, front, shade } of withN) {
      const l = C.lMin + (C.lMax - C.lMin) * shade;
      const fill = `hsla(${C.hue},${C.sat}%,${l}%,${front ? C.aFront : C.aBack})`;
      const pts = f.map(i => P[i].join(',')).join(' ');
      s += `<polygon points="${pts}" fill="${fill}"></polygon>`;
    }
    for (const e of edges.values()) {
      if (!e.front) continue;
      s += `<line x1="${P[e.a][0]}" y1="${P[e.a][1]}" x2="${P[e.b][0]}" y2="${P[e.b][1]}" stroke="${C.edge}" stroke-width="1.3" stroke-linecap="round"></line>`;
    }
    return svg(s + (extra ? extra(P) : ''));
  }

  function svg(inner) {
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  }

  // ── Мешеві генератори ────────────────────────────────────
  function ring(n, r, y, rot) {
    const a0 = rot !== undefined ? rot : Math.PI / n - Math.PI / 2;
    return Array.from({ length: n }, (_, i) => {
      const a = a0 + i * 2 * Math.PI / n;
      return [r * Math.cos(a), y, r * Math.sin(a)];
    });
  }
  function prism(n, r, h, opts) {
    const o = opts || {};
    const bot = ring(n, r, 0, o.rot), top = ring(n, o.rTop !== undefined ? o.rTop : r, h, o.rot)
      .map(v => [v[0] + (o.skew || 0), v[1], v[2]]);
    const verts = [...bot, ...top];
    const faces = [];
    faces.push([...Array(n).keys()].reverse());                    // низ (нормаль вниз)
    faces.push([...Array(n).keys()].map(i => i + n));              // верх
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      faces.push([i, j, j + n, i + n]);
    }
    return { verts, faces };
  }
  function pyramid(n, r, h, opts) {
    const o = opts || {};
    const bot = o.base || ring(n, r, 0, o.rot);
    const verts = [...bot, [o.ax || 0, h, o.az || 0]];
    const nn = bot.length;
    const faces = [[...Array(nn).keys()].reverse()];
    for (let i = 0; i < nn; i++) faces.push([i, (i + 1) % nn, nn]);
    return { verts, faces };
  }

  // ── Тіла обертання (ручні path'и) ────────────────────────
  function cylinderSvg(extra) {
    const rx = 21, ry = 7.5, x = 40, yT = 13, yB = 50;
    let s = `<path d="M${x - rx} ${yT} L${x - rx} ${yB} A${rx} ${ry} 0 0 0 ${x + rx} ${yB} L${x + rx} ${yT}" fill="hsla(${C.hue},${C.sat}%,66%,.75)"></path>`;
    s += `<ellipse cx="${x}" cy="${yT}" rx="${rx}" ry="${ry}" fill="hsla(${C.hue},${C.sat}%,86%,.9)" stroke="${C.edge}" stroke-width="1.3"></ellipse>`;
    s += `<path d="M${x - rx} ${yB} A${rx} ${ry} 0 0 0 ${x + rx} ${yB}" fill="none" stroke="${C.edge}" stroke-width="1.3"></path>`;
    s += `<path d="M${x - rx} ${yB} A${rx} ${ry} 0 0 1 ${x + rx} ${yB}" fill="none" stroke="${C.hidden}" stroke-width="1" stroke-dasharray="3 2.5"></path>`;
    s += `<line x1="${x - rx}" y1="${yT}" x2="${x - rx}" y2="${yB}" stroke="${C.edge}" stroke-width="1.3"></line>`;
    s += `<line x1="${x + rx}" y1="${yT}" x2="${x + rx}" y2="${yB}" stroke="${C.edge}" stroke-width="1.3"></line>`;
    return svg(s + (extra || ''));
  }
  function coneSvg(extra) {
    const rx = 22, ry = 7.5, x = 40, yA = 9, yB = 50;
    let s = `<path d="M${x} ${yA} L${x - rx} ${yB} A${rx} ${ry} 0 0 0 ${x + rx} ${yB} Z" fill="hsla(${C.hue},${C.sat}%,68%,.8)"></path>`;
    s += `<path d="M${x - rx} ${yB} A${rx} ${ry} 0 0 1 ${x + rx} ${yB}" fill="none" stroke="${C.hidden}" stroke-width="1" stroke-dasharray="3 2.5"></path>`;
    s += `<path d="M${x - rx} ${yB} A${rx} ${ry} 0 0 0 ${x + rx} ${yB}" fill="none" stroke="${C.edge}" stroke-width="1.3"></path>`;
    s += `<line x1="${x}" y1="${yA}" x2="${x - rx}" y2="${yB}" stroke="${C.edge}" stroke-width="1.3"></line>`;
    s += `<line x1="${x}" y1="${yA}" x2="${x + rx}" y2="${yB}" stroke="${C.edge}" stroke-width="1.3"></line>`;
    return svg(s + (extra || ''));
  }
  function sphereSvg(id, extra) {
    const x = 40, y = 32, r = 23;
    let s = `<defs><radialGradient id="sg${id}" cx="38%" cy="30%" r="75%">`
      + `<stop offset="0%" stop-color="hsla(${C.hue},${C.sat}%,92%,.95)"></stop>`
      + `<stop offset="100%" stop-color="hsla(${C.hue},${C.sat}%,58%,.9)"></stop></radialGradient></defs>`;
    s += `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#sg${id})" stroke="${C.edge}" stroke-width="1.3"></circle>`;
    s += `<path d="M${x - r} ${y} A${r} ${r * 0.32} 0 0 0 ${x + r} ${y}" fill="none" stroke="${C.edge}" stroke-width="1"></path>`;
    s += `<path d="M${x - r} ${y} A${r} ${r * 0.32} 0 0 1 ${x + r} ${y}" fill="none" stroke="${C.hidden}" stroke-width="1" stroke-dasharray="3 2.5"></path>`;
    return svg(s + (extra || ''));
  }
  function frustumConeSvg() {
    const x = 40, rT = 12, rB = 22, ryT = 4.5, ryB = 7.5, yT = 15, yB = 50;
    let s = `<path d="M${x - rT} ${yT} L${x - rB} ${yB} A${rB} ${ryB} 0 0 0 ${x + rB} ${yB} L${x + rT} ${yT}" fill="hsla(${C.hue},${C.sat}%,68%,.8)"></path>`;
    s += `<ellipse cx="${x}" cy="${yT}" rx="${rT}" ry="${ryT}" fill="hsla(${C.hue},${C.sat}%,86%,.9)" stroke="${C.edge}" stroke-width="1.2"></ellipse>`;
    s += `<path d="M${x - rB} ${yB} A${rB} ${ryB} 0 0 0 ${x + rB} ${yB}" fill="none" stroke="${C.edge}" stroke-width="1.3"></path>`;
    s += `<path d="M${x - rB} ${yB} A${rB} ${ryB} 0 0 1 ${x + rB} ${yB}" fill="none" stroke="${C.hidden}" stroke-width="1" stroke-dasharray="3 2.5"></path>`;
    s += `<line x1="${x - rT}" y1="${yT}" x2="${x - rB}" y2="${yB}" stroke="${C.edge}" stroke-width="1.3"></line>`;
    s += `<line x1="${x + rT}" y1="${yT}" x2="${x + rB}" y2="${yB}" stroke="${C.edge}" stroke-width="1.3"></line>`;
    return svg(s);
  }

  // ── Каталог 23 фігур ─────────────────────────────────────
  const box = (w, h, d) => {
    const x = w / 2, z = d / 2;
    return {
      verts: [[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z], [-x, h, -z], [x, h, -z], [x, h, z], [-x, h, z]],
      faces: [[3, 2, 1, 0], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]],
    };
  };
  const trapBase = [[-1.3, 0, -0.8], [1.3, 0, -0.8], [0.7, 0, 0.8], [-0.7, 0, 0.8]];

  const DEFS = {
    cube: () => { const m = box(1.6, 1.6, 1.6); return meshSvg(m.verts, m.faces); },
    cuboid: () => { const m = box(2.3, 1.3, 1.3); return meshSvg(m.verts, m.faces); },
    pyramid4: () => { const m = pyramid(4, 1.25, 1.9); return meshSvg(m.verts, m.faces); },
    pyramid3: () => { const m = pyramid(3, 1.3, 1.8); return meshSvg(m.verts, m.faces); },
    pyramid6: () => { const m = pyramid(6, 1.25, 1.8); return meshSvg(m.verts, m.faces); },
    ngonPyramid: () => { const m = pyramid(7, 1.25, 1.7); return meshSvg(m.verts, m.faces); },
    tetrahedron: () => { const m = pyramid(3, 1.35, 1.55, { ax: 0, az: 0 }); return meshSvg(m.verts, m.faces); },
    trapPyramid: () => { const m = pyramid(0, 0, 1.8, { base: trapBase }); return meshSvg(m.verts, m.faces); },
    prism4: () => { const m = prism(4, 1.05, 1.9); return meshSvg(m.verts, m.faces); },
    prism6: () => { const m = prism(6, 1.1, 1.8); return meshSvg(m.verts, m.faces); },
    ngonPrism: () => { const m = prism(7, 1.1, 1.7); return meshSvg(m.verts, m.faces); },
    obliquePrism4: () => { const m = prism(4, 1.05, 1.7, { skew: 0.75 }); return meshSvg(m.verts, m.faces); },
    frustumPyramid4: () => { const m = prism(4, 1.35, 1.35, { rTop: 0.75 }); return meshSvg(m.verts, m.faces); },
    cubeSection3: () => {
      const m = box(1.6, 1.6, 1.6);
      return meshSvg(m.verts, m.faces, P => {
        const a = P[4], b = P[2], c = P[5]; // переріз через 3 вершини
        return `<polygon points="${a.join(',')} ${b.join(',')} ${c.join(',')}" fill="${C.accentFill}" stroke="${C.accent}" stroke-width="1.4" stroke-linejoin="round"></polygon>`;
      });
    },
    pyramid4Section3: () => {
      const m = pyramid(4, 1.3, 1.9);
      return meshSvg(m.verts, m.faces, P => {
        // трикутний переріз: середини двох бічних ребер + точка на основі
        const apex = P[4];
        const mid = (i) => [(P[i][0] + apex[0]) / 2, (P[i][1] + apex[1]) / 2];
        const p1 = mid(0), p2 = mid(2), p3 = [(P[1][0] + P[2][0]) / 2, (P[1][1] + P[2][1]) / 2];
        return `<polygon points="${p1.join(',')} ${p2.join(',')} ${p3.join(',')}" fill="${C.accentFill}" stroke="${C.accent}" stroke-width="1.4" stroke-linejoin="round"></polygon>`;
      });
    },
    prism4Section3: () => {
      const m = prism(4, 1.05, 1.9);
      return meshSvg(m.verts, m.faces, P => {
        // похилий переріз через точки на ребрах
        const p1 = [(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2];
        const p2 = [(P[2][0] + P[6][0]) / 2, (P[2][1] + P[6][1]) / 2];
        const p3 = [(P[7][0] + P[4][0]) / 2, (P[7][1] + P[4][1]) / 2];
        return `<polygon points="${p1.join(',')} ${p2.join(',')} ${p3.join(',')}" fill="${C.accentFill}" stroke="${C.accent}" stroke-width="1.4" stroke-linejoin="round"></polygon>`;
      });
    },
    cylinder: () => cylinderSvg(),
    cone: () => coneSvg(),
    sphere: () => sphereSvg('s'),
    frustumCone: () => frustumConeSvg(),
    cubeInscribedSphere: () => {
      const m = box(1.7, 1.7, 1.7);
      return meshSvg(m.verts, m.faces, () =>
        `<circle cx="40" cy="33" r="17.5" fill="rgba(13,148,136,.12)" stroke="${C.teal}" stroke-width="1.4"></circle>`);
    },
    cubeCircumSphere: () => {
      const m = box(1.35, 1.35, 1.35);
      return meshSvg(m.verts, m.faces, () =>
        `<circle cx="40" cy="32" r="26" fill="none" stroke="${C.teal}" stroke-width="1.4" stroke-dasharray="4 3"></circle>`);
    },
    cylinderInscribedSphere: () => cylinderSvg(
      `<circle cx="40" cy="31.5" r="17" fill="rgba(13,148,136,.12)" stroke="${C.teal}" stroke-width="1.4"></circle>`),
    sphereInscribedCone: () => sphereSvg('c',
      `<path d="M40 12 L23 47 A17 5.5 0 0 0 57 47 Z" fill="rgba(124,58,237,.16)" stroke="${C.accent}" stroke-width="1.3"></path>`),
    coneInscribedCylinder: () => coneSvg(
      `<path d="M30 30 L30 50 A10 3.6 0 0 0 50 50 L50 30 A10 3.6 0 0 0 30 30 A10 3.6 0 0 0 50 30" fill="rgba(13,148,136,.10)" stroke="${C.teal}" stroke-width="1.2"></path>`),
  };

  const StereoThumbs = {};
  for (const [key, fn] of Object.entries(DEFS)) StereoThumbs[key] = { render: fn };

  if (typeof window !== 'undefined') window.StereoThumbs = StereoThumbs;
  if (typeof module !== 'undefined' && module.exports) module.exports = StereoThumbs;
})();

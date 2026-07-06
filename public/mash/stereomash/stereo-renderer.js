/* ═══════════════════════════════════════════════════════════
   StereoMASH — stereo-renderer.js (ТЗ v2 §2)
   Красивий рендер display-list-фрейму від двигуна nmt-3d.
   Принципи §1: stateless щодо сцени; без RAF / addEventListener /
   localStorage / глобального document; кольори ТІЛЬКИ через theme;
   детермінізм: два draw(frame) → ідентичний кадр.
   window.StereoRenderer + module.exports (Node-smoke ok).
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Theme-пресети (§4): rich (дефолт воронки) + exam (канонічний каркас)
  const THEMES = {
    rich: {
      bgTop: '#faf9fd', bgBottom: '#efeaf8',
      faceHue: 258, faceSat: 44, faceLightMin: 40, faceLightMax: 88,
      faceAlphaFront: 0.85, faceAlphaBack: 0.30,
      edge: '#3f3260', edgeHidden: '#a99cc9', edgeWidth: 1.7, edgeHiddenDash: [5, 4],
      shadow: 'rgba(60,45,110,.16)',
      label: '#2a2140', labelHalo: 'rgba(255,255,255,.85)',
      dot: '#3f3260', dotR: 3.2,
      curve: '#3f3260', curveHidden: '#a99cc9',
      curvedFill: true,
      highlightAlpha: 0.45,
      aux: {
        height: '#e2483d', section: '#7c3aed', diagonal: '#2d70b3',
        apothem: '#e07030', radius: '#1f8a5b',
        inscribed: '#0d9488', circumscribed: '#0d9488',
        hiddenPart: '#a99cc9', rightAngle: '#e2483d', aux: null, default: '#7c3aed',
      },
      useColorHint: true,
      auxWidth: 2.2,
      sectionFill: 'rgba(124,58,237,.15)',
      unfoldFace: 'rgba(124,58,237,.10)',
    },
    exam: {
      bgTop: '#ffffff', bgBottom: '#ffffff',
      faceHue: 0, faceSat: 0, faceLightMin: 100, faceLightMax: 100,
      faceAlphaFront: 0, faceAlphaBack: 0,          // грані не заливаються
      edge: '#1c1c1c', edgeHidden: '#8a8a8a', edgeWidth: 1.2, edgeHiddenDash: [5, 4],
      shadow: null,
      label: '#111111', labelHalo: 'rgba(255,255,255,.9)',
      dot: '#1c1c1c', dotR: 2.8,
      curve: '#1c1c1c', curveHidden: '#8a8a8a',
      curvedFill: false,
      highlightAlpha: 0.08,
      aux: {
        height: '#444444', section: '#444444', diagonal: '#444444',
        apothem: '#444444', radius: '#444444',
        inscribed: '#444444', circumscribed: '#444444',
        hiddenPart: '#8a8a8a', rightAngle: '#444444', aux: '#444444', default: '#444444',
      },
      useColorHint: false,
      auxWidth: 1.5,
      sectionFill: 'rgba(0,0,0,.05)',
      unfoldFace: 'rgba(0,0,0,.04)',
    },
  };

  function mergeTheme(base, patch) {
    const out = { ...base, aux: { ...base.aux } };
    if (patch) {
      for (const [k, v] of Object.entries(patch)) {
        if (k === 'aux' && v && typeof v === 'object') Object.assign(out.aux, v);
        else out[k] = v;
      }
    }
    return out;
  }

  function createStereoRenderer(canvas, opts) {
    opts = opts || {};
    let theme = (typeof opts.theme === 'string')
      ? mergeTheme(THEMES[opts.theme] || THEMES.rich, null)
      : mergeTheme(THEMES.rich, opts.theme);
    const fonts = Object.assign({ label: 'italic 600 15px Georgia, serif' }, opts.fonts);
    let dead = false;
    let vw = 0, vh = 0, vdpr = 1;
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;

    function faceFill(f) {
      const alpha = f.front ? theme.faceAlphaFront : theme.faceAlphaBack;
      if (!alpha) return null;
      const sh = typeof f.shade === 'number' ? Math.max(0, Math.min(1, f.shade)) : 0.6;
      const l = theme.faceLightMin + (theme.faceLightMax - theme.faceLightMin) * sh;
      return `hsla(${theme.faceHue},${theme.faceSat}%,${l}%,${alpha})`;
    }

    function poly(pts) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
    }

    function drawBg(w, h) {
      if (theme.bgTop === theme.bgBottom) {
        ctx.fillStyle = theme.bgTop;
      } else {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, theme.bgTop);
        g.addColorStop(1, theme.bgBottom);
        ctx.fillStyle = g;
      }
      ctx.fillRect(0, 0, w, h);
    }

    function drawShadow(frame) {
      if (!theme.shadow) return;
      // тінь за НИЖНІМ контуром об'єкта, не всім bbox — ширина = точки біля опори
      const pts = [];
      const scan = (arr) => { for (const p of arr) pts.push(p); };
      (frame.faces || []).forEach(f => f.pts && scan(f.pts));
      (frame.edges || []).forEach(e => e.pts && scan(e.pts));
      for (const c of frame.curves || []) {
        if (c.visible === false || !c.d) continue;
        const nums = c.d.match(/-?\d+(?:\.\d+)?/g) || [];
        for (let i = 0; i + 1 < nums.length; i += 2) pts.push({ x: +nums[i], y: +nums[i + 1] });
      }
      if (pts.length < 3) return;
      let minY = Infinity, maxY = -Infinity;
      for (const p of pts) { if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
      const h = maxY - minY;
      if (h < 8) return;
      // опорна зона — нижні 12% висоти
      let bx0 = Infinity, bx1 = -Infinity;
      for (const p of pts) {
        if (p.y >= maxY - h * 0.12) { if (p.x < bx0) bx0 = p.x; if (p.x > bx1) bx1 = p.x; }
      }
      if (!isFinite(bx0) || bx1 - bx0 < 2) return;
      const bw = bx1 - bx0;
      const cx = (bx0 + bx1) / 2;
      // куля/вузька опора — трохи розширюємо, але не до повного bbox
      const rx = Math.max(bw * 0.58, h * 0.10);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, maxY + 10, rx, Math.max(4, rx * 0.16), 0, 0, Math.PI * 2);
      ctx.fillStyle = theme.shadow;
      ctx.fill();
      ctx.restore();
    }

    function drawFaces(frame) {
      const faces = (frame.faces || []).slice()
        .sort((a, b) => (b.depth || 0) - (a.depth || 0)); // далекі перші (painter)
      for (const f of faces) {
        if (!f.pts || f.pts.length < 3) continue;
        const fill = frame.kind === 'unfolded' ? theme.unfoldFace : faceFill(f);
        if (!fill) continue;
        poly(f.pts);
        ctx.fillStyle = fill;
        ctx.fill();
      }
    }

    function drawEdges(frame, visible) {
      ctx.save();
      ctx.strokeStyle = visible ? theme.edge : theme.edgeHidden;
      ctx.lineWidth = visible ? theme.edgeWidth : Math.max(1, theme.edgeWidth - 0.5);
      ctx.setLineDash(visible ? [] : theme.edgeHiddenDash);
      ctx.lineCap = 'round';
      for (const e of frame.edges || []) {
        if (!!e.visible !== visible || !e.pts || e.pts.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(e.pts[0].x, e.pts[0].y);
        for (let i = 1; i < e.pts.length; i++) ctx.lineTo(e.pts[i].x, e.pts[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    function pathBBox(d) {
      // грубий bbox з числових токенів path-рядка (достатньо для вибору силуета)
      const nums = d.match(/-?\d+(?:\.\d+)?/g);
      if (!nums || nums.length < 4) return null;
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const x = +nums[i], y = +nums[i + 1];
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      return { x0, y0, x1, y1, area: (x1 - x0) * (y1 - y0) };
    }

    function drawCurves(frame) {
      if (typeof Path2D === 'undefined') return;
      const curves = frame.curves || [];
      ctx.save();
      // rich: скляна заливка тіла обертання.
      // Двигун v4 дає точні ролі: 'silhouette' (обриси) / 'ring' (кільця основ).
      if (theme.curvedFill && curves.length) {
        const sil = curves.filter(c => c.role === 'silhouette' && c.visible !== false && c.d);
        const rings = curves.filter(c => c.role === 'ring' && c.d);
        let fillPath = null, fillBox = null;
        if (sil.length === 1 && /[AZz]/.test(sil[0].d)) {
          // замкнений силует (куля) — заливаємо напряму
          fillPath = new Path2D(sil[0].d);
          fillBox = pathBBox(sil[0].d);
        } else if (sil.length >= 2) {
          // твірні-відрізки (циліндр/конус/зріз.) — будуємо чотирикутник тіла
          const ends = sil.slice(0, 2).map(c => {
            const n = c.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
            return [{ x: n[0], y: n[1] }, { x: n[n.length - 2], y: n[n.length - 1] }];
          });
          const [a, b] = ends;
          fillPath = new Path2D();
          fillPath.moveTo(a[0].x, a[0].y);
          fillPath.lineTo(a[1].x, a[1].y);
          fillPath.lineTo(b[1].x, b[1].y);
          fillPath.lineTo(b[0].x, b[0].y);
          fillPath.closePath();
          // + кільця основ як частина тіла
          for (const r of rings) { try { fillPath.addPath(new Path2D(r.d + ' Z')); } catch (_) {} }
          const xs = [...a, ...b];
          fillBox = { x0: Math.min.apply(null, xs.map(p => p.x)), x1: Math.max.apply(null, xs.map(p => p.x)),
                      y0: Math.min.apply(null, xs.map(p => p.y)), y1: Math.max.apply(null, xs.map(p => p.y)) };
        } else {
          // старий двигун без ролей — евристика max-bbox
          let best = null, bestBox = null;
          for (const c of curves) {
            if (c.visible === false || !c.d) continue;
            const box = pathBBox(c.d);
            if (box && (!bestBox || box.area > bestBox.area)) { best = c; bestBox = box; }
          }
          if (best && bestBox && bestBox.area > 40) { fillPath = new Path2D(best.d); fillBox = bestBox; }
        }
        if (fillPath && fillBox) {
          const w = fillBox.x1 - fillBox.x0, h = fillBox.y1 - fillBox.y0;
          if (w > 4 && h > 4) {
            const g = ctx.createRadialGradient(
              fillBox.x0 + w * 0.38, fillBox.y0 + h * 0.30, Math.max(4, w * 0.08),
              fillBox.x0 + w * 0.5, fillBox.y0 + h * 0.55, Math.max(w, h) * 0.75);
            g.addColorStop(0, `hsla(${theme.faceHue},${theme.faceSat}%,${theme.faceLightMax}%,${theme.faceAlphaFront})`);
            g.addColorStop(1, `hsla(${theme.faceHue},${theme.faceSat}%,${theme.faceLightMin + 12}%,${theme.faceAlphaFront})`);
            ctx.fillStyle = g;
            ctx.fill(fillPath);
          }
        }
      }
      ctx.lineCap = 'round';
      for (const c of curves) {
        if (!c.d) continue;
        ctx.strokeStyle = c.visible === false ? theme.curveHidden : theme.curve;
        ctx.lineWidth = c.visible === false ? Math.max(1, theme.edgeWidth - 0.5) : theme.edgeWidth;
        ctx.setLineDash(c.visible === false ? theme.edgeHiddenDash : []);
        ctx.stroke(new Path2D(c.d));
      }
      ctx.restore();
    }

    function auxColor(a) {
      const roleCol = theme.aux[a.role];
      if (roleCol) return roleCol;
      if (theme.useColorHint && a.colorHint) return a.colorHint;
      return theme.aux.default;
    }

    function drawAux(frame) {
      ctx.save();
      ctx.lineCap = 'round';
      for (const a of frame.aux || []) {
        const col = auxColor(a);
        ctx.strokeStyle = col;
        ctx.lineWidth = a.w || theme.auxWidth;
        ctx.setLineDash(a.dash ? [6, 5] : []);
        if (a.d && typeof Path2D !== 'undefined') {
          ctx.stroke(new Path2D(a.d));
          continue;
        }
        if (!a.pts || a.pts.length < 2) continue;
        poly(a.pts);
        if (a.kind === 'poly') {
          if (a.role === 'section') { ctx.fillStyle = theme.sectionFill; ctx.fill(); }
          ctx.stroke();
        } else {
          // line/polyline — без замикання
          ctx.beginPath();
          ctx.moveTo(a.pts[0].x, a.pts[0].y);
          for (let i = 1; i < a.pts.length; i++) ctx.lineTo(a.pts[i].x, a.pts[i].y);
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    function drawFills(frame) {
      if (typeof Path2D === 'undefined') return;
      ctx.save();
      for (const f of frame.fills || []) {
        if (!f.d) continue;
        const col = auxColor(f);
        ctx.globalAlpha = f.fillOpacity != null ? f.fillOpacity : 0.15;
        ctx.fillStyle = col;
        ctx.fill(new Path2D(f.d));
      }
      ctx.restore();
    }

    function drawDotsLabels(frame) {
      for (const d of frame.dots || []) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, theme.dotR, 0, Math.PI * 2);
        ctx.fillStyle = theme.dot;
        ctx.fill();
      }
      ctx.save();
      ctx.textBaseline = 'middle';
      for (const l of frame.labels || []) {
        ctx.font = l.italic === false ? fonts.label.replace(/^italic\s+/, '') : fonts.label;
        if (theme.labelHalo) {
          ctx.lineWidth = 4;
          ctx.strokeStyle = theme.labelHalo;
          ctx.strokeText(l.text, l.x, l.y);
        }
        ctx.fillStyle = theme.label;
        ctx.fillText(l.text, l.x, l.y);
      }
      ctx.restore();
    }

    function drawStrokes(frame) {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const s of frame.strokes || []) {
        if (s.erase) continue;
        ctx.strokeStyle = s.color || theme.edge;
        ctx.lineWidth = s.width || 3;
        if (s.d && typeof Path2D !== 'undefined') { ctx.stroke(new Path2D(s.d)); continue; }
        if (!s.pts || s.pts.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(s.pts[0].x, s.pts[0].y);
        for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i].x, s.pts[i].y);
        ctx.stroke();
      }
      ctx.restore();
    }

    return {
      draw(frame, ui) {
        if (dead || !ctx || !frame) return;
        const v = frame.view || { w: vw, h: vh, dpr: vdpr };
        if (v.w !== vw || v.h !== vh || (v.dpr || 1) !== vdpr) this.resize(v.w, v.h, v.dpr || 1);
        ctx.setTransform(vdpr, 0, 0, vdpr, 0, 0);
        drawBg(vw, vh);
        drawShadow(frame);
        drawFaces(frame);
        // підсвітка однієї грані (ТЗ v3 §A1 режим 4; в exam ≤ 10%)
        if (ui && ui.highlightFaceId) {
          const hf = (frame.faces || []).find(f => f.id === ui.highlightFaceId);
          if (hf && hf.pts && hf.pts.length >= 3) {
            poly(hf.pts);
            ctx.fillStyle = `hsla(${theme.faceHue},${Math.max(theme.faceSat, 30)}%,60%,${theme.highlightAlpha})`;
            ctx.fill();
          }
        }
        drawEdges(frame, false);   // приховані — під видимими
        drawEdges(frame, true);
        drawCurves(frame);
        drawFills(frame);
        drawAux(frame);
        drawDotsLabels(frame);
        drawStrokes(frame);
      },
      resize(w, h, dpr) {
        if (dead || !canvas) return;
        vw = w; vh = h; vdpr = dpr || 1;
        canvas.width = Math.round(w * vdpr);
        canvas.height = Math.round(h * vdpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
      },
      setTheme(patch) {
        if (dead) return;
        theme = (typeof patch === 'string')
          ? mergeTheme(THEMES[patch] || THEMES.rich, null)
          : mergeTheme(theme, patch);
      },
      destroy() { dead = true; },
    };
  }

  const api = { createStereoRenderer, THEMES };
  if (typeof window !== 'undefined') window.StereoRenderer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();

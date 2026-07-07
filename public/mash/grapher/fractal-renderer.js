// fractal-renderer.js — Phase 6/7: Universal Fractal Renderer
// Підтримка: Mandelbrot, Julia (легко розширюється на Burning Ship, Newton, Multibrot)
// Прогресивний рендер 1/8→1/4→1/2→1, abort-токен, LRU-кеш, адаптивний maxIter
(function () {
  'use strict';

  // ── HSL → RGB ─────────────────────────────────────────────────────────────
  function hsl2rgb(h, s, l) {
    h /= 360;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + h * 12) % 12;
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }

  // ── Палітри ───────────────────────────────────────────────────────────────
  // (v, maxIter) → [r, g, b].  v >= maxIter → interior (чорна точка)
  const PALETTE_FNS = {
    smooth(v, maxIter) {
      if (v >= maxIter) return [0, 0, 0];
      const t = v / maxIter;
      return hsl2rgb((240 + t * 340) % 360, 0.85, 0.12 + t * 0.68);
    },
    fire(v, maxIter) {
      if (v >= maxIter) return [0, 0, 0];
      const t = v / maxIter;
      if (t < 0.35) { const u = t / 0.35; return [Math.round(u * 220), 0, 0]; }
      if (t < 0.65) { const u = (t - 0.35) / 0.30; return [220 + Math.round(u * 35), Math.round(u * 155), 0]; }
      const u = (t - 0.65) / 0.35;
      return [255, 155 + Math.round(u * 100), Math.round(u * 255)];
    },
    gray(v, maxIter) {
      if (v >= maxIter) return [0, 0, 0];
      const t = Math.sqrt(v / maxIter);
      const c = Math.round(t * 240);
      return [c, c, c];
    },
    rainbow(v, maxIter) {
      if (v >= maxIter) return [0, 0, 0];
      return hsl2rgb((v / maxIter) * 360, 0.9, 0.5);
    },
    ice(v, maxIter) {
      if (v >= maxIter) return [0, 10, 30];
      const t = v / maxIter;
      return hsl2rgb(200 + t * 50, 0.85, 0.08 + t * 0.75);
    },
  };

  // ── Адаптивний maxIter (залежно від zoom) ─────────────────────────────────
  // scale = фізичні пікселі / математична одиниця (viewport.scale)
  function adaptiveIter(scale) {
    if (scale < 30)   return 150;
    if (scale < 200)  return 300;
    if (scale < 1500) return 500;
    if (scale < 8000) return 800;
    if (scale < 5e5)  return 1200;
    return 1600;
  }

  // ── Ядро ітерацій ─────────────────────────────────────────────────────────
  // Повертає smooth iteration count (float). Значення >= maxIter → interior.
  function iterCore(zx, zy, cx, cy, maxIter) {
    let zx2 = zx * zx, zy2 = zy * zy, i = 0;
    while (zx2 + zy2 <= 4 && i < maxIter) {
      zy = 2 * zx * zy + cy;
      zx = zx2 - zy2 + cx;
      zx2 = zx * zx; zy2 = zy * zy;
      i++;
    }
    if (i >= maxIter) return maxIter;
    // Smooth normalized iteration count (log-log escape)
    return i + 1 - Math.log2(Math.log2(Math.sqrt(zx2 + zy2)));
  }

  // ── Burning Ship: z_{n+1} = (|Re(z)| + i|Im(z)|)² + c ────────────────────
  function iterCoreBurningShip(zx, zy, cx, cy, maxIter) {
    let zx2 = zx * zx, zy2 = zy * zy, i = 0;
    while (zx2 + zy2 <= 4 && i < maxIter) {
      zy = 2 * Math.abs(zx) * Math.abs(zy) + cy;
      zx = zx2 - zy2 + cx;
      zx2 = zx * zx; zy2 = zy * zy; i++;
    }
    if (i >= maxIter) return maxIter;
    return i + 1 - Math.log2(Math.log2(Math.sqrt(zx2 + zy2)));
  }

  // ── Tricorn (Mandelbar): z_{n+1} = conj(z)² + c ────────────────────────────
  function iterCoreTricorn(zx, zy, cx, cy, maxIter) {
    let zx2 = zx * zx, zy2 = zy * zy, i = 0;
    while (zx2 + zy2 <= 4 && i < maxIter) {
      zy = -2 * zx * zy + cy;
      zx = zx2 - zy2 + cx;
      zx2 = zx * zx; zy2 = zy * zy; i++;
    }
    if (i >= maxIter) return maxIter;
    return i + 1 - Math.log2(Math.log2(Math.sqrt(zx2 + zy2)));
  }

  // ── Multibrot: z_{n+1} = z^p + c (полярна форма) ─────────────────────
  function iterCoreMultibrot(zx, zy, cx, cy, maxIter, p) {
    let zx2 = zx * zx, zy2 = zy * zy, i = 0;
    const logP = Math.log(p);
    while (zx2 + zy2 <= 4 && i < maxIter) {
      const r = Math.sqrt(zx2 + zy2);
      const th = Math.atan2(zy, zx);
      const rp = Math.pow(r, p);
      zx = rp * Math.cos(p * th) + cx;
      zy = rp * Math.sin(p * th) + cy;
      zx2 = zx * zx; zy2 = zy * zy; i++;
    }
    if (i >= maxIter) return maxIter;
    return i + 1 - Math.log(Math.log(Math.sqrt(zx2 + zy2))) / logP;
  }

  // ── Рендер одного прогресивного проходу ───────────────────────────────────
  // rs = render scale [0..1]. Повертає ImageData розміром ⌊W·rs⌋ × ⌊H·rs⌋.
  // Координатне перетворення: (px,py) — фізичний піксель; viewport.scale = фіз.px/unit.
  function renderPass(type, cx, cy, scale, W, H, maxIter, palFn, rs, juliaC, fp) {
    const sw = Math.max(1, Math.round(W * rs));
    const sh = Math.max(1, Math.round(H * rs));
    const id = new ImageData(sw, sh);
    const d = id.data;
    const [jcx, jcy] = juliaC;
    for (let py = 0; py < sh; py++) {
      const my = cy - (py / rs - H / 2) / scale;
      for (let px = 0; px < sw; px++) {
        const mx = cx + (px / rs - W / 2) / scale;
        let v;
        switch (type) {
          case 'julia':       v = iterCore(mx, my, jcx, jcy, maxIter); break;
          case 'burningship': v = iterCoreBurningShip(0, 0, mx, my, maxIter); break;
          case 'tricorn':     v = iterCoreTricorn(0, 0, mx, my, maxIter); break;
          case 'multibrot':   v = iterCoreMultibrot(0, 0, mx, my, maxIter, fp || 3); break;
          default:            v = iterCore(0, 0, mx, my, maxIter);
        }
        const [r, g, b] = palFn(v, maxIter);
        const i4 = (py * sw + px) * 4;
        d[i4] = r; d[i4 + 1] = g; d[i4 + 2] = b; d[i4 + 3] = 255;
      }
    }
    return id;
  }

  // ── Відмальовування ImageData → ctx ──────────────────────────────────────
  // putImageData ігнорує transform. Для full-res — прямо; для low-res — через offscreen.
  function paintId(ctx, id, W, H) {
    if (id.width === W && id.height === H) {
      ctx.putImageData(id, 0, 0);
    } else {
      const oc = document.createElement('canvas');
      oc.width = id.width; oc.height = id.height;
      oc.getContext('2d').putImageData(id, 0, 0);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(oc, 0, 0, W, H);
      ctx.restore();
    }
  }

  // ── LRU-кеш (full-quality рендери) ───────────────────────────────────────
  const _cache = new Map();
  const CACHE_MAX = 6;

  function cKey(type, cx, cy, scale, W, H, maxIter, pal, jc, fp) {
    return `${type}|${cx.toFixed(9)}|${cy.toFixed(9)}|${scale.toFixed(3)}|${W}|${H}|${maxIter}|${pal}|${jc}|${fp}`;
  }

  function cGet(k) { return _cache.get(k) || null; }

  function cSet(k, id) {
    if (_cache.size >= CACHE_MAX) _cache.delete(_cache.keys().next().value);
    _cache.set(k, id);
  }

  function clearCache() { _cache.clear(); _state.clear(); }

  // ── Abort-токен ───────────────────────────────────────────────────────────
  const _canvasIds = new WeakMap();
  let _canvasIdCtr = 0;
  function _sk(canvas, type, jcStr, fp, pal) {
    let id = _canvasIds.get(canvas);
    if (id === undefined) { id = ++_canvasIdCtr; _canvasIds.set(canvas, id); }
    return `${id}|${type}|${jcStr}|${fp}|${pal}`;
  }
  const STATE_MAX = 12;

  // ── Стан per-canvas (найкращий ImageData для поточного viewport) ──────────
  const _state = new Map(); // stateKey → { key, bestId, tok }

  // ── Головна функція render ────────────────────────────────────────────────
  /**
   * render({ ctx, canvas, viewport, type, juliaC, paletteId, isPanning, onRepaint })
   *
   * Потоки:
   *  1. Full-quality кеш → putImageData, return.
   *  2. Той самий viewport + є bestId → paintId(bestId), return (async продовжується).
   *  3. Новий viewport → abort попереднього токена, прогресивний рендер:
   *     isPanning=true → лише 1/4 (швидко).
   *     isPanning=false → 1/8→1/4→1/2→1.
   *  4. Перший прохід — синхронно (всередині _render, перед grid/axes).
   *     Решта — async; кожен виклик onRepaint() → _scheduleRender → _render → paintId(bestId) + grid/axes.
   */
  function render({ ctx, canvas, viewport, type, juliaC = [0, 0], fractalPower = 2, paletteId = 'smooth', isPanning = false, onRepaint }) {
    const W = canvas.width, H = canvas.height;
    const { cx, cy, scale } = viewport;
    const maxIter = adaptiveIter(scale);
    const palFn = PALETTE_FNS[paletteId] || PALETTE_FNS.smooth;
    const jcStr = juliaC.join(',');
    const key = cKey(type, cx, cy, scale, W, H, maxIter, paletteId, jcStr, fractalPower);
    const sk = _sk(canvas, type, jcStr, fractalPower, paletteId);

    // 1. Full-quality cache hit
    const cached = cGet(key);
    if (cached) { paintId(ctx, cached, W, H); return; }

    // 2. Той самий viewport — не перезапускаємо async
    const st = _state.get(sk);
    if (st && st.key === key && st.bestId) { paintId(ctx, st.bestId, W, H); return; }

    // 3. Новий viewport — per-fractal tok
    const myTok = (st ? st.tok : 0) + 1;
    const newSt = { key, bestId: null, tok: myTok };
    if (_state.size >= STATE_MAX) _state.delete(_state.keys().next().value);
    _state.set(sk, newSt);

    const passes = isPanning ? [0.25] : [0.125, 0.25, 0.5, 1];

    // Перший прохід синхронно — ще всередині _render(), тому НЕ викликаємо onRepaint.
    // Grid/axes будуть намальовані поверх після повернення зі _drawFractal.
    const firstId = renderPass(type, cx, cy, scale, W, H, maxIter, palFn, passes[0], juliaC, fractalPower);
    if (newSt.tok === myTok) {
      newSt.bestId = firstId;
      paintId(ctx, firstId, W, H);
    }

    // Решта проходів — асинхронно
    if (passes.length > 1) {
      (async () => {
        for (let i = 1; i < passes.length; i++) {
          await new Promise((r) => setTimeout(r, 0));
          if (newSt.tok !== myTok) return;
          const id = renderPass(type, cx, cy, scale, W, H, maxIter, palFn, passes[i], juliaC, fractalPower);
          if (newSt.tok !== myTok) return;
          newSt.bestId = id;
          if (passes[i] === 1) cSet(key, id);
          // onRepaint() → _scheduleRender() → rAF → _render():
          //   спочатку _drawFractal → paintId(bestId) [цей id],
          //   потім grid/axes/криві поверх. Без мерехтіння.
          if (onRepaint) onRepaint();
        }
      })();
    }
  }

  // ── Синхронний рендер у canvas (для thumbnail'ів галереї) ─────────────────
  function renderToCanvas(canvas, type, cx, cy, scale, juliaC, paletteId, fractalPower = 2) {
    const W = canvas.width, H = canvas.height;
    const maxIter = adaptiveIter(scale);
    const palFn = PALETTE_FNS[paletteId] || PALETTE_FNS.smooth;
    const id = renderPass(type, cx, cy, scale, W, H, maxIter, palFn, 1, juliaC || [0, 0], fractalPower);
    canvas.getContext('2d').putImageData(id, 0, 0);
  }

  window.FractalRenderer = {
    render,
    renderToCanvas,
    clearCache,
    adaptiveIter,
    PALETTE_FNS,
  };
})();

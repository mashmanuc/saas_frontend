// trig-solver.js — Trig equation & inequality solver with unit circle visualisation.
// Interactive cards for classroom demos: solve sin/cos/tan/cot equations and inequalities.
//
// Exposes: window.TrigEquation, window.TrigInequality
//
// Canvas layout (pure canvas, no SVG):
//   Left half:  unit circle with the value line + solution point highlights
//   Right half: solution text panel (exact form when special angle, decimal otherwise)
//
// Controls (slider, input, func selector, toggles) are in the Vue renderer template.
// Canvas is purely declarative — call setOption(k, v) to update, onChange fires after.
//
// Exact form coverage: 16 special angles (0°, 30°, 45°, 60°, 90° … 330°).
// Special sin/cos values: 0, ±½, ±√2/2, ±√3/2, ±1.

(function () {
  'use strict';

  const PAL = {
    bg:          '#fffaf0',
    gridMinor:   'rgba(43,33,24,0.05)',
    axis:        '#2b2118',
    circle:      '#1e293b',
    radius:      '#c4622a',
    sin:         '#a83a5b',
    cos:         '#3b7b9b',
    tan:         '#3a8a4f',
    cot:         '#7b6193',
    line:        '#64748b',    // y=a / x=a guide line
    lineDash:    '#94a3b8',
    pt:          '#c4622a',    // solution point on circle
    ptBorder:    '#fff',
    shadePos:    'rgba(58,138,79,0.22)',   // valid region (inequality)
    shadeNeg:    'rgba(168,58,91,0.12)',   // invalid region
    solTxt:      '#1e293b',
    solSub:      '#64748b',
    noSolTxt:    '#b91c1c',
    panelBorder: 'rgba(30,41,59,0.12)',
    panelBg:     'rgba(248,250,252,0.92)',
  };

  const TAU = Math.PI * 2;
  const HALF_PI = Math.PI / 2;

  // ── Special angles database (same 16 as trig-circle.js) ──────────────────
  const SPECIAL_ANGLES = [
    [  0,  0, 1], [ 30,  1, 6], [ 45,  1, 4], [ 60,  1, 3],
    [ 90,  1, 2], [120,  2, 3], [135,  3, 4], [150,  5, 6],
    [180,  1, 1], [210,  7, 6], [225,  5, 4], [240,  4, 3],
    [270,  3, 2], [300,  5, 3], [315,  7, 4], [330, 11, 6],
  ].map(([deg, num, den]) => {
    const rad = (deg / 180) * Math.PI;
    return { deg, num, den, rad, sin: Math.sin(rad), cos: Math.cos(rad) };
  });

  // ── Format helpers ────────────────────────────────────────────────────────

  /** Format a pi-fraction: (1,6)→'π/6', (2,3)→'2π/3', (1,1)→'π', (0,1)→'0' */
  function piFrac(num, den) {
    if (num === 0) return '0';
    const sgn = num < 0 ? '−' : '';
    const n = Math.abs(num);
    if (n === 1 && den === 1) return sgn + 'π';
    if (den === 1)             return sgn + n + 'π';
    if (n === 1)               return sgn + 'π/' + den;
    return sgn + n + 'π/' + den;
  }

  /** Match a normalised angle [0, 2π) to exact pi-fraction label. Returns null if not special. */
  function angleToExact(theta) {
    const t = ((theta % TAU) + TAU) % TAU;
    for (const sa of SPECIAL_ANGLES) {
      if (Math.abs(t - sa.rad) < 0.0008) return piFrac(sa.num, sa.den);
    }
    if (Math.abs(t - TAU) < 0.0008) return '2π';
    return null;
  }

  /** Match a sin/cos value to exact label. Returns null if not special. */
  function valToExact(v) {
    const T = 0.005;
    if (Math.abs(v) < T)                          return '0';
    if (Math.abs(Math.abs(v) - 1) < T)            return v > 0 ? '1' : '−1';
    if (Math.abs(Math.abs(v) - 0.5) < T)          return v > 0 ? '½' : '−½';
    if (Math.abs(Math.abs(v) - Math.SQRT2/2) < T) return v > 0 ? '√2/2' : '−√2/2';
    if (Math.abs(Math.abs(v) - Math.sqrt(3)/2) < T) return v > 0 ? '√3/2' : '−√3/2';
    return null;
  }

  function fmtVal(v) {
    return valToExact(v) ?? v.toFixed(2).replace('.', ',');
  }

  function normAngle(t) {
    return ((t % TAU) + TAU) % TAU;
  }

  /** Format angle for equation label (tries exact, falls back to decimal rad). */
  function fmtAngle(t) {
    return angleToExact(normAngle(t)) ?? normAngle(t).toFixed(2).replace('.', ',');
  }

  // ── Equation solving ──────────────────────────────────────────────────────

  /**
   * Solve func(x) = a.
   * Returns { angles, formula, noSolution, outOfRange, aLabel, oneFamily }
   *   angles: [{theta, label}] — solution points on unit circle in [0, 2π)
   *   formula: multi-line string with the general solution
   */
  function solveEquation(func, a) {
    const EPS = 0.0008;
    const aLabel = fmtVal(a);

    if (func === 'sin') {
      if (a > 1 + EPS || a < -1 - EPS) return { noSolution: true, outOfRange: true, aLabel };

      if (Math.abs(a - 1) < EPS) {
        return { angles: [{ theta: HALF_PI, label: 'π/2' }],
          formula: 'x = π/2 + 2πn, n ∈ ℤ', aLabel };
      }
      if (Math.abs(a + 1) < EPS) {
        return { angles: [{ theta: 3 * HALF_PI, label: '3π/2' }],
          formula: 'x = −π/2 + 2πn, n ∈ ℤ', aLabel };
      }
      if (Math.abs(a) < EPS) {
        return { angles: [{ theta: 0, label: '0' }, { theta: Math.PI, label: 'π' }],
          formula: 'x = πn, n ∈ ℤ', aLabel };
      }

      const t1 = Math.asin(a);             // in (−π/2, π/2)
      const t2 = Math.PI - t1;             // always in (π/2, 3π/2)
      const t1n = normAngle(t1);
      const t2n = normAngle(t2);
      const ex1 = fmtAngle(t1n);
      const ex2 = fmtAngle(t2n);
      return {
        angles: [{ theta: t1n, label: ex1 }, { theta: t2n, label: ex2 }],
        formula: `x₁ = ${ex1} + 2πn\nx₂ = ${ex2} + 2πn\n n ∈ ℤ`,
        aLabel,
      };
    }

    if (func === 'cos') {
      if (a > 1 + EPS || a < -1 - EPS) return { noSolution: true, outOfRange: true, aLabel };

      if (Math.abs(a - 1) < EPS) {
        return { angles: [{ theta: 0, label: '0' }],
          formula: 'x = 2πn, n ∈ ℤ', aLabel };
      }
      if (Math.abs(a + 1) < EPS) {
        return { angles: [{ theta: Math.PI, label: 'π' }],
          formula: 'x = π + 2πn, n ∈ ℤ', aLabel };
      }
      if (Math.abs(a) < EPS) {
        return { angles: [{ theta: HALF_PI, label: 'π/2' }, { theta: 3*HALF_PI, label: '3π/2' }],
          formula: 'x = π/2 + πn, n ∈ ℤ', aLabel };
      }

      const t1 = Math.acos(a);    // in (0, π)
      const t2 = TAU - t1;        // in (π, 2π)
      const ex1 = fmtAngle(t1);
      return {
        angles: [{ theta: t1, label: ex1 }, { theta: t2, label: '−' + ex1 }],
        formula: `x = ±${ex1} + 2πn\n n ∈ ℤ`,
        aLabel,
      };
    }

    if (func === 'tan') {
      const t1  = normAngle(Math.atan(a));
      const t2  = normAngle(t1 + Math.PI);
      const ex1 = fmtAngle(t1);
      return {
        angles: [{ theta: t1, label: ex1 }, { theta: t2, label: ex1 + '+π' }],
        formula: `x = ${ex1} + πn\n n ∈ ℤ`,
        aLabel,
        oneFamily: true,
      };
    }

    if (func === 'cot') {
      // cot(x) = a  ↔  x = π/2 − arctan(a) + πn
      const base = Math.abs(a) < 0.0001
        ? HALF_PI
        : HALF_PI - Math.atan(a);
      const t1  = normAngle(base);
      const t2  = normAngle(t1 + Math.PI);
      const ex1 = fmtAngle(t1);
      return {
        angles: [{ theta: t1, label: ex1 }, { theta: t2, label: ex1 + '+π' }],
        formula: `x = ${ex1} + πn\n n ∈ ℤ`,
        aLabel,
        oneFamily: true,
      };
    }

    return { noSolution: true, aLabel };
  }

  // ── Inequality solving ────────────────────────────────────────────────────

  /**
   * Solve func(x) sign a.
   * Returns { arcStart, arcEnd, arcWrap, intervalStr, noSolution, noSolutionUniversal, aLabel }
   *   arcStart, arcEnd: start and end angles for the valid arc in [0, 2π)
   *   arcWrap: if true, the valid arc passes through 0 (wraps around)
   */
  function solveInequality(func, sign, a) {
    const EPS = 0.0008;
    const aLabel = fmtVal(a);
    const strict = sign === '>' || sign === '<';
    const upper  = sign === '>' || sign === '≥';
    const bracket = (open, close, s, e) =>
      `x ∈ ${open}${s} + 2πn; ${e} + 2πn${close}, n ∈ ℤ`;

    if (func === 'sin') {
      // sin(x) > a: arc from arcsin(a) to π−arcsin(a) (upper half)
      if (a >= 1 - EPS) {
        if (upper) {
          if (strict) return { noSolution: true, aLabel };
          return { point: HALF_PI, intervalStr: 'x = π/2 + 2πn, n ∈ ℤ', aLabel, isPoint: true };
        } else {
          return { arcStart: 0, arcEnd: TAU, arcFull: true,
            intervalStr: 'x ∈ ℝ (усі дійсні)', aLabel };
        }
      }
      if (a <= -1 + EPS) {
        if (!upper) {
          if (strict) return { noSolution: true, aLabel };
          return { point: 3*HALF_PI, intervalStr: 'x = −π/2 + 2πn, n ∈ ℤ', aLabel, isPoint: true };
        } else {
          return { arcStart: 0, arcEnd: TAU, arcFull: true,
            intervalStr: 'x ∈ ℝ (усі дійсні)', aLabel };
        }
      }

      const t1 = normAngle(Math.asin(a));      // arcsin(a) ∈ [0, π/2] for a≥0; or [3π/2, 2π) for a<0
      const t2 = normAngle(Math.PI - Math.asin(a)); // π−arcsin(a) ∈ [π/2, π]

      const ex1 = fmtAngle(t1);
      const ex2 = fmtAngle(t2);
      const ob = strict ? '(' : '[';
      const cb = strict ? ')' : ']';

      if (upper) {
        // sin(x) ≥ a: arc from t1 to t2 going counterclockwise (upper arc)
        return {
          arcStart: t1, arcEnd: t2, arcWrap: false,
          intervalStr: `x ∈ ${ob}${ex1} + 2πn; ${ex2} + 2πn${cb}, n ∈ ℤ`,
          aLabel,
        };
      } else {
        // sin(x) ≤ a: arc from t2 to t1+2π going counterclockwise (lower arc)
        return {
          arcStart: t2, arcEnd: t1, arcWrap: true,
          intervalStr: `x ∈ ${ob}${ex2} + 2πn; ${ex1} + 2π(n+1)${cb}, n ∈ ℤ`,
          aLabel,
        };
      }
    }

    if (func === 'cos') {
      // cos(x) > a: arc from −arccos(a) to arccos(a) (right arc, passes through 0)
      if (a >= 1 - EPS) {
        if (upper) {
          if (strict) return { noSolution: true, aLabel };
          return { point: 0, intervalStr: 'x = 2πn, n ∈ ℤ', aLabel, isPoint: true };
        } else {
          return { arcStart: 0, arcEnd: TAU, arcFull: true, intervalStr: 'x ∈ ℝ', aLabel };
        }
      }
      if (a <= -1 + EPS) {
        if (!upper) {
          if (strict) return { noSolution: true, aLabel };
          return { point: Math.PI, intervalStr: 'x = π + 2πn, n ∈ ℤ', aLabel, isPoint: true };
        } else {
          return { arcStart: 0, arcEnd: TAU, arcFull: true, intervalStr: 'x ∈ ℝ', aLabel };
        }
      }

      const t1 = Math.acos(a);          // in (0, π)
      const t2 = normAngle(-t1);        // = 2π − t1
      const ex1 = fmtAngle(t1);
      const ob = strict ? '(' : '[';
      const cb = strict ? ')' : ']';

      if (upper) {
        // cos(x) ≥ a: arc from −t1 to t1 (passes through 0)
        return {
          arcStart: t2, arcEnd: t1, arcWrap: true,
          intervalStr: `x ∈ ${ob}−${ex1} + 2πn; ${ex1} + 2πn${cb}, n ∈ ℤ`,
          aLabel,
        };
      } else {
        return {
          arcStart: t1, arcEnd: t2, arcWrap: false,
          intervalStr: `x ∈ ${ob}${ex1} + 2πn; −${ex1} + 2π(n+1)${cb}, n ∈ ℤ`,
          aLabel,
        };
      }
    }

    if (func === 'tan') {
      // tan(x) > a: arc from arctan(a) to π/2 (the valid part in one period)
      const t1 = normAngle(Math.atan(a));
      const ex1 = fmtAngle(t1);
      const ob = strict ? '(' : '[';
      const cb = strict ? ')' : ']';

      if (upper) {
        // tan(x) > a in (arctan(a), π/2) + πn
        return {
          arcStart: t1, arcEnd: normAngle(HALF_PI - 0.001), arcWrap: false,
          tanBound: true, // special marker: arc stops at π/2 asymptote
          intervalStr: `x ∈ ${ob}${ex1} + πn; π/2 + πn${cb}, n ∈ ℤ`,
          aLabel,
        };
      } else {
        return {
          arcStart: normAngle(HALF_PI + 0.001 + Math.PI), arcEnd: normAngle(t1 + Math.PI), arcWrap: false,
          tanBound: true,
          intervalStr: `x ∈ ${ob}−π/2 + πn; ${ex1} + πn${cb}, n ∈ ℤ`,
          aLabel,
        };
      }
    }

    if (func === 'cot') {
      const base = Math.abs(a) < 0.0001 ? HALF_PI : HALF_PI - Math.atan(a);
      const t1 = normAngle(base);
      const ex1 = fmtAngle(t1);
      const ob = strict ? '(' : '[';
      const cb = strict ? ')' : ']';

      if (upper) {
        return {
          arcStart: normAngle(0.001), arcEnd: t1, arcWrap: false,
          cotBound: true,
          intervalStr: `x ∈ ${ob}0 + πn; ${ex1} + πn${cb}, n ∈ ℤ`,
          aLabel,
        };
      } else {
        return {
          arcStart: t1, arcEnd: normAngle(Math.PI - 0.001), arcWrap: false,
          cotBound: true,
          intervalStr: `x ∈ ${ob}${ex1} + πn; π + πn${cb}, n ∈ ℤ`,
          aLabel,
        };
      }
    }

    return { noSolution: true, aLabel };
  }

  // ── Shared canvas drawing helpers ─────────────────────────────────────────

  /** Draw unit circle axes + circle. cx,cy = center; R = radius. */
  function drawBaseCircle(ctx, cx, cy, R, dpr) {
    const lw = dpr < 2 ? 1 : 1.5;

    // Background
    ctx.fillStyle = PAL.bg;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Fine grid
    ctx.save();
    ctx.strokeStyle = PAL.gridMinor;
    ctx.lineWidth = lw * 0.5;
    for (let i = -1; i <= 1; i += 0.5) {
      if (i === 0) continue;
      ctx.beginPath();
      ctx.moveTo(cx + i * R, cy - R - 12);
      ctx.lineTo(cx + i * R, cy + R + 12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - R - 12, cy - i * R);
      ctx.lineTo(cx + R + 12, cy - i * R);
      ctx.stroke();
    }
    ctx.restore();

    // Axes
    ctx.save();
    ctx.strokeStyle = PAL.axis;
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(cx - R - 18, cy); ctx.lineTo(cx + R + 18, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - R - 18); ctx.lineTo(cx, cy + R + 18); ctx.stroke();
    // Axis labels
    ctx.fillStyle = PAL.axis;
    ctx.font = `${Math.round(11 * dpr)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('1', cx + R, cy + 4);
    ctx.fillText('−1', cx - R, cy + 4);
    ctx.textAlign = 'left';
    ctx.fillText('1', cx + 4, cy - R - 16);
    ctx.fillText('−1', cx + 4, cy + R + 2);
    ctx.restore();

    // Unit circle
    ctx.save();
    ctx.strokeStyle = PAL.circle;
    ctx.lineWidth = lw * 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw a guide line for sin/cos/tan/cot.
   * For sin: horizontal at y = a (canvas: cy - a*R)
   * For cos: vertical at x = a (canvas: cx + a*R)
   * For tan: vertical tangent line + point (1, a)
   * For cot: horizontal cotangent line + point (a, 1)
   */
  function drawGuideLine(ctx, cx, cy, R, func, a, color, dpr) {
    const lw = dpr < 2 ? 1.2 : 1.8;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.setLineDash([5 * dpr, 4 * dpr]);

    const half = R + 24;

    if (func === 'sin') {
      const yl = cy - a * R;
      if (yl < cy - R - 20 || yl > cy + R + 20) { ctx.restore(); return; }
      ctx.beginPath();
      ctx.moveTo(cx - half, yl);
      ctx.lineTo(cx + half, yl);
      ctx.stroke();
      // value label
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.font = `bold ${Math.round(10 * dpr)}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('a = ' + fmtVal(a), cx + R + 8, yl);
    } else if (func === 'cos') {
      const xl = cx + a * R;
      if (xl < cx - R - 20 || xl > cx + R + 20) { ctx.restore(); return; }
      ctx.beginPath();
      ctx.moveTo(xl, cy - half);
      ctx.lineTo(xl, cy + half);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.font = `bold ${Math.round(10 * dpr)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('a = ' + fmtVal(a), xl, cy + R + 6);
    } else if (func === 'tan') {
      // tangent line: vertical at x = R
      const xt = cx + R;
      const yt = cy - a * R;
      ctx.beginPath();
      ctx.moveTo(xt, cy - R * 2.2);
      ctx.lineTo(xt, cy + R * 2.2);
      ctx.stroke();
      ctx.restore(); ctx.save();
      // ray from origin to tangent point
      ctx.strokeStyle = color;
      ctx.lineWidth = lw * 0.8;
      ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      if (Math.abs(a) < 50) { ctx.lineTo(xt, yt); } else { ctx.lineTo(xt, cy - Math.sign(a) * R * 1.8); }
      ctx.stroke();
      ctx.setLineDash([]);
      // tangent point
      if (Math.abs(a) <= R / dpr * 0.8 || true) {
        const realYt = Math.abs(yt - cy) < R * 2 ? yt : cy - Math.sign(a) * R * 1.5;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(xt, realYt, 3.5 * dpr, 0, TAU);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.font = `bold ${Math.round(10 * dpr)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('T(1; ' + fmtVal(a) + ')', xt + 6, realYt);
      }
    } else if (func === 'cot') {
      // cotangent line: horizontal at y = R
      const yt = cy - R;
      const xt = cx + a * R;
      ctx.beginPath();
      ctx.moveTo(cx - R * 2.2, yt);
      ctx.lineTo(cx + R * 2.2, yt);
      ctx.stroke();
      ctx.restore(); ctx.save();
      // ray from origin
      ctx.strokeStyle = color;
      ctx.lineWidth = lw * 0.8;
      ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      if (Math.abs(a) < 50) { ctx.lineTo(xt, yt); }
      ctx.stroke();
      ctx.setLineDash([]);
      if (Math.abs(xt - cx) < R * 2.5) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(xt, yt, 3.5 * dpr, 0, TAU);
        ctx.fill();
        ctx.font = `bold ${Math.round(10 * dpr)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('T(' + fmtVal(a) + '; 1)', xt, yt - 4);
      }
    }

    ctx.restore();
  }

  /** Draw a solution point on the circle with its angle label. */
  function drawSolutionPoint(ctx, cx, cy, R, theta, label, color, dpr) {
    const px = cx + R * Math.cos(theta);
    const py = cy - R * Math.sin(theta);   // canvas y-flip

    // Radius line
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = dpr < 2 ? 1.2 : 1.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.stroke();

    // Arc from 0 to theta (short arc indicator)
    const arcR = R * 0.28;
    ctx.strokeStyle = color;
    ctx.lineWidth = dpr < 2 ? 1 : 1.4;
    ctx.beginPath();
    ctx.arc(cx, cy, arcR, 0, -theta, theta < 0);
    ctx.stroke();

    // Point
    ctx.beginPath();
    ctx.arc(px, py, 5 * dpr, 0, TAU);
    ctx.fillStyle = PAL.ptBorder;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py, 4 * dpr, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();

    // Angle label
    const lx = cx + (R + 20) * Math.cos(theta);
    const ly = cy - (R + 20) * Math.sin(theta);
    ctx.font = `bold ${Math.round(11 * dpr)}px sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = lx > cx + R * 0.3 ? 'left' : lx < cx - R * 0.3 ? 'right' : 'center';
    ctx.textBaseline = ly < cy ? 'bottom' : 'top';
    ctx.fillText(label, lx, ly);

    ctx.restore();
  }

  /** Render the solution panel (right half of canvas). */
  function drawSolutionPanel(ctx, px, py, pw, ph, lines, color, dpr) {
    // Panel bg
    ctx.save();
    ctx.fillStyle = PAL.panelBg;
    ctx.strokeStyle = PAL.panelBorder;
    ctx.lineWidth = dpr < 2 ? 0.8 : 1;
    const pad = 12 * dpr;
    const rx = px + pad * 0.5;
    const ry = py + pad * 0.5;
    const rw = pw - pad;
    const rh = ph - pad;
    roundRect(ctx, rx, ry, rw, rh, 8 * dpr);
    ctx.fill();
    ctx.stroke();

    // Title
    const titleSize = Math.round(11 * dpr);
    const bodySize  = Math.round(13 * dpr);
    const lineH     = bodySize * 1.6;
    let ty = ry + pad + titleSize;

    ctx.fillStyle = PAL.solSub;
    ctx.font = `${titleSize}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Відповідь:', rx + pad, ty);
    ty += lineH;

    // Body lines
    ctx.fillStyle = color;
    ctx.font = `bold ${bodySize}px sans-serif`;
    for (const line of lines) {
      if (!line) continue;
      // Sub-lines (formula has \n)
      const subLines = line.split('\n');
      for (const sl of subLines) {
        ctx.fillText(sl.trim(), rx + pad, ty);
        ty += lineH;
      }
    }
    ctx.restore();
  }

  /** Polyfill-style roundRect */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /** Pick colour for func. */
  function funcColor(func) {
    return { sin: PAL.sin, cos: PAL.cos, tan: PAL.tan, cot: PAL.cot }[func] || PAL.sin;
  }

  // ── TrigEquation ──────────────────────────────────────────────────────────

  class TrigEquation {
    constructor(container, opts = {}) {
      this.container = container;
      this.opts = Object.assign({
        func:        'sin',  // 'sin' | 'cos' | 'tan' | 'cot'
        value:       0.5,    // a — right-hand side value
        showFormula: true,
        showAngles:  true,
      }, opts);

      this._canvas = document.createElement('canvas');
      this._canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
      this.container.innerHTML = '';
      this.container.appendChild(this._canvas);

      this._dpr = window.devicePixelRatio || 1;
      this._ro = new ResizeObserver(() => { this._resize(); this._draw(); });
      this._ro.observe(this.container);
      this._resize();
      this._draw();
    }

    setOption(k, v) {
      if (this._destroyed) return;
      this.opts[k] = v;
      this._draw();
      if (this.onChange) this.onChange();
    }

    destroy() {
      if (this._destroyed) return;
      this._destroyed = true;
      if (this._ro) this._ro.disconnect();
    }

    _resize() {
      const W = this.container.clientWidth  || 480;
      const H = this.container.clientHeight || 320;
      const dpr = this._dpr;
      this._canvas.width  = Math.round(W * dpr);
      this._canvas.height = Math.round(H * dpr);
      this._W = W; this._H = H;
    }

    _draw() {
      if (this._destroyed) return;
      const canvas = this._canvas;
      const ctx    = canvas.getContext('2d');
      const dpr    = this._dpr;
      const W      = canvas.width;
      const H      = canvas.height;
      const { func, value, showFormula } = this.opts;

      ctx.clearRect(0, 0, W, H);

      // Layout: left half = circle, right half = solutions
      const circleW = W * 0.52;
      const solveW  = W - circleW;

      // Circle geometry
      const margin = 40 * dpr;
      const R = Math.min(circleW / 2 - margin, H / 2 - margin * 0.8);
      const cx = circleW / 2;
      const cy = H / 2;

      drawBaseCircle(ctx, cx, cy, R, dpr);

      const color = funcColor(func);
      drawGuideLine(ctx, cx, cy, R, func, value, color, dpr);

      // Solve + draw solution points
      const sol = solveEquation(func, value);

      if (!sol.noSolution && sol.angles) {
        for (const { theta, label } of sol.angles) {
          drawSolutionPoint(ctx, cx, cy, R, theta, label, color, dpr);
        }
      }

      // Solution panel
      if (showFormula) {
        const panelLines = sol.noSolution
          ? [sol.outOfRange ? '|a| > 1 — розв\'язків немає' : 'Немає розв\'язків']
          : [sol.formula];
        drawSolutionPanel(ctx, circleW, 0, solveW, H, panelLines,
          sol.noSolution ? PAL.noSolTxt : color, dpr);
      }

      // Equation title in top-left of circle panel
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = `bold ${Math.round(12 * dpr)}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const eqLabel = `${func}(x) = ${sol.aLabel ?? fmtVal(value)}`;
      ctx.fillText(eqLabel, 8 * dpr, 6 * dpr);
      ctx.restore();
    }
  }

  // ── TrigInequality ────────────────────────────────────────────────────────

  class TrigInequality {
    constructor(container, opts = {}) {
      this.container = container;
      this.opts = Object.assign({
        func:  'sin',    // 'sin' | 'cos' | 'tan' | 'cot'
        sign:  '>',      // '>' | '<' | '≥' | '≤'
        value: 0.5,
        showInterval: true,
      }, opts);

      this._canvas = document.createElement('canvas');
      this._canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
      this.container.innerHTML = '';
      this.container.appendChild(this._canvas);

      this._dpr = window.devicePixelRatio || 1;
      this._ro = new ResizeObserver(() => { this._resize(); this._draw(); });
      this._ro.observe(this.container);
      this._resize();
      this._draw();
    }

    setOption(k, v) {
      if (this._destroyed) return;
      this.opts[k] = v;
      this._draw();
      if (this.onChange) this.onChange();
    }

    destroy() {
      if (this._destroyed) return;
      this._destroyed = true;
      if (this._ro) this._ro.disconnect();
    }

    _resize() {
      const W = this.container.clientWidth  || 480;
      const H = this.container.clientHeight || 320;
      const dpr = this._dpr;
      this._canvas.width  = Math.round(W * dpr);
      this._canvas.height = Math.round(H * dpr);
      this._W = W; this._H = H;
    }

    _draw() {
      if (this._destroyed) return;
      const canvas = this._canvas;
      const ctx    = canvas.getContext('2d');
      const dpr    = this._dpr;
      const W      = canvas.width;
      const H      = canvas.height;
      const { func, sign, value, showInterval } = this.opts;

      ctx.clearRect(0, 0, W, H);

      const circleW = W * 0.52;
      const solveW  = W - circleW;
      const margin  = 40 * dpr;
      const R = Math.min(circleW / 2 - margin, H / 2 - margin * 0.8);
      const cx = circleW / 2;
      const cy = H / 2;

      drawBaseCircle(ctx, cx, cy, R, dpr);

      const color = funcColor(func);
      drawGuideLine(ctx, cx, cy, R, func, value, color, dpr);

      const ineq = solveInequality(func, sign, value);

      // Draw shaded arc for valid region
      if (!ineq.noSolution && !ineq.isPoint) {
        this._drawShade(ctx, cx, cy, R, ineq, color, dpr);
      }
      if (ineq.isPoint) {
        drawSolutionPoint(ctx, cx, cy, R, ineq.point,
          fmtAngle(ineq.point), color, dpr);
      }

      // Interval panel
      if (showInterval) {
        const panelLines = ineq.noSolution
          ? ['Немає розв\'язків']
          : [ineq.intervalStr];
        drawSolutionPanel(ctx, circleW, 0, solveW, H, panelLines,
          ineq.noSolution ? PAL.noSolTxt : color, dpr);
      }

      // Inequality title
      ctx.save();
      ctx.fillStyle = color;
      ctx.font = `bold ${Math.round(12 * dpr)}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${func}(x) ${sign} ${ineq.aLabel ?? fmtVal(value)}`, 8 * dpr, 6 * dpr);
      ctx.restore();
    }

    _drawShade(ctx, cx, cy, R, ineq, color, dpr) {
      ctx.save();

      if (ineq.arcFull) {
        // Full circle — shade everything
        ctx.fillStyle = PAL.shadePos;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, TAU);
        ctx.fill();
        ctx.restore();
        return;
      }

      const { arcStart, arcEnd, arcWrap } = ineq;

      // Convert math angles to canvas angles (canvas: clockwise, y-down)
      // math angle θ → canvas angle = -θ (since canvas y increases downward)
      const canvasArcStart = -arcStart;
      const canvasArcEnd   = -arcEnd;

      ctx.fillStyle = PAL.shadePos;

      // Draw a "pie" arc sector
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      if (arcWrap) {
        // Arc wraps through 0 — goes from arcStart counter-clockwise past 2π to arcEnd
        // In canvas terms: goes clockwise from -arcStart to -arcEnd
        ctx.arc(cx, cy, R, canvasArcStart, canvasArcEnd, false);
      } else {
        // Straight arc from arcStart to arcEnd (counter-clockwise in math = clockwise in canvas)
        ctx.arc(cx, cy, R, canvasArcStart, canvasArcEnd, false);
      }
      ctx.closePath();
      ctx.fill();

      // Border arcs
      ctx.strokeStyle = color;
      ctx.lineWidth = dpr < 2 ? 2 : 3;
      ctx.beginPath();
      ctx.arc(cx, cy, R, canvasArcStart, canvasArcEnd, arcWrap);
      ctx.stroke();

      // Endpoint dots
      const pts = [arcStart, arcEnd];
      const strict = ineq.intervalStr && (ineq.intervalStr.includes('(') || ineq.intervalStr.startsWith('x ∈ ('));
      for (const t of pts) {
        const px = cx + R * Math.cos(t);
        const py = cy - R * Math.sin(t);
        ctx.beginPath();
        ctx.arc(px, py, 4.5 * dpr, 0, TAU);
        ctx.fillStyle = strict ? PAL.bg : color;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = dpr < 2 ? 1.5 : 2;
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // ── Expose ────────────────────────────────────────────────────────────────
  window.TrigEquation   = TrigEquation;
  window.TrigInequality = TrigInequality;

})();

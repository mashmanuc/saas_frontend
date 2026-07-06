/* ═══════════════════════════════════════════════════════════
   StereoMASH — analysis.js (ТЗ v3 §A5)
   Величини та формули для 23 шаблонів двигуна: V, S, кути, радіуси.
   window.StereoAnalysis.get(templateKey, params) →
     [{ q: 'V', expr: 'V = a³ = 2.20³ = 10.65', value: 10.65 }]
   q-ключі — лейбли через i18n mash.stereo.analysis.q.*
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const PI = Math.PI, sqrt = Math.sqrt, atan = Math.atan, tan = Math.tan, sin = Math.sin;
  const F = (v) => {
    if (!isFinite(v)) return '—';
    const a = Math.abs(v);
    const d = a >= 100 ? 1 : a >= 10 ? 2 : 3;
    return (Math.round(v * 10 ** d) / 10 ** d).toString();
  };
  const DEG = (rad) => F(rad * 180 / PI) + '°';
  const Q = (q, expr, value) => ({ q, expr, value });

  // Правильний n-кутник: r вписаного, R описаного, площа
  const ngon = (n, a) => {
    const r = a / (2 * tan(PI / n)), R = a / (2 * sin(PI / n));
    return { r, R, S: n * a * r / 2 };
  };

  const T = {
    cube({ a }) {
      return [
        Q('V', `V = a³ = ${F(a)}³ = ${F(a ** 3)}`, a ** 3),
        Q('Stot', `S = 6a² = ${F(6 * a * a)}`, 6 * a * a),
        Q('dBody', `d = a√3 = ${F(a * sqrt(3))}`, a * sqrt(3)),
        Q('dFace', `d₁ = a√2 = ${F(a * sqrt(2))}`, a * sqrt(2)),
        Q('rIn', `r = a/2 = ${F(a / 2)}`, a / 2),
        Q('RCirc', `R = a√3/2 = ${F(a * sqrt(3) / 2)}`, a * sqrt(3) / 2),
      ];
    },
    cuboid({ a, b, c }) {
      return [
        Q('V', `V = abc = ${F(a)}·${F(b)}·${F(c)} = ${F(a * b * c)}`, a * b * c),
        Q('Stot', `S = 2(ab+bc+ac) = ${F(2 * (a * b + b * c + a * c))}`, 2 * (a * b + b * c + a * c)),
        Q('dBody', `d = √(a²+b²+c²) = ${F(sqrt(a * a + b * b + c * c))}`, sqrt(a * a + b * b + c * c)),
      ];
    },
    pyramid4({ a, h }) {
      const m = sqrt(h * h + (a / 2) ** 2), l = sqrt(h * h + a * a / 2);
      return [
        Q('Sbase', `S_осн = a² = ${F(a * a)}`, a * a),
        Q('V', `V = ⅓a²h = ⅓·${F(a * a)}·${F(h)} = ${F(a * a * h / 3)}`, a * a * h / 3),
        Q('apothem', `m = √(h²+(a/2)²) = ${F(m)}`, m),
        Q('slant', `l = √(h²+a²/2) = ${F(l)}`, l),
        Q('Slat', `S_біч = 2am = ${F(2 * a * m)}`, 2 * a * m),
        Q('Stot', `S = S_біч + a² = ${F(2 * a * m + a * a)}`, 2 * a * m + a * a),
        Q('angleFace', `∠(грань,осн) = arctg(2h/a) = ${DEG(atan(h / (a / 2)))}`, atan(h / (a / 2))),
        Q('angleEdge', `∠(ребро,осн) = arctg(h√2/a) = ${DEG(atan(h / (a * sqrt(2) / 2)))}`, atan(h / (a * sqrt(2) / 2))),
      ];
    },
    pyramid3({ a, h }) {
      const r = a / (2 * sqrt(3)), R = a / sqrt(3), Sb = sqrt(3) / 4 * a * a, m = sqrt(h * h + r * r);
      return [
        Q('Sbase', `S_осн = a²√3/4 = ${F(Sb)}`, Sb),
        Q('V', `V = ⅓S_осн·h = ${F(Sb * h / 3)}`, Sb * h / 3),
        Q('rIn', `r = a/(2√3) = ${F(r)}`, r),
        Q('RCirc', `R = a/√3 = ${F(R)}`, R),
        Q('apothem', `m = √(h²+r²) = ${F(m)}`, m),
        Q('Slat', `S_біч = 3·am/2 = ${F(3 * a * m / 2)}`, 3 * a * m / 2),
        Q('angleFace', `∠(грань,осн) = arctg(h/r) = ${DEG(atan(h / r))}`, atan(h / r)),
        Q('angleEdge', `∠(ребро,осн) = arctg(h/R) = ${DEG(atan(h / R))}`, atan(h / R)),
      ];
    },
    prism4({ a, h }) {
      return [
        Q('V', `V = a²h = ${F(a * a * h)}`, a * a * h),
        Q('Slat', `S_біч = 4ah = ${F(4 * a * h)}`, 4 * a * h),
        Q('Stot', `S = 4ah + 2a² = ${F(4 * a * h + 2 * a * a)}`, 4 * a * h + 2 * a * a),
        Q('dBody', `d = √(2a²+h²) = ${F(sqrt(2 * a * a + h * h))}`, sqrt(2 * a * a + h * h)),
      ];
    },
    prism6({ a, h }) {
      const Sb = 3 * sqrt(3) / 2 * a * a;
      return [
        Q('Sbase', `S_осн = 3√3a²/2 = ${F(Sb)}`, Sb),
        Q('V', `V = S_осн·h = ${F(Sb * h)}`, Sb * h),
        Q('Slat', `S_біч = 6ah = ${F(6 * a * h)}`, 6 * a * h),
        Q('dSmall', `d_мала = a√3 = ${F(a * sqrt(3))}`, a * sqrt(3)),
        Q('dBig', `d_велика = 2a = ${F(2 * a)}`, 2 * a),
        Q('dBody', `D = √(4a²+h²) = ${F(sqrt(4 * a * a + h * h))}`, sqrt(4 * a * a + h * h)),
      ];
    },
    pyramid6({ a, h }) {
      const r = a * sqrt(3) / 2, Sb = 3 * sqrt(3) / 2 * a * a, m = sqrt(h * h + r * r);
      return [
        Q('Sbase', `S_осн = 3√3a²/2 = ${F(Sb)}`, Sb),
        Q('V', `V = ⅓S_осн·h = ${F(Sb * h / 3)}`, Sb * h / 3),
        Q('rIn', `r = a√3/2 = ${F(r)}`, r),
        Q('RCirc', `R = a = ${F(a)}`, a),
        Q('apothem', `m = √(h²+r²) = ${F(m)}`, m),
        Q('Slat', `S_біч = 3am = ${F(3 * a * m)}`, 3 * a * m),
        Q('angleFace', `∠(грань,осн) = arctg(h/r) = ${DEG(atan(h / r))}`, atan(h / r)),
      ];
    },
    ngonPyramid({ n, a, h }) {
      n = Math.round(n);
      const { r, R, S } = ngon(n, a), m = sqrt(h * h + r * r);
      return [
        Q('Sbase', `S_осн = n·a·r/2 = ${F(S)}`, S),
        Q('V', `V = ⅓S_осн·h = ${F(S * h / 3)}`, S * h / 3),
        Q('rIn', `r = a/(2tg(π/${n})) = ${F(r)}`, r),
        Q('RCirc', `R = a/(2sin(π/${n})) = ${F(R)}`, R),
        Q('apothem', `m = √(h²+r²) = ${F(m)}`, m),
        Q('Slat', `S_біч = n·a·m/2 = ${F(n * a * m / 2)}`, n * a * m / 2),
      ];
    },
    ngonPrism({ n, a, h }) {
      n = Math.round(n);
      const { r, R, S } = ngon(n, a);
      return [
        Q('Sbase', `S_осн = n·a·r/2 = ${F(S)}`, S),
        Q('V', `V = S_осн·h = ${F(S * h)}`, S * h),
        Q('Slat', `S_біч = n·a·h = ${F(n * a * h)}`, n * a * h),
        Q('rIn', `r = ${F(r)}`, r),
        Q('RCirc', `R = ${F(R)}`, R),
      ];
    },
    tetrahedron({ a }) {
      const h = a * sqrt(2 / 3);
      return [
        Q('V', `V = a³√2/12 = ${F(a ** 3 * sqrt(2) / 12)}`, a ** 3 * sqrt(2) / 12),
        Q('Stot', `S = a²√3 = ${F(a * a * sqrt(3))}`, a * a * sqrt(3)),
        Q('height', `h = a√(2/3) = ${F(h)}`, h),
        Q('rIn', `r = a/(2√3) = ${F(a / (2 * sqrt(3)))}`, a / (2 * sqrt(3))),
        Q('RCirc', `R = a/√3 = ${F(a / sqrt(3))}`, a / sqrt(3)),
      ];
    },
    frustumPyramid4({ a, b, h }) {
      const m = sqrt(h * h + ((a - b) / 2) ** 2);
      const V = h / 3 * (a * a + a * b + b * b);
      return [
        Q('V', `V = h/3·(a²+ab+b²) = ${F(V)}`, V),
        Q('apothem', `m = √(h²+((a−b)/2)²) = ${F(m)}`, m),
        Q('Slat', `S_біч = 2(a+b)m = ${F(2 * (a + b) * m)}`, 2 * (a + b) * m),
        Q('Stot', `S = S_біч + a² + b² = ${F(2 * (a + b) * m + a * a + b * b)}`, 2 * (a + b) * m + a * a + b * b),
      ];
    },
    obliquePrism4({ a, h, tx, tz }) {
      const l = sqrt(h * h + tx * tx + tz * tz);
      return [
        Q('V', `V = a²·h = ${F(a * a * h)}`, a * a * h),
        Q('lateral', `l = √(h²+Δx²+Δz²) = ${F(l)}`, l),
      ];
    },
    cylinder({ r, h }) {
      return [
        Q('V', `V = πr²h = π·${F(r * r)}·${F(h)} = ${F(PI * r * r * h)}`, PI * r * r * h),
        Q('Slat', `S_біч = 2πrh = ${F(2 * PI * r * h)}`, 2 * PI * r * h),
        Q('Stot', `S = 2πr(r+h) = ${F(2 * PI * r * (r + h))}`, 2 * PI * r * (r + h)),
        Q('dAx', `d_перерізу = √(4r²+h²) = ${F(sqrt(4 * r * r + h * h))}`, sqrt(4 * r * r + h * h)),
      ];
    },
    cone({ r, h }) {
      const l = sqrt(r * r + h * h);
      return [
        Q('slant', `l = √(r²+h²) = ${F(l)}`, l),
        Q('V', `V = ⅓πr²h = ${F(PI * r * r * h / 3)}`, PI * r * r * h / 3),
        Q('Slat', `S_біч = πrl = ${F(PI * r * l)}`, PI * r * l),
        Q('Stot', `S = πr(l+r) = ${F(PI * r * (l + r))}`, PI * r * (l + r)),
        Q('angleSlant', `∠(твірна,осн) = arctg(h/r) = ${DEG(atan(h / r))}`, atan(h / r)),
      ];
    },
    sphere({ r }) {
      return [
        Q('V', `V = 4πR³/3 = ${F(4 / 3 * PI * r ** 3)}`, 4 / 3 * PI * r ** 3),
        Q('Stot', `S = 4πR² = ${F(4 * PI * r * r)}`, 4 * PI * r * r),
      ];
    },
    frustumCone({ r1, r2, h }) {
      const l = sqrt(h * h + (r1 - r2) ** 2);
      const V = PI * h / 3 * (r1 * r1 + r1 * r2 + r2 * r2);
      return [
        Q('V', `V = πh/3·(R²+Rr+r²) = ${F(V)}`, V),
        Q('slant', `l = √(h²+(R−r)²) = ${F(l)}`, l),
        Q('Slat', `S_біч = π(R+r)l = ${F(PI * (r1 + r2) * l)}`, PI * (r1 + r2) * l),
        Q('Stot', `S = S_біч + π(R²+r²) = ${F(PI * (r1 + r2) * l + PI * (r1 * r1 + r2 * r2))}`, PI * (r1 + r2) * l + PI * (r1 * r1 + r2 * r2)),
      ];
    },
    cubeInscribedSphere({ a }) {
      const R = a / 2;
      return [
        Q('RCirc', `R = a/2 = ${F(R)}`, R),
        Q('Vsph', `V_кулі = 4πR³/3 = ${F(4 / 3 * PI * R ** 3)}`, 4 / 3 * PI * R ** 3),
        Q('Vbody', `V_куба = a³ = ${F(a ** 3)}`, a ** 3),
        Q('ratio', `V_кулі/V_куба = π/6 ≈ ${F(PI / 6)}`, PI / 6),
      ];
    },
    cubeCircumSphere({ a }) {
      const R = a * sqrt(3) / 2;
      return [
        Q('RCirc', `R = a√3/2 = ${F(R)}`, R),
        Q('Vsph', `V_кулі = 4πR³/3 = ${F(4 / 3 * PI * R ** 3)}`, 4 / 3 * PI * R ** 3),
        Q('Vbody', `V_куба = a³ = ${F(a ** 3)}`, a ** 3),
      ];
    },
    cylinderInscribedSphere({ r }) {
      return [
        Q('RCirc', `R = r = ${F(r)}`, r),
        Q('height', `h_цил = 2R = ${F(2 * r)}`, 2 * r),
        Q('Vsph', `V_кулі = 4πR³/3 = ${F(4 / 3 * PI * r ** 3)}`, 4 / 3 * PI * r ** 3),
        Q('Vbody', `V_цил = 2πR³ = ${F(2 * PI * r ** 3)}`, 2 * PI * r ** 3),
        Q('ratio', `V_кулі/V_цил = 2/3`, 2 / 3),
      ];
    },
    sphereInscribedCone({ R, hc }) {
      const r = sqrt(Math.max(0, hc * (2 * R - hc)));
      return [
        Q('rBase', `r = √(h(2R−h)) = ${F(r)}`, r),
        Q('V', `V_кон = ⅓πr²h = ${F(PI * r * r * hc / 3)}`, PI * r * r * hc / 3),
        Q('Vsph', `V_кулі = 4πR³/3 = ${F(4 / 3 * PI * R ** 3)}`, 4 / 3 * PI * R ** 3),
      ];
    },
    coneInscribedCylinder({ R, H, rc }) {
      const hc = H * (1 - rc / R);
      return [
        Q('height', `h_цил = H(1−r/R) = ${F(hc)}`, hc),
        Q('V', `V_цил = πr²h = ${F(PI * rc * rc * hc)}`, PI * rc * rc * hc),
        Q('Vbody', `V_кон = ⅓πR²H = ${F(PI * R * R * H / 3)}`, PI * R * R * H / 3),
      ];
    },
    cubeSection3({ a }) {
      return [
        Q('Vbody', `V_куба = a³ = ${F(a ** 3)}`, a ** 3),
        Q('Stot', `S_куба = 6a² = ${F(6 * a * a)}`, 6 * a * a),
      ];
    },
    pyramid4Section3({ a, h }) {
      return [
        Q('Sbase', `S_осн = a² = ${F(a * a)}`, a * a),
        Q('Vbody', `V = ⅓a²h = ${F(a * a * h / 3)}`, a * a * h / 3),
      ];
    },
    prism4Section3({ a, h }) {
      return [
        Q('Sbase', `S_осн = a² = ${F(a * a)}`, a * a),
        Q('Vbody', `V = a²h = ${F(a * a * h)}`, a * a * h),
      ];
    },
    trapPyramid() { return []; }, // основа-трапеція: величини залежать від форми — кошик B
  };

  const api = {
    get(templateKey, params) {
      const fn = T[templateKey];
      if (!fn) return [];
      try { return fn(params) || []; } catch (_) { return []; }
    },
    has(templateKey) { return !!T[templateKey] && templateKey !== 'trapPyramid'; },
  };
  if (typeof window !== 'undefined') window.StereoAnalysis = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();

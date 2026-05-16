// geo2d-presets.js — predefined dynamic constructions
(function () {
  const { G } = window.Geo2D;

  // helper: tag-aware add. each toggle's objects are tagged so we can remove them.
  const add = (con, o, tag) => con.add(o, tag ? [tag] : []);

  const PRESETS = {
    // ========================================================================
    // euler9: Пряма Ейлера + Коло 9 точок.
    //   Для будь-якого △ABC:
    //     - Центроїд G, ортоцентр H, центр описаного O — на прямій Ейлера.
    //     - 9 спеціальних точок (3 середини сторін, 3 основи висот, 3 середини
    //       від H до вершин) лежать на колі радіуса R/2 з центром у середині OH.
    //   WOW: drag вершини — все перебудовується, але інваріанти зберігаються.
    // ========================================================================
    euler9: {
      name: 'Пряма Ейлера + 9 точок',
      meta: 'GHО колінеарні · 9 точок на колі',
      defaults: { showGrid: false, showAxes: false },
      build(con) {
        const INK = '#1e293b';
        const GREEN = '#16a34a';   // centroid
        const RED = '#dc2626';     // orthocenter
        const BLUE = '#2563eb';    // circumcenter
        const ORANGE = '#ea580c';  // 9-point circle
        const PURPLE = '#a855f7';  // Euler line
        const GRAY = '#94a3b8';

        // Трикутник
        add(con, G.free('A', -2.6, -1.4, { label: 'A', labelOffset: { x: -14, y: 6 } }));
        add(con, G.free('B', 2.6, -1.4, { label: 'B', labelOffset: { x: 10, y: 6 } }));
        add(con, G.free('C', 0.4, 2.4, { label: 'C', labelOffset: { x: 0, y: -10 } }));
        add(con, G.segment('AB', 'A', 'B', { color: INK, width: 2 }));
        add(con, G.segment('BC', 'B', 'C', { color: INK, width: 2 }));
        add(con, G.segment('CA', 'C', 'A', { color: INK, width: 2 }));

        // Три головні центри
        add(con, G.centroid('G', 'A', 'B', 'C', { label: 'G', labelOffset: { x: 10, y: -4 }, color: GREEN, size: 5 }));
        add(con, G.orthocenter('H', 'A', 'B', 'C', { label: 'H', labelOffset: { x: 10, y: -4 }, color: RED, size: 5 }));
        add(con, G.circumcenter('O', 'A', 'B', 'C', { label: 'O', labelOffset: { x: 10, y: -4 }, color: BLUE, size: 5 }));

        // Пряма Ейлера — через O та H (G на ній автоматично)
        add(con, G.line('euler', 'O', 'H', { style: 'dashed', color: PURPLE, width: 2.5 }));

        // Центр кола 9-ти точок N₉ = середина OH
        add(con, G.midpoint('N9', 'O', 'H', { label: 'N₉', labelOffset: { x: 10, y: -4 }, color: ORANGE, size: 5 }));

        // Підказка
        add(con, G.formula('hint', () => 'G, H, O — колінеарні · 9 точок — на колі', { anchor: 'tl' }));
        add(con, G.formula('proportion', () => 'GH = 2 · GO', { anchor: 'bl' }));
      },
      toggles: [
        { key: 'midpoints', label: 'Середини сторін', icon: '◇', default: true, apply(con, on) {
          con.removeByTag('midpoints');
          if (on) {
            const C = '#ea580c';
            add(con, G.midpoint('M_AB', 'A', 'B', { size: 4, color: C }), 'midpoints');
            add(con, G.midpoint('M_BC', 'B', 'C', { size: 4, color: C }), 'midpoints');
            add(con, G.midpoint('M_CA', 'C', 'A', { size: 4, color: C }), 'midpoints');
          }
        }},
        { key: 'altfeet', label: 'Основи висот', icon: '⊥', default: true, apply(con, on) {
          con.removeByTag('altfeet');
          if (on) {
            const C = '#ea580c';
            add(con, G.foot('F_A', 'A', 'BC', { size: 4, color: C }), 'altfeet');
            add(con, G.foot('F_B', 'B', 'CA', { size: 4, color: C }), 'altfeet');
            add(con, G.foot('F_C', 'C', 'AB', { size: 4, color: C }), 'altfeet');
          }
        }},
        { key: 'eulerpts', label: 'Сер. до H', icon: '◆', default: true, apply(con, on) {
          // Середини відрізків від ортоцентру до вершин (3 з 9 точок).
          con.removeByTag('eulerpts');
          if (on) {
            const C = '#ea580c';
            add(con, G.midpoint('E_HA', 'H', 'A', { size: 4, color: C }), 'eulerpts');
            add(con, G.midpoint('E_HB', 'H', 'B', { size: 4, color: C }), 'eulerpts');
            add(con, G.midpoint('E_HC', 'H', 'C', { size: 4, color: C }), 'eulerpts');
          }
        }},
        { key: 'ninecircle', label: 'Коло 9 точок', icon: '◉', default: true, apply(con, on) {
          // Малюємо тільки якщо є хоч одна з 9 точок (M_AB), щоб circle мав parent.
          con.removeByTag('ninecircle');
          if (on) {
            // Потрібно щоб M_AB вже існувала (через toggle midpoints).
            // Use circumcircle helper — приймає 3 точки, обчислює коло через них.
            // 3 з 9 точок: M_AB, M_BC, M_CA.
            add(con, G.midpoint('M_AB_n', 'A', 'B', { size: 0 }), 'ninecircle');
            add(con, G.midpoint('M_BC_n', 'B', 'C', { size: 0 }), 'ninecircle');
            add(con, G.midpoint('M_CA_n', 'C', 'A', { size: 0 }), 'ninecircle');
            add(con, G.circumcircle('c9', 'M_AB_n', 'M_BC_n', 'M_CA_n', { color: '#ea580c', width: 1.8, style: 'dashed' }), 'ninecircle');
          }
        }},
        { key: 'sides_extended', label: 'Висоти', icon: '↧', apply(con, on) {
          con.removeByTag('sides_extended');
          if (on) {
            const C = '#dc262680';
            add(con, G.altitude('h_a', 'A', 'B', 'C', { color: C, width: 1 }), 'sides_extended');
            add(con, G.altitude('h_b', 'B', 'C', 'A', { color: C, width: 1 }), 'sides_extended');
            add(con, G.altitude('h_c', 'C', 'A', 'B', { color: C, width: 1 }), 'sides_extended');
          }
        }},
      ],
    },

    // ========================================================================
    // simson: Симсонова пряма.
    //   Для трикутника + точки P на описаному колі — основи перпендикулярів
    //   з P на 3 сторони ЗАВЖДИ колінеарні (Simson line).
    //   WOW: drag P уздовж кола → 3 точки повзуть, але завжди на одній прямій.
    // ========================================================================
    simson: {
      name: 'Симсонова пряма',
      meta: 'P на колі → 3 проекції колінеарні',
      defaults: { showGrid: false, showAxes: false },
      build(con) {
        const INK = '#1e293b';
        const BLUE = '#2563eb';
        const RED = '#dc2626';
        const PURPLE = '#a855f7';
        const GRAY = '#94a3b8';

        // Трикутник
        add(con, G.free('A', -2.3, -1.5, { label: 'A', labelOffset: { x: -14, y: 6 } }));
        add(con, G.free('B', 2.5, -1.2, { label: 'B', labelOffset: { x: 10, y: 6 } }));
        add(con, G.free('C', 0.2, 2.3, { label: 'C', labelOffset: { x: 0, y: -10 } }));
        add(con, G.segment('AB', 'A', 'B', { color: INK, width: 2 }));
        add(con, G.segment('BC', 'B', 'C', { color: INK, width: 2 }));
        add(con, G.segment('CA', 'C', 'A', { color: INK, width: 2 }));

        // Описане коло
        add(con, G.circumcenter('O', 'A', 'B', 'C', { label: 'O', color: BLUE, size: 4 }));
        add(con, G.circumcircle('circ', 'A', 'B', 'C', { color: BLUE, width: 1.5, style: 'dashed' }));

        // Точка P на описаному колі — drag-able вздовж кола
        add(con, G.onCircle('P', 'circ', -0.6, { label: 'P', labelOffset: { x: 10, y: -6 }, color: RED, size: 6 }));

        // Перпендикуляри з P на 3 сторони — пунктирні (для візуалізації)
        add(con, G.foot('F_AB', 'P', 'AB', { label: 'F₁', labelOffset: { x: 0, y: -10 }, color: PURPLE, size: 5 }));
        add(con, G.foot('F_BC', 'P', 'BC', { label: 'F₂', labelOffset: { x: 10, y: 0 }, color: PURPLE, size: 5 }));
        add(con, G.foot('F_CA', 'P', 'CA', { label: 'F₃', labelOffset: { x: -10, y: 0 }, color: PURPLE, size: 5 }));

        // Симсонова пряма (через 2 з 3 проекцій — третя на ній автоматично)
        add(con, G.line('simson', 'F_AB', 'F_BC', { color: PURPLE, width: 2.5 }));

        add(con, G.formula('hint', () => 'Drag P уздовж кола · F₁, F₂, F₃ завжди на прямій', { anchor: 'tl' }));
      },
      toggles: [
        { key: 'perpendiculars', label: 'Перпендикуляри', icon: '⊥', default: true, apply(con, on) {
          con.removeByTag('perpendiculars');
          if (on) {
            const C = '#94a3b8';
            add(con, G.segment('p_AB', 'P', 'F_AB', { style: 'dashed', color: C, width: 1 }), 'perpendiculars');
            add(con, G.segment('p_BC', 'P', 'F_BC', { style: 'dashed', color: C, width: 1 }), 'perpendiculars');
            add(con, G.segment('p_CA', 'P', 'F_CA', { style: 'dashed', color: C, width: 1 }), 'perpendiculars');
          }
        }},
        { key: 'extend_sides', label: 'Сторони ↔', icon: '⟷', apply(con, on) {
          // Подовжити сторони як прямі — інколи F₂/F₃ лежать за межами трикутника.
          con.removeByTag('extend_sides');
          if (on) {
            const C = '#1e293b40';
            add(con, G.line('lAB', 'A', 'B', { color: C, width: 0.8 }), 'extend_sides');
            add(con, G.line('lBC', 'B', 'C', { color: C, width: 0.8 }), 'extend_sides');
            add(con, G.line('lCA', 'C', 'A', { color: C, width: 0.8 }), 'extend_sides');
          }
        }},
      ],
    },

    // ========================================================================
    // inversion: Інверсія відносно кола.
    //   P' = O + r²/|OP|² · (P - O)
    //   - Точка на колі інверсії → P' = P (фіксована).
    //   - Точка близько до центру → P' летить на нескінченність.
    //   - Зовнішнє/внутрішнє інвертується.
    //   WOW: drag P → P' живо рухається, формула живо оновлюється.
    // ========================================================================
    inversion: {
      name: 'Інверсія відносно кола',
      meta: "P' = O + r²/|OP|² · (P − O)",
      defaults: { showGrid: true, showAxes: true },
      build(con) {
        const BLUE = '#2563eb';
        const RED = '#dc2626';
        const ORANGE = '#ea580c';
        const GRAY = '#94a3b8';
        const INK = '#1e293b';

        // Центр та радіус кола інверсії
        add(con, G.free('O', 0, 0, { label: 'O', labelOffset: { x: -12, y: -10 }, color: INK }));
        add(con, G.free('R', 2.2, 0, { label: 'R', labelOffset: { x: 10, y: -8 }, color: GRAY }));
        add(con, G.circle('inv_circle', 'O', 'R', { color: BLUE, width: 1.8 }));
        add(con, G.segment('OR', 'O', 'R', { style: 'dashed', color: GRAY }));

        // Точка P (free) та її інверсна P'
        add(con, G.free('P', 1.2, 1.5, { label: 'P', labelOffset: { x: 8, y: -10 }, color: RED, size: 6 }));
        add(con, G.derived('P1', ['O', 'R', 'P'], (reg) => {
          const O = reg.get('O'), R = reg.get('R'), P = reg.get('P');
          const dx = P.x - O.x, dy = P.y - O.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 1e-9) return { x: O.x + 1000, y: O.y }; // P→O → P' уходить
          const r2 = (R.x - O.x) ** 2 + (R.y - O.y) ** 2;
          const k = r2 / d2;
          return { x: O.x + k * dx, y: O.y + k * dy };
        }, { label: "P'", labelOffset: { x: 10, y: -6 }, color: ORANGE, size: 6 }));

        // Промінь через O, P, P' (вони завжди колінеарні)
        add(con, G.ray('ray_OPP', 'O', 'P', { style: 'dashed', color: GRAY, width: 1 }));

        // Live підказка та формули
        add(con, G.formula('hint', () => 'Drag P · P′ повзе по тому ж променю від O', { anchor: 'tl' }));
        add(con, G.formula('product', (reg) => {
          const O = reg.get('O'), R = reg.get('R'), P = reg.get('P');
          const r = Math.hypot(R.x - O.x, R.y - O.y);
          const OP = Math.hypot(P.x - O.x, P.y - O.y);
          if (OP < 1e-3) return 'OP → 0 · OP′ → ∞';
          const OP1 = (r * r) / OP;
          return 'OP · OP′ = ' + u.fmt(OP * OP1, 2) + '  =  r² = ' + u.fmt(r * r, 2);
        }, { anchor: 'bl' }));
      },
      toggles: [
        { key: 'segments', label: 'OP та OP′', icon: '∣', default: true, apply(con, on) {
          con.removeByTag('segments');
          if (on) {
            const C1 = '#dc2626';
            const C2 = '#ea580c';
            add(con, G.segment('seg_OP', 'O', 'P', { color: C1, width: 1.5 }), 'segments');
            add(con, G.segment('seg_OP1', 'O', 'P1', { color: C2, width: 1.5 }), 'segments');
            add(con, G.lengthLabel('lab_OP', 'seg_OP', { prefix: 'OP = ' }), 'segments');
            add(con, G.lengthLabel('lab_OP1', 'seg_OP1', { prefix: "OP′ = " }), 'segments');
          }
        }},
        { key: 'second', label: 'Друга точка', icon: '◐', apply(con, on) {
          // Друга вільна точка Q з її інверсією Q' — показує що інверсія
          // зберігає кути (конформність) між кривими, які проходять через P та Q.
          con.removeByTag('second');
          if (on) {
            add(con, G.free('Q', -1.5, 0.8, { label: 'Q', color: '#10b981', size: 6 }), 'second');
            add(con, G.derived('Q1', ['O', 'R', 'Q'], (reg) => {
              const O = reg.get('O'), R = reg.get('R'), Q = reg.get('Q');
              const dx = Q.x - O.x, dy = Q.y - O.y;
              const d2 = dx * dx + dy * dy;
              if (d2 < 1e-9) return { x: O.x + 1000, y: O.y };
              const r2 = (R.x - O.x) ** 2 + (R.y - O.y) ** 2;
              const k = r2 / d2;
              return { x: O.x + k * dx, y: O.y + k * dy };
            }, { label: "Q'", color: '#0891b2', size: 6 }), 'second');
            add(con, G.ray('ray_OQQ', 'O', 'Q', { style: 'dashed', color: '#94a3b8', width: 1 }), 'second');
            add(con, G.segment('PQ', 'P', 'Q', { style: 'dashed', color: '#94a3b8', width: 1.2 }), 'second');
            add(con, G.segment('P1Q1', 'P1', 'Q1', { style: 'dashed', color: '#94a3b8', width: 1.2 }), 'second');
          }
        }},
      ],
    },

    // ========================================================================
    // trapezium: Трапеція з constrained паралельністю бaз.
    //   - A, B — free (нижня основа)
    //   - D — free (top-left vertex)
    //   - E — derived hidden anchor = D + (B - A) — другий якір верхньої прямої
    //   - C — G.onLine(D, E) — drag-constrained на верхній прямій
    //   ⇒ AB ∥ DC завжди, незалежно від drag.
    //   - Toggle "Описане" малює коло через A, B, C + live відстань від D
    //     (drag D на коло → трапеція стає cyclic — рівнобедрена).
    // ========================================================================
    trapezium: {
      name: 'Трапеція',
      meta: 'AB ∥ DC · constrained drag',
      defaults: { showGrid: false, showAxes: false },
      build(con) {
        const INK = '#1e293b';

        // Нижня основа AB
        add(con, G.free('A', -2.7, -1.5, { label: 'A', labelOffset: { x: -14, y: 6 } }));
        add(con, G.free('B', 2.7, -1.5, { label: 'B', labelOffset: { x: 10, y: 6 } }));
        // Top-left vertex D — free
        add(con, G.free('D', -1.4, 1.4, { label: 'D', labelOffset: { x: -14, y: -8 } }));
        // E — hidden anchor (D translated by B-A), defines top line direction
        add(con, G.derived('_E', ['D', 'A', 'B'], (reg) => {
          const A = reg.get('A'), B = reg.get('B'), D = reg.get('D');
          return { x: D.x + (B.x - A.x), y: D.y + (B.y - A.y) };
        }, { hidden: true }));
        // C — drag-constrained на прямій через D ‖ AB (через onLine D→E з t=0.5)
        add(con, G.onLine('C', 'D', '_E', 0.5, { label: 'C', labelOffset: { x: 10, y: -8 } }));

        // Сторони трапеції
        add(con, G.segment('AB', 'A', 'B', { color: INK, width: 2 }));
        add(con, G.segment('BC', 'B', 'C', { color: INK, width: 2 }));
        add(con, G.segment('CD', 'C', 'D', { color: INK, width: 2 }));
        add(con, G.segment('DA', 'D', 'A', { color: INK, width: 2 }));

        add(con, G.formula('hint', () => 'Drag A/B/D вільно · C по верхній прямій (‖ AB)', { anchor: 'tl' }));
        add(con, G.formula('areas', (r) => {
          const A = r.get('A'), B = r.get('B'), Cp = r.get('C'), Dp = r.get('D');
          const u = window.Geo2D.util;
          const ab = u.dist(A, B), cd = u.dist(Cp, Dp);
          // height = відстань від D до прямої AB
          const v = u.sub(B, A), n = { x: -v.y, y: v.x };
          const ln = u.len(n);
          const h = ln < 1e-9 ? 0 : Math.abs(u.dot(u.sub(Dp, A), n)) / ln;
          const S = (ab + cd) * h / 2;
          return 'S = ((a+b)/2) · h = ' + u.fmt(S, 2);
        }, { anchor: 'bl' }));
      },
      toggles: [
        { key: 'sides', label: 'Довжини', icon: '∣', default: true, apply(con, on) {
          con.removeByTag('sides');
          if (on) {
            add(con, G.lengthLabel('lab_AB', 'AB', { prefix: 'a = ' }), 'sides');
            add(con, G.lengthLabel('lab_CD', 'CD', { prefix: 'b = ' }), 'sides');
            add(con, G.lengthLabel('lab_BC', 'BC'), 'sides');
            add(con, G.lengthLabel('lab_DA', 'DA'), 'sides');
          }
        }},
        { key: 'midsegment', label: 'Сер. лінія', icon: '═', apply(con, on) {
          // Середня лінія трапеції = (AB + CD) / 2
          con.removeByTag('midsegment');
          if (on) {
            const C = '#ca8a04';
            add(con, G.midpoint('M_DA', 'D', 'A', { size: 4, color: C, label: 'M₁' }), 'midsegment');
            add(con, G.midpoint('M_BC', 'B', 'C', { size: 4, color: C, label: 'M₂' }), 'midsegment');
            add(con, G.segment('midseg', 'M_DA', 'M_BC', { style: 'dashed', color: C, width: 2 }), 'midsegment');
            add(con, G.lengthLabel('lab_mid', 'midseg', { prefix: 'm = ' }), 'midsegment');
          }
        }},
        { key: 'height', label: 'Висота', icon: '↧', apply(con, on) {
          // Висота — перпендикуляр з D до AB
          con.removeByTag('height');
          if (on) {
            const C = '#dc2626';
            add(con, G.foot('H_D', 'D', 'AB', { size: 4, color: C, label: 'H' }), 'height');
            add(con, G.segment('h_seg', 'D', 'H_D', { style: 'dashed', color: C, width: 1.5 }), 'height');
            add(con, G.lengthLabel('lab_h', 'h_seg', { prefix: 'h = ' }), 'height');
          }
        }},
        { key: 'diagonals', label: 'Діагоналі', icon: '╳', apply(con, on) {
          con.removeByTag('diagonals');
          if (on) {
            const C = '#a855f7';
            add(con, G.segment('AC', 'A', 'C', { style: 'dashed', color: C, width: 1.5 }), 'diagonals');
            add(con, G.segment('BD', 'B', 'D', { style: 'dashed', color: C, width: 1.5 }), 'diagonals');
            add(con, G.intersectLL('Pint', 'AC', 'BD', { label: 'P', color: C, size: 4 }), 'diagonals');
          }
        }},
        { key: 'circumscribed', label: 'Описане ?', icon: '◎', apply(con, on) {
          // Описане коло існує лише якщо ABCD — рівнобедрена трапеція.
          // Малюємо коло через A, B, C; live label показує відстань від D
          // (=0 коли cyclic). Drag → користувач сам бачить умову.
          con.removeByTag('circumscribed');
          if (on) {
            const C = '#2563eb';
            add(con, G.circumcenter('Oc', 'A', 'B', 'C', { label: 'O', color: C, size: 4 }), 'circumscribed');
            add(con, G.circumcircle('circ_abc', 'A', 'B', 'C', { color: C, width: 1.5, style: 'dashed' }), 'circumscribed');
            add(con, G.formula('cyclic_diff', (r) => {
              const O = r.get('Oc'), A = r.get('A'), D = r.get('D');
              const radius = window.Geo2D.util.dist(O, A);
              const dist_OD = window.Geo2D.util.dist(O, D);
              const diff = dist_OD - radius;
              const status = Math.abs(diff) < 0.05 ? '✓ вписана' : (diff > 0 ? 'D назовні' : 'D всередині');
              return 'D − коло: ' + window.Geo2D.util.fmt(diff, 2) + '  · ' + status;
            }, { anchor: 'tr' }), 'circumscribed');
          }
        }},
        { key: 'incscribed_check', label: 'Pitot?', icon: '◉', apply(con, on) {
          // Pitot: вписане коло існує ⇔ AB + CD = BC + DA. Live check.
          con.removeByTag('incscribed_check');
          if (on) {
            add(con, G.formula('pitot', (r) => {
              const A = r.get('A'), B = r.get('B'), Cp = r.get('C'), Dp = r.get('D');
              const u = window.Geo2D.util;
              const ab = u.dist(A, B), cd = u.dist(Cp, Dp);
              const bc = u.dist(B, Cp), da = u.dist(Dp, A);
              const lhs = ab + cd, rhs = bc + da;
              const diff = Math.abs(lhs - rhs);
              const ok = diff < 0.05 ? '✓ можна вписати' : '✗ ';
              return 'AB+CD = ' + u.fmt(lhs, 2) + '  · BC+DA = ' + u.fmt(rhs, 2) + '  · ' + ok;
            }, { anchor: 'tr' }), 'incscribed_check');
          }
        }},
      ],
    },

    // ========================================================================
    // parallels: Паралельні прямі та січна.
    //   - Дві паралельні прямі a (через A,B) та b (через C, D=C+(B-A) — derived).
    //   - Січна t (через T, S — обидві free).
    //   - Точки перетину M=a∩t, N=b∩t.
    //   - 8 кутів навколо M+N з 2 кольорами:
    //       рожевий — гострі рівні пари (відповідні + різносторонні + вертикальні)
    //       зелений — тупі рівні пари
    //   - Toggles: відповідні, внутрішні різносторонні, внутрішні односторонні.
    // ========================================================================
    parallels: {
      name: 'Паралельні + січна',
      meta: '8 кутів · відповідні · різносторонні',
      defaults: { showGrid: false, showAxes: false },
      build(con) {
        const BLUE = '#2563eb';
        const RED = '#dc2626';
        const GRAY = '#94a3b8';

        // Верхня пряма a: 2 free points
        add(con, G.free('A', -3.5, 1.5, { label: 'A', labelOffset: { x: -14, y: -6 }, color: BLUE }));
        add(con, G.free('B', 3.5, 1.5, { label: 'B', labelOffset: { x: 10, y: -6 }, color: BLUE }));
        // C — free point, що задає зсув нижньої прямої.
        // D = C + (B - A) — derived, гарантує паралельність a ∥ b.
        add(con, G.free('C', -3.5, -1.5, { label: 'C', labelOffset: { x: -14, y: 8 }, color: BLUE }));
        add(con, G.derived('D', ['C', 'A', 'B'], (reg) => {
          const A = reg.get('A'), B = reg.get('B'), C = reg.get('C');
          return { x: C.x + (B.x - A.x), y: C.y + (B.y - A.y) };
        }, { label: 'D', labelOffset: { x: 10, y: 8 }, color: BLUE }));

        // Прямі a (верхня) та b (нижня) — паралельні
        add(con, G.line('a', 'A', 'B', { color: BLUE, width: 2 }));
        add(con, G.line('b', 'C', 'D', { color: BLUE, width: 2 }));

        // Секанта t — два free points (T згори, S знизу)
        add(con, G.free('T', -1.0, 2.8, { label: 'T', labelOffset: { x: 8, y: -8 }, color: RED }));
        add(con, G.free('S', 1.5, -2.8, { label: 'S', labelOffset: { x: 10, y: 6 }, color: RED }));
        add(con, G.line('t', 'T', 'S', { color: RED, width: 2 }));

        // Точки перетину M = a ∩ t, N = b ∩ t
        add(con, G.intersectLL('M', 'a', 't', { label: 'M', labelOffset: { x: 10, y: -10 }, color: '#1e293b' }));
        add(con, G.intersectLL('N', 'b', 't', { label: 'N', labelOffset: { x: 10, y: 10 }, color: '#1e293b' }));

        // Підказка
        add(con, G.formula('hint', () => 'a ∥ b · тягни точки · кути живі', { anchor: 'tl' }));
      },
      toggles: [
        // Відповідні кути — пара ∠1 (M, top-left) та ∠5 (N, bottom-left).
        // Однаковий колір показує що вони рівні.
        { key: 'corresponding', label: 'Відповідні', icon: '⇊', default: true, apply(con, on) {
          con.removeByTag('corresponding');
          if (on) {
            const C = '#ec4899'; // рожевий — для гострих пар
            // У вершині M між променем M→A (ліворуч по a) та M→T (вгору по секанті)
            add(con, G.angleArc('corr_M', 'A', 'M', 'T', { radius: 0.5, color: C }), 'corresponding');
            // У вершині N між променем N→C (ліворуч по b) та N→T (вгору по секанті, через M)
            add(con, G.angleArc('corr_N', 'C', 'N', 'T', { radius: 0.5, color: C }), 'corresponding');
          }
        }},
        // Внутрішні різносторонні (Z-кути) — рівні.
        { key: 'alternate', label: 'Різносторонні', icon: 'Z', apply(con, on) {
          con.removeByTag('alternate');
          if (on) {
            const C = '#16a34a'; // зелений
            // У M: між M→B (праворуч) та M→S (вниз по секанті)
            add(con, G.angleArc('alt_M', 'B', 'M', 'S', { radius: 0.55, color: C }), 'alternate');
            // У N: між N→C (ліворуч) та N→T (вгору по секанті)
            add(con, G.angleArc('alt_N', 'C', 'N', 'T', { radius: 0.55, color: C }), 'alternate');
          }
        }},
        // Внутрішні односторонні (C-кути) — у сумі 180°.
        { key: 'cointerior', label: 'Односторонні', icon: 'C', apply(con, on) {
          con.removeByTag('cointerior');
          if (on) {
            const C1 = '#a855f7'; // пурпур
            const C2 = '#0891b2'; // бірюзовий
            // У M: між M→B (праворуч) та M→S (вниз)
            add(con, G.angleArc('co_M', 'B', 'M', 'S', { radius: 0.7, color: C1 }), 'cointerior');
            // У N: між N→D (праворуч) та N→T (вгору)
            add(con, G.angleArc('co_N', 'D', 'N', 'T', { radius: 0.7, color: C2 }), 'cointerior');
            add(con, G.formula('co_sum', () => '∠M + ∠N = 180°', { anchor: 'bl' }), 'cointerior');
          }
        }},
        // Вертикальні кути у вершині M (рівні самі собі).
        { key: 'vertical', label: 'Вертикальні', icon: '✕', apply(con, on) {
          con.removeByTag('vertical');
          if (on) {
            const C = '#ea580c'; // помаранчевий
            // У M: між M→A (ліворуч) та M→S (вниз) — vs пара між M→B та M→T (рівна)
            add(con, G.angleArc('vert_M1', 'A', 'M', 'S', { radius: 0.4, color: C }), 'vertical');
            add(con, G.angleArc('vert_M2', 'B', 'M', 'T', { radius: 0.4, color: C }), 'vertical');
          }
        }},
      ],
    },

    // ========================================================================
    // similar: Подібні трикутники (заміна blank — навчальна тема гомотетії).
    //   - Малий △ ABC (3 free points, синій).
    //   - O — центр гомотетії (free).
    //   - K — handle, що задає коефіцієнт k = dist(O, K).
    //   - A', B', C' = O + k*(P - O) — derived, помаранчевий.
    //   - Промені OA-A', OB-B', OC-C' (dashed) показують напрямок гомотетії.
    //   - Відношення сторін AB/A'B' = k для всіх (за теоремою про подібність).
    // ========================================================================
    similar: {
      name: 'Подібні трикутники',
      meta: 'гомотетія · k = const',
      defaults: { showGrid: true, showAxes: false },
      build(con) {
        const BLUE = '#2563eb';
        const ORANGE = '#ea580c';
        const GRAY = '#94a3b8';

        // Центр гомотетії
        add(con, G.free('O', -3.2, -2.2, { label: 'O', labelOffset: { x: -12, y: -8 }, color: GRAY }));
        // Handle для коефіцієнта k. Default position: 1 unit right of O → k=1
        // initially, але render-ить через k = dist(O, K) які треба >1 щоб
        // одразу побачити різницю. Ставимо K на 2 units → k = 2.
        add(con, G.free('K', -1.2, -2.2, { label: 'k', labelOffset: { x: 0, y: 16 }, color: GRAY }));

        // Малий трикутник
        add(con, G.free('A', -2.0, -1.0, { label: 'A', labelOffset: { x: -14, y: 6 }, color: BLUE }));
        add(con, G.free('B', -0.6, -1.0, { label: 'B', labelOffset: { x: 8, y: 8 }, color: BLUE }));
        add(con, G.free('C', -1.3, 0.2, { label: 'C', labelOffset: { x: 0, y: -10 }, color: BLUE }));
        add(con, G.segment('AB', 'A', 'B', { color: BLUE, width: 2 }));
        add(con, G.segment('BC', 'B', 'C', { color: BLUE, width: 2 }));
        add(con, G.segment('CA', 'C', 'A', { color: BLUE, width: 2 }));

        // Великий трикутник A'B'C' = гомотетія(O, k) — k = dist(O, K)
        const homothety = (sourceId) => ({
          deps: ['O', 'K', sourceId],
          fn(reg) {
            const O = reg.get('O'), K = reg.get('K'), P = reg.get(sourceId);
            const k = Math.hypot(K.x - O.x, K.y - O.y);
            return { x: O.x + k * (P.x - O.x), y: O.y + k * (P.y - O.y) };
          },
        });
        const hA = homothety('A');
        const hB = homothety('B');
        const hC = homothety('C');
        add(con, G.derived('A1', hA.deps, hA.fn, { label: "A'", labelOffset: { x: -14, y: 6 }, color: ORANGE }));
        add(con, G.derived('B1', hB.deps, hB.fn, { label: "B'", labelOffset: { x: 10, y: 8 }, color: ORANGE }));
        add(con, G.derived('C1', hC.deps, hC.fn, { label: "C'", labelOffset: { x: 0, y: -10 }, color: ORANGE }));
        add(con, G.segment('A1B1', 'A1', 'B1', { color: ORANGE, width: 2 }));
        add(con, G.segment('B1C1', 'B1', 'C1', { color: ORANGE, width: 2 }));
        add(con, G.segment('C1A1', 'C1', 'A1', { color: ORANGE, width: 2 }));

        // Промені гомотетії (dashed, сірі) — показують що O, A, A' колінеарні
        add(con, G.line('rO_A', 'O', 'A1', { style: 'dashed', color: GRAY, width: 1 }));
        add(con, G.line('rO_B', 'O', 'B1', { style: 'dashed', color: GRAY, width: 1 }));
        add(con, G.line('rO_C', 'O', 'C1', { style: 'dashed', color: GRAY, width: 1 }));

        // "Лінійка" k: відрізок OK для візуалізації
        add(con, G.segment('seg_OK', 'O', 'K', { style: 'dashed', color: GRAY, width: 1.5 }));

        // Формула коефіцієнта k = |OK|
        add(con, G.formula('label_k', (reg) => {
          const O = reg.get('O'), K = reg.get('K');
          const k = Math.hypot(K.x - O.x, K.y - O.y);
          return 'k = ' + u.fmt(k, 2);
        }, { anchor: 'tl' }));

        // Інформаційна формула — теорема про відношення сторін
        add(con, G.formula('info', (reg) => {
          const A = reg.get('A'), B = reg.get('B');
          const A1 = reg.get('A1'), B1 = reg.get('B1');
          const ab = Math.hypot(B.x - A.x, B.y - A.y);
          const a1b1 = Math.hypot(B1.x - A1.x, B1.y - A1.y);
          if (ab < 1e-6) return '';
          return "A'B' / AB = " + u.fmt(a1b1 / ab, 2);
        }, { anchor: 'bl' }));
      },
      toggles: [
        { key: 'lengths', label: 'Сторони', icon: '∣', apply(con, on) {
          // Показує довжини обох пар відповідних сторін — учень бачить що
          // відношення завжди однакове (= k).
          con.removeByTag('lengths');
          if (on) {
            add(con, G.lengthLabel('lab_AB', 'AB'), 'lengths');
            add(con, G.lengthLabel('lab_BC', 'BC'), 'lengths');
            add(con, G.lengthLabel('lab_CA', 'CA'), 'lengths');
            add(con, G.lengthLabel('lab_A1B1', 'A1B1'), 'lengths');
            add(con, G.lengthLabel('lab_B1C1', 'B1C1'), 'lengths');
            add(con, G.lengthLabel('lab_C1A1', 'C1A1'), 'lengths');
          }
        }},
        { key: 'angles', label: 'Кути', icon: '∠', apply(con, on) {
          // Показує що відповідні кути рівні (∠A = ∠A' тощо).
          con.removeByTag('angles');
          if (on) {
            add(con, G.angleArc('ang_A', 'B', 'A', 'C', { radius: 0.4 }), 'angles');
            add(con, G.angleArc('ang_B', 'C', 'B', 'A', { radius: 0.4 }), 'angles');
            add(con, G.angleArc('ang_C', 'A', 'C', 'B', { radius: 0.4 }), 'angles');
            add(con, G.angleArc('ang_A1', 'B1', 'A1', 'C1', { radius: 0.5 }), 'angles');
            add(con, G.angleArc('ang_B1', 'C1', 'B1', 'A1', { radius: 0.5 }), 'angles');
            add(con, G.angleArc('ang_C1', 'A1', 'C1', 'B1', { radius: 0.5 }), 'angles');
          }
        }},
      ],
    },

    // ========================================================================
    triangle: {
      name: 'Трикутник',
      meta: '3 вершини · 6 елементів',
      defaults: { showGrid: false },
      build(con) {
        add(con, G.free('A', -2.4, -1.4, { label: 'A', labelOffset: { x: -14, y: 6 } }));
        add(con, G.free('B', 2.4, -1.4, { label: 'B', labelOffset: { x: 10, y: 6 } }));
        add(con, G.free('C', 0.2, 2.2, { label: 'C', labelOffset: { x: 8, y: -10 } }));
        add(con, G.polygon('tri', ['A', 'B', 'C']));
        add(con, G.segment('AB', 'A', 'B'));
        add(con, G.segment('BC', 'B', 'C'));
        add(con, G.segment('CA', 'C', 'A'));
        add(con, G.lengthLabel('lab_c', 'AB', { prefix: 'c=' }));
        add(con, G.lengthLabel('lab_a', 'BC', { prefix: 'a=' }));
        add(con, G.lengthLabel('lab_b', 'CA', { prefix: 'b=' }));
        add(con, G.angleArc('ang_A', 'B', 'A', 'C', { rPx: 22 }));
        add(con, G.angleArc('ang_B', 'C', 'B', 'A', { rPx: 22 }));
        add(con, G.angleArc('ang_C', 'A', 'C', 'B', { rPx: 22 }));
        add(con, G.formula('eq', (r) => {
          const A = r.get('A'), B = r.get('B'), C = r.get('C');
          const u = window.Geo2D.util;
          const S = Math.abs(u.polygonArea([A, B, C]));
          const a = u.dist(B, C), b = u.dist(C, A), c = u.dist(A, B);
          const p = (a + b + c);
          return 'S = ' + u.fmt(S, 2) + '   P = ' + u.fmt(p, 2);
        }, { anchor: 'bl' }));
      },
      // Освітня палітра для трикутника — кожен тип лінії має свій сталий колір
      // щоб учні могли візуально розрізняти що саме показано:
      //   медіани    → зелений   (#16a34a)
      //   висоти     → червоний  (#dc2626)
      //   бісектриси → пурпуровий (#a855f7)
      //   медіатриси → бірюзовий  (#0891b2)
      //   вписане    → помаранчевий (#ea580c) — теплий warm для "in"
      //   описане    → синій      (#2563eb) — холодний для "out"
      //   сер.лінія  → жовтий-охра (#ca8a04, dashed)
      toggles: [
        { key: 'medians', label: 'Медіани', icon: '⊿', apply(con, on) {
          con.removeByTag('medians');
          if (on) {
            const C = '#16a34a';
            add(con, G.median('m_a', 'A', 'B', 'C', { color: C }), 'medians');
            add(con, G.median('m_b', 'B', 'C', 'A', { color: C }), 'medians');
            add(con, G.median('m_c', 'C', 'A', 'B', { color: C }), 'medians');
            add(con, G.centroid('G', 'A', 'B', 'C', { label: 'G', color: C }), 'medians');
          }
        }},
        { key: 'altitudes', label: 'Висоти', icon: '⊥', apply(con, on) {
          con.removeByTag('altitudes');
          if (on) {
            const C = '#dc2626';
            add(con, G.altitude('h_a', 'A', 'B', 'C', { color: C }), 'altitudes');
            add(con, G.altitude('h_b', 'B', 'C', 'A', { color: C }), 'altitudes');
            add(con, G.altitude('h_c', 'C', 'A', 'B', { color: C }), 'altitudes');
            add(con, G.orthocenter('H', 'A', 'B', 'C', { label: 'H', color: C }), 'altitudes');
          }
        }},
        { key: 'bisectors', label: 'Бісектриси', icon: '∡', apply(con, on) {
          con.removeByTag('bisectors');
          if (on) {
            const C = '#a855f7';
            add(con, G.angleBisector('bi_A', 'B', 'A', 'C', { color: C }), 'bisectors');
            add(con, G.angleBisector('bi_B', 'C', 'B', 'A', { color: C }), 'bisectors');
            add(con, G.angleBisector('bi_C', 'A', 'C', 'B', { color: C }), 'bisectors');
            add(con, G.incenter('I', 'A', 'B', 'C', { label: 'I', color: C }), 'bisectors');
          }
        }},
        { key: 'perpbis', label: 'Медіатриси', icon: '⊥∣', apply(con, on) {
          con.removeByTag('perpbis');
          if (on) {
            const C = '#0891b2';
            add(con, G.perpBisector('pb_AB', 'A', 'B', { color: C }), 'perpbis');
            add(con, G.perpBisector('pb_BC', 'B', 'C', { color: C }), 'perpbis');
            add(con, G.perpBisector('pb_CA', 'C', 'A', { color: C }), 'perpbis');
            add(con, G.midpoint('M_pb_AB', 'A', 'B', { size: 3, color: C }), 'perpbis');
            add(con, G.midpoint('M_pb_BC', 'B', 'C', { size: 3, color: C }), 'perpbis');
            add(con, G.midpoint('M_pb_CA', 'C', 'A', { size: 3, color: C }), 'perpbis');
            add(con, G.circumcenter('O_pb', 'A', 'B', 'C', { label: 'O', color: C }), 'perpbis');
          }
        }},
        { key: 'incircle', label: 'Вписане', icon: '◉', apply(con, on) {
          con.removeByTag('incircle');
          if (on) {
            const C = '#ea580c';
            add(con, G.incircle('inc', 'A', 'B', 'C', { color: C, fill: 'circle' }), 'incircle');
            add(con, G.incenter('I_in', 'A', 'B', 'C', { label: 'I', color: C }), 'incircle');
          }
        }},
        { key: 'circumcircle', label: 'Описане', icon: '◎', apply(con, on) {
          con.removeByTag('circumcircle');
          if (on) {
            const C = '#2563eb';
            add(con, G.circumcircle('circ', 'A', 'B', 'C', { color: C }), 'circumcircle');
            add(con, G.circumcenter('O', 'A', 'B', 'C', { label: 'O', color: C }), 'circumcircle');
          }
        }},
        { key: 'midline', label: 'Сер. лінії', icon: '═', apply(con, on) {
          // Три середні лінії — кожна сполучає середини двох сторін і паралельна
          // третій стороні. Утворюють "середній трикутник" (Варіньон-аналог для △).
          // Це повноцінна теорема про середню лінію (×3), а не одна лінія.
          con.removeByTag('midline');
          if (on) {
            const C = '#ca8a04';
            add(con, G.midpoint('M_AB', 'A', 'B', { size: 4, color: C, label: 'M₁' }), 'midline');
            add(con, G.midpoint('M_BC', 'B', 'C', { size: 4, color: C, label: 'M₂' }), 'midline');
            add(con, G.midpoint('M_CA', 'C', 'A', { size: 4, color: C, label: 'M₃' }), 'midline');
            // паралельна BC (з'єднує середини AB та AC)
            add(con, G.segment('mid_a', 'M_AB', 'M_CA', { style: 'dashed', width: 2, color: C }), 'midline');
            // паралельна CA (з'єднує середини AB та BC)
            add(con, G.segment('mid_b', 'M_AB', 'M_BC', { style: 'dashed', width: 2, color: C }), 'midline');
            // паралельна AB (з'єднує середини BC та CA)
            add(con, G.segment('mid_c', 'M_BC', 'M_CA', { style: 'dashed', width: 2, color: C }), 'midline');
          }
        }},
      ],
    },

    // ========================================================================
    circle: {
      name: 'Коло',
      meta: 'центр · точки · хорда',
      defaults: { showGrid: false },
      build(con) {
        add(con, G.free('O', 0, 0, { label: 'O', labelOffset: { x: 9, y: 4 } }));
        add(con, G.free('R', 2.4, 0, { label: 'R', labelOffset: { x: 10, y: -8 } }));
        add(con, G.circle('k', 'O', 'R', { fill: 'circle', width: 1.8 }));
        add(con, G.segment('OR', 'O', 'R', { style: 'dashed-accent' }));
        add(con, G.lengthLabel('lab_R', 'OR', { prefix: 'R = ' }));
        add(con, G.formula('eq', (r) => {
          const O = r.get('O'), R = r.get('R');
          const u = window.Geo2D.util;
          const rad = u.dist(O, R);
          return 'R = ' + u.fmt(rad, 2) + '   C = ' + u.fmt(2 * Math.PI * rad, 2) + '   S = ' + u.fmt(Math.PI * rad * rad, 2);
        }, { anchor: 'bl' }));
      },
      toggles: [
        { key: 'diameter', label: 'Діаметр', icon: '⌀', apply(con, on) {
          con.removeByTag('diameter');
          if (on) {
            // antipode point — derived (compute reflection through O)
            const dia = {
              id: 'R_op', kind: 'point', x: 0, y: 0, deps: ['O', 'R'], style: 'derived',
              compute(reg) {
                const O = reg.get('O'), R = reg.get('R');
                this.x = 2 * O.x - R.x; this.y = 2 * O.y - R.y;
              },
              label: "R'", labelOffset: { x: -12, y: -10 }, size: 5,
            };
            add(con, dia, 'diameter');
            add(con, G.segment('diam', 'R', 'R_op', { width: 1.8 }), 'diameter');
          }
        }},
        { key: 'chord', label: 'Хорда', icon: '/', apply(con, on) {
          con.removeByTag('chord');
          if (on) {
            const S = G.onCircle('S', 'k', 2.0);
            S.label = 'S'; S.labelOffset = { x: 10, y: -8 };
            add(con, S, 'chord');
            add(con, G.segment('chRS', 'R', 'S', { style: 'solid', width: 1.8, color: 'accent' }), 'chord');
            add(con, G.lengthLabel('lab_RS', 'chRS', { prefix: '|RS|=' }), 'chord');
            add(con, G.midpoint('M_RS', 'R', 'S', { size: 4 }), 'chord');
            add(con, G.segment('OM', 'O', 'M_RS', { style: 'dashed-accent' }), 'chord');
            add(con, G.rightAngle('rmark', 'R', 'M_RS', 'O', { sizePx: 10 }), 'chord');
          }
        }},
        { key: 'tangent', label: 'Дотична', icon: '─', apply(con, on) {
          con.removeByTag('tangent');
          if (on) {
            // tangent at R: perpendicular to OR through R
            add(con, G.perpLine('tan', 'R', 'OR', { width: 1.8, style: 'solid', color: 'accent' }), 'tangent');
            add(con, G.rightAngle('tan_r', 'O', 'R', 'R_helper_tangent', { sizePx: 10 }), 'tangent');
            // For the right-angle mark we need a 3rd point along the tangent direction; create derived helper
            const hp = {
              id: 'R_helper_tangent', kind: 'point', x: 0, y: 0, deps: ['O', 'R'], style: 'derived', size: 0, label: null, hidden: true,
              compute(reg) {
                const O = reg.get('O'), R = reg.get('R');
                const dx = R.x - O.x, dy = R.y - O.y;
                this.x = R.x - dy; this.y = R.y + dx;
              },
            };
            // insert hp BEFORE the rightAngle uses it: simplest — remove and re-add right angle
            con.remove('R_helper_tangent');
            con.remove('tan_r');
            // re-add helper, then mark
            add(con, hp, 'tangent');
            add(con, G.rightAngle('tan_r', 'O', 'R', 'R_helper_tangent', { sizePx: 10 }), 'tangent');
          }
        }},
        { key: 'inscribed', label: 'Вписаний кут', icon: '∢', apply(con, on) {
          con.removeByTag('inscribed');
          if (on) {
            // two endpoints on circle + apex on circle → inscribed angle theorem
            const P = G.onCircle('P1', 'k', 2.3); P.label = 'P'; P.labelOffset = { x: 10, y: -8 };
            const Q = G.onCircle('Q1', 'k', -1.2); Q.label = 'Q'; Q.labelOffset = { x: 10, y: -8 };
            const T = G.onCircle('T1', 'k', 0.8); T.label = 'T'; T.labelOffset = { x: 10, y: -8 };
            add(con, P, 'inscribed');
            add(con, Q, 'inscribed');
            add(con, T, 'inscribed');
            add(con, G.segment('TP', 'T1', 'P1', { color: 'accent' }), 'inscribed');
            add(con, G.segment('TQ', 'T1', 'Q1', { color: 'accent' }), 'inscribed');
            add(con, G.segment('OP', 'O', 'P1', { style: 'dashed' }), 'inscribed');
            add(con, G.segment('OQ', 'O', 'Q1', { style: 'dashed' }), 'inscribed');
            add(con, G.angleArc('ang_T', 'P1', 'T1', 'Q1', { rPx: 26, label: '∠' }), 'inscribed');
            add(con, G.angleArc('ang_O', 'P1', 'O', 'Q1', { rPx: 22, label: '2∠' }), 'inscribed');
          }
        }},
      ],
    },

    // ========================================================================
    polygon: {
      name: 'Чотирикутник',
      meta: '4 вершини · діагоналі',
      defaults: { showGrid: false },
      build(con) {
        add(con, G.free('A', -2.4, -1.6, { label: 'A', labelOffset: { x: -14, y: 6 } }));
        add(con, G.free('B', 2.6, -2.0, { label: 'B', labelOffset: { x: 10, y: 6 } }));
        add(con, G.free('C', 2.2, 1.8, { label: 'C', labelOffset: { x: 10, y: -10 } }));
        add(con, G.free('D', -2.0, 1.4, { label: 'D', labelOffset: { x: -14, y: -10 } }));
        add(con, G.polygon('quad', ['A', 'B', 'C', 'D']));
        add(con, G.segment('AB', 'A', 'B'));
        add(con, G.segment('BC', 'B', 'C'));
        add(con, G.segment('CD', 'C', 'D'));
        add(con, G.segment('DA', 'D', 'A'));
        add(con, G.formula('eq', (r) => {
          const A = r.get('A'), B = r.get('B'), C = r.get('C'), D = r.get('D');
          const u = window.Geo2D.util;
          const S = Math.abs(u.polygonArea([A, B, C, D]));
          const p = u.dist(A, B) + u.dist(B, C) + u.dist(C, D) + u.dist(D, A);
          return 'S = ' + u.fmt(S, 2) + '   P = ' + u.fmt(p, 2);
        }, { anchor: 'bl' }));
      },
      toggles: [
        { key: 'sides', label: 'Сторони', icon: '∣', default: true, apply(con, on) {
          con.removeByTag('sides');
          if (on) {
            add(con, G.lengthLabel('lab_AB', 'AB'), 'sides');
            add(con, G.lengthLabel('lab_BC', 'BC'), 'sides');
            add(con, G.lengthLabel('lab_CD', 'CD'), 'sides');
            add(con, G.lengthLabel('lab_DA', 'DA'), 'sides');
          }
        }},
        { key: 'diagonals', label: 'Діагоналі', icon: '╳', apply(con, on) {
          con.removeByTag('diagonals');
          if (on) {
            add(con, G.segment('AC', 'A', 'C', { style: 'dashed-accent' }), 'diagonals');
            add(con, G.segment('BD', 'B', 'D', { style: 'dashed-accent' }), 'diagonals');
            // intersection of two diagonals
            const P = G.intersectLL('PIN', 'AC', 'BD', { label: 'P', size: 4 });
            add(con, P, 'diagonals');
          }
        }},
        { key: 'angles', label: 'Кути', icon: '∠', apply(con, on) {
          con.removeByTag('angles');
          if (on) {
            add(con, G.angleArc('aA', 'D', 'A', 'B', { rPx: 20 }), 'angles');
            add(con, G.angleArc('aB', 'A', 'B', 'C', { rPx: 20 }), 'angles');
            add(con, G.angleArc('aC', 'B', 'C', 'D', { rPx: 20 }), 'angles');
            add(con, G.angleArc('aD', 'C', 'D', 'A', { rPx: 20 }), 'angles');
          }
        }},
        { key: 'midpoints', label: 'Варіньон', icon: '◇', apply(con, on) {
          con.removeByTag('midpoints');
          if (on) {
            add(con, G.midpoint('M1', 'A', 'B', { size: 4 }), 'midpoints');
            add(con, G.midpoint('M2', 'B', 'C', { size: 4 }), 'midpoints');
            add(con, G.midpoint('M3', 'C', 'D', { size: 4 }), 'midpoints');
            add(con, G.midpoint('M4', 'D', 'A', { size: 4 }), 'midpoints');
            add(con, G.polygon('var', ['M1', 'M2', 'M3', 'M4'], { fill: 'face' }), 'midpoints');
            add(con, G.segment('m12', 'M1', 'M2', { style: 'dashed-accent' }), 'midpoints');
            add(con, G.segment('m23', 'M2', 'M3', { style: 'dashed-accent' }), 'midpoints');
            add(con, G.segment('m34', 'M3', 'M4', { style: 'dashed-accent' }), 'midpoints');
            add(con, G.segment('m41', 'M4', 'M1', { style: 'dashed-accent' }), 'midpoints');
          }
        }},
        // Описане коло — існує лише якщо чотирикутник cyclic (∠A + ∠C = 180°).
        // Малюємо коло через A, B, C (унікальне); live label показує відстань
        // від D до цього кола. Drag D на коло → бачиш cyclic config.
        { key: 'circumscribed', label: 'Описане ?', icon: '◎', apply(con, on) {
          con.removeByTag('circumscribed');
          if (on) {
            const C = '#2563eb';
            add(con, G.circumcenter('Oc', 'A', 'B', 'C', { label: 'O', color: C, size: 4 }), 'circumscribed');
            add(con, G.circumcircle('circ_abc', 'A', 'B', 'C', { color: C, width: 1.5, style: 'dashed' }), 'circumscribed');
            add(con, G.formula('cyclic_diff', (r) => {
              const O = r.get('Oc'), A = r.get('A'), D = r.get('D');
              const u = window.Geo2D.util;
              const radius = u.dist(O, A);
              const dist_OD = u.dist(O, D);
              const diff = dist_OD - radius;
              const status = Math.abs(diff) < 0.05 ? '✓ вписаний (cyclic)' : (diff > 0 ? 'D назовні' : 'D всередині');
              return 'D − коло: ' + u.fmt(diff, 2) + '  · ' + status;
            }, { anchor: 'tr' }), 'circumscribed');
          }
        }},
        // Pitot: вписане коло (тангентний 4-кутник) існує ⇔ AB+CD = BC+DA.
        // Без числового solver-а малюємо лише live умову — drag сторони щоб
        // вирівняти суми, тоді incircle існує (геометрично).
        { key: 'pitot', label: 'Pitot ?', icon: '◉', apply(con, on) {
          con.removeByTag('pitot');
          if (on) {
            add(con, G.formula('pitot_eq', (r) => {
              const A = r.get('A'), B = r.get('B'), Cp = r.get('C'), Dp = r.get('D');
              const u = window.Geo2D.util;
              const ab = u.dist(A, B), cd = u.dist(Cp, Dp);
              const bc = u.dist(B, Cp), da = u.dist(Dp, A);
              const lhs = ab + cd, rhs = bc + da;
              const diff = Math.abs(lhs - rhs);
              const ok = diff < 0.05 ? '✓ дотичний (можна вписати)' : '✗';
              return 'AB+CD = ' + u.fmt(lhs, 2) + ' · BC+DA = ' + u.fmt(rhs, 2) + ' · ' + ok;
            }, { anchor: 'tr' }), 'pitot');
          }
        }},
        // Cyclic кутова умова: ∠A + ∠C = 180° та ∠B + ∠D = 180°. Альтернативний
        // тест cyclic-config (часто учні впізнають кутами легше ніж відстанями).
        { key: 'angles_opposite', label: '∠A+∠C', icon: '∠∠', apply(con, on) {
          con.removeByTag('angles_opposite');
          if (on) {
            add(con, G.formula('opp_angles', (r) => {
              const A = r.get('A'), B = r.get('B'), Cp = r.get('C'), Dp = r.get('D');
              const u = window.Geo2D.util;
              const angA = u.angleBetween(Dp, A, B) * 180 / Math.PI;
              const angC = u.angleBetween(B, Cp, Dp) * 180 / Math.PI;
              const sum = angA + angC;
              const ok = Math.abs(sum - 180) < 2 ? '✓ cyclic' : '';
              return '∠A + ∠C = ' + u.fmt(sum, 1) + '°  ' + ok;
            }, { anchor: 'bl' }), 'angles_opposite');
          }
        }},
      ],
    },

    // ========================================================================
    pythagoras: {
      name: 'Піфагор',
      meta: 'c² = a² + b²',
      defaults: { showGrid: true, showAxes: true },
      build(con) {
        // Vertex C — right angle at origin (fixed). A on +y axis. B on +x axis.
        // Triangle traversed C → B → A is CCW (so right-hand normals point outward).
        add(con, { id: 'C', kind: 'point', x: 0, y: 0, deps: [], movable: false, label: 'C', labelOffset: { x: -14, y: 14 }, size: 5, style: 'free' });
        add(con, G.onAxis('B', 3, 0, 'x', { label: 'B', labelOffset: { x: 10, y: 14 } }));
        add(con, G.onAxis('A', 0, 2.4, 'y', { label: 'A', labelOffset: { x: -14, y: -10 } }));
        // clamp legs to stay positive
        const B = con.get('B'), A = con.get('A');
        const origSetB = B.setTo, origSetA = A.setTo;
        B.setTo = function (mx) { origSetB.call(this, Math.max(0.5, mx), 0); };
        A.setTo = function (mx, my) { origSetA.call(this, 0, Math.max(0.5, my)); };
        add(con, G.polygon('tri', ['C', 'B', 'A']));
        // sides: a = opposite vertex A (i.e. CB), b = opposite B (i.e. AC), c = hypotenuse AB
        add(con, G.segment('side_a', 'C', 'B', { width: 2 }));
        add(con, G.segment('side_b', 'A', 'C', { width: 2 }));
        add(con, G.segment('side_c', 'B', 'A', { width: 2 }));
        add(con, G.rightAngle('rC', 'B', 'C', 'A', { sizePx: 12 }));
        // squares — built outward (right-hand normal works because polygon is CCW)
        add(con, G.squareOut('sq_a', 'C', 'B', { color: 'a' }));
        add(con, G.squareOut('sq_b', 'A', 'C', { color: 'b' }));
        add(con, G.squareOut('sq_c', 'B', 'A', { color: 'c' }));
        add(con, G.lengthLabel('lab_a', 'side_a', { prefix: 'a=' }));
        add(con, G.lengthLabel('lab_b', 'side_b', { prefix: 'b=' }));
        add(con, G.lengthLabel('lab_c', 'side_c', { prefix: 'c=' }));
        add(con, G.formula('eq', (r) => {
          const A = r.get('A'), B = r.get('B'), C = r.get('C');
          const u = window.Geo2D.util;
          const a = u.dist(B, C), b = u.dist(A, C), c = u.dist(A, B);
          return [
            'a² + b² = ' + u.fmt(a * a, 2) + ' + ' + u.fmt(b * b, 2) + ' = ' + u.fmt(a * a + b * b, 2),
            'c² = ' + u.fmt(c * c, 2),
          ].join('\n');
        }, { anchor: 'tr' }));
      },
      toggles: [
        { key: 'squares', label: 'Квадрати', icon: '▣', default: true, apply(con, on) {
          ['sq_a', 'sq_b', 'sq_c'].forEach((id) => { const o = con.get(id); if (o) o.hidden = !on; });
        }},
        { key: 'lengths', label: 'Довжини', icon: '∣', default: true, apply(con, on) {
          ['lab_a', 'lab_b', 'lab_c'].forEach((id) => { const o = con.get(id); if (o) o.hidden = !on; });
        }},
        { key: 'angles', label: 'Кути', icon: '∠', apply(con, on) {
          con.removeByTag('pang');
          if (on) {
            add(con, G.angleArc('aB', 'A', 'B', 'C', { rPx: 24 }), 'pang');
            add(con, G.angleArc('aA', 'C', 'A', 'B', { rPx: 24 }), 'pang');
          }
        }},
      ],
    },

    // ========================================================================
    thales: {
      name: 'Фалес',
      meta: 'паралельні · пропорції',
      defaults: { showGrid: false },
      build(con) {
        // 3 parallel lines, defined by an anchor point on each + a shared direction.
        // Direction defined by 2 free points P, Q on first line (line2 controlled by L position).
        // Two transversals through fixed pivots S1, S2.
        // Simplification: 3 horizontal-ish parallels at y = 0, y = -2, y = -4 (movable),
        // direction = "from anchor1 to anchor1+d", where d is set by dragging anchor2.
        add(con, G.free('A', -3, 2, { label: 'A', labelOffset: { x: -14, y: -10 } }));
        add(con, G.free('B', -1.5, 0, { label: 'B', labelOffset: { x: -14, y: -10 } }));
        add(con, G.free('C', 0, -2, { label: 'C', labelOffset: { x: -14, y: -10 } }));
        add(con, G.free('A1', 3, 1.5, { label: 'A₁', labelOffset: { x: 10, y: -10 } }));
        // B1, C1 derived: through B parallel to AA1; intersect transversal CA1 with parallel through B... too complex.
        // Cleaner: define direction via A→A1 as the "parallels direction".
        // 3 parallel lines: line_a through A, line_b through B, line_c through C, all parallel to A→A1.
        // Two transversals: t1 = line through A and B (already a transversal if we pick wisely)
        //                   t2 = line through A1 and (some derived point on parallel through B).
        // Even cleaner: only 1 transversal pair, set up like:
        //   parallels horizontal direction = A→A1 (drag A1 to rotate all parallels around their anchors)
        //   transversal 1: line through A and C (passes through anchors of top and bottom parallels)
        //   transversal 2: line through A1 and a free point C1 on bottom parallel
        // Derived:
        //   B1 = intersection of transversal2 with parallel through B
        // Ratios: AB/BC vs A1B1/B1C1
        // line through B parallel to (A,A1): use parLine constructor (B + direction A→A1).
        // We'll store a virtual "ref" segment AA1 to define direction.
        add(con, G.segment('refDir', 'A', 'A1', { hidden: true }));
        // parallels themselves
        add(con, G.parLine('par_A', 'A', 'refDir', { style: 'solid', width: 1.6 }));
        add(con, G.parLine('par_B', 'B', 'refDir', { style: 'solid', width: 1.6 }));
        add(con, G.parLine('par_C', 'C', 'refDir', { style: 'solid', width: 1.6 }));
        // Transversal 1: through A, B, C (we draw a long line from A through C; if user drags them off, won't be exact — instead transversal1 is itself a segment ABC.
        // Better: transversal1 = segment through A and the projection... user-controlled by ABC's positions; we'll just draw segment from A to C; B is forced to lie on it via constraint.
        // Constrain B: make it onLine(A, C) — change its kind. But B is also defining the parallel through B. OK, fine: B on segment AC.
        // Replace B with on-line constraint.
        con.remove('B');
        const Bon = G.onLine('B', 'A', 'C', 0.5, { label: 'B', labelOffset: { x: -14, y: -10 } });
        // Insert B BEFORE par_B in order. Easier: rebuild order — remove later objects, re-add.
        // Simpler: add B then remove+re-add the par_B and subsequent ones.
        ['par_A', 'par_B', 'par_C'].forEach((id) => con.remove(id));
        add(con, Bon);
        add(con, G.parLine('par_A', 'A', 'refDir', { style: 'solid', width: 1.6 }));
        add(con, G.parLine('par_B', 'B', 'refDir', { style: 'solid', width: 1.6 }));
        add(con, G.parLine('par_C', 'C', 'refDir', { style: 'solid', width: 1.6 }));
        // Now: transversal 2 — through A1 + a draggable second pt anchor on par_C
        add(con, G.free('C1', 3, -1.8, { label: 'C₁', labelOffset: { x: 10, y: -10 } }));
        // Constrain C1 onto par_C: instead make a derived point — intersection of line A1-Cdrag with par_C.
        // Keep C1 free for now; just draw A1->C1 transversal. Then B1 = intersection of A1C1 with par_B.
        add(con, G.segment('trans1', 'A', 'C', { style: 'solid', width: 1.6, color: 'accent' }));
        add(con, G.segment('trans2', 'A1', 'C1', { style: 'solid', width: 1.6, color: 'accent' }));
        // B1 = intersect(trans2, par_B)
        add(con, G.intersectLL('B1', 'trans2', 'par_B', { label: 'B₁', labelOffset: { x: 10, y: -10 } }));
        // Distance labels
        add(con, G.distanceLine('d_AB', 'A', 'B', { prefix: 'AB=' }));
        add(con, G.distanceLine('d_BC', 'B', 'C', { prefix: 'BC=' }));
        add(con, G.distanceLine('d_A1B1', 'A1', 'B1', { prefix: 'A₁B₁=' }));
        add(con, G.distanceLine('d_B1C1', 'B1', 'C1', { prefix: 'B₁C₁=' }));
        add(con, G.formula('eq', (r) => {
          const A = r.get('A'), B = r.get('B'), C = r.get('C'), A1 = r.get('A1'), B1 = r.get('B1'), C1 = r.get('C1');
          const u = window.Geo2D.util;
          const k1 = u.dist(A, B) / u.dist(B, C);
          const k2 = u.dist(A1, B1) / u.dist(B1, C1);
          return ['AB / BC   = ' + u.fmt(k1, 3), 'A₁B₁ / B₁C₁ = ' + u.fmt(k2, 3)].join('\n');
        }, { anchor: 'bl' }));
      },
      toggles: [
        { key: 'measures', label: 'Виміри', icon: '↔', default: true, apply(con, on) {
          ['d_AB', 'd_BC', 'd_A1B1', 'd_B1C1'].forEach((id) => { const o = con.get(id); if (o) o.hidden = !on; });
        }},
      ],
    },

  };

  window.Geo2D.PRESETS = PRESETS;
})();

// grapher-3d-engine.js — GraphMASH 3D Engine v0.2
// Full product engine: surfaces, curves, points, color maps, animation, export
// Requires: three@0.160 via importmap, window.GraphCalc from grapher-engine.js
import * as THREE from 'three';
import { OrbitControls }  from 'three/addons/controls/OrbitControls.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { GLTFExporter }   from 'three/addons/exporters/GLTFExporter.js';
import { STLExporter }    from 'three/addons/exporters/STLExporter.js';
import { Line2 }                from 'three/addons/lines/Line2.js';
import { LineSegments2 }        from 'three/addons/lines/LineSegments2.js';
import { LineGeometry }         from 'three/addons/lines/LineGeometry.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial }         from 'three/addons/lines/LineMaterial.js';
// Note: Three.js MarchingCubes requires addBall() to populate seq — not suitable
// for direct field writing. We use our own Marching Tetrahedra instead.

// ── Color maps ────────────────────────────────────────────────────────────────
const CM_STOPS = {
  viridis: [[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]],
  jet:     [[0,0,143],[0,0,255],[0,127,255],[0,255,255],[127,255,127],[255,255,0],[255,127,0],[255,0,0]],
  cool:    [[0,255,255],[255,0,255]],
  warm:    [[255,255,0],[255,64,0]],
  grey:    [[200,200,200],[40,40,40]],
};
export const COLOR_MAPS = Object.keys(CM_STOPS);

function lerpStop(stops, t) {
  t = Math.max(0, Math.min(1, t));
  const n = stops.length - 1;
  const i = Math.min(Math.floor(t * n), n - 1);
  const f = t * n - i;
  const a = stops[i], b = stops[i + 1];
  return new THREE.Color(
    (a[0] + (b[0] - a[0]) * f) / 255,
    (a[1] + (b[1] - a[1]) * f) / 255,
    (a[2] + (b[2] - a[2]) * f) / 255);
}

function applyColorMap(geom, zValues, zMin, zMax, mapName) {
  const n = zValues.length;
  const arr = new Float32Array(n * 3);
  const stops = CM_STOPS[mapName] || CM_STOPS.viridis;
  const range = (zMax - zMin) || 1;
  for (let i = 0; i < n; i++) {
    const c = lerpStop(stops, (zValues[i] - zMin) / range);
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geom.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
}

// ── AST→JS compiler (Полір-1) ─────────────────────────────────────────────────
// Компілює чисту арифметику + білий список функцій у нативну JS-функцію.
// Все, що не покрито (piecewise, user funcs, неоднозначний log) → null,
// і викликач падає назад на evalAst.
const COMPILE_VARS = ['x','y','z','t','s','u','v','th','ph','rh'];
const CV_ALIAS = { theta:'th', 'θ':'th', phi:'ph', 'φ':'ph', rho:'rh', 'ρ':'rh',
                   x:'x', y:'y', z:'z', t:'t', s:'s', u:'u', v:'v' };
function compileAst(ast) {
  const M1 = { sin:'Math.sin', cos:'Math.cos', tan:'Math.tan', asin:'Math.asin',
    acos:'Math.acos', atan:'Math.atan', arcsin:'Math.asin', arccos:'Math.acos',
    arctan:'Math.atan', sinh:'Math.sinh', cosh:'Math.cosh', tanh:'Math.tanh',
    sqrt:'Math.sqrt', abs:'Math.abs', exp:'Math.exp', floor:'Math.floor',
    ceil:'Math.ceil', round:'Math.round', sign:'Math.sign', ln:'Math.log' };
  const KC = { pi: 'Math.PI', e: 'Math.E', tau: '(2*Math.PI)' };
  let ok = true;
  const gen = (n) => {
    if (!ok || !n) { ok = false; return '0'; }
    switch (n.kind) {
      case 'num': return '(' + n.v + ')';
      case 'ident': {
        if (CV_ALIAS[n.name]) return CV_ALIAS[n.name];
        if (KC[n.name]) return KC[n.name];
        if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(n.name)) return 'E["' + n.name + '"]';
        ok = false; return '0';
      }
      case 'unary': return '(-' + gen(n.arg) + ')';
      case 'binop': {
        const l = gen(n.left), r = gen(n.right);
        if (n.op === '^') return 'Math.pow(' + l + ',' + r + ')';
        if (n.op === '+' || n.op === '-' || n.op === '*' || n.op === '/')
          return '(' + l + n.op + r + ')';
        ok = false; return '0';
      }
      case 'call': {
        const a = n.args || [];
        if (M1[n.name] && a.length === 1) return M1[n.name] + '(' + gen(a[0]) + ')';
        if ((n.name === 'min' || n.name === 'max') && a.length >= 2)
          return 'Math.' + n.name + '(' + a.map(gen).join(',') + ')';
        if (n.name === 'atan2' && a.length === 2)
          return 'Math.atan2(' + gen(a[0]) + ',' + gen(a[1]) + ')';
        if (n.name === 'pow' && a.length === 2)
          return 'Math.pow(' + gen(a[0]) + ',' + gen(a[1]) + ')';
        if (n.name === 'cot') return '(1/Math.tan(' + gen(a[0]) + '))';
        if (n.name === 'sec') return '(1/Math.cos(' + gen(a[0]) + '))';
        if (n.name === 'csc') return '(1/Math.sin(' + gen(a[0]) + '))';
        if (n.name === 'mod' && a.length === 2) {
          const p = gen(a[0]), q = gen(a[1]);
          return '((((' + p + ')%(' + q + '))+(' + q + '))%(' + q + '))';
        }
        ok = false; return '0';
      }
      default: ok = false; return '0';
    }
  };
  const src = gen(ast);
  if (!ok) return null;
  try {
    const fn = new Function(...COMPILE_VARS, 'E', '"use strict"; return (' + src + ');');
    fn.__src = src; // для передачі у worker (№23)
    return fn;
  } catch (_) { return null; }
}
const _compileCache = new WeakMap();
function compiledOf(ast) {
  if (!ast || typeof ast !== 'object') return null;
  if (_compileCache.has(ast)) return _compileCache.get(ast);
  const fn = compileAst(ast);
  _compileCache.set(ast, fn);
  return fn;
}

// ── Classifier ────────────────────────────────────────────────────────────────
function splitTop(str, sep) {
  const out = []; let depth = 0, s = 0;
  for (let i = 0; i < str.length; i++) {
    if ('([{'.includes(str[i])) depth++;
    else if (')]}'.includes(str[i])) depth--;
    else if (str[i] === sep && !depth) { out.push(str.slice(s, i).trim()); s = i + 1; }
  }
  out.push(str.slice(s).trim()); return out;
}

function parseTuple(src) {
  const s = src.trim();
  if (!s.startsWith('(') || !s.endsWith(')')) return null;
  const parts = splitTop(s.slice(1, -1), ',');
  if (parts.length < 2 || parts.length > 3) return null;
  try { return parts.map(p => window.GraphCalc.parse(p.trim())); } catch (_) { return null; }
}

export function classify3D(src, paramNames = []) {
  const GC = window.GraphCalc;
  if (!GC) return { kind: 'invalid', src, error: 'GraphCalc not loaded' };
  const { parse, freeVars, CONSTS } = GC;
  const paramSet = new Set(paramNames);
  const consts = new Set(Object.keys(CONSTS || {}));

  try {
    const s = src.trim();

    // 0. Заголовок групи: "# Назва"
    if (s.startsWith('#'))
      return { kind: 'header', text: s.slice(1).trim(), src };

    // 0. div(F) / curl(F) — векторний аналіз
    if (/^(div|curl)\s*\(/.test(s)) {
      let inner = s.slice(s.indexOf('(') + 1, s.lastIndexOf(')')).trim();
      if (/^(field|vector|V)\s*\(/.test(inner))
        inner = inner.slice(inner.indexOf('('));
      const tuple = parseTuple(inner.startsWith('(') ? inner : '(' + inner + ')');
      if (tuple && tuple.length === 3)
        return { kind: s.startsWith('div') ? 'div3D' : 'curl3D',
                 xAst: tuple[0], yAst: tuple[1], zAst: tuple[2], src };
      return { kind: 'invalid', src, error: 'div(fx,fy,fz) | curl(fx,fy,fz)' };
    }

    // 0. V(...) / vector(...) / field(...) — canonical vector & field syntax
    if (/^([Vv]\w*|field)\s*\(/.test(s)) {
      const pi = s.indexOf('(');
      const tuple = parseTuple(s.slice(pi));
      if (tuple && tuple.length === 3) {
        const [xA, yA, zA] = tuple;
        const free = new Set([...freeVars(xA), ...freeVars(yA), ...freeVars(zA)]);
        const realFree = [...free].filter(v => !paramSet.has(v) && !consts.has(v));
        return { kind: 'vectorField3D', xAst: xA, yAst: yA, zAst: zA,
                 isStatic: realFree.length === 0, src };
      }
      // vector(P, Q) — стрілка від точки P до точки Q
      const parts = splitTop(s.slice(pi + 1, s.lastIndexOf(')')), ',');
      if (parts.length === 2 && parts[0].trim().startsWith('(') && parts[1].trim().startsWith('(')) {
        const P = parseTuple(parts[0].trim()), Q = parseTuple(parts[1].trim());
        if (P && Q && P.length === 3 && Q.length === 3)
          return { kind: 'vectorAnchored3D', pAsts: P, qAsts: Q, src };
      }
    }

    // 0.6 Special calls: flow(...), mandelbulb(n), lsystem3d(...)
    if (/^flow\s*\(/.test(s)) {
      const tuple = parseTuple(s.slice(s.indexOf('(')));
      if (tuple && tuple.length === 3)
        return { kind: 'flow3D', xAst: tuple[0], yAst: tuple[1], zAst: tuple[2], src };
    }
    if (/^mandelbulb\s*\(/.test(s)) {
      try {
        const ast = parse(s);
        if (ast.kind === 'call') return { kind: 'mandelbulb3D', args: ast.args, src };
      } catch(_) {}
      return { kind: 'mandelbulb3D', args: [], src };
    }
    if (/^lsystem3d\s*\(/.test(s)) {
      try {
        const ast = parse(s);
        if (ast.kind === 'call') return { kind: 'lsystem3D', args: ast.args, src };
      } catch(_) {}
    }

    // 0.62 levelset(f, c) → implicit3D (той самий MT-worker пайплайн)
    if (/^levelset\s*\(/.test(s)) {
      const parts = splitTop(s.slice(s.indexOf('(') + 1, s.lastIndexOf(')')), ',');
      if (parts.length === 2) {
        try { return { kind: 'implicit3D', lhsAst: parse(parts[0]), rhsAst: parse(parts[1]), src }; }
        catch (e) { return { kind: 'invalid', src, error: e.message }; }
      }
      return { kind: 'invalid', src, error: 'levelset(f(x,y,z), c)' };
    }
    // 0.63 contour(f, levels?) — лінії рівня поверхні z=f(x,y)
    if (/^contour\s*\(/.test(s)) {
      const parts = splitTop(s.slice(s.indexOf('(') + 1, s.lastIndexOf(')')), ',');
      try {
        return { kind: 'contour3D', fAst: parse(parts[0]),
                 levelAst: parts[1] ? parse(parts[1]) : null, src };
      } catch (e) { return { kind: 'invalid', src, error: e.message }; }
    }
    // 0.64 critical(f) — критичні точки z=f(x,y)
    if (/^critical\s*\(/.test(s)) {
      try {
        return { kind: 'critical3D',
                 fAst: parse(s.slice(s.indexOf('(') + 1, s.lastIndexOf(')'))), src };
      } catch (e) { return { kind: 'invalid', src, error: e.message }; }
    }
    // 0.66 label("текст", (x,y,z))
    if (/^label\s*\(/.test(s)) {
      const m = s.match(/^label\s*\(\s*"([^"]*)"\s*,\s*(\(.+\))\s*\)$/);
      if (m) {
        const t = parseTuple(m[2]);
        if (t && t.length === 3) return { kind: 'label3D', text: m[1], pAsts: t, src };
      }
      return { kind: 'invalid', src, error: 'label("текст", (x,y,z))' };
    }
    // 0.67 segment(P, Q)
    if (/^segment\s*\(/.test(s)) {
      const parts = splitTop(s.slice(s.indexOf('(') + 1, s.lastIndexOf(')')), ',');
      if (parts.length === 2) {
        const P = parseTuple(parts[0].trim()), Q = parseTuple(parts[1].trim());
        if (P && Q && P.length === 3 && Q.length === 3)
          return { kind: 'segment3D', pAsts: P, qAsts: Q, src };
      }
      return { kind: 'invalid', src, error: 'segment((x,y,z), (x,y,z))' };
    }

    // 0.65 slice(x=c) | slice(y=c) | slice(z=c) | slice(a,b,c,d) — section plane
    if (/^slice\s*\(/.test(s)) {
      const inner = s.slice(s.indexOf('(') + 1, s.lastIndexOf(')'));
      const parts = splitTop(inner, ',');
      try {
        if (parts.length === 1) {
          const eqi = parts[0].indexOf('=');
          if (eqi > 0) {
            const axis = parts[0].slice(0, eqi).trim();
            if (['x','y','z'].includes(axis))
              return { kind: 'slice3D', axis, valAst: parse(parts[0].slice(eqi + 1).trim()), src };
          }
        } else if (parts.length === 4) {
          return { kind: 'slice3D', axis: null, coefAsts: parts.map(p => parse(p)), src };
        }
      } catch (e) { return { kind: 'invalid', src, error: e.message }; }
      return { kind: 'invalid', src, error: 'slice(x=c) | slice(y=c) | slice(z=c) | slice(a,b,c,d)' };
    }

    // 0.7 Math-tool calls: grad, riemann, intersect, tangent
    const CALL_KINDS = { grad: 'gradField3D', riemann: 'riemann3D', intersect: 'intersect3D', tangent: 'tangent3D' };
    const cm = s.match(/^(grad|riemann|intersect|tangent)\s*\(/);
    if (cm) {
      try {
        const ast = parse(s);
        if (ast.kind === 'call' && ast.args && ast.args.length >= 1)
          return { kind: CALL_KINDS[cm[1]], args: ast.args, src };
      } catch(_) {}
    }

    // 1. Plain tuple (a, b, c)
    const tuple = parseTuple(s);
    if (tuple && tuple.length === 3) {
      const [xA, yA, zA] = tuple;
      const free = new Set([...freeVars(xA), ...freeVars(yA), ...freeVars(zA)]);
      const realFree = [...free].filter(v => !paramSet.has(v) && !consts.has(v));
      if (realFree.length === 0) return { kind: 'point3D', xAst: xA, yAst: yA, zAst: zA, src };
      if (free.has('u') || free.has('v')) return { kind: 'surface3D', xAst: xA, yAst: yA, zAst: zA, src };
      if (free.has('t') || free.has('s')) return { kind: 'curve3D', xAst: xA, yAst: yA, zAst: zA, tVar: free.has('t') ? 't' : 's', src };
      if (realFree.some(v => ['x','y','z'].includes(v))) return { kind: 'vectorField3D', xAst: xA, yAst: yA, zAst: zA, src };
      return { kind: 'point3D', xAst: xA, yAst: yA, zAst: zA, src };
    }

    // Parse equation by splitting at '=' — avoids relying on parse() handling '='
    let eqPos = -1;
    for (let i = 1; i < src.length; i++) {
      if (src[i] === '=' && !['<','>','!','='].includes(src[i-1]) && src[i+1] !== '=') { eqPos = i; break; }
    }
    if (eqPos < 0) return { kind: 'invalid', src, error: 'Не знайдено =' };
    const lhsStr = src.slice(0, eqPos).trim();
    const rhsStr = src.slice(eqPos + 1).trim();
    const lhsAst = parse(lhsStr);
    const rhsAst = parse(rhsStr);
    // Function def: f(x,y) = expr
    if (lhsAst.kind === 'call' || lhsAst.kind === 'apply') {
      const name   = lhsAst.name || lhsAst.func || lhsStr.split('(')[0];
      const params = (lhsAst.args || lhsAst.arguments || []).map(a => a.name || String(a));
      // №15: f(x,y) = ... — і функція, і поверхня (як у Desmos 3D)
      const isXY = params.length === 2 && params.includes('x') && params.includes('y');
      return { kind: 'funcDef3D', name, params, ast: rhsAst, src, surface: isXY };
    }
    if (lhsAst.kind === 'ident') {
      const name = lhsAst.name;
      if (name === 'z') return { kind: 'surfaceZ', ast: rhsAst, restrictions: rhsAst.restrictions || [], src };
      const rf = freeVars(rhsAst);
      // Spherical r(θ,φ) / cylindrical ρ(θ,z)
      if (name === 'r' || name === 'rho' || name === 'ρ') {
        if (rf.has('phi') || rf.has('φ'))   return { kind: 'spherical3D',   ast: rhsAst, src };
        if (rf.has('z'))                     return { kind: 'cylindrical3D', ast: rhsAst, src };
        if (rf.has('theta') || rf.has('θ'))  return { kind: (name === 'r') ? 'spherical3D' : 'cylindrical3D', ast: rhsAst, src };
      }
      const SPATIALS = ['x','y','z','t','u','v','s','r','theta','phi','rho'];
      if (!SPATIALS.some(v => rf.has(v)) && !consts.has(name) && !paramSet.has(name))
        return { kind: 'param', name, ast: rhsAst, src };
    }
    // Implicit surface f(x,y,z) = g
    const allFree = new Set([...freeVars(lhsAst), ...freeVars(rhsAst)]);
    if (allFree.has('z') || (allFree.has('x') && allFree.has('y')))
      return { kind: 'implicit3D', lhsAst, rhsAst, src };
    return { kind: 'invalid', src, error: 'Невідомий вираз' };
  } catch (e) {
    return { kind: 'invalid', src, error: e.message };
  }
}

export const PALETTE3D = ['#c74440','#2d70b3','#388c46','#6042a6','#fa7e19','#cf5283','#000000'];

// ── Marching Tetrahedra ────────────────────────────────────────────────────────────────
// Splits each cube into 5 tetrahedra; 16 tet-cases (no ambiguous configs)
const _CV = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
const _CT = [[0,1,2,5],[0,2,3,7],[0,4,5,7],[2,5,6,7],[0,2,5,7]]; // 5 tets/cube
const _TE = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]]; // 6 edges per tet
// Tri lists per tet-case (edge indices 0–5, triplets = 1 triangle each)
const _TT = [
  [],             // 0: none
  [0,1,2],        // 1: a
  [0,3,4],        // 2: b
  [1,3,4,1,4,2],  // 3: ab
  [1,3,5],        // 4: c
  [0,2,5,0,5,3],  // 5: ac
  [0,1,5,0,5,4],  // 6: bc
  [2,5,4],        // 7: abc (=d out)
  [2,4,5],        // 8: d
  [0,4,5,0,5,1],  // 9: ad
  [0,2,5,0,5,3],  // 10: bd
  [1,5,3],        // 11: abd (=c out)
  [1,3,4,1,4,2],  // 12: cd
  [0,4,3],        // 13: acd (=b out)
  [0,2,1],        // 14: bcd (=a out)
  [],             // 15: all
];

function marchingTetrahedra(evalF, range, N) {
  const dx = 2 * range / N, sz = N + 1;
  // Sample (N+1)^3 field once
  const field = new Float32Array(sz * sz * sz);
  for (let iz = 0; iz <= N; iz++)
    for (let iy = 0; iy <= N; iy++)
      for (let ix = 0; ix <= N; ix++)
        field[ix + iy*sz + iz*sz*sz] = evalF(-range+dx*ix, -range+dx*iy, -range+dx*iz);

  const verts = [];
  for (let iz = 0; iz < N; iz++) {
    for (let iy = 0; iy < N; iy++) {
      for (let ix = 0; ix < N; ix++) {
        // Field & world positions at 8 cube corners
        const fv = _CV.map(([vx,vy,vz]) => field[(ix+vx)+(iy+vy)*sz+(iz+vz)*sz*sz]);
        const pv = _CV.map(([vx,vy,vz]) => [-range+dx*(ix+vx), -range+dx*(iy+vy), -range+dx*(iz+vz)]);
        for (const tet of _CT) {
          const [ta,tb,tc,td] = tet;
          const tetCase = (fv[ta]<0?1:0)|(fv[tb]<0?2:0)|(fv[tc]<0?4:0)|(fv[td]<0?8:0);
          const tris = _TT[tetCase]; if (!tris.length) continue;
          const tF = [fv[ta],fv[tb],fv[tc],fv[td]];
          const tP = [pv[ta],pv[tb],pv[tc],pv[td]];
          // Interpolated point on each tet edge
          const ep = _TE.map(([ei,ej]) => {
            const [px,py,pz] = tP[ei], [qx,qy,qz] = tP[ej];
            const d = tF[ei]-tF[ej];
            const t = Math.abs(d)<1e-12 ? 0.5 : Math.max(0,Math.min(1,tF[ei]/d));
            return [px+t*(qx-px), py+t*(qy-py), pz+t*(qz-pz)];
          });
          for (let i = 0; i < tris.length; i += 3) {
            const [ax,ay,az]=ep[tris[i]], [bx,by,bz]=ep[tris[i+1]], [cx,cy,cz]=ep[tris[i+2]];
            // Math(x,y,z) → Three.js(x, z, y)
            verts.push(ax,az,ay, bx,bz,by, cx,cz,cy);
          }
        }
      }
    }
  }
  return new Float32Array(verts);
}

// ── GraphCalculator3D ─────────────────────────────────────────────────────────
export class GraphCalculator3D {
  constructor(container, opts = {}) {
    this.container = container;
    this.expressions = [];
    this.params      = {};
    this._userFuncs  = {};
    this._nextId     = 1;
    this._meshes     = new Map();
    this._destroyed  = false;
    this._animParams = {};
    this.onChange    = null;
    this._fps        = 0;
    this._ortho      = false;
    this._initThree(opts);
    this._buildScene();
    this._loop();
  }

  // ── Setup ───────────────────────────────────────────────────────────────────
  _initThree(opts) {
    const W = this.container.clientWidth  || 800;
    const H = this.container.clientHeight || 600;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf8f8f8);

    // Perspective camera
    this._camPersp = new THREE.PerspectiveCamera(50, W / H, 0.01, 500);
    this._camPersp.position.set(6, 4, 8);
    this._camPersp.lookAt(0, 0, 0); // ← required before OrbitControls init
    const aspect = W / H;
    this._camOrtho = new THREE.OrthographicCamera(-6*aspect, 6*aspect, 6, -6, 0.01, 500);
    this._camOrtho.position.set(6, 4, 8);
    this._camOrtho.lookAt(0, 0, 0);
    this.camera = this._camPersp;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(W, H);
    this.renderer.shadowMap.enabled = false;
    this.container.appendChild(this.renderer.domElement);

    this.controls = this._makeControls(this.camera);

    // Deferred resize — container may not have final size at constructor time
    setTimeout(() => {
      const W2 = this.container.clientWidth, H2 = this.container.clientHeight;
      if (!W2 || !H2) return;
      this._camPersp.aspect = W2 / H2;
      this._camPersp.updateProjectionMatrix();
      const a2 = W2 / H2;
      this._camOrtho.left = -6*a2; this._camOrtho.right = 6*a2;
      this._camOrtho.updateProjectionMatrix();
      this.renderer.setSize(W2, H2);
    }, 100);

    this._ro = new ResizeObserver(() => {
      const W2 = this.container.clientWidth, H2 = this.container.clientHeight;
      if (!W2 || !H2) return;
      this._camPersp.aspect = W2 / H2;
      this._camPersp.updateProjectionMatrix();
      const a2 = W2 / H2;
      this._camOrtho.left = -6 * a2; this._camOrtho.right = 6 * a2;
      this._camOrtho.updateProjectionMatrix();
      this.renderer.setSize(W2, H2);
      this.controls.handleResize && this.controls.handleResize();
      this._fatMats && this._fatMats.forEach(m => m.resolution.set(W2, H2));
    });
    this._ro.observe(this.container);

    // FPS tracking
    this._fpsTimer = 0; this._fpsFrames = 0;
    this._lastT = performance.now();
  }

  _makeControls(camera) {
    // TrackballControls — unrestricted rotation on ALL axes (like Desmos 3D)
    const c = new TrackballControls(camera, this.renderer.domElement);
    c.rotateSpeed = 3.0;
    c.zoomSpeed   = 1.4;
    c.panSpeed    = 0.8;
    c.dynamicDampingFactor = 0.12;
    c.minDistance = 0.3;
    c.maxDistance = 100;
    return c;
  }

  _buildScene() {
    // 3-point studio lighting for smooth PBR surfaces
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(6, 14, 8); this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xd0e8ff, 0.55);
    fill.position.set(-8, 4, -6); this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xfff8ee, 0.35);
    rim.position.set(0, -12, 10); this.scene.add(rim);

    this._grid = new THREE.GridHelper(10, 10, 0xbbbbbb, 0xdddddd);
    this.scene.add(this._grid);

    // Bounding box wireframe (like Desmos)
    const boxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(6, 6, 6));
    this._bbox = new THREE.LineSegments(boxGeo,
      new THREE.LineBasicMaterial({ color: 0xbbbbbb, transparent: true, opacity: 0.5 }));
    this.scene.add(this._bbox);

    this._buildAxes();
  }

  _buildAxes() {
    const L = 5.5, T = 0.06;
    const line = (p, q, hex) => {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...p), new THREE.Vector3(...q)]);
      return new THREE.Line(g, new THREE.LineBasicMaterial({ color: hex }));
    };
    this.scene.add(line([0,0,0],[L,0,0], 0xcc2222));
    this.scene.add(line([0,0,0],[0,0,L], 0x22aa44));
    this.scene.add(line([0,0,0],[0,L,0], 0x2255cc));
    ['x','y','z'].forEach((label, li) => {
      const pos = [[L+0.5,0,0],[0,0,L+0.5],[0,L+0.5,0]][li];
      const col = ['#cc2222','#22aa44','#2255cc'][li];
      this.scene.add(this._sprite(label, pos, col, 0.55));
    });
    // Ticks + labels on ALL 3 axes, every unit (labels every 1, skip 0)
    for (let i = -5; i <= 5; i++) {
      if (i === 0) continue;
      this.scene.add(line([i,-T,0],[i,T,0], 0xcc2222));          // x ticks
      this.scene.add(line([0,-T,i],[0,T,i], 0x22aa44));          // y ticks
      this.scene.add(line([-T,i,0],[T,i,0], 0x2255cc));          // z ticks
      this.scene.add(this._sprite(String(i), [i, -0.32, 0], '#cc2222', 0.28));
      this.scene.add(this._sprite(String(i), [0, -0.32, i], '#22aa44', 0.28));
      this.scene.add(this._sprite(String(i), [-0.35, i, 0], '#2255cc', 0.28));
    }
  }

  _sprite(text, pos, color, scale = 0.5) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const ctx = cv.getContext('2d');
    ctx.font = 'bold 72px Arial'; ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 64);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv), depthTest: false }));
    sp.position.set(...pos); sp.scale.set(scale, scale, scale);
    return sp;
  }

  // ── Env / eval ──────────────────────────────────────────────────────────────
  _env() {
    // Use Proxy so unknown identifiers default to 0 instead of undefined→NaN
    const base = { ...window.GraphCalc.CONSTS, ...this.params,
                   __funcs: this._userFuncs, __seqs: {}, __seqCache: {} };
    return new Proxy(base, {
      get(t, k) { return k in t ? t[k] : (typeof k === 'string' && !k.startsWith('__') ? 0 : undefined); }
    });
  }

  // Швидкі скаляризовані обгортки (compiled → fallback на evalAst)
  _f1(ast, varName) {
    const fn = compiledOf(ast);
    const env = this._env();
    if (fn) {
      if (varName === 's') return (t) => fn(0,0,0,t,t,0,0,0,0,0, env);
      return (t) => fn(0,0,0,t,0,0,0,0,0,0, env);
    }
    return (t) => this._ev(ast, { [varName]: t, t });
  }
  _f2(ast) {
    const fn = compiledOf(ast);
    const env = this._env();
    if (fn) return (x, y) => fn(x,y,0,0,0,0,0,0,0,0, env);
    return (x, y) => this._ev(ast, { x, y });
  }
  _f3(ast) {
    const fn = compiledOf(ast);
    const env = this._env();
    if (fn) return (x, y, z) => fn(x,y,z,0,0,0,0,0,0,0, env);
    return (x, y, z) => this._ev(ast, { x, y, z });
  }
  _fuv(ast) {
    const fn = compiledOf(ast);
    const env = this._env();
    if (fn) return (u, v) => fn(0,0,0,0,0,u,v,0,0,0, env);
    return (u, v) => this._ev(ast, { u, v });
  }

  _ev(ast, extra) {
    try { return window.GraphCalc.evalAst(ast, { ...this._env(), ...extra }); }
    catch (_) { return NaN; }
  }

  // ── Expressions ─────────────────────────────────────────────────────────────
  addExpression(src, color, opts = {}) {
    const id = this._nextId++;
    const c = color || PALETTE3D[(id - 1) % PALETTE3D.length];
    const expr = { id, src, color: c, classified: null,
                   wireframe: false, opacity: 1, colorMap: 'solid', visible: true,
                   ...opts };
    this.expressions.push(expr);
    this._classify(expr);
    this._build(expr);
    // Param defined AFTER expressions that reference it — rebuild them with new value
    if (expr.classified?.kind === 'param') this._rebuildAll();
    this._rebuildSlices(expr.id);
    if (this.onChange) this.onChange({ reason: 'expression' });
    return expr;
  }

  updateExpression(id, src) {
    const e = this._get(id); if (!e) return;
    e.src = src;
    this._removeMesh(id);
    this._classify(e);
    if (e.classified?.kind === 'param') this._rebuildAll();
    else this._build(e);
    this._rebuildSlices(id);
    if (this.onChange) this.onChange({ reason: 'expression' });
  }

  moveExpression(id, newIndex) {
    const i = this.expressions.findIndex(e => e.id === id);
    if (i < 0) return;
    const [e] = this.expressions.splice(i, 1);
    this.expressions.splice(Math.max(0, Math.min(newIndex, this.expressions.length)), 0, e);
    if (this.onChange) this.onChange({ reason: 'expression' });
  }

  duplicateExpression(id) {
    const e = this._get(id);
    if (!e) return null;
    const copy = this.addExpression(e.src, null, {
      wireframe: e.wireframe, opacity: e.opacity, colorMap: e.colorMap,
      range: e.range, resolution: e.resolution,
      tRange: e.tRange, uRange: e.uRange, vRange: e.vRange,
    });
    // Поставити одразу після оригіналу
    const from = this.expressions.findIndex(x => x.id === copy.id);
    const to   = this.expressions.findIndex(x => x.id === id) + 1;
    if (from >= 0 && from !== to) {
      const [c2] = this.expressions.splice(from, 1);
      this.expressions.splice(to, 0, c2);
      if (this.onChange) this.onChange({ reason: 'expression' });
    }
    return copy;
  }

  removeExpression(id) {
    this._removeMesh(id);
    this.expressions = this.expressions.filter(e => e.id !== id);
    this._rebuildSlices(-1);
    if (this.onChange) this.onChange({ reason: 'expression' });
  }

  setExprProp(id, key, value) {
    const e = this._get(id); if (!e) return;
    e[key] = value;
    this._removeMesh(id);
    this._build(e);
    if (this.onChange) this.onChange({ reason: 'expression' });
  }

  setColor(id, hex)       { const e = this._get(id); if (!e) return; e.color = hex; this._removeMesh(id); this._build(e); if (this.onChange) this.onChange({ reason: 'expression' }); }
  setVisible(id, v)       { const e = this._get(id); if (!e) return; e.visible = v; (this._meshes.get(id)||[]).forEach(m => { m.visible = v; }); if (this.onChange) this.onChange({ reason: 'expression' }); }
  setWireframe(id, w)     { this.setExprProp(id, 'wireframe', w); }
  setOpacity(id, o)       { this.setExprProp(id, 'opacity', o); }
  setColorMap(id, cm)     { this.setExprProp(id, 'colorMap', cm); }
  setRange(id, r)         { this.setExprProp(id, 'range', r); }
  setResolution(id, n)    { this.setExprProp(id, 'resolution', n); }
  setTRange(id, mn, mx)   { this.setExprProp(id, 'tRange', [mn, mx]); }
  setUVRange(id, u, v)    { const e = this._get(id); if (!e) return; e.uRange=u; e.vRange=v; this._removeMesh(id); this._build(e); if (this.onChange) this.onChange({ reason:'expression' }); }

  // ── Parameters ─────────────────────────────────────────────────────────────
  setParam(name, value) {
    this.params[name] = value; this._rebuildAll();
    if (this.onChange) this.onChange({ reason: 'param' });
  }
  getParam(name) { return this.params[name]; }

  // ── Animation ───────────────────────────────────────────────────────────────
  animateCurveUnfold(id, duration = 4) {
    const e = this._get(id);
    if (!e || e.classified?.kind !== 'curve3D') return;
    if (!this._unfolds) this._unfolds = {};
    this._unfolds[id] = { start: performance.now(), duration: duration * 1000 };
  }

  _tickUnfolds() {
    if (!this._unfolds) return;
    for (const key of Object.keys(this._unfolds)) {
      const id = +key, u = this._unfolds[key];
      const e = this._get(id);
      if (!e) { delete this._unfolds[key]; continue; }
      const frac = Math.min((performance.now() - u.start) / u.duration, 1);
      e._unfoldFrac = frac;
      this._removeMesh(id); this._build(e);
      if (frac >= 1) { delete this._unfolds[key]; delete e._unfoldFrac; }
    }
  }

  startAnimation(name, opts = {}) {
    // mode: 'pingpong' (bounce) | 'loop' (wrap) | 'once' (stop at max)
    const mode = opts.mode || (opts.loop === false ? 'once' : 'pingpong');
    this._animParams[name] = { min: opts.min ?? 0, max: opts.max ?? 10,
      speed: opts.speed ?? 1, mode, dir: 1 };
  }
  setAnimationOpts(name, opts = {}) {
    const a = this._animParams[name]; if (!a) return;
    if (opts.mode)  a.mode  = opts.mode;
    if (opts.speed) a.speed = opts.speed;
    if (Number.isFinite(opts.min)) a.min = opts.min;
    if (Number.isFinite(opts.max)) a.max = opts.max;
  }
  stopAnimation(name) { delete this._animParams[name]; }
  stopAllAnimations() { this._animParams = {}; }

  _tickAnimations(dt) {
    let any = false, ended = false;
    for (const [name, a] of Object.entries(this._animParams)) {
      let v = (this.params[name] ?? a.min) + a.dir * a.speed * dt;
      const mode = a.mode || 'pingpong';
      if (a.dir > 0 && v >= a.max) {
        if      (mode === 'pingpong') { v = a.max; a.dir = -1; }
        else if (mode === 'loop')     { v = a.min; }
        else { v = a.max; delete this._animParams[name]; ended = true; }
      } else if (a.dir < 0 && v <= a.min) {
        if      (mode === 'pingpong') { v = a.min; a.dir = 1; }
        else if (mode === 'loop')     { v = a.max; }
        else { v = a.min; delete this._animParams[name]; ended = true; }
      }
      this.params[name] = v; any = true;
    }
    if (any) { this._rebuildAll(); if (this.onChange) this.onChange({ reason: 'animate' }); }
    if (ended && this.onChange) this.onChange({ reason: 'animend' });
  }

  // ── Camera ──────────────────────────────────────────────────────────────────
  setOrtho(enabled) {
    this._ortho = enabled;
    this.camera = enabled ? this._camOrtho : this._camPersp;
    const old = this.controls;
    this.controls = this._makeControls(this.camera);
    this.controls.target.copy(old.target);
    old.dispose();
    this.camera.position.set(6, 4, 8);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  autoFit() {
    const box = new THREE.Box3();
    let empty = true;
    this._meshes.forEach(meshes => meshes.forEach(m => {
      if (m.visible) { box.expandByObject(m); empty = false; }
    }));
    if (empty) { this.resetView(); return; }
    const size   = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxD   = Math.max(size.x, size.y, size.z, 0.1);
    const dist   = maxD / (2 * Math.tan((this._camPersp.fov * Math.PI) / 360)) * 1.6;
    this.controls.target.copy(center);
    this.camera.position.set(center.x + dist * 0.6, center.y + dist * 0.45, center.z + dist * 0.8);
    this.controls.update();
  }

  setClipPlane(axis, val, showPlane = true) {
    // Map math axis to Three.js clip plane
    // math x→Three x, math y→Three z, math z→Three y
    const planeMap = {
      x: new THREE.Plane(new THREE.Vector3(-1, 0, 0),  val),
      y: new THREE.Plane(new THREE.Vector3( 0, 0,-1),  val),
      z: new THREE.Plane(new THREE.Vector3( 0,-1, 0),  val),
    };
    this.renderer.clippingPlanes = [planeMap[axis]];
    this._clipAxis = axis; this._clipVal = val;
    this._updateClipIndicator(axis, val, showPlane);
  }

  disableClipPlane() {
    this.renderer.clippingPlanes = [];
    this._clipAxis = null;
    this._removeClipIndicator();
  }

  _removeClipIndicator() {
    if (this._clipMesh) {
      this.scene.remove(this._clipMesh);
      this._clipMesh.geometry.dispose();
      this._clipMesh.material.dispose();
      this._clipMesh = null;
    }
  }

  _updateClipIndicator(axis, val, show) {
    this._removeClipIndicator();
    if (!show) return;
    const size = 7;
    const geom = new THREE.PlaneGeometry(size, size);
    if (axis === 'z') geom.rotateX(-Math.PI / 2);     // lie in XZ plane, y=val
    else if (axis === 'x') geom.rotateY( Math.PI / 2); // lie in YZ plane, x=val
    // axis 'y': default XY plane, z=val
    const mat = new THREE.MeshBasicMaterial({
      color: 0x2d70b3, transparent: true, opacity: 0.15,
      side: THREE.DoubleSide, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this._clipMesh = new THREE.Mesh(geom, mat);
    this._clipMesh.renderOrder = 999; // draw last — avoids z-fight with surface
    if      (axis === 'x') this._clipMesh.position.set(val, 0, 0);
    else if (axis === 'y') this._clipMesh.position.set(0, 0, val);
    else                   this._clipMesh.position.set(0, val, 0);
    this.scene.add(this._clipMesh);
  }

  setAutoRotate(enabled, speed = 1.0) {
    this._autoRot = { enabled, speed };
  }

  // ── Camera state (Scene v2 contract) ──────────────────────────────────
  getCameraState() {
    return {
      position:   this.camera.position.toArray(),
      target:     this.controls.target.toArray(),
      projection: this._ortho ? 'ortho' : 'perspective',
      autoRotate: { on: !!(this._autoRot && this._autoRot.enabled),
                    speed: (this._autoRot && this._autoRot.speed) || 1 },
    };
  }

  setCameraState(cam) {
    if (!cam) return;
    const wantOrtho = cam.projection === 'ortho';
    if (wantOrtho !== !!this._ortho) this.setOrtho(wantOrtho); // resets pos — set after
    if (Array.isArray(cam.target))   this.controls.target.fromArray(cam.target);
    if (Array.isArray(cam.position)) this.camera.position.fromArray(cam.position);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
    if (cam.autoRotate) this.setAutoRotate(!!cam.autoRotate.on, cam.autoRotate.speed || 1);
  }

  resetView() {
    this.controls.target.set(0, 0, 0);
    this.camera.position.set(6, 4, 8);
    this.camera.lookAt(0, 0, 0);
    this.controls.update();
  }

  // ── State ───────────────────────────────────────────────────────────────────
  getState() {
    return {
      version: 1,
      expressions: this.expressions.map(e => ({
        src: e.src, color: e.color, wireframe: e.wireframe,
        opacity: e.opacity, colorMap: e.colorMap, visible: e.visible,
        range: e.range || null, resolution: e.resolution || null,
        tRange: e.tRange || null, uRange: e.uRange || null, vRange: e.vRange || null,
      })),
      params: { ...this.params },
    };
  }
  setState(state) {
    this.expressions.slice().forEach(e => this.removeExpression(e.id));
    (state.expressions || []).forEach(e => this.addExpression(e.src, e.color, e));
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  // ── №24: запис відео WebM (canvas.captureStream + MediaRecorder) ─────────────
  // §5.1: бейдж воронки на растрових експортах (вимикається capabilities.branded:false)
  get _branded() {
    const caps = window.__mashG3dOpts && window.__mashG3dOpts.capabilities;
    return !caps || caps.branded !== false;
  }
  _drawBadge(ctx, w, h) {
    const fs = Math.max(11, Math.round(h / 60));
    ctx.save();
    ctx.font = `500 ${fs}px system-ui, sans-serif`;
    const text = 'GraphMASH · m4sh.org';
    const tw = ctx.measureText(text).width;
    const pad = Math.round(fs * 0.6);
    const x = w - tw - pad * 2 - 8, y = h - fs - pad * 2 - 8;
    ctx.fillStyle = 'rgba(10,14,20,.55)';
    ctx.beginPath();
    ctx.roundRect(x, y, tw + pad * 2, fs + pad * 2, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + pad, y + pad + fs / 2);
    ctx.restore();
  }

  startRecording() {
    if (this._recorder) return false;
    try {
      const src = this.renderer.domElement;
      let stream;
      if (this._branded) {
        // композитна канва: кадр двигуна + бейдж у кожному кадрі
        const comp = document.createElement('canvas');
        comp.width = src.width; comp.height = src.height;
        const cctx = comp.getContext('2d');
        const tick = () => {
          if (!this._recorder) return;
          if (comp.width !== src.width || comp.height !== src.height) { comp.width = src.width; comp.height = src.height; }
          cctx.drawImage(src, 0, 0);
          this._drawBadge(cctx, comp.width, comp.height);
          this._recRAF = requestAnimationFrame(tick);
        };
        this._recRAF = requestAnimationFrame(tick);
        this._recComp = comp;
        stream = comp.captureStream(30);
      } else {
        stream = src.captureStream(30);
      }
      const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
        .find(m => MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8e6 } : undefined);
      this._recChunks = [];
      rec.ondataavailable = e => { if (e.data.size) this._recChunks.push(e.data); };
      rec.start(250);
      this._recorder = rec;
      return true;
    } catch (e) { console.warn('recording failed', e); return false; }
  }

  stopRecording(filename = 'graphmash-3d') {
    return new Promise(resolve => {
      const rec = this._recorder;
      if (!rec) { resolve(false); return; }
      rec.onstop = () => {
        if (this._recRAF) { cancelAnimationFrame(this._recRAF); this._recRAF = null; this._recComp = null; }
        const blob = new Blob(this._recChunks, { type: rec.mimeType || 'video/webm' });
        this._recChunks = [];
        this._recorder = null;
        this._dl(blob, filename + '.webm');
        resolve(true);
      };
      rec.stop();
    });
  }

  get isRecording() { return !!this._recorder; }

  exportPNG(filename = 'graphmash-3d') {
    this.renderer.render(this.scene, this.camera); // свіжий кадр (preserveDrawingBuffer)
    const src = this.renderer.domElement;
    if (!this._branded) {
      src.toBlob(blob => { if (blob) this._dl(blob, filename + '.png'); }, 'image/png');
      return;
    }
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    this._drawBadge(ctx, c.width, c.height);
    c.toBlob(blob => {
      if (blob) this._dl(blob, filename + '.png');
    }, 'image/png');
  }

  async exportGLTF(filename = 'graphmash-3d') {
    const group = new THREE.Group();
    this._meshes.forEach(meshes => meshes.forEach(m => { if (m.visible && !m.__isSlice && !m.__isPlaceholder) group.add(m.clone()); }));
    const data = await new Promise((res, rej) => {
      new GLTFExporter().parse(group, res, rej, { binary: true });
    });
    // §5.1: generator у метадані glb (перепаковуємо JSON-чанк)
    const patched = this._patchGlbGenerator(data, 'GraphMASH (m4sh.org)');
    this._dl(new Blob([patched], { type: 'application/octet-stream' }), filename + '.glb');
  }
  _patchGlbGenerator(buf, generator) {
    try {
      const dv = new DataView(buf);
      if (dv.getUint32(0, true) !== 0x46546C67) return buf; // 'glTF'
      const jsonLen = dv.getUint32(12, true);
      const jsonBytes = new Uint8Array(buf, 20, jsonLen);
      const json = JSON.parse(new TextDecoder().decode(jsonBytes));
      json.asset = json.asset || {};
      json.asset.generator = generator;
      let enc = new TextEncoder().encode(JSON.stringify(json));
      const padded = new Uint8Array(Math.ceil(enc.length / 4) * 4).fill(0x20);
      padded.set(enc);
      const rest = new Uint8Array(buf, 20 + jsonLen); // BIN-чанк(и) як є
      const out = new Uint8Array(20 + padded.length + rest.length);
      const odv = new DataView(out.buffer);
      odv.setUint32(0, 0x46546C67, true);
      odv.setUint32(4, dv.getUint32(4, true), true);
      odv.setUint32(8, out.length, true);
      odv.setUint32(12, padded.length, true);
      odv.setUint32(16, 0x4E4F534A, true); // 'JSON'
      out.set(padded, 20);
      out.set(rest, 20 + padded.length);
      return out.buffer;
    } catch (e) { console.warn('glb generator patch failed', e); return buf; }
  }
  exportSTL(filename = 'graphmash-3d', binary = false) {
    const group = new THREE.Group();
    this._meshes.forEach(meshes => meshes.forEach(m => { if (m.visible && !m.__isSlice && !m.__isPlaceholder) group.add(m.clone()); }));
    const out = new STLExporter().parse(group, { binary });
    // §5.1: generator у заголовку STL
    let payload = out;
    if (!binary && typeof out === 'string') {
      payload = out.replace(/^solid exported/, 'solid GraphMASH (m4sh.org)').replace(/endsolid exported\s*$/, 'endsolid GraphMASH (m4sh.org)\n');
    } else if (binary && out && out.buffer) {
      const header = new TextEncoder().encode('GraphMASH (m4sh.org) binary STL');
      new Uint8Array(out.buffer, 0, Math.min(80, header.length)).set(header.slice(0, 80));
    }
    const blob = binary
      ? new Blob([payload], { type: 'application/octet-stream' })
      : new Blob([payload], { type: 'text/plain' });
    this._dl(blob, filename + '.stl');
  }
  _dl(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // ── Internal ────────────────────────────────────────────────────────────────
  _get(id) { return this.expressions.find(e => e.id === id); }

  _classify(expr) {
    const paramNames = this.expressions.filter(e => e.classified?.kind === 'param').map(e => e.classified.name);
    expr.classified = classify3D(expr.src, paramNames);
    const c = expr.classified;
    if (c.kind === 'param') {
      const v = this._ev(c.ast, {}); if (Number.isFinite(v)) this.params[c.name] = v;
    }
    if (c.kind === 'funcDef3D') this._userFuncs[c.name] = { params: c.params, body: c.ast };
  }

  _removeMesh(id) {
    (this._meshes.get(id) || []).forEach(m => {
      this.scene.remove(m);
      m.traverse(ch => {
        ch.geometry?.dispose();
        (Array.isArray(ch.material) ? ch.material : [ch.material]).forEach(mt => {
          if (mt) { this._fatMats && this._fatMats.delete(mt); mt.dispose(); }
        });
      });
    });
    this._meshes.delete(id);
  }

  _build(expr) {
    if (!expr.visible) return;
    const c = expr.classified;
    if (!c) return;
    if (c.kind === 'funcDef3D' && c.surface) {
      // №15: рендеримо як z=f(x,y)
      try {
        const obj0 = this._surfaceZ({ ast: c.ast, restrictions: c.ast.restrictions || [] }, expr);
        if (obj0) {
          const arr0 = Array.isArray(obj0) ? obj0 : [obj0];
          arr0.forEach(o => this.scene.add(o));
          this._meshes.set(expr.id, arr0);
        }
      } catch (e) { console.warn('[G3D] funcdef surface:', e); }
      return;
    }
    if (['invalid','param','funcDef3D','header'].includes(c.kind)) return;
    let obj;
    try {
      if      (c.kind === 'surfaceZ')      obj = this._surfaceZ(c, expr);
      else if (c.kind === 'curve3D')       obj = this._curve3D(c, expr);
      else if (c.kind === 'surface3D')     obj = this._surface3D(c, expr);
      else if (c.kind === 'point3D')       obj = this._point3D(c, expr);
      else if (c.kind === 'implicit3D')    obj = this._implicitSurface(c, expr);
      else if (c.kind === 'vectorField3D') obj = this._vectorField(c, expr);
      else if (c.kind === 'spherical3D')   obj = this._sphericalSurface(c, expr);
      else if (c.kind === 'cylindrical3D') obj = this._cylindricalSurface(c, expr);
      else if (c.kind === 'flow3D')        obj = this._flowField(c, expr);
      else if (c.kind === 'mandelbulb3D')  obj = this._mandelbulb(c, expr);
      else if (c.kind === 'lsystem3D')     obj = this._lsystem3D(c, expr);
      else if (c.kind === 'slice3D')       obj = this._slicePlane(c, expr);
      else if (c.kind === 'div3D')         obj = this._divField(c, expr);
      else if (c.kind === 'curl3D')        obj = this._curlField(c, expr);
      else if (c.kind === 'vectorAnchored3D') obj = this._vectorAnchored(c, expr);
      else if (c.kind === 'contour3D')     obj = this._contour(c, expr);
      else if (c.kind === 'critical3D')    obj = this._critical(c, expr);
      else if (c.kind === 'label3D')       obj = this._label3D(c, expr);
      else if (c.kind === 'segment3D')     obj = this._segment3D(c, expr);
      else if (c.kind === 'gradField3D')   obj = this._gradField(c, expr);
      else if (c.kind === 'riemann3D')     obj = this._riemann(c, expr);
      else if (c.kind === 'intersect3D')   obj = this._intersectCurve(c, expr);
      else if (c.kind === 'tangent3D')     obj = this._tangentPlane(c, expr);
    } catch (e) { console.error('[G3D] build error:', expr.src, e); }
    if (obj) {
      const arr = Array.isArray(obj) ? obj : [obj];
      arr.forEach(o => this.scene.add(o));
      this._meshes.set(expr.id, arr);
    }
  }

  _rebuildAll() {
    this.expressions.forEach(e => {
      const k = e.classified;
      if (k?.kind === 'funcDef3D' && !k.surface) return;
      if (!['param'].includes(k?.kind)) { this._removeMesh(e.id); this._build(e); }
    });
  }

  _mat(expr, opts = {}) {
    const useVC = opts.vertexColors;
    return new THREE.MeshStandardMaterial({
      color:        useVC ? 0xffffff : new THREE.Color(expr.color),
      vertexColors: !!useVC,
      side:         THREE.DoubleSide,
      roughness:    0.35,
      metalness:    0.05,
      wireframe:    !!expr.wireframe,
      transparent:  expr.opacity < 0.99,
      opacity:      expr.opacity,
      ...opts.matOpts,
    });
  }

  // ── Surface z=f(x,y) ────────────────────────────────────────────────────────
  _surfaceZ(c, expr) {
    const fZ = this._f2(c.ast);
    const N = expr.resolution || 100;
    const range = expr.range || 3;
    const env = this._env();
    // Domain restrictions {x<1,y<1} — застосовуємо через 2D-passRestrict
    const restr = c.restrictions && c.restrictions.length ? c.restrictions : null;
    const GC = window.GraphCalc;
    const vCount = (N + 1) * (N + 1);
    const pos  = new Float32Array(vCount * 3);
    const zVal = new Float32Array(vCount);
    const ok   = new Uint8Array(vCount);
    const idx  = [];
    let zMin = Infinity, zMax = -Infinity;

    for (let i = 0; i <= N; i++) {
      const x = -range + 2 * range * i / N;
      for (let j = 0; j <= N; j++) {
        const y = -range + 2 * range * j / N;
        const vi = i * (N + 1) + j;
        const inDomain = !restr || GC.passRestrict(restr, env, x, y);
        const z = inDomain ? fZ(x, y) : NaN;
        const good = inDomain && Number.isFinite(z) && Math.abs(z) < 1e6;
        ok[vi] = good ? 1 : 0;
        zVal[vi] = good ? z : 0;
        pos[vi*3] = x; pos[vi*3+1] = good ? z : 0; pos[vi*3+2] = y;
        if (good) { zMin = Math.min(zMin, z); zMax = Math.max(zMax, z); }
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const a = i*(N+1)+j, b=a+1, cc=a+(N+1), d=cc+1;
      if (ok[a]&&ok[b]&&ok[cc]&&ok[d]) idx.push(a,b,cc, b,d,cc);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geom.setIndex(idx); geom.computeVertexNormals();
    const useVC = expr.colorMap && expr.colorMap !== 'solid';
    if (useVC) {
      if (expr.colorMap === 'curvature') {
        // Gaussian curvature K = (fxx*fyy - fxy^2) / (1+fx^2+fy^2)^2
        const K = new Float32Array(vCount);
        const h = 2 * range / N;
        let kMin = Infinity, kMax = -Infinity;
        for (let i = 1; i < N; i++) for (let j = 1; j < N; j++) {
          const vi = i*(N+1)+j;
          const fx  = (zVal[(i+1)*(N+1)+j] - zVal[(i-1)*(N+1)+j]) / (2*h);
          const fy  = (zVal[vi+1] - zVal[vi-1]) / (2*h);
          const fxx = (zVal[(i+1)*(N+1)+j] - 2*zVal[vi] + zVal[(i-1)*(N+1)+j]) / (h*h);
          const fyy = (zVal[vi+1] - 2*zVal[vi] + zVal[vi-1]) / (h*h);
          const fxy = (zVal[(i+1)*(N+1)+j+1] - zVal[(i+1)*(N+1)+j-1] - zVal[(i-1)*(N+1)+j+1] + zVal[(i-1)*(N+1)+j-1]) / (4*h*h);
          let k = (fxx*fyy - fxy*fxy) / Math.pow(1 + fx*fx + fy*fy, 2);
          k = Math.sign(k) * Math.log(1 + Math.abs(k) * 10); // compress dynamic range
          if (Number.isFinite(k)) { K[vi] = k; kMin = Math.min(kMin, k); kMax = Math.max(kMax, k); }
        }
        applyColorMap(geom, K, kMin, kMax, 'jet');
      } else {
        applyColorMap(geom, zVal, zMin, zMax, expr.colorMap);
      }
    }
    const mesh = new THREE.Mesh(geom, this._mat(expr, { vertexColors: useVC }));

    // ── Isolines overlay ──
    if (expr.isolines && zMin < zMax) {
      const isoGroup = this._buildIsolines(pos, zVal, ok, N, zMin, zMax, expr);
      return [mesh, isoGroup];
    }
    return mesh;
  }

  // Marching Squares — contour lines on surface grid
  _buildIsolines(pos, zVal, ok, N, zMin, zMax, expr) {
    const count = expr.isolineCount || 10;
    const base  = new THREE.Color(expr.color);
    const col   = new THREE.Color(base.r * 0.5, base.g * 0.5, base.b * 0.5);
    const group = new THREE.Group();

    for (let li = 1; li <= count; li++) {
      const level = zMin + (zMax - zMin) * li / (count + 1);
      const pts   = [];
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const ia = i*(N+1)+j, ib = ia+1, ic = ia+(N+1), id = ic+1;
          if (!(ok[ia]&&ok[ib]&&ok[ic]&&ok[id])) continue;
          const edges = [[ia,ib],[ic,id],[ia,ic],[ib,id]];
          const cross = edges.map(([p,q]) => {
            const za = zVal[p], zb = zVal[q];
            if ((za - level) * (zb - level) > 0) return null;
            const t = Math.abs(za - zb) < 1e-10 ? 0.5 : (level - za) / (zb - za);
            return [
              pos[p*3]   + t*(pos[q*3]   - pos[p*3]),
              pos[p*3+1] + t*(pos[q*3+1] - pos[p*3+1]),
              pos[p*3+2] + t*(pos[q*3+2] - pos[p*3+2]),
            ];
          });
          const hit = cross.filter(Boolean);
          if (hit.length >= 2) pts.push(...hit[0], ...hit[1]);
        }
      }
      if (!pts.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      group.add(new THREE.LineSegments(g,
        new THREE.LineBasicMaterial({ color: col, linewidth: 1.5 })));
    }
    return group;
  }

  // ── Parametric curve ─────────────────────────────────────────────────────────
  _curve3D(c, expr) {
    const N = 500;
    let [t0, t1] = expr.tRange || [0, 2 * Math.PI];
    if (expr._unfoldFrac !== undefined)
      t1 = t0 + (t1 - t0) * Math.max(expr._unfoldFrac, 0.02);
    const tv = c.tVar || 't';
    const fX = this._f1(c.xAst, tv), fY = this._f1(c.yAst, tv), fZ = this._f1(c.zAst, tv);
    const segs = []; let cur = [];
    for (let i = 0; i <= N; i++) {
      const t = t0 + (t1 - t0) * i / N;
      const x = fX(t), y = fY(t), z = fZ(t);
      const good = [x,y,z].every(v => Number.isFinite(v) && Math.abs(v) < 1e4);
      if (good) cur.push(new THREE.Vector3(x, z, y));
      else if (cur.length >= 2) { segs.push([...cur]); cur = []; } else cur = [];
    }
    if (cur.length >= 2) segs.push(cur);
    const group = new THREE.Group();
    segs.forEach(pts => {
      if (pts.length < 3) return;
      try {
        const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.07, 20, false); // 20 radial segs → smooth circle
        group.add(new THREE.Mesh(tube, this._mat(expr)));
      } catch (_) {}
    });
    return group;
  }

  // ── Parametric surface ────────────────────────────────────────────────────────
  _surface3D(c, expr) {
    const fX = this._fuv(c.xAst), fY = this._fuv(c.yAst), fZ = this._fuv(c.zAst);
    const N = expr.resolution || 55, M = expr.resolution || 55;
    const [u0, u1] = expr.uRange || [0, 2 * Math.PI];
    const [v0, v1] = expr.vRange || [0, 2 * Math.PI];
    const pos = [], zVals = [], idx = [];
    let zMin = Infinity, zMax = -Infinity;
    for (let i = 0; i <= N; i++) {
      const u = u0 + (u1 - u0) * i / N;
      for (let j = 0; j <= M; j++) {
        const v = v0 + (v1 - v0) * j / M;
        const x = fX(u, v) || 0;
        const y = fY(u, v) || 0;
        const z = fZ(u, v) || 0;
        pos.push(Number.isFinite(x)?x:0, Number.isFinite(z)?z:0, Number.isFinite(y)?y:0);
        zVals.push(Number.isFinite(z) ? z : 0);
        if (Number.isFinite(z)) { zMin = Math.min(zMin,z); zMax = Math.max(zMax,z); }
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
      const a = i*(M+1)+j, b=a+1, cc=a+(M+1), d=cc+1;
      idx.push(a,b,cc, b,d,cc);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setIndex(idx); geom.computeVertexNormals();
    const useVC = expr.colorMap && expr.colorMap !== 'solid';
    if (useVC) applyColorMap(geom, new Float32Array(zVals), zMin, zMax, expr.colorMap);
    return new THREE.Mesh(geom, this._mat(expr, { vertexColors: useVC }));
  }

  // ── Implicit surface f(x,y,z)=g via Marching Tetrahedra (Web Worker) ──────────
  // Полір-5: прогресивно — грубе N=16 одразу, повне N у фоні.
  // №23: якщо вирази компілюються — семплінг у worker (ліміт 96), інакше main (48).
  _implicitSurface(c, expr) {
    const cL = compiledOf(c.lhsAst), cR = compiledOf(c.rhsAst);
    const workerSample = !!(cL && cL.__src && cR && cR.__src);
    const cap = workerSample ? 96 : 48;
    const N = Math.min(expr.resolution || 24, cap);
    const range = expr.range || 3;
    const fL = this._f3(c.lhsAst), fR = this._f3(c.rhsAst);

    const ensureWorker = () => {
      if (!this._mtWorker) {
        this._mtWorker = new Worker(new URL('./mt-worker.js', import.meta.url));
        this._mtWorker.onmessage = (e) => this._onMTResult(e.data);
      }
      if (!this._mtPending) this._mtPending = new Map();
      this._mtPending.set(expr.id, { expr, mat: this._mat(expr) });
    };
    const sampleAndPost = (NN) => {
      ensureWorker();
      if (workerSample) {
        // №23: увесь семплінг у worker — нуль роботи в main thread
        this._mtWorker.postMessage({ mode: 'sample',
          lhsSrc: cL.__src, rhsSrc: cR.__src,
          env: { ...this._env(), __funcs: undefined, __seqs: undefined, __seqCache: undefined },
          N: NN, range, id: expr.id });
        return;
      }
      const sz = NN + 1;
      const field = new Float32Array(sz * sz * sz);
      const dx = 2 * range / NN;
      for (let iz = 0; iz <= NN; iz++) {
        const mathY = -range + dx * iz;
        for (let iy = 0; iy <= NN; iy++) {
          const mathZ = -range + dx * iy;
          for (let ix = 0; ix <= NN; ix++) {
            const mathX = -range + dx * ix;
            const lv = fL(mathX, mathY, mathZ);
            const rv = fR(mathX, mathY, mathZ);
            field[ix + iy * sz + iz * sz * sz] = (isFinite(lv) && isFinite(rv)) ? lv - rv : 1e6;
          }
        }
      }
      this._mtWorker.postMessage({ field, N: NN, range, id: expr.id }, [field.buffer]);
    };

    const coarse = N > 18 ? 16 : N;
    sampleAndPost(coarse);
    if (coarse < N) {
      const myGen = (expr.__mtGen = (expr.__mtGen || 0) + 1);
      setTimeout(() => {
        // Вираз міг змінитись/зникнути, поки чекали
        if (this._destroyed || this._get(expr.id) !== expr || expr.__mtGen !== myGen) return;
        if (expr.classified !== c) return;
        sampleAndPost(N);
      }, 80);
    }

    // Placeholder bounding-box, поки worker рахує грубу версію
    const boxGeom = new THREE.BoxGeometry(range*2, range*2, range*2);
    const boxMat  = new THREE.MeshBasicMaterial({
      color: new THREE.Color(expr.color), wireframe: true, transparent: true, opacity: 0.25
    });
    const placeholder = new THREE.Mesh(boxGeom, boxMat);
    placeholder.__isPlaceholder = true;
    return placeholder;
  }

  _onMTResult(...args) { const d = args[0]; if (d && d.error) { this._mtPending && this._mtPending.delete(d.id); return; } return this.__onMTResultImpl(d); }
  __onMTResultImpl({ id, positions }) {
    const pending = this._mtPending?.get(id);
    if (!pending) return; // expression was removed before worker finished
    this._mtPending.delete(id);
    const { expr, mat, refine } = pending;

    // Remove placeholder
    const existing = this._meshes.get(expr.id) || [];
    existing.forEach(m => {
      if (m.__isPlaceholder || m.__mtMesh) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
    });

    if (!positions.length) return;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.computeVertexNormals();
    const mesh = new THREE.Mesh(geom, mat);
    mesh.__mtMesh = true;
    this.scene.add(mesh);
    // Replace placeholder + попередній MT-меш у _meshes
    const others = (this._meshes.get(expr.id) || []).filter(m => !m.__isPlaceholder && !m.__mtMesh);
    this._meshes.set(expr.id, [...others, mesh]);
    if (this.onChange) this.onChange({ reason: 'implicit-ready' });
    // Прогресивне уточнення (mandelbulb): замовити повне N у фоні
    if (refine) requestAnimationFrame(() => { try { refine(); } catch(_) {} });
  }

  // ── Vector field (vx,vy,vz)(x,y,z) via ArrowHelper grid ──────────────────────
  _vectorField(c, expr) {
    const env = this._env(), col = new THREE.Color(expr.color);
    const group = new THREE.Group();

    const vFx = this._f3(c.xAst), vFy = this._f3(c.yAst), vFz = this._f3(c.zAst);
    if (c.isStatic) {
      // Single static vector arrow from origin
      const vx = this._ev(c.xAst, env), vy = this._ev(c.yAst, env), vz = this._ev(c.zAst, env);
      if ([vx,vy,vz].every(Number.isFinite)) {
        const mag = Math.hypot(vx, vy, vz);
        if (mag > 1e-8) {
          const dir = new THREE.Vector3(vx, vz, vy).normalize();
          const hl = Math.min(mag * 0.25, 0.5), hw = hl * 0.5;
          group.add(new THREE.ArrowHelper(dir, new THREE.Vector3(0,0,0), mag, col, hl, hw));
        }
      }
      return group;
    }

    // Vector field: 5×5×5 grid
    const STEPS = 5, range = expr.range || 3;
    const step = 2 * range / (STEPS - 1), maxLen = step * 0.44;
    for (let iz = 0; iz < STEPS; iz++) {
      const mathY = -range + step * iz;
      for (let iy = 0; iy < STEPS; iy++) {
        const mathZ = -range + step * iy;
        for (let ix = 0; ix < STEPS; ix++) {
          const mathX = -range + step * ix;
          const vx = vFx(mathX, mathY, mathZ), vy = vFy(mathX, mathY, mathZ), vz = vFz(mathX, mathY, mathZ);
          if (![vx,vy,vz].every(Number.isFinite)) continue;
          const mag = Math.hypot(vx, vy, vz);
          if (mag < 1e-8) continue;
          const dir = new THREE.Vector3(vx, vz, vy).normalize();
          const len = Math.min(mag / (mag + 1) * maxLen * 2, maxLen);
          const origin = new THREE.Vector3(mathX, mathZ, mathY);
          const hl = Math.min(len * 0.35, 0.18);
          group.add(new THREE.ArrowHelper(dir, origin, Math.max(len, 0.05), col, hl, hl * 0.55));
        }
      }
    }
    return group;
  }

  // ── Generic UV-grid mesh builder ──────────────────────────────────────────────
  _uvMesh(expr, N, u0, u1, v0, v1, fn) {
    const pos = [], zVals = [], idx = [];
    let zMin = Infinity, zMax = -Infinity;
    for (let i = 0; i <= N; i++) {
      const u = u0 + (u1 - u0) * i / N;
      for (let j = 0; j <= N; j++) {
        const v = v0 + (v1 - v0) * j / N;
        const p = fn(u, v);
        const x = p && Number.isFinite(p[0]) ? p[0] : 0;
        const y = p && Number.isFinite(p[1]) ? p[1] : 0;
        const z = p && Number.isFinite(p[2]) ? p[2] : 0;
        pos.push(x, z, y); zVals.push(z);
        if (p) { zMin = Math.min(zMin, z); zMax = Math.max(zMax, z); }
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const a = i*(N+1)+j, b = a+1, cc = a+(N+1), d = cc+1;
      idx.push(a, b, cc, b, d, cc);
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setIndex(idx); geom.computeVertexNormals();
    const useVC = expr.colorMap && expr.colorMap !== 'solid';
    if (useVC) applyColorMap(geom, new Float32Array(zVals), zMin, zMax, expr.colorMap);
    return new THREE.Mesh(geom, this._mat(expr, { vertexColors: useVC }));
  }

  // ── Spherical surface r = f(θ, φ) ──────────────────────────────────────────────
  _sphericalSurface(c, expr) {
    const N = expr.resolution || 80;
    const [u0, u1] = expr.uRange || [0, 2 * Math.PI];  // θ
    const [v0, v1] = expr.vRange || [0, Math.PI];       // φ
    return this._uvMesh(expr, N, u0, u1, v0, v1, (th, ph) => {
      const r = this._ev(c.ast, { theta: th, 'θ': th, phi: ph, 'φ': ph });
      if (!Number.isFinite(r)) return null;
      return [r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph)];
    });
  }

  // ── Cylindrical surface ρ = f(θ, z) ──────────────────────────────────────────
  _cylindricalSurface(c, expr) {
    const N = expr.resolution || 80;
    const [u0, u1] = expr.uRange || [0, 2 * Math.PI];  // θ
    const [v0, v1] = expr.vRange || [-3, 3];            // z
    return this._uvMesh(expr, N, u0, u1, v0, v1, (th, z) => {
      const rho = this._ev(c.ast, { theta: th, 'θ': th, z });
      if (!Number.isFinite(rho)) return null;
      return [rho * Math.cos(th), rho * Math.sin(th), z];
    });
  }

  // ── Flow field: vector field + RK4 integral curves ────────────────────────────
  _flowField(c, expr) {
    const range = expr.range || 3;
    const env = this._env();
    const col = new THREE.Color(expr.color);
    const group = new THREE.Group();
    const fFx = this._f3(c.xAst), fFy = this._f3(c.yAst), fFz = this._f3(c.zAst);
    const f = (x, y, z) => [
      fFx(x, y, z),
      fFy(x, y, z),
      fFz(x, y, z),
    ];
    // Адаптивний крок: один крок h vs два кроки h/2 (Річардсон), контроль похибки
    const rk4step = (p, h) => {
      const k1 = f(p[0], p[1], p[2]);
      const k2 = f(p[0]+h/2*k1[0], p[1]+h/2*k1[1], p[2]+h/2*k1[2]);
      const k3 = f(p[0]+h/2*k2[0], p[1]+h/2*k2[1], p[2]+h/2*k2[2]);
      const k4 = f(p[0]+h*k3[0], p[1]+h*k3[1], p[2]+h*k3[2]);
      if (![...k1,...k2,...k3,...k4].every(Number.isFinite)) return null;
      return [0,1,2].map(d => p[d] + h/6*(k1[d] + 2*k2[d] + 2*k3[d] + k4[d]));
    };
    const S = 3, step = 2 * range / (S - 1);
    const bbox = range * 1.6;
    const TOL = 3e-3, H_MIN = 2e-3, H_MAX = 0.25, ARC_MAX = range * 8;
    for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) for (let k = 0; k < S; k++) {
      let p = [-range + i*step, -range + j*step, -range + k*step];
      const pts = [new THREE.Vector3(p[0], p[2], p[1])];
      let h = 0.05, arc = 0;
      for (let n = 0; n < 2000 && arc < ARC_MAX; n++) {
        const full = rk4step(p, h);
        const half1 = rk4step(p, h/2);
        const p2 = half1 && rk4step(half1, h/2);
        if (!full || !p2) { h *= 0.5; if (h < H_MIN) break; continue; }
        // локальна похибка = |two-half — one-full|
        const err = Math.hypot(p2[0]-full[0], p2[1]-full[1], p2[2]-full[2]);
        if (err > TOL && h > H_MIN) { h = Math.max(H_MIN, h * 0.6); continue; } // відхилити, зменшити
        // прийняти крок p2 (точніший)
        const dseg = Math.hypot(p2[0]-p[0], p2[1]-p[1], p2[2]-p[2]);
        arc += dseg;
        p = p2;
        if (p.some(v => Math.abs(v) > bbox)) break;   // bbox-clamp
        if (dseg < 1e-5) break;                        // застій (фіксована точка)
        pts.push(new THREE.Vector3(p[0], p[2], p[1]));
        if (err < TOL * 0.2 && h < H_MAX) h = Math.min(H_MAX, h * 1.4); // збільшити крок
      }
      if (pts.length > 3) {
        group.add(this._fatLine(pts, expr.color, 2.2));
        const seed = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8),
          new THREE.MeshBasicMaterial({ color: col }));
        seed.position.copy(pts[0]);
        group.add(seed);
      }
    }
    return group;
  }

  // ── Mandelbulb fractal (implicit, via MT worker) ──────────────────────────────
  _mandelbulb(c, expr) {
    const env = this._env();
    const power = c.args && c.args[0] ? (this._ev(c.args[0], env) || 8) : 8;
    const range = 1.2;
    const iterMax = Math.min(Math.max(Math.round(power) + 4, 8), 16);
    const sampleField = (N) => {
      const sz = N + 1;
      const field = new Float32Array(sz * sz * sz);
      for (let iz = 0; iz <= N; iz++) {
        const z0 = -range + 2*range*iz/N;
        for (let iy = 0; iy <= N; iy++) {
          const y0 = -range + 2*range*iy/N;
          for (let ix = 0; ix <= N; ix++) {
            const x0 = -range + 2*range*ix/N;
            let x = x0, y = y0, z = z0, r = 0, val = -1;
            for (let it = 0; it < iterMax; it++) {
              r = Math.sqrt(x*x + y*y + z*z);
              if (r > 2) { val = r - 2; break; }
              const th = Math.acos(r < 1e-12 ? 0 : z / r), ph = Math.atan2(y, x);
              const rp = Math.pow(r, power);
              x = rp * Math.sin(th*power) * Math.cos(ph*power) + x0;
              y = rp * Math.sin(th*power) * Math.sin(ph*power) + y0;
              z = rp * Math.cos(th*power) + z0;
            }
            field[ix + iy*sz + iz*sz*sz] = val;
          }
        }
      }
      return field;
    };
    if (!this._mtWorker) {
      this._mtWorker = new Worker(new URL('./mt-worker.js', import.meta.url));
      this._mtWorker.onmessage = (e) => this._onMTResult(e.data);
    }
    if (!this._mtPending) this._mtPending = new Map();
    const fullN = Math.min(expr.resolution || 56, 96);
    // Крок 1: грубе N=28 одразу (силует за ~30мс)
    const coarseN = 28;
    this._mtPending.set(expr.id, { expr, mat: this._mat(expr),
      // коли грубий результат прийде — замовити повне N у фоні
      refine: fullN > coarseN ? () => {
        const f2 = sampleField(fullN);
        this._mtPending.set(expr.id, { expr, mat: this._mat(expr) });
        this._mtWorker.postMessage({ field: f2, N: fullN, range, id: expr.id }, [f2.buffer]);
      } : null });
    const f1 = sampleField(coarseN);
    this._mtWorker.postMessage({ field: f1, N: coarseN, range, id: expr.id }, [f1.buffer]);
    const placeholder = new THREE.Mesh(
      new THREE.BoxGeometry(range*2, range*2, range*2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(expr.color), wireframe: true, transparent: true, opacity: 0.25 }));
    placeholder.__isPlaceholder = true;
    return placeholder;
  }

  // ── 3D L-system turtle: lsystem3d(axiom, rules, iters, angle) ─────────────────
  // Команди: F G draw · f move · +- yaw · &^ pitch · \/ roll · | розворот180°
  //          [ ] стек · $ вирівняти вгору · 39-quote крок×1.1 · 34-quote крок×0.9 · 0-6 колір
  _lsystem3D(c, expr) {
    const env = this._env();
    const strOf = n => (n && n.kind === "str") ? n.v : String(this._ev(n, env));
    const numOf = (n, d) => { const v = n ? this._ev(n, env) : NaN; return Number.isFinite(v) ? v : d; };
    const axiom = c.args[0] ? strOf(c.args[0]) : "F";
    const rulesStr = c.args[1] ? strOf(c.args[1]) : "";
    const iters = Math.min(Math.round(numOf(c.args[2], 3)), 8);
    const angle = numOf(c.args[3], 25) * Math.PI / 180;
    const map = {};
    rulesStr.split(";").forEach(r => {
      const m = r.split("->");
      if (m.length === 2) map[m[0].trim()] = m[1].trim();
    });
    let s = axiom;
    for (let i = 0; i < iters; i++) {
      let next = "";
      for (const ch of s) next += (map[ch] !== undefined ? map[ch] : ch);
      if (next.length > 300000) break;
      s = next;
    }
    let pos = new THREE.Vector3(0, 0, 0);
    let H = new THREE.Vector3(0, 1, 0);
    let L = new THREE.Vector3(-1, 0, 0);
    let U = new THREE.Vector3(0, 0, 1);
    let stepLen = 1, colIdx = 0;
    const stack = [], pts = [], cols = [];
    const ROLL = String.fromCharCode(92);
    const Q1 = String.fromCharCode(39); // single quote — крок довше
    const Q2 = String.fromCharCode(34); // double quote — крок коротше
    const PAL = ["#388c46","#2d70b3","#c74440","#6042a6","#fa7e19","#cf5283","#1e9e8a"];
    const rot = (a, b, ang) => {
      const ca = Math.cos(ang), sa = Math.sin(ang);
      return [
        a.clone().multiplyScalar(ca).add(b.clone().multiplyScalar(sa)),
        b.clone().multiplyScalar(ca).sub(a.clone().multiplyScalar(sa)),
      ];
    };
    for (const ch of s) {
      if (ch === "F" || ch === "G") {
        const np = pos.clone().add(H.clone().multiplyScalar(stepLen));
        pts.push(pos.clone(), np.clone()); cols.push(colIdx); pos = np;
      }
      else if (ch === "f") pos = pos.clone().add(H.clone().multiplyScalar(stepLen));
      else if (ch === "+") { const r2 = rot(H, L, angle);  H = r2[0]; L = r2[1]; }
      else if (ch === "-") { const r2 = rot(H, L, -angle); H = r2[0]; L = r2[1]; }
      else if (ch === "&") { const r2 = rot(H, U, angle);  H = r2[0]; U = r2[1]; }
      else if (ch === "^") { const r2 = rot(H, U, -angle); H = r2[0]; U = r2[1]; }
      else if (ch === ROLL){ const r2 = rot(L, U, angle);  L = r2[0]; U = r2[1]; }
      else if (ch === "/") { const r2 = rot(L, U, -angle); L = r2[0]; U = r2[1]; }
      else if (ch === "|") { H.negate(); L.negate(); }
      else if (ch === Q1) stepLen *= 1.1;
      else if (ch === Q2) stepLen *= 0.9;
      else if (ch === String.fromCharCode(36)) { H.set(0,1,0); L.set(-1,0,0); U.set(0,0,1); }
      else if (ch >= "0" && ch <= "6") colIdx = +ch;
      else if (ch === "[") stack.push([pos.clone(), H.clone(), L.clone(), U.clone(), stepLen, colIdx]);
      else if (ch === "]") { const st = stack.pop(); if (st) { pos = st[0]; H = st[1]; L = st[2]; U = st[3]; stepLen = st[4]; colIdx = st[5]; } }
    }
    if (!pts.length) return null;
    const box = new THREE.Box3().setFromPoints(pts);
    const ctr = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const sc = 4.5 / Math.max(size.x, size.y, size.z, 0.01);
    const scaled = pts.map(p => p.sub(ctr).multiplyScalar(sc));
    const minY = Math.min(...scaled.map(p => p.y));
    scaled.forEach(p => p.y -= minY);
    const usedColors = new Set(cols);
    if (usedColors.size <= 1) {
      const g = new THREE.BufferGeometry().setFromPoints(scaled);
      return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(expr.color) }));
    }
    const group = new THREE.Group();
    usedColors.forEach(ci => {
      const seg = [];
      cols.forEach((c2, i) => { if (c2 === ci) seg.push(scaled[2*i], scaled[2*i+1]); });
      if (!seg.length) return;
      const g = new THREE.BufferGeometry().setFromPoints(seg);
      group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: new THREE.Color(ci ? (PAL[ci] || expr.color) : expr.color) })));
    });
    return group;
  }

  // ── Gradient field of f(x,y): arrows on the surface ──────────────────────────
  _gradField(c, expr) {
    const range = expr.range || 3, S = 11;
    const env = this._env();
    const f = (x, y) => this._ev(c.args[0], { ...env, x, y });
    const col = new THREE.Color(expr.color);
    const group = new THREE.Group();
    const step = 2 * range / (S - 1), h = 0.01, maxLen = step * 0.85;
    for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
      const x = -range + step * i, y = -range + step * j;
      const z = f(x, y);
      if (!Number.isFinite(z)) continue;
      const fx = (f(x + h, y) - f(x - h, y)) / (2 * h);
      const fy = (f(x, y + h) - f(x, y - h)) / (2 * h);
      const mag = Math.hypot(fx, fy);
      if (!Number.isFinite(mag) || mag < 1e-9) continue;
      const dir = new THREE.Vector3(fx, 0, fy).normalize();
      const len = Math.min(mag / (mag + 1) * maxLen * 1.6, maxLen);
      const origin = new THREE.Vector3(x, z + 0.04, y);
      const hl = Math.min(len * 0.35, 0.16);
      group.add(new THREE.ArrowHelper(dir, origin, Math.max(len, 0.04), col, hl, hl * 0.55));
    }
    return group;
  }

  // ── Riemann sum: columns under z=f(x,y) + volume label ────────────────────────
  _riemann(c, expr) {
    const env = this._env();
    const f = (x, y) => this._ev(c.args[0], { ...env, x, y });
    let n = c.args[1] ? Math.round(this._ev(c.args[1], env)) : 10;
    if (!Number.isFinite(n)) n = 10;
    n = Math.max(2, Math.min(n, 60));
    const range = expr.range || 3;
    const cell = 2 * range / n;
    const items = [];
    let volume = 0, zTop = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const x = -range + cell * (i + 0.5), y = -range + cell * (j + 0.5);
      const zv = f(x, y);
      if (!Number.isFinite(zv)) continue;
      volume += zv * cell * cell;
      if (Math.abs(zv) < 1e-6) continue;
      items.push([x, y, zv]);
      zTop = Math.max(zTop, zv);
    }
    const group = new THREE.Group();
    if (items.length) {
      const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this._mat(expr), items.length);
      const m = new THREE.Matrix4();
      items.forEach(([x, y, zv], k) => {
        m.compose(
          new THREE.Vector3(x, zv / 2, y),
          new THREE.Quaternion(),
          new THREE.Vector3(cell * 0.94, Math.abs(zv), cell * 0.94));
        inst.setMatrixAt(k, m);
      });
      group.add(inst);
    }
    group.add(this._labelSprite('V \u2248 ' + volume.toFixed(3) + '  (n=' + n + ')',
      [0, zTop + 0.9, 0], expr.color));
    return group;
  }

  // ── Intersection curve of two surfaces f(x,y) and g(x,y) ─────────────────────
  _intersectCurve(c, expr) {
    const env = this._env();
    const f = (x, y) => this._ev(c.args[0], { ...env, x, y });
    const g = (x, y) => this._ev(c.args[1], { ...env, x, y });
    const range = expr.range || 3, N = 120;
    const step = 2 * range / N;
    const dv = new Float32Array((N + 1) * (N + 1));
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const d = f(-range + step * i, -range + step * j) - g(-range + step * i, -range + step * j);
      dv[i * (N + 1) + j] = Number.isFinite(d) ? d : 1e9;
    }
    const pts = [];
    const lerp = (xa, ya, da, xb, yb, db) => {
      const t = Math.abs(da - db) < 1e-12 ? 0.5 : da / (da - db);
      const x = xa + t * (xb - xa), y = ya + t * (yb - ya);
      return [x, y];
    };
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x0 = -range + step * i, y0 = -range + step * j;
      const x1 = x0 + step, y1 = y0 + step;
      const a = dv[i*(N+1)+j], b = dv[i*(N+1)+j+1], cc = dv[(i+1)*(N+1)+j], d = dv[(i+1)*(N+1)+j+1];
      if ([a,b,cc,d].some(v => Math.abs(v) > 1e8)) continue;
      const cross = [];
      if (a * b <= 0 && a !== b) cross.push(lerp(x0, y0, a, x0, y1, b));
      if (cc * d <= 0 && cc !== d) cross.push(lerp(x1, y0, cc, x1, y1, d));
      if (a * cc <= 0 && a !== cc) cross.push(lerp(x0, y0, a, x1, y0, cc));
      if (b * d <= 0 && b !== d) cross.push(lerp(x0, y1, b, x1, y1, d));
      if (cross.length >= 2) {
        const z1 = f(cross[0][0], cross[0][1]), z2 = f(cross[1][0], cross[1][1]);
        if (Number.isFinite(z1) && Number.isFinite(z2)) {
          pts.push(new THREE.Vector3(cross[0][0], z1, cross[0][1]),
                   new THREE.Vector3(cross[1][0], z2, cross[1][1]));
        }
      }
    }
    if (!pts.length) return null;
    return this._fatSegments(pts, expr.color, 3);
  }

  // ── Tangent plane to z=f(x,y) at (x0, y0) ─────────────────────────────────────
  _tangentPlane(c, expr) {
    const env = this._env();
    const f = (x, y) => this._ev(c.args[0], { ...env, x, y });
    const x0 = c.args[1] ? this._ev(c.args[1], env) : 0;
    const y0 = c.args[2] ? this._ev(c.args[2], env) : 0;
    const z0 = f(x0, y0);
    if (![x0, y0, z0].every(Number.isFinite)) return null;
    const h = 0.01;
    const fx = (f(x0 + h, y0) - f(x0 - h, y0)) / (2 * h);
    const fy = (f(x0, y0 + h) - f(x0, y0 - h)) / (2 * h);
    if (![fx, fy].every(Number.isFinite)) return null;
    const size = 2.6;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(expr.color), transparent: true, opacity: 0.45,
        side: THREE.DoubleSide, roughness: 0.5, depthWrite: false }));
    // math normal (-fx, -fy, 1) → three (-fx, 1, -fy)
    const nrm = new THREE.Vector3(-fx, 1, -fy).normalize();
    plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm);
    plane.position.set(x0, z0, y0);
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 14, 14),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(expr.color) }));
    marker.position.set(x0, z0, y0);
    return [plane, marker];
  }

  // Скалярна f(x,y): inline-вираз або ім'я funcDef
  _scalarF2(ast) {
    if (ast.kind === 'ident' && this._userFuncs[ast.name]) {
      const name = ast.name;
      return (x, y) => this._ev(
        { kind: 'call', name, args: [{ kind: 'num', v: x }, { kind: 'num', v: y }] }, {});
    }
    return this._f2(ast);
  }

  // ── contour(f, levels?): лінії рівня ──────────────────────────────────────────
  _contour(c, expr) {
    const Rr = expr.range || 3;
    const f = this._scalarF2(c.fAst);
    const env = this._env();
    let zMin = Infinity, zMax = -Infinity;
    const NS = 40;
    for (let i = 0; i <= NS; i++) for (let j = 0; j <= NS; j++) {
      const z = f(-Rr + 2*Rr*i/NS, -Rr + 2*Rr*j/NS);
      if (Number.isFinite(z) && Math.abs(z) < 1e6) { zMin = Math.min(zMin, z); zMax = Math.max(zMax, z); }
    }
    if (!(zMax > zMin)) return null;
    const lv = c.levelAst ? this._ev(c.levelAst, env) : null;
    let levels;
    const auto = n => {
      const out = [], d = (zMax - zMin) / (n + 1);
      for (let i = 1; i <= n; i++) out.push(zMin + d * i);
      return out;
    };
    if (lv == null || !Number.isFinite(lv)) levels = auto(10);
    else if (Number.isInteger(lv) && lv >= 2 && lv <= 40) levels = auto(lv);
    else levels = [lv];
    const group = new THREE.Group();
    const col = new THREE.Color(expr.color);
    levels.forEach(L => group.add(this._marchingSquaresLines(
      (a, b) => f(a, b) - L, Rr, (a, b) => new THREE.Vector3(a, L + 0.01, b), col)));
    return group;
  }

  // ── critical(f): критичні точки (Ньютон по ∇f, класифікація Гессіаном) ────────
  _critical(c, expr) {
    const Rr = expr.range || 3;
    const f = this._scalarF2(c.fAst);
    const h = 0.01, G = 12, step = 2 * Rr / G;
    const found = [];
    const grad = (x, y) => [
      (f(x + h, y) - f(x - h, y)) / (2 * h),
      (f(x, y + h) - f(x, y - h)) / (2 * h)];
    const hess = (x, y) => {
      const f0 = f(x, y);
      return [
        (f(x + h, y) - 2 * f0 + f(x - h, y)) / (h * h),
        (f(x, y + h) - 2 * f0 + f(x, y - h)) / (h * h),
        (f(x + h, y + h) - f(x + h, y - h) - f(x - h, y + h) + f(x - h, y - h)) / (4 * h * h)];
    };
    for (let i = 1; i < G; i++) for (let j = 1; j < G; j++) {
      let x = -Rr + step * i, y = -Rr + step * j, ok = true;
      for (let it = 0; it < 12; it++) {
        const [fx, fy] = grad(x, y);
        if (![fx, fy].every(Number.isFinite)) { ok = false; break; }
        if (Math.hypot(fx, fy) < 1e-8) break;
        const [fxx, fyy, fxy] = hess(x, y);
        const det = fxx * fyy - fxy * fxy;
        if (!Number.isFinite(det) || Math.abs(det) < 1e-12) { ok = false; break; }
        const dx = (fyy * fx - fxy * fy) / det, dy = (fxx * fy - fxy * fx) / det;
        x -= dx; y -= dy;
        if (Math.hypot(dx, dy) > step * 2) { ok = false; break; }
      }
      if (!ok || Math.abs(x) > Rr || Math.abs(y) > Rr) continue;
      const [fx, fy] = grad(x, y);
      if (Math.hypot(fx, fy) > 1e-5) continue;
      if (found.some(p => Math.hypot(p.x - x, p.y - y) < 0.2)) continue;
      const [fxx, fyy, fxy] = hess(x, y);
      const det = fxx * fyy - fxy * fxy;
      const type = det < -1e-9 ? 'сідло' : det > 1e-9 ? (fxx > 0 ? 'мін' : 'макс') : null;
      if (!type) continue;
      const z = f(x, y);
      if (!Number.isFinite(z)) continue;
      found.push({ x, y, z, type });
      if (found.length >= 24) break;
    }
    if (!found.length) return null;
    const group = new THREE.Group();
    const COLS = { 'мін': '#388c46', 'макс': '#c74440', 'сідло': '#fa7e19' };
    found.forEach(p => {
      const mk = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(COLS[p.type]) }));
      mk.position.set(p.x, p.z, p.y);
      group.add(mk);
      group.add(this._labelSprite(
        p.type + ' (' + (+p.x.toFixed(2)) + ', ' + (+p.y.toFixed(2)) + ')',
        [p.x + 0.1, p.z + 0.3, p.y], COLS[p.type]));
    });
    return group;
  }

  // ── label("текст", P) ─────────────────────────────────────────────────────────
  _label3D(c, expr) {
    const env = this._env();
    const p = c.pAsts.map(a => this._ev(a, env));
    if (!p.every(Number.isFinite)) return null;
    return this._labelSprite(c.text, [p[0], p[2], p[1]], expr.color);
  }

  // ── segment(P, Q) ─────────────────────────────────────────────────────────────
  _segment3D(c, expr) {
    const env = this._env();
    const p = c.pAsts.map(a => this._ev(a, env));
    const q = c.qAsts.map(a => this._ev(a, env));
    if (![...p, ...q].every(Number.isFinite)) return null;
    const col = new THREE.Color(expr.color);
    const A = new THREE.Vector3(p[0], p[2], p[1]);
    const B = new THREE.Vector3(q[0], q[2], q[1]);
    const group = new THREE.Group();
    group.add(this._fatLine([A, B], col, 3));
    [A, B].forEach(pt => {
      const mk = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10),
        new THREE.MeshBasicMaterial({ color: col }));
      mk.position.copy(pt);
      group.add(mk);
    });
    return group;
  }

  // ── div(F): скалярне поле дивергенції — хмара кольорових точок ───────────────
  _divField(c, expr) {
    const env = this._env();
    const Rr = expr.range || 3, S = 9, h = 0.01;
    const Fx = this._f3(c.xAst), Fy = this._f3(c.yAst), Fz = this._f3(c.zAst);
    const divAt = (x,y,z) =>
      (Fx(x+h,y,z) - Fx(x-h,y,z)) / (2*h) +
      (Fy(x,y+h,z) - Fy(x,y-h,z)) / (2*h) +
      (Fz(x,y,z+h) - Fz(x,y,z-h)) / (2*h);
    const pos = [], vals = [];
    let vMax = 0;
    const step = 2 * Rr / (S - 1);
    for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) for (let k = 0; k < S; k++) {
      const x = -Rr + step*i, y = -Rr + step*j, z = -Rr + step*k;
      const d = divAt(x, y, z);
      if (!Number.isFinite(d)) continue;
      pos.push(x, z, y); vals.push(d);
      vMax = Math.max(vMax, Math.abs(d));
    }
    if (!pos.length) return null;
    if (vMax < 1e-12) vMax = 1;
    const colors = new Float32Array(vals.length * 3);
    vals.forEach((d, i) => {
      const t = Math.max(-1, Math.min(1, d / vMax)); // −1..1
      colors[i*3]   = t > 0 ? 0.55 + 0.45*t : 0.55 * (1 + t) + 0.15;
      colors[i*3+1] = 0.55 * (1 - Math.abs(t)) + 0.1;
      colors[i*3+2] = t < 0 ? 0.55 - 0.45*t : 0.55 * (1 - t) + 0.15;
    });
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(geom, new THREE.PointsMaterial({
      size: 0.14, vertexColors: true }));
    const label = this._labelSprite(
      'div ∈ [' + (-vMax).toFixed(2) + ', ' + vMax.toFixed(2) + ']',
      [0, Rr + 0.7, 0], expr.color);
    return [points, label];
  }

  // ── curl(F): ротор — векторне поле стрілок ────────────────────────────────────
  _curlField(c, expr) {
    const env = this._env();
    const Rr = expr.range || 3, S = 7, h = 0.01;
    const Fx = this._f3(c.xAst), Fy = this._f3(c.yAst), Fz = this._f3(c.zAst);
    const col = new THREE.Color(expr.color);
    const group = new THREE.Group();
    const step = 2 * Rr / (S - 1), maxLen = step * 0.8;
    for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) for (let k = 0; k < S; k++) {
      const x = -Rr + step*i, y = -Rr + step*j, z = -Rr + step*k;
      const cx = (Fz(x,y+h,z) - Fz(x,y-h,z)) / (2*h) - (Fy(x,y,z+h) - Fy(x,y,z-h)) / (2*h);
      const cy = (Fx(x,y,z+h) - Fx(x,y,z-h)) / (2*h) - (Fz(x+h,y,z) - Fz(x-h,y,z)) / (2*h);
      const cz = (Fy(x+h,y,z) - Fy(x-h,y,z)) / (2*h) - (Fx(x,y+h,z) - Fx(x,y-h,z)) / (2*h);
      const mag = Math.hypot(cx, cy, cz);
      if (!Number.isFinite(mag) || mag < 1e-9) continue;
      const dir = new THREE.Vector3(cx, cz, cy).normalize();   // math→three
      const len = Math.min(mag / (mag + 1) * maxLen * 2, maxLen);
      const hl = Math.min(len * 0.35, 0.18);
      group.add(new THREE.ArrowHelper(dir,
        new THREE.Vector3(x, z, y), Math.max(len, 0.05), col, hl, hl * 0.55));
    }
    return group;
  }

  // ── vector(P, Q): стрілка від точки P до Q ────────────────────────────────────
  _vectorAnchored(c, expr) {
    const env = this._env();
    const p = c.pAsts.map(a => this._ev(a, env));
    const q = c.qAsts.map(a => this._ev(a, env));
    if (![...p, ...q].every(Number.isFinite)) return null;
    const from = new THREE.Vector3(p[0], p[2], p[1]);
    const to   = new THREE.Vector3(q[0], q[2], q[1]);
    const dir  = to.clone().sub(from);
    const len  = dir.length();
    if (len < 1e-9) return null;
    const col = new THREE.Color(expr.color);
    return new THREE.ArrowHelper(dir.normalize(), from, len, col,
      Math.min(len * 0.2, 0.3), Math.min(len * 0.1, 0.15));
  }

  // ── Slice plane (SSOT BLOCK 3): напівпрозора площина + криві перетину ────────
  _slicePlane(c, expr) {
    const env = this._env();
    const Rr = expr.range || 3;
    const group = new THREE.Group();
    const col = new THREE.Color(expr.color);
    let val = 0;
    if (c.axis) {
      val = this._ev(c.valAst, env);
      if (!Number.isFinite(val)) return null;
    }
    const planeGeom = new THREE.PlaneGeometry(2 * Rr, 2 * Rr);
    const plane = new THREE.Mesh(planeGeom, new THREE.MeshBasicMaterial({
      color: col, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }));
    plane.__sliceId = expr.id;
    if (c.axis === 'x')      { plane.rotation.y = Math.PI / 2; plane.position.x = val; }
    else if (c.axis === 'y') { plane.position.z = val; }               // math y → three z
    else if (c.axis === 'z') { plane.rotation.x = -Math.PI / 2; plane.position.y = val; }
    else {
      const [a, b, cc, d] = c.coefAsts.map(A => this._ev(A, env));
      if (![a, b, cc, d].every(Number.isFinite)) return null;
      const n = new THREE.Vector3(a, cc, b);                            // math→three
      const len = n.length(); if (len < 1e-9) return null;
      n.divideScalar(len);
      plane.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      plane.position.copy(n.clone().multiplyScalar(d / len));
    }
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(planeGeom),
      new THREE.LineBasicMaterial({ color: col }));
    edge.position.copy(plane.position);
    edge.quaternion.copy(plane.quaternion);
    group.add(plane, edge);
    if (c.axis) group.add(this._sliceIntersections(c.axis, val, Rr, col));
    group.__isSlice = true;
    group.traverse(o => { o.__isSlice = true; });
    return group;
  }

  // Криві перетину активної площини з видимими surfaceZ / implicit3D
  _sliceIntersections(axis, val, Rr, col) {
    const group = new THREE.Group();
    const N = 200;
    for (const e of this.expressions) {
      if (!e.visible || !e.classified) continue;
      const k = e.classified.kind;
      if (k === 'surfaceZ') {
        const f = (x, y) => this._ev(e.classified.ast, { x, y });
        if (axis === 'x' || axis === 'y') {
          let cur = []; const segs = [];
          for (let i = 0; i <= N; i++) {
            const q = -Rr + 2 * Rr * i / N;
            const x = axis === 'x' ? val : q;
            const y = axis === 'y' ? val : q;
            const z = f(x, y);
            if (Number.isFinite(z) && Math.abs(z) < 1e4) cur.push(new THREE.Vector3(x, z, y));
            else { if (cur.length > 1) segs.push(cur); cur = []; }
          }
          if (cur.length > 1) segs.push(cur);
          segs.forEach(p => group.add(this._fatLine(p, col, 2.5)));
        } else {
          group.add(this._marchingSquaresLines((x, y) => f(x, y) - val, Rr,
            (a, b) => new THREE.Vector3(a, val, b), col));
        }
      } else if (k === 'implicit3D') {
        const F = (x, y, z) => {
          const lv = this._ev(e.classified.lhsAst, { x, y, z });
          const rv = this._ev(e.classified.rhsAst, { x, y, z });
          return (isFinite(lv) && isFinite(rv)) ? lv - rv : NaN;
        };
        let f2, lift;
        if (axis === 'x')      { f2 = (a, b) => F(val, a, b); lift = (a, b) => new THREE.Vector3(val, b, a); }
        else if (axis === 'y') { f2 = (a, b) => F(a, val, b); lift = (a, b) => new THREE.Vector3(a, b, val); }
        else                   { f2 = (a, b) => F(a, b, val); lift = (a, b) => new THREE.Vector3(a, val, b); }
        group.add(this._marchingSquaresLines(f2, Rr, lift, col));
      }
    }
    return group;
  }

  // ── Fat lines (Полір-4): Line2 з піксельною товщиною ──────────────────────────
  _fatMat(color, width = 2.5) {
    if (!this._fatMats) this._fatMats = new Set();
    const m = new LineMaterial({
      color: new THREE.Color(color).getHex(), linewidth: width });
    m.resolution.set(this.container.clientWidth || 800, this.container.clientHeight || 600);
    this._fatMats.add(m);
    return m;
  }
  _fatSegments(points, color, width = 2.5) {  // пари точок
    const arr = [];
    points.forEach(p => arr.push(p.x, p.y, p.z));
    const g = new LineSegmentsGeometry();
    g.setPositions(arr);
    const l = new LineSegments2(g, this._fatMat(color, width));
    l.computeLineDistances();
    return l;
  }
  _fatLine(points, color, width = 2.5) {      // полілінія
    const arr = [];
    points.forEach(p => arr.push(p.x, p.y, p.z));
    const g = new LineGeometry();
    g.setPositions(arr);
    const l = new Line2(g, this._fatMat(color, width));
    l.computeLineDistances();
    return l;
  }

  // Marching squares: нульова лінія f2(a,b)=0 → LineSegments через lift(a,b)
  _marchingSquaresLines(f2, Rr, lift, col) {
    const N = 100, step = 2 * Rr / N;
    const vals = new Float32Array((N + 1) * (N + 1));
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
      const v = f2(-Rr + step * i, -Rr + step * j);
      vals[i * (N + 1) + j] = Number.isFinite(v) ? v : 1e9;
    }
    const pts = [];
    const lerp = (pa, pb, da, db) => {
      const t = Math.abs(da - db) < 1e-12 ? 0.5 : da / (da - db);
      return [pa[0] + t * (pb[0] - pa[0]), pa[1] + t * (pb[1] - pa[1])];
    };
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const a0 = -Rr + step * i, b0 = -Rr + step * j, a1 = a0 + step, b1 = b0 + step;
      const va = vals[i*(N+1)+j], vb = vals[i*(N+1)+j+1], vc = vals[(i+1)*(N+1)+j], vd = vals[(i+1)*(N+1)+j+1];
      if ([va, vb, vc, vd].some(v => Math.abs(v) > 1e8)) continue;
      const cross = [];
      if (va * vb <= 0 && va !== vb) cross.push(lerp([a0,b0],[a0,b1],va,vb));
      if (vc * vd <= 0 && vc !== vd) cross.push(lerp([a1,b0],[a1,b1],vc,vd));
      if (va * vc <= 0 && va !== vc) cross.push(lerp([a0,b0],[a1,b0],va,vc));
      if (vb * vd <= 0 && vb !== vd) cross.push(lerp([a0,b1],[a1,b1],vb,vd));
      if (cross.length >= 2)
        pts.push(lift(cross[0][0], cross[0][1]), lift(cross[1][0], cross[1][1]));
    }
    if (!pts.length) return new THREE.Group();
    return this._fatSegments(pts, col, 2.5);
  }

  // Перебудувати всі slice-об'єкти (вони залежать від інших виразів)
  _rebuildSlices(exceptId) {
    this.expressions.forEach(e => {
      if (e.id !== exceptId && e.classified?.kind === 'slice3D') {
        this._removeMesh(e.id); this._build(e);
      }
    });
  }

  setActiveSlice(id) {
    this.expressions.forEach(e => {
      if (e.classified?.kind === 'slice3D') e.active = (e.id === id);
    });
    if (this.onChange) this.onChange({ reason: 'expression' });
  }

  getActiveSlice() {
    const e = this.expressions.find(e =>
      e.classified?.kind === 'slice3D' && e.visible && e.active !== false && e.classified.axis);
    if (!e) return null;
    const val = this._ev(e.classified.valAst, this._env());
    return Number.isFinite(val) ? { id: e.id, axis: e.classified.axis, value: val } : null;
  }

  // ── 3D point ─────────────────────────────────────────────────────────────────
  // Координата — чистий ідент-параметр → цю вісь можна тягнути мишею (№22)
  _dragVarsOf(c) {
    const varOf = a => (a && a.kind === 'ident' &&
      Object.prototype.hasOwnProperty.call(this.params, a.name)) ? a.name : null;
    return [varOf(c.xAst), varOf(c.yAst), varOf(c.zAst)];
  }

  _point3D(c, expr) {
    const env = this._env();
    const x = this._ev(c.xAst, env), y = this._ev(c.yAst, env), z = this._ev(c.zAst, env);
    if (![x,y,z].every(Number.isFinite)) return null;
    const dragVars = this._dragVarsOf(c);
    const draggable = dragVars.some(v => v);
    const geo = new THREE.SphereGeometry(draggable ? 0.13 : 0.1, 14, 14);
    const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(expr.color) });
    if (draggable) { mat.emissive = new THREE.Color(expr.color); mat.emissiveIntensity = 0.35; }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, z, y);
    if (draggable) {
      mesh.__dragPoint = { id: expr.id, dragVars };
      // невидима більша зона захвату
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.copy(mesh.position);
      hit.__dragPoint = mesh.__dragPoint;
      const fmt0 = v => Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '');
      const sp0 = this._labelSprite(`(${fmt0(x)}, ${fmt0(y)}, ${fmt0(z)})`,
        [x + 0.18, z + 0.32, y], expr.color);
      return [mesh, hit, sp0];
    }
    // Compact label: short decimals, wide canvas so text fits
    const fmt = v => Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '');
    const label = `(${fmt(x)}, ${fmt(y)}, ${fmt(z)})`;
    const sp = this._labelSprite(label, [x + 0.18, z + 0.32, y], expr.color);
    return [mesh, sp];
  }

  _labelSprite(text, pos, color) {
    const CW = 512, CH = 80;
    const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
    const ctx = cv.getContext('2d');
    ctx.font = 'bold 38px Arial'; ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, CW / 2, CH / 2);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(cv), depthTest: false }));
    sp.position.set(...pos);
    sp.scale.set(CW / CH * 0.5, 0.5, 0.5); // correct aspect ratio
    return sp;
  }

  // ── Render loop ─────────────────────────────────────────────────────────────
  _loop() {
    if (this._destroyed) return;
    const now = performance.now();
    const dt  = Math.min((now - this._lastT) / 1000, 0.1);
    this._lastT = now;

    this._tickAnimations(dt);
    this._tickUnfolds();
    if (this._autoRot && this._autoRot.enabled) {
      const t = this.controls.target;
      const v = this.camera.position.clone().sub(t);
      v.applyAxisAngle(new THREE.Vector3(0, 1, 0), this._autoRot.speed * dt * 0.5);
      this.camera.position.copy(t).add(v);
      this.camera.lookAt(t);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    // FPS
    this._fpsFrames++; this._fpsTimer += dt;
    if (this._fpsTimer >= 0.5) {
      this._fps = Math.round(this._fpsFrames / this._fpsTimer);
      this._fpsFrames = 0; this._fpsTimer = 0;
      if (this.onFPS) this.onFPS(this._fps);
    }
    this._raf = requestAnimationFrame(() => this._loop());
  }

  // ── Click inspection: pick a point on any mesh, show coord label ─────────────
  enablePicking() {
    if (this._pickEnabled) return;
    this._pickEnabled = true;
    this._raycaster = new THREE.Raycaster();
    const dom = this.renderer.domElement;
    let downX = 0, downY = 0;
    const ndcOf = e => {
      const rect = dom.getBoundingClientRect();
      return new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1,
                               -((e.clientY - rect.top) / rect.height) * 2 + 1);
    };
    dom.addEventListener('pointerdown', e => {
      downX = e.clientX; downY = e.clientY;
      // Point drag (№22): draggable точки мають пріоритет
      this._raycaster.setFromCamera(ndcOf(e), this.camera);
      const dragTargets = [];
      this._meshes.forEach(arr => arr.forEach(o => {
        if (o.__dragPoint && o.visible !== false) dragTargets.push(o);
      }));
      if (dragTargets.length) {
        const phits = this._raycaster.intersectObjects(dragTargets, false);
        if (phits.length) {
          const dp = phits[0].object.__dragPoint;
          // Площина перетягування: через точку, перпендикулярна погляду
          const camDir = new THREE.Vector3();
          this.camera.getWorldDirection(camDir);
          const anchor = phits[0].object.position.clone();
          this._pointDrag = {
            ...dp,
            plane: new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, anchor),
            last: 0,
          };
          this.controls.enabled = false;
          dom.style.cursor = 'grabbing';
          return;
        }
      }
      // Slice drag: тільки площини з числовим значенням
      this._raycaster.setFromCamera(ndcOf(e), this.camera);
      const planes = [];
      this._meshes.forEach(arr => arr.forEach(g =>
        g.traverse(o => { if (o.__sliceId != null && o.visible) planes.push(o); })));
      if (!planes.length) return;
      const hits = this._raycaster.intersectObjects(planes, false);
      if (!hits.length) return;
      const expr = this._get(hits[0].object.__sliceId);
      const c = expr?.classified;
      const isNum = a => a && (a.kind === 'num' || (a.kind === 'unary' && a.arg?.kind === 'num'));
      if (!c || !c.axis || !isNum(c.valAst)) return;
      this._sliceDrag = { id: expr.id, axis: c.axis, val: this._ev(c.valAst, this._env()) };
      this.controls.enabled = false;
    });
    dom.addEventListener('pointermove', e => {
      const pd = this._pointDrag;
      if (pd) {
        const now = performance.now();
        if (now - pd.last < 33) return; // ~30 Гц
        pd.last = now;
        this._raycaster.setFromCamera(ndcOf(e), this.camera);
        const ipt = new THREE.Vector3();
        if (!this._raycaster.ray.intersectPlane(pd.plane, ipt)) return;
        // three(x,y,z) → math(x,z,y); оновлюємо лише осі-параметри
        const mathVals = [ipt.x, ipt.z, ipt.y];
        const upd = {};
        pd.dragVars.forEach((v, i) => {
          if (v) upd[v] = Math.max(-50, Math.min(50, mathVals[i]));
        });
        Object.entries(upd).forEach(([n, v]) => { this.params[n] = v; });
        this._rebuildAll();
        if (this.onChange) this.onChange({ reason: 'param' });
        return;
      }
      const d = this._sliceDrag; if (!d) return;
      this._raycaster.setFromCamera(ndcOf(e), this.camera);
      const axisVec = d.axis === 'x' ? new THREE.Vector3(1, 0, 0)
                    : d.axis === 'y' ? new THREE.Vector3(0, 0, 1)
                    : new THREE.Vector3(0, 1, 0);
      const camDir = new THREE.Vector3(); this.camera.getWorldDirection(camDir);
      const n = camDir.clone().sub(axisVec.clone().multiplyScalar(camDir.dot(axisVec)));
      if (n.lengthSq() < 1e-6) return;
      n.normalize();
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        n, axisVec.clone().multiplyScalar(d.val));
      const ipt = new THREE.Vector3();
      if (!this._raycaster.ray.intersectPlane(plane, ipt)) return;
      const nv = Math.max(-20, Math.min(20, ipt.dot(axisVec)));
      if (Math.abs(nv - d.val) < 0.02) return;
      d.val = nv;
      this.updateExpression(d.id, 'slice(' + d.axis + ' = ' + (+nv.toFixed(2)) + ')');
    });
    dom.addEventListener('pointerup', e => {
      if (this._pointDrag) {
        this._pointDrag = null;
        this.controls.enabled = true;
        dom.style.cursor = '';
        if (this.onChange) this.onChange({ reason: 'param' });
        return;
      }
      if (this._sliceDrag) { this._sliceDrag = null; this.controls.enabled = true; return; }
      // Ignore drags (camera rotation)
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 5) return;
      const rect = dom.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this._raycaster.setFromCamera(ndc, this.camera);
      const targets = [];
      this._meshes.forEach(arr => arr.forEach(m => {
        if (m.visible && !m.__isPlaceholder) targets.push(m);
      }));
      let hits = [];
      try { hits = this._raycaster.intersectObjects(targets, true); } catch(_) {}
      if (hits.length) this._showPick(hits[0].point);
      else this._clearPick();
    });
  }

  _showPick(p) {
    this._clearPick();
    // Three.js(x, y, z) → math(x, z, y)
    const mx = p.x, my = p.z, mz = p.y;
    const fmt = v => (+v.toFixed(2)).toString();
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 14, 14),
      new THREE.MeshBasicMaterial({ color: 0x111111 }));
    marker.position.copy(p);
    const label = this._labelSprite(
      '(' + fmt(mx) + ', ' + fmt(my) + ', ' + fmt(mz) + ')',
      [p.x + 0.15, p.y + 0.35, p.z], '#111111');
    this._pickObjs = [marker, label];
    this._pickObjs.forEach(o => this.scene.add(o));
  }

  _clearPick() {
    (this._pickObjs || []).forEach(o => {
      this.scene.remove(o);
      o.geometry && o.geometry.dispose();
      o.material && o.material.dispose();
    });
    this._pickObjs = null;
  }

  destroy() {
    this._destroyed = true;
    cancelAnimationFrame(this._raf);
    this._ro?.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement))
      this.container.removeChild(this.renderer.domElement);
  }
}

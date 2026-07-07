// mt-worker.js — Marching Tetrahedra in a Web Worker
// Receives: {field: Float32Array, N, range, id}
// Sends:    {id, positions: Float32Array} via transferable

const _CV = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
const _CT = [[0,1,2,5],[0,2,3,7],[0,4,5,7],[2,5,6,7],[0,2,5,7]];
const _TE = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
const _TT = [
  [],             // 0
  [0,1,2],        // 1
  [0,3,4],        // 2
  [1,3,4,1,4,2],  // 3
  [1,3,5],        // 4
  [0,2,5,0,5,3],  // 5
  [0,1,5,0,5,4],  // 6
  [2,5,4],        // 7
  [2,4,5],        // 8
  [0,4,5,0,5,1],  // 9
  [0,2,5,0,5,3],  // 10
  [1,5,3],        // 11
  [1,3,4,1,4,2],  // 12
  [0,4,3],        // 13
  [0,2,1],        // 14
  [],             // 15
];

function marchingTetrahedra(field, N, range) {
  const dx = 2 * range / N, sz = N + 1;
  const verts = [];
  for (let iz = 0; iz < N; iz++) {
    for (let iy = 0; iy < N; iy++) {
      for (let ix = 0; ix < N; ix++) {
        const fv = _CV.map(([vx,vy,vz]) => field[(ix+vx)+(iy+vy)*sz+(iz+vz)*sz*sz]);
        const pv = _CV.map(([vx,vy,vz]) => [
          -range + dx*(ix+vx),
          -range + dx*(iy+vy),
          -range + dx*(iz+vz),
        ]);
        for (const tet of _CT) {
          const [ta,tb,tc,td] = tet;
          const tetCase = (fv[ta]<0?1:0)|(fv[tb]<0?2:0)|(fv[tc]<0?4:0)|(fv[td]<0?8:0);
          const tris = _TT[tetCase];
          if (!tris.length) continue;
          const tF = [fv[ta],fv[tb],fv[tc],fv[td]];
          const tP = [pv[ta],pv[tb],pv[tc],pv[td]];
          const ep = _TE.map(([ei,ej]) => {
            const [px,py,pz] = tP[ei], [qx,qy,qz] = tP[ej];
            const d = tF[ei] - tF[ej];
            const t = Math.abs(d) < 1e-12 ? 0.5 : Math.max(0, Math.min(1, tF[ei] / d));
            return [px + t*(qx-px), py + t*(qy-py), pz + t*(qz-pz)];
          });
          for (let i = 0; i < tris.length; i += 3) {
            const [ax,ay,az] = ep[tris[i]];
            const [bx,by,bz] = ep[tris[i+1]];
            const [cx,cy,cz] = ep[tris[i+2]];
            // math(x,y,z) → Three.js(x, z, y)
            verts.push(ax,az,ay, bx,bz,by, cx,cz,cy);
          }
        }
      }
    }
  }
  return new Float32Array(verts);
}

const _fnCache = new Map(); // jsSrc → compiled Function
function fnOf(src) {
  if (_fnCache.has(src)) return _fnCache.get(src);
  let fn = null;
  try {
    fn = new Function('x','y','z','E',
      'const t=0,s=0,u=0,v=0,th=0,ph=0,rh=0; return (' + src + ');');
  } catch (_) {}
  _fnCache.set(src, fn);
  if (_fnCache.size > 50) _fnCache.delete(_fnCache.keys().next().value);
  return fn;
}

self.onmessage = function(e) {
  const d = e.data;
  if (d.mode === 'sample') {
    // № 23: семплінг компільованих виразів прямо у worker — main thread вільний
    const { lhsSrc, rhsSrc, env, N, range, id } = d;
    const fL = fnOf(lhsSrc), fR = fnOf(rhsSrc);
    if (!fL || !fR) { self.postMessage({ id, error: 'compile' }); return; }
    const sz = N + 1;
    const field = new Float32Array(sz * sz * sz);
    const dx = 2 * range / N;
    try {
      for (let iz = 0; iz <= N; iz++) {
        const my = -range + dx * iz;
        for (let iy = 0; iy <= N; iy++) {
          const mz = -range + dx * iy;
          for (let ix = 0; ix <= N; ix++) {
            const mx = -range + dx * ix;
            const lv = fL(mx, my, mz, env), rv = fR(mx, my, mz, env);
            field[ix + iy*sz + iz*sz*sz] = (isFinite(lv) && isFinite(rv)) ? lv - rv : 1e6;
          }
        }
      }
    } catch (_) { self.postMessage({ id, error: 'eval' }); return; }
    const positions = marchingTetrahedra(field, N, range);
    self.postMessage({ id, positions }, [positions.buffer]);
    return;
  }
  const { field, N, range, id } = d;
  const positions = marchingTetrahedra(field, N, range);
  // Transfer ownership of the buffer back — zero-copy
  self.postMessage({ id, positions }, [positions.buffer]);
};

// Solid Card — single 3D solid with controls
// VENDORED from scripts/Geom_bady_4/solid-card.js — Phase O PR-O2.
// DO NOT MODIFY INTERNAL LOGIC (SSOT §3.7.1 adapter pattern).
// Reads `window.THREE` — loader assigns it before importing this module.
// IIFE registers SolidCard constructor on `window.SolidCard` (consumed by loader).
(function () {
  const THREE = window.THREE;

  function mergeVerts(geometry, tolerance = 1e-4) {
    tolerance = Math.max(tolerance, Number.EPSILON);
    const hashToIndex = {};
    const indices = geometry.getIndex();
    const positions = geometry.getAttribute('position');
    const vertexCount = indices ? indices.count : positions.count;
    let nextIndex = 0;
    const attrNames = Object.keys(geometry.attributes);
    const tmpAttrs = {};
    const newIndices = [];
    const decimal = Math.log10(1 / tolerance);
    const shiftMultiplier = Math.pow(10, decimal);
    const getComp = (attr, idx, k) => {
      if (attr.getComponent) return attr.getComponent(idx, k);
      return attr.array[idx * attr.itemSize + k];
    };
    for (const name of attrNames) tmpAttrs[name] = [];
    for (let i = 0; i < vertexCount; i++) {
      const index = indices ? indices.getX(i) : i;
      let hash = '';
      for (const name of attrNames) {
        const attr = geometry.getAttribute(name);
        for (let k = 0; k < attr.itemSize; k++) hash += `${~~(getComp(attr, index, k) * shiftMultiplier)},`;
      }
      if (hash in hashToIndex) {
        newIndices.push(hashToIndex[hash]);
      } else {
        for (const name of attrNames) {
          const attr = geometry.getAttribute(name);
          for (let k = 0; k < attr.itemSize; k++) tmpAttrs[name].push(getComp(attr, index, k));
        }
        hashToIndex[hash] = nextIndex;
        newIndices.push(nextIndex);
        nextIndex++;
      }
    }
    const result = new THREE.BufferGeometry();
    for (const name of attrNames) {
      const oldAttr = geometry.getAttribute(name);
      const buffer = new oldAttr.array.constructor(tmpAttrs[name]);
      result.setAttribute(name, new THREE.BufferAttribute(buffer, oldAttr.itemSize, oldAttr.normalized));
    }
    result.setIndex(newIndices);
    result.computeVertexNormals();
    return result;
  }

  const LABELS = {
    cube: { name: 'Куб', vertices: 8, edges: 12, faces: 6 },
    cuboid: { name: 'Прямокутний паралелепіпед', vertices: 8, edges: 12, faces: 6 },
    sphere: { name: 'Куля', vertices: '∞', edges: '∞', faces: 1 },
    cylinder: { name: 'Циліндр', vertices: '∞', edges: 2, faces: 3 },
    cone: { name: 'Конус', vertices: 1, edges: 1, faces: 2 },
    tetrahedron: { name: 'Тетраедр', vertices: 4, edges: 6, faces: 4 },
    pyramid3: { name: 'Піраміда трикутна', vertices: 4, edges: 6, faces: 4 },
    pyramid4: { name: 'Піраміда квадратна', vertices: 5, edges: 8, faces: 5 },
    prism3: { name: 'Призма трикутна', vertices: 6, edges: 9, faces: 5 },
    prism6: { name: 'Призма шестикутна', vertices: 12, edges: 18, faces: 8 },
  };

  class SolidCard {
    constructor(container, opts) {
      this.container = container;
      this.type = opts.type;
      this.meta = LABELS[opts.type];
      this.state = {
        showFaces: true, showEdges: true, showVertices: false,
        transparent: false, showNet: false, showCut: false,
        cutHeight: 0.5, autoRotate: true, building: 0,
      };
      this._initRenderer();
      this._initScene();
      this._buildSolid();
      this._initInteraction();
      this._loop();
    }

    _initRenderer() {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      r.shadowMap.enabled = true;
      r.shadowMap.type = THREE.PCFSoftShadowMap;
      r.setClearColor(0x000000, 0);
      r.setSize(this.container.clientWidth || 300, this.container.clientHeight || 300);
      this.container.appendChild(r.domElement);
      r.domElement.style.cssText = 'display:block;cursor:grab;';
      this.renderer = r;
    }

    _initScene() {
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      this.camera.position.set(4.2, 3.6, 5.4);
      this.camera.lookAt(0, 0.2, 0);

      const key = new THREE.DirectionalLight(0xfff5e6, 1.05);
      key.position.set(5, 8, 4);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.camera.left = -4; key.shadow.camera.right = 4;
      key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
      key.shadow.radius = 6; key.shadow.bias = -0.0008;
      this.scene.add(key);
      const fill = new THREE.DirectionalLight(0xc8d8ff, 0.35);
      fill.position.set(-4, 3, -3);
      this.scene.add(fill);
      this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));

      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.ShadowMaterial({ opacity: 0.22 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -1.05;
      ground.receiveShadow = true;
      this.scene.add(ground);

      this.root = new THREE.Group();
      this.scene.add(this.root);
      this.netGroup = new THREE.Group();
      this.netGroup.visible = false;
      this.scene.add(this.netGroup);
      this.labelGroup = new THREE.Group();
      this.root.add(this.labelGroup);
    }

    _materials() {
      return {
        face: new THREE.MeshStandardMaterial({
          color: 0xe9b88a, roughness: 0.55, metalness: 0.05,
          transparent: true, opacity: 1, side: THREE.DoubleSide,
        }),
        edge: new THREE.LineBasicMaterial({ color: 0x2b2118, transparent: true, opacity: 1 }),
        vertex: new THREE.MeshBasicMaterial({ color: 0x2b2118 }),
      };
    }

    _buildSolid() {
      const { face, edge } = this._materials();
      this.mats = { face, edge };

      let geom, verts = [];
      switch (this.type) {
        case 'cube': {
          geom = new THREE.BoxGeometry(1.6, 1.6, 1.6);
          const s = 0.8;
          verts = [
            { p: [-s,-s,s], l: 'A' }, { p: [s,-s,s], l: 'B' }, { p: [s,-s,-s], l: 'C' }, { p: [-s,-s,-s], l: 'D' },
            { p: [-s,s,s], l: 'A₁' }, { p: [s,s,s], l: 'B₁' }, { p: [s,s,-s], l: 'C₁' }, { p: [-s,s,-s], l: 'D₁' },
          ];
          break;
        }
        case 'cuboid': {
          geom = new THREE.BoxGeometry(2.0, 1.2, 1.4);
          const a=1.0, b=0.6, c=0.7;
          verts = [
            {p:[-a,-b,c],l:'A'},{p:[a,-b,c],l:'B'},{p:[a,-b,-c],l:'C'},{p:[-a,-b,-c],l:'D'},
            {p:[-a,b,c],l:'A₁'},{p:[a,b,c],l:'B₁'},{p:[a,b,-c],l:'C₁'},{p:[-a,b,-c],l:'D₁'},
          ]; break;
        }
        case 'sphere': {
          geom = new THREE.SphereGeometry(1.0, 48, 32);
          verts = [{p:[0,0,0],l:'O'},{p:[0,1,0],l:'N'},{p:[0,-1,0],l:'S'}];
          break;
        }
        case 'cylinder': {
          geom = new THREE.CylinderGeometry(0.85, 0.85, 1.8, 64, 1);
          verts = [{p:[0,-0.9,0],l:'O'},{p:[0,0.9,0],l:'O₁'}]; break;
        }
        case 'cone': {
          geom = new THREE.ConeGeometry(0.95, 1.8, 64);
          verts = [{p:[0,0.9,0],l:'S'},{p:[0,-0.9,0],l:'O'}]; break;
        }
        case 'tetrahedron': {
          const r=1.1, a=Math.sqrt(8/9)*r, b=Math.sqrt(2/9)*r, c=Math.sqrt(2/3)*r;
          const A=[0,r,0], B=[a,-b,0], C=[-a/2,-b,c], D=[-a/2,-b,-c];
          geom = this._geomFromFaces([[A,C,B],[A,D,C],[A,B,D],[B,C,D]]);
          verts=[{p:A,l:'A'},{p:B,l:'B'},{p:C,l:'C'},{p:D,l:'D'}]; break;
        }
        case 'pyramid3': {
          const R=0.95, H=1.4, base=[];
          for(let i=0;i<3;i++){const a=(i/3)*Math.PI*2+Math.PI/2; base.push([Math.cos(a)*R,-H/2,Math.sin(a)*R]);}
          const apex=[0,H/2,0];
          geom = this._geomFromFaces([[base[0],base[2],base[1]],[apex,base[0],base[1]],[apex,base[1],base[2]],[apex,base[2],base[0]]]);
          verts=[{p:apex,l:'S'},{p:base[0],l:'A'},{p:base[1],l:'B'},{p:base[2],l:'C'}]; break;
        }
        case 'pyramid4': {
          const a=1.0, H=1.5;
          const base=[[-a/2,-H/2,a/2],[a/2,-H/2,a/2],[a/2,-H/2,-a/2],[-a/2,-H/2,-a/2]];
          const apex=[0,H/2,0];
          geom = this._geomFromFaces([
            [base[0],base[2],base[1]],[base[0],base[3],base[2]],
            [apex,base[0],base[1]],[apex,base[1],base[2]],[apex,base[2],base[3]],[apex,base[3],base[0]],
          ]);
          verts=[{p:apex,l:'S'},{p:base[0],l:'A'},{p:base[1],l:'B'},{p:base[2],l:'C'},{p:base[3],l:'D'}]; break;
        }
        case 'prism3': {
          const R=0.9, H=1.6, top=[], bot=[];
          for(let i=0;i<3;i++){const a=(i/3)*Math.PI*2+Math.PI/2; top.push([Math.cos(a)*R,H/2,Math.sin(a)*R]); bot.push([Math.cos(a)*R,-H/2,Math.sin(a)*R]);}
          const faces=[[bot[0],bot[2],bot[1]],[top[0],top[1],top[2]]];
          for(let i=0;i<3;i++){const j=(i+1)%3; faces.push([bot[i],bot[j],top[j]]); faces.push([bot[i],top[j],top[i]]);}
          geom = this._geomFromFaces(faces);
          verts=[{p:bot[0],l:'A'},{p:bot[1],l:'B'},{p:bot[2],l:'C'},{p:top[0],l:'A₁'},{p:top[1],l:'B₁'},{p:top[2],l:'C₁'}]; break;
        }
        case 'prism6': {
          const R=0.95, H=1.4, top=[], bot=[];
          for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2; top.push([Math.cos(a)*R,H/2,Math.sin(a)*R]); bot.push([Math.cos(a)*R,-H/2,Math.sin(a)*R]);}
          const faces=[];
          for(let i=1;i<5;i++) faces.push([bot[0],bot[i+1],bot[i]]);
          for(let i=1;i<5;i++) faces.push([top[0],top[i],top[i+1]]);
          for(let i=0;i<6;i++){const j=(i+1)%6; faces.push([bot[i],bot[j],top[j]]); faces.push([bot[i],top[j],top[i]]);}
          geom = this._geomFromFaces(faces);
          const lab=['A','B','C','D','E','F']; verts=[];
          for(let i=0;i<6;i++) verts.push({p:bot[i],l:lab[i]});
          for(let i=0;i<6;i++) verts.push({p:top[i],l:lab[i]+'₁'});
          break;
        }
      }
      geom.computeVertexNormals();

      this.mesh = new THREE.Mesh(geom, face);
      this.mesh.castShadow = true; this.mesh.receiveShadow = true;
      this.root.add(this.mesh);

      const eGeom = new THREE.EdgesGeometry(geom, 1);
      this.edges = new THREE.LineSegments(eGeom, edge);
      this.edges.renderOrder = 2;
      this.root.add(this.edges);

      const hiddenMat = new THREE.LineDashedMaterial({
        color: 0x2b2118, dashSize: 0.07, gapSize: 0.05,
        transparent: true, opacity: 0.55,
        depthTest: true, depthFunc: THREE.GreaterDepth,
      });
      this.hiddenEdges = new THREE.LineSegments(eGeom.clone(), hiddenMat);
      this.hiddenEdges.computeLineDistances();
      this.hiddenEdges.renderOrder = 1;
      this.root.add(this.hiddenEdges);

      this.vertexMeshes = new THREE.Group();
      verts.forEach((v) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), new THREE.MeshBasicMaterial({ color: 0x2b2118 }));
        m.position.set(v.p[0], v.p[1], v.p[2]);
        this.vertexMeshes.add(m);
      });
      this.vertexMeshes.visible = false;
      this.root.add(this.vertexMeshes);
      this.vertexData = verts;

      this._buildLabels();
      this._buildCutPlane();
      this._buildNet();
    }

    _geomFromFaces(triFaces) {
      const positions = [];
      triFaces.forEach((f) => positions.push(...f[0], ...f[1], ...f[2]));
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.computeVertexNormals();
      return mergeVerts(g, 1e-4);
    }

    _buildLabels() {
      this.labelLayer = document.createElement('div');
      Object.assign(this.labelLayer.style, {
        position:'absolute', inset:'0', pointerEvents:'none',
        fontFamily:'Inter, system-ui, sans-serif', fontSize:'13px', fontWeight:'600',
      });
      this.container.appendChild(this.labelLayer);
      this.labelEls = this.vertexData.map((v) => {
        const el = document.createElement('div');
        el.textContent = v.l;
        Object.assign(el.style, {
          position:'absolute', transform:'translate(-50%, -120%)',
          color:'#1a1410', background:'rgba(255,253,248,0.9)',
          padding:'1px 5px', borderRadius:'3px',
          border:'1px solid rgba(43,33,24,0.18)', whiteSpace:'nowrap',
          opacity:'0', transition:'opacity 0.18s',
        });
        this.labelLayer.appendChild(el);
        return el;
      });
    }

    _buildCutPlane() {
      const planeGeom = new THREE.PlaneGeometry(3, 3);
      this.cutPlane = new THREE.Mesh(planeGeom, new THREE.MeshBasicMaterial({
        color: 0xff7849, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false,
      }));
      this.cutPlane.rotation.x = -Math.PI / 2;
      this.cutPlane.visible = false;
      this.root.add(this.cutPlane);
      this.cutOutline = new THREE.LineSegments(new THREE.EdgesGeometry(planeGeom), new THREE.LineBasicMaterial({ color: 0xff5a2e, transparent:true, opacity:0.5 }));
      this.cutOutline.rotation.x = -Math.PI / 2;
      this.cutOutline.visible = false;
      this.root.add(this.cutOutline);

      // Intersection contour — built each time cutHeight changes
      this.cutContour = new THREE.LineSegments(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: 0xff3a14, linewidth: 4, depthTest: false, transparent: true })
      );
      this.cutContour.renderOrder = 10;
      this.cutContour.visible = false;
      this.root.add(this.cutContour);
      this._lastCutY = NaN;
    }

    _rectShape(hx, hy) { const s = new THREE.Shape(); s.moveTo(-hx,-hy); s.lineTo(hx,-hy); s.lineTo(hx,hy); s.lineTo(-hx,hy); s.closePath(); return s; }
    _equilTri(R, rotate=0) { const s = new THREE.Shape(); const pts=[]; for(let i=0;i<3;i++){const a=i*(2*Math.PI/3)+Math.PI/2+rotate; pts.push([Math.cos(a)*R,Math.sin(a)*R]);} s.moveTo(pts[0][0],pts[0][1]); s.lineTo(pts[1][0],pts[1][1]); s.lineTo(pts[2][0],pts[2][1]); s.closePath(); return s; }
    _isoFlap(base, slant, rotate=0) { const s = new THREE.Shape(); const cos=Math.cos(rotate), sin=Math.sin(rotate); const pts=[[-base/2,-slant/2],[base/2,-slant/2],[0,slant/2]].map(([x,y])=>[x*cos-y*sin,x*sin+y*cos]); s.moveTo(pts[0][0],pts[0][1]); s.lineTo(pts[1][0],pts[1][1]); s.lineTo(pts[2][0],pts[2][1]); s.closePath(); return s; }
    _hexShape(R) { const s = new THREE.Shape(); for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2; const x=Math.cos(a)*R, y=Math.sin(a)*R; if(i===0) s.moveTo(x,y); else s.lineTo(x,y);} s.closePath(); return s; }
    _circleShape(R) { const s = new THREE.Shape(); s.absarc(0,0,R,0,Math.PI*2,false); return s; }
    _sectorShape(R, ang, start=0) { const s = new THREE.Shape(); s.moveTo(0,0); s.absarc(0,0,R,start,start+ang,false); s.lineTo(0,0); return s; }
    _luneShape(R, halfAng) {
      const s = new THREE.Shape(); const seg=16; const pts=[];
      for(let i=0;i<=seg;i++){const t=i/seg; const y=(t-0.5)*2*R; const w=Math.cos((y/R)*Math.PI/2)*R*Math.sin(halfAng); pts.push([w,y]);}
      for(let i=seg;i>=0;i--){const t=i/seg; const y=(t-0.5)*2*R; const w=-Math.cos((y/R)*Math.PI/2)*R*Math.sin(halfAng); pts.push([w,y]);}
      s.moveTo(pts[0][0],pts[0][1]); pts.forEach(p=>s.lineTo(p[0],p[1])); return s;
    }

    _buildNet() {
      this.netGroup.clear();
      const mat = new THREE.MeshStandardMaterial({ color: 0xe9b88a, roughness: 0.6, metalness: 0.04, side: THREE.DoubleSide, transparent: true, opacity: 1 });
      const lineMat = new THREE.LineBasicMaterial({ color: 0x2b2118 });
      const Y = -0.02;
      const addShape = (shape, x, z) => {
        const g = new THREE.ShapeGeometry(shape);
        const mesh = new THREE.Mesh(g, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(x, Y, z);
        this.netGroup.add(mesh);
        const ls = new THREE.LineSegments(new THREE.EdgesGeometry(g), lineMat);
        ls.rotation.x = -Math.PI / 2;
        ls.position.set(x, Y + 0.001, z);
        this.netGroup.add(ls);
      };

      switch (this.type) {
        case 'cube': {
          const a=0.8; const sq=this._rectShape(a,a);
          [[-1.5,0],[-0.5,0],[0.5,0],[1.5,0],[-0.5,-1],[-0.5,1]].forEach(([gx,gz])=>addShape(sq, gx*2*a, gz*2*a));
          break;
        }
        case 'cuboid': {
          const ax=0.85, ay=0.5, az=0.6;
          const front=this._rectShape(ax,ay), top=this._rectShape(ax,az), side=this._rectShape(az,ay);
          addShape(front,0,0); addShape(top,0,ay+az); addShape(top,0,-(ay+az));
          addShape(side,ax+az,0); addShape(side,-(ax+az),0); addShape(front,2*(ax+az),0); break;
        }
        case 'tetrahedron':
        case 'pyramid3': {
          const R=0.55, apothem=R/2;
          addShape(this._equilTri(R,0),0,0);
          for(let i=0;i<3;i++){const midAng=i*(2*Math.PI/3)-Math.PI/2; const cx=Math.cos(midAng)*apothem*3; const cz=Math.sin(midAng)*apothem*3; addShape(this._equilTri(R, midAng+Math.PI/2+Math.PI), cx, cz);}
          break;
        }
        case 'pyramid4': {
          const a=0.75, slant=1.05;
          addShape(this._rectShape(a,a),0,0);
          addShape(this._isoFlap(2*a, slant, -Math.PI/2), a+slant/2, 0);
          addShape(this._isoFlap(2*a, slant, Math.PI/2), -(a+slant/2), 0);
          addShape(this._isoFlap(2*a, slant, 0), 0, a+slant/2);
          addShape(this._isoFlap(2*a, slant, Math.PI), 0, -(a+slant/2));
          break;
        }
        case 'prism3': {
          const R=0.5, side=R*Math.sqrt(3), H=1.0;
          const rect=this._rectShape(side/2,H/2);
          for(let i=0;i<3;i++) addShape(rect,(i-1)*side,0);
          addShape(this._equilTri(R,0),0,H/2+R); addShape(this._equilTri(R,Math.PI),0,-(H/2+R)); break;
        }
        case 'prism6': {
          const R=0.4, sideLen=R, H=0.85;
          const rect=this._rectShape(sideLen/2,H/2);
          for(let i=0;i<6;i++) addShape(rect,(i-2.5)*sideLen,0);
          addShape(this._hexShape(R),0,H/2+R); addShape(this._hexShape(R),0,-(H/2+R)); break;
        }
        case 'cylinder': {
          const R=0.5, H=1.0, w=R*Math.PI*0.65;
          addShape(this._rectShape(w,H/2),0,0);
          addShape(this._circleShape(R),-(w+R+0.05),0); addShape(this._circleShape(R),w+R+0.05,0); break;
        }
        case 'cone': {
          const R=0.45, L=1.1, arcAng=2*Math.PI*R/L;
          addShape(this._sectorShape(L, arcAng, -arcAng/2), 0, 0.3);
          addShape(this._circleShape(R), 0, -(R+0.5)); break;
        }
        case 'sphere': {
          const R=0.35;
          for(let i=0;i<8;i++) addShape(this._luneShape(R, Math.PI/8), (i-3.5)*R*0.65, 0);
          break;
        }
      }
      const bb = new THREE.Box3();
      this.netGroup.updateMatrixWorld(true);
      this.netGroup.children.forEach((c) => { if (c.geometry) bb.expandByObject(c); });
      this.netBBox = bb;
      this.netGroup.scale.setScalar(0.0001);
    }

    _initInteraction() {
      const dom = this.renderer.domElement;
      let dragging=false, lx=0, ly=0;
      dom.addEventListener('pointerdown', (e) => { dragging=true; lx=e.clientX; ly=e.clientY; dom.style.cursor='grabbing'; this.state.autoRotate=false; dom.setPointerCapture(e.pointerId); });
      dom.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        this.root.rotation.y += (e.clientX-lx)*0.01;
        this.root.rotation.x = Math.max(-1.2, Math.min(1.2, this.root.rotation.x + (e.clientY-ly)*0.01));
        lx=e.clientX; ly=e.clientY;
      });
      const up=(e)=>{ dragging=false; dom.style.cursor='grab'; try{dom.releasePointerCapture(e.pointerId);}catch(_){} };
      dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
      this._ro = new ResizeObserver(() => this._resize());
      this._ro.observe(this.container);
      requestAnimationFrame(() => this._resize());
      requestAnimationFrame(() => requestAnimationFrame(() => this._resize()));
    }

    _resize() {
      const w=this.container.clientWidth, h=this.container.clientHeight;
      if (!w||!h) return;
      this.renderer.setSize(w,h);
      this.camera.aspect=w/h; this.camera.updateProjectionMatrix();
    }

    set(key, value) { this.state[key]=value; this._apply(); }

    _apply() {
      this.mesh.visible = this.state.showFaces;
      this.edges.visible = this.state.showEdges;
      this.vertexMeshes.visible = this.state.showVertices;
      this.labelEls.forEach((el) => el.style.opacity = this.state.showVertices ? '1' : '0');
      const cutActive = this.state.showCut;
      const effectiveTransparent = this.state.transparent || cutActive;
      const opacity = effectiveTransparent ? 0.32 : 1.0;
      this.mats.face.opacity = opacity;
      this.mats.face.depthWrite = !effectiveTransparent;
      this.hiddenEdges.visible = this.state.showEdges && this.state.showFaces && !effectiveTransparent;
      this.cutPlane.visible = this.state.showCut;
      this.cutOutline.visible = this.state.showCut;
      this.cutContour.visible = this.state.showCut;
      const y = -1.05 + 2.1 * this.state.cutHeight;
      this.cutPlane.position.y = y; this.cutOutline.position.y = y;
      if (this.state.showCut && y !== this._lastCutY) {
        this._rebuildCutContour(y);
        this._lastCutY = y;
      }
      // No more world-space clipping — body stays whole; we just highlight the contour
      this.mats.face.clippingPlanes = [];
    }

    _rebuildCutContour(y) {
      // Find intersection of mesh geometry with horizontal plane y=Y in LOCAL space
      const geom = this.mesh.geometry;
      const pos = geom.getAttribute('position');
      const idx = geom.getIndex();
      const segments = [];
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
      const triCount = idx ? idx.count / 3 : pos.count / 3;
      const lerpY = (p1, p2, Y) => {
        const t = (Y - p1.y) / (p2.y - p1.y);
        return new THREE.Vector3(
          p1.x + (p2.x - p1.x) * t,
          Y,
          p1.z + (p2.z - p1.z) * t
        );
      };
      for (let i = 0; i < triCount; i++) {
        const i0 = idx ? idx.getX(i*3) : i*3;
        const i1 = idx ? idx.getX(i*3+1) : i*3+1;
        const i2 = idx ? idx.getX(i*3+2) : i*3+2;
        a.fromBufferAttribute(pos, i0);
        b.fromBufferAttribute(pos, i1);
        c.fromBufferAttribute(pos, i2);
        const da = a.y - y, db = b.y - y, dc = c.y - y;
        const eps = 1e-6;
        const sa = da > eps ? 1 : (da < -eps ? -1 : 0);
        const sb = db > eps ? 1 : (db < -eps ? -1 : 0);
        const sc = dc > eps ? 1 : (dc < -eps ? -1 : 0);
        if (sa === sb && sb === sc) continue; // triangle entirely above/below
        // Collect intersection points on edges where signs differ
        const hits = [];
        const edge = (p1, p2, s1, s2) => {
          if (s1 === 0 && s2 === 0) return; // edge lies in plane — skip (shared with adjacent tri)
          if (s1 === 0) { hits.push(p1.clone()); return; }
          if (s2 === 0) return; // will be added via the other edge containing p2 with sign 0
          if (s1 !== s2) hits.push(lerpY(p1, p2, y));
        };
        edge(a, b, sa, sb);
        edge(b, c, sb, sc);
        edge(c, a, sc, sa);
        // Dedupe (vertex on plane shared by two edges)
        const unique = [];
        for (const h of hits) {
          if (!unique.some((u) => u.distanceToSquared(h) < 1e-10)) unique.push(h);
        }
        if (unique.length === 2) {
          segments.push(unique[0].x, unique[0].y, unique[0].z, unique[1].x, unique[1].y, unique[1].z);
        }
      }
      const newGeom = new THREE.BufferGeometry();
      newGeom.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
      this.cutContour.geometry.dispose();
      this.cutContour.geometry = newGeom;
    }

    _updateLabels() {
      if (!this.state.showVertices) return;
      const w=this.container.clientWidth, h=this.container.clientHeight;
      const v = new THREE.Vector3();
      this.vertexMeshes.children.forEach((m, i) => {
        m.getWorldPosition(v); v.project(this.camera);
        const el = this.labelEls[i];
        el.style.left = ((v.x*0.5+0.5)*w)+'px';
        el.style.top = ((-v.y*0.5+0.5)*h)+'px';
        el.style.opacity = (v.z<1) ? '1' : '0';
      });
    }

    _loop() {
      if (this._destroyed) return;
      requestAnimationFrame(() => this._loop());
      if (this.state.autoRotate) this.root.rotation.y += 0.0045;

      if (this.state.building < 1) {
        this.state.building = Math.min(1, this.state.building + 0.012);
        const s = 0.4 + 0.6 * (this.state.building<0.5 ? 2*this.state.building*this.state.building : 1-Math.pow(-2*this.state.building+2,2)/2);
        this.mesh.scale.setScalar(s); this.edges.scale.setScalar(s); this.hiddenEdges.scale.setScalar(s); this.vertexMeshes.scale.setScalar(s);
        this.mesh.material.opacity = (this.state.transparent?0.32:1.0)*this.state.building;
      } else {
        this.mesh.scale.setScalar(1); this.edges.scale.setScalar(1); this.hiddenEdges.scale.setScalar(1); this.vertexMeshes.scale.setScalar(1);
      }

      this.netT = this.netT==null ? 0 : this.netT;
      this.netT += ((this.state.showNet?1:0) - this.netT) * 0.12;
      const netVisible = this.netT > 0.02;
      this.netGroup.visible = netVisible;
      if (netVisible && this.netBBox && !this.netBBox.isEmpty()) {
        const sz = new THREE.Vector3(); this.netBBox.getSize(sz);
        const maxDim = Math.max(sz.x, sz.z) || 1;
        const fitScale = 3.4 / maxDim;
        const finalScale = fitScale * this.netT;
        this.netGroup.scale.setScalar(finalScale);
        const c = new THREE.Vector3(); this.netBBox.getCenter(c);
        this.netGroup.position.x = -c.x * finalScale;
        this.netGroup.position.z = -c.z * finalScale;
        this.netGroup.position.y = -1.0 + (1-this.netT)*0.3;
      }
      const solidAlpha = 1 - this.netT;
      this.mesh.visible = this.state.showFaces && solidAlpha > 0.02;
      this.edges.visible = this.state.showEdges && solidAlpha > 0.02;
      this.hiddenEdges.visible = this.state.showEdges && this.state.showFaces && !this.state.transparent && solidAlpha > 0.02;
      if (this.mesh.visible) this.mesh.material.opacity = (this.state.transparent?0.32:1.0)*solidAlpha*Math.min(1,this.state.building);

      this._updateLabels();
      this.renderer.render(this.scene, this.camera);
    }

    rebuild() { this.state.building = 0; }
    destroy() { this._destroyed=true; this._ro.disconnect(); this.renderer.dispose(); this.container.innerHTML=''; }
  }

  window.SolidCard = SolidCard;
  window.SOLID_LABELS = LABELS;
})();

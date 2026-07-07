/* ═══════════════════════════════════════════════════════════
   StereoMASH — UI-оболонка навколо window.NMT3D (двигун read-only)
   ТЗ: MASH_STEREOMASH_TZ.md. Оболонка НЕ містить 3D-математики.
   Host-API: window.__mashStereoOpts { state, onChange, storage, dialogs }
             window.MashStereoApp   { serialize, loadScene, destroy }
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const OPTS = window.__mashStereoOpts || {};
  const STORE_LOCAL = OPTS.storage !== 'none';
  const LS_KEY = 'mash:stereo:scene';

  // i18n: TS('key', 'укр fallback') — словник mash.stereo.*
  const TS = (k, fb) => {
    if (!window.MashI18n || !MashI18n.ready) return fb;
    const v = MashI18n.t('mash.stereo.' + k);
    return v === 'mash.stereo.' + k ? (fb !== undefined ? fb : k) : v;
  };

  const root    = document.getElementById('stereo-root');
  const stage   = document.getElementById('st-stage');
  const gallery = document.getElementById('st-gallery');
  const panel   = document.getElementById('st-panel');
  const figname = document.getElementById('st-figname');
  const toast   = document.getElementById('st-toast');

  let ws = null;          // активний Nmt3dWorkspace
  let currentKey = null;
  let _saveT = null;
  let renderer = null;    // stereo-renderer (seam)
  let rCanvas = null;
  let visualStyle = 'rich';    // 'rich' | 'exam'
  let material = { hue: 258, sat: 44, alpha: 0.85 };   // колір + насиченість граней
  try {
    const s = STORE_LOCAL && localStorage.getItem('mash:stereo:style');
    if (s === 'exam') visualStyle = 'exam';
    const m = STORE_LOCAL && JSON.parse(localStorage.getItem('mash:stereo:material'));
    if (m && isFinite(m.hue)) material = m;
  } catch (_) {}

  function materialTheme() {
    return {
      faceHue: material.hue, faceSat: material.sat,
      faceAlphaFront: material.alpha,
      faceAlphaBack: Math.round(material.alpha * 0.35 * 100) / 100,
    };
  }

  // ТЗ v3 §A1: режим видимості тіла
  let visMode = 'solid';       // solid | translucent | wire | wireface
  let uiState = { highlightFaceId: null };
  let lastFrame = null;
  let syncVisUI = null;

  function refresh() { if (ws) { try { ws.setParams({ ...ws.params }); } catch (_) {} } }

  function appliedTheme() {
    const mt = materialTheme();
    if (visMode === 'translucent') return { ...mt, faceAlphaFront: 0.38, faceAlphaBack: 0.14 };
    if (visMode === 'wire' || visMode === 'wireface') return { ...mt, faceAlphaFront: 0, faceAlphaBack: 0 };
    return mt;
  }

  function setVisMode(m) {
    visMode = m;
    if (m !== 'wireface') uiState.highlightFaceId = null;
    if (renderer && visualStyle === 'rich') renderer.setTheme(appliedTheme());
    if (syncVisUI) syncVisUI();
    refresh();
    scheduleSave();
  }

  function applyMaterial() {
    if (renderer && visualStyle === 'rich') renderer.setTheme(appliedTheme());
    if (STORE_LOCAL) { try { localStorage.setItem('mash:stereo:material', JSON.stringify(material)); } catch (_) {} }
    if (ws) { try { ws.setParams({ ...ws.params }); } catch (_) {} } // тригер перемальовки
  }

  function attachRenderer() {
    // seam (ТЗ v2): canvas ПІД SVG-шаром двигуна; двигун шле frame у sink.
    // Детекція: frameSink — просте присвоєння (не преддеклароване в ws),
    // тому присвоюємо завжди й вмикаємо frameOnly лише коли перший frame реально прийшов.
    if (!window.StereoRenderer || !ws) return;
    rCanvas = document.createElement('canvas');
    rCanvas.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;';
    stage.insertBefore(rCanvas, stage.firstChild);
    renderer = StereoRenderer.createStereoRenderer(rCanvas, { theme: visualStyle });
    if (visualStyle === 'rich') renderer.setTheme(appliedTheme());
    let gotFrame = false;
    ws.frameSink = (frame) => {
      if (!renderer) return;
      if (!frame || !frame.view || !frame.view.w || !frame.view.h) return; // 0×0 до layout — ігноруємо
      if (!gotFrame) { gotFrame = true; ws.frameOnly = true; } // seam живий — SVG лишає тільки хендли
      lastFrame = frame;
      try { renderer.draw(frame, uiState); } catch (e) { console.warn('stereo-renderer:', e); }
    };
    ws.frameOnly = true;
    // тригер першого фрейму
    try { ws.setParams({ ...ws.params }); } catch (_) {}
    // якщо двигун без seam — фрейми не прийдуть: прибираємо canvas, повертаємо legacy-SVG
    setTimeout(() => {
      if (gotFrame || !renderer) return;
      try { ws.frameOnly = false; delete ws.frameSink; } catch (_) {}
      try { renderer.destroy(); } catch (_) {}
      renderer = null;
      if (rCanvas && rCanvas.parentElement) rCanvas.parentElement.removeChild(rCanvas);
      rCanvas = null;
    }, 400);
  }

  function setVisualStyle(style) {
    visualStyle = style;
    if (renderer) {
      renderer.setTheme(style);
      if (style === 'rich') renderer.setTheme(appliedTheme());
    }
    if (STORE_LOCAL) { try { localStorage.setItem('mash:stereo:style', style); } catch (_) {} }
    if (ws) { try { ws.setParams({ ...ws.params }); } catch (_) {} } // тригер перемальовки
  }

  // ── Групи галереї (ключі звірені з NMT3D.TEMPLATES у рантаймі) ──
  const GROUPS = [
    { id: 'poly',  keys: ['cube', 'cuboid', 'prism4', 'prism6', 'ngonPrism', 'obliquePrism4',
                          'pyramid4', 'pyramid3', 'pyramid6', 'ngonPyramid', 'tetrahedron',
                          'trapPyramid', 'frustumPyramid4'] },
    { id: 'round', keys: ['cylinder', 'cone', 'sphere', 'frustumCone'] },
    { id: 'sect',  keys: ['cubeSection3', 'pyramid4Section3', 'prism4Section3'] },
    { id: 'combo', keys: ['cubeInscribedSphere', 'cubeCircumSphere', 'cylinderInscribedSphere',
                          'sphereInscribedCone', 'coneInscribedCylinder'] },
  ];

  // §A4: фігура + дія → комбінований шаблон (кнопка лише де шаблон існує)
  const COMBO = {
    cube: [['inscribeSphere', 'cubeInscribedSphere'], ['circumSphere', 'cubeCircumSphere']],
    cylinder: [['inscribeSphere', 'cylinderInscribedSphere']],
    cone: [['inscribeCylinder', 'coneInscribedCylinder']],
    sphere: [['inscribeCone', 'sphereInscribedCone']],
  };
  const COMBO_LBL = { inscribeSphere: '○ Вписати кулю', circumSphere: '● Описати кулю', inscribeCylinder: '▭ Вписати циліндр', inscribeCone: '△ Вписати конус' };

  // §A6: бібліотека навчальних сцен (з ІСНУЮЧИХ шаблонів+aux)
  const BUILTIN_SCENES = [
    { id: 'cubeSect',      key: 'cube',                name: 'Куб з перерізом AB₁C₁D',        opts: { diagSect: true } },
    { id: 'pyrHeight',     key: 'pyramid4',            name: 'Піраміда: висота й апофема',      opts: { height: true, apothem: true } },
    { id: 'pyrAxSect',     key: 'pyramid4',            name: 'Піраміда: осьовий переріз',       opts: { axSect: true, diags: true } },
    { id: 'coneAx',        key: 'cone',                name: 'Конус: осьовий переріз і твірна',  opts: { axSect: true, slant: true } },
    { id: 'cylAx',         key: 'cylinder',            name: 'Циліндр: осьовий переріз',       opts: { axSect: true, height: true } },
    { id: 'sphInCube',     key: 'cubeInscribedSphere', name: 'Куля, вписана в куб',            opts: { tangents: true, radius: true } },
    { id: 'tetMedian',     key: 'tetrahedron',         name: 'Тетраедр з медіаною',           opts: { median: true, axSect: true } },
    { id: 'prism6Diag',    key: 'prism6',              name: 'Призма: діагональний переріз',  opts: { diagSect: true, bigDiag: true } },
    { id: 'frustApothem',  key: 'frustumPyramid4',     name: 'Зрізана піраміда: апофема',      opts: { apothem: true, axSect: true } },
    { id: 'cubeSect3',     key: 'cubeSection3',        name: 'Переріз куба через 3 точки',      opts: { fill: true, verticesLabel: true } },
    { id: 'coneInSphere',  key: 'sphereInscribedCone', name: 'Конус, вписаний у кулю',         opts: { sphereCenter: true, coneHeight: true } },
    { id: 'pyrSect3',      key: 'pyramid4Section3',    name: 'Переріз піраміди через 3 точки',  opts: { fill: true, verticesLabel: true } },
    { id: 'prismSect3',    key: 'prism4Section3',      name: 'Переріз призми через 3 точки',    opts: { fill: true, verticesLabel: true } },
  ];

  let galleryTab = 'figs';   // 'figs' | 'scenes' (§A6)
  let scenePresets = [];     // §A7: use-стани сцени

  function loadUserScenes() {
    if (!STORE_LOCAL) return [];
    try { return JSON.parse(localStorage.getItem('mash:stereo:scenes')) || []; } catch (_) { return []; }
  }
  function saveUserScenes(list) {
    if (STORE_LOCAL) { try { localStorage.setItem('mash:stereo:scenes', JSON.stringify(list)); } catch (_) {} }
  }

  function sceneCard(name, key, onClick, onDel, sceneOpts) {
    const card = document.createElement('button');
    card.className = 'st-card'; card.type = 'button';
    card.style.position = 'relative';
    card.style.borderStyle = 'dashed';
    const gthumb = (window.StereoThumbs && window.StereoThumbs[key]) ? window.StereoThumbs[key].render() : FALLBACK_THUMB;
    card.innerHTML = '<div class="thumb">' + gthumb + '</div><div class="cap">' + name + '</div>';
    // чіп: що саме ввімкнено в цій сцені (відрізняє від голої фігури)
    if (sceneOpts) {
      const tpl = NMT3D.TEMPLATES[key];
      const onKeys = Object.keys(sceneOpts).filter(k => sceneOpts[k]);
      if (onKeys.length && tpl) {
        const first = (tpl.aux || []).find(a => a.key === onKeys[0]);
        const chip = document.createElement('span');
        chip.textContent = (first ? TS('aux.' + key + '.' + first.key, first.label) : '') + (onKeys.length > 1 ? ' +' + (onKeys.length - 1) : '');
        chip.style.cssText = 'position:absolute;top:3px;left:4px;max-width:calc(100% - 22px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px;line-height:1;padding:2px 5px;border-radius:6px;background:var(--st-accent);color:#fff;pointer-events:none;';
        card.appendChild(chip);
      }
    }
    card.addEventListener('click', onClick);
    if (onDel) {
      const x = document.createElement('span');
      x.textContent = '✕';
      x.title = TS('scenes.delete', 'Видалити');
      x.style.cssText = 'position:absolute;top:3px;right:5px;font-size:10px;color:#b0a8c4;cursor:pointer;';
      x.addEventListener('click', (e) => { e.stopPropagation(); onDel(); });
      card.appendChild(x);
    }
    return card;
  }

  function buildScenesTab() {
    const title1 = document.createElement('div');
    title1.className = 'st-group-title';
    title1.textContent = TS('scenes.builtin', 'Навчальні сцени');
    gallery.appendChild(title1);
    const grid1 = document.createElement('div'); grid1.className = 'st-cards';
    for (const s of BUILTIN_SCENES) {
      if (!NMT3D.TEMPLATES[s.key]) continue;
      grid1.appendChild(sceneCard(TS('scenes.items.' + s.id, s.name), s.key, () => {
        loadScene({ templateKey: s.key, opts: s.opts, visMode: 'translucent', style: 'rich' });
      }, null, s.opts));
    }
    gallery.appendChild(grid1);

    const userScenes = loadUserScenes();
    const title2 = document.createElement('div');
    title2.className = 'st-group-title';
    title2.textContent = TS('scenes.my', 'Мої сцени');
    gallery.appendChild(title2);
    if (userScenes.length) {
      const grid2 = document.createElement('div'); grid2.className = 'st-cards';
      userScenes.forEach((us, i) => {
        grid2.appendChild(sceneCard(us.name, us.scene && us.scene.templateKey, () => loadScene(us.scene), () => {
          userScenes.splice(i, 1);
          saveUserScenes(userScenes);
          buildGallery();
        }, us.scene && us.scene.opts));
      });
      gallery.appendChild(grid2);
    }
    const saveBtn = mkBtn(TS('scenes.save', '+ Зберегти мою сцену'), () => {
      const name = window.prompt(TS('scenes.namePrompt', 'Назва сцени:'), ws ? TS('gallery.' + currentKey, ws.template.name) : '');
      if (!name) return;
      const list = loadUserScenes();
      list.push({ name, scene: serialize() });
      saveUserScenes(list);
      buildGallery();
    });
    saveBtn.style.cssText += 'width:100%;justify-content:center;margin-top:8px;';
    gallery.appendChild(saveBtn);
  }

  function buildGallery() {
    const known = new Set(Object.keys(NMT3D.TEMPLATES)); // двигун — джерело правди
    gallery.innerHTML = '';
    // таби Фігури | Сцени (§A6)
    const tabs = document.createElement('div');
    tabs.className = 'st-seg';
    tabs.style.marginBottom = '8px';
    const bF = document.createElement('button'); bF.textContent = TS('tabs.figures', 'Фігури');
    const bS = document.createElement('button'); bS.textContent = TS('tabs.scenes', 'Сцени');
    bF.classList.toggle('active', galleryTab === 'figs');
    bS.classList.toggle('active', galleryTab === 'scenes');
    bF.addEventListener('click', () => { galleryTab = 'figs'; buildGallery(); });
    bS.addEventListener('click', () => { galleryTab = 'scenes'; buildGallery(); });
    tabs.appendChild(bF); tabs.appendChild(bS);
    gallery.appendChild(tabs);

    if (galleryTab === 'scenes') { buildScenesTab(); return; }
    buildGalleryFigs(known);
  }

  const FALLBACK_THUMB = '<svg viewBox="0 0 80 56" width="80" height="56"><g fill="none" stroke="#8a93a6" stroke-width="1.6"><path d="M22 20 L48 20 L58 13 L32 13 Z"></path><path d="M22 20 L22 43 L48 43 L48 20"></path><path d="M48 43 L58 36 L58 13"></path><path d="M22 43 L32 36 L32 13" stroke-dasharray="3 3" opacity=".55"></path><path d="M32 36 L58 36" stroke-dasharray="3 3" opacity=".55"></path></g></svg>';

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  // ── Галерея ──────────────────────────────────────────────
  function buildGalleryFigs(known) {
    for (const g of GROUPS) {
      const keys = g.keys.filter(k => known.has(k));
      if (!keys.length) continue;
      const title = document.createElement('div');
      title.className = 'st-group-title';
      title.textContent = TS('groups.' + g.id, { poly: 'Багатогранники', round: 'Тіла обертання', sect: 'Перерізи', combo: 'Комбіновані' }[g.id]);
      gallery.appendChild(title);
      const grid = document.createElement('div');
      grid.className = 'st-cards';
      for (const key of keys) {
        const t = NMT3D.TEMPLATES[key];
        const card = document.createElement('button');
        card.className = 'st-card';
        card.dataset.key = key;
        card.type = 'button';
        const thumb = document.createElement('div');
        thumb.className = 'thumb';
        try {
          const gt = window.StereoThumbs && window.StereoThumbs[key];
          const tt = window.NMT_TEMPLATES && window.NMT_TEMPLATES[key];
          thumb.innerHTML = gt ? gt.render() : (tt ? tt.render({}) : FALLBACK_THUMB);
        } catch (_) { thumb.innerHTML = FALLBACK_THUMB; }
        const cap = document.createElement('div');
        cap.className = 'cap';
        cap.textContent = TS('gallery.' + key, t.name);
        card.appendChild(thumb); card.appendChild(cap);
        card.addEventListener('click', () => mount(key));
        grid.appendChild(card);
      }
      gallery.appendChild(grid);
    }
    // фігури поза групами (нові в двигуні) — додаємо в кінець, щоб нічого не загубити
    const listed = new Set(GROUPS.flatMap(g => g.keys));
    const extra = [...known].filter(k => !listed.has(k));
    if (extra.length) {
      const grid = document.createElement('div');
      grid.className = 'st-cards';
      for (const key of extra) {
        const card = document.createElement('button');
        card.className = 'st-card'; card.dataset.key = key; card.type = 'button';
        const gthumb = (window.StereoThumbs && window.StereoThumbs[key]) ? window.StereoThumbs[key].render() : FALLBACK_THUMB;
        card.innerHTML = '<div class="thumb">' + gthumb + '</div><div class="cap">' + NMT3D.TEMPLATES[key].name + '</div>';
        card.addEventListener('click', () => mount(key));
        grid.appendChild(card);
      }
      gallery.appendChild(grid);
    }
  }

  function markActive() {
    gallery.querySelectorAll('.st-card').forEach(c => c.classList.toggle('active', c.dataset.key === currentKey));
  }

  // ── Права панель ─────────────────────────────────────────
  function buildPanel() {
    const t = ws.template;
    panel.innerHTML = '';

    // Параметри
    const secP = document.createElement('div');
    secP.innerHTML = '<div class="st-sec-title">' + TS('panel.params', 'Параметри') + '</div>';
    for (const [key, m] of Object.entries(t.params)) {
      const row = document.createElement('div');
      row.className = 'st-param';
      const lab = document.createElement('label'); lab.textContent = m.label;
      const inp = document.createElement('input');
      Object.assign(inp, { type: 'range', min: m.min, max: m.max, step: m.step != null ? m.step : 0.1 });
      inp.value = ws.params[key];
      inp.dataset.param = key;
      const val = document.createElement('span'); val.className = 'val';
      val.textContent = fmtVal(ws.params[key]);
      inp.addEventListener('input', () => {
        ws.setParam(key, +inp.value);
        val.textContent = fmtVal(ws.params[key]);
        updateAnalysis(ws.params);
        scheduleSave();
      });
      row.appendChild(lab); row.appendChild(inp); row.appendChild(val);
      secP.appendChild(row);
    }
    panel.appendChild(secP);

    // ПОБУДОВИ (ТЗ v3 §A3): aux як кнопки-дії + вписати/описати (§A4) + розгортка
    const secC = document.createElement('div');
    secC.innerHTML = '<div class="st-sec-title">' + TS('panel.constructions', 'Побудови') + '</div>';
    const cGrid = document.createElement('div'); cGrid.className = 'st-constr';
    for (const a of (t.aux || [])) {
      const b = document.createElement('button');
      b.className = 'st-btn'; b.type = 'button';
      b.textContent = TS('aux.' + currentKey + '.' + a.key, a.label);
      b.classList.toggle('st-on', !!ws.opts[a.key]);
      b.addEventListener('click', () => {
        const on = !ws.opts[a.key];
        ws.setOpt(a.key, on);
        b.classList.toggle('st-on', on);
        // §A1: напівпрозоре — дефолт при активних побудовах
        if (on && visMode === 'solid' && visualStyle === 'rich') setVisMode('translucent');
        scheduleSave();
      });
      cGrid.appendChild(b);
    }
    // Вибрати всі побудови / зняти всі
    if ((t.aux || []).length > 1) {
      const allOn = (t.aux || []).every(a => !!ws.opts[a.key]);
      const bAll = document.createElement('button');
      bAll.className = 'st-btn'; bAll.type = 'button';
      bAll.style.fontWeight = '600';
      bAll.textContent = allOn ? TS('panel.selectNone', '✕ Зняти все') : TS('panel.selectAll', '✓ Вибрати все');
      bAll.addEventListener('click', () => {
        const target = !allOn;
        for (const a of (t.aux || [])) ws.setOpt(a.key, target);
        if (target && visMode === 'solid' && visualStyle === 'rich') setVisMode('translucent');
        scheduleSave();
        buildPanel();
      });
      cGrid.appendChild(bAll);
    }
    for (const [comboKey, target] of (COMBO[currentKey] || [])) {
      if (!NMT3D.TEMPLATES[target]) continue;
      const b = document.createElement('button');
      b.className = 'st-btn'; b.type = 'button';
      b.style.borderStyle = 'dashed';
      b.textContent = TS('combo.' + comboKey, COMBO_LBL[comboKey] || comboKey);
      b.addEventListener('click', () => {
        const carry = {};
        const tp = NMT3D.TEMPLATES[target].params;
        for (const k of Object.keys(tp)) if (ws.params[k] !== undefined) carry[k] = ws.params[k];
        mount(target, { params: carry });
      });
      cGrid.appendChild(b);
    }
    if (t.buildUnfolded) {
      cGrid.appendChild(mkBtn(TS('panel.unfold', '⧉ Розгортка'), function () {
        ws.toggleUnfold();
        this.classList.toggle('st-on', ws.unfoldT < 0.5);
      }));
    }
    secC.appendChild(cGrid);
    // §A7: use-стани сцени (пресети opts+style — формат для дошки)
    const pRow = document.createElement('div');
    pRow.className = 'st-constr';
    pRow.style.marginTop = '7px';
    const pTitle = document.createElement('div');
    pTitle.className = 'st-sec-title';
    pTitle.style.margin = '8px 0 0';
    pTitle.textContent = TS('presets.title', 'Стани');
    scenePresets.forEach((p, i) => {
      const b = document.createElement('button');
      b.className = 'st-btn'; b.type = 'button';
      b.textContent = p.name;
      b.title = TS('presets.applyHint', 'Клік — застосувати · Alt+клік — видалити');
      b.addEventListener('click', (e) => {
        if (e.altKey) { scenePresets.splice(i, 1); scheduleSave(); buildPanel(); return; }
        for (const k of Object.keys(ws.opts)) ws.setOpt(k, !!(p.opts && p.opts[k]));
        if (p.style === 'rich' || p.style === 'exam') setVisualStyle(p.style);
        if (p.visMode) visMode = p.visMode;
        if (renderer && visualStyle === 'rich') renderer.setTheme(appliedTheme());
        refresh(); scheduleSave(); buildPanel();
      });
      pRow.appendChild(b);
    });
    const pAdd = document.createElement('button');
    pAdd.className = 'st-btn'; pAdd.type = 'button';
    pAdd.style.borderStyle = 'dashed';
    pAdd.textContent = TS('presets.save', '+ Зберегти стан');
    pAdd.addEventListener('click', () => {
      const name = window.prompt(TS('presets.namePrompt', 'Назва стану:'), '');
      if (!name) return;
      scenePresets.push({ name, opts: { ...ws.opts }, style: visualStyle, visMode: visMode });
      scheduleSave(); buildPanel();
    });
    pRow.appendChild(pAdd);
    secC.appendChild(pTitle);
    secC.appendChild(pRow);
    panel.appendChild(secC);

    // АНАЛІЗ (§A5): Дано + величини live + формули
    if (window.StereoAnalysis && (StereoAnalysis.has(currentKey) || ws.measures)) {
      const secAn = document.createElement('div');
      secAn.innerHTML = '<div class="st-sec-title">' + TS('panel.analysis', 'Аналіз') + '</div>';
      analysisBox = document.createElement('div');
      analysisBox.className = 'st-analysis';
      secAn.appendChild(analysisBox);
      panel.appendChild(secAn);
      updateAnalysis(ws.params);
    } else { analysisBox = null; }

    // Вигляд
    const secV = document.createElement('div');
    secV.innerHTML = '<div class="st-sec-title">' + TS('panel.views', 'Вигляд') + '</div>';
    const grid = document.createElement('div'); grid.className = 'st-viewgrid';
    for (const v of ['3d', 'iso', 'front', 'side', 'top', 'bottom']) {
      const b = document.createElement('button');
      b.className = 'st-btn'; b.type = 'button';
      b.textContent = TS('views.' + (v === '3d' ? 'v3d' : v),
        { '3d': '3D', iso: 'Ізо', front: 'Спереду', side: 'Збоку', top: 'Згори', bottom: 'Знизу' }[v]);
      b.addEventListener('click', () => ws.setView(v));
      grid.appendChild(b);
    }
    secV.appendChild(grid);
    const rowV = document.createElement('div'); rowV.className = 'st-row';
    const bReset = mkBtn(TS('panel.reset', '⟳ Скинути'), () => ws.resetView());
    const bOrbit = mkBtn(TS('panel.autoOrbit', '▶ Оберт'), function () {
      ws.setAutoOrbit(!ws.autoOrbit);
      this.classList.toggle('st-on', ws.autoOrbit);
    });
    rowV.appendChild(bReset); rowV.appendChild(bOrbit);
    secV.appendChild(rowV);
    if (t.buildUnfolded) {
      // розгортка перенесена в Побудови (§A3)
    }
    panel.appendChild(secV);

    // Стиль візуалізації (seam-рендерер): rich / exam
    if (renderer) {
      const secS = document.createElement('div');
      secS.innerHTML = '<div class="st-sec-title">' + TS('panel.style', 'Стиль') + '</div>';
      const segS = document.createElement('div'); segS.className = 'st-seg';
      const bRich = document.createElement('button'); bRich.textContent = TS('style.rich', 'Об’ємний');
      const bExam = document.createElement('button'); bExam.textContent = TS('style.exam', 'Як у зошиті');
      const syncS = () => {
        bRich.classList.toggle('active', visualStyle === 'rich');
        bExam.classList.toggle('active', visualStyle === 'exam');
      };
      bRich.addEventListener('click', () => { setVisualStyle('rich'); syncS(); });
      bExam.addEventListener('click', () => { setVisualStyle('exam'); syncS(); });
      syncS();
      segS.appendChild(bRich); segS.appendChild(bExam);
      secS.appendChild(segS);

      // §A1: режим видимості тіла (4 кнопки + вибір грані)
      const visRow = document.createElement('div');
      visRow.className = 'st-constr';
      visRow.style.marginTop = '7px';
      const VISM = [
        ['solid', TS('vis.solid', 'Суцільне')],
        ['translucent', TS('vis.translucent', 'Напівпрозоре')],
        ['wire', TS('vis.wire', 'Каркас')],
        ['wireface', TS('vis.wireface', 'Каркас + грань')],
      ];
      const visBtns = new Map();
      for (const [vm, lbl] of VISM) {
        const b = document.createElement('button');
        b.className = 'st-btn'; b.type = 'button';
        b.textContent = lbl;
        b.addEventListener('click', () => setVisMode(vm));
        visBtns.set(vm, b);
        visRow.appendChild(b);
      }
      const faceSel = document.createElement('select');
      faceSel.className = 'st-btn';
      faceSel.style.display = 'none';
      faceSel.addEventListener('change', () => { uiState.highlightFaceId = faceSel.value || null; refresh(); });
      visRow.appendChild(faceSel);
      syncVisUI = () => {
        for (const [vm, b] of visBtns) b.classList.toggle('st-on', vm === visMode);
        const show = visMode === 'wireface';
        faceSel.style.display = show ? '' : 'none';
        if (show) {
          const faces = (lastFrame && lastFrame.faces) || [];
          faceSel.innerHTML = '<option value="">' + TS('panel.highlightFace', 'Грань…') + '</option>' +
            faces.map(f => `<option value="${f.id}"${f.id === uiState.highlightFaceId ? ' selected' : ''}>${f.id}</option>`).join('');
        }
      };
      syncVisUI();
      secS.appendChild(visRow);

      // Матеріал: колір граней + насиченість (діє в rich; згорнуто за замовч. — §A3)
      const matDet = document.createElement('details');
      const matSum = document.createElement('summary');
      matSum.className = 'st-sec-title';
      matSum.style.cssText = 'margin-top:10px;cursor:pointer;list-style-position:outside;';
      matSum.textContent = TS('panel.material', 'Матеріал');
      matDet.appendChild(matSum);
      secS.appendChild(matDet);
      const hueRow = document.createElement('div'); hueRow.className = 'st-swatches';
      const HUES = [
        { hue: 258, sat: 44 },  // фіолет (бренд)
        { hue: 215, sat: 55 },  // синій
        { hue: 150, sat: 42 },  // зелений
        { hue: 28,  sat: 62 },  // помаранчевий
        { hue: 340, sat: 45 },  // рожевий
      ];
      const syncHues = () => {
        const btns = hueRow.querySelectorAll('.st-swatch');
        let any = false;
        btns.forEach((b, i) => {
          const on = HUES[i] && HUES[i].hue === material.hue && HUES[i].sat === material.sat;
          b.classList.toggle('active', !!on);
          any = any || on;
        });
        custWrap.classList.toggle('active', !any);
        custWrap.style.borderColor = !any ? 'var(--st-fg)' : 'transparent';
      };
      for (const hd of HUES) {
        const b = document.createElement('button');
        b.className = 'st-swatch'; b.type = 'button';
        b.style.background = `hsl(${hd.hue},${hd.sat}%,62%)`;
        b.addEventListener('click', () => { material.hue = hd.hue; material.sat = hd.sat; applyMaterial(); syncHues(); });
        hueRow.appendChild(b);
      }
      // Свій колір — нативний color-picker у вигляді свотча
      const custWrap = document.createElement('label');
      custWrap.className = 'st-swatch';
      custWrap.title = TS('panel.customColor', 'Свій колір');
      custWrap.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;background:conic-gradient(red,yellow,lime,cyan,blue,magenta,red);overflow:hidden;cursor:pointer;';
      const custInp = document.createElement('input');
      custInp.type = 'color';
      custInp.value = hslToHex(material.hue, material.sat, 62);
      custInp.style.cssText = 'opacity:0;width:0;height:0;border:none;padding:0;';
      custInp.addEventListener('input', () => {
        const [h2, s2] = hexToHueSat(custInp.value);
        material.hue = h2; material.sat = s2;
        applyMaterial(); syncHues();
      });
      custWrap.appendChild(custInp);
      hueRow.appendChild(custWrap);
      syncHues();
      matDet.appendChild(hueRow);
      const satRow = document.createElement('div'); satRow.className = 'st-pen-width'; satRow.style.marginTop = '7px';
      const satLab = document.createElement('span'); satLab.textContent = TS('panel.saturation', 'Насиченість');
      const satInp = document.createElement('input');
      Object.assign(satInp, { type: 'range', min: 0.1, max: 1, step: 0.05, value: material.alpha });
      const satVal = document.createElement('span'); satVal.textContent = Math.round(material.alpha * 100) + '%';
      satInp.addEventListener('input', () => {
        material.alpha = +satInp.value;
        satVal.textContent = Math.round(material.alpha * 100) + '%';
        applyMaterial();
      });
      satRow.appendChild(satLab); satRow.appendChild(satInp); satRow.appendChild(satVal);
      matDet.appendChild(satRow);
      panel.appendChild(secS);
    }

    // Режим + перо
    const secM = document.createElement('div');
    secM.innerHTML = '<div class="st-sec-title">' + TS('panel.mode', 'Режим') + '</div>';
    const seg = document.createElement('div'); seg.className = 'st-seg';
    const bAdapt = document.createElement('button'); bAdapt.textContent = TS('panel.adapt', 'Форма');
    const bDraw  = document.createElement('button'); bDraw.textContent  = TS('panel.draw', 'Малювання');
    const penBox = document.createElement('div'); penBox.className = 'st-pen';
    const setMode = (m) => {
      ws.setMode(m);
      bAdapt.classList.toggle('active', m === 'adapt');
      bDraw.classList.toggle('active', m === 'draw');
      penBox.classList.toggle('visible', m === 'draw');
      scheduleSave();
    };
    bAdapt.addEventListener('click', () => setMode('adapt'));
    bDraw.addEventListener('click', () => setMode('draw'));
    seg.appendChild(bAdapt); seg.appendChild(bDraw);
    secM.appendChild(seg);

    // Перо
    const sw = document.createElement('div'); sw.className = 'st-swatches';
    for (const col of ['#ff924f', '#e2483d', '#2d70b3', '#1f8a5b', '#1d2430']) {
      const b = document.createElement('button');
      b.className = 'st-swatch'; b.type = 'button';
      b.style.background = col;
      if (col === ws.pen.color) b.classList.add('active');
      b.addEventListener('click', () => {
        ws.pen.color = col; ws.pen.tool = 'pen';
        sw.querySelectorAll('.st-swatch').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        er.classList.remove('st-on');
      });
      sw.appendChild(b);
    }
    const pw = document.createElement('div'); pw.className = 'st-pen-width';
    const pwLab = document.createElement('span'); pwLab.textContent = TS('panel.width', 'Товщина');
    const pwInp = document.createElement('input');
    Object.assign(pwInp, { type: 'range', min: 1, max: 10, step: 1, value: ws.pen.width });
    const pwVal = document.createElement('span'); pwVal.textContent = ws.pen.width;
    pwInp.addEventListener('input', () => { ws.pen.width = +pwInp.value; pwVal.textContent = pwInp.value; });
    pw.appendChild(pwLab); pw.appendChild(pwInp); pw.appendChild(pwVal);
    const rowPen = document.createElement('div'); rowPen.className = 'st-row';
    const er = mkBtn(TS('panel.eraser', 'Гумка'), function () {
      ws.pen.tool = ws.pen.tool === 'erase' ? 'pen' : 'erase';
      this.classList.toggle('st-on', ws.pen.tool === 'erase');
    });
    const clr = mkBtn(TS('panel.clear', 'Стерти все'), () => { ws.clearStrokes(); scheduleSave(); });
    rowPen.appendChild(er); rowPen.appendChild(clr);
    penBox.appendChild(sw); penBox.appendChild(pw); penBox.appendChild(rowPen);
    secM.appendChild(penBox);
    panel.appendChild(secM);

    setMode(ws.mode); // синхронізувати кнопки з поточним станом
  }

  function mkBtn(label, onClick) {
    const b = document.createElement('button');
    b.className = 'st-btn'; b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function fmtVal(v) { return (Math.round(v * 100) / 100).toString(); }

  // §A5: блок Аналіз — Дано + величини + формули (live)
  let analysisBox = null;
  let showFormulas = false;
  function updateAnalysis(params) {
    if (!analysisBox || !window.StereoAnalysis || !ws) return;
    const rows = StereoAnalysis.get(currentKey, params);
    analysisBox.innerHTML = '';
    const given = document.createElement('div');
    given.className = 'st-an-given';
    given.textContent = TS('analysis.given', 'Дано') + ': ' +
      Object.entries(ws.template.params).map(([k, m]) => m.label + ' = ' + fmtVal(params[k])).join(' · ');
    analysisBox.appendChild(given);
    for (const r of rows) {
      const parts = r.expr.split(' = ');
      const row = document.createElement('div');
      row.className = 'st-an-row';
      const label = document.createElement('span');
      label.textContent = TS('analysis.q.' + r.q, parts[0]);
      const val = document.createElement('b');
      val.textContent = parts[parts.length - 1];
      row.appendChild(label); row.appendChild(val);
      analysisBox.appendChild(row);
      if (showFormulas) {
        const f = document.createElement('div');
        f.className = 'st-an-formula';
        f.textContent = r.expr;
        analysisBox.appendChild(f);
      }
    }
    // двигун v4: площа перерізу для Section3-шаблонів (без символьної формули — довільний полігон)
    if (ws.measures && isFinite(ws.measures.sectionArea)) {
      const row = document.createElement('div');
      row.className = 'st-an-row';
      const label = document.createElement('span');
      label.textContent = TS('analysis.q.sectionArea', 'Площа перерізу');
      const val = document.createElement('b');
      const nv = ws.measures.sectionVertices;
      val.textContent = fmtVal(ws.measures.sectionArea) + (nv ? ' (' + nv + '-' + TS('analysis.gon', 'кутник') + ')' : '');
      row.appendChild(label); row.appendChild(val);
      analysisBox.appendChild(row);
    }
    const tog = document.createElement('button');
    tog.className = 'st-btn'; tog.type = 'button';
    tog.style.marginTop = '6px';
    tog.textContent = showFormulas
      ? TS('analysis.hideFormulas', 'Сховати формули')
      : TS('analysis.showFormulas', 'ƒ Показати формули');
    tog.addEventListener('click', () => { showFormulas = !showFormulas; updateAnalysis(ws.params); });
    analysisBox.appendChild(tog);
  }

  // hex ↔ hue/sat для свого кольору матеріалу
  function hexToHueSat(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255,
          g = parseInt(hex.slice(3, 5), 16) / 255,
          b = parseInt(hex.slice(5, 7), 16) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h = Math.round(h * 60); if (h < 0) h += 360;
    }
    const l = (mx + mn) / 2;
    const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    return [h, Math.round(Math.min(1, s) * 100)];
  }
  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const f = (n) => {
      const k = (n + h / 30) % 12;
      const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(c * 255).toString(16).padStart(2, '0');
    };
    return '#' + f(0) + f(8) + f(4);
  }

  function syncSliders(params) {
    panel.querySelectorAll('input[data-param]').forEach(inp => {
      const k = inp.dataset.param;
      if (params[k] !== undefined) {
        inp.value = params[k];
        const val = inp.parentElement.querySelector('.val');
        if (val) val.textContent = fmtVal(params[k]);
      }
    });
    updateAnalysis(params);
    scheduleSave();
  }

  // ── Монтування фігури ────────────────────────────────────
  function mount(key, initial) {
    if (!NMT3D.TEMPLATES[key]) { console.warn('StereoMASH: невідомий templateKey', key); return; }
    if (ws) { try { ws.destroy(); } catch (_) {} ws = null; }
    if (renderer) { try { renderer.destroy(); } catch (_) {} renderer = null; rCanvas = null; }
    stage.innerHTML = '';
    currentKey = key;
    ws = new NMT3D.Workspace(stage, key);
    attachRenderer();
    if (initial) {
      if (initial.params) ws.setParams(initial.params);
      if (initial.opts) for (const [k, v] of Object.entries(initial.opts)) { if (k in ws.opts) ws.setOpt(k, !!v); }
      if (initial.mode === 'draw') ws.setMode('draw');
    }
    ws.onParamsChanged = syncSliders;
    const t = ws.template;
    figname.innerHTML = '<b>' + escapeHtml(TS('gallery.' + key, t.name)) + '</b>' + (t.full ? ' · ' + escapeHtml(t.full) : '');
    buildPanel();
    markActive();
    scheduleSave();
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // ── Серіалізація (ТЗ §5) ─────────────────────────────────
  function serialize() {
    return {
      format: 'stereomash-scene',
      version: 1,
      templateKey: currentKey,
      params: { ...ws.params },
      opts: { ...ws.opts },
      mode: ws.mode,
      // additive-поля ТЗ v3 (version:1 не ламають)
      style: visualStyle,
      visMode: visMode,
      material: { ...material },
      presets: scenePresets,
    };
  }

  function loadScene(scene) {
    if (!scene || !scene.templateKey || !NMT3D.TEMPLATES[scene.templateKey]) return false;
    if (scene.style === 'exam' || scene.style === 'rich') visualStyle = scene.style;
    if (scene.visMode) visMode = scene.visMode;
    if (scene.material && isFinite(scene.material.hue)) material = { ...material, ...scene.material };
    scenePresets = Array.isArray(scene.presets) ? scene.presets : [];
    mount(scene.templateKey, scene);
    return true;
  }

  function scheduleSave() {
    clearTimeout(_saveT);
    _saveT = setTimeout(() => {
      if (!ws) return;
      const sc = serialize();
      if (STORE_LOCAL) { try { localStorage.setItem(LS_KEY, JSON.stringify(sc)); } catch (_) {} }
      if (typeof OPTS.onChange === 'function') { try { OPTS.onChange(sc); } catch (_) {} }
    }, 400);
  }

  // ── «→ На дошку» / Поділитися ────────────────────────────
  function sceneToHash() {
    return btoa(unescape(encodeURIComponent(JSON.stringify(serialize()))));
  }

  document.getElementById('st-board').addEventListener('click', () => {
    // §7.1+§7.3: єдиний шлях CTA — міст MashUseOnBoard; guard до готовності ws
    if (!ws) { showToast(TS('msg.pickFigureFirst', 'Спершу оберіть фігуру')); return; }
    if (typeof window.MashUseOnBoard === 'function') {
      window.MashUseOnBoard('stereo', serialize, null);   // міст сам перевірить hook хоста
      return;
    }
    // останній рубіж — clipboard як було
    const json = JSON.stringify(serialize(), null, 2);
    if (window.parent !== window) {
      try { window.parent.postMessage({ type: 'mash:toBoard', app: 'stereo', scene: serialize() }, '*'); } catch (_) {}
    }
    navigator.clipboard.writeText(json).then(
      () => showToast(TS('msg.sceneCopied', 'Сцену скопійовано — вставте на дошку')),
      () => showToast(TS('msg.copyFail', 'Не вдалося скопіювати')));
  });

  document.getElementById('st-share').addEventListener('click', () => {
    if (!ws) { showToast(TS('msg.pickFigureFirst', 'Спершу оберіть фігуру')); return; }
    const url = location.origin + location.pathname + '#' + sceneToHash();
    history.replaceState(null, '', '#' + sceneToHash());
    navigator.clipboard.writeText(url).then(
      () => showToast(TS('msg.linkCopied', 'Посилання скопійовано')),
      () => showToast(TS('msg.copyFail', 'Не вдалося скопіювати')));
  });

  // Мова
  const langBtn = document.getElementById('st-lang');
  langBtn.textContent = (window.MashI18n && MashI18n.lang === 'en') ? 'EN' : 'UK';
  langBtn.addEventListener('click', () => {
    const next = (MashI18n.lang === 'uk') ? 'en' : 'uk';
    MashI18n.setLang(next);
    location.reload();
  });

  // ── keydown — ТІЛЬКИ в межах контейнера (ТЗ §7) ──────────
  const keyHandler = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (k === 'r') { ws && ws.resetView(); }
    else if (k === 'u') { ws && ws.template.buildUnfolded && ws.toggleUnfold(); }
    else if (k === 'o') { ws && ws.setAutoOrbit(!ws.autoOrbit); }
    else if (k === 'd') { ws && ws.setMode(ws.mode === 'draw' ? 'adapt' : 'draw'); buildPanel(); }
  };
  root.addEventListener('keydown', keyHandler);

  // ── Початковий стан: opts.state → #hash → localStorage → cube ──
  function loadInitial() {
    if (OPTS.state && loadScene(OPTS.state)) return;
    if (location.hash.length > 2) {
      try {
        const sc = JSON.parse(decodeURIComponent(escape(atob(location.hash.slice(1)))));
        if (loadScene(sc)) return;
      } catch (_) {}
    }
    if (STORE_LOCAL) {
      try {
        const sc = JSON.parse(localStorage.getItem(LS_KEY));
        if (sc && loadScene(sc)) return;
      } catch (_) {}
    }
    mount('cube');
  }

  buildGallery();
  // ФІКС першого рендера: не монтувати двигун, поки stage не має розміру (інакше SVG/canvas 0×0)
  (function initWhenLaidOut(tries) {
    if ((stage.clientWidth > 10 && stage.clientHeight > 10) || tries > 120) {
      loadInitial();
      // страховка: якщо двигун все ж зміряв 0×0 — перемонтувати раз
      requestAnimationFrame(() => {
        const svg = stage.querySelector('svg');
        if (svg && (!+svg.getAttribute('width') || !+svg.getAttribute('height'))) {
          const sc = serialize();
          mount(sc.templateKey, sc);
        }
      });
      return;
    }
    requestAnimationFrame(() => initWhenLaidOut(tries + 1));
  })(0);

  // ── Host-API (симетрія з MashGeoApp/MashG2dApp/MashG3dApp) ──
  window.MashStereoApp = {
    serialize,
    loadScene,
    destroy() {
      clearTimeout(_saveT);
      root.removeEventListener('keydown', keyHandler);
      if (ws) { try { ws.destroy(); } catch (_) {} ws = null; }
      delete window.MashStereoApp;
    },
  };
})();

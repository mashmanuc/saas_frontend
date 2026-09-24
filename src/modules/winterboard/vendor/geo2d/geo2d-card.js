// geo2d-card.js — wraps a dynamic-geometry preset in a card with toolbar
(function () {
  const { Construction, Renderer, PRESETS } = window.Geo2D;

  class GeoCard {
    constructor(container, opts) {
      this.container = container;
      this.type = opts.type;
      this.preset = PRESETS[opts.type];
      if (!this.preset) throw new Error('Unknown preset: ' + opts.type);
      // Опційний перекладач `(key) => string | null` від Vue-обгортки.
      this.i18n = typeof opts.i18n === 'function' ? opts.i18n : null;
      this.toggleState = {};
      this._build();
    }

    _build() {
      this.con = new Construction();
      this.preset.build(this.con);
      this.renderer = new Renderer(this.container, this.con,
        // i18n прокидається до рендерера — саме він малює formula-плашки.
        Object.assign({}, this.preset.defaults || {},
                      this.i18n ? { i18n: this.i18n } : {},
                      { fitReserve: () => this._reserveObjects() }));
      // apply toggles with defaults
      (this.preset.toggles || []).forEach((t) => {
        const on = !!t.default;
        this.toggleState[t.key] = on;
        if (on) t.apply(this.con, true);
      });
      this.renderer.render();
      // Wire point-move callback — fires on drag (rAF-throttled) and drag end.
      this.renderer.onChange = () => {
        if (this.onPointMove) this.onPointMove(this._getFreePoints());
      };
    }

    /**
     * Об'єкти, під які рендерер резервує місце у видимому полі (2026-09-24).
     *
     * Дефект із живої дошки власника: кожен render() заново вписує поле в межі
     * НАМАЛЬОВАНОГО. Описане коло більше за трикутник — тож «Описане» зменшувало
     * й зсувало всю фігуру, а зняття — повертало назад («фігура скаче»). Те саме
     * з висотами тупокутного (основи й H — поза трикутником).
     *
     * Тепер поле рахується так, ніби УСІ побудови пресета ввімкнені: тіньова
     * конструкція з тими самими вільними точками. Перемикачі більше не рухають
     * фігуру; поле змінюється лише від перетягування точок і розміру картки.
     */
    _reserveObjects() {
      const togs = this.preset.toggles || [];
      if (!togs.length) return [];
      const shadow = new Construction();
      this.preset.build(shadow);
      // recompute ПЕРЕД кожним setTo: точка «на прямій» (C трапеції) проєктує
      // себе на пряму з похідних точок, а до recompute їх ще немає — коло в
      // резерві виходило іншим, ніж на екрані (знайшов тест усіх пресетів).
      shadow.recompute();
      for (const o of this.con.objects) {
        if (!o.movable || typeof o.x !== 'number' || typeof o.y !== 'number') continue;
        const s = shadow.get(o.id);
        if (s && typeof s.setTo === 'function') { s.setTo(o.x, o.y, shadow); shadow.recompute(); }
      }
      togs.forEach((t) => t.apply(shadow, true));
      shadow.recompute();
      return shadow.objects;
    }

    /** Returns {id: {x,y}} for every movable point in the current construction. */
    _getFreePoints() {
      const pts = {};
      for (const o of this.con.objects) {
        if (o.movable && typeof o.x === 'number' && typeof o.y === 'number') {
          pts[o.id] = { x: o.x, y: o.y };
        }
      }
      return pts;
    }

    /**
     * Restore free-point positions from a saved snapshot.
     * Called by the renderer on mount when asset.data.pointsSnapshot exists.
     */
    setFreePoints(snapshot) {
      if (!snapshot || !this.con || !this.renderer) return;
      for (const [id, pos] of Object.entries(snapshot)) {
        const o = this.con.get(id);
        if (o && typeof o.setTo === 'function') o.setTo(pos.x, pos.y, this.con);
      }
      this.con.recompute();
      this.renderer.render();
    }

    setToggle(key, on) {
      const t = (this.preset.toggles || []).find((x) => x.key === key);
      if (!t) return;
      this.toggleState[key] = on;
      t.apply(this.con, on);
      this.renderer.render();
    }

    setOption(k, v) {
      this.renderer.setOption(k, v);
      this.renderer.render();
    }

    rebuild() {
      this.renderer.destroy();
      this._build();
      // Notify with reset positions so store clears stale snapshot.
      if (this.onPointMove) this.onPointMove(this._getFreePoints());
    }

    destroy() {
      this.renderer?.destroy();
    }
  }

  // Toolbar factory: build buttons for the preset's toggles + global view toggles
  function makeGeoToolbar(card, host) {
    const bar = document.createElement('div');
    bar.className = 'toolbar';
    const togs = card.preset.toggles || [];
    togs.forEach((t) => {
      const b = document.createElement('button');
      b.className = 'tool';
      b.setAttribute('data-key', t.key);
      b.innerHTML = `<span class="tool-icon">${t.icon || '◦'}</span><span class="tool-label">${t.label}</span>`;
      if (card.toggleState[t.key]) b.classList.add('active');
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const next = !card.toggleState[t.key];
        card.setToggle(t.key, next);
        b.classList.toggle('active', next);
        // Збереження — ПІСЛЯ зміни стану, у тому ж обробнику (2026-09-24).
        // Раніше обгортка слухала тулбар у capture і читала стан у мікрозадачі;
        // на справжньому кліку мікрозадача виконується МІЖ слухачами, тобто ДО
        // цього обробника → зберігався попередній стан (другий клік «вмикав»).
        if (typeof card.onUserToggle === 'function') card.onUserToggle();
      });
      bar.appendChild(b);
    });
    // view options — data-key для уніфікованого i18n-локалізатора у renderer
    const grid = document.createElement('button');
    grid.className = 'tool';
    grid.setAttribute('data-key', 'grid');
    grid.innerHTML = `<span class="tool-icon">⊞</span><span class="tool-label">Сітка</span>`;
    if (card.renderer.opts.showGrid) grid.classList.add('active');
    grid.addEventListener('click', (e) => {
      e.stopPropagation();
      const next = !card.renderer.opts.showGrid;
      grid.classList.toggle('active', next);
      card.setOption('showGrid', next);
    });
    bar.appendChild(grid);
    const axes = document.createElement('button');
    axes.className = 'tool';
    axes.setAttribute('data-key', 'axes');
    axes.innerHTML = `<span class="tool-icon">+</span><span class="tool-label">Осі</span>`;
    if (card.renderer.opts.showAxes) axes.classList.add('active');
    axes.addEventListener('click', (e) => {
      e.stopPropagation();
      const next = !card.renderer.opts.showAxes;
      axes.classList.toggle('active', next);
      card.setOption('showAxes', next);
    });
    bar.appendChild(axes);

    const replay = document.createElement('button');
    replay.className = 'tool replay';
    replay.setAttribute('data-key', 'reset');
    replay.innerHTML = '<span class="tool-icon">↻</span><span class="tool-label">Скинути</span>';
    replay.addEventListener('click', (e) => {
      e.stopPropagation();
      card.rebuild();
      // rebuild повертає перемикачі до дефолтів — підсвітка кнопок теж.
      bar.querySelectorAll('button.tool[data-key]').forEach((btn) => {
        const k = btn.getAttribute('data-key');
        if (k in card.toggleState) btn.classList.toggle('active', !!card.toggleState[k]);
      });
      if (typeof card.onUserToggle === 'function') card.onUserToggle();
    });
    bar.appendChild(replay);
    return bar;
  }

  window.GeoCard = GeoCard;
  window.makeGeoToolbar = makeGeoToolbar;

  // Catalog metadata
  window.GEO_PRESETS = [
    { type: 'similar',        short: '△ ~ △′',     full: 'Подібні трикутники', desc: 'гомотетія · drag k' },
    { type: 'parallels',      short: 'a ∥ b · t',  full: 'Паралельні + січна', desc: '8 кутів · відповідні · різносторонні' },
    { type: 'parallelogram',  short: 'AB ∥ DC',    full: 'Паралелограм',       desc: 'сторони · кути · діагоналі · висота' },
    { type: 'rhombus',        short: 'a=a=a=a',    full: 'Ромб',               desc: 'рівні сторони · ⊥ діагоналі · ∠60°' },
    { type: 'trapezium',      short: 'AB ∥ DC',    full: 'Трапеція',           desc: 'сер. лінія · висота · cyclic check' },
    { type: 'euler9',      short: 'G·H·O',       full: 'Ейлер + 9 точок',    desc: 'колінеарність · коло 9 точок' },
    { type: 'simson',      short: 'P → F₁F₂F₃', full: 'Симсонова пряма',    desc: 'P на колі · 3 проекції колінеарні' },
    { type: 'inversion',   short: "P → P'",     full: 'Інверсія',           desc: "r²/|OP|² · OP · конформність" },
    { type: 'triangle',       short: 'A·B·C',    full: 'Трикутник',                desc: 'медіани · висоти · бісектриси' },
    { type: 'right_triangle', short: '△⊾',      full: 'Прямокутний трикутник',    desc: 'висота · медіана · описане' },
    { type: 'circle',      short: 'O·R',         full: 'Коло',              desc: 'хорда · дотична · кут' },
    { type: 'polygon',     short: '4 верш.',     full: 'Чотирикутник',      desc: 'діагоналі · Варіньон' },
    { type: 'pythagoras',  short: 'a²+b²',       full: 'Піфагор',           desc: 'квадрати на сторонах' },
    { type: 'thales',      short: '‖',           full: 'Фалес',             desc: '3 паралельні · ratios' },
  ];
})();

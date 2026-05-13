// geo2d-card.js — wraps a dynamic-geometry preset in a card with toolbar
(function () {
  const { Construction, Renderer, PRESETS } = window.Geo2D;

  class GeoCard {
    constructor(container, opts) {
      this.container = container;
      this.type = opts.type;
      this.preset = PRESETS[opts.type];
      if (!this.preset) throw new Error('Unknown preset: ' + opts.type);
      this.toggleState = {};
      this._build();
    }

    _build() {
      this.con = new Construction();
      this.preset.build(this.con);
      this.renderer = new Renderer(this.container, this.con, this.preset.defaults || {});
      // apply toggles with defaults
      (this.preset.toggles || []).forEach((t) => {
        const on = !!t.default;
        this.toggleState[t.key] = on;
        if (on) t.apply(this.con, true);
      });
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
    replay.addEventListener('click', (e) => { e.stopPropagation(); card.rebuild(); });
    bar.appendChild(replay);
    return bar;
  }

  window.GeoCard = GeoCard;
  window.makeGeoToolbar = makeGeoToolbar;

  // Catalog metadata
  window.GEO_PRESETS = [
    { type: 'similar',     short: '△ ~ △′',     full: 'Подібні трикутники', desc: 'гомотетія · drag k' },
    { type: 'parallels',   short: 'a ∥ b · t',  full: 'Паралельні + січна', desc: '8 кутів · відповідні · різносторонні' },
    { type: 'trapezium',   short: 'AB ∥ DC',    full: 'Трапеція',          desc: 'сер. лінія · висота · cyclic check' },
    { type: 'euler9',      short: 'G·H·O',       full: 'Ейлер + 9 точок',    desc: 'колінеарність · коло 9 точок' },
    { type: 'simson',      short: 'P → F₁F₂F₃', full: 'Симсонова пряма',    desc: 'P на колі · 3 проекції колінеарні' },
    { type: 'inversion',   short: "P → P'",     full: 'Інверсія',           desc: "r²/|OP|² · OP · конформність" },
    { type: 'triangle',    short: 'A·B·C',       full: 'Трикутник',         desc: 'медіани · висоти · бісектриси' },
    { type: 'circle',      short: 'O·R',         full: 'Коло',              desc: 'хорда · дотична · кут' },
    { type: 'polygon',     short: '4 верш.',     full: 'Чотирикутник',      desc: 'діагоналі · Варіньон' },
    { type: 'pythagoras',  short: 'a²+b²',       full: 'Піфагор',           desc: 'квадрати на сторонах' },
    { type: 'thales',      short: '‖',           full: 'Фалес',             desc: '3 паралельні · ratios' },
    { type: 'unitCircle',  short: 'sin·cos',     full: 'Тригонометричне коло', desc: 'sin · cos · tg · ctg' },
  ];
})();

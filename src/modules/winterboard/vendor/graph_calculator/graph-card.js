// Graph Card — wraps GraphCalculator in a card-style UI with expression list.
//
// Phase G (2026-05-06): engine `addExpression` / `addParameterFor` тепер
// вимагають externally-assigned id (per FE-RULE-3 / inv-21.6). Цей UI генерує
// UUID локально через `_genId()` та передає його як останній arg.
(function () {
  const COLORS = ['#c4622a', '#3b7b9b', '#7a8b3a', '#a83a5b', '#5a4a8a', '#2b6e58', '#c08820', '#8a4a2a'];

  function _genId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return 'expr-' + crypto.randomUUID();
    }
    return 'expr-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function renderPanel(panel, calc, opts={}) {
    panel.innerHTML = '';
    const list = document.createElement('ul');
    list.className = 'gc-list';
    panel.appendChild(list);

    const renderRows = () => {
      list.innerHTML = '';
      calc.expressions.forEach((expr) => list.appendChild(renderRow(expr)));
    };

    const renderRow = (expr) => {
      const li = document.createElement('li');
      li.className = 'gc-row';
      li.dataset.id = expr.id;

      const sw = document.createElement('div');
      sw.className = 'gc-swatch';
      const refreshSwatch = () => {
        const isParam = expr.classified?.kind === 'param';
        if (isParam) {
          sw.style.background = 'transparent';
          sw.classList.add('param-icon');
          sw.classList.remove('hidden');
          sw.innerHTML = '<svg viewBox="0 0 14 14" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.6"><line x1="1" y1="7" x2="13" y2="7"/><circle cx="9" cy="7" r="2.4" fill="currentColor" stroke="none"/></svg>';
          sw.style.color = 'var(--ink-2,#5a4a3a)';
          sw.title = 'параметр (без графіка)';
        } else {
          sw.innerHTML = '';
          sw.classList.remove('param-icon');
          sw.style.background = expr.hidden ? 'transparent' : expr.color;
          sw.classList.toggle('hidden', expr.hidden);
          sw.title = 'Клік — приховати/показати · правий клік — колір';
        }
      };
      refreshSwatch();
      sw.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (expr.classified?.kind === 'param') return;
        // ЛКМ → toggle hidden
        calc.setHidden(expr.id, !expr.hidden);
        refreshSwatch();
      });
      sw.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        if (expr.classified?.kind === 'param') return;
        // ПКМ → колір
        showColorPopover(sw, expr.color, (c) => { calc.setColor(expr.id, c); refreshSwatch(); });
      });

      const wrap = document.createElement('div'); wrap.className = 'gc-input-wrap';
      const input = document.createElement('input');
      input.className = 'gc-input';
      input.value = expr.src;
      input.spellcheck = false; input.autocomplete = 'off';
      input.placeholder = 'y = x^2  ·  x²+y²=9  ·  (2,3)';
      input.addEventListener('input', () => calc.updateExpression(expr.id, input.value));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (calc.expressions[calc.expressions.length-1].id === expr.id) {
            const e2 = calc.addExpression('', _genId());
            renderRows();
            const next = list.querySelector(`[data-id="${e2.id}"] .gc-input`);
            next && next.focus();
          } else {
            const idx = calc.expressions.findIndex((x) => x.id === expr.id);
            const nextExpr = calc.expressions[idx+1];
            const next = list.querySelector(`[data-id="${nextExpr.id}"] .gc-input`);
            next && next.focus();
          }
        }
        if (e.key === 'Backspace' && input.value === '' && calc.expressions.length > 1) {
          e.preventDefault();
          const idx = calc.expressions.findIndex((x) => x.id === expr.id);
          calc.removeExpression(expr.id);
          renderRows();
          const target = calc.expressions[Math.max(0, idx-1)];
          if (target) {
            const next = list.querySelector(`[data-id="${target.id}"] .gc-input`);
            next && next.focus();
          }
        }
      });
      wrap.appendChild(input);

      const errEl = document.createElement('div'); errEl.className = 'gc-error';
      const tagEl = document.createElement('div'); tagEl.className = 'gc-tag';
      const sliderRow = document.createElement('div'); sliderRow.className = 'gc-slider-row';
      const suggestRow = document.createElement('div'); suggestRow.className = 'gc-suggest';

      const refreshClassification = () => {
        sliderRow.style.display = 'none';
        errEl.style.display = 'none';
        tagEl.style.display = 'none';
        suggestRow.style.display = 'none';
        suggestRow.innerHTML = '';
        li.classList.remove('invalid','param','needs');
        const c = expr.classified;
        if (!c) return;
        if (c.kind === 'invalid') {
          if (input.value.trim() !== '') {
            errEl.textContent = c.error || 'Помилка'; errEl.style.display = 'block';
          }
          li.classList.add('invalid');
          return;
        }
        if (c.kind === 'needsParam') {
          li.classList.add('needs');
          suggestRow.style.display = 'flex';
          const txt = document.createElement('span');
          txt.className = 'gc-suggest-txt';
          txt.textContent = c.unknown.length === 1
            ? `додати слайдер для ${c.unknown[0]}?`
            : `додати слайдери: ${c.unknown.join(', ')}?`;
          suggestRow.appendChild(txt);
          c.unknown.forEach((nm) => {
            const b = document.createElement('button');
            b.className = 'gc-suggest-btn';
            b.innerHTML = `<span class="ck">+</span>${nm}`;
            b.addEventListener('click', () => calc.addParameterFor(nm, expr.id, 1, _genId()));
            suggestRow.appendChild(b);
          });
          return;
        }
        const tagMap = {
          explicitY: 'функція y(x)',
          explicitX: 'функція x(y)',
          implicit: 'рівняння',
          point: 'точка',
          param: 'параметр',
        };
        tagEl.textContent = tagMap[c.kind] || '';
        tagEl.style.display = 'block';
        if (c.kind === 'param') {
          li.classList.add('param');
          buildSlider(c.name);
        }
      };

      const buildSlider = (name) => {
        sliderRow.style.display = 'flex';
        sliderRow.innerHTML = '';
        const lab = document.createElement('span'); lab.className = 'gc-lab'; lab.textContent = name + ' =';
        const playBtn = document.createElement('button');
        playBtn.className = 'gc-play';
        const refreshPlay = () => {
          playBtn.textContent = expr.animating ? '⏸' : '▶';
          playBtn.title = expr.animating ? 'Зупинити анімацію' : 'Анімувати між min і max';
          playBtn.classList.toggle('on', !!expr.animating);
        };
        refreshPlay();
        playBtn.addEventListener('click', () => {
          calc.setParamAnimating(expr.id, !expr.animating);
          refreshPlay();
        });
        const rng = document.createElement('input'); rng.type = 'range'; rng.className = 'gc-rng';
        const setRng = () => {
          rng.min = expr.paramRange.min; rng.max = expr.paramRange.max; rng.step = expr.paramRange.step;
          rng.value = calc.params[name] ?? 1;
        };
        setRng();
        const val = document.createElement('span'); val.className = 'gc-val';
        const fmt = (n) => Number.isFinite(n) ? (Math.round(n*100)/100).toString() : '?';
        val.textContent = fmt(parseFloat(rng.value));
        rng.addEventListener('input', () => {
          const v = parseFloat(rng.value);
          val.textContent = fmt(v);
          calc.setParamValue(name, v);
          if (expr.animating) { calc.setParamAnimating(expr.id, false); refreshPlay(); }
        });
        // Live-update slider position when animating
        expr._sliderRefresh = () => {
          rng.value = calc.params[name] ?? 0;
          val.textContent = fmt(parseFloat(rng.value));
        };
        const bounds = document.createElement('span'); bounds.className = 'gc-bounds';
        const minIn = document.createElement('input'); minIn.type='text'; minIn.value = expr.paramRange.min;
        const maxIn = document.createElement('input'); maxIn.type='text'; maxIn.value = expr.paramRange.max;
        minIn.addEventListener('change', () => { const n = parseFloat(minIn.value); if (Number.isFinite(n)) { expr.paramRange.min = n; setRng(); }});
        maxIn.addEventListener('change', () => { const n = parseFloat(maxIn.value); if (Number.isFinite(n)) { expr.paramRange.max = n; setRng(); }});
        bounds.appendChild(minIn);
        const dash = document.createElement('span'); dash.textContent = '…'; dash.style.color = 'rgba(43,33,24,0.4)'; bounds.appendChild(dash);
        bounds.appendChild(maxIn);
        sliderRow.appendChild(playBtn);
        sliderRow.appendChild(lab);
        sliderRow.appendChild(rng);
        sliderRow.appendChild(val);
        sliderRow.appendChild(bounds);
      };

      wrap.appendChild(tagEl);
      wrap.appendChild(suggestRow);
      wrap.appendChild(sliderRow);
      wrap.appendChild(errEl);
      refreshClassification();

      const del = document.createElement('button');
      del.className = 'gc-del'; del.textContent = '×'; del.title = 'Видалити';
      del.addEventListener('click', () => { calc.removeExpression(expr.id); renderRows(); });

      li.appendChild(sw); li.appendChild(wrap); li.appendChild(del);

      li._refresh = () => { refreshSwatch(); refreshClassification(); };
      li._sliderTick = () => { expr._sliderRefresh && expr._sliderRefresh(); };
      return li;
    };

    const addBar = document.createElement('div');
    addBar.className = 'gc-add';
    addBar.innerHTML = `
      <button class="gc-add-btn" title="Додати вираз (Enter в останньому полі)">
        <span class="gc-add-plus">+</span>
        <span class="gc-add-lbl">додати поле</span>
      </button>
    `;
    addBar.querySelector('button').addEventListener('click', () => {
      const e = calc.addExpression('', _genId());
      renderRows();
      const target = list.querySelector(`[data-id="${e.id}"] .gc-input`);
      target && target.focus();
    });
    panel.insertBefore(addBar, list);

    if (!opts.compact) {
      const hint = document.createElement('div');
      hint.className = 'gc-hint';
      hint.innerHTML = `Підтримує: <b>y=x^2</b>, <b>sin(a*x)</b>, <b>(x-2)²+y²=9</b>, <b>(2,3)</b>. Невідома буква → пропозиція слайдера.`;
      panel.appendChild(hint);
    }

    calc.onChange = () => {
      const allOk = list.children.length === calc.expressions.length &&
        Array.from(list.children).every((li, i) => +li.dataset.id === calc.expressions[i].id);
      if (allOk) Array.from(list.children).forEach((li) => {
        li._refresh && li._refresh();
        li._sliderTick && li._sliderTick();
      });
      else renderRows();
    };

    renderRows();
  }

  function showColorPopover(anchor, currentColor, onPick) {
    const existing = document.querySelector('.gc-cpop');
    if (existing) existing.remove();
    const pop = document.createElement('div'); pop.className = 'gc-cpop';
    COLORS.forEach((c) => {
      const b = document.createElement('button'); b.style.background = c;
      if (c === currentColor) b.style.boxShadow = '0 0 0 2px '+c;
      b.addEventListener('click', () => { onPick(c); pop.remove(); });
      pop.appendChild(b);
    });
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.left = (r.right + 4) + 'px';
    pop.style.top = r.top + 'px';
    setTimeout(() => {
      const close = (e) => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('mousedown', close); } };
      document.addEventListener('mousedown', close);
    }, 0);
  }

  function makeGraphCard(opts = {}) {
    const wrap = document.createElement('article');
    wrap.className = 'gc-card';
    if (opts.compact) wrap.classList.add('gc-mini');
    wrap.setAttribute('data-screen-label', opts.label || 'graph-calc');

    if (!opts.compact) {
      const head = document.createElement('header');
      head.className = 'gc-head';
      if (opts.draggable) head.draggable = true;
      head.innerHTML = `
        <div class="grip" title="Перетягни на дошку">⋮⋮</div>
        <h3 class="gc-title">${opts.title || 'Графічний калькулятор'}</h3>
        <div class="gc-meta">${opts.meta || 'функції · рівняння · параметри'}</div>
        ${opts.expand ? '<button class="gc-expand" title="На весь екран">⤢</button>' : ''}
      `;
      wrap.appendChild(head);
      if (opts.draggable && opts.onDragStart) {
        head.addEventListener('dragstart', (e) => opts.onDragStart(e, wrap));
      }
      if (opts.expand) {
        head.querySelector('.gc-expand').addEventListener('click', () => opts.onExpand && opts.onExpand());
      }
    }

    const body = document.createElement('div');
    body.className = 'gc-body' + (opts.compact ? ' compact' : '');
    const panel = document.createElement('aside'); panel.className = 'gc-panel';
    const plot = document.createElement('div'); plot.className = 'gc-plot';
    body.appendChild(panel); body.appendChild(plot);
    wrap.appendChild(body);

    const calc = new window.GraphCalculator(plot);
    renderPanel(panel, calc, { compact: opts.compact });

    const seeds = opts.seed || ['y = x^2'];
    seeds.forEach((s) => calc.addExpression(s, _genId()));

    wrap._calc = calc;
    return wrap;
  }

  window.makeGraphCard = makeGraphCard;
})();

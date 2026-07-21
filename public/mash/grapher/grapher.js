// grapher.js — Desmos-style app shell around the GraphCalculator engine.
(function () {
  const COLORS = ['#c74440', '#2d70b3', '#388c46', '#6042a6', '#fa7e19', '#000000', '#cf5283', '#0d9488'];
  const $ = (s, r = document) => r.querySelector(s);

  // ---- typeset preview (AST -> HTML) ----
  function prettyMath(src) {
    const GC = window.GraphCalc;
    const ast = GC.parse(src);
    return H(ast).h + restrHtml(ast.restrictions);
  }
  function escH(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function symName(n) { return ({ pi: 'π', 'π': 'π', theta: 'θ', 'θ': 'θ', tau: 'τ', 'τ': 'τ' })[n] || escH(n); }
  function fmtN(v) { return Number.isFinite(v) ? (Math.round(v * 1e9) / 1e9).toString() : String(v); }
  function wrapP(x, min) { return x.p < min ? '(' + x.h + ')' : x.h; }
  function H(node) {
    switch (node.kind) {
      case 'num': return { h: fmtN(node.v), p: 10 };
      case 'ident': return { h: '<i>' + symName(node.name) + '</i>', p: 10 };
      case 'unary':
        if (node.op === '!') return { h: wrapP(H(node.arg), 9) + '!', p: 9 };
        return { h: '−' + wrapP(H(node.arg), 3), p: 3 };
      case 'binop': {
        if (node.op === '/') return { h: '<span class="frac"><span class="fnum">' + H(node.left).h + '</span><span class="fden">' + H(node.right).h + '</span></span>', p: 10 };
        if (node.op === '^') return { h: wrapP(H(node.left), 6) + '<sup>' + H(node.right).h + '</sup>', p: 5 };
        const opsym = { '+': ' + ', '-': ' − ', '*': '·', '%': ' mod ' }[node.op];
        const pr = (node.op === '+' || node.op === '-') ? 1 : 2;
        return { h: wrapP(H(node.left), pr) + opsym + wrapP(H(node.right), node.op === '-' ? pr + 1 : pr), p: pr };
      }
      case 'call': {
        const a = node.args.map((x) => H(x).h);
        if (node.name === 'log' && node.args.length === 2) return { h: '<span class="fn">log</span><sub>' + a[1] + '</sub>(' + a[0] + ')', p: 10 };
        if (node.name === 'sqrt') return { h: '<span class="rad">√<span class="radc">' + a.join(', ') + '</span></span>', p: 10 };
        if (node.name === 'cbrt') return { h: '<span class="rad"><sup class="radn">3</sup>√<span class="radc">' + a.join(', ') + '</span></span>', p: 10 };
        if (node.name === 'abs') return { h: '|' + a.join(', ') + '|', p: 10 };
        return { h: '<span class="fn">' + escH(node.name) + '</span>(' + a.join(', ') + ')', p: 10 };
      }
      case 'tuple': return { h: '(' + node.items.map((x) => H(x).h).join(', ') + ')', p: 10 };
      case 'eq': return { h: H(node.lhs).h + ' = ' + H(node.rhs).h, p: 0 };
      case 'cmp': {
        const rel = { '<': ' < ', '>': ' > ', '<=': ' ≤ ', '>=': ' ≥ ' };
        let s = H(node.operands[0]).h;
        for (let k = 0; k < node.ops.length; k++) s += rel[node.ops[k]] + H(node.operands[k + 1]).h;
        return { h: s, p: 0 };
      }
      case 'logic':
        if (node.op === 'not') return { h: '<b class="lg">not</b> ' + H(node.arg).h, p: 0 };
        return { h: H(node.left).h + ' <b class="lg">' + node.op + '</b> ' + H(node.right).h, p: 0 };
      case 'piecewise': {
        const rows = node.pieces.map((pc) => '<span class="pwv">' + H(pc.val).h + '</span><span class="pwc">' + T2('ui.piecewiseIf', 'якщо') + ' ' + H(pc.cond).h + '</span>');
        if (node.elseNode) rows.push('<span class="pwv">' + H(node.elseNode).h + '</span><span class="pwc">' + T2('ui.piecewiseElse', 'інакше') + '</span>');
        return { h: '<span class="pw"><span class="pwbrace">{</span><span class="pwrows">' + rows.join('') + '</span></span>', p: 10 };
      }
      // L-06: sum / product / sequences / L-systems / fractals
      case 'str': return { h: '&ldquo;<span class="str">' + escH(node.v) + '</span>&rdquo;', p: 10 };
      case 'sum':
        return { h: '<span class="op-sum">Σ</span><sub><i>' + escH(node.varName) + '</i>=' + H(node.start).h + '</sub><sup>' + H(node.end).h + '</sup>' + wrapP(H(node.body), 2), p: 2 };
      case 'product':
        return { h: '<span class="op-sum">Π</span><sub><i>' + escH(node.varName) + '</i>=' + H(node.start).h + '</sub><sup>' + H(node.end).h + '</sup>' + wrapP(H(node.body), 2), p: 2 };
      case 'sequencePlot':
        return { h: '<span class="fn">plot</span>(' + H(node.body).h + ', <i>' + escH(node.varName) + '</i>, ' + H(node.start).h + ', ' + H(node.end).h + ')', p: 10 };
      case 'lsystem':
        return { h: '<span class="fn">lsystem</span>(&ldquo;' + escH((node.axiomNode && node.axiomNode.v) || '') + '&rdquo;, &ldquo;' + escH((node.rulesNode && node.rulesNode.v) || '') + '&rdquo;, ' + H(node.itersNode).h + (node.angleNode ? ', ' + H(node.angleNode).h + '°' : '') + ')', p: 10 };
      case 'mandelbrot': return { h: '<span class="fn">mandelbrot</span>(' + (node.args || []).map((a) => H(a).h).join(', ') + ')', p: 10 };
      case 'julia':       return { h: '<span class="fn">julia</span>(' + (node.args || []).map((a) => H(a).h).join(', ') + ')', p: 10 };
      case 'burningship': return { h: '<span class="fn">burningship</span>()', p: 10 };
      case 'tricorn':     return { h: '<span class="fn">tricorn</span>()', p: 10 };
      case 'multibrot':   return { h: '<span class="fn">multibrot</span>(' + (node.args || []).map((a) => H(a).h).join(', ') + ')', p: 10 };
    }
    return { h: '', p: 10 };
  }
  function restrHtml(restr) {
    if (!restr || !restr.length) return '';
    return restr.map((r) => ' <span class="restr">{' + H(r.test).h + '}</span>').join('');
  }

  // ── i18n (§1): T2('key','укр fallback') — словник mash.g2d.* ──
  const T2 = (k, fb) => {
    if (!window.MashI18n || !MashI18n.ready) return fb;
    const v = MashI18n.t('mash.g2d.' + k);
    return v === 'mash.g2d.' + k ? fb : v;
  };

  // ---- mount engine into plot ----
  const plotWrap = $('#plotWrap');
  const calc = new window.GraphCalculator(plotWrap, {
    bg: '#ffffff',
    gridMinor: 'rgba(0,0,0,0.06)', gridMajor: 'rgba(0,0,0,0.13)',
    axis: '#3c3c3c', axisLabel: '#7a7a7a', pointHalo: '#ffffff', pointLabel: '#3c3c3c',
    palette: COLORS,
  });
  window.__calc = calc;

  // ── A2: локалізація помилок двигуна НА ПОКАЗІ (engine не чіпаємо) ──────
  // Двигун кидає укр-тексти; тут мапимо їх на T2-ключі + олюднюємо токени
  // (RP → «)») — «Несподіваний токен: RP» нікому нічого не каже жодною мовою.
  // Невідома помилка → показуємо як є (укр fallback, нічого не ковтаємо).
  const TOK_HUMAN = {
    RP: ')', LP: '(', RBRACE: '}', LBRACE: '{', RBRACK: ']', LBRACK: '[',
    COMMA: ',', COLON: ':', EQ: '=',
    NUM: () => T2('engineErr.tokNum', 'число'),
    IDENT: () => T2('engineErr.tokIdent', 'ім’я'),
    STR: () => T2('engineErr.tokStr', 'рядок'),
    OP: () => T2('engineErr.tokOp', 'оператор'),
    REL: () => T2('engineErr.tokRel', 'знак порівняння'),
    LOGIC: () => T2('engineErr.tokLogic', 'логічний оператор'),
    END: () => T2('engineErr.tokEnd', 'кінець виразу'),
  };
  const humanTok = (t) => { const h = TOK_HUMAN[t]; return typeof h === 'function' ? h() : (h || t); };
  const ERR_EXACT = {
    'Очікується рівняння або точка': ['engineErr.expectEq', 'Очікується рівняння або точка'],
    'Очікувалось порівняння (напр. x > 0)': ['engineErr.expectCmp', 'Очікувалось порівняння (напр. x > 0)'],
    'Залишок після виразу': ['engineErr.trailing', 'Залишок після виразу'],
    'Забагато рекурсії': ['engineErr.tooDeep', 'Забагато рекурсії'],
    'n! недоступний для комплексних': ['engineErr.cxFactorial', 'n! недоступний для комплексних'],
    'Комплексний вираз: непідтримувана конструкція': ['engineErr.cxUnsupported', 'Комплексний вираз: непідтримувана конструкція'],
    'Дія: очікується name -> вираз': ['engineErr.actionShape', 'Дія: очікується name -> вираз'],
    'Регресія: очікується y ~ формула': ['engineErr.fitShape', 'Регресія: очікується y ~ формула'],
    'Регресія: немає параметрів для підгонки (напр. y ~ a x + b)': ['engineErr.fitNoParams', 'Регресія: немає параметрів для підгонки (напр. y ~ a x + b)'],
    'Регресія: занадто багато параметрів (макс 6)': ['engineErr.fitTooMany', 'Регресія: занадто багато параметрів (макс 6)'],
    'Аксіома і правила — рядки у лапках': ['engineErr.lsysStrings', 'Аксіома і правила — рядки у лапках'],
    'Потрібна таблиця з даними': ['engineErr.fitNeedTable', 'Потрібна таблиця з даними'],
    'Не вдалося підігнати': ['engineErr.fitFailed', 'Не вдалося підігнати'],
  };
  const ERR_RX = [
    [/^Несподіваний токен: (\S+)\s*(.*)$/, (m) => T2('engineErr.unexpectedToken', 'Несподіваний токен: {tok}').replace('{tok}', m[2] || humanTok(m[1]))],
    [/^Невідомий символ «(.+)» на позиції (\d+)$/, (m) => T2('engineErr.unknownChar', 'Невідомий символ «{ch}» на позиції {pos}').replace('{ch}', m[1]).replace('{pos}', m[2])],
    [/^Очікувалось (\S+?)(?:=(\S+))?, отримано (\S+)=?(.*)$/, (m) => T2('engineErr.expectedGot', 'Очікувалось {want}, отримано {got}').replace('{want}', m[2] || humanTok(m[1])).replace('{got}', m[4] || humanTok(m[3]))],
    [/^Невідома змінна: (.+)$/, (m) => T2('engineErr.unknownVar', 'Невідома змінна: {name}').replace('{name}', m[1])],
    [/^Невідома функція: (.+)$/, (m) => T2('engineErr.unknownFn', 'Невідома функція: {name}').replace('{name}', m[1])],
    [/^Дія: некоректне ім'я (.+)$/, (m) => T2('engineErr.actionBadName', 'Дія: некоректне ім’я {name}').replace('{name}', m[1])],
    [/^Функція (.+) недоступна для комплексних$/, (m) => T2('engineErr.cxFnUnavailable', 'Функція {name} недоступна для комплексних').replace('{name}', m[1])],
    [/^Забагато рекурсії \(>(\d+)\)$/, (m) => T2('engineErr.tooDeepN', 'Забагато рекурсії (>{n})').replace('{n}', m[1])],
    [/^Забагато ітерацій \(>(\d+)\)$/, (m) => T2('engineErr.tooManyIter', 'Забагато ітерацій (>{n})').replace('{n}', m[1])],
    [/^Забагато точок \(>(\d+)\)$/, (m) => T2('engineErr.tooManyPts', 'Забагато точок (>{n})').replace('{n}', m[1])],
  ];
  function localizeEngineError(msg) {
    if (!msg) return msg;
    const ex = ERR_EXACT[msg];
    if (ex) return T2(ex[0], ex[1]);
    for (const [rx, fn] of ERR_RX) { const m = msg.match(rx); if (m) return fn(m); }
    return msg; // невідомий текст — показуємо як є (double-safe fallback)
  }

  // Зум-кнопки створює engine з укр title-ами — патчимо на показі
  for (const [z, key, fb] of [['in', 'ui.zoomIn', 'Збільшити'], ['out', 'ui.zoomOut', 'Зменшити'], ['home', 'ui.zoomHome', 'До початку']]) {
    const btn = plotWrap.querySelector(`.gc-zb[data-z="${z}"]`);
    if (btn) btn.title = T2(key, fb);
  }

  const list = $('#exprList');

  // ---------- row rendering ----------
  function renderRows() {
    list.innerHTML = '';
    calc.expressions.forEach((expr, i) => list.appendChild(renderRow(expr, i)));
  }

  // Drag-перестановка рядків (як у 3D): тягни за номер/іконку
  function wireRowDrag(li, idx, expr) {
    idx.draggable = true;
    idx.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('text/g2d-id', String(expr.id));
      ev.dataTransfer.effectAllowed = 'move';
      li.classList.add('dragging');
    });
    idx.addEventListener('dragend', () => li.classList.remove('dragging'));
    li.addEventListener('dragover', (ev) => {
      if (![...ev.dataTransfer.types].includes('text/g2d-id')) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      li.classList.add('drag-over');
    });
    li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
    li.addEventListener('drop', (ev) => {
      ev.preventDefault();
      li.classList.remove('drag-over');
      const srcId = +ev.dataTransfer.getData('text/g2d-id');
      const dstId = expr.id;
      if (!srcId || srcId === dstId) return;
      const dstIdx = calc.expressions.findIndex((x) => x.id === dstId);
      calc.moveExpression(srcId, dstIdx);
      renderRows();
      snapshot();
    });
  }

  function renderRow(expr, index) {
    const li = document.createElement('li');
    li.className = 'row';
    li.dataset.id = expr.id;

    if (expr.isTable) return renderTableRow(expr, index, li);

    // index / style cell
    const idx = document.createElement('div');
    idx.className = 'row-idx';
    const num = document.createElement('span');
    num.className = 'row-num';
    idx.appendChild(num);
    const ico = document.createElement('div');
    ico.className = 'row-ico';
    idx.appendChild(ico);

    const refreshIco = () => {
      const c = expr.classified;
      num.textContent = index + 1;
      ico.innerHTML = '';
      idx.classList.remove('param-cell');
      if (c && c.kind === 'param') {
        idx.classList.add('param-cell');
        ico.innerHTML = '<svg class="pico" viewBox="0 0 18 18" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7"><line x1="2" y1="9" x2="16" y2="9"/><circle cx="11" cy="9" r="3" fill="currentColor" stroke="none"/></svg>';
        idx.title = T2('ui.paramSliderTitle', 'параметр — повзунок');
        return;
      }
      if (c && c.kind === 'funcDef') {
        idx.classList.add('param-cell');
        ico.innerHTML = '<span class="ficon">ƒ</span>';
        idx.title = c.isSeqGeneral ? T2('tags.seqGeneral', 'рекурентна формула') : T2('ui.funcDefTitle', 'визначення функції');
        return;
      }
      if (c && c.kind === 'seqBase') {
        idx.classList.add('param-cell');
        ico.innerHTML = '<span class="ficon">ƒ</span>';
        idx.title = T2('ui.seqBaseTitle', 'базовий випадок послідовності');
        return;
      }
      if (c && c.kind === 'fractal') {
        ico.innerHTML = '';
        ico.style.cssText = 'display:block;width:12px;height:12px;border-radius:2px;background:conic-gradient(#00d4ff 0%,#7b2fbe 40%,#ff6b35 70%,#00d4ff 100%)';
        const fnames = { mandelbrot: T2('tags.fractalMandelbrot', 'Мандельброт'), julia: T2('tags.fractalJuliaSet', 'Множина Юлії'), burningship: 'Burning Ship', tricorn: 'Tricorn', multibrot: 'Multibrot' };
        idx.title = fnames[c.type] || T2('tags.fractalGeneric', 'Фрактал');
        return;
      }
      if (c && (c.kind === 'point' || c.kind === 'sequencePlot')) {
        const d = document.createElement('div');
        d.className = 'row-dot' + (expr.hidden ? ' hollow' : '');
        d.style.background = expr.color;
        ico.appendChild(d);
      } else if (c && (c.kind === 'inequality' || (c.kind === 'needsParam' && c.isIneq))) {
        const s = document.createElement('div');
        s.style.cssText = 'width:17px;height:12px;border-radius:3px;';
        s.style.background = expr.color + '44';
        s.style.boxShadow = 'inset 0 0 0 1.6px ' + expr.color;
        if (expr.hidden) s.style.opacity = '0.32';
        ico.appendChild(s);
      } else {
        const l = document.createElement('div');
        l.className = 'row-line' + (expr.hidden ? ' hollow' : '');
        l.style.background = expr.color;
        ico.appendChild(l);
      }
      idx.title = T2('ui.rowIcoTitle', 'клік — сховати/показати · правий клік — колір');
    };
    refreshIco();
    wireRowDrag(li, idx, expr);
    idx.addEventListener('click', () => {
      if (expr.classified?.kind === 'param' || expr.classified?.kind === 'funcDef' || expr.classified?.kind === 'seqBase') return;
      calc.setHidden(expr.id, !expr.hidden); refreshIco();
    });
    idx.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (expr.classified?.kind === 'param' || expr.classified?.kind === 'funcDef' || expr.classified?.kind === 'seqBase') return;
      colorPopover(idx, expr.color, (c) => { calc.setColor(expr.id, c); refreshIco(); });
    });

    // body
    const body = document.createElement('div');
    body.className = 'row-body';
    const input = document.createElement('input');
    input.className = 'row-input';
    input.value = expr.src;
    input.spellcheck = false; input.autocomplete = 'off';
    input.placeholder = T2('input.placeholder', 'y = x²   ·   x²+y²=9   ·   (2, 3)');
    input.addEventListener('input', () => { calc.updateExpression(expr.id, input.value); updatePretty(); });
    input.addEventListener('keydown', (e) => onKey(e, expr, input));
    // Single-view swap (як Desmos): клік по формулі → редагування в тому ж місці
    input.addEventListener('focus', () => { li.classList.add('editing'); });
    input.addEventListener('blur', () => { li.classList.remove('editing'); updatePretty(); });
    body.appendChild(input);
    const pretty = document.createElement('div'); pretty.className = 'row-pretty';
    pretty.title = T2('ui.clickToEdit', 'Клік — редагувати');
    pretty.addEventListener('mousedown', (e) => {
      e.preventDefault();
      li.classList.add('editing');
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
    body.appendChild(pretty);
    const updatePretty = () => {
      const v = input.value.trim();
      let html = '';
      if (v) {
        const lm = v.match(/^\s*(\([\s\S]*\))\s*"([^"]*)"\s*$/);
        try { html = prettyMath(lm ? lm[1] : v); } catch (_) { html = ''; }
        if (html && lm) html += ' <span class="lg">«' + lm[2].replace(/&/g,'&amp;').replace(/</g,'&lt;') + '»</span>';
      }
      if (html) { pretty.innerHTML = html; pretty.classList.add('has'); body.classList.add('haspretty'); }
      else { pretty.classList.remove('has'); body.classList.remove('haspretty'); pretty.innerHTML = ''; }
    };
    updatePretty();

    const tag = document.createElement('div'); tag.className = 'row-tag';
    const err = document.createElement('div'); err.className = 'row-err';
    const sliderRow = document.createElement('div'); sliderRow.className = 'slider-row';
    const suggest = document.createElement('div'); suggest.className = 'suggest';
    body.appendChild(tag); body.appendChild(suggest); body.appendChild(sliderRow); body.appendChild(err);

    const refreshClass = () => {
      tag.style.display = 'none'; err.style.display = 'none';
      suggest.style.display = 'none'; suggest.innerHTML = '';
      li.classList.remove('invalid', 'needs');
      const c = expr.classified;
      const hideSlider = () => { sliderRow.style.display = 'none'; sliderRow.dataset.built = ''; };
      if (!c) { hideSlider(); return; }
      if (c.kind === 'invalid') {
        if (input.value.trim() !== '') { err.textContent = localizeEngineError(c.error) || T2('errors.generic', 'Помилка'); err.style.display = 'block'; }
        li.classList.add('invalid'); hideSlider(); return;
      }
      if (c.kind === 'needsParam') {
        li.classList.add('needs'); suggest.style.display = 'flex'; hideSlider();
        const t = document.createElement('span');
        t.textContent = c.unknown.length === 1 ? T2('ui.addSliderOne', 'Додати повзунок для {name}?').replace('{name}', c.unknown[0]) : T2('ui.addSliderMany', 'Додати повзунки: {names}?').replace('{names}', c.unknown.join(', '));
        suggest.appendChild(t);
        c.unknown.forEach((nm) => {
          const b = document.createElement('button'); b.className = 'sbtn';
          b.innerHTML = `<span class="ck">+</span>${nm}`;
          b.addEventListener('click', () => calc.addParameterFor(nm, expr.id, 1));
          suggest.appendChild(b);
        });
        return;
      }
      const tags = { explicitY: T2('tags.explicitY', 'функція y(x)'), explicitX: T2('tags.explicitX', 'функція x(y)'), implicit: T2('tags.implicit', 'рівняння'), inequality: T2('tags.inequality', 'нерівність · область'), polar: T2('tags.polar', 'полярна r(θ)'), parametric: T2('tags.parametric', 'параметрична (t)'), point: T2('tags.point', 'точка'), param: T2('tags.param', 'параметр'), funcDef: T2('tags.funcDef', 'функція ƒ(x)'), seqBase: T2('tags.seqBase', 'базовий випадок'), sequencePlot: T2('tags.sequencePlot', 'послідовність · точки'), lsystem: T2('tags.lsystem', 'L-система'), fitExpr: T2('tags.fitExpr', 'регресія'), domainColor: T2('tags.domainColor', 'комплексна f(z) · domain coloring'), complexPoint: T2('tags.complexPoint', 'комплексне число'), action: T2('tags.action', 'дія'), histogram: T2('tags.histogram', 'гістограма'), boxplot: 'boxplot' };
      const fractalNames = { mandelbrot: T2('tags.fractalMandelbrot', 'Мандельброт'), julia: T2('tags.fractalJulia', 'Юлія'), burningship: 'Burning Ship', tricorn: 'Tricorn', multibrot: 'Multibrot' };
      tag.textContent = (c.kind === 'funcDef' && c.isSeqGeneral) ? T2('tags.seqGeneral', 'рекурентна формула') : c.kind === 'fractal' ? T2('tags.fractal', 'фрактал · {name}').replace('{name}', fractalNames[c.type] || c.type) : c.kind === 'point' && c.label ? T2('tags.pointLabeled', 'точка · «{label}»').replace('{label}', c.label) : (tags[c.kind] || ''); tag.style.display = 'block';
      if (c.kind === 'fitExpr') {
        // Показати підігнані параметри після рендеру (fitResult з'являється асинхронно)
        const showFit = () => {
          const fr = expr.fitResult;
          if (!fr) { setTimeout(showFit, 250); return; }
          if (fr.error) { tag.textContent = T2('tags.fitExpr', 'регресія') + ' · ' + localizeEngineError(fr.error); return; }
          const ps = Object.entries(fr.params).map(([n, v]) => `${n} = ${(+v.toPrecision(4))}`).join(', ');
          tag.textContent = `${T2('tags.fitExpr', 'регресія')} · ${ps} · R² = ${(+fr.r2.toFixed(4))}`;
        };
        setTimeout(showFit, 120);
      }
      if (c.kind === 'param') {
        // список-параметр (d = [1,2,3] або random(n)) — без слайдера
        if (Array.isArray(calc.params[c.name])) { hideSlider(); }
        // build slider only once per param name; subsequent refreshes reuse it (so Play/Stop is stable)
        else if (sliderRow.dataset.built !== c.name) buildSlider(sliderRow, expr, c.name);
        else sliderRow.style.display = 'flex';
      } else if (c.kind === 'parametric') {
        if (sliderRow.dataset.built !== '#t') buildTRange(sliderRow, expr);
        else sliderRow.style.display = 'flex';
      } else if (c.kind === 'action') {
        if (sliderRow.dataset.built !== '#act') buildAction(sliderRow, expr);
        else sliderRow.style.display = 'flex';
      } else hideSlider();
    };
    refreshClass();

    // WYSIWYG-редактор (MathQuill) — редагування «як на папері»
    if (window.MQAdapter && MQAdapter.ready() && !expr._textMode && MQAdapter.canWysiwyg(expr.src)) {
      input.style.display = 'none';
      pretty.style.display = 'none';
      pretty.classList.remove('has');
      body.classList.remove('haspretty');
      const span = document.createElement('span');
      span.className = 'mq-field';
      body.insertBefore(span, input);
      let deb = null;
      const mq = MQAdapter.mount(span, expr.src, {
        onEdit: (s) => {
          input.value = s;
          clearTimeout(deb);
          deb = setTimeout(() => { calc.updateExpression(expr.id, s); refreshClass(); }, 140);
        },
        onEnter: () => {
          const exprs = calc.expressions;
          if (exprs[exprs.length - 1].id === expr.id) { const n = calc.addExpression(''); renderRows(); focusRow(n.id); }
          else { const j = exprs.findIndex((x) => x.id === expr.id); focusRow(exprs[j + 1].id); }
        },
        onDeleteEmpty: () => {
          const j = calc.expressions.findIndex((x) => x.id === expr.id);
          calc.removeExpression(expr.id); renderRows();
          const t = calc.expressions[Math.max(0, j - 1)];
          t && focusRow(t.id);
        },
        onUp: () => { const j = calc.expressions.findIndex((x) => x.id === expr.id); if (j > 0) focusRow(calc.expressions[j - 1].id); },
        onDown: () => { const j = calc.expressions.findIndex((x) => x.id === expr.id); if (j < calc.expressions.length - 1) focusRow(calc.expressions[j + 1].id); },
      });
      li._mq = mq;
      const tbtn = document.createElement('button');
      tbtn.className = 'row-textmode'; tbtn.title = T2('ui.textMode', 'Текстовий режим (для лапок, кускових функцій)'); tbtn.textContent = 'ab';
      tbtn.addEventListener('click', () => { expr._textMode = true; renderRows(); focusRow(expr.id); });
      li.appendChild(tbtn);
    } else if (window.MQAdapter && MQAdapter.ready() && expr._textMode) {
      const tbtn = document.createElement('button');
      tbtn.className = 'row-textmode active'; tbtn.title = T2('ui.visualMode', 'Візуальний режим'); tbtn.textContent = 'ƒx';
      tbtn.addEventListener('click', () => { expr._textMode = false; renderRows(); focusRow(expr.id); });
      li.appendChild(tbtn);
    }

    const dup = document.createElement('button');
    dup.className = 'row-dup'; dup.textContent = '⧉'; dup.title = T2('toolbar.duplicate', 'Дублювати');
    dup.addEventListener('click', () => {
      // §7.6: копія виразу одразу під оригіналом (паритет з 3D dup-btn); колір — новий з палітри
      const n = calc.addExpression(expr.src);
      if (expr.hidden) calc.setHidden(n.id, true);
      calc.moveExpression(n.id, calc.expressions.findIndex((x) => x.id === expr.id) + 1);
      renderRows(); focusRow(n.id); snapshot();
    });
    const del = document.createElement('button');
    del.className = 'row-del'; del.textContent = '×'; del.title = T2('toolbar.deleteRow', 'Видалити');
    del.addEventListener('click', () => { calc.removeExpression(expr.id); renderRows(); });

    li.appendChild(idx); li.appendChild(body); li.appendChild(dup); li.appendChild(del);
    li._refresh = () => { refreshIco(); refreshClass(); };
    li._tick = () => { expr._sliderRefresh && expr._sliderRefresh(); expr._playRefresh && expr._playRefresh(); };
    return li;
  }

  // ---------- data table row ----------
  function renderTableRow(expr, index, li) {
    li.classList.add('table-row');

    const idx = document.createElement('div');
    idx.className = 'row-idx';
    const num = document.createElement('span'); num.className = 'row-num'; num.textContent = index + 1;
    const ico = document.createElement('div'); ico.className = 'row-ico';
    idx.appendChild(num); idx.appendChild(ico);
    const refreshDot = () => {
      ico.innerHTML = '';
      const d = document.createElement('div');
      d.className = 'row-dot' + (expr.hidden ? ' hollow' : '');
      d.style.background = expr.color;
      ico.appendChild(d);
    };
    refreshDot();
    idx.title = T2('ui.rowIcoTitle', 'клік — сховати/показати · правий клік — колір');
    wireRowDrag(li, idx, expr);
    idx.addEventListener('click', () => { calc.setHidden(expr.id, !expr.hidden); refreshDot(); });
    idx.addEventListener('contextmenu', (e) => { e.preventDefault(); colorPopover(idx, expr.color, (c) => { calc.setColor(expr.id, c); refreshDot(); }); });

    const body = document.createElement('div'); body.className = 'row-body';
    const tag = document.createElement('div'); tag.className = 'row-tag'; tag.textContent = T2('tags.dataTable', 'таблиця даних'); tag.style.display = 'block';
    body.appendChild(tag);

    const grid = document.createElement('div'); grid.className = 'dtable';
    body.appendChild(grid);

    const commit = () => { calc.updateTable(expr.id, expr.table); refreshReg(); };

    const buildGrid = () => {
      grid.innerHTML = '';
      // header
      const head = document.createElement('div'); head.className = 'dt-row dt-head';
      expr.table.head.forEach((hname, ci) => {
        const h = document.createElement('input'); h.className = 'dt-h'; h.value = hname;
        h.addEventListener('change', () => { expr.table.head[ci] = h.value.trim() || (ci === 0 ? 'x' : 'y'); commit(); });
        head.appendChild(h);
      });
      const spacer = document.createElement('span'); spacer.className = 'dt-del-sp';
      head.appendChild(spacer);
      grid.appendChild(head);
      // data rows
      expr.table.rows.forEach((row, ri) => {
        const tr = document.createElement('div'); tr.className = 'dt-row';
        row.forEach((cell, ci) => {
          const inp = document.createElement('input'); inp.className = 'dt-c'; inp.value = cell;
          inp.inputMode = 'decimal'; inp.spellcheck = false;
          inp.addEventListener('input', () => { expr.table.rows[ri][ci] = inp.value.trim(); commit(); });
          inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (ri === expr.table.rows.length - 1) { addRow(); }
              const next = grid.querySelectorAll('.dt-row')[ri + 2];
              const tgt = next && next.querySelectorAll('.dt-c')[ci];
              tgt && tgt.focus();
            }
          });
          tr.appendChild(inp);
        });
        const rm = document.createElement('button'); rm.className = 'dt-del'; rm.textContent = '×'; rm.title = T2('ui.deleteTableRow', 'Видалити рядок');
        rm.addEventListener('click', () => {
          expr.table.rows.splice(ri, 1);
          if (!expr.table.rows.length) expr.table.rows.push(['', '']);
          commit(); buildGrid();
        });
        tr.appendChild(rm);
        grid.appendChild(tr);
      });
    };
    const addRow = () => { expr.table.rows.push(['', '']); commit(); buildGrid(); };
    buildGrid();

    const ctrls = document.createElement('div'); ctrls.className = 'dt-ctrls';
    const addBtn = document.createElement('button'); addBtn.className = 'dt-add'; addBtn.textContent = T2('ui.addRow', '+ рядок');
    addBtn.addEventListener('click', () => { addRow(); const rows = grid.querySelectorAll('.dt-row'); const last = rows[rows.length - 1]; last && last.querySelector('.dt-c').focus(); });
    ctrls.appendChild(addBtn);

    const seg = document.createElement('div'); seg.className = 'dt-seg';
    const styles = [[T2('ui.stylePoints', 'точки'), { points: true, line: false }], [T2('ui.styleLine', 'лінія'), { points: false, line: true }], [T2('ui.styleBoth', 'обидва'), { points: true, line: true }]];
    const syncSeg = () => {
      const st = expr.tableStyle || { points: true, line: false };
      [...seg.children].forEach((b, i) => b.classList.toggle('on', styles[i][1].points === !!st.points && styles[i][1].line === !!st.line));
    };
    styles.forEach(([lab, st]) => {
      const b = document.createElement('button'); b.textContent = lab;
      b.addEventListener('click', () => { calc.updateTable(expr.id, null, st); expr.tableStyle = Object.assign({}, expr.tableStyle, st); syncSeg(); });
      seg.appendChild(b);
    });
    syncSeg();
    ctrls.appendChild(seg);
    body.appendChild(ctrls);

    // regression control
    const regRow = document.createElement('div'); regRow.className = 'dt-reg';
    const regLab = document.createElement('span'); regLab.className = 'dt-reg-lab'; regLab.textContent = T2('ui.regressionLabel', 'регресія');
    const regSel = document.createElement('select'); regSel.className = 'dt-reg-sel';
    [['none', T2('regression.none', 'немає')], ['linear', T2('regression.linear', 'лінійна')], ['quadratic', T2('regression.quadratic', 'квадратична')], ['cubic', T2('regression.cubic', 'кубічна')], ['exponential', T2('regression.exponential', 'експонента')], ['logarithmic', T2('regression.logarithmic', 'логарифм')], ['power', T2('regression.power', 'степенева')]]
      .forEach(([v, lab]) => { const o = document.createElement('option'); o.value = v; o.textContent = lab; regSel.appendChild(o); });
    regSel.value = expr.regression || 'none';
    regSel.addEventListener('change', () => { calc.setRegression(expr.id, regSel.value); refreshReg(); });
    regRow.appendChild(regLab); regRow.appendChild(regSel);
    body.appendChild(regRow);
    const eqBox = document.createElement('div'); eqBox.className = 'dt-eq';
    body.appendChild(eqBox);
    const refreshReg = () => {
      if (!expr.regression) { eqBox.style.display = 'none'; eqBox.innerHTML = ''; return; }
      if (expr.regFit) {
        const r2 = Number.isFinite(expr.regFit.r2) ? expr.regFit.r2.toFixed(4) : '—';
        eqBox.innerHTML = `<span class="dt-eq-f">${expr.regFit.label}</span><span class="dt-eq-r">R² = ${r2}</span>`;
        eqBox.style.display = 'flex';
      } else {
        eqBox.innerHTML = '<span class="dt-eq-err">' + T2('ui.regNotEnough', 'недостатньо даних або модель не підходить') + '</span>';
        eqBox.style.display = 'flex';
      }
    };
    refreshReg();

    const del = document.createElement('button');
    del.className = 'row-del'; del.textContent = '×'; del.title = T2('ui.deleteTable', 'Видалити таблицю');
    del.addEventListener('click', () => { calc.removeExpression(expr.id); renderRows(); });

    li.appendChild(idx); li.appendChild(body); li.appendChild(del);
    li._refresh = () => { refreshDot(); };
    li._tick = () => {};
    return li;
  }

  function onKey(e, expr, input) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const exprs = calc.expressions;
      if (exprs[exprs.length - 1].id === expr.id) {
        const n = calc.addExpression(''); renderRows();
        focusRow(n.id);
      } else {
        const i = exprs.findIndex((x) => x.id === expr.id);
        focusRow(exprs[i + 1].id);
      }
    }
    if (e.key === 'Backspace' && input.value === '' && calc.expressions.length > 1) {
      e.preventDefault();
      const i = calc.expressions.findIndex((x) => x.id === expr.id);
      calc.removeExpression(expr.id); renderRows();
      const t = calc.expressions[Math.max(0, i - 1)];
      t && focusRow(t.id);
    }
  }
  function focusRow(id) {
    const li = list.querySelector(`[data-id="${id}"]`);
    if (!li) return;
    if (li._mq) { li._mq.focus(); return; }
    li.classList.add('editing');
    const el = li.querySelector('.row-input');
    el && el.focus();
  }

  function buildSlider(row, expr, name) {
    row.style.display = 'flex'; row.innerHTML = ''; row.dataset.built = name;
    const play = document.createElement('button'); play.className = 'play';
    const refreshPlay = () => { play.textContent = expr.animating ? '❚❚' : '▶'; play.classList.toggle('on', !!expr.animating); play.title = expr.animating ? T2('ui.stop', 'Стоп') : T2('ui.animate', 'Анімувати'); };
    refreshPlay();
    expr._playRefresh = refreshPlay;
    play.addEventListener('click', () => { calc.setParamAnimating(expr.id, !expr.animating); refreshPlay(); });

    const nm = document.createElement('span'); nm.className = 'pname'; nm.textContent = name + ' =';
    const rng = document.createElement('input'); rng.type = 'range'; rng.className = 'rng';
    const setR = () => { rng.min = expr.paramRange.min; rng.max = expr.paramRange.max; rng.step = expr.paramRange.step; rng.value = calc.params[name] ?? 1; };
    setR();
    const val = document.createElement('span'); val.className = 'pval';
    const fmt = (n) => Number.isFinite(n) ? (Math.round(n * 100) / 100).toString() : '?';
    val.textContent = fmt(parseFloat(rng.value));
    rng.addEventListener('input', () => {
      const v = parseFloat(rng.value); val.textContent = fmt(v); calc.setParamValue(name, v);
      if (expr.animating) { calc.setParamAnimating(expr.id, false); refreshPlay(); }
    });
    expr._sliderRefresh = () => { rng.value = calc.params[name] ?? 0; val.textContent = fmt(parseFloat(rng.value)); };

    const bounds = document.createElement('span'); bounds.className = 'bounds';
    const mn = document.createElement('input'); mn.type = 'text'; mn.value = expr.paramRange.min;
    const mx = document.createElement('input'); mx.type = 'text'; mx.value = expr.paramRange.max;
    mn.addEventListener('change', () => { const n = parseFloat(mn.value); if (Number.isFinite(n)) { expr.paramRange.min = n; setR(); } });
    mx.addEventListener('change', () => { const n = parseFloat(mx.value); if (Number.isFinite(n)) { expr.paramRange.max = n; setR(); } });
    const dash = document.createElement('span'); dash.textContent = '…'; dash.style.color = 'var(--ink-3)';
    bounds.appendChild(mn); bounds.appendChild(dash); bounds.appendChild(mx);

    row.appendChild(play); row.appendChild(nm); row.appendChild(rng); row.appendChild(val); row.appendChild(bounds);
  }

  // №10: контроли дії — виконати раз (▶) або тікер (⟳ періодично)
  function buildAction(row, expr) {
    row.style.display = 'flex'; row.innerHTML = ''; row.dataset.built = '#act';
    const play = document.createElement('button'); play.className = 'play';
    play.textContent = '▶'; play.title = T2('ui.runAction', 'Виконати дію');
    const loop = document.createElement('button'); loop.className = 'play';
    loop.textContent = '⟳'; loop.title = T2('ui.ticker', 'Тікер: виконувати безперервно');
    const speed = document.createElement('input');
    speed.type = 'range'; speed.min = '1'; speed.max = '60'; speed.step = '1'; speed.value = '20';
    speed.title = T2('ui.stepsPerSecond', 'Кроків за секунду');
    speed.style.flex = '1';
    const lbl = document.createElement('span'); lbl.className = 'trange-lbl';
    lbl.textContent = '20' + T2('ui.perSecond', '/с');
    play.addEventListener('click', () => { calc.runAction(expr.id); snapshot(); });
    let timer = null;
    const stopT = () => { if (timer) { clearInterval(timer); timer = null; loop.classList.remove('running'); loop.textContent = '⟳'; } };
    loop.addEventListener('click', () => {
      if (timer) { stopT(); snapshot(); return; }
      loop.classList.add('running'); loop.textContent = '⏸';
      const start = () => {
        timer = setInterval(() => {
          if (!calc.expressions.some((x) => x.id === expr.id)) { stopT(); return; }
          calc.runAction(expr.id);
        }, 1000 / (+speed.value || 20));
      };
      start();
      speed.addEventListener('input', () => { if (timer) { clearInterval(timer); timer = null; start(); } });
    });
    speed.addEventListener('input', () => { lbl.textContent = speed.value + T2('ui.perSecond', '/с'); });
    row.appendChild(play); row.appendChild(loop); row.appendChild(speed); row.appendChild(lbl);
  }

  // t-range control for parametric curves
  function buildTRange(row, expr) {
    row.style.display = 'flex'; row.innerHTML = ''; row.dataset.built = '#t';
    expr.tRange = expr.tRange || { min: 0, max: Math.round(Math.PI * 2 * 1000) / 1000 };
    const GC = window.GraphCalc;
    const evalNum = (s) => { try { return GC.evalAst(GC.parse(String(s)), {}); } catch (_) { return NaN; } };
    const nm = document.createElement('span'); nm.className = 'pname'; nm.innerHTML = '<i>t</i> \u2208';
    const wrap = document.createElement('span'); wrap.className = 'trange';
    const lb = document.createElement('span'); lb.textContent = '[';
    const rb = document.createElement('span'); rb.textContent = ']';
    const mn = document.createElement('input'); mn.type = 'text'; mn.value = expr.tRange.min;
    const mx = document.createElement('input'); mx.type = 'text'; mx.value = (Math.abs(expr.tRange.max - Math.PI * 2) < 1e-6) ? '2pi' : expr.tRange.max;
    const comma = document.createElement('span'); comma.textContent = ',';
    mn.addEventListener('change', () => { const n = evalNum(mn.value); if (Number.isFinite(n)) calc.setTRange(expr.id, n, undefined); });
    mx.addEventListener('change', () => { const n = evalNum(mx.value); if (Number.isFinite(n)) calc.setTRange(expr.id, undefined, n); });
    wrap.appendChild(lb); wrap.appendChild(mn); wrap.appendChild(comma); wrap.appendChild(mx); wrap.appendChild(rb);
    row.appendChild(nm); row.appendChild(wrap);
  }

  // ---------- popovers ----------
  function colorPopover(anchor, current, onPick) {
    document.querySelector('.cpop')?.remove();
    const pop = document.createElement('div'); pop.className = 'cpop';
    COLORS.forEach((c) => {
      const b = document.createElement('button'); b.style.background = c;
      if (c === current) b.style.boxShadow = '0 0 0 2px ' + c;
      b.addEventListener('click', () => { onPick(c); pop.remove(); });
      pop.appendChild(b);
    });
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.left = (r.right + 6) + 'px'; pop.style.top = r.top + 'px';
    setTimeout(() => {
      const close = (e) => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('mousedown', close); } };
      document.addEventListener('mousedown', close);
    }, 0);
  }

  // ---------- engine change hook ----------
  calc.onChange = (event = {}) => { // M-05 / A-04: reason-aware unified callback
    const reason = event.reason || 'unknown';
    const aligned = list.children.length === calc.expressions.length &&
      Array.from(list.children).every((li, i) => +li.dataset.id === calc.expressions[i].id);
    if (!aligned) { renderRows(); } else {
      // A-04: animate ticks only need _tick (slider value); full _refresh on structural changes
      const isAnimate = reason === 'animate';
      Array.from(list.children).forEach((li) => {
        if (!isAnimate && li._refresh) li._refresh();
        li._tick && li._tick();
      });
    }
    // A-04: skip snapshotting ephemeral animate ticks — only user-committed changes
    if (reason !== 'animate') { clearTimeout(_snapT); _snapT = setTimeout(snapshot, 350); }
  };

  // ---------- toolbar ----------
  $('#addExpr').addEventListener('click', () => { const e = calc.addExpression(''); renderRows(); focusRow(e.id); });
  $('#addTable').addEventListener('click', () => { calc.addTable(); renderRows(); });

  // undo/redo (expression-source level)
  const history = []; let hIdx = -1; let suppress = false; let _snapT; // L-02: was window._snapT
  function stateJSON() {
    return JSON.stringify({
      format: 'graphmash-2d',
      version: 2,
      viewport: { ...calc.viewport },
      expressions: calc.expressions.map((e) => e.isTable
        ? { isTable: true, table: JSON.parse(JSON.stringify(e.table)),
            tableStyle: { ...(e.tableStyle || {}) }, regression: e.regression || null,
            color: e.color, hidden: !!e.hidden }
        : { src: e.src, color: e.color, hidden: !!e.hidden,
            tRange: e.tRange || null, fractalPalette: e._fractalPalette || null }),
      params: { ...calc.params },
      angleMode: window.GraphCalc.getAngleMode(),
      axisNames: calc.axisNames || null,
      images: (calc.images || []).map((r) => ({ dataURL: r.dataURL, cx: r.cx, cy: r.cy, w: r.w, h: r.h, opacity: r.opacity })),
    });
  }
  function snapshot() {
    if (suppress) return;
    const snap = stateJSON();
    if (history[hIdx] === snap) return;
    history.splice(hIdx + 1); history.push(snap); hIdx = history.length - 1;
    updateUndo();
    g2dSaveSoon();
  }
  function restore(snap) {
    const data = JSON.parse(snap);
    suppress = true;
    try {
    calc.batch(() => { // A-03: single reclassify after all adds
      [...calc.expressions].forEach((e) => calc.removeExpression(e.id));
      // back-compat: v1 used 'items', v2 uses 'expressions'
      const items = data.expressions || data.items || (data.src || []).map((s) => ({ src: s }));
      items.forEach((it) => {
        if (it.isTable) {
          const t = calc.addTable(JSON.parse(JSON.stringify(it.table)));
          t.tableStyle = it.tableStyle || { points: true, line: false };
          if (it.color) calc.setColor(t.id, it.color);
          if (it.hidden) calc.setHidden(t.id, true);
          if (it.regression) calc.setRegression(t.id, it.regression);
        } else {
          const e = calc.addExpression(it.src || '');
          if (it.color) calc.setColor(e.id, it.color);
          if (it.hidden) calc.setHidden(e.id, true);
          if (it.tRange) calc.setTRange(e.id, it.tRange.min, it.tRange.max);
          if (it.fractalPalette) e._fractalPalette = it.fractalPalette;
        }
      });
      if (data.viewport) calc.viewport = { ...data.viewport };
    });
    if (data.angleMode) { window.GraphCalc.setAngleMode(data.angleMode); try { typeof syncAngleUI === 'function' && syncAngleUI(); } catch (_) {} }
    if (data.axisNames) calc.setAxisNames(data.axisNames.x, data.axisNames.y);
    calc.images = [];
    (data.images || []).forEach((r) => calc.addImage(r.dataURL, r));
    } finally {
      suppress = false;
    }
    renderRows(); calc._scheduleRender();
  }
  function updateUndo() { $('#undoBtn').disabled = hIdx <= 0; $('#redoBtn').disabled = hIdx >= history.length - 1; }
  $('#undoBtn').addEventListener('click', () => { if (hIdx > 0) { hIdx--; restore(history[hIdx]); updateUndo(); } });
  $('#redoBtn').addEventListener('click', () => { if (hIdx < history.length - 1) { hIdx++; restore(history[hIdx]); updateUndo(); } });
  // M-05: snapshot debounce merged into calc.onChange above; _origChange chaining removed

  // ── §4.6: host-API — симетрія з MashGeoApp/MashG3dApp ─────────────────
  const G2D_OPTS = window.__mashG2dOpts || {};
  const G2D_STORE_LOCAL = G2D_OPTS.storage !== 'none';
  let _g2dSaveT = null;
  function g2dSaveSoon() {
    clearTimeout(_g2dSaveT);
    _g2dSaveT = setTimeout(() => {
      if (G2D_STORE_LOCAL) { try { localStorage.setItem('mash:g2d:state', stateJSON()); } catch (_) {} }
      if (typeof G2D_OPTS.onChange === 'function') { try { G2D_OPTS.onChange(JSON.parse(stateJSON())); } catch (_) {} }
    }, 400);
  }
  const _g2dUnload = () => { if (G2D_STORE_LOCAL) { try { localStorage.setItem('mash:g2d:state', stateJSON()); } catch (_) {} } };
  window.addEventListener('beforeunload', _g2dUnload);
  window.MashG2dApp = {
    serialize:  () => JSON.parse(stateJSON()),
    loadScene:  (scene) => { restore(typeof scene === 'string' ? scene : JSON.stringify(scene)); snapshot(); },
    destroy:    () => { clearTimeout(_g2dSaveT); window.removeEventListener('beforeunload', _g2dUnload); delete window.MashG2dApp; },
  };

  // home / zoom-fit already handled by engine's .gc-zoom

  // ---------- presets ----------
  const PRESETS = [
    { label: T2('presets.parabola', 'Парабола'), items: ['y=a x^2', 'a=1'] },
    { label: T2('presets.circle', 'Коло'), items: ['x^2 + y^2 = r^2', 'r=5'] },
    { label: T2('presets.sine', 'Синус'), items: ['y=A sin(b x)', 'A=2', 'b=1'] },
    { label: T2('presets.heart', 'Серце'), items: ['(x^2 + y^2 - 1)^3 = x^2 y^3'] },
    { label: T2('presets.ellipse', 'Еліпс'), items: ['x^2/9 + y^2/4 = 1'] },
    { label: T2('presets.lemniscate', 'Лемніската'), items: ['(x^2 + y^2)^2 = 4(x^2 - y^2)'] },
    { label: T2('presets.rose', 'Роза r(θ)'), items: ['r = 4 cos(3 θ)'] },
  ];
  const pbar = $('#presets');
  PRESETS.forEach((p) => {
    const b = document.createElement('button'); b.className = 'pchip'; b.textContent = p.label;
    b.addEventListener('click', () => loadSet(p.items));
    pbar.appendChild(b);
  });
  function loadSet(items) {
    suppress = true;
    [...calc.expressions].forEach((e) => calc.removeExpression(e.id));
    calc.params = {};
    items.forEach((s) => calc.addExpression(s));
    suppress = false;
    calc.viewport = { cx: 0, cy: 0, scale: 38 };
    renderRows(); calc._scheduleRender(); snapshot();
  }
  function loadTableExample(ex) {
    suppress = true;
    [...calc.expressions].forEach((e) => calc.removeExpression(e.id));
    calc.params = {};
    const t = calc.addTable({ head: ex.head || ['x', 'y'], rows: ex.tableData.map((r) => [String(r[0]), String(r[1])]) });
    if (ex.tableStyle) calc.updateTable(t.id, null, ex.tableStyle);
    if (ex.regression) calc.setRegression(t.id, ex.regression);
    if (ex.set) ex.set.forEach((s) => calc.addExpression(s));
    suppress = false;
    calc.viewport = { cx: 0, cy: 0, scale: 38 };
    renderRows(); calc._scheduleRender(); snapshot();
  }

  // ---------- №8: екранна мат-клавіатура (докова, працює з MathQuill і текстом) ----------
  let _kbEl = null, _kbTab = 'main';
  function kbTarget() {
    const ae = document.activeElement;
    if (ae && ae.classList && ae.classList.contains('row-input')) return { input: ae };
    const li0 = ae && ae.closest ? ae.closest('.row') : null;
    if (li0 && li0._mq) return { mq: li0._mq };
    // фолбек: останній рядок з MQ
    const rows = [...list.querySelectorAll('.row')].reverse();
    for (const li of rows) if (li._mq) { li._mq.focus(); return { mq: li._mq }; }
    const inp = list.querySelector('.row-input');
    if (inp) { inp.closest('.row')?.classList.add('editing'); inp.focus(); return { input: inp }; }
    return null;
  }
  function kbPress(key) {
    const t = kbTarget();
    if (!t) return;
    if (t.mq) {
      const mq = t.mq;
      if (key.ks) mq.keystroke(key.ks);
      else if (key.cmd) mq.cmd(key.cmd);
      else if (key.mq !== undefined) mq.typedText(key.mq);
      else mq.typedText(key.t || key.l);
      if (key.after) mq.keystroke(key.after);
      mq.focus();
    } else if (t.input) {
      if (key.ks === 'Backspace') { document.execCommand && document.execCommand('delete'); }
      else if (key.ks) return;
      else document.execCommand && document.execCommand('insertText', false, key.t !== undefined ? key.t : (key.mq !== undefined ? key.mq : key.l));
      t.input.dispatchEvent(new Event('input'));
      t.input.focus();
    }
  }
  const KB_MAIN = [
    [{l:'x'},{l:'y'},{l:'a²',mq:'^2',after:'Right',t:'^2'},{l:'aᵇ',mq:'^',t:'^'},{l:'√',cmd:'\\sqrt',t:'sqrt('},{l:'('},{l:')'},{l:'7'},{l:'8'},{l:'9'}],
    [{l:'π',cmd:'\\pi',t:'pi'},{l:'θ',cmd:'\\theta',t:'theta'},{l:'a/b',cmd:'\\frac',t:'/'},{l:'=',mq:'='},{l:'~'},{l:'|a|',cmd:'|',t:'abs('},{l:',',t:', '},{l:'4'},{l:'5'},{l:'6'}],
    [{l:'<'},{l:'>'},{l:'≤',mq:'<=',t:'<='},{l:'≥',mq:'>=',t:'>='},{l:'['},{l:']'},{l:'!',t:'!'},{l:'1'},{l:'2'},{l:'3'}],
    [{l:'←',ks:'Left'},{l:'→',ks:'Right'},{l:'ƒ',t:'f(x) = '},{l:'+'},{l:'−',mq:'-',t:'-'},{l:'×',mq:'*',t:'*'},{l:'÷',mq:'/',t:'/'},{l:'0'},{l:'.'},{l:'⌫',ks:'Backspace',cls:'kb-del'}],
  ];
  const KB_FN = [
    [{l:'sin',t:'sin('},{l:'cos',t:'cos('},{l:'tan',t:'tan('},{l:'ln',t:'ln('},{l:'log',t:'log('},{l:'exp',t:'exp('},{l:'∛',t:'cbrt('},{l:'mod',t:'mod('}],
    [{l:'asin',t:'asin('},{l:'acos',t:'acos('},{l:'atan',t:'atan('},{l:'sinh',t:'sinh('},{l:'cosh',t:'cosh('},{l:'tanh',t:'tanh('},{l:'floor',t:'floor('},{l:'ceil',t:'ceil('}],
    [{l:'Σ',t:'sum(n, 1, 10, '},{l:'∏',t:'product(n, 1, 5, '},{l:'∫',t:'integral(f, t, 0, x)'},{l:"f'",t:"f'("},{l:'mean',t:'mean('},{l:'stdev',t:'stdev('},{l:'random',t:'random('},{l:'hist',t:'histogram('}],
    [{l:'i',t:'i'},{l:'dc',t:'domaincolor(z^2)'},{l:T2('ui.kbCircle','коло'),t:'x^2 + y^2 = 25'},{l:'r(θ)',t:'r = cos(3 theta)'},{l:T2('ui.kbCond','{умова'),t:'{x < 0: -x, x}'},{l:T2('ui.kbAction','дія'),t:'n -> n + 1'},{l:'⌫',ks:'Backspace',cls:'kb-del'}],
  ];
  function renderKb() {
    const grid = _kbEl.querySelector('.kb-grid');
    grid.innerHTML = '';
    (( _kbTab === 'main') ? KB_MAIN : KB_FN).forEach((row) => {
      const rEl = document.createElement('div'); rEl.className = 'kb-row';
      row.forEach((key) => {
        const b = document.createElement('button');
        b.className = 'kb-key' + (key.cls ? ' ' + key.cls : '');
        b.textContent = key.l;
        b.addEventListener('pointerdown', (e) => e.preventDefault()); // не забирати фокус
        b.addEventListener('click', () => kbPress(key));
        rEl.appendChild(b);
      });
      grid.appendChild(rEl);
    });
    _kbEl.querySelectorAll('.kb-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === _kbTab));
  }
  function toggleKeyboard() {
    if (_kbEl) { _kbEl.remove(); _kbEl = null; return; }
    _kbEl = document.createElement('div');
    _kbEl.className = 'mathkb';
    _kbEl.innerHTML = '<div class="kb-tabs">' +
      '<button class="kb-tab active" data-tab="main">123</button>' +
      '<button class="kb-tab" data-tab="fn">ƒ(x)</button>' +
      '<span style="flex:1"></span>' +
      '<button class="kb-tab kb-close">✕</button></div>' +
      '<div class="kb-grid"></div>';
    _kbEl.querySelectorAll('.kb-tab[data-tab]').forEach((t) => {
      t.addEventListener('pointerdown', (e) => e.preventDefault());
      t.addEventListener('click', () => { _kbTab = t.dataset.tab; renderKb(); });
    });
    _kbEl.querySelector('.kb-close').addEventListener('click', () => { _kbEl.remove(); _kbEl = null; });
    document.querySelector('.sidebar, aside').appendChild(_kbEl);
    renderKb();
  }
  $('#keypad').addEventListener('click', toggleKeyboard);
  $('#keypadToggle').addEventListener('click', toggleKeyboard);

  // ---------- examples gallery (flyout) ----------
  const GC = window.GraphCalc;
  const GALLERY = [
    { cat: T2('gallery.cat.funcs', 'Функції y = f(x)'), items: [
      { name: T2('gallery.item.parabola', 'Парабола'), set: ['y = x^2'] },
      { name: T2('gallery.item.cubic', 'Кубічна'), set: ['y = x^3 - 3 x'] },
      { name: T2('gallery.item.sine', 'Синусоїда'), set: ['y = 2 sin(x)'] },
      { name: T2('gallery.item.gauss', 'Дзвін Гауса'), set: ['y = 4 exp(0 - x^2 / 4)'] },
      { name: T2('gallery.item.sqrt', 'Квадратний корінь'), set: ['y = sqrt(x)'] },
      { name: T2('gallery.item.abs', 'Модуль'), set: ['y = abs(x) - 3'] },
      { name: T2('gallery.item.hyperbola1x', 'Гіпербола 1/x'), set: ['y = 6 / x'] },
      { name: T2('gallery.item.log', 'Логарифм'), set: ['y = 2 ln(x)'] },
      { name: T2('gallery.item.logBase', 'Логарифм з основою'), set: ['y = log_2 x'] },
      { name: T2('gallery.item.mod', 'Остача mod'), set: ['y = mod(x, 3)'], r: 5 },
      { name: T2('gallery.item.factorial', 'Факторіал x!'), set: ['y = x!'], r: 4 },
    ]},
    { cat: T2('gallery.cat.sums', 'Суми Σ та добутки Π'), items: [
      { name: T2('gallery.item.fourierSaw', 'Ряд Фур\'є (пилка)'), set: ['y = sum(n, 1, 20, sin(n x) / n)'], r: 7 },
      { name: T2('gallery.item.fourierSquare', 'Ряд Фур\'є (меандр)'), set: ['y = sum(n, 1, 15, sin((2 n - 1) x) / (2 n - 1))'], r: 6 },
      { name: T2('gallery.item.powerSeriesExp', 'Степеневий ряд eˣ'), set: ['y = sum(n, 0, 8, x^n / n!)'], r: 6 },
      { name: T2('gallery.item.triangular', 'Сума 1..x (трикутні)'), set: ['y = sum(i, 1, x, i)'], r: 12 },
      { name: T2('gallery.item.productFactorial', 'Добуток Π → x!'), set: ['y = product(i, 1, x, i)'], r: 8 },
    ]},
    { cat: T2('gallery.cat.sequences', 'Рекурентні послідовності'), items: [
      { name: T2('gallery.item.fibonacci', 'Фібоначчі'), set: ['F(0) = 0', 'F(1) = 1', 'F(n) = F(n-1) + F(n-2)', 'plot(F(n), n, 0, 11)'], seqPlot: true },
      { name: T2('gallery.item.arithmetic', 'Арифметична +3'), set: ['a(0) = 1', 'a(n) = a(n-1) + 3', 'plot(a(n), n, 0, 10)'], seqPlot: true },
      { name: T2('gallery.item.geometric', 'Геометрична ×2'), set: ['g(0) = 1', 'g(n) = 2 g(n-1)', 'plot(g(n), n, 0, 8)'], seqPlot: true },
      { name: T2('gallery.item.factorialRec', 'Факторіал (рекурсія)'), set: ['p(0) = 1', 'p(n) = n p(n-1)', 'plot(p(n), n, 0, 6)'], seqPlot: true },
      { name: T2('gallery.item.cubes', 'Куби n³'), set: ['c(0) = 0', 'c(n) = c(n-1) + 3 n^2 - 3 n + 1', 'plot(c(n), n, 0, 8)'], seqPlot: true },
      { name: T2('gallery.item.mersenne', 'Мерсенна 2ⁿ−1'), set: ['M(0) = 0', 'M(n) = 2 M(n-1) + 1', 'plot(M(n), n, 0, 8)'], seqPlot: true },
    ]},
    { cat: T2('gallery.cat.listsCalculus', 'Списки · похідні · інтеграли'), items: [
      { name: T2('gallery.item.sineFamily', 'Сімейство синусоїд'), set: ['y = sin(x [1, 2, 3])'], r: 7 },
      { name: T2('gallery.item.parabolaFamily', 'Сімейство парабол'), set: ['y = [0.5, 1, 2] x^2'], r: 6 },
      { name: T2('gallery.item.shiftedCopies', 'Зсунуті копії'), set: ['y = sin(x) + [0, 2, 4]'], r: 8 },
      { name: T2('gallery.item.pointFamily', 'Сімейство точок'), set: ['([1, 2, 3, 4], [1, 4, 9, 16])'], r: 18 },
      { name: T2('gallery.item.derivative', "Похідна f'(x)"), set: ['f(x) = x^3 - 3 x', "y = f'(x)"], r: 6 },
      { name: T2('gallery.item.derivativesTogether', "f, f' і f'' разом"), set: ['f(x) = sin(x)', 'y = f(x)', "y = f'(x)", "y = f''(x)"], r: 7 },
      { name: T2('gallery.item.tangentAt', 'Дотична в точці a'), set: ['f(x) = x^2 / 2', 'a = 1', "y = f(a) + f'(a) (x - a)", 'y = f(x)'], badge: '▶ a', r: 6 },
      { name: T2('gallery.item.integralAccum', 'Інтеграл-накопичення'), set: ['y = integral(sin(t), t, 0, x)'], r: 8 },
      { name: T2('gallery.item.areaUnderCurve', 'Площа під кривою'), set: ['f(x) = 4 - x^2', 'y = f(x)', 'S = integral(f(t), t, 0 - 2, 2)'], r: 6 },
      { name: T2('gallery.item.erfLike', 'Ерф-подібна крива'), set: ['y = integral(exp(0 - t^2), t, 0, x)'], r: 4 },
      { name: T2('gallery.item.regLinear', 'Регресія y ~ a·x + b'), tableData: [[1,2.1],[2,3.9],[3,6.2],[4,7.8],[5,10.1]], set: ['y ~ a x + b'], badge: '~' },
      { name: T2('gallery.item.regSine', 'Регресія y ~ a·sin(b·x)'), tableData: [[0,0],[0.5,1.4],[1,2.5],[1.5,2.9],[2,2.6],[2.5,1.7],[3,0.3],[3.5,-1.2],[4,-2.4]], set: ['y ~ a sin(b x)'], badge: '~' },
      { name: T2('gallery.item.regExp', 'Регресія-експонента'), tableData: [[0,1.1],[1,2.6],[2,7.5],[3,19.8],[4,55]], set: ['y ~ a exp(b x)'], badge: '~' },
      { name: T2('gallery.item.labeledPoints', 'Підписані точки'), set: ['y = x^2 - 2', '(0, -2) "' + T2('gallery.lbl.vertex', 'Вершина') + '"', '(1.41, 0) "' + T2('gallery.lbl.root', 'Корінь') + '"'], r: 5 },
    ]},
    { cat: T2('gallery.cat.stats', 'Статистика'), items: [
      { name: T2('gallery.item.histRandom', 'Гістограма випадкових'), set: ['d = random(200, 0, 10)', 'histogram(d)'], r: 12 },
      { name: T2('gallery.item.histBin', 'Гістограма + крок кошика'), set: ['d = random(300, -5, 5)', 'histogram(d, 1)'], r: 8 },
      { name: 'Boxplot', set: ['d = [2, 3, 3.5, 4, 4.2, 5, 5.5, 6, 9.5]', 'boxplot(d, 1)'], r: 7 },
      { name: T2('gallery.item.normalDist', 'Нормальний розподіл'), set: ['y = normalpdf(x, 0, 1)', 'y = normalpdf(x, 0, 2)'], r: 5 },
      { name: T2('gallery.item.meanMedian', 'Середнє та медіана'), set: ['d = [1, 2, 2, 3, 3, 3, 4, 4, 10]', 'histogram(d, 1)', 'x = mean(d)', 'x = median(d)'], r: 7 },
    ]},
    { cat: T2('gallery.cat.simulations', 'Симуляції (дії)'), items: [
      { name: T2('gallery.item.bouncingBall', 'М\'ячик стрибає'), set: ['h = 8', 'v = 0', '(0, h) "⚽"', 'h -> {h + v/10 < 0: 0, h + v/10}, v -> {h + v/10 < 0: -0.82 v, v - 0.5}'], r: 9,
        hint: T2('gallery.hint.ticker', 'Натисніть ⟳ біля дії') },
      { name: T2('gallery.item.randomWalk', 'Випадкове блукання'), set: ['a = 0', 'b = 0', '(a, b)', 'a -> a + random() - 0.5, b -> b + random() - 0.5'], r: 5 },
      { name: T2('gallery.item.counter', 'Лічильник'), set: ['n = 0', '(n, 0) "n"', 'n -> n + 1'], r: 10 },
    ]},
    { cat: T2('gallery.cat.complex', 'Комплексні числа'), items: [
      { name: T2('gallery.item.complexPoints', 'Комплексні точки'), set: ['2 + 3i', '(1 + i)^2', 'exp(i pi / 4)'], r: 5 },
      { name: T2('gallery.item.rootsOfUnity', 'Корені з одиниці (5)'), set: ['exp(2 i pi / 5)', 'exp(4 i pi / 5)', 'exp(6 i pi / 5)', 'exp(8 i pi / 5)', '1 + 0 i'], r: 2 },
      { name: 'f(z) = z²', set: ['domaincolor(z^2)'], r: 3 },
      { name: T2('gallery.item.pole', 'f(z) = 1/z (полюс)'), set: ['domaincolor(1 / z)'], r: 3 },
      { name: T2('gallery.item.zerosPoles', 'Нулі та полюси'), set: ['domaincolor((z^2 - 1) / (z^2 + 1))'], r: 3 },
      { name: T2('gallery.item.essentialSingularity', 'Суттєва особливість'), set: ['domaincolor(exp(1 / z))'], r: 1.6 },
      { name: T2('gallery.item.sinZ', 'sin(z) на площині'), set: ['domaincolor(sin(z))'], r: 6 },
      { name: T2('gallery.item.polyRoots', 'Поліном з коренями'), set: ['domaincolor((z - 1) (z + 1) (z - i) (z + i))'], r: 2.5 },
    ]},
    { cat: T2('gallery.cat.fractals', 'Фрактали'), items: [
      { name: T2('gallery.item.mandelbrot', 'Мандельброт'), set: ['mandelbrot()'], fractal: true, fractalType: 'mandelbrot' },
      { name: T2('gallery.item.julia', 'Юлія') + ' (−0.8, 0.156)', set: ['julia(-0.8, 0.156)'], fractal: true, fractalType: 'julia', juliaC: [-0.8, 0.156] },
      { name: T2('gallery.item.julia', 'Юлія') + ' (−0.4, 0.6)', set: ['julia(-0.4, 0.6)'], fractal: true, fractalType: 'julia', juliaC: [-0.4, 0.6] },
      { name: T2('gallery.item.julia', 'Юлія') + ' (0.285, 0.01)', set: ['julia(0.285, 0.01)'], fractal: true, fractalType: 'julia', juliaC: [0.285, 0.01] },
      { name: T2('gallery.item.julia', 'Юлія') + ' (−0.74, 0.18)', set: ['julia(-0.74, 0.18)'], fractal: true, fractalType: 'julia', juliaC: [-0.74, 0.18] },
      { name: T2('gallery.item.julia', 'Юлія') + ' (0, 0.8)', set: ['julia(0, 0.8)'], fractal: true, fractalType: 'julia', juliaC: [0, 0.8] },
      { name: 'Burning Ship', set: ['burningship()'], fractal: true, fractalType: 'burningship' },
      { name: 'Tricorn', set: ['tricorn()'], fractal: true, fractalType: 'tricorn' },
      { name: 'Multibrot(3)', set: ['multibrot(3)'], fractal: true, fractalType: 'multibrot', fractalPower: 3 },
      { name: 'Multibrot(4)', set: ['multibrot(4)'], fractal: true, fractalType: 'multibrot', fractalPower: 4 },
    ]},
    { cat: T2('gallery.cat.lsystems', 'L-системи · фрактальні криві'), items: [
      { name: T2('gallery.item.koch', 'Крива Коха'), set: ['koch(4)'], lsystem: true, lsystemData: {axiom:'F', rules:'F->F+F--F+F', iters:3, angle:60, color:COLORS[1]} },
      { name: T2('gallery.item.dragon', 'Дракон Гайвея'), set: ['dragon(12)'], lsystem: true, lsystemData: {axiom:'FX', rules:'X->X+YF+;Y->-FX-Y', iters:9, angle:90, color:COLORS[0]} },
      { name: T2('gallery.item.sierpinski', 'Серпінський'), set: ['sierpinski(5)'], lsystem: true, lsystemData: {axiom:'F-G-G', rules:'F->F-G+F+G-F;G->GG', iters:4, angle:120, color:COLORS[2]} },
      { name: T2('gallery.item.hilbert', 'Крива Гільберта'), set: ['hilbert(5)'], lsystem: true, lsystemData: {axiom:'A', rules:'A->-BF+AFA+FB-;B->+AF-BFB-FA+', iters:4, angle:90, color:COLORS[3]} },
      { name: T2('gallery.item.plant', 'Рослина'), set: ['plant(5)'], lsystem: true, lsystemData: {axiom:'X', rules:'X->F+[[X]-X]-F[-FX]+X;F->FF', iters:3, angle:25, startAngle:90, color:COLORS[2]} },
      { name: T2('gallery.item.kochSnowflake', 'Сніжинка Коха'), set: ['lsystem("F--F--F", "F->F+F--F+F", 4, 60)'], lsystem: true, lsystemData: {axiom:'F--F--F', rules:'F->F+F--F+F', iters:3, angle:60, color:COLORS[4]} },
    ]},
    { cat: T2('gallery.cat.curves', 'Криві та рівняння'), items: [
      { name: T2('gallery.item.circle', 'Коло'), set: ['x^2 + y^2 = 25'] },
      { name: T2('gallery.item.ellipse', 'Еліпс'), set: ['x^2 / 9 + y^2 / 4 = 1'] },
      { name: T2('gallery.item.hyperbola', 'Гіпербола'), set: ['x^2 / 4 - y^2 / 4 = 1'] },
      { name: T2('gallery.item.heart', 'Серце'), set: ['(x^2 + y^2 - 1)^3 = x^2 y^3'], r: 1.7 },
      { name: T2('gallery.item.lemniscate', 'Лемніската'), set: ['(x^2 + y^2)^2 = 4 (x^2 - y^2)'], r: 2.6 },
      { name: T2('gallery.item.superellipse', 'Супереліпс'), set: ['abs(x / 4)^4 + abs(y / 3)^4 = 1'] },
    ]},
    { cat: T2('gallery.cat.sliders', 'З повзунками · анімація'), items: [
      { name: T2('gallery.item.parabolaFamily', 'Сімейство парабол'), set: ['y = a x^2', 'a = 1'], badge: '▶ a' },
      { name: T2('gallery.item.wave', 'Хвиля A·sin(b·x)'), set: ['y = A sin(b x)', 'A = 2', 'b = 1'], badge: '▶ A,b' },
      { name: T2('gallery.item.circleRadius', 'Коло радіуса r'), set: ['x^2 + y^2 = r^2', 'r = 5'], badge: '▶ r' },
      { name: T2('gallery.item.lineKxB', 'Пряма k·x + b'), set: ['y = k x + b', 'k = 1', 'b = 0'], badge: '▶ k,b' },
    ]},
    { cat: T2('gallery.cat.inequalities', 'Нерівності · області'), items: [
      { name: T2('gallery.item.underParabola', 'Під параболою'), set: ['y < x^2'] },
      { name: T2('gallery.item.aboveSine', 'Над синусом'), set: ['y >= sin(x)'] },
      { name: T2('gallery.item.disk', 'Круг (диск)'), set: ['x^2 + y^2 <= 9'] },
      { name: T2('gallery.item.aboveAbs', 'Над модулем'), set: ['y > abs(x) - 2'] },
      { name: T2('gallery.item.annulusSystem', 'Кільце (система)'), set: ['x^2 + y^2 <= 16', 'x^2 + y^2 >= 4'] },
      { name: T2('gallery.item.stripBetween', 'Смуга між кривими'), set: ['y < x + 2', 'y > x^2 - 2'] },
    ]},
    { cat: T2('gallery.cat.domains', 'Обмеження області {…}'), items: [
      { name: T2('gallery.item.ray', 'Промінь'), set: ['y = x {x > 0}'] },
      { name: T2('gallery.item.halfParabola', 'Півпарабола'), set: ['y = x^2 {x >= 0}'] },
      { name: T2('gallery.item.sineSegment', 'Відрізок синуса'), set: ['y = 2 sin(x) {-3 < x < 3}'] },
      { name: T2('gallery.item.piecewiseTwo', 'Кускова (дві гілки)'), set: ['y = 0 - x {x < 0}', 'y = x {x >= 0}'] },
      { name: T2('gallery.item.steps', 'Сходинки'), set: ['y = x^2 {x < 0}', 'y = 1 {0 <= x < 2}', 'y = x - 1 {x >= 2}'] },
      { name: T2('gallery.item.circleSector', 'Сектор кола'), set: ['x^2 + y^2 = 9 {y > 0}'] },
    ]},
    { cat: T2('gallery.cat.logic', 'Логіка · and / or / not'), items: [
      { name: T2('gallery.item.firstQuadrant', 'Перша чверть'), set: ['x > 0 and y > 0'] },
      { name: T2('gallery.item.betweenZeroAndParabola', 'Між 0 і параболою'), set: ['y > 0 and y < x^2'] },
      { name: T2('gallery.item.annulusIntersect', 'Кільце (перетин)'), set: ['x^2 + y^2 > 4 and x^2 + y^2 < 16'], r: 5 },
      { name: T2('gallery.item.twoStrips', 'Дві смуги (or)'), set: ['x < -2 or x > 2'] },
      { name: T2('gallery.item.cross', 'Хрест (or)'), set: ['abs(x) < 1 or abs(y) < 1'] },
      { name: T2('gallery.item.outsideCircleUpper', 'Поза колом, не нижче'), set: ['x^2 + y^2 > 4 and y >= 0'], r: 4 },
    ]},
    { cat: T2('gallery.cat.customFuncs', 'Власні функції · кускові'), items: [
      { name: T2('gallery.item.customFunc', 'Власна функція f(x)'), set: ['f(x) = x^2 - 2 x', 'y = f(x)'] },
      { name: T2('gallery.item.composition', 'Композиція f(f(x))'), set: ['f(x) = x^2 - 1', 'y = f(f(x))'] },
      { name: T2('gallery.item.absPiecewise', 'Модуль як кускова'), set: ['y = {x < 0: 0 - x, x >= 0: x}'] },
      { name: T2('gallery.item.signStep', 'Сходинка (sign)'), set: ['y = {x < 0: -1, x >= 0: 1}'] },
      { name: T2('gallery.item.parabolaOrLine', 'Парабола / пряма'), set: ['y = {x < 1: x^2, x >= 1: 2 x - 1}'] },
      { name: T2('gallery.item.factorial', 'Факторіал x!'), set: ['y = x!'], r: 4 },
    ]},
    { cat: T2('gallery.cat.drawings', 'Малюнки з формул'), items: [
      { name: T2('gallery.item.cat', 'Котик'), set: [
        'x^2 + y^2 = 16',
        'y = 3.8x + 17.14 {-3.8<x<-2.8}',
        'y = -1.8x + 1.46 {-2.8<x<-1.3}',
        'y = 1.8x + 1.46 {1.3<x<2.8}',
        'y = -3.8x + 17.14 {2.8<x<3.8}',
        '(x+1.6)^2 + (y-0.8)^2 = 0.36',
        '(x-1.6)^2 + (y-0.8)^2 = 0.36',
        '(x+1.6)^2 + (y-0.8)^2 < 0.12',
        '(x-1.6)^2 + (y-0.8)^2 < 0.12',
        'y = 0 {-0.4<x<0.4}',
        'y = -1.5x - 0.6 {-0.4<x<0}',
        'y = 1.5x - 0.6 {0<x<0.4}',
        'x = 0 {-1.28<y<-0.6}',
        'y = 0.6(x+0.6)^2 - 1.5 {-1.2<x<0}',
        'y = 0.6(x-0.6)^2 - 1.5 {0<x<1.2}',
        'y = 0.18x {-5.5<x<-1.8}',
        'y = -0.55 {-5.5<x<-1.8}',
        'y = -0.18x - 1 {-5.5<x<-1.8}',
        'y = -0.18x {1.8<x<5.5}',
        'y = -0.55 {1.8<x<5.5}',
        'y = 0.18x - 1 {1.8<x<5.5}',
      ], r: 7 },
      { name: T2('gallery.item.house', 'Будиночок'), set: [
        'y = -3 {-3<x<3}',
        'y = 1 {-3<x<3}',
        'x = -3 {-3<y<1}',
        'x = 3 {-3<y<1}',
        'y = 0.714x + 3.5 {-3.5<x<0}',
        'y = -0.714x + 3.5 {0<x<3.5}',
        'y = 1 {-3.5<x<3.5}',
        'x = -1 {-3<y<-0.4}',
        'x = 1 {-3<y<-0.4}',
        'y = -0.4 {-1<x<1}',
        '(x-1.6)^2/0.5 + (y+0.2)^2/0.5 = 1',
      ], r: 5 },
    ]},
    { cat: T2('gallery.cat.polar', 'Полярні криві r(θ)'), items: [
      { name: T2('gallery.item.circle', 'Коло'), set: ['r = 4'], r: 5 },
      { name: T2('gallery.item.cardioid', 'Кардіоїда'), set: ['r = 2 (1 + cos(θ))'], r: 4.6 },
      { name: T2('gallery.item.rose3', 'Роза · 3 пелюстки'), set: ['r = 4 cos(3 θ)'], r: 4.6 },
      { name: T2('gallery.item.rose4', 'Роза · 4 пелюстки'), set: ['r = 4 sin(2 θ)'], r: 4.6 },
      { name: T2('gallery.item.archimedeanSpiral', 'Спіраль Архімеда'), set: ['r = θ'], r: 6.8 },
      { name: T2('gallery.item.limacon', 'Равлик Паскаля'), set: ['r = 1 + 2 cos(θ)'], r: 3.4 },
    ]},
    { cat: T2('gallery.cat.parametric', 'Параметричні криві (t)'), items: [
      { name: T2('gallery.item.circle', 'Коло'), set: ['(cos(t), sin(t))'], r: 1.6 },
      { name: T2('gallery.item.ellipse', 'Еліпс'), set: ['(3 cos(t), 2 sin(t))'], r: 4 },
      { name: T2('gallery.item.spiral', 'Спіраль'), set: ['(t cos(t), t sin(t))'], r: 7 },
      { name: T2('gallery.item.lissajous', 'Фігура Ліссажу'), set: ['(3 sin(3 t), 3 sin(2 t))'], r: 4 },
      { name: T2('gallery.item.cycloid', 'Циклоїда'), set: ['(t - sin(t), 1 - cos(t))'], r: 7 },
      { name: T2('gallery.item.astroid', 'Астроїда'), set: ['(3 cos(t)^3, 3 sin(t)^3)'], r: 4 },
    ]},
    { cat: T2('gallery.cat.tables', 'Таблиці даних · регресія'), items: [
      { name: T2('gallery.item.linearRegression', 'Лінійна регресія'), tableData: [[-4, -3], [-2, -1.2], [0, 0.4], [2, 2.1], [4, 3.6], [6, 5.2]], tableStyle: { points: true, line: false }, regression: 'linear', r: 7 },
      { name: T2('gallery.item.quadratic', 'Квадратична'), tableData: [[-3, 9.5], [-2, 4.2], [-1, 1.1], [0, -0.3], [1, 0.8], [2, 4.1], [3, 9.2]], tableStyle: { points: true, line: false }, regression: 'quadratic', r: 11 },
      { name: T2('gallery.item.cubic', 'Кубічна'), tableData: [[-3, -22], [-2, -5], [-1, 1], [0, 0.5], [1, 2], [2, 9], [3, 28]], tableStyle: { points: true, line: false }, regression: 'cubic', r: 30 },
      { name: T2('gallery.item.exponential', 'Експонента'), tableData: [[0, 2.1], [1, 3.2], [2, 5.6], [3, 9.1], [4, 14.8], [5, 24.5]], tableStyle: { points: true, line: false }, regression: 'exponential', r: 26 },
      { name: T2('gallery.item.log', 'Логарифм'), tableData: [[1, 0.1], [2, 1.5], [3, 2.3], [4, 2.9], [5, 3.3], [6, 3.7]], tableStyle: { points: true, line: false }, regression: 'logarithmic', r: 7 },
      { name: T2('gallery.item.power', 'Степенева'), tableData: [[1, 2.1], [2, 8.3], [3, 18.5], [4, 32.1], [5, 50.4]], tableStyle: { points: true, line: false }, regression: 'power', r: 55 },
      { name: T2('gallery.item.polyline', 'Ламана лінія'), tableData: [[-5, 2], [-3, -1], [-1, 3], [1, 0], [3, 4], [5, 1]], tableStyle: { points: true, line: true }, r: 6 },
    ]},
  ];

  // collect params (name=value) from a set, ignoring x/y deps
  function thumbParams(set) {
    const params = {};
    set.forEach((src) => {
      try {
        const ast = GC.parse(src);
        if (ast.kind === 'eq' && ast.lhs.kind === 'ident') {
          const nm = ast.lhs.name;
          if (nm !== 'x' && nm !== 'y') {
            const fv = GC.freeVars(ast.rhs);
            if (!fv.has('x') && !fv.has('y')) { try { params[nm] = GC.evalAst(ast.rhs, {}); } catch (_) {} }
          }
        }
      } catch (_) {}
    });
    return params;
  }

  function renderFractalThumb(canvas, ex) {
    if (!window.FractalRenderer) return;
    canvas.width = 148; canvas.height = 104;
    let cx = -0.5, cy = 0, scale = 35, fp = 2;
    switch (ex.fractalType) {
      case 'julia':        cx = 0;    cy = 0;     scale = 38; break;
      case 'burningship':  cx = -0.5; cy = -0.4;  scale = 28; break;
      case 'tricorn':      cx = -0.4; cy = 0;     scale = 32; break;
      case 'multibrot':    cx = 0;    cy = 0;     scale = 38; fp = ex.fractalPower || 3; break;
    }
    FractalRenderer.renderToCanvas(canvas, ex.fractalType || 'mandelbrot', cx, cy, scale, ex.juliaC || [0, 0], 'smooth', fp);
  }

  function renderLSystemThumb(canvas, ex) {
    const { axiom, rules: rulesStr, iters, angle: angleDeg, startAngle: startAngleDeg = 0, color = '#2d70b3' } = ex.lsystemData;
    const W = 148, H = 104;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    const angle = angleDeg * Math.PI / 180, th0 = (startAngleDeg || 0) * Math.PI / 180;
    const rules = Object.create(null);
    rulesStr.split(';').forEach((r) => { const a = r.indexOf('->'); if (a >= 0) rules[r.slice(0,a).trim()] = r.slice(a+2).trim(); });
    let str = axiom; const MAX = 200000;
    for (let step = 0; step < iters; step++) {
      let next = '';
      for (let j = 0; j < str.length; j++) { const sub = rules[str[j]]||str[j]; if(next.length+sub.length>MAX){next+=sub.slice(0,MAX-next.length);break;}next+=sub; }
      str = next; if(str.length>=MAX)break;
    }
    if (!str.length) return;
    let tx=0,ty=0,th=th0,minX=0,maxX=0,minY=0,maxY=0; const stk=[];
    for(let j=0;j<str.length;j++){const ch=str[j];
      if(ch==='F'||ch==='G'){tx+=Math.cos(th);ty+=Math.sin(th);if(tx<minX)minX=tx;if(tx>maxX)maxX=tx;if(ty<minY)minY=ty;if(ty>maxY)maxY=ty;}
      else if(ch==='f'){tx+=Math.cos(th);ty+=Math.sin(th);}
      else if(ch==='+'){th+=angle;}else if(ch==='-'){th-=angle;}else if(ch==='|'){th+=Math.PI;}
      else if(ch==='['){stk.push(tx,ty,th);}else if(ch===']'){if(stk.length>=3){th=stk.pop();ty=stk.pop();tx=stk.pop();}}
    }
    minX=Math.min(minX,0);maxX=Math.max(maxX,0);minY=Math.min(minY,0);maxY=Math.max(maxY,0);
    const bw=Math.max(maxX-minX,1e-6),bh=Math.max(maxY-minY,1e-6);
    const pad=6,scl=Math.min((W-2*pad)/bw,(H-2*pad)/bh);
    const ox=W/2-(maxX+minX)/2*scl,oy=H/2+(maxY+minY)/2*scl;
    tx=0;ty=0;th=th0;stk.length=0;let penDown=false;
    ctx.strokeStyle=color;ctx.lineWidth=1;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();
    for(let j=0;j<str.length;j++){const ch=str[j];
      if(ch==='F'||ch==='G'){const nx=tx+Math.cos(th),ny=ty+Math.sin(th);if(!penDown){ctx.moveTo(ox+tx*scl,oy-ty*scl);penDown=true;}ctx.lineTo(ox+nx*scl,oy-ny*scl);tx=nx;ty=ny;}
      else if(ch==='f'){tx+=Math.cos(th);ty+=Math.sin(th);penDown=false;}
      else if(ch==='+'){th+=angle;}else if(ch==='-'){th-=angle;}else if(ch==='|'){th+=Math.PI;}
      else if(ch==='['){stk.push(tx,ty,th);}
      else if(ch===']'){if(stk.length>=3){th=stk.pop();ty=stk.pop();tx=stk.pop();}penDown=false;}
    }
    ctx.stroke();
  }

  function renderThumb(canvas, ex) {
    if (ex.seqPlot) { try { return renderSeqThumb(canvas, ex); } catch (_) {} }
    if (ex.fractal) { try { return renderFractalThumb(canvas, ex); } catch (_) {} return; }
    if (ex.lsystem) { try { return renderLSystemThumb(canvas, ex); } catch (_) {} return; }
    const dpr = 2, W = 148, H = 104;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    const R = ex.r || 6;
    const scale = Math.min(W, H) / (2 * R) * 0.92;
    const cx = W / 2, cy = H / 2;
    const X = (mx) => cx + mx * scale, Y = (my) => cy - my * scale;
    // grid + axes
    ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.lineWidth = 1;
    for (let g = -Math.ceil(R); g <= Math.ceil(R); g++) {
      ctx.beginPath(); ctx.moveTo(X(g), 0); ctx.lineTo(X(g), H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, Y(g)); ctx.lineTo(W, Y(g)); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(0), 0); ctx.lineTo(X(0), H); ctx.stroke();

    if (ex.tableData) {
      const col = COLORS[1];
      const pts = ex.tableData.filter((r) => Number.isFinite(+r[0]) && Number.isFinite(+r[1]));
      if (ex.tableStyle && ex.tableStyle.line) {
        ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.beginPath();
        pts.forEach((p, i) => { const x = X(+p[0]), y = Y(+p[1]); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
        ctx.stroke();
      }
      ctx.fillStyle = col; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4;
      pts.forEach((p) => { ctx.beginPath(); ctx.arc(X(+p[0]), Y(+p[1]), 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
      if (ex.regression) {
        try {
          const fit = GC.fitRegression(ex.regression, pts.map((p) => [+p[0], +p[1]]));
          if (fit) {
            ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.setLineDash([5, 4]); ctx.beginPath();
            let started = false;
            for (let px = 0; px <= W; px += 2) {
              const mx = (px - cx) / scale, my = fit.predict(mx);
              if (!Number.isFinite(my)) { started = false; continue; }
              const py = Y(my);
              if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
            }
            ctx.stroke(); ctx.setLineDash([]);
          }
        } catch (_) {}
      }
      return;
    }

    const params = thumbParams(ex.set);
    const pNames = Object.keys(params);
    const funcs = {};
    ex.set.forEach((src) => { try { const c = GC.classify(src, pNames); if (c && c.kind === 'funcDef') funcs[c.name] = { params: c.params, body: c.ast }; } catch (_) {} });
    let ci = 0;
    const colorAt = () => COLORS[ci++ % COLORS.length];

    ex.set.forEach((src) => {
      let c; try { c = GC.classify(src, pNames); } catch (_) { return; }
      if (!c) return;
      const env = Object.assign({}, params); env.__funcs = funcs;
      if (c.kind === 'param') return;
      if (c.kind === 'explicitY' || c.kind === 'needsParam' && c.target === 'y') {
        const ast = c.ast; const col = colorAt();
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
        let started = false, prevY = null;
        for (let px = 0; px <= W; px += 1.5) {
          const mx = (px - cx) / scale; env.x = mx;
          let my; try { my = GC.evalAst(ast, env); } catch (_) { started = false; continue; }
          if (!Number.isFinite(my)) { started = false; continue; }
          if (c.restrictions && c.restrictions.length && !GC.passRestrict(c.restrictions, env, mx, my)) { started = false; continue; }
          const py = Y(my);
          if (py < -40 || py > H + 40 || (prevY != null && Math.abs(py - prevY) > H)) { started = false; prevY = py; continue; }
          if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
          prevY = py;
        }
        ctx.stroke();
      } else if (c.kind === 'explicitX' || c.kind === 'needsParam' && c.target === 'x') {
        const ast = c.ast; const col = colorAt();
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
        let started = false;
        for (let py = 0; py <= H; py += 1.5) {
          const my = (cy - py) / scale; env.y = my;
          let mx; try { mx = GC.evalAst(ast, env); } catch (_) { started = false; continue; }
          if (!Number.isFinite(mx)) { started = false; continue; }
          if (c.restrictions && c.restrictions.length && !GC.passRestrict(c.restrictions, env, mx, my)) { started = false; continue; }
          const px = X(mx);
          if (!started) { ctx.moveTo(px, py); started = true; } else ctx.lineTo(px, py);
        }
        ctx.stroke();
      } else if (c.kind === 'implicit' || (c.kind === 'needsParam' && c.isEq)) {
        const lhs = c.lhs, rhs = c.rhs; const col = colorAt();
        const step = 3, f = (mx, my) => { env.x = mx; env.y = my; if (c.restrictions && c.restrictions.length && !GC.passRestrict(c.restrictions, env, mx, my)) return NaN; try { return GC.evalAst(lhs, env) - GC.evalAst(rhs, env); } catch (_) { return NaN; } };
        ctx.fillStyle = col;
        for (let px = 0; px < W; px += step) {
          for (let py = 0; py < H; py += step) {
            const x0 = (px - cx) / scale, y0 = (cy - py) / scale;
            const x1 = (px + step - cx) / scale, y1 = (cy - (py + step)) / scale;
            const a = f(x0, y0), b = f(x1, y0), d = f(x0, y1), e = f(x1, y1);
            if (![a, b, d, e].every(Number.isFinite)) continue;
            const s = Math.sign(a);
            if (Math.sign(b) !== s || Math.sign(d) !== s || Math.sign(e) !== s) {
              ctx.fillRect(px, py, step - 0.5, step - 0.5);
            }
          }
        }
      } else if (c.kind === 'inequality' || (c.kind === 'needsParam' && c.isIneq)) {
        const col = colorAt();
        let holds;
        if (c.test) {
          holds = (mx, my) => { env.x = mx; env.y = my; try { return GC.boolEval(c.test, env); } catch (_) { return false; } };
        } else {
          const lhs = c.lhs, rhs = c.rhs, less = (c.op === '<' || c.op === '<=');
          holds = (mx, my) => { env.x = mx; env.y = my; try { const v = GC.evalAst(lhs, env) - GC.evalAst(rhs, env); return Number.isFinite(v) && (less ? v < 0 : v > 0); } catch (_) { return false; } };
        }
        ctx.fillStyle = col + '33';
        const st = 4;
        for (let px = 0; px < W; px += st) for (let py = 0; py < H; py += st) {
          const mx = (px + st / 2 - cx) / scale, my = (cy - (py + st / 2)) / scale;
          if (holds(mx, my)) ctx.fillRect(px, py, st, st);
        }
        // boundary only for a single comparison
        if (c.lhs) {
          const lhs = c.lhs, rhs = c.rhs;
          const g = (mx, my) => { env.x = mx; env.y = my; try { return GC.evalAst(lhs, env) - GC.evalAst(rhs, env); } catch (_) { return NaN; } };
          ctx.fillStyle = col;
          for (let px = 0; px < W; px += 3) for (let py = 0; py < H; py += 3) {
            const x0 = (px - cx) / scale, y0 = (cy - py) / scale, x1 = (px + 3 - cx) / scale, y1 = (cy - (py + 3)) / scale;
            const a = g(x0, y0), b = g(x1, y0), d = g(x0, y1), e = g(x1, y1);
            if (![a, b, d, e].every(Number.isFinite)) continue;
            const s = Math.sign(a);
            if (Math.sign(b) !== s || Math.sign(d) !== s || Math.sign(e) !== s) ctx.fillRect(px, py, 2.5, 2.5);
          }
        }
      } else if (c.kind === 'polar' || (c.kind === 'needsParam' && c.polar)) {
        const ast = c.ast; const col = colorAt();
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
        const N = 720; let started = false, prev = null;
        for (let i = 0; i <= N; i++) {
          const th = (i / N) * Math.PI * 2; env['θ'] = th; env.theta = th;
          let r; try { r = GC.evalAst(ast, env); } catch (_) { started = false; continue; }
          if (!Number.isFinite(r)) { started = false; continue; }
          const px = X(r * Math.cos(th)), py = Y(r * Math.sin(th));
          if (!started || (prev && Math.hypot(px - prev[0], py - prev[1]) > H * 0.6)) { ctx.moveTo(px, py); started = true; }
          else ctx.lineTo(px, py);
          prev = [px, py];
        }
        ctx.stroke();
      } else if (c.kind === 'parametric' || (c.kind === 'needsParam' && c.parametric)) {
        const aX = c.astX || (c.ast && c.ast.items[0]), aY = c.astY || (c.ast && c.ast.items[1]);
        const col = colorAt();
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
        const N = 720; let started = false, prev = null;
        for (let i = 0; i <= N; i++) {
          const t = (i / N) * Math.PI * 2; env.t = t;
          let mx, my; try { mx = GC.evalAst(aX, env); my = GC.evalAst(aY, env); } catch (_) { started = false; continue; }
          if (!Number.isFinite(mx) || !Number.isFinite(my)) { started = false; continue; }
          const px = X(mx), py = Y(my);
          if (!started || (prev && Math.hypot(px - prev[0], py - prev[1]) > H * 0.6)) { ctx.moveTo(px, py); started = true; }
          else ctx.lineTo(px, py);
          prev = [px, py];
        }
        ctx.stroke();
      } else if (c.kind === 'point') {
        let pt; try { pt = GC.evalAst(c.ast, env); } catch (_) { return; }
        if (Array.isArray(pt) && pt.every(Number.isFinite)) {
          const col = colorAt();
          ctx.fillStyle = col; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(X(pt[0]), Y(pt[1]), 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      }
    });
  }

  // build user funcs + recursive sequences from a gallery set
  function thumbSeqs(set) {
    const funcs = {}, seqs = {};
    set.forEach((src) => { try { const c = GC.classify(src, []); if (c && c.kind === 'funcDef') funcs[c.name] = { params: c.params, body: c.ast }; if (c && c.kind === 'seqBase') { (seqs[c.name] || (seqs[c.name] = { param: 'n', body: null, bases: new Map() })).bases.set(c.index, c.ast); } } catch (_) {} });
    set.forEach((src) => { try { const c = GC.classify(src, []); if (c && c.kind === 'funcDef' && c.params.length === 1 && seqs[c.name]) { seqs[c.name].body = c.ast; seqs[c.name].param = c.params[0]; } } catch (_) {} });
    return { funcs, seqs };
  }

  function renderSeqThumb(canvas, ex) {
    const dpr = 2, W = 148, H = 104;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    const { funcs, seqs } = thumbSeqs(ex.set);
    let plot = null;
    ex.set.forEach((src) => { try { const c = GC.classify(src, []); if (c && c.kind === 'sequencePlot') plot = c; } catch (_) {} });
    if (!plot) return;
    const env = { __funcs: funcs, __seqs: seqs, __seqCache: {} };
    const lo = Math.round(GC.evalAst(plot.start, env)), hi = Math.round(GC.evalAst(plot.end, env));
    const child = Object.assign({}, env); const pts = [];
    for (let n = lo; n <= hi; n++) { child[plot.varName] = n; let v; try { v = GC.evalAst(plot.body, child); } catch (_) { continue; } if (Number.isFinite(v)) pts.push([n, v]); }
    if (!pts.length) return;
    const pad = 12;
    let minY = Math.min(0, ...pts.map((p) => p[1])), maxY = Math.max(0, ...pts.map((p) => p[1]));
    if (maxY === minY) maxY = minY + 1;
    const X = (n) => pad + (n - lo) / Math.max(1, hi - lo) * (W - 2 * pad);
    const Y = (y) => (H - pad) - (y - minY) / (maxY - minY) * (H - 2 * pad);
    // baseline (y=0)
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, Y(0)); ctx.lineTo(W, Y(0)); ctx.stroke();
    const col = COLORS[1];
    // stems
    ctx.strokeStyle = col + '66'; ctx.lineWidth = 1.4; ctx.beginPath();
    pts.forEach(([n, y]) => { ctx.moveTo(X(n), Y(0)); ctx.lineTo(X(n), Y(y)); });
    ctx.stroke();
    // dots
    ctx.fillStyle = col; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4;
    pts.forEach(([n, y]) => { ctx.beginPath(); ctx.arc(X(n), Y(y), 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
  }

  let galleryBuilt = false;
  const GAL_ALL = T2('gallery.cat.all', 'Всі');
  let galCat = GAL_ALL;
  function buildGallery() {
    if (galleryBuilt) return; galleryBuilt = true;
    const body = $('#exBody');
    // Чіпи-фільтри категорій (як у 3D-галереї)
    const chips = document.createElement('div'); chips.className = 'ex-chips';
    const cats = [GAL_ALL, ...GALLERY.map(g => g.cat)];
    cats.forEach(cat => {
      const ch = document.createElement('button');
      ch.className = 'ex-chip' + (cat === galCat ? ' active' : '');
      ch.textContent = cat;
      ch.addEventListener('click', () => {
        galCat = cat;
        chips.querySelectorAll('.ex-chip').forEach(b => b.classList.toggle('active', b === ch));
        body.querySelectorAll('.ex-cat').forEach(sec => {
          sec.style.display = (cat === GAL_ALL || sec.dataset.cat === cat) ? '' : 'none';
        });
      });
      chips.appendChild(ch);
    });
    body.appendChild(chips);
    GALLERY.forEach((group) => {
      const sec = document.createElement('div'); sec.className = 'ex-cat';
      sec.dataset.cat = group.cat;
      const h = document.createElement('div'); h.className = 'ex-cat-h'; h.textContent = group.cat;
      sec.appendChild(h);
      const grid = document.createElement('div'); grid.className = 'ex-grid';
      group.items.forEach((ex) => {
        const card = document.createElement('button'); card.className = 'ex-card';
        const cv = document.createElement('canvas'); cv.className = 'ex-thumb';
        const meta = document.createElement('div'); meta.className = 'ex-meta';
        const nm = document.createElement('div'); nm.className = 'ex-name'; nm.textContent = ex.name;
        const fm = document.createElement('div'); fm.className = 'ex-formula';
        fm.textContent = ex.set
          ? ex.set[0].replace(/\*/g, '·').replace(/sqrt/g, '√').replace(/<=/g, '≤').replace(/>=/g, '≥').replace(/\bpi\b/g, 'π')
          : (ex.tableData ? `${ex.tableData.length} ${T2('ui.pointsCount', 'точок')}` + (ex.regression ? ' · ' + T2('tags.fitExpr', 'регресія') : '') : '');
        meta.appendChild(nm); meta.appendChild(fm);
        if (ex.badge) { const bd = document.createElement('span'); bd.className = 'ex-badge'; bd.textContent = ex.badge; meta.appendChild(bd); }
        card.appendChild(cv); card.appendChild(meta);
        card.addEventListener('click', () => {
          if (ex.tableData) loadTableExample(ex);
          else loadSet(ex.set);
          closeGallery();
        });
        grid.appendChild(card);
        // P-03: defer thumb renders to avoid blocking UI thread on gallery open
        const _drawThumb = () => { try { renderThumb(cv, ex); } catch (_) {} };
        if (window.requestIdleCallback) requestIdleCallback(_drawThumb, { timeout: 2000 });
        else setTimeout(_drawThumb, 0);
      });
      sec.appendChild(grid); body.appendChild(sec);
    });
  }
  function openGallery() { buildGallery(); $('#exDrawer').classList.add('open'); $('#exOverlay').classList.add('open'); }
  function closeGallery() { $('#exDrawer').classList.remove('open'); $('#exOverlay').classList.remove('open'); }
  $('#examplesBtn').addEventListener('click', openGallery);
  $('#exClose').addEventListener('click', closeGallery);
  $('#exOverlay').addEventListener('click', closeGallery);
  document.addEventListener('keydown', (e) => {
    const scope = window.__mashKeydownScope;
    if (scope && e.target instanceof Node && !scope.contains(e.target)) return; // guard для вбудовування (§2.2)
    if (e.key === 'Escape') closeGallery();
  });

  // ---------- seed / відновлення (§4.6) ----------
  let _init2d = G2D_OPTS.state || null;
  if (!_init2d && G2D_STORE_LOCAL) {
    try { _init2d = JSON.parse(localStorage.getItem('mash:g2d:state')); } catch (_) {}
  }
  if (_init2d && ((_init2d.expressions && _init2d.expressions.length) || (_init2d.items && _init2d.items.length))) {
    restore(typeof _init2d === 'string' ? _init2d : JSON.stringify(_init2d));
  } else {
    ['y=a x^2', 'a=1', '(x-1)^2 + (y-1)^2 = 4', '(0, 0)'].forEach((s) => calc.addExpression(s));
    renderRows();
  }
  snapshot();
// ═══ Налаштування (⚙): кутовий режим + межі осей + підписи (№13, №14) ═══
(function () {
  const btn = document.getElementById('settingsBtn');
  if (!btn) return;
  const pop = document.createElement('div');
  pop.id = 'settingsPop';
  pop.innerHTML = `
    <div class="sp-title">${T2('settings.title', 'Налаштування графіка')}</div>
    <div class="sp-row">
      <span class="sp-label">${T2('settings.angles', 'Кути')}</span>
      <div class="sp-seg">
        <button data-am="rad" class="active">${T2('settings.radians', 'Радіани')}</button>
        <button data-am="deg">${T2('settings.degrees', 'Градуси')}</button>
      </div>
    </div>
    <div class="sp-sep"></div>
    <div class="sp-row"><span class="sp-label">${T2('settings.axisX', 'Вісь X')}</span>
      <input id="spXmin" class="sp-num" placeholder="min">
      <span class="sp-dash">–</span>
      <input id="spXmax" class="sp-num" placeholder="max">
    </div>
    <div class="sp-row"><span class="sp-label">${T2('settings.axisY', 'Вісь Y')}</span>
      <input id="spYmin" class="sp-num" placeholder="min">
      <span class="sp-dash">–</span>
      <input id="spYmax" class="sp-num" placeholder="max">
    </div>
    <button id="spApplyBounds" class="sp-apply">${T2('settings.applyBounds', 'Застосувати межі')}</button>
    <div class="sp-sep"></div>
    <div class="sp-row"><span class="sp-label">${T2('settings.labelX', 'Підпис X')}</span><input id="spXname" class="sp-text" placeholder="${T2('settings.labelXPlaceholder', 'напр. час, с')}"></div>
    <div class="sp-row"><span class="sp-label">${T2('settings.labelY', 'Підпис Y')}</span><input id="spYname" class="sp-text" placeholder="${T2('settings.labelYPlaceholder', 'напр. шлях, м')}"></div>
    <div class="sp-sep"></div>
    <button id="spAddImage" class="sp-apply">${T2('settings.addImage', '🖼 Додати картинку на графік')}</button>
    <div id="spImgList"></div>
  `;
  document.body.appendChild(pop);

  const GC = window.GraphCalc;
  const num = (s) => {
    if (!s.trim()) return NaN;
    try { return GC.evalAst(GC.parse(s), { ...GC.CONSTS }); } catch (_) { return NaN; }
  };

  window.syncAngleUI = function () {
    const m = GC.getAngleMode();
    pop.querySelectorAll('[data-am]').forEach((b) => b.classList.toggle('active', b.dataset.am === m));
  };

  pop.querySelectorAll('[data-am]').forEach((b) => {
    b.addEventListener('click', () => {
      GC.setAngleMode(b.dataset.am);
      syncAngleUI();
      calc._reclassifyAll && calc._reclassifyAll();
      calc._scheduleRender();
      snapshot();
    });
  });

  function fillBounds() {
    const bb = calc.getBounds();
    const f = (v) => String(parseFloat(v.toPrecision(4)));
    document.getElementById('spXmin').value = f(bb.xmin);
    document.getElementById('spXmax').value = f(bb.xmax);
    document.getElementById('spYmin').value = f(bb.ymin);
    document.getElementById('spYmax').value = f(bb.ymax);
    document.getElementById('spXname').value = (calc.axisNames && calc.axisNames.x) || '';
    document.getElementById('spYname').value = (calc.axisNames && calc.axisNames.y) || '';
  }

  document.getElementById('spApplyBounds').addEventListener('click', () => {
    const ok = calc.setBounds(
      num(document.getElementById('spXmin').value), num(document.getElementById('spXmax').value),
      num(document.getElementById('spYmin').value), num(document.getElementById('spYmax').value));
    if (!ok) { document.getElementById('spApplyBounds').textContent = T2('settings.invalidBounds', 'Невалідні межі'); setTimeout(() => { document.getElementById('spApplyBounds').textContent = T2('settings.applyBounds', 'Застосувати межі'); }, 1400); return; }
    snapshot();
  });

  ['spXname', 'spYname'].forEach((id) => {
    document.getElementById(id).addEventListener('change', () => {
      calc.setAxisNames(document.getElementById('spXname').value.trim(), document.getElementById('spYname').value.trim());
      snapshot();
    });
  });

  // №12: картинка на графік
  const imgInput = document.createElement('input');
  imgInput.type = 'file';
  imgInput.accept = 'image/*';
  imgInput.style.display = 'none';
  document.body.appendChild(imgInput);
  document.getElementById('spAddImage').addEventListener('click', () => imgInput.click());
  imgInput.addEventListener('change', () => {
    const f = imgInput.files && imgInput.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      calc.addImage(rd.result);
      renderImgList();
      snapshot();
    };
    rd.readAsDataURL(f);
    imgInput.value = '';
  });
  function renderImgList() {
    const box = document.getElementById('spImgList');
    const imgs = calc.images || [];
    box.innerHTML = imgs.length
      ? imgs.map((r, i) => '<div class="sp-row"><span class="sp-label">' + T2('settings.photo', 'Фото') + ' ' + (i + 1) + '</span>' +
          '<input type="range" class="sp-imgop" data-id="' + r.id + '" min="0.1" max="1" step="0.05" value="' + r.opacity + '" style="flex:1">' +
          '<button class="sp-imgdel" data-id="' + r.id + '" title="' + T2('settings.removeImage', 'Прибрати') + '">✕</button></div>').join('')
      : '';
    box.querySelectorAll('.sp-imgop').forEach((s) => s.addEventListener('input', () => {
      const rec = (calc.images || []).find((r) => r.id === s.dataset.id);
      if (rec) { rec.opacity = +s.value; calc._scheduleRender(); }
    }));
    box.querySelectorAll('.sp-imgdel').forEach((b) => b.addEventListener('click', () => {
      calc.removeImage(b.dataset.id);
      renderImgList();
      snapshot();
    }));
  }
  calc.onImageChange = () => snapshot();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = pop.classList.toggle('open');
    if (open) { fillBounds(); syncAngleUI(); renderImgList(); }
  });
  document.addEventListener('click', (e) => {
    if (!pop.contains(e.target) && e.target !== btn) pop.classList.remove('open');
  });
})();

})();



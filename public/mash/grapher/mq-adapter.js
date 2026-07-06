// mq-adapter.js — WYSIWYG формули (MathQuill) ↔ синтаксис GraphCalc
// Експортує window.MQAdapter = { ready, canWysiwyg, srcToLatex, latexToSrc, mount }
(function () {
  let MQ = null;
  function ready() {
    if (MQ) return true;
    if (window.MathQuill && window.jQuery) { MQ = MathQuill.getInterface(2); return true; }
    return false;
  }

  const GREEK = { pi:'\\pi ', theta:'\\theta ', tau:'\\tau ', alpha:'\\alpha ', beta:'\\beta ', phi:'\\phi ', rho:'\\rho ', omega:'\\omega ', lambda:'\\lambda ', mu:'\\mu ', sigma:'\\sigma ' };
  const GREEK_R = { pi:'pi', theta:'theta', tau:'tau', alpha:'alpha', beta:'beta', phi:'phi', rho:'rho', omega:'omega', lambda:'lambda', mu:'mu', sigma:'sigma' };
  const TRIG = new Set(['sin','cos','tan','sec','csc','cot','sinh','cosh','tanh','ln','log','exp','min','max','arcsin','arccos','arctan']);
  const FN_R = new Set(['sin','cos','tan','sec','csc','cot','sinh','cosh','tanh','ln','log','exp','min','max','arcsin','arccos','arctan','arg','abs']);

  // ---------- AST → LaTeX ----------
  function toLatex(n) {
    switch (n.kind) {
      case 'num': return Number.isFinite(n.v) ? String(parseFloat(n.v.toPrecision(10))) : String(n.v);
      case 'ident': return GREEK[n.name] || n.name;
      case 'unary':
        if (n.op === '!') return wrapT(n.arg) + '!';
        return '-' + wrapT(n.arg);
      case 'binop': {
        const a = n.left, b = n.right;
        switch (n.op) {
          case '+': return toLatex(a) + '+' + toLatex(b);
          case '-': return toLatex(a) + '-' + (isAdd(b) ? par(b) : toLatex(b));
          case '*': return mulSide(a) + '\\cdot ' + mulSide(b);
          case '/': return '\\frac{' + toLatex(a) + '}{' + toLatex(b) + '}';
          case '^': return powBase(a) + '^{' + toLatex(b) + '}';
          case '%': return mulSide(a) + '\\operatorname{mod}' + mulSide(b);
        }
        break;
      }
      case 'call': {
        const name = n.name;
        if (name === 'sqrt') return '\\sqrt{' + toLatex(n.args[0]) + '}';
        if (name === 'cbrt') return '\\sqrt[3]{' + toLatex(n.args[0]) + '}';
        if (name === 'abs') return '\\left|' + toLatex(n.args[0]) + '\\right|';
        const map = { asin:'arcsin', acos:'arccos', atan:'arctan' };
        const ln = map[name] || name;
        const body = n.args.map(toLatex).join(',');
        if (TRIG.has(ln)) return '\\' + ln + '\\left(' + body + '\\right)';
        return '\\operatorname{' + ln + '}\\left(' + body + '\\right)';
      }
      case 'list': return '\\left[' + n.items.map(toLatex).join(',') + '\\right]';
      case 'tuple': return '\\left(' + n.items.map(toLatex).join(',') + '\\right)';
      case 'deriv': return n.name + "'".repeat(n.order) + '\\left(' + toLatex(n.arg) + '\\right)';
      case 'sum': case 'product':
        return '\\operatorname{' + (n.kind === 'sum' ? 'sum' : 'product') + '}\\left(' + n.varName + ',' + toLatex(n.start) + ',' + toLatex(n.end) + ',' + toLatex(n.body) + '\\right)';
      case 'integral':
        return '\\operatorname{integral}\\left(' + toLatex(n.body) + ',' + n.varName + ',' + toLatex(n.start) + ',' + toLatex(n.end) + '\\right)';
    }
    throw new Error('toLatex: ' + n.kind);
  }
  const isAdd = (n) => n.kind === 'binop' && (n.op === '+' || n.op === '-');
  const par = (n) => '\\left(' + toLatex(n) + '\\right)';
  const wrapT = (n) => (n.kind === 'num' || n.kind === 'ident' || n.kind === 'call') ? toLatex(n) : par(n);
  const mulSide = (n) => isAdd(n) ? par(n) : toLatex(n);
  const powBase = (n) => (n.kind === 'num' || n.kind === 'ident') ? toLatex(n) : par(n);

  // src (з =, ~, <, >, <=, >=) → LaTeX
  function splitTop(src) {
    const out = []; let depth = 0, cur = '';
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if ('([{'.includes(c)) depth++;
      else if (')]}'.includes(c)) depth--;
      if (depth === 0 && (c === '=' || c === '~' || c === '<' || c === '>')) {
        let op = c;
        if (src[i + 1] === '=') { op += '='; i++; }
        out.push({ t: 'e', v: cur }); out.push({ t: 'o', v: op });
        cur = '';
      } else cur += c;
    }
    out.push({ t: 'e', v: cur });
    return out;
  }
  function srcToLatex(src) {
    return splitTop(src).map((p) => {
      if (p.t === 'o') return { '=':'=', '~':'\\sim ', '<':'<', '>':'>', '<=':'\\le ', '>=':'\\ge ' }[p.v] || p.v;
      const s = p.v.trim();
      return s ? toLatex(window.GraphCalc.parse(s)) : '';
    }).join('');
  }

  function canWysiwyg(src) {
    const s = (src || '').trim();
    if (!s) return true;
    if (s.includes('"') || s.includes('{')) return false; // рядки/piecewise → текстовий режим
    try { srcToLatex(s); return true; } catch (_) { return false; }
  }

  // ---------- LaTeX → src ----------
  function latexToSrc(lx) {
    let i = 0;
    const skipSp = () => { while (lx[i] === ' ') i++; };
    function readCmd() {
      i++; let c = '';
      while (i < lx.length && /[a-zA-Z]/.test(lx[i])) c += lx[i++];
      if (!c) c = lx[i++];
      return c;
    }
    function group() {
      skipSp();
      if (lx[i] === '{') { i++; const s = level('}'); i++; return s; }
      if (lx[i] === '\\') return cmdToSrc(readCmd());
      return lx[i++];
    }
    function cmdToSrc(c) {
      switch (c) {
        case 'frac': { const a = group(), b = group(); return '((' + a + ')/(' + b + '))'; }
        case 'sqrt': {
          skipSp(); let n2 = null;
          if (lx[i] === '[') { i++; n2 = level(']'); i++; }
          const a = group();
          return n2 ? '((' + a + ')^(1/(' + n2 + ')))' : 'sqrt(' + a + ')';
        }
        case 'cdot': case 'times': return '*';
        case 'left': {
          skipSp();
          if (lx[i] === '\\') { const d = readCmd(); if (d === '|') return 'abs('; return '('; }
          const d = lx[i++];
          if (d === '|') return 'abs(';
          return d === '[' ? '[' : '(';
        }
        case 'right': {
          skipSp();
          if (lx[i] === '\\') { readCmd(); return ')'; }
          const d = lx[i++];
          return d === ']' ? ']' : ')';
        }
        case 'operatorname': return group();
        case 'le': return '<='; case 'ge': return '>='; case 'ne': return '!='; case 'sim': return '~';
        case 'sum': case 'prod': {
          skipSp(); let lo = '', hi = '';
          if (lx[i] === '_') { i++; lo = group(); }
          skipSp();
          if (lx[i] === '^') { i++; hi = group(); }
          const body = level(null);
          const m = lo.match(/^\s*([a-zA-Zα-ω]\w*)\s*=\s*([\s\S]*)$/);
          const v = m ? m[1] : 'n', l = m ? m[2] : lo;
          return (c === 'sum' ? 'sum(' : 'product(') + v + ',' + l + ',' + hi + ',' + body + ')';
        }
        default:
          if (GREEK_R[c]) return GREEK_R[c];
          if (FN_R.has(c)) return c === 'arcsin' ? 'asin' : c === 'arccos' ? 'acos' : c === 'arctan' ? 'atan' : c;
          if (c === ' ' || c === ',') return c;
          return c.length > 1 ? c : c; // невідома команда — як текст
      }
    }
    function level(closer) {
      let s = '';
      while (i < lx.length) {
        const ch = lx[i];
        if (closer && ch === closer) break;
        if (ch === '}') break;
        if (ch === '\\') { s += cmdToSrc(readCmd()); continue; }
        if (ch === '^') { i++; s += '^(' + group() + ')'; continue; }
        if (ch === '_') { i++; s += '_' + group(); continue; }
        if (ch === '~') { i++; s += ' '; continue; }
        i++; s += ch;
      }
      return s;
    }
    return level(null).trim();
  }

  // ---------- Монтування поля ----------
  function mount(span, src, cb) {
    const mq = MQ.MathField(span, {
      spaceBehavesLikeTab: false,
      sumStartsWithNEquals: true,
      autoCommands: 'pi theta tau sqrt sum prod',
      autoOperatorNames: 'sin cos tan sec csc cot sinh cosh tanh asin acos atan arcsin arccos arctan ln log exp abs min max mod floor ceil round sign cbrt arg re im conj integral sum product plot domaincolor dc lsystem koch dragon hilbert plant sierpinski mandelbrot julia burningship tricorn multibrot',
      handlers: {
        edit: (mf) => {
          if (mount._silent) return;
          let s;
          try { s = latexToSrc(mf.latex()); } catch (_) { s = mf.text(); }
          cb.onEdit(s);
        },
        enter: () => cb.onEnter && cb.onEnter(),
        deleteOutOf: (dir, mf) => { if (!mf.latex()) cb.onDeleteEmpty && cb.onDeleteEmpty(); },
        upOutOf: () => cb.onUp && cb.onUp(),
        downOutOf: () => cb.onDown && cb.onDown(),
      },
    });
    mount._silent = true;
    try { mq.latex(src ? srcToLatex(src) : ''); } catch (_) {}
    mount._silent = false;
    return mq;
  }

  window.MQAdapter = { ready, canWysiwyg, srcToLatex, latexToSrc, mount };
})();

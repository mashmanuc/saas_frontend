// ast-to-latex.js — converts GraphCalc AST nodes to LaTeX strings
// Loaded as a regular script (no module) so it's accessible globally

(function() {

const GREEK = {
  alpha:'\\alpha',beta:'\\beta',gamma:'\\gamma',delta:'\\delta',
  epsilon:'\\epsilon',zeta:'\\zeta',eta:'\\eta',theta:'\\theta',
  iota:'\\iota',kappa:'\\kappa',lambda:'\\lambda',mu:'\\mu',
  nu:'\\nu',xi:'\\xi',pi:'\\pi',rho:'\\rho',sigma:'\\sigma',
  tau:'\\tau',phi:'\\phi',chi:'\\chi',psi:'\\psi',omega:'\\omega',
  Gamma:'\\Gamma',Delta:'\\Delta',Theta:'\\Theta',Lambda:'\\Lambda',
  Pi:'\\Pi',Sigma:'\\Sigma',Phi:'\\Phi',Psi:'\\Psi',Omega:'\\Omega',
};

const FUNC_MAP = {
  sin:'\\sin',cos:'\\cos',tan:'\\tan',cot:'\\cot',
  sec:'\\sec',csc:'\\csc',
  asin:'\\arcsin',acos:'\\arccos',atan:'\\arctan',
  arcsin:'\\arcsin',arccos:'\\arccos',arctan:'\\arctan',
  sinh:'\\sinh',cosh:'\\cosh',tanh:'\\tanh',
  log:'\\log',ln:'\\ln',exp:'\\exp',
  abs:'\\left|#\\right|',
  sqrt:'\\sqrt{#}',
  floor:'\\lfloor#\\rfloor',ceil:'\\lceil#\\rceil',
  sign:'\\operatorname{sgn}',
  max:'\\max',min:'\\min',
};

// Operator precedence for parenthesisation
const PREC = {'+':1,'-':1,'*':2,'/':2,'^':3};

function needsParens(node, parentOp, side) {
  if (node.kind !== 'binop') return false;
  const cp = PREC[node.op] || 0, pp = PREC[parentOp] || 0;
  if (cp < pp) return true;
  // Right-associative ^: right child at same prec doesn't need parens
  if (parentOp === '^' && side === 'right') return false;
  if (cp === pp && side === 'right' && (parentOp === '-' || parentOp === '/')) return true;
  return false;
}

function astToLatex(node, parentOp, side) {
  if (!node) return '?';
  switch (node.kind) {
    case 'num': {
      const v = node.v;
      if (!Number.isFinite(v)) return '\\infty';
      // Format nicely: avoid 3.141592653589793
      const s = Number.isInteger(v) ? String(v) : v.toPrecision(6).replace(/\.?0+$/, '');
      return s.startsWith('-') ? `\\left(${s}\\right)` : s;
    }
    case 'ident': {
      const n = node.name;
      if (GREEK[n]) return GREEK[n];
      if (n === 'e') return 'e';
      if (n === 'inf' || n === 'Inf') return '\\infty';
      // Multi-char identifiers → roman text
      return n.length > 1 ? `\\mathit{${n}}` : n;
    }
    case 'unary':
      return `-${astToLatex(node.arg, '-', 'right')}`;
    case 'binop': {
      const { op, left, right } = node;
      const lx = astToLatex(left, op, 'left');
      const rx = astToLatex(right, op, 'right');
      const lp = needsParens(left, op, 'left')   ? `\\left(${lx}\\right)` : lx;
      const rp = needsParens(right, op, 'right') ? `\\left(${rx}\\right)` : rx;
      if (op === '+') return `${lp}+${rp}`;
      if (op === '-') return `${lp}-${rp}`;
      if (op === '*') {
        // Implicit mult: number × variable → no symbol
        if (left.kind === 'num' && right.kind === 'ident') return `${lp}${rp}`;
        if (left.kind === 'num' && right.kind === 'call')  return `${lp}${rp}`;
        return `${lp}\\cdot ${rp}`;
      }
      if (op === '/') return `\\frac{${lx}}{${rx}}`;
      if (op === '^') {
        // e^x → special
        if (left.kind === 'ident' && left.name === 'e') return `e^{${rx}}`;
        return `${lp}^{${rx}}`;
      }
      return `${lp}${op}${rp}`;
    }
    case 'call': {
      const { name, args } = node;
      const fmt = FUNC_MAP[name];
      if (fmt) {
        if (fmt.includes('#')) {
          // Template with # = first arg
          return fmt.replace('#', astToLatex(args[0]));
        }
        if (name === 'exp') return `e^{${astToLatex(args[0])}}`;
        if (name === 'log' && args.length === 2) {
          return `\\log_{${astToLatex(args[1])}}\\!\\left(${astToLatex(args[0])}\\right)`;
        }
        const inner = args.map(a => astToLatex(a)).join(', ');
        return `${fmt}\\!\\left(${inner}\\right)`;
      }
      // Unknown function
      const inner2 = args.map(a => astToLatex(a)).join(', ');
      return `\\operatorname{${name}}\\!\\left(${inner2}\\right)`;
    }
    case 'eq': {
      return `${astToLatex(node.lhs)}=${astToLatex(node.rhs)}`;
    }
    case 'piecewise': {
      const rows = node.pieces.map(p =>
        `${astToLatex(p.val)} & ${astToLatex(p.cond)}`
      ).join('\\\\');
      const els = node.otherwise ? `${astToLatex(node.otherwise)} & \\text{інакше}` : '';
      return `\\begin{cases}${rows}${els ? '\\\\'+els : ''}\\end{cases}`;
    }
    default:
      return '\\text{?}';
  }
}

// Main entry: convert expression string → LaTeX string
function exprToLatex(src) {
  if (!src || !src.trim()) return '';
  const GC = window.GraphCalc;
  if (!GC) return src;
  try {
    const s = src.trim();
    // Split at top-level '=' manually (same logic as classify3D)
    let eqPos = -1;
    for (let i = 1; i < s.length; i++) {
      if (s[i]==='=' && !['<','>','!','='].includes(s[i-1]) && s[i+1]!=='=') { eqPos=i; break; }
    }
    if (eqPos > 0) {
      const lhs = GC.parse(s.slice(0, eqPos).trim());
      const rhs = GC.parse(s.slice(eqPos+1).trim());
      return `${astToLatex(lhs)}=${astToLatex(rhs)}`;
    }
    // No '=': try tuple or plain expr
    const s2 = s.startsWith('(') && s.endsWith(')') ? s : s;
    return astToLatex(GC.parse(s2));
  } catch (_) {
    return src; // fallback: raw string
  }
}

window.exprToLatex = exprToLatex;
})();

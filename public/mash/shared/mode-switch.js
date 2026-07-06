/* ═══════════════════════════════════════════════════════════
   MASH — спільний перемикач додатків (2D / 3D / Geo)
   Підключається в УСІХ калькуляторах:
     <script src="../shared/mode-switch.js"></script>
     <mash-mode-switch active="geo"></mash-mode-switch>
   Атрибути:
     active — '2d' | '3d' | 'geo' (поточний додаток)
     theme  — 'light' (типово) | 'dark'
     accent — колір активної пігулки (типово за темою)
   Змінюєте APPS тут — міняється в усіх додатках одразу.
   ═══════════════════════════════════════════════════════════ */
(function () {
  const APPS_DEFAULT = [
    { id: '2d',     label: '2D',     path: 'grapher/index.html' },
    { id: '3d',     label: '3D',     path: 'grapher-3d/index.html' },
    { id: 'geo',    label: 'Geo',    path: 'geomash/GeoMASH.html' },
    { id: 'stereo', label: 'Stereo', path: 'stereomash/index.html' },
  ];
  const TITLE = 'Перемкнути калькулятор';

  // Хост може задати власний список: window.MASH_APPS = [{id,label,path|href},...]
  // або атрибутом apps='[{"id":"2d",...}]' на самому елементі.

  class MashModeSwitch extends HTMLElement {
    static get observedAttributes() { return ['active', 'theme', 'accent', 'apps']; }
    connectedCallback() { this.render(); }
    attributeChangedCallback() { if (this.isConnected) this.render(); }
    getApps() {
      const attr = this.getAttribute('apps');
      if (attr) { try { return JSON.parse(attr); } catch (_) {} }
      if (Array.isArray(window.MASH_APPS) && window.MASH_APPS.length) return window.MASH_APPS;
      return APPS_DEFAULT;
    }
    render() {
      const APPS = this.getApps();
      const active = (this.getAttribute('active') || '').toLowerCase();
      const dark   = this.getAttribute('theme') === 'dark';
      const accent = this.getAttribute('accent') || (dark ? '#2d70b3' : '#1a5c38');
      const border = dark ? 'rgba(255,255,255,0.2)' : '#e0e6ea';
      const fg     = dark ? '#b4bcc4' : '#8a9e94';
      const hoverBg = dark ? 'rgba(255,255,255,0.12)' : '#f0f5f0';
      const hoverFg = dark ? '#fff' : '#4a5e54';
      const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
      root.innerHTML = `
        <style>
          :host { display: inline-flex; }
          .sw {
            display: inline-flex; border: 1px solid ${border};
            border-radius: 6px; overflow: hidden;
            font-family: inherit;
          }
          .opt {
            font-size: 11px; font-weight: 600; padding: 3px 9px;
            line-height: 1.4; text-decoration: none; color: ${fg};
            border-left: 1px solid ${border}; cursor: pointer;
            font-family: inherit;
          }
          .opt:first-child { border-left: none; }
          a.opt:hover { background: ${hoverBg}; color: ${hoverFg}; }
          .opt.active { background: ${accent}; color: #fff; cursor: default; }
        </style>
        <div class="sw" title="${TITLE}">
          ${APPS.map(a => a.id === active
            ? `<span class="opt active">${a.label}</span>`
            : `<a class="opt" href="${a.href || '../' + a.path}">${a.label}</a>`).join('')}
        </div>`;
    }
  }
  if (!customElements.get('mash-mode-switch')) {
    customElements.define('mash-mode-switch', MashModeSwitch);
  }
})();

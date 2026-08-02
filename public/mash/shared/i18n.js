/* ═══════════════════════════════════════════════════════════
   MASH i18n — спільний t()-хелпер для всіх vanilla-додатків
   Використання:
     <script src="../shared/i18n.js"></script>
     <script>MashI18n.initSync(null, '../i18n/');</script>  // до першого рендера
     MashI18n.t('mash.geo.tools.POINT')
     MashI18n.t('mash.geo.dialogs.pointCoords', { id: 'A' })
   Статична розмітка: data-i18n / data-i18n-html / data-i18n-title /
     data-i18n-placeholder + виклик MashI18n.applyDom(document) до boot.
   Словники: i18n/uk.json, i18n/en.json (nested, префікс mash.*)
   Fallback = сам ключ (нічого не падає); applyDom пропускає
   відсутні ключі, лишаючи текст із розмітки.
   ═══════════════════════════════════════════════════════════ */
(function () {
  const S = { dicts: {}, lang: 'uk', ready: false };

  function resolve(key) {
    return key.split('.').reduce((o, k) => (o == null ? o : o[k]), S.dicts);
  }

  function interp(str, vars) {
    return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : '{' + k + '}'));
  }

  async function init(lang, basePath) {
    S.lang = lang || localStorage.getItem('mash:lang') || 'uk';
    try {
      const res = await fetch((basePath || './i18n/') + S.lang + '.json');
      S.dicts = await res.json();
      S.ready = true;
    } catch (_) { S.dicts = {}; S.ready = false; }
    return S.lang;
  }

  // Синхронна ініціалізація — для додатків, що рендеряться одразу на DOMContentLoaded
  function initSync(lang, basePath) {
    S.lang = lang || localStorage.getItem('mash:lang') || 'uk';
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', (basePath || './i18n/') + S.lang + '.json', false);
      xhr.send();
      if ((xhr.status === 200 || xhr.status === 0) && xhr.responseText) {
        S.dicts = JSON.parse(xhr.responseText);
        S.ready = true;
      }
    } catch (_) { S.dicts = {}; S.ready = false; }
    return S.lang;
  }

  // Інлайн-ініціалізація — для бандлів (dist), де fetch недоступний (file://)
  function initInline(dictsByLang, lang) {
    S.lang = lang || localStorage.getItem('mash:lang') || 'uk';
    S.dicts = dictsByLang[S.lang] || dictsByLang.uk || {};
    S.ready = true;
  }

  function t(key, vars = {}) {
    const val = resolve(key);
    return interp(typeof val === 'string' ? val : key, vars);
  }

  // Переклад статичної розмітки (до boot рантайму, щоб шаблон уже був перекладений)
  function applyDom(root) {
    if (!S.ready) return;
    const scope = root || document;
    const apply = (attr, fn) => {
      scope.querySelectorAll('[' + attr + ']').forEach(el => {
        const val = resolve(el.getAttribute(attr));
        if (typeof val === 'string') fn(el, val);
      });
    };
    apply('data-i18n',             (el, v) => { el.textContent = v; });
    apply('data-i18n-html',        (el, v) => { el.innerHTML = v; });
    apply('data-i18n-title',       (el, v) => { el.setAttribute('title', v); });
    apply('data-i18n-placeholder', (el, v) => { el.setAttribute('placeholder', v); });
    apply('data-i18n-aria-label',  (el, v) => { el.setAttribute('aria-label', v); });
  }

  function setLang(lang) { localStorage.setItem('mash:lang', lang); }

  window.MashI18n = {
    init, initSync, initInline, t, applyDom, setLang,
    get lang() { return S.lang; },
    get ready() { return S.ready; },
  };
})();

/* ═══════════════════════════════════════════════════════════
   MASH shared: «Використати на дошці» (Guide §5.3) + мовна кнопка
   window.MashUseOnBoard(app, serializeFn, canvasSel?)
     → envelope {app, version, scene, preview} → window.__mashUseOnBoard(envelope)
     fallback (standalone, без hook-а): діалог з лінком на дошку.
   window.MashLangInit(btnEl) — тумблер uk/en через mash:lang + reload.
   ═══════════════════════════════════════════════════════════ */
(function () {
  // Плейсхолдер — фінальний URL дасть власник (Guide §5.3)
  window.MASH_BOARD_URL = window.MASH_BOARD_URL || 'https://m4sh.org';

  window.MashUseOnBoard = function (app, serializeFn, canvasSel) {
    let scene = null;
    try { scene = serializeFn(); } catch (e) { console.warn('MashUseOnBoard: serialize failed', e); return false; }
    let preview = null;
    if (canvasSel) {
      try {
        const c = document.querySelector(canvasSel);
        if (c && typeof c.toDataURL === 'function') preview = c.toDataURL('image/png');
      } catch (_) {}
    }
    const envelope = { app, version: 1, scene, preview };
    if (typeof window.__mashUseOnBoard === 'function') {
      window.__mashUseOnBoard(envelope);
      return true;
    }
    // A2-міст (host patch, upstream → Guide §6): envelope → localStorage →
    // SPA-роут /mash/import (same-origin). Гість пройде реєстрацію/логін —
    // handoff чекає у сховищі. preview у сховище не кладемо, якщо не влазить
    // (quota) — сцена важливіша за картинку.
    try {
      try {
        localStorage.setItem('mash:handoff', JSON.stringify(envelope));
      } catch (_) {
        localStorage.setItem('mash:handoff', JSON.stringify({ app: envelope.app, version: envelope.version, scene: envelope.scene, preview: null }));
      }
      // Відносний шлях: воронка і SPA — той самий origin (m4sh.org або dev-хост)
      location.href = '/mash/import';
      return true;
    } catch (e) {
      console.warn('MashUseOnBoard: handoff failed', e);
    }
    const url = window.MASH_BOARD_URL;
    const msg = (window.MashI18n && MashI18n.ready)
      ? MashI18n.t('mash.common.boardFallback', { url })
      : 'Доступно на дошці M4SH: ' + url;
    window.alert(msg);
    return false;
  };

  window.MashLangInit = function (btn) {
    if (!btn) return;
    const cur = localStorage.getItem('mash:lang') || 'uk';
    btn.textContent = cur.toUpperCase();
    btn.addEventListener('click', () => {
      localStorage.setItem('mash:lang', cur === 'uk' ? 'en' : 'uk');
      location.reload();
    });
  };
})();

// Спільний словник MASH; сторінка-вхід не підвантажує жодного рушія інструментів.
document.addEventListener('DOMContentLoaded', async () => {
  const saved = localStorage.getItem('mash:lang');
  const lang = saved === 'uk' || saved === 'en' ? saved : 'uk';
  await MashI18n.init(lang, './i18n/');
  MashI18n.applyDom(document);
  if (MashI18n.ready) document.title = MashI18n.t('mash.hub.pageTitle');
  document.documentElement.lang = MashI18n.lang;
  const button = document.getElementById('languageButton');
  button.textContent = MashI18n.lang.toUpperCase();
  button.setAttribute('aria-label', MashI18n.lang === 'uk' ? 'Switch to English' : 'Перемкнути українською');
  button.addEventListener('click', () => {
    MashI18n.setLang(MashI18n.lang === 'uk' ? 'en' : 'uk');
    location.reload();
  });
});

/* Tag-/Nachtmodus: folgt der Einstellung des Geräts. Früh geladen, damit die Seite nicht aufblitzt.
   Setzt data-theme immer, damit alle :root[data-theme="dark"]-Regeln auch ohne Umschaltknopf greifen. */
(function () {
  var root = document.documentElement;
  var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  // Früher per Knopf gespeicherte Wahl verwerfen, der Knopf ist entfernt.
  try { localStorage.removeItem('bsn_theme'); } catch (e) {}

  function apply() { root.setAttribute('data-theme', mq && mq.matches ? 'dark' : 'light'); }
  apply();
  if (mq) {
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq.addListener) mq.addListener(apply);
  }
})();

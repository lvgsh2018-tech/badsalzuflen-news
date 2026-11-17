/* Tag-/Nachtmodus. Früh geladen, damit die Seite nicht aufblitzt.
   Ohne eigene Wahl folgt die Seite dem Gerät. Wer im Menü „Hell“ oder „Dunkel“ wählt,
   behält diese Wahl auf allen Seiten (gespeichert im Browser unter bsn_ansicht).
   Setzt data-theme immer, damit alle :root[data-theme="..."]-Regeln greifen. */
(function () {
  var root = document.documentElement;
  var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  var SCHLUESSEL = 'bsn_ansicht';
  // Wahl des früheren, inzwischen entfernten Knopfs verwerfen.
  try { localStorage.removeItem('bsn_theme'); } catch (e) {}

  function gewaehlt() {
    try { var w = localStorage.getItem(SCHLUESSEL); return w === 'light' || w === 'dark' ? w : null; }
    catch (e) { return null; }
  }

  // Farbe der Browserleiste am Handy: bei eigener Wahl beide Einträge auf die gewählte Farbe.
  var leiste = { light: null, dark: null };
  var metas = document.querySelectorAll('meta[name="theme-color"]');
  for (var i = 0; i < metas.length; i++) {
    leiste[(metas[i].getAttribute('media') || '').indexOf('dark') > -1 ? 'dark' : 'light'] = metas[i].getAttribute('content');
  }

  function apply() {
    var wahl = gewaehlt();
    var modus = wahl || (mq && mq.matches ? 'dark' : 'light');
    root.setAttribute('data-theme', modus);
    for (var m = 0; m < metas.length; m++) {
      var fuer = (metas[m].getAttribute('media') || '').indexOf('dark') > -1 ? 'dark' : 'light';
      var farbe = leiste[wahl || fuer];
      if (farbe) metas[m].setAttribute('content', farbe);
    }
    var knoepfe = document.querySelectorAll('.ansicht button[data-wahl]');
    for (var k = 0; k < knoepfe.length; k++) {
      knoepfe[k].setAttribute('aria-pressed', knoepfe[k].getAttribute('data-wahl') === modus ? 'true' : 'false');
    }
  }
  apply();
  if (mq) {
    if (mq.addEventListener) mq.addEventListener('change', apply);
    else if (mq.addListener) mq.addListener(apply);
  }
  // Wahl aus einem anderen offenen Tab übernehmen.
  window.addEventListener('storage', function (e) { if (e.key === SCHLUESSEL) apply(); });

  var SONNE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
  var MOND = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  // Schalter im Menü, direkt vor dem Instagram-Knopf.
  function schalterEinbauen() {
    var nav = document.getElementById('mainNav');
    if (!nav || nav.querySelector('.ansicht')) return;
    var gruppe = document.createElement('div');
    gruppe.className = 'ansicht';
    gruppe.setAttribute('role', 'group');
    gruppe.setAttribute('aria-label', 'Ansicht');
    gruppe.innerHTML =
      '<span class="ansicht-titel" aria-hidden="true">Ansicht</span>' +
      '<button type="button" data-wahl="light" aria-label="Helle Ansicht" title="Helle Ansicht">' + SONNE + '<span>Hell</span></button>' +
      '<button type="button" data-wahl="dark" aria-label="Dunkle Ansicht" title="Dunkle Ansicht">' + MOND + '<span>Dunkel</span></button>';
    gruppe.addEventListener('click', function (e) {
      var knopf = e.target.closest ? e.target.closest('button[data-wahl]') : null;
      if (!knopf) return;
      try { localStorage.setItem(SCHLUESSEL, knopf.getAttribute('data-wahl')); } catch (err) {}
      apply();
      // Ohne Speicher (privates Fenster) gilt die Wahl wenigstens für diese Seite.
      root.setAttribute('data-theme', knopf.getAttribute('data-wahl'));
    });
    nav.insertBefore(gruppe, nav.querySelector('.nav-cta'));
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schalterEinbauen);
  else schalterEinbauen();
})();

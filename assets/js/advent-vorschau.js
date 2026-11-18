/* Gewinnspiel-Vorschau: ersetzt bis zur letzten Auslosung (27.12.2026) die Wetter-Kachel auf der Startseite.
   Gezeigt wird das laufende Gewinnspiel, sonst das nächste. Danach kommt das Wetter von selbst zurück. */
(function () {
  var B = 'assets/img/advent-vorschau-', KRANZ = 'assets/img/advent-kranz.png', BOGEN = 'assets/img/advent-lichterbogen.webp';
  var d = new Date(), lokal = ['localhost', '127.0.0.1'].indexOf(location.hostname) >= 0;
  var heute = (lokal && new URLSearchParams(location.search).get('tag')) ||
    d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);

  /* Der erste Eintrag, dessen "bis" noch nicht vorbei ist, wird gezeigt */
  var PLAN = [
    { bis: '2026-11-26', bild: BOGEN, oben: true, titel: 'Lichterbogen gewinnen',
      wann: heute < '2026-11-23' ? 'Ab 23. November' : 'Bis 26. November', anzeige: true },
    { bis: '2026-11-28', bild: KRANZ, titel: '1. Advent: Den Preis verraten wir am Sonntag', wann: 'Ab 29. November' },
    { bis: '2026-12-05', bild: KRANZ, titel: 'Produktkorb von Bio am Markt gewinnen', wann: 'Bis 5. Dezember', anzeige: true },
    { bis: '2026-12-12', bild: B + 'biokiste.webp', titel: 'Zwei Biokisten gewinnen', wann: 'Bis 12. Dezember', anzeige: true },
    { bis: '2026-12-19', bild: B + 'esquina.webp', titel: 'Kaffee und Snack für zwei gewinnen', wann: 'Bis 19. Dezember', anzeige: true },
    { bis: '2026-12-26', bild: B + 'komplizen.webp', titel: 'Keramikmalen für zwei gewinnen', wann: 'Bis 26. Dezember', anzeige: true },
    { bis: '2026-12-27', bild: B + 'komplizen.webp', titel: 'Heute losen wir das Keramikmalen aus', wann: 'Auslosung in der Story', anzeige: true }
  ];
  var e = PLAN.filter(function (p) { return heute <= p.bis; })[0];
  if (!e) return;

  window.BSNAdvent = {
    html: function (cls) {
      return '<a class="tile adv-vorschau' + (e.bild === KRANZ ? ' adv-vorschau--kranz ' : e.oben ? ' adv-vorschau--oben ' : ' ') + cls + '" href="advent.html">' +
        '<img src="' + e.bild + '" alt="" loading="lazy">' +
        '<div class="tile-body"><span class="tag">Gewinnspiel</span><h3>' + e.titel + '</h3>' +
        '<p class="adv-vorschau-wann">' + e.wann + (e.anzeige ? ' · Anzeige' : '') + '</p></div></a>';
    }
  };
})();

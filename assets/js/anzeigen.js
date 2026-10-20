/* Werbepartner: zeigt die heute laufenden Anzeigen an ihren Plätzen und zählt, wie oft sie
   gesehen (mindestens zur Hälfte im Bild) und angeklickt werden. Gepflegt im Redaktionsbereich → Werbung.
   Läuft nichts, bleibt die Seite genau wie ohne Werbung. Jede laufende Anzeige ist immer zu sehen (keine Obergrenze, kein Abwechseln). Neben Blaulicht-Meldungen steht nie Werbung.
   BSNAnzeigen.html() baut dieselben Anzeigen auch für die Vorschau im Redaktionsbereich. */
(function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var PLAETZE = {
    kachel_klein: 'Startseiten-Kachel klein',
    kachel_gross: 'Startseiten-Kachel groß',
    artikel: 'Anzeige unter dem Artikel',
    termine: '„präsentiert von“ bei den Terminen',
    partner: 'Partnerleiste'
  };
  var LABEL = '<span class="ad-label">Anzeige</span>';
  function knopf(a, std) { return esc(a.knopf || std) + ' →'; }
  function bild(a, cls) { return a.bild_url ? '<img class="' + cls + '" src="' + esc(a.bild_url) + '" alt="" loading="lazy" decoding="async">' : ''; }
  function zeichen(a) { return '<span class="ad-initial" aria-hidden="true">' + esc(String(a.firma || '?').trim().charAt(0).toUpperCase()) + '</span>'; }
  function logo(a) { return a.bild_url ? '<img class="ad-logo-img" src="' + esc(a.bild_url) + '" alt="" loading="lazy">' : zeichen(a); }
  function attrs(a, cls, vorschau) {
    return 'class="' + cls + '" href="' + esc(vorschau ? '#' : a.link) + '"' +
      (vorschau ? ' tabindex="-1" onclick="return false"' : ' target="_blank" rel="sponsored noopener" data-anzeige="' + esc(a.id) + '"');
  }

  /* Eine Anzeige als HTML. vorschau = im Redaktionsbereich (kein echter Link, wird nicht gezählt). */
  function html(a, vorschau) {
    if (a.platz === 'kachel_klein' || a.platz === 'kachel_gross') {
      return '<a ' + attrs(a, 'tile ad-tile ' + (a.platz === 'kachel_gross' ? 's6 ad-tile--gross' : 's3'), vorschau) + '>' +
        (a.bild_url ? bild(a, '') : '<div class="ph ad-ph" aria-hidden="true"></div>') +
        '<div class="tile-body">' + LABEL + '<h3>' + esc(a.titel || a.firma) + '</h3>' +
        (a.text ? '<p>' + esc(a.text) + '</p>' : '') + '<span class="ad-cta">' + knopf(a, 'Mehr erfahren') + '</span></div></a>';
    }
    if (a.platz === 'artikel') {
      return '<a ' + attrs(a, 'ad-inline' + (a.bild_url ? '' : ' ad-inline--ohne-bild'), vorschau) + '>' +
        (a.bild_url ? '<div class="ad-pic">' + bild(a, '') + '</div>' : '') +
        '<div>' + LABEL + '<span class="ad-firma">' + esc(a.firma) + '</span><h4>' + esc(a.titel || a.firma) + '</h4>' +
        (a.text ? '<p>' + esc(a.text) + '</p>' : '') + '<span class="ad-cta">' + knopf(a, 'Mehr erfahren') + '</span></div></a>';
    }
    if (a.platz === 'termine') {
      return '<a ' + attrs(a, 'ad-band', vorschau) + '><span class="ad-logo">' + logo(a) + '</span>' + LABEL +
        '<span class="txt">Termine präsentiert von <strong>' + esc(a.firma) + '</strong>' + (a.titel ? '<small>' + esc(a.titel) + '</small>' : '') + '</span>' +
        '<span class="ad-go">' + knopf(a, 'Zur Webseite') + '</span></a>';
    }
    if (a.platz === 'partner') {
      return '<li><a ' + attrs(a, 'ad-partner', vorschau) + '>' + logo(a) + '<span>' + esc(a.firma) + '</span></a></li>';
    }
    return '';
  }
  function partnerleiste(list, vorschau) {
    return '<section class="ad-partners" aria-label="Unsere Partner"><h2>Unsere Partner aus Bad Salzuflen ' + LABEL + '</h2><ul>' +
      list.map(function (a) { return html(a, vorschau); }).join('') + '</ul></section>';
  }
  window.BSNAnzeigen = { PLAETZE: PLAETZE, html: html, partnerleiste: partnerleiste };

  /* ---------- Auf der Webseite einsetzen (nicht im Redaktionsbereich) ---------- */
  if (document.body && document.body.classList.contains('admin')) return;
  if (!window.BSN || !BSN.aktiveAnzeigen) return;

  /* Alle laufenden Anzeigen eines Platzes, in zufälliger Reihenfolge (so steht nicht immer dieselbe oben) */
  function alle(list, platz) {
    return list.filter(function (a) { return a.platz === platz; }).sort(function () { return Math.random() - 0.5; });
  }
  function element(a) { var d = document.createElement('div'); d.innerHTML = html(a); return d.firstChild; }

  var erledigt = {}, list = [];
  function artikel() {
    var share = document.querySelector('#article .share');
    if (!share || erledigt.artikel) return;
    erledigt.artikel = true;
    alle(list, 'artikel').forEach(function (a) { share.before(beobachten(element(a))); });
  }
  function termine() {
    var ev = document.getElementById('events');
    if (!ev || erledigt.termine || !ev.querySelector('.event, h2')) return;
    erledigt.termine = true;
    var l = alle(list, 'termine'); if (!l.length) return;
    var w = document.createElement('div'); w.className = 'ad-events-top';
    l.forEach(function (a) { w.appendChild(beobachten(element(a))); });
    ev.prepend(w);
  }
  function partner() {
    var f = document.querySelector('.site-footer');
    var l = alle(list, 'partner');
    if (!f || !l.length) return;
    var d = document.createElement('div'); d.innerHTML = partnerleiste(l);
    var s = d.firstChild; s.querySelectorAll('[data-anzeige]').forEach(beobachten);
    f.before(s);
  }

  /* ---------- Zählen ---------- */
  var zaehlen = true, gesehen = {};
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      var id = e.target.getAttribute('data-anzeige'); io.unobserve(e.target);
      if (zaehlen && !gesehen[id]) { gesehen[id] = true; BSN.anzeigeZaehlen(id, 'gesehen'); }
    });
  }, { threshold: 0.5 }) : null;
  function beobachten(el) { if (io) io.observe(el); return el; }
  function klick(e) {
    var a = e.target.closest && e.target.closest('a[data-anzeige]');
    if (!a || (e.type === 'auxclick' && e.button !== 1)) return;
    if (zaehlen) BSN.anzeigeZaehlen(a.getAttribute('data-anzeige'), 'klick');
  }
  document.addEventListener('click', klick);
  document.addEventListener('auxclick', klick);

  /* Anzeigen-Kacheln setzt die Startseite selbst (home.js) – hier nur noch zum Zählen anmelden */
  function kacheln() {
    document.querySelectorAll('#boardGrid [data-anzeige]:not([data-beobachtet])').forEach(function (el) { el.setAttribute('data-beobachtet', ''); beobachten(el); });
  }
  function setzen() { kacheln(); artikel(); termine(); }
  function start() {
    Promise.all([BSN.aktiveAnzeigen(), BSN.getUser().catch(function () { return null; })]).then(function (r) {
      list = r[0] || []; zaehlen = !r[1]; // die eigene Redaktion zählt nicht mit
      if (!list.length) return;
      partner(); setzen();
      var main = document.querySelector('main');
      if (main) new MutationObserver(setzen).observe(main, { childList: true, subtree: true });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

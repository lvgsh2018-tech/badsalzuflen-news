/* Blaulicht: Liste aller Meldungen oder eine einzelne (blaulicht.html?m=<Nummer bei presseportal> bzw. fw-<Nummer> bei der Feuerwehr).
   Auf den festen Seiten unter blaulicht/ steht die Meldung schon im HTML (data-id nennt die Nummer). */
(function () {
  var R = window.BSNR;
  var built = document.getElementById('bl-article').getAttribute('data-id');
  var sid = built || new URLSearchParams(location.search).get('m');

  function when(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) + ', ' +
      d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
  }
  /* Feuerwehr-Berichte tragen „fw-“ vor der Nummer, alles andere kommt von der Polizei */
  function istFw(m) { return /^fw-/.test(m.source_id || ''); }
  function quelle(m) {
    return istFw(m)
      ? { name: m.source_name || 'Feuerwehr Bad Salzuflen', seite: 'feuerwehrbadsalzuflen.de',
          url: /^https:\/\/www\.feuerwehrbadsalzuflen\.de\//i.test(m.source_url || '') ? m.source_url : 'https://www.feuerwehrbadsalzuflen.de/einsatzberichte/' }
      : { name: m.source_name || 'Polizei Lippe', seite: 'presseportal.de',
          url: /^https:\/\/(www\.)?presseportal\.de\//i.test(m.source_url || '') ? m.source_url : 'https://www.presseportal.de/blaulicht/nr/12727' };
  }
  /* Vorschau nicht mitten im Wort abschneiden */
  function teaser(t) { t = String(t || ''); return t.length < 200 ? t : t.replace(/\s+\S*$/, '') + ' …'; }

  function item(m) {
    return '<a class="bl-item" href="' + R.blUrl(m) + '"><div class="bl-meta"><span class="tag tag-dark">' + R.esc(R.ort(m.place)) + '</span>' +
      '<span class="bl-von">' + (istFw(m) ? 'Feuerwehr' : 'Polizei') + '</span>' +
      '<time datetime="' + R.esc(m.published_at) + '">' + R.esc(when(m.published_at)) + '</time></div>' +
      '<h3>' + R.esc(m.title) + '</h3><p>' + R.esc(teaser(m.teaser)) + '</p></a>';
  }

  function showList() {
    var box = document.getElementById('bl-list');
    BSN.listBlaulicht().then(function (list) {
      list = list.filter(function (m) { return !m.hidden; });
      if (!list.length) { box.innerHTML = '<p class="posts-note">Aktuell gibt es keine Meldungen von Polizei oder Feuerwehr aus Bad Salzuflen.</p>'; return; }
      box.innerHTML = list.map(item).join('');
    }).catch(function () { box.innerHTML = '<p class="posts-note">Die Meldungen lassen sich gerade nicht laden.</p>'; });
  }

  function showOne() {
    document.getElementById('liste').hidden = true;
    document.getElementById('einzeln').hidden = false;
    var box = document.getElementById('bl-article');
    BSN.getBlaulicht(sid).then(function (m) {
      if (!m || m.hidden) {
        /* Zurückgezogene Meldung: auch Suchmaschinen sollen sie vergessen */
        var r = document.createElement('meta'); r.name = 'robots'; r.content = 'noindex'; document.head.appendChild(r);
        document.title = 'Meldung nicht gefunden — Bad Salzuflen News';
        box.innerHTML = '<h1>Meldung nicht gefunden</h1><p>Vielleicht ist sie nicht mehr verfügbar. <a href="blaulicht.html">Zu allen Blaulicht-Meldungen</a></p>'; return;
      }
      if (built) return;
      document.title = m.title + ' — Blaulicht — Bad Salzuflen News';
      var q = quelle(m);
      box.innerHTML = '<span class="tag tag-dark">' + R.esc(m.place) + '</span>' +
        '<h1>' + R.esc(m.title) + '</h1>' +
        '<p class="article-meta">' + R.esc(q.name) + ' · <time datetime="' + R.esc(m.published_at) + '">' + R.esc(when(m.published_at)) + '</time></p>' +
        '<div class="article-body">' + R.sanitize(m.body) + '</div>' +
        '<p class="bl-source"><strong>Quelle:</strong> ' + R.esc(q.name) + ', ' + q.seite + ' — ' +
        '<a href="' + R.esc(q.url) + '" target="_blank" rel="noopener noreferrer">' + R.esc(q.url) + '</a></p>';
    }).catch(function () { if (!built) box.innerHTML = '<p class="posts-note">Die Meldung lässt sich gerade nicht laden.</p>'; });
  }

  if (sid) showOne(); else showList();
  R.demoBadge();
})();

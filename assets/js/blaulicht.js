/* Blaulicht: Liste aller Meldungen oder eine einzelne (blaulicht.html?m=<Nummer bei presseportal>). */
(function () {
  var R = window.BSNR;
  var sid = new URLSearchParams(location.search).get('m');

  function when(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' }) + ', ' +
      d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
  }
  function safeUrl(u) { return /^https:\/\/(www\.)?presseportal\.de\//i.test(u || '') ? u : 'https://www.presseportal.de/blaulicht/nr/12727'; }
  /* Vorschau nicht mitten im Wort abschneiden */
  function teaser(t) { t = String(t || ''); return t.length < 200 ? t : t.replace(/\s+\S*$/, '') + ' …'; }
  function url(m) { return 'blaulicht.html?m=' + encodeURIComponent(m.source_id); }

  function item(m) {
    return '<a class="bl-item" href="' + url(m) + '"><div class="bl-meta"><span class="tag tag-dark">' + R.esc(m.place) + '</span>' +
      '<time datetime="' + R.esc(m.published_at) + '">' + R.esc(when(m.published_at)) + '</time></div>' +
      '<h3>' + R.esc(m.title) + '</h3><p>' + R.esc(teaser(m.teaser)) + '</p></a>';
  }

  function showList() {
    var box = document.getElementById('bl-list');
    BSN.listBlaulicht().then(function (list) {
      list = list.filter(function (m) { return !m.hidden; });
      if (!list.length) { box.innerHTML = '<p class="posts-note">Aktuell gibt es keine Polizeimeldungen aus Bad Salzuflen.</p>'; return; }
      box.innerHTML = list.map(item).join('');
    }).catch(function () { box.innerHTML = '<p class="posts-note">Die Meldungen lassen sich gerade nicht laden.</p>'; });
  }

  function showOne() {
    document.getElementById('liste').hidden = true;
    document.getElementById('einzeln').hidden = false;
    var box = document.getElementById('bl-article');
    BSN.getBlaulicht(sid).then(function (m) {
      if (!m || m.hidden) { box.innerHTML = '<h1>Meldung nicht gefunden</h1><p>Vielleicht ist sie nicht mehr verfügbar. <a href="blaulicht.html">Zu allen Blaulicht-Meldungen</a></p>'; return; }
      document.title = m.title + ' — Blaulicht — Bad Salzuflen News';
      var src = safeUrl(m.source_url);
      box.innerHTML = '<span class="tag tag-dark">' + R.esc(m.place) + '</span>' +
        '<h1>' + R.esc(m.title) + '</h1>' +
        '<p class="article-meta">' + R.esc(m.source_name || 'Polizei Lippe') + ' · <time datetime="' + R.esc(m.published_at) + '">' + R.esc(when(m.published_at)) + '</time></p>' +
        '<div class="article-body">' + R.sanitize(m.body) + '</div>' +
        '<p class="bl-source"><strong>Quelle:</strong> ' + R.esc(m.source_name || 'Polizei Lippe') + ', presseportal.de — ' +
        '<a href="' + R.esc(src) + '" target="_blank" rel="noopener noreferrer">' + R.esc(src) + '</a></p>';
    }).catch(function () { box.innerHTML = '<p class="posts-note">Die Meldung lässt sich gerade nicht laden.</p>'; });
  }

  if (sid) showOne(); else showList();
  R.demoBadge();
})();

/* Artikelseite. Gilt für artikel.html?s=… und für die festen Seiten unter beitrag/
   (dort steht der Beitrag schon fertig im HTML, damit Suchmaschinen und Link-Vorschauen ihn lesen können;
   data-slug nennt den Beitrag, data-stand den Stand, mit dem die Seite gebaut wurde). */
(function () {
  var R = window.BSNR, box = document.getElementById('article');
  var built = box.getAttribute('data-slug');
  var slug = built || new URLSearchParams(location.search).get('s');
  var robots = document.querySelector('meta[name=robots]');

  document.getElementById('jahr').textContent = new Date().getFullYear();
  var toggle = document.getElementById('navToggle'), nav = document.getElementById('mainNav');
  toggle.addEventListener('click', function () { toggle.setAttribute('aria-expanded', nav.classList.toggle('open')); });

  function missing() {
    document.title = 'Beitrag nicht gefunden — Bad Salzuflen News';
    robots.content = 'noindex';
    box.innerHTML = '<h1>Diesen Beitrag gibt es nicht</h1><p>Vielleicht wurde er entfernt oder der Link ist unvollständig.</p><a class="btn btn-primary" href="index.html">Zu allen Nachrichten</a>';
  }
  function html(a) {
    return (a.anzeige ? '<p class="ad-kennung"><span class="ad-label">Anzeige</span> Dieser Beitrag ist eine bezahlte Anzeige.</p>' : '') +
      '<span class="tag tag-dark">' + R.esc(a.category) + '</span><h1>' + R.esc(a.title) + '</h1>' +
      '<p class="article-meta">' + (a.published_at ? R.date(a.published_at) + ' · ' : '') + R.readMinutes(a.body) + ' Min. Lesezeit</p>' +
      (a.image_url ? '<figure><img src="' + R.esc(a.image_url) + '" alt="">' + (a.image_credit ? '<figcaption>' + R.esc(a.image_credit) + '</figcaption>' : '') + '</figure>' : '') +
      (a.teaser ? '<p class="article-lede">' + R.esc(a.teaser) + '</p>' : '') +
      '<div class="article-body">' + R.sanitize(a.body) + '</div>';
  }
  if (!slug) { missing(); return; }
  BSN.getUser().catch(function () { return null; }).then(function (u) {
    return BSN.getArticle(slug, { preview: !!u });
  }).then(function (a) {
    if (!a) { missing(); return; }
    var draft = a.status !== 'published';
    document.getElementById('previewFlag').hidden = !draft;
    document.title = a.title + ' — Bad Salzuflen News';
    if (draft) robots.content = 'noindex';
    /* Die feste Seite nur neu zeichnen, wenn der Beitrag seit dem Bau geändert wurde */
    if (!built || draft || box.getAttribute('data-stand') !== a.updated_at) box.innerHTML = html(a);
    if (draft) return;
    box.insertAdjacentHTML('beforeend', R.shareHTML(a));
    if (!built && R.hasPage(a)) {
      var c = document.createElement('link'); c.rel = 'canonical'; c.href = R.pageUrl(a); document.head.appendChild(c);
    }
    BSN.addView(a.id);
  }).catch(function () {
    /* Auf der festen Seite bleibt der Beitrag einfach stehen */
    if (!built) box.innerHTML = '<h1>Der Beitrag lässt sich gerade nicht laden</h1><p>Bitte versuche es gleich noch einmal.</p>';
  });
  R.demoBadge();
})();

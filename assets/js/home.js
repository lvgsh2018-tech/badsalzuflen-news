/* Startseite: Kachel-Tafel und filterbare Beitragsliste. */
(function () {
  var R = window.BSNR, all = [], filter = null, shown = 0, PAGE = 9, BOARD = 7;
  var grid = document.getElementById('boardGrid'), pg = document.getElementById('postGrid');
  var chips = document.getElementById('chips'), more = document.getElementById('moreBtn'), note = document.getElementById('postNote');

  /* Neueste Blaulicht-Meldung als feste Kachel (gleich neben der Titelkachel) */
  var BL_BILD = 'assets/img/blaulicht-kachel.jpg';
  function blaulichtTile() {
    if (!BSN.listBlaulicht) return Promise.resolve(null);
    return BSN.listBlaulicht().then(function (l) {
      var m = l.filter(function (x) { return !x.hidden; })[0];
      if (!m) return null;
      return { title: m.title, category: m.place || 'Blaulicht', image_url: BL_BILD, published_at: m.published_at,
        href: 'blaulicht.html?m=' + encodeURIComponent(m.source_id), blaulicht: true };
    }).catch(function () { return null; });
  }

  function board(list, bl) {
    if (bl) {
      if (!list.length) list = [bl];
      else { var f = list.filter(function (a) { return a.featured; })[0] || list[0]; list = [f, bl].concat(list.filter(function (a) { return a !== f; })); }
    }
    if (!list.length) {
      grid.innerHTML = '<div class="board-empty"><h2>Bald gibt es hier Neuigkeiten</h2><p>Sobald der erste Beitrag erscheint, siehst du ihn an dieser Stelle.</p></div>';
      return;
    }
    var featured = list.filter(function (a) { return a.featured; })[0] || list[0];
    var rest = list.filter(function (a) { return a !== featured; }).slice(0, BOARD - 1);
    var html = '';
    /* Links die Titelkachel (doppelt hoch), rechts bis zu vier kleine, darunter bis zu zwei breite */
    if (!rest.length) html += R.tile(featured, 's12');
    else if (rest.length === 1) html += R.tile(featured, 's6') + R.tile(rest[0], 's6');
    else {
      html += R.tile(featured, 's6 tile--lead');
      var side = rest.slice(0, 4), low = rest.slice(4);
      var sw = side.length === 4 ? ['s3', 's3', 's3', 's3'] : side.length === 3 ? ['s6', 's3', 's3'] : ['s6', 's6'];
      side.forEach(function (a, i) { html += R.tile(a, sw[i]); });
      low.forEach(function (a) { html += R.tile(a, low.length === 1 ? 's12' : 's6'); });
    }
    grid.innerHTML = html;
    board.used = [featured].concat(rest);
  }

  function pool() {
    if (filter) return all.filter(function (a) { return a.category === filter; });
    return all;
  }
  function renderList(reset) {
    var p = pool();
    if (reset) { shown = 0; pg.innerHTML = ''; }
    var next = p.slice(shown, shown + PAGE);
    pg.insertAdjacentHTML('beforeend', next.map(R.card).join(''));
    shown += next.length;
    more.hidden = shown >= p.length;
    note.hidden = p.length > 0;
    if (!p.length) note.textContent = filter ? 'Zu diesem Thema gibt es noch keine Beiträge.' : '';
  }
  function renderChips() {
    var cats = BSN.categories.filter(function (c) { return all.some(function (a) { return a.category === c; }); });
    if (!cats.length) { chips.innerHTML = ''; return; }
    chips.innerHTML = ['Alle'].concat(cats).map(function (c) {
      var on = (c === 'Alle' && !filter) || c === filter;
      return '<button type="button" class="chip" data-c="' + R.esc(c) + '" aria-pressed="' + on + '">' + R.esc(c) + '</button>';
    }).join('');
  }
  chips.addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    filter = b.dataset.c === 'Alle' ? null : b.dataset.c;
    renderChips(); renderList(true);
  });
  more.addEventListener('click', function () { renderList(false); });

  Promise.all([BSN.listPublished(), blaulichtTile()]).then(function (r) {
    var list = r[0]; all = list; board(list, r[1]); renderChips(); renderList(true);
  }).catch(function (err) {
    grid.innerHTML = '<div class="board-empty"><h2>Die Beiträge lassen sich gerade nicht laden</h2><p>Bitte versuche es in ein paar Minuten noch einmal.</p></div>';
    if (window.console) console.error(err);
  });
  R.demoBadge();
})();

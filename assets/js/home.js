/* Startseite: Kachel-Tafel und filterbare Beitragsliste. */
(function () {
  var R = window.BSNR, all = [], filter = null, shown = 0, PAGE = 9, BOARD = 7;
  var grid = document.getElementById('boardGrid'), pg = document.getElementById('postGrid');
  var chips = document.getElementById('chips'), more = document.getElementById('moreBtn'), note = document.getElementById('postNote');

  /* Nur die neueste Blaulicht-Meldung läuft nach Datum zwischen den Beiträgen mit (nur auf der Kacheltafel) */
  var BL_BILD = 'assets/img/blaulicht.jpg#fp=40,30', FW_BILD = 'assets/img/feuerwehr.jpg#fp=40,50';
  /* Verspätet nachgeholte Meldungen (mehr als 3 Stunden nach Erscheinen geholt) stehen nur im Reiter „Blaulicht“ */
  function nachgeholt(m) { return Date.parse(m.created_at) - Date.parse(m.published_at) > 3 * 3600e3; }
  function blaulichtTiles() {
    if (!BSN.listBlaulicht) return Promise.resolve([]);
    return BSN.listBlaulicht().then(function (l) {
      return l.filter(function (x) { return !x.hidden && !nachgeholt(x); }).slice(0, 1).map(function (m) {
        return { title: m.title, category: R.ort(m.place) || 'Blaulicht', image_url: /^fw-/.test(m.source_id || '') ? FW_BILD : BL_BILD, published_at: m.published_at,
          href: R.blUrl(m), blaulicht: true };
      });
    }).catch(function () { return []; });
  }
  function time(a) { var t = Date.parse(a.published_at || a.created_at); return isNaN(t) ? 0 : t; }

  function mischen(l) { l = l.slice(); for (var i = l.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = l[i]; l[i] = l[j]; l[j] = t; } return l; }
  function istBl(a) { return !!a.blaulicht; }

  /* Mit Anzeigen-Kacheln: Anzeigen kommen zu den Beiträgen dazu, keine fällt weg und es gibt keine Obergrenze.
     Die erste kleine Anzeige sitzt oben rechts (nie direkt neben Blaulicht), alle weiteren bekommen eigene Reihen
     (vier kleine bzw. zwei breite), die mit den nächsten Beiträgen aufgefüllt werden. */
  function boardMitAnzeigen(featured, rest, articles, ads) {
    var A = window.BSNAnzeigen, klein = mischen(ads.filter(function (a) { return a.platz === 'kachel_klein'; }));
    var gross = mischen(ads.filter(function (a) { return a.platz === 'kachel_gross'; }));
    var side = rest.slice(0, 4), low = rest.slice(4);
    var queue = articles.filter(function (a) { return a !== featured && rest.indexOf(a) < 0; });
    function ad(a) { return { werbekachel: a }; }
    if (klein.length) {
      /* Die vier kleinen stehen 2 × 2: mit Blaulicht die Kachel schräg gegenüber, sonst die zweite */
      var bl = side.findIndex(istBl), best = -1;
      var abstand = function (i) { return Math.abs((i >> 1) - (bl >> 1)) + Math.abs((i & 1) - (bl & 1)); };
      if (bl < 0) best = Math.min(1, side.length - 1);
      else side.forEach(function (a, i) { if (!istBl(a) && (best < 0 || abstand(i) > abstand(best))) best = i; });
      queue.unshift(side[best]); side[best] = ad(klein.shift());
    }
    function fuellen() { return queue.shift(); }
    var breit = [], kleinReihen = [], i, r;
    if (gross.length) {
      queue = low.concat(queue);
      for (i = 0; i < gross.length; i += 2) {
        r = gross.slice(i, i + 2).map(ad);
        if (r.length < 2 && queue.length) r.push(fuellen());
        breit.push(r);
      }
    } else if (low.length) breit.push(low);
    for (i = 0; i < klein.length; i += 4) {
      var ads4 = klein.slice(i, i + 4), row = [null, null, null, null];
      [1, 3, 0, 2].slice(0, ads4.length).forEach(function (pos, k) { row[pos] = ad(ads4[k]); });
      kleinReihen.push(row.map(function (x) { return x || fuellen(); }).filter(Boolean));
    }
    function kachel(x, cls) { return x.werbekachel ? A.html(x.werbekachel) : R.tile(x, cls); }
    var html = R.tile(featured, 's6 tile--lead') + side.map(function (x) { return kachel(x, 's3'); }).join('');
    for (i = 0; i < Math.max(breit.length, kleinReihen.length); i++) {
      if (breit[i]) html += breit[i].map(function (x) { return kachel(x, breit[i].length === 1 ? 's12' : 's6'); }).join('');
      if (kleinReihen[i]) html += kleinReihen[i].map(function (x) { return kachel(x, 's3'); }).join('');
    }
    return html;
  }

  function board(articles, bls, ads) {
    if (!articles.length && !bls.length) {
      grid.innerHTML = '<div class="board-empty"><h2>Bald gibt es hier Neuigkeiten</h2><p>Sobald der erste Beitrag erscheint, siehst du ihn an dieser Stelle.</p></div>';
      return;
    }
    /* Titelkachel bleibt ein Beitrag; alles andere rückt nach Datum nach */
    var top = articles.filter(function (a) { return a.featured; })[0] || articles[0] || bls[0];
    var featured = top;
    var rest = articles.concat(bls).filter(function (a) { return a !== top; })
      .sort(function (a, b) { return time(b) - time(a); }).slice(0, BOARD - 1);
    var tileAds = (ads || []).filter(function (a) { return /^kachel/.test(a.platz); });
    if (tileAds.length && window.BSNAnzeigen && rest.length >= 4) {
      grid.innerHTML = boardMitAnzeigen(featured, rest, articles, tileAds);
      board.used = [featured].concat(rest);
      return;
    }
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
    var cats = BSN.themen(all).filter(function (c) { return all.some(function (a) { return a.category === c; }); });
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

  var anzeigen = BSN.aktiveAnzeigen ? BSN.aktiveAnzeigen().catch(function () { return []; }) : Promise.resolve([]);
  Promise.all([BSN.listPublished(), blaulichtTiles(), anzeigen]).then(function (r) {
    var list = r[0]; all = list; board(list, r[1], r[2]); renderChips(); renderList(true);
  }).catch(function (err) {
    grid.innerHTML = '<div class="board-empty"><h2>Die Beiträge lassen sich gerade nicht laden</h2><p>Bitte versuche es in ein paar Minuten noch einmal.</p></div>';
    if (window.console) console.error(err);
  });
  R.demoBadge();
})();

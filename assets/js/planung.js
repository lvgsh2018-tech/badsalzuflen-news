/* Redaktionsbereich → Planung: die Contentplanung aus MeinOrbit.
   Kanäle (Instagram-Konten …) mit eigener Farbe, geplante Beiträge im
   Monatsraster, dazu „Als Nächstes“ und der Ideenspeicher (Beiträge ohne Datum).
   Die Farbe steht nie allein: in Listen steht immer der Kanalname daneben,
   „Fertig“ trägt zusätzlich einen Haken. */
(function () {
  'use strict';
  var esc = function (s) { return window.BSNR.esc(s == null ? '' : s); };

  var MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  var FORMAT = { post: 'Beitrag', reel: 'Reel', story: 'Story', karussell: 'Karussell', video: 'Video', text: 'Text' };
  var STAND = { idee: 'Idee', geplant: 'Geplant', fertig: 'Fertig' };
  var PLATTFORM = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', linkedin: 'LinkedIn',
    pinterest: 'Pinterest', newsletter: 'Newsletter', webseite: 'Webseite', sonstiges: 'Sonstiges' };
  var FARBE = { blau: 'Blau', tuerkis: 'Türkis', gruen: 'Grün', limette: 'Limette', gelb: 'Gelb',
    orange: 'Orange', rot: 'Rot', pink: 'Pink', lila: 'Lila', grau: 'Grau' };
  var FARBEN = Object.keys(FARBE);
  var STANDARDKANAL = 'Bad Salzuflen News';

  var heute = new Date(), jahr = heute.getFullYear(), monat = heute.getMonth(); // monat: 0–11
  var filter = [];               // leer = alle Kanäle
  var kanaele = [], beitraege = [], view, toast, ask, zieht = null;

  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function datumLang(s) { var d = new Date(s + 'T12:00'); return TAGE[d.getDay()] + ', ' + d.getDate() + '. ' + MONATE[d.getMonth()]; }
  function kurz(s) { return s.slice(8, 10) + '.' + s.slice(5, 7) + '.'; }
  function kanalVon(b) { return kanaele.filter(function (k) { return k.id === b.kanal_id; })[0] || null; }
  function farbeVon(b) { var k = kanalVon(b); return k && FARBE[k.farbe] ? k.farbe : 'grau'; }
  function nameVon(b) { var k = kanalVon(b); return k ? k.name : 'Ohne Kanal'; }
  function sichtbar(b) { return !filter.length || filter.indexOf(b.kanal_id) >= 0; }
  function sortiert(a, b) { return String(a.datum || '').localeCompare(String(b.datum || '')) || (a.uhrzeit ? 0 : 1) - (b.uhrzeit ? 0 : 1) || String(a.uhrzeit).localeCompare(String(b.uhrzeit)) || a.id - b.id; }

  function laden() {
    return Promise.all([BSN.listKanaele(), BSN.listPlanung()]).then(function (r) {
      kanaele = r[0]; beitraege = r[1].sort(sortiert);
      var ids = kanaele.map(function (k) { return k.id; });
      filter = filter.filter(function (id) { return ids.indexOf(id) >= 0; });
    });
  }

  /* Ein Beitrag als Kachel. mitKanal: Kanalname dazuschreiben (Listen); im Raster reicht die Farbe + Titel. */
  function kachel(b, mitKanal) {
    var info = nameVon(b) + ' · ' + (FORMAT[b.format] || b.format) + ' · ' + (STAND[b.status] || b.status) + (b.uhrzeit ? ' · ' + b.uhrzeit + ' Uhr' : '');
    return '<button type="button" class="cp-b f-' + farbeVon(b) + ' st-' + esc(b.status) + '" data-b="' + b.id + '" draggable="true"' +
      ' title="' + esc(info + '\n' + (b.titel || 'Ohne Titel')) + '" aria-label="' + esc((b.titel || 'Ohne Titel') + ', ' + info) + '">' +
      (mitKanal ? '<span class="cp-punkt" aria-hidden="true"></span>' : '') +
      (b.uhrzeit ? '<span class="cp-zeit">' + esc(b.uhrzeit) + '</span>' : '') +
      '<span class="cp-txt">' + esc(b.titel || 'Ohne Titel') + (mitKanal ? ' · ' + esc(nameVon(b)) : '') + '</span></button>';
  }

  /* ---------- Hauptansicht ---------- */
  function malen() {
    var erster = new Date(jahr, monat, 1), start = new Date(erster);
    start.setDate(1 - ((erster.getDay() + 6) % 7));        // Montag der ersten Woche
    var ende = new Date(jahr, monat + 1, 0);
    var letzter = new Date(ende); letzter.setDate(ende.getDate() + (7 - ((ende.getDay() + 6) % 7) - 1));
    var tage = [], d = new Date(start), heuteIso = iso(new Date());
    while (d <= letzter) { tage.push(iso(d)); d.setDate(d.getDate() + 1); }

    var nachTag = {};
    beitraege.forEach(function (b) { if (b.datum && sichtbar(b)) (nachTag[b.datum] = nachTag[b.datum] || []).push(b); });
    var eigen = beitraege.filter(function (b) { return b.datum && +b.datum.slice(0, 4) === jahr && +b.datum.slice(5, 7) === monat + 1; });
    var imMonat = eigen.filter(sichtbar);
    var stand = Object.keys(STAND).map(function (s) {
      var n = imMonat.filter(function (b) { return b.status === s; }).length; return n ? n + ' ' + STAND[s] : '';
    }).filter(Boolean).join(' · ');

    var bis = new Date(); bis.setDate(bis.getDate() + 21);
    var naechste = beitraege.filter(function (b) { return b.datum && b.datum >= heuteIso && b.datum <= iso(bis) && sichtbar(b); });
    var gruppen = [];
    naechste.forEach(function (b) {
      if (!gruppen.length || gruppen[gruppen.length - 1].datum !== b.datum) gruppen.push({ datum: b.datum, liste: [] });
      gruppen[gruppen.length - 1].liste.push(b);
    });
    var ideen = beitraege.filter(function (b) { return !b.datum && sichtbar(b); }).sort(function (a, b) { return b.id - a.id; });
    var aktive = kanaele.filter(function (k) { return k.aktiv; });

    var kopf = '<div class="cp-kopf"><div><h1>Planung</h1><p class="cp-unter">' +
      (kanaele.length ? imMonat.length + (imMonat.length === 1 ? ' Beitrag' : ' Beiträge') + ' im ' + MONATE[monat] + (stand ? ' · ' + stand : '') : 'Erst die Kanäle anlegen, dann lässt sich planen.') +
      '</p></div><div class="cp-aktionen"><button class="btn btn-secondary btn-sm" type="button" data-a="kanaele">Kanäle</button>' +
      '<button class="btn btn-primary btn-sm" type="button" data-a="neu"' + (aktive.length ? '' : ' disabled') + '>+ Neuer Beitrag</button></div></div>';

    if (!kanaele.length) {
      view.innerHTML = kopf + '<div class="panel"><p class="empty">Noch kein Kanal angelegt. Ein Kanal ist ein Konto, für das du planst – etwa ein Instagram-Profil. Jeder bekommt seine eigene Farbe.<br><br>' +
        '<button class="btn btn-primary btn-sm" type="button" data-a="kanal-neu">Ersten Kanal anlegen</button></p></div>';
      return;
    }

    var chips = aktive.map(function (k) {
      var n = eigen.filter(function (b) { return b.kanal_id === k.id; }).length, an = filter.indexOf(k.id) >= 0;
      return '<button type="button" class="cp-chip f-' + esc(k.farbe) + '" data-filter="' + k.id + '" aria-pressed="' + an + '">' +
        '<span class="cp-punkt" aria-hidden="true"></span>' + esc(k.name) + '<span class="cp-zahl">' + n + '</span></button>';
    }).join('') + (filter.length ? '<button type="button" class="btn-ghost" data-a="filter-weg">Filter aufheben</button>' : '');

    var raster = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(function (t) { return '<div class="cp-wt" aria-hidden="true">' + t + '</div>'; }).join('') +
      tage.map(function (t) {
        var liste = nachTag[t] || [], fremd = +t.slice(5, 7) !== monat + 1, nr = +t.slice(8, 10);
        return '<div class="cp-tag' + (fremd ? ' fremd' : '') + (t === heuteIso ? ' heute' : '') + (liste.length ? '' : ' leer') + '" data-tag="' + t + '">' +
          '<button type="button" class="cp-nr" data-neu="' + t + '" aria-label="' + esc(datumLang(t)) + ': neuer Beitrag" title="' + esc(datumLang(t)) + ' – neuer Beitrag">' +
          '<span class="cp-nr-kurz">' + nr + (fremd ? ' <small>' + MONATE[+t.slice(5, 7) - 1].slice(0, 3) + '</small>' : '') + '</span>' +
          '<span class="cp-nr-lang">' + esc(datumLang(t)) + '</span><span class="cp-plus" aria-hidden="true">+</span></button>' +
          liste.slice(0, 4).map(function (b) { return kachel(b); }).join('') +
          (liste.length > 4 ? '<button type="button" class="cp-mehr" data-tagliste="' + t + '">+ ' + (liste.length - 4) + ' weitere</button>' : '') +
          '</div>';
      }).join('');

    view.innerHTML = kopf +
      '<div class="cp-grid"><section class="panel cp-kal" aria-label="Monatsübersicht">' +
      '<div class="cp-monat"><button type="button" class="btn-ghost cp-pfeil" data-monat="-1" aria-label="Vorheriger Monat">‹</button>' +
      '<h2 aria-live="polite">' + MONATE[monat] + ' ' + jahr + '</h2>' +
      '<button type="button" class="btn-ghost cp-pfeil" data-monat="1" aria-label="Nächster Monat">›</button>' +
      '<button type="button" class="chip" data-a="heute">Heute</button></div>' +
      '<div class="cp-chips" role="group" aria-label="Nach Kanal filtern">' + chips + '</div>' +
      '<div class="cp-raster">' + raster + '</div>' +
      '<p class="cp-legende"><span>Farbe = Kanal.</span><span class="cp-b f-grau st-geplant cp-muster"><span class="cp-txt">Idee &amp; Geplant</span></span>' +
      '<span class="cp-b f-grau st-fertig cp-muster"><span class="cp-txt">Fertig</span></span>' +
      '<span class="cp-nur-gross">Zum Verschieben einen Beitrag auf einen anderen Tag ziehen – oder anklicken und das Datum ändern.</span></p></section>' +
      '<aside class="cp-seite"><section class="panel"><h2>Als Nächstes</h2>' +
      (gruppen.length ? gruppen.map(function (g) {
        return '<div class="cp-gruppe"><div class="cp-gtag">' + esc(datumLang(g.datum)) + '</div><div class="cp-stapel">' + g.liste.map(function (b) { return kachel(b, true); }).join('') + '</div></div>';
      }).join('') : '<p class="cp-hinweis">In den nächsten drei Wochen ist nichts eingeplant.</p>') + '</section>' +
      '<section class="panel"><h2>Ideenspeicher <span class="cp-anzahl">' + ideen.length + ' ohne Datum</span></h2>' +
      (ideen.length ? '<div class="cp-stapel">' + ideen.map(function (b) { return kachel(b, true); }).join('') + '</div>' +
        '<p class="cp-hinweis">Eine Idee bekommt ein Datum, sobald du sie anklickst und eins einträgst.</p>'
        : '<p class="cp-hinweis">Hier landen Beiträge ohne Datum. Lass beim Anlegen einfach das Datum leer.</p>') +
      '</section></aside></div>';
  }

  function neu() { return laden().then(malen).catch(function (x) { view.innerHTML = '<h1>Das hat nicht geklappt</h1><p>' + esc(x.message) + '</p>'; }); }

  /* ---------- Dialoge ---------- */
  var dlg;
  function fenster(titel, inhalt, knoepfe) {
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.className = 'dlg cp-dlg';
      document.body.appendChild(dlg);
    }
    dlg.onclick = null;                                   // Klick-Regeln des vorigen Fensters verwerfen
    dlg.innerHTML = '<h2>' + esc(titel) + '</h2>' + inhalt + '<div class="dlg-actions cp-dlg-knoepfe">' + knoepfe + '</div>';
    if (!dlg.open) dlg.showModal();
    return dlg;
  }
  function zu() { if (dlg && dlg.open) dlg.close(); }
  function optionen(obj, wert) {
    return Object.keys(obj).map(function (k) { return '<option value="' + k + '"' + (k === wert ? ' selected' : '') + '>' + obj[k] + '</option>'; }).join('');
  }

  function beitragDialog(id, vorgabeDatum) {
    var aktive = kanaele.filter(function (k) { return k.aktiv; });
    if (!aktive.length) { toast('Leg zuerst einen Kanal an.', true); return kanalDialog(); }
    var std = aktive.filter(function (k) { return k.name === STANDARDKANAL; })[0] || aktive[0];
    var b = id ? beitraege.filter(function (x) { return x.id === id; })[0] : null;
    if (id && !b) return;
    b = b || { kanal_id: std.id, titel: '', datum: vorgabeDatum === undefined ? iso(new Date()) : vorgabeDatum, uhrzeit: '', format: 'post', status: 'idee', text: '', notiz: '' };
    var liste = kanaele.filter(function (k) { return k.aktiv || k.id === b.kanal_id; });
    var d = fenster(id ? 'Beitrag bearbeiten' : 'Neuer Beitrag',
      '<form id="cpForm" novalidate><div class="cp-2">' +
      '<label class="field"><span>Kanal</span><select id="cpKanal">' + liste.map(function (k) {
        return '<option value="' + k.id + '"' + (k.id === b.kanal_id ? ' selected' : '') + '>' + esc(k.name) + ' · ' + esc(PLATTFORM[k.plattform] || k.plattform) + '</option>';
      }).join('') + (b.kanal_id ? '' : '<option value="" selected>Ohne Kanal</option>') + '</select></label>' +
      '<label class="field"><span>Worum geht es?</span><input id="cpTitel" value="' + esc(b.titel) + '" placeholder="Reel vom Kurpark-Dreh" required></label></div>' +
      '<p class="cp-farbhinweis" id="cpFarbe"></p>' +
      '<div class="cp-2"><label class="field"><span>Datum <small>(leer = Ideenspeicher)</small></span><input type="date" id="cpDatum" value="' + esc(b.datum || '') + '"></label>' +
      '<label class="field"><span>Uhrzeit</span><input type="time" id="cpZeit" value="' + esc(b.uhrzeit || '') + '"></label></div>' +
      '<div class="cp-2"><label class="field"><span>Format</span><select id="cpFormat">' + optionen(FORMAT, b.format || 'post') + '</select></label>' +
      '<label class="field"><span>Stand</span><select id="cpStand">' + optionen(STAND, b.status || 'idee') + '</select></label></div>' +
      '<label class="field"><span>Bildunterschrift</span><textarea id="cpText" rows="4" placeholder="Der Text, der später unter dem Beitrag steht.">' + esc(b.text || '') + '</textarea></label>' +
      '<label class="field"><span>Notiz für dich</span><input id="cpNotiz" value="' + esc(b.notiz || '') + '"></label>' +
      '<div class="form-error" id="cpErr" role="alert" hidden></div></form>',
      (id ? '<button type="button" class="btn-ghost cp-loeschen" data-d="loeschen">Löschen</button><span class="cp-wachs"></span>' : '') +
      '<button type="button" class="btn btn-secondary btn-sm" data-d="zu">Abbrechen</button>' +
      '<button type="button" class="btn btn-primary btn-sm" data-d="speichern">Speichern</button>');
    var wahl = d.querySelector('#cpKanal');
    function farbeZeigen() {
      var k = kanaele.filter(function (x) { return String(x.id) === wahl.value; })[0], f = k ? k.farbe : 'grau';
      d.querySelector('#cpFarbe').innerHTML = '<span class="cp-punkt f-' + esc(f) + '" aria-hidden="true"></span>Erscheint im Kalender in ' + esc(FARBE[f] || f) + '.';
    }
    wahl.addEventListener('change', farbeZeigen); farbeZeigen();
    if (!id) d.querySelector('#cpTitel').focus();
    d.querySelector('#cpForm').addEventListener('submit', function (e) { e.preventDefault(); speichern(); });
    d.querySelector('.cp-dlg-knoepfe').onclick = function (e) {
      var a = e.target.closest('[data-d]'); if (!a) return;
      if (a.dataset.d === 'zu') zu();
      if (a.dataset.d === 'speichern') speichern();
      if (a.dataset.d === 'loeschen') {
        zu();
        ask({ title: 'Beitrag löschen?', text: '„' + (b.titel || 'Ohne Titel') + '“ wird aus der Planung entfernt.', yes: 'Löschen', danger: true }).then(function (ok) {
          if (ok) BSN.deletePlan(id).then(function () { toast('Beitrag gelöscht.'); return neu(); }).catch(function (x) { toast(x.message, true); });
        });
      }
    };
    function speichern() {
      var rec = { kanal_id: wahl.value ? +wahl.value : null, titel: d.querySelector('#cpTitel').value.trim(), datum: d.querySelector('#cpDatum').value || null,
        uhrzeit: d.querySelector('#cpZeit').value, format: d.querySelector('#cpFormat').value, status: d.querySelector('#cpStand').value,
        text: d.querySelector('#cpText').value, notiz: d.querySelector('#cpNotiz').value.trim() };
      var err = d.querySelector('#cpErr');
      if (!rec.titel) { err.textContent = 'Der Beitrag braucht einen Titel.'; err.hidden = false; d.querySelector('#cpTitel').focus(); return; }
      if (id) rec.id = id;
      d.querySelectorAll('.cp-dlg-knoepfe button').forEach(function (x) { x.disabled = true; });
      BSN.savePlan(rec).then(function () {
        zu(); toast('Beitrag gespeichert.');
        if (rec.datum) { jahr = +rec.datum.slice(0, 4); monat = +rec.datum.slice(5, 7) - 1; }
        return neu();
      }).catch(function (x) { err.textContent = x.message; err.hidden = false; d.querySelectorAll('.cp-dlg-knoepfe button').forEach(function (y) { y.disabled = false; }); });
    }
  }

  function tagDialog(t) {
    var liste = beitraege.filter(function (b) { return b.datum === t && sichtbar(b); });
    var d = fenster(datumLang(t), '<div class="cp-stapel">' + liste.map(function (b) { return kachel(b, true); }).join('') + '</div>',
      '<button type="button" class="btn btn-secondary btn-sm" data-d="zu">Schließen</button><button type="button" class="btn btn-primary btn-sm" data-d="neu">Beitrag an diesem Tag</button>');
    d.onclick = function (e) {
      var k = e.target.closest('[data-b]'); if (k) { beitragDialog(+k.dataset.b); return; }
      var a = e.target.closest('[data-d]'); if (!a) return;
      if (a.dataset.d === 'zu') zu(); else beitragDialog(null, t);
    };
  }

  function kanaeleDialog() {
    var anzahl = function (k) { return beitraege.filter(function (b) { return b.kanal_id === k.id; }).length; };
    var d = fenster('Kanäle', kanaele.length ? '<div class="cp-kanalliste">' + kanaele.map(function (k) {
      var n = anzahl(k);
      return '<div class="cp-kanal f-' + esc(k.farbe) + (k.aktiv ? '' : ' still') + '"><span class="cp-balken" aria-hidden="true"></span><div class="cp-wachs">' +
        '<b>' + esc(k.name) + (k.aktiv ? '' : ' · stillgelegt') + '</b><small>' + esc(PLATTFORM[k.plattform] || k.plattform) + ' · ' + n + (n === 1 ? ' Beitrag' : ' Beiträge') + ' · ' + esc(FARBE[k.farbe] || k.farbe) + '</small></div>' +
        '<button type="button" class="btn-ghost" data-k="' + k.id + '">Bearbeiten</button>' +
        '<button type="button" class="btn-ghost del" data-kdel="' + k.id + '">Löschen</button></div>';
    }).join('') + '</div>' : '<p class="cp-hinweis">Noch kein Kanal angelegt.</p>',
      '<button type="button" class="btn btn-secondary btn-sm" data-d="neu">+ Kanal hinzufügen</button><span class="cp-wachs"></span><button type="button" class="btn btn-primary btn-sm" data-d="zu">Fertig</button>');
    d.onclick = function (e) {
      var b = e.target.closest('[data-k]'); if (b) return kanalDialog(+b.dataset.k);
      var del = e.target.closest('[data-kdel]');
      if (del) {
        var k = kanaele.filter(function (x) { return x.id === +del.dataset.kdel; })[0], n = anzahl(k);
        zu();
        ask({ title: 'Kanal löschen?', text: '„' + k.name + '“ wird entfernt.' + (n ? ' ' + (n === 1 ? 'Der geplante Beitrag bleibt' : 'Die ' + n + ' geplanten Beiträge bleiben') + ' stehen, danach aber ohne Kanal.' : ''), yes: 'Löschen', danger: true }).then(function (ok) {
          if (!ok) return kanaeleDialog();
          BSN.deleteKanal(k.id).then(function () { toast('Kanal gelöscht.'); return neu(); }).then(kanaeleDialog).catch(function (x) { toast(x.message, true); });
        });
        return;
      }
      var a = e.target.closest('[data-d]'); if (!a) return;
      if (a.dataset.d === 'zu') zu(); else kanalDialog();
    };
  }

  function kanalDialog(id) {
    var k = id ? kanaele.filter(function (x) { return x.id === id; })[0] : { name: '', plattform: 'instagram', notiz: '', aktiv: true };
    var belegt = kanaele.filter(function (x) { return x.id !== id; }).map(function (x) { return x.farbe; });
    var farbe = k.farbe || FARBEN.filter(function (f) { return belegt.indexOf(f) < 0; })[0] || 'blau';
    var d = fenster(id ? 'Kanal bearbeiten' : 'Neuer Kanal',
      '<form id="cpKForm" novalidate><div class="cp-2"><label class="field"><span>Name</span><input id="kName" value="' + esc(k.name) + '" placeholder="@badsalzuflen_bilder"></label>' +
      '<label class="field"><span>Wo?</span><select id="kPlatt">' + optionen(PLATTFORM, k.plattform || 'instagram') + '</select></label></div>' +
      '<div class="field"><span id="kFarbeLabel">Farbe im Kalender</span><div class="cp-farbwahl" role="radiogroup" aria-labelledby="kFarbeLabel">' +
      FARBEN.map(function (f) {
        return '<button type="button" role="radio" class="f-' + f + (belegt.indexOf(f) >= 0 ? ' belegt' : '') + '" data-farbe="' + f + '" aria-checked="' + (f === farbe) + '" aria-label="' + FARBE[f] + (belegt.indexOf(f) >= 0 ? ', schon vergeben' : '') + '" title="' + FARBE[f] + '"></button>';
      }).join('') + '</div><p class="cp-farbhinweis" id="kHinweis"></p></div>' +
      '<label class="field"><span>Notiz</span><input id="kNotiz" value="' + esc(k.notiz || '') + '"></label>' +
      '<label class="check"><input type="checkbox" id="kAktiv"' + (k.aktiv ? ' checked' : '') + '> Kanal wird aktiv bespielt</label>' +
      '<div class="form-error" id="kErr" role="alert" hidden></div></form>',
      '<button type="button" class="btn btn-secondary btn-sm" data-d="zurueck">Zurück</button><span class="cp-wachs"></span><button type="button" class="btn btn-primary btn-sm" data-d="speichern">Speichern</button>');
    function farbeSetzen(f) {
      farbe = f;
      d.querySelectorAll('[data-farbe]').forEach(function (b) { b.setAttribute('aria-checked', b.dataset.farbe === f); });
      d.querySelector('#kHinweis').textContent = FARBE[f] + (belegt.indexOf(f) >= 0 ? ' – die hat schon ein anderer Kanal. Geht, ist aber schwerer auseinanderzuhalten.' : ' – noch frei.');
    }
    farbeSetzen(farbe);
    d.onclick = function (e) {
      var fb = e.target.closest('[data-farbe]'); if (fb) return farbeSetzen(fb.dataset.farbe);
      var a = e.target.closest('[data-d]'); if (!a) return;
      if (a.dataset.d === 'zurueck') return kanaeleDialog();
      var rec = { name: d.querySelector('#kName').value.trim(), plattform: d.querySelector('#kPlatt').value, farbe: farbe,
        notiz: d.querySelector('#kNotiz').value.trim(), aktiv: d.querySelector('#kAktiv').checked };
      if (!rec.name) { var err = d.querySelector('#kErr'); err.textContent = 'Der Kanal braucht einen Namen.'; err.hidden = false; return; }
      if (id) rec.id = id;
      BSN.saveKanal(rec).then(function () { toast('Kanal gespeichert.'); return neu(); }).then(kanaeleDialog).catch(function (x) { toast(x.message, true); });
    };
  }

  /* ---------- Bedienung ---------- */
  function binden() {
    view.onclick = function (e) {
      var t;
      if ((t = e.target.closest('[data-b]'))) return beitragDialog(+t.dataset.b);
      if ((t = e.target.closest('[data-neu]'))) return beitragDialog(null, t.dataset.neu);
      if ((t = e.target.closest('[data-tagliste]'))) return tagDialog(t.dataset.tagliste);
      if ((t = e.target.closest('[data-monat]'))) { monat += +t.dataset.monat; if (monat < 0) { monat = 11; jahr--; } if (monat > 11) { monat = 0; jahr++; } return malen(); }
      if ((t = e.target.closest('[data-filter]'))) {
        var id = +t.dataset.filter; filter = filter.indexOf(id) >= 0 ? filter.filter(function (x) { return x !== id; }) : filter.concat(id); return malen();
      }
      if (!(t = e.target.closest('[data-a]'))) {
        // Klick auf freie Fläche eines Tages = neuer Beitrag an diesem Tag
        var tag = e.target.closest('.cp-tag'); if (tag && e.target === tag) beitragDialog(null, tag.dataset.tag);
        return;
      }
      var a = t.dataset.a;
      if (a === 'neu') beitragDialog();
      if (a === 'kanaele') kanaeleDialog();
      if (a === 'kanal-neu') kanalDialog();
      if (a === 'filter-weg') { filter = []; malen(); }
      if (a === 'heute') { jahr = new Date().getFullYear(); monat = new Date().getMonth(); malen(); }
    };
    /* Verschieben per Ziehen (nur mit Maus; ohne Ziehen geht's über das Datum im Fenster) */
    view.ondragstart = function (e) {
      var k = e.target.closest && e.target.closest('[data-b]'); if (!k) return;
      zieht = +k.dataset.b; e.dataTransfer.setData('text/plain', String(zieht)); e.dataTransfer.effectAllowed = 'move';
    };
    view.ondragover = function (e) {
      var tag = e.target.closest && e.target.closest('.cp-tag'); if (!tag || zieht == null) return;
      e.preventDefault();
      view.querySelectorAll('.cp-tag.drueber').forEach(function (x) { if (x !== tag) x.classList.remove('drueber'); });
      tag.classList.add('drueber');
    };
    view.ondragend = function () { zieht = null; view.querySelectorAll('.cp-tag.drueber').forEach(function (x) { x.classList.remove('drueber'); }); };
    view.ondrop = function (e) {
      var tag = e.target.closest && e.target.closest('.cp-tag'), id = zieht; if (!tag || id == null) return;
      e.preventDefault(); zieht = null;
      var b = beitraege.filter(function (x) { return x.id === id; })[0], t = tag.dataset.tag;
      if (!b || b.datum === t) return malen();
      var alt = b.datum; b.datum = t; malen();               // sofort zeigen, dann speichern
      BSN.savePlan({ id: id, datum: t }).then(function () { toast('Auf den ' + kurz(t) + ' verschoben.'); })
        .catch(function (x) { b.datum = alt; malen(); toast(x.message, true); });
    };
  }

  window.BSNPlanung = {
    zeigen: function (v, t, a) {
      view = v; toast = t; ask = a; binden();
      view.innerHTML = '<h1>Planung</h1><p class="cp-unter">Wird geladen …</p>';
      return neu();
    }
  };
})();

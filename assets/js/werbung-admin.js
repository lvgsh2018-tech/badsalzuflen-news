/* Redaktionsbereich → Werbung: Anzeigen der Werbepartner anlegen, zeitlich steuern, pausieren
   und auswerten. Die Webseite zeigt eine Anzeige vom ersten bis zum letzten Tag von selbst
   (assets/js/anzeigen.js); gezählt wird „gesehen“ und „angeklickt“. Speicher: supabase/werbung.sql.
   Seiten: #werbung (Übersicht), #anzeige/neu, #anzeige/<id>, #anzeige/<id>/bericht (zum Drucken für Kunden). */
(function () {
  'use strict';
  var R = window.BSNR, esc = R.esc, A = window.BSNAnzeigen;
  var PLAETZE = A.PLAETZE;
  var WO = {
    kachel_klein: 'Quadratische Kachel zwischen den Beiträgen auf der Startseite. Jede weitere Anzeige bekommt einen eigenen Platz, die Kacheltafel wird dann länger.',
    kachel_gross: 'Breite Kachel (doppelt so groß) auf der Kacheltafel der Startseite. Jede weitere Anzeige bekommt einen eigenen Platz.',
    artikel: 'Unter jedem Beitrag, direkt über „Beitrag teilen“. Mehrere Anzeigen stehen untereinander. Nie bei Blaulicht-Meldungen.',
    termine: 'Oben im Reiter „Termine“: „Termine präsentiert von …“. Mehrere Anzeigen stehen untereinander.',
    partner: 'Leiste „Unsere Partner aus Bad Salzuflen“ unten auf Startseite, Beiträgen und Terminen.'
  };
  var MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var view, toast, ask, setDirty, anzeigen = [], stat = [], filter = 'alle';

  /* ---------- Hilfen ---------- */
  function heute() { return R.todayIso(); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function plusTage(s, n) { var d = R.day(s); d.setDate(d.getDate() + n); return iso(d); }
  /* Laufzeit in Monaten: vom Starttag bis einen Tag vor demselben Tag n Monate später */
  function plusMonate(s, n) { var d = R.day(s); d.setMonth(d.getMonth() + n); d.setDate(d.getDate() - 1); return iso(d); }
  function tageBis(s) { return Math.round((R.day(s) - R.day(heute())) / 864e5); }
  function de(s) { return s ? s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4) : ''; }
  function kurz(s) { return s.slice(8, 10) + '.' + s.slice(5, 7) + '.'; }
  function zeitraum(a) { return de(a.start_am) + ' – ' + de(a.ende_am); }
  function zahl(n) { return Number(n || 0).toLocaleString('de-DE'); }
  function rate(k, g) { return g ? (k / g * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' %' : '–'; }

  function stand(a) {
    var t = heute();
    if (a.pausiert) return 'pausiert';
    if (a.ende_am < t) return 'abgelaufen';
    if (a.start_am > t) return 'geplant';
    return 'laeuft';
  }
  function badge(a) {
    var s = stand(a);
    var txt = { laeuft: 'Läuft', geplant: 'Startet ' + kurz(a.start_am), abgelaufen: 'Abgelaufen', pausiert: 'Pausiert' }[s];
    var cls = { laeuft: 'live', geplant: 'draft', abgelaufen: 'alt', pausiert: 'off' }[s];
    return '<span class="badge ' + cls + '">' + txt + '</span>';
  }
  function summe(id, von, bis) {
    return stat.reduce(function (r, z) {
      if ((!id || z.id === id) && (!von || z.tag >= von) && (!bis || z.tag <= bis)) { r.g += +z.gesehen || 0; r.k += +z.klick || 0; }
      return r;
    }, { g: 0, k: 0 });
  }
  function ueberschneidet(a, b) { return a.start_am <= b.ende_am && b.start_am <= a.ende_am; }
  function fehler(x) {
    var m = String(x && x.message || x);
    if (/anzeigen|relation|function|does not exist|schema cache/i.test(m)) {
      return '<h1>Werbung</h1><div class="panel"><h2>Der Speicher für Anzeigen ist noch nicht eingerichtet</h2>' +
        '<p>Einmal in Supabase den Inhalt von <code>supabase/werbung.sql</code> im „SQL Editor“ einfügen und auf „Run“ klicken. Danach diese Seite neu laden.</p></div>';
    }
    return '<h1>Das hat nicht geklappt</h1><p>' + esc(m) + '</p>';
  }
  function laden() {
    return Promise.all([BSN.listAnzeigen(), BSN.anzeigenStatistik().catch(function () { return []; })])
      .then(function (r) { anzeigen = r[0] || []; stat = r[1] || []; });
  }

  /* ---------- Übersicht ---------- */
  function seiteUebersicht() {
    var t = heute(), vor30 = plusTage(t, -29);
    var laufend = anzeigen.filter(function (a) { return stand(a) === 'laeuft'; });
    var bald = laufend.filter(function (a) { return tageBis(a.ende_am) <= 14; }).sort(function (a, b) { return a.ende_am.localeCompare(b.ende_am); });
    var s30 = summe(null, vor30, t);
    var rows = anzeigen.filter(function (a) { return filter === 'alle' || stand(a) === filter; })
      .sort(function (a, b) {
        var o = { laeuft: 0, geplant: 1, pausiert: 2, abgelaufen: 3 };
        return o[stand(a)] - o[stand(b)] || (stand(a) === 'abgelaufen' ? b.ende_am.localeCompare(a.ende_am) : a.start_am.localeCompare(b.start_am));
      });

    view.innerHTML = '<div class="wa-kopf"><h1>Werbung</h1><a class="btn btn-primary" href="#anzeige/neu">+ Neue Anzeige</a></div>' +
      '<p class="wa-hilfe">Eine Anzeige erscheint am ersten Tag von selbst auf der Webseite und verschwindet nach dem letzten Tag. Deine eigenen Besuche zählen nicht mit.</p>' +
      '<div class="stat-grid">' +
      '<div class="stat"><strong>' + laufend.length + '</strong><span>Anzeigen laufen gerade</span></div>' +
      '<div class="stat"><strong>' + zahl(s30.g) + '</strong><span>Mal gesehen, letzte 30 Tage</span></div>' +
      '<div class="stat"><strong>' + zahl(s30.k) + '</strong><span>Klicks, letzte 30 Tage</span></div>' +
      '<div class="stat"><strong>' + bald.length + '</strong><span>Laufen in 14 Tagen aus</span></div></div>' +
      (bald.length ? '<section class="panel wa-bald"><h2>Läuft bald aus: Kunden wegen Verlängerung fragen</h2><ul class="rank">' + bald.map(function (a) {
        var n = tageBis(a.ende_am);
        return '<li><a href="#anzeige/' + esc(a.id) + '">' + esc(a.firma) + ' · ' + esc(PLAETZE[a.platz]) + '</a><span>' +
          (n === 0 ? 'heute letzter Tag' : n === 1 ? 'morgen letzter Tag' : 'noch ' + n + ' Tage, bis ' + kurz(a.ende_am)) + '</span></li>';
      }).join('') + '</ul></section>' : '') +
      '<div class="panel-cols wa-cols"><section class="panel"><h2>Plätze heute</h2><ul class="wa-plaetze">' + Object.keys(PLAETZE).map(function (p) {
        var jetzt = laufend.filter(function (a) { return a.platz === p; });
        var next = anzeigen.filter(function (a) { return a.platz === p && stand(a) === 'geplant'; }).sort(function (a, b) { return a.start_am.localeCompare(b.start_am); })[0];
        return '<li><strong>' + esc(PLAETZE[p]) + '</strong><span>' +
          (jetzt.length ? jetzt.map(function (a) { return esc(a.firma); }).join(', ') : '<em>frei</em>') +
          (next ? ' · ab ' + kurz(next.start_am) + ': ' + esc(next.firma) : '') + '</span></li>';
      }).join('') + '</ul></section>' +
      '<section class="panel"><h2>Gesehen pro Tag (14 Tage)</h2>' + balken(null, plusTage(t, -13), t) + '</section></div>' +
      '<section class="panel"><h2>Alle Anzeigen</h2><div class="list-tools" role="group" aria-label="Filtern">' +
      [['alle', 'Alle'], ['laeuft', 'Läuft'], ['geplant', 'Geplant'], ['pausiert', 'Pausiert'], ['abgelaufen', 'Abgelaufen']].map(function (f) {
        return '<button class="chip" type="button" data-wf="' + f[0] + '" aria-pressed="' + (filter === f[0]) + '">' + f[1] + '</button>';
      }).join('') + '</div><div class="table-wrap">' +
      (rows.length ? '<table class="posts"><thead><tr><th>Anzeige</th><th>Platz</th><th>Zeitraum</th><th>Stand</th><th>Gesehen</th><th>Klicks</th><th><span class="sr-only">Aktionen</span></th></tr></thead><tbody>' +
        rows.map(function (a) {
          var s = summe(a.id);
          return '<tr><td class="t"><a href="#anzeige/' + esc(a.id) + '">' + esc(a.firma) + '</a>' + (a.titel ? '<small class="wa-sub">' + esc(a.titel) + '</small>' : '') + '</td>' +
            '<td>' + esc(PLAETZE[a.platz]) + '</td><td class="wa-nowrap">' + zeitraum(a) + '</td><td>' + badge(a) + '</td>' +
            '<td>' + zahl(s.g) + '</td><td>' + zahl(s.k) + '</td>' +
            '<td><div class="row-actions"><a class="btn-ghost" href="#anzeige/' + esc(a.id) + '">Bearbeiten</a>' +
            '<a class="btn-ghost" href="#anzeige/' + esc(a.id) + '/bericht">Bericht</a>' +
            (stand(a) === 'abgelaufen' ? '' : '<button class="btn-ghost" type="button" data-wpause="' + esc(a.id) + '">' + (a.pausiert ? 'Fortsetzen' : 'Pausieren') + '</button>') +
            '</div></td></tr>';
        }).join('') + '</tbody></table>'
        : '<p class="empty">' + (anzeigen.length ? 'In dieser Auswahl ist keine Anzeige.' : 'Noch keine Anzeige angelegt. <a href="#anzeige/neu">Leg die erste an.</a>') + '</p>') +
      '</div></section>';

    view.onclick = function (e) {
      var f = e.target.closest('[data-wf]'); if (f) { filter = f.dataset.wf; seiteUebersicht(); return; }
      var p = e.target.closest('[data-wpause]');
      if (p) {
        var a = finde(p.dataset.wpause); p.disabled = true;
        BSN.saveAnzeige({ id: a.id, pausiert: !a.pausiert }).then(laden).then(function () {
          toast(a.pausiert ? 'Anzeige läuft wieder.' : 'Anzeige ist pausiert und verschwindet von der Webseite.'); seiteUebersicht();
        }).catch(function (x) { p.disabled = false; toast(x.message, true); });
        return;
      }
    };
  }
  function finde(id) { return anzeigen.filter(function (a) { return a.id === id; })[0]; }
  function loeschen(a) {
    ask({ title: 'Anzeige löschen?', text: '„' + a.firma + '“ wird endgültig gelöscht, mit allen gezählten Aufrufen und Klicks. Willst du sie nur von der Seite nehmen, nimm lieber „Pausieren“.', yes: 'Endgültig löschen', danger: true }).then(function (ok) {
      if (!ok) return;
      BSN.deleteAnzeige(a.id).then(laden).then(function () { setDirty(false); toast('Anzeige gelöscht.'); location.hash = '#werbung'; seiteUebersicht(); })
        .catch(function (x) { toast(x.message, true); });
    });
  }
  function balken(id, von, bis) {
    var tage = [], d = von, max = 1;
    while (d <= bis && tage.length < 62) { var s = summe(id, d, d); tage.push({ d: d, n: s.g, k: s.k }); if (s.g > max) max = s.g; d = plusTage(d, 1); }
    var ges = tage.reduce(function (r, x) { return r + x.n; }, 0);
    return '<div class="bars" role="img" aria-label="Balkendiagramm: ' + ges + ' Mal gesehen vom ' + de(von) + ' bis ' + de(bis) + '">' + tage.map(function (x) {
      return '<div class="bar" title="' + de(x.d) + ': ' + x.n + ' gesehen, ' + x.k + ' Klicks"><b>' + (x.n || '') + '</b><i style="height:' + Math.round(x.n / max * 100) + '%"></i><small>' + (tage.length > 31 ? (x.d.slice(8) === '01' ? kurz(x.d) : '') : +x.d.slice(8)) + '</small></div>';
    }).join('') + '</div>';
  }

  /* ---------- Anlegen und bearbeiten ---------- */
  function seiteEditor(id) {
    var neu = id === 'neu', t = heute();
    var a = neu ? { firma: '', platz: 'kachel_klein', titel: '', text: '', knopf: '', bild_url: '', link: '', start_am: t, ende_am: plusMonate(t, 1), pausiert: false, notiz: '' } : finde(id);
    if (!a) { view.innerHTML = '<h1>Anzeige nicht gefunden</h1><p><a href="#werbung">Zurück zur Übersicht</a></p>'; return; }
    a = Object.assign({}, a);
    setDirty(false);
    view.innerHTML = '<p class="wa-zurueck"><a href="#werbung">← Werbung</a></p><h1>' + (neu ? 'Neue Anzeige' : esc(a.firma)) + '</h1>' +
      '<div class="editor-grid"><form class="panel wa-form" id="waForm" novalidate>' +
      '<label class="field" style="margin-top:0"><span>Firma</span><input id="wFirma" required maxlength="80" value="' + esc(a.firma) + '" placeholder="z. B. Café am Kurpark"></label>' +
      '<label class="field"><span>Platz auf der Webseite</span><select id="wPlatz">' + Object.keys(PLAETZE).map(function (p) {
        return '<option value="' + p + '"' + (p === a.platz ? ' selected' : '') + '>' + esc(PLAETZE[p]) + '</option>';
      }).join('') + '</select><small class="wa-feldhilfe" id="wWo"></small></label>' +
      '<label class="field" data-nur="kachel artikel termine"><span id="wTitelLabel">Überschrift</span><input id="wTitel" maxlength="80" value="' + esc(a.titel) + '"></label>' +
      '<label class="field" data-nur="kachel artikel"><span>Kurzer Text (kann leer bleiben)</span><textarea id="wText" maxlength="160" rows="3">' + esc(a.text) + '</textarea></label>' +
      '<label class="field" data-nur="kachel artikel termine"><span>Text auf dem Knopf (kann leer bleiben)</span><input id="wKnopf" maxlength="30" value="' + esc(a.knopf) + '" placeholder=""></label>' +
      '<div class="field"><span id="wBildLabel">Bild</span></div>' +
      '<div class="side-row" style="margin-top:6px"><label class="btn btn-secondary btn-sm" for="wFile" style="cursor:pointer">Bild wählen</label>' +
      '<button class="btn-ghost" type="button" id="wBildWeg">Bild entfernen</button></div>' +
      '<input type="file" id="wFile" accept="image/*" class="sr-only">' +
      '<label class="field"><span>Link zur Firma</span><input type="url" id="wLink" required placeholder="https://" value="' + esc(a.link) + '"></label>' +
      '<div class="wa-zeit"><label class="field"><span>Erster Tag</span><input type="date" id="wVon" required value="' + esc(a.start_am) + '"></label>' +
      '<label class="field"><span>Letzter Tag</span><input type="date" id="wBis" required value="' + esc(a.ende_am) + '"></label></div>' +
      '<div class="list-tools wa-laufzeit" role="group" aria-label="Laufzeit ab dem ersten Tag"><span>Laufzeit:</span>' +
      [[1, '1 Monat'], [3, '3 Monate'], [6, '6 Monate'], [12, '12 Monate']].map(function (m) { return '<button class="chip" type="button" data-monate="' + m[0] + '">' + m[1] + '</button>'; }).join('') + '</div>' +
      '<div class="wa-hinweis" id="wHinweis" role="status" hidden></div>' +
      (neu ? '' : '<label class="check"><input type="checkbox" id="wPause"' + (a.pausiert ? ' checked' : '') + '><span>Pausiert (die Anzeige ist vorübergehend nicht zu sehen)</span></label>') +
      '<label class="field"><span>Interne Notiz, z. B. Preis oder Rechnung (sieht nur die Redaktion)</span><textarea id="wNotiz" rows="3">' + esc(a.notiz) + '</textarea></label>' +
      '<div class="form-error" id="wErr" role="alert" hidden></div>' +
      '</form><aside class="editor-side">' +
      '<div class="panel"><h2 class="side-h">So sieht es aus</h2><div class="wa-vorschau" id="wVorschau"></div></div>' +
      '<div class="panel stack"><div class="save-state">' + (neu ? 'Noch nicht gespeichert' : badge(a) + ' ' + zeitraum(a)) + '</div>' +
      '<button class="btn btn-primary" type="button" id="wSave">Anzeige speichern</button>' +
      '<a class="btn btn-secondary" href="#werbung">Abbrechen</a>' +
      (neu ? '' : '<a class="btn-ghost" href="#anzeige/' + esc(a.id) + '/bericht">Bericht für den Kunden</a><button class="btn-ghost del" type="button" id="wDel">Anzeige löschen</button>') +
      '</div></aside></div>';

    var $ = function (i) { return document.getElementById(i); };
    function sammeln() {
      return {
        id: a.id, firma: $('wFirma').value.trim(), platz: $('wPlatz').value, titel: $('wTitel').value.trim(), text: $('wText').value.trim(),
        knopf: $('wKnopf').value.trim(), bild_url: a.bild_url || '', link: $('wLink').value.trim(),
        start_am: $('wVon').value, ende_am: $('wBis').value, pausiert: $('wPause') ? $('wPause').checked : false, notiz: $('wNotiz').value.trim()
      };
    }
    function andere(r) {
      return anzeigen.filter(function (x) { return x.id !== r.id && x.platz === r.platz && !x.pausiert && r.start_am && r.ende_am && ueberschneidet(x, r) && stand(x) !== 'abgelaufen'; });
    }
    function malen() {
      var r = sammeln(), p = r.platz, art = /^kachel/.test(p) ? 'kachel' : p;
      view.querySelectorAll('[data-nur]').forEach(function (el) { el.hidden = el.dataset.nur.split(' ').indexOf(art) < 0; });
      $('wWo').textContent = WO[p];
      $('wTitelLabel').textContent = p === 'termine' ? 'Zusatzzeile unter dem Namen (kann leer bleiben)' : 'Überschrift';
      $('wBildLabel').textContent = p === 'termine' || p === 'partner' ? 'Logo (kann leer bleiben, dann steht dort der Anfangsbuchstabe)' : 'Bild (am besten ein Foto ohne Schrift)';
      $('wKnopf').placeholder = p === 'termine' ? 'Zur Webseite' : 'Mehr erfahren';
      $('wBildWeg').hidden = !a.bild_url;
      var v = $('wVorschau'), muster = Object.assign({}, r, { firma: r.firma || 'Firma', titel: r.titel || (art === 'termine' ? '' : 'Überschrift der Anzeige') });
      v.className = 'wa-vorschau wa-vorschau--' + p;
      v.innerHTML = p === 'partner' ? A.partnerleiste([muster], true) : A.html(muster, true);
      // Info, wer im selben Zeitraum auf diesem Platz noch läuft (alle sind gleichzeitig zu sehen)
      var o = andere(r), h = $('wHinweis');
      h.hidden = !o.length;
      if (o.length) h.textContent = 'Im selben Zeitraum läuft hier auch: ' + o.map(function (x) { return x.firma + ' (' + zeitraum(x) + ')'; }).join(', ') + '. Alle Anzeigen sind gleichzeitig zu sehen.';
    }
    malen();
    var form = $('waForm');
    form.addEventListener('input', function () { setDirty(true); malen(); });
    form.addEventListener('change', function () { setDirty(true); malen(); });
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    view.querySelectorAll('[data-monate]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (!$('wVon').value) $('wVon').value = heute();
        $('wBis').value = plusMonate($('wVon').value, +b.dataset.monate); setDirty(true); malen();
      });
    });
    $('wFile').addEventListener('change', function (e) {
      var f = e.target.files[0]; e.target.value = ''; if (!f) return;
      toast('Bild wird verarbeitet …');
      BSN.uploadImage(f).then(function (url) { a.bild_url = url; setDirty(true); malen(); toast('Bild ist drin.'); }).catch(function (x) { toast(x.message, true); });
    });
    $('wBildWeg').addEventListener('click', function () { a.bild_url = ''; setDirty(true); malen(); });
    if ($('wDel')) $('wDel').addEventListener('click', function () { loeschen(a); });

    $('wSave').addEventListener('click', function () {
      var r = sammeln(), err = $('wErr'), m = [];
      if (!r.firma) m.push('der Name der Firma');
      if (/^kachel|artikel/.test(r.platz) && !r.titel) m.push('eine Überschrift');
      if (!r.link) m.push('der Link');
      if (!r.start_am || !r.ende_am) m.push('der Zeitraum');
      if (m.length) { err.textContent = 'Es fehlt noch ' + m.join(', ').replace(/, ([^,]*)$/, ' und $1') + '.'; err.hidden = false; return; }
      if (!/^https?:\/\//i.test(r.link)) r.link = 'https://' + r.link.replace(/^\/+/, '');
      if (r.ende_am < r.start_am) { err.textContent = 'Der letzte Tag liegt vor dem ersten Tag.'; err.hidden = false; return; }
      err.hidden = true;
      Promise.resolve(true)
        .then(function () {
          var b = $('wSave'); b.disabled = true;
          return BSN.saveAnzeige(r).then(laden).then(function () {
            setDirty(false);
            var s = stand(Object.assign({}, r));
            toast(s === 'laeuft' ? 'Gespeichert. Die Anzeige ist jetzt auf der Webseite.' : s === 'geplant' ? 'Gespeichert. Die Anzeige erscheint am ' + de(r.start_am) + '.' : 'Gespeichert.');
            location.hash = '#werbung';
          }).catch(function (x) { b.disabled = false; err.textContent = x.message; err.hidden = false; });
        });
    });
  }

  /* ---------- Bericht für den Kunden (druckbar / als PDF speichern) ---------- */
  function seiteBericht(id) {
    var a = finde(id);
    if (!a) { view.innerHTML = '<h1>Anzeige nicht gefunden</h1><p><a href="#werbung">Zurück zur Übersicht</a></p>'; return; }
    var t = heute(), bis = a.ende_am < t ? a.ende_am : t, s = summe(a.id, a.start_am, a.ende_am);
    var tage = a.start_am > t ? 0 : Math.round((R.day(bis) - R.day(a.start_am)) / 864e5) + 1;
    var monate = [], m = a.start_am.slice(0, 7);
    while (m <= bis.slice(0, 7) && tage) {
      var v = summe(a.id, m + '-01', m + '-31');
      monate.push({ m: m, g: v.g, k: v.k });
      var d = new Date(+m.slice(0, 4), +m.slice(5, 7), 1); m = iso(d).slice(0, 7);
    }
    view.innerHTML = '<p class="wa-zurueck no-print"><a href="#werbung">← Werbung</a></p>' +
      '<div class="wa-bericht"><div class="wa-bericht-kopf"><img src="assets/img/logo.webp" alt="Bad Salzuflen News"><div>' +
      '<h1>Bericht für ' + esc(a.firma) + '</h1><p>' + esc(PLAETZE[a.platz]) + (a.titel ? ' · „' + esc(a.titel) + '“' : '') + '<br>Laufzeit ' + zeitraum(a) + ' · Stand ' + de(t) + '</p></div></div>' +
      '<div class="stat-grid">' +
      '<div class="stat"><strong>' + zahl(s.g) + '</strong><span>Mal gesehen</span></div>' +
      '<div class="stat"><strong>' + zahl(s.k) + '</strong><span>Klicks auf die Anzeige</span></div>' +
      '<div class="stat"><strong>' + rate(s.k, s.g) + '</strong><span>Klickrate</span></div>' +
      '<div class="stat"><strong>' + tage + '</strong><span>' + (tage === 1 ? 'Tag' : 'Tage') + ' online' + (a.ende_am > t && tage ? ' bisher' : '') + '</span></div></div>' +
      (tage ? '<section class="panel"><h2>Gesehen pro Tag</h2>' + balken(a.id, tage > 62 ? plusTage(bis, -61) : a.start_am, bis) + '</section>' +
        '<section class="panel"><h2>Nach Monaten</h2><div class="table-wrap"><table class="posts"><thead><tr><th>Monat</th><th>Gesehen</th><th>Klicks</th><th>Klickrate</th></tr></thead><tbody>' +
        monate.map(function (x) { return '<tr><td>' + MONATE[+x.m.slice(5) - 1] + ' ' + x.m.slice(0, 4) + '</td><td>' + zahl(x.g) + '</td><td>' + zahl(x.k) + '</td><td>' + rate(x.k, x.g) + '</td></tr>'; }).join('') +
        '<tr class="wa-summe"><td>Gesamt</td><td>' + zahl(s.g) + '</td><td>' + zahl(s.k) + '</td><td>' + rate(s.k, s.g) + '</td></tr></tbody></table></div></section>'
        : '<section class="panel"><p class="empty">Die Anzeige startet am ' + de(a.start_am) + '. Ab dann gibt es hier Zahlen.</p></section>') +
      '<p class="wa-erklaerung"><strong>Gesehen</strong> heißt: Die Anzeige war bei einem Seitenaufruf mindestens zur Hälfte auf dem Bildschirm (pro Aufruf einmal gezählt). ' +
      '<strong>Klicks</strong> zählen, wie oft jemand auf die Anzeige getippt hat. Besuche der Redaktion sind nicht enthalten. Gezählt wird ohne Cookies und ohne persönliche Daten.</p>' +
      '<p class="wa-absender">Bad Salzuflen News · badsalzuflennews.de · werbung@badsalzuflennews.de</p></div>' +
      '<div class="side-row no-print"><button class="btn btn-primary" type="button" id="wDruck">Drucken oder als PDF speichern</button><a class="btn btn-secondary" href="#anzeige/' + esc(a.id) + '">Anzeige bearbeiten</a></div>';
    document.getElementById('wDruck').addEventListener('click', function () { window.print(); });
  }

  window.BSNWerbung = {
    zeigen: function (v, p, t, a, d) {
      view = v; toast = t; ask = a; setDirty = d;
      view.innerHTML = '<p class="empty">Wird geladen …</p>';
      laden().then(function () {
        if (p[0] === 'anzeige' && p[2] === 'bericht') return seiteBericht(p[1]);
        if (p[0] === 'anzeige') return seiteEditor(p[1] || 'neu');
        seiteUebersicht();
      }).catch(function (x) { view.innerHTML = fehler(x); });
    }
  };
})();

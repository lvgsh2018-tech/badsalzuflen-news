/* Redaktionsbereich → Generator: Montagsupdate, Story- und Beitrag-Vorlage.
   Alles läuft im Browser — die Bilder werden hier gezeichnet und direkt
   heruntergeladen, nichts wird hochgeladen. Einstellungen und die zuletzt
   bearbeitete Terminliste merkt sich der Browser. */
(function () {
  'use strict';
  var TM = window.BSNTermine, Z = window.BSNZeichnen;
  var esc = function (s) { return window.BSNR.esc(s == null ? '' : s); };
  var $ = function (id) { return document.getElementById(id); };

  var KE = 'bsn_gen_einstellungen', KT = 'bsn_gen_termine', KR = 'bsn_gen_rohtext', KN = 'bsn_gen_nachweis';
  var NACHWEISE = ['Stadt Bad Salzuflen', 'Lennart Schleef'];
  function lesen(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (x) { return d; } }
  function merken(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (x) { /* egal */ } }

  function heuteIso() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function dateiname(art, zusatz, endung) { return heuteIso() + '_' + art + (zusatz ? '_' + zusatz : '') + '.' + endung; }
  function wortFuerDatei(t) {
    return String(t || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'bild';
  }
  function alsBlob(c, format) {
    return new Promise(function (ok, nein) {
      c.toBlob(function (b) { b ? ok(b) : nein(new Error('Bild konnte nicht erzeugt werden.')); },
        format === 'jpg' ? 'image/jpeg' : 'image/png', 0.96);
    });
  }
  function herunterladen(blob, name) {
    var a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  /* Auf dem iPhone: über „Teilen" direkt in Fotos sichern */
  function kannTeilen() {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] })); } catch (x) { return false; }
  }
  function teilen(dateien) {
    return navigator.share({ files: dateien }).catch(function (x) { if (x && x.name !== 'AbortError') throw x; });
  }

  function kopfNavigation(aktiv) {
    return '<div class="gen-kopf"><h1>Generator</h1><div class="list-tools gen-reiter" role="group" aria-label="Vorlage wählen">' +
      [['montag', 'Montagsupdate', '#generator'], ['story', 'Story', '#generator/story'], ['beitrag', 'Beitrag', '#generator/beitrag']].map(function (r) {
        return '<a class="chip" href="' + r[2] + '"' + (aktiv === r[0] ? ' aria-pressed="true" aria-current="page"' : '') + '>' + r[1] + '</a>';
      }).join('') + '</div></div>';
  }

  function ladeFehler(view, x) {
    view.innerHTML = '<h1>Generator</h1><div class="panel"><p>Die Vorlage oder die Schriften konnten nicht geladen werden: ' + esc(x.message) + '</p><p>Bitte die Seite neu laden.</p></div>';
  }

  /* ================================================== Montagsupdate */
  function montag(view, toast) {
    var E = Object.assign({}, Z.STANDARD, lesen(KE, {}));
    var T = lesen(KT, []), SEITEN = [], seite = 0, daten = null, uhr = null;

    view.innerHTML = kopfNavigation('montag') +
      '<div class="gen-grid"><div class="gen-buehne">' +
      '<div class="gen-leer" id="gLeer"><b>Noch keine Termine</b><span>Kopier die Veranstaltungen der Woche ins Feld „Veranstaltungen der Woche“ und tipp auf „Termine erkennen“.</span></div>' +
      '<div class="gen-rahmen" id="gRahmen" hidden><div id="gBild" class="gen-bild" role="img" aria-label="Vorschau des Montagsupdates"></div>' +
      '<div class="gen-feld" id="gFeld" hidden title="Terminbereich verschieben"><span class="gen-marke">Terminbereich</span><span class="gen-griff" id="gGriff" title="Größe ändern"></span></div></div>' +
      '<div class="gen-blaettern" id="gBlaettern" hidden><button class="btn-ghost" type="button" id="gZurueck" aria-label="Vorige Seite">←</button>' +
      '<span>Seite <b id="gNr">1</b> von <b id="gZahl">1</b></span><button class="btn-ghost" type="button" id="gWeiter" aria-label="Nächste Seite">→</button></div>' +
      '<p class="gen-status" id="gStatus" aria-live="polite"></p></div>' +

      '<div class="gen-seite">' +
      '<section class="panel"><h2>Veranstaltungen der Woche</h2>' +
      '<p class="gen-hilfe">Kopier alles hier hinein, so wie du es findest — von salzstreuner.de, von der Stadtseite, aus einer Mail. Reihenfolge, Zwischenzeilen und Links sind egal.</p>' +
      '<label class="field" style="margin-top:0"><span class="sr-only">Rohtext mit Terminen</span><textarea id="gRoh" class="gen-roh" placeholder="Montag, 28. September&#10;19:30 Sommerkonzert im Kurpark&#10;20 Uhr Filmabend | Kino Salzuflen | 8 €"></textarea></label>' +
      '<div class="side-row"><button class="btn btn-primary btn-sm" type="button" id="gLesen">Termine erkennen</button>' +
      '<button class="btn btn-secondary btn-sm" type="button" id="gDazu">Dazu erkennen</button>' +
      '<button class="btn-ghost" type="button" id="gHolen">Aus „Termine“ übernehmen</button></div>' +
      '<div class="gen-meldung" id="gMeldung" role="status" hidden></div></section>' +

      '<section class="panel"><div class="gen-zeile"><h2>Erkannte Termine <span class="gen-anzahl" id="gAnzahl"></span></h2>' +
      '<button class="btn-ghost" type="button" id="gLeeren">Liste leeren</button></div>' +
      '<p class="gen-hilfe">Alles ist änderbar — die Vorschau zieht sofort nach. Höchstens ' + '<span id="gJeSeite"></span> Termine kommen auf eine Seite, der Rest auf die nächste.</p>' +
      '<div id="gListe"></div><button class="btn btn-secondary btn-sm gen-breit" type="button" id="gNeu">+ Termin von Hand hinzufügen</button></section>' +

      '<section class="panel"><h2>Fertigstellen</h2>' +
      '<button class="btn btn-primary gen-breit" type="button" id="gFertig">Bilder erstellen</button>' +
      '<div id="gErgebnis" hidden><ul class="gen-folien" id="gFolien"></ul>' +
      '<div class="side-row"><button class="btn btn-secondary btn-sm" type="button" id="gAlle">Alle herunterladen</button>' +
      '<button class="btn btn-secondary btn-sm" type="button" id="gTeilen" hidden>Teilen / in Fotos sichern</button></div></div></section>' +

      '<details class="panel gen-mehr"><summary>Feinheiten</summary>' +
      '<h3>Schriftgrößen wie in Canva</h3><p class="gen-hilfe">Die Zahlen sind das Verhältnis zueinander — mit „automatisch anpassen“ wächst alles gemeinsam, bis die vollste Seite gerade noch passt.</p>' +
      '<div class="gen-3">' + zahl('zeile_pt', 'Tag und Uhrzeit', 0.5) + zahl('titel_pt', 'Titel', 0.5) + zahl('ort_pt', 'Ort', 0.5) + '</div>' +
      '<div class="gen-3">' + staerke('zeile_gewicht', 'Stärke Zeile') + staerke('titel_gewicht', 'Stärke Titel') + staerke('ort_gewicht', 'Stärke Ort') + '</div>' +
      '<div class="gen-3">' + farbe('zeile_farbe', 'Farbe Zeile') + farbe('titel_farbe', 'Farbe Titel') + farbe('ort_farbe', 'Farbe Ort') + '</div>' +
      '<h3>Wo die Termine stehen</h3><p class="gen-hilfe">Den Rahmen kannst du auch in der Vorschau verschieben und am Punkt unten rechts größer ziehen.</p>' +
      '<div class="gen-2">' + regler('feld_x', 'Links', 0, 100, 0.2) + regler('feld_y', 'Oben', 0, 100, 0.2) + regler('feld_breite', 'Breite', 5, 100, 0.2) + regler('feld_hoehe', 'Höhe', 5, 100, 0.2) + '</div>' +
      '<div class="gen-2"><label class="field"><span>Senkrecht</span><select id="g_senkrecht"><option value="oben">oben anfangen</option><option value="mitte">mittig</option><option value="unten">unten</option></select></label>' +
      regler('ort_einzug', 'Ort eingerückt', 0, 12, 0.1) + '</div>' +
      '<h3>Abstände</h3><div class="gen-2">' + regler('zeilenabstand', 'Zeilenabstand', 0.9, 2.4, 0.01) + zahl('abstand_termine', 'Zwischen zwei Terminen', 1) +
      zahl('hoechstens', 'Höchstens Termine je Seite (0 = so viele wie passen)', 1) + '</div>' +
      schalter('auto_groesse', 'Schrift automatisch an die Seite anpassen') +
      '<h3>Schreibweise der ersten Zeile</h3><p class="gen-hilfe" id="g_beispiel"></p>' +
      '<div class="gen-2">' + text('aufzaehlung', 'Zeichen davor') + text('ort_zeichen', 'Zeichen vor dem Ort') + '</div>' +
      '<label class="field"><span>Tag und Datum</span><select id="g_tag_form"><option value="tag_kurz">Mittwoch, 12.08.</option><option value="tag_lang">Mittwoch, 12. August</option><option value="nur_tag">Mittwoch</option><option value="nur_datum">12.08.</option></select></label>' +
      '<div class="gen-2">' + text('kopf_trenner', 'Trenner vor der Uhrzeit') + text('zeit_zusatz', 'Hinter der Uhrzeit') + '</div>' +
      schalter('preis_zeigen', 'Preis hinter dem Ort mitschreiben') +
      '<h3>Bilddatei</h3><div class="gen-2"><label class="field"><span>Größe</span><select id="g_ausgabe_breite"><option value="1080">Normal — 1080 breit</option><option value="1440">Hoch — 1440 breit</option><option value="2160">Maximal — 2160 breit</option></select></label>' +
      '<label class="field"><span>Dateiformat</span><select id="g_format"><option value="png">PNG — beste Qualität</option><option value="jpg">JPG — kleinere Datei</option></select></label></div>' +
      '<p style="margin-top:20px"><button class="btn-ghost" type="button" id="gZurueckSetzen">Alle Feinheiten auf den Ausgangsstand</button></p>' +
      '</details></div></div>';

    function zahl(id, l, s) { return '<label class="field"><span>' + l + '</span><input type="number" inputmode="decimal" id="g_' + id + '" step="' + s + '"></label>'; }
    function text(id, l) { return '<label class="field"><span>' + l + '</span><input type="text" id="g_' + id + '" autocomplete="off"></label>'; }
    function farbe(id, l) { return '<label class="field"><span>' + l + '</span><input type="color" id="g_' + id + '" class="gen-farbe"></label>'; }
    function regler(id, l, a, b, s) { return '<label class="field"><span>' + l + ' <output id="w_' + id + '"></output></span><input type="range" id="g_' + id + '" min="' + a + '" max="' + b + '" step="' + s + '"></label>'; }
    function schalter(id, l) { return '<label class="check"><input type="checkbox" id="g_' + id + '"><span>' + l + '</span></label>'; }
    function staerke(id, l) {
      return '<label class="field"><span>' + l + '</span><select id="g_' + id + '">' +
        [[300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'SemiBold'], [700, 'Bold']].map(function (w) { return '<option value="' + w[0] + '">' + w[1] + '</option>'; }).join('') + '</select></label>';
    }

    var ZAHLEN = ['zeile_pt', 'titel_pt', 'ort_pt', 'abstand_termine', 'hoechstens', 'zeile_gewicht', 'titel_gewicht', 'ort_gewicht', 'ausgabe_breite'];
    var REGLER = ['feld_x', 'feld_y', 'feld_breite', 'feld_hoehe', 'ort_einzug', 'zeilenabstand'];
    var TEXTE = ['aufzaehlung', 'ort_zeichen', 'kopf_trenner', 'zeit_zusatz', 'zeile_farbe', 'titel_farbe', 'ort_farbe', 'senkrecht', 'tag_form', 'format'];
    var SCHALTER = ['auto_groesse', 'preis_zeigen'];

    function eintragen() {
      ZAHLEN.concat(REGLER, TEXTE).forEach(function (k) { if ($('g_' + k)) $('g_' + k).value = E[k]; });
      SCHALTER.forEach(function (k) { $('g_' + k).checked = !!E[k]; });
      anzeigen();
    }
    function anzeigen() {
      REGLER.forEach(function (k) { $('w_' + k).textContent = k === 'zeilenabstand' ? Number(E[k]).toFixed(2) + '×' : Number(E[k]).toFixed(1) + ' %'; });
      var tage = { tag_kurz: 'Mittwoch, 12.08.', tag_lang: 'Mittwoch, 12. August', nur_tag: 'Mittwoch', nur_datum: '12.08.' };
      $('g_beispiel').textContent = 'So sieht die erste Zeile aus: ' + (E.aufzaehlung || '') + (tage[E.tag_form] || tage.tag_kurz) + (E.kopf_trenner || '') + 'ab 14:30' + (E.zeit_zusatz || '');
      $('gJeSeite').textContent = +E.hoechstens || 'so viele wie passen,';
      feldZeichnen();
    }
    function sichern() { merken(KE, E); }
    ZAHLEN.forEach(function (k) { $('g_' + k).addEventListener('input', function () { E[k] = this.value === '' ? 0 : Number(this.value); anzeigen(); sichern(); spaeter(); }); });
    REGLER.forEach(function (k) { $('g_' + k).addEventListener('input', function () { E[k] = Number(this.value); anzeigen(); sichern(); spaeter(); }); });
    TEXTE.forEach(function (k) { $('g_' + k).addEventListener('input', function () { E[k] = this.value; anzeigen(); sichern(); spaeter(); }); });
    SCHALTER.forEach(function (k) { $('g_' + k).addEventListener('change', function () { E[k] = this.checked; sichern(); spaeter(); }); });
    $('gZurueckSetzen').addEventListener('click', function () { E = Object.assign({}, Z.STANDARD); sichern(); eintragen(); vorschau(); toast('Feinheiten stehen wieder auf dem Ausgangsstand.'); });

    function melden(t, gut) {
      var m = $('gMeldung'); m.textContent = t; m.className = 'gen-meldung ' + (gut ? 'gut' : 'schlecht'); m.hidden = false;
    }

    /* ---------- Terminliste ---------- */
    function listeZeichnen() {
      var ziel = $('gListe');
      $('gAnzahl').textContent = T.length ? '· ' + T.length : '';
      if (!T.length) { ziel.innerHTML = '<p class="empty" style="padding:20px 0">Noch nichts da.</p>'; return; }
      ziel.innerHTML = T.map(function (t, i) {
        return '<fieldset class="gen-termin"><legend>Termin ' + (i + 1) + '</legend><div class="gen-termin-knoepfe">' +
          '<button class="btn-ghost" type="button" data-tun="hoch" data-i="' + i + '" aria-label="Termin ' + (i + 1) + ' nach oben"' + (i ? '' : ' disabled') + '>↑</button>' +
          '<button class="btn-ghost" type="button" data-tun="runter" data-i="' + i + '" aria-label="Termin ' + (i + 1) + ' nach unten"' + (i < T.length - 1 ? '' : ' disabled') + '>↓</button>' +
          '<button class="btn-ghost del" type="button" data-tun="weg" data-i="' + i + '" aria-label="Termin ' + (i + 1) + ' löschen">✕</button></div>' +
          '<div class="gen-2"><label class="field"><span>Datum</span><input type="date" data-feld="datum" data-i="' + i + '" value="' + esc(t.datum) + '"></label>' +
          '<label class="field"><span>Uhrzeit</span><input type="text" data-feld="zeit" data-i="' + i + '" value="' + esc(t.zeit) + '" placeholder="19:30"></label></div>' +
          '<label class="field"><span>Titel</span><input type="text" data-feld="titel" data-i="' + i + '" value="' + esc(t.titel) + '"></label>' +
          '<div class="gen-2"><label class="field"><span>Ort</span><input type="text" data-feld="ort" data-i="' + i + '" value="' + esc(t.ort) + '"></label>' +
          '<label class="field"><span>Preis</span><input type="text" data-feld="preis" data-i="' + i + '" value="' + esc(t.preis) + '"></label></div></fieldset>';
      }).join('');
    }
    $('gListe').addEventListener('input', function (ev) {
      var inp = ev.target; if (!inp.dataset.feld) return;
      var t = T[+inp.dataset.i]; t[inp.dataset.feld] = inp.value;
      /* Der Wochentag kommt immer aus dem Datum */
      if (inp.dataset.feld === 'datum') t.tag = TM.wochentagVon(inp.value);
      merken(KT, T); spaeter();
    });
    $('gListe').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-tun]'); if (!b) return;
      var i = +b.dataset.i;
      if (b.dataset.tun === 'weg') T.splice(i, 1);
      if (b.dataset.tun === 'hoch' && i > 0) T.splice(i - 1, 0, T.splice(i, 1)[0]);
      if (b.dataset.tun === 'runter' && i < T.length - 1) T.splice(i + 1, 0, T.splice(i, 1)[0]);
      merken(KT, T); listeZeichnen(); vorschau();
    });

    function erkennen(dazu) {
      var roh = $('gRoh').value.trim();
      if (!roh) { melden('Da steht noch nichts drin.', false); return; }
      var neu = TM.lesen(roh);
      T = dazu ? T.concat(neu) : neu;
      merken(KT, T); listeZeichnen(); vorschau();
      var w = TM.woche(neu);
      melden(neu.length ? neu.length + ' Termine erkannt' + (w ? ' — ' + w : '') : 'Ich habe nichts gefunden, das nach einem Termin aussieht.', neu.length > 0);
    }
    $('gRoh').value = lesen(KR, '');
    $('gRoh').addEventListener('input', function () { merken(KR, this.value); });
    $('gLesen').addEventListener('click', function () { erkennen(false); });
    $('gDazu').addEventListener('click', function () { erkennen(true); });
    $('gLeeren').addEventListener('click', function () { T = []; merken(KT, T); listeZeichnen(); vorschau(); });
    $('gNeu').addEventListener('click', function () {
      T.push({ tag: '', datum: '', zeit: '', titel: 'Neuer Termin', ort: '', preis: '' });
      merken(KT, T); listeZeichnen(); vorschau();
      var felder = $('gListe').querySelectorAll('[data-feld="titel"]'); felder[felder.length - 1].select();
    });
    /* Die Termine, die im Reiter „Termine" eingetragen sind — die nächsten sieben Tage */
    $('gHolen').addEventListener('click', function () {
      BSN.listEvents().then(function (list) {
        var von = heuteIso(), bis = new Date(); bis.setDate(bis.getDate() + 7);
        var bisIso = bis.getFullYear() + '-' + String(bis.getMonth() + 1).padStart(2, '0') + '-' + String(bis.getDate()).padStart(2, '0');
        var neu = list.filter(function (e) { return e.starts_on >= von && e.starts_on <= bisIso; }).map(function (e) {
          return { tag: TM.wochentagVon(e.starts_on), datum: e.starts_on, zeit: (e.starts_at || '').slice(0, 5).replace(/^0(\d)/, '$1'), titel: e.title || '', ort: e.location || '', preis: '' };
        });
        if (!neu.length) { melden('Im Reiter „Termine“ steht für die nächsten sieben Tage nichts.', false); return; }
        T = T.concat(neu); merken(KT, T); listeZeichnen(); vorschau();
        melden(neu.length + ' Termine aus dem Reiter „Termine“ übernommen.', true);
      }).catch(function (x) { melden(x.message, false); });
    });

    /* ---------- Vorschau ---------- */
    function spaeter() { clearTimeout(uhr); uhr = setTimeout(vorschau, 140); }
    function vorschau() {
      var hat = T.length > 0;
      $('gRahmen').hidden = !hat; $('gLeer').hidden = hat; $('gBlaettern').hidden = !hat;
      $('gErgebnis').hidden = true;
      if (!hat || !daten) { SEITEN = []; return; }
      SEITEN = Z.montagsupdate(T, Object.assign({}, E, { ausgabe_breite: 1080 }), daten);
      if (seite >= SEITEN.length) seite = 0;
      zeigen();
    }
    function zeigen() {
      var bild = $('gBild'); bild.innerHTML = ''; bild.appendChild(SEITEN[seite]);
      $('gNr').textContent = seite + 1; $('gZahl').textContent = SEITEN.length;
      $('gZurueck').disabled = seite === 0; $('gWeiter').disabled = seite >= SEITEN.length - 1;
      $('gBlaettern').hidden = SEITEN.length < 2;
      $('gFeld').hidden = false; feldZeichnen();
    }
    $('gZurueck').addEventListener('click', function () { if (seite > 0) { seite--; zeigen(); } });
    $('gWeiter').addEventListener('click', function () { if (seite < SEITEN.length - 1) { seite++; zeigen(); } });

    /* ---------- Terminbereich in der Vorschau verschieben ---------- */
    function feldZeichnen() {
      var f = $('gFeld'); if (!f) return;
      Object.assign(f.style, { left: E.feld_x + '%', top: E.feld_y + '%', width: E.feld_breite + '%', height: E.feld_hoehe + '%' });
    }
    (function () {
      var art = null, start = null, f = $('gFeld');
      function runter(ev, welche) {
        ev.preventDefault(); ev.stopPropagation(); art = welche;
        var r = $('gRahmen').getBoundingClientRect();
        start = { x: ev.clientX, y: ev.clientY, fx: E.feld_x, fy: E.feld_y, fb: E.feld_breite, fh: E.feld_hoehe, b: r.width, h: r.height };
        f.setPointerCapture(ev.pointerId); f.classList.add('zieht');
      }
      f.addEventListener('pointerdown', function (ev) { runter(ev, ev.target.id === 'gGriff' ? 'ziehen' : 'schieben'); });
      f.addEventListener('pointermove', function (ev) {
        if (!art) return;
        var dx = (ev.clientX - start.x) / start.b * 100, dy = (ev.clientY - start.y) / start.h * 100;
        if (art === 'schieben') {
          E.feld_x = Math.max(0, Math.min(100 - start.fb, start.fx + dx));
          E.feld_y = Math.max(0, Math.min(100 - start.fh, start.fy + dy));
        } else {
          E.feld_breite = Math.max(5, Math.min(100 - E.feld_x, start.fb + dx));
          E.feld_hoehe = Math.max(5, Math.min(100 - E.feld_y, start.fh + dy));
        }
        ['feld_x', 'feld_y', 'feld_breite', 'feld_hoehe'].forEach(function (k) { $('g_' + k).value = E[k]; });
        anzeigen(); spaeter();
      });
      function los() { if (!art) return; art = null; f.classList.remove('zieht'); sichern(); }
      f.addEventListener('pointerup', los); f.addEventListener('pointercancel', los);
    })();

    /* ---------- Fertigstellen ---------- */
    var fertige = [];
    $('gFertig').addEventListener('click', function () {
      if (!T.length) { toast('Es sind noch keine Termine da.', true); return; }
      var k = $('gFertig'); k.disabled = true; k.textContent = 'Einen Moment …';
      setTimeout(function () {
        var seiten = Z.montagsupdate(T, E, daten), endung = E.format === 'jpg' ? 'jpg' : 'png';
        Promise.all(seiten.map(function (c) { return alsBlob(c, endung); })).then(function (blobs) {
          fertige.forEach(function (x) { URL.revokeObjectURL(x.url); });
          fertige = blobs.map(function (b, i) {
            var name = dateiname('montagsupdate', seiten.length > 1 ? 'folie-' + (i + 1) : '', endung);
            return { blob: b, name: name, url: URL.createObjectURL(b), b: seiten[i].width, h: seiten[i].height };
          });
          $('gFolien').innerHTML = fertige.map(function (x, i) {
            return '<li><img src="' + x.url + '" alt="Seite ' + (i + 1) + '"><div><b>' + esc(x.name) + '</b><span>' + x.b + ' × ' + x.h + ' · ' + (x.blob.size / 1048576).toFixed(1) + ' MB</span></div>' +
              '<a class="btn btn-secondary btn-sm" href="' + x.url + '" download="' + esc(x.name) + '">Laden</a></li>';
          }).join('');
          $('gErgebnis').hidden = false; $('gTeilen').hidden = !kannTeilen();
          toast(fertige.length === 1 ? 'Das Bild ist fertig.' : fertige.length + ' Bilder sind fertig.');
        }).catch(function (x) { toast(x.message, true); }).then(function () { k.disabled = false; k.textContent = 'Bilder erstellen'; });
      }, 30);
    });
    $('gAlle').addEventListener('click', function () {
      fertige.forEach(function (x, i) { setTimeout(function () { herunterladen(x.blob, x.name); }, i * 400); });
    });
    $('gTeilen').addEventListener('click', function () {
      teilen(fertige.map(function (x) { return new File([x.blob], x.name, { type: x.blob.type }); })).catch(function (x) { toast(x.message, true); });
    });

    eintragen(); listeZeichnen();
    $('gLeer').hidden = T.length > 0;
    $('gStatus').textContent = 'Vorlage und Schriften werden geladen …';
    return Z.laden().then(function (d) { daten = d; $('gStatus').textContent = ''; vorschau(); }, function (x) { ladeFehler(view, x); });
  }

  /* ============================================ Story und Beitrag */
  function story(view, toast, format) {
    var beitrag = format === 'beitrag', NAME = beitrag ? 'Beitrag' : 'Story';
    var S = Object.assign({}, Z.STORY_STANDARD, beitrag ? Z.BEITRAG_STANDARD : {}, { format: format });
    S.nachweis = lesen(KN, '');
    var foto = null, daten = null, uhr = null;

    view.innerHTML = kopfNavigation(format) +
      '<div class="gen-grid"><div class="gen-buehne">' +
      '<div class="gen-rahmen gen-' + format + '" id="sRahmen"><div id="sBild" class="gen-bild" role="img" aria-label="Vorschau: ' + NAME + '"></div>' +
      '<div class="gen-feld gen-textfeld" id="sFeld" hidden title="Text verschieben"><span class="gen-marke">Text – verschieben</span></div></div>' +
      '<p class="gen-status" id="sStatus" aria-live="polite"></p>' +
      (beitrag ? '' : '<p class="gen-hilfe gen-mitte">Oben und unten blendet Instagram Profilzeile und Antwortfeld ein. Den Link-Sticker am besten in die freie Fläche unter der Überschrift setzen.</p>') +
      '</div><div class="gen-seite">' +

      '<section class="panel"><h2>1 · Foto</h2>' +
      '<div class="gen-ablage" id="sAblage" tabindex="0" role="button" aria-label="Foto auswählen oder hierher ziehen"><b id="sAblageTitel">Foto hierher ziehen</b><span id="sAblageText">oder tippen zum Auswählen</span></div>' +
      '<input type="file" id="sDatei" accept="image/*" class="sr-only" tabindex="-1">' +
      regler('foto_x', 'Ausschnitt links / rechts', 0, 100, 1, ' %') + regler('foto_y', 'Ausschnitt oben / unten', 0, 100, 1, ' %') + regler('zoom', 'Vergrößern', 100, 250, 1, ' %') +
      '</section>' +

      '<section class="panel"><h2>2 · Text</h2>' +
      '<label class="field" style="margin-top:0"><span>Kleine Zeile darüber (freiwillig)</span><input type="text" id="s_zusatz" placeholder="' + (beitrag ? 'z. B. bis zum Jahresende' : 'z. B. 152.889 km') + '"></label>' +
      '<label class="field"><span>Überschrift</span><textarea id="s_titel" placeholder="' + (beitrag ? 'z. B. Weg „An den Gleisen“ wird saniert' : 'z. B. Stadtradeln 2026') + '"></textarea></label>' +
      '<label class="field"><span>Bildnachweis (freiwillig)</span><input type="text" id="s_nachweis" placeholder="z. B. Stadt Bad Salzuflen"></label>' +
      '<div class="credit-vorschlaege" role="group" aria-label="Bildnachweis-Vorschläge">' + NACHWEISE.map(function (n) { return '<button type="button" class="chip" data-nachweis="' + n + '">' + n + '</button>'; }).join('') + '</div>' +
      (beitrag ? '' : '<label class="check"><input type="checkbox" id="s_link_zeigen"><span>Hinweis für den Link-Sticker zeigen</span></label>' +
        '<label class="field"><span>Text des Hinweises</span><input type="text" id="s_link_text"></label>') +
      '<details class="gen-klein"><summary>Größe und Lage</summary><p class="gen-hilfe">Den Text kannst du auch direkt in der Vorschau verschieben.</p>' +
      regler('titel_x', 'Text links / rechts', 0, 60, 0.1, ' %') + regler('titel_y', 'Text oben / unten', 20, 88, 0.1, ' %') +
      regler('titel_pt', 'Schriftgröße Überschrift', 36, 100, 1, '') + regler('zusatz_pt', 'Schriftgröße kleine Zeile', 20, 56, 1, '') +
      '<label class="check"><input type="checkbox" id="s_deko"><span>Kreise und Striche zeigen</span></label></details></section>' +

      (beitrag ? '' : '<section class="panel"><h2>3 · Link zum Artikel</h2>' +
        '<label class="field" style="margin-top:0"><span>Artikel-Adresse (für den Link-Sticker)</span><input type="url" id="sArtikel" placeholder="https://www.badsalzuflennews.de/…"></label>' +
        '<div class="side-row"><button class="btn btn-secondary btn-sm" type="button" id="sKopieren">Link kopieren</button></div>' +
        '<p class="gen-hilfe">Mit gleicher Apple-ID kannst du ihn direkt auf dem iPhone in den Link-Sticker einfügen.</p></section>') +

      '<section class="panel"><button class="btn btn-primary gen-breit" type="button" id="sFertig">' + NAME + ' herunterladen</button>' +
      '<button class="btn btn-secondary gen-breit" type="button" id="sTeilen" hidden style="margin-top:10px">Teilen / in Fotos sichern</button></section>' +
      '</div></div>';

    function regler(id, l, a, b, s, einheit) {
      return '<label class="field"><span>' + l + ' <output id="w_' + id + '" data-einheit="' + einheit + '"></output></span><input type="range" id="s_' + id + '" min="' + a + '" max="' + b + '" step="' + s + '"></label>';
    }
    var REGLER = ['foto_x', 'foto_y', 'zoom', 'titel_x', 'titel_y', 'titel_pt', 'zusatz_pt'];
    var TEXTE = ['zusatz', 'titel', 'nachweis', 'link_text'], SCHALTER = ['link_zeigen', 'deko'];

    function werte() {
      REGLER.forEach(function (k) { var o = $('w_' + k); o.textContent = (Math.round(S[k] * 10) / 10).toLocaleString('de-DE') + o.dataset.einheit; });
    }
    REGLER.forEach(function (k) { $('s_' + k).value = S[k]; $('s_' + k).addEventListener('input', function () { S[k] = Number(this.value); werte(); spaeter(); }); });
    TEXTE.forEach(function (k) { var el = $('s_' + k); if (!el) return; el.value = S[k] || ''; el.addEventListener('input', function () { S[k] = this.value; spaeter(); }); });
    SCHALTER.forEach(function (k) { var el = $('s_' + k); if (!el) return; el.checked = !!S[k]; el.addEventListener('change', function () { S[k] = this.checked; spaeter(); }); });
    $('s_nachweis').addEventListener('change', function () { merken(KN, this.value); });
    // Bildnachweis-Vorschläge: ein Tipp füllt das Feld, Knopf zeigt, welcher gerade drinsteht.
    var nachweisBtns = document.querySelectorAll('[data-nachweis]');
    function nachweisMarken() { nachweisBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.nachweis === $('s_nachweis').value.trim() ? 'true' : 'false'); }); }
    nachweisBtns.forEach(function (b) { b.addEventListener('click', function () { var el = $('s_nachweis'); el.value = S.nachweis = b.dataset.nachweis; merken(KN, el.value); nachweisMarken(); spaeter(); }); });
    $('s_nachweis').addEventListener('input', nachweisMarken);
    nachweisMarken();
    werte();

    function spaeter() { clearTimeout(uhr); uhr = setTimeout(vorschau, 90); }
    function vorschau() {
      if (!daten) return;
      var r = Z.story(foto, S, daten), b = $('sBild');
      b.innerHTML = ''; b.appendChild(r.canvas); feldSetzen(r.feld);
    }

    /* ---------- Textblock in der Vorschau verschieben ---------- */
    var SEITE = beitrag ? 4 / 5 : 9 / 16;
    function feldSetzen(f) {
      var d = $('sFeld');
      if (!f || !(String(S.titel || '').trim() || String(S.zusatz || '').trim())) { d.hidden = true; return; }
      var pad = 1.2;
      Object.assign(d.style, { left: (f[0] - pad) + '%', top: (f[1] - pad * SEITE) + '%', width: (f[2] + 2 * pad) + '%', height: (f[3] + 2 * pad * SEITE) + '%' });
      d.hidden = false;
    }
    (function () {
      var d = $('sFeld'), start = null;
      d.addEventListener('pointerdown', function (ev) {
        ev.preventDefault(); d.setPointerCapture(ev.pointerId); d.classList.add('zieht');
        var r = $('sRahmen').getBoundingClientRect();
        start = { x: ev.clientX, y: ev.clientY, w: r.width, h: r.height, tx: S.titel_x, ty: S.titel_y };
      });
      d.addEventListener('pointermove', function (ev) {
        if (!start) return;
        S.titel_x = Math.min(60, Math.max(0, start.tx + (ev.clientX - start.x) / start.w * 100));
        S.titel_y = Math.min(88, Math.max(20, start.ty + (ev.clientY - start.y) / start.h * 100));
        $('s_titel_x').value = S.titel_x; $('s_titel_y').value = S.titel_y; werte(); vorschau();
      });
      function los() { start = null; d.classList.remove('zieht'); }
      d.addEventListener('pointerup', los); d.addEventListener('pointercancel', los);
    })();

    /* ---------- Foto ---------- */
    function fotoLaden(datei) {
      if (!datei || !/^image\//.test(datei.type)) { $('sAblageTitel').textContent = 'Das ist keine Bilddatei.'; return; }
      $('sAblageTitel').textContent = 'Foto wird geladen …';
      var url = URL.createObjectURL(datei), bild = new Image();
      bild.onload = function () {
        foto = bild;
        $('sAblageTitel').textContent = datei.name; $('sAblageText').textContent = 'Tippen, um ein anderes Foto zu nehmen';
        vorschau();
      };
      bild.onerror = function () { URL.revokeObjectURL(url); $('sAblageTitel').textContent = 'Dieses Foto lässt sich nicht öffnen.'; };
      bild.src = url;
    }
    var ablage = $('sAblage');
    ablage.addEventListener('click', function () { $('sDatei').click(); });
    ablage.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); $('sDatei').click(); } });
    $('sDatei').addEventListener('change', function (ev) { fotoLaden(ev.target.files[0]); ev.target.value = ''; });
    ['dragenter', 'dragover'].forEach(function (t) { ablage.addEventListener(t, function (ev) { ev.preventDefault(); ablage.classList.add('drueber'); }); });
    ['dragleave', 'drop'].forEach(function (t) { ablage.addEventListener(t, function (ev) { ev.preventDefault(); ablage.classList.remove('drueber'); }); });
    ablage.addEventListener('drop', function (ev) { fotoLaden(ev.dataTransfer.files[0]); });

    if ($('sKopieren')) $('sKopieren').addEventListener('click', function () {
      var k = this, link = $('sArtikel').value.trim();
      if (!link) { $('sArtikel').focus(); return; }
      (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).catch(function () { $('sArtikel').select(); document.execCommand('copy'); })
        .then(function () { k.textContent = 'Kopiert ✓'; setTimeout(function () { k.textContent = 'Link kopieren'; }, 1600); });
    });

    /* ---------- Speichern ---------- */
    function fertigesBild() {
      if (!String(S.titel || '').trim()) { toast('Bitte eine Überschrift eintragen.', true); $('s_titel').focus(); return null; }
      return alsBlob(Z.story(foto, S, daten).canvas, 'png').then(function (b) {
        return { blob: b, name: dateiname(format, wortFuerDatei(S.titel), 'png') };
      });
    }
    $('sFertig').addEventListener('click', function () {
      var p = fertigesBild(); if (!p) return;
      p.then(function (x) { herunterladen(x.blob, x.name); toast(NAME + ' ist fertig: ' + x.name); }).catch(function (x) { toast(x.message, true); });
    });
    $('sTeilen').hidden = !kannTeilen();
    $('sTeilen').addEventListener('click', function () {
      var p = fertigesBild(); if (!p) return;
      p.then(function (x) { return teilen([new File([x.blob], x.name, { type: 'image/png' })]); }).catch(function (x) { toast(x.message, true); });
    });

    $('sStatus').textContent = 'Vorlage und Schriften werden geladen …';
    return Z.laden().then(function (d) { daten = d; $('sStatus').textContent = ''; vorschau(); }, function (x) { ladeFehler(view, x); });
  }

  window.BSNGenerator = {
    zeigen: function (view, unterseite, toast) {
      if (unterseite === 'story' || unterseite === 'beitrag') return story(view, toast, unterseite);
      return montag(view, toast);
    }
  };
})();

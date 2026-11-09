/* Redaktionsbereich → Generator: Story- und Beitrag-Vorlage.
   Alles läuft im Browser — die Bilder werden hier gezeichnet und direkt
   heruntergeladen, nichts wird hochgeladen. */
(function () {
  'use strict';
  var Z = window.BSNZeichnen;
  var esc = function (s) { return window.BSNR.esc(s == null ? '' : s); };
  var $ = function (id) { return document.getElementById(id); };

  var KN = 'bsn_gen_nachweis';
  var NACHWEISE = ['Stadt Bad Salzuflen', 'Lennart Schleef', 'Symbolbild', 'Symbolbild (KI-generiert)'];

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
      [['story', 'Story', '#generator/story'], ['beitrag', 'Beitrag', '#generator/beitrag']].map(function (r) {
        return '<a class="chip" href="' + r[2] + '"' + (aktiv === r[0] ? ' aria-pressed="true" aria-current="page"' : '') + '>' + r[1] + '</a>';
      }).join('') + '</div></div>';
  }

  function ladeFehler(view, x) {
    view.innerHTML = '<h1>Generator</h1><div class="panel"><p>Die Vorlage oder die Schriften konnten nicht geladen werden: ' + esc(x.message) + '</p><p>Bitte die Seite neu laden.</p></div>';
  }

  /* ============================================ Story und Beitrag */
  function story(view, toast, format) {
    var beitrag = format === 'beitrag', NAME = beitrag ? 'Beitrag' : 'Story';
    var S = Object.assign({}, Z.STORY_STANDARD, beitrag ? Z.BEITRAG_STANDARD : {}, { format: format });
    // Bildnachweis startet immer leer – er gehört zum jeweiligen Foto, nicht zum letzten Bild.
    S.nachweis = '';
    try { localStorage.removeItem(KN); } catch (e) {}
    var foto = null, fotoFest = false, daten = null, uhr = null;

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
      '<div class="credit-vorschlaege"><button type="button" class="chip" id="sBlaulicht">Polizei-Foto nehmen</button><button type="button" class="chip" id="sFeuerwehr">Feuerwehr-Foto nehmen</button></div>' +
      regler('foto_x', 'Ausschnitt links / rechts', 0, 100, 1, ' %') + regler('foto_y', 'Ausschnitt oben / unten', 0, 100, 1, ' %') + regler('zoom', 'Vergrößern', 100, 250, 1, ' %') +
      '</section>' +

      '<section class="panel"><h2>2 · Text</h2>' +
      '<label class="field" style="margin-top:0"><span>Schild über der Überschrift: Ort oder Rubrik (freiwillig)</span><input type="text" id="s_zusatz" placeholder="z. B. Bad Salzuflen"></label>' +
      '<details class="gen-klein" open><summary>Letzte Überschriften übernehmen</summary><div class="gen-zuletzt" id="sZuletzt"><span class="gen-hilfe">Wird geladen …</span></div></details>' +
      '<label class="field"><span>Überschrift</span><textarea id="s_titel" placeholder="' + (beitrag ? 'z. B. Weg „An den Gleisen“ wird saniert' : 'z. B. Stadtradeln 2026') + '"></textarea></label>' +
      '<label class="field"><span>Bildnachweis (freiwillig)</span><input type="text" id="s_nachweis" placeholder="z. B. Stadt Bad Salzuflen"></label>' +
      '<div class="credit-vorschlaege" role="group" aria-label="Bildnachweis-Vorschläge">' + NACHWEISE.map(function (n) { return '<button type="button" class="chip" data-nachweis="' + n + '">' + n + '</button>'; }).join('') + '</div>' +
      (beitrag ? '' : '<label class="check"><input type="checkbox" id="s_link_zeigen"><span>Hinweis für den Link-Sticker zeigen</span></label>' +
        '<label class="field"><span>Text des Hinweises</span><input type="text" id="s_link_text"></label>') +
      '<details class="gen-klein"><summary>Größe und Lage</summary><p class="gen-hilfe">Den Text kannst du auch direkt in der Vorschau verschieben.</p>' +
      regler('titel_x', 'Text links / rechts', 0, 60, 0.1, ' %') + regler('titel_y', 'Text oben / unten', 20, 96, 0.1, ' %') +
      regler('titel_pt', 'Schriftgröße Überschrift', 36, 100, 1, '') + regler('zusatz_pt', 'Schriftgröße Schild', 20, 56, 1, '') +
      '<label class="check"><input type="checkbox" id="s_deko"><span>Dunklen Verlauf hinter dem Text zeigen</span></label></details></section>' +

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
    // Bildnachweis-Vorschläge: ein Tipp füllt das Feld, Knopf zeigt, welcher gerade drinsteht.
    var nachweisBtns = document.querySelectorAll('[data-nachweis]');
    function nachweisMarken() { nachweisBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.nachweis === $('s_nachweis').value.trim() ? 'true' : 'false'); }); }
    nachweisBtns.forEach(function (b) { b.addEventListener('click', function () { var el = $('s_nachweis'); el.value = S.nachweis = b.dataset.nachweis; nachweisMarken(); spaeter(); }); });
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
        S.titel_y = Math.min(96, Math.max(20, start.ty + (ev.clientY - start.y) / start.h * 100));
        $('s_titel_x').value = S.titel_x; $('s_titel_y').value = S.titel_y; werte(); vorschau();
      });
      function los() { start = null; d.classList.remove('zieht'); }
      d.addEventListener('pointerup', los); d.addEventListener('pointercancel', los);
    })();

    /* ---------- Foto ---------- */
    function fotoLaden(datei, fest) {
      if (!datei || !/^image\//.test(datei.type)) { $('sAblageTitel').textContent = 'Das ist keine Bilddatei.'; return; }
      $('sAblageTitel').textContent = 'Foto wird geladen …';
      var url = URL.createObjectURL(datei), bild = new Image();
      bild.onload = function () {
        foto = bild; fotoFest = !!fest;
        // Neues Foto → alter Bildnachweis passt nicht mehr, Feld leeren
        $('s_nachweis').value = S.nachweis = ''; nachweisMarken();
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
    // Fest hinterlegte Fotos für Polizei und Feuerwehr mit einem Tipp übernehmen
    function festesFoto(pfad, name) {
      fetch(pfad).then(function (r) { return r.blob(); }).then(function (b) {
        fotoLaden(new File([b], name, { type: 'image/jpeg' }), true);
      }).catch(function () { $('sAblageTitel').textContent = name + ' ließ sich nicht laden.'; });
    }
    $('sBlaulicht').addEventListener('click', function () { festesFoto('assets/generator/blaulicht.jpg', 'Polizei-Foto'); });
    $('sFeuerwehr').addEventListener('click', function () { festesFoto('assets/img/feuerwehr.jpg', 'Feuerwehr-Foto'); });

    /* ---------- Letzte Überschriften (Nachrichten + Blaulicht) vorschlagen ---------- */
    function tag(d) { return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }); }
    var basis = location.origin + '/';
    Promise.all([BSN.listPublished(), BSN.listBlaulicht()]).then(function (r) {
      var gruppen = [
        ['Nachrichten', r[0].slice(0, 5).map(function (a) { return { titel: a.title, rubrik: a.category || '', datum: a.published_at, link: basis + 'artikel.html?s=' + encodeURIComponent(a.slug) }; })],
        ['Blaulicht', r[1].filter(function (m) { return !m.hidden; }).slice(0, 5).map(function (m) { return { titel: m.title, rubrik: 'Blaulicht', datum: m.published_at, link: basis + 'blaulicht.html?m=' + encodeURIComponent(m.source_id), blaulicht: /^fw-/.test(m.source_id || '') ? 'sFeuerwehr' : 'sBlaulicht' }; })]
      ];
      var box = $('sZuletzt'), alle = [];
      box.innerHTML = gruppen.map(function (g, gi) {
        return '<h3>' + g[0] + '</h3>' + (g[1].length ? g[1].map(function (x, i) {
          alle.push(x);
          return '<button type="button" data-zuletzt="' + (alle.length - 1) + '"><span>' + esc(x.titel) + '</span><small>' + tag(x.datum) + '</small></button>';
        }).join('') : '<span class="gen-hilfe">Nichts gefunden.</span>');
      }).join('');
      box.querySelectorAll('[data-zuletzt]').forEach(function (b) {
        b.addEventListener('click', function () {
          var x = alle[Number(b.dataset.zuletzt)];
          $('s_titel').value = S.titel = x.titel;
          $('s_zusatz').value = S.zusatz = x.rubrik;
          if ($('sArtikel')) $('sArtikel').value = x.link;
          box.querySelectorAll('[data-zuletzt]').forEach(function (k) { k.setAttribute('aria-pressed', k === b ? 'true' : 'false'); });
          // Feuerwehr-Meldung → Feuerwehr-Foto, Polizei-Meldung → Polizei-Foto; ein eigenes Foto bleibt stehen
          if (x.blaulicht && (!foto || fotoFest)) $(x.blaulicht).click();
          spaeter();
        });
      });
    }).catch(function () { $('sZuletzt').innerHTML = '<span class="gen-hilfe">Überschriften ließen sich nicht laden.</span>'; });

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

    // Kommt man über „Anpassen“ von einem Artikel, ist schon alles vorausgefüllt.
    var U = null;
    try { U = JSON.parse(sessionStorage.getItem(KU)); sessionStorage.removeItem(KU); } catch (x) { U = null; }
    if (U) {
      $('s_titel').value = S.titel = U.titel || '';
      $('s_zusatz').value = S.zusatz = U.rubrik || '';
      if ($('sArtikel')) $('sArtikel').value = U.link || '';
      S.foto_x = U.foto_x; S.foto_y = U.foto_y; $('s_foto_x').value = S.foto_x; $('s_foto_y').value = S.foto_y; werte();
      bildVon(U.bild).then(function (b) {
        if (!b) return;
        foto = b; $('sAblageTitel').textContent = 'Titelbild des Artikels'; $('sAblageText').textContent = 'Tippen, um ein anderes Foto zu nehmen';
        $('s_nachweis').value = S.nachweis = U.nachweis || ''; nachweisMarken(); vorschau();
      }).catch(function (x) { toast(x.message, true); });
    }

    $('sStatus').textContent = 'Vorlage und Schriften werden geladen …';
    return Z.laden().then(function (d) { daten = d; $('sStatus').textContent = ''; vorschau(); }, function (x) { ladeFehler(view, x); });
  }

  /* ============================== Story + Beitrag direkt zum Artikel */
  var KU = 'bsn_gen_uebernahme';
  // Foto über fetch holen, damit die Zeichenfläche es wieder als Datei herausgeben darf.
  function bildVon(url) {
    url = String(url || '').replace(/#fp=[^#]*$/, '');
    if (!url) return Promise.resolve(null);
    return fetch(url).then(function (r) { if (!r.ok) throw new Error('Titelbild ließ sich nicht laden.'); return r.blob(); }).then(function (b) {
      return new Promise(function (ok, nein) {
        var bild = new Image(); bild.onload = function () { ok(bild); };
        bild.onerror = function () { nein(new Error('Titelbild ließ sich nicht öffnen.')); }; bild.src = URL.createObjectURL(b);
      });
    });
  }
  function ausArtikel(a) {
    var f = window.BSNR.focus(a.image_url) || { x: 50, y: 50 };
    return {
      titel: a.title || '', rubrik: a.category || '', nachweis: String(a.image_credit || '').replace(/^Foto:\s*/i, ''),
      bild: a.image_url || '', foto_x: f.x, foto_y: f.y,
      link: location.origin + '/artikel.html?s=' + encodeURIComponent(a.slug || '')
    };
  }

  /* Bildstrecken im Artikeltext finden: jeder Bildblock mit mindestens zwei Bildern */
  function streckenAus(body) {
    var d = new DOMParser().parseFromString('<div>' + (body || '') + '</div>', 'text/html');
    return Array.prototype.map.call(d.querySelectorAll('figure'), function (fig) {
      return Array.prototype.map.call(fig.querySelectorAll('img'), function (i) { return i.getAttribute('src'); }).filter(Boolean);
    }).filter(function (l) { return l.length > 1; });
  }
  function streckenHtml(strecken, nachweis) {
    if (!strecken.length) return '';
    return '<section class="panel strecke-paket"><h2>Bildstrecke für Instagram</h2>' +
      '<p class="gen-hilfe">Jedes Bild im Beitragsformat 4:5 mit dem Logo oben links – so passen alle zusammen in ein Karussell. Tipp ein Bild an, um den Ausschnitt zu verschieben.</p>' +
      '<label class="field"><span>Bildnachweis auf den Bildern (leer lassen für keinen)</span><input id="pSNachweis" value="' + esc(nachweis) + '"></label>' +
      strecken.map(function (liste, s) {
        return (strecken.length > 1 ? '<h3>Bildstrecke ' + (s + 1) + '</h3>' : '') +
          (liste.length > 20 ? '<p class="gen-hilfe">Instagram nimmt höchstens 20 Bilder pro Beitrag – hier sind es ' + liste.length + '.</p>' : '') +
          '<div class="strecke-raster">' + liste.map(function (_, i) {
            return '<button type="button" class="strecke-kachel" data-sk="' + s + '-' + i + '" aria-pressed="false" aria-label="Bild ' + (i + 1) + ' von ' + liste.length + ': Ausschnitt anpassen" disabled><span class="strecke-nr">' + (i + 1) + '</span></button>';
          }).join('') + '</div>' +
          '<div class="strecke-wahl" data-swahl="' + s + '" hidden>' +
          '<div class="strecke-gross" role="slider" tabindex="0" aria-label="Ausschnitt, ziehen oder mit den Pfeiltasten verschieben" aria-valuetext="Mitte"></div>' +
          '<div class="strecke-wahl-text"><h4 data-swtitel></h4><p class="gen-hilfe" data-swhilfe></p>' +
          '<div class="side-row"><button class="btn btn-primary btn-sm" type="button" data-swladen>Dieses Bild herunterladen</button>' +
          '<button class="btn btn-secondary btn-sm" type="button" data-swmitte>Mitte nehmen</button>' +
          '<button class="btn-ghost" type="button" data-swzu>Fertig</button></div></div></div>' +
          '<div class="side-row"><button class="btn btn-primary btn-sm" type="button" data-salle="' + s + '" disabled>Alle ' + liste.length + ' Bilder herunterladen</button>' +
          '<button class="btn btn-secondary btn-sm" type="button" data-steilen="' + s + '" hidden disabled>Teilen / in Fotos sichern</button></div>';
      }).join('') +
      '<p class="gen-status" id="pSStatus" aria-live="polite">Bilder werden gezeichnet …</p></section>';
  }
  function streckenStarten(view, toast, strecken, titel) {
    if (!strecken.length) return;
    var fotos = [], fertig = [], lage = [], daten = null, uhr, B = 1080, H = 1350;
    var stueck = wortFuerDatei(titel);
    strecken.forEach(function (liste, s) { fertig[s] = []; lage[s] = liste.map(function () { return { x: 50, y: 50 }; }); });
    function einst(s, i) { return { nachweis: $('pSNachweis').value, foto_x: lage[s][i].x, foto_y: lage[s][i].y }; }
    // Wie viel vom Foto über das 4:5-Format hinausragt – nur in diese Richtung lässt sich verschieben.
    function ueber(foto) {
      if (!foto) return { x: 0, y: 0 };
      var fw = foto.naturalWidth || foto.width, fh = foto.naturalHeight || foto.height, m = Math.max(B / fw, H / fh);
      return { x: Math.max(0, fw * m - B), y: Math.max(0, fh * m - H) };
    }
    function einBild(s, i) {
      var c = Z.streckenBild(fotos[s][i], einst(s, i), daten);
      var k = view.querySelector('[data-sk="' + s + '-' + i + '"]');
      k.querySelectorAll('canvas').forEach(function (x) { x.remove(); });
      k.insertBefore(c, k.firstChild);
      return alsBlob(c, 'jpg').then(function (b) {
        fertig[s][i] = { blob: b, name: dateiname('bildstrecke', stueck + (strecken.length > 1 ? '-' + (s + 1) : '') + '_' + String(i + 1).padStart(2, '0'), 'jpg') };
      });
    }
    function zeichnen() {
      return Promise.all(strecken.map(function (liste, s) { return Promise.all(liste.map(function (_, i) { return einBild(s, i); })); }));
    }
    function bereit(an) {
      view.querySelectorAll('[data-sk], [data-salle], [data-steilen]').forEach(function (k) { k.disabled = !an; });
      view.querySelectorAll('[data-steilen]').forEach(function (k) { k.hidden = !kannTeilen(); });
    }
    Promise.all([Z.laden(), Promise.all(strecken.map(function (liste) {
      return Promise.all(liste.map(function (url) { return bildVon(url).catch(function () { return null; }); }));
    }))]).then(function (r) {
      daten = r[0]; fotos = r[1];
      var fehlt = [].concat.apply([], fotos).filter(function (f) { return !f; }).length;
      return zeichnen().then(function () {
        bereit(true);
        $('pSStatus').textContent = fehlt ? fehlt + (fehlt === 1 ? ' Bild ließ' : ' Bilder ließen') + ' sich nicht laden und ' + (fehlt === 1 ? 'ist' : 'sind') + ' leer.' : '';
      });
    }).catch(function (x) { $('pSStatus').textContent = 'Das hat nicht geklappt: ' + x.message; });

    $('pSNachweis').addEventListener('input', function () {
      if (!daten) return;
      clearTimeout(uhr); bereit(false);
      uhr = setTimeout(function () { zeichnen().then(function () { bereit(true); offen && gross(); }); }, 250);
    });

    /* Ausschnitt wählen: Bild antippen → große Vorschau, darin ziehen oder Pfeiltasten */
    var offen = null; // [s, i]
    function wahl(s) { return view.querySelector('[data-swahl="' + s + '"]'); }
    function gross() {
      var s = offen[0], i = offen[1], w = wahl(s), feld = w.querySelector('.strecke-gross');
      var c = Z.streckenBild(fotos[s][i], einst(s, i), daten);
      feld.replaceChildren(c);
      var u = ueber(fotos[s][i]), l = lage[s][i];
      feld.setAttribute('aria-valuetext', u.x ? 'waagerecht ' + Math.round(l.x) + ' Prozent' : u.y ? 'senkrecht ' + Math.round(l.y) + ' Prozent' : 'Bild passt genau');
    }
    function oeffnen(s, i) {
      if (offen) schliessen(true);
      offen = [s, i];
      var w = wahl(s), u = ueber(fotos[s][i]);
      w.hidden = false;
      w.querySelector('[data-swtitel]').textContent = 'Bild ' + (i + 1) + ' von ' + strecken[s].length;
      w.querySelector('[data-swhilfe]').textContent = !fotos[s][i] ? 'Dieses Bild ließ sich nicht laden.' :
        u.x ? 'Zieh das Bild nach links oder rechts, bis der wichtige Teil zu sehen ist.' :
        u.y ? 'Zieh das Bild nach oben oder unten, bis der wichtige Teil zu sehen ist.' : 'Dieses Bild passt genau ins Format, hier gibt es nichts zu verschieben.';
      view.querySelectorAll('[data-sk]').forEach(function (k) { k.setAttribute('aria-pressed', k.dataset.sk === s + '-' + i ? 'true' : 'false'); });
      gross();
      w.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
    }
    function schliessen(still) {
      if (!offen) return;
      var s = offen[0], i = offen[1];
      wahl(s).hidden = true; offen = null;
      var k = view.querySelector('[data-sk="' + s + '-' + i + '"]');
      k.setAttribute('aria-pressed', 'false');
      if (!still) k.focus();
    }
    function schieben(dx, dy) {
      var s = offen[0], i = offen[1], u = ueber(fotos[s][i]), l = lage[s][i];
      if (u.x) l.x = Math.max(0, Math.min(100, l.x + dx / u.x * 100));
      if (u.y) l.y = Math.max(0, Math.min(100, l.y + dy / u.y * 100));
      gross();
    }
    function uebernehmen() { if (offen) einBild(offen[0], offen[1]); }
    view.querySelectorAll('[data-sk]').forEach(function (k) {
      k.addEventListener('click', function () {
        var p = k.dataset.sk.split('-').map(Number);
        if (offen && offen[0] === p[0] && offen[1] === p[1]) schliessen(true); else oeffnen(p[0], p[1]);
      });
    });
    view.querySelectorAll('[data-swahl]').forEach(function (w) {
      var feld = w.querySelector('.strecke-gross'), start = null;
      feld.addEventListener('pointerdown', function (e) {
        if (!offen) return; e.preventDefault();
        feld.setPointerCapture(e.pointerId); feld.classList.add('zieht');
        start = { x: e.clientX, y: e.clientY };
      });
      feld.addEventListener('pointermove', function (e) {
        if (!start) return;
        // Bild folgt dem Finger: nach rechts ziehen zeigt mehr vom linken Rand.
        var faktor = B / (feld.clientWidth || 1);
        schieben(-(e.clientX - start.x) * faktor, -(e.clientY - start.y) * faktor);
        start = { x: e.clientX, y: e.clientY };
      });
      function los() { if (!start) return; start = null; feld.classList.remove('zieht'); uebernehmen(); }
      feld.addEventListener('pointerup', los); feld.addEventListener('pointercancel', los);
      feld.addEventListener('keydown', function (e) {
        var k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (e.key === 'Escape') { e.preventDefault(); schliessen(); return; }
        if (!k || !offen) return; e.preventDefault();
        var n = e.shiftKey ? 120 : 30; schieben(-k[0] * n, -k[1] * n); uebernehmen();
      });
      w.querySelector('[data-swmitte]').addEventListener('click', function () {
        lage[offen[0]][offen[1]] = { x: 50, y: 50 }; gross(); uebernehmen();
      });
      w.querySelector('[data-swladen]').addEventListener('click', function () {
        var s = offen[0], i = offen[1];
        einBild(s, i).then(function () { var x = fertig[s][i]; herunterladen(x.blob, x.name); });
      });
      w.querySelector('[data-swzu]').addEventListener('click', function () { schliessen(); });
    });

    // Mehrere Dateien kurz nacheinander – Browser fragen beim ersten Mal evtl., ob mehrere Downloads erlaubt sind.
    function wennFertig() { return offen ? einBild(offen[0], offen[1]) : Promise.resolve(); }
    view.querySelectorAll('[data-salle]').forEach(function (k) {
      k.addEventListener('click', function () {
        wennFertig().then(function () {
          var liste = fertig[k.dataset.salle];
          liste.forEach(function (x, i) { setTimeout(function () { herunterladen(x.blob, x.name); }, i * 350); });
          toast(liste.length + ' Bilder werden heruntergeladen.');
        });
      });
    });
    view.querySelectorAll('[data-steilen]').forEach(function (k) {
      k.addEventListener('click', function () {
        // Teilen muss direkt auf den Tipp folgen (iPhone), deshalb die schon fertigen Dateien nehmen.
        teilen(fertig[k.dataset.steilen].map(function (x) { return new File([x.blob], x.name, { type: 'image/jpeg' }); })).catch(function (x) { toast(x.message, true); });
      });
    });
  }

  function paket(view, toast, a) {
    var U = ausArtikel(a), fertig = {}, strecken = streckenAus(a.body);
    view.innerHTML = '<div class="gen-kopf"><h1>Story und Beitrag</h1></div>' +
      '<p class="gen-hilfe">Zum Artikel „' + esc(U.titel) + '“ — gleiches Foto, gleiche Überschrift. ' + (U.bild ? '' : 'Der Artikel hat kein Titelbild, deshalb ist der Hintergrund leer. ') +
      (a.status === 'published' ? '' : 'Der Artikel ist noch ein Entwurf – der Link funktioniert erst nach dem Veröffentlichen. ') +
      '<a href="#editor/' + esc(a.id) + '">Zurück zum Artikel</a></p>' +
      '<div class="paket-grid">' + [['story', 'Story'], ['beitrag', 'Beitrag']].map(function (f) {
        return '<section class="panel paket-karte"><h2>' + f[1] + '</h2>' +
          '<div class="gen-rahmen gen-' + f[0] + '"><div class="gen-bild" id="p_' + f[0] + '" role="img" aria-label="' + f[1] + ' zum Artikel"></div></div>' +
          '<div class="side-row"><button class="btn btn-primary btn-sm" type="button" data-laden="' + f[0] + '" disabled>' + f[1] + ' herunterladen</button>' +
          '<a class="btn-ghost" href="#generator/' + f[0] + '" data-anpassen="' + f[0] + '">Anpassen</a></div></section>';
      }).join('') + '</div>' +
      streckenHtml(strecken, U.nachweis) +
      '<section class="panel paket-ende"><label class="field" style="margin-top:0"><span>Artikel-Adresse (für den Link-Sticker)</span><input type="url" id="pLink" readonly value="' + esc(U.link) + '"></label>' +
      '<div class="side-row"><button class="btn btn-secondary btn-sm" type="button" id="pKopieren">Link kopieren</button>' +
      '<button class="btn btn-secondary btn-sm" type="button" id="pBeide" disabled>Beide herunterladen</button>' +
      '<button class="btn btn-secondary btn-sm" type="button" id="pTeilen" hidden disabled>Teilen / in Fotos sichern</button>' +
      '<a class="btn-ghost" href="#beitraege">Zur Beitragsliste</a></div>' +
      '<p class="gen-status" id="pStatus" aria-live="polite">Bilder werden gezeichnet …</p></section>';

    streckenStarten(view, toast, strecken, U.titel);
    Promise.all([Z.laden(), bildVon(U.bild).catch(function (x) { toast(x.message, true); return null; })]).then(function (r) {
      var daten = r[0], foto = r[1];
      return Promise.all(['story', 'beitrag'].map(function (format) {
        var S = Object.assign({}, Z.STORY_STANDARD, format === 'beitrag' ? Z.BEITRAG_STANDARD : {},
          { format: format, titel: U.titel, zusatz: U.rubrik, nachweis: U.nachweis, foto_x: U.foto_x, foto_y: U.foto_y });
        var c = Z.story(foto, S, daten).canvas;
        $('p_' + format).appendChild(c);
        return alsBlob(c, 'png').then(function (b) { fertig[format] = { blob: b, name: dateiname(format, wortFuerDatei(U.titel), 'png') }; });
      }));
    }).then(function () {
      view.querySelectorAll('[data-laden], #pBeide, #pTeilen').forEach(function (k) { k.disabled = false; });
      $('pTeilen').hidden = !kannTeilen();
      $('pStatus').textContent = '';
    }).catch(function (x) { $('pStatus').textContent = 'Das hat nicht geklappt: ' + x.message; });

    view.querySelectorAll('[data-laden]').forEach(function (k) {
      k.addEventListener('click', function () { var x = fertig[k.dataset.laden]; herunterladen(x.blob, x.name); });
    });
    $('pBeide').addEventListener('click', function () {
      herunterladen(fertig.story.blob, fertig.story.name);
      setTimeout(function () { herunterladen(fertig.beitrag.blob, fertig.beitrag.name); }, 400);
    });
    $('pTeilen').addEventListener('click', function () {
      teilen(['story', 'beitrag'].map(function (f) { return new File([fertig[f].blob], fertig[f].name, { type: 'image/png' }); })).catch(function (x) { toast(x.message, true); });
    });
    $('pKopieren').addEventListener('click', function () {
      var k = this;
      (navigator.clipboard ? navigator.clipboard.writeText(U.link) : Promise.reject()).catch(function () { $('pLink').select(); document.execCommand('copy'); })
        .then(function () { k.textContent = 'Kopiert ✓'; setTimeout(function () { k.textContent = 'Link kopieren'; }, 1600); });
    });
    // „Anpassen“ öffnet den normalen Generator, schon mit Foto, Überschrift, Bildnachweis und Link gefüllt.
    view.querySelectorAll('[data-anpassen]').forEach(function (k) {
      k.addEventListener('click', function () { try { sessionStorage.setItem(KU, JSON.stringify(U)); } catch (x) { /* egal */ } });
    });
  }

  window.BSNGenerator = {
    paket: paket,
    zeigen: function (view, unterseite, toast) {
      return story(view, toast, unterseite === 'beitrag' ? 'beitrag' : 'story');
    }
  };
})();

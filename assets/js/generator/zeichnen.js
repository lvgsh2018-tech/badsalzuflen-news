/* Zeichnet die Bilder für @badsalzuflen_news im Browser.
   Übertragen aus dem Update-Generator auf dem Mac (bildbearbeitung.py und
   story.py): gleiche Maße, gleiche Schriften, gleiche Regeln.

   - montagsupdate(termine, e) → Liste von <canvas> (1080 × 1920)
   - story(foto, e)            → {canvas, feld} (Story 1080 × 1920 oder
                                  Beitrag 1080 × 1350) */
(function () {
  'use strict';
  var TM = window.BSNTermine;
  var ORDNER = 'assets/generator/';
  var SANS = 'BSNMontserrat', SERIF = 'BSNPlayfair';

  /* ------------------------------------------------ Schriften und Bilder */
  var bereit = null;
  function bildLaden(src) {
    return new Promise(function (ok, nein) {
      var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { nein(new Error('Datei fehlt: ' + src)); }; i.src = src;
    });
  }
  function laden() {
    if (bereit) return bereit;
    var schriften = [
      [SANS, 'Montserrat-Light.ttf', '300'], [SANS, 'Montserrat-Regular.ttf', '400'],
      [SANS, 'Montserrat-Medium.ttf', '500'], [SANS, 'Montserrat-SemiBold.ttf', '600'],
      [SANS, 'Montserrat-Bold.ttf', '700'], [SERIF, 'PlayfairDisplay-VariableFont_wght.ttf', '400 900']
    ].map(function (s) {
      var f = new FontFace(s[0], 'url(' + ORDNER + s[1] + ')', { weight: s[2] });
      return f.load().then(function (x) { document.fonts.add(x); });
    });
    bereit = Promise.all([
      Promise.all(schriften),
      bildLaden(ORDNER + 'montagsupdate-vorlage.png'),
      bildLaden(ORDNER + 'logo-durchsichtig.png')
    ]).then(function (r) { return { vorlage: r[1], logo: r[2] }; });
    bereit.catch(function () { bereit = null; });
    return bereit;
  }

  function leinwand(b, h) { var c = document.createElement('canvas'); c.width = b; c.height = h; return c; }
  var messer = leinwand(10, 10).getContext('2d');

  /* Eine „Schrift" merkt sich Größe und Maße wie im Mac-Programm:
     ganze Punktzahlen, Oberlänge + Unterlänge als Zeilenhöhe. */
  var schriftSpeicher = {};
  function schrift(familie, gewicht, groesse) {
    groesse = Math.max(4, Math.round(groesse));
    var k = familie + gewicht + '/' + groesse;
    if (schriftSpeicher[k]) return schriftSpeicher[k];
    var css = gewicht + ' ' + groesse + 'px ' + familie;
    messer.font = css;
    var m = messer.measureText('Hg');
    var h = messer.measureText('H');
    return (schriftSpeicher[k] = {
      css: css, groesse: groesse,
      oben: m.fontBoundingBoxAscent || groesse * 0.97,
      unten: m.fontBoundingBoxDescent || groesse * 0.25,
      versal: h.actualBoundingBoxAscent || groesse * 0.7
    });
  }
  function zeilenhoehe(f) { return f.oben + f.unten; }

  function breiteVon(text, f, sperrung) {
    if (!text) return 0;
    messer.font = f.css;
    if (!sperrung) return messer.measureText(text).width;
    var b = 0;
    for (var z of text) b += messer.measureText(z).width;
    return b + sperrung * Math.max(0, Array.from(text).length - 1);
  }

  /* Bricht an Leerzeichen um. `hoechstens` begrenzt die Zeilenzahl; der
     Rest endet mit einem Auslassungszeichen. */
  function umbrechen(text, f, sperrung, grenze, hoechstens) {
    text = String(text || '').trim();
    if (!text) return [];
    if (grenze <= 0 || breiteVon(text, f, sperrung) <= grenze) return [text];
    var zeilen = [], aktuell = '';
    text.split(' ').forEach(function (wort) {
      var versuch = (aktuell + ' ' + wort).trim();
      if (aktuell && breiteVon(versuch, f, sperrung) > grenze) { zeilen.push(aktuell); aktuell = wort; }
      else aktuell = versuch;
    });
    if (aktuell) zeilen.push(aktuell);
    if (hoechstens && zeilen.length > hoechstens) {
      zeilen = zeilen.slice(0, hoechstens);
      var letzte = zeilen[zeilen.length - 1];
      while (letzte && breiteVon(letzte + '…', f, sperrung) > grenze) letzte = letzte.slice(0, -1).trimEnd();
      zeilen[zeilen.length - 1] = letzte + '…';
    }
    return zeilen;
  }

  /* Schreibt eine Zeile; y ist die Oberkante wie im Mac-Programm. */
  function zeileSchreiben(ctx, x, y, text, f, farbe, sperrung) {
    ctx.font = f.css; ctx.fillStyle = farbe; ctx.textBaseline = 'alphabetic';
    if (!sperrung) { ctx.fillText(text, x, y + f.oben); return; }
    for (var z of text) { ctx.fillText(z, x, y + f.oben); x += ctx.measureText(z).width + sperrung; }
  }

  /* Ein farbiges Zeichen wie 📍 als Bild — groß gezeichnet, knapp
     zugeschnitten, dann auf die gewünschte Höhe gebracht. */
  var emojiSpeicher = {};
  function emojiBild(zeichen) {
    if (zeichen in emojiSpeicher) return emojiSpeicher[zeichen];
    var c = leinwand(220, 220), x = c.getContext('2d');
    x.font = '160px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    x.textBaseline = 'top'; x.fillText(zeichen, 20, 20);
    var d = x.getImageData(0, 0, 220, 220).data, l = 220, o = 220, r = -1, u = -1;
    for (var py = 0; py < 220; py++) for (var px = 0; px < 220; px++) {
      if (d[(py * 220 + px) * 4 + 3] > 8) { if (px < l) l = px; if (px > r) r = px; if (py < o) o = py; if (py > u) u = py; }
    }
    if (r < 0) return (emojiSpeicher[zeichen] = null);
    var aus = leinwand(r - l + 1, u - o + 1);
    aus.getContext('2d').drawImage(c, l, o, aus.width, aus.height, 0, 0, aus.width, aus.height);
    return (emojiSpeicher[zeichen] = aus);
  }

  /* ================================================= Montagsupdate */

  /* Voreinstellungen = der Stand aus einstellungen.json vom Mac */
  var STANDARD = {
    breite: 1080, hoehe: 1920, pt_faktor: 1, hintergrund: '#F3F0EA', vorlage: true,
    feld_x: 11.733, feld_y: 19, feld_breite: 74.68, feld_hoehe: 74, senkrecht: 'oben',
    aufzaehlung: '• ', tag_form: 'tag_kurz', kopf_trenner: ' | ', zeit_zusatz: ' Uhr',
    zeile_pt: 34.8, zeile_sperrung: 0, zeile_farbe: '#174B90', zeile_gewicht: 700,
    titel_pt: 34.8, titel_sperrung: 0, titel_farbe: '#174B90', titel_gewicht: 400, titel_zeilen: 3,
    ort_zeichen: '📍', ort_einzug: 1.5, ort_pt: 31.3, ort_sperrung: 0, ort_farbe: '#174B90', ort_gewicht: 400, ort_zeilen: 2,
    preis_zeigen: true, zeilenabstand: 1.32, abstand_termine: 71, hoechstens: 5, auto_groesse: true,
    linie_zeigen: false, linie_farbe: '#CBD0EA', linie_staerke: 1,
    ausgabe_breite: 1080, format: 'png'
  };

  function pt(e, name, skala, ersatz) {
    var v = e[name] == null ? (ersatz || 0) : e[name];
    return Number(v) * Number(e.pt_faktor || 1) * skala;
  }

  /* Die fette Zeile über dem Titel: „• Mittwoch, 12.08. | ab 14:30 Uhr" */
  function kopfzeile(t, e) {
    var form = e.tag_form || 'tag_kurz', tag = t.tag || '';
    var lang = TM.datumLang(t.datum), kurz = TM.datumKurz(t.datum), wann;
    if (form === 'nur_tag') wann = tag;
    else if (form === 'tag_lang') wann = [tag, lang].filter(Boolean).join(', ');
    else if (form === 'nur_datum') wann = kurz;
    else wann = [tag, kurz].filter(Boolean).join(', ');
    var zeit = String(t.zeit || '').trim();
    if (zeit && e.zeit_zusatz) zeit += e.zeit_zusatz;
    var zeile = [wann, zeit].filter(Boolean).join(e.kopf_trenner == null ? ' | ' : e.kopf_trenner);
    return zeile ? (e.aufzaehlung == null ? '• ' : e.aufzaehlung) + zeile : '';
  }

  function blockBauen(t, e, skala, platz) {
    var kopfGr = pt(e, 'zeile_pt', skala, 40), titelGr = pt(e, 'titel_pt', skala, 40), ortGr = pt(e, 'ort_pt', skala, 36);
    var fKopf = schrift(SANS, e.zeile_gewicht, kopfGr), fTitel = schrift(SANS, e.titel_gewicht, titelGr), fOrt = schrift(SANS, e.ort_gewicht, ortGr);
    var spKopf = pt(e, 'zeile_sperrung', skala), spTitel = pt(e, 'titel_sperrung', skala), spOrt = pt(e, 'ort_sperrung', skala);
    var lh = titelGr * Number(e.zeilenabstand || 1.5);
    var einzug = platz * Number(e.ort_einzug == null ? 4.5 : e.ort_einzug) / 100;
    var zeilen = [];

    var kopf = kopfzeile(t, e);
    if (kopf) umbrechen(kopf, fKopf, spKopf, platz, 2).forEach(function (z) {
      zeilen.push({ text: z, f: fKopf, sp: spKopf, farbe: e.zeile_farbe, dx: 0 });
    });
    umbrechen(String(t.titel || '').trim(), fTitel, spTitel, platz, +e.titel_zeilen || 3).forEach(function (z) {
      zeilen.push({ text: z, f: fTitel, sp: spTitel, farbe: e.titel_farbe, dx: 0 });
    });
    var ort = String(t.ort || '').trim(), preis = String(t.preis || '').trim();
    if (preis && e.preis_zeigen) ort = ort ? ort + ' · ' + preis : preis;
    if (ort) {
      var zeichen = e.ort_zeichen == null ? '📍' : String(e.ort_zeichen);
      var vorspann = zeichen ? ortGr * 1.35 : 0;
      umbrechen(ort, fOrt, spOrt, platz - einzug - vorspann, +e.ort_zeilen || 2).forEach(function (z, i) {
        zeilen.push({ text: z, f: fOrt, sp: spOrt, farbe: e.ort_farbe, dx: einzug, emoji: i === 0 ? zeichen : '', vorspann: vorspann });
      });
    }
    if (!zeilen.length) return { zeilen: [], hoehe: 0, lh: lh };
    return { zeilen: zeilen, hoehe: (zeilen.length - 1) * lh + zeilenhoehe(zeilen[zeilen.length - 1].f), lh: lh };
  }

  function blockZeichnen(ctx, block, x, y) {
    block.zeilen.forEach(function (z) {
      var links = x + z.dx;
      if (z.emoji) {
        var hoch = z.f.oben, bild = emojiBild(z.emoji);
        if (bild) {
          var bh = Math.max(6, Math.round(hoch * 0.86)), bb = Math.max(1, Math.round(bild.width * bh / bild.height));
          ctx.drawImage(bild, Math.round(links), Math.round(y + hoch * 0.16), bb, bh);
        }
        links += z.vorspann || 0;
      }
      zeileSchreiben(ctx, links, y, z.text, z.f, z.farbe, z.sp);
      y += block.lh;
    });
  }

  var MITWACHSEN = ['zeile_pt', 'titel_pt', 'ort_pt', 'abstand_termine'];
  function mitFaktor(e, faktor) {
    if (faktor === 1) return e;
    var z = Object.assign({}, e);
    MITWACHSEN.forEach(function (n) { z[n] = Number(e[n] || 0) * faktor; });
    return z;
  }
  function hoeheMessen(gruppe, e, skala, breite) {
    var abstand = pt(e, 'abstand_termine', skala, 26), h = 0, erster = true;
    gruppe.forEach(function (t) {
      var b = blockBauen(t, e, skala, breite);
      if (!b.zeilen.length) return;
      if (!erster) h += abstand;
      h += b.hoehe; erster = false;
    });
    return h;
  }
  /* Die Schrift wächst, bis die vollste Seite gerade noch in das helle
     Feld passt. Alle Seiten bekommen dieselbe Größe. */
  function autoFaktor(liste, e, breite, hoehe, jeSeite) {
    if (!liste.length || hoehe <= 0) return 1;
    var n = jeSeite > 0 ? jeSeite : liste.length, gruppen = [];
    for (var i = 0; i < liste.length; i += n) gruppen.push(liste.slice(i, i + n));
    function passt(faktor) {
      var z = mitFaktor(e, faktor);
      var fKopf = schrift(SANS, z.zeile_gewicht, pt(z, 'zeile_pt', 1, 40)), sp = pt(z, 'zeile_sperrung', 1);
      for (var k = 0; k < liste.length; k++) {
        var kopf = kopfzeile(liste[k], z);
        if (kopf && breiteVon(kopf, fKopf, sp) > breite) return false;
      }
      return gruppen.every(function (g) { return hoeheMessen(g, z, 1, breite) <= hoehe; });
    }
    var klein = 0.45, gross = 2.6;
    if (!passt(klein)) return klein;
    if (passt(gross)) return gross;
    for (var s = 0; s < 11; s++) { var m = (klein + gross) / 2; if (passt(m)) klein = m; else gross = m; }
    return klein;
  }

  function montagsupdate(liste, einst, daten) {
    var e = Object.assign({}, STANDARD, einst || {});
    var eb = +e.breite, eh = +e.hoehe, ziel = +e.ausgabe_breite || eb;
    var skala = ziel / eb, B = Math.round(eb * skala), H = Math.round(eh * skala);
    var feldX = B * e.feld_x / 100, feldB = B * e.feld_breite / 100, feldOben = H * e.feld_y / 100, feldH = H * e.feld_hoehe / 100;
    var hoechstens = +e.hoechstens || 0;

    /* Gemessen wird immer in der Entwurfsgröße, damit die Ausgabegröße nichts verschiebt */
    if (e.auto_groesse && liste.length) {
      e = mitFaktor(e, autoFaktor(liste, e, eb * e.feld_breite / 100, eh * e.feld_hoehe / 100, hoechstens));
    }
    var abstandT = pt(e, 'abstand_termine', skala, 26), linie = Math.max(1, pt(e, 'linie_staerke', skala, 1));

    /* erst aufteilen, dann zeichnen */
    var seiten = [], aktuell = [], y = feldOben, unten = feldOben + feldH;
    liste.forEach(function (t) {
      var block = blockBauen(t, e, skala, feldB);
      if (!block.zeilen.length) return;
      var vorlauf = aktuell.length ? abstandT : 0;
      var zuVoll = y + vorlauf + block.hoehe > unten, zuViele = hoechstens && aktuell.length >= hoechstens;
      if (aktuell.length && (zuVoll || zuViele)) {
        seiten.push({ stuecke: aktuell, ende: y }); aktuell = []; y = feldOben; vorlauf = 0;
      }
      y += vorlauf; aktuell.push({ block: block, y: y }); y += block.hoehe;
    });
    if (aktuell.length) seiten.push({ stuecke: aktuell, ende: y });
    if (!seiten.length) seiten = [{ stuecke: [], ende: feldOben }];

    return seiten.map(function (seite) {
      var c = leinwand(B, H), ctx = c.getContext('2d');
      ctx.fillStyle = e.hintergrund; ctx.fillRect(0, 0, B, H);
      if (e.vorlage && daten.vorlage) { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(daten.vorlage, 0, 0, B, H); }
      var frei = Math.max(0, unten - seite.ende);
      var versatz = e.senkrecht === 'mitte' ? frei / 2 : e.senkrecht === 'unten' ? frei : 0;
      /* Rest-Luft gleichmäßig auf die Lücken verteilen — höchstens 0,6 Abstände */
      var luecken = Math.max(0, seite.stuecke.length - 1), luft = 0;
      if (e.auto_groesse && luecken && e.senkrecht === 'oben') luft = Math.min(frei / luecken, abstandT * 0.6);
      var vorher = null;
      seite.stuecke.forEach(function (s, nr) {
        var ys = s.y + versatz + luft * nr;
        if (e.linie_zeigen && vorher !== null) {
          var mitte = (vorher + ys) / 2; ctx.fillStyle = e.linie_farbe; ctx.fillRect(feldX, mitte, feldB, linie);
        }
        blockZeichnen(ctx, s.block, feldX, ys);
        vorher = ys + s.block.hoehe;
      });
      return c;
    });
  }

  /* ================================================= Story und Beitrag */

  var FORMATE = {
    story: {
      groesse: [1080, 1920], logoForm: ['oval', [805, 167, 1145, 403]], logo: [958, 285, 190],
      kreise: [[830, 2070, 280], [1060, 1900, 240]], ring: [960, 2020, 149], punkte: [792, 1772],
      nachweisY: 1712, randRechts: 150
    },
    beitrag: {
      groesse: [1080, 1350], logoForm: ['kreis', [1030, -60, 236]], logo: [968, 76, 180],
      kreise: [[830, 1525, 285], [1070, 1300, 250]], ring: [1000, 1425, 155], punkte: [830, 1165],
      nachweisY: 1300, randRechts: 45
    }
  };
  var STORY_STANDARD = {
    zusatz: '', titel: '', nachweis: '', titel_pt: 60, zusatz_pt: 32, titel_x: 5.1, titel_y: 66,
    link_zeigen: true, link_text: 'Alles Weitere hier', foto_x: 50, foto_y: 50, zoom: 100, deko: true, format: 'story'
  };
  var BEITRAG_STANDARD = { titel_pt: 58, zusatz_pt: 36, titel_x: 3.5, titel_y: 76, link_zeigen: false };
  var CREME = '243,240,234', CREME_KREIS = 'rgb(241,236,230)', FLIEDER = 'rgb(148,154,196)', PUNKTE = 'rgb(216,196,206)', WEISS = 'rgb(248,245,240)';

  function kreis(ctx, mx, my, r) { ctx.beginPath(); ctx.arc(mx, my, Math.max(0, r), 0, Math.PI * 2); }
  function strich(ctx, a, b, breite, farbe) {
    ctx.strokeStyle = farbe; ctx.lineWidth = breite; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  function rund(ctx, l, o, r, u, radius) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(l, o, r - l, u - o, radius); else ctx.rect(l, o, r - l, u - o);
  }
  function woerterUmbrechen(text, f, grenze) {
    var zeilen = [], aktuell = '';
    text.split(/\s+/).filter(Boolean).forEach(function (w) {
      var v = (aktuell + ' ' + w).trim();
      if (aktuell && breiteVon(v, f, 0) > grenze) { zeilen.push(aktuell); aktuell = w; } else aktuell = v;
    });
    if (aktuell) zeilen.push(aktuell);
    return zeilen;
  }
  /* Flieder-Kasten mit weißem Text; Großbuchstaben optisch mittig */
  function kasten(ctx, links, oben, zeilen, f, ptGr, innenX, innenY, zh) {
    var breite = Math.max.apply(null, zeilen.map(function (t) { return breiteVon(t, f, 0); })) + 2 * innenX;
    var hoehe = zh * zeilen.length + 2 * innenY;
    ctx.fillStyle = FLIEDER; rund(ctx, links, oben, links + breite, oben + hoehe, Math.round(ptGr * 0.16)); ctx.fill();
    ctx.font = f.css; ctx.fillStyle = WEISS; ctx.textBaseline = 'alphabetic';
    zeilen.forEach(function (t, i) {
      var zo = oben + innenY + i * zh;
      ctx.fillText(t, links + innenX, zo + (zh + f.versal) / 2);
    });
    return [links, oben, links + breite, oben + hoehe];
  }

  function story(foto, einst, daten) {
    var e = Object.assign({}, STORY_STANDARD, (einst || {}).format === 'beitrag' ? BEITRAG_STANDARD : {});
    Object.keys(einst || {}).forEach(function (k) { if (einst[k] != null) e[k] = einst[k]; });
    ['titel_pt', 'zusatz_pt', 'titel_x', 'titel_y', 'foto_x', 'foto_y', 'zoom'].forEach(function (k) { e[k] = Number(e[k]); });
    var f = FORMATE[e.format] || FORMATE.story, B = f.groesse[0], H = f.groesse[1];
    var c = leinwand(B, H), ctx = c.getContext('2d');
    ctx.fillStyle = 'rgb(' + CREME + ')'; ctx.fillRect(0, 0, B, H);

    /* Foto füllend zugeschnitten */
    if (foto) {
      var fw = foto.naturalWidth || foto.width, fh = foto.naturalHeight || foto.height;
      var m = Math.max(B / fw, H / fh) * Math.max(1, e.zoom / 100);
      var nb = Math.max(B, Math.round(fw * m)), nh = Math.max(H, Math.round(fh * m));
      var x = Math.round((nb - B) * e.foto_x / 100), y = Math.round((nh - H) * e.foto_y / 100);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(foto, -x, -y, nb, nh);
    }

    /* Oben rechts: Creme-Form mit Logo */
    ctx.fillStyle = CREME_KREIS;
    if (f.logoForm[0] === 'oval') {
      var o = f.logoForm[1];
      ctx.beginPath(); ctx.ellipse((o[0] + o[2]) / 2, (o[1] + o[3]) / 2, (o[2] - o[0]) / 2, (o[3] - o[1]) / 2, 0, 0, Math.PI * 2); ctx.fill();
    } else { kreis(ctx, f.logoForm[1][0], f.logoForm[1][1], f.logoForm[1][2]); ctx.fill(); }
    if (daten.logo) {
      var lb = f.logo[2], lh = Math.round(daten.logo.naturalHeight * lb / daten.logo.naturalWidth);
      ctx.drawImage(daten.logo, Math.trunc(f.logo[0] - lb / 2), Math.trunc(f.logo[1] - lh / 2), lb, lh);
    }

    /* Unten rechts: Kreise, Flieder-Ring, Punkteraster */
    if (e.deko) {
      ctx.fillStyle = CREME_KREIS;
      f.kreise.forEach(function (k) { kreis(ctx, k[0], k[1], k[2]); ctx.fill(); });
      ctx.strokeStyle = FLIEDER; ctx.lineWidth = 22; kreis(ctx, f.ring[0], f.ring[1], f.ring[2] - 11); ctx.stroke();
      ctx.fillStyle = PUNKTE;
      for (var reihe = 0; reihe < 3; reihe++) for (var sp = 0; sp < 4; sp++) { kreis(ctx, f.punkte[0] + sp * 25, f.punkte[1] + reihe * 25, 3.2); ctx.fill(); }
    }

    /* Titelblock, Unterkante bei titel_y */
    var links = Math.round(B * e.titel_x / 100), grenze = Math.max(300, B - links - f.randRechts);
    var titel = String(e.titel || '').split(/\s+/).filter(Boolean).join(' ');
    var zusatz = String(e.zusatz || '').split(/\s+/).filter(Boolean).join(' ');
    var tPt = e.titel_pt, tSchrift = schrift(SERIF, 600, tPt), innenX = Math.round(tPt * 0.24);
    var tZeilen = titel ? woerterUmbrechen(titel, tSchrift, grenze - 2 * innenX) : [];
    var unten = H * e.titel_y / 100, titelKanten = null, feld = [links, unten, links + 1, unten];
    if (tZeilen.length) {
      var zh = Math.round(tPt * 1.2), hoehe = zh * tZeilen.length + 2 * Math.round(tPt * 0.13);
      titelKanten = kasten(ctx, links, unten - hoehe, tZeilen, tSchrift, tPt, innenX, Math.round(tPt * 0.13), zh);
      feld = titelKanten.slice();
    }
    if (zusatz) {
      var zPt = e.zusatz_pt, zSchrift = schrift(SERIF, 600, zPt), zi = Math.round(zPt * 0.3);
      var zZeilen = woerterUmbrechen(zusatz, zSchrift, grenze - 2 * zi), zzh = Math.round(zPt * 1.2);
      var zHoehe = zzh * zZeilen.length + 2 * Math.round(zPt * 0.2), obenTitel = titelKanten ? titelKanten[1] : unten;
      /* Wie in Canva: der kleine Kasten sitzt knapp auf dem großen */
      var k = kasten(ctx, links + Math.round(tPt * 0.02), obenTitel - zHoehe + 4, zZeilen, zSchrift, zPt, zi, Math.round(zPt * 0.2), zzh);
      feld = [Math.min(feld[0], k[0]), k[1], Math.max(feld[2], k[2]), feld[3]];
    }

    /* „Alles Weitere hier ↓" — darunter kommt in Instagram der Link-Sticker */
    var linkText = String(e.link_text || '').trim();
    if (e.link_zeigen && linkText && e.format !== 'beitrag') {
      var lPt = Math.max(22, Math.round(tPt * 0.45)), lS = schrift(SANS, 600, lPt);
      var pfeil = Math.round(lPt * 0.9), innen = Math.round(lPt * 0.7), obenL = feld[3] + Math.round(tPt * 0.35);
      var lBreite = breiteVon(linkText, lS, 0) + pfeil + innen * 2.6, lHoehe = Math.round(lPt * 2);
      ctx.fillStyle = 'rgba(' + CREME + ',' + (245 / 255) + ')';
      rund(ctx, links, obenL, links + lBreite, obenL + lHoehe, Math.floor(lHoehe / 2)); ctx.fill();
      var blau = 'rgb(23,75,144)';
      ctx.font = lS.css; ctx.fillStyle = blau; ctx.fillText(linkText, links + innen, obenL + (lHoehe + lS.versal) / 2);
      var px = links + lBreite - innen - pfeil / 2, py1 = obenL + lHoehe * 0.28, py2 = obenL + lHoehe * 0.72, sb = Math.max(3, Math.round(lPt * 0.13));
      strich(ctx, [px, py1], [px, py2], sb, blau);
      strich(ctx, [px - pfeil * 0.34, py2 - pfeil * 0.34], [px, py2], sb, blau);
      strich(ctx, [px + pfeil * 0.34, py2 - pfeil * 0.34], [px, py2], sb, blau);
      feld = [feld[0], feld[1], Math.max(feld[2], links + lBreite), obenL + lHoehe];
    }

    /* Die drei Striche an der oberen rechten Ecke der Überschrift */
    if (titelKanten && e.deko) {
      var rx = titelKanten[2], ry = titelKanten[1], farbe = 'rgba(' + CREME + ',' + (235 / 255) + ')';
      strich(ctx, [rx + 2, ry - 52], [rx + 3, ry - 20], 7, farbe);
      strich(ctx, [rx + 42, ry - 54], [rx + 25, ry - 10], 7, farbe);
      strich(ctx, [rx + 40, ry + 8], [rx + 84, ry + 2], 7, farbe);
    }

    /* Bildnachweis unten links */
    var nachweis = String(e.nachweis || '').trim();
    if (nachweis) {
      if (nachweis.charAt(0) !== '©') nachweis = '© ' + nachweis;
      var nS = schrift(SANS, 500, 22);
      ctx.font = nS.css; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(0,0,0,' + (60 / 255) + ')'; ctx.lineWidth = 2;
      ctx.strokeText(nachweis, links, f.nachweisY + nS.oben);
      ctx.fillStyle = 'rgba(255,255,255,' + (230 / 255) + ')';
      ctx.fillText(nachweis, links, f.nachweisY + nS.oben);
    }

    return { canvas: c, feld: [feld[0] / B * 100, feld[1] / H * 100, (feld[2] - feld[0]) / B * 100, (feld[3] - feld[1]) / H * 100] };
  }

  window.BSNZeichnen = {
    laden: laden, montagsupdate: montagsupdate, story: story,
    STANDARD: STANDARD, STORY_STANDARD: STORY_STANDARD, BEITRAG_STANDARD: BEITRAG_STANDARD
  };
})();

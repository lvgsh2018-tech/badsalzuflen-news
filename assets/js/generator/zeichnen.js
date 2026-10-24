/* Zeichnet die Bilder für @badsalzuflen_news im Browser.
   Übertragen aus dem Update-Generator auf dem Mac (bildbearbeitung.py und
   story.py). Story und Beitrag seit 2026-10-24 im Stil der Webseiten-Kacheln.

   - montagsupdate(termine, e) → Liste von <canvas> (1080 × 1920)
   - story(foto, e)            → {canvas, feld} (Story 1080 × 1920 oder
                                  Beitrag 1080 × 1350) */
(function () {
  'use strict';
  var TM = window.BSNTermine;
  var ORDNER = 'assets/generator/';
  var MONTSERRAT = 'BSNMontserrat';
  var SANS = 'BSNPublicSans', SERIF = 'BSNBodoni';   // Story und Beitrag: Schriften der Webseite

  /* ------------------------------------------------ Schriften und Bilder */
  var bereit = null;
  function bildLaden(src) {
    return new Promise(function (ok, nein) {
      var i = new Image(); i.onload = function () { ok(i); }; i.onerror = function () { nein(new Error('Datei fehlt: ' + src)); }; i.src = src;
    });
  }
  var LATEIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
  var LATEIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';
  function laden() {
    if (bereit) return bereit;
    var schriften = [
      [MONTSERRAT, ORDNER + 'Montserrat-Light.ttf', '300'], [MONTSERRAT, ORDNER + 'Montserrat-Regular.ttf', '400'],
      [MONTSERRAT, ORDNER + 'Montserrat-Medium.ttf', '500'], [MONTSERRAT, ORDNER + 'Montserrat-SemiBold.ttf', '600'],
      [MONTSERRAT, ORDNER + 'Montserrat-Bold.ttf', '700'],
      [SERIF, 'assets/fonts/libre-bodoni-latin-3e48d7.woff2', '400 700', LATEIN], [SERIF, 'assets/fonts/libre-bodoni-latin-ext-a3e342.woff2', '400 700', LATEIN_EXT],
      [SANS, 'assets/fonts/public-sans-latin-f63147.woff2', '100 900', LATEIN], [SANS, 'assets/fonts/public-sans-latin-ext-da9f89.woff2', '100 900', LATEIN_EXT]
    ].map(function (s) {
      var f = new FontFace(s[0], 'url(' + s[1] + ')', s[3] ? { weight: s[2], unicodeRange: s[3] } : { weight: s[2] });
      return f.load().then(function (x) { document.fonts.add(x); });
    });
    bereit = Promise.all([
      Promise.all(schriften),
      bildLaden(ORDNER + 'montagsupdate-vorlage.png'),
      bildLaden(ORDNER + 'logo-durchsichtig.png'),
      bildLaden(ORDNER + 'logo-weiss.png')
    ]).then(function (r) { return { vorlage: r[1], logo: r[2], logoWeiss: r[3] }; });
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
    var fKopf = schrift(MONTSERRAT, e.zeile_gewicht, kopfGr), fTitel = schrift(MONTSERRAT, e.titel_gewicht, titelGr), fOrt = schrift(MONTSERRAT, e.ort_gewicht, ortGr);
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
      var fKopf = schrift(MONTSERRAT, z.zeile_gewicht, pt(z, 'zeile_pt', 1, 40)), sp = pt(z, 'zeile_sperrung', 1);
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
  /* Seit 2026-10-24 im Stil der Kacheln auf der Startseite: Foto vollflächig,
     unten dunkler Verlauf, Ort/Rubrik im Lavendel-Schild, Überschrift weiß in
     Libre Bodoni, Hinweis für den Link-Sticker als Lavendel-Pille. */

  var FORMATE = {
    story: { groesse: [1080, 1920], logo: [72, 110, 250], nachweis: 132 },
    beitrag: { groesse: [1080, 1350], logo: [64, 64, 210], nachweis: 84 }
  };
  var STORY_STANDARD = {
    zusatz: '', titel: '', nachweis: '', titel_pt: 80, zusatz_pt: 28, titel_x: 6.7, titel_y: 69,
    link_zeigen: true, link_text: 'Alles Weitere hier', foto_x: 50, foto_y: 50, zoom: 100, deko: true, format: 'story'
  };
  var BEITRAG_STANDARD = { titel_pt: 80, zusatz_pt: 30, titel_x: 5.9, titel_y: 92.9, link_zeigen: false };
  var NAVY = '#1E3A66', NAVY_DUNKEL = '#142845', LAVENDEL = '#E7DDF6', SCHATTEN = '10,18,36';

  function strich(ctx, a, b, breite, farbe) {
    ctx.strokeStyle = farbe; ctx.lineWidth = breite; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }
  function pille(ctx, l, o, b, h) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(l, o, b, h, h / 2); else ctx.rect(l, o, b, h);
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
  /* Wie text-wrap: balance auf der Webseite: gleiche Zeilenzahl, aber
     möglichst gleich lange Zeilen, damit kein einzelnes Wort allein steht. */
  function ausgewogen(text, f, grenze) {
    var zeilen = woerterUmbrechen(text, f, grenze);
    if (zeilen.length < 2) return zeilen;
    var lo = grenze * 0.5, hi = grenze;
    for (var i = 0; i < 12; i++) {
      var mitte = (lo + hi) / 2;
      if (woerterUmbrechen(text, f, mitte).length > zeilen.length) lo = mitte; else hi = mitte;
    }
    return woerterUmbrechen(text, f, hi);
  }

  function story(foto, einst, daten) {
    var e = Object.assign({}, STORY_STANDARD, (einst || {}).format === 'beitrag' ? BEITRAG_STANDARD : {});
    Object.keys(einst || {}).forEach(function (k) { if (einst[k] != null) e[k] = einst[k]; });
    ['titel_pt', 'zusatz_pt', 'titel_x', 'titel_y', 'foto_x', 'foto_y', 'zoom'].forEach(function (k) { e[k] = Number(e[k]); });
    var f = FORMATE[e.format] || FORMATE.story, B = f.groesse[0], H = f.groesse[1];
    var c = leinwand(B, H), ctx = c.getContext('2d');
    ctx.fillStyle = NAVY_DUNKEL; ctx.fillRect(0, 0, B, H);

    /* Foto füllend zugeschnitten */
    if (foto) {
      var fw = foto.naturalWidth || foto.width, fh = foto.naturalHeight || foto.height;
      var m = Math.max(B / fw, H / fh) * Math.max(1, e.zoom / 100);
      var nb = Math.max(B, Math.round(fw * m)), nh = Math.max(H, Math.round(fh * m));
      var x = Math.round((nb - B) * e.foto_x / 100), y = Math.round((nh - H) * e.foto_y / 100);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(foto, -x, -y, nb, nh);
    }

    /* Text vorbereiten: Schild, Überschrift, Link-Hinweis */
    var links = Math.round(B * e.titel_x / 100), grenze = Math.max(300, B - links - Math.max(links, 56));
    var titel = String(e.titel || '').split(/\s+/).filter(Boolean).join(' ');
    var zusatz = String(e.zusatz || '').split(/\s+/).filter(Boolean).join(' ').toLocaleUpperCase('de-DE');
    var tPt = e.titel_pt, tS = schrift(SERIF, 600, tPt), zh = Math.round(tPt * 1.1);
    var tZeilen = titel ? ausgewogen(titel, tS, grenze) : [];
    var unten = Math.round(H * e.titel_y / 100), oben = unten - zh * tZeilen.length;
    var zPt = e.zusatz_pt, zS = schrift(SANS, 700, zPt), zSp = zPt * 0.08;
    var zH = Math.round(zPt * 2.07), zB = zusatz ? Math.round(breiteVon(zusatz, zS, zSp) + zPt * 1.87) : 0;
    var zOben = tZeilen.length ? oben - Math.round(tPt * 0.3) - zH : unten - zH;
    var linkText = String(e.link_text || '').trim(), mitLink = e.link_zeigen && linkText && e.format !== 'beitrag';
    var lPt = Math.max(22, Math.round(tPt * 0.37)), lS = schrift(SANS, 600, lPt), pfeil = lPt;
    var lH = Math.round(lPt * 2.41), lOben = unten + Math.round(tPt * 0.52), innen = Math.round(lPt * 1.06);
    var lB = Math.round(breiteVon(linkText, lS, 0) + lPt * 0.53 + pfeil + innen * 2);
    var blockOben = zusatz ? zOben : oben, blockUnten = mitLink ? lOben + lH : unten;

    /* Dunkler Verlauf: unten hinter dem Text, oben schmal hinter dem Logo */
    if (e.deko) {
      var bis = Math.max(0, blockOben - H * 0.28), g = ctx.createLinearGradient(0, H, 0, bis);
      g.addColorStop(0, 'rgba(' + SCHATTEN + ',0.9)');
      g.addColorStop(Math.min(0.9, Math.max(0.05, (H - blockUnten) / (H - bis))), 'rgba(' + SCHATTEN + ',0.82)');
      g.addColorStop(Math.min(0.95, (H - blockOben) / (H - bis) + 0.05), 'rgba(' + SCHATTEN + ',0.5)');
      g.addColorStop(1, 'rgba(' + SCHATTEN + ',0)');
      ctx.fillStyle = g; ctx.fillRect(0, bis, B, H - bis);
      var go = ctx.createLinearGradient(0, 0, 0, H * 0.2);
      go.addColorStop(0, 'rgba(' + SCHATTEN + ',0.45)'); go.addColorStop(1, 'rgba(' + SCHATTEN + ',0)');
      ctx.fillStyle = go; ctx.fillRect(0, 0, B, H * 0.2);
    }

    /* Oben links: Logo in Weiß mit goldenem Blatt */
    if (daten.logoWeiss) {
      var lb = f.logo[2], lhh = Math.round(daten.logoWeiss.naturalHeight * lb / daten.logoWeiss.naturalWidth);
      ctx.drawImage(daten.logoWeiss, f.logo[0], f.logo[1], lb, lhh);
    }

    var feld = [links, unten, links + 1, unten];
    ctx.textBaseline = 'alphabetic';
    if (zusatz) {
      ctx.fillStyle = LAVENDEL; pille(ctx, links, zOben, zB, zH); ctx.fill();
      zeileSchreiben(ctx, links + Math.round(zPt * 0.93), zOben + (zH + zS.versal) / 2 - zS.oben, zusatz, zS, NAVY, zSp);
      feld = [links, zOben, links + zB, unten];
    }
    if (tZeilen.length) {
      ctx.font = tS.css; ctx.fillStyle = '#FFFFFF';
      var breit = 0;
      tZeilen.forEach(function (t, i) {
        ctx.fillText(t, links, oben + i * zh + (zh + tS.versal) / 2);
        breit = Math.max(breit, breiteVon(t, tS, 0));
      });
      feld = [links, zusatz ? zOben : oben, links + Math.max(breit, zB), unten];
    }

    /* „Alles Weitere hier ↓" — darunter kommt in Instagram der Link-Sticker */
    if (mitLink) {
      ctx.fillStyle = LAVENDEL; pille(ctx, links, lOben, lB, lH); ctx.fill();
      ctx.font = lS.css; ctx.fillStyle = NAVY; ctx.fillText(linkText, links + innen, lOben + (lH + lS.versal) / 2);
      var px = links + lB - innen - pfeil / 2, py1 = lOben + lH * 0.3, py2 = lOben + lH * 0.7, sb = Math.max(3, Math.round(lPt * 0.11));
      strich(ctx, [px, py1], [px, py2], sb, NAVY);
      strich(ctx, [px - pfeil * 0.3, py2 - pfeil * 0.3], [px, py2], sb, NAVY);
      strich(ctx, [px + pfeil * 0.3, py2 - pfeil * 0.3], [px, py2], sb, NAVY);
      feld = [feld[0], Math.min(feld[1], lOben), Math.max(feld[2], links + lB), lOben + lH];
    }

    /* Bildnachweis oben rechts, auf Höhe des Logos */
    var nachweis = String(e.nachweis || '').trim();
    if (nachweis) {
      if (nachweis.charAt(0) !== '©') nachweis = '© ' + nachweis;
      var nS = schrift(SANS, 500, 22);
      ctx.font = nS.css; ctx.textAlign = 'right';
      ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 6;
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.fillText(nachweis, B - f.logo[0], f.nachweis + nS.oben);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.textAlign = 'left';
    }

    return { canvas: c, feld: [feld[0] / B * 100, feld[1] / H * 100, (feld[2] - feld[0]) / B * 100, (feld[3] - feld[1]) / H * 100] };
  }

  window.BSNZeichnen = {
    laden: laden, montagsupdate: montagsupdate, story: story,
    STANDARD: STANDARD, STORY_STANDARD: STORY_STANDARD, BEITRAG_STANDARD: BEITRAG_STANDARD
  };
})();

/* Termine aus unformatiertem Text herauslesen.
   Übertragen aus dem Update-Generator auf dem Mac (termine.py) — gleiche
   Muster, gleiche Reihenfolge. Hier kommt rein, was von salzstreuner.de,
   der Stadtseite oder aus einer Mail kopiert wurde; heraus kommt eine
   saubere Liste: Tag, Datum, Uhrzeit, Titel, Ort, Preis.

   Ein Termin auf salzstreuner.de steht über mehrere Zeilen (Kategorie,
   Titel, Datum, Uhrzeit, Ort, „Details"). Deshalb wird in Blöcken gelesen,
   nicht Zeile für Zeile. Am Ende fliegen Doppelte raus. */
(function () {
  'use strict';

  var MONATE = {
    januar: 1, jan: 1, februar: 2, feb: 2, maerz: 3, 'märz': 3,
    mrz: 3, mar: 3, april: 4, apr: 4, mai: 5, juni: 6, jun: 6,
    juli: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9,
    sept: 9, oktober: 10, okt: 10, november: 11, nov: 11,
    dezember: 12, dez: 12
  };
  var WOCHENTAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  /* Kürzel wie „di" oder „mit" sind auch normale Wörter. Deshalb zählen
     ausgeschriebene Wochentage überall, Kürzel nur am Zeilenanfang. */
  var WOCHENTAG_KURZ = {
    montag: 0, dienstag: 1, mittwoch: 2, donnerstag: 3, freitag: 4, samstag: 5,
    sonnabend: 5, sonntag: 6, mo: 0, di: 1, mi: 2, do: 3, fr: 4, sa: 5, so: 6
  };
  var WOCHENTAG_LANG = {};
  Object.keys(WOCHENTAG_KURZ).forEach(function (k) { if (k.length > 2) WOCHENTAG_LANG[k] = WOCHENTAG_KURZ[k]; });

  /* Wortgrenzen, die auch Umlaute und ß als Buchstaben kennen */
  var W = '[\\p{L}\\p{N}_]', VOR = '(?<!' + W + ')', NACH = '(?!' + W + ')';
  function laengsteZuerst(o) { return Object.keys(o).sort(function (a, b) { return b.length - a.length; }).join('|'); }

  var MUELL = new RegExp(
    '^(mehr\\s*(infos?|erfahren|lesen)|weiterlesen|details?|zur\\s+webseite|' +
    'tickets?|jetzt\\s+buchen|alle\\s+termine|veranstaltungen?|termine|' +
    'cookie|impressum|datenschutz' + W + '*|teilen|drucken|anzeige|werbung|' +
    'suche(\\s+\\S+)?|erweiterte\\s+suche|alle\\s+l(ö|oe)schen|zeitraum|' +
    'kategorien?|home|start|archiv|hier\\s+werben|zur(ü|ue)ck|weiter|' +
    'instagram|facebook|whatsapp|newsletter|bis|mehr|karte|' +
    'stadtticker|revierverhalten|geschmackssachen|stadtgeschichte' + W + '*|' +
    '\\d+\\s*von\\s*\\d+)[^\\p{L}\\p{N}_]*$', 'iu');

  var KATEGORIEN = [
    'ausstellung', 'ballett', 'charity', 'comedy', 'fest', 'flohmarkt',
    'flohmarkt/troedelmarkt/basar', 'fuehrung', 'gesundheit / wellness',
    'gedenkveranstaltung', 'information', 'kinder / jugend',
    'kino / filmvorfuehrung', 'kirche / soziales', 'kleinkunst / kabarett',
    'konzert / livemusik', 'kreativ', 'kulinarisch', 'lesung',
    'messe / tagung', 'musical', 'natur', 'operette', 'party',
    'public viewing', 'revue', 'seminar / workshop', 'senioren', 'shopping',
    'sonstiges', 'sport', 'tag der offenen tuer', 'tanz', 'theater',
    'verkaufsoffen', 'vortrag', 'markt', 'brauchtum', 'familie'
  ];

  var AUFZAEHLUNG = /^\s*(?:[-–—•*·>»]|\d+[.)])\s+/;
  var MD_BILD = /!\[[^\]]*\]\([^)]*\)/g;
  var MD_LINK = /\[([^\]]*)\]\([^)]*\)/g;
  var MD_SPITZ = /<https?:\/\/[^>]*>/g;
  var NACKTE_ADRESSE = /(?:https?:\/\/|www\.)\S+/gi;
  var MD_UEBERSCHRIFT = /^\s{0,3}#{1,6}\s+/;
  var MD_ZIER = /\*\*|__|~~|`/g;

  /* 19:30 · 19.30 Uhr · 19 Uhr · 19:30 - 22:00 */
  var ZEIT = /(?<![\d.,])(\d{1,2})[:.](\d{2})\s*(?:Uhr)?(?:\s*(?:-|–|—|bis)\s*(\d{1,2})[:.](\d{2})\s*(?:Uhr)?)?|(?<![\d.,])(\d{1,2})\s*Uhr/i;
  /* Kein Leerzeichen vor der Jahreszahl — sonst wird aus „23.08. 14 Uhr"
     versehentlich das Jahr 2014. */
  var DATUM_ZIFFERN = /(?<!\d)(\d{1,2})\.\s*(\d{1,2})\.(\d{4}|\d{2})?(?!\d)/;
  var DATUM_MONAT = new RegExp('(?<!\\d)(\\d{1,2})\\.?\\s*(' + laengsteZuerst(MONATE) + ')\\.?\\s*(\\d{4})?', 'iu');
  var WOCHENTAG_MUSTER = new RegExp(VOR + '(' + laengsteZuerst(WOCHENTAG_LANG) + ')' + NACH + '\\.?,?', 'iu');
  var WOCHENTAG_ANFANG = /^\s*(mo|di|mi|do|fr|sa|so)\.?\s*[,.]?\s+(?=\S)/i;

  var PREIS = /(Eintritt\s+frei|freier\s+Eintritt|kostenlos|kostenfrei|(?:ab\s+)?\d{1,3}(?:[,.]\d{2})?\s*(?:€|EUR|Euro))/i;

  var TRENNER = /\s*(?:\||•|·|>>|»)\s*/;
  var ORT_WORT = /\s+(?:im|in\s+der|in\s+dem|in|auf\s+dem|auf\s+der|auf|am|an\s+der|beim|bei|vor\s+dem|@)\s+/gi;
  var ORT_WORT_ANFANG = /^(?:im|in\s+der|in\s+dem|in|auf\s+dem|auf\s+der|auf|am|an\s+der|beim|bei|vor\s+dem|@)\s+/i;
  var ORT_MARKE = /^\s*(?:ort|wo|treffpunkt|veranstaltungsort)\s*[:\-]\s*/i;
  var ZEIT_MARKE = /^\s*(?:zeit|wann|beginn|uhrzeit)\s*[:\-]\s*/i;

  /* Wörter, an denen ein Ort zu erkennen ist — auch hinten in einem
     zusammengesetzten Wort: „Kurgastzentrum" endet auf „zentrum". */
  var ORT_WOERTER =
    'haus|halle|platz|markt|park|kirche|museum|schule|saal|zentrum|' +
    'straße|strasse|str\\.|weg|allee|garten|hof|mühle|muehle|werk|turm|' +
    'bühne|buehne|stadion|arena|friedhof|bahnhof|gelände|gelaende|wiese|' +
    'villa|schloss|burg|kate|klinik|therme|theater|kino|café|cafe|forum|' +
    'bücherei|buecherei|bibliothek|innenstadt|altstadt|rathaus|hotel|' +
    'gradierwerk|kurpark|see|bad|zelt|studio|galerie|akademie|hütte|huette';
  var ORT_ORTSTEILE =
    'bad\\s+salzuflen|schötmar|schoetmar|wüsten|wuesten|bergkirchen|' +
    'lockhausen|holzhausen|werl-aspe|werl|aspe|retzen|ehrsen|biemsen|' +
    'papenhausen|knetterheide|wülfer|wuelfer|bexten|grastrup|hölsen|' +
    'hoelsen|ahmsen|wasserfuhr|obernberg';
  var ORT_MUSTER = new RegExp('(?:' + ORT_WOERTER + ')' + NACH + '|' + VOR + '(?:' + ORT_ORTSTEILE + ')' + NACH, 'iu');

  /* ------------------------------------------------------------ Hilfen */
  function neuesDatum(j, m, t) {
    var d = new Date(j, m - 1, t);
    return (d.getFullYear() === j && d.getMonth() === m - 1 && d.getDate() === t) ? d : null;
  }
  function heuteOhneZeit(h) { var d = h ? new Date(h) : new Date(); d.setHours(0, 0, 0, 0); return d; }
  function plusTage(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function wochentag(d) { return WOCHENTAGE[(d.getDay() + 6) % 7]; }
  function ausIso(s) { var t = String(s || '').split('-').map(Number); return t.length === 3 ? neuesDatum(t[0], t[1], t[2]) : null; }

  /* Ohne Jahresangabe: das Jahr nehmen, in dem der Termin am nächsten liegt. */
  function jahrRaten(tag, monat, heute) {
    var jahre = [heute.getFullYear(), heute.getFullYear() + 1, heute.getFullYear() - 1];
    for (var i = 0; i < jahre.length; i++) {
      var d = neuesDatum(jahre[i], monat, tag);
      if (d && d >= plusTage(heute, -60)) return jahre[i];
    }
    return heute.getFullYear();
  }

  function datumLesen(text, heute) {
    var t = DATUM_ZIFFERN.exec(text), tag, monat, jahr, d;
    if (t) {
      tag = +t[1]; monat = +t[2];
      if (t[3]) { jahr = +t[3]; if (jahr < 100) jahr += 2000; } else jahr = jahrRaten(tag, monat, heute);
      d = neuesDatum(jahr, monat, tag);
      if (!d) return [null, text];
      return [d, text.slice(0, t.index) + ' ' + text.slice(t.index + t[0].length)];
    }
    t = DATUM_MONAT.exec(text);
    if (t) {
      tag = +t[1];
      monat = MONATE[t[2].toLowerCase().replace(/ä/g, 'ae')];
      jahr = t[3] ? +t[3] : jahrRaten(tag, monat, heute);
      d = neuesDatum(jahr, monat, tag);
      if (!d) return [null, text];
      return [d, text.slice(0, t.index) + ' ' + text.slice(t.index + t[0].length)];
    }
    return [null, text];
  }

  function zeitLesen(text) {
    text = text.replace(ZEIT_MARKE, '');
    var t = ZEIT.exec(text), zeit;
    if (!t) return ['', text];
    if (t[1] !== undefined) {
      var std = +t[1];
      if (std > 23 || +t[2] > 59) return ['', text];
      zeit = std + ':' + t[2];
      if (t[3] !== undefined) zeit += '–' + (+t[3]) + ':' + t[4];
    } else {
      if (+t[5] > 23) return ['', text];
      zeit = (+t[5]) + ':00';
    }
    /* Ein „ab" vor der Uhrzeit gehört dazu: „ab 14:30 Uhr" */
    var davor = text.slice(0, t.index);
    if (/\bab\s*$/i.test(davor)) { zeit = 'ab ' + zeit; davor = davor.replace(/\bab\s*$/i, ''); }
    var rest = davor + ' ' + text.slice(t.index + t[0].length);
    rest = rest.replace(/^\s*uhr(?![\p{L}\p{N}_])/iu, ' ');
    return [zeit, rest];
  }

  function saubern(text) {
    return String(text).replace(/\s+/g, ' ').replace(/^[\s,;:.\-–—|/]+|[\s,;:.\-–—|/]+$/g, '').trim();
  }
  /* Für den Vergleich: alles klein, ohne Umlaute und ohne Zeichen. */
  function schlicht(text) {
    return String(text || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '');
  }
  /* Ist das ein Ort — oder nur der zweite Teil einer Überschrift? */
  function siehtNachOrtAus(text) {
    text = saubern(text);
    if (!text || text.split(/\s+/).length > 8) return false;
    return ORT_MUSTER.test(text);
  }
  function istKategorie(zeile) {
    var s = schlicht(zeile);
    if (!s || s.length > 30) return false;
    return KATEGORIEN.some(function (k) { return s === schlicht(k); });
  }

  /* Teilt eine Zeile, in der Titel und Ort zusammenstehen — aber nur, wenn
     der hintere Teil wirklich nach einem Ort aussieht. */
  function titelUndOrt(text) {
    text = saubern(text);
    if (!text) return ['', ''];
    var teile = text.split(TRENNER).filter(function (t) { return saubern(t); });
    if (teile.length >= 2) {
      var hinten = saubern(teile.slice(1).join(' · '));
      if (siehtNachOrtAus(hinten)) return [saubern(teile[0]), hinten];
      return [text, ''];
    }
    /* Kein Trenner da? Dann an einem Ortswort teilen — „Konzert im Kurpark". */
    var treffer = Array.from(text.matchAll(ORT_WORT));
    if (treffer.length) {
      var t = treffer[treffer.length - 1];
      var titel = saubern(text.slice(0, t.index));
      var ort = saubern(text.slice(t.index)).replace(ORT_WORT_ANFANG, '');
      if (titel && ort && siehtNachOrtAus(ort)) return [titel, saubern(ort)];
    }
    /* Komma als letzte Möglichkeit, aber nur wenn hinten ein Ort steht */
    var k = text.lastIndexOf(',');
    if (k >= 0) {
      var vorne = text.slice(0, k), h = saubern(text.slice(k + 1));
      if (saubern(vorne) && siehtNachOrtAus(h)) return [saubern(vorne), h];
    }
    return [text, ''];
  }

  function wochentagLesen(text) {
    var t = WOCHENTAG_MUSTER.exec(text);
    if (t) return [WOCHENTAG_LANG[t[1].toLowerCase()], text.slice(0, t.index) + ' ' + text.slice(t.index + t[0].length)];
    t = WOCHENTAG_ANFANG.exec(text);
    if (t) return [WOCHENTAG_KURZ[t[1].toLowerCase()], text.slice(t[0].length)];
    return [null, text];
  }

  /* Links und Formatierungszeichen aus einer kopierten Zeile werfen */
  function markdownEntfernen(z) {
    return z.replace(MD_BILD, ' ').replace(MD_LINK, '$1').replace(MD_SPITZ, ' ')
      .replace(NACKTE_ADRESSE, ' ').replace(MD_UEBERSCHRIFT, '').replace(MD_ZIER, '');
  }

  function leer() { return { tag: '', datum: '', zeit: '', titel: '', ort: '', preis: '' }; }

  /* ---------------------------------------------------------- Auslesen */
  function termineLesen(roh, heuteWert) {
    var heute = heuteOhneZeit(heuteWert);
    var zeilen = [];
    String(roh || '').replace(/\r/g, '\n').split('\n').forEach(function (zeile) {
      zeile = zeile.replace(/­/g, '').replace(/​/g, '');
      var hatteText = !!zeile.trim();
      zeile = markdownEntfernen(zeile).replace(AUFZAEHLUNG, '').trim().replace(/\s+/g, ' ');
      if (!zeile) {
        /* Stand da nur eine Adresse, war das keine echte Leerzeile */
        if (!hatteText) zeilen.push('');
        return;
      }
      if (MUELL.test(zeile)) { zeilen.push(''); return; }
      zeilen.push(zeile);
    });

    var termine = [], offen = null, stand = 0, letztesDatum = '', luecke = false;

    function ablegen() {
      if (offen && (offen.titel || offen.ort)) {
        if (!offen.titel && offen.ort) { offen.titel = offen.ort; offen.ort = ''; }
        if (!offen.datum && offen.zeit && letztesDatum) {
          offen.datum = letztesDatum;
          offen.tag = wochentag(ausIso(letztesDatum));
        }
        termine.push(offen);
      }
      offen = null; stand = 0;
    }

    zeilen.forEach(function (zeile) {
      if (!zeile) {
        if (offen !== null && stand === 0 && offen.titel) { luecke = true; return; }
        ablegen(); luecke = false; return;
      }
      var hatteLuecke = luecke;
      luecke = false;

      if (istKategorie(zeile)) { ablegen(); return; }

      if (ORT_MARKE.test(zeile)) {
        var ot = saubern(zeile.replace(ORT_MARKE, ''));
        if (offen === null) offen = leer();
        if (ot) offen.ort = ot;
        stand = 1; return;
      }

      var rest = zeile, preis = '';
      var p = PREIS.exec(rest);
      if (p) { preis = saubern(p[1]); rest = rest.slice(0, p.index) + ' ' + rest.slice(p.index + p[0].length); }

      var r = wochentagLesen(rest), nummer = r[0]; rest = r[1];
      r = datumLesen(rest, heute); var datum = r[0]; rest = r[1];
      r = zeitLesen(rest); var zeit = r[0]; rest = r[1];
      var text = saubern(rest), kopf = !!(datum || zeit);
      if (datum) letztesDatum = iso(datum);

      /* Zeile mit Datum oder Uhrzeit, sonst nichts */
      if (kopf && !text) {
        if (offen === null) offen = leer();
        else if (stand === 1 && ((datum && offen.datum) || (zeit && offen.zeit) || offen.ort)) { ablegen(); offen = leer(); }
        if (datum) { offen.datum = iso(datum); offen.tag = wochentag(datum); }
        else if (nummer !== null && !offen.tag) offen.tag = WOCHENTAGE[nummer];
        if (zeit && !offen.zeit) offen.zeit = zeit;
        if (preis && !offen.preis) offen.preis = preis;
        stand = 1; return;
      }

      /* Alles in einer Zeile: „Mi, 12.08. | 14:30 Uhr | Konzert im Kurpark" */
      if (kopf && text) {
        ablegen(); offen = leer();
        if (datum) { offen.datum = iso(datum); offen.tag = wochentag(datum); }
        else if (nummer !== null) offen.tag = WOCHENTAGE[nummer];
        else if (letztesDatum) {
          /* Die Tages-Überschrift darüber gilt — nicht erst die nächste */
          offen.datum = letztesDatum; offen.tag = wochentag(ausIso(letztesDatum));
        }
        offen.zeit = zeit; offen.preis = preis;
        var to = titelUndOrt(text); offen.titel = to[0]; offen.ort = to[1];
        stand = 1; return;
      }

      /* Reine Textzeile */
      if (!text) return;
      if (offen === null) { offen = leer(); stand = 0; }
      if (preis && !offen.preis) offen.preis = preis;

      if (stand === 1) {
        if (!offen.titel) {
          var tu = titelUndOrt(text); offen.titel = tu[0];
          if (tu[1] && !offen.ort) offen.ort = tu[1];
        } else if (!offen.ort) offen.ort = text;
        else { ablegen(); offen = leer(); offen.titel = text; }
      } else {
        /* salzstreuner.de zeigt den Titel zweimal — einmal reicht */
        if (offen.titel && schlicht(text) === schlicht(offen.titel)) return;
        if (offen.titel && hatteLuecke) { ablegen(); offen = leer(); offen.titel = text; }
        else if (!offen.titel) offen.titel = text;
        else if (siehtNachOrtAus(text) && !offen.ort) offen.ort = text;
        else if (offen.titel.length + text.length < 90) offen.titel = saubern(offen.titel + ' ' + text);
        else { ablegen(); offen = leer(); offen.titel = text; }
      }
    });
    ablegen();
    return sortieren(entdoppeln(aussortieren(termine, heute)));
  }

  /* Ohne Datum und Uhrzeit ist es kein Termin; was mehr als eine Woche
     zurückliegt, gehört nicht ins Montagsupdate. */
  function aussortieren(termine, heute) {
    var grenze = plusTage(heute, -7);
    return termine.filter(function (t) {
      if (!t.datum && !t.zeit) return false;
      var d = t.datum && ausIso(t.datum);
      return !(d && d < grenze);
    });
  }

  function gleicherTermin(a, b) {
    if (schlicht(a.titel) !== schlicht(b.titel)) return false;
    if (a.datum && b.datum && a.datum !== b.datum) return false;
    if (a.zeit && b.zeit && a.zeit !== b.zeit) return false;
    if (a.ort && b.ort && schlicht(a.ort) !== schlicht(b.ort)) return false;
    return true;
  }
  /* Denselben Termin nur einmal behalten — und dabei das Vollständigere.
     Gleicher Titel und Zeit an verschiedenen Orten bleibt doppelt stehen. */
  function entdoppeln(termine) {
    var fertig = [];
    termine.forEach(function (t) {
      if (!t.titel && !t.ort) return;
      var schon = fertig.filter(function (s) { return gleicherTermin(s, t); })[0];
      if (schon) ['tag', 'datum', 'zeit', 'ort', 'preis'].forEach(function (f) { if (!schon[f] && t[f]) schon[f] = t[f]; });
      else fertig.push(t);
    });
    return fertig;
  }

  /* Nach Datum, dann Uhrzeit. Termine ohne Datum bleiben hinten. */
  function sortieren(termine) {
    function minuten(z) {
      var teile = String(z || '99:99').replace('ab ', '').split('–')[0].split(':');
      var m = parseInt(teile[0], 10) * 60 + parseInt(teile[1], 10);
      return isNaN(m) ? 9999 : m;
    }
    return termine.slice().sort(function (a, b) {
      var da = a.datum || '9999-99-99', db = b.datum || '9999-99-99';
      if (da !== db) return da < db ? -1 : 1;
      var ma = minuten(a.zeit), mb = minuten(b.zeit);
      if (ma !== mb) return ma - mb;
      return (a.titel || '') < (b.titel || '') ? -1 : (a.titel || '') > (b.titel || '') ? 1 : 0;
    });
  }

  var MONATSNAMEN = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  function datumLang(s) { var d = ausIso(s); return d ? d.getDate() + '. ' + MONATSNAMEN[d.getMonth()] : ''; }
  function datumKurz(s) {
    var t = String(s || '').split('-');
    return t.length === 3 ? t[2].padStart(2, '0') + '.' + t[1].padStart(2, '0') + '.' : '';
  }
  /* „18. – 24. August" aus der Terminliste */
  function wocheBeschriften(termine) {
    var daten = Array.from(new Set(termine.map(function (t) { return t.datum; }).filter(Boolean))).sort();
    if (!daten.length) return '';
    if (daten.length === 1) return datumLang(daten[0]);
    var a = daten[0], b = daten[daten.length - 1];
    if (a.slice(0, 7) === b.slice(0, 7)) return datumLang(a).split('.')[0] + '. – ' + datumLang(b);
    return datumLang(a) + ' – ' + datumLang(b);
  }

  window.BSNTermine = {
    lesen: termineLesen, woche: wocheBeschriften, datumLang: datumLang, datumKurz: datumKurz,
    wochentagVon: function (s) { var d = ausIso(s); return d ? wochentag(d) : ''; }
  };
})();

/* Wetter für Bad Salzuflen: kleine Anzeige in der Kopfzeile, Wetter-Kachel auf der Startseite,
   Vorhersage neben jedem Termin der nächsten zehn Tage. Daten vom Deutschen Wetterdienst (offene Daten),
   abgerufen über Bright Sky (brightsky.dev), ohne Schlüssel und auch mit Werbung auf der Seite erlaubt.
   Eine Abfrage pro Besuch, 30 Minuten im Browser zwischengespeichert. */
(function () {
  var API = 'https://api.brightsky.dev/', ORT = 'lat=52.0875&lon=8.7508&tz=Europe%2FBerlin';
  var KEY = 'bsn-wetter-dwd', MAX_ALTER = 30 * 60e3;

  function ico(d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; }
  var WOLKE = '<path d="M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24"/>';
  var ICONS = {
    sonne: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-17.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    mond: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    heiter: '<path d="M12 2v2m-7.07.93 1.41 1.41M20 12h2m-2.93-7.07-1.41 1.41M15.95 12.65a4 4 0 0 0-5.93-4.13"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>',
    wolke: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    nebel: WOLKE + '<path d="M16 17H7m10 4H9"/>',
    regen: WOLKE + '<path d="M16 14v6M8 14v6m4-4v6"/>',
    schnee: WOLKE + '<path d="M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01"/>',
    gewitter: '<path d="M6 16.33A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.97"/><path d="m13 12-3 5h4l-3 5"/>'
  };

  /* Wetterbilder von Bright Sky in Worte und Symbol */
  function art(icon) {
    return {
      'clear-day': ['Sonnig', 'sonne'], 'clear-night': ['Klar', 'mond'],
      'partly-cloudy-day': ['Leicht bewölkt', 'heiter'], 'partly-cloudy-night': ['Leicht bewölkt', 'wolke'],
      'cloudy': ['Bewölkt', 'wolke'], 'fog': ['Nebel', 'nebel'], 'wind': ['Windig', 'wolke'],
      'rain': ['Regen', 'regen'], 'sleet': ['Schneeregen', 'schnee'], 'snow': ['Schnee', 'schnee'],
      'hail': ['Hagel', 'gewitter'], 'thunderstorm': ['Gewitter', 'gewitter']
    }[icon] || ['Wechselhaft', 'wolke'];
  }
  function grad(t) { return Math.round(t) + '°'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function isoTag(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  /* Tageswetter aus den Stunden von 9 bis 19 Uhr: Unwetter und Niederschlag vor Wolken */
  function tagesbild(icons) {
    function n(l) { return icons.filter(function (i) { return l.indexOf(i) >= 0; }).length; }
    if (!icons.length) return null;
    if (n(['thunderstorm', 'hail'])) return 'thunderstorm';
    if (n(['snow', 'sleet']) >= 2) return 'snow';
    if (n(['rain']) >= 3) return 'rain';
    if (n(['fog']) >= 4) return 'fog';
    if (n(['cloudy', 'wind']) >= 6) return 'cloudy';
    if (n(['clear-day']) >= 6) return 'clear-day';
    return 'partly-cloudy-day';
  }

  /* Bright Sky liefert Stunden; daraus werden jetzt, Stunden und Tage */
  function umwandeln(stunden, jetzt) {
    var d = { current: { temperature_2m: jetzt.temperature, weather_code: jetzt.icon },
      hourly: { time: [], temperature_2m: [], weather_code: [], precipitation_probability: [] },
      daily: { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [], precipitation_probability_max: [] } };
    var tage = {};
    stunden.forEach(function (w) {
      if (w.temperature == null) return;
      var tag = w.timestamp.slice(0, 10), std = +w.timestamp.slice(11, 13), p = w.precipitation_probability;
      d.hourly.time.push(w.timestamp.slice(0, 13) + ':00');
      d.hourly.temperature_2m.push(w.temperature);
      d.hourly.weather_code.push(w.icon);
      d.hourly.precipitation_probability.push(p == null ? 0 : p);
      var t = tage[tag] || (tage[tag] = { max: -99, min: 99, regen: 0, icons: [], stunden: 0 });
      t.max = Math.max(t.max, w.temperature); t.min = Math.min(t.min, w.temperature);
      t.regen = Math.max(t.regen, p || 0); t.stunden++;
      if (std >= 9 && std <= 19) t.icons.push(w.icon);
    });
    Object.keys(tage).sort().forEach(function (tag) {
      var t = tage[tag], bild = tagesbild(t.icons);
      if (!bild || t.stunden < 12) return; /* angebrochener letzter Tag */
      d.daily.time.push(tag); d.daily.weather_code.push(bild);
      d.daily.temperature_2m_max.push(t.max); d.daily.temperature_2m_min.push(t.min);
      d.daily.precipitation_probability_max.push(t.regen);
    });
    return d;
  }

  function holen(pfad) { return fetch(API + pfad).then(function (r) { if (!r.ok) throw new Error('Wetter ' + r.status); return r.json(); }); }
  function laden() {
    try {
      var c = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (c && Date.now() - c.zeit < MAX_ALTER) return Promise.resolve(c.daten);
    } catch (e) {}
    var heute = new Date(), ende = new Date(heute.getTime() + 11 * 864e5);
    return Promise.all([
      holen('weather?' + ORT + '&date=' + isoTag(heute) + '&last_date=' + isoTag(ende)),
      holen('current_weather?' + ORT)
    ]).then(function (r) {
      var d = umwandeln(r[0].weather || [], r[1].weather || {});
      if (d.current.temperature_2m == null || !d.daily.time.length) throw new Error('Wetter unvollständig');
      try { sessionStorage.setItem(KEY, JSON.stringify({ zeit: Date.now(), daten: d })); } catch (e) {}
      return d;
    });
  }

  /* 1 · Kopfzeile */
  function kopf(d) {
    var el = document.getElementById('wetterKopf');
    if (!el) return;
    var c = d.current, a = art(c.weather_code);
    el.innerHTML = ico(ICONS[a[1]]) + '<span>' + grad(c.temperature_2m) + '</span><span class="wetter-kopf-ort">Bad Salzuflen</span>';
    el.setAttribute('aria-label', 'Wetter in Bad Salzuflen: ' + grad(c.temperature_2m) + ', ' + a[0]);
    el.title = a[0];
    el.hidden = false;
  }

  /* 2 · Kachel auf der Startseite (Platzhalter setzt home.js) */
  function kachel(d) {
    var el = document.getElementById('wetter');
    if (!el) return;
    var c = d.current, a = art(c.weather_code), t = d.daily, tage = '';
    for (var i = 1; i <= 4 && i < t.time.length; i++) {
      var w = art(t.weather_code[i]), tag = new Date(t.time[i] + 'T12:00').toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
      tage += '<li><span>' + tag + '</span>' + ico(ICONS[w[1]]) + '<b>' + grad(t.temperature_2m_max[i]) + '</b>' +
        '<span class="sr-only">' + w[0] + ', bis ' + grad(t.temperature_2m_max[i]) + '</span></li>';
    }
    var bild = { mond: 'nacht', gewitter: 'regen' }[a[1]] || a[1];
    el.innerHTML = '<img src="assets/img/wetter/' + bild + '.jpg" alt="" loading="lazy" onerror="this.remove()">' +
      '<div class="tile-body"><span class="wetter-quelle" title="Daten: Deutscher Wetterdienst"><span class="wetter-quelle-wort">Daten: </span>DWD</span>' +
      '<div class="wetter-jetzt">' + ico(ICONS[a[1]]) + '<strong>' + grad(c.temperature_2m) + '</strong></div>' +
      '<p class="wetter-text">' + a[0] + ' · ' + grad(t.temperature_2m_min[0]) + ' bis ' + grad(t.temperature_2m_max[0]) + '</p>' +
      '<ul class="wetter-tage" aria-label="Die nächsten Tage">' + tage + '</ul></div>';
    el.classList.add('bereit');
  }
  function kachelFehler() {
    var el = document.getElementById('wetter');
    if (!el) return;
    el.innerHTML = '<div class="tile-body"><p class="wetter-text">Das Wetter für Bad Salzuflen lässt sich gerade nicht laden.</p></div>';
    el.classList.add('bereit');
  }

  /* 3 · Termine: mit Uhrzeit das Wetter zu dieser Stunde, sonst der Tag */
  function termine(d) {
    var box = document.getElementById('events');
    if (!box) return;
    function stunde(iso, zeit) {
      var m = /^(\d{1,2})[:.](\d{2})/.exec(zeit || '');
      if (!m) return -1;
      return d.hourly.time.indexOf(iso + 'T' + String(Math.min(23, +m[1])).padStart(2, '0') + ':00');
    }
    function setzen() {
      box.querySelectorAll('.event[data-tag]:not([data-wetter])').forEach(function (ev) {
        var iso = ev.getAttribute('data-tag'), di = d.daily.time.indexOf(iso);
        ev.setAttribute('data-wetter', '');
        if (di < 0) return;
        var h = stunde(iso, ev.getAttribute('data-zeit')), temp, code, regen;
        if (h < 0 && /^\d/.test(ev.getAttribute('data-zeit') || '')) return; /* Uhrzeit liegt hinter der Vorhersage */
        if (h >= 0) { temp = d.hourly.temperature_2m[h]; code = d.hourly.weather_code[h]; regen = d.hourly.precipitation_probability[h]; }
        else { temp = d.daily.temperature_2m_max[di]; code = d.daily.weather_code[di]; regen = d.daily.precipitation_probability_max[di]; }
        var a = art(code), text = regen >= 40 ? 'Regen ' + regen + ' %' : (a[1] === 'regen' ? 'kaum Regen' : a[0]);
        if (a[1] === 'schnee' || a[1] === 'gewitter') text = a[0];
        /* Feste Spalte rechts im Termin, Gegenstück zum Datum links */
        var box = document.createElement('div');
        box.className = 'wetter-termin';
        box.innerHTML = ico(ICONS[regen >= 40 && a[1] !== 'schnee' && a[1] !== 'gewitter' ? 'regen' : a[1]]) +
          '<b aria-hidden="true">' + grad(temp) + '</b><span class="wetter-termin-text" aria-hidden="true">' + esc(text) + '</span>' +
          '<span class="sr-only">Wettervorhersage' + (h >= 0 ? ' für ' + esc(ev.getAttribute('data-zeit')) + ' Uhr' : '') + ': ' + grad(temp) + ', ' + esc(text) + '</span>';
        box.title = 'Vorhersage' + (h >= 0 ? ' für ' + ev.getAttribute('data-zeit') + ' Uhr' : ' für den Tag');
        ev.classList.add('mit-wetter');
        ev.appendChild(box);
      });
    }
    setzen();
    new MutationObserver(setzen).observe(box, { childList: true });
    var quelle = document.createElement('p');
    quelle.className = 'wetter-hinweis';
    quelle.innerHTML = 'Wettervorhersage für die nächsten zehn Tage: <a href="https://www.dwd.de" target="_blank" rel="noopener">Deutscher Wetterdienst</a>, abgerufen über <a href="https://brightsky.dev" target="_blank" rel="noopener">Bright Sky</a>.';
    box.after(quelle);
  }

  laden().then(function (d) { kopf(d); kachel(d); termine(d); })
    .catch(function () { kachelFehler(); });
  /* Die Kachel entsteht erst, wenn die Startseite ihre Beiträge geladen hat */
  window.BSNWetter = { kachel: function () { laden().then(kachel, kachelFehler); } };
})();

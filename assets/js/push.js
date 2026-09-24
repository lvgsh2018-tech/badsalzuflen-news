/* Mitteilungen bei neuen Beiträgen: Karte „Keinen Beitrag verpassen“.
   Füllt jedes Element mit [data-push]. Die Erlaubnis wird erst nach einem Klick abgefragt. */
(function () {
  var boxes = document.querySelectorAll('[data-push]');
  if (!boxes.length || !window.BSN) return;

  var ua = navigator.userAgent;
  var iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  var can = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  var key = null, reg = null, busy = false;

  var BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
  var SHARE = '<svg class="ico-inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Teilen-Symbol"><path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';

  function b64(s) {
    var p = '='.repeat((4 - s.length % 4) % 4), raw = atob((s + p).replace(/-/g, '+').replace(/_/g, '/'));
    var out = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i); return out;
  }

  function paint(state, msg) {
    var title = 'Keinen Beitrag verpassen', text, action = '';
    if (state === 'ios') {
      text = 'Auf dem iPhone geht das so: unten auf ' + SHARE + ' <b>Teilen</b> tippen, dann <b>„Zum Home-Bildschirm“</b>. ' +
        'Öffne Bad Salzuflen News danach über das neue Symbol und schalte hier die Mitteilungen ein.';
    } else if (state === 'off') {
      text = 'Wir sagen dir mit einer kurzen Mitteilung Bescheid, sobald ein neuer Beitrag erscheint. Jederzeit wieder abschaltbar. <a href="datenschutz.html#mitteilungen">Mehr zum Datenschutz</a>';
      action = '<button class="btn btn-primary" type="button" data-push-on>Mitteilungen einschalten</button>';
    } else if (state === 'on') {
      title = 'Mitteilungen sind an';
      text = 'Du bekommst eine kurze Mitteilung, sobald ein neuer Beitrag erscheint.';
      action = '<button class="btn btn-secondary" type="button" data-push-off>Ausschalten</button>';
    } else if (state === 'blocked') {
      text = 'Mitteilungen sind für diese Seite in deinem Browser blockiert. Du kannst sie in den Einstellungen des Browsers wieder erlauben.';
    } else {
      text = 'Dieser Browser kann leider keine Mitteilungen empfangen. Probier es mit Chrome, Firefox, Edge oder Safari.';
    }
    boxes.forEach(function (b) {
      b.className = 'push-card' + (state === 'on' ? ' is-on' : '');
      b.hidden = false;
      b.innerHTML = '<div class="push-icon">' + BELL + '</div><div class="push-text"><h2>' + title + '</h2><p>' + text + '</p>' +
        (msg ? '<p class="push-msg" role="status">' + msg + '</p>' : '') + '</div>' +
        (action ? '<div class="push-action">' + action + '</div>' : '');
    });
  }

  function subscribe() {
    if (busy) return; busy = true;
    // Erlaubnis direkt im Klick abfragen (Safari verlangt das).
    Notification.requestPermission().then(function (p) {
      if (p !== 'granted') { busy = false; paint(p === 'denied' ? 'blocked' : 'off'); return; }
      return navigator.serviceWorker.ready.then(function (r) {
        return r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
      }).then(function (sub) { return BSN.pushSubscribe(sub); }).then(function () {
        busy = false; paint('on', 'Geklappt! Ab jetzt bist du immer als Erstes informiert.');
      });
    }).catch(function () { busy = false; paint('off', 'Das hat gerade nicht geklappt. Bitte versuche es noch einmal.'); });
  }

  function unsubscribe() {
    if (busy) return; busy = true;
    reg.pushManager.getSubscription().then(function (sub) {
      if (!sub) return;
      var ep = sub.endpoint;
      return sub.unsubscribe().then(function () { return BSN.pushUnsubscribe(ep).catch(function () {}); });
    }).then(function () { busy = false; paint('off', 'Mitteilungen sind aus.'); })
      .catch(function () { busy = false; paint('on', 'Das hat gerade nicht geklappt. Bitte versuche es noch einmal.'); });
  }

  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-push-on]')) subscribe();
    else if (e.target.closest('[data-push-off]')) unsubscribe();
  });

  if (!can) {
    // iPhone im normalen Safari: erst zum Home-Bildschirm. Andere Browser ohne Mitteilungen: Karte weglassen.
    if (iOS && !standalone) BSN.pushPublicKey().then(function (k) { if (k) paint('ios'); }).catch(function () {});
    return;
  }

  Promise.all([
    navigator.serviceWorker.register('sw.js'),
    BSN.pushPublicKey().catch(function () { return null; })
  ]).then(function (r) {
    reg = r[0]; key = r[1];
    if (!key) return; // Versand noch nicht eingerichtet: Karte bleibt versteckt.
    if (Notification.permission === 'denied') { paint('blocked'); return; }
    return reg.pushManager.getSubscription().then(function (sub) {
      if (sub && Notification.permission === 'granted') {
        BSN.pushSubscribe(sub).catch(function () {}); // hält die Liste aktuell
        paint('on');
      } else paint('off');
    });
  }).catch(function () {});
})();

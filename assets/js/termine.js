(function () {
  var R = window.BSNR, box = document.getElementById('events');
  BSN.listEvents().then(function (list) {
    var today = R.todayIso();
    list = list.filter(function (e) { return e.starts_on >= today; });
    if (!list.length) { box.innerHTML = '<p class="posts-note">Aktuell sind keine Termine eingetragen. Schau bald wieder vorbei.</p>'; return; }
    var html = '', month = '';
    list.forEach(function (e) {
      var m = R.day(e.starts_on).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      if (m !== month) { month = m; html += '<h2>' + R.esc(m) + '</h2>'; }
      html += R.eventHTML(e);
    });
    box.innerHTML = html;
  }).catch(function () { box.innerHTML = '<p class="posts-note">Die Termine lassen sich gerade nicht laden.</p>'; });
  R.demoBadge();
})();

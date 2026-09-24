/* Redaktionsbereich: Übersicht, Beitragsliste, Editor. */
(function () {
  var R = window.BSNR, esc = R.esc, view = document.getElementById('view');
  var articles = [], views = [], pushN = null, dirty = false;

  /* ---------- Hilfen ---------- */
  function toast(msg, bad) {
    var t = document.getElementById('toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' err' : ''); t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 3200);
  }
  function ask(o) {
    return new Promise(function (res) {
      var d = document.getElementById('dlg');
      document.getElementById('dlgTitle').textContent = o.title;
      document.getElementById('dlgText').textContent = o.text || '';
      var f = document.getElementById('dlgField'), i = document.getElementById('dlgInput');
      f.hidden = !o.input; i.value = o.value || ''; document.getElementById('dlgLabel').textContent = o.label || '';
      var yes = document.getElementById('dlgYes'); yes.textContent = o.yes || 'OK';
      yes.className = 'btn btn-sm ' + (o.danger ? 'btn-danger' : 'btn-primary');
      d.onclose = function () { res(d.returnValue === 'ok' ? (o.input ? i.value.trim() : true) : null); };
      d.showModal(); if (o.input) i.focus();
    });
  }
  /* Mitteilung an alle, die sie eingeschaltet haben – nur nach Rückfrage. */
  function notify(a) {
    return BSN.pushCount().catch(function () { return 0; }).then(function (n) {
      if (!n) return null;
      return ask({
        title: 'Leser benachrichtigen?',
        text: n + (n === 1 ? ' Person bekommt' : ' Personen bekommen') + ' eine Mitteilung mit der Überschrift „' + title(a) + '“. Das geht pro Beitrag nur einmal.',
        yes: 'Mitteilung senden'
      }).then(function (ok) {
        if (!ok) return null;
        toast('Mitteilung wird verschickt …');
        return BSN.pushSend(a.id).then(function (r) {
          toast('Mitteilung ist raus an ' + r.sent + (r.sent === 1 ? ' Person.' : ' Personen.'));
          return r;
        }).catch(function (x) { toast(x.message, true); return null; });
      });
    });
  }
  function views7(id) {
    var lim = Date.now() - 7 * 864e5;
    return views.filter(function (v) { return (!id || v.article_id === id) && new Date(v.created_at).getTime() >= lim; }).length;
  }
  function viewsOf(id) { return views.filter(function (v) { return v.article_id === id; }).length; }
  function title(a) { return a.title || 'Ohne Titel'; }
  function load() {
    return Promise.all([BSN.listAll(), BSN.getViews().catch(function () { return []; }), BSN.pushCount().catch(function () { return null; })])
      .then(function (r) { articles = r[0]; views = r[1]; pushN = r[2]; });
  }

  /* ---------- Übersicht ---------- */
  function pageOverview() {
    var pub = articles.filter(function (a) { return a.status === 'published'; }), dr = articles.length - pub.length;
    var days = [], max = 1, i;
    for (i = 13; i >= 0; i--) { var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i); days.push({ d: d, n: 0 }); }
    views.forEach(function (v) {
      var t = new Date(v.created_at); t.setHours(0, 0, 0, 0);
      days.forEach(function (x) { if (x.d.getTime() === t.getTime()) x.n++; });
    });
    days.forEach(function (x) { if (x.n > max) max = x.n; });
    var top = pub.map(function (a) { return { a: a, n: viewsOf(a.id) }; }).sort(function (x, y) { return y.n - x.n; }).slice(0, 5);
    view.innerHTML = '<h1>Übersicht</h1>' +
      '<div class="stat-grid">' +
      '<div class="stat"><strong>' + views.length + '</strong><span>Aufrufe insgesamt</span></div>' +
      '<div class="stat"><strong>' + views7() + '</strong><span>Aufrufe letzte 7 Tage</span></div>' +
      '<div class="stat"><strong>' + pub.length + '</strong><span>Veröffentlichte Beiträge</span></div>' +
      '<div class="stat"><strong>' + dr + '</strong><span>Entwürfe</span></div></div>' +
      (pushN !== null && BSN.live ? '<p class="push-note">' + pushN + (pushN === 1 ? ' Person hat' : ' Personen haben') + ' Mitteilungen bei neuen Beiträgen eingeschaltet.</p>' : '') +
      '<div class="panel-cols"><section class="panel"><h2>Aufrufe pro Tag (14 Tage)</h2>' +
      '<div class="bars" role="img" aria-label="Balkendiagramm der Aufrufe pro Tag, insgesamt ' + days.reduce(function (s, x) { return s + x.n; }, 0) + ' in 14 Tagen">' +
      days.map(function (x) {
        return '<div class="bar" title="' + x.d.toLocaleDateString('de-DE') + ': ' + x.n + '"><b>' + (x.n || '') + '</b><i style="height:' + Math.round(x.n / max * 100) + '%"></i><small>' + x.d.getDate() + '.</small></div>';
      }).join('') + '</div></section>' +
      '<section class="panel"><h2>Meistgelesen</h2>' + (top.length ? '<ol class="rank">' + top.map(function (t) {
        return '<li><a href="#editor/' + esc(t.a.id) + '">' + esc(title(t.a)) + '</a><span>' + t.n + ' Aufrufe</span></li>';
      }).join('') + '</ol>' : '<p class="empty">Noch keine veröffentlichten Beiträge.</p>') + '</section></div>' +
      '<p><a class="btn btn-primary" href="#editor/neu">Neuen Beitrag schreiben</a></p>';
  }

  /* ---------- Beitragsliste ---------- */
  var listFilter = 'alle';
  function pageList() {
    var rows = articles.filter(function (a) { return listFilter === 'alle' || (listFilter === 'live') === (a.status === 'published'); });
    view.innerHTML = '<h1>Beiträge</h1><div class="list-tools" role="group" aria-label="Filtern">' +
      [['alle', 'Alle'], ['live', 'Veröffentlicht'], ['draft', 'Entwürfe']].map(function (f) {
        return '<button class="chip" type="button" data-f="' + f[0] + '" aria-pressed="' + (listFilter === f[0]) + '">' + f[1] + '</button>';
      }).join('') + '</div><div class="panel"><div class="table-wrap">' +
      (rows.length ? '<table class="posts"><thead><tr><th>Titel</th><th>Thema</th><th>Status</th><th>Datum</th><th>Aufrufe</th><th><span class="sr-only">Aktionen</span></th></tr></thead><tbody>' +
        rows.map(function (a) {
          return '<tr><td class="t"><a href="#editor/' + esc(a.id) + '">' + esc(title(a)) + '</a></td><td>' + esc(a.category) + '</td>' +
            '<td><span class="badge ' + (a.status === 'published' ? 'live' : 'draft') + '">' + (a.status === 'published' ? 'Veröffentlicht' : 'Entwurf') + '</span></td>' +
            '<td>' + R.date(a.published_at || a.created_at) + '</td><td>' + viewsOf(a.id) + '</td>' +
            '<td><div class="row-actions"><a class="btn-ghost" href="#editor/' + esc(a.id) + '">Bearbeiten</a>' +
            '<a class="btn-ghost" href="' + R.url(a) + '" target="_blank" rel="noopener">Ansehen</a>' +
            '<button class="btn-ghost del" type="button" data-del="' + esc(a.id) + '">Löschen</button></div></td></tr>';
        }).join('') + '</tbody></table>' : '<p class="empty">Hier ist noch nichts. <a href="#editor/neu">Schreib den ersten Beitrag.</a></p>') +
      '</div></div>';
  }
  view.addEventListener('click', function (e) {
    var f = e.target.closest('[data-f]'); if (f) { listFilter = f.dataset.f; pageList(); return; }
    var d = e.target.closest('[data-del]');
    if (d) {
      var a = articles.filter(function (x) { return x.id === d.dataset.del; })[0];
      ask({ title: 'Beitrag löschen?', text: '„' + title(a) + '“ wird endgültig gelöscht. Das lässt sich nicht rückgängig machen.', yes: 'Endgültig löschen', danger: true }).then(function (ok) {
        if (!ok) return;
        BSN.deleteArticle(a.id).then(load).then(function () { pageList(); toast('Beitrag gelöscht.'); }).catch(function (x) { toast(x.message, true); });
      });
    }
  });

  /* ---------- Editor ---------- */
  function pageEditor(id) {
    var isNew = id === 'neu';
    (isNew ? Promise.resolve({ title: '', teaser: '', body: '', category: BSN.categories[0], image_url: '', image_credit: '', status: 'draft', featured: false }) : BSN.getById(id)).then(function (a) {
      if (!a) { view.innerHTML = '<h1>Beitrag nicht gefunden</h1><p><a href="#beitraege">Zurück zur Liste</a></p>'; return; }
      dirty = false;
      var cats = BSN.categories.slice(); if (cats.indexOf(a.category) < 0) cats.push(a.category);
      var live = a.status === 'published';
      view.innerHTML = '<div class="editor-grid"><div>' +
        '<input class="title-input" id="fTitle" placeholder="Überschrift" aria-label="Überschrift" value="' + esc(a.title) + '">' +
        '<label class="field" style="margin-top:0"><span>Kurzfassung (erscheint unter der Überschrift und auf Kacheln)</span><textarea id="fTeaser" maxlength="220">' + esc(a.teaser) + '</textarea></label>' +
        '<div class="field"><span>Text</span></div>' +
        '<div class="toolbar" role="toolbar" aria-label="Textformat">' +
        '<button type="button" data-cmd="bold" aria-label="Fett" title="Fett"><b>F</b></button>' +
        '<button type="button" data-cmd="italic" aria-label="Kursiv" title="Kursiv"><i>K</i></button><span class="sep"></span>' +
        '<button type="button" data-block="h2" aria-label="Überschrift" title="Zwischenüberschrift">Ü</button>' +
        '<button type="button" data-block="p" aria-label="Normaler Text" title="Normaler Text">¶</button>' +
        '<button type="button" data-cmd="insertUnorderedList" aria-label="Liste" title="Liste">• Liste</button>' +
        '<button type="button" data-block="blockquote" aria-label="Zitat" title="Zitat">„ “</button><span class="sep"></span>' +
        '<button type="button" data-link aria-label="Link einfügen" title="Link einfügen">Link</button>' +
        '<button type="button" data-cmd="unlink" aria-label="Link entfernen" title="Link entfernen">Link weg</button></div>' +
        '<div class="body-edit" id="fBody" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Beitragstext" data-placeholder="Schreib hier deinen Beitrag …">' + R.sanitize(a.body) + '</div>' +
        '</div><aside class="editor-side">' +
        '<div class="panel"><div class="cover-preview" id="cover">' + (a.image_url ? '<img src="' + esc(a.image_url) + '" alt="Titelbild">' : 'Noch kein Titelbild') + '</div>' +
        '<div class="side-row"><label class="btn btn-secondary btn-sm" for="fFile" style="cursor:pointer">Bild wählen</label><button class="btn-ghost" type="button" id="rmImg"' + (a.image_url ? '' : ' hidden') + '>Entfernen</button></div>' +
        '<input type="file" id="fFile" accept="image/*" class="sr-only">' +
        '<label class="field"><span>Bildnachweis (z. B. „Foto: Name“)</span><input id="fCredit" value="' + esc(a.image_credit) + '"></label></div>' +
        '<div class="panel"><label class="field" style="margin-top:0"><span>Thema</span><select id="fCat">' + cats.map(function (c) { return '<option' + (c === a.category ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
        '<label class="check"><input type="checkbox" id="fFeat"' + (a.featured ? ' checked' : '') + '><span>Als große Kachel oben auf der Startseite zeigen</span></label></div>' +
        '<div class="panel stack"><div class="save-state" id="state">' + (live ? 'Veröffentlicht am ' + R.date(a.published_at) : 'Entwurf — noch nicht sichtbar') + '</div>' +
        (live
          ? '<button class="btn btn-primary" id="bSave" type="button">Änderungen speichern</button><button class="btn btn-secondary" id="bDraft" type="button">Zurück zum Entwurf</button>'
          : '<button class="btn btn-primary" id="bPub" type="button">Veröffentlichen</button><button class="btn btn-secondary" id="bSave" type="button">Als Entwurf speichern</button>') +
        (live && !a.notified_at && BSN.live ? '<button class="btn-ghost" type="button" id="bNotify">Leser per Mitteilung informieren</button>' : '') +
        '<button class="btn-ghost" type="button" id="bPrev"' + (isNew ? ' disabled' : '') + '>Vorschau in neuem Tab</button></div></aside></div>';

      var st = { id: a.id, image_url: a.image_url, status: a.status, published_at: a.published_at };
      var body = document.getElementById('fBody');
      view.oninput = view.onchange = function () { dirty = true; };

      view.querySelector('.toolbar').addEventListener('mousedown', function (e) { e.preventDefault(); });
      view.querySelector('.toolbar').addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return; body.focus();
        if (b.dataset.cmd) document.execCommand(b.dataset.cmd);
        else if (b.dataset.block) document.execCommand('formatBlock', false, b.dataset.block);
        else if (b.hasAttribute('data-link')) {
          var sel = window.getSelection(), range = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
          ask({ title: 'Link einfügen', text: 'Markiere vorher den Text, der zum Link werden soll.', input: true, label: 'Adresse', yes: 'Einfügen' }).then(function (u) {
            if (!u) return; body.focus(); sel.removeAllRanges(); if (range) sel.addRange(range);
            if (!/^(https?:|mailto:)/i.test(u)) u = 'https://' + u;
            document.execCommand('createLink', false, u);
          });
        }
        dirty = true;
      });
      body.addEventListener('paste', function (e) {
        e.preventDefault();
        var cd = e.clipboardData, h = cd.getData('text/html');
        var clean = h ? R.sanitize(h) : esc(cd.getData('text/plain')).split(/\n{2,}/).map(function (p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; }).join('');
        document.execCommand('insertHTML', false, clean);
      });

      function setCover(url) {
        st.image_url = url; var c = document.getElementById('cover');
        c.innerHTML = url ? '<img alt="Titelbild">' : 'Noch kein Titelbild';
        if (url) c.querySelector('img').src = url;
        document.getElementById('rmImg').hidden = !url; dirty = true;
      }
      document.getElementById('fFile').addEventListener('change', function (e) {
        var f = e.target.files[0]; if (!f) return; toast('Bild wird verarbeitet …');
        BSN.uploadImage(f).then(function (url) { setCover(url); toast('Bild ist drin.'); }).catch(function (x) { toast(x.message, true); });
        e.target.value = '';
      });
      document.getElementById('rmImg').addEventListener('click', function () { setCover(''); });

      function collect(status) {
        return {
          id: st.id, title: document.getElementById('fTitle').value.trim(), teaser: document.getElementById('fTeaser').value.trim(),
          body: R.sanitize(body.innerHTML), category: document.getElementById('fCat').value, image_url: st.image_url,
          image_credit: document.getElementById('fCredit').value.trim(), featured: document.getElementById('fFeat').checked,
          status: status, published_at: st.published_at
        };
      }
      function save(status, msg) {
        var rec = collect(status), missing = [];
        if (!rec.title) missing.push('eine Überschrift');
        if (status === 'published' && !rec.teaser) missing.push('eine Kurzfassung');
        if (status === 'published' && !rec.body.replace(/<[^>]+>/g, '').trim()) missing.push('einen Text');
        if (missing.length) { toast('Es fehlt noch ' + missing.join(' und ') + '.', true); return; }
        var btns = view.querySelectorAll('.editor-side .btn'); btns.forEach(function (b) { b.disabled = true; });
        BSN.saveArticle(rec).then(function (saved) {
          dirty = false; toast(msg);
          var first = status === 'published' && !live && !saved.notified_at;
          return (first ? notify(saved) : Promise.resolve()).then(load).then(function () { location.hash = '#beitraege'; });
        }).catch(function (x) { toast(x.message, true); btns.forEach(function (b) { b.disabled = false; }); });
      }
      var nb = document.getElementById('bNotify');
      if (nb) nb.addEventListener('click', function () { notify(a).then(function (r) { if (r) nb.hidden = true; }); });
      var pub = document.getElementById('bPub'), sv = document.getElementById('bSave'), dr = document.getElementById('bDraft');
      if (pub) pub.addEventListener('click', function () {
        ask({ title: 'Jetzt veröffentlichen?', text: 'Der Beitrag ist danach für alle Besucher der Webseite sichtbar.', yes: 'Veröffentlichen' }).then(function (ok) { if (ok) save('published', 'Beitrag veröffentlicht.'); });
      });
      if (sv) sv.addEventListener('click', function () { save(live ? 'published' : 'draft', live ? 'Änderungen gespeichert.' : 'Entwurf gespeichert.'); });
      if (dr) dr.addEventListener('click', function () { save('draft', 'Beitrag ist wieder ein Entwurf.'); });
      document.getElementById('bPrev').addEventListener('click', function () {
        var rec = collect(st.status);
        var open = function (s) { window.open('artikel.html?s=' + encodeURIComponent(s.slug), '_blank'); };
        if (!rec.title) { toast('Gib zuerst eine Überschrift ein.', true); return; }
        BSN.saveArticle(rec).then(function (s) { dirty = false; open(s); toast('Zwischengespeichert.'); });
      });
    });
  }

  /* ---------- Termine ---------- */
  function pageEvents() {
    BSN.listEvents().then(function (list) {
      var today = R.todayIso(), up = list.filter(function (e) { return e.starts_on >= today; }), past = list.filter(function (e) { return e.starts_on < today; }).reverse();
      function rows(a) {
        return a.map(function (e) {
          return '<tr><td class="t"><a href="#termin/' + esc(e.id) + '">' + esc(e.title) + '</a></td><td>' + R.date(e.starts_on) + (e.starts_at ? ', ' + esc(e.starts_at) + ' Uhr' : '') + '</td><td>' + esc(e.location) + '</td>' +
            '<td><div class="row-actions"><a class="btn-ghost" href="#termin/' + esc(e.id) + '">Bearbeiten</a><button class="btn-ghost del" type="button" data-delev="' + esc(e.id) + '">Löschen</button></div></td></tr>';
        }).join('');
      }
      function table(a, empty) {
        return a.length ? '<table class="posts"><thead><tr><th>Termin</th><th>Wann</th><th>Wo</th><th><span class="sr-only">Aktionen</span></th></tr></thead><tbody>' + rows(a) + '</tbody></table>' : '<p class="empty">' + empty + '</p>';
      }
      view.innerHTML = '<h1>Termine</h1><p><a class="btn btn-primary" href="#termin/neu">+ Neuer Termin</a></p>' +
        '<div class="panel"><h2>Kommende Termine</h2><div class="table-wrap">' + table(up, 'Keine kommenden Termine eingetragen.') + '</div></div>' +
        (past.length ? '<div class="panel"><h2>Vergangene Termine</h2><div class="table-wrap">' + table(past, '') + '</div></div>' : '');
      view.querySelectorAll('[data-delev]').forEach(function (b) {
        b.addEventListener('click', function () {
          var e = list.filter(function (x) { return x.id === b.dataset.delev; })[0];
          ask({ title: 'Termin löschen?', text: '„' + e.title + '“ wird endgültig gelöscht.', yes: 'Endgültig löschen', danger: true }).then(function (ok) {
            if (ok) BSN.deleteEvent(e.id).then(pageEvents).then(function () { toast('Termin gelöscht.'); }).catch(function (x) { toast(x.message, true); });
          });
        });
      });
    }).catch(function (x) { view.innerHTML = '<h1>Das hat nicht geklappt</h1><p>' + esc(x.message) + '</p>'; });
  }
  function pageEvent(id) {
    (id === 'neu' ? Promise.resolve({ title: '', starts_on: '', starts_at: '', location: '', description: '', link: '' }) : BSN.getEvent(id)).then(function (e) {
      if (!e) { view.innerHTML = '<h1>Termin nicht gefunden</h1><p><a href="#termine">Zurück zur Liste</a></p>'; return; }
      dirty = false;
      view.innerHTML = '<h1>' + (id === 'neu' ? 'Neuer Termin' : 'Termin bearbeiten') + '</h1><form class="panel" id="evForm" style="max-width:640px" novalidate>' +
        '<label class="field" style="margin-top:0"><span>Name der Veranstaltung</span><input id="eTitle" required value="' + esc(e.title) + '"></label>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px"><label class="field"><span>Datum</span><input type="date" id="eDate" required value="' + esc(e.starts_on) + '"></label>' +
        '<label class="field"><span>Uhrzeit (kann leer bleiben)</span><input type="time" id="eTime" value="' + esc(e.starts_at) + '"></label></div>' +
        '<label class="field"><span>Ort</span><input id="eLoc" value="' + esc(e.location) + '"></label>' +
        '<label class="field"><span>Beschreibung (kurz)</span><textarea id="eDesc" maxlength="500">' + esc(e.description) + '</textarea></label>' +
        '<label class="field"><span>Link für mehr Infos (kann leer bleiben)</span><input type="url" id="eLink" placeholder="https://" value="' + esc(e.link) + '"></label>' +
        '<div class="form-error" id="eErr" role="alert" hidden></div>' +
        '<div class="side-row" style="margin-top:22px"><button class="btn btn-primary" type="submit">Termin speichern</button><a class="btn btn-secondary" href="#termine">Abbrechen</a></div></form>';
      var f = document.getElementById('evForm'); f.oninput = function () { dirty = true; };
      f.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var rec = { id: e.id, title: document.getElementById('eTitle').value.trim(), starts_on: document.getElementById('eDate').value, starts_at: document.getElementById('eTime').value,
          location: document.getElementById('eLoc').value.trim(), description: document.getElementById('eDesc').value.trim(), link: document.getElementById('eLink').value.trim() };
        var err = document.getElementById('eErr'), m = [];
        if (!rec.title) m.push('einen Namen'); if (!rec.starts_on) m.push('ein Datum');
        if (rec.link && !/^https?:\/\//i.test(rec.link)) { err.textContent = 'Der Link muss mit https:// beginnen.'; err.hidden = false; return; }
        if (m.length) { err.textContent = 'Es fehlt noch ' + m.join(' und ') + '.'; err.hidden = false; return; }
        BSN.saveEvent(rec).then(function () { dirty = false; toast('Termin gespeichert.'); location.hash = '#termine'; }).catch(function (x) { err.textContent = x.message; err.hidden = false; });
      });
    });
  }

  /* ---------- Weiche ---------- */
  function route() {
    var h = location.hash.replace('#', '') || 'uebersicht', p = h.split('/');
    document.querySelectorAll('[data-tab]').forEach(function (a) {
      if (a.dataset.tab === (p[0] === 'termin' ? 'termine' : p[0] === 'editor' ? 'beitraege' : p[0])) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
    if (p[0] === 'editor') return pageEditor(p[1] || 'neu');
    if (p[0] === 'termine') return pageEvents();
    if (p[0] === 'termin') return pageEvent(p[1] || 'neu');
    if (p[0] === 'generator') return window.BSNGenerator.zeigen(view, p[1], toast);
    load().then(function () { p[0] === 'beitraege' ? pageList() : pageOverview(); })
      .catch(function (x) { view.innerHTML = '<h1>Das hat nicht geklappt</h1><p>' + esc(x.message) + '</p>'; });
  }
  var prev = location.hash;
  window.addEventListener('hashchange', function () {
    if (dirty && !window.confirm('Du hast ungespeicherte Änderungen. Wirklich verlassen?')) { history.replaceState(null, '', prev); return; }
    dirty = false; prev = location.hash; route();
  });
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  document.getElementById('logout').addEventListener('click', function () { BSN.signOut().then(function () { location.href = 'login.html'; }); });

  /* Zutritt nur mit Anmeldung */
  BSN.getUser().then(function (u) {
    if (!u) { location.replace('login.html'); return; }
    document.body.hidden = false; R.demoBadge(); route();
    // Absender-Schlüssel für Mitteilungen einmalig anlegen lassen (falls der Versand eingerichtet ist).
    if (BSN.live) BSN.pushPublicKey().then(function (k) { if (!k) return BSN.pushInit(); }).catch(function () {});
  }).catch(function () { location.replace('login.html'); });
})();

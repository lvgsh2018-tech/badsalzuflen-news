/* Datenschicht: Demo-Modus (Browser-Speicher) oder Supabase (echt).
   Alle Seiten sprechen nur mit window.BSN — nie direkt mit dem Dienst. */
(function () {
  var cfg = window.BSN_CONFIG || {};
  var live = !!(cfg.SUPABASE_URL && cfg.SUPABASE_KEY);
  var BSN = { live: live, demo: !live, categories: cfg.CATEGORIES || [] };

  /* ---------- Hilfen ---------- */
  function rid(n) { return Math.random().toString(36).slice(2, 2 + n); }
  function slugify(t) {
    return String(t || 'beitrag').toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'beitrag';
  }
  BSN.slugify = slugify;

  /* Bild vor dem Hochladen verkleinern (spart Platz und Ladezeit). */
  BSN.prepareImage = function (file) {
    return new Promise(function (resolve, reject) {
      if (!/^image\//.test(file.type)) return reject(new Error('Das ist keine Bilddatei.'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1600, s = Math.min(1, max / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve(b) : reject(new Error('Bild konnte nicht verkleinert werden.')); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht gelesen werden.')); };
      img.src = url;
    });
  };

  /* ================= DEMO-MODUS ================= */
  if (!live) {
    var KA = 'bsn_demo_articles', KV = 'bsn_demo_views', KS = 'bsn_demo_auth';
    var read = function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
    var write = function (k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); }
      catch (e) { throw new Error('Der Browser-Speicher ist voll. Lösche Demo-Beiträge oder nimm kleinere Bilder.'); }
    };
    var daysAgo = function (n) { return new Date(Date.now() - n * 864e5).toISOString(); };

    function seed() {
      if (read(KA, null)) return;
      var lorem = '<p>Das ist ein Beispieltext, damit du siehst, wie ein Beitrag auf der Seite aussieht. Er ist frei erfunden und nicht Teil der echten Berichterstattung.</p><h2>Zwischenüberschrift</h2><p>Hier steht ein zweiter Absatz. Im Editor kannst du Text <strong>fett</strong> oder <em>kursiv</em> setzen, Listen anlegen und Links einfügen.</p><ul><li>Erster Punkt</li><li>Zweiter Punkt</li></ul>';
      var items = [
        ['Beispiel: Neuer Wochenmarkt startet in der Innenstadt', 'Bad Salzuflen', true, 0],
        ['Beispiel: Radweg in Schötmar wird ausgebaut', 'Schötmar', false, 1],
        ['Beispiel: Dorffest in Wüsten lockt viele Besucher an', 'Wüsten', false, 2],
        ['Beispiel: Diese Termine erwarten dich am Wochenende', 'Termine', false, 3],
        ['Beispiel: Café eröffnet am Kurpark', 'Wirtschaft', false, 4],
        ['Beispiel: Ein Verein feiert sein 50-jähriges Bestehen', 'Vereine', false, 6],
        ['Beispiel: Kreis Lippe plant neue Busverbindung', 'Kreis Lippe', false, 8],
        ['Beispiel: Ein Porträt über eine engagierte Ehrenamtliche', 'Menschen', false, 9]
      ];
      var list = items.map(function (it, i) {
        return {
          id: 'demo-' + i, slug: slugify(it[0]) + '-' + i, title: it[0],
          teaser: 'Kurze Beispiel-Zusammenfassung, die unter der Überschrift und auf den Kacheln erscheint.',
          body: lorem, category: it[1], image_url: '', image_credit: '', status: 'published',
          featured: it[2], published_at: daysAgo(it[3]), created_at: daysAgo(it[3]), updated_at: daysAgo(it[3])
        };
      });
      list.push({
        id: 'demo-draft', slug: 'beispiel-entwurf', title: 'Beispiel: Ein Entwurf, den noch niemand sieht',
        teaser: 'Entwürfe bleiben unsichtbar, bis du sie veröffentlichst.', body: lorem, category: 'Bad Salzuflen',
        image_url: '', image_credit: '', status: 'draft', featured: false, published_at: null,
        created_at: daysAgo(0), updated_at: daysAgo(0)
      });
      write(KA, list);
      var views = [];
      list.forEach(function (a, i) {
        if (a.status !== 'published') return;
        for (var k = 0; k < 4 + ((i * 7) % 9); k++) views.push({ article_id: a.id, created_at: daysAgo((k * 2 + i) % 14) });
      });
      write(KV, views);
    }
    seed();

    var byDate = function (a, b) { return String(b.published_at || b.created_at).localeCompare(String(a.published_at || a.created_at)); };

    BSN.listPublished = function () { return Promise.resolve(read(KA, []).filter(function (a) { return a.status === 'published'; }).sort(byDate)); };
    BSN.listAll = function () { return Promise.resolve(read(KA, []).sort(byDate)); };
    BSN.getArticle = function (slug, opts) {
      var a = read(KA, []).filter(function (x) { return x.slug === slug; })[0] || null;
      if (a && a.status !== 'published' && !(opts && opts.preview && sessionStorage.getItem(KS))) a = null;
      return Promise.resolve(a);
    };
    BSN.getById = function (id) { return Promise.resolve(read(KA, []).filter(function (x) { return x.id === id; })[0] || null); };
    BSN.saveArticle = function (a) {
      var list = read(KA, []), now = new Date().toISOString(), i;
      if (!a.id) {
        a.id = 'demo-' + rid(8); a.slug = slugify(a.title) + '-' + rid(4); a.created_at = now; list.push(a);
      } else {
        i = list.findIndex(function (x) { return x.id === a.id; });
        if (i < 0) list.push(a); else { a.slug = list[i].slug; a.created_at = list[i].created_at; list[i] = a; }
      }
      a.updated_at = now;
      if (a.status === 'published' && !a.published_at) a.published_at = now;
      if (a.status !== 'published') a.published_at = null;
      write(KA, list);
      return Promise.resolve(a);
    };
    BSN.deleteArticle = function (id) {
      write(KA, read(KA, []).filter(function (x) { return x.id !== id; }));
      write(KV, read(KV, []).filter(function (v) { return v.article_id !== id; }));
      return Promise.resolve();
    };
    BSN.uploadImage = function (file) {
      return BSN.prepareImage(file).then(function (blob) {
        return new Promise(function (res, rej) {
          var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(new Error('Bild konnte nicht gelesen werden.')); };
          r.readAsDataURL(blob);
        });
      });
    };
    BSN.addView = function (id) { var v = read(KV, []); v.push({ article_id: id, created_at: new Date().toISOString() }); try { write(KV, v); } catch (e) {} return Promise.resolve(); };
    BSN.getViews = function () { return Promise.resolve(read(KV, [])); };


    /* Termine (Demo) */
    var KE = 'bsn_demo_events';
    function iso(n) { var d = new Date(Date.now() + n * 864e5); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    if (!read(KE, null)) write(KE, [
      { id: 'ev-1', title: 'Beispiel: Wochenmarkt am Kurpark', starts_on: iso(2), starts_at: '08:00', location: 'Kurpark', description: 'Frisches von Händlern aus der Region.', link: '' },
      { id: 'ev-2', title: 'Beispiel: Konzert im Kurgastzentrum', starts_on: iso(5), starts_at: '19:30', location: 'Kurgastzentrum', description: 'Ein Beispieltermin, damit du die Darstellung siehst.', link: '' },
      { id: 'ev-3', title: 'Beispiel: Vereinsfest', starts_on: iso(20), starts_at: '', location: 'Schötmar', description: '', link: '' }
    ]);
    var byEv = function (a, b) { return (a.starts_on + (a.starts_at || '')).localeCompare(b.starts_on + (b.starts_at || '')); };
    BSN.listEvents = function () { return Promise.resolve(read(KE, []).sort(byEv)); };
    BSN.getEvent = function (id) { return Promise.resolve(read(KE, []).filter(function (x) { return x.id === id; })[0] || null); };
    BSN.saveEvent = function (e) {
      var list = read(KE, []);
      if (!e.id) { e.id = 'ev-' + rid(8); list.push(e); }
      else { var i = list.findIndex(function (x) { return x.id === e.id; }); if (i < 0) list.push(e); else list[i] = e; }
      write(KE, list); return Promise.resolve(e);
    };
    BSN.deleteEvent = function (id) { write(KE, read(KE, []).filter(function (x) { return x.id !== id; })); return Promise.resolve(); };

    /* Blaulicht (Demo) */
    var KB = 'bsn_demo_blaulicht';
    if (!read(KB, null)) write(KB, [
      { id: 'bl-1', source_id: '1', source_url: 'https://www.presseportal.de/blaulicht/nr/12727', source_name: 'Polizei Lippe', title: 'Beispiel: Einbruch in Wohnung', place: 'Schötmar', teaser: 'Das ist eine Beispielmeldung, damit du siehst, wie Blaulicht-Meldungen aussehen.', body: '<p>Das ist eine Beispielmeldung, damit du siehst, wie Blaulicht-Meldungen aussehen.</p><p>Hinweise nimmt die Polizei unter (05231) 6090 entgegen.</p>', published_at: daysAgo(0), hidden: false },
      { id: 'bl-2', source_id: '2', source_url: 'https://www.presseportal.de/blaulicht/nr/12727', source_name: 'Polizei Lippe', title: 'Beispiel: Radfahrer bei Unfall leicht verletzt', place: 'Bad Salzuflen', teaser: 'Noch eine Beispielmeldung.', body: '<p>Noch eine Beispielmeldung.</p>', published_at: daysAgo(2), hidden: false }
    ]);
    BSN.listBlaulicht = function (all) { return Promise.resolve(read(KB, []).filter(function (m) { return all || !m.hidden; }).sort(function (a, b) { return String(b.published_at).localeCompare(String(a.published_at)); })); };
    BSN.getBlaulicht = function (sid) { return Promise.resolve(read(KB, []).filter(function (m) { return m.source_id === sid && !m.hidden; })[0] || null); };
    BSN.setBlaulichtHidden = function (id, hidden) {
      var list = read(KB, []); list.forEach(function (m) { if (m.id === id) m.hidden = !!hidden; }); write(KB, list); return Promise.resolve();
    };

    /* Contentplanung (Demo) — Kanäle und geplante Beiträge, nur für die Redaktion */
    var KK = 'bsn_demo_kanaele', KP = 'bsn_demo_planung';
    if (!read(KK, null)) write(KK, [
      { id: 1, name: 'Bad Salzuflen Bilder', plattform: 'instagram', farbe: 'limette', notiz: '', aktiv: true, reihung: 1 },
      { id: 2, name: 'Bad Salzuflen News', plattform: 'instagram', farbe: 'lila', notiz: '', aktiv: true, reihung: 2 }
    ]);
    if (!read(KP, null)) write(KP, [
      { id: 1, kanal_id: 2, titel: 'Beispiel: Wochenmarkt', datum: iso(1), uhrzeit: '18:00', format: 'post', status: 'fertig', text: '', notiz: '' },
      { id: 2, kanal_id: 1, titel: 'Beispiel: Kurpark im Herbst', datum: iso(3), uhrzeit: '', format: 'post', status: 'geplant', text: '', notiz: '' },
      { id: 3, kanal_id: 2, titel: 'Beispiel: Idee ohne Datum', datum: null, uhrzeit: '', format: 'reel', status: 'idee', text: '', notiz: '' }
    ]);
    function nextId(list) { return list.reduce(function (m, x) { return Math.max(m, +x.id || 0); }, 0) + 1; }
    /* Beim Ändern nur die mitgeschickten Felder anfassen (Verschieben schickt nur id + datum). */
    function merge(key, rec) {
      var list = read(key, []), i;
      if (!rec.id) { rec = Object.assign({}, rec, { id: nextId(list) }); list.push(rec); write(key, list); return rec; }
      i = list.findIndex(function (x) { return x.id === rec.id; });
      if (i < 0) list.push(rec); else list[i] = Object.assign({}, list[i], rec);
      write(key, list); return list[i < 0 ? list.length - 1 : i];
    }
    BSN.listKanaele = function () { return Promise.resolve(read(KK, []).sort(function (a, b) { return a.reihung - b.reihung; })); };
    BSN.saveKanal = function (k) {
      if (!k.id) k.reihung = read(KK, []).reduce(function (m, x) { return Math.max(m, x.reihung || 0); }, 0) + 1;
      return Promise.resolve(merge(KK, k));
    };
    BSN.deleteKanal = function (id) {
      write(KP, read(KP, []).map(function (p) { if (p.kanal_id === id) p.kanal_id = null; return p; }));
      write(KK, read(KK, []).filter(function (k) { return k.id !== id; }));
      return Promise.resolve();
    };
    BSN.listPlanung = function () { return Promise.resolve(read(KP, [])); };
    BSN.savePlan = function (p) { return Promise.resolve(merge(KP, p)); };
    BSN.deletePlan = function (id) { write(KP, read(KP, []).filter(function (p) { return p.id !== id; })); return Promise.resolve(); };

    BSN.signIn = function (email, pw) {
      if (!email || !pw) return Promise.reject(new Error('Bitte E-Mail und Passwort eingeben.'));
      sessionStorage.setItem(KS, email); return Promise.resolve({ email: email });
    };
    BSN.signOut = function () { sessionStorage.removeItem(KS); return Promise.resolve(); };
    BSN.getUser = function () { var e = sessionStorage.getItem(KS); return Promise.resolve(e ? { email: e } : null); };
    BSN.resetDemo = function () { localStorage.removeItem(KA); localStorage.removeItem(KV); localStorage.removeItem(KE); localStorage.removeItem(KB); localStorage.removeItem(KK); localStorage.removeItem(KP); seed(); };
    /* Mitteilungen (Demo: nichts wird gespeichert oder verschickt) */
    BSN.pushPublicKey = function () { return Promise.resolve(null); };
    BSN.pushSubscribe = function () { return Promise.resolve(); };
    BSN.pushUnsubscribe = function () { return Promise.resolve(); };
    BSN.pushCount = function () { return Promise.resolve(0); };
    BSN.pushSend = function () { return Promise.resolve({ sent: 0, gone: 0, failed: 0 }); };
    window.BSN = BSN;
    return;
  }

  /* ================= ECHT (Supabase) ================= */
  var clientP = null;
  function client() {
    if (!clientP) clientP = new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = 'assets/js/vendor/supabase.min.js';
      s.onload = function () { res(window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY)); };
      s.onerror = function () { rej(new Error('Verbindung zum Speicherdienst fehlgeschlagen. Bist du online?')); };
      document.head.appendChild(s);
    });
    return clientP;
  }
  function ok(r) { if (r.error) throw new Error(r.error.message); return r.data; }

  BSN.listPublished = function () {
    return client().then(function (c) {
      return c.from('articles').select('*').eq('status', 'published').order('published_at', { ascending: false }).limit(200);
    }).then(ok);
  };
  BSN.listAll = function () {
    return client().then(function (c) { return c.from('articles').select('*').order('created_at', { ascending: false }); }).then(ok);
  };
  BSN.getArticle = function (slug) {
    return client().then(function (c) { return c.from('articles').select('*').eq('slug', slug).maybeSingle(); }).then(ok);
  };
  BSN.getById = function (id) {
    return client().then(function (c) { return c.from('articles').select('*').eq('id', id).maybeSingle(); }).then(ok);
  };
  BSN.saveArticle = function (a) {
    var now = new Date().toISOString();
    var row = {
      title: a.title, teaser: a.teaser, body: a.body, category: a.category, image_url: a.image_url || '',
      image_credit: a.image_credit || '', status: a.status, featured: !!a.featured, updated_at: now
    };
    if (a.status === 'published') row.published_at = a.published_at || now; else row.published_at = null;
    return client().then(function (c) {
      if (a.id) return c.from('articles').update(row).eq('id', a.id).select().single();
      row.slug = slugify(a.title) + '-' + rid(4);
      return c.from('articles').insert(row).select().single();
    }).then(ok);
  };
  BSN.deleteArticle = function (id) {
    return client().then(function (c) { return c.from('articles').delete().eq('id', id); }).then(ok);
  };
  BSN.uploadImage = function (file) {
    return Promise.all([client(), BSN.prepareImage(file)]).then(function (r) {
      var path = Date.now() + '-' + rid(6) + '.jpg';
      return r[0].storage.from('bilder').upload(path, r[1], { contentType: 'image/jpeg' }).then(function (up) {
        if (up.error) throw new Error(up.error.message);
        return r[0].storage.from('bilder').getPublicUrl(path).data.publicUrl;
      });
    });
  };
  BSN.addView = function (id) {
    return client().then(function (c) { return c.from('views').insert({ article_id: id }); }).catch(function () {});
  };
  BSN.getViews = function () {
    return client().then(function (c) { return c.from('views').select('article_id,created_at').order('created_at', { ascending: false }).limit(20000); }).then(ok);
  };

  BSN.listEvents = function () {
    return client().then(function (c) { return c.from('events').select('*').order('starts_on').order('starts_at'); }).then(ok);
  };
  BSN.getEvent = function (id) { return client().then(function (c) { return c.from('events').select('*').eq('id', id).maybeSingle(); }).then(ok); };
  BSN.saveEvent = function (e) {
    var row = { title: e.title, starts_on: e.starts_on, starts_at: e.starts_at || '', location: e.location || '', description: e.description || '', link: e.link || '' };
    return client().then(function (c) {
      return e.id ? c.from('events').update(row).eq('id', e.id).select().single() : c.from('events').insert(row).select().single();
    }).then(ok);
  };
  BSN.deleteEvent = function (id) { return client().then(function (c) { return c.from('events').delete().eq('id', id); }).then(ok); };

  /* Blaulicht: kommt automatisch von presseportal.de (Edge Function blaulicht-sync) */
  BSN.listBlaulicht = function () {
    return client().then(function (c) { return c.from('blaulicht').select('*').order('published_at', { ascending: false }).limit(200); }).then(ok);
  };
  BSN.getBlaulicht = function (sid) {
    return client().then(function (c) { return c.from('blaulicht').select('*').eq('source_id', sid).maybeSingle(); }).then(ok);
  };
  BSN.setBlaulichtHidden = function (id, hidden) {
    return client().then(function (c) { return c.from('blaulicht').update({ hidden: !!hidden }).eq('id', id); }).then(ok);
  };
  BSN.signIn = function (email, pw) {
    return client().then(function (c) { return c.auth.signInWithPassword({ email: email, password: pw }); }).then(function (r) {
      if (r.error) throw new Error('E-Mail oder Passwort stimmt nicht.');
      return r.data.user;
    });
  };
  BSN.signOut = function () { return client().then(function (c) { return c.auth.signOut(); }); };
  BSN.getUser = function () {
    return client().then(function (c) { return c.auth.getSession(); }).then(function (r) {
      return r.data && r.data.session ? r.data.session.user : null;
    });
  };
  /* Contentplanung — nur für die Redaktion lesbar (siehe supabase/content.sql).
     Beim Ändern nur die mitgeschickten Felder schreiben: Verschieben schickt nur id + datum. */
  function pick(o, keys) { var r = {}; keys.forEach(function (k) { if (k in o) r[k] = o[k]; }); return r; }
  var KANAL = ['name', 'plattform', 'farbe', 'notiz', 'aktiv', 'reihung'];
  var PLAN = ['kanal_id', 'titel', 'datum', 'uhrzeit', 'format', 'status', 'text', 'notiz'];
  function upsert(table, rec, keys) {
    var row = pick(rec, keys);
    return client().then(function (c) {
      return rec.id ? c.from(table).update(row).eq('id', rec.id).select().single() : c.from(table).insert(row).select().single();
    }).then(ok);
  }
  BSN.listKanaele = function () {
    return client().then(function (c) { return c.from('content_kanaele').select('*').order('reihung').order('name'); }).then(ok);
  };
  BSN.saveKanal = function (k) {
    if (k.id) return upsert('content_kanaele', k, KANAL);
    return BSN.listKanaele().then(function (l) {
      k.reihung = l.reduce(function (m, x) { return Math.max(m, x.reihung || 0); }, 0) + 1;
      return upsert('content_kanaele', k, KANAL);
    });
  };
  BSN.deleteKanal = function (id) { return client().then(function (c) { return c.from('content_kanaele').delete().eq('id', id); }).then(ok); };
  BSN.listPlanung = function () {
    return client().then(function (c) { return c.from('content_beitraege').select('*').order('datum').order('uhrzeit').limit(5000); }).then(ok);
  };
  BSN.savePlan = function (p) { return upsert('content_beitraege', p, PLAN); };
  BSN.deletePlan = function (id) { return client().then(function (c) { return c.from('content_beitraege').delete().eq('id', id); }).then(ok); };

  /* Mitteilungen bei neuen Beiträgen */
  BSN.pushPublicKey = function () {
    return client().then(function (c) { return c.rpc('push_public_key'); }).then(ok);
  };
  BSN.pushSubscribe = function (sub) {
    var j = sub.toJSON();
    return client().then(function (c) { return c.rpc('push_anmelden', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth }); }).then(ok);
  };
  BSN.pushUnsubscribe = function (endpoint) {
    return client().then(function (c) { return c.rpc('push_abmelden', { p_endpoint: endpoint }); }).then(ok);
  };
  BSN.pushCount = function () {
    return client().then(function (c) { return c.from('push_subscriptions').select('endpoint', { count: 'exact', head: true }); })
      .then(function (r) { if (r.error) throw new Error(r.error.message); return r.count || 0; });
  };
  function pushCall(body) {
    return client().then(function (c) { return c.functions.invoke('push', { body: body }); }).then(function (r) {
      if (r.error) {
        var ctx = r.error.context;
        if (ctx && ctx.json) return ctx.json().then(function (j) { throw Object.assign(new Error(j.error || 'Versand fehlgeschlagen.'), j); });
        throw new Error('Versand fehlgeschlagen.');
      }
      return r.data;
    });
  }
  BSN.pushInit = function () { return pushCall({ action: 'init' }); };
  BSN.pushSend = function (id, again) { return pushCall({ action: 'send', article_id: id, again: !!again }); };
  window.BSN = BSN;
})();

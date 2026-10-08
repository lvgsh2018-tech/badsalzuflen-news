/* Gemeinsame Bausteine: Text absichern, Datum, Kacheln, Karten. */
(function () {
  var R = {};
  R.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* Nur harmlose Formatierung durchlassen. */
  var ALLOWED = { P: 1, H2: 1, H3: 1, STRONG: 1, EM: 1, UL: 1, OL: 1, LI: 1, BLOCKQUOTE: 1, A: 1, BR: 1, FIGURE: 1, FIGCAPTION: 1, IMG: 1 };
  var RENAME = { B: 'STRONG', I: 'EM', H1: 'H2', H4: 'H3', H5: 'H3', H6: 'H3', DIV: 'P' };
  /* Bilder im Text: nur aus dem eigenen Bilderspeicher (bzw. im Demo-Modus direkt eingebettet) */
  function ownImage(src) {
    var base = ((window.BSN_CONFIG || {}).SUPABASE_URL || '').replace(/\/$/, '');
    if (!src) return false;
    if (base && src.indexOf(base + '/storage/v1/object/public/bilder/') === 0) return true;
    return /^data:image\/(jpeg|png|webp);base64,/i.test(src);
  }
  R.sanitize = function (html) {
    var doc = new DOMParser().parseFromString('<body>' + (html || '') + '</body>', 'text/html');
    function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 3) return;
        if (ch.nodeType !== 1) { ch.remove(); return; }
        if (/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED)$/.test(ch.tagName)) { ch.remove(); return; }
        walk(ch);
        var tag = RENAME[ch.tagName] || ch.tagName;
        if (!ALLOWED[tag]) { while (ch.firstChild) node.insertBefore(ch.firstChild, ch); ch.remove(); return; }
        var el = ch, src = ch.getAttribute('src'), h = ch.getAttribute('href');
        if (tag !== ch.tagName) { el = doc.createElement(tag); while (ch.firstChild) el.appendChild(ch.firstChild); node.replaceChild(el, ch); }
        Array.prototype.slice.call(el.attributes).forEach(function (a) { el.removeAttribute(a.name); });
        if (tag === 'IMG') {
          if (!ownImage(src)) { el.remove(); return; }
          el.setAttribute('src', src); el.setAttribute('alt', ''); el.setAttribute('loading', 'lazy'); el.setAttribute('decoding', 'async');
        }
        if (tag === 'FIGCAPTION' && !el.textContent.trim()) { el.remove(); return; }
        if (tag === 'FIGURE' && !el.querySelector('img')) { el.remove(); return; }
        if (tag === 'A') {
          if (h && /^(https?:|mailto:)/i.test(h)) { el.setAttribute('href', h); el.setAttribute('rel', 'noopener noreferrer'); el.setAttribute('target', '_blank'); }
        }
      });
    }
    walk(doc.body);
    return doc.body.innerHTML;
  };

  R.date = function (iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  R.readMinutes = function (html) {
    var words = (html || '').replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  };
  R.url = function (a) { return a.href || 'artikel.html?s=' + encodeURIComponent(a.slug); };

  /* Ohne Foto: ruhiger Farbverlauf aus den Markenfarben, je Kategorie anders. */
  var PH = [
    ['#1E3A66', '#4A66B0'], ['#3A3F86', '#8A78C8'], ['#1E5A78', '#5FA3B8'],
    ['#5A3F86', '#B48AC8'], ['#2C4A7A', '#D9A441'], ['#284B63', '#7BA3A8']
  ];
  R.placeholder = function (cat) {
    var h = 0, s = String(cat || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    var p = PH[h % PH.length];
    return 'background:linear-gradient(140deg,' + p[0] + ',' + p[1] + ')';
  };
  /* Bildausschnitt: der wichtigste Punkt steckt als „#fp=x,y“ (Prozent) hinten an der Bildadresse. */
  R.focus = function (url) {
    var m = /#fp=(\d{1,3}(?:\.\d+)?),(\d{1,3}(?:\.\d+)?)$/.exec(url || '');
    return m ? { x: Math.min(100, +m[1]), y: Math.min(100, +m[2]) } : { x: 50, y: 50 };
  };
  R.withFocus = function (url, f) {
    url = String(url || '').replace(/#fp=[^#]*$/, '');
    if (!url || !f || (Math.round(f.x) === 50 && Math.round(f.y) === 50)) return url;
    return url + '#fp=' + Math.round(f.x) + ',' + Math.round(f.y);
  };
  R.focusStyle = function (url) {
    var f = R.focus(url);
    return 'object-position:' + f.x + '% ' + f.y + '%;transform-origin:' + f.x + '% ' + f.y + '%';
  };
  function media(a) {
    return a.image_url
      ? '<img src="' + R.esc(a.image_url) + '" alt="" loading="lazy" decoding="async" style="' + R.focusStyle(a.image_url) + '">'
      : '<div class="ph" style="' + R.placeholder(a.category) + '" aria-hidden="true"></div>';
  }
  R.tile = function (a, cls) {
    return '<a class="tile ' + cls + '" href="' + R.url(a) + '">' + media(a) +
      '<div class="tile-body"><span class="tag">' + R.esc(a.category) + '</span>' +
      '<h3>' + R.esc(a.title) + '</h3></div></a>';
  };
  R.card = function (a) {
    return '<a class="post-card" href="' + R.url(a) + '"><div class="post-media">' + media(a) + '</div>' +
      '<div class="post-text"><span class="tag tag-dark">' + R.esc(a.category) + '</span>' +
      '<h3>' + R.esc(a.title) + '</h3><p>' + R.esc(a.teaser) + '</p>' +
      '<time datetime="' + R.esc(a.published_at) + '">' + R.date(a.published_at) + '</time></div></a>';
  };

  /* Hinweis, solange die Seite noch nicht mit dem echten Speicher verbunden ist. */
  R.demoBadge = function () {
    if (!window.BSN || !BSN.demo) return;
    var d = document.createElement('div');
    d.className = 'demo-badge'; d.setAttribute('role', 'status');
    d.textContent = 'Demo-Modus · Beispielinhalte, nur in deinem Browser';
    document.body.appendChild(d);
  };
  window.BSNR = R;
})();

/* Termine */
(function () {
  var R = window.BSNR;
  R.day = function (iso) { var p = String(iso).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  R.dayLong = function (iso) { return R.day(iso).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); };
  R.todayIso = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  R.eventHTML = function (e) {
    var d = R.day(e.starts_on), when = [];
    if (e.starts_at) when.push(e.starts_at + ' Uhr'); if (e.location) when.push(e.location);
    var safe = e.link && /^https?:\/\//i.test(e.link);
    return '<article class="event' + (e.starts_on === R.todayIso() ? ' today' : '') + '"><div class="event-date" aria-hidden="true"><strong>' + d.getDate() + '</strong><span>' +
      d.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '') + '</span></div><div><h3>' + R.esc(e.title) + '</h3>' +
      '<p class="event-meta"><span class="sr-only">' + R.dayLong(e.starts_on) + '. </span>' + R.esc(when.join(' · ')) + '</p>' +
      (e.description ? '<p>' + R.esc(e.description) + '</p>' : '') +
      (safe ? '<a class="more" href="' + R.esc(e.link) + '" target="_blank" rel="noopener noreferrer">Mehr Infos ↗</a>' : '') + '</div></article>';
  };
})();
/* Teilen-Leiste unter Beiträgen: Handy-Teilen-Menü (falls vorhanden), WhatsApp, Facebook, E-Mail, Link kopieren.
   Nur einfache Links, keine fremden Skripte — es wird nichts an andere Dienste geladen, bevor jemand tippt. */
(function () {
  var R = window.BSNR;
  function ico(d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; }
  var I = {
    share: ico('<path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'),
    wa: ico('<path d="M3 21l1.65-4.95A8.5 8.5 0 1 1 8 19.4z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1a3.5 3.5 0 0 1-2-2l1-1-1-2z"/>'),
    fb: ico('<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>'),
    mail: ico('<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>'),
    link: ico('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
    ok: ico('<path d="M20 6 9 17l-5-5"/>')
  };
  R.shareHTML = function (a) {
    var url = location.origin + location.pathname + '?s=' + encodeURIComponent(a.slug);
    var u = encodeURIComponent(url), t = encodeURIComponent(a.title);
    var btn = function (cls, href, icon, label) {
      return '<a class="share-btn ' + cls + '" href="' + href + '" target="_blank" rel="noopener noreferrer">' + icon + '<span>' + label + '</span></a>';
    };
    return '<section class="share" aria-label="Beitrag teilen" data-url="' + R.esc(url) + '" data-title="' + R.esc(a.title) + '">' +
      '<h2 class="share-title">Beitrag teilen</h2><div class="share-row">' +
      (navigator.share ? '<button type="button" class="share-btn share-native" data-share="native">' + I.share + '<span>Teilen</span></button>' : '') +
      btn('share-wa', 'https://wa.me/?text=' + t + '%20' + u, I.wa, 'WhatsApp') +
      btn('share-fb', 'https://www.facebook.com/sharer/sharer.php?u=' + u, I.fb, 'Facebook') +
      '<a class="share-btn share-mail" href="mailto:?subject=' + t + '&amp;body=' + t + '%0A%0A' + u + '">' + I.mail + '<span>E-Mail</span></a>' +
      '<button type="button" class="share-btn share-copy" data-share="copy">' + I.link + '<span>Link kopieren</span></button>' +
      '</div><p class="sr-only" role="status" aria-live="polite"></p></section>';
  };
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(function () { return copyOld(text); });
    return copyOld(text);
  }
  function copyOld(text) {
    return new Promise(function (ok, fail) {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? ok() : fail(); } catch (e) { fail(e); } finally { ta.remove(); }
    });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.share [data-share]'); if (!b) return;
    var box = b.closest('.share'), url = box.dataset.url, title = box.dataset.title, live = box.querySelector('[role=status]');
    if (b.dataset.share === 'native') { navigator.share({ title: title, url: url }).catch(function () {}); return; }
    var label = b.querySelector('span'), old = b.innerHTML;
    copy(url).then(function () {
      b.innerHTML = I.ok + '<span>Link kopiert</span>'; b.classList.add('is-done'); live.textContent = 'Link kopiert';
    }, function () { label.textContent = 'Kopieren ging nicht'; }).then(function () {
      clearTimeout(b._t); b._t = setTimeout(function () { b.innerHTML = old; b.classList.remove('is-done'); live.textContent = ''; }, 2200);
    });
  });
})();

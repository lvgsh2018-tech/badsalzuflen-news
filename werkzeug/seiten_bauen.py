#!/usr/bin/env python3
"""Baut die fertige Webseite nach _site/.

Kopiert die Seite und legt zusätzlich an, was Suchmaschinen und Link-Vorschauen brauchen:
  beitrag/<slug>.html  eine feste Seite pro veröffentlichtem Beitrag (Vorlage: artikel.html)
  blaulicht/<nr>.html  eine feste Seite pro Blaulicht-Meldung (Vorlage: blaulicht.html)
  beitrag/liste.js     welche Beiträge und Meldungen eine feste Seite haben
  sitemap.xml          Inhaltsverzeichnis für Suchmaschinen
  stand.txt            Prüfsumme; daran erkennt der Zeitplan, ob neu veröffentlicht werden muss

Aufruf:  python3 werkzeug/seiten_bauen.py
Braucht nur Python, keine Zusatzpakete. Läuft automatisch über .github/workflows/seite.yml.
"""
import hashlib
import html
import json
import re
import shutil
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / '_site'
SITE = 'https://badsalzuflennews.de/'
NAME = 'Bad Salzuflen News'
BERLIN = ZoneInfo('Europe/Berlin')
MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August',
          'September', 'Oktober', 'November', 'Dezember']
# Gehört nicht auf die veröffentlichte Seite
SKIP = shutil.ignore_patterns('.git', '.github', '.claude', '.DS_Store', '.gitignore', '_site', '__pycache__',
                              'werkzeug', 'supabase', 'design-system', 'README.md')
# Feste Unterseiten fürs Inhaltsverzeichnis (Impressum, Datenschutz, Redaktion bleiben draußen)
PAGES = ['', 'blaulicht.html', 'termine.html', 'angebot.html', 'werbung.html', 'team.html', 'kontakt.html']


def esc(s):
    return html.escape(str(s or ''), quote=True)


def config():
    src = (ROOT / 'assets/js/config.js').read_text(encoding='utf-8')
    url = re.search(r'SUPABASE_URL:\s*"([^"]+)"', src)
    key = re.search(r'SUPABASE_KEY:\s*"([^"]+)"', src)
    if not url or not key:
        sys.exit('assets/js/config.js enthält keine Verbindung zum Speicher.')
    return url.group(1).rstrip('/'), key.group(1)


def fetch(base, key, query):
    req = urllib.request.Request(base + '/rest/v1/' + query, headers={'apikey': key})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def articles(base, key):
    return fetch(base, key, 'articles?select=*&status=eq.published&order=published_at.desc&limit=1000')


# Suchmeldungen nach Personen werden von der Polizei wieder zurückgezogen — die bekommen keine feste Seite
# und landen damit nicht bei Suchmaschinen (auf der Blaulicht-Seite selbst stehen sie wie bisher).
KEINE_SEITE = re.compile(r'vermiss|fahndung|wer kennt|identit', re.I)


def blaulicht(base, key):
    rows = fetch(base, key, 'blaulicht?select=*&hidden=eq.false&order=published_at.desc&limit=1000')
    return [m for m in rows if re.fullmatch(r'[A-Za-z0-9_-]+', m.get('source_id') or '')
            and not KEINE_SEITE.search(m.get('title') or '')]


def when(iso):
    """Zeitstempel aus dem Speicher (beliebig viele Nachkommastellen) lesen."""
    s = re.sub(r'\.\d+', '', str(iso)).replace('Z', '+00:00')
    return datetime.fromisoformat(s)


def date_de(iso):
    d = when(iso).astimezone(BERLIN)
    return '%d. %s %d' % (d.day, MONATE[d.month - 1], d.year)


# ---------- Beitragstext absichern: gleiche Regeln wie R.sanitize in assets/js/render.js ----------
ALLOWED = {'p', 'h2', 'h3', 'strong', 'em', 'ul', 'ol', 'li', 'blockquote', 'a', 'br', 'figure', 'figcaption', 'img'}
RENAME = {'b': 'strong', 'i': 'em', 'h1': 'h2', 'h4': 'h3', 'h5': 'h3', 'h6': 'h3', 'div': 'p'}
DROP = {'script', 'style', 'iframe', 'object', 'embed'}
VOID = {'br', 'img', 'hr', 'input', 'meta', 'link', 'source', 'wbr', 'area', 'base', 'col', 'embed', 'track'}


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = ('', {}, [])
        self.stack = [self.root]

    def handle_starttag(self, tag, attrs):
        node = (tag, dict(attrs), [])
        self.stack[-1][2].append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        self.stack[-1][2].append(data)


def sanitize(body, base):
    own = base + '/storage/v1/object/public/bilder/'

    def text(node):
        return node if isinstance(node, str) else ''.join(text(c) for c in node[2])

    def out(node):
        if isinstance(node, str):
            return html.escape(node, quote=False)
        tag, attrs, kids = node
        if tag in DROP:
            return ''
        inner = ''.join(out(k) for k in kids)
        tag = RENAME.get(tag, tag)
        if tag not in ALLOWED:
            return inner
        if tag == 'br':
            return '<br>'
        if tag == 'img':
            src = attrs.get('src') or ''
            return '<img src="%s" alt="" loading="lazy" decoding="async">' % esc(src) if src.startswith(own) else ''
        if tag == 'figcaption' and not text(node).strip():
            return ''
        if tag == 'figure' and '<img' not in inner:
            return ''
        if tag == 'a':
            href = attrs.get('href') or ''
            if re.match(r'(https?:|mailto:)', href, re.I):
                return '<a href="%s" rel="noopener noreferrer" target="_blank">%s</a>' % (esc(href), inner)
        return '<%s>%s</%s>' % (tag, inner, tag)

    t = Tree()
    t.feed(body or '')
    t.close()
    return ''.join(out(k) for k in t.root[2])


def plain(body):
    return ' '.join(html.unescape(re.sub(r'<[^>]+>', ' ', body or '')).split())


def read_minutes(body):
    return max(1, round(len(re.sub(r'<[^>]+>', ' ', body or '').split()) / 200))


def description(a):
    """Kurzfassung für Suchergebnis und Link-Vorschau; kurze Kurzfassungen mit dem Textanfang auffüllen."""
    t = ' '.join((a.get('teaser') or '').split())
    if len(t) < 110:
        rest = plain(a.get('body'))
        t = (t + ('' if not t else ' ' if t[-1] in '.!?…' else ' – ') + rest).strip()
    if len(t) > 160:
        t = t[:158].rsplit(' ', 1)[0].rstrip(' ,;:–-') + ' …'
    return t


def swap(page, old, new):
    if old not in page:
        sys.exit('Vorlage artikel.html passt nicht mehr zum Bauwerkzeug, gesucht: ' + old[:70])
    return page.replace(old, new, 1)


def article_page(tpl, a, base):
    url = SITE + 'beitrag/' + a['slug'] + '.html'
    title, desc = a['title'], description(a)
    image = re.sub(r'#.*$', '', a.get('image_url') or '') or SITE + 'assets/img/og-bild.png'
    ld = {
        '@context': 'https://schema.org', '@type': 'NewsArticle', 'headline': title[:110], 'description': desc,
        'image': [image], 'datePublished': when(a['published_at']).isoformat(),
        'dateModified': when(a.get('updated_at') or a['published_at']).isoformat(),
        'articleSection': a.get('category') or '', 'inLanguage': 'de', 'mainEntityOfPage': url,
        'author': {'@type': 'Organization', 'name': NAME, 'url': SITE},
        'publisher': {'@type': 'Organization', 'name': NAME, 'url': SITE,
                      'logo': {'@type': 'ImageObject', 'url': SITE + 'assets/img/icon-512.png'}},
    }
    head = '\n'.join([
        '<title>%s — %s</title>' % (esc(title), NAME),
        '<meta name="description" content="%s">' % esc(desc),
        '<link rel="canonical" href="%s">' % url,
        '<meta property="og:type" content="article">',
        '<meta property="og:url" content="%s">' % url,
        '<meta property="og:title" content="%s">' % esc(title),
        '<meta property="og:description" content="%s">' % esc(desc),
        '<meta property="og:locale" content="de_DE">',
        '<meta property="article:published_time" content="%s">' % when(a['published_at']).isoformat(),
        '<script type="application/ld+json">%s</script>' % json.dumps(ld, ensure_ascii=False).replace('</', '<\\/'),
    ])
    body = (
        ('<p class="ad-kennung"><span class="ad-label">Anzeige</span> Dieser Beitrag ist eine bezahlte Anzeige.</p>'
         if a.get('anzeige') else '') +
        '<span class="tag tag-dark">%s</span><h1>%s</h1>' % (esc(a.get('category')), esc(title)) +
        '<p class="article-meta">%s · %d Min. Lesezeit</p>' % (date_de(a['published_at']), read_minutes(a.get('body'))) +
        ('<figure><img src="%s" alt="">%s</figure>' % (
            esc(a['image_url']),
            '<figcaption>%s</figcaption>' % esc(a['image_credit']) if a.get('image_credit') else '')
         if a.get('image_url') else '') +
        ('<p class="article-lede">%s</p>' % esc(a['teaser']) if a.get('teaser') else '') +
        '<div class="article-body">%s</div>' % sanitize(a.get('body'), base)
    )
    page = swap(tpl, '<meta charset="UTF-8">', '<meta charset="UTF-8">\n<base href="/">')
    page = swap(page, '<title>Beitrag — Bad Salzuflen News</title>', head)
    page = swap(page, '<meta property="og:image" content="https://badsalzuflennews.de/assets/img/og-bild.png">',
                '<meta property="og:image" content="%s">' % esc(image))
    page = swap(page, '<article class="article" id="article" aria-live="polite"><p>Beitrag wird geladen …</p></article>',
                '<article class="article" id="article" aria-live="polite" data-slug="%s" data-stand="%s">%s</article>'
                % (esc(a['slug']), esc(a.get('updated_at')), body))
    return page


def swap_bl(page, old, new):
    if old not in page:
        sys.exit('Vorlage blaulicht.html passt nicht mehr zum Bauwerkzeug, gesucht: ' + old[:70])
    return page.replace(old, new, 1)


def bl_quelle(m):
    """Link zur Original-Meldung und die Seite, von der sie stammt (Polizei: presseportal.de, Feuerwehr: ihre eigene Seite)."""
    src = m.get('source_url') or ''
    if (m.get('source_id') or '').startswith('fw-'):
        ok = re.match(r'https://www\.feuerwehrbadsalzuflen\.de/', src, re.I)
        return (src if ok else 'https://www.feuerwehrbadsalzuflen.de/einsatzberichte/'), 'feuerwehrbadsalzuflen.de'
    ok = re.match(r'https://(www\.)?presseportal\.de/', src, re.I)
    return (src if ok else 'https://www.presseportal.de/blaulicht/nr/12727'), 'presseportal.de'


def blaulicht_page(tpl, m, base):
    url = SITE + 'blaulicht/' + m['source_id'] + '.html'
    title, place, src_name = m['title'], m.get('place') or 'Bad Salzuflen', m.get('source_name') or 'Polizei Lippe'
    src, src_site = bl_quelle(m)
    bild = SITE + 'assets/img/' + ('feuerwehr.jpg' if m['source_id'].startswith('fw-') else 'blaulicht.jpg')
    desc = plain(m.get('body')) or ' '.join((m.get('teaser') or '').split())
    if len(desc) > 160:
        desc = desc[:158].rsplit(' ', 1)[0].rstrip(' ,;:–-') + ' …'
    d = when(m['published_at']).astimezone(BERLIN)
    stamp = '%d. %s %d, %02d:%02d Uhr' % (d.day, MONATE[d.month - 1], d.year, d.hour, d.minute)
    full = '%s: %s' % (place, title) if place.lower() not in title.lower() else title
    ld = {
        '@context': 'https://schema.org', '@type': 'NewsArticle', 'headline': full[:110], 'description': desc,
        'image': [bild], 'datePublished': when(m['published_at']).isoformat(),
        'inLanguage': 'de', 'mainEntityOfPage': url, 'isBasedOn': src,
        'author': {'@type': 'Organization', 'name': src_name},
        'publisher': {'@type': 'Organization', 'name': NAME, 'url': SITE,
                      'logo': {'@type': 'ImageObject', 'url': SITE + 'assets/img/icon-512.png'}},
    }
    body = (
        '<span class="tag tag-dark">%s</span><h1>%s</h1>' % (esc(place), esc(title)) +
        '<p class="article-meta">%s · <time datetime="%s">%s</time></p>' % (esc(src_name), esc(m['published_at']), stamp) +
        '<div class="article-body">%s</div>' % sanitize(m.get('body'), base) +
        '<p class="bl-source"><strong>Quelle:</strong> %s, %s — '
        '<a href="%s" target="_blank" rel="noopener noreferrer">%s</a></p>' % (esc(src_name), src_site, esc(src), esc(src))
    )
    page = swap_bl(tpl, '<meta charset="UTF-8">', '<meta charset="UTF-8">\n<base href="/">')
    page = swap_bl(page, '<title>Blaulicht — Bad Salzuflen News</title>',
                   '<title>%s — Blaulicht — %s</title>' % (esc(full), NAME))
    page = swap_bl(page, '<meta name="description" content="Meldungen der Polizei und Einsätze der Feuerwehr in Bad Salzuflen und den Ortsteilen.">',
                   '<meta name="description" content="%s">' % esc(desc))
    page = swap_bl(page, '<meta property="og:title" content="Blaulicht — Bad Salzuflen News">',
                   '<meta property="og:title" content="%s">' % esc(full))
    page = swap_bl(page, '<meta property="og:description" content="Meldungen der Polizei und Einsätze der Feuerwehr in Bad Salzuflen und den Ortsteilen.">',
                   '<meta property="og:description" content="%s">' % esc(desc))
    page = swap_bl(page, '<meta property="og:image" content="https://badsalzuflennews.de/assets/img/og-bild.png">\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">',
                   '<meta property="og:image" content="%s">' % bild)
    page = swap_bl(page, '<meta property="og:type" content="website">\n<link rel="canonical" href="https://badsalzuflennews.de/blaulicht.html">',
                   '<meta property="og:type" content="article">\n<meta property="og:url" content="%s">\n<link rel="canonical" href="%s">\n'
                   '<script type="application/ld+json">%s</script>'
                   % (url, url, json.dumps(ld, ensure_ascii=False).replace('</', '<\\/')))
    page = swap_bl(page, '<section class="section" id="liste">', '<section class="section" id="liste" hidden>')
    page = swap_bl(page, '<div class="article-wrap" id="einzeln" hidden>', '<div class="article-wrap" id="einzeln">')
    page = swap_bl(page, '<article class="article" id="bl-article" aria-live="polite"><p>Meldung wird geladen …</p></article>',
                   '<article class="article" id="bl-article" aria-live="polite" data-id="%s">%s</article>'
                   % (esc(m['source_id']), body))
    return page


def sitemap(arts, bls):
    fresh = datetime.now(timezone.utc) - timedelta(days=2)
    rows = ['  <url><loc>%s%s</loc></url>' % (SITE, p) for p in PAGES]
    for a in arts:
        pub = when(a['published_at'])
        news = ''
        if pub > fresh:  # Google News liest nur Beiträge der letzten zwei Tage
            news = ('<news:news><news:publication><news:name>%s</news:name><news:language>de</news:language>'
                    '</news:publication><news:publication_date>%s</news:publication_date>'
                    '<news:title>%s</news:title></news:news>' % (NAME, pub.isoformat(), esc(a['title'])))
        rows.append('  <url><loc>%sbeitrag/%s.html</loc><lastmod>%s</lastmod>%s</url>' % (
            SITE, a['slug'], when(a.get('updated_at') or a['published_at']).isoformat(), news))
    for m in bls:
        rows.append('  <url><loc>%sblaulicht/%s.html</loc><lastmod>%s</lastmod></url>' % (
            SITE, m['source_id'], when(m['published_at']).isoformat()))
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
            'xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n' + '\n'.join(rows) + '\n</urlset>\n')


def main():
    base, key = config()
    arts = [a for a in articles(base, key)
            if a.get('published_at') and re.fullmatch(r'[a-z0-9-]+', a.get('slug') or '')]
    if not arts:
        # Lieber gar nicht veröffentlichen als alle Beitragsseiten löschen
        sys.exit('Keine veröffentlichten Beiträge erhalten — Abbruch, die Seite bleibt wie sie ist.')

    try:
        bls = blaulicht(base, key)
    except Exception as e:  # Blaulicht darf den Bau der Beiträge nicht aufhalten
        print('Blaulicht-Meldungen nicht erreichbar, es werden keine Seiten dafür gebaut:', e)
        bls = []

    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(ROOT, OUT, ignore=SKIP)

    tpl = (ROOT / 'artikel.html').read_text(encoding='utf-8')
    (OUT / 'beitrag').mkdir(exist_ok=True)
    for a in arts:
        (OUT / 'beitrag' / (a['slug'] + '.html')).write_text(article_page(tpl, a, base), encoding='utf-8')
    tpl_bl = (ROOT / 'blaulicht.html').read_text(encoding='utf-8')
    (OUT / 'blaulicht').mkdir(exist_ok=True)
    for m in bls:
        (OUT / 'blaulicht' / (m['source_id'] + '.html')).write_text(blaulicht_page(tpl_bl, m, base), encoding='utf-8')
    (OUT / 'beitrag/liste.js').write_text(
        '/* Automatisch erzeugt: Beiträge und Blaulicht-Meldungen mit fester Seite. */\n'
        'window.BSN_SEITEN = %s;\nwindow.BSN_BLAULICHT = %s;\n' % (
            json.dumps({a['slug']: 1 for a in arts}, separators=(',', ':')),
            json.dumps({m['source_id']: 1 for m in bls}, separators=(',', ':'))), encoding='utf-8')
    (OUT / 'sitemap.xml').write_text(sitemap(arts, bls), encoding='utf-8')

    h = hashlib.sha256()
    for f in sorted(p for p in OUT.rglob('*') if p.is_file()):
        h.update(str(f.relative_to(OUT)).encode())
        h.update(f.read_bytes())
    (OUT / 'stand.txt').write_text(h.hexdigest() + '\n', encoding='utf-8')
    print('%d Beitragsseiten und %d Blaulicht-Seiten gebaut, Stand %s' % (len(arts), len(bls), h.hexdigest()[:12]))


if __name__ == '__main__':
    main()

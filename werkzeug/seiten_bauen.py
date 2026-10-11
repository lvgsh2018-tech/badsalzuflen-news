#!/usr/bin/env python3
"""Baut die fertige Webseite nach _site/.

Kopiert die Seite und legt zusätzlich an, was Suchmaschinen und Link-Vorschauen brauchen:
  beitrag/<slug>.html  eine feste Seite pro veröffentlichtem Beitrag (Vorlage: artikel.html)
  beitrag/liste.js     welche Beiträge eine feste Seite haben
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
PAGES = ['', 'blaulicht.html', 'termine.html', 'angebot.html', 'team.html', 'kontakt.html']


def esc(s):
    return html.escape(str(s or ''), quote=True)


def config():
    src = (ROOT / 'assets/js/config.js').read_text(encoding='utf-8')
    url = re.search(r'SUPABASE_URL:\s*"([^"]+)"', src)
    key = re.search(r'SUPABASE_KEY:\s*"([^"]+)"', src)
    if not url or not key:
        sys.exit('assets/js/config.js enthält keine Verbindung zum Speicher.')
    return url.group(1).rstrip('/'), key.group(1)


def articles(base, key):
    req = urllib.request.Request(
        base + '/rest/v1/articles?select=*&status=eq.published&order=published_at.desc&limit=1000',
        headers={'apikey': key})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


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


def sitemap(arts):
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

    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(ROOT, OUT, ignore=SKIP)

    tpl = (ROOT / 'artikel.html').read_text(encoding='utf-8')
    (OUT / 'beitrag').mkdir(exist_ok=True)
    for a in arts:
        (OUT / 'beitrag' / (a['slug'] + '.html')).write_text(article_page(tpl, a, base), encoding='utf-8')
    (OUT / 'beitrag/liste.js').write_text(
        '/* Automatisch erzeugt: Beiträge mit fester Seite. */\nwindow.BSN_SEITEN = %s;\n'
        % json.dumps({a['slug']: 1 for a in arts}, separators=(',', ':')), encoding='utf-8')
    (OUT / 'sitemap.xml').write_text(sitemap(arts), encoding='utf-8')

    h = hashlib.sha256()
    for f in sorted(p for p in OUT.rglob('*') if p.is_file()):
        h.update(str(f.relative_to(OUT)).encode())
        h.update(f.read_bytes())
    (OUT / 'stand.txt').write_text(h.hexdigest() + '\n', encoding='utf-8')
    print('%d Beitragsseiten gebaut, Stand %s' % (len(arts), h.hexdigest()[:12]))


if __name__ == '__main__':
    main()

# Bad Salzuflen News — Webseite

Nachrichtenseite zu Bad Salzuflen News: Kachel-Startseite mit Beiträgen,
Artikelseiten, Anmeldung und Redaktionsbereich (Übersicht, Editor), dazu
Angebot, Team, Kontakt.

## Aufbau

- `index.html` — die Startseite (alles auf einer Seite: Hero, Was wir machen,
  Impressionen, Team, Kontakt)
- `impressum.html` — Impressum und rechtliche Hinweise
- `assets/css/style.css` — das komplette Design (Farben, Schrift, Abstände
  ganz oben in der Datei unter `:root` — dort lässt sich z. B. die Farbe
  ändern, ohne den Rest anzufassen)
- `assets/img/` — Logo und Bilder
- `assets/img/impressionen/` — hier kommen die echten Fotos rein

## Eigene Fotos einsetzen

In `index.html` gibt es acht Platzhalter-Kacheln ("Foto 1" bis "Foto 8") im
Abschnitt „Impressionen". Ein Platzhalter sieht so aus:

```html
<div class="gallery-item placeholder">Foto 1</div>
```

Foto reinlegen: Bild in `assets/img/impressionen/` speichern (z. B.
`markt.jpg`), dann die Zeile ersetzen durch:

```html
<div class="gallery-item"><img src="assets/img/impressionen/markt.jpg" alt="Kurze Beschreibung des Bildes"></div>
```

Das bei `alt="..."` ist eine kurze Bildbeschreibung — wichtig für
Suchmaschinen und für Menschen, die die Seite mit einem Screenreader nutzen.

## Team-Foto statt Kürzel

Im Abschnitt „Team" steht aktuell ein Kürzel („LS") statt Foto. Um ein echtes
Foto einzusetzen: Bild nach `assets/img/team-lennart.jpg` legen, dann in
`index.html` die Zeile

```html
<div class="team-photo" aria-hidden="true">LS</div>
```

ersetzen durch:

```html
<div class="team-photo"><img src="assets/img/team-lennart.jpg" alt="Lennart Schleef"></div>
```

## Lokal ansehen, bevor etwas online geht

Im Ordner `Second Brain` liegt eine `.claude/launch.json`, mit der Claude Code
die Seite lokal auf `http://localhost:4321` zeigen kann. Einfach sagen
„zeig mir die Webseite" — dafür ist keine Internetverbindung oder ein Konto
nötig.

## Veröffentlichen

Diese Seite ist eine reine HTML/CSS-Seite ohne Build-Schritt — sie kann direkt
so hochgeladen werden, wie sie ist. Der nächste Schritt (GitHub Pages +
eigene Domain) steht im Chat mit Claude Code.

## Nachrichten und Redaktion (seit 2026-09-24)

- `index.html` — Startseite mit Kachel-Tafel und Beitragsliste
- `artikel.html?s=...` — ein einzelner Beitrag
- `login.html` → `admin.html` — Anmeldung und Redaktionsbereich (Übersicht mit
  Aufrufen, Beitragsliste, Editor)
- `assets/js/config.js` — Verbindung zum Speicher; leer = Demo-Modus
- `supabase/` — Einrichtung des echten Speichers (`ANLEITUNG.md`, `setup.sql`);
  liegt nur lokal und wird nicht veröffentlicht

## Generator im Redaktionsbereich (seit 2026-09-24)

`admin.html#generator` — der Bad Salzuflen News Update-Generator vom Mac, hier
als Reiter „Generator“ mit drei Vorlagen: Montagsupdate, Story, Beitrag. Läuft
komplett im Browser: Termine reinkopieren → erkennen → Bilder herunterladen.
Nichts wird hochgeladen; Einstellungen und die letzte Terminliste merkt sich
der Browser.

- `assets/js/generator/termine.js` — Termine aus Rohtext lesen (wie `termine.py`)
- `assets/js/generator/zeichnen.js` — Bilder zeichnen (wie `bildbearbeitung.py` und `story.py`)
- `assets/js/generator/generator.js` — die Bedienung
- `assets/generator/` — Canva-Vorlage, Logo, Montserrat und Playfair Display

Neue Canva-Vorlage: als `assets/generator/montagsupdate-vorlage.png`
(1080 × 1920) ersetzen und in `admin.html` die Zahl hinter `?v=` erhöhen.

## Mitteilungen bei neuen Beiträgen (seit 2026-09-24; Supabase eingerichtet, Seite noch nicht online)

- `assets/js/push.js` — Karte „Keinen Beitrag verpassen“ auf Startseite und Artikelseite
- `sw.js`, `manifest.webmanifest` — Hintergrund-Helfer und App-Angaben (nötig fürs iPhone)
- `supabase/push.sql`, `supabase/functions/push/index.ts` — Speicher und Versand
- Redaktionsbereich: beim ersten Veröffentlichen Rückfrage „Leser benachrichtigen?“,
  Übersicht zeigt, wie viele Leser Mitteilungen eingeschaltet haben.

## Blaulicht (seit 2026-09-25 online)

`blaulicht.html` — Polizeimeldungen der Polizei Lippe, nur Bad Salzuflen, automatisch
von presseportal.de/blaulicht/nr/12727. Einzelne Meldung: `blaulicht.html?m=<Nummer>`,
darunter immer der Link zur Meldung bei presseportal.de als Quelle.

- `assets/js/blaulicht.js` — Liste und Einzelansicht
- `supabase/functions/blaulicht-sync/index.ts`, `supabase/blaulicht.sql` — Abruf alle 30 Minuten

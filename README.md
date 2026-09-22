# Bad Salzuflen News — Webseite

Reine Info-Seite zu Bad Salzuflen News: was wir machen, Impressionen, Team,
Kontakt. Kein Nachrichten-Upload — das bleibt bei Instagram.

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

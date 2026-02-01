# Bäckerei Heusser — Brand- und Website-Guide

**Version:** 2.0
**Letzte Aktualisierung:** Januar 2025
**Zweck:** Umfassende Marken-Dokumentation für AI-Agents, Entwickler und Teammitglieder

---

## 1. Kurzbeschreibung

Bäckerei Heusser ist eine kleine, lokale Handwerksbäckerei mit warmem, freundlichem Auftreten. Die Marke verbindet Tradition (handwerkliche Backkunst) mit einem modernen, wohnlichen Look — einladend, ehrlich und etwas verspielt.

**Gründung:** 1933 durch Heinrich Heusser
**Standort:** Eckstraße 3, 66424 Homburg, Saarland
**Leitspruch:** „Handwerkliche Backkunst seit über 90 Jahren"
**Tagline:** „Tradition trifft Leidenschaft — täglich frisch für Sie gebacken"

### Zielgruppen

- **Primär**: Lokale Familien und Gemeindemitglieder (25–65 Jahre)
- **Sekundär**: Junge Berufstätige, die Qualität und Bequemlichkeit suchen (25–40 Jahre)
- **Tertiär**: Backwarenliebhaber und Touristen, die authentisches deutsches Backhandwerk schätzen

### Alleinstellungsmerkmal

„Wo traditionelle deutsche Backkunst auf modernen Komfort trifft — authentische, frische Backwaren mit der Einfachheit der Online-Vorbestellung für den aktiven Alltag."

---

## 2. Kernwerte & Markenpersönlichkeit

### Kernwerte

- **Warm**: Einladend wie frisch gebackenes Brot.
- **Ehrlich & Handwerklich**: Authentizität und Qualität stehen im Vordergrund.
- **Lokaler Stolz**: Verbunden mit der Nachbarschaft.
- **Großzügig & Sorgfältig**: Liebe zum Detail in Produkt und Service.

### Markenpersönlichkeit

- **Authentisch**: Echte deutsche Backtradition, keine künstlichen Abkürzungen
- **Zuverlässig**: Gleichbleibende Qualität, verlässlicher Service
- **Fachkundig**: Meisterliches Handwerk, professionelle Expertise
- **Gemeinschaftsorientiert**: Lokaler Fokus, persönliche Beziehungen
- **Progressiv-traditionell**: Das Bewährte ehren und hilfreiche Innovation begrüßen

### Ton der Texte

Freundlich, persönlich, leicht beschwingt. Du-Ansprache möglich — lokal eher „Du".

### Kommunikationsstil

- **Freundlich, aber professionell**: Nahbar und dennoch kompetent
- **Warm und einladend**: Wie ein Gespräch mit einem kenntnisreichen Nachbarn
- **Selbstbewusst ohne Arroganz**: Stolz auf Qualität, ohne zu prahlen
- **Geduldig und hilfsbereit**: Kundenbedürfnisse verstehen
- **Regional verwurzelt**: Deutsches Kulturbewusstsein und Sprache

### Sprachrichtlinien

- Du-Ansprache für lokale Stammkunden, Sie-Ansprache für neue/formale Kontexte
- Regionale Ausdrücke natürlich einstreuen
- Frische und tägliche Produktion betonen
- Traditionelle Methoden erwähnen, wo relevant
- Hilfreiche Produktinformationen immer anbieten
- Konkrete Angaben zu Zeiten und Verfügbarkeit

### Sprache

- **Primär**: Deutsch (regionaler saarländischer Dialekt akzeptabel)
- **Ton**: Warm, professionell, informativ
- **Vermeiden**: Konzern-Jargon, künstlichen Enthusiasmus, hastige Sprache
- **Bevorzugen**: Traditionelle Backbegriffe, saisonale Bezüge, gemeinschaftliche Sprache

---

## 3. Farbpalette

Primär- und unterstützende Farben auf Grundlage der Vorgaben (Highlight `#d038ba` und „Macchiato" `#928168`) — mit warmen Tönen für ein wohnliches Gesamtbild.

### Hauptfarben

| Variable                 | Hex       | Verwendung                                                            |
| ------------------------ | --------- | --------------------------------------------------------------------- |
| `--brand-highlight`      | `#d038ba` | Bäckerei-Highlight — Akzente, Calls-to-Action, Buttons, Links, Badges |
| `--brand-base-macchiato` | `#928168` | Macchiato — warmes Grau-Braun für Flächen, Hintergründe, Footer       |

### Sekundärfarben / Neutrale

| Variable       | Hex       | Verwendung                                                |
| -------------- | --------- | --------------------------------------------------------- |
| `--cream`      | `#FFF3E6` | Sahnige Crème — helle Flächen, Kartenhintergründe         |
| `--beige`      | `#E6D8C3` | Weicher Beige-Ton — Sektionen, Karten                     |
| `--dark-brown` | `#5A2E2A` | Kräftiges Braun — Überschriften, Icons                    |
| `--text`       | `#3B2B28` | Haupttextfarbe — gute Lesbarkeit auf hellen Hintergründen |
| `--white`      | `#FFFFFF` | Reines Weiß                                               |

### Frische-Nuance (saisonale Akzente)

| Variable       | Hex       | Verwendung                                                 |
| -------------- | --------- | ---------------------------------------------------------- |
| `--leaf-green` | `#7A9B6B` | Sanftes Grün für saisonale Aktionen: Ostern, Frühlingsbrot |

### CSS-Variablen

```css
:root {
  --brand-highlight: #d038ba;
  --brand-base-macchiato: #928168;
  --cream: #fff3e6;
  --beige: #e6d8c3;
  --dark-brown: #5a2e2a;
  --text: #3b2b28;
  --white: #ffffff;
  --leaf-green: #7a9b6b;
}
```

### Hinweise zur Verwendung

- **`--brand-base-macchiato`** großflächig als ruhige, wohnliche Hintergrundfarbe verwenden (z.B. Sektionen, Footer, große Flächen).
- **`--brand-highlight`** (`#d038ba`) sparsam einsetzen als Hervorhebung: Buttons, Links, Rabatt-Badges, Social-Icons, Promo-Banner.
- **Crème- und Beige-Töne** für Karten, Produkt-Hintergründe und Subsektionen — geben Wärme und Lesekomfort.
- **Dunkelbraun / Textfarbe** für Texte und Überschriften statt reinem Schwarz — wirkt weicher und wohnlicher.
- **Highlight-Varianten** (für erweiterte Farbskala):
  - Dunkler: `#A02E94` (erhöhter Kontrast)
  - Heller: `#E666D3` (Hintergründe, dezente Akzente)

---

## 4. Typografie

**Ziel:** Handwerkliche Werte + Lesbarkeit für Web.

### Schriftempfehlungen (Google Fonts)

| Einsatz             | Schrift                                       | Charakter                                                         |
| ------------------- | --------------------------------------------- | ----------------------------------------------------------------- |
| **Überschriften**   | Cinzel                                        | Serifisch, traditionelle Anmutung, elegante Headlines             |
| **Fließtext**       | Merriweather (primär) oder Inter (alternativ) | Gute Lesbarkeit, warm wirkend in Kombination mit Serif-Headlines  |
| **Signatur / Logo** | Pacifico oder Pinyon Script                   | Handgeschrieben, persönlich — für Labels, Etiketten, Social-Posts |

### Größenskala

```
H1:    40–48px  (Desktop)
H2:    28–34px
H3:    22–26px
H4:    18–22px
Body:  16px
Small: 12–14px  (Hilfetexte, Captions)
```

### Typografische Regeln

- Großzügige Zeilenhöhe (`line-height: 1.5`) für Wohlfühl-Lesbarkeit
- Überschriften dürfen mehr Weißraum bekommen, um die warme, ruhige Marke zu unterstützen
- Fließtext-Zeilenhöhe: 1.5–1.7 für optimale Lesbarkeit
- Letter-Spacing für Buttons: `0.5px`

### Font-Loading

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Merriweather:wght@400;500;700&family=Pacifico&display=swap"
  rel="stylesheet"
/>
```

Strategie: `font-display: swap` — Text sofort mit Systemschrift rendern, bei Laden der Custom Font tauschen.

---

## 5. Logo & Markenzeichen

### Logo-Varianten

1. **Primär-Logo (horizontal):** Wortmarke „Bäckerei Heusser" in Serif + kleines Icon links (Weizenähre / Laib Brot / Schneebesen).
2. **Kompakt (Badge):** Kreis-Version mit Icon in der Mitte und „Heusser" halbkreisförmig — ideal für Social Icons, Stempel, Sticker.
3. **Signatur:** Handschriftliche Variante (nur für Labels, Produktetiketten oder Social-Posts).

### SVG-Komponenten im Code

| Komponente           | Datei           | Beschreibung                                                    |
| -------------------- | --------------- | --------------------------------------------------------------- |
| „Bäckerei" Wortmarke | `Baeckerei.tsx` | Dekorative Serif-Schrift, Mindestbreite 300px                   |
| „Heusser" Schriftzug | `Heusser.tsx`   | Familienname in elegantem Script, Standardfarbe: `#7B341E`      |
| „H" Monogramm        | `H.tsx`         | Stilisiertes „H" für kompakte Einsätze (Favicons, Kleinformate) |
| Wappen (Crest)       | `Wappen.tsx`    | Traditionelles heraldisches Element, für formelle Anwendungen   |
| Dekorativer Teiler   | `Divider.tsx`   | Ornamentale Linie für Abschnittstrennungen                      |

Alle Komponenten liegen unter `src/components/icons/brand/`.

### Logo-Nutzungsregeln

- Genug Sicherheitsraum geben (min. 1× Höhe des Logos rundherum)
- Nicht auf zu kontrastreichen Hintergründen platzieren — helle Crème- oder dunkle Braunflächen nutzen
- **Invers:** Weißes Logo auf dunklem Braun oder Macchiato möglich
- **Primärkombination**: „Bäckerei" + „Heusser" für Hauptidentifikation
- **Kompakte Einsätze**: Nur „H"-Monogramm
- **Traditionelle Kontexte**: Wappen-Crest einbinden
- **Digitale Interfaces**: Vereinfachte Versionen ohne feine Details
- **Mindestgrößen**: Sicherstellen, dass Text lesbar bleibt
- **Farbvariationen**: An Hintergrund anpassen unter Beibehaltung des Kontrasts

---

## 6. Bildsprache & Iconographie

### Fotostil

- Warme, natürliche Lichtstimmung (goldene Morgenstunden)
- Nahaufnahmen von Krusten, Krümeln, Laiben, Hände beim Formen
- Authentische Bilder: Mitarbeiter:innen, Backstube, Regionalität zeigen
- Hintergrund-Unschärfe (Bokeh) für Produktfokus
- Hochwertige Produktfotografie, die Textur und Handwerkskunst zeigt

### Icons & Grafiken

- Line-Icons mit leicht abgerundeten Ecken oder einfache Piktogramme (Mehl, Weizen, Ofen)
- Farbfüllung bevorzugt in `--dark-brown` oder `--brand-base-macchiato`
- Konsistenter Illustrationsstil, einfach und wiedererkennbar

### Produkt-Icon-Komponenten

Die folgenden Produkt-Icons liegen unter `src/components/icons/products/`:

| Icon     | Datei          | Kategorie  |
| -------- | -------------- | ---------- |
| Brot     | `Brot.tsx`     | Brote      |
| Brötchen | `Brötchen.tsx` | Brötchen   |
| Kuchen   | `Kuchen.tsx`   | Kuchen     |
| Teilchen | `Teilchen.tsx` | Feingebäck |
| Torten   | `Torten.tsx`   | Torten     |
| Getränke | `Getränke.tsx` | Getränke   |

Zusätzlich verfügbare Produkt-SVGs unter `public/assets/images/products/`:
Baguette, Brezel, Brot Rund, Croissant, Doppelweck, Hefezopf, Kastenbrot, Kornbrot, Kranzkuchen, Kuchenstück, Mischbrot, Rolle, Schnecke, Schokobrötchen, Tasche, Vollkorn Kastenbrot.

### Social-Media-Icons

- Instagram, Facebook, WhatsApp
- Gestaltet im Marken-Stil
- Farbe: `--brand-highlight` auf dunklen Hintergründen

---

## 7. UI-Komponenten (Website)

### Header

- Transparenter Header über Hero-Bereich
- Bei Scroll: Wechsel zu cremefarbigem Hintergrund mit leichter Schattenkante
- Logo links, Navigation rechts (Produkte, Über uns, Filialen, Kontakt, Online-Bestellung)

### Hero

- Großes Bild (Nahaufnahme eines Brotes) + kurzer Claim
- Claim-Beispiel: „Herzlich. Handwerklich. Heusser."
- CTA-Button (Primär): Hintergrund `--brand-highlight`, Text `--white`
- Sekundär-CTA: `--dark-brown` auf `--cream`

### Buttons

```css
.btn-primary {
  background: var(--brand-highlight);
  color: var(--white);
  border-radius: 12px;
  padding: 12px 20px;
  font-weight: 700;
}

.btn-secondary {
  background: var(--cream);
  color: var(--dark-brown);
  border: 2px solid var(--beige);
  border-radius: 10px;
  padding: 12px 20px;
}
```

### Cards / Produkte

- Karte mit leichtem Schatten, abgerundeten Ecken
- Bild oben, Produktname, kurze Beschreibung, Preis, Button
- Hintergrund: `--white` oder `--cream`
- Texte in `--text`

### Footer

- Hintergrund: `--brand-base-macchiato`
- Texte: weiß oder cremefarben
- Social-Icons: `--brand-highlight`
- Newsletter-Anmeldung: Input auf `--cream`, Button `--brand-highlight`

### Theme-System

- **Kundenbereiche**: Immer heller Modus (warm, einladend)
- **Admin-Bereiche**: Hell/Dunkel-Umschaltung nach Mitarbeiterpräferenz
- **Konsistente Elemente**: Typografie, Farben, Abstände über alle Themes beibehalten

---

## 8. Accessibility & Kontrast

- **WCAG AA** einhalten: Mindestkontrast 4,5:1 für normalen Text
- Dunkle Textfarbe (`--text`) auf `--cream`/`--white` erfüllt die Anforderungen
- Text auf `--brand-highlight` sollte weiß sein (kontrollierter Kontrast)
- Wichtigen Text **nicht** direkt auf Bilder ohne halbtransparente Overlay platzieren
- Keyboard-Navigation unterstützen
- Mehrere Gerätegrößen berücksichtigen (Mobile-first)
- Hohe Kontrastoptionen für Admin-Bereich

---

## 9. Content & Microcopy

### Hero-Claims

- „Frisch. Handgemacht. Für die Nachbarschaft."
- „Herzlich. Handwerklich. Heusser."
- „Täglich frisch gebacken für unsere Gemeinschaft."

### CTA-Beispiele

- „Jetzt vorbestellen"
- „Unser Sortiment"
- „Entdecken Sie unsere Backwaren"

### Über-uns-Kurztext

„Seit 1933 backt die Familie Heusser mit Herz und Hand — täglich frisch aus der Backstube."

### Ton

Freundlich, ehrlich, mit leichtem regionalem Bezug. Kurze Sätze. Emojis sparsam (nur Social Media).

### Willkommen

```
„Willkommen bei Bäckerei Heusser! Täglich frisch gebacken für Sie."

„Entdecken Sie unsere handwerklichen Backwaren — von traditionellen Broten
bis hin zu köstlichen Torten."
```

### Produktbeschreibungen

```
„Unser traditionelles Sauerteigbrot wird täglich frisch nach alter
Familienrezeptur gebacken."

„Knusprige Brötchen, warm aus dem Ofen — perfekt für Ihr Frühstück."
```

### Bestellbestätigung

```
„Vielen Dank für Ihre Bestellung! Ihre frischen Backwaren sind am [Datum]
um [Zeit] zur Abholung bereit."
```

### Saisonale Nachrichten

```
„Probieren Sie unsere saisonalen Stollen — nach traditioneller Rezeptur
mit besten Zutaten."
```

### Marketing-Ton

```
Qualität:
„Handwerkliche Qualität seit Generationen — schmecken Sie den Unterschied
echter Bäckertradition."

Gemeinschaft:
„Teil unserer Gemeinschaft — Ihre Nachbarschaftsbäckerei für alle Lebensmomente."

Innovation:
„Tradition trifft Komfort — bestellen Sie online und holen Sie sich Ihre
Lieblings-Backwaren garantiert frisch ab."
```

### Fehlermeldungen & Support

```
„Entschuldigung, dieses Produkt ist heute ausverkauft.
Möchten Sie es für morgen vorbestellen?"

„Haben Sie Fragen? Rufen Sie uns an oder schreiben Sie uns —
wir helfen gerne weiter!"
```

---

## 10. Seitenvorlagen (Page Templates)

### Startseite

1. **Hero** — Großes Foto + Claim + CTA
2. **Kategorien** — Brote, Gebäck, Kuchen, Snacks
3. **Wochenangebot / Aktuelle Aktion** — Badge in `--brand-highlight`
4. **Über Uns** — Foto Backstube + Kurztext
5. **Filialfinder + Öffnungszeiten**
6. **Footer** mit Newsletter-Anmeldung

### Produktseite

- Galerie (Carousel)
- Beschreibung
- Zutaten
- Nährwerte
- CTA: „Vorbestellen" oder „Zum Warenkorb"

---

## 11. Geschäftsbetrieb

### Öffnungszeiten

```
Montag:              Ruhetag (Geschlossen)
Dienstag – Freitag:  05:30 – 13:30 Uhr
Samstag:             05:30 – 12:30 Uhr
Sonntag & Feiertage: 08:00 – 11:00 Uhr
```

**Kultureller Kontext**: Dieser Plan entspricht dem traditionellen deutschen Bäckereibetrieb:

- Frühe Öffnung für frische Backwaren
- Montag als Ruhetag ist Standard
- Erweiterte Sonn-/Feiertagszeiten für die Gemeinschaft
- Nachmittagsschluss üblich bei Familienbetrieben

### Kontaktinformationen

- **Telefon**: +49 1234 567890
- **WhatsApp**: +49 1522 6621236
- **E-Mail**: info@baeckerei-heusser.de
- **Bestellungen**: bestellung@baeckerei-heusser.de
- **Adresse**: Eckstraße 3, 66424 Homburg, Saarland

### Digitale Präsenz

- **Website**: https://baeckerei-heusser.de
- **Instagram**: [@baeckereiheusser](https://www.instagram.com/baeckereiheusser)
- **Facebook**: [Bäckerei Heusser](https://www.facebook.com/baeckereiheusser)

### Produkte & Services

#### Kernprodukte

| Kategorie | Deutsch    | Beschreibung                                       |
| --------- | ---------- | -------------------------------------------------- |
| Brot      | Brote      | Traditionelle deutsche Brote, handwerkliche Sorten |
| Brötchen  | Brötchen   | Täglich frische Brötchen, diverse Sorten           |
| Kuchen    | Kuchen     | Saisonale Kuchen, Sonderbestellungen               |
| Teilchen  | Feingebäck | Croissants, Plunder, deutsches Feingebäck          |
| Torten    | Torten     | Festtags-Torten, individuelle Designs              |
| Getränke  | Getränke   | Kaffee, traditionelle Getränke                     |

#### Servicemodell

- **Ladenverkauf**: Traditioneller Thekenservice
- **Vorbestellung**: Online-System für garantierte Verfügbarkeit
- **Sonderbestellungen**: Festtagsartikel mit Vorlaufzeit
- **Saisonale Spezialitäten**: Feiertags- und saisonale Backwaren

### Zahlungsmethoden

- Bargeld, EC-Karte, Kreditkarte
- Währung: EUR (Euro)
- Preissegment: € (erschwinglich)

---

## 12. Technische Hinweise

### CSS-Variablen

Alle Markenwerte als CSS Custom Properties definieren (siehe Abschnitt 3). Dies ermöglicht einfache Pflege und konsistente Anwendung.

### Google Fonts

Prefetch für Performance:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```

### Bilder

- WebP-Format für Kompression
- `loading="lazy"` für große Bilder
- Open-Graph-Bilder: `/og-image.svg` (1200×630), Fallback `/og-image.jpg`

### Favicons

- 16×16: `/favicon-16x16.png`
- 32×32: `/favicon-32x32.png`
- 48×48: `/favicon.ico`
- Apple Touch: `/apple-touch-icon.png`

### Migrationsstatus

> **Hinweis:** Der Code verwendet derzeit ältere Farbwerte als die hier definierten Markenfarben. Die folgenden Dateien enthalten hardcodierte Werte, die in einem zukünftigen Update angepasst werden müssen:
>
> | Datei                                       | Aktuelle Werte                                                         | Zielwerte                                  |
> | ------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------ |
> | `src/theme/theme.ts`                        | Primär `#6B4423`, Text `#3D3027`, Background `#FFFBF5`, WarmGrey-Skala | Markenpalette (s. Abschnitt 3)             |
> | `src/app/global.css`                        | `--color-primary: #6B4423`, `--color-background: #FFFBF5` etc.         | Neue CSS-Variablen                         |
> | `src/components/home/hero/EnhancedHero.tsx` | Gradient `#4A2C17 → #6B4423 → #8B5A2B → #A67C52 → #D4C4B0`             | Neues Gradient auf Basis der Markenpalette |
> | `src/components/home/map/Marker.tsx`        | Fill `#6B4423`, Text `#3D3027`                                         | `--dark-brown` / `--text`                  |
> | `src/app/layout.tsx`                        | Lädt Playfair Display, Lora, Ubuntu                                    | Cinzel, Merriweather, Pacifico             |
>
> Diese Migration ist ein separater zukünftiger Task — dieses Dokument definiert den Zielzustand.

---

## 13. Launch-Assets Checkliste

- [ ] Logo in SVG (Primär, Invers, Badge)
- [ ] Farb- und Typografie-Guide (Kurzfassung)
- [ ] Produktfotografie (Mindestanzahl 20 Bilder)
- [ ] Social-Profile (Avatar-Variante des Badges)
- [ ] Favicon (16/32/48px)
- [ ] Open-Graph-Bilder
- [ ] Historisches Foto (1933.png vorhanden)

---

## 14. AI-Agent-Richtlinien

### Markenverständnis

Beim Erstellen von Inhalten oder Treffen von Entscheidungen als AI-Agent für Bäckerei Heusser:

1. **Heritage beachten**: Traditionelle deutsche Bäckerei mit modernem Komfort
2. **Qualität priorisieren**: Jede Entscheidung soll handwerkliche Standards widerspiegeln
3. **Gemeinschaft denken**: Lokale Kunden und Nachbarschaftsbeziehungen berücksichtigen
4. **Innovation balancieren**: Hilfreiche Technik begrüßen, ohne traditionelle Werte zu verlieren
5. **Passende Sprache**: Deutsch-zuerst, warm aber professionell
6. **Kontext beachten**: Tageszeit, Saison, lokale Events beeinflussen die Kommunikation
7. **Konsistenz wahren**: Alle Touchpoints sollen sich kohärent „Bäckerei Heusser" anfühlen

### Content-Prioritäten

1. **Produktqualität** — Handwerk und Frische betonen
2. **Kundenservice** — Hilfreiche, klare, zeitnahe Kommunikation
3. **Traditionelle Werte** — Respekt für Backhandwerk und Methoden
4. **Gemeinschaftsverbindung** — Lokaler Fokus und persönliche Beziehungen
5. **Barrierefreiheit** — Alle Kunden erreichen
6. **Saisonale Relevanz** — Verbindung zu lokalem Kalender und Traditionen

### Entscheidungsrahmen

Bei Unsicherheit zur Markenkonformität fragen:

- „Spiegelt das handwerkliche Qualität wider?"
- „Dient das unserer lokalen Gemeinschaft gut?"
- „Ist das sowohl traditionell als auch hilfreich?"
- „Wahrt das unsere warme, professionelle Stimme?"
- „Würden Kunden sich willkommen und wertgeschätzt fühlen?"

---

## 15. Markennutzungs-Richtlinien

### Do's

- Qualitätsstandards an jedem Touchpoint einhalten
- Warme, professionelle Sprache verwenden
- Frische betonen — tägliche Produktion ist ein Alleinstellungsmerkmal
- Traditionelle Elemente respektieren
- Barrierefreiheit sicherstellen
- Konkret sein: klare Zeiten, Zutaten, Zubereitungsmethoden
- Handwerkskunst hervorheben

### Don'ts

- Kunden hetzen — Zeit für informierte Entscheidungen lassen
- Konzern-Jargon verwenden — natürliche Sprache beibehalten
- Qualitätskommunikation abschwächen
- Traditionellen Kontext ignorieren
- Technik überkomplizieren — digitale Tools einfach und hilfreich halten
- Versprechen machen, die nicht gehalten werden können
- Persönliche Note verlieren trotz digitaler Effizienz

### Kontextspezifische Richtlinien

#### Social Media

- **Instagram**: Visueller Fokus, Blick hinter die Kulissen, Handwerk
- **Facebook**: Community-Engagement, Events, Kundengeschichten
- **WhatsApp**: Direkter Kundenservice, Bestellbestätigungen

#### Printmaterialien

- Vollständiges Logosystem mit angemessenem Abstand
- Typografie-Hierarchie einhalten
- Wesentliche Kontaktinformationen einbinden
- Konsistenz mit digitalem Markenauftritt

#### Verpackung

- Einfaches, sauberes Design, das Qualität widerspiegelt
- Grundlegende Markenelemente einbinden
- Fokus auf Lebensmittelsicherheit und Frische-Informationen
- Professionelles Erscheinungsbild

---

**Dokumentstatus**: Aktiv
**Nächste Überprüfung**: Vierteljährlich oder bei größeren Markenaktualisierungen
**Gepflegt von**: Markenteam und Entwicklungsleitung

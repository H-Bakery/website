---
id: TASK-047
title: Warenkorb auf der Website - Vorbestellung per WhatsApp-Nachricht
slug: warenkorb-whatsapp-vorbestellung
status: todo
priority: 2
owner: ''
projects: []
customers: []
tags:
  - landing
  - vorbestellungen
  - whatsapp
  - warenkorb
  - ux
sprint: ''
depends_on: []
due_date: ''
created: 2026-11-22
updated: 2026-11-22
---

# Warenkorb auf der Website - Vorbestellung per WhatsApp-Nachricht

Vorgesehen für den nächsten Sprint (Inhaber, 22.11.2026).

## Kontext

Kunden bestellen heute per Telefon, im Laden oder mit einer frei formulierten WhatsApp-Nachricht.
Im Laden wird daraus von Hand eine Vorbestellung (Kanal „WhatsApp“, `docs/domains/vorbestellungen.md`).
Freie Texte sind oft unvollständig: Abholtag oder Uhrzeit fehlen, Produktnamen sind ungenau, der Name
fehlt. Das führt zu Rückfragen.

Ziel ist ein **Warenkorb auf der Website ohne Server-Bestellung**. Der Kunde wählt Produkte, Abholtag,
Uhrzeit und Abholort. Die Website baut daraus eine **vollständige, einheitliche WhatsApp-Nachricht**, die
der Kunde selbst abschickt. Die Bestellung gilt erst, wenn die Bäckerei per WhatsApp bestätigt. So
gibt es keine Konten, keine Zahlung, keine Spam-Abwehr und keine personenbezogenen Daten auf einem
Server.

### Was es schon gibt (gesucht 22.11.2026)

| Wo                                                                                                                        | Was                                                                                                                                                                   | Brauchbar?                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/bakery-landing/src/components/home/QuickOrder.tsx`                                                                  | Alter „Schnellbestellung“-Block: fest eingetragene Emoji-Artikel, Mengen, `wa.me`-Link mit „Ich möchte folgendes bestellen …“, Fehlerfall per `alert()`               | **Nein.** Wird nirgends eingebunden, die Artikel stimmen nicht mit hq überein. Ersetzen und löschen.                                                     |
| `apps/bakery-landing/src/context/CartContext.tsx`, `libs/shared/contexts` (`cart.context`), `libs/shared/ui` (`lib/cart`) | Alter Warenkorb-Kontext, in `ThemeRegistry.tsx` auskommentiert („not needed for static landing page“)                                                                 | Nur als Vorlage. Aufräumen, wenn nichts anderes ihn nutzt.                                                                                               |
| `apps/bakery-landing/src/app/bestellen/page.tsx`                                                                          | Seite „Bestellen“ mit Telefon- und WhatsApp-Knopf; die Nummer steht dort ein zweites Mal fest im Code                                                                 | Wird zur Einstiegsseite des Korbs. Die Nummer nur noch aus `config/contact.ts` (`createWhatsAppLink`) nehmen.                                            |
| `libs/bakery-shop/feature-cart/src/lib/pickup.ts`, `lead-time.ts`                                                         | Reine Funktionen: Abholtage und 30-Minuten-Raster aus den Öffnungszeiten, Montag Ruhetag, 60 Min. Vorlauf am selben Tag, Vorlauf je Produkt (ganze Torten und Kuchen) | **Ja**, wiederverwenden (App → Lib ist erlaubt). Die Werte für den Vorlauf sind laut Datei ein Vorschlag und brauchen die Bestätigung der Backstube.     |
| `apps/bakery-shop` + `feature-cart`                                                                                       | Echter Shop mit Kasse gegen `POST /api/orders`                                                                                                                        | Nicht hier. Der Shop hat bewusst **keinen** WhatsApp-Weg (`docs/apps/shop.md`); WhatsApp gehört laut Doku zur Landing-Page. Der Shop bleibt, wie er ist. |
| `apps/bakery-landing/src/config/openingHours.ts`, `holidays.ts`                                                           | Öffnungszeiten (eine Quelle) und Feiertage                                                                                                                            | Ja, für die Abholtage.                                                                                                                                   |

Die Landing-Page ist ein statischer Export auf GitHub Pages. Produkte kommen beim Build aus
`hq/products` (`src/lib/products.ts`), also gibt es keine API und keinen Server. Das passt zu diesem
Ansatz.

## Ziel

1. **„In den Korb“** auf Produktkarten, in der Suche und auf der Produktseite, mit Mengenwähler. Bei
   Produkten mit `available: false` gibt es den Knopf nicht.
2. **Korb** als Bottom-Sheet am Handy und als Seitenleiste am Desktop. Darin:
   - Mengen ändern und Artikel entfernen;
   - pro Artikel eine optionale Notiz („geschnitten“, „Aufschrift: Alles Gute“);
   - eine Summe mit dem Hinweis „ca., bezahlt wird bei Abholung“.
3. **Abholung wählen:** Tag als Chips für die nächsten 14 Tage. Ruhetag, Feiertage und Betriebsferien
   sind ausgegraut und haben einen Grund im Tooltip bzw. darunter.
   - Uhrzeit als Chips im 30-Minuten-Raster innerhalb der Öffnungszeit.
   - Abholort: zuerst nur der Laden; die Sammelstelle siehe „Entscheidungen“.
   - Liegt ein Artikel mit langem Vorlauf im Korb (z. B. eine ganze Torte), ist der früheste Tag
     entsprechend später. Ein Satz erklärt, warum.
4. **Angaben:** Name (Pflicht) und optional eine Anmerkung. Die Telefonnummer ist überflüssig, denn
   die WhatsApp-Nummer des Absenders reicht.
5. **Nachricht senden:** Vorschau des genauen Textes, dann der Knopf **„Per WhatsApp senden“**. Er
   öffnet `wa.me/<nummer>?text=…`.
   - Am Desktop zusätzlich ein QR-Code, den man mit dem Handy scannt.
   - Ausweichwege: „Text kopieren“ und „Lieber anrufen“.
6. **Danach:** Eine Bestätigungsseite: „Nachricht abgeschickt? Wir bestätigen Ihre Vorbestellung per
   WhatsApp. Erst dann ist sie fest.“ Dazu die Knöpfe „Korb leeren“ und „Zurück zum Korb“. Wurde nichts
   abgeschickt, bleibt der Korb erhalten.
7. **Merken auf dem Gerät** (`localStorage`):
   - Korb und letzter Abholort immer. Ein Korb älter als 7 Tage wird verworfen.
   - Name nur mit dem Häkchen „Auf diesem Gerät merken“, das vorausgewählt ist, plus „Angaben
     vergessen“.
   - Jeder Zugriff steht in `try/catch`. Ohne Speicher (privates Fenster) funktioniert alles, nur ohne
     Merken.

### Die Nachricht (fester Aufbau, gut lesbar und später auswertbar)

```text
Hallo, ich möchte vorbestellen:

2× Beispielbrot 1 kg
3× Beispielweck
1× Beispieltorte (ganz) – Aufschrift „Alles Gute“

Abholung: Samstag, 28.11.2026, 09:30 Uhr
Abholort: Laden
Name: Erika Beispielfrau
Anmerkung: bitte geschnitten

Summe ca. 24,80 € (bezahlt wird bei Abholung)
Bestell-Nr. W-7K3F
```

- Die Produktnamen stehen genau wie in hq. Die Reihenfolge folgt den Abschnitten des Sortiments.
- Die **Bestell-Nr.** ist ein kurzer Zufallscode, unter dem man die Bestellung im Chat und später in
  der App wiederfindet. Sie ist keine Rechnungsnummer.
- Den Text baut genau eine reine Funktion (`buildOrderMessage()`), die getestet ist. Er enthält
  keine unsichtbaren Zeichen, denn WhatsApp entfernt sie. Die Länge ist begrenzt: bei sehr großen
  Bestellungen erscheint der Hinweis „Für große Bestellungen bitte anrufen“, bevor die URL zu lang
  wird. Ab etwa 2.000 Zeichen öffnen manche Clients den Link nicht.

## UX/UI - was es „cool“ macht, ohne zu überladen

- **Mobile first** (390 px). Unten steht eine feste Leiste, sobald etwas im Korb ist:
  „3 Artikel · ca. 12,40 € → Korb“. Sie verdeckt keinen Inhalt; der Fokus wird nicht verdeckt
  (`focusNotObscured` wie in der Verwaltung).
- **Hinzufügen fühlt sich direkt an:** Der Knopf wird zum Mengenwähler (− 1 +), die Zahl in der Leiste
  springt kurz, `aria-live` sagt „Beispielbrot im Korb, 2 Stück“. Es gibt keine Popups.
  Animationen sind kurz und richten sich nach `prefers-reduced-motion`.
- **Der Korb führt in drei Schritten:** „Was“, „Wann & wo“, „Senden“. Es gibt einen Fortschritt,
  aber kein starres Formular. Jeder Schritt ist auf dem Handy ohne Scrollen sichtbar, wo das möglich
  ist.
- **Nichts Unmögliches anbieten:** Geschlossene Tage und vergangene Uhrzeiten sind nicht wählbar und
  haben einen Grund dabei. Ein Tag, der wegen einer Torte zu früh ist, bekommt den Satz „Ganze Torten
  brauchen 2 Tage Vorlauf“.
- **Vorschau der Nachricht** wie eine WhatsApp-Sprechblase. Der Kunde sieht vor dem Senden genau, was
  ankommt.
- Bilder aus den vorhandenen Produktbildern (3D-Renderings bzw. Kategorie-Illustration).
- Tippflächen mindestens 44 px, Kontrast nach WCAG AA, alles per Tastatur bedienbar. Das Sheet ist
  ein echter Dialog mit Fokusfalle, Escape schließt es.
- **Texte:** kurz und freundlich, per „Sie“ wie auf der übrigen Seite.

## Umsetzung (Vorschlag)

- **Ort:** `apps/bakery-landing`. Die Korb-Logik liegt in einer neuen Lib
  `libs/bakery-landing/feature-order` (oder in `src/lib/order/`, wenn eine Lib zu viel ist):
  - `cart-store.ts`: Zustand, `localStorage`-Schlüssel `heusser-korb-v1` mit Version und Ablauf.
  - `order-message.ts`: `buildOrderMessage()`, Bestell-Nr.
  - `pickup-options.ts`: dünne Hülle um `feature-cart/pickup.ts` + `lead-time.ts` +
    `holidays.ts`.
  - UI-Komponenten: `AddToCartButton`, `CartBar`, `CartSheet`, `PickupPicker`, `MessagePreview`.
- **Katalog:** Der Korb speichert nur `id` und Menge. Name und Preis kommen immer aus dem aktuellen
  Build. Fehlt ein Artikel oder ist er nicht mehr verfügbar, zeigt der Korb „nicht mehr im Angebot“
  und lässt ihn nicht senden.
- **Öffnungszeiten:** Die Spiegelung in `pickup.ts` bleibt oder wird bei dieser Gelegenheit zu einer
  gemeinsamen Quelle in einer Lib zusammengelegt; drei Kopien sind heute schon eine zu viel
  (`docs/apps/landing.md`). Betriebsferien: prüfen, ob `hq/config/kalender.yaml` beim Build gelesen
  werden kann. Sonst steht das als offener Punkt drin.
- **Aufräumen:** `QuickOrder.tsx` und `context/CartContext.tsx` löschen. Den alten Shared-Kontext nur
  löschen, wenn ihn kein anderes Projekt importiert (`nx graph` prüfen). `bestellen/page.tsx` nutzt
  `createWhatsAppLink` aus `config/contact.ts`.
- **Datenschutz:** In `datenschutz/page.tsx` den Abschnitt WhatsApp um den Warenkorb und
  `localStorage` ergänzen: nur auf dem Gerät, keine Übertragung an uns außer der Nachricht, die der
  Kunde selbst abschickt. Kein Tracking.
- **Doku:** `docs/apps/landing.md` (neuer Abschnitt „Warenkorb und WhatsApp-Vorbestellung“),
  `docs/domains/vorbestellungen.md` (Kanal WhatsApp: neuer, einheitlicher Nachrichtenaufbau).
- **Tests** (synthetische Produkte, keine echten Namen oder Nummern in Fixtures):
  - Unit-Tests: Nachrichtentext inkl. Sonderzeichen und URL-Länge, Abholtage (Montag, Feiertag,
    Vorlauf Torte, kurz vor Ladenschluss), Speicher (kaputtes JSON, kein Speicher, abgelaufener Korb,
    Version).
  - E2E im Handy-Profil: Artikel hinzufügen, Menge ändern, Tag und Uhrzeit wählen, Name eingeben,
    `href` des WhatsApp-Knopfs enthält den erwarteten Text. Nach dem Neuladen ist der Korb noch da.
    Axe-Check des Sheets.

## Stufe 2 (eigener Task, nicht Teil dieses Sprints)

**„Aus WhatsApp übernehmen“ in der Verwaltung:** Im Formular „Vorbestellung erfassen“ fügt das Team
den Nachrichtentext ein. Ein Parser in `*.core.js` erkennt Produkte (über die exakten hq-Namen),
Mengen, Abholtag, Uhrzeit, Name und Bestell-Nr. und füllt daraus einen Entwurf mit Kanal „WhatsApp“.
Das Team prüft und speichert. Dadurch zahlt sich der feste Aufbau der Nachricht aus.

Später denkbar: WhatsApp Business (Kurzantworten „Bestätigt ✅“) als Arbeitsablauf. Die
WhatsApp-Business-API ist kostenpflichtig, an Meta gebunden und **nicht** geplant.

## Entscheidungen für den Inhaber

1. **Vorlauf und Bestellschluss:** Wie viele Stunden vorher für ganze Torten und Kuchen? Gibt es einen
   Bestellschluss für den Folgetag (z. B. „bis 12 Uhr für morgen“)? Die Werte in `lead-time.ts` sind
   bisher nur ein Vorschlag.
2. **Welche Produkte sind bestellbar?** Alle verfügbaren hq-Produkte, oder ohne Handelsware/Getränke?
3. **Abholort:** Nur der Laden, oder auch die Sammelstelle (mit eigenem Bestellschluss)?
4. **Preise anzeigen** als „ca.“-Summe, oder ganz ohne Summe?
5. **Höchstmengen** pro Artikel online (z. B. ab 20 Stück „bitte anrufen“)?
6. Welche **WhatsApp-Nummer** empfängt die Bestellungen: das bisherige Mobiltelefon oder ein eigenes
   Geschäftshandy? Wer bestätigt wann?

## Abnahme

- Am Handy (390 px) lässt sich in unter einer Minute ein Korb mit drei Artikeln füllen, eine
  Abholzeit wählen und WhatsApp mit dem fertigen Text öffnen.
- Ein geschlossener Tag, eine vergangene Uhrzeit oder ein zu früher Tag für eine Torte ist nicht
  wählbar, und der Grund steht dabei.
- Nach dem Neuladen sind Korb und (mit Häkchen) Name noch da; „Angaben vergessen“ löscht sie.
- Ohne `localStorage` funktioniert alles, nur ohne Merken.
- `QuickOrder.tsx` und der alte Landing-Kontext sind entfernt; die WhatsApp-Nummer steht nur noch in
  `config/contact.ts`.
- Der Inhaber schickt sich eine Testbestellung und bestätigt, dass sie im Laden ohne Rückfrage
  erfasst werden kann.

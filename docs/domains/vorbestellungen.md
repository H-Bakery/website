# Vorbestellungen

Alle Vorbestellungen - Laden, Telefon, WhatsApp, Shop, Sammelstelle Kindergarten Mörsbach - liegen in
der TypeScript-API in **einer** Tabelle (`preorders` + `preorder_items`) unter `/api/preorders`. Die
Verwaltung erfasst, bearbeitet, übergibt und druckt sie; die Backstube sieht nur Summen.

**Code:** Regeln `apps/bakery-api/src/services/delivery-preorders.core.js`; API
`src/routes/preorders.routes.ts`, `src/services/preorders.service.ts`,
`src/services/preorders-maintenance.ts` (Anonymisierung, Import), `src/services/preorder-variants.ts`;
Verwaltung `apps/bakery-management/src/lib/preordersApi.ts`, `preordersTypes.ts`, `abholliste.ts`,
`preorderDraft.ts`, `src/app/admin/preorders/**`, `src/app/admin/delivery/preorders/**`,
`src/components/preorders/`. Endpunkte, Rollen und Antwortform:
[`docs/api/preorders.md`](../api/preorders.md).

## Regeln (API)

- **Die Regeln stehen genau einmal** in `delivery-preorders.core.js` (bis B12 benutzte auch der
  Mock-Server dieselbe Datei). Keine zweite Implementierung anlegen.
- **Endpunkte:** Liste mit Filtern (`date`, `from`/`to`, `status`, `channel`, `pickupPointId`, `q`),
  Einzelabruf, Anlegen, Ändern, `/:id/status`, `/:id/cancel`, `/bulk-status`, `/sums?date=[&pickupPointId=]`
  (Backstube, Backliste), `/day?date=[&pickupPointId=<id>|laden]` (Abholliste), `/variants`,
  `/pickup-points[/:id]`. Der Alias `/api/deliveries/preorders*` mit dem Vertrag des früheren
  Mock-Servers bleibt für die Fahrer-App und alte Clients stehen (eine Vertrags-Suite vergleicht mit
  den aufgezeichneten Mock-Antworten); die Verwaltung spricht nur `/api/preorders`.
- **Status** `offen → bereit → abgeholt | storniert`, `abgeholt ↔ storniert` gesperrt, storniert wird
  statt gelöscht. Eine abgeholte Bestellung behält Positionen, Abholtag und -ort (409
  `already_picked_up`, erst auf „Offen" zurücksetzen). „Nicht abgeholt" ist **kein eigener Status**,
  sondern `bereit` + `notCollectedAt` (so übersetzt der Alias das `not_collected` des Mocks verlustfrei)
  und erst ab dem Abholtag erlaubt (409 `not_collected_too_early`).
- **Eingaben:** Mengen sind ganze Zahlen; `"abc"` oder `2.7` sind 400 `invalid_quantity`, nur eine
  ausdrückliche `0` streicht eine Zeile. Ein neuer Abholtag muss zwischen 30 Tagen zurück und 366 Tagen
  voraus liegen und im Laden kein Montag sein (400 `date_out_of_range` / `ruhetag`). Mit gültigem
  Kalender (`hq/config/kalender.yaml`, `docs/domains/backzettel.md` „Kalender") ist ein Schließtag -
  `geschlossen`, gesetzlicher Feiertag, reiner `teigtag` - auch für Sammelstellen gesperrt (400
  `geschlossen`, Meldung nennt Notiz bzw. Feiertag); eine Sonderöffnung oder „wie Sonntag" gibt den
  Montag frei. Ohne Kalender oder für ein Jahr ohne Feiertagsliste gilt nur der Montag
  (`pickupDayClosed()` in `delivery-preorders.core.js`). Vorläufig, bis der Inhaber entscheidet;
  Sonderproduktion an Schließtagen (R2-23) gibt es noch nicht. Dieselbe Regel liefert die Liste für
  die Maske: `GET /api/preorders/pickup-points` trägt neben `data` das Feld `pickupDays`
  (`closedPickupDays()`: `from`/`to` = das Fenster oben, `calendar`, `closed[]` mit `date`, `code`,
  `reason`, `message`, `shopOnly` - `shopOnly` heißt „nur im Laden gesperrt", also Ruhetag). Steuerzeichen im
  Namen und eine Telefonnummer mit weniger als 5 Ziffern sind 400, statt still gespeichert oder
  verworfen zu werden.
- **Doppeltes Anlegen:** `POST` nimmt eine optionale `requestId`; eine Wiederholung mit derselben
  Kennung liefert die schon angelegte Bestellung (200 statt 201), mit anderem Inhalt 409
  `request_id_changed` samt Verweis auf die Bestellung.
- **Sorten:** `variant` ist `''` für „keine Sorte", nie `null`. Gibt es `hq/config/backzettel.yaml`,
  muss bei Produkten mit Sorten eine davon gewählt werden; ohne Config wird jede Sorte angenommen. Über
  den Mörsbach-Alias ist das Speichern der Positionen einer Bestellung mit Sorten 409 `has_variants` -
  der alte Mock-Vertrag kennt keine Sorten.
- **Preis-Snapshot:** Name und Preis kommen beim Anlegen aus dem freigegebenen hq-Katalog
  (`hq-catalogue.ts`); beim Bearbeiten behalten vorhandene Positionen ihren damaligen Preis.
- **Kurzcode** für die Abholliste: `MO-2027-01-09-01` (Sammelstelle) bzw. `LA-…` (Laden). Jeder Code
  wird **nur einmal** vergeben - auch nicht nach Storno oder wenn die Bestellung auf einen anderen
  Tag/Ort umzieht (Register `preorder_codes`); ein alter Abholzettel zeigt nie auf eine fremde
  Bestellung.
- **Rollen:** `verkauf` (und `inhaber`) alles, `fahrer` lesen und nur übergeben bzw. „nicht abgeholt",
  `backstube` nur `/sums` (und dort ohne `summary`, also ohne Beträge und Bezahlstand). Der Fahrer darf
  „bezahlt" setzen, aber nie zurücknehmen (403 `paid_undo_forbidden`, auch über `bulk-status`), und
  eine **Übergabe nicht zurücknehmen**: eine `abgeholt`e Bestellung auf `offen`/`bereit`/„nicht
  abgeholt" setzen ist für ihn 403 `handover_undo_forbidden` (Status-Endpunkt, `bulk-status` und
  Mörsbach-Alias). Das kann nur der Verkauf.
- **Veraltete Schreibzugriffe:** Schreibaktionen nehmen `expectedUpdatedAt`; hat inzwischen jemand
  anderes geändert, 409 `stale_preorder` (Sammelstelle: `stale_pickup_point`).
- **Suche `?q=`** über Name und Code ist ein `GLOB` mit Groß/klein-Klassen je Buchstabe
  (`caseInsensitiveGlob()` in `preorders.service.ts`) - SQLites `LIKE` faltet nur ASCII, „öztürk"
  fand „Öztürk" nicht. `%`, `_`, `*`, `?`, `[` sind wörtliche Zeichen.
- **Bezahlter Betrag** (`paid_amount`): wird beim Erfassen der Zahlung auf die Summe gesetzt (Anlegen
  mit `paid`, `paid` false → true, ein ausdrückliches `paid: true` am Status-Endpunkt = „Rest
  kassiert"), bleibt beim Bearbeiten stehen und fällt mit `paid: false` weg. DTO: `paidAmount`,
  `paymentBalance` (> 0 noch kassieren, < 0 erstatten; storniert + bezahlt = −bezahlt).
  `/day`-Summary: `unpaidTotal` enthält Nachzahlungen (`topUpTotal`), dazu `refundCount`/`refundTotal`
  - auch über stornierte. `NULL` bei `paid` heißt „voll bezahlt" (Altbestand, Importe).
- **Backzettel-Nachträge** schreibt der Schreibweg der Vorbestellung (Anlegen, Ändern, Status, Storno,
  Sammelaktion) in derselben Transaktion, nicht das Lesen des Backzettels - siehe
  [`backzettel.md`](backzettel.md).
- **Shop:** `POST /api/orders` legt eine Vorbestellung mit Kanal `shop` an (`shop-orders.core.js`),
  **bleibt aber hinter der Anmeldung** - ein öffentlicher Bestellweg ist noch nicht entschieden. Die
  E-Mail wird nicht gespeichert.
- **Mörsbach-Alias:** übergeben heißt bezahlt (wie beim Import) - seit der Abschluss-Verifikation
  `next` nur bei einer **unbezahlten** Bestellung; eine vorab bezahlte behält ihren Betrag, ein offener
  Rest bleibt „noch zu kassieren", eine offene Erstattung „zu erstatten". Der Fahrer bestätigt sie mit
  `{ status: 'handed_over', paid: true }` (Fahrer-App: „Rest kassiert und übergeben" / „Erstattet und
  übergeben"). Reines Abhaken (`{ status[, paid] }`) prüft den Liefertag nicht erneut. Die Antworten
  tragen zusätzlich `paidAmount` und `paymentBalance`.

## Datenschutz und Betrieb

- **DSGVO (P4):** 90 Tage nach dem Abholtag werden Name, Telefon **und Anmerkung** jeder Vorbestellung
  gelöscht, **egal in welchem Status** (Name `anonymisiert`) - nachts um 23:45 über
  `deploy/systemd/bakery-anonymize.timer` (`cli.js anonymize-preorders`). Der Lauf migriert nie; stehen
  Migrationen aus, bricht er ab. Das Audit-Log enthält nie Namen oder Telefonnummern. Im selben Lauf
  verlieren seit B8 Lieferstopps, deren Tourtag mehr als 90 Tage zurückliegt, Name, Telefon,
  Hinweis, Straße und Koordinaten ([liefertouren.md](liefertouren.md)).
- **Summen-Snapshot nach hq (Z9):** `cli.js snapshot-preorders` schreibt nachts um 22:15
  (`bakery-snapshot-preorders.timer`) `data/production/vorbestellungen/YYYY-MM-DD.json` - nur Summen,
  keine Personendaten (`hq-snapshots.core.js`).
- **Umzug der früheren Mock-Daten:** `cli.js import-preorders --file apps/bakery-api/data/delivery-store.json --dry-run`,
  idempotent (`docs/runbook.md` §3.9); die Touren derselben Datei übernimmt `import-deliveries`
  ([liefertouren.md](liefertouren.md)).

## Verwaltung: Liste, Erfassung, Ansicht, Tag (P1/P3)

`/admin/preorders` (Liste mit Suche `q`, Zeitraum, Status, Bestellweg, Abholort - alles in der URL),
`/admin/preorders/neu` (Erfassung), `/admin/preorders/[id]` (Ansicht, Bearbeiten, Status, Stornieren)
und `/admin/preorders/tag?date=` (Summen je Produkt **und Sorte**, Abholliste, A4-Druck).

- **Ein Client für alle:** `src/lib/preordersApi.ts` (jeder `/api/preorders`-Endpunkt) und
  `src/lib/preordersTypes.ts` (Typen, Labels, Produktionstage, `isEditable`/`isCancellable`,
  `canWritePreorders`, `paymentState`). Keinen zweiten Client anlegen. Gerechnet wird auf dem Server
  (`/day`, `/sums`, Preise); die App zeigt nur an.
- **Sorten** kommen aus `GET /api/preorders/variants` → `{ data: { [productId]: string[] }, configured }`
  (aus `backzettel.core.js#variantsByProduct`). Hat ein Produkt Sorten, ist die Wahl Pflicht; das
  Label ist der großgeschriebene Slug (`nuss` → „Nuss"). Fokus der Sorten-Chips ist ein abgesetzter
  Ring, keine Flächenfarbe (sonst sieht die erste Sorte im Dunkelmodus gewählt aus); solange die Sorte
  fehlt, heißt der Knopf „Erst Sorte wählen".
- **Abholtag:** Vorschlag ist der nächste Produktionstag ab morgen; Montag ist Ruhetag und wird
  abgelehnt. Eine Sammelstelle erzwingt ihren Wochentag (`weekday` wie `Date.getDay()`, 6 = Sa) und hat
  keine Uhrzeit; der Kanal springt dann auf „Sammelstelle".
- **Schließtage werden nicht angeboten (Z14):** die Maske (Erfassen, Bearbeiten, Sammelstelle) lädt
  mit den Sammelstellen `pickupDays` (`fetchPickupPointInfo()`) und fragt nur `closedPickupDay()` in
  `preordersTypes.ts` - gerechnet wird auf dem Server. Vorgabe und Schnellwahl überspringen Ruhe-
  und Schließtage (eine Sonderöffnung am Montag steht dabei), an der Sammelstelle fällt ein
  geschlossener Liefertag weg. Darunter steht, was fehlt: „Geschlossen, deshalb nicht wählbar: Fr
  25.12. (1. Weihnachtstag)" - nur Schließtage bis zum letzten Vorschlag, nicht der wöchentliche
  Ruhetag. Das Datumsfeld ist das des Browsers: es kennt das Fenster (`min`/`max`), kann aber
  einzelne Tage nicht ausgrauen - ein von Hand gewählter Schließtag zeigt sofort die Meldung des
  Servers und lässt sich nicht speichern. Ohne `pickupDays` (kein Feld in der Antwort) oder außerhalb
  des Fensters gilt nur der Montag im Laden. **Bearbeiten:** der schon gespeicherte Abholtag ist am
  gespeicherten Ort nie gesperrt (die API prüft nur einen neuen Tag); wechselt die Bestellung
  zwischen Sammelstelle und Laden, ist der Tag dort neu und wird geprüft - in Maske und API (der
  Montag einer Sammelstelle ist im Laden Ruhetag: die Maske weicht auf den nächsten offenen Tag aus,
  die API antwortet `ruhetag`). Ist der Tag inzwischen geschlossen, bleibt er stehen mit
  dem Hinweis „An diesem Tag ist die Bäckerei geschlossen (…) - der Abholtag bleibt stehen, bis er
  geändert wird." Vorläufig: ob eine solche Bestellung umgelegt werden muss, entscheidet der
  Inhaber (der Backzettel meldet sie mit `preorders_on_closed_day`). Der Shop-Checkout fragt keinen
  Abholtag ab und ist unverändert. **Wege in die Maske:** die Tagesübersicht startet ohne Datum am
  nächsten offenen Tag (`nextProductionDate(today, pickupDays)`; ohne Antwort des Servers gilt nur
  der Montag), nennt an einem Schließtag den Grund und bietet dort „Vorbestellung erfassen" nicht
  an; „Nächster Backtag" in der Liste überspringt Schließtage. Ein Tag aus dem Link (`?date=`, auch
  von der Abholliste) ist für die Maske nur ein Vorschlag: ist er gesperrt, steht der nächste offene
  Tag danach da (Sammelstelle: ihr nächster Liefertag), nicht vor morgen. Blättern in
  Tagesübersicht und Abholliste zeigt Schließtage weiter - dort können alte Bestellungen liegen.
- **Tastatur:** Die Maske ist kein `<form>` - Enter springt weiter (Name → Telefon → Suche → Menge →
  Hinzufügen → Suche), **Strg/Cmd+Enter speichert**. Die Ziffernblock-Tasten haben `tabIndex -1` und
  nehmen dem Mengenfeld den Fokus nicht.
- **Entwurf übersteht das Sitzungsende** (`src/lib/preorderDraft.ts`): eine halb erfasste
  Telefonbestellung liegt in `sessionStorage`, **einer je Benutzer** (`draftKey`, an der gemeinsamen
  Station überschreibt ein Kollege ihn nicht), verfällt nach 12 h und trägt die `requestId` des
  Speicherns mit - ein Wiederholen nach verlorener Antwort legt keine zweite Bestellung an. Meldet die
  API `request_id_changed`, entscheidet die Verkäuferin: in die schon angelegte Bestellung übernehmen
  oder neu.
- **Preis-Snapshot:** Die Summe in der Maske ist eine Vorschau. Ändert sich Tag oder Ort, vergibt der
  Server einen neuen Code - die Oberfläche sagt das an.
- **„Als PDF drucken“ (Bestellschein):** Die Ansicht einer Vorbestellung lädt die Bestellung als
  A4-PDF mit dem Briefkopf der Bäckerei: Code, Kunde, Telefon, Abholtag, -ort und -zeit, Bestellweg,
  Status, Bezahlstand, Positionen mit Einzelpreis und Summe, Gesamtbetrag, Anmerkung. Darauf steht
  „Dieser Bestellschein ist keine Rechnung.“ - eine Rechnung stellt nur der Inhaber unter
  `/admin/rechnungen` aus. Stornierte tragen „STORNIERT“; eine anonymisierte Bestellung zeigt auch
  im PDF weder Name noch Telefon noch Anmerkung. Den Knopf sieht jeder, der die Bestellung sehen
  darf (auch der Fahrer). `GET /api/preorders/:id/pdf`, Details in
  [`docs/api/preorders.md`](../api/preorders.md).
- **Nie löschen:** Stornieren nur über die Rückfrage, `offen`/`bereit` sind bearbeitbar, abgeholt nur
  zurück auf „Offen". Auch „Storno aufheben" fragt nach - die Bestellung zählt danach wieder für die
  Backstube.
- **Keine verlorenen Änderungen (zweites Gerät).** Bearbeiten schickt nur die geänderten Felder
  (`preorderPatch()` in `preordersTypes.ts`), und jede Schreibaktion der Ansicht (Bearbeiten, Status,
  bezahlt, Stornieren, Storno aufheben) schickt den geladenen `updatedAt` als `expectedUpdatedAt`. Bei
  409 `stale_preorder` schließt die Seite die Maske, lädt neu und sagt, dass nichts überschrieben wurde
  (`isPreorderConflict()` zählt auch `already_picked_up` und `cancelled` dazu). Sonst setzte eine offene
  Maske, in der nur eine Notiz ergänzt wird, `paid` einer schon bezahlt übergebenen Bestellung wieder
  auf `false`. Neue Schreibaktionen: genauso.
- **„Alle Tage" steht als `range=alle` in der URL** (`preorderPageQuery()`); eine URL ganz ohne
  Zeitraum heißt „Vorgabe ab heute". Die API kennt den Parameter nicht.
- **Rollen:** `verkauf` und `inhaber` schreiben; `fahrer` sieht Liste, Ansicht und Tag nur lesend
  (`/admin/preorders/neu` ist für ihn gesperrt - `RouteRule` mit `except` in `src/lib/roles.ts`).
  Verkauf startet nach der Anmeldung in `/admin/preorders`.
- **Gerätespeicher** (nur Bequemlichkeit): `bakery-management-preorder-channel` (zuletzt gewählter
  Kanal), `bakery-management-preorder-recent` (zuletzt erfasste Produkte); „Häufig" rechnet zusätzlich
  über die Vorbestellungen der letzten 28 Tage.

## Abholliste (P2, `/admin/preorders/abholliste?date=&point=`)

Die Übergabeliste je Tag und Abholort (`point` = `laden` oder die id einer Sammelstelle) - am Tablet
an der Theke, am Handy des Fahrers an der Sammelstelle, auf Papier, wenn beides ausfällt. Logik ohne
React in `src/lib/abholliste.ts`.

- **Eine Anfrage je Liste:** `GET /api/preorders/day?date=&pickupPointId=` (`laden` = ohne
  Sammelstelle). Kacheln und Summen rechnet der Server für genau diesen Ort;
  `pickupPoints[].preorderCount` zählt den ganzen Tag.
- **Gruppiert** nach Uhrzeit (Laden-Vorgabe; ohne Uhrzeit ans Ende, an der Sammelstelle als „Übergabe
  {Fenster} Uhr") oder nach Name (Sammelstelle-Vorgabe; Anfangsbuchstabe, Umlaute auf den
  Grundbuchstaben). Stornierte stehen immer zuletzt, durchgestrichen, und fehlen im Druck.
- **Suche** im Client: ein- bis zweistellige Zahl = laufende Nummer am Ende des Codes (sonst träfe „4"
  jedes Datum), sonst Name oder Code, ab drei Ziffern auch die Telefonnummer.
- **Übergeben** setzt `abgeholt` über `POST /:id/status` mit `expectedUpdatedAt` (409 → Liste neu laden,
  Hinweis, nichts überschrieben). Bezahlt + Verkauf/Inhaber: ein Tipp mit „Rückgängig" (stellt Status,
  `paid` und `notCollected` von vorher wieder her). Sonst ein Dialog: „Bezahlt und übergeben" / „Ohne
  Zahlung übergeben". Fahrer bekommen immer den Dialog und kein Rückgängig. Welche Aktion wer sieht,
  steht einmal in `abholActions(preorder, role, today)` und spiegelt die Rollenregeln der API - auch
  „Nicht abgeholt" je Zeile erst ab dem Abholtag.
- **Tagesabschluss** („Rest nicht abgeholt") erst ab dem Abholtag (`isDayEndAllowed`), „Alle offenen
  als bereit" nur für Verkauf/Inhaber; beide mit Rückfrage und als **ein Aufruf**
  (`POST /api/preorders/bulk-status`, eine Transaktion, Ergebnis je Bestellung). Meldungen je Art
  getrennt (`describeBulkResults`): inzwischen geändert, anonymisiert, nicht mehr da, abgelehnt (mit
  API-Text). Scheitert der Aufruf als Ganzes, ist nichts gespeichert - „Keine Verbindung …" bzw. „Der
  Server hat einen Fehler gemeldet …" im offenen Dialog (`requestFailureKind`: keine Antwort / 5xx / 4xx).
- **Einzelne Tipps melden Fehler auch unten** als Snackbar, die stehen bleibt (die Meldung über der
  Liste lag am Handy außer Sicht). Bleibt die Antwort aus oder kommt 5xx, ist **unklar**, ob gespeichert
  wurde - die Seite lädt sofort neu und vergleicht (`changeAlreadyApplied`): schon so am Server → „Die
  Antwort ging verloren, gespeichert ist es trotzdem."; frisch geladen und nicht so → „nichts
  gespeichert"; Neuladen scheitert → „ob das gespeichert wurde, ist unklar"
  (`singleRequestFailedMessage`), und das Ereignis `online` lädt nach. Ein 409 auf einen zweiten
  Versuch, der schon so gespeichert ist, heißt „Das ist bereits gespeichert - nichts zu tun."
  **Mehrere unklare Tipps** (Funkloch) werden je Bestellung gemerkt und nach dem Neuladen einzeln
  aufgelöst (`data-testid="open-actions"`); ein späterer erfolgreicher Tipp auf dieselbe Bestellung
  streicht ihren Eintrag. Die Snackbar bekommt einen Platzhalter unter der Liste, damit sie die letzten
  Knöpfe nicht verdeckt.
- **Rest und Erstattung** (`paymentState()` aus `paymentBalance`: `unpaid`, `paid`, `rest`, `refund`):
  Chip „Rest X offen" bzw. „Erstattung X offen" - auch an stornierten, schon bezahlten Bestellungen. Ein
  Tipp-Übergeben gibt es nur bei `paid`; sonst nennt der Dialog den Rest bzw. „X an die Kundschaft
  zurückgeben" und bietet „Erstattet und übergeben" / „Ohne Erstattung übergeben". „Erstattet" je Zeile
  schickt `paid: true` (offen, abgeholt: Betrag = Summe) bzw. an einer stornierten `paid: false`; der
  Fahrer darf das an stornierten nicht (`paid_undo_forbidden`) und sieht stattdessen „Erfassen kann das
  der Verkauf.". Kachel „Zu erstatten"; der Druck hat eine Gruppe „Storniert - Geld zurückgeben" und
  schreibt „☐ Rest X" / „☐ X zurück". Listen, Tagesansicht und Sammelstelle zeigen dasselbe über
  `components/preorders/PaymentNote.tsx`; Sammelstelle und Backliste nennen `handedOverUnpaidTotal`
  neben der Summe.
- **Stilles Nachladen** alle 60 s und beim Zurückkehren ins Fenster (`focus`, `visibilitychange`) -
  aber nie, solange ein Dialog, ein Menü oder eine Aktion offen ist. Dabei wird auch **„heute" neu
  bestimmt** (ein Tablet, das über Nacht offen bleibt). Scheitert es, bleibt die letzte Liste mit
  Hinweis „… Angezeigt wird der Stand von HH:MM." stehen; „Die Liste ist neu geladen" steht nur da, wenn
  das Neuladen wirklich geklappt hat.
- **Telefonnummern** sind `tel:`-Links mit mindestens 44 × 44 px (`TOUCH_LINK_STYLE`).
- **Druck (A4 hoch):** gedruckt wird eine eigene Tabelle `.abholliste-print`, nicht die Karten - immer
  der ganze Tag ohne Stornierte, unabhängig von Suche und Filter, mit ☐/☑, Code, Name (+ Telefon),
  Artikel mit Sorte, Summe, Bezahlt ja/nein, Unterschrift; Kopf mit „Stand … Uhr". `border-collapse` +
  `width: 100%` schnitt rechts die Außenlinie ab - deshalb `calc(100% - 1pt)`.
- **Navigation:** „Abholliste" steht direkt unter „Vorbestellungen"; `isNavItemActive()` bekommt die
  Geschwister-Pfade und lässt den spezifischeren Eintrag gewinnen, sonst wären beide markiert.

## Sammelstelle Mörsbach (`/admin/delivery/preorders*`)

Navigationspunkt „Sammelstelle Mörsbach" (eigene Liste mit Bestellschluss, Backliste und Lieferstelle).

- Liste, Backliste und Lieferstelle lesen und schreiben über `src/lib/preordersApi.ts`
  (`fetchPreorderDay(date, pointId)`, `cancelPreorder`, `savePickupPoint`). Erfassen und Bearbeiten
  sind die P1-Maske bzw. die P3-Ansicht mit vorbelegter Sammelstelle und Rückweg auf den Liefertag
  (`MoersbachPreorderClients.tsx`).
- Die Liste zeigt Sorten, Code und bezahlt, verlinkt auf die Abholliste und storniert mit
  `expectedUpdatedAt`. Unter `md` (Handy, Tablet hochkant) steht je Bestellung eine Karte statt der
  Tabelle - Summe, Status und Aktion lagen sonst seitlich außer Sicht.
- `PUT /api/preorders/pickup-points/:id` (nur `inhaber`) ändert die Sammelstelle; die Seite zeigt allen
  anderen die Felder **schreibgeschützt** (`readOnly`, Schalter gesperrt, kein „Speichern"), schickt
  `expectedUpdatedAt` mit (409 `stale_pickup_point` → Hinweis mit „Neu laden") und begrenzt die Texte
  wie der Core (Notizen 2000 Zeichen).
- Die **Backliste** liest `GET /api/preorders/sums?date=&pickupPointId=` (Summen + Kopfzahlen, ohne
  Namen und Telefon), nicht `/day`.
- Fahrer: Liste, Bestellung und Backliste lesen, ohne `/new` und `/lieferstelle`.
- Eine geänderte Sammelstelle (Adresse) zieht seit B8 an jedem Tourstopp dieser Stelle mit; die
  Koordinaten werden dort geleert und beim nächsten Lesen neu gesucht. Die Übergabeliste des Stopps
  in der Fahrer-App kommt aus `/api/preorders` (siehe [liefertouren.md](liefertouren.md)).

## Tests

- API: `tests/integration/preordersPickupDays.test.ts` (`pickupDays` gegen das, was Speichern
  ablehnt), `tests/integration/preorders.test.ts` (u. a. `GET /variants`, veraltete Schreibzugriffe,
  Storno-Sperre, „narrows the day to one place", `PUT /api/preorders/pickup-points/:id`),
  `tests/integration/preordersMaintenance.test.ts` (Anonymisierung, Import),
  `tests/unit/preordersModel.test.js` (`lockCancelled`), `tests/unit/deliveryPreorders.test.js`,
  `tests/unit/preorderVariants.test.ts`, `tests/contract/preorders.contract.test.ts` (Alias gegen den
  aufgezeichneten Mock).
- Verwaltung: `src/lib/preorders.spec.ts` (Formatierung, Produktionstage, Suche, Ziffernblock),
  `src/lib/preordersApi.spec.ts`, `src/lib/abholliste.spec.ts`, RTL-Specs neben den Seiten
  (`admin/preorders/**/*.spec.tsx`, `admin/delivery/preorders/**/*.spec.tsx`,
  `components/preorders/PaymentNote.spec.tsx`), `src/app/layout.navigation.spec.tsx`. Fixtures
  erfunden: `src/lib/testing/preorderFixtures.ts`.
- E2E: `apps/bakery-management-e2e/src/management-preorders.spec.ts`.

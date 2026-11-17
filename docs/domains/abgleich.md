# Abgleich Produktion ↔ Kasse

Ein Kontrollwerkzeug für den Inhaber unter `/admin/abgleich`: Was gebacken wurde, wird je Backtag
und Posten gegen Kasse und Rest am Abend gelegt.

**Ungeklärt = gebacken − CAP − verkauft (Kasse) − Rest (gezählt)**

- **> 0 deutlich:** Ware ist weg, ohne an der Kasse oder im Rest zu stehen (ohne Bon verkauft,
  Bruch, Personalverzehr, verzählt).
- **< 0 deutlich:** mehr verkauft als gebacken (Kassennummer falsch zugeordnet, nachgebacken ohne
  Nachtrag, Ware vom Vortag).

Ein Unterschied ist ein **Hinweis, kein Beweis**. Nirgends steht, wer gezählt oder kassiert hat -
keine Zuordnung zu einzelnen Personen.

**Code:** Rechnung `apps/bakery-api/src/services/abgleich.core.js` (auf den Bausteinen von
`rest-am-abend.core.js` und `backzettel-reference.core.js`) · Lesen `abgleich.service.ts` ·
Routen `src/routes/abgleich.routes.ts` (`/api/abgleich`) · Management-App
`src/lib/abgleichApi.ts`, `src/app/admin/abgleich/AbgleichClient.tsx`. API-Details:
[`docs/api/abgleich.md`](../api/abgleich.md).

## Regeln

- **Die Rechnung steht genau einmal**, in `abgleich.core.js`. Gebacken, CAP und Rest kommen aus
  den Bausteinen von Rest am Abend (`backzettelLines`, `lineComplete`, `lineRest`,
  `countDayStatus`, Restquote `rate`), verkauft aus der Z4-Referenz (`itemSoldInfo`,
  `sizeSoldInfo`, `soldOnDay`, Stornos saldiert). Keine zweite Implementierung.
- **Je Posten wie Rest am Abend:** Backzettel-Posten × Sorte × Laibgröße. Die Kasse kennt keine
  Sorten (Nuss, Mohn …): verglichen wird der Posten über alle Sorten, die Sorten stehen beim
  Aufklappen zur Information. **Brot je Laibgröße** wird je Größe verglichen, wenn jede Größe
  eigene Kassennummern hat (`sizes[].plu`) und sie zusammen alle Kassennummern des Postens
  abdecken; sonst der ganze Posten über alle Größen.
- **Gebacken** = freigegebener Backzettel des Backtags (Backliste `getBakeLines`, alle Zettel
  dieses Tages freigegeben) plus quittierte Nachträge. **Nicht freigegeben:** der geplante Wert,
  deutlich markiert („geplant – nicht freigegeben“, je Tag, Posten und oben auf der Seite). Im
  Pilot ist das vorerst der Normalfall.
- **Grundmenge offen:** hat eine Entwurfszeile keine festgelegte Grundmenge und für den Tag keine
  Entscheidung (`totalIsMinimum`), ist ihr Gesamt nur ein Mindestwert (CAP + Vorbestellungen),
  kein Plan. Die Tageszeile heißt „Grundmenge offen – kein Plan“, zeigt gebacken als „≥ n“ und hat
  kein Ungeklärt und keine Ampel - eine Lücke wie „kein Kassenbericht“, nie 0 und nie „mehr
  verkauft“. Solche Tage zählen nicht in die Summen des Postens (`gaps.baseOpen`).
- **Entwurf ohne Zeile:** ein Backtag, dessen Backliste keine einzige Zeile hat, ist „kein
  Backzettel“ - nicht ein Backtag, an dem alles „verkauft, aber nicht gebacken“ wäre.
- **CAP** (Verkaufspartner) verlässt den Laden und wird abgezogen. **Vorbestellungen** werden im
  Laden an der Kasse bezahlt und deshalb **nicht** abgezogen - **vorläufig**.
- **Rest fehlt** (Tag nicht oder nur teilweise gezählt): nie 0. Dann steht nur „nicht verkauft
  oder nicht kassiert“ = gebacken − CAP − verkauft; „Ungeklärt“ gibt es erst mit vollständiger
  Zählung. Ist schon dieser Wert negativ, kann kein Rest ihn erklären - die Ampel zeigt das auch
  ohne Zählung („prüfen (ohne Rest)“).
- **Verkauft, aber nicht gebacken:** steht ein Posten nicht auf dem Backzettel des Tages, wurde
  aber verkauft, erscheint er mit gebacken 0 (Signal „mehr verkauft“). Das ist keine Zähllücke:
  die Zeile sagt „verkauft, aber nicht auf dem Backzettel“ (`gaps.notOnBackzettel`), nicht „Rest
  nicht gezählt“.
- **Einheiten:** verglichen wird, wenn jede Kassennummer einem Produkt des Postens mit Faktor
  zugeordnet ist (`converted`, `soldBasis: 'umgerechnet'`) - oder wenn Posten und Kasse beide
  Stück zählen: ein Stück-Posten, dessen Produkte je ein Stück sind (Faktor 1), wird Stück gegen
  Stück verglichen (`soldBasis: 'stueck'`, **vorläufig**; in hq sind die Kassennummern heute meist
  nicht die `numeric_id` der Produkte). Sonst „nicht vergleichbar (Einheit)“ - z. B. ein Liter-Posten,
  dessen Kassennummer kein Produkt mit Faktor hat, oder ein Stück-Posten, von dessen
  Kassennummern eine das Produkt eines **anderen** Postens ist (Stammdatenfehler, wird nie still
  mitgezählt). „Fremd“ ist eine Kassennummer nur, wenn ein anderer Posten sie selbst in `plu`
  führt oder sie die Produkt-ID eines Produkts eines anderen Postens ist - ein Treffer nur über die
  `numeric_id` des Katalogs zählt nicht (Kassennummern und `numeric_id` treffen sich zufällig). Ob ein Posten vergleichbar ist, hängt nur an den Stammdaten - nicht daran, ob es im
  Zeitraum einen Kassenbericht gab. Die Stück-gegen-Stück-Regel gilt bewusst nur hier; Rest am
  Abend und die Grundmengen-Referenz zeigen dieselben Stückzahlen weiter als „nicht umgerechnet“,
  bis der Inhaber die Regel bestätigt. **Ohne Kassennummer:** „keine Kassennummer“.
  Beide stehen getrennt unter „Ohne Kassennummer / nicht vergleichbar“ mit dem Hinweis, was in
  hq `config/backzettel.yaml` fehlt (`plu`, `products[].factor`).
- **Lücken:** ein Backtag ohne Kassenbericht ist „kein Kassenbericht“, nie 0. Der Kalender
  (`countDayStatus`) entscheidet wie bei Rest am Abend: Schließtag = „geschlossen“, Ruhetag wird
  übersprungen.
- **Ampel** (Schwellen **vorläufig**, Konstanten in `abgleich.core.js`): |Ungeklärt| ≤ max(1 Stück,
  5 % von gebacken − CAP) → ok, ≤ 15 % → auffällig, sonst → prüfen. „1 Stück“ ist das kleinste
  Produkt des Postens in seiner Einheit (ein 500-g-Laib = 0,5 L, ein Kuchenstück = ¼ Blech). Je
  Tag und je Posten über den Zeitraum: dort gilt die **schlechtere** von zwei Ampeln - Ungeklärt
  über die Tage mit Rest, und „mehr verkauft“ über die Tage ohne Rest (nur die negativen Tage
  summiert; übrige Ware eines Tages gleicht zu viel Verkauf an einem anderen nicht aus). Diese
  Menge steht unter der Ampel („−10 St. an einem Tag ohne Rest“, `shortWithoutRest`, im CSV „Mehr
  verkauft (Tage ohne Rest)“), weil die Spalten davor sie verrechnet zeigen. Hat ein Tag „prüfen“,
  der Zeitraum aber nicht, sagt die Zeile „An n Tagen prüfen“.
- **Gebacken je Posten** zählt nur die vergleichbaren Tage (Kassenbericht da, Grundmenge
  festgelegt), damit gebacken − CAP − verkauft aufgeht. Fehlen Tage, steht darunter „x von y
  Tagen (alle: n)“; im CSV stehen „Gebacken (alle Tage)“ und „Gebacken (vergleichbare Tage)“
  getrennt. Ein Mindestwert (Grundmenge offen) steht auch im CSV als „≥ n“.
- **Rest nur an einem Teil der Tage:** gebacken, CAP, verkauft und „nicht verkauft oder nicht
  kassiert“ laufen über alle vergleichbaren Tage, Rest und Ungeklärt nur über die gezählten. Die
  Grundlage von Ungeklärt steht deshalb darunter („nur 1 von 2 Tagen: gebacken − CAP − verkauft −
  Rest“) und im CSV als eigene Spalten („Gebacken − CAP (Tage mit Rest)“, „Verkauft (Tage mit
  Rest)“).
- **Zu viel produziert:** Restquote (Rest ÷ (gebacken − CAP), wie Rest am Abend) über 10 %
  (**vorläufig**).
- **Sortierung:** „prüfen“ vor „auffällig“ vor „ok“, darin der größte Unterschied zuerst.
- **Zeitraum:** ohne Angabe die letzten 7 Backtage vor heute (heute ist noch nicht
  abgeschlossen), höchstens 62 Tage.
- **Nur Inhaber:** `ROLE_ACCESS` (Inhaber hat alle Routen), `PILOT_ALLOWED_ROUTES` enthält
  `/admin/abgleich`, die API prüft `requireRole('inhaber')`. Verlinkt in der Navigation unter der
  Rest-Auswertung und von der Rest-Auswertung („Abgleich mit Kasse“).

## Für die volle Rechnung

1. Backzettel freigeben (sonst „geplant“).
2. Rest am Abend vollständig zählen (sonst nur „nicht verkauft oder nicht kassiert“).
3. Kassennummern (`plu`) und Produktfaktoren in hq `config/backzettel.yaml` pflegen.

## Tests

- API: `apps/bakery-api/tests/unit/abgleich.test.js` (Kern) und
  `apps/bakery-api/tests/integration/abgleich.test.ts` (Rollen, Zeitraum, CSV)
- Management-App: `src/app/admin/abgleich/AbgleichClient.spec.tsx`

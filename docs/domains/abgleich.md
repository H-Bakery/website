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
- **CAP** (Verkaufspartner) verlässt den Laden und wird abgezogen. **Vorbestellungen** werden im
  Laden an der Kasse bezahlt und deshalb **nicht** abgezogen - **vorläufig**.
- **Rest fehlt** (Tag nicht oder nur teilweise gezählt): nie 0. Dann steht nur „nicht verkauft
  oder nicht kassiert“ = gebacken − CAP − verkauft; „Ungeklärt“ gibt es erst mit vollständiger
  Zählung. Ist schon dieser Wert negativ, kann kein Rest ihn erklären - die Ampel zeigt das auch
  ohne Zählung („prüfen (ohne Rest)“).
- **Verkauft, aber nicht gebacken:** steht ein Posten nicht auf dem Backzettel des Tages, wurde
  aber verkauft, erscheint er mit gebacken 0 (Signal „mehr verkauft“).
- **Einheiten:** verglichen wird nur, wenn jede Kassennummer einem Produkt des Postens mit Faktor
  zugeordnet ist (`converted`). Sonst „nicht vergleichbar (Einheit)“ - z. B. ein Liter-Posten,
  dessen Kassennummer kein Produkt mit Faktor hat. **Ohne Kassennummer:** „keine Kassennummer“.
  Beide stehen getrennt unter „Ohne Kassennummer / nicht vergleichbar“ mit dem Hinweis, was in
  hq `config/backzettel.yaml` fehlt (`plu`, `products[].factor`).
- **Lücken:** ein Backtag ohne Kassenbericht ist „kein Kassenbericht“, nie 0. Der Kalender
  (`countDayStatus`) entscheidet wie bei Rest am Abend: Schließtag = „geschlossen“, Ruhetag wird
  übersprungen.
- **Ampel** (Schwellen **vorläufig**, Konstanten in `abgleich.core.js`): |Ungeklärt| ≤ max(1 Stück,
  5 % von gebacken − CAP) → ok, ≤ 15 % → auffällig, sonst → prüfen. „1 Stück“ ist das kleinste
  Produkt des Postens in seiner Einheit (ein 500-g-Laib = 0,5 L, ein Kuchenstück = ¼ Blech). Je
  Tag und je Posten über den Zeitraum (Summe der Tage mit Rest).
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

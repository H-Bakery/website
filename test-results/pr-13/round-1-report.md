# PR #13 — Testbericht Runde 1

**Prüferin:** Emma (Qualitätsprüfung)
**Datum:** 2026-03-08
**Branch:** pr-13 (feat: display HQ products on landing page)
**Ergebnis:** PASS (mit Hinweis)

---

## Zusammenfassung

PR #13 zeigt echte HQ-Produktdaten auf der Landing Page und fügt einen API-Endpoint hinzu. **Die Kernfunktionalität funktioniert einwandfrei.**

## Build-Status

| Build                   | Status  |
| ----------------------- | ------- |
| bakery-api              | ✅ GRÜN |
| bakery-landing (static) | ✅ GRÜN |

## Playwright-Tests: 10/11 bestanden

| #   | Test                                 | Status                      |
| --- | ------------------------------------ | --------------------------- |
| 01  | Homepage lädt ohne Fehler            | ⚠️ FAIL (404 Console-Error) |
| 02  | Sortiment-Sektion sichtbar           | ✅ PASS                     |
| 03  | Kategorie-Filter-Chips angezeigt     | ✅ PASS                     |
| 04  | Produkte im Grid angezeigt           | ✅ PASS                     |
| 05  | Kategorie-Filter funktioniert (Brot) | ✅ PASS                     |
| 06  | Vollseiten-Screenshot                | ✅ PASS                     |
| 07  | Mobile Viewport                      | ✅ PASS                     |
| 08  | /products Seite lädt                 | ✅ PASS                     |
| 09  | API /api/products liefert Daten      | ✅ PASS                     |
| 10  | API Kategorie-Filter funktioniert    | ✅ PASS                     |
| 11  | Keine Console-Errors bei Navigation  | ✅ PASS                     |

## Bekannter Fehler (Minor)

**404 für `Type=Brötchen.svg`**

- **Ursache:** Die Datei `apps/bakery-landing/public/assets/images/products/Type=Brötchen.svg` hat einen Umlaut (`ö`) im Dateinamen. Next.js Dev-Server encodiert die URL doppelt (`%C3%83%C2%B6` statt `%C3%B6`), was zum 404 führt.
- **Betrifft:** `apps/bakery-landing/src/lib/products.ts` Zeile 32 — `CATEGORY_FALLBACK_IMAGE.broetchen`
- **Auswirkung:** Brötchen-Produkte ohne eigenes Bild zeigen kein Fallback-Bild. Kein Crash, kein Layout-Bruch.
- **Empfehlung:** SVG-Datei umbenennen zu `Type=Broetchen.svg` (ohne Umlaut) und Referenz in `products.ts` anpassen.

## Was funktioniert

- ✅ 103 Produkte aus HQ werden korrekt angezeigt
- ✅ 7 Kategorien: Brot (25), Baguette (5), Brötchen (15), Teilchen (16), Snacks (8), Kuchen (26), Torten (8)
- ✅ Kategorie-Filter per Chip-Click
- ✅ Produktbilder (SVG) laden korrekt (außer Brötchen-Fallback)
- ✅ Preise korrekt formatiert (deutsches Format: 2,50 €)
- ✅ Responsives Layout (Desktop 5-spaltig, Mobile 2-spaltig)
- ✅ API-Endpoint `/api/products` liefert echte Daten
- ✅ API-Kategorie-Filter (`?category=brot`) funktioniert
- ✅ Navigation zwischen Seiten fehlerfrei
- ✅ Statischer Build erfolgreich (121 Seiten generiert)

## Screenshots

Alle Screenshots in: `test-results/pr-13/round-1/`

1. `01-homepage-loaded.png` — Homepage mit Hero
2. `02-sortiment-section.png` — Sortiment-Sektion mit Chips und Produkten
3. `03-category-chips.png` — Filter-Chips Nahaufnahme
4. `04-product-grid.png` — Produkt-Grid mit Bildern und Preisen
5. `05-filter-brot.png` — Gefilterter Zustand (nur Brot)
6. `06-full-page.png` — Vollständige Homepage
7. `07-mobile-sortiment.png` — Mobile Ansicht (375px)
8. `08-products-page.png` — /products Seite
9. `11-navigation-test.png` — Nach Navigation-Test

## Urteil

**PASS** — Die Kernfunktionalität ist solide. Der 404-Bug ist kosmetisch und betrifft nur das Fallback-Bild einer Kategorie. Sollte in einem Follow-up gefixt werden, blockiert aber nicht den Merge.

---
id: TASK-035
title: Management App - echte Produkte aus HQ anzeigen
slug: management-app-echte-produkte-aus-hq
status: done
priority: 1
tags:
  - mvp
  - management
  - products
created: 2026-03-10
updated: 2026-03-11
---

Die Management App soll dieselben Produkte aus `hq/products/*.md` anzeigen wie die Landing Page — keine Mock-Daten mehr.

## Details

1. Produktliste im Management-Bereich (`apps/bakery-management`) auf echte HQ-Daten umstellen
2. Nutze `lib/products.ts` analog zur Landing Page (loadProducts / getHQProducts)
3. Produktverwaltung: Anzeige mit Name, Kategorie, Preis, Bild
4. Filter nach Kategorie soll funktionieren

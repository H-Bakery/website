# feature-catalog

Die Verkaufsflächen des Kundenshops (`apps/bakery-shop`): Startseite, Katalog,
Produktseite. Import über `@bakery/shop/feature-catalog`.

| Export              | Props             | Route             |
| ------------------- | ----------------- | ----------------- |
| `StorefrontHome`    | –                 | `/`               |
| `CatalogPage`       | –                 | `/products`       |
| `ProductDetailPage` | `{ pid: string }` | `/products/[pid]` |

## Regeln

- **Keine Chrome.** Header und Footer gehören dem App-Layout. Diese Komponenten
  rendern ausschließlich den Seiteninhalt.
- **Nur echte Daten.** Alles kommt über `fetchShopProducts` / `fetchShopProduct`
  aus `@bakery/shared/data-access` von `GET /api/products` (~103 hq-Produkte).
  Der `bakeryAPI`-Mock mit seinen 10 erfundenen Produkten wird hier nirgends
  importiert – er war die Ursache dafür, dass „Bauernbrot“ „Kornbrot 500g“
  öffnete.
- **Keine erfundenen Daten in der UI.** Keine Sterne, keine Bewertungen, keine
  „frisch heute“-Badges. Ein `Saisonal`-Chip erscheint nur bei
  `product.seasonal`, ein Hinweis auf Nichtverfügbarkeit nur bei
  `available: false`. `EnhancedProductCard` aus `@bakery/shared/ui` ist tabu:
  ihre `Math.random()`-Defaults erzeugen Hydration-Fehler.
- **Deutsch.** Jede sichtbare Zeichenkette, auch Fehler- und Leerzustände.
- **Preise sind Bruttopreise.** Formatierung über `formatEuro`; ein Steuerhinweis
  heißt „inkl. MwSt.“, es wird nichts aufgeschlagen.
- **Warenkorb-Ids sind Zahlen.** `toCartProduct()` setzt `numericId` als
  `Product.id`; URLs benutzen dagegen den lesbaren Slug (`/products/kornbrot-500g`).

## Aufbau

- `product-card.tsx` – die Produktkarte (`product-card`, `add-to-cart`).
- `product-image.tsx` – Bild mit Platzhalter. Rund 40 hq-Produkte tragen den
  Müllwert `images/` im Frontmatter; solche Pfade werden gar nicht erst
  angefragt, 404er fallen über `onError` auf denselben Platzhalter.
- `product-grid.tsx` – gemeinsames Raster (2/3/4 Spalten).
- `use-shop-products.ts` – Laden, Fehler, erneuter Versuch.
- `states.tsx`, `product-description.tsx` – Leer-/Fehlerzustand und der
  Mini-Markdown-Renderer für den Produktfließtext.

`CatalogPage` liest `?q=`, `?category=` und `?sort=` aus der URL und schreibt sie
zurück. Die dafür nötige Suspense-Grenze steckt in der Bibliothek selbst, damit
der Build der Route nicht davon abhängt, wie die App sie einbindet.

## Tests

`npx nx test feature-catalog` (Jest). Die E2E-Abdeckung liegt in
`apps/bakery-shop-e2e` und hängt an den `data-testid`-Werten oben.

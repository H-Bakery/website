# Landing page (`apps/bakery-landing`)

Public website, static export to GitHub Pages (xn--bckerei-heusser-0kb.de) on every push to
`main` (`deploy-to-github-pages.yml`). Not part of the pilot box. The same workflow builds the
Digitale Bäckerei and copies it into this export as `out/digitale-baeckerei/`
([digitale-baeckerei.md](./digitale-baeckerei.md#deploy)); the landing app itself must not get a
route of that name. The home page links to it (`components/home/DigitaleBaeckereiTeaser.tsx`, a
plain `<a href="/digitale-baeckerei/">`, not `next/link`) and the sitemap lists it.

- **Build:** `build-static-standalone` → `apps/bakery-landing/out/` (not `dist/`); delete
  `apps/bakery-landing/.next` first - a stale dev cache breaks the export. Details in
  [development.md](../development.md#landing-page-static-export--github-pages).
- **Products** come from `hq/products` (`src/lib/products.ts`, `HQ_PRODUCTS_DIR`) at build time.
  The deploy builds from `hq/products` since 2026-11-13 (DB14, see the Deploy section of
  digitale-baeckerei.md). Without `hq` (CI, other machines) it falls back to the bundled JSON in
  `src/mocks/products/` and logs
  `HQ products directory not found` - check for that log before suspecting a cache when a product
  edit doesn't show up.
  Reading and parsing the files lives once in the lib `@bakery/shared/hq-products`
  (`libs/shared/hq-products`, CommonJS, also used by the Digitale Bäckerei's `sync-products`);
  `products.ts` keeps only the landing mapping (fallback images, category labels, mock fallback).
  A product with `available: false` in hq is not on offer: it is left out of the listing, the
  search, the start page, the related products and the sitemap (`isListedHqProduct`, one rule
  in the lib), but keeps its page for old links - with a notice, no price or order button,
  alternatives from its category, and `noindex`.
- **Product images rendered from the 3D models (DB13):** see [below](#product-images-from-the-3d-models).
- **Navigation and accessibility:** see [below](#navigation-and-accessibility).
- **Öffnungszeiten:** Landing und Shop verwenden das Wochenraster aus
  `libs/bakery-shop/feature-cart/src/lib/pickup.ts`. `openingHours.spec.ts` prüft die Übereinstimmung
  mit der CommonJS-Fassung der API für den Dienstplan. Der Öffnungsstatus der Startseite
  (`src/utils/openingHours.ts`) rechnet in der Zeitzone Europe/Berlin.
  `src/config/holidays.ts` liefert die gesetzlichen Feiertage im Saarland.
  `holidays.spec.ts` prüft sie gegen die Kalenderformel der API. Der Öffnungsstatus bittet
  an Feiertagen um telefonische Rückfrage.
- Shared brand claims (`REVIEW_SUMMARY` etc.) live in `libs/shared/utils/src/lib/brand.ts`; the
  shop's rules for them (nothing invented, snapshot values) are in [shop.md](./shop.md).

## Sortiment (`/products`)

One component holds the whole listing: `components/home/products/index.tsx` (`Products` with
`showCategoryFilter` and `syncUrl`, rendered by `app/products/ProductsPageClient.tsx`). It owns
category, search, sort and page together, so a search inside a category knows whether other
categories would match.

- **Category tiles** (`components/products/Filter.tsx`) are toggle buttons (`aria-pressed`) in a
  group „Kategorie“: reachable with Tab, Enter/Space selects. The value is the label as it stands
  on the product (`Brot`, `Brötchen`, …).
- **Search** (`searchProducts`, `normalizeSearch`): every word must appear in the name or the
  category; case, umlauts and ß don't matter (`broetchen` = `Brötchen`, `weissbrot` = `Weißbrot`),
  hyphens in names don't count (`kirschtorte`). Only if that finds nothing does the bare vowel
  count for the umlaut (`brotchen`, `kase`) - otherwise „Brot“ would bring all Brötchen.
  No hit in the chosen category but hits elsewhere → „In „Brot“ nichts zu „…“ gefunden“ with
  „In allen Kategorien suchen“.
- **Address:** category, search and page are mirrored as `?kategorie=Brot&search=…&seite=2`
  (`history.replaceState`, defaults left out, other parameters kept) and read back once after
  hydration from `window.location` - so browser Back from a product page restores the view and
  `/products?search=…` (the `SearchAction` in `app/layout.tsx`) searches right away. Deliberately
  no `useSearchParams`: in the static export it needs a Suspense boundary whose fallback would
  drop the page-1 cards from the HTML. The HTML therefore always shows page 1 of „Alle“; the
  address applies a moment later.
- **Page change** scrolls the list heading („Alle Produkte“ / the category, count and page) into
  view below the fixed header - smooth only without `prefers-reduced-motion` - and moves the
  focus there. Pagination labels are German („Seite 2“, „Nächste Seite“ …), items at least
  44 px; below `sm` without first/last buttons, neighbours and gaps, so it fits on one line from
  360 px width. A visually
  hidden status line („12 Produkte gefunden“) announces changes; the grid has no `aria-live`.
- **E2E:** `apps/bakery-landing-e2e/src/sortiment.spec.ts` (keyboard, page 2 on the phone,
  `?search=`, Back); data-driven, so it runs against the bundled fallback in CI and the fixture
  locally.

## Navigation and accessibility

- **Header** (`components/header/`): a `<header>` (banner); the links sit in a
  `<nav aria-label="Hauptnavigation">` (one on desktop, one inside the mobile dialog).
  - desktop: Sortiment, Neuigkeiten, Über uns, Kontakt in the middle, Bestellen as CTA. Logo and CTA
    sit in equally wide side slots (`SIDE_SLOT`), so the menu is centred in normal flow and cannot
    overlap them (checked at 900 and 1440 px). The current page gets `aria-current="page"`.
  - mobile: the hamburger (44x44 hit area) opens a MUI `Modal` whose panel is
    `role="dialog" aria-modal aria-label="Hauptmenü"`, with the same links in its own
    „Hauptnavigation“, a phone link (`LEGAL.phoneHref`) and a „Menü schließen“ button. The
    hamburger's X stays visible but is `aria-hidden` while the dialog is open, so the dialog needs
    its own button; Escape and a tap beside the menu close it too.
- **Skip link** „Zum Inhalt springen“ (`app/layout.tsx`): the first focusable element, visible only
  on focus, targets `<main id="inhalt" tabIndex={-1}>`.
- **Featured products carousel** (`components/home/FeaturedProducts.tsx`, WCAG 2.2.2): advances
  every 5 s, but not with `prefers-reduced-motion: reduce`, pauses while hovered or focused, and
  stops for good on pointerdown/touch, sideways scrolling (trackpad, shift + wheel) or any key
  inside it; a vertical wheel that scrolls the page past it does not stop it. A pause/play button next
  to the dots stops or (deliberately) restarts it. The dots are buttons „Produkt N von M“ with
  `aria-current`, 44 px hit area (narrowing to 32 px wide on very small screens).
- **404** (`app/not-found.tsx`): Next 16 reads `metadata` from `not-found.tsx` as the last level
  after the layout, also for the export's `404.html`. It sets its own title and `robots: null`,
  which drops the layout's `index, follow`; Next writes `<meta name="robots" content="noindex">`
  for every 404 itself, so the page carries exactly one `noindex` (asserted by
  `landing-smoke.spec.ts` against the export).

## Product images from the 3D models

The data repo `../produkte-3d` renders one image per product model (`npm run render` there →
`bilder/<id>/haupt-800.webp`, `haupt-400.webp`, `bilder/index.json`; square, transparent, `<id>` =
hq id without the number). The landing page can show them instead of the category illustration.
They are digital illustrations, not photos - the product page says so under the image
(„Digitale Darstellung – kein Foto“).

**Flow.** `scripts/sync-produktbilder.js` runs before every build (`build`,
`build-static-standalone`; `serve` depends on the Nx target `sync-produktbilder`). It reads exactly
the commit named in `apps/bakery-landing/produkte-3d-bilder.lock.json` with `git show` from
`PRODUKTE_3D_DIR` (default `../produkte-3d` next to the repo), checks every file (WebP, the size the
index states, alpha channel, and that `modellSha256` is the model's `sha256` in `manifest.json` of
that commit - a stale render aborts), copies the images to `public/produkte-3d/bilder/` and writes
`apps/bakery-landing/produkte-3d-bilder.json` (both git-ignored). `src/lib/products.ts` reads that
index at build time through `@bakery/shared/produkte-3d` (`libs/shared/produkte-3d`: the contract
of `bilder/index.json`, the checks, the one reader; also home of what the Digitale Bäckerei's
model sync shares - model id, commit pin, `git show`).

- **No data repo, or `"commit": null` in the lock** (CI, other machines): empty index,
  no `public/produkte-3d/`, one info line, exit 0. The export is then the one from before - same
  files, same HTML and RSC payload apart from build hashes. The deploy has the images through the
  export in hq (see "Published" below).
- **Adopt a new state:** commit the renders in `produkte-3d`, put that commit hash into the lock,
  PR. The real images never go into this repo.
- **Fixture:** `LANDING_PRODUKTBILDER_FIXTURE=1` uses the synthetic images in
  `src/test/fixtures/produktbilder/` (two invented shapes for products of `tools/e2e/hq-products`;
  rebuild with `build-fixture.mjs`). CI builds a second export this way and runs
  `apps/bakery-landing-e2e/src/produktbilder.spec.ts` against it (390 px and desktop).

**Which image a product shows** is decided once, in `resolveProductImage()` (`src/lib/products.ts`):

1. a real photo set in hq (`image:` with a raster file) always wins,
2. else the rendered image,
3. else the vector illustration set in hq (`image:` with an `.svg` - most products name their
   category SVG explicitly, so an `.svg` does not count as "explicit photo"),
4. else the category illustration.

The bundled fallback products (`src/mocks/products`, used without `hq`) have no hq id and never get
a rendered image. Where it is shown: product cards (`/products`), the product page (main image,
loaded eagerly, and "related products") and the featured products on the start page - through
`components/products/RenderedImage.tsx` (`<img>` with `srcset` 400w/800w, intrinsic
`width`/`height`, lazy below the fold, `alt` = product name; the frames have fixed heights, so
nothing shifts). `og:image` stays the generic `og-image.jpg`: link previews show a transparent
WebP on black or not at all. The landing page has no dark mode in use (`ThemeContext` is not
mounted), the frames are always the light cream surfaces.

**Published since 2026-11-13** (owner decision DB14): the deploy checks out `hq/products` and the
export `hq/produkte-3d/` before the landing build, so the public landing page is built from the
real hq products (names, texts, prices) and shows the rendered images. `sync-produktbilder` reads
the export with the same checks as the data repo, but only if its `STAND.json` names the commit
pinned in the lock. That commit is a label there, not a content hash: the images carry no checksum,
so whoever can write to `hq/produkte-3d` can change them - the same trust as `hq/products`. How to publish a new state:
[digitale-baeckerei.md](./digitale-baeckerei.md#veröffentlichen-der-produktmodelle-db14).

## Warenkorb und WhatsApp-Vorbestellung

Unter `/bestellen` geht es zum Sortiment und zum Korb. Im Sortiment, in den Suchergebnissen
und auf der Produktseite können Kundinnen und Kunden verfügbare Artikel aus dem hq-Katalog
hinzufügen. Die gebündelte Liste dient als Ansicht, wenn beim Build kein Katalog vorliegt.
Im Korb folgen auf Mengen und optionale Artikelnotizen die Abholung und die Nachrichtenvorschau.
Die Kundschaft schickt den vorbereiteten Text selbst ab. Erst die Bestätigung der Bäckerei
per WhatsApp macht die Vorbestellung fest. [Nachrichtenformat](../domains/vorbestellungen.md#kanal-whatsapp)

- **Katalog und Preis.** Der Korb speichert hq-IDs und Mengen. Name, Preis und Bild kommen aus
  dem aktuellen Build. Ist ein Artikel weggefallen oder aus dem Angebot, muss er vor dem Senden
  entfernt werden. Die Schätzung verwendet `orderTotal` aus dem Vorbestellungskern, der
  zuerst die Zeilensumme rundet. Bei fehlenden Preisen bleibt die Summe offen. Abholort, Kategorien, Höchstmenge
  und Preisanzeige stehen in `src/lib/order/order-config.ts`. Dort lässt sich auch ein
  Bestellschluss für den Folgetag setzen.
- **Abholung.** 14 Tage ab dem heutigen Datum am Laden. Das 30-Minuten-Raster, der Vorlauf am
  selben Tag und die vorgeschlagenen Fristen für ganze Kuchen und Torten kommen aus
  `feature-cart`. Montags, an Feiertagen und an Schließtagen bleibt die Auswahl gesperrt.
  Bei Sonderöffnungszeiten verweist der Korb ans Telefon. Heute zeigt der Korb den frühesten
  verfügbaren Termin, wenn der Vorlauf frühere Uhrzeiten ausschließt. Wird die gewählte
  Abholzeit ungültig, bittet der Korb um eine neue Auswahl.
- **Kalender.** Der Next-Build kann lokal `HQ_KALENDER_FILE` oder
  `config/kalender.yaml` neben dem hq-Produktordner mit dem API-Kalenderloader einlesen.
  Der GitHub-Pages-Build läuft derzeit ohne diese Datei. Er sperrt Ruhetag und Feiertage
  und zeigt „Keine Betriebsferien bekannt“. Das gilt auch lokal bei fehlender oder ungültiger
  Datei. Nach Freigabe durch den Inhaber den Sparse-Checkout um `/config/kalender.yaml`
  erweitern und den Checkout-Prüfschritt für genau diese Datei anpassen. Im Export stehen für Abweichungen nur Datum und Typ
  (geschlossen oder Sonderzeiten). Der Stand der Schließtage ändert sich mit dem nächsten Build.
- **Nachricht.** `buildOrderMessage()` erzeugt die exakte Vorschau und den Text für WhatsApp.
  Das Ziel kommt aus `src/config/contact.ts`. Für GitHub Pages kann die Repository-Variable
  `NEXT_PUBLIC_WHATSAPP_NUMBER` gesetzt werden. Wenn sie leer ist, gilt die Mobilnummer
  aus dem Impressum. Die kodierte URL muss kürzer als 2.000 Zeichen bleiben.
  Der Desktop-QR-Code entsteht lokal mit `qrcode.react`. Textkopie und Telefon stehen als
  Ausweichwege bereit.
- **Speicher.** `heusser-korb-v1` speichert die Artikel sieben Tage ab ihrer letzten Änderung
  und verwirft abgelaufene Artikel auch auf einer offen gebliebenen Seite. Der Abholort
  bleibt gespeichert. Der Name wird mit dem vorausgewählten Häkchen gespeichert.
  Termin, Notizen und Bestellnummer bleiben im laufenden Entwurf. „Angaben vergessen“ löscht
  Korb und gespeicherte Angaben. Ändert ein anderer Tab den gespeicherten Korb, übernimmt
  der offene Tab den neuen Stand und setzt seinen Entwurf zurück. Vor jedem Schreiben wird
  der gespeicherte Stand verglichen. Die Ablaufprüfung
  bereinigt nur einen erneut gelesenen, selbst abgelaufenen Speicherstand. Bei gesperrtem
  Speicher läuft die Sitzung im Browser weiter.
- **Prüfung.** Jest prüft Nachricht, URL-Limit, Abholzeiten, Kalender und Speicherung.
  `whatsapp-vorbestellung.spec.ts` prüft den Ablauf mit dem synthetischen Katalog und Axe.

## Readability and tap targets

- **Secondary text** is `text.secondary` of the light theme, `#6B5D50` - at least 4.5:1 (WCAG AA)
  on white, cream `#FFF3E6` and soft beige `#F5EDE4`. Use the token, never a hex value; macchiato
  `#928168` is only for decorative backgrounds (3.45:1 on cream is too weak for text). The theme
  also carries MUI's German locale `deDE` (Pagination, Rating, Breadcrumbs labels).
- **Footer** (`components/LocalFooter.tsx`, a server component, `<footer>` = landmark
  `contentinfo`): dark brown with opaque text colours (`FOOTER_COLORS`), every link at least 44 px
  high, column titles are paragraphs, not headings. The crest is the static
  `public/assets/images/brand/wappen.svg` (cream fill baked in), loaded lazily as `<img alt="">` -
  inline it was 55 KB of path data in every page. `icons/brand/Wappen.tsx` stays for the hero.
  `src/theme/theme.spec.ts` computes every contrast.
- **Map consent** (`components/home/map/MapConsent.tsx`, two-click solution for OpenStreetMap): its
  `height` is the height of the loaded map (Leaflet needs a fixed one); before consent the notice
  is only _at least_ that high and grows with its content, so on a phone nothing is cut off. The
  frames around it (start page, `/contact`) set no fixed height of their own.
- **Contact rows** on `/contact`: phone, WhatsApp and e-mail are full-row links (`LEGAL` targets).
- e2e `apps/bakery-landing-e2e/src/lesbarkeit.spec.ts` (mobile profile) checks the consent notice
  and the 44 px tap targets.

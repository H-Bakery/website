# Landing page (`apps/bakery-landing`)

Public website, static export to GitHub Pages (xn--bckerei-heusser-0kb.de) on every push to
`main` (`deploy-to-github-pages.yml`). Not part of the pilot box. The same workflow builds the
Digitale Bäckerei and copies it into this export as `out/digitale-baeckerei/`
([digitale-baeckerei.md](./digitale-baeckerei.md#deploy)); the landing app itself must not get a
route of that name.

- **Build:** `build-static-standalone` → `apps/bakery-landing/out/` (not `dist/`); delete
  `apps/bakery-landing/.next` first - a stale dev cache breaks the export. Details in
  [development.md](../development.md#landing-page-static-export--github-pages).
- **Products** come from `hq/products` (`src/lib/products.ts`, `HQ_PRODUCTS_DIR`) at build time.
  Without `hq` (CI, and the deploy: it builds the landing page before it checks out `hq`, on
  purpose - see the Deploy section of digitale-baeckerei.md) it falls back to the bundled JSON in
  `src/mocks/products/` and logs
  `HQ products directory not found` - check for that log before suspecting a cache when a product
  edit doesn't show up.
  Reading and parsing the files lives once in the lib `@bakery/shared/hq-products`
  (`libs/shared/hq-products`, CommonJS, also used by the Digitale Bäckerei's `sync-products`);
  `products.ts` keeps only the landing mapping (fallback images, category labels, mock fallback).
- **Opening hours** have one source, `src/config/openingHours.ts`, mirrored into
  `libs/shared/ui/src/lib/footer/footer-openings.tsx` and the shop's
  `libs/bakery-shop/feature-cart/src/lib/pickup.ts` - change all three together.
- Shared brand claims (`REVIEW_SUMMARY` etc.) live in `libs/shared/utils/src/lib/brand.ts`; the
  shop's rules for them (nothing invented, snapshot values) are in [shop.md](./shop.md).

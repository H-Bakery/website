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
  Without `hq` (CI, and the deploy: it builds the landing page before it checks out `hq`, on
  purpose - see the Deploy section of digitale-baeckerei.md) it falls back to the bundled JSON in
  `src/mocks/products/` and logs
  `HQ products directory not found` - check for that log before suspecting a cache when a product
  edit doesn't show up.
  Reading and parsing the files lives once in the lib `@bakery/shared/hq-products`
  (`libs/shared/hq-products`, CommonJS, also used by the Digitale Bäckerei's `sync-products`);
  `products.ts` keeps only the landing mapping (fallback images, category labels, mock fallback).
- **Product images rendered from the 3D models (DB13):** see [below](#product-images-from-the-3d-models).
- **Opening hours** have one source, `src/config/openingHours.ts`, mirrored into
  `libs/shared/ui/src/lib/footer/footer-openings.tsx` and the shop's
  `libs/bakery-shop/feature-cart/src/lib/pickup.ts` - change all three together.
- Shared brand claims (`REVIEW_SUMMARY` etc.) live in `libs/shared/utils/src/lib/brand.ts`; the
  shop's rules for them (nothing invented, snapshot values) are in [shop.md](./shop.md).

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

- **No data repo, or `"commit": null` in the lock** (CI, the deploy, other machines): empty index,
  no `public/produkte-3d/`, one info line, exit 0. The export is then the one from before - same
  files, same HTML and RSC payload apart from build hashes. **So the published site has no rendered
  images today:** `produkte-3d` has no remote, and the lock names no commit yet.
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

**Publishing them** needs the images where the deploy can read them. Two options, not decided:

- **A private remote for `produkte-3d` plus a second read-only deploy key** (like `HQ_DEPLOY_KEY`;
  the workflow checks out the pinned commit before the landing build and sets `PRODUKTE_3D_DIR`).
  One source for models and images, and the same step would give the Digitale Bäckerei its
  close-up models; the lock and all checks work unchanged. Costs: a second secret and checkout in
  the deploy, the repo's size (models, GLBs, possibly LFS) on every run unless checked out sparsely,
  and DB9 ("local only, never push") has to be lifted.
- **The rendered images in `hq`** (e.g. `hq/products/bilder/`, copied there after a render). No new
  secret - but the deploy builds the landing page _before_ it checks out `hq` and only fetches
  `products/`, so the workflow order and the sparse path change; ≈ 100 products × 2 WebP grow a
  repo that the box clones and Anna edits; and the images sit apart from the models they were
  rendered from, so the `modellSha256` check against the manifest is lost unless the manifest is
  copied too.

import { cache } from 'react'
import type { Metadata } from 'next'

import {
  fetchShopProduct,
  shopCategoryLabel,
  type ShopProduct,
} from '@bakery/shared/data-access'
import { ProductDetailPage } from '@bakery/shop/feature-catalog'

import { shopUrl } from '../../../lib/site'
import {
  JsonLd,
  breadcrumbJsonLd,
  productJsonLd,
} from '../../../lib/structured-data'

/**
 * @fileoverview Produktdetailseite — Serverkomponente.
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-metadata
 *
 * Vorher war diese Route `'use client'`. Das hatte drei Folgen, die alle
 * dieselbe Ursache haben — der Server wusste nichts über das Produkt:
 *
 * 1. **Alle 103 Produktseiten trugen denselben `<title>`.** `generateMetadata`
 *    ist in einer Client-Komponente nicht möglich.
 * 2. **Ein Crawler bekam eine leere Seite.** Der Name stand erst nach dem
 *    `useEffect` im DOM.
 * 3. Kein JSON-LD, also kein `Product`-Knoten für die Suche.
 *
 * Jetzt lädt der Server das Produkt und reicht es der Client-Komponente als
 * `initialProduct` durch. Die bleibt für Menge, Warenkorb und „Passt dazu"
 * zuständig — nur ohne eigenen Ladevorgang, weshalb der Produktname im
 * ausgelieferten HTML steht.
 *
 * ## Fehlend ist nicht dasselbe wie unerreichbar
 *
 * {@link fetchShopProduct} unterscheidet das sauber: `null` heißt „gibt es
 * nicht", ein `throw` heißt „API weg". Diese Route hält den Unterschied durch
 * (siehe {@link loadProduct}) — ein Ausfall der API darf keine 103 Produkte
 * aus dem Index werfen.
 *
 * `notFound()` wird bewusst **nicht** gerufen: der Shop hat keine
 * `not-found.tsx`, Next zeigte also seine englische Standardseite, und die
 * Playwright-Suite prüft auf dem unbekannten Pfad den deutschen Leerzustand
 * (`product-not-found`). Stattdessen liefert die Seite diesen Leerzustand und
 * nimmt sich über `robots: { index: false }` selbst aus dem Index.
 */

/**
 * Pro Anfrage gerechnet, nicht beim Build eingefroren: die Produkte in `hq`
 * ändern sich unabhängig vom Deployment, und ein Build läuft womöglich ohne
 * Zugriff auf die API. Dasselbe tut `sitemap.ts` aus demselben Grund.
 */
export const dynamic = 'force-dynamic'

interface ProductPageProps {
  /** Next 16 liefert die Routen-Parameter als Promise. */
  params: Promise<{ pid: string }>
}

/** Was der Server über das Produkt hinter der URL herausfinden konnte. */
type LoadedProduct =
  | { state: 'found'; product: ShopProduct }
  | { state: 'missing' }
  | { state: 'unavailable' }

/**
 * Lädt das Produkt genau einmal je Anfrage.
 *
 * `generateMetadata` und die Seite selbst laufen beide für dieselbe Anfrage;
 * ohne `cache()` holte jede von beiden die Produktliste einzeln.
 */
const loadProduct = cache(async (pid: string): Promise<LoadedProduct> => {
  try {
    const product = await fetchShopProduct(pid)
    return product ? { state: 'found', product } : { state: 'missing' }
  } catch {
    // Netzwerk- oder HTTP-Fehler. Kein 404, keine Fehlerseite: die
    // Client-Komponente lädt im Browser nach und bietet „Erneut versuchen".
    return { state: 'unavailable' }
  }
})

/** Pfad und absolute URL eines Produkts — beide aus derselben Ableitung. */
function productPath(product: ShopProduct): string {
  return `/products/${encodeURIComponent(product.id)}`
}

/**
 * Die Beschreibung für Suchergebnis und Vorschaukarte.
 *
 * Grundlage ist der Teaser aus dem Frontmatter (`shortDescription`); fehlt er,
 * tritt der Anfang des Fließtextes ein. Beide Felder bleiben getrennt — sie
 * zusammenzuwerfen hat in diesem Repo schon einmal Produkttexte vernichtet.
 */
function metaDescription(product: ShopProduct): string {
  const teaser = product.shortDescription || product.description
  const trimmed =
    teaser.length > 150 ? `${teaser.slice(0, 147).trimEnd()}…` : teaser
  const tail = 'Online vorbestellen und in Homburg abholen.'
  return trimmed ? `${trimmed} ${tail}` : tail
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { pid } = await params
  const loaded = await loadProduct(pid)

  if (loaded.state !== 'found') {
    // Weder eine erfundene Produktseite noch ein Indexeintrag: was hier steht,
    // ist entweder nicht (mehr) da oder gerade nicht abrufbar.
    return {
      title:
        loaded.state === 'missing'
          ? 'Produkt nicht gefunden'
          : 'Produkt wird geladen',
      robots: { index: false, follow: true },
    }
  }

  const product = loaded.product
  const url = shopUrl(productPath(product))
  const description = metaDescription(product)

  return {
    // Das Layout hängt „| Bäckerei Heusser Online-Shop" an (title.template).
    title: product.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      // Next kennt für `type` kein 'product'; 'website' ist die richtige Wahl.
      type: 'website',
      locale: 'de_DE',
      siteName: 'Bäckerei Heusser Online-Shop',
      title: `${product.name} — ${shopCategoryLabel(product.category)}`,
      description,
      url,
      // `images` fehlt absichtlich: `src/app/opengraph-image.tsx` gilt für den
      // ganzen Shop und wird vererbt. Die Produktbilder sind 250×250-SVGs und
      // als Vorschaubild unbrauchbar.
    },
  }
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { pid } = await params
  const loaded = await loadProduct(pid)

  // API nicht erreichbar: nichts behaupten, im Browser nachladen lassen.
  if (loaded.state === 'unavailable') {
    return <ProductDetailPage pid={pid} />
  }

  // Nachgesehen, gibt es nicht — `null` führt direkt in den Leerzustand.
  if (loaded.state === 'missing') {
    return <ProductDetailPage pid={pid} initialProduct={null} />
  }

  const product = loaded.product

  return (
    <>
      {/* Nur Belegtes: kein aggregateRating, keine erfundene Verfügbarkeit —
          siehe lib/structured-data.tsx. */}
      <JsonLd data={productJsonLd(product)} id="ld-product" />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'Startseite', url: '/' },
          { name: 'Alle Produkte', url: '/products' },
          {
            name: shopCategoryLabel(product.category),
            url: `/products?category=${product.category}`,
          },
          { name: product.name, url: productPath(product) },
        ])}
        id="ld-breadcrumb"
      />
      <ProductDetailPage pid={pid} initialProduct={product} />
    </>
  )
}

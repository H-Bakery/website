import type { MetadataRoute } from 'next'
import { fetchShopProducts, SHOP_CATEGORIES } from '@bakery/shared/data-access'
import { shopUrl } from '../lib/site'

/**
 * @fileoverview `sitemap.xml` des Shops (Next.js Metadata Route).
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 *
 * **Kein Wiring nötig.** Next.js bedient `GET /sitemap.xml` allein durch die
 * Existenz dieser Datei; `robots.ts` verweist bereits darauf.
 *
 * Enthalten sind Startseite, Katalog, die sieben Kategoriefilter und je eine
 * URL pro Produkt aus `hq` (aktuell 103). Warenkorb, Kasse und
 * Bestellbestätigung fehlen absichtlich — dieselbe Auswahl, die `robots.ts`
 * sperrt.
 *
 * Produkte kommen über `fetchShopProducts()` aus derselben Datenschicht, aus
 * der auch Katalog und Detailseite lesen. Eine zweite Produktquelle hier hätte
 * genau den Split-Brain-Fehler wiederholt, den `apps/bakery-shop/CLAUDE.md`
 * beschreibt.
 *
 * **Fällt die API aus, wird nichts geworfen.** Der Katalogteil entfällt dann,
 * die statischen Routen bleiben. Eine Sitemap ohne Produkte ist unvollständig;
 * ein Build- oder Request-Fehler wäre schlimmer.
 */

/**
 * Die Sitemap wird pro Anfrage gerechnet, nicht beim Build eingefroren.
 *
 * Zwei Gründe: die Produktliste in `hq` ändert sich unabhängig vom Deployment,
 * und ein Build läuft womöglich ohne Zugriff auf die API — dann stünde sonst
 * dauerhaft eine Sitemap ohne Produkte im Netz.
 */
export const dynamic = 'force-dynamic'

/**
 * `lastModified` fehlt bewusst: die Content-API liefert keine Zeitstempel
 * (`toCartProduct` lässt `createdAt`/`updatedAt` aus demselben Grund leer).
 * Ein `new Date()` pro Eintrag wäre eine erfundene Frischeangabe — Crawler
 * entwerten eine Sitemap, deren Datum sich bei jedem Abruf ändert.
 *
 * `changeFrequency` und `priority` sind ausdrücklich Hinweise, keine Aussagen
 * über den Inhalt, und bleiben daher drin.
 */
function staticRoutes(): MetadataRoute.Sitemap {
  return [
    {
      url: shopUrl('/'),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: shopUrl('/products'),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...SHOP_CATEGORIES.map((category) => ({
      url: shopUrl(`/products?category=${encodeURIComponent(category.key)}`),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
  ]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = staticRoutes()

  try {
    const products = await fetchShopProducts()
    for (const product of products) {
      routes.push({
        // Produktkarten verlinken über den Slug; die Sitemap nennt dieselbe
        // Form, damit Crawler nicht zwei URLs für dasselbe Produkt finden.
        url: shopUrl(`/products/${encodeURIComponent(product.id)}`),
        changeFrequency: 'weekly',
        // Nicht verfügbare Produkte bleiben in der Sitemap — die Seite gibt es,
        // sie sagt nur „Zur Zeit nicht verfügbar“. Sie ist nur weniger wichtig.
        priority: product.available ? 0.8 : 0.4,
      })
    }
  } catch {
    // Kein Rethrow: `sitemap.xml` darf nie 500 liefern, nur kürzer ausfallen.
    // Absichtlich still — ein Crawler-Abruf ist kein Anlass für Log-Rauschen.
  }

  return routes
}

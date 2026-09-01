import type { MetadataRoute } from 'next'
import { shopBaseUrl, shopUrl } from '../lib/site'

/**
 * @fileoverview `robots.txt` des Shops (Next.js Metadata Route).
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 *
 * **Kein Wiring nötig.** Next.js bedient allein durch die Existenz dieser Datei
 * `GET /robots.txt`. `layout.tsx` muss dafür nicht angefasst werden.
 *
 * Freigegeben ist alles, was ein Suchergebnis sein soll: Startseite, Katalog
 * und die 103 Produktseiten. Gesperrt ist die Transaktionsstrecke —
 * Warenkorb, Kasse, Bestellbestätigung. Die trägt keinen eigenen Inhalt,
 * existiert pro Besucher in anderer Form und würde als Suchergebnis nur
 * Crawl-Budget kosten. `/bestellung/<id>` gehört zusätzlich niemandem außer
 * dem Besteller.
 *
 * `robots.txt` ist keine Zugriffssperre, sondern eine Bitte an Crawler. Es
 * steht deshalb bewusst nichts Vertrauliches in einer der gesperrten URLs.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/products'],
        disallow: [
          '/cart',
          '/kasse',
          // Slash am Ende: sperrt den ganzen Zweig `/bestellung/<id>`.
          '/bestellung/',
          // 308-Weiterleitung auf `/kasse` — dieselbe Seite, gleiche Sperre.
          '/bestellen',
        ],
      },
    ],
    sitemap: shopUrl('/sitemap.xml'),
    host: shopBaseUrl(),
  }
}

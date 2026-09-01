import * as React from 'react'
import { OPENING_HOURS_ROWS } from '@bakery/shop/feature-cart'
import { shopCategoryLabel, type ShopProduct } from '@bakery/shared/data-access'
import { BRAND_FACTS } from '@bakery/shared/utils'
import { landingUrl, shopBaseUrl, shopUrl } from './site'

/**
 * @fileoverview JSON-LD (schema.org) für den Shop.
 * @module apps/bakery-shop/lib/structured-data
 *
 * Strukturierte Daten sagen einer Suchmaschine, *was* eine Seite ist, statt sie
 * raten zu lassen. Sie sind zugleich der Ort, an dem sich am billigsten lügen
 * lässt — und an dem eine Lüge am teuersten wird: erfundene Bewertungssterne im
 * Markup sind in Deutschland unlauter (§ 5b Abs. 3 UWG) und bei Google ein
 * klassischer Grund für eine manuelle Maßnahme gegen die ganze Domain.
 *
 * Deshalb gilt hier dieselbe Regel wie auf der Startseite: **es steht nur drin,
 * was belegt ist.**
 *
 * - {@link productJsonLd} gibt bewusst **kein** `aggregateRating` und **keine**
 *   `review` aus. Pro Produkt gibt es keine Bewertungsdaten; die 4,5 ★ aus
 *   `REVIEW_SUMMARY` sind ein Wert für den *Betrieb*, nicht für ein Brötchen.
 * - {@link bakeryJsonLd} leitet die Öffnungszeiten aus `OPENING_HOURS_ROWS` ab
 *   und schreibt sie nicht ab (siehe dort).
 * - Es wird kein `priceValidUntil`, keine `deliveryTime` und keine
 *   Verfügbarkeitszahl erfunden — diese Daten existieren schlicht nicht.
 *
 * Alle Bausteine sind reine Funktionen ohne Seiteneffekte und laufen in
 * Server- wie Client-Komponenten.
 */

/* -------------------------------------------------------------------------- */
/* Typen                                                                       */
/* -------------------------------------------------------------------------- */

/** Ein JSON-LD-Objekt. Rekursiv, damit verschachtelte Knoten typisiert bleiben. */
export interface JsonLdObject {
  readonly [key: string]: JsonLdValue
}

/** Alles, was in JSON-LD als Wert vorkommen darf — kein `any`, kein `unknown`. */
export type JsonLdValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<JsonLdValue>
  | JsonLdObject

/** Eine Station im Brotkrümelpfad. */
export interface BreadcrumbTrailItem {
  /** Beschriftung, wie sie der Besucher sieht, z. B. `'Brot'`. */
  name: string
  /**
   * Pfad (`'/products?category=brot'`) oder fertige absolute URL.
   * Relative Angaben werden über {@link shopUrl} absolut gemacht.
   */
  url: string
}

const SCHEMA_CONTEXT = 'https://schema.org'

/** Der Betrieb heißt überall gleich; ein Tippfehler hier spaltet die Entität. */
const BAKERY_NAME = 'Bäckerei Heusser'

/**
 * Stabile Knoten-ID der Bäckerei. Produktangebote verweisen als `seller`
 * darauf, statt den Betrieb ein zweites Mal zu beschreiben.
 */
function bakeryNodeId(): string {
  return `${shopBaseUrl()}/#bakery`
}

/* -------------------------------------------------------------------------- */
/* Öffnungszeiten                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Deutsche Wochentage — lang wie kurz — auf die englischen schema.org-Namen.
 *
 * Das ist eine **Übersetzungstabelle, keine zweite Öffnungszeiten-Tabelle**:
 * die Zeiten selbst kommen ausschließlich aus `OPENING_HOURS_ROWS`.
 */
const SCHEMA_DAY_BY_GERMAN: Readonly<Record<string, string>> = {
  Sonntag: 'Sunday',
  So: 'Sunday',
  Montag: 'Monday',
  Mo: 'Monday',
  Dienstag: 'Tuesday',
  Di: 'Tuesday',
  Mittwoch: 'Wednesday',
  Mi: 'Wednesday',
  Donnerstag: 'Thursday',
  Do: 'Thursday',
  Freitag: 'Friday',
  Fr: 'Friday',
  Samstag: 'Saturday',
  Sa: 'Saturday',
}

/** Wochenreihenfolge wie `Date#getDay()`, für das Auflösen von Spannen. */
const WEEK_ORDER: ReadonlyArray<string> = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

/** Halbgeviert-, Geviert- oder einfacher Strich zwischen zwei Angaben. */
const RANGE_SEPARATOR = /\s*[–—-]\s*/

/** `'05:30 – 13:30 Uhr'` → Öffnen/Schließen. `'Ruhetag'` ergibt `null`. */
const HOURS_PATTERN = /(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})/

/**
 * Löst `'Di – Fr'` zu `['Tuesday', …, 'Friday']` und `'Samstag'` zu
 * `['Saturday']` auf. Unbekannte Beschriftungen ergeben eine leere Liste,
 * damit ein künftiger Umbau der Anzeige hier nichts Falsches behauptet.
 */
function daysOfRow(label: string): string[] {
  const parts = label.split(RANGE_SEPARATOR).filter((part) => part.length > 0)

  if (parts.length === 1) {
    const single = SCHEMA_DAY_BY_GERMAN[parts[0]]
    return single ? [single] : []
  }
  if (parts.length !== 2) return []

  const from = SCHEMA_DAY_BY_GERMAN[parts[0]]
  const to = SCHEMA_DAY_BY_GERMAN[parts[1]]
  if (!from || !to) return []

  const start = WEEK_ORDER.indexOf(from)
  const end = WEEK_ORDER.indexOf(to)
  const days: string[] = []

  // Höchstens sieben Schritte, damit eine über den Sonntag laufende Spanne
  // (z. B. 'Sa – Mo') terminiert statt endlos zu kreisen.
  for (let step = 0; step < WEEK_ORDER.length; step += 1) {
    const index = (start + step) % WEEK_ORDER.length
    days.push(WEEK_ORDER[index])
    if (index === end) break
  }
  return days
}

/**
 * Die Öffnungszeiten als `OpeningHoursSpecification[]`, **abgeleitet** aus
 * `OPENING_HOURS_ROWS`.
 *
 * `OPENING_HOURS_ROWS` wird seinerseits aus `WEEKDAY_HOURS` in
 * `libs/bakery-shop/feature-cart/src/lib/pickup.ts` gerechnet — derselben
 * Tabelle, aus der die Kasse ihre Abholzeiten baut. Es ist die einzige Form der
 * Öffnungszeiten, die das Lib nach außen gibt (`WEEKDAY_HOURS` selbst ist
 * modulprivat, und ein relativer Deep-Import in ein anderes Nx-Lib ist
 * verboten). Eine zweite Zeitentabelle im Shop ist laut
 * `apps/bakery-shop/CLAUDE.md` ausdrücklich untersagt.
 *
 * Folge: **Montag taucht nicht auf.** Die Zeile trägt `'Ruhetag'` statt einer
 * Uhrzeit, {@link HOURS_PATTERN} greift nicht, die Zeile entfällt. Ein
 * geschlossener Tag wird gar nicht ausgewiesen — ein
 * `opens: '00:00', closes: '00:00'` ist die häufige, aber schlechtere Variante,
 * weil manche Auswerter daraus „durchgehend geöffnet“ lesen.
 *
 * @returns eine Spezifikation je Anzeigezeile mit Uhrzeit, mit
 * `dayOfWeek` als Liste (schema.org erlaubt mehrere Tage pro Eintrag).
 */
export function openingHoursJsonLd(): JsonLdObject[] {
  const specs: JsonLdObject[] = []

  for (const row of OPENING_HOURS_ROWS) {
    const hours = HOURS_PATTERN.exec(row.time)
    if (!hours) continue // Ruhetag oder unerwartetes Format

    const days = daysOfRow(row.days)
    if (days.length === 0) continue

    specs.push({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: days.map((day) => `${SCHEMA_CONTEXT}/${day}`),
      opens: hours[1],
      closes: hours[2],
    })
  }

  return specs
}

/* -------------------------------------------------------------------------- */
/* Der Betrieb                                                                 */
/* -------------------------------------------------------------------------- */

/** `'06841 2229'` → `'+49 6841 2229'`; abgeleitet aus {@link BRAND_FACTS}. */
function internationalPhone(): string {
  return BRAND_FACTS.phone.replace(/^0/, '+49 ')
}

/**
 * Die Bäckerei als schema.org-`Bakery`.
 *
 * Gedacht für **genau eine** Einbindung, im `layout.tsx`, damit jede Seite des
 * Shops denselben Betriebsknoten trägt.
 *
 * Enthalten ist nur Belegtes: Name, Anschrift und Telefon aus `BRAND_FACTS`
 * (`libs/shared/utils/src/lib/brand.ts`, jede Angabe mit Quelle), das
 * Gründungsjahr von dort, die abgeleiteten Öffnungszeiten und ein `sameAs` auf
 * die Hauptseite der Bäckerei, damit Suchmaschinen Shop und Website als
 * denselben Betrieb führen.
 *
 * Bewusst **nicht** enthalten: `priceRange` (nie erhoben), `geo` (keine
 * geprüften Koordinaten), `aggregateRating` (siehe Modul-Kommentar),
 * `paymentAccepted` (welche Karten akzeptiert werden, wissen wir nicht — nur
 * dass im Laden bezahlt wird).
 */
export function bakeryJsonLd(): JsonLdObject {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Bakery',
    '@id': bakeryNodeId(),
    name: BAKERY_NAME,
    url: shopUrl('/'),
    sameAs: [landingUrl()],
    telephone: internationalPhone(),
    foundingDate: String(BRAND_FACTS.foundedYear),
    currenciesAccepted: 'EUR',
    address: {
      '@type': 'PostalAddress',
      streetAddress: BRAND_FACTS.street,
      postalCode: BRAND_FACTS.postalCode,
      addressLocality: BRAND_FACTS.city,
      addressRegion: 'Saarland',
      addressCountry: 'DE',
    },
    openingHoursSpecification: openingHoursJsonLd(),
  }
}

/* -------------------------------------------------------------------------- */
/* Produkte                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Nur absolute Pfade mit Bild-Endung sind brauchbar.
 *
 * Rund 40 der 103 `hq`-Produkte tragen im Frontmatter den Müllwert `images/`.
 * Dieselbe Prüfung steht in `isUsableProductImage`
 * (`feature-catalog/src/lib/product-image.tsx`) — sie lässt sich hier leider
 * nicht wiederverwenden, weil jenes Modul `'use client'` trägt und ein
 * Serverbaustein daraus nur eine Client-Referenz bekäme. Ändert sich die eine
 * Regel, gehört die andere mitgezogen.
 */
const USABLE_IMAGE_PATH = /^\/\S+\.(svg|jpg|jpeg|png|webp|avif)$/i

/** Ein Produkt als schema.org-`Product` samt `Offer`. */
export function productJsonLd(product: ShopProduct): JsonLdObject {
  const path = `/products/${encodeURIComponent(product.id)}`
  const url = shopUrl(path)

  const node: {
    [key: string]: JsonLdValue
  } = {
    '@context': SCHEMA_CONTEXT,
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.name,
    // Der lange Fließtext beschreibt das Produkt; der Teaser ist die Notlösung.
    // Beide Felder bleiben getrennt — sie zusammenzuwerfen hat schon einmal
    // Produkttexte vernichtet (siehe apps/bakery-shop/CLAUDE.md).
    description: product.description || product.shortDescription,
    sku: product.id,
    category: shopCategoryLabel(product.category),
    url,
    brand: {
      '@type': 'Brand',
      name: BAKERY_NAME,
    },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'EUR',
      // Preise in `hq` sind Bruttopreise (inkl. MwSt.). schema.org erwartet den
      // Preis als Zeichenkette mit Punkt als Dezimaltrenner — nicht deutsch
      // formatiert, das ist Maschinenlesbarkeit, keine Anzeige.
      price: product.price.toFixed(2),
      availability: product.available
        ? `${SCHEMA_CONTEXT}/InStock`
        : `${SCHEMA_CONTEXT}/OutOfStock`,
      itemCondition: `${SCHEMA_CONTEXT}/NewCondition`,
      // Es gibt keinen Versand: abgeholt und im Laden bezahlt wird.
      availableDeliveryMethod: `${SCHEMA_CONTEXT}/OnSitePickup`,
      seller: {
        '@type': 'Bakery',
        '@id': bakeryNodeId(),
        name: BAKERY_NAME,
      },
    },
  }

  // Nur setzen, wenn es sie gibt — ein leeres oder falsches Feld ist schlechter
  // als ein fehlendes.
  if (product.numericId > 0) {
    node['productID'] = String(product.numericId)
  }
  const image = product.image?.trim() ?? ''
  if (USABLE_IMAGE_PATH.test(image)) {
    node['image'] = shopUrl(image)
  }

  return node
}

/* -------------------------------------------------------------------------- */
/* Brotkrümelpfad                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Ein Brotkrümelpfad als schema.org-`BreadcrumbList`.
 *
 * @param trail Stationen in Leserichtung, die aktuelle Seite zuletzt.
 * Eine leere Liste ergibt eine leere `itemListElement` — der Aufrufer soll den
 * Baustein dann gar nicht erst einbinden.
 *
 * @example
 * breadcrumbJsonLd([
 *   { name: 'Startseite', url: '/' },
 *   { name: 'Brot', url: '/products?category=brot' },
 *   { name: 'Kornbrot 500g', url: '/products/kornbrot-500g' },
 * ])
 */
export function breadcrumbJsonLd(
  trail: ReadonlyArray<BreadcrumbTrailItem>
): JsonLdObject {
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      item: /^https?:\/\//i.test(entry.url) ? entry.url : shopUrl(entry.url),
    })),
  }
}

/* -------------------------------------------------------------------------- */
/* Ausgabe                                                                     */
/* -------------------------------------------------------------------------- */

const HTML_UNSAFE = /[<>&\u2028\u2029]/g

const JSON_ESCAPES: Readonly<Record<string, string>> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
}

/**
 * Serialisiert JSON-LD so, dass es in einem `<script>`-Block nicht ausbrechen
 * kann.
 *
 * `JSON.stringify` allein genügt nicht: ein Produkttext, der `</script>`
 * enthält, würde den Block beenden und den Rest als Markup ausliefern — der
 * klassische Weg zu einer XSS-Lücke über Inhaltsdaten. `<`, `>` und `&` werden
 * deshalb als Unicode-Escapes geschrieben (im JSON identischer Wert), dazu die
 * beiden Zeilentrenner U+2028/U+2029, die in JavaScript ungültig wären.
 */
export function serializeJsonLd(
  data: JsonLdObject | ReadonlyArray<JsonLdObject>
): string {
  return JSON.stringify(data).replace(
    HTML_UNSAFE,
    (character) => JSON_ESCAPES[character]
  )
}

export interface JsonLdProps {
  /** Ein Knoten oder mehrere; mehrere werden als JSON-Array ausgegeben. */
  data: JsonLdObject | ReadonlyArray<JsonLdObject>
  /** Optionale `id` des Script-Tags, praktisch für Tests und Debugging. */
  id?: string
}

/**
 * Gibt JSON-LD als `<script type="application/ld+json">` aus.
 *
 * Läuft in Server- wie Client-Komponenten und rendert nichts Sichtbares.
 *
 * @example
 * // in apps/bakery-shop/src/app/layout.tsx, innerhalb von <body>:
 * <JsonLd data={bakeryJsonLd()} id="ld-bakery" />
 */
export function JsonLd({ data, id }: JsonLdProps): React.JSX.Element {
  return (
    <script
      id={id}
      type="application/ld+json"
      // Der Inhalt stammt aus serializeJsonLd, das genau dafür escaped.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  )
}

/**
 * @fileoverview Vorbestellfrist je Produkt.
 * @module @bakery/shop/feature-cart/lead-time
 *
 * Eine Schwarzwälder-Kirsch-Torte für 45 € wurde bisher behandelt wie ein
 * Brötchen: bestellbar zur Abholung in 60 Minuten. Das kann keine Backstube
 * leisten — die Bestellung wäre angenommen und nicht erfüllbar.
 *
 * Ganze Torten und ganze Kuchen werden auf Bestellung gebacken, einzelne
 * Stücke liegen in der Theke. Der Unterschied steckt zuverlässig in der ID:
 * Portionsartikel heißen `…-1-stueck` bzw. `…-1-4-stueck`, ganze Artikel nicht.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ACHTUNG — die Stundenwerte unten sind ein **Vorschlag**, keine erhobene
 * Angabe der Bäckerei. Der Mechanismus ist richtig, die Zahlen müssen von der
 * Backstube bestätigt werden. Sie stehen deshalb genau hier, in einer Tabelle,
 * und nirgends sonst im Code.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Das Minimum, das ein Artikel zur Bestimmung seiner Frist mitbringen muss. */
export interface LeadTimeProduct {
  /** Slug-ID, z. B. `'schwarzwaelder-kirsch-torte'`. */
  id: string
  /** Kategorie-Schlüssel, z. B. `'torten'`. */
  category?: string
}

/** Eine Vorlaufregel mit der Begründung, die im Shop angezeigt wird. */
export interface LeadTimeRule {
  hours: number
  /** Kurzer deutscher Satz für die Kasse. */
  reason: string
}

/**
 * Artikel, die in der Theke liegen, brauchen keinen Vorlauf über die
 * allgemeine Vorlaufzeit (`PICKUP_LEAD_MINUTES`) hinaus.
 */
const NO_LEAD: LeadTimeRule = { hours: 0, reason: '' }

/**
 * Vorlauf je Kategorie für **ganze** Artikel.
 * Portionsstücke derselben Kategorie sind davon ausgenommen.
 */
const WHOLE_ITEM_RULES: Readonly<Record<string, LeadTimeRule>> = {
  torten: {
    hours: 48,
    reason: 'Ganze Torten backen wir auf Bestellung — bitte zwei Tage vorher.',
  },
  kuchen: {
    hours: 24,
    reason: 'Ganze Kuchen backen wir auf Bestellung — bitte einen Tag vorher.',
  },
}

/**
 * Erkennt Portionsartikel an der ID (`…-1-stueck`, `…-1-4-stueck`).
 *
 * Bewusst über die ID und nicht über den Preis: eine Preisschwelle würde bei
 * der nächsten Preisänderung still kippen.
 */
export function isPortion(product: LeadTimeProduct): boolean {
  return /-\d+(-\d+)?-stueck$/.test(product.id)
}

/** Die Vorlaufregel für ein einzelnes Produkt. */
export function leadTimeRuleFor(product: LeadTimeProduct): LeadTimeRule {
  if (!product || typeof product.id !== 'string') return NO_LEAD
  if (isPortion(product)) return NO_LEAD
  const category = typeof product.category === 'string' ? product.category : ''
  return WHOLE_ITEM_RULES[category] ?? NO_LEAD
}

/**
 * Die bindende Regel für einen ganzen Warenkorb: der längste Vorlauf gewinnt.
 * Ein Brötchen neben einer Torte macht die Torte nicht schneller.
 *
 * @returns die strengste Regel, oder {@link NO_LEAD} wenn nichts vorbestellt
 * werden muss.
 */
export function leadTimeRuleForItems(
  items: ReadonlyArray<LeadTimeProduct>
): LeadTimeRule {
  let strictest = NO_LEAD
  for (const item of items ?? []) {
    const rule = leadTimeRuleFor(item)
    if (rule.hours > strictest.hours) strictest = rule
  }
  return strictest
}

/**
 * Frühestes Abholdatum (ISO `YYYY-MM-DD`) für einen Warenkorb.
 *
 * Rechnet in ganzen Tagen aufwärts: wer heute um 15:00 Uhr eine Torte mit
 * 48 Stunden Vorlauf bestellt, bekommt übermorgen — nicht „in 48 Stunden“ auf
 * die Minute. Das ist die Lesart, die eine Backstube tatsächlich verwendet,
 * und sie ist für die Kundschaft die verständlichere.
 */
export function earliestPickupIsoDate(
  items: ReadonlyArray<LeadTimeProduct>,
  now: Date
): string {
  const rule = leadTimeRuleForItems(items)
  const days = Math.ceil(rule.hours / 24)
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Produktsuche der Vorbestell-Erfassung (P1): unscharf nach Namen, damit
 * „brotchen“, „zopf nuss“ oder „kornbr“ am Telefon sofort treffen.
 *
 * Reine Funktionen, keine API. Rangfolge je Suchwort: Namensanfang <
 * Wortanfang < Teilstring < Buchstabenfolge (alle Buchstaben in Reihenfolge,
 * Lücken erlaubt). Jedes Wort der Suche muss treffen.
 */

export interface SearchableProduct {
  productId: string
  name: string
}

/** Kleinbuchstaben, Umlaute ausgeschrieben, Satzzeichen als Leerzeichen. */
export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0
  for (const ch of haystack) {
    if (ch === needle[i]) i += 1
    if (i === needle.length) return true
  }
  return needle.length === 0
}

/** Rang eines Suchworts in einem normalisierten Namen; `null` = kein Treffer. */
function tokenRank(token: string, name: string): number | null {
  if (name.startsWith(token)) return 0
  if (name.split(' ').some((word) => word.startsWith(token))) return 1
  if (name.includes(token)) return 2
  // Buchstabenfolge erst ab drei Zeichen - sonst trifft „ab“ fast alles.
  if (token.length >= 3 && isSubsequence(token, name.replace(/ /g, ''))) {
    return 4
  }
  return null
}

/** Gesamtrang eines Produkts; `null` = passt nicht. Kleiner ist besser. */
export function matchRank(name: string, query: string): number | null {
  const tokens = normalizeSearch(query).split(' ').filter(Boolean)
  if (tokens.length === 0) return null
  const normalized = normalizeSearch(name)
  let rank = 0
  for (const token of tokens) {
    const r = tokenRank(token, normalized)
    if (r === null) return null
    rank += r
  }
  return rank
}

/** Treffer, beste zuerst; bei Gleichstand kürzerer Name, dann alphabetisch. */
export function searchProducts<T extends SearchableProduct>(
  products: T[],
  query: string,
  limit = 8
): T[] {
  return products
    .map((product) => ({ product, rank: matchRank(product.name, query) }))
    .filter((hit): hit is { product: T; rank: number } => hit.rank !== null)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.product.name.length - b.product.name.length ||
        a.product.name.localeCompare(b.product.name, 'de')
    )
    .slice(0, limit)
    .map((hit) => hit.product)
}

/**
 * Häufig vorbestellte Produkte: in wie vielen Vorbestellungen ein Produkt
 * vorkommt (stornierte zählen nicht), meiste zuerst. Nur Produkte, die es im
 * Sortiment gibt.
 */
export function frequentProducts<T extends SearchableProduct>(
  preorders: Array<{ status?: string; items: Array<{ productId: string }> }>,
  products: T[],
  limit = 8
): T[] {
  const counts = new Map<string, number>()
  for (const preorder of preorders) {
    if (preorder.status === 'storniert') continue
    const seen = new Set<string>()
    for (const item of preorder.items) {
      if (seen.has(item.productId)) continue
      seen.add(item.productId)
      counts.set(item.productId, (counts.get(item.productId) ?? 0) + 1)
    }
  }
  const byId = new Map(products.map((p) => [p.productId, p]))
  return Array.from(counts.entries())
    .filter(([id]) => byId.has(id))
    .sort(
      (a, b) =>
        b[1] - a[1] ||
        (byId.get(a[0]) as T).name.localeCompare((byId.get(b[0]) as T).name)
    )
    .slice(0, limit)
    .map(([id]) => byId.get(id) as T)
}

/**
 * Schnellknöpfe: zuletzt auf diesem Gerät erfasste Produkte zuerst, dann die
 * häufigsten - ohne Doppelte.
 */
export function quickProducts<T extends SearchableProduct>(
  recentIds: string[],
  frequent: T[],
  products: T[],
  limit = 8
): T[] {
  const byId = new Map(products.map((p) => [p.productId, p]))
  const out: T[] = []
  const seen = new Set<string>()
  for (const product of [
    ...recentIds.map((id) => byId.get(id)).filter((p): p is T => !!p),
    ...frequent,
  ]) {
    if (seen.has(product.productId)) continue
    seen.add(product.productId)
    out.push(product)
    if (out.length >= limit) break
  }
  return out
}

/* ------------------------------------------------------------------ *
 * „Zuletzt verwendet“ je Gerät (localStorage, nur Bequemlichkeit)
 * ------------------------------------------------------------------ */

export const RECENT_PRODUCTS_KEY = 'bakery-management-preorder-recent'
const RECENT_MAX = 8

export function readRecentProducts(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_PRODUCTS_KEY)
    const list = raw ? JSON.parse(raw) : []
    return Array.isArray(list)
      ? list.filter((id): id is string => typeof id === 'string')
      : []
  } catch {
    return []
  }
}

/** Merkt sich die Produkte einer gespeicherten Bestellung (neueste vorn). */
export function rememberRecentProducts(productIds: string[]): void {
  try {
    const next = [
      ...productIds,
      ...readRecentProducts().filter((id) => !productIds.includes(id)),
    ]
      .filter((id, i, all) => all.indexOf(id) === i)
      .slice(0, RECENT_MAX)
    window.localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(next))
  } catch {
    // privates Fenster, gesperrter Speicher - die Knöpfe sind nur Bequemlichkeit
  }
}

/**
 * @fileoverview Allergene: Schlüssel, deutsche Bezeichnungen, Hinweistexte.
 * @module @bakery/shared/utils/allergens
 *
 * Die Daten dazu stehen im Frontmatter von `hq/products/*.md` und werden von
 * `website/tools/allergens/derive-allergens.mjs` aus den echten Rezepten der
 * Backstube abgeleitet:
 *
 * ```yaml
 * allergens: [gluten, weizen]
 * allergens_source: rezept        # 'rezept' = aus dem Rezept | 'geprueft' = von der Bäckerei bestätigt
 * allergen_recipe: Kornbrot
 * ```
 *
 * **Die Regel, an der sich hier alles ausrichtet: nur positive Aussagen.**
 * Es gibt in diesem Modul keinen Text und keine Funktion, die Abwesenheit
 * behauptet — kein "frei von", kein "glutenfrei", kein "laktosefrei". Ein
 * falsches "enthält" ärgert jemanden. Ein falsches "enthält nicht" bringt
 * jemanden ins Krankenhaus. Ein Test in `allergens.spec.ts` hält das fest.
 *
 * Daraus folgen zwei Eigenheiten, die auf den ersten Blick unbequem wirken:
 *
 * - **Kein Eintrag ist etwas anderes als eine leere Liste.** 51 der 103
 *   Produkte haben kein Rezept in `hq` und deshalb *keine* der drei Keys.
 *   {@link readAllergenDeclaration} gibt dafür `null` zurück, nie ein leeres
 *   Array — sonst stünde am Kuchen "Allergene: keine".
 * - **{@link formatAllergens} wirft nichts weg.** Kommt ein Schlüssel an, den
 *   dieses Modul noch nicht kennt (weil `hq` schneller ist als der Code), wird
 *   er trotzdem angezeigt. Ein stillschweigend verschluckter Schlüssel wäre
 *   genau die Falschaussage, die hier nicht passieren darf.
 *
 * Rechtlicher Rahmen: Anhang II LMIV (VO (EU) Nr. 1169/2011) für die Liste der
 * Allergene, § 4 LMIDV für unverpackte Ware — dort genügt eine mündliche
 * Auskunft, solange sie auf Nachfrage verfügbar ist. Genau das sagt
 * {@link NO_DECLARATION_NOTE} zu.
 */

import { BRAND_FACTS } from './brand'

/**
 * Die Allergene, die aus den Rezepten der Bäckerei ableitbar sind.
 *
 * Dieselbe Liste steht in `tools/allergens/derive-allergens.mjs` als
 * `ALLERGEN_KEYS`; das Skript bricht ab, wenn die Zutaten-Datenbank ein
 * Allergen nennt, das hier fehlt. Wer einen Schlüssel ergänzt, ergänzt beide
 * Dateien und {@link ALLERGEN_LABELS}.
 *
 * Getreide steht doppelt drin: `gluten` als Oberbegriff und dazu das Getreide
 * selbst. Anhang II Nr. 1 LMIV nennt die Getreidearten ausdrücklich, und
 * "Gluten" allein hilft niemandem, der nur Weizen nicht verträgt.
 */
export type AllergenKey =
  | 'gluten'
  | 'weizen'
  | 'roggen'
  | 'gerste'
  | 'hafer'
  | 'dinkel'
  | 'ei'
  | 'milch'
  | 'sesam'
  | 'mandel'
  | 'haselnuss'
  | 'walnuss'
  | 'cashew'

/**
 * Alle Schlüssel in Anzeigereihenfolge: erst das Getreide (Gluten als
 * Oberbegriff voran), dann Ei und Milch, dann Sesam und die Schalenfrüchte.
 *
 * Im Frontmatter stehen sie alphabetisch — das ist nur die Speicherform.
 * Für die Anzeige sortiert {@link formatAllergens} nach dieser Reihenfolge.
 */
export const ALLERGEN_KEYS: readonly AllergenKey[] = [
  'gluten',
  'weizen',
  'roggen',
  'gerste',
  'hafer',
  'dinkel',
  'ei',
  'milch',
  'sesam',
  'mandel',
  'haselnuss',
  'walnuss',
  'cashew',
]

/**
 * Deutsche Bezeichnung je Schlüssel, in der Wortwahl von Anhang II LMIV:
 * die Getreidearten namentlich, die Schalenfrüchte im Plural.
 */
export const ALLERGEN_LABELS: Record<AllergenKey, string> = {
  gluten: 'Gluten',
  weizen: 'Weizen',
  roggen: 'Roggen',
  gerste: 'Gerste',
  hafer: 'Hafer',
  dinkel: 'Dinkel',
  ei: 'Ei',
  milch: 'Milch',
  sesam: 'Sesam',
  mandel: 'Mandeln',
  haselnuss: 'Haselnüsse',
  walnuss: 'Walnüsse',
  cashew: 'Cashewnüsse',
}

/** Woher die Angabe stammt. Entspricht `allergens_source` im Frontmatter. */
export type AllergenSource = 'rezept' | 'geprueft'

/**
 * Was hinter der Herkunft steht — gehört sichtbar neben die Liste.
 *
 * `rezept` ist aus der Rezeptur abgeleitet und nicht von der Bäckerei
 * gegengelesen. Das zu verschweigen wäre eine stillschweigende Zusicherung,
 * die niemand gegeben hat.
 */
export const ALLERGEN_SOURCE_NOTES: Record<AllergenSource, string> = {
  rezept: `Abgeleitet aus dem Rezept unserer Backstube. Bei einer schweren Allergie rufen Sie uns bitte vorher an: ${BRAND_FACTS.phone}.`,
  geprueft: 'Von uns geprüft und bestätigt.',
}

/**
 * Der Standardhinweis der Backstube. Er sagt, was hier verarbeitet wird —
 * nicht, was ein einzelnes Gebäck nicht enthält.
 *
 * In einer Backstube dieser Größe laufen alle Teige über dieselben Kessel,
 * Bleche und Hände. Spuren lassen sich nicht ausschließen, also wird das auch
 * nicht behauptet.
 */
export const CROSS_CONTAMINATION_NOTE =
  'In unserer Backstube werden Getreide, Nüsse, Sesam, Milch und Eier verarbeitet. Spuren davon sind in jedem Gebäck möglich.'

/**
 * Für die Produkte, zu denen kein Rezept vorliegt.
 *
 * Kein Platzhalter und keine Beschwichtigung: die Angabe fehlt, und der Weg zur
 * Auskunft steht daneben. § 4 LMIDV lässt für unverpackte Ware die mündliche
 * Auskunft zu, solange sie auf Nachfrage zu bekommen ist.
 */
export const NO_DECLARATION_NOTE = `Zu diesem Gebäck haben wir hier noch keine geprüfte Angabe. Rufen Sie uns an: ${BRAND_FACTS.phone}. Oder fragen Sie an der Theke — wir sagen es Ihnen vor dem Kauf.`

/** Ob `value` ein Schlüssel ist, den dieses Modul kennt. */
export function isAllergenKey(value: unknown): value is AllergenKey {
  return (
    typeof value === 'string' &&
    (ALLERGEN_KEYS as readonly string[]).includes(value)
  )
}

/**
 * Bezeichnung zu einem Schlüssel.
 *
 * Unbekannte Schlüssel werden **nicht** verworfen, sondern mit großem
 * Anfangsbuchstaben durchgereicht. Lieber ein rohes Wort in der Liste als ein
 * verschwiegenes Allergen.
 */
export function allergenLabel(key: string): string {
  if (isAllergenKey(key)) return ALLERGEN_LABELS[key]
  return key.charAt(0).toUpperCase() + key.slice(1)
}

/**
 * Deutsche Aufzählung: "Gluten", "Gluten und Weizen", "Gluten, Weizen und Milch".
 *
 * Doppelte Einträge fallen weg, bekannte Schlüssel kommen in der Reihenfolge
 * von {@link ALLERGEN_KEYS}, unbekannte hängen hinten an — verworfen wird
 * keiner. Eine leere Liste ergibt einen leeren String: es gibt keinen Satz,
 * mit dem sich "keine Allergene" sagen ließe.
 */
export function formatAllergens(keys: readonly string[]): string {
  const cleaned: string[] = []
  for (const key of keys) {
    if (typeof key !== 'string') continue
    const trimmed = key.trim()
    if (trimmed === '' || cleaned.indexOf(trimmed) !== -1) continue
    cleaned.push(trimmed)
  }

  const known: string[] = ALLERGEN_KEYS.filter(
    (key) => cleaned.indexOf(key) !== -1
  )
  const unknown = cleaned.filter((key) => !isAllergenKey(key))
  const labels = known.concat(unknown).map(allergenLabel)

  if (labels.length === 0) return ''
  if (labels.length === 1) return labels[0]
  return `${labels.slice(0, -1).join(', ')} und ${labels[labels.length - 1]}`
}

/** Eine belegte Allergen-Angabe zu einem Produkt. */
export interface AllergenDeclaration {
  /**
   * Mindestens ein Eintrag — eine leere Deklaration gibt es nicht.
   * `string` statt `AllergenKey`, damit ein neuer Schlüssel aus `hq` nicht
   * schon beim Einlesen verloren geht.
   */
  readonly allergens: readonly string[]
  readonly source: AllergenSource
  /** Rezept, aus dem die Liste stammt — nur bei `source: 'rezept'`. */
  readonly recipe?: string
}

/**
 * Liest die drei Frontmatter-Keys aus einem Produkt (snake_case wie in `hq`
 * und in der API, camelCase wie nach dem Mapping in den Apps).
 *
 * Gibt `null` zurück, sobald etwas fehlt oder nicht passt. Dieser eine
 * Rückgabewert ist die ganze Sicherheitslogik der Oberfläche: `null` heißt
 * "wir wissen es nicht" und muss zu {@link NO_DECLARATION_NOTE} führen — nie
 * zu einer leeren Liste, die sich wie eine Entwarnung liest.
 */
export function readAllergenDeclaration(
  product: Record<string, unknown> | null | undefined
): AllergenDeclaration | null {
  if (!product) return null

  const rawList = product['allergens']
  if (!Array.isArray(rawList)) return null

  const allergens = rawList
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry !== '')
  if (allergens.length === 0) return null

  const rawSource = product['allergens_source'] ?? product['allergensSource']
  if (rawSource !== 'rezept' && rawSource !== 'geprueft') return null

  const rawRecipe = product['allergen_recipe'] ?? product['allergenRecipe']
  const recipe =
    typeof rawRecipe === 'string' && rawRecipe.trim() !== ''
      ? rawRecipe.trim()
      : undefined

  return rawSource === 'rezept' && recipe
    ? { allergens, source: rawSource, recipe }
    : { allergens, source: rawSource }
}

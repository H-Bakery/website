/**
 * Zahl mit dem passenden Wort: `1 Besuch`, `2 Besuche`, `1.250 Produkte`.
 * Die Zahl im deutschen Format; `null`/ungültig zählt als 0.
 *
 * Einzige Fassung für die ganze App - keine lokalen Kopien mehr (früher in
 * `partnerTypes.ts`, Preisliste und Kassenberichte je eine).
 */
export function plural(
  count: number | null | undefined,
  one: string,
  many: string
): string {
  const n = count == null || !Number.isFinite(count) ? 0 : count
  return `${n.toLocaleString('de-DE')} ${n === 1 ? one : many}`
}

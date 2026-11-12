/**
 * Zustände der Auslage („Fills“): Die App zeigt nur „Morgens“.
 *
 * Im Modell trägt jeder belegte Platz einen Knoten `produkt/<slot>` mit
 * `extras.fills` (Liste der Zustände, in denen er zu sehen ist). Ein Platz, der
 * sich zwischen den Zuständen unterscheidet, hat dafür einen zweiten Knoten
 * `produkt/<slot>@<fill>`. Knoten ohne `fills` (Möbel, Wände, Außenraum) sind
 * immer zu sehen. three legt `extras` unverändert in `userData` ab.
 *
 * Reine Logik ohne three - sie arbeitet auf jedem Baum mit `userData`,
 * `visible` und `children` und ist in fills.spec.ts getestet.
 *
 * Herkunft: `fillShows` / `applyFill` aus dem Saar LiDAR Explorer
 * (github.com/Open-Kirrberg/saar-lidar-explorer, MIT, gleicher Urheber),
 * `app/src/zones/catalogue.ts` und `app/src/zones/runtime/twinInteract.ts`.
 */

/** Das Nötigste eines three-`Object3D`. */
export interface FillNode {
  userData: Record<string, unknown>
  visible: boolean
  children: readonly FillNode[]
}

/**
 * Ist ein Knoten mit diesen `fills` im Zustand `fill` zu sehen? Ohne Liste
 * (alles außer den Produkten): immer. Eine Liste, die keine ist, blendet
 * nichts aus - lieber ein Stück zu viel zeigen als den Laden leeren.
 */
export function fillShows(fills: unknown, fill: string): boolean {
  if (!Array.isArray(fills)) return true
  return fills.includes(fill)
}

/** Platz und Zustand aus einem Knotennamen `produkt/<slot>[@<fill>]`. */
export function parseProduktName(
  name: unknown
): { slot: string; variante: string | null } | null {
  if (typeof name !== 'string' || !name.startsWith('produkt/')) return null
  const rest = name.slice('produkt/'.length)
  const at = rest.lastIndexOf('@')
  if (at < 0) return rest ? { slot: rest, variante: null } : null
  const slot = rest.slice(0, at)
  const variante = rest.slice(at + 1)
  return slot && variante ? { slot, variante } : null
}

export interface FillResult {
  /** Knoten mit `fills`, die zu sehen sind. */
  shown: number
  /** Knoten mit `fills`, die ausgeblendet wurden. */
  hidden: number
  /**
   * Plätze, von denen im gewählten Zustand mehr als ein Knoten zu sehen ist -
   * dann lägen zwei Varianten übereinander. Sollte leer sein.
   */
  doubled: string[]
}

/**
 * Setzt `visible` aller Knoten mit `fills` für den Zustand `fill` und zählt.
 * Knoten ohne `fills` bleiben unberührt.
 */
export function applyFill(root: FillNode, fill: string): FillResult {
  const result: FillResult = { shown: 0, hidden: 0, doubled: [] }
  const seen = new Map<string, number>()
  const visit = (node: FillNode) => {
    const { fills, name, id } = node.userData
    if (fills !== undefined) {
      const show = fillShows(fills, fill)
      node.visible = show
      if (show) {
        result.shown += 1
        const parsed = parseProduktName(name)
        const slot = parsed?.slot ?? (typeof id === 'string' ? id : null)
        if (slot) seen.set(slot, (seen.get(slot) ?? 0) + 1)
      } else {
        result.hidden += 1
      }
    }
    node.children.forEach(visit)
  }
  visit(root)
  for (const [slot, count] of seen) if (count > 1) result.doubled.push(slot)
  return result
}

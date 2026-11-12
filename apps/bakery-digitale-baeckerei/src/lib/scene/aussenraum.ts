/**
 * Außenraum (`fassade/*`, `umgebung/*`) ein- und ausblenden: An Blickpunkten,
 * von denen man nicht nach draußen sieht, muss er nicht gezeichnet werden
 * (`Blickpunkt.aussenSichtbar === false`).
 *
 * Ohne three zur Laufzeit - arbeitet auf jedem Baum mit `name`, `userData`,
 * `visible` und `children` (aussenraum.spec.ts).
 */
import type { Object3D } from 'three'

const AUSSEN = ['fassade', 'umgebung'] as const

/**
 * Gehört ein Knoten zum Außenraum? Der GLTFLoader streicht `/` aus
 * `object.name` (`fassadedach`); der echte Name steht in `userData.name`.
 */
export function istAussenraum(node: {
  name?: string
  userData?: Record<string, unknown>
}): boolean {
  const echt = node.userData?.name
  if (typeof echt === 'string') {
    return AUSSEN.some((p) => echt.startsWith(`${p}/`))
  }
  const name = node.name ?? ''
  return AUSSEN.some((p) => name.startsWith(p))
}

/** Setzt `visible` aller Außenraum-Knoten unter `root`; alles andere bleibt. */
export function setzeAussenraum(root: Object3D, sichtbar: boolean): void {
  for (const child of root.children) {
    if (istAussenraum(child)) child.visible = sichtbar
    else if (child.children.length > 0) setzeAussenraum(child, sichtbar)
  }
}

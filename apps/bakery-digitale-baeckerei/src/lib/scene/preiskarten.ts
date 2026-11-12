/**
 * Preisschilder im Modell ausblenden (DB8: keine Preise, auch nicht im Bild).
 *
 * Im Modell sind die Preiskarten eigene Teil-Meshes der Produktknoten mit den
 * Materialien `preiskarte` (das Kärtchen) und `preisschrift` (die Schrift
 * darauf). Der GLTFLoader macht aus jedem Material eines Knotens ein eigenes
 * Kind-Mesh - es reicht, diese Meshes auszublenden.
 *
 * Nur Typen aus three; arbeitet auf jedem Object3D-Baum (preiskarten.spec.ts).
 */
import type { Material, Mesh, Object3D } from 'three'
import { istPreisMaterial } from './treffer'

/** Ist dieses Mesh (ganz) ein Preisschild? Bei Material-Listen: alle Materialien. */
export function istPreiskarte(mesh: Mesh): boolean {
  const materials = ([] as Material[]).concat(mesh.material ?? [])
  return (
    materials.length > 0 && materials.every((m) => istPreisMaterial(m.name))
  )
}

/**
 * Blendet alle Preisschilder unter `root` aus und gibt zurück, wie viele
 * Meshes betroffen sind. Ein Mesh mit Material-Liste, in der nur ein Teil
 * Preis-Material ist, bleibt sichtbar; seine Preis-Materialien werden
 * unsichtbar geschaltet (`material.visible`) und das Mesh zählt mit.
 * Mehrfach aufrufen schadet nicht.
 */
export function blendePreiskartenAus(root: Object3D): number {
  let count = 0
  root.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    if (istPreiskarte(mesh)) {
      mesh.visible = false
      count += 1
      return
    }
    if (!Array.isArray(mesh.material)) return
    let betroffen = false
    for (const material of mesh.material) {
      if (!istPreisMaterial(material.name)) continue
      material.visible = false
      betroffen = true
    }
    if (betroffen) count += 1
  })
  return count
}

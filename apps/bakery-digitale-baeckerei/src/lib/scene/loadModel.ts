/**
 * Entpackt ein Modell (GLB mit EXT_meshopt_compression, KHR_mesh_quantization,
 * KHR_materials_unlit). Das Holen mit Fortschritt steht ohne three in
 * `src/lib/modell/holeModell.ts`.
 *
 * Herkunft: `loadScene` und `disposeTree` aus dem Saar LiDAR
 * Explorer (github.com/Open-Kirrberg/saar-lidar-explorer, MIT, gleicher
 * Urheber), `app/src/zones/runtime/gltfZone.ts`. Ohne KTX2-Loader: der
 * Zwilling hat keine Texturen, das Licht steckt in den Vertex-Farben.
 *
 * Importiert three - nur aus der nachgeladenen Viewer-Komponente verwenden.
 */
import type { InstancedMesh, Material, Mesh, Object3D, Texture } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { fetchBytes } from '../modell/holeModell'

/**
 * Entpackt ein schon geholtes Modell (meshopt) zu einem three-Baum. `url`:
 * woher es kam - Basis für Dateien, auf die das GLB verweist.
 */
export async function parseModel(
  buffer: ArrayBuffer,
  url: string
): Promise<Object3D> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const gltf = await loader.parseAsync(
    buffer,
    url.slice(0, url.lastIndexOf('/') + 1)
  )
  const root = gltf.scene
  root.traverse((node) => {
    const mesh = node as Mesh
    if (mesh.isMesh) mesh.frustumCulled = true
  })
  return root
}

/** Holt und entpackt ein Modell (Nahansicht). Der Laden holt sein Modell selbst: `holeModell`. */
export async function loadModel(
  url: string,
  signal: AbortSignal,
  declaredBytes: number | undefined,
  onBytes: (fraction: number) => void
): Promise<Object3D> {
  const buffer = await fetchBytes(url, signal, declaredBytes, onBytes)
  if (signal.aborted) throw new DOMException('Laden abgebrochen', 'AbortError')
  return parseModel(buffer, url)
}

/** Gibt Geometrien, Materialien und Texturen eines Teilbaums frei. */
export function disposeTree(root: Object3D): void {
  root.traverse((node) => {
    const mesh = node as Mesh
    if (!mesh.isMesh) return
    mesh.geometry?.dispose()
    for (const material of ([] as Material[]).concat(mesh.material ?? [])) {
      for (const value of Object.values(material)) {
        if ((value as Texture | null)?.isTexture) (value as Texture).dispose()
      }
      material.dispose()
    }
  })
}

export function countTriangles(root: Object3D, visibleOnly = false): number {
  let triangles = 0
  const visit = (node: Object3D) => {
    if (visibleOnly && !node.visible) return
    const mesh = node as Mesh
    // Überzüge der Hervorhebung (interact.ts) teilen die Geometrie ihres Meshes.
    if (mesh.userData?.dbUeberzug) return
    // Ware des Modells, die die Einrichtung verborgen hat (einrichtung.ts):
    // zählt nicht zu dem, was zu sehen ist.
    const verborgen = visibleOnly && mesh.userData?.dbVerborgen
    if (mesh.isMesh && !verborgen) {
      // Gelegte Regal-Modelle: eine Geometrie, viele Stücke.
      const stuecke = (mesh as InstancedMesh).isInstancedMesh
        ? (mesh as InstancedMesh).count
        : 1
      triangles +=
        ((mesh.geometry.index?.count ??
          mesh.geometry.attributes.position?.count ??
          0) /
          3) *
        stuecke
    }
    node.children.forEach(visit)
  }
  visit(root)
  return Math.round(triangles)
}

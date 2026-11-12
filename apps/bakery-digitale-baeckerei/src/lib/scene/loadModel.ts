/**
 * Lädt das Modell (GLB mit EXT_meshopt_compression, KHR_mesh_quantization,
 * KHR_materials_unlit) mit Byte-Fortschritt.
 *
 * Herkunft: `fetchBytes`, `loadScene` und `disposeTree` aus dem Saar LiDAR
 * Explorer (github.com/Open-Kirrberg/saar-lidar-explorer, MIT, gleicher
 * Urheber), `app/src/zones/runtime/gltfZone.ts`. Ohne KTX2-Loader: der
 * Zwilling hat keine Texturen, das Licht steckt in den Vertex-Farben.
 *
 * Importiert three - nur aus der nachgeladenen Viewer-Komponente verwenden.
 */
import type { Material, Mesh, Object3D, Texture } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

/** GET mit Fortschritt 0…1 (Content-Length, sonst die erwartete Größe). */
export async function fetchBytes(
  url: string,
  signal: AbortSignal,
  declared: number | undefined,
  onBytes: (fraction: number) => void
): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  // Bei komprimierter Auslieferung zählt Content-Length die gepackten Bytes,
  // der Reader liefert die entpackten - dann gilt die erwartete Größe.
  const encoded = res.headers.get('content-encoding')
  const length = encoded ? 0 : Number(res.headers.get('content-length'))
  const total = length || declared || 0
  if (!res.body || !total) {
    const all = await res.arrayBuffer()
    onBytes(1)
    return all
  }
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let got = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    got += value.byteLength
    onBytes(Math.min(1, got / total))
  }
  const out = new Uint8Array(got)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  onBytes(1)
  return out.buffer
}

export async function loadModel(
  url: string,
  signal: AbortSignal,
  declaredBytes: number | undefined,
  onBytes: (fraction: number) => void
): Promise<Object3D> {
  const buffer = await fetchBytes(url, signal, declaredBytes, onBytes)
  if (signal.aborted) throw new DOMException('Laden abgebrochen', 'AbortError')
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
    if (mesh.isMesh) {
      triangles +=
        (mesh.geometry.index?.count ??
          mesh.geometry.attributes.position?.count ??
          0) / 3
    }
    node.children.forEach(visit)
  }
  visit(root)
  return Math.round(triangles)
}

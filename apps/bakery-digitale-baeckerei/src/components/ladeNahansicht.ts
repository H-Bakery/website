import type {
  NahansichtHandle,
  NahansichtOptions,
} from '../lib/scene/createNahansicht'

export type BaueNahansicht = (
  container: HTMLElement,
  options: NahansichtOptions
) => NahansichtHandle | null

/**
 * Lädt den Code der Nahansicht (three.js, GLTFLoader, RoomEnvironment) als
 * eigenen Chunk nach - erst, wenn jemand „In 3D ansehen“ antippt. Die einzige
 * Stelle, die `createNahansicht` importiert; in jest wird sie gemockt.
 */
export function ladeNahansicht(): Promise<BaueNahansicht> {
  return import('../lib/scene/createNahansicht').then(
    (modul) => modul.createNahansicht
  )
}

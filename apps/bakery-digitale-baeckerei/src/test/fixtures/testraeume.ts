/**
 * Der synthetische zweite Raum der Tests: die „Testbackstube“ (DB11). Alles
 * erfunden - Kisten als Stationen, das Modell baut `build-fixture.mjs --raum
 * testbackstube`, die Infopunkte stehen in `raeume/testbackstube.yaml`.
 *
 * Nur mit `DIGITALE_BAECKEREI_FIXTURE=1` Teil der App (`src/config/raeume.ts`
 * lädt diese Datei nur dann); der Export-Wächter bricht ab, wenn im echten
 * Export etwas davon auftaucht.
 */
import type { Raum } from '../../config/raeume'

export const TESTBACKSTUBE: Raum = {
  id: 'testbackstube',
  name: 'Testbackstube',
  wechsel: 'In die Testbackstube',
  modell: 'testbackstube.glb',
  fuellung: 'morgens',
  produkte: false,
  start: 'ofen',
  blickpunkte: [
    {
      // Von der Ostwand auf Ofen, Kneter und Spüle an der Westwand.
      id: 'ofen',
      name: 'Ofen',
      eye: [5.2, 245.85, -2.8],
      look: [1.0, 245.2, -2.8],
      fov: 62,
      yawDeg: 20,
      pitchDeg: 12,
      fovMin: 24,
      fovMax: 62,
      moebel: ['ofen/', 'kneter/', 'spuele/'],
    },
    {
      // Auf den Arbeitstisch und die Tür daneben.
      id: 'tisch',
      name: 'Arbeitstisch',
      eye: [4.0, 245.85, -3.6],
      look: [3.53, 245.1, -0.8],
      fov: 62,
      yawDeg: 20,
      pitchDeg: 12,
      fovMin: 24,
      fovMax: 62,
      moebel: ['arbeitstisch/', 'tuer/'],
    },
  ],
  // Die Tür führt zurück in den Laden.
  tueren: [{ knoten: 'tuer', ziel: 'laden' }],
}

export const TESTRAEUME: readonly Raum[] = [TESTBACKSTUBE]

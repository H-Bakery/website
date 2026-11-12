/**
 * Räume und ihre Blickpunkte - die einzige Quelle für Kamerawerte.
 *
 * Koordinaten: Zonen-Rahmen des Saar LiDAR Explorers, unverändert übernommen
 * (x = Ost, y = Höhe in m ü. NHN, im Laden ≈ 244, z = −Nord). Nicht umrechnen.
 *
 * P0 kennt nur den Blickpunkt „Theke“; Brotregal und Regale kommen in P1 als
 * weitere Einträge, die Backstube später als weiterer Raum mit eigenem Modell.
 */

export type Vec3 = readonly [number, number, number]

export interface BlickpunktHochformat {
  eye: Vec3
  look: Vec3
  /** Senkrechter Öffnungswinkel in Grad (Start und weiteste Einstellung). */
  fov: number
}

export interface Blickpunkt {
  id: string
  name: string
  /** Standort der Kamera. Er bleibt fest (DB4). */
  eye: Vec3
  /** Punkt, auf den die Kamera in der Ruhelage schaut. */
  look: Vec3
  /** Umschauen: höchstens ± so viele Grad seitlich (Kamera-Rig, P1). */
  yawDeg: number
  /** Umschauen: höchstens ± so viele Grad nach oben/unten (P1). */
  pitchDeg: number
  /** Engster senkrechter Öffnungswinkel (ganz herangezoomt, P1). */
  fovMin: number
  /** Weitester senkrechter Öffnungswinkel - damit startet das Querformat. */
  fovMax: number
  /** Eigene Werte für Hochformat, damit das ganze Möbel ins Bild passt. */
  portrait?: BlickpunktHochformat
}

export interface Raum {
  id: string
  name: string
  /** Datei unter public/model/ (aus scripts/sync-model.mjs). */
  modell: string
  /** Zustand der Auslage, der gezeigt wird (`extras.fills` im Modell). */
  fuellung: string
  blickpunkte: readonly Blickpunkt[]
}

export const raeume: readonly Raum[] = [
  {
    id: 'laden',
    name: 'Laden',
    modell: 'twin.glb',
    fuellung: 'morgens',
    blickpunkte: [
      {
        id: 'theke',
        name: 'Theke',
        // Startwerte aus der Führung des Explorers (catalogue/tour.json, Halt „theke“).
        eye: [6.0, 245.9, -0.6],
        look: [3.9, 245.0, -1.8],
        yawDeg: 20,
        pitchDeg: 12,
        fovMin: 28,
        fovMax: 62,
        // Hochformat (390 px breit): vom Ende der Theke an ihr entlang, damit
        // die ganze Vitrine ins schmale Bild passt. Am Bild bestimmt (P0).
        portrait: {
          eye: [5.8, 245.95, 0.3],
          look: [4.0, 245.05, -2.1],
          fov: 62,
        },
      },
    ],
  },
]

export const START_RAUM_ID = 'laden'
export const START_BLICKPUNKT_ID = 'theke'

export function findeRaum(id: string): Raum | undefined {
  return raeume.find((r) => r.id === id)
}

export function findeBlickpunkt(
  raum: Raum,
  id: string
): Blickpunkt | undefined {
  return raum.blickpunkte.find((b) => b.id === id)
}

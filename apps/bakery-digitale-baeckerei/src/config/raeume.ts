/**
 * Räume und ihre Blickpunkte - die einzige Quelle für Kamerawerte.
 *
 * Koordinaten: Zonen-Rahmen des Saar LiDAR Explorers, unverändert übernommen
 * (x = Ost, y = Höhe in m ü. NHN, im Laden ≈ 244, z = −Nord). Nicht umrechnen.
 *
 * Der Laden hat drei Blickpunkte (DB3): Theke, Brotregal, Regale. Die Backstube
 * kommt später als weiterer Raum mit eigenem Modell.
 *
 * Alle Standorte liegen im Kundenbereich (Läufer vor der Theke) auf Augenhöhe
 * (1,45-1,65 m über dem Boden bei y = 244,25). Sie sind am echten Modell
 * bestimmt (390x844, 844x390, 1440x900, jeweils auch an den Grenzen des
 * Umschauens): Ändert sich das Modell, die Bilder neu ansehen.
 */

export type Vec3 = readonly [number, number, number]

export interface BlickpunktHochformat {
  eye: Vec3
  look: Vec3
  /** Senkrechter Öffnungswinkel in Grad: Start und weiteste Einstellung. */
  fov: number
  /** Engster Winkel im Hochformat (sonst der des Blickpunkts). */
  fovMin?: number
  /** Weitester Winkel im Hochformat (sonst `fov`). */
  fovMax?: number
}

export interface Blickpunkt {
  id: string
  name: string
  /** Standort der Kamera. Er bleibt fest (DB4). */
  eye: Vec3
  /** Punkt, auf den die Kamera in der Ruhelage schaut. */
  look: Vec3
  /** Senkrechter Öffnungswinkel in Grad, mit dem das Querformat startet. */
  fov: number
  /** Umschauen: höchstens ± so viele Grad seitlich. */
  yawDeg: number
  /** Umschauen: höchstens ± so viele Grad nach oben/unten. */
  pitchDeg: number
  /** Engster senkrechter Öffnungswinkel (ganz herangezoomt). */
  fovMin: number
  /** Weitester senkrechter Öffnungswinkel. */
  fovMax: number
  /** Eigene Werte für Hochformat, damit das Möbel ins schmale Bild passt. */
  portrait?: BlickpunktHochformat
  /**
   * Möbel dieses Blickpunkts als Anfang der Platz-ID (`theke/`). Jeder Platz
   * des Modells gehört zu genau einem Blickpunkt.
   */
  moebel: string[]
  /**
   * `false`: Von hier sieht man nicht nach draußen - `fassade/*` und
   * `umgebung/*` werden ausgeblendet (aussenraum.ts).
   */
  aussenSichtbar?: boolean
}

/** Der Teil eines Blickpunkts, den die Bedienelemente brauchen. */
export type BlickpunktKurz = Pick<Blickpunkt, 'id' | 'name'>

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
        // Vom Ende des Läufers an der Ladentür die Theke entlang: Vitrine und
        // Brezelständer im Bild, dahinter das Gitterregal neben dem
        // Schaufenster. Das Gitterregal steht 7 m von den anderen Regalen
        // entfernt und ist nur von hier zu sehen - darum gehört es hierher.
        id: 'theke',
        name: 'Theke',
        eye: [4.85, 245.9, -3.2],
        look: [3.9, 245.0, -1.2],
        fov: 62,
        yawDeg: 20,
        pitchDeg: 12,
        fovMin: 24,
        fovMax: 62,
        portrait: {
          eye: [4.85, 245.9, -3.2],
          look: [3.95, 245.0, -1.3],
          fov: 64,
        },
        moebel: ['theke/', 'gitterregal/'],
        // Links liegt das Schaufenster im Bild.
        aussenSichtbar: true,
      },
      {
        // An der Theke, zwischen zwei Hängelampen, gerade aufs Regal; die
        // Augenhöhe (1,45 m) hält die Lampen über der obersten Reihe. Das
        // Würfelregal steht rechts neben dem Brotregal hinter der Theke und
        // kommt erst beim Schwenk nach rechts ins Bild - darum ± 30° statt 20°.
        // Seine unteren Fächer verdeckt die Theke von jedem Kundenplatz aus.
        id: 'brotregal',
        name: 'Brotregal',
        eye: [4.68, 245.7, -2.02],
        look: [2.34, 245.7, -1.41],
        fov: 62,
        yawDeg: 30,
        pitchDeg: 10,
        fovMin: 24,
        fovMax: 62,
        portrait: {
          eye: [4.68, 245.7, -2.02],
          look: [2.34, 245.5, -1.41],
          fov: 66,
        },
        moebel: ['brotregal/', 'wuerfelregal/'],
        // Ganz links reicht der Schwenk im Querformat bis ans Schaufenster.
        aussenSichtbar: true,
      },
      {
        // Neben dem Bistrotisch an der Ladentür: Dosenregal (Gitter- und
        // Würfelteil) und Getränkekühlschrank. Im Hochformat ein Stück weiter
        // zurück auf dem Läufer, damit der Tisch nicht im Bild steht.
        id: 'regale',
        name: 'Regale',
        eye: [5.1, 245.9, -3.75],
        look: [4.3, 245.12, -5.5],
        fov: 62,
        yawDeg: 20,
        pitchDeg: 12,
        fovMin: 24,
        fovMax: 62,
        portrait: {
          eye: [4.9, 245.9, -3.3],
          look: [4.2, 245.15, -5.35],
          fov: 66,
        },
        moebel: ['dosenregal/', 'getraenkekuehlschrank/'],
        aussenSichtbar: false,
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

/** Der Blickpunkt, zu dem ein Platz (`brotregal/ebene-1/platz-01`) gehört. */
export function findeBlickpunktFuerSlot(
  raum: Raum,
  slot: string
): Blickpunkt | undefined {
  return raum.blickpunkte.find((b) =>
    b.moebel.some((prefix) => slot.startsWith(prefix))
  )
}

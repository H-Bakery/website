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
  /** Punkt, auf den die Kamera in der Ruhelage (beim Start) schaut. */
  look: Vec3
  /**
   * Mitte der Grenzen des Umschauens, falls sie nicht die Ruhelage ist: Von
   * diesem Punkt aus gelten ± `yawDeg` / ± `pitchDeg`. So darf man im schmalen
   * Bild zu einer Seite weiter schwenken als zur anderen, ohne dass sich das
   * Startbild ändert. Ohne Angabe: `look`.
   */
  grenzenUm?: Vec3
  /** Umschauen im Hochformat: ± Grad seitlich (sonst der Wert des Blickpunkts). */
  yawDeg?: number
  /** Umschauen im Hochformat: ± Grad nach oben/unten (sonst der des Blickpunkts). */
  pitchDeg?: number
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

/** Ein Stützpunkt eines Kameraflugs: Zeit auf dem Pfad (s), Standort, Blickziel. */
export interface IntroPunkt {
  t: number
  eye: Vec3
  look: Vec3
}

/**
 * Ein kurzer, automatischer Kameraflug, der an einem Blickpunkt endet
 * (Rechnung: src/lib/scene/intro.ts). Standort und Blickziel laufen zwischen
 * den Stützpunkten geradlinig; die Stützpunkte sind im Explorer am Modell
 * geprüft und stehen hier unverändert.
 */
export interface Intro {
  id: string
  name: string
  /** id des Blickpunkts, an dem der Flug endet. Der letzte Punkt ist dessen Ruhelage. */
  ziel: string
  /**
   * Der Flug führt über Gelände, das es erst in einem späteren Modell gibt:
   * Er wird nur angeboten, wenn das geladene Modell einen Knoten enthält,
   * dessen Name so beginnt.
   */
  braucht?: string
  punkte: readonly IntroPunkt[]
  /**
   * Eigener Zeitplan: Zur Filmzeit `film` (s) steht die Kamera an der
   * Pfadzeit `pfad`; dazwischen geradlinig. So lässt sich der Flug vorn kürzen
   * (später einsteigen) oder ein Stück langsamer fliegen, ohne die geprüften
   * Stützpunkte anzufassen. Ohne Angabe: Filmzeit = Pfadzeit.
   */
  ablauf?: readonly { film: number; pfad: number }[]
}

export interface Raum {
  id: string
  name: string
  /** Datei unter public/model/ (aus scripts/sync-model.mjs). */
  modell: string
  /** Zustand der Auslage, der gezeigt wird (`extras.fills` im Modell). */
  fuellung: string
  blickpunkte: readonly Blickpunkt[]
  /**
   * Flüge zum Start, in der Reihenfolge des Vorrangs: Gezeigt wird der erste,
   * den das geladene Modell hergibt (`braucht`).
   */
  intros?: readonly Intro[]
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
          // Der Standort steht neben dem türseitigen Ende der Vitrine. Im
          // schmalen Bild reichen ± 20° nicht bis dorthin: Die Grenzen liegen
          // darum um einen Punkt weiter rechts, ± 40°. Nach links bleibt es
          // bei rund 20° ab dem Startbild, nach rechts sind es rund 60° - so
          // kommt jeder Platz der Vitrine ins Bild (am echten Modell geprüft).
          grenzenUm: [3.45, 245.0, -1.75],
          yawDeg: 40,
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
    // Beide Flüge enden genau in der Ruhelage des Blickpunkts „Theke“
    // (Querformat; ins Hochformat blendet intro.ts am Schluss über). Die
    // Stützpunkte stammen aus dem Explorer (lokaler Zweig
    // `feat/bh-intro-kreisel`, dort am Modell geprüft) - nicht verschieben,
    // ohne die Bilder neu anzusehen: Der Weg führt durch die offene Ladentür.
    intros: [
      {
        // Vom Kreisel die Eckstraße herunter: braucht Kreisel und Straße im
        // Modell. Am heute gesperrten Stand gibt es sie nicht - dieser Flug
        // wird erst mit einem neuen Modell angeboten, dann von selbst.
        id: 'kreisel',
        name: 'Vom Kreisel zur Theke',
        ziel: 'theke',
        braucht: 'umgebung/kreisel',
        punkte: [
          { t: 0, eye: [-25.0, 248.25, 61.0], look: [-4.0, 245.5, 28.0] },
          { t: 1.7, eye: [-15.0, 245.83, 48.6], look: [-4.4, 247.5, 20.0] },
          { t: 3.2, eye: [-9.0, 244.69, 38.8], look: [-4.39, 248.6, 16.23] },
          { t: 6.0, eye: [3.2, 244.97, 15.0], look: [7.0, 245.6, -2.5] },
          { t: 8.0, eye: [13.05, 245.22, -2.66], look: [6.3, 245.55, -4.14] },
          { t: 9.4, eye: [8.21, 245.13, -3.22], look: [4.61, 245.55, -4.51] },
          { t: 10.4, eye: [6.45, 245.9, -4.07], look: [4.3, 245.4, -3.6] },
          { t: 11.2, eye: [5.6, 245.9, -4.48], look: [3.9, 245.1, -2.2] },
          { t: 12.0, eye: [4.85, 245.9, -3.2], look: [3.9, 245.0, -1.2] },
        ],
      },
      {
        // Die Straße am Haus entlang, vor dem Laden einschwenken, die Stufen
        // hinauf und durch die Tür: bleibt auf dem Außenraum, den das Modell
        // schon hat (8,0 s, 35 m).
        id: 'kurz',
        name: 'Von der Straße zur Theke',
        ziel: 'theke',
        punkte: [
          { t: 0.0, eye: [0.55, 244.87, 20.0], look: [7.0, 246.2, -2.5] },
          { t: 1.2, eye: [3.2, 244.97, 15.0], look: [7.0, 245.6, -2.5] },
          { t: 3.4, eye: [13.05, 245.22, -2.66], look: [6.3, 245.55, -4.14] },
          { t: 5.0, eye: [8.21, 245.13, -3.22], look: [4.61, 245.55, -4.51] },
          { t: 6.2, eye: [6.45, 245.9, -4.07], look: [4.3, 245.4, -3.6] },
          { t: 7.2, eye: [5.6, 245.9, -4.48], look: [3.9, 245.1, -2.2] },
          { t: 8.0, eye: [4.85, 245.9, -3.2], look: [3.9, 245.0, -1.2] },
        ],
        // Vorn gekürzt statt schneller: Das lange Stück an der Hauswand
        // (20 m in 2,2 s, ≈ 9 m/s knapp über der Straße, dazu ein Schwenk
        // bis ≈ 77°/s) ist am Handy zu hastig. Der Flug steigt darum erst
        // bei Pfadzeit 1,9 ein - das erste Bild zeigt schon die Ladenfront -
        // und nimmt sich für den Rest des Stücks 2,9 s (≈ 5 m/s, ≈ 40°/s).
        // Ab dem Einschwenken vor dem Laden läuft er wie geprüft: 7,5 s, 23 m.
        ablauf: [
          { film: 0, pfad: 1.9 },
          { film: 2.9, pfad: 3.4 },
          { film: 7.5, pfad: 8.0 },
        ],
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

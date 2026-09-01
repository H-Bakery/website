/**
 * @fileoverview Nachprüfbare Fakten über die Bäckerei Heusser.
 * @module @bakery/shared/utils/brand
 *
 * Alles hier ist **belegt**, nichts geschätzt oder ausgeschmückt. Jede Zahl
 * trägt ihre Quelle, damit sie später nachgeprüft und aufgefrischt werden kann.
 * Werbung mit erfundenen Bewertungen oder Auszeichnungen ist in Deutschland
 * unlauter (§ 5 UWG; für Bewertungen ausdrücklich § 5b Abs. 3 UWG) — wer hier
 * eine Zahl ergänzt, braucht dafür einen Beleg.
 */

/** Gründung, Generation, Ort — aus dem Impressum und der Strategieakte in `hq/`. */
export const BRAND_FACTS = {
  /** Gegründet 1933 (hq/projects/PROJ-001-…/strategy/business-modernization-plan-DE.md). */
  foundedYear: 1933,
  /** Familienbetrieb in dritter Generation (gleiche Quelle). */
  generation: 3,
  street: 'Eckstraße 3',
  postalCode: '66424',
  city: 'Homburg',
  district: 'Kirrberg',
  phone: '06841 2229',
  phoneHref: 'tel:+4968412229',
} as const

/**
 * Zusammenfassung der öffentlichen Google-Bewertungen.
 *
 * Quelle: `hq/projects/PROJ-001-bakery-2025-strategy/strategy/business-modernization-plan-DE.md`
 * (Stand 2025). **Das ist ein Momentwert** — vor einem Livegang neu auszählen
 * und `asOf` mitziehen, sonst steht auf der Startseite eine veraltete Zahl.
 */
export const REVIEW_SUMMARY = {
  average: 4.5,
  count: 134,
  source: 'Google',
  asOf: '2025',
} as const

/** Eine veröffentlichte Kundenrezension. */
export interface CustomerReview {
  /** Anzeigename, wie ihn die Plattform führt. */
  name: string
  /** Sternebewertung, 1–5. */
  stars: number
  /** Wortlaut, ungekürzt. */
  text: string
}

/**
 * Echte Rezensionen aus dem Google-Unternehmensprofil.
 *
 * Ungekürzt und mit der tatsächlich vergebenen Sternezahl — auch die
 * Drei-Sterne-Bewertung bleibt drin. Nur die guten zu zeigen wäre eine
 * Auswahl, die den Gesamteindruck verzerrt.
 *
 * Dieselbe Liste liegt noch einmal in `apps/bakery-landing/src/mocks/testimonials`;
 * die Landingpage sollte sie später von hier beziehen.
 */
export const CUSTOMER_REVIEWS: ReadonlyArray<CustomerReview> = [
  {
    stars: 5,
    name: 'Freyja7',
    text: 'das ist noch eine 3 Generationen - Bäckerei da wird noch alles, Brot Brötchen, Kuchen, Torten selber gebacken nix vom Band. Echte Handwerkskunst vom Feinsten 👌🏻😍',
  },
  {
    stars: 3,
    name: 'Sarah K',
    text: 'Lieblings Bäckerei! Seit der Kindheit!!! Hier wird noch selbst gebacken und es schmeckt ausgezeichnet! Preis Leistung top👌 Dazu ein außergewöhnlich freundliches Personal!!',
  },
  {
    stars: 5,
    name: 'Niko H',
    text: 'Super leckere Brötchen. Schön groß, einfach toll',
  },
]

import { DailyOffer } from './Card'

/** Gültig ab dem 11.08.2026 */
export const BROTPLAN_GUELTIG_AB = '11.08.2026'

const bread = (name: string, description: string) => ({
  type: 'bread' as const,
  name,
  description,
})

export const ANGEBOTE: DailyOffer[] = [
  {
    name: 'Dienstag',
    date: 'Di.',
    specialOffers: [
      bread(
        'Holzluken',
        'Unser rustikales Roggenmischbrot mit herzhaftem Geschmack und langer Frischhaltung.'
      ),
      bread(
        'Erlebnishof Brot',
        'Saftiges Vollkornbrot mit Sonnenblumenkernen und Leinsaat – für alle, die bewusst genießen.'
      ),
    ],
  },
  {
    name: 'Mittwoch',
    date: 'Mi.',
    specialOffers: [
      bread(
        'Roggenmischbrot',
        'Der klassische Brotgenuss – aromatisch, locker und täglich frisch gebacken.'
      ),
      bread(
        'Bäckers Spezial',
        'Jede Woche eine wechselnde Brotspezialität aus unserer Backstube.'
      ),
    ],
  },
  {
    name: 'Donnerstag',
    date: 'Do.',
    specialOffers: [
      bread(
        'Heiners Kruste',
        'Kräftiges Roggen-Dinkel-Malzbrot mit feiner Malznote und vollmundigem Geschmack.'
      ),
      bread(
        'Haferbrot',
        'Mildes Mischbrot mit wertvollen Haferflocken – besonders saftig und lange frisch.'
      ),
    ],
  },
  {
    name: 'Freitag',
    date: 'Fr.',
    specialOffers: [
      bread(
        'Hildegard von Bingen',
        'Urgetreidebrot mit ausgewählten Zutaten nach Hildegards traditioneller Ernährungslehre.'
      ),
      bread(
        'Roggenmischbrot',
        'Unser beliebter Brotklassiker – herzhaft, aromatisch und täglich frisch.'
      ),
    ],
  },
  {
    name: 'Samstag',
    date: 'Sa.',
    specialOffers: [
      bread('Weizenmischbrot', 'Mildes Mischbrot – ideal für jeden Tag.'),
      bread(
        'Roggenmischbrot',
        'Kräftig im Geschmack und besonders aromatisch.'
      ),
      bread(
        'Holzluken',
        'Rustikales Roggenmischbrot mit langer Frischhaltung.'
      ),
      bread(
        'Kerbricher 4-Saat',
        'Saftiges Mehrkornbrot mit vier wertvollen Saaten – kernig und aromatisch.'
      ),
    ],
  },
]

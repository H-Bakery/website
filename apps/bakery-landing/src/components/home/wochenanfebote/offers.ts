import { DailyOffer } from './Card'

export const ANGEBOTE: DailyOffer[] = [
  {
    name: 'Dienstag',
    date: 'Täglich frisch',
    specialOffers: [
      {
        type: 'bread' as const,
        name: 'Mischbrot',
        description: 'Klassisches Mischbrot aus Roggen und Weizen',
      },
      {
        type: 'bread' as const,
        name: 'Haferbrot',
        description: 'Saftiges Brot mit knusprigen Haferflocken',
      },
    ],
  },
  {
    name: 'Mittwoch',
    date: 'Täglich frisch',
    specialOffers: [
      {
        type: 'bread' as const,
        name: 'Vollgut',
        description: 'Vollkornbrot mit besonders vielen Ballaststoffen',
      },
      {
        type: 'bread' as const,
        name: 'Walnuss',
        description: 'Mit gerösteten Walnussstücken',
      },
      {
        type: 'bread' as const,
        name: 'Buttermilchbrot',
        description: 'Besonders saftig durch Buttermilch',
      },
      {
        type: 'pastry' as const,
        name: 'Schnittentag',
        description:
          'Verschiedene Schnitten wie Sahneschnitten zum Sonderpreis',
      },
      {
        type: 'meal' as const,
        name: 'Schnitzelsandwich',
        description: 'Ab 11 Uhr, knuspriges Schnitzel im Brötchen',
      },
    ],
  },
  {
    name: 'Donnerstag',
    date: 'Täglich frisch',
    specialOffers: [
      {
        type: 'bread' as const,
        name: 'Dinkelmalz',
        description: 'Dinkelmalzbrot mit besonderem Aroma',
      },
      {
        type: 'bread' as const,
        name: 'Dinkelvollkorn',
        description: 'Herzhaftes Vollkornbrot aus 100% Dinkelmehl',
      },
      {
        type: 'meal' as const,
        name: 'Pizza & Flammkuchen',
        description: 'Ab 11 Uhr, selbstgemacht aus unserem Steinbackofen',
      },
    ],
  },
  {
    name: 'Freitag',
    date: 'Täglich frisch',
    specialOffers: [
      {
        type: 'bread' as const,
        name: 'Hildegard',
        description: 'Nach Hildegard von Bingen Rezeptur',
      },
      {
        type: 'bread' as const,
        name: 'Urkorn',
        description: 'Mit alten Getreidesorten gebacken',
      },
      {
        type: 'meal' as const,
        name: 'Mittagstisch',
        description: 'Ab 11 Uhr, wechselnde Mittagsgerichte der Woche',
      },
    ],
  },
  {
    name: 'Samstag',
    date: 'Kuchentag',
    specialOffers: [
      {
        type: 'bread' as const,
        name: 'Mischbrot',
        description: 'Klassisches Mischbrot aus Roggen und Weizen',
      },
      {
        type: 'bread' as const,
        name: 'Vitalbrot',
        description: 'Mit vielen gesunden Körnern und Saaten',
      },
      {
        type: 'bread' as const,
        name: 'Kerrbricher "Knorze"',
        description: 'Unsere regionale Spezialität mit knuspriger Kruste',
      },
      {
        type: 'pastry' as const,
        name: 'Hefezöpfe',
        description: 'Traditionell geflochten, gefüllt oder ungefüllt',
      },
      {
        type: 'pastry' as const,
        name: 'Kuchen des Tages',
        description: 'Verschiedene hausgemachte Kuchenspezialitäten',
      },
    ],
  },
  {
    name: 'Sonntag',
    date: '8:00 - 11:00 Uhr',
    specialOffers: [
      {
        type: 'bread' as const,
        name: 'Frische Brötchen',
        description: 'Klassisch, Mehrkorn, Laugen und Dinkel',
      },
      {
        type: 'pastry' as const,
        name: 'Kaffeestückchen',
        description: 'Verschiedene Gebäcke zum Sonntagskaffee',
      },
    ],
  },
]

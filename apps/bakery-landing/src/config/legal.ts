/**
 * Zentrale rechtliche Angaben (Impressum / Datenschutz).
 * Alle Pflichtangaben an einer Stelle pflegen.
 */
export const SITE_URL = 'https://xn--bckerei-heusser-0kb.de' // = https://bäckerei-heusser.de
export const SITE_DOMAIN_DISPLAY = 'bäckerei-heusser.de'

export const LEGAL = {
  companyName: 'Bäckerei Heusser',
  legalForm: 'Einzelunternehmen',
  owner: 'Karl-Heinz Heußer',
  address: {
    street: 'Eckstraße 3',
    postalCode: '66424',
    city: 'Homburg/Kirrberg',
    country: 'Deutschland',
  },
  phone: '06841 2229',
  phoneHref: 'tel:+4968412229',
  mobile: '0170 6133279',
  mobileHref: 'tel:+491706133279',
  email: 'baeckerei@heusserk.de',
  vatId: 'DE356803905',
  /** Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV */
  editorial: {
    name: 'Sebastian Heußer',
    street: 'Collingstraße 104',
    postalCode: '66424',
    city: 'Homburg/Kirrberg',
  },
  /** Bäckerhandwerk = zulassungspflichtiges Handwerk (Anlage A HwO) */
  craft: {
    profession: 'Bäckermeister',
    awardedIn: 'Bundesrepublik Deutschland',
    chamber: 'Handwerkskammer des Saarlandes',
    chamberAddress: 'Hohenzollernstraße 47–49, 66117 Saarbrücken',
    chamberUrl: 'https://www.hwk-saarland.de',
    regulation: 'Handwerksordnung (HwO)',
    regulationUrl: 'https://www.gesetze-im-internet.de/hwo/',
  },
  /** Zuständige Datenschutz-Aufsichtsbehörde (Saarland) */
  supervisoryAuthority: {
    name: 'Unabhängiges Datenschutzzentrum Saarland',
    subtitle: 'Landesbeauftragte für Datenschutz und Informationsfreiheit',
    street: 'Fritz-Dobisch-Straße 12',
    postalCode: '66111',
    city: 'Saarbrücken',
    url: 'https://www.datenschutz.saarland.de',
  },
  social: {
    instagram: 'https://www.instagram.com/baeckereiheusser',
    facebook: 'https://www.facebook.com/baeckereiheusser',
  },
} as const

export const LEGAL_LAST_UPDATED = '15.08.2026'

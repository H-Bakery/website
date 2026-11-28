/**
 * Links auf die Landingpage. Die App liegt auf GitHub Pages unter
 * `/digitale-baeckerei/` im Export der Landingpage - Impressum und
 * Datenschutzerklärung sind also deren Seiten auf demselben Ursprung.
 *
 * Die Pfade sind wurzelrelativ und gehören in ein einfaches `<a>` (auch MUI
 * `Link` oder `Button component="a"`), **nie** in `next/link`: Das hängt den
 * Unterpfad `/digitale-baeckerei` davor, und `/digitale-baeckerei/imprint`
 * gibt es nicht. Seiten der Landingpage: `apps/bakery-landing/src/app/`.
 */

/** Die Adresse der Landingpage, für absolute Angaben (Link-Vorschau). */
export const LANDING_URL = 'https://xn--bckerei-heusser-0kb.de'

/** Startseite der Landingpage. */
export const STARTSEITE_PFAD = '/'
/** Impressum der Landingpage. */
export const IMPRESSUM_PFAD = '/imprint'
/** Datenschutzerklärung der Landingpage. */
export const DATENSCHUTZ_PFAD = '/datenschutz'

export const STARTSEITE_TEXT = 'Zur Website'
export const IMPRESSUM_TEXT = 'Impressum'
export const DATENSCHUTZ_TEXT = 'Datenschutz'

/** Die Seite der App selbst, absolut (Link-Vorschau). */
export const APP_URL = `${LANDING_URL}/digitale-baeckerei/`

/** Ein Link in einem neuen Tab - die 3D-Ansicht bleibt offen. */
export const NEUER_TAB = {
  target: '_blank',
  rel: 'noopener noreferrer',
} as const

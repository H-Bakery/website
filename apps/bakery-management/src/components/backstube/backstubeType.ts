/**
 * Schriftgrößen des Backstube-Tablets (Z6) - eine Stelle für alle
 * Überschriften. Die Seite liegt außerhalb `/admin` (kein Layout-Kit), nimmt
 * aber dieselben Überschriften-Varianten des Themes (`h1`/`h2`: Schriftart,
 * Zeilenhöhe) und vergrößert sie nur - aus Armlänge lesbar.
 */
export const BS_TITLE_SX = {
  fontSize: { xs: '1.4rem', sm: '2.1rem' },
  fontWeight: 800,
  lineHeight: 1.15,
} as const

export const BS_SECTION_TITLE_SX = {
  fontSize: { xs: '1.5rem', sm: '1.9rem' },
  fontWeight: 800,
  lineHeight: 1.2,
} as const

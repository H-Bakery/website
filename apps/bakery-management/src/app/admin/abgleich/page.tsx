import React from 'react'
import AbgleichClient from './AbgleichClient'

export const metadata = {
  title: 'Abgleich Produktion ↔ Kasse - Bäckerei Heusser',
}

/**
 * Abgleich Produktion ↔ Kasse für den Inhaber: gebacken − CAP − verkauft −
 * Rest je Posten und Backtag, mit Ampel und CSV. Daten über
 * `GET /api/abgleich` (nur `inhaber`). Hinweise, keine Beweise.
 */
export default function AbgleichPage() {
  return <AbgleichClient />
}

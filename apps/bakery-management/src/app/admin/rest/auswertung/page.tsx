import React from 'react'
import RestAuswertungClient from './RestAuswertungClient'

export const metadata = {
  title: 'Rest-Auswertung - Bäckerei Heusser',
}

/**
 * M4 - Auswertung „Rest am Abend“ für den Inhaber: gebacken, verkauft, Rest
 * und Restquote je Posten über einen Zeitraum, Verlauf, CSV. Daten über
 * `GET /api/rest/summary` (nur `inhaber`).
 */
export default function RestAuswertungPage() {
  return <RestAuswertungClient />
}

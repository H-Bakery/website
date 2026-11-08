import DienstplanClient from './DienstplanClient'

export const metadata = {
  title: 'Dienstplan - Bäckerei Heusser',
}

/**
 * `/admin/dienstplan` - Kalender des Dienstplans (TASK-042, nur Inhaber mit
 * persönlicher Sitzung, im Pilotbetrieb gesperrt).
 *
 * Reine Server-Hülle: die Query-Parameter werden hier gelesen, damit die
 * Client-Komponente ohne `useSearchParams()` auskommt (Muster wie
 * `preorders/tag/page.tsx`). Die Client-Komponente prüft die Werte.
 *
 *   `?woche=JJJJ-MM-TT`  ein Tag der Woche (Vorgabe: diese Woche)
 *   `?ansicht=`          `woche` (Standard) | `monat` | `jahr`
 *   `?bereich=`          `verkauf` | `backstube` | `fahrer` | `buero` (Vorgabe: alle)
 */
export default async function DienstplanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = await searchParams
  const first = (key: string) => {
    const raw = query[key]
    return Array.isArray(raw) ? raw[0] : raw
  }
  return (
    <DienstplanClient
      week={first('woche')}
      view={first('ansicht')}
      area={first('bereich')}
    />
  )
}

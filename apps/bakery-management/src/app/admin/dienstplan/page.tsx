import { redirect } from 'next/navigation'

/**
 * `/admin/dienstplan` - hier entsteht der Kalender (TASK-042, Woche/Monat/
 * Jahr). Bis er steht, führt der Menüeintrag „Dienstplan“ zur
 * Mitarbeiterliste.
 */
export default function DienstplanPage() {
  redirect('/admin/dienstplan/mitarbeiter')
}

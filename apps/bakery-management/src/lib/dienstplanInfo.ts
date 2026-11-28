/**
 * Erklärtexte zu den Regeln der Stunden im Dienstplan - einmal hier, benutzt
 * von der Stundenübersicht (Info-Knöpfe und „So rechnet die App“), der
 * Schublade und dem Profil. Gerechnet wird nur in der API
 * (`vacation.core.js`); Werte wie die Minijob-Grenze kommen aus deren
 * Antwort (`limitCents`, dieselbe Konstante wie die Rechnung) und stehen
 * hier nie als Zahl im Text.
 */
import { formatCents } from './dienstplanApi'

export type HoursInfoKey =
  | 'bisHeute'
  | 'verrechnung'
  | 'schaetzung'
  | 'lohnkosten'
  | 'minijob'
  | 'woche'

export interface HoursInfo {
  title: string
  paragraphs: string[]
}

/** Was die Texte aus der API brauchen: Minijob-Grenze des Jahres. */
export interface HoursInfoContext {
  /** Grenze in Cent oder `null` (für das Jahr nicht hinterlegt). */
  minijobLimitCents: number | null
  /** Jahr des gezeigten Monats, `JJJJ`. */
  year: string
}

/** Reihenfolge in „So rechnet die App“. */
export const HOURS_INFO_ORDER: HoursInfoKey[] = [
  'bisHeute',
  'verrechnung',
  'woche',
  'schaetzung',
  'lohnkosten',
  'minijob',
]

export function hoursInfo(
  key: HoursInfoKey,
  ctx?: HoursInfoContext
): HoursInfo {
  switch (key) {
    case 'bisHeute':
      return {
        title: 'Bis heute oder ganzer Monat',
        paragraphs: [
          'Im laufenden Monat vergleicht die App Plan bis heute mit Soll bis heute - vom Ersten bis einschließlich heute. Daraus kommen die Überstunden und die geschätzte Bezahlung.',
          'Der ganze Monat (alles, was schon geplant ist) steht daneben, damit du siehst, wohin der Monat läuft.',
          'Ein vergangener Monat zählt ganz. Ein künftiger Monat zeigt nur geplant gegen Soll - Überstunden gibt es dort noch nicht.',
          '„Heute“ ist das Datum der Bäckerei-Box, nicht das deines Geräts.',
        ],
      }
    case 'verrechnung':
      return {
        title: 'Überstunden im Monat',
        paragraphs: [
          'Bezahlt wird der Monat: Minusstunden einer Woche gleichen Überstunden einer anderen Woche im selben Monat aus.',
          'Überstunden = Plan minus Soll des Monats (bis heute) - nur wenn mehr geplant ist als das Soll.',
          'Zwischen den Monaten wird nichts übertragen.',
        ],
      }
    case 'woche':
      return {
        title: 'Woche nur als Richtwert',
        paragraphs: [
          'Die Woche zeigt Plan minus Soll von Montag bis Sonntag und was das in Euro wäre.',
          'Bezahlt wird aber der Monat - dort gleichen sich Wochen mit Minus- und Überstunden aus. Für die Summe schaust du auf den Monat.',
        ],
      }
    case 'schaetzung':
      return {
        title: 'Geschätzte Bezahlung',
        paragraphs: [
          'Bezahlung = Überstunden × Stundenlohn (brutto), auf den Cent gerundet.',
          'Ohne Zuschläge (Nacht, Sonntag, Feiertag) und nach Plan - Ist-Stunden gibt es noch nicht.',
          'Eine Schätzung, keine Lohnabrechnung. Fehlt der Stundenlohn, steht „Stundenlohn offen“ statt eines Betrags.',
        ],
      }
    case 'lohnkosten':
      return {
        title: 'Lohnkosten (geschätzt)',
        paragraphs: [
          'Lohnkosten = geplante Stunden × Stundenlohn (brutto), ohne Arbeitgeberanteile und ohne Zuschläge.',
          'Im laufenden Monat siehst du die Kosten bis heute und für den ganzen Monat.',
          'Fehlt bei jemandem mit Schichten der Stundenlohn, heißt die Summe „mind. …“ und nennt, wie viele Löhne offen sind.',
        ],
      }
    case 'minijob': {
      const limit =
        ctx && ctx.minijobLimitCents !== null
          ? `Ein Minijob darf im Monat höchstens ${formatCents(
              ctx.minijobLimitCents
            )} verdienen (Stand ${ctx.year}; die Grenze hängt am Mindestlohn).`
          : `Für ${
              ctx?.year ?? 'dieses Jahr'
            } ist noch keine Minijob-Grenze hinterlegt - dann prüft die App nicht.`
      return {
        title: 'Minijob-Grenze',
        paragraphs: [
          limit,
          'Die App nimmt die geplanten Lohnkosten des ganzen Monats (Plan-Stunden × Stundenlohn) und warnt, wenn sie darüber liegen. Genau die Grenze ist noch in Ordnung.',
          'Das gilt nur für Personen mit Beschäftigung „Minijob“. Fehlt der Stundenlohn, ist die Prüfung „offen“.',
        ],
      }
    }
  }
}

/**
 * Öffnungszeiten des Ladens je Wochentag - **die eine Quelle** für die API
 * (Dienstplan: `days[].openingHours`, Besetzung des Verkaufs, Soll-Stunden
 * über `vacation.core.js`).
 *
 * Bewusst abhängigkeitsfreies CommonJS (Konvention wie `vacation.core.js`).
 * Die Landing-Page (`apps/bakery-landing/src/config/openingHours.ts`) ist ein
 * statischer Export und kann diese Datei nicht importieren; ihre Tabelle
 * prüft `apps/bakery-landing/src/config/openingHours.spec.ts` gegen diese
 * hier. Wer eine Zeit ändert, ändert sie hier **und** dort - sonst fällt die
 * Spec um.
 *
 * Ob ein Tag überhaupt offen ist, entscheidet nicht diese Tabelle allein:
 * Ruhetag (`closed_weekdays` aus der Finanz-Config, sonst Montag) und
 * Feiertage Saarland stehen in `vacation.core.js` (`dayInfo`). Ein Wochentag
 * ohne Zeiten hier (`null`) ist der Ruhetag der Tabelle; er muss mit
 * `DEFAULT_CLOSED_WEEKDAYS` in `vacation.core.js` übereinstimmen (Test).
 *
 * Wochentage ISO (1 = Montag … 7 = Sonntag), Uhrzeiten `HH:MM`.
 */

'use strict'

const OPENING_HOURS = Object.freeze({
  1: null, // Montag: Ruhetag
  2: Object.freeze({ opens: '05:30', closes: '13:30' }),
  3: Object.freeze({ opens: '05:30', closes: '13:30' }),
  4: Object.freeze({ opens: '05:30', closes: '13:30' }),
  5: Object.freeze({ opens: '05:30', closes: '13:30' }),
  6: Object.freeze({ opens: '05:30', closes: '12:30' }),
  7: Object.freeze({ opens: '08:00', closes: '11:00' }),
})

/**
 * Öffnungszeiten eines ISO-Wochentags laut Tabelle: `{ opens, closes }`
 * (eine neue Kopie) oder `null` (laut Tabelle geschlossen).
 */
function openingHoursForWeekday(weekday) {
  const hours = OPENING_HOURS[weekday]
  return hours ? { opens: hours.opens, closes: hours.closes } : null
}

/** ISO-Wochentage, an denen die Tabelle keine Zeiten hat. */
function weekdaysWithoutHours() {
  return [1, 2, 3, 4, 5, 6, 7].filter((wd) => !OPENING_HOURS[wd])
}

module.exports = {
  OPENING_HOURS,
  openingHoursForWeekday,
  weekdaysWithoutHours,
}

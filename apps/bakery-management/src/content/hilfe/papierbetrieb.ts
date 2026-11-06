/**
 * Papierbetrieb (P6, roadmap §6 M1/M3, docs/runbook.md §9): die Regel, wann
 * auf Papier umgestellt wird, und was die Formulare enthalten. Nur Text - die
 * Formulare selbst zeichnen `components/hilfe/*`.
 *
 * Die Regel muss zum Runbook passen (§2 „Wer macht was“, §8, §9): wer gerade
 * im Laden/in der Backstube steht, entscheidet; Schwelle 10 Minuten.
 */

import type { HilfeBlock } from './spickzettel'

/** Ab wie vielen Minuten Blockade auf Papier umgestellt wird. */
export const PAPIER_SCHWELLE_MINUTEN = 10

export const PAPIER_REGEL_TITEL = 'Papierbetrieb – wann und wie'

export const PAPIER_REGEL: readonly HilfeBlock[] = [
  {
    title: 'Wann',
    tone: 'warning',
    steps: [
      `Blockiert die App die Arbeit länger als **${PAPIER_SCHWELLE_MINUTEN} Minuten**, wird auf Papier umgestellt.`,
      'Beispiele: „Keine Verbindung zum Server“, Seite lädt nicht, Tablet aus, Anmeldung geht nicht.',
      'Erst arbeiten, dann reparieren. Niemand wartet auf die Technik.',
    ],
  },
  {
    title: 'Wer entscheidet',
    steps: [
      'Wer gerade im Laden bzw. in der Backstube steht – ohne Rückfrage.',
      'Danach sofort dem Inhaber Bescheid geben. Der ruft die Technik an.',
    ],
  },
  {
    title: 'Laden: Vorbestellungen',
    steps: [
      'Jede Vorbestellung auf einen **Vorbestellschein** (Stapel liegt an der Theke).',
      'Abholung heute oder morgen: die zuletzt gedruckte **Abholliste** benutzen und von Hand abhaken.',
      'Ausgefüllte Scheine in einem Fach sammeln – nichts wegwerfen.',
      'Vorbestellungen für morgen: Bescheid in die Backstube (Schein-Kopie oder Zuruf, auf dem Notfallblatt eintragen).',
    ],
  },
  {
    title: 'Backstube: Backzettel',
    steps: [
      'Den **letzten freigegebenen Ausdruck** des Tages verwenden.',
      'Keiner da? Den Ausdruck vom gleichen Wochentag der Vorwoche nehmen und von Hand korrigieren.',
      'Oder das **Backzettel-Notfallblatt** ausfüllen: Basis + Vorbestellt = Gesamt.',
    ],
  },
  {
    title: 'Wenn die App wieder geht: nachtragen',
    steps: [
      'Jeden Schein als **Neue Vorbestellung** erfassen – mit den Angaben vom Schein.',
      'In die **Notiz** schreiben: „Papier, angenommen am …“ (Tag und Uhrzeit vom Schein).',
      'Den neuen **Code** aus der App auf den Schein schreiben und **„in App übertragen“** ankreuzen.',
      'Schon übergeben oder bezahlt? Das in der Abholliste gleich mit abhaken.',
      'Scheine erst vernichten, wenn alle angekreuzt sind und die Ware abgeholt ist – sie tragen Namen und Telefonnummern.',
    ],
  },
]

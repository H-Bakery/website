/**
 * Fortschritt und Inhaltsverzeichnis des Backstube-Tablets (Z6/Z10). Rein,
 * ohne React: was erledigt bzw. gebacken ist, steht an den Zeilen vom Server
 * (`doneAt`, `bakedAt`); hier wird nur gezählt und gruppiert, wie die Seite
 * die Abschnitte zeigt. Keine Menge wird gerechnet.
 */

import type {
  BackzettelDay,
  BackzettelDeltaEntry,
  BackzettelLine,
  BackzettelSection,
  BakeList,
} from './backzettelApi'
import { isDoughDaySheet } from './backzettelApi'
import { bakeDayLabel, deltaAfterDone } from './backzettelFormat'
import { bakeDeltaGroups } from './backstubeBake'

/** Abgehakt, aber danach kam ein Nachtrag, der mehr backen heißt (UI-Runde 1). */
export function isReopened(
  line: BackzettelLine,
  deltas: BackzettelDeltaEntry[]
): boolean {
  const after = deltaAfterDone(line, deltas)
  return !!after && after.bake > 0
}

/** Zeile auf dem Zettel erledigt - ein Nachtrag danach öffnet sie wieder. */
export function isLineDone(
  line: BackzettelLine,
  deltas: BackzettelDeltaEntry[]
): boolean {
  return !!line.doneAt && !isReopened(line, deltas)
}

/**
 * Z10: die Abschnitte eines Teigtag-Zettels je Backtag - erst der Tag selbst,
 * dann „für Sonntag“, „für Dienstag“. Zeilen ohne `bakeDate` gehören dem
 * Zettel-Tag. Reihenfolge der Backtage wie `bakeDates` vom Server.
 */
export function sectionsByBakeDay(
  day: Pick<BackzettelDay, 'date' | 'sections' | 'bakeDates'>
): { bakeDate: string; sections: BackzettelSection[] }[] {
  const order = [
    day.date,
    ...(day.bakeDates ?? []).map((b) => b.date).filter((d) => d !== day.date),
  ]
  for (const s of day.sections) {
    for (const l of s.lines) {
      const d = l.bakeDate ?? day.date
      if (!order.includes(d)) order.push(d)
    }
  }
  return order
    .map((bakeDate) => ({
      bakeDate,
      sections: day.sections
        .map((s) => ({
          ...s,
          lines: s.lines.filter((l) => (l.bakeDate ?? day.date) === bakeDate),
        }))
        .filter((s) => s.lines.length > 0),
    }))
    .filter((g) => g.sections.length > 0)
}

/** Überschrift einer Backtag-Gruppe auf dem Teigtag-Zettel. */
export function bakeDayHeading(bakeDate: string, sheetDate: string): string {
  return bakeDate === sheetDate
    ? 'Heute backen'
    : `Teig ${bakeDayLabel(bakeDate, sheetDate)}`
}

/** Ein Eintrag im Überblick: Sprungziel + wie weit der Abschnitt ist. */
export interface BackstubeTocEntry {
  /** DOM-ID des Abschnitts (`bs-anchor-…`). */
  anchor: string
  label: string
  /** Backtag-Gruppe (Teigtag-Zettel), sonst `null`. */
  group: string | null
  done: number
  /** Zeilen mit Haken-Möglichkeit; 0 = nur Ansicht (Hefeteig-Karte, Entwurf). */
  total: number
}

export interface BackstubeProgress {
  done: number
  total: number
  entries: BackstubeTocEntry[]
}

/** DOM-ID eines Zettel-Abschnitts (`renderSection`-Schlüssel). */
export function sectionAnchor(id: string): string {
  return `bs-anchor-${id}`
}

export const HEFETEIG_ANCHOR = 'bs-anchor-hefeteig-card'
export const BAKE_DELTAS_ANCHOR = 'bs-anchor-bake-deltas'

function sectionEntry(
  section: BackzettelSection,
  id: string,
  group: string | null,
  isDone: (line: BackzettelLine) => boolean
): BackstubeTocEntry {
  return {
    anchor: sectionAnchor(id),
    label: section.label,
    group,
    done: section.lines.filter(isDone).length,
    total: section.lines.length,
  }
}

/**
 * Überblick des Zettels: „n von m erledigt“ und je Abschnitt (in der
 * Reihenfolge der Seite; Teigtag-Zettel je Backtag). Am Samstag steht die
 * Hefeteig-Karte zuerst, sonst zuletzt - wie auf der Seite.
 */
export function sheetProgress(
  day: Pick<
    BackzettelDay,
    | 'date'
    | 'sections'
    | 'bakeDates'
    | 'deltas'
    | 'status'
    | 'weekday'
    | 'hefeteig'
    | 'fillings'
    | 'deltaExtras'
    | 'sheetVersion'
  >
): BackstubeProgress {
  const isDone = (l: BackzettelLine) => isLineDone(l, day.deltas)
  const entries: BackstubeTocEntry[] = isDoughDaySheet(day)
    ? sectionsByBakeDay(day).flatMap((g) =>
        g.sections.map((s) =>
          sectionEntry(
            s,
            `${g.bakeDate}-${s.id}`,
            bakeDayHeading(g.bakeDate, day.date),
            isDone
          )
        )
      )
    : day.sections
        .filter((s) => s.lines.length > 0)
        .map((s) => sectionEntry(s, s.id, null, isDone))
  const hasHefeteig =
    (day.hefeteig?.doughs ?? []).length > 0 ||
    (day.fillings ?? []).length > 0 ||
    !!day.deltaExtras
  if (hasHefeteig) {
    const card: BackstubeTocEntry = {
      anchor: HEFETEIG_ANCHOR,
      label: 'Hefeteig & Füllungen',
      group: null,
      done: 0,
      total: 0,
    }
    if (day.weekday === 6) entries.unshift(card)
    else entries.push(card)
  }
  const lines = day.sections.flatMap((s) => s.lines)
  return {
    done: lines.filter(isDone).length,
    total: lines.length,
    entries,
  }
}

/** Zeile der Backliste gebacken (ein Entwurf hat keinen Haken). */
export function isLineBaked(line: BackzettelLine): boolean {
  return line.sheetStatus !== 'draft' && !!line.bakedAt
}

/**
 * Überblick der Backliste: „n von m gebacken“ je Abschnitt, dazu die
 * Nachträge mit Haken (ohne „−3“/„±0“, die nichts zu backen haben).
 */
export function bakeProgress(
  list: Pick<BakeList, 'sections' | 'deltas'>
): BackstubeProgress {
  const entries = list.sections
    .filter((s) => s.lines.length > 0)
    .map((s) => ({
      anchor: `bs-anchor-bake-${s.id}`,
      label: s.label,
      group: null,
      done: s.lines.filter(isLineBaked).length,
      total: s.lines.length,
    }))
  const all = bakeDeltaGroups(list)
  const groups = all.filter((g) => g.tickable)
  if (all.length > 0) {
    entries.push({
      anchor: BAKE_DELTAS_ANCHOR,
      label: 'Nachträge',
      group: null,
      done: groups.filter((g) => g.checked).length,
      total: groups.length,
    })
  }
  const lines = list.sections.flatMap((s) => s.lines)
  return {
    done: lines.filter(isLineBaked).length,
    total: lines.length,
    entries,
  }
}

/**
 * UI-Runde 2: welche Zeilen eines Abschnitts stehen, wenn Erledigte
 * zugeklappt sind. Offene Zeilen bleiben in ihrer Reihenfolge; `keep`
 * (gerade abgehakt - der Haken lässt sich noch zurücknehmen) bleibt kurz
 * stehen. Gezählt wird nur, was `isDone` sagt.
 */
export function splitDone<T>(
  lines: T[],
  isDone: (line: T) => boolean,
  keep: (line: T) => boolean = () => false
): { shown: T[]; hidden: T[] } {
  const shown: T[] = []
  const hidden: T[] = []
  for (const l of lines) (isDone(l) && !keep(l) ? hidden : shown).push(l)
  return { shown, hidden }
}

/**
 * Bäcker-Ansicht: mit welchem Abschnitt sie beginnt - dem ersten, in dem
 * noch etwas offen ist; ist alles erledigt (oder nichts abhakbar), dem
 * ersten überhaupt. `-1` = keine Abschnitte.
 */
export function focusStartIndex(entries: BackstubeTocEntry[]): number {
  if (entries.length === 0) return -1
  const open = entries.findIndex((e) => e.total > 0 && e.done < e.total)
  return open >= 0 ? open : 0
}

/** Nächster Abschnitt mit offenen Zeilen nach `from` (ringsum), sonst `-1`. */
export function nextOpenIndex(
  entries: BackstubeTocEntry[],
  from: number
): number {
  for (let i = 1; i < entries.length; i++) {
    const j = (from + i) % entries.length
    const e = entries[j]
    if (e.total > 0 && e.done < e.total) return j
  }
  return -1
}

/** Offene (nicht quittierte) Nachträge - für den kurzen Hinweis „n neu“. */
export function openDeltaCount(deltas: BackzettelDeltaEntry[]): number {
  return deltas.filter((d) => !d.acknowledgedAt).length
}

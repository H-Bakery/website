import type { FormProblems } from '../../../lib/recipeForm'

/** Meldung über der Speichern-Leiste, wenn Angaben nicht gespeichert werden können. */
export function problemsMessage(problems: FormProblems): string {
  return problems.count === 1
    ? 'Nicht gespeichert: bitte die markierte Angabe prüfen.'
    : `Nicht gespeichert: bitte die ${problems.count} markierten Angaben prüfen.`
}

/**
 * Setzt den Cursor in das erste markierte Feld - nach dem nächsten Rendern,
 * wenn die Markierungen im DOM stehen. Die Speichern-Leiste klebt unten; das
 * Feld, um das es geht, liegt sonst oft außer Sicht.
 */
export function focusFirstProblem(): void {
  if (typeof window === 'undefined') return
  window.setTimeout(() => {
    const field = document.querySelector<HTMLElement>(
      '[role="form"] [aria-invalid="true"]'
    )
    field?.focus()
  }, 0)
}

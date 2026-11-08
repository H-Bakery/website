/**
 * Text in die Zwischenablage. Zuerst die Clipboard-API (nur in sicherem
 * Kontext), sonst das alte `execCommand('copy')`. `false` heißt: der Nutzer
 * muss selbst kopieren - die Oberfläche markiert den Text dann.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // weiter mit dem Rückweg
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok =
      typeof document.execCommand === 'function' && document.execCommand('copy')
    document.body.removeChild(area)
    return Boolean(ok)
  } catch {
    return false
  }
}

/** Markiert den Inhalt eines Elements, damit Strg+C/⌘+C ihn kopiert. */
export function selectElementText(element: HTMLElement | null): void {
  if (!element || typeof window.getSelection !== 'function') return
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.selectNodeContents(element)
  selection.removeAllRanges()
  selection.addRange(range)
}

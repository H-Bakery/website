import { TOUCH_MEDIA } from '../muiTheme'

/**
 * Prüft in Specs die Layout-Kit-Regel „Touch-Ziele ≥ 44 px“ für eigene
 * klickbare Flächen: liefert die CSS-Eigenschaften, die Emotion für das
 * Element unter `TOUCH_MEDIA` eingefügt hat (z. B. `{ 'min-height':
 * '44px' }`). jsdom wertet keine Media-Queries aus, darum wird die
 * eingefügte Regel gelesen, nicht die berechnete Höhe.
 *
 * Mit `descendant` (z. B. `' svg'` für `'& svg'` im `sx`) liest sie die
 * Regel für ein Kind des Elements.
 */
export function touchStyle(
  element: Element,
  descendant = ''
): Record<string, string> {
  const media = normalize(TOUCH_MEDIA.replace(/^@media\s*/, ''))
  const selectors = new Set(
    Array.from(element.classList).map((c) => `.${c}${descendant}`)
  )
  const out: Record<string, string> = {}
  for (const sheet of Array.from(document.styleSheets)) {
    for (const rule of Array.from(sheet.cssRules)) {
      if (!(rule instanceof CSSMediaRule)) continue
      if (normalize(rule.media.mediaText) !== media) continue
      for (const inner of Array.from(rule.cssRules)) {
        if (!(inner instanceof CSSStyleRule)) continue
        if (!selectors.has(inner.selectorText.trim())) continue
        for (const name of Array.from(inner.style)) {
          out[name] = inner.style.getPropertyValue(name)
        }
      }
    }
  }
  return out
}

function normalize(media: string): string {
  return media.replace(/\s+/g, '')
}

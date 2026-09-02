/**
 * Stub für `react-markdown` und `remark-gfm`.
 *
 * Beide Pakete werden als reines ESM ausgeliefert; jest transformiert
 * node_modules nicht, deshalb bricht schon der Import des Barrels
 * `@bakery/shared/ui` ab (es zieht `display/markdown-display.tsx` mit).
 * Der Shop rendert nirgends Markdown — ein Platzhalter genügt.
 */
const React = require('react')

function MarkdownStub(props) {
  return React.createElement(
    'div',
    { 'data-testid': 'markdown-stub' },
    props && props.children
  )
}

module.exports = MarkdownStub
module.exports.default = MarkdownStub
module.exports.__esModule = true

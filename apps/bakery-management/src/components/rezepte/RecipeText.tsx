'use client'
import React from 'react'
import { Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'

/**
 * Zeigt den Markdown-Text eines Rezepts (Notizen, Beschreibung, ein Schritt
 * mit Unterpunkten, wörtlich übernommene Abschnitte wie „Fehlerquellen“).
 *
 * Bewusst klein und ohne Paket: die Rezepte in hq kennen nur Absätze,
 * Aufzählungen (auch eingerückt und `- [ ]`), nummerierte Listen, `**fett**`,
 * `*kursiv*`, Zwischenüberschriften und Tabellen. Was hier nicht gedeutet
 * wird, erscheint als Text - es fällt nie etwas weg. HTML im Text wird nicht
 * ausgeführt (React setzt es als Text).
 */

export type TextBlock =
  | { kind: 'paragraph'; lines: string[] }
  | { kind: 'heading'; text: string }
  | { kind: 'list'; ordered: boolean; items: ListItem[] }
  | {
      kind: 'table'
      head: string[] | null
      align: ('left' | 'right' | 'center')[]
      rows: string[][]
    }

export interface ListItem {
  text: string
  children: TextBlock[]
}

const LIST_LINE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/
const HEADING_LINE = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/
const TABLE_LINE = /^\s*\|.*\|\s*$/
const SEPARATOR_CELL = /^:?-{1,}:?$/
const CHECKBOX = /^\[[ xX]\]\s+/

function indentOf(line: string): number {
  return /^\s*/.exec(line)?.[0].replace(/\t/g, '    ').length ?? 0
}

function cells(line: string): string[] {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return inner.split('|').map((cell) => cell.trim())
}

function isSeparator(line: string): boolean {
  const row = cells(line)
  return row.length > 0 && row.every((cell) => SEPARATOR_CELL.test(cell))
}

/** Zerlegt den Text in Blöcke (für die Anzeige und für Tests). */
export function parseRecipeText(text: string): TextBlock[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const blocks: TextBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      i += 1
      continue
    }
    const heading = HEADING_LINE.exec(line)
    if (heading) {
      blocks.push({ kind: 'heading', text: heading[1] })
      i += 1
      continue
    }
    if (TABLE_LINE.test(line)) {
      const tableLines: string[] = []
      while (i < lines.length && TABLE_LINE.test(lines[i])) {
        tableLines.push(lines[i])
        i += 1
      }
      const hasHead = tableLines.length > 1 && isSeparator(tableLines[1])
      const align = hasHead
        ? cells(tableLines[1]).map((cell) =>
            cell.startsWith(':') && cell.endsWith(':')
              ? ('center' as const)
              : cell.endsWith(':')
              ? ('right' as const)
              : ('left' as const)
          )
        : []
      blocks.push({
        kind: 'table',
        head: hasHead ? cells(tableLines[0]) : null,
        align,
        rows: tableLines
          .slice(hasHead ? 2 : 0)
          .filter((row) => !isSeparator(row))
          .map(cells),
      })
      continue
    }
    const first = LIST_LINE.exec(line)
    if (first) {
      const base = indentOf(line)
      const ordered = /\d/.test(first[2])
      const items: { text: string; rest: string[] }[] = []
      while (i < lines.length) {
        const current = lines[i]
        if (current.trim() === '') {
          // Eine Leerzeile beendet die Liste - außer es geht mit einem
          // weiteren Punkt oder eingerückt weiter.
          const next = lines[i + 1]
          if (next === undefined || next.trim() === '') break
          const nextIndent = indentOf(next)
          const continues =
            nextIndent > base || (LIST_LINE.test(next) && nextIndent === base)
          if (!continues) break
          i += 1
          continue
        }
        const match = LIST_LINE.exec(current)
        const indent = indentOf(current)
        if (match && indent <= base + 1) {
          // Weniger eingerückt oder die andere Listenart: eine neue Liste.
          if (indent < base || /\d/.test(match[2]) !== ordered) break
          items.push({ text: match[3].replace(CHECKBOX, ''), rest: [] })
        } else if (indent > base && items.length > 0) {
          items[items.length - 1].rest.push(current)
        } else {
          break
        }
        i += 1
      }
      blocks.push({
        kind: 'list',
        ordered,
        items: items.map((item) => ({
          text: item.text,
          children: item.rest.length
            ? parseRecipeText(dedent(item.rest).join('\n'))
            : [],
        })),
      })
      continue
    }
    const paragraph: string[] = []
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !LIST_LINE.test(lines[i]) &&
      !TABLE_LINE.test(lines[i]) &&
      !HEADING_LINE.test(lines[i])
    ) {
      paragraph.push(lines[i].trim())
      i += 1
    }
    blocks.push({ kind: 'paragraph', lines: paragraph })
  }
  return blocks
}

function dedent(lines: string[]): string[] {
  const indents = lines
    .filter((line) => line.trim() !== '')
    .map((line) => indentOf(line))
  const cut = indents.length ? Math.min(...indents) : 0
  return lines.map((line) => line.replace(/\t/g, '    ').slice(cut))
}

const INLINE = /(\*\*[^*]+?\*\*|__[^_]+?__|\*[^*\s][^*]*?\*|`[^`]+?`)/g

/** `**fett**`, `*kursiv*` und `` `wörtlich` `` in einer Zeile. */
export function renderInlineText(text: string): React.ReactNode {
  const parts = text.split(INLINE)
  if (parts.length === 1) return text
  return parts.map((part, index) => {
    if (index % 2 === 0)
      return <React.Fragment key={index}>{part}</React.Fragment>
    if (part.startsWith('**') || part.startsWith('__')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`'))
      return <span key={index}>{part.slice(1, -1)}</span>
    return <em key={index}>{part.slice(1, -1)}</em>
  })
}

function renderBlock(block: TextBlock, key: number): React.ReactNode {
  switch (block.kind) {
    case 'heading':
      return (
        <p key={key} className="recipe-text-heading">
          <strong>{renderInlineText(block.text)}</strong>
        </p>
      )
    case 'paragraph':
      return (
        <p key={key}>
          {block.lines.map((line, index) => (
            <React.Fragment key={index}>
              {index > 0 && <br />}
              {renderInlineText(line)}
            </React.Fragment>
          ))}
        </p>
      )
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul'
      return (
        <Tag key={key}>
          {block.items.map((item, index) => (
            <li key={index}>
              {renderInlineText(item.text)}
              {item.children.map(renderBlock)}
            </li>
          ))}
        </Tag>
      )
    }
    case 'table':
      return (
        <div key={key} className="recipe-text-table">
          <table>
            {block.head && (
              <thead>
                <tr>
                  {block.head.map((cell, index) => (
                    <th
                      key={index}
                      scope="col"
                      style={{ textAlign: block.align[index] ?? 'left' }}
                    >
                      {renderInlineText(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, index) => (
                    <td
                      key={index}
                      style={{ textAlign: block.align[index] ?? 'left' }}
                    >
                      {renderInlineText(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    default:
      return null
  }
}

/** Abstände und Tabellenlinien des Rezepttexts - erbt Schriftgröße und Farbe. */
export const RECIPE_TEXT_SX = {
  overflowWrap: 'anywhere',
  '& p': { m: 0 },
  '& p + p, & p + ul, & p + ol, & ul + p, & ol + p, & .recipe-text-table + p, & p + .recipe-text-table':
    { mt: 1 },
  '& ul, & ol': { m: 0, pl: 3 },
  '& li': { py: 0.25 },
  '& li > ul, & li > ol': { mt: 0.25 },
  '& .recipe-text-heading': { mt: 1.5 },
  '& .recipe-text-heading:first-of-type': { mt: 0 },
  '& .recipe-text-table': { overflowX: 'auto', maxWidth: '100%' },
  '& table': { borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' },
  '& th, & td': {
    borderBottom: 1,
    borderColor: 'divider',
    px: 1.5,
    py: 0.75,
    verticalAlign: 'top',
  },
  '& th:first-of-type, & td:first-of-type': { pl: 0 },
  '& th': { fontWeight: 600 },
} as const

export interface RecipeTextProps {
  text: string
  sx?: SxProps<Theme>
  'data-testid'?: string
}

export default function RecipeText({
  text,
  sx,
  'data-testid': testId,
}: RecipeTextProps) {
  const blocks = React.useMemo(() => parseRecipeText(text), [text])
  return (
    <Box
      data-testid={testId}
      sx={[RECIPE_TEXT_SX, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
    >
      {blocks.map(renderBlock)}
    </Box>
  )
}

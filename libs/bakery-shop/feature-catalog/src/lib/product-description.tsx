'use client'

/**
 * @fileoverview Fließtext eines Produkts aus dem hq-Markdown.
 *
 * Die Beschreibungen sind Markdown-Rümpfe: meist ein Absatz, vereinzelt mit
 * Zwischenüberschrift und Aufzählung. Statt `react-markdown` (schwer, bricht
 * die Jest-Läufe) genügt hier ein winziger Parser für genau diese drei Formen.
 */

import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }

/** Entfernt Auszeichnungszeichen, die als Text nichts verloren haben. */
function stripMarks(value: string): string {
  return value
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .trim()
}

export function parseDescription(raw: string): Block[] {
  const blocks: Block[] = []

  for (const chunk of raw.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const lines = chunk
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    if (lines.length === 0) continue

    let paragraph: string[] = []
    let items: string[] = []

    const flushParagraph = () => {
      if (paragraph.length === 0) return
      blocks.push({ kind: 'paragraph', text: stripMarks(paragraph.join(' ')) })
      paragraph = []
    }
    const flushList = () => {
      if (items.length === 0) return
      blocks.push({ kind: 'list', items })
      items = []
    }

    for (const line of lines) {
      if (/^#{1,6}\s+/.test(line)) {
        flushParagraph()
        flushList()
        blocks.push({
          kind: 'heading',
          text: stripMarks(line.replace(/^#{1,6}\s+/, '')),
        })
      } else if (/^[-*]\s+/.test(line)) {
        flushParagraph()
        items.push(stripMarks(line.replace(/^[-*]\s+/, '')))
      } else {
        flushList()
        paragraph.push(line)
      }
    }

    flushParagraph()
    flushList()
  }

  return blocks
}

export function ProductDescription({ text }: { text: string }) {
  const blocks = React.useMemo(() => parseDescription(text), [text])
  if (blocks.length === 0) return null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          return (
            <Typography
              key={index}
              variant="h6"
              component="h3"
              sx={{ mt: index === 0 ? 0 : 1 }}
            >
              {block.text}
            </Typography>
          )
        }
        if (block.kind === 'list') {
          return (
            <Box
              key={index}
              component="ul"
              sx={{
                m: 0,
                pl: 3,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5,
              }}
            >
              {block.items.map((item, itemIndex) => (
                <Typography
                  key={itemIndex}
                  component="li"
                  variant="body1"
                  sx={{ color: 'text.primary' }}
                >
                  {item}
                </Typography>
              ))}
            </Box>
          )
        }
        return (
          <Typography
            key={index}
            variant="body1"
            sx={{ color: 'text.primary' }}
          >
            {block.text}
          </Typography>
        )
      })}
    </Box>
  )
}

export default ProductDescription

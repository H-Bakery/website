import React from 'react'
import { Box } from '@mui/material'
import type { HilfeBlock } from '../../content/hilfe/spickzettel'
import { renderInline, type SheetId } from './hilfePrint'

/**
 * Ein Hilfeblatt aus Abschnitten (Spickzettel einer Rolle oder die
 * Papier-Regel): auf dem Bildschirm eine Karte, gedruckt eine A4-Seite in zwei
 * Spalten (Druckbild in `hilfePrint.tsx`, Klasse `.spickzettel`).
 */
export default function HilfeSheet({
  id,
  title,
  intro,
  blocks,
  printDefault = false,
  poster = false,
  footer,
  children,
}: {
  id: SheetId
  title: string
  intro: string
  blocks: readonly HilfeBlock[]
  /** Dieses Blatt druckt Strg+P (ohne Knopf). */
  printDefault?: boolean
  /** Aushang: gedruckt größere Schrift (Papier-Regel an der Wand). */
  poster?: boolean
  footer?: React.ReactNode
  /** Zusatz unter den Abschnitten (z. B. Telefonnummern zum Eintragen). */
  children?: React.ReactNode
}) {
  return (
    <Box
      component="article"
      className={`hilfe-sheet spickzettel${poster ? ' sz-poster' : ''}`}
      data-sheet={id}
      data-print-default={printDefault ? 'true' : undefined}
      data-testid={`sheet-${id}`}
      aria-label={title}
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        p: { xs: 2, sm: 3 },
      }}
    >
      <Box
        component="h2"
        sx={{ typography: 'h5', fontWeight: 700, m: 0, mb: 0.5 }}
      >
        {title}
      </Box>
      <Box
        component="p"
        className="sz-intro"
        sx={{ typography: 'body1', color: 'text.secondary', m: 0, mb: 2 }}
      >
        {intro}
      </Box>
      <Box
        className="sz-grid"
        sx={{ columnCount: { xs: 1, md: 2 }, columnGap: 3 }}
      >
        {blocks.map((block) => (
          <Box
            component="section"
            key={block.title}
            className={`sz-block${
              block.tone === 'warning' ? ' sz-warning' : ''
            }`}
            sx={{
              // Kein Einblenden (global.css: section → sectionFadeIn): beim
              // Reiterwechsel stünde der Text sonst kurz halb durchsichtig da.
              animation: 'none',
              breakInside: 'avoid',
              border: block.tone === 'warning' ? 2 : 1,
              borderColor:
                block.tone === 'warning' ? 'warning.main' : 'divider',
              borderRadius: 1,
              p: 1.5,
              mb: 2,
              display: 'inline-block',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            <Box
              component="h3"
              sx={{ typography: 'subtitle1', fontWeight: 700, m: 0, mb: 0.5 }}
            >
              {block.title}
            </Box>
            <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
              {block.steps.map((step) => (
                <Box
                  component="li"
                  key={step}
                  sx={{ typography: 'body1', mb: 0.5 }}
                >
                  {renderInline(step)}
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
      {children}
      {footer && (
        <Box
          component="p"
          className="sz-foot"
          sx={{ typography: 'body2', color: 'text.secondary', m: 0, mt: 1 }}
        >
          {footer}
        </Box>
      )}
    </Box>
  )
}

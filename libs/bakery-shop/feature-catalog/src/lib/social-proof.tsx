'use client'

/**
 * @fileoverview Vertrauen — mit Belegen, nicht mit Behauptungen.
 *
 * Alles in dieser Sektion stammt aus `@bakery/shared/utils` und ist dort mit
 * Quelle hinterlegt: echte Google-Rezensionen im vollen Wortlaut, die echte
 * Durchschnittsnote und das echte Gründungsjahr. Keine erfundenen Namen, keine
 * „Verifiziert“-Plaketten, keine Auswahl nur der Fünf-Sterne-Stimmen — die
 * Drei-Sterne-Rezension steht mit drin (§ 5b Abs. 3 UWG).
 *
 * Typografie: die Note ist eine **Kennzahl**, keine Überschrift. Sie stand
 * vorher als `h2` direkt unter der `h2` der Sektion — zwei gleich laute
 * Zeilen übereinander, und keine sagte, welche die Überschrift ist. Jetzt
 * eine Stufe darunter (`h3`), mit Ziffern gleicher Breite.
 */

import * as React from 'react'
import Box from '@mui/material/Box'
import Paper from '@mui/material/Paper'
import Rating from '@mui/material/Rating'
import Typography from '@mui/material/Typography'
import FormatQuoteIcon from '@mui/icons-material/FormatQuote'

import {
  BRAND_FACTS,
  CUSTOMER_REVIEWS,
  REVIEW_SUMMARY,
} from '@bakery/shared/utils'

import { GRID_GAP, HEADING_GAP } from './storefront-rhythm'

export function SocialProof() {
  const average = REVIEW_SUMMARY.average.toLocaleString('de-DE')

  return (
    <Box data-testid="social-proof">
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: { xs: 1.5, md: 3 },
          mb: HEADING_GAP,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Typography
            variant="h3"
            component="p"
            sx={{
              color: 'primary.main',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {average}
          </Typography>
          <Box>
            <Rating
              value={REVIEW_SUMMARY.average}
              precision={0.5}
              readOnly
              size="small"
              aria-label={`Durchschnittlich ${average} von 5 Sternen`}
            />
            {/* Der Stand gehört dazu: die Zahl ist ein Momentwert von 2025
                und darf sich später nicht als tagesaktuell ausgeben. */}
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary', mt: 0.25 }}
            >
              {REVIEW_SUMMARY.count} {REVIEW_SUMMARY.source}-Bewertungen, Stand{' '}
              {REVIEW_SUMMARY.asOf}
            </Typography>
          </Box>
        </Box>

        <Box
          aria-hidden="true"
          sx={{
            display: { xs: 'none', md: 'block' },
            width: '1px',
            alignSelf: 'stretch',
            bgcolor: 'divider',
          }}
        />

        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Familienbetrieb seit {BRAND_FACTS.foundedYear} – in dritter
          Generation, alles aus der eigenen Backstube.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: GRID_GAP,
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(3, minmax(0, 1fr))',
          },
        }}
      >
        {CUSTOMER_REVIEWS.map((review) => (
          <Paper
            key={review.name}
            variant="outlined"
            sx={{
              display: 'flex',
              flexDirection: 'column',
              p: { xs: 2, md: 2.5 },
            }}
          >
            <FormatQuoteIcon
              aria-hidden="true"
              sx={{ color: 'grey.300', fontSize: 26, mb: 0.5 }}
            />
            <Typography
              variant="body2"
              sx={{ color: 'text.primary', flexGrow: 1, lineHeight: 1.65 }}
            >
              {review.text}
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                mt: 2,
                pt: 1.5,
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              {/* Fließschrift: ein Name in Kapitälchen ist schwerer zu lesen
                  als in gemischter Schreibung. */}
              <Typography variant="subtitle2" component="p">
                {review.name}
              </Typography>
              <Rating
                value={review.stars}
                readOnly
                size="small"
                aria-label={`${review.stars} von 5 Sternen`}
              />
            </Box>
          </Paper>
        ))}
      </Box>
    </Box>
  )
}

export default SocialProof

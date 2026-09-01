'use client'

/**
 * @fileoverview Der Hero der Startseite — das Bild verkauft, nicht der Satz.
 *
 * Für Backwaren ist die Fotografie der stärkste Hebel; ein reiner Textblock
 * verschenkt ihn. Links steht deshalb nur so viel Text, wie eine Entscheidung
 * braucht (wer wir sind, was man hier tut, ein Weg hinein), rechts ein echtes
 * Foto aus der Backstube mit der Abholauskunft darauf.
 *
 * Bewusst geteiltes Layout statt Vollbild mit Textschleier: das Motiv ist im
 * Hochformat, und Text auf Foto ist immer ein Kontrastrisiko.
 *
 * Reihenfolge links: Suchfeld → „Oft gesucht“ → Katalogknopf. Die Vorschläge
 * gehören zur Suche und standen vorher durch den Katalogknopf von ihr
 * getrennt; so las man sie als Beiwerk statt als Einstieg ins Feld darüber.
 *
 * Farben auf dem dunklen Band sind gerechnet, nicht geschätzt (Grund:
 * `primary.dark` #3B2B28): `grey.300` trägt allen kleinen Text mit 7,89:1,
 * und auch die Rahmen von Chips und Umriss-Knopf — `grey.400` blieb dort mit
 * 2,96:1 unter der 3:1-Schwelle für Bedienelement-Rahmen (WCAG 1.4.11).
 */

import * as React from 'react'
import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Container from '@mui/material/Container'
import InputAdornment from '@mui/material/InputAdornment'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import SearchIcon from '@mui/icons-material/Search'

import { BRAND_FACTS } from '@bakery/shared/utils'

import { BakeryPhoto } from './bakery-photo'
import { PickupStatusCard } from './pickup-status-card'
import { BAND_Y, SURFACE_RADIUS } from './storefront-rhythm'

/**
 * Einstiege für die Suche. Jeder Begriff hat im hq-Bestand echte Treffer —
 * ein Vorschlag, der ins Leere führt, ist schlimmer als gar keiner.
 */
const QUICK_SEARCHES: ReadonlyArray<string> = [
  'Brötchen',
  'Croissant',
  'Laugen',
  'Streuselkuchen',
]

export interface StorefrontHeroProps {
  /** Anzahl der Sorten – erst gesetzt, wenn die Daten da sind. */
  productCount: number
}

export function StorefrontHero({ productCount }: StorefrontHeroProps) {
  const router = useRouter()
  const [query, setQuery] = React.useState('')

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmed = query.trim()
    router.push(
      trimmed ? `/products?q=${encodeURIComponent(trimmed)}` : '/products'
    )
  }

  return (
    <Box
      component="section"
      sx={{
        bgcolor: 'primary.dark',
        color: 'common.white',
        overflow: 'hidden',
      }}
    >
      <Container sx={{ py: BAND_Y }}>
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 4, md: 6 },
            gridTemplateColumns: {
              xs: '1fr',
              md: 'minmax(0, 6fr) minmax(0, 5fr)',
            },
            alignItems: 'center',
          }}
        >
          <Box>
            <Typography
              variant="overline"
              component="p"
              sx={{ color: 'warning.main', mb: 1.5 }}
            >
              Seit {BRAND_FACTS.foundedYear} · Familienbetrieb in dritter
              Generation
            </Typography>

            {/* Die einzige Stelle im Laden, an der die Display-Serife groß
                auftreten darf. Bewusst über der Theme-Skala: ein Hero, der
                so laut ist wie eine Sektionsüberschrift, ist keiner. */}
            <Typography
              variant="h1"
              sx={{
                color: 'common.white',
                mb: 2,
                fontSize: { xs: '2.125rem', md: '3rem' },
                lineHeight: 1.12,
              }}
            >
              Frisch aus dem Ofen – für Sie zurückgelegt
            </Typography>

            <Typography
              variant="body1"
              sx={{
                color: 'grey.300',
                maxWidth: 520,
                mb: 3,
                fontSize: { md: '1.0625rem' },
              }}
            >
              Suchen Sie sich in Ruhe aus, was Sie mögen. Wir legen alles
              zurück, Sie holen es in der {BRAND_FACTS.street} ab – ohne
              Anstehen.
            </Typography>

            <Box
              component="form"
              role="search"
              onSubmit={handleSearch}
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1.5,
              }}
            >
              <TextField
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Kornbrot, Croissant, Käsekuchen …"
                aria-label="Produkte durchsuchen"
                size="medium"
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon
                        fontSize="small"
                        sx={{ color: 'text.secondary' }}
                      />
                    </InputAdornment>
                  ),
                }}
                inputProps={{ 'data-testid': 'home-search-input' }}
              />
              <Button
                type="submit"
                variant="contained"
                color="secondary"
                size="large"
                sx={{ flexShrink: 0, px: 3 }}
              >
                Suchen
              </Button>
            </Box>

            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 1,
                mt: 2,
              }}
            >
              <Typography variant="caption" sx={{ color: 'grey.300' }}>
                Oft gesucht:
              </Typography>
              {QUICK_SEARCHES.map((term) => (
                <Chip
                  key={term}
                  component={NextLink}
                  href={`/products?q=${encodeURIComponent(term)}`}
                  clickable
                  size="small"
                  label={term}
                  variant="outlined"
                  sx={{
                    color: 'common.white',
                    borderColor: 'grey.300',
                    bgcolor: (theme) => alpha(theme.palette.common.white, 0.06),
                    '&:hover': {
                      bgcolor: (theme) =>
                        alpha(theme.palette.common.white, 0.16),
                    },
                  }}
                />
              ))}
            </Box>

            <Button
              component={NextLink}
              href="/products"
              variant="outlined"
              size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{
                mt: 3,
                color: 'common.white',
                borderColor: 'grey.300',
                '&:hover': {
                  borderColor: 'common.white',
                  backgroundColor: (theme) =>
                    alpha(theme.palette.common.white, 0.08),
                },
              }}
            >
              {productCount > 0
                ? `Alle ${productCount} Sorten ansehen`
                : 'Alles ansehen'}
            </Button>
          </Box>

          {/* Foto mit aufliegender Abholauskunft. */}
          <Box sx={{ position: 'relative' }}>
            <BakeryPhoto
              name="fresh-bread-hero"
              alt="Frisch gebackene Brotlaibe aus der Backstube der Bäckerei Heusser"
              ratio="4 / 5"
              sizes="(max-width: 900px) 100vw, 40vw"
              eager
              sx={{
                borderRadius: SURFACE_RADIUS,
                boxShadow: 10,
                // Am Handy flacher – hochkant fräse das Foto sonst die halbe
                // Seite weg, bevor der erste Satz gelesen ist. Am Desktop
                // quadratisch: hochkant wurde der Hero 740 px hoch und schob
                // alles Verkaufende unter die Falz.
                aspectRatio: { xs: '16 / 10', md: '1 / 1' },
              }}
            />
            <Box
              sx={{
                position: { xs: 'static', sm: 'absolute' },
                left: { sm: 16 },
                right: { sm: 16 },
                bottom: { sm: -18 },
                mt: { xs: 2, sm: 0 },
              }}
            >
              <PickupStatusCard />
            </Box>
          </Box>
        </Box>
      </Container>
    </Box>
  )
}

export default StorefrontHero

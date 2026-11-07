'use client'
import React from 'react'
import { Box, Button, Typography } from '@mui/material'
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import Link from 'next/link'

/**
 * Seitenrahmen der Verwaltung (Layout-Kit, siehe README.md daneben).
 *
 * Jede Seite unter `/admin` besteht aus genau einem `PageLayout`: Kopf
 * (`PageHeader`: h1, eine Zeile Untertitel, Rücklink, Aktionen, Status) und
 * darunter die Abschnitte (`PageSection`) mit festem Abstand. Den äußeren
 * Rand (Gutter) setzt die App-Hülle (`admin/layout.tsx`) - eine Seite gibt
 * keinen eigenen `p`/`Container` mehr dazu, sonst ist sie doppelt gepolstert.
 */

/** Breite je Seitentyp: Formular schmal, Übersicht Standard, Tabellen breit. */
export type PageWidth = 'narrow' | 'default' | 'wide' | 'full'

export const PAGE_MAX_WIDTH: Record<PageWidth, number | 'none'> = {
  narrow: 760,
  default: 1200,
  wide: 1600,
  full: 'none',
}

/**
 * Mindestbreite des Titelblocks neben den Kopf-Aktionen. Passen Titel und
 * Aktionen nicht nebeneinander, stehen die Aktionen darunter.
 */
export const HEADER_TITLE_MIN_WIDTH = '25rem'

/** Abstand zwischen Abschnitten (MUI-Spacing-Einheiten, 8 px). */
export const SECTION_GAP = { xs: 2, md: 3 } as const

export interface PageBackLink {
  href: string
  /** Sichtbarer Text, z. B. „Alle Vorbestellungen“. */
  label: string
}

export interface PageHeaderProps {
  /** Seitentitel - die einzige h1 der Seite. */
  title: React.ReactNode
  /** Höchstens eine Zeile, `text.secondary`. Details gehören in Abschnitte. */
  subtitle?: React.ReactNode
  /** Rücklink über dem Titel (Detail- und Unterseiten). */
  back?: PageBackLink
  /**
   * Seitenaktionen: höchstens EINE `variant="contained"` (die Hauptaktion),
   * weitere `outlined`/`text`. Desktop rechts neben dem Titel, am Handy
   * darunter in voller Breite. Im Druck ausgeblendet.
   */
  actions?: React.ReactNode
  /** Status-Chips direkt neben dem Titel (z. B. „Freigegeben“). */
  status?: React.ReactNode
}

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  status,
}: PageHeaderProps) {
  return (
    <Box component="header" data-testid="page-header" sx={{ mb: SECTION_GAP }}>
      {back && (
        <Button
          component={Link}
          href={back.href}
          size="small"
          startIcon={<ArrowBackIcon />}
          sx={{ mb: 1, ml: -1, '@media print': { display: 'none' } }}
        >
          {back.label}
        </Button>
      )}
      <Box
        sx={{
          display: 'flex',
          // Titel und Aktionen stehen nebeneinander - aber nur, solange der
          // Titel dabei mindestens HEADER_TITLE_MIN_WIDTH behält. Sonst
          // rutschen die Aktionen in die nächste Zeile (Tablet hochkant mit
          // drei, vier Knöpfen), statt den Titel in Silben zu zerquetschen.
          // Am Handy stehen sie immer darunter (volle Breite, s. u.).
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box
          data-testid="page-title-block"
          sx={{
            minWidth: 0,
            flex: `1 1 ${HEADER_TITLE_MIN_WIDTH}`,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              columnGap: 1.5,
              rowGap: 0.5,
            }}
          >
            <Typography
              variant="h1"
              component="h1"
              sx={{ overflowWrap: 'anywhere' }}
            >
              {title}
            </Typography>
            {status && (
              <Box
                data-testid="page-status"
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
              >
                {status}
              </Box>
            )}
          </Box>
          {subtitle && (
            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions && (
          <Box
            data-testid="page-actions"
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 1,
              // nie breiter als die Zeile: steht der Block allein in einer
              // Zeile, brechen seine Knöpfe um, statt überzustehen
              flex: { xs: '1 1 100%', sm: '0 1 auto' },
              maxWidth: '100%',
              // Am Handy füllen Knöpfe die Zeile (Daumen), ab sm natürliche Breite.
              '& > .MuiButton-root': { flexGrow: { xs: 1, sm: 0 } },
              '@media print': { display: 'none' },
            }}
          >
            {actions}
          </Box>
        )}
      </Box>
    </Box>
  )
}

export interface PageLayoutProps extends PageHeaderProps {
  /** Seitentyp, siehe `PAGE_MAX_WIDTH`. Standard: `default`. */
  width?: PageWidth
  children?: React.ReactNode
  'data-testid'?: string
}

export function PageLayout({
  width = 'default',
  children,
  'data-testid': testId,
  ...header
}: PageLayoutProps) {
  return (
    <Box
      data-testid={testId}
      data-page-width={width}
      sx={{
        width: '100%',
        maxWidth: PAGE_MAX_WIDTH[width],
        '@media print': { maxWidth: 'none' },
      }}
    >
      <PageHeader {...header} />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: SECTION_GAP,
          minWidth: 0,
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

export default PageLayout

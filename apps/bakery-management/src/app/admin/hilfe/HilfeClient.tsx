'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Box, Button, Stack, Tab, Tabs, Typography } from '@mui/material'
import { Print as PrintIcon } from '@mui/icons-material'
import { useOptionalSession } from '../../../lib/session'
import { ROLE_LABELS, type PilotRole } from '../../../lib/roles'
import {
  SPICKZETTEL,
  spickzettelOrderFor,
} from '../../../content/hilfe/spickzettel'
import {
  PAPIER_REGEL,
  PAPIER_REGEL_TITEL,
  PAPIER_SCHWELLE_MINUTEN,
} from '../../../content/hilfe/papierbetrieb'
import {
  hilfePrintStyles,
  printSheet,
  type SheetId,
} from '../../../components/hilfe/hilfePrint'
import HilfeSheet from '../../../components/hilfe/HilfeSheet'
import { PageLayout, PageSection } from '../../../components/layout'
import Vorbestellschein from '../../../components/hilfe/Vorbestellschein'
import BackzettelNotfallblatt from '../../../components/hilfe/BackzettelNotfallblatt'
import {
  fetchBackzettelConfig,
  type BackzettelConfigData,
} from '../../../lib/backzettelApi'

/** Touch-Ziel: mindestens 48 px (Tablet an der Theke, Handy). */
const TOUCH = { minHeight: 48 }

function PrintButton({
  sheet,
  label = 'Drucken',
  variant = 'contained',
}: {
  sheet: SheetId
  label?: string
  variant?: 'contained' | 'outlined'
}) {
  return (
    <Button
      variant={variant}
      startIcon={<PrintIcon />}
      onClick={() => printSheet(sheet)}
      sx={TOUCH}
      data-testid={`print-${sheet}`}
    >
      {label}
    </Button>
  )
}

/**
 * `/admin/hilfe` (P6): Spickzettel je Rolle (die eigene zuerst) und der
 * Papierbetrieb - Regel, leere Vorbestellscheine, Backzettel-Notfallblatt.
 * Jedes Blatt druckt auf genau eine A4-Seite (`components/hilfe/hilfePrint`).
 * Der Text steht in `src/content/hilfe/`.
 */
export default function HilfeClient() {
  const session = useOptionalSession()
  const role: PilotRole | null = session?.user?.role ?? null
  const order = spickzettelOrderFor(role)
  const [tab, setTab] = useState<PilotRole>(order[0])
  // Kommt die Sitzung erst nach dem ersten Rendern, springt der Reiter auf
  // die eigene Rolle - aber nur, solange niemand selbst gewählt hat.
  const chosen = useRef(false)
  useEffect(() => {
    if (role && !chosen.current) setTab(role)
  }, [role])

  const [config, setConfig] = useState<BackzettelConfigData | null>(null)
  useEffect(() => {
    let cancelled = false
    fetchBackzettelConfig()
      .then((response) => {
        if (!cancelled && response.status === 'ok') setConfig(response.config)
      })
      .catch(() => {
        // Ohne Stammdaten druckt das Notfallblatt leere Zeilen - kein Fehler.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const sheet = SPICKZETTEL[tab]

  return (
    <Box className="hilfe-wrap">
      {hilfePrintStyles}

      <PageLayout
        title="Hilfe"
        subtitle="Kurzanleitung je Rolle und Papierbetrieb – jedes Blatt passt gedruckt auf eine A4-Seite."
      >
        <Box component="section" aria-label="Kurzanleitung">
          <Box
            className="hilfe-screen"
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'flex-end' },
              justifyContent: 'space-between',
              gap: 1,
              mb: 2,
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Tabs
              value={tab}
              onChange={(_, value: PilotRole) => {
                chosen.current = true
                setTab(value)
              }}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              aria-label="Kurzanleitung für Rolle"
              sx={{ minHeight: 48 }}
            >
              {order.map((r) => (
                <Tab
                  key={r}
                  value={r}
                  label={
                    r === role
                      ? `${ROLE_LABELS[r]} (Ihre Rolle)`
                      : ROLE_LABELS[r]
                  }
                  sx={TOUCH}
                  data-testid={`tab-${r}`}
                />
              ))}
            </Tabs>
            <Box sx={{ pb: { sm: 1 } }}>
              <PrintButton sheet={`spickzettel-${tab}`} />
            </Box>
          </Box>

          <HilfeSheet
            id={`spickzettel-${tab}`}
            title={`Kurzanleitung ${sheet.title}`}
            intro={sheet.intro}
            blocks={sheet.blocks}
            printDefault
            footer="Heusser Verwaltung · in der App: Menü › Hilfe"
          />
        </Box>

        <PageSection
          id="papierbetrieb"
          title="Papierbetrieb"
          description={`Blockiert die App die Arbeit länger als ${PAPIER_SCHWELLE_MINUTEN} Minuten, wird auf Papier umgestellt.`}
          actions={
            <PrintButton
              sheet="papier-regel"
              label="Regel drucken"
              variant="outlined"
            />
          }
          details={
            <HilfeSheet
              id="papier-regel"
              title={PAPIER_REGEL_TITEL}
              intro="Aushang für Laden und Backstube."
              blocks={PAPIER_REGEL}
              poster
              footer="Heusser Verwaltung · in der App: Menü › Hilfe › Papierbetrieb"
            >
              <Box
                className="sz-contacts"
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
                  mt: 1,
                }}
              >
                {['Inhaber', 'Technik'].map((who) => (
                  <Box
                    key={who}
                    sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}
                  >
                    <strong>{who}:</strong>
                    <Box
                      component="span"
                      aria-label={`${who}: Name und Telefon von Hand eintragen`}
                      sx={{
                        flexGrow: 1,
                        borderBottom: 1,
                        borderColor: 'text.secondary',
                        height: 24,
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </HilfeSheet>
          }
          detailsLabel="Regel ansehen"
        >
          <Box
            className="hilfe-screen"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: { xs: 3, md: 4 },
            }}
          >
            <Box data-testid="card-vorbestellschein">
              <Typography
                variant="subtitle1"
                component="h3"
                sx={{ fontWeight: 600 }}
              >
                Vorbestellschein (leer)
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1.5 }}
              >
                Felder wie in der App, unten „in App übertragen“ mit dem Code.
                Mit Schnittlinien.
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <PrintButton
                  sheet="vorbestellschein-2"
                  label="2 pro Seite"
                  variant="outlined"
                />
                <PrintButton
                  sheet="vorbestellschein-4"
                  label="4 pro Seite"
                  variant="outlined"
                />
              </Stack>
            </Box>
            <Box data-testid="card-notfallblatt">
              <Typography
                variant="subtitle1"
                component="h3"
                sx={{ fontWeight: 600 }}
              >
                Backzettel-Notfallblatt
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1.5 }}
              >
                Nur, wenn kein freigegebener Ausdruck da ist. Basis, Vorbestellt
                und Gesamt von Hand
                {config
                  ? ' – die Posten stehen schon da.'
                  : ' – ohne Stammdaten mit leeren Zeilen.'}
              </Typography>
              <PrintButton
                sheet="notfallblatt"
                label="Notfallblatt drucken"
                variant="outlined"
              />
            </Box>
          </Box>
        </PageSection>
      </PageLayout>

      <Vorbestellschein perPage={2} />
      <Vorbestellschein perPage={4} />
      <BackzettelNotfallblatt config={config} />
    </Box>
  )
}

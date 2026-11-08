'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Box, Button, Paper, Stack, Tab, Tabs, Typography } from '@mui/material'
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
    <Box className="hilfe-wrap" sx={{ maxWidth: 1100 }}>
      {hilfePrintStyles}

      <Box className="hilfe-screen" sx={{ mb: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Hilfe
        </Typography>
        <Typography color="text.secondary">
          Kurzanleitung für jede Rolle und der Papierbetrieb. Jedes Blatt passt
          gedruckt auf eine A4-Seite.
        </Typography>
      </Box>

      <Stack
        className="hilfe-screen"
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
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
                r === role ? `${ROLE_LABELS[r]} (Ihre Rolle)` : ROLE_LABELS[r]
              }
              sx={TOUCH}
              data-testid={`tab-${r}`}
            />
          ))}
        </Tabs>
        <PrintButton sheet={`spickzettel-${tab}`} />
      </Stack>

      <HilfeSheet
        id={`spickzettel-${tab}`}
        title={`Kurzanleitung ${sheet.title}`}
        intro={sheet.intro}
        blocks={sheet.blocks}
        printDefault
        footer="Heusser Verwaltung · in der App: Menü › Hilfe"
      />

      <Box
        component="section"
        aria-labelledby="papierbetrieb"
        sx={{ mt: 5, animation: 'none' }}
      >
        <Stack
          className="hilfe-screen"
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
          sx={{ mb: 2 }}
        >
          <Box>
            <Typography variant="h5" component="h2" id="papierbetrieb">
              Papierbetrieb
            </Typography>
            <Typography color="text.secondary">
              Blockiert die App die Arbeit länger als {PAPIER_SCHWELLE_MINUTEN}{' '}
              Minuten, wird auf Papier umgestellt.
            </Typography>
          </Box>
          <PrintButton sheet="papier-regel" label="Regel drucken" />
        </Stack>

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

        <Box
          className="hilfe-screen"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: 2,
            mt: 3,
          }}
        >
          <Paper
            variant="outlined"
            sx={{ p: 2 }}
            data-testid="card-vorbestellschein"
          >
            <Typography variant="h6" component="h3" gutterBottom>
              Vorbestellschein (leer)
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Felder wie in der App: Name, Telefon, Bestellweg, Abholung (Tag
              und Uhrzeit oder Sammelstelle), Produkt, Sorte, Menge, bezahlt,
              Anmerkung, aufgenommen von – und unten „in App übertragen“ mit dem
              Code. Mit Schnittlinien.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
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
          </Paper>
          <Paper
            variant="outlined"
            sx={{ p: 2 }}
            data-testid="card-notfallblatt"
          >
            <Typography variant="h6" component="h3" gutterBottom>
              Backzettel-Notfallblatt
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Nur, wenn kein freigegebener Ausdruck da ist. Spalten Basis,
              Vorbestellt und Gesamt zum Ausfüllen von Hand
              {config
                ? ' – die Posten stehen schon da.'
                : ' – ohne Stammdaten mit leeren Zeilen.'}
            </Typography>
            <PrintButton
              sheet="notfallblatt"
              label="Notfallblatt drucken"
              variant="outlined"
            />
          </Paper>
        </Box>
      </Box>

      <Vorbestellschein perPage={2} />
      <Vorbestellschein perPage={4} />
      <BackzettelNotfallblatt config={config} />
    </Box>
  )
}

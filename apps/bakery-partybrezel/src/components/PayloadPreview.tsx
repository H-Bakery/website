'use client'
import React, { useMemo, useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import type { PartybrezelConfig } from '../config/partybrezel.config'
import { copyText, selectElementText } from '../lib/clipboard'
import {
  MAPPING_LABELS,
  buildPayload,
  type PayloadMapping,
} from '../lib/payload'
import type { OrderDraft } from '../lib/types'

function mappingText(
  mapping: PayloadMapping,
  config: PartybrezelConfig
): string {
  return mapping === 'A'
    ? 'Eine Position je Größe, Menge = Anzahl Brezeln. Die Beläge stehen nur in der Anmerkung. Einfach und passend, wenn die ganze Brezel die Zähleinheit ist (Q-P1) – die Backstube muss die Beläge aber aus dem Text lesen.'
    : `Eine Position je Größe und Belag, Menge = Anzahl Teile, der Belag als Sorte. So kann der Backzettel Teile (${config.doughName} in g) und Beläge zählen wie andere Sorten; welche Teile zu welcher Brezel gehören, steht weiter in der Anmerkung.`
}

export interface PayloadPreviewProps {
  config: PartybrezelConfig
  draft: OrderDraft
  mapping: PayloadMapping
  onMappingChange: (mapping: PayloadMapping) => void
}

export default function PayloadPreview({
  config,
  draft,
  mapping,
  onMappingChange,
}: PayloadPreviewProps) {
  const { payload, warnings } = useMemo(
    () => buildPayload(mapping, draft, config),
    [mapping, draft, config]
  )
  const json = JSON.stringify(payload, null, 2)
  const preRef = useRef<HTMLPreElement>(null)
  const [copyStatus, setCopyStatus] = useState('')

  const handleCopy = async () => {
    const ok = await copyText(json)
    if (ok) {
      setCopyStatus('In die Zwischenablage kopiert.')
    } else {
      selectElementText(preRef.current)
      setCopyStatus(
        'Kopieren ist hier nicht möglich – der Text ist markiert, bitte mit Strg+C (Mac: ⌘+C) kopieren.'
      )
    }
  }

  return (
    <Box component="section" aria-labelledby="payload-heading" sx={{ mt: 4 }}>
      <Typography
        id="payload-heading"
        component="h3"
        variant="h2"
        sx={{ mb: 1 }}
      >
        So würde die Vorbestellung aussehen
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>Es wurde nichts gesendet.</strong> Später würde dieser Inhalt
        als Vorbestellung an <code>POST /api/preorders</code> gehen. Preise
        stehen bewusst nicht darin: der Server übernimmt den Preis aus dem
        Produktkatalog. Aufpreise für Beläge lassen sich darüber heute nicht
        abbilden – in beiden Varianten kämen sie nicht an. Die Produkt-IDs sind
        hypothetisch.
      </Alert>
      <ToggleButtonGroup
        exclusive
        value={mapping}
        onChange={(_, value: PayloadMapping | null) => {
          if (value) onMappingChange(value)
        }}
        aria-label="Abbildung auf Positionen"
        sx={{ flexWrap: 'wrap', mb: 1 }}
      >
        {(Object.keys(MAPPING_LABELS) as PayloadMapping[]).map((m) => (
          <ToggleButton key={m} value={m}>
            {MAPPING_LABELS[m]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Typography sx={{ mb: 2 }} data-testid="mapping-description">
        {mappingText(mapping, config)}
      </Typography>
      {warnings.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }} data-testid="payload-warnings">
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {warnings.map((w, i) => (
              <li key={`${w.code}-${i}`}>{w.message}</li>
            ))}
          </Box>
        </Alert>
      )}
      <Box
        component="pre"
        ref={preRef}
        tabIndex={0}
        role="region"
        aria-label={`Vorbestellung als JSON, ${MAPPING_LABELS[mapping]}`}
        data-testid="payload-json"
        sx={{
          m: 0,
          p: 2,
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
          bgcolor: 'action.hover',
          fontSize: '0.85rem',
          overflowX: 'auto',
          maxWidth: '100%',
          // lange Anmerkung umbrechen statt seitlich scrollen (Handy)
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {json}
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mt: 1,
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant="contained"
          startIcon={<ContentCopyIcon />}
          onClick={handleCopy}
        >
          Kopieren
        </Button>
        <Typography role="status" aria-live="polite">
          {copyStatus}
        </Typography>
      </Box>
    </Box>
  )
}

'use client'
import React from 'react'
import dynamic from 'next/dynamic'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import type {
  PartybrezelConfig,
  SizeConfig,
  ToppingConfig,
} from '../config/partybrezel.config'
import type { PreviewMode } from '../lib/previewMode'
import PretzelPreview, { PretzelLegend } from './PretzelPreview'
import type { PreviewModeState } from './usePreviewMode'

/** three.js erst laden, wenn die 3D-Ansicht wirklich gezeigt wird. */
const PretzelPreview3D = dynamic(() => import('./PretzelPreview3D'), {
  ssr: false,
  loading: () => (
    <Box
      role="status"
      sx={{
        width: '100%',
        aspectRatio: '16 / 10',
        maxHeight: 400,
        display: 'grid',
        placeItems: 'center',
        color: 'text.secondary',
        fontSize: '0.9rem',
      }}
    >
      3D-Ansicht wird geladen …
    </Box>
  ),
})

export const WEBGL_UNAVAILABLE_TEXT =
  'Die 3D-Ansicht ist auf diesem Gerät nicht verfügbar – Sie sehen die 2D-Vorschau.'
export const WEBGL_INTERRUPTED_TEXT =
  'Die 3D-Ansicht wurde unterbrochen – Sie sehen die 2D-Vorschau. Mit „3D“ lässt sie sich erneut öffnen.'

export interface PreviewModeToggleProps {
  preview: PreviewModeState
}

/** Umschalter 2D | 3D für alle Vorschauen des Schritts. */
export function PreviewModeToggle({ preview }: PreviewModeToggleProps) {
  const notice =
    preview.notice === 'unavailable'
      ? WEBGL_UNAVAILABLE_TEXT
      : preview.notice === 'interrupted'
      ? WEBGL_INTERRUPTED_TEXT
      : ''
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        flexWrap: 'wrap',
        mb: 2,
      }}
    >
      <Typography id="preview-mode-label" component="span" variant="body2">
        Vorschau
      </Typography>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={preview.mode}
        onChange={(_, value: PreviewMode | null) => {
          if (value) preview.setMode(value)
        }}
        aria-labelledby="preview-mode-label"
        aria-describedby={notice ? 'preview-mode-notice' : undefined}
      >
        <ToggleButton value="2d" aria-label="2D-Ansicht" sx={{ px: 2 }}>
          2D
        </ToggleButton>
        <ToggleButton
          value="3d"
          aria-label="3D-Ansicht"
          disabled={preview.webgl !== true}
          sx={{ px: 2 }}
        >
          3D
        </ToggleButton>
      </ToggleButtonGroup>
      {/* Die Status-Region steht immer im DOM, damit Screenreader den
          später eingesetzten Text auch ansagen. */}
      <Typography
        id="preview-mode-notice"
        role="status"
        variant="body2"
        color="text.secondary"
        data-testid="preview-notice"
      >
        {notice}
      </Typography>
    </Box>
  )
}

export interface PretzelViewProps {
  parts: (ToppingConfig | undefined)[]
  label: string
  size: SizeConfig
  config: PartybrezelConfig
  /** '3d' nur für die Brezel, die gerade bearbeitet wird. */
  mode: PreviewMode
  /** Die 3D-Ansicht ließ sich nicht starten. */
  onUnavailable: () => void
  /** Der WebGL-Kontext ging verloren. */
  onInterrupted: () => void
  /** Bei mehreren Brezeln: diese Brezel in 3D zeigen. */
  onShow3D?: () => void
  /** Die 3D-Ansicht kam per Knopf hierher: Fokus auf ihre Bedienung. */
  focus3D?: boolean
  /** Der Fokus ist gesetzt - nur einmal, nicht bei jedem neuen Mounten. */
  onFocused?: () => void
}

/**
 * Vorschau einer Brezel: 2D (SVG) oder 3D (three.js, nachgeladen). Die
 * Legende (Nummer + Belag je Teil) steht in beiden Ansichten darunter.
 */
export default function PretzelView({
  parts,
  label,
  size,
  config,
  mode,
  onUnavailable,
  onInterrupted,
  onShow3D,
  focus3D = false,
  onFocused,
}: PretzelViewProps) {
  if (mode === '3d') {
    return (
      <Box>
        <PretzelPreview3D
          parts={parts}
          size={size}
          config={config}
          label={label}
          onUnavailable={onUnavailable}
          onInterrupted={onInterrupted}
          focusOnMount={focus3D}
          onFocused={onFocused}
        />
        <PretzelLegend parts={parts} label={label} />
      </Box>
    )
  }
  return (
    <Box>
      <PretzelPreview parts={parts} label={label} />
      {onShow3D && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
          <Button
            size="small"
            variant="text"
            onClick={onShow3D}
            aria-label={`${label} in 3D ansehen`}
          >
            In 3D ansehen
          </Button>
        </Box>
      )}
    </Box>
  )
}

'use client'
import React, { useId } from 'react'
import Box from '@mui/material/Box'
import type { ToppingConfig } from '../config/partybrezel.config'

/** Stilisierte Brezel aus drei Teilen: linker Bogen, rechter Bogen, Mitte. */
const THREE_PART_PATHS = [
  'M 108 166 C 22 166 10 52 74 34 C 104 26 124 48 120 76',
  'M 132 166 C 218 166 230 52 166 34 C 136 26 116 48 120 76',
  'M 120 76 C 112 104 92 122 72 146 M 120 76 C 128 104 148 122 168 146',
]
const THREE_PART_BADGES = [
  { x: 30, y: 104 },
  { x: 210, y: 104 },
  { x: 120, y: 128 },
]

const CRUST = '#7a4a1d'
const UNSET = '#b9aea2'

export interface PretzelPreviewProps {
  /** Je Teil der gewählte Belag oder `undefined` (offen). */
  parts: (ToppingConfig | undefined)[]
  /** Zugänglicher Name, z. B. "Brezel 1 (groß)". */
  label: string
  size?: number
  /** Legende unter dem Bild (Nummer + Text je Teil). */
  showLegend?: boolean
}

function partText(topping: ToppingConfig | undefined) {
  return topping ? topping.label : 'noch offen'
}

/**
 * Vorschau der Teile, eingefärbt nach Belag. Farbe trägt nie allein: jedes
 * Teil hat eine Nummer, die Legende nennt den Belag, und das Bild hat einen
 * Text-Titel. Für eine andere Teilezahl als 3 zeigt sie einfache Segmente.
 */
export default function PretzelPreview({
  parts,
  label,
  size = 160,
  showLegend = true,
}: PretzelPreviewProps) {
  const titleId = useId()
  const description = parts
    .map((t, i) => `Teil ${i + 1}: ${partText(t)}`)
    .join(', ')
  const three = parts.length === 3

  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      <svg
        role="img"
        aria-labelledby={titleId}
        viewBox={three ? '0 0 240 190' : `0 0 ${parts.length * 60 + 20} 80`}
        width={size}
        style={{ maxWidth: '100%', height: 'auto', display: 'block' }}
      >
        <title id={titleId}>{`${label} - ${description}`}</title>
        {three
          ? THREE_PART_PATHS.map((d, i) => (
              <g key={i} data-part={i + 1} data-topping={parts[i]?.id ?? ''}>
                <path
                  d={d}
                  fill="none"
                  stroke={CRUST}
                  strokeWidth={28}
                  strokeLinecap="round"
                />
                <path
                  d={d}
                  fill="none"
                  stroke={parts[i]?.color ?? UNSET}
                  strokeWidth={18}
                  strokeLinecap="round"
                  strokeDasharray={parts[i] ? undefined : '4 7'}
                />
              </g>
            ))
          : parts.map((t, i) => (
              <rect
                key={i}
                data-part={i + 1}
                data-topping={t?.id ?? ''}
                x={10 + i * 60}
                y={20}
                width={54}
                height={40}
                rx={10}
                fill={t?.color ?? UNSET}
                stroke={CRUST}
                strokeWidth={4}
                strokeDasharray={t ? undefined : '4 4'}
              />
            ))}
        {parts.map((_, i) => {
          const pos = three ? THREE_PART_BADGES[i] : { x: 37 + i * 60, y: 40 }
          return (
            <g key={`badge-${i}`} aria-hidden="true">
              <circle
                cx={pos.x}
                cy={pos.y}
                r={13}
                style={{
                  fill: 'var(--mui-palette-background-paper, #fff)',
                  stroke: 'var(--mui-palette-text-primary, #222)',
                }}
                strokeWidth={2}
              />
              <text
                x={pos.x}
                y={pos.y + 5}
                textAnchor="middle"
                fontSize={15}
                fontWeight={700}
                style={{ fill: 'var(--mui-palette-text-primary, #222)' }}
              >
                {i + 1}
              </text>
            </g>
          )
        })}
      </svg>
      {showLegend && (
        <Box
          component="ul"
          aria-label={`Teile von ${label}`}
          sx={{
            listStyle: 'none',
            p: 0,
            m: 0,
            mt: 1,
            display: 'grid',
            gap: 0.5,
            fontSize: '0.9rem',
          }}
        >
          {parts.map((t, i) => (
            <Box
              component="li"
              key={i}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <Box
                aria-hidden="true"
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  flexShrink: 0,
                  bgcolor: t?.color ?? UNSET,
                  border: `2px ${t ? 'solid' : 'dashed'} ${CRUST}`,
                }}
              />
              <span>
                {`Teil ${i + 1}: `}
                <strong>{partText(t)}</strong>
              </span>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

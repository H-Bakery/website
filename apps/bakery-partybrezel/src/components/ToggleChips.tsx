'use client'
import React from 'react'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CheckIcon from '@mui/icons-material/Check'

export interface ToggleChipOption {
  value: string
  label: string
  /** Zugänglicher Name, falls er vom sichtbaren Text abweicht. */
  ariaLabel?: string
}

export interface ToggleChipsProps {
  legend: React.ReactNode
  options: ToggleChipOption[]
  selected: string | null
  onSelect: (value: string) => void
  /** Legende nur für Screenreader. */
  hideLegend?: boolean
}

/**
 * Eine Auswahl als Chips (Knöpfe mit aria-pressed) in einem fieldset. Die
 * Wahl trägt ein Häkchen und den Text - nicht nur die Farbe.
 */
export default function ToggleChips({
  legend,
  options,
  selected,
  onSelect,
  hideLegend = false,
}: ToggleChipsProps) {
  return (
    <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
      <Box
        component="legend"
        sx={
          hideLegend
            ? {
                position: 'absolute',
                width: 1,
                height: 1,
                overflow: 'hidden',
                clip: 'rect(0 0 0 0)',
              }
            : { fontWeight: 600, mb: 1, p: 0 }
        }
      >
        {legend}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {options.map((option) => {
          const isSelected = option.value === selected
          return (
            <Chip
              key={option.value}
              label={option.label}
              aria-label={option.ariaLabel}
              aria-pressed={isSelected}
              clickable
              onClick={() => onSelect(option.value)}
              color={isSelected ? 'primary' : 'default'}
              variant={isSelected ? 'filled' : 'outlined'}
              // Das Häkchen hat immer seinen Platz (unsichtbar, solange
              // nicht gewählt): sonst würde der Chip beim Wählen breiter
              // und auf schmalen Bildschirmen in die nächste Zeile springen.
              icon={
                <CheckIcon
                  sx={{ visibility: isSelected ? 'visible' : 'hidden' }}
                />
              }
            />
          )
        })}
      </Box>
    </Box>
  )
}

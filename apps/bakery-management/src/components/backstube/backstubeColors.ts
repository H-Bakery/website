'use client'

import { useTheme } from '@mui/material/styles'

/**
 * Feste Kontrastfarben des Backstube-Tablets (Z6). Gemessen gegen die
 * eigene Hintergrundfarbe, nicht gegen `paper`: jedes Paar liegt in beiden
 * Modi über 7:1 (Mehl auf dem Glas, Abstand zum Tablet). Keine
 * `*.main`-Farben aus MUI - `warning.main` fiele im hellen Modus auf ~3:1,
 * und `primary.main` wird im dunklen Modus hell.
 */
export interface BackstubeColors {
  /** „Noch nicht freigegeben“-Banner. */
  draftBg: string
  draftFg: string
  /** Nachtrag-Badge und „Gesehen“-Knopf. */
  deltaBg: string
  deltaFg: string
  /** Rand/Hintergrund einer Zeile mit offenem Nachtrag. */
  deltaEdge: string
  deltaRow: string
  /** Gesetzter Haken. */
  doneBg: string
  doneFg: string
  doneRow: string
}

export const BACKSTUBE_COLORS: Record<'light' | 'dark', BackstubeColors> = {
  dark: {
    draftBg: '#fbbf24',
    draftFg: '#111111',
    deltaBg: '#fbbf24',
    deltaFg: '#111111',
    deltaEdge: '#fbbf24',
    deltaRow: 'rgba(251, 191, 36, 0.16)',
    doneBg: '#4ade80',
    doneFg: '#052e16',
    doneRow: 'rgba(74, 222, 128, 0.12)',
  },
  light: {
    draftBg: '#fde68a',
    draftFg: '#1a1200',
    deltaBg: '#92400e',
    deltaFg: '#ffffff',
    deltaEdge: '#b45309',
    deltaRow: 'rgba(180, 83, 9, 0.10)',
    doneBg: '#166534',
    doneFg: '#ffffff',
    doneRow: 'rgba(22, 101, 52, 0.10)',
  },
}

export function useBackstubeColors(): BackstubeColors {
  const theme = useTheme()
  return BACKSTUBE_COLORS[theme.palette.mode === 'light' ? 'light' : 'dark']
}

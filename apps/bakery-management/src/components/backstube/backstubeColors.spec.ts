import { createTheme } from '@mui/material/styles'
import { BACKSTUBE_COLORS } from './backstubeColors'

function channel(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

function luminance(hex: string): number {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.replace(/./g, (c) => c + c)
  const n = parseInt(h, 16)
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  )
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('Kontrastfarben des Backstube-Tablets', () => {
  it.each(['light', 'dark'] as const)(
    '%s: Banner, Nachtrag und Haken mindestens 7:1',
    (mode) => {
      const c = BACKSTUBE_COLORS[mode]
      expect(contrast(c.draftFg, c.draftBg)).toBeGreaterThanOrEqual(7)
      expect(contrast(c.deltaFg, c.deltaBg)).toBeGreaterThanOrEqual(7)
      expect(contrast(c.doneFg, c.doneBg)).toBeGreaterThanOrEqual(7)
    }
  )

  it.each(['light', 'dark'] as const)(
    '%s: Nachtrag-Rand und Haken heben sich vom Papier ab (≥ 3:1)',
    (mode) => {
      const paper = createTheme({ palette: { mode } }).palette.background.paper
      const c = BACKSTUBE_COLORS[mode]
      expect(contrast(c.deltaEdge, paper)).toBeGreaterThanOrEqual(3)
      expect(contrast(c.doneBg, paper)).toBeGreaterThanOrEqual(3)
    }
  )
})

import React from 'react'
import { render, screen } from '@testing-library/react'
import { ThemeProvider } from '@mui/material/styles'
import { Switch } from '@mui/material'
import {
  FOCUS_RING_COLOR,
  LIGHT_PRIMARY_TEXT,
  TOUCH_MEDIA,
  createManagementTheme,
} from './muiTheme'

function expand(hex: string): string {
  const h = hex.replace('#', '')
  return h.length === 3
    ? h
        .split('')
        .map((c) => c + c)
        .join('')
    : h
}

function luminance(hex: string): number {
  const h = expand(hex)
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
  const f = (c: number) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

/** `rgba(0, 0, 0, 0.87)` auf einer Fläche als Hex (für die Rechnung). */
function solid(color: string, bg: string): string {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(color)
  if (!m) return color
  const a = m[4] === undefined ? 1 : Number(m[4])
  const bgHex = expand(bg)
  const bgv = [0, 2, 4].map((i) => parseInt(bgHex.slice(i, i + 2), 16))
  return (
    '#' +
    [1, 2, 3]
      .map((i, k) =>
        Math.round(Number(m[i]) * a + bgv[k] * (1 - a))
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  )
}

describe('createManagementTheme (W4-Verifikation: Kontrast)', () => {
  for (const mode of ['light', 'dark'] as const) {
    const theme = createManagementTheme(mode)
    for (const key of [
      'primary',
      'secondary',
      'error',
      'warning',
      'info',
      'success',
    ] as const) {
      it(`${mode}: Schrift auf ${key}.main mindestens 4,5:1`, () => {
        const { main, contrastText } = theme.palette[key]
        expect(
          contrast(solid(contrastText, main), main)
        ).toBeGreaterThanOrEqual(4.5)
      })
    }
  }

  it('hell: warning.main und info.main als Text auf Papier mindestens 4,5:1', () => {
    const theme = createManagementTheme('light')
    const paper = theme.palette.background.paper
    expect(contrast(theme.palette.warning.main, paper)).toBeGreaterThanOrEqual(
      4.5
    )
    expect(contrast(theme.palette.info.main, paper)).toBeGreaterThanOrEqual(4.5)
  })

  it('primary und Hintergründe bleiben MUI-Standard (PWA-Statusleiste)', () => {
    expect(createManagementTheme('light').palette.primary.main).toBe('#1976d2')
    expect(createManagementTheme('dark').palette.background.paper).toBe(
      '#121212'
    )
  })

  it('Knöpfe auf Touch-Geräten mindestens 44 px', () => {
    const theme = createManagementTheme('light')
    expect(theme.components?.MuiButton?.styleOverrides?.root).toEqual({
      [TOUCH_MEDIA]: { minHeight: 44 },
    })
    expect(theme.components?.MuiIconButton?.styleOverrides?.root).toEqual({
      [TOUCH_MEDIA]: { minWidth: 44, minHeight: 44 },
    })
  })

  it('Eingabefelder und Schalter auf Touch-Geräten mindestens 44 px (W4-verify r2)', () => {
    const theme = createManagementTheme('dark')
    expect(theme.components?.MuiInputBase?.styleOverrides?.root).toEqual({
      [TOUCH_MEDIA]: { minHeight: 44 },
    })
    type Nested = Record<string, Record<string, Record<string, unknown>>>
    const sw = (theme.components?.MuiSwitch?.styleOverrides?.root as Nested)[
      TOUCH_MEDIA
    ]['&.MuiSwitch-sizeMedium'] as Record<string, unknown>
    // Schaltfläche (switchBase) 20 px Daumen + 2 × 12 = 44; Weg 64 − 44 = 20
    // wie im MUI-Standard (translateX 20 px), Schiene 64 − 30 = 34 breit.
    expect(sw).toMatchObject({ width: 64, height: 44, padding: 15 })
    expect(sw['& .MuiSwitch-switchBase']).toEqual({ padding: 12 })
  })

  it('MUI-Texte auf Deutsch: das X einer Meldung heißt „Schließen“ (W4-verify r3)', () => {
    const theme = createManagementTheme('light')
    expect(theme.components?.MuiAlert?.defaultProps?.closeText).toBe(
      'Schließen'
    )
    // Die eigenen Overrides bleiben neben der Locale erhalten.
    expect(theme.components?.MuiButton?.styleOverrides?.root).toEqual({
      [TOUCH_MEDIA]: { minHeight: 44 },
    })
  })
})

describe('Text- und Umriss-Knöpfe im hellen Modus (W4-verify r4)', () => {
  const theme = createManagementTheme('light')
  const overrides = theme.components?.MuiButton?.styleOverrides as Record<
    string,
    { color?: string }
  >

  it('nutzen primary.dark statt primary.main', () => {
    expect(LIGHT_PRIMARY_TEXT).toBe(theme.palette.primary.dark)
    expect(overrides['textPrimary']?.color).toBe(LIGHT_PRIMARY_TEXT)
    expect(overrides['outlinedPrimary']?.color).toBe(LIGHT_PRIMARY_TEXT)
  })

  it('mindestens 4,5:1 auf Hover-Tönung und grauem Kartengrund', () => {
    // Hover: 4 % der Knopffarbe über Weiß; Karten-/Zeilengrund #f4f4f4.
    const hover = solid('rgba(21, 101, 192, 0.04)', 'ffffff')
    for (const bg of [hover, '#f4f4f4', '#f6fafd', '#ffffff']) {
      expect(contrast(LIGHT_PRIMARY_TEXT, bg)).toBeGreaterThanOrEqual(4.5)
    }
    // Vorher: primary.main auf denselben Flächen darunter.
    expect(contrast(theme.palette.primary.main, '#f4f4f4')).toBeLessThan(4.5)
  })

  it('dunkel bleibt MUI-Standard', () => {
    const dark = createManagementTheme('dark').components?.MuiButton
      ?.styleOverrides as Record<string, unknown>
    expect(dark['textPrimary']).toBeUndefined()
  })
})

describe('Layout-Kit: Überschriften (src/components/layout)', () => {
  it.each(['light', 'dark'] as const)(
    '%s: h1 (Seitentitel) größer als h2 (Abschnitt), am Handy kleiner',
    (mode) => {
      const { h1, h2 } = createManagementTheme(mode).typography
      const rem = (v: unknown) => parseFloat(String(v))
      const desktop = (v: unknown) =>
        rem(
          (v as Record<string, { fontSize?: string }>)[
            '@media (min-width:900px)'
          ]?.fontSize
        )
      expect(rem(h1.fontSize)).toBeGreaterThan(rem(h2.fontSize))
      expect(desktop(h1)).toBeGreaterThan(rem(h1.fontSize))
      expect(desktop(h2)).toBeGreaterThan(rem(h2.fontSize))
      expect(desktop(h1)).toBeLessThanOrEqual(2)
    }
  )
})

describe('Tastatur-Fokus (Review r2)', () => {
  it.each(['light', 'dark'] as const)(
    '%s: der Fokusring hebt sich von Karte und Hintergrund ab (>= 3:1)',
    (mode) => {
      const theme = createManagementTheme(mode)
      const ring = FOCUS_RING_COLOR[mode]
      expect(
        contrast(ring, expand(theme.palette.background.paper))
      ).toBeGreaterThanOrEqual(3)
      expect(
        contrast(ring, expand(theme.palette.background.default))
      ).toBeGreaterThanOrEqual(3)
    }
  )

  it('jedes ButtonBase bekommt bei Tastaturfokus einen Ring, in der AppBar in Schriftfarbe', () => {
    const root = createManagementTheme('light').components?.MuiButtonBase
      ?.styleOverrides?.root as Record<string, Record<string, unknown>>
    expect(root['&.Mui-focusVisible']).toMatchObject({
      outline: '2px solid',
      outlineColor: FOCUS_RING_COLOR.light,
    })
    expect(root['.MuiAppBar-root &.Mui-focusVisible']).toEqual({
      outlineColor: 'currentColor',
    })
  })

  it('ein ungeschalteter Switch zeigt den Fokus am Daumen, auch hell auf Weiß', () => {
    // Vorher: weißer Ripple (0,3) auf weißer Karte - unsichtbar.
    const theme = createManagementTheme('light')
    render(
      React.createElement(
        ThemeProvider,
        { theme },
        React.createElement(Switch, {
          inputProps: { 'aria-label': 'Tage ohne Bericht ausblenden' },
        })
      )
    )
    const root = screen
      .getByRole('checkbox', { name: 'Tage ohne Bericht ausblenden' })
      .closest('.MuiSwitch-root') as HTMLElement
    const cls = Array.from(root.classList).find((c) => c.startsWith('css-'))
    expect(cls).toBeDefined()
    const rules = Array.from(document.styleSheets).flatMap((sheet) =>
      Array.from(sheet.cssRules)
    ) as CSSStyleRule[]
    const thumbRule = rules.find(
      (rule) =>
        rule.selectorText?.includes(`.${cls}`) &&
        rule.selectorText.includes(
          '.MuiSwitch-switchBase.Mui-focusVisible .MuiSwitch-thumb'
        )
    )
    expect(thumbRule).toBeDefined()
    expect(thumbRule?.style.getPropertyValue('outline-color')).toMatch(
      /#1565c0|rgb\(21, 101, 192\)/i
    )
  })
})

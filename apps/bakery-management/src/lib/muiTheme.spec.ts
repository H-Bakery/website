import { createManagementTheme } from './muiTheme'

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
})

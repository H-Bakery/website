import { lightTheme } from './theme'
import { FOOTER_COLORS } from '../components/LocalFooter'

/** sRGB channels 0-255 and alpha 0-1 of `#rgb`, `#rrggbb` or `rgb(a)(…)`. */
function parse(color: string): [number, number, number, number] {
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const h =
      hex[1].length === 3
        ? hex[1]
            .split('')
            .map((c) => c + c)
            .join('')
        : hex[1]
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
      1,
    ]
  }
  const rgb = color.match(/^rgba?\(([^)]+)\)$/i)
  if (rgb) {
    const [r, g, b, a = '1'] = rgb[1].split(',').map((p) => p.trim())
    return [Number(r), Number(g), Number(b), Number(a)]
  }
  throw new Error(`Unbekannte Farbe: ${color}`)
}

/** WCAG 2.x relative luminance of an opaque colour. */
function luminance([r, g, b]: number[]): number {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

/**
 * WCAG contrast ratio of a text colour on an opaque background. A
 * transparent text colour is first blended onto the background - that is
 * what the eye sees, and it is how cream at 50 % alpha failed before.
 */
function contrast(foreground: string, background: string): number {
  const bg = parse(background)
  if (bg[3] !== 1) throw new Error('Hintergrund muss deckend sein')
  const [r, g, b, a] = parse(foreground)
  const fg = [r, g, b].map((v, i) => v * a + bg[i] * (1 - a))
  const [l1, l2] = [luminance(fg), luminance(bg)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

describe('contrast helper', () => {
  it('matches known WCAG values', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5)
    // The old secondary text colour, as measured in the finding.
    expect(contrast('#928168', '#FFF3E6')).toBeCloseTo(3.45, 2)
    expect(contrast('#928168', '#FFFFFF')).toBeCloseTo(3.78, 2)
  })

  it('blends transparent text onto the background', () => {
    expect(contrast('rgba(0, 0, 0, 0)', '#FFFFFF')).toBeCloseTo(1, 5)
    // The old footer: cream at 50 % on macchiato.
    expect(contrast('rgba(255, 243, 230, 0.5)', '#928168')).toBeLessThan(2.5)
  })
})

describe('lightTheme', () => {
  const AA = 4.5

  it.each([
    ['white (paper)', '#FFFFFF'],
    ['cream (default background)', '#FFF3E6'],
    ['soft beige (surfaces)', '#F5EDE4'],
  ])('text.secondary reads on %s with at least 4.5:1', (_, background) => {
    expect(
      contrast(lightTheme.palette.text.secondary, background)
    ).toBeGreaterThanOrEqual(AA)
  })

  it('text.primary reads on the same backgrounds', () => {
    for (const background of ['#FFFFFF', '#FFF3E6', '#F5EDE4']) {
      expect(
        contrast(lightTheme.palette.text.primary, background)
      ).toBeGreaterThanOrEqual(AA)
    }
  })

  it('uses the German MUI locale (Pagination, Rating)', () => {
    const components = lightTheme.components ?? {}
    const pagination = components.MuiPagination?.defaultProps
    const rating = components.MuiRating?.defaultProps

    expect(pagination?.getItemAriaLabel?.('page', 3, false)).toBe(
      'Gehe zu Seite 3'
    )
    expect(pagination?.getItemAriaLabel?.('next', 4, false)).toBe(
      'Zur nächsten Seite'
    )
    expect(rating?.getLabelText?.(4)).toBe('4 Sterne')
    expect(rating?.emptyLabelText).toBe('Keine Wertung')
  })
})

describe('footer colours', () => {
  it.each(Object.entries(FOOTER_COLORS.text))(
    'text colour "%s" reads on the footer background with at least 4.5:1',
    (_, color) => {
      expect(contrast(color, FOOTER_COLORS.background)).toBeGreaterThanOrEqual(
        4.5
      )
    }
  )
})

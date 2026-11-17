import { screen } from '@testing-library/react'
import { renderWithTheme } from '@bakery/shared/test-utils'
import { LEGAL } from '../../config/legal'
import QuickInfoBar from './QuickInfoBar'

// The real getOpenStatus against a fake clock: UTC instants, evaluated in
// German time - never the real date.
const renderAt = (isoUtc: string) => {
  jest.useFakeTimers().setSystemTime(new Date(isoUtc))
  return renderWithTheme(<QuickInfoBar />)
}

describe('QuickInfoBar', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('on 2026-12-25 at 09:00 German time it shows "Feiertag", not "Jetzt geöffnet"', () => {
    renderAt('2026-12-25T08:00:00Z')

    expect(screen.getByText('Feiertag')).toBeInTheDocument()
    expect(
      screen.getByText(
        '1. Weihnachtstag – Öffnungszeiten bitte telefonisch erfragen'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('Jetzt geöffnet')).not.toBeInTheDocument()
    expect(screen.queryByText('Geschlossen')).not.toBeInTheDocument()
  })

  it('on a normal Tuesday at 09:00 German time it is open with today’s hours', () => {
    renderAt('2026-11-17T08:00:00Z')

    expect(screen.getByText('Jetzt geöffnet')).toBeInTheDocument()
    expect(screen.getByText(/^Heute \d/)).toBeInTheDocument()
  })

  it('before opening time it names today’s opening time', () => {
    renderAt('2026-11-17T23:30:00Z') // Mi 00:30 in Berlin

    expect(screen.getByText(/^Öffnet um \d+:\d{2} Uhr$/)).toBeInTheDocument()
  })

  it('on the Ruhetag it is closed and names the next opening', () => {
    renderAt('2026-11-16T09:00:00Z') // Mo 10:00

    expect(screen.getByText('Geschlossen')).toBeInTheDocument()
    expect(screen.getByText(/^Nächste Öffnung: Dienstag /)).toBeInTheDocument()
  })

  it('phone and order cards call the shop number from LEGAL', () => {
    renderAt('2026-11-17T08:00:00Z')

    expect(screen.getByText(LEGAL.phone).closest('a')).toHaveAttribute(
      'href',
      LEGAL.phoneHref
    )
    expect(
      screen.getByText('Telefonisch oder vor Ort').closest('a')
    ).toHaveAttribute('href', LEGAL.phoneHref)
  })
})

import React from 'react'
import { render, screen } from '@testing-library/react'
import { DayKindNotice } from './DayKindNotice'
import type { DayKind } from '../../lib/backzettelApi'

const kind = (over: Partial<DayKind>): DayKind => ({
  date: '2026-12-24',
  weekday: 4,
  baseWeekday: 4,
  kind: 'normal',
  open: true,
  bakeDay: true,
  doughDay: true,
  holidayName: null,
  note: null,
  openUntil: null,
  before: null,
  calendar: 'ok',
  label: null,
  detail: null,
  ...over,
})

describe('DayKindNotice (U9)', () => {
  it('normaler Tag mit Kalender: nichts', () => {
    const { container } = render(<DayKindNotice dayKind={kind({})} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('Tag vor Schließtagen: Titel und geschlossene Tage', () => {
    render(
      <DayKindNotice
        dayKind={kind({
          before: {
            type: 'samstag_ersatz',
            closedDays: [],
            nextDoughDay: '2026-12-29',
          },
          label: 'Samstags-Satz',
          detail: 'danach geschlossen: Fr 25.12. Testfeiertag',
        })}
      />
    )
    expect(screen.getByTestId('day-kind')).toHaveTextContent(
      'Samstags-Satzdanach geschlossen: Fr 25.12. Testfeiertag'
    )
  })

  it('Kalender fehlt: Hinweis', () => {
    render(
      <DayKindNotice
        dayKind={kind({ calendar: 'missing' })}
        calendarHint={{ code: 'calendar_missing', message: 'Kalender fehlt' }}
      />
    )
    expect(screen.queryByTestId('day-kind')).toBeNull()
    expect(screen.getByTestId('calendar-hint')).toHaveTextContent(
      'Kalender fehlt'
    )
  })
})

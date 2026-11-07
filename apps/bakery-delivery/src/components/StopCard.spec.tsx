import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import type { Stop } from '../lib/delivery-api'
import { formatTime } from '../lib/format'
import { StopCard } from './StopCard'

// Synthetischer Stopp: die Sammelstelle mit Zeitfenster 09:00-09:30.
function stop(overrides: Partial<Stop> = {}): Stop {
  return {
    id: 2,
    customer: 'Kindergarten Mörsbach',
    street: 'Höhenstraße 24',
    zip: '66482',
    city: 'Zweibrücken-Mörsbach',
    address: 'Höhenstraße 24, 66482 Zweibrücken-Mörsbach',
    phone: null,
    timeWindow: '09:00-09:30',
    notes: null,
    items: [],
    status: 'open',
    completedAt: null,
    failureReason: null,
    goodsDisposition: null,
    lat: 49.302619,
    lon: 7.3937453,
    geocodeSource: 'nominatim',
    geocodePrecision: 'house',
    estimatedArrival: '2026-09-19T07:00:00.000Z',
    ...overrides,
  }
}

function renderCard(s: Stop) {
  return render(
    <ul>
      <StopCard
        stop={s}
        position={1}
        isNext={false}
        distance={null}
        busy={false}
        onStatusChange={jest.fn()}
      />
    </ul>
  )
}

describe('StopCard – Zeitfenster', () => {
  // Regression: an der Sammelstelle stand „Ankunft ca. 06:34" - Abfahrt plus
  // vier Minuten Fahrt, das Fenster 09:00-09:30 spielte keine Rolle. Der
  // Server wartet jetzt bis zum Fensterbeginn und schickt die Wartezeit mit.
  it('zeigt die Wartezeit bis zum Fensterbeginn', () => {
    renderCard(
      stop({ waitSeconds: 2 * 3600 + 26 * 60, missesTimeWindow: false })
    )

    expect(screen.getByText('Wartezeit bis Fensterbeginn')).toBeTruthy()
    expect(screen.getByText('2 h 26 min')).toBeTruthy()
    expect(screen.queryByText(/nicht mehr einhaltbar/)).toBeNull()
  })

  it('verschweigt eine Wartezeit unter einer halben Minute', () => {
    renderCard(stop({ waitSeconds: 20 }))
    expect(screen.queryByText('Wartezeit bis Fensterbeginn')).toBeNull()
  })

  it('kommt ohne die neuen Felder aus (ältere Offline-Kopie)', () => {
    renderCard(stop())
    expect(screen.queryByText('Wartezeit bis Fensterbeginn')).toBeNull()
    expect(screen.queryByText(/nicht mehr einhaltbar/)).toBeNull()
    expect(screen.getByText('Ankunft ca.')).toBeTruthy()
  })

  it('weist auf ein Fenster hin, das nicht mehr einhaltbar ist', () => {
    renderCard(
      stop({
        estimatedArrival: '2026-09-19T07:45:00.000Z',
        waitSeconds: 0,
        missesTimeWindow: true,
      })
    )

    const hint = screen.getByText(/nicht mehr einhaltbar/)
    expect(hint.textContent).toContain('Zeitfenster 09:00-09:30')
    // Ueber `formatTime`, damit der Test nicht an der Zeitzone des Rechners haengt.
    expect(hint.textContent).toContain(
      `Ankunft erst gegen ${formatTime('2026-09-19T07:45:00.000Z')} Uhr`
    )
  })

  it('zeigt an einem erledigten Stopp weder Wartezeit noch Hinweis', () => {
    renderCard(
      stop({
        status: 'done',
        completedAt: '2026-09-19T07:10:00.000Z',
        estimatedArrival: null,
        waitSeconds: 600,
        missesTimeWindow: true,
      })
    )
    expect(screen.queryByText('Wartezeit bis Fensterbeginn')).toBeNull()
    expect(screen.queryByText(/nicht mehr einhaltbar/)).toBeNull()
  })
})

describe('StopCard – Planung', () => {
  it('fragt vor dem Entfernen eines Stopps nach', () => {
    // Regression: „Entfernen" löschte den Stopp samt Ware und Hinweis beim
    // ersten Tippen - direkt neben „Nach unten".
    const onRemove = jest.fn()
    render(
      <ul>
        <StopCard
          stop={stop({ customer: 'Testkunde Ahorn', pickupPointId: null })}
          position={1}
          isNext={false}
          distance={null}
          busy={false}
          onStatusChange={jest.fn()}
          onRemove={onRemove}
          onMove={jest.fn()}
        />
      </ul>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }))
    expect(onRemove).not.toHaveBeenCalled()
    expect(
      screen.getByRole('alertdialog', { name: 'Stopp entfernen?' }).textContent
    ).toMatch(/Testkunde Ahorn/)

    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(onRemove).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ja, entfernen' }))
    expect(onRemove).toHaveBeenCalledWith(2)
  })
})

describe('StopCard – Sammelstelle', () => {
  const preorders = [
    {
      id: 11,
      reference: 'MO-2026-09-19-01',
      pickupPointId: 'kindergarten-moersbach',
      date: '2026-09-19',
      customer: 'Testfamilie Ahorn',
      phone: null,
      items: [],
      total: 5,
      note: null,
      status: 'open' as const,
      handedOverAt: null,
      createdAt: '2026-09-17T08:00:00.000Z',
      updatedAt: '2026-09-17T08:00:00.000Z',
      deadline: '2026-09-18T10:00:00.000Z',
      afterDeadline: false,
    },
  ]

  function renderPickup(collapseHandover: boolean) {
    return render(
      <ul>
        <StopCard
          stop={stop({ pickupPointId: 'kindergarten-moersbach', preorders })}
          position={1}
          isNext={false}
          distance={null}
          busy={false}
          onStatusChange={jest.fn()}
          onPreorderStatusChange={jest.fn()}
          collapseHandover={collapseHandover}
        />
      </ul>
    )
  }

  it('klappt die Übergabeliste in „Alle Stopps" zu, die Kopfzeile bleibt sichtbar', () => {
    const { container } = renderPickup(true)
    const details = container.querySelector('details')
    expect(details).not.toBeNull()
    expect(details?.open).toBe(false)
    expect(details?.querySelector('summary')?.textContent).toBe(
      'Übergabeliste (1)'
    )
    // Die Zahlen stehen außerhalb der zugeklappten Liste.
    expect(screen.getByText(/0 von 1 übergeben/).closest('details')).toBeNull()
  })

  it('zeigt die Übergabeliste im Block „Nächster Stopp" offen', () => {
    const { container } = renderPickup(false)
    expect(container.querySelector('details')).toBeNull()
    expect(screen.getByText('Testfamilie Ahorn')).toBeTruthy()
  })
})

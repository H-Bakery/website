/**
 * Fehlertexte der Korrektur in der Zeile: was Browser oder Proxy statt einer
 * Antwort melden, gehört nicht auf den Backzettel - die deutsche Meldung der
 * API schon. Erfundene Zeile (`backzettelFixtures`), nichts aus hq.
 */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { ApiError } from '@bakery/shared/data-access'
import { CorrectionEditor } from './CorrectionEditor'
import { OFFLINE_TEXT } from '../../lib/backstubeErrors'
import { v2Line } from '../../lib/backzettelFixtures'

const LINE = v2Line({
  itemId: 'test-korn',
  name: 'Testkorn',
  section: 'brot',
  base: 12,
})

async function saveRejectedWith(error: unknown): Promise<HTMLElement> {
  const onSave = jest.fn().mockRejectedValue(error)
  render(
    <CorrectionEditor
      line={LINE}
      label="Testkorn"
      onSave={onSave}
      onCancel={() => undefined}
      idPrefix="t"
    />
  )
  fireEvent.change(screen.getByLabelText('Korrektur'), {
    target: { value: '3' },
  })
  fireEvent.change(screen.getByLabelText('Grund'), {
    target: { value: 'Testgrund' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
  const alert = await screen.findByRole('alert')
  expect(onSave).toHaveBeenCalledWith(3, 'Testgrund')
  return alert
}

describe('CorrectionEditor: Fehlertexte', () => {
  it('WLAN weg („Failed to fetch“): deutscher Satz statt Browsermeldung', async () => {
    const alert = await saveRejectedWith(new TypeError('Failed to fetch'))
    expect(alert).toHaveTextContent(
      'Keine Verbindung zum Server – bitte WLAN prüfen.'
    )
    expect(alert).not.toHaveTextContent('Failed to fetch')
  })

  it('Caddy meldet 502: deutscher Text, nie „HTTP 502“', async () => {
    const alert = await saveRejectedWith(
      new ApiError('HTTP 502: Bad Gateway', 502)
    )
    expect(alert).toHaveTextContent(OFFLINE_TEXT)
    expect(alert).not.toHaveTextContent('HTTP 502')
    expect(alert).not.toHaveTextContent('Bad Gateway')
  })

  it('eine deutsche Meldung der API (correction_changed) bleibt, wie sie ist', async () => {
    const message =
      'Die Korrektur dieser Zeile wurde inzwischen auf +2 gesetzt. Deine Eingabe wurde nicht gespeichert - bitte prüfen und erneut speichern.'
    const alert = await saveRejectedWith(
      new ApiError(message, 409, 'correction_changed')
    )
    expect(alert).toHaveTextContent(message)
    expect(alert.textContent).toBe(message)
  })
})

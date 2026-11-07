import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { useTheme } from '@mui/material/styles'
import { ThemeProvider } from '@bakery/shared/contexts'
import { MuiThemeBridge } from '../app/Providers'

/**
 * Review r2: der Kassentag (und jede Seite ohne eigene Druckansicht) kam aus
 * dem Dunkelmodus mit der dunklen Palette aufs Papier - hellgrau auf Weiß,
 * mit Hintergrundgrafiken ein schwarzes Blatt. Beim Drucken gilt das helle
 * Theme, danach wieder das gewählte.
 */
function Probe() {
  const theme = useTheme()
  return (
    <span data-testid="probe">
      {theme.palette.mode} {theme.palette.text.primary}
    </span>
  )
}

function renderBridge() {
  return render(
    <ThemeProvider defaultMode="dark" storageKey="print-mode-spec">
      <MuiThemeBridge>
        <Probe />
      </MuiThemeBridge>
    </ThemeProvider>
  )
}

describe('Druck aus dem Dunkelmodus', () => {
  beforeEach(() => window.localStorage.clear())

  it('rendert beim Drucken hell und danach wieder dunkel', () => {
    renderBridge()
    expect(screen.getByTestId('probe')).toHaveTextContent(/^dark /)

    act(() => {
      window.dispatchEvent(new Event('beforeprint'))
    })
    // sofort (flushSync), nicht erst nach dem Druckbild
    expect(screen.getByTestId('probe')).toHaveTextContent(
      'light rgba(0, 0, 0, 0.87)'
    )

    act(() => {
      window.dispatchEvent(new Event('afterprint'))
    })
    expect(screen.getByTestId('probe')).toHaveTextContent(/^dark /)
  })

  it('ändert die gespeicherte Wahl nicht', () => {
    renderBridge()
    const before = window.localStorage.getItem('print-mode-spec')
    act(() => {
      window.dispatchEvent(new Event('beforeprint'))
    })
    act(() => {
      window.dispatchEvent(new Event('afterprint'))
    })
    expect(window.localStorage.getItem('print-mode-spec')).toBe(before)
  })
})

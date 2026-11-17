import { StrictMode, createElement as h, useState } from 'react'
import { act, render, waitFor } from '@testing-library/react'
import { VERLAUF_MARKE, useZurueckSchliesst } from './verlauf'

// (Ohne JSX: Die Datei ist .ts.) jsdom führt einen echten Verlauf: `history.back()` springt zurück und
// meldet das (wie der Browser) etwas später mit `popstate`.

const marke = (): unknown =>
  (window.history.state as Record<string, unknown> | null)?.[VERLAUF_MARKE]

/** Wartet, bis der Verlauf nach einem `back()` angekommen ist. */
const zurueckGelandet = () => waitFor(() => expect(marke()).toBeUndefined())

let back: jest.SpyInstance
let push: jest.SpyInstance

beforeEach(() => {
  // Ein frischer Eintrag ohne Marke oben, ohne Schritte nach vorn.
  window.history.pushState({ vorher: true }, '')
  back = jest.spyOn(window.history, 'back')
  push = jest.spyOn(window.history, 'pushState')
})

afterEach(() => {
  back.mockRestore()
  push.mockRestore()
})

function Ansicht({
  offen = true,
  onClose,
  merke,
}: {
  offen?: boolean
  onClose: () => void
  merke?: (schliesse: () => void) => void
}) {
  const schliesse = useZurueckSchliesst(offen, onClose)
  merke?.(schliesse)
  return null
}

/** Wie die App: Die Ansicht steht nur da, solange sie offen ist. */
function Rahmen({ onClose }: { onClose: () => void }) {
  const [offen, setOffen] = useState(true)
  return offen
    ? h(Ansicht, {
        onClose: () => {
          onClose()
          setOffen(false)
        },
      })
    : null
}

describe('useZurueckSchliesst', () => {
  it('legt beim Öffnen genau einen Eintrag an - dieselbe Adresse, mit Marke, alter Zustand bleibt', () => {
    const adresse = window.location.href
    const laenge = window.history.length
    render(h(Ansicht, { onClose: jest.fn() }))
    expect(push).toHaveBeenCalledTimes(1)
    expect(window.history.length).toBe(laenge + 1)
    expect(window.location.href).toBe(adresse)
    expect(typeof marke()).toBe('string')
    // Der Zustand des Eintrags darunter (bei Next.js `__NA`) kommt mit.
    expect(window.history.state).toMatchObject({ vorher: true })
  })

  it('unter React StrictMode: trotzdem nur ein Eintrag', async () => {
    const laenge = window.history.length
    render(h(StrictMode, null, h(Ansicht, { onClose: jest.fn() })))
    expect(window.history.length).toBe(laenge + 1)
    // Das verzögerte Aufräumen des ersten Abbaus nimmt ihn nicht wieder weg.
    await act(() => new Promise((r) => setTimeout(r, 20)))
    expect(back).not.toHaveBeenCalled()
    expect(typeof marke()).toBe('string')
  })

  it('Zurück im Browser (Geste) schließt die Ansicht - einmal, ohne weiteres back()', async () => {
    const onClose = jest.fn()
    render(h(Rahmen, { onClose }))
    window.history.back()
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(marke()).toBeUndefined()
    expect(back).toHaveBeenCalledTimes(1) // nur das eigene oben
  })

  it('von innen geschlossen („Zurück“, Escape): ein back(), ein onClose, kein toter Eintrag', async () => {
    const onClose = jest.fn()
    let schliesse = () => undefined as void
    const laenge = window.history.length
    const { unmount } = render(
      h(Ansicht, { onClose, merke: (s) => (schliesse = s) })
    )
    act(() => schliesse())
    expect(back).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    await zurueckGelandet()
    // Das popstate des eigenen back() schließt nicht ein zweites Mal.
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(window.history.state).toMatchObject({ vorher: true })
    unmount()
    await act(() => new Promise((r) => setTimeout(r, 20)))
    expect(back).toHaveBeenCalledTimes(1)
    // Der Eintrag gilt als Schritt nach vorn, nicht als zusätzlicher.
    expect(window.history.length).toBe(laenge + 1)
  })

  it('abgebaut, während schon ein anderer Eintrag oben liegt: kein back()', async () => {
    const onClose = jest.fn()
    const { unmount } = render(h(Ansicht, { onClose }))
    // Etwa ein Raumwechsel: ein neuer Schritt über dem der Ansicht.
    window.history.pushState({ raum: 'test' }, '')
    unmount()
    await act(() => new Promise((r) => setTimeout(r, 20)))
    expect(back).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('von außen geschlossen, der eigene Eintrag liegt oben: er wird herausgenommen', async () => {
    const onClose = jest.fn()
    const { rerender } = render(h(Ansicht, { offen: true, onClose }))
    rerender(h(Ansicht, { offen: false, onClose }))
    await waitFor(() => expect(back).toHaveBeenCalledTimes(1))
    await zurueckGelandet()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('gleich wieder geöffnet: wartet, bis das alte Zurück angekommen ist', async () => {
    const laenge = window.history.length
    const erste = jest.fn()
    let schliesse = () => undefined as void
    const { unmount } = render(
      h(Ansicht, { onClose: erste, merke: (s) => (schliesse = s) })
    )
    act(() => schliesse())
    unmount()
    // Sofort die nächste Ansicht - das back() der ersten ist noch unterwegs.
    // (Ein Browser zählte es danach vom neuen Eintrag aus und schlösse die
    // zweite; jsdom bräche es ab und ließe den der ersten liegen.)
    const zweite = jest.fn()
    render(h(Ansicht, { onClose: zweite }))
    expect(push).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(push).toHaveBeenCalledTimes(2))
    await act(() => new Promise((r) => setTimeout(r, 20)))
    expect(zweite).not.toHaveBeenCalled()
    expect(typeof marke()).toBe('string')
    // Unter dem Eintrag der zweiten liegt der vorige, nicht der der ersten.
    expect(window.history.length).toBe(laenge + 1)
  })

  it('speichert nichts auf dem Gerät', async () => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    render(h(Rahmen, { onClose: jest.fn() }))
    window.history.back()
    await zurueckGelandet()
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })
})

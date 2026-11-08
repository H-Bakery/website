import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import LogoutButton from './LogoutButton'
import { fakeSession, WithSession } from '../../lib/testing/fakeSession'
import { useMemoryStorage } from '../../lib/testing/memoryStorage'

describe('LogoutButton (Abschluss-Verifikation next)', () => {
  beforeEach(() => {
    useMemoryStorage()
  })

  it('meldet ohne Entwurf sofort ab', async () => {
    const session = fakeSession({ role: 'verkauf' })
    render(
      <WithSession value={session}>
        <LogoutButton />
      </WithSession>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }))
    await waitFor(() => expect(session.logout).toHaveBeenCalled())
  })

  it('fragt nach, wenn „Rest am Abend“ ungespeicherte Eingaben hat', async () => {
    window.localStorage.setItem(
      'bakery-rest-draft:1:2026-12-01',
      JSON.stringify({ 'weck||test-weck': { qty: 4, base: null } })
    )
    const session = fakeSession({ role: 'verkauf' })
    render(
      <WithSession value={session}>
        <LogoutButton />
      </WithSession>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }))
    expect(await screen.findByText('Zählung nicht gespeichert')).toBeTruthy()
    expect(screen.getByText(/01\.12\./)).toBeTruthy()
    expect(session.logout).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Angemeldet bleiben' }))
    expect(session.logout).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Trotzdem abmelden' })
    )
    await waitFor(() => expect(session.logout).toHaveBeenCalled())
  })

  it('der Entwurf einer anderen Person zählt nicht', async () => {
    window.localStorage.setItem(
      'bakery-rest-draft:2:2026-12-01',
      JSON.stringify({ 'weck||test-weck': { qty: 4, base: null } })
    )
    const session = fakeSession({ role: 'verkauf' })
    render(
      <WithSession value={session}>
        <LogoutButton />
      </WithSession>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }))
    await waitFor(() => expect(session.logout).toHaveBeenCalled())
  })
})

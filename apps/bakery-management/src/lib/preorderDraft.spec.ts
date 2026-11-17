import {
  draftKey,
  draftMayHaveArrived,
  draftOutcomeAfter,
  readPreorderDraft,
  savePreorderDraft,
  type PreorderDraftFields,
} from './preorderDraft'

const FIELDS: PreorderDraftFields = {
  customerName: 'Testkundin',
  customerPhone: '',
  channel: 'telefon',
  pickupPointId: '',
  pickupDate: '2026-11-20',
  pickupTime: '',
  paid: false,
  note: '',
  lines: [],
}

/** `sessionStorage` als echter Speicher. */
function memorySessionStorage(): Map<string, string> {
  const data = new Map<string, string>()
  const store = window.sessionStorage as unknown as Record<string, jest.Mock>
  store.getItem.mockImplementation((key: string) =>
    data.has(key) ? data.get(key) : null
  )
  store.setItem.mockImplementation((key: string, value: string) => {
    data.set(key, String(value))
  })
  store.removeItem.mockImplementation((key: string) => {
    data.delete(key)
  })
  return data
}

describe('draftOutcomeAfter', () => {
  it('abgelehnt bleibt abgelehnt, solange kein Versuch davor unklar war', () => {
    expect(draftOutcomeAfter('refused', 'refused')).toBe('refused')
    expect(draftOutcomeAfter('offline', 'refused')).toBe('offline')
    expect(draftOutcomeAfter('server', 'refused')).toBe('server')
    expect(draftOutcomeAfter(null, 'refused')).toBeNull()
  })

  it('ohne (gültige) Antwort ist der Ausgang immer unklar', () => {
    expect(draftOutcomeAfter('refused', 'offline')).toBe('offline')
    expect(draftOutcomeAfter('refused', 'server')).toBe('server')
    expect(draftOutcomeAfter(null, 'offline')).toBe('offline')
  })

  it('request_id_changed: ein früherer Versuch ist angekommen', () => {
    expect(draftOutcomeAfter('refused', 'refused', true)).toBeNull()
  })
})

describe('Entwurf mit Ausgang des Speicherns', () => {
  let stored: Map<string, string>
  beforeEach(() => {
    stored = memorySessionStorage()
  })

  it('merkt sich „refused“ und liest es wieder', () => {
    savePreorderDraft(7, FIELDS, 'kennung-1', 'refused')
    const draft = readPreorderDraft(7)
    expect(draft?.outcome).toBe('refused')
    expect(draft?.requestId).toBe('kennung-1')
    expect(draft && draftMayHaveArrived(draft)).toBe(false)
  })

  it('unklar (ohne Antwort, 5xx, Versuch lief noch): „vielleicht angekommen“', () => {
    for (const outcome of ['offline', 'server', null] as const) {
      savePreorderDraft(7, FIELDS, 'kennung-1', outcome)
      const draft = readPreorderDraft(7)
      expect(draft && draftMayHaveArrived(draft)).toBe(true)
    }
  })

  it('ohne Kennung kein Ausgang - und nichts „vielleicht angekommen“', () => {
    savePreorderDraft(7, FIELDS, null, 'refused')
    const draft = readPreorderDraft(7)
    expect(draft).not.toHaveProperty('outcome')
    expect(draft && draftMayHaveArrived(draft)).toBe(false)
  })

  it('ein alter Entwurf ohne das Feld gilt wie bisher als unklar', () => {
    stored.set(
      draftKey(7),
      JSON.stringify({
        ...FIELDS,
        userId: '7',
        savedAt: new Date().toISOString(),
        requestId: 'alt-1',
      })
    )
    const draft = readPreorderDraft(7)
    expect(draft?.requestId).toBe('alt-1')
    expect(draft && draftMayHaveArrived(draft)).toBe(true)
  })
})

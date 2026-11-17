import { readFileSync } from 'fs'
import { join } from 'path'
import { MODELL_NOCHMAL, fetchBytes, holeModell } from './holeModell'

/**
 * Eine Antwort wie von `fetch`, deren Körper in Stücken kommt - nur das, was
 * `fetchBytes` liest. Synthetische Bytes, kein Modell.
 */
function antwort(
  stuecke: number[],
  { status = 200, kopf = {} as Record<string, string> } = {}
) {
  let i = 0
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => kopf[name.toLowerCase()] ?? null },
    body: {
      getReader: () => ({
        read: async () =>
          i < stuecke.length
            ? { done: false, value: new Uint8Array(stuecke[i++]).fill(7) }
            : { done: true, value: undefined },
      }),
    },
    arrayBuffer: async () =>
      new Uint8Array(stuecke.reduce((a, b) => a + b, 0)).buffer,
  }
}

const fetchMock = jest.fn()
beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
})

const ADRESSE = '/model/testladen.glb'
const ohnePause = { pauseMs: 0 }

/** Alle gemeldeten Werte eines Abrufs. */
async function werte(
  stuecke: number[],
  bytes: number | undefined,
  kopf: Record<string, string> = {}
): Promise<{ werte: number[]; laenge: number }> {
  fetchMock.mockResolvedValue(antwort(stuecke, { kopf }))
  const gemeldet: number[] = []
  const daten = await holeModell(ADRESSE, {
    signal: new AbortController().signal,
    bytes,
    onFortschritt: (f) => gemeldet.push(f),
  })
  return { werte: gemeldet, laenge: daten.byteLength }
}

const steigt = (liste: number[]) =>
  liste.every((wert, i) => i === 0 || wert > liste[i - 1])

describe('holeModell: Fortschritt', () => {
  it('zählt nach der erwarteten Größe und endet bei 1', async () => {
    const { werte: w, laenge } = await werte([250, 250, 500], 1000)
    // Fertig ist es erst, wenn der Strom zu Ende ist - nicht schon beim letzten Paket.
    expect(w).toEqual([0.25, 0.5, 0.99, 1])
    expect(laenge).toBe(1000)
  })

  it('Content-Length geht vor der erwarteten Größe', async () => {
    const { werte: w } = await werte([100, 100], 99999, {
      'content-length': '200',
    })
    expect(w).toEqual([0.5, 0.99, 1])
  })

  it('die Datei ist größer als erwartet: steigt nur, ist nie vor dem Ende fertig, endet bei 1', async () => {
    const { werte: w, laenge } = await werte([400, 400, 400, 400], 1000)
    expect(steigt(w)).toBe(true)
    expect(w.slice(0, -1).every((f) => f < 1)).toBe(true)
    expect(w.at(-1)).toBe(1)
    expect(laenge).toBe(1600)
  })

  it('die Datei ist viel kleiner als erwartet (wie das Fixture): endet trotzdem bei 1', async () => {
    const { werte: w } = await werte([20, 20], 3_000_000)
    expect(steigt(w)).toBe(true)
    expect(w[0]).toBeLessThan(0.01)
    expect(w.at(-1)).toBe(1)
  })

  it('gepackt ausgeliefert: zählt nach der erwarteten Größe, nicht nach den gepackten Bytes', async () => {
    const { werte: w } = await werte([500, 500], 1000, {
      'content-encoding': 'gzip',
      'content-length': '300',
    })
    expect(w).toEqual([0.5, 0.99, 1])
  })

  it('ohne jede Größe: nur 1 am Ende', async () => {
    const { werte: w } = await werte([10, 10], undefined)
    expect(w).toEqual([1])
  })

  it('ein neuer Versuch nach einem Netzfehler fängt nicht wieder bei 0 an', async () => {
    const gemeldet: number[] = []
    let versuch = 0
    fetchMock.mockImplementation(async () => {
      versuch += 1
      if (versuch === 1) {
        // halb gelesen, dann reißt die Verbindung ab
        const halb = antwort([500])
        const reader = halb.body.getReader()
        let gelesen = false
        halb.body.getReader = () => ({
          read: async () => {
            if (!gelesen) {
              gelesen = true
              return reader.read()
            }
            throw new TypeError('network error')
          },
        })
        return halb
      }
      return antwort([250, 250, 250, 250])
    })
    await holeModell(ADRESSE, {
      signal: new AbortController().signal,
      bytes: 1000,
      onFortschritt: (f) => gemeldet.push(f),
      ...ohnePause,
    })
    expect(gemeldet).toEqual([0.5, 0.75, 0.99, 1])
  })
})

describe('holeModell: Fehler und Abbruch', () => {
  it('wiederholt einen Netzfehler zweimal und gibt dann auf', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(
      holeModell(ADRESSE, {
        signal: new AbortController().signal,
        ...ohnePause,
      })
    ).rejects.toThrow(TypeError)
    expect(MODELL_NOCHMAL).toBe(2)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('gelingt der zweite Versuch, gibt es keinen Fehler', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue(antwort([8]))
    const daten = await holeModell(ADRESSE, {
      signal: new AbortController().signal,
      ...ohnePause,
    })
    expect(daten.byteLength).toBe(8)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('wiederholt eine Antwort mit Fehlerstatus (404) nicht', async () => {
    fetchMock.mockResolvedValue(antwort([], { status: 404 }))
    await expect(
      holeModell(ADRESSE, {
        signal: new AbortController().signal,
        ...ohnePause,
      })
    ).rejects.toThrow('404')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('Abbrechen endet mit einem AbortError und ohne neuen Versuch', async () => {
    const abbruch = new AbortController()
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_, ablehnen) => {
          init.signal.addEventListener('abort', () =>
            ablehnen(new DOMException('aborted', 'AbortError'))
          )
        })
    )
    const daten = holeModell(ADRESSE, { signal: abbruch.signal, ...ohnePause })
    abbruch.abort()
    await expect(daten).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('Abbrechen in der Pause vor dem nächsten Versuch: AbortError, kein weiterer Abruf', async () => {
    const abbruch = new AbortController()
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    const daten = holeModell(ADRESSE, {
      signal: abbruch.signal,
      pauseMs: 60_000,
    })
    // Erster Abruf gescheitert, die Pause läuft.
    await new Promise((weiter) => setTimeout(weiter, 0))
    abbruch.abort()
    await expect(daten).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('schon abgebrochen: kein Abruf', async () => {
    const abbruch = new AbortController()
    abbruch.abort()
    await expect(
      holeModell(ADRESSE, { signal: abbruch.signal })
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fragt genau so an wie der preload-Link im HTML: nur URL und Signal', async () => {
    fetchMock.mockResolvedValue(antwort([4]))
    const abbruch = new AbortController()
    await fetchBytes(ADRESSE, abbruch.signal, undefined, () => undefined)
    expect(fetchMock).toHaveBeenCalledWith(ADRESSE, { signal: abbruch.signal })
  })
})

describe('holeModell.ts', () => {
  it('importiert nichts aus three (sonst wartete der Abruf auf den three-Chunk)', () => {
    const quelle = readFileSync(join(__dirname, 'holeModell.ts'), 'utf8')
    expect(quelle).not.toMatch(/from\s+['"]three/)
    expect(quelle).not.toMatch(/import\(\s*['"]three/)
    expect(quelle).not.toMatch(/require\(\s*['"]three/)
  })
})

import { ApiClient, ApiError, filenameFromDisposition } from './api-client'

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: { get: () => 'application/json' },
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

describe('ApiClient', () => {
  const fetchMock = jest.fn()
  let client: ApiClient

  beforeEach(() => {
    fetchMock.mockReset()
    ;(global as unknown as { fetch: unknown }).fetch = fetchMock
    client = new ApiClient({ baseUrl: 'http://api.test/' })
  })

  function sentHeaders(call: number): Record<string, string> {
    return fetchMock.mock.calls[call][1].headers
  }

  it('schickt das Bearer-Token und zusätzliche Header je Anfrage', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: 1 }))
    client.setAuthToken('tok-1')
    await client.get('/api/x', undefined, {
      headers: { 'X-Station-Token': 'st_abc' },
    })
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/x')
    expect(sentHeaders(0)['Authorization']).toBe('Bearer tok-1')
    expect(sentHeaders(0)['X-Station-Token']).toBe('st_abc')
  })

  it('wirft ApiError mit Status, Code und deutscher Meldung', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, { error: 'forbidden', message: 'Keine Berechtigung.' })
    )
    await expect(client.get('/api/x')).rejects.toMatchObject({
      status: 403,
      code: 'forbidden',
      message: 'Keine Berechtigung.',
    })
  })

  it('erneuert bei 401 einmal und wiederholt die Anfrage mit dem neuen Token', async () => {
    client.setAuthToken('alt')
    const handler = jest.fn(async () => {
      client.setAuthToken('neu')
      return true
    })
    client.setUnauthorizedHandler(handler)
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(401, { error: 'unauthorized', message: 'abgelaufen' })
      )
      .mockResolvedValueOnce(jsonResponse(200, { success: true, data: 'ok' }))

    const res = await client.get<string>('/api/x')
    expect(res.data).toBe('ok')
    expect(handler).toHaveBeenCalledTimes(1)
    expect(sentHeaders(0)['Authorization']).toBe('Bearer alt')
    expect(sentHeaders(1)['Authorization']).toBe('Bearer neu')
  })

  it('wirft die 401, wenn die Erneuerung scheitert, und versucht es nur einmal', async () => {
    client.setAuthToken('alt')
    const handler = jest.fn(async () => false)
    client.setUnauthorizedHandler(handler)
    fetchMock.mockResolvedValue(
      jsonResponse(401, { error: 'unauthorized', message: 'abgelaufen' })
    )
    await expect(client.get('/api/x')).rejects.toBeInstanceOf(ApiError)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('wiederholt höchstens einmal, auch wenn die zweite Antwort wieder 401 ist', async () => {
    client.setAuthToken('alt')
    const handler = jest.fn(async () => true)
    client.setUnauthorizedHandler(handler)
    fetchMock.mockResolvedValue(
      jsonResponse(401, { error: 'unauthorized', message: 'abgelaufen' })
    )
    await expect(client.get('/api/x')).rejects.toMatchObject({ status: 401 })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fragt den Handler nicht ohne Token und nicht bei retryOnUnauthorized: false', async () => {
    const handler = jest.fn(async () => true)
    client.setUnauthorizedHandler(handler)
    fetchMock.mockResolvedValue(
      jsonResponse(401, { error: 'invalid_credentials', message: 'falsch' })
    )
    await expect(client.post('/api/auth/login', {})).rejects.toMatchObject({
      status: 401,
    })
    client.setAuthToken('tok')
    await expect(
      client.post('/api/auth/refresh', {}, { retryOnUnauthorized: false })
    ).rejects.toMatchObject({ status: 401 })
    expect(handler).not.toHaveBeenCalled()
  })

  it('setBaseUrl("") schickt Anfragen an die eigene Origin', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: 1 }))
    client.setBaseUrl('')
    expect(client.getBaseUrl()).toBe('')
    await client.get('/api/x', { a: 1 })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/x?a=1')
  })

  describe('getBlob', () => {
    function fileResponse(
      status: number,
      body: string,
      headers: Record<string, string>
    ) {
      const lower = Object.fromEntries(
        Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
      )
      return {
        ok: status >= 200 && status < 300,
        status,
        statusText: String(status),
        headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
        blob: async () => ({ size: body.length, text: async () => body }),
        json: async () => JSON.parse(body),
      }
    }

    it('lädt mit Bearer-Token, ohne Content-Type, und liest den Dateinamen', async () => {
      client.setAuthToken('tok')
      fetchMock.mockResolvedValue(
        fileResponse(200, 'a;b\n', {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="report.csv"',
        })
      )
      const result = await client.getBlob('/api/partners/1/report.csv?x=1')
      expect(fetchMock.mock.calls[0][0]).toBe(
        'http://api.test/api/partners/1/report.csv?x=1'
      )
      expect(sentHeaders(0)['Authorization']).toBe('Bearer tok')
      expect(sentHeaders(0)['Content-Type']).toBeUndefined()
      expect(result.filename).toBe('report.csv')
      expect(result.contentType).toContain('text/csv')
      expect(result.blob.size).toBe(4)
    })

    it('wirft ApiError mit der Meldung aus dem JSON-Fehler', async () => {
      fetchMock.mockResolvedValue(
        fileResponse(
          400,
          JSON.stringify({
            error: 'INVALID_RANGE',
            message: 'Zeitraum ungültig.',
          }),
          { 'Content-Type': 'application/json' }
        )
      )
      await expect(client.getBlob('/api/x.csv')).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_RANGE',
        message: 'Zeitraum ungültig.',
      })
    })

    it('erneuert bei 401 einmal und lädt dann mit dem neuen Token', async () => {
      client.setAuthToken('alt')
      client.setUnauthorizedHandler(async () => {
        client.setAuthToken('neu')
        return true
      })
      fetchMock
        .mockResolvedValueOnce(
          fileResponse(
            401,
            JSON.stringify({ error: 'unauthorized', message: 'abgelaufen' }),
            { 'Content-Type': 'application/json' }
          )
        )
        .mockResolvedValueOnce(
          fileResponse(200, 'x', { 'Content-Type': 'text/csv' })
        )
      const result = await client.getBlob('/api/x.csv')
      expect(result.filename).toBeNull()
      expect(sentHeaders(1)['Authorization']).toBe('Bearer neu')
    })
  })

  it('filenameFromDisposition kennt filename und filename*', () => {
    expect(filenameFromDisposition(null)).toBeNull()
    expect(filenameFromDisposition('attachment')).toBeNull()
    expect(filenameFromDisposition('attachment; filename=a.csv')).toBe('a.csv')
    expect(
      filenameFromDisposition(
        'attachment; filename="x.csv"; filename*=UTF-8\'\'B%C3%A4ckerei.csv'
      )
    ).toBe('Bäckerei.csv')
  })
})

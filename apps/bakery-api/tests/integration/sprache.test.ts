import * as fs from 'node:fs'
import { once } from 'node:events'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import * as os from 'node:os'
import * as path from 'node:path'
import { QueryTypes } from 'sequelize'
import request from 'supertest'
import { AuditLog, RestCount } from '../../src/models'
import { createTestApp, TestApp } from '../helpers/createTestApp'
import { bearer, sessionFor } from '../helpers/auth'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixture = require('../fixtures/backzettel.synthetic')
const DAY = '2026-12-08'
const NOW = new Date(`${DAY}T12:00Z`)
const KEY = 'weck||test-weck'
const env: NodeJS.ProcessEnv = {}
const provider = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
const warn = jest.fn()
const tokens = { verkauf: '', inhaber: '', backstube: '' }
let api: TestApp
let hq: string

function audio(seconds = 1) {
  const bytes = Buffer.alloc(44 + 32000 * seconds)
  bytes.write('RIFF')
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(16000, 24)
  bytes.writeUInt32LE(32000, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(bytes.length - 44, 40)
  return bytes
}

const getStatus = (role: keyof typeof tokens = 'verkauf') =>
  request(api.app).get('/api/sprache/status').set(bearer(tokens[role]))

const post = (
  role: keyof typeof tokens = 'verkauf',
  date = DAY,
  clip = audio()
) =>
  request(api.app)
    .post(`/api/sprache/verstehen?screen=rest&date=${date}`)
    .set(bearer(tokens[role]))
    .set('X-Forwarded-Proto', 'https')
    .type('audio/wav')
    .send(clip)

const response = (data: object) => new Response(JSON.stringify(data))
const localUnavailable = {
  error: 'voice_unavailable',
  message:
    'Die Spracherkennung auf der Bäckerei-Box antwortet nicht – bitte tippen.',
}

function useLocal(settings: NodeJS.ProcessEnv = {}) {
  delete env.MISTRAL_API_KEY
  delete env.OPENAI_API_KEY
  delete env.ANTHROPIC_API_KEY
  Object.assign(env, { VOICE_STT_PROVIDER: 'local', ...settings })
}

const usage = () =>
  api.sequelize.query<Record<string, unknown>>(
    'SELECT * FROM voice_usage ORDER BY id',
    { type: QueryTypes.SELECT }
  )

beforeAll(async () => {
  hq = fs.mkdtempSync(path.join(os.tmpdir(), 'sprache-test-'))
  fs.mkdirSync(path.join(hq, 'config'))
  fs.mkdirSync(path.join(hq, 'products'))
  fs.mkdirSync(path.join(hq, 'data', 'recipes', 'fillings'), {
    recursive: true,
  })
  fs.writeFileSync(
    path.join(hq, 'data', 'recipes', 'fillings', 'test.md'),
    fixture.RECIPE_MD
  )
  for (const product of fixture.PRODUCTS) {
    fs.writeFileSync(
      path.join(hq, 'products', `${product.numeric_id}-${product.id}.md`),
      `---\nid: ${product.id}\nnumeric_id: ${product.numeric_id}\nname: Test ${product.id}\nprice: 1.5\navailable: true\n---\n\nTest\n`
    )
  }
  fs.writeFileSync(
    path.join(hq, 'config', 'backzettel.yaml'),
    JSON.stringify(fixture.config())
  )
  api = await createTestApp({
    app: {
      backzettel: { hqDir: hq, now: () => NOW },
      hq: { today: DAY, reportsDir: path.join(hq, 'reports') },
      voice: { env, fetch: provider, now: () => NOW, warn },
    },
  })
  tokens.verkauf = await sessionFor(api.app, 'sprache.verkauf', 'verkauf')
  tokens.inhaber = await sessionFor(api.app, 'sprache.inhaber', 'inhaber')
  tokens.backstube = await sessionFor(api.app, 'sprache.backstube', 'backstube')
})

beforeEach(async () => {
  for (const key of Object.keys(env)) delete env[key]
  Object.assign(env, {
    VOICE_ENABLED: '1',
    MISTRAL_API_KEY: 'test-stt',
    ANTHROPIC_API_KEY: 'test-llm',
  })
  fs.rmSync(path.join(hq, 'config', 'sprache.yaml'), { force: true })
  await api.sequelize.query('DELETE FROM voice_usage')
  provider
    .mockReset()
    .mockImplementation(async () => response({ text: 'Weck zwei' }))
  warn.mockClear()
})

afterAll(async () => {
  await (api.app.locals['backzettelIdle'] as () => Promise<void>)()
  await api.close()
  fs.rmSync(hq, { recursive: true, force: true })
})

it('ist ohne Schlüssel des gewählten Anbieters und ohne Freigabe aus', async () => {
  delete env.MISTRAL_API_KEY
  env.OPENAI_API_KEY = 'test-alternativ'
  expect((await getStatus()).body.data).toMatchObject({
    enabled: false,
    screens: [],
  })
  expect((await post().expect(503)).body.error).toBe('voice_disabled')
  env.MISTRAL_API_KEY = 'test-stt'
  delete env.VOICE_ENABLED
  expect((await getStatus()).body.data.enabled).toBe(false)
  expect(provider).not.toHaveBeenCalled()
  expect(await usage()).toEqual([])
})

it('erlaubt Verkauf und Inhaber, sperrt Backstube, HTTP und gesperrte Tage', async () => {
  await getStatus('backstube').expect(403)
  await post('backstube').expect(403)
  expect(
    (await post().set('X-Forwarded-Proto', 'http').expect(403)).body.error
  ).toBe('voice_https_required')
  expect((await post('verkauf', '2026-12-09').expect(409)).body.error).toBe(
    'voice_day_locked'
  )
  expect(provider).not.toHaveBeenCalled()
  expect((await getStatus('verkauf')).body.data).toMatchObject({
    enabled: true,
    screens: ['rest'],
  })
  await post('verkauf').expect(200)
  await post('inhaber').expect(200)
})

it('löst Aliase ohne Haiku und speichert nur abrechenbare Metadaten', async () => {
  fs.writeFileSync(
    path.join(hq, 'config', 'sprache.yaml'),
    'test-weck:\n  - Testsemmel\n'
  )
  provider.mockResolvedValueOnce(
    response({
      text: 'Testsemmel zwei',
      model: 'voxtral-mini-2602',
      usage: {
        prompt_audio_seconds: 1,
        prompt_tokens: 19,
        completion_tokens: 4,
        total_tokens: 23,
      },
    })
  )
  const result = await post().expect(200)
  expect(result.headers['cache-control']).toBe('no-store')
  expect(result.body.data).toMatchObject({
    transcript: 'Testsemmel zwei',
    unmatched: [],
    proposal: [{ key: KEY, menge: 2, unsicher: false }],
    usage: { llmUsed: false, input: 19, output: 4 },
  })
  expect(provider).toHaveBeenCalledTimes(1)
  const [url, opts] = provider.mock.calls[0]
  expect(url).toBe('https://api.eu.mistral.ai/v1/audio/transcriptions')
  expect((opts.body as FormData).get('model')).toBe('voxtral-mini-2602')
  expect((opts.body as FormData).getAll('context_bias')).toContain('Testsemmel')
  const [row] = await usage()
  expect(row).toMatchObject({
    started_ms: NOW.getTime(),
    user_id: expect.any(Number),
    month: '2026-12',
    screen: 'rest',
    duration_ms: 1000,
    stt_provider: 'mistral',
    llm_used: 0,
    cost_micro_eur: 50,
    input_tokens: 19,
    output_tokens: 4,
    outcome: 'ok',
  })
  expect(
    Object.keys(row).some((key) => /transcript|text|audio/.test(key))
  ).toBe(false)
  expect(JSON.stringify(row)).not.toContain('Testsemmel')
  expect(await RestCount.count()).toBe(0)
})

it('steuert das alternative STT per Env und zeigt Parser-Lücken ohne Claude', async () => {
  Object.assign(env, {
    VOICE_STT_PROVIDER: 'openai',
    VOICE_STT_MODEL: 'test-modell',
    OPENAI_API_KEY: 'test-alternativ',
  })
  delete env.ANTHROPIC_API_KEY
  provider.mockResolvedValueOnce(response({ text: 'Weck zwei, Krustis drei' }))
  const result = await post().expect(200)
  expect(result.body.data.unmatched).toEqual([
    { heard: 'Krustis drei', candidates: [] },
  ])
  const [url, opts] = provider.mock.calls[0]
  expect(url).toBe('https://api.openai.com/v1/audio/transcriptions')
  expect((opts.body as FormData).get('model')).toBe('test-modell')
  expect((opts.body as FormData).get('prompt')).toEqual(
    expect.stringContaining('Weck')
  )
  expect(provider).toHaveBeenCalledTimes(1)
})

it('aktiviert die lokale Spracherkennung ohne Schlüssel und sendet WAV und Produktnamen', async () => {
  useLocal({ VOICE_STT_URL: 'https://sprache.test/erkennen' })
  const oversized = `Testkruste ${'Ä🧪'.repeat(70)}`
  const aliases = [
    oversized,
    ...Array.from(
      { length: 12 },
      (_, i) => `Synthetisches Würzbrötchen ÄÖß 🥨🧪 №${i}`
    ),
  ]
  fs.writeFileSync(
    path.join(hq, 'config', 'sprache.yaml'),
    JSON.stringify({ 'test-weck': aliases })
  )
  expect((await getStatus().expect(200)).body.data).toMatchObject({
    enabled: true,
    sttProvider: 'local',
    screens: ['rest'],
  })
  const clip = audio(8.25)
  const data = (await post('verkauf', DAY, clip).expect(200)).body.data
  expect(data).toMatchObject({
    proposal: [{ key: KEY, menge: 2, unsicher: false }],
    usage: { costEuro: 0, llmUsed: false },
  })
  const [[url, opts]] = provider.mock.calls
  expect(url).toBe('https://sprache.test/erkennen')
  expect(new Headers(opts.headers).has('authorization')).toBe(false)
  const form = opts.body as FormData
  expect(form.get('response_format')).toBe('json')
  expect(form.get('language')).toBe('de')
  expect(form.get('temperature')).toBe('0')
  expect(form.get('audio_ctx')).toBe('477')
  expect(form.has('model')).toBe(false)
  expect(form.has('temperature_inc')).toBe(false)
  const prompt = String(form.get('prompt'))
  expect(prompt).toMatch(/^Produktnamen: /)
  expect(Buffer.byteLength(prompt, 'utf8')).toBeLessThanOrEqual(400)
  const names = prompt.slice('Produktnamen: '.length).split(', ')
  expect(names).toContain('Test test-weck')
  expect(names).toContain('Weck')
  expect(names).toContain(aliases[1])
  expect(names.indexOf('Test test-weck')).toBeLessThan(names.indexOf('Weck'))
  expect(names.indexOf('Weck')).toBeLessThan(names.indexOf(aliases[1]))
  const includedAliases = names.slice(names.indexOf(aliases[1]))
  expect(includedAliases).toEqual(aliases.slice(1, 1 + includedAliases.length))
  expect(includedAliases).not.toContain(aliases.at(-1))
  const file = form.get('file') as File
  expect(file.name).toBe('aufnahme.wav')
  expect(file.type).toBe('audio/wav')
  expect(Buffer.from(await file.arrayBuffer()).equals(clip)).toBe(true)
})

it.each([
  [undefined, 1, '256'],
  ['0', 8, '0'],
  ['500', 8, '500'],
  ['500', 12, '664'],
  ['500', 30, '1500'],
  ['auto', 29.9, '1500'],
])(
  'nutzt den Standard-Endpunkt und berücksichtigt audio_ctx=%s für %s s',
  async (ctx, seconds, frames) => {
    useLocal({ VOICE_STT_MODEL: 'test-modell', OPENAI_API_KEY: 'test-cloud' })
    if (ctx !== undefined) env.VOICE_STT_AUDIO_CTX = ctx
    await post('verkauf', DAY, audio(seconds)).expect(200)
    const [[url, opts]] = provider.mock.calls
    expect(url).toBe('http://127.0.0.1:8178/inference')
    expect(new Headers(opts.headers).has('authorization')).toBe(false)
    const form = opts.body as FormData
    expect(form.get('audio_ctx')).toBe(frames)
    expect(form.has('model')).toBe(false)
  }
)

it.each(['ftp://sprache.test/inference', 'keine-url', ''])(
  'schaltet local bei ungültiger URL aus (%s)',
  async (url) => {
    useLocal({ VOICE_STT_URL: url })
    expect((await getStatus().expect(200)).body.data).toMatchObject({
      enabled: false,
      screens: [],
    })
    expect((await post().expect(503)).body.error).toBe('voice_disabled')
    expect(provider).not.toHaveBeenCalled()
  }
)

it('transkribiert lokal kostenlos über dem Monatsbudget und begrenzt Aufnahmen je Person', async () => {
  await post('inhaber').expect(200)
  useLocal({
    VOICE_MONTHLY_BUDGET_EUR: '0',
    VOICE_STT_USD_PER_MINUTE: '100',
    VOICE_STT_USD_PER_M_INPUT: '100',
    VOICE_STT_USD_PER_M_OUTPUT: '100',
    VOICE_RATE_PER_MINUTE: '1',
    ANTHROPIC_API_KEY: 'test-llm',
  })
  expect((await getStatus().expect(200)).body.data.budget).toMatchObject({
    remainingEuro: 0,
    spentEuro: 0.00005,
  })
  provider.mockResolvedValueOnce(
    response({
      text: 'Weck zwei, Krustis drei',
      usage: { type: 'tokens', input_tokens: 19, output_tokens: 11 },
    })
  )
  const data = (await post().expect(200)).body.data
  expect(data).toMatchObject({
    proposal: [{ key: KEY, menge: 2, unsicher: false }],
    hint: expect.any(String),
    usage: { costEuro: 0, llmUsed: false, input: 0, output: 0 },
  })
  expect((await post().expect(429)).body.error).toBe('voice_rate_limit')
  expect(provider).toHaveBeenCalledTimes(2)
  expect((await usage())[1]).toMatchObject({
    stt_provider: 'local',
    cost_micro_eur: 0,
    llm_used: 0,
    outcome: 'llm_budget_exhausted',
  })
})

it.each([
  new Response('Synthetischer Anbieterfehler', { status: 500 }),
  new Response('Keine JSON-Antwort'),
  response({ error: 'Synthetischer Anbieterfehler', text: 42 }),
])('meldet ungültige lokale Antworten als voice_unavailable', async (reply) => {
  useLocal()
  provider.mockResolvedValueOnce(reply)
  expect((await post().expect(503)).body).toMatchObject(localUnavailable)
  expect(warn).not.toHaveBeenCalled()
  expect(await usage()).toEqual([
    expect.objectContaining({
      outcome: 'voice_unavailable',
      cost_micro_eur: 0,
    }),
  ])
})

it('meldet ein leeres lokales Transkript als nicht verstanden', async () => {
  useLocal()
  provider.mockResolvedValueOnce(response({ text: ' \n ' }))
  expect((await post().expect(422)).body.error).toBe('voice_not_understood')
})

it.each([
  ['mistral', undefined, 12_000],
  ['local', undefined, 25_000],
  ['local', '32000', 32_000],
  ['local', '90000', 60_000],
] as const)(
  'setzt den STT-Timeout für %s mit VOICE_STT_TIMEOUT_MS=%s',
  async (stt, configured, expected) => {
    if (stt === 'local') useLocal()
    if (configured !== undefined) env.VOICE_STT_TIMEOUT_MS = configured
    const timeout = jest.spyOn(AbortSignal, 'timeout')
    try {
      await post().expect(200)
      expect(timeout).toHaveBeenCalledWith(expected)
    } finally {
      timeout.mockRestore()
    }
  }
)

it('bricht die lokale Anfrage nach dem konfigurierten Mindest-Timeout ab', async () => {
  useLocal({ VOICE_STT_TIMEOUT_MS: '25' })
  const timeout = jest.spyOn(AbortSignal, 'timeout')
  provider.mockImplementationOnce(
    (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init.signal
        signal.addEventListener('abort', () => reject(signal.reason), {
          once: true,
        })
      })
  )
  try {
    expect((await post().expect(503)).body).toMatchObject(localUnavailable)
    expect(timeout).toHaveBeenCalledWith(1000)
  } finally {
    timeout.mockRestore()
  }
})

it('sendet Multipart über Loopback und meldet den geschlossenen Port als Ausfall', async () => {
  const clip = audio()
  let upload: Response
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk)
    upload = new Response(Buffer.concat(chunks), {
      headers: { 'content-type': req.headers['content-type'] },
    })
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ text: 'Weck zwei' }))
  })
  await once(server.listen(0, '127.0.0.1'), 'listening')
  try {
    const { port } = server.address() as AddressInfo
    useLocal({ VOICE_STT_URL: `http://127.0.0.1:${port}/inference` })
    provider.mockImplementation(fetch)
    await post('verkauf', DAY, clip).expect(200)
    const form = await upload.formData()
    expect(form.get('audio_ctx')).toBe('256')
    const file = form.get('file') as File
    expect(Buffer.from(await file.arrayBuffer()).equals(clip)).toBe(true)
  } finally {
    const closed = once(server, 'close')
    server.close()
    server.closeAllConnections()
    await closed
  }
  expect((await post().expect(503)).body).toMatchObject(localUnavailable)
})

it.each(['mistral', 'local'])(
  'schickt einen freien Satz nach %s an Haiku und prüft die Werkzeugausgabe',
  async (stt) => {
    if (stt === 'local') useLocal({ ANTHROPIC_API_KEY: 'test-llm' })
    const text = 'Vom Weck liegen noch zwei in der Auslage'
    provider.mockResolvedValueOnce(response({ text }))
    provider.mockResolvedValueOnce(
      response({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            name: 'rest_set_counts',
            input: {
              zeilen: [
                {
                  key: KEY,
                  menge: 2,
                  unsicher: false,
                  einheit: null,
                  gehoert: text,
                },
                {
                  key: 'fremd',
                  menge: 17,
                  unsicher: false,
                  einheit: null,
                  gehoert: text,
                },
              ],
              nicht_zugeordnet: [],
            },
          },
        ],
        usage: {
          input_tokens: 200,
          output_tokens: 120,
          cache_read_input_tokens: 1000,
        },
      })
    )
    const result = await post().expect(200)
    expect(result.body.data).toMatchObject({
      proposal: [
        { key: KEY, menge: 2, unsicher: false },
        {
          key: 'fremd',
          menge: null,
          unsicher: true,
          reason: 'Diese Zählzeile ist nicht bekannt.',
        },
      ],
      unmatched: [],
      usage: { llmUsed: true },
    })
    const [url, opts] = provider.mock.calls[1]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    const body = JSON.parse(String(opts.body))
    expect(body).toMatchObject({
      model: 'claude-haiku-5-5',
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      tools: [{ name: 'rest_set_counts', strict: true }],
      system: [{ cache_control: { type: 'ephemeral' } }],
    })
    expect(
      body.tools[0].input_schema.properties.zeilen.items.properties.key.enum
    ).toContain(KEY)
    expect(body.system[0].text).not.toContain(text)
    expect(body.messages[0].content).toContain(text)
    expect(await usage()).toEqual([
      expect.objectContaining({
        llm_used: 1,
        input_tokens: 200,
        output_tokens: 120,
        cache_read_tokens: 1000,
        stt_provider: stt,
        cost_micro_eur: stt === 'local' ? 90 : 140,
        outcome: 'review',
      }),
    ])
  }
)

it.each(['end_turn', 'refusal'])(
  'meldet „Nicht verstanden“ bei %s',
  async (stop_reason) => {
    provider.mockResolvedValueOnce(
      response({ text: 'Vom Weck liegen noch zwei bereit' })
    )
    provider.mockResolvedValueOnce(
      response({ stop_reason, content: [{ type: 'text', text: 'Test' }] })
    )
    const res = await post().expect(422)
    expect(res.body).toMatchObject({
      error: 'voice_not_understood',
      message: 'Nicht verstanden – bitte nochmal oder tippen.',
    })
    expect(await usage()).toEqual([
      expect.objectContaining({ llm_used: 1, outcome: 'llm_failed' }),
    ])
  }
)

it('lässt bei zwei parallelen Aufnahmen nur eine STT-Reservierung zu', async () => {
  env.VOICE_MONTHLY_BUDGET_EUR = '0.00015'
  let started: () => void
  let finish: (response: Response) => void
  const ready = new Promise<void>((resolve) => {
    started = resolve
  })
  const reply = new Promise<Response>((resolve) => {
    finish = resolve
  })
  provider.mockImplementationOnce(() => {
    started()
    return reply
  })

  const first = post()
    .expect(200)
    .then((result) => result)
  await Promise.race([ready, first])
  try {
    expect((await post('inhaber').expect(429)).body.error).toBe(
      'voice_budget_exhausted'
    )
    expect(provider).toHaveBeenCalledTimes(1)
    expect(await usage()).toEqual([
      expect.objectContaining({
        outcome: 'pending',
        cost_micro_eur: 150,
      }),
    ])
  } finally {
    finish(response({ text: 'Weck zwei', usage: { prompt_audio_seconds: 3 } }))
    await first
  }
  expect(warn).toHaveBeenCalledTimes(1)
  expect((await getStatus()).body.data.budget).toMatchObject({
    remainingEuro: 0,
    spentEuro: 0.00015,
  })
})

it('gibt nicht benötigte STT-Reserve nach der Antwort für weitere Aufnahmen frei', async () => {
  env.VOICE_MONTHLY_BUDGET_EUR = '0.0002'
  await post().expect(200)
  expect((await getStatus()).body.data.budget).toMatchObject({
    remainingEuro: 0.00015,
    spentEuro: 0.00005,
  })
  await post('inhaber').expect(200)
  expect(provider).toHaveBeenCalledTimes(2)
  expect((await getStatus()).body.data.budget.spentEuro).toBe(0.0001)
})

it.each([
  ['mistral', 'VOICE_RATE_PER_MINUTE'],
  ['mistral', 'VOICE_RATE_PER_DAY'],
  ['local', 'VOICE_RATE_PER_MINUTE'],
  ['local', 'VOICE_RATE_PER_DAY'],
])('beschränkt %s mit %s pro Benutzer', async (stt, setting) => {
  if (stt === 'local') useLocal()
  env[setting] = '1'
  await post().expect(200)
  expect((await post().expect(429)).body.error).toBe('voice_rate_limit')
  await post('inhaber').expect(200)
  expect(provider).toHaveBeenCalledTimes(2)
})

it('prüft Byte- und Zeitgrenze vor Fremdaufrufen', async () => {
  await post('verkauf', DAY, Buffer.alloc(1024 * 1024 + 1)).expect(413)
  expect((await post('verkauf', DAY, audio(31)).expect(413)).body.error).toBe(
    'voice_audio_duration'
  )
  await post('verkauf', DAY, Buffer.alloc(100)).expect(415)
  expect(provider).not.toHaveBeenCalled()
})

it('schreibt die Herkunft erst über den normalen PUT ins Audit', async () => {
  const result = await post().expect(200)
  expect(await RestCount.count()).toBe(0)
  const items = [
    {
      itemId: 'weck',
      productId: 'test-weck',
      qty: result.body.data.proposal[0].menge,
      expected: null,
    },
  ]
  await request(api.app)
    .put(`/api/rest/${DAY}`)
    .set(bearer(tokens.verkauf))
    .send({ source: 'sprache', items })
    .expect(200)
  expect(
    (await AuditLog.findOne({ where: { action: 'rest_count' } })).data
  ).toMatchObject({
    source: 'sprache',
    changes: [expect.objectContaining({ to: 2 })],
  })
})

const partialHint =
  'Freie Sätze konnten nicht ausgewertet werden – bitte prüfen oder tippen.'

it.each([
  ['Anbieterfehler', async () => new Response(null, { status: 503 })],
  [
    'Timeout',
    async () => {
      throw new DOMException('Test', 'TimeoutError')
    },
  ],
  [
    'Refusal',
    async () =>
      response({
        stop_reason: 'refusal',
        usage: { input_tokens: 4, output_tokens: 2 },
      }),
  ],
  [
    'fehlendem Werkzeug',
    async () => response({ stop_reason: 'end_turn', content: [] }),
  ],
  [
    'ungültigem Werkzeug',
    async () =>
      response({
        stop_reason: 'tool_use',
        content: [
          {
            type: 'tool_use',
            name: 'rest_set_counts',
            input: {
              zeilen: [{ key: KEY, menge: 'zwei', gehoert: 'Krustis drei' }],
              nicht_zugeordnet: [],
            },
          },
        ],
      }),
  ],
] as const)(
  'bewahrt Parser-Treffer bei %s samt Claude-Reservierung',
  async (_case, reply) => {
    provider.mockResolvedValueOnce(
      response({ text: 'Weck zwei, Krustis drei' })
    )
    provider.mockImplementationOnce(reply)
    const data = (await post().expect(200)).body.data
    expect(data).toMatchObject({
      proposal: [{ key: KEY, menge: 2, unsicher: false }],
      unmatched: [{ heard: 'Krustis drei' }],
      hint: partialHint,
      usage: { llmUsed: true },
    })
    const [row] = await usage()
    expect(row).toMatchObject({ llm_used: 1, outcome: 'llm_failed' })
    expect(row.cost_micro_eur).toBeGreaterThan(1_000)
    expect(data.usage.costEuro).toBe(Number(row.cost_micro_eur) / 1_000_000)
  }
)

it.each([
  ['Weck zwei, Krustis drei', 200],
  ['Vom Weck liegen noch zwei bereit', 422],
] as const)(
  'sperrt Claude bei zu kleinem Budget und meldet den passenden Parser-Ausgang (%s)',
  async (text, status) => {
    env.VOICE_MONTHLY_BUDGET_EUR = '0.00015'
    provider.mockResolvedValueOnce(response({ text }))
    const res = await post().expect(status)
    if (status === 200) {
      expect(res.body.data).toMatchObject({
        proposal: [{ key: KEY, menge: 2, unsicher: false }],
        unmatched: [{ heard: 'Krustis drei' }],
        hint: partialHint,
        usage: { llmUsed: false, costEuro: 0.00005 },
      })
    } else {
      expect(res.body).toMatchObject({
        error: 'voice_not_understood',
        message: 'Nicht verstanden – bitte nochmal oder tippen.',
      })
    }
    expect(provider).toHaveBeenCalledTimes(1)
    expect(await usage()).toEqual([
      expect.objectContaining({
        llm_used: 0,
        outcome: 'llm_budget_exhausted',
        cost_micro_eur: 50,
      }),
    ])
  }
)

it('weist eine Aufnahme mit 150 Mikro-Euro Reserve bei 100 Mikro-Euro Budget vor STT ab', async () => {
  env.VOICE_MONTHLY_BUDGET_EUR = '0.0001'
  provider.mockResolvedValueOnce(
    response({
      text: 'Weck zwei, Krustis drei',
      usage: { prompt_audio_seconds: 3 },
    })
  )
  expect((await post().expect(429)).body.error).toBe('voice_budget_exhausted')
  expect(provider).not.toHaveBeenCalled()
  expect(await usage()).toEqual([])
})

it('prüft bei einem Tokentarif vorab auch das maximale Ausgabevolumen', async () => {
  Object.assign(env, {
    VOICE_STT_PROVIDER: 'openai',
    OPENAI_API_KEY: 'test-alternativ',
    VOICE_STT_MODEL: 'gpt-4o-mini-transcribe',
    VOICE_MONTHLY_BUDGET_EUR: '0.010',
  })
  expect((await post().expect(429)).body.error).toBe('voice_budget_exhausted')
  expect(provider).not.toHaveBeenCalled()
})

it.each([
  [{ type: 'duration', seconds: 3 }, 300, 0, 0],
  [{ type: 'duration', seconds: 0.2 }, 100, 0, 0],
  [{ type: 'tokens', input_tokens: 19, output_tokens: 11 }, 100, 19, 11],
] as const)(
  'rechnet OpenAI-Verbrauch konservativ ab (%o)',
  async (reported, cost, input, output) => {
    Object.assign(env, {
      VOICE_STT_PROVIDER: 'openai',
      OPENAI_API_KEY: 'test-alternativ',
    })
    provider.mockResolvedValueOnce(
      response({ text: 'Weck zwei', usage: reported })
    )
    const data = (await post().expect(200)).body.data
    const body = provider.mock.calls[0][1].body as FormData
    expect(body.get('model')).toBe('gpt-transcribe')
    expect(body.get('languages[]')).toBe('de')
    expect(body.has('language')).toBe(false)
    expect(data.usage).toMatchObject({
      costEuro: cost / 1_000_000,
      input,
      output,
    })
    expect(await usage()).toEqual([
      expect.objectContaining({
        stt_provider: 'openai',
        cost_micro_eur: cost,
        input_tokens: input,
        output_tokens: output,
      }),
    ])
  }
)

it('wendet den konfigurierten STT-Tarif auf die höhere gemeldete Dauer an', async () => {
  env.VOICE_STT_USD_PER_MINUTE = '0.012'
  provider.mockResolvedValueOnce(
    response({ text: 'Weck zwei', usage: { prompt_audio_seconds: 2 } })
  )
  expect((await post().expect(200)).body.data.usage.costEuro).toBe(0.0004)
})

it.each([
  ['gpt-4o-mini-transcribe', {}, 19, 11, 100],
  ['gpt-4o-mini-transcribe', {}, 80, 20, 200],
  [
    'gpt-4o-transcribe',
    { VOICE_STT_USD_PER_M_INPUT: '3', VOICE_STT_USD_PER_M_OUTPUT: '7' },
    80,
    20,
    380,
  ],
] as const)(
  'setzt bei OpenAI den höheren Betrag aus Dauer und belegten Tokenpreisen an (%s)',
  async (model, tariff, input, output, cost) => {
    Object.assign(env, {
      VOICE_STT_PROVIDER: 'openai',
      OPENAI_API_KEY: 'test-alternativ',
      VOICE_STT_MODEL: model,
      ...tariff,
    })
    provider.mockResolvedValueOnce(
      response({
        text: 'Weck zwei',
        usage: { type: 'tokens', input_tokens: input, output_tokens: output },
      })
    )
    expect((await post().expect(200)).body.data.usage.costEuro).toBe(
      cost / 1_000_000
    )
  }
)

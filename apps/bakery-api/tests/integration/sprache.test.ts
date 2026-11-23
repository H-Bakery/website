import * as fs from 'node:fs'
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
  provider.mockResolvedValueOnce(response({ text: 'Testsemmel zwei' }))
  const result = await post().expect(200)
  expect(result.headers['cache-control']).toBe('no-store')
  expect(result.body.data).toMatchObject({
    transcript: 'Testsemmel zwei',
    unmatched: [],
    proposal: [{ key: KEY, menge: 2, unsicher: false }],
    usage: { llmUsed: false },
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

it('schickt einen freien Satz an Haiku und prüft die Werkzeugausgabe', async () => {
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
      cost_micro_eur: 140,
      outcome: 'review',
    }),
  ])
})

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

it('blockiert parallele Anfragen über dem Monatsbudget und warnt einmal', async () => {
  env.VOICE_MONTHLY_BUDGET_EUR = '0.0001'
  const results = await Promise.all([post(), post('inhaber'), post()])
  expect(results.map(({ status }) => status).sort()).toEqual([200, 200, 429])
  expect(results.find(({ status }) => status === 429).body).toMatchObject({
    error: 'voice_budget_exhausted',
  })
  expect(provider).toHaveBeenCalledTimes(2)
  expect(warn).toHaveBeenCalledTimes(1)
  expect((await getStatus()).body.data.budget).toMatchObject({
    remainingEuro: 0,
    spentEuro: 0.0001,
  })
})

it.each(['VOICE_RATE_PER_MINUTE', 'VOICE_RATE_PER_DAY'])(
  'beschränkt %s pro Benutzer',
  async (setting) => {
    env[setting] = '1'
    await post().expect(200)
    expect((await post().expect(429)).body.error).toBe('voice_rate_limit')
    await post('inhaber').expect(200)
    expect(provider).toHaveBeenCalledTimes(2)
  }
)

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
    env.VOICE_MONTHLY_BUDGET_EUR = '0.00005'
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

it('rechnet gemeldete Mistral-Dauer vor der Claude-Reservierung an und sperrt weitere Aufnahmen', async () => {
  env.VOICE_MONTHLY_BUDGET_EUR = '0.0001'
  provider.mockResolvedValueOnce(
    response({
      text: 'Weck zwei, Krustis drei',
      usage: { prompt_audio_seconds: 3 },
    })
  )
  const data = (await post().expect(200)).body.data
  expect(data).toMatchObject({
    hint: partialHint,
    proposal: [{ key: KEY, menge: 2 }],
    usage: { llmUsed: false, costEuro: 0.00015 },
  })
  expect((await getStatus()).body.data.budget).toMatchObject({
    spentEuro: 0.00015,
    remainingEuro: 0,
  })
  expect((await post().expect(429)).body.error).toBe('voice_budget_exhausted')
  expect(provider).toHaveBeenCalledTimes(1)
  expect(warn).toHaveBeenCalledTimes(1)
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

import { act, renderHook } from '@testing-library/react'
import { useRecorder } from './useRecorder'

const initialMedia = Object.getOwnPropertyDescriptor(navigator, 'mediaDevices')
const initialContext = Object.getOwnPropertyDescriptor(window, 'AudioContext')
const initialWorklet = Object.getOwnPropertyDescriptor(
  window,
  'AudioWorkletNode'
)

function restore(target: object, key: string, descriptor?: PropertyDescriptor) {
  if (descriptor) Object.defineProperty(target, key, descriptor)
  else Reflect.deleteProperty(target, key)
}

function setupAudio() {
  const track = { stop: jest.fn() }
  const stream = { getTracks: () => [track] }
  const getUserMedia = jest.fn(async () => stream)
  const context = {
    sampleRate: 44100,
    resume: jest.fn(async () => undefined),
    close: jest.fn(async () => undefined),
    destination: {},
    createMediaStreamSource: jest.fn(() => ({ connect: jest.fn() })),
    audioWorklet: { addModule: jest.fn(async () => undefined) },
  }
  const node = {
    port: {
      close: jest.fn(),
      onmessage: null as ((event: { data: Float32Array }) => void) | null,
    },
    connect: jest.fn(),
    disconnect: jest.fn(),
  }
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  })
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    value: jest.fn(() => context),
  })
  Object.defineProperty(window, 'AudioWorkletNode', {
    configurable: true,
    value: jest.fn(() => node),
  })
  const feed = (amplitude: number) =>
    node.port.onmessage?.({ data: new Float32Array(256).fill(amplitude) })
  return { context, track, node, getUserMedia, stream, feed }
}

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.useRealTimers()
  restore(navigator, 'mediaDevices', initialMedia)
  restore(window, 'AudioContext', initialContext)
  restore(window, 'AudioWorkletNode', initialWorklet)
})

it('stoppt nach 1,5 Sekunden Stille, gibt WAV zurück und schließt das Mikrofon', async () => {
  const { context, track, node, getUserMedia, feed } = setupAudio()
  const receive = jest.fn()
  const { result } = renderHook(useRecorder)
  await act(() => result.current.start(receive))
  expect(result.current.phase).toBe('recording')
  expect(context.audioWorklet.addModule).toHaveBeenCalledWith('/sprache-pcm.js')
  expect(getUserMedia).toHaveBeenCalledWith({
    audio: {
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true,
    },
  })
  act(() => {
    feed(0.3)
    jest.advanceTimersByTime(1499)
    feed(0)
  })
  expect(receive).not.toHaveBeenCalled()
  act(() => {
    jest.advanceTimersByTime(1)
  })
  expect(receive).toHaveBeenCalledTimes(1)
  const clip: Blob = receive.mock.calls[0][0]
  expect(clip.type).toBe('audio/wav')
  expect(clip.size).toBe(44 + 2 * 512)
  expect(node.port.close).toHaveBeenCalledTimes(1)
  expect(track.stop).toHaveBeenCalledTimes(1)
  expect(context.close).toHaveBeenCalledTimes(1)
  expect(result.current.phase).toBe('idle')
})

it('meldet fehlenden Pegel und beendet eine stille Aufnahme spätestens nach 30 Sekunden', async () => {
  const { track, feed } = setupAudio()
  const receive = jest.fn()
  const { result } = renderHook(useRecorder)
  await act(() => result.current.start(receive))
  act(() => {
    feed(0)
    jest.advanceTimersByTime(3000)
  })
  expect(result.current.noSound).toBe(true)
  act(() => {
    jest.advanceTimersByTime(27000)
  })
  expect(result.current.phase).toBe('idle')
  expect(result.current.error).toContain('Ich höre nichts')
  expect(receive).not.toHaveBeenCalled()
  expect(track.stop).toHaveBeenCalledTimes(1)
})

it('gibt ein spät freigegebenes Mikrofon nach Abbrechen sofort wieder frei', async () => {
  const { context, getUserMedia, stream, track } = setupAudio()
  let grant: (value: typeof stream) => void = () => undefined
  getUserMedia.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        grant = resolve
      })
  )
  const receive = jest.fn()
  const { result } = renderHook(useRecorder)
  let start: Promise<void> | undefined
  act(() => {
    start = result.current.start(receive)
  })
  expect(result.current.phase).toBe('requesting')
  act(() => result.current.cancel())
  await act(async () => {
    grant(stream)
    await start
  })
  expect(context.audioWorklet.addModule).not.toHaveBeenCalled()
  expect(track.stop).toHaveBeenCalledTimes(1)
  expect(receive).not.toHaveBeenCalled()
})

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const SAMPLE_RATE = 16000
const MAX_SECONDS = 30
const MAX_SAMPLES = SAMPLE_RATE * MAX_SECONDS

function wav(samples: Int16Array, length: number) {
  const bytes = new ArrayBuffer(44 + length * 2)
  const view = new DataView(bytes)
  const text = (offset: number, value: string) => {
    Array.from(value).forEach((letter, i) =>
      view.setUint8(offset + i, letter.charCodeAt(0))
    )
  }
  text(0, 'RIFF')
  view.setUint32(4, bytes.byteLength - 8, true)
  text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, length * 2, true)
  for (let i = 0; i < length; i++) view.setInt16(44 + i * 2, samples[i], true)
  return new Blob([bytes], { type: 'audio/wav' })
}

interface Capture {
  context: AudioContext
  stream?: MediaStream
  node?: AudioWorkletNode
  timer?: ReturnType<typeof setInterval>
  stop?: () => void
}

function release(capture: Capture) {
  clearInterval(capture.timer)
  if (capture.node) {
    capture.node.port.onmessage = null
    capture.node.port.close()
    capture.node.disconnect()
  }
  capture.stream?.getTracks().forEach((track) => track.stop())
  void capture.context.close().catch(() => undefined)
}

export function useRecorder() {
  const active = useRef<Capture | null>(null)
  const [phase, setPhase] = useState<'idle' | 'requesting' | 'recording'>(
    'idle'
  )
  const [meter, setMeter] = useState({ seconds: 0, level: 0, noSound: false })
  const [error, setError] = useState<string | null>(null)

  useEffect(
    () => () => {
      if (!active.current) return
      release(active.current)
      active.current = null
    },
    []
  )

  const cancel = useCallback(() => {
    if (active.current) release(active.current)
    active.current = null
    setPhase('idle')
  }, [])

  async function start(onClip: (clip: Blob) => void) {
    if (active.current) return
    setError(null)
    setMeter({ seconds: 0, level: 0, noSound: false })
    let capture: Capture | undefined
    try {
      const context = new AudioContext()
      capture = { context }
      const current = capture
      active.current = current
      setPhase('requesting')
      // resume() muss aus dem Tipp heraus gestartet werden (auch in iOS).
      const resumed = context.resume().then(
        () => true,
        () => false
      )
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true,
        },
      })
      if (active.current !== current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      current.stream = stream
      if (!(await resumed) || context.sampleRate < SAMPLE_RATE)
        throw new Error()
      await context.audioWorklet.addModule('/sprache-pcm.js')
      if (active.current !== current) return
      const node = new AudioWorkletNode(context, 'sprache-pcm', {
        channelCount: 1,
        channelCountMode: 'explicit',
      })
      current.node = node
      context.createMediaStreamSource(stream).connect(node)
      // Der Worklet liefert stumme Ausgänge. Die Verbindung hält den Audiographen aktiv.
      node.connect(context.destination)
      const samples = new Int16Array(MAX_SAMPLES)
      const started = performance.now()
      let length = 0
      let lastVoice: number | null = null
      let level = 0
      current.stop = () => {
        if (active.current !== current) return
        cancel()
        if (lastVoice === null || !length) {
          setError('Ich höre nichts – Mikrofon erlaubt?')
        } else {
          onClip(wav(samples, length))
        }
      }
      node.port.onmessage = (event: MessageEvent<Float32Array>) => {
        const block = event.data
        let sum = 0
        for (let i = 0; i < block.length && length < MAX_SAMPLES; i++) {
          const sample = Math.max(-1, Math.min(1, block[i]))
          samples[length++] = sample * (sample < 0 ? 32768 : 32767)
          sum += sample * sample
        }
        level = Math.sqrt(sum / block.length)
        if (level >= 0.015) lastVoice = performance.now()
        if (length === MAX_SAMPLES) current.stop?.()
      }
      current.timer = setInterval(() => {
        const time = performance.now()
        if (
          time - started >= MAX_SECONDS * 1000 ||
          (lastVoice !== null && time - lastVoice >= 1500)
        ) {
          current.stop?.()
        } else {
          setMeter({
            seconds: Math.floor((time - started) / 1000),
            level,
            noSound: lastVoice === null && time - started >= 3000,
          })
        }
      }, 100)
      setPhase('recording')
    } catch {
      if (capture && active.current !== capture) return
      cancel()
      setError(
        'Das Mikrofon konnte nicht gestartet werden – bitte Zugriff erlauben oder tippen.'
      )
    }
  }

  return {
    phase,
    ...meter,
    error,
    start,
    stop: () => active.current?.stop?.(),
    cancel,
  }
}

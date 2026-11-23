/* global sampleRate:readonly */
class SprachePcm extends AudioWorkletProcessor {
  constructor() {
    super()
    this.samples = new Float32Array(256)
    this.offset = 0
    this.phase = 0
    this.sum = 0
    this.count = 0
  }

  process(inputs) {
    const mono = inputs[0]?.[0]
    if (!mono) return true
    for (const sample of mono) {
      // Im nativen Gerätesampletakt aufnehmen und vor dem Versand auf 16 kHz
      // herunterrechnen. So hängt der Mikrofoneingang nicht am WAV-Takt.
      this.phase += 16000
      this.sum += sample
      this.count++
      if (this.phase < sampleRate) continue
      this.phase -= sampleRate
      this.samples[this.offset++] = this.sum / this.count
      this.count = 0
      this.sum = 0
      if (this.offset === this.samples.length) {
        this.port.postMessage(this.samples)
        this.offset = 0
      }
    }
    return true
  }
}

registerProcessor('sprache-pcm', SprachePcm)

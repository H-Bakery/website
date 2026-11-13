/**
 * Liest den sichtbaren Text aus einem von pdfkit erzeugten PDF - ohne fremdes
 * Werkzeug. pdfkit schreibt Text als Glyphen-Nummern einer eingebetteten
 * Schrift-Teilmenge (`[<0012…> 0] TJ`); die Zuordnung zu Unicode steht in der
 * `ToUnicode`-CMap der Schrift. Reicht für die PDFs dieser API (Rechnung,
 * Entwurf, Bestellschein), ist kein allgemeiner PDF-Leser.
 */
import * as zlib from 'zlib'

interface PdfObject {
  dict: string
  stream: Buffer | null
}

function objects(pdf: Buffer): Map<number, PdfObject> {
  const raw = pdf.toString('latin1')
  const out = new Map<number, PdfObject>()
  const start = /(\d+) 0 obj\n/g
  for (let m = start.exec(raw); m; m = start.exec(raw)) {
    const from = m.index + m[0].length
    const streamAt = raw.indexOf('stream\n', from)
    const end = raw.indexOf('endobj', from)
    if (end < 0) break
    if (streamAt >= 0 && streamAt < end) {
      const dataEnd = raw.indexOf('\nendstream', streamAt)
      const data = pdf.subarray(streamAt + 7, dataEnd)
      let stream: Buffer
      try {
        stream = zlib.inflateSync(data)
      } catch {
        stream = Buffer.from(data)
      }
      out.set(Number(m[1]), { dict: raw.slice(from, streamAt), stream })
      start.lastIndex = dataEnd
    } else {
      out.set(Number(m[1]), { dict: raw.slice(from, end), stream: null })
    }
  }
  return out
}

/** Glyphe → Zeichen aus einer `ToUnicode`-CMap (pdfkit: nur `bfrange` mit Liste). */
function cmap(source: string): Map<number, string> {
  const map = new Map<number, string>()
  const range = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([^\]]*)\]/g
  for (let m = range.exec(source); m; m = range.exec(source)) {
    const first = parseInt(m[1], 16)
    const targets = [...m[3].matchAll(/<([0-9a-fA-F]+)>/g)].map((t) => t[1])
    targets.forEach((hex, index) => {
      let text = ''
      for (let i = 0; i + 4 <= hex.length; i += 4) {
        text += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16))
      }
      map.set(first + index, text)
    })
  }
  return map
}

export interface PdfText {
  /** Anzahl Seiten. */
  pages: number
  /** Der Text aller Seiten, ein Textstück je Zeile. */
  text: string
  /** Der Text je Inhalts-Stream (pdfkit: einer je Seite), in Dateireihenfolge. */
  streams: string[]
}

export function pdfText(pdf: Buffer): PdfText {
  const all = objects(pdf)
  const fonts = new Map<string, Map<number, string>>()
  for (const object of all.values()) {
    for (const ref of object.dict.matchAll(/\/(F\d+) (\d+) 0 R/g)) {
      if (fonts.has(ref[1])) continue
      const font = all.get(Number(ref[2]))
      const unicode = font && /\/ToUnicode (\d+) 0 R/.exec(font.dict)
      const stream = unicode && all.get(Number(unicode[1]))?.stream
      if (stream) fonts.set(ref[1], cmap(stream.toString('latin1')))
    }
  }

  const streams: string[] = []
  for (const object of all.values()) {
    const content = object.stream?.toString('latin1') ?? ''
    if (!/\/F\d+ [\d.]+ Tf/.test(content)) continue
    const pieces: string[] = []
    let font = new Map<number, string>()
    const token = /\/(F\d+) [\d.]+ Tf|\[([^\]]*)\] TJ|<([0-9a-fA-F]+)> Tj/g
    for (let m = token.exec(content); m; m = token.exec(content)) {
      if (m[1]) {
        font = fonts.get(m[1]) ?? new Map()
        continue
      }
      const hex =
        m[3] ??
        [...m[2].matchAll(/<([0-9a-fA-F]+)>/g)].map((h) => h[1]).join('')
      let piece = ''
      for (let i = 0; i + 4 <= hex.length; i += 4) {
        piece += font.get(parseInt(hex.slice(i, i + 4), 16)) ?? '�'
      }
      pieces.push(piece)
    }
    streams.push(pieces.join('\n'))
  }

  const raw = pdf.toString('latin1')
  return {
    pages: (raw.match(/\/Type \/Page\b/g) ?? []).length,
    text: streams.join('\n'),
    streams,
  }
}

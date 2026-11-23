import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { SaxesParser } from 'saxes'

import { decodeXml, StoredReceiptFile } from './receipt-files'
import type { ReceiptFields } from './receipt-types'

import { extractText, extractXml } from './receipt-extract.core'
const run = promisify(execFile)
const PDF_OPTIONS = {
  timeout: 8_000,
  maxBuffer: 512_000,
  killSignal: 'SIGKILL' as const,
}

export interface Extraction {
  fields: ReceiptFields
  field_flags: Record<string, string>
  confidence: number | null
  extracted_by:
    | 'xml'
    | 'textlayer'
    | 'manuell'
    | 'tesseract'
    | 'vlm_local'
    | 'mistral'
}

interface XmlNode {
  name: string
  uri: string
  attrs: Record<string, string>
  text: string
  children: XmlNode[]
}

export function parseReceiptXml(input: string): XmlNode {
  const parser = new SaxesParser({ xmlns: true })
  const stack: XmlNode[] = []
  let root: XmlNode
  let nodes = 0
  parser.on('doctype', () => {
    throw new Error('DOCTYPE ist in Beleg-XML unzulässig.')
  })
  parser.on('error', () => {
    throw new Error('Die Beleg-XML ist ungültig.')
  })
  parser.on('opentag', (tag) => {
    if (++nodes > 50_000 || stack.length >= 64)
      throw new Error('Die Beleg-XML ist zu komplex.')
    const attrs = Object.fromEntries(
      Object.values(tag.attributes).map((attr) => [attr.name, attr.value])
    )
    const node = {
      name: tag.local,
      uri: tag.uri,
      attrs,
      text: '',
      children: [],
    }
    const parent = stack.at(-1)
    if (parent) parent.children.push(node)
    else root = node
    stack.push(node)
  })
  const text = (value: string) => {
    const node = stack.at(-1)
    if (node) node.text += value
  }
  parser.on('text', text)
  parser.on('cdata', text)
  parser.on('closetag', () => {
    stack.pop()
  })
  parser.write(input).close()
  if (!root) throw new Error('Die Beleg-XML enthält kein Dokument.')
  return root
}

interface Reading {
  raw?: unknown
  result?: Extraction
  error?: string
}

interface Extractor {
  engine: Extraction['extracted_by']
  version: string
  read(filename: string, today: string): Promise<Reading>
}

const xmlExtractor: Extractor = {
  engine: 'xml',
  version: '1',
  async read(filename, today) {
    try {
      const root = parseReceiptXml(decodeXml(await readFile(filename)))
      const raw = { root: root.name, namespace: root.uri }
      const result = extractXml(root, today)
      return result
        ? { raw, result }
        : {
            raw,
            error: 'Die XML ist keine unterstützte UBL- oder CII-Rechnung.',
          }
    } catch {
      return { error: 'Die Beleg-XML konnte nicht sicher gelesen werden.' }
    }
  },
}

function textExtractor(executable: string): Extractor {
  return {
    engine: 'textlayer',
    version: '1',
    async read(filename, today) {
      try {
        const { stdout } = await run(
          executable,
          ['-layout', '-enc', 'UTF-8', filename, '-'],
          PDF_OPTIONS
        )
        const raw = stdout.trim()
        if (!raw) return {}
        const result = extractText(raw, today)
        const { supplier_name, invoice_number, invoice_date, gross_cents } =
          result.fields
        return {
          raw,
          result:
            supplier_name ||
            invoice_number ||
            invoice_date ||
            gross_cents != null
              ? result
              : undefined,
        }
      } catch (error) {
        return (error as NodeJS.ErrnoException).code === 'ENOENT'
          ? {}
          : { error: 'Die PDF-Textschicht konnte nicht gelesen werden.' }
      }
    },
  }
}

export async function readReceiptFile(
  file: StoredReceiptFile,
  filename: string,
  today: string,
  pdftotext = 'pdftotext'
) {
  const extractor =
    file.role === 'xml'
      ? xmlExtractor
      : file.mime === 'application/pdf'
      ? textExtractor(pdftotext)
      : ({
          engine: 'manuell',
          version: '1',
          read: async (): Promise<Reading> => ({}),
        } as const)
  const start = performance.now()
  const reading = await extractor.read(filename, today)
  return {
    ...reading,
    engine: extractor.engine,
    version: extractor.version,
    duration_ms: Math.round(performance.now() - start),
  }
}

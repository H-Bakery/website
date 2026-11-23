import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { chmod, link, mkdir, open, unlink } from 'node:fs/promises'
import path from 'node:path'

export const MAX_RECEIPT_BYTES = 15_000_000
export const MAX_RECEIPT_PAGES = 10

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10])
const HEIC = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
])
export const FILE_TYPES = {
  jpg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  pdf: 'application/pdf',
  xml: 'application/xml',
} as const
type Extension = keyof typeof FILE_TYPES

function xmlDecoder(bytes: Buffer, fatal = false): TextDecoder {
  const marker = bytes.subarray(0, 4).toString('hex')
  const encoding =
    marker.startsWith('fffe') || marker === '3c003f00'
      ? 'utf-16le'
      : marker.startsWith('feff') || marker === '003c003f'
      ? 'utf-16be'
      : 'utf-8'
  return new TextDecoder(encoding, { fatal })
}

export function decodeXml(bytes: Buffer): string {
  return xmlDecoder(bytes, true).decode(bytes)
}

export function detectExtension(bytes: Buffer): Extension | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  if (bytes.subarray(0, PNG.length).equals(PNG)) return 'png'
  if (bytes.subarray(0, 5).toString('ascii') === '%PDF-') return 'pdf'
  if (
    bytes.length >= 16 &&
    bytes.subarray(4, 8).toString('latin1') === 'ftyp'
  ) {
    const size = bytes.readUInt32BE(0)
    if (size >= 16 && size <= bytes.length) {
      if (HEIC.has(bytes.toString('latin1', 8, 12))) return 'heic'
      for (let offset = 16; offset + 4 <= Math.min(size, 1024); offset += 4) {
        if (HEIC.has(bytes.toString('latin1', offset, offset + 4)))
          return 'heic'
      }
    }
  }
  const prefix = xmlDecoder(bytes).decode(bytes.subarray(0, 4096)).trimStart()
  return /^<(?:\?xml\b|!--|[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?(?=[\s/>]))/.test(
    prefix
  )
    ? 'xml'
    : null
}

export interface StoredReceiptFile {
  id: number
  receipt_id: number
  role: 'original' | 'xml'
  mime: string
  sha256: string
  path: string
  page: number
  size: number
}

export class ReceiptFileStore {
  constructor(
    readonly directory = process.env['RECEIPTS_DIR'] || '/var/lib/bakery/belege'
  ) {}

  absolute(relative: string): string {
    if (
      !/^\d{4}\/(0[1-9]|1[0-2])\/[a-f\d]{64}\.(jpg|png|heic|pdf|xml)$/.test(
        relative
      )
    ) {
      throw new Error('Ungültiger interner Belegpfad.')
    }
    return path.resolve(this.directory, relative)
  }

  async save(bytes: Buffer, sha256: string, extension: Extension, day: string) {
    const relative =
      day.slice(0, 7).replace('-', '/') + '/' + sha256 + '.' + extension
    const finalPath = this.absolute(relative)
    const directory = path.dirname(finalPath)
    const created = await mkdir(directory, { recursive: true, mode: 0o750 })
    const temporary = path.join(directory, '.upload-' + randomUUID())
    try {
      const file = await open(temporary, 'wx', 0o440)
      try {
        await file.writeFile(bytes)
        await file.chmod(0o440)
        await file.sync()
      } finally {
        await file.close()
      }
      try {
        await link(temporary, finalPath)
      } catch (error) {
        if (
          (error as NodeJS.ErrnoException).code !== 'EEXIST' ||
          (await this.hash(relative)) !== sha256
        )
          throw error
        await chmod(finalPath, 0o440)
      }
    } finally {
      await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error
      })
    }
    // Auch neue Verzeichniseinträge müssen vor dem Datenbank-Commit auf Platte sein.
    const last = created ? path.dirname(created) : directory
    let folderPath = directory
    for (;;) {
      const folder = await open(folderPath, 'r')
      try {
        await folder.sync()
      } finally {
        await folder.close()
      }
      if (folderPath === last) break
      folderPath = path.dirname(folderPath)
    }
    return relative
  }

  async hash(relative: string): Promise<string> {
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(this.absolute(relative)))
      hash.update(chunk)
    return hash.digest('hex')
  }
}

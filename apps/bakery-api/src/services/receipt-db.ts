import { QueryTypes, Transaction } from 'sequelize'
import { getSequelize } from '../models'

type Table =
  | 'receipts'
  | 'receipt_vat_lines'
  | 'receipt_files'
  | 'receipt_extractions'
  | 'transaction_links'
type Value = string | number | null
type Values = Record<string, Value>

export function select<T extends object>(
  sql: string,
  bind: Values = {},
  transaction?: Transaction
) {
  return getSequelize().query<T>(sql, {
    bind,
    transaction,
    type: QueryTypes.SELECT,
  })
}

export async function insert(
  table: Table,
  row: Values,
  transaction: Transaction
) {
  const columns = Object.keys(row)
  const [id] = await getSequelize().query(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns
      .map((key) => '$' + key)
      .join(', ')})`,
    { bind: row, transaction, type: QueryTypes.INSERT }
  )
  return id
}

export async function update(
  table: Table,
  id: number,
  row: Values,
  transaction: Transaction
) {
  const setters = Object.keys(row)
    .map((key) => `${key} = $${key}`)
    .join(', ')
  await write(
    `UPDATE ${table} SET ${setters} WHERE id = $id`,
    { ...row, id },
    transaction
  )
}

export async function write(
  sql: string,
  bind: Values,
  transaction: Transaction
) {
  await getSequelize().query(sql, { bind, transaction })
}

export class ReceiptError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra?: Record<string, unknown>
  ) {
    super(message)
  }
}

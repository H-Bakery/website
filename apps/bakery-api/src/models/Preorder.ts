/**
 * A preorder from any channel (B7): pickup at the Laden on `pickupDate` +
 * `pickupTime`, or at a pickup point (`pickupPointId`, its window applies).
 *
 * Status `offen → bereit → abgeholt`, or `storniert`. Cancelled, never
 * deleted; `abgeholt ↔ storniert` is locked (rules live in the core, B7).
 * `customerName`/`customerPhone` are cleared by the GDPR job (P4), which sets
 * `anonymizedAt`.
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  NonAttribute,
  Sequelize,
} from 'sequelize'
import type { PreorderItem } from './PreorderItem'

export const PREORDER_CHANNELS = [
  'laden',
  'telefon',
  'whatsapp',
  'shop',
  'sammelstelle',
] as const
export type PreorderChannel = (typeof PREORDER_CHANNELS)[number]

export const PREORDER_STATUSES = [
  'offen',
  'bereit',
  'abgeholt',
  'storniert',
] as const
export type PreorderStatus = (typeof PREORDER_STATUSES)[number]

export class Preorder extends Model<
  InferAttributes<Preorder>,
  InferCreationAttributes<Preorder>
> {
  declare id: CreationOptional<number>
  /** Human-readable reference, unique, e.g. `MO-2026-11-21-03`. */
  declare code: string
  declare channel: PreorderChannel
  declare customerName: string | null
  declare customerPhone: CreationOptional<string | null>
  /** `YYYY-MM-DD` */
  declare pickupDate: string
  /** `HH:MM` at the Laden; null at a pickup point. */
  declare pickupTime: CreationOptional<string | null>
  declare pickupPointId: CreationOptional<string | null>
  declare status: CreationOptional<PreorderStatus>
  declare paid: CreationOptional<boolean>
  declare note: CreationOptional<string | null>
  declare pickedUpAt: CreationOptional<Date | null>
  /** "nicht abgeholt" = status `bereit` + this timestamp (migration B7). */
  declare notCollectedAt: CreationOptional<Date | null>
  declare createdBy: CreationOptional<number | null>
  declare updatedBy: CreationOptional<number | null>
  declare anonymizedAt: CreationOptional<Date | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  declare items?: NonAttribute<PreorderItem[]>

  static initModel(sequelize: Sequelize): typeof Preorder {
    Preorder.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        code: { type: DataTypes.STRING(32), allowNull: false, unique: true },
        channel: {
          type: DataTypes.ENUM(...PREORDER_CHANNELS),
          allowNull: false,
        },
        customerName: { type: DataTypes.STRING, allowNull: true },
        customerPhone: { type: DataTypes.STRING(40), allowNull: true },
        pickupDate: { type: DataTypes.DATEONLY, allowNull: false },
        pickupTime: { type: DataTypes.STRING(5), allowNull: true },
        pickupPointId: { type: DataTypes.STRING(64), allowNull: true },
        status: {
          type: DataTypes.ENUM(...PREORDER_STATUSES),
          allowNull: false,
          defaultValue: 'offen',
        },
        paid: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        note: { type: DataTypes.TEXT, allowNull: true },
        pickedUpAt: { type: DataTypes.DATE, allowNull: true },
        notCollectedAt: { type: DataTypes.DATE, allowNull: true },
        createdBy: { type: DataTypes.INTEGER, allowNull: true },
        updatedBy: { type: DataTypes.INTEGER, allowNull: true },
        anonymizedAt: { type: DataTypes.DATE, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'Preorder',
        tableName: 'preorders',
        underscored: true,
        timestamps: true,
      }
    )
    return Preorder
  }
}

export default Preorder

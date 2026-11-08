/**
 * One production day of the Backzettel (roadmap §5.3, Z3).
 *
 * `draft` days are computed live from the YAML, the preorders and the CAP
 * template; only the season factor and corrections are stored for them. On
 * confirmation the lines are frozen into `backzettel_lines` and the preorder
 * positions of the day are kept as `preorderSnapshot`; preorders that change
 * afterwards become `backzettel_deltas`, never silently merged.
 */
import {
  CreationOptional,
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  Model,
  Sequelize,
} from 'sequelize'

export const BACKZETTEL_STATUSES = ['draft', 'confirmed'] as const
export type BackzettelStatus = (typeof BACKZETTEL_STATUSES)[number]

/** One preorder position as it was at confirmation. */
export interface PreorderSnapshotItem {
  preorderId: number | null
  productId: string
  /** '' = no variant */
  variant: string
  qty: number
  /** Z10: pickup day of the preorder (a sheet collects several bake days). */
  pickupDate?: string
}

/** Z10: which (bake date × item) a sheet holds (`backzettel-plan.core.js`). */
export interface BackzettelPlan {
  version: number
  doughDate: string
  /** `itemIds: null` = every item (a day confirmed before Z10, `legacyPlan`). */
  bakeDates: { date: string; itemIds: string[] | null }[]
  /**
   * Item ids of the master data at confirm (Z10): an item added to hq later
   * stays with this sheet if its dough day is this sheet (`planCovers`).
   */
  knownItems?: string[]
}

/**
 * What the core computed besides the lines at confirmation; a confirmed day
 * is served from it, never recomputed from the current YAML.
 */
export interface ComputedSnapshot {
  hefeteig: unknown
  fillings: unknown
  prep: unknown
  warnings: unknown[]
  /** Zeilen ohne festgelegte Grundmenge bei der Freigabe (fehlt bei älteren Freigaben). */
  unsetKeys?: string[]
  /** Vorbestellungen je Zeile vor dem Aufrunden (fehlt bei Freigaben vor der W4-Verifikation). */
  preordersExact?: Record<string, number>
  subtotalExact?: Record<string, number>
  /**
   * Z10 (`sheetVersion: 2`): the frozen plan and dough-day parts. A snapshot
   * without `plan` is a day confirmed before Z10 (`legacyPlan`).
   */
  sheetVersion?: number
  plan?: BackzettelPlan | null
  bakeDates?: unknown[]
  doughs?: unknown[]
  machine?: unknown[]
  bread?: unknown
  rolls?: unknown[]
  openMasterData?: unknown[]
}

export class BackzettelDay extends Model<
  InferAttributes<BackzettelDay>,
  InferCreationAttributes<BackzettelDay>
> {
  /** `YYYY-MM-DD`, primary key. */
  declare date: string
  declare status: CreationOptional<BackzettelStatus>
  /** SQLite returns DECIMAL as a number; other dialects as a string. */
  declare seasonFactor: CreationOptional<number>
  declare confirmedBy: CreationOptional<number | null>
  declare confirmedAt: CreationOptional<Date | null>
  declare preorderSnapshot: CreationOptional<PreorderSnapshotItem[] | null>
  declare computedSnapshot: CreationOptional<ComputedSnapshot | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  static initModel(sequelize: Sequelize): typeof BackzettelDay {
    BackzettelDay.init(
      {
        date: { type: DataTypes.DATEONLY, allowNull: false, primaryKey: true },
        status: {
          type: DataTypes.ENUM(...BACKZETTEL_STATUSES),
          allowNull: false,
          defaultValue: 'draft',
        },
        seasonFactor: {
          type: DataTypes.DECIMAL(5, 2),
          allowNull: false,
          defaultValue: 1.0,
        },
        confirmedBy: { type: DataTypes.INTEGER, allowNull: true },
        confirmedAt: { type: DataTypes.DATE, allowNull: true },
        preorderSnapshot: { type: DataTypes.JSON, allowNull: true },
        computedSnapshot: { type: DataTypes.JSON, allowNull: true },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'BackzettelDay',
        tableName: 'backzettel_days',
        underscored: true,
        timestamps: true,
      }
    )
    return BackzettelDay
  }
}

export default BackzettelDay

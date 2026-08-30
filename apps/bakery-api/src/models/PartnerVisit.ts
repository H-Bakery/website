import {
  Model,
  DataTypes,
  Sequelize,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  ForeignKey,
  BelongsToGetAssociationMixin,
  HasManyGetAssociationsMixin,
} from 'sequelize'
// Temporary local logger until utils library is properly configured
const logger = {
  info: (message: string, ...args: any[]) =>
    console.log(`[INFO] ${message}`, ...args),
  error: (message: string, ...args: any[]) =>
    console.error(`[ERROR] ${message}`, ...args),
  warn: (message: string, ...args: any[]) =>
    console.warn(`[WARN] ${message}`, ...args),
  debug: (message: string, ...args: any[]) =>
    console.log(`[DEBUG] ${message}`, ...args),
  db: (message: string, ...args: any[]) =>
    console.log(`[DB] ${message}`, ...args),
}

/**
 * Besuchstyp am Backschrank.
 * `initial` - Erstbestückung am Morgen
 * `refill`  - Nachlieferung im Tagesverlauf
 * `pickup`  - Abholung/Tagesabschluss; erst damit gilt der Geschäftstag als
 *             abgeschlossen. Ohne `pickup` sind Verkauf und Umsatz vorläufig.
 */
export type VisitType = 'initial' | 'refill' | 'pickup'

export const VISIT_TYPES: VisitType[] = ['initial', 'refill', 'pickup']

export interface PartnerVisitAttributes {
  id: number
  partnerId: number
  /** Geschäftstag `YYYY-MM-DD` - Gruppierungsschlüssel aller Auswertungen. */
  businessDate: string
  visitAt: Date
  visitType: VisitType
  /** Laufende Nummer des Besuchs innerhalb des Geschäftstags (1, 2, 3 …). */
  sequence: number
  staffId: number | null
  staffName: string | null
  note: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Ein Besuch am Backschrank des Partners. Erfasst wird nicht "eine Lieferung",
 * sondern der Besuch: was lag noch da und was wurde neu eingeräumt
 * (siehe `PartnerVisitItem`). Verkäufe werden daraus abgeleitet, nie erfasst.
 */
export class PartnerVisit extends Model<
  InferAttributes<PartnerVisit>,
  InferCreationAttributes<PartnerVisit>
> {
  declare id: CreationOptional<number>
  declare partnerId: ForeignKey<number>
  declare businessDate: string
  declare visitAt: CreationOptional<Date>
  declare visitType: VisitType
  declare sequence: CreationOptional<number>
  declare staffId: CreationOptional<ForeignKey<number> | null>
  declare staffName: CreationOptional<string | null>
  declare note: CreationOptional<string | null>
  declare createdAt: CreationOptional<Date>
  declare updatedAt: CreationOptional<Date>

  // Associations
  declare getPartner: BelongsToGetAssociationMixin<any>
  declare getItems: HasManyGetAssociationsMixin<any>
  declare getStaff: BelongsToGetAssociationMixin<any>
  declare partner?: any
  declare items?: any
  declare staff?: any

  static initModel(sequelize: Sequelize): typeof PartnerVisit {
    PartnerVisit.init(
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        partnerId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'Partners',
            key: 'id',
          },
        },
        businessDate: {
          type: DataTypes.DATEONLY,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        visitAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        visitType: {
          type: DataTypes.ENUM('initial', 'refill', 'pickup'),
          allowNull: false,
          defaultValue: 'refill',
        },
        sequence: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
          validate: {
            min: {
              args: [1],
              msg: 'Sequence starts at 1',
            },
            isInt: {
              msg: 'Sequence must be an integer',
            },
          },
        },
        staffId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: 'Users',
            key: 'id',
          },
        },
        staffName: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        note: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE,
      },
      {
        sequelize,
        modelName: 'PartnerVisit',
        tableName: 'PartnerVisits',
        timestamps: true,
        indexes: [
          {
            fields: ['partnerId', 'businessDate'],
          },
        ],
        hooks: {
          beforeCreate: (visit: PartnerVisit) => {
            logger.info(
              `Recording partner visit: ${visit.visitType} #${visit.sequence} on ${visit.businessDate}`
            )
          },
        },
      }
    )

    return PartnerVisit
  }

  // Instance methods
  toJSON() {
    const values = { ...this.get() }
    return values
  }
}

// For backward compatibility
export default PartnerVisit

/**
 * Sequelize models of the pilot (roadmap B2).
 *
 * `initializeModels()` initialises exactly the models whose tables the pilot
 * baseline migration creates (`migrations/20261105000000-pilot-baseline.js`):
 *
 *   User, RefreshToken, AuditLog                 users, refresh_tokens, audit_log
 *   Station, AuthSession                         stations, auth_sessions (B3 migration)
 *   Partner, PartnerDeliveryTemplate,
 *   PartnerVisit, PartnerVisitItem               Partners, PartnerDeliveryTemplates, ...
 *   PickupPoint, Preorder, PreorderItem          pickup_points, preorders, preorder_items
 *   BackzettelDay, BackzettelLine,
 *   BackzettelDelta                              backzettel_days/_lines/_deltas (Z3)
 *   RestCount                                    rest_counts (M4 „Rest am Abend“ migration)
 *
 * Legacy models (Cash, Chat, Product, Order, OrderItem, Inventory, Recipe,
 * Notification*, Production*, StockAdjustment, UnsoldProduct) are still
 * exported so the unmounted legacy code keeps compiling, but they are
 * **not initialised** and their tables are not in the baseline. Using one
 * throws "Model not initialized". B12 deletes them with the legacy routes.
 */
import { Sequelize } from 'sequelize'

import { default as User } from './User'
import { default as RefreshToken } from './RefreshToken'
import { default as AuditLog } from './AuditLog'
import { default as Station } from './Station'
import { default as AuthSession } from './AuthSession'
import { default as Partner } from './Partner'
import { default as PartnerDeliveryTemplate } from './PartnerDeliveryTemplate'
import { default as PartnerVisit } from './PartnerVisit'
import { default as PartnerVisitItem } from './PartnerVisitItem'
import { default as PickupPoint } from './PickupPoint'
import { default as Preorder } from './Preorder'
import { default as PreorderItem } from './PreorderItem'
import { default as BackzettelDay } from './BackzettelDay'
import { default as BackzettelLine } from './BackzettelLine'
import { default as BackzettelDelta } from './BackzettelDelta'
import { default as RestCount } from './RestCount'

// --- Legacy, unused in the pilot (not initialised, no table) --------------
import { default as Cash } from './Cash'
import { default as Chat } from './Chat'
import { default as Product } from './Product'
import { default as UnsoldProduct } from './UnsoldProduct'
import { default as Order } from './Order'
import { default as OrderItem } from './OrderItem'
import { default as Inventory } from './Inventory'
import { default as Recipe } from './Recipe'
import { default as Notification } from './Notification'
import { default as StockAdjustment } from './StockAdjustment'
import { default as NotificationPreferences } from './NotificationPreferences'
import { default as NotificationTemplate } from './NotificationTemplate'
import { default as ProductionBatch } from './ProductionBatch'
import { default as ProductionSchedule } from './ProductionSchedule'
import { default as ProductionStep } from './ProductionStep'

// Sequelize instance - set during initializeModels
let _sequelize: Sequelize | undefined

export function getSequelize(): Sequelize {
  if (!_sequelize) {
    throw new Error('Sequelize not initialized. Call initializeModels() first.')
  }
  return _sequelize
}

// Keep backward-compatible named export for existing imports
export { _sequelize as sequelize }

export {
  User,
  RefreshToken,
  AuditLog,
  Station,
  AuthSession,
  Partner,
  PartnerDeliveryTemplate,
  PartnerVisit,
  PartnerVisitItem,
  PickupPoint,
  Preorder,
  PreorderItem,
  BackzettelDay,
  BackzettelLine,
  BackzettelDelta,
  RestCount,
}

/** @deprecated legacy alias, the pilot has staff users only. */
export const Customer = User

/** @deprecated legacy models: not initialised in the pilot, see header. */
export {
  Cash,
  Chat,
  Product,
  UnsoldProduct,
  Order,
  OrderItem,
  Inventory,
  Recipe,
  Notification,
  StockAdjustment,
  NotificationPreferences,
  NotificationTemplate,
  ProductionBatch,
  ProductionSchedule,
  ProductionStep,
}

/** The models `initializeModels()` sets up, in dependency order. */
export const PILOT_MODELS = [
  User,
  Station,
  AuthSession,
  RefreshToken,
  AuditLog,
  Partner,
  PartnerDeliveryTemplate,
  PartnerVisit,
  PartnerVisitItem,
  PickupPoint,
  Preorder,
  PreorderItem,
  BackzettelDay,
  BackzettelLine,
  BackzettelDelta,
  RestCount,
] as const

export async function initializeModels(seq: Sequelize): Promise<void> {
  _sequelize = seq
  for (const model of PILOT_MODELS) {
    model.initModel(seq)
  }
  setupAssociations()
}

function setupAssociations(): void {
  // Auth
  User.hasMany(RefreshToken, { foreignKey: 'userId', as: 'refreshTokens' })
  RefreshToken.belongsTo(User, { foreignKey: 'userId', as: 'user' })
  AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' })
  User.hasMany(AuthSession, { foreignKey: 'userId', as: 'sessions' })
  AuthSession.belongsTo(User, { foreignKey: 'userId', as: 'user' })
  AuthSession.belongsTo(Station, { foreignKey: 'stationId', as: 'station' })
  AuthSession.hasMany(RefreshToken, {
    foreignKey: 'sessionId',
    as: 'refreshTokens',
  })
  RefreshToken.belongsTo(AuthSession, {
    foreignKey: 'sessionId',
    as: 'session',
  })

  // Sales partners (Backschrank, TASK-037)
  Partner.hasMany(PartnerDeliveryTemplate, {
    foreignKey: 'partnerId',
    as: 'templates',
  })
  Partner.hasMany(PartnerVisit, { foreignKey: 'partnerId', as: 'visits' })
  PartnerDeliveryTemplate.belongsTo(Partner, {
    foreignKey: 'partnerId',
    as: 'partner',
  })
  PartnerVisit.belongsTo(Partner, { foreignKey: 'partnerId', as: 'partner' })
  PartnerVisit.hasMany(PartnerVisitItem, {
    foreignKey: 'visitId',
    as: 'items',
    onDelete: 'CASCADE',
  })
  PartnerVisit.belongsTo(User, { foreignKey: 'staffId', as: 'staff' })
  PartnerVisitItem.belongsTo(PartnerVisit, {
    foreignKey: 'visitId',
    as: 'visit',
  })

  // Preorders (B7)
  Preorder.hasMany(PreorderItem, {
    foreignKey: 'preorderId',
    as: 'items',
    onDelete: 'CASCADE',
  })
  PreorderItem.belongsTo(Preorder, { foreignKey: 'preorderId', as: 'preorder' })
  Preorder.belongsTo(PickupPoint, {
    foreignKey: 'pickupPointId',
    as: 'pickupPoint',
  })
  PickupPoint.hasMany(Preorder, {
    foreignKey: 'pickupPointId',
    as: 'preorders',
  })
  Preorder.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' })
  Preorder.belongsTo(User, { foreignKey: 'updatedBy', as: 'updater' })

  // Backzettel (Z3)
  BackzettelDay.hasMany(BackzettelLine, { foreignKey: 'date', as: 'lines' })
  BackzettelLine.belongsTo(BackzettelDay, { foreignKey: 'date', as: 'day' })
  BackzettelDay.hasMany(BackzettelDelta, { foreignKey: 'date', as: 'deltas' })
  BackzettelDelta.belongsTo(BackzettelDay, { foreignKey: 'date', as: 'day' })
}

/** Models with a table in the pilot schema (for tooling and tests). */
export function getAllModels(): unknown[] {
  return [...PILOT_MODELS]
}

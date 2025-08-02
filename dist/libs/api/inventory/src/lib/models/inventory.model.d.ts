import { Model, Sequelize } from 'sequelize'
export type InventoryUnit =
  | 'kg'
  | 'g'
  | 'liters'
  | 'ml'
  | 'units'
  | 'pieces'
  | 'bags'
  | 'boxes'
  | 'bottles'
  | 'jars'
export type InventoryCategory =
  | 'ingredients'
  | 'packaging'
  | 'supplies'
  | 'equipment'
  | 'consumables'
  | 'other'
export interface InventoryAttributes {
  id?: number
  name: string
  sku?: string
  description?: string
  quantity: number
  unit: InventoryUnit
  lowStockThreshold?: number
  category?: InventoryCategory
  location?: string
  supplier?: string
  cost?: number
  reorderLevel?: number
  reorderQuantity?: number
  lastRestockedAt?: Date
  expiryDate?: Date
  notes?: string
  isActive?: boolean
  createdAt?: Date
  updatedAt?: Date
}
export interface InventoryCreationAttributes
  extends Omit<InventoryAttributes, 'id' | 'createdAt' | 'updatedAt'> {}
export declare class Inventory
  extends Model<InventoryAttributes, InventoryCreationAttributes>
  implements InventoryAttributes
{
  id: number
  name: string
  sku?: string
  description?: string
  quantity: number
  unit: InventoryUnit
  lowStockThreshold: number
  category?: InventoryCategory
  location?: string
  supplier?: string
  cost?: number
  reorderLevel: number
  reorderQuantity: number
  lastRestockedAt?: Date
  expiryDate?: Date
  notes?: string
  isActive: boolean
  readonly createdAt: Date
  readonly updatedAt: Date
  isLowStock(): boolean
  needsReorder(): boolean
  adjustStock(change: number): Promise<Inventory>
  static initialize(sequelize: Sequelize): void
}

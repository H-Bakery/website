import { ValidationChain } from 'express-validator'
/**
 * Validation rules for creating an inventory item
 */
export declare const inventoryCreationRules: () => ValidationChain[]
/**
 * Validation rules for updating an inventory item
 */
export declare const inventoryUpdateRules: () => ValidationChain[]
/**
 * Validation rules for deleting an inventory item
 */
export declare const inventoryDeleteRules: () => ValidationChain[]
/**
 * Validation rules for stock adjustment
 */
export declare const stockAdjustmentRules: () => ValidationChain[]
/**
 * Validation rules for bulk stock adjustments
 */
export declare const bulkStockAdjustmentRules: () => ValidationChain[]

import { ValidationChain } from 'express-validator';
/**
 * Validation rules for creating an order
 */
export declare const orderCreationRules: () => ValidationChain[];
/**
 * Validation rules for updating an order
 */
export declare const orderUpdateRules: () => ValidationChain[];
/**
 * Validation rules for deleting an order
 */
export declare const orderDeleteRules: () => ValidationChain[];

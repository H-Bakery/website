import { ValidationChain } from 'express-validator';
/**
 * Validation rules for user registration
 */
export declare const userRegistrationRules: () => ValidationChain[];
/**
 * Validation rules for user login
 */
export declare const loginRules: () => ValidationChain[];
/**
 * Validation rules for customer update
 */
export declare const customerUpdateRules: () => ValidationChain[];
/**
 * Validation rules for password update
 */
export declare const passwordUpdateRules: () => ValidationChain[];
/**
 * Validation rules for customer ID parameter
 */
export declare const customerIdRules: () => ValidationChain[];

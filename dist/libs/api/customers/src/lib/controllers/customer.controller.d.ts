import { Request, Response } from 'express';
export declare class CustomerController {
    /**
     * Register new customer/user
     */
    static register(req: Request, res: Response): Promise<void>;
    /**
     * Login customer/user
     */
    static login(req: Request, res: Response): Promise<void>;
    /**
     * Get all customers (admin only)
     */
    static getAllCustomers(req: Request, res: Response): Promise<void>;
    /**
     * Get customer by ID
     */
    static getCustomerById(req: Request, res: Response): Promise<void>;
    /**
     * Update customer profile
     */
    static updateCustomer(req: Request, res: Response): Promise<void>;
    /**
     * Update customer password
     */
    static updatePassword(req: Request, res: Response): Promise<void>;
    /**
     * Deactivate customer (soft delete)
     */
    static deactivateCustomer(req: Request, res: Response): Promise<void>;
    /**
     * Reactivate customer
     */
    static reactivateCustomer(req: Request, res: Response): Promise<void>;
}

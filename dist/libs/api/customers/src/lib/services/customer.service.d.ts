import { Customer, CustomerCreationAttributes } from '../models/customer.model';
interface CustomerFilters {
    role?: string;
    isActive?: boolean;
    search?: string;
}
interface CustomerStats {
    totalCustomers: number;
    activeCustomers: number;
    inactiveCustomers: number;
    customersByRole: {
        admin: number;
        staff: number;
        user: number;
    };
}
export declare class CustomerService {
    /**
     * Create a new customer
     * @param customerData - The customer data
     * @returns The created customer (without password)
     */
    createCustomer(customerData: CustomerCreationAttributes): Promise<Omit<Customer, 'password'>>;
    /**
     * Get all customers with optional filtering
     * @param filters - Optional filters
     * @returns Array of customers (without passwords)
     */
    getAllCustomers(filters?: CustomerFilters): Promise<Omit<Customer, 'password'>[]>;
    /**
     * Get a single customer by ID
     * @param id - The customer ID
     * @returns The customer (without password) or null
     */
    getCustomerById(id: number): Promise<Omit<Customer, 'password'> | null>;
    /**
     * Get customer by username
     * @param username - The username
     * @returns The customer or null
     */
    getCustomerByUsername(username: string): Promise<Customer | null>;
    /**
     * Update customer details
     * @param id - The customer ID
     * @param updateData - The data to update
     * @returns The updated customer (without password)
     */
    updateCustomer(id: number, updateData: Partial<CustomerCreationAttributes>): Promise<Omit<Customer, 'password'> | null>;
    /**
     * Update customer password
     * @param id - The customer ID
     * @param currentPassword - The current password for verification
     * @param newPassword - The new password
     * @returns Success boolean
     */
    updatePassword(id: number, currentPassword: string, newPassword: string): Promise<boolean>;
    /**
     * Deactivate customer (soft delete)
     * @param id - The customer ID
     * @returns Success boolean
     */
    deactivateCustomer(id: number): Promise<boolean>;
    /**
     * Reactivate customer
     * @param id - The customer ID
     * @returns Success boolean
     */
    reactivateCustomer(id: number): Promise<boolean>;
    /**
     * Get customer statistics
     * @returns Customer statistics
     */
    getCustomerStats(): Promise<CustomerStats>;
    /**
     * Validate customer credentials
     * @param username - The username
     * @param password - The password
     * @returns The customer if valid, null otherwise
     */
    validateCredentials(username: string, password: string): Promise<Customer | null>;
}
export {};

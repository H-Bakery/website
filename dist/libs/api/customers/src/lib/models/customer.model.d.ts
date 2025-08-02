import { Model, Sequelize, CreationOptional, Association } from 'sequelize'
export interface CustomerAttributes {
  id: number
  username: string
  password: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'staff' | 'user'
  isActive: boolean
  lastLogin: Date | null
  createdAt?: Date
  updatedAt?: Date
  deletedAt?: Date | null
}
export interface CustomerCreationAttributes
  extends Omit<
    CustomerAttributes,
    'id' | 'createdAt' | 'updatedAt' | 'deletedAt'
  > {
  id?: number
}
export declare class Customer
  extends Model<CustomerAttributes, CustomerCreationAttributes>
  implements CustomerAttributes
{
  id: number
  username: string
  password: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'staff' | 'user'
  isActive: boolean
  lastLogin: CreationOptional<Date | null>
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly deletedAt: Date | null
  readonly orders?: any[]
  readonly cashEntries?: any[]
  readonly chats?: any[]
  readonly unsoldProducts?: any[]
  static associations: {
    orders: Association<Customer, any>
    cashEntries: Association<Customer, any>
    chats: Association<Customer, any>
    unsoldProducts: Association<Customer, any>
  }
  getFullName(): string
  isAdmin(): boolean
  isStaff(): boolean
  updateLastLogin(): Promise<void>
  static initModel(sequelize: Sequelize): typeof Customer
  static associate(models: any): void
}

import { Sequelize } from 'sequelize'
export interface DatabaseConfig {
  dialect: 'sqlite' | 'postgres' | 'mysql' | 'mariadb' | 'mssql'
  storage?: string
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  logging?: boolean | ((sql: string, timing?: number) => void)
  pool?: {
    max?: number
    min?: number
    acquire?: number
    idle?: number
  }
}
export declare function getDatabaseConfig(): DatabaseConfig
export declare function createSequelize(config?: DatabaseConfig): Sequelize
export declare const sequelize: Sequelize
export declare function testConnection(seq?: Sequelize): Promise<boolean>
export declare function syncDatabase(
  seq?: Sequelize,
  force?: boolean
): Promise<void>
export declare function closeConnection(seq?: Sequelize): Promise<void>

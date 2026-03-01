import * as path from 'path'
import { Product } from '../models'
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

// TODO: Import from @bakery/api/utils when fixed
// import { parseCSV } from '@bakery/api/utils';
import * as fs from 'fs'

function parseCSV(filePath: string): any[] {
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split('\n').filter((line) => line.trim())
    if (lines.length === 0) return []

    const headers = lines[0].split(',').map((h) => h.trim())
    return lines.slice(1).map((line) => {
      const values = line.split(',')
      const obj: any = {}
      headers.forEach((header, index) => {
        obj[header] = values[index]?.trim() || ''
      })
      return obj
    })
  } catch (error) {
    logger.error(`Error parsing CSV file ${filePath}:`, error)
    return []
  }
}

export async function runProductSeeder(): Promise<void> {
  try {
    // Check if Product model exists before trying to use it
    if (!Product) {
      logger.error('Product model not found. Skipping product seeding.')
      return
    }

    const productCount = await Product.count()

    if (productCount === 0) {
      // Path to CSV file relative to this file
      const csvFilePath = path.resolve(
        __dirname,
        '../../../hq/data/products/products.csv'
      )

      // Parse CSV data
      const productsData = parseCSV(csvFilePath)

      // Transform CSV data to match our model structure
      const productsToCreate = productsData.map((product: any) => ({
        id: parseInt(product.id),
        name: product.name,
        price: parseFloat(product.price),
        description: `Category: ${product.category}`,
        // Set default values for fields not in CSV
        stock: 10,
        dailyTarget: 20,
        isActive: true,
        // Store image path from CSV
        image: product.image,
        category: product.category,
      }))

      // Create products in database
      await Product.bulkCreate(productsToCreate)
      logger.info(`Created ${productsToCreate.length} products from CSV data`)
    } else {
      logger.info('Products already exist, skipping seed')
    }
  } catch (error) {
    logger.error('Error seeding products:', error)
    if (error instanceof Error) {
      logger.error(error.stack)
    }
  }
}

/**
 * Import Routes
 * Handles data imports, file uploads, and bulk data processing
 */

import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs/promises'
import csv from 'csv-parse'
import xlsx from 'xlsx'

const router = Router()

// ============================================================================
// FILE UPLOAD CONFIGURATION
// ============================================================================

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'imports')
    await fs.mkdir(uploadDir, { recursive: true })
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, `import-${uniqueSuffix}${path.extname(file.originalname)}`)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.csv', '.xlsx', '.xls', '.json', '.xml']
    const ext = path.extname(file.originalname).toLowerCase()
    
    if (allowedExtensions.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error(`File type ${ext} not supported. Allowed types: ${allowedExtensions.join(', ')}`))
    }
  }
})

// ============================================================================
// IMPORT DATA INTERFACES
// ============================================================================

interface ImportResult {
  success: boolean
  totalRows: number
  imported: number
  failed: number
  errors: Array<{
    row: number
    field?: string
    message: string
  }>
  warnings: Array<{
    row: number
    message: string
  }>
}

interface ImportOptions {
  validateOnly?: boolean
  updateExisting?: boolean
  skipDuplicates?: boolean
  mapping?: Record<string, string>
}

// ============================================================================
// DAILY REPORT IMPORT ROUTES
// ============================================================================

// Import daily report data
router.post('/daily-report', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      })
    }

    const options: ImportOptions = {
      validateOnly: req.body.validateOnly === 'true',
      updateExisting: req.body.updateExisting === 'true',
      skipDuplicates: req.body.skipDuplicates !== 'false'
    }

    const filePath = req.file.path
    const fileExt = path.extname(req.file.originalname).toLowerCase()
    
    let data: any[] = []

    // Parse file based on extension
    if (fileExt === '.csv') {
      const fileContent = await fs.readFile(filePath, 'utf-8')
      data = await new Promise((resolve, reject) => {
        csv.parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true
        }, (err, records) => {
          if (err) reject(err)
          else resolve(records)
        })
      })
    } else if (['.xlsx', '.xls'].includes(fileExt)) {
      const workbook = xlsx.readFile(filePath)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      data = xlsx.utils.sheet_to_json(worksheet)
    } else if (fileExt === '.json') {
      const fileContent = await fs.readFile(filePath, 'utf-8')
      data = JSON.parse(fileContent)
    }

    // Process the imported data
    const result: ImportResult = {
      success: true,
      totalRows: data.length,
      imported: 0,
      failed: 0,
      errors: [],
      warnings: []
    }

    // Validate and import each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNumber = i + 1

      try {
        // Validate required fields
        if (!row.date || !row.revenue || !row.orders) {
          result.errors.push({
            row: rowNumber,
            message: 'Missing required fields: date, revenue, or orders'
          })
          result.failed++
          continue
        }

        // Validate data types
        const revenue = parseFloat(row.revenue)
        const orders = parseInt(row.orders)
        
        if (isNaN(revenue) || isNaN(orders)) {
          result.errors.push({
            row: rowNumber,
            message: 'Invalid data types for revenue or orders'
          })
          result.failed++
          continue
        }

        // If not validation only, import the data
        if (!options.validateOnly) {
          // Mock implementation - would save to database
          // await dailyReportService.import(row, options)
        }

        result.imported++

        // Add warnings for unusual values
        if (revenue > 10000) {
          result.warnings.push({
            row: rowNumber,
            message: 'Unusually high revenue value'
          })
        }
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Import failed'
        })
        result.failed++
      }
    }

    // Clean up uploaded file
    await fs.unlink(filePath)

    res.json({
      success: result.errors.length === 0,
      result,
      message: options.validateOnly 
        ? 'Validation completed' 
        : `Imported ${result.imported} of ${result.totalRows} records`
    })
  } catch (error) {
    next(error)
  }
})

// ============================================================================
// INVENTORY IMPORT ROUTES
// ============================================================================

// Import inventory data
router.post('/inventory', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      })
    }

    const filePath = req.file.path
    const fileExt = path.extname(req.file.originalname).toLowerCase()
    
    let data: any[] = []

    // Parse file based on extension
    if (fileExt === '.csv') {
      const fileContent = await fs.readFile(filePath, 'utf-8')
      data = await new Promise((resolve, reject) => {
        csv.parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true
        }, (err, records) => {
          if (err) reject(err)
          else resolve(records)
        })
      })
    } else if (['.xlsx', '.xls'].includes(fileExt)) {
      const workbook = xlsx.readFile(filePath)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      data = xlsx.utils.sheet_to_json(worksheet)
    }

    const result: ImportResult = {
      success: true,
      totalRows: data.length,
      imported: 0,
      failed: 0,
      errors: [],
      warnings: []
    }

    // Process inventory items
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNumber = i + 1

      try {
        // Validate required fields
        if (!row.name || row.quantity === undefined || !row.unit) {
          result.errors.push({
            row: rowNumber,
            message: 'Missing required fields: name, quantity, or unit'
          })
          result.failed++
          continue
        }

        // Mock implementation - would save to database
        result.imported++
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Import failed'
        })
        result.failed++
      }
    }

    // Clean up uploaded file
    await fs.unlink(filePath)

    res.json({
      success: result.errors.length === 0,
      result,
      message: `Imported ${result.imported} of ${result.totalRows} inventory items`
    })
  } catch (error) {
    next(error)
  }
})

// ============================================================================
// PRODUCT IMPORT ROUTES
// ============================================================================

// Import product catalog
router.post('/products', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      })
    }

    const filePath = req.file.path
    const fileExt = path.extname(req.file.originalname).toLowerCase()
    
    let data: any[] = []

    // Parse file
    if (fileExt === '.json') {
      const fileContent = await fs.readFile(filePath, 'utf-8')
      data = JSON.parse(fileContent)
    } else if (['.xlsx', '.xls'].includes(fileExt)) {
      const workbook = xlsx.readFile(filePath)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      data = xlsx.utils.sheet_to_json(worksheet)
    }

    const result: ImportResult = {
      success: true,
      totalRows: data.length,
      imported: 0,
      failed: 0,
      errors: [],
      warnings: []
    }

    // Process products
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNumber = i + 1

      try {
        // Validate required fields
        if (!row.name || !row.price || !row.category) {
          result.errors.push({
            row: rowNumber,
            message: 'Missing required fields: name, price, or category'
          })
          result.failed++
          continue
        }

        // Validate price
        const price = parseFloat(row.price)
        if (isNaN(price) || price < 0) {
          result.errors.push({
            row: rowNumber,
            field: 'price',
            message: 'Invalid price value'
          })
          result.failed++
          continue
        }

        // Mock implementation - would save to database
        result.imported++
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Import failed'
        })
        result.failed++
      }
    }

    // Clean up uploaded file
    await fs.unlink(filePath)

    res.json({
      success: result.errors.length === 0,
      result,
      message: `Imported ${result.imported} of ${result.totalRows} products`
    })
  } catch (error) {
    next(error)
  }
})

// ============================================================================
// CUSTOMER IMPORT ROUTES
// ============================================================================

// Import customer data
router.post('/customers', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      })
    }

    const options: ImportOptions = {
      updateExisting: req.body.updateExisting === 'true',
      skipDuplicates: req.body.skipDuplicates !== 'false'
    }

    const filePath = req.file.path
    const fileExt = path.extname(req.file.originalname).toLowerCase()
    
    let data: any[] = []

    // Parse file
    if (fileExt === '.csv') {
      const fileContent = await fs.readFile(filePath, 'utf-8')
      data = await new Promise((resolve, reject) => {
        csv.parse(fileContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true
        }, (err, records) => {
          if (err) reject(err)
          else resolve(records)
        })
      })
    } else if (['.xlsx', '.xls'].includes(fileExt)) {
      const workbook = xlsx.readFile(filePath)
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      data = xlsx.utils.sheet_to_json(worksheet)
    }

    const result: ImportResult = {
      success: true,
      totalRows: data.length,
      imported: 0,
      failed: 0,
      errors: [],
      warnings: []
    }

    // Process customers
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNumber = i + 1

      try {
        // Validate required fields
        if (!row.email || !row.name) {
          result.errors.push({
            row: rowNumber,
            message: 'Missing required fields: email or name'
          })
          result.failed++
          continue
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(row.email)) {
          result.errors.push({
            row: rowNumber,
            field: 'email',
            message: 'Invalid email format'
          })
          result.failed++
          continue
        }

        // Check for duplicates
        if (options.skipDuplicates) {
          // Mock check - would check database
          const exists = false // await customerService.exists(row.email)
          if (exists) {
            result.warnings.push({
              row: rowNumber,
              message: 'Customer already exists, skipping'
            })
            continue
          }
        }

        // Mock implementation - would save to database
        result.imported++
      } catch (error) {
        result.errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : 'Import failed'
        })
        result.failed++
      }
    }

    // Clean up uploaded file
    await fs.unlink(filePath)

    res.json({
      success: result.errors.length === 0,
      result,
      message: `Imported ${result.imported} of ${result.totalRows} customers`
    })
  } catch (error) {
    next(error)
  }
})

// ============================================================================
// IMPORT STATUS & HISTORY ROUTES
// ============================================================================

// Get import history
router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20
    const offset = parseInt(req.query.offset as string) || 0

    // Mock implementation - would fetch from database
    const history = [
      {
        id: 'imp-001',
        type: 'daily-report',
        filename: 'daily-report-2024-01.csv',
        uploadedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        uploadedBy: 'admin@bakery.com',
        status: 'completed',
        totalRows: 31,
        imported: 31,
        failed: 0
      },
      {
        id: 'imp-002',
        type: 'inventory',
        filename: 'inventory-update.xlsx',
        uploadedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        uploadedBy: 'manager@bakery.com',
        status: 'completed',
        totalRows: 150,
        imported: 148,
        failed: 2
      },
      {
        id: 'imp-003',
        type: 'products',
        filename: 'new-products.json',
        uploadedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        uploadedBy: 'admin@bakery.com',
        status: 'failed',
        totalRows: 25,
        imported: 0,
        failed: 25,
        error: 'Invalid JSON format'
      }
    ]

    res.json({
      success: true,
      history: history.slice(offset, offset + limit),
      total: history.length,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < history.length
      }
    })
  } catch (error) {
    next(error)
  }
})

// Get import templates
router.get('/templates/:type', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type } = req.params
    const format = req.query.format as string || 'csv'

    const templates: Record<string, any> = {
      'daily-report': {
        headers: ['date', 'revenue', 'orders', 'customers', 'avgOrderValue'],
        sample: {
          date: '2024-01-15',
          revenue: 5432.50,
          orders: 145,
          customers: 89,
          avgOrderValue: 37.50
        }
      },
      'inventory': {
        headers: ['name', 'quantity', 'unit', 'minStock', 'maxStock', 'supplier'],
        sample: {
          name: 'All-Purpose Flour',
          quantity: 100,
          unit: 'kg',
          minStock: 50,
          maxStock: 200,
          supplier: 'Local Mill Co.'
        }
      },
      'products': {
        headers: ['name', 'category', 'price', 'cost', 'description', 'allergens'],
        sample: {
          name: 'Croissant',
          category: 'Pastries',
          price: 4.00,
          cost: 1.50,
          description: 'Buttery, flaky French pastry',
          allergens: 'Wheat, Milk, Eggs'
        }
      },
      'customers': {
        headers: ['email', 'name', 'phone', 'address', 'type', 'notes'],
        sample: {
          email: 'customer@example.com',
          name: 'John Doe',
          phone: '+1234567890',
          address: '123 Main St, City',
          type: 'regular',
          notes: 'Prefers whole grain products'
        }
      }
    }

    const template = templates[type]
    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      })
    }

    if (format === 'csv') {
      const csvContent = [
        template.headers.join(','),
        Object.values(template.sample).join(',')
      ].join('\n')

      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="${type}-template.csv"`)
      res.send(csvContent)
    } else {
      res.json({
        success: true,
        template,
        format,
        instructions: 'Use this template structure for importing data'
      })
    }
  } catch (error) {
    next(error)
  }
})

export default router
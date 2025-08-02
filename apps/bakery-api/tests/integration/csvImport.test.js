const path = require('path')
const fs = require('fs')
const { testSequelize, models } = require('../helpers/testDatabase')
const { parseCSV } = require('../../utils/csvParser')
const logger = require('../../utils/logger')

describe('CSV Import Integration', () => {
  let Product
  const fixturesDir = path.join(__dirname, '../fixtures')
  const testCsvPath = path.join(fixturesDir, 'test-products.csv')
  
  beforeAll(async () => {
    // Initialize the test database
    await testSequelize.sync({ force: true })
    
    // Get the Product model from our test models
    Product = models.Product
    
    // Ensure fixture files exist
    if (!fs.existsSync(testCsvPath)) {
      throw new Error('Test CSV fixture not found at: ' + testCsvPath)
    }
  })

  afterAll(async () => {
    // Close the database connection
    await testSequelize.close()
  })

  beforeEach(async () => {
    // Clean up the database between tests
    await Product.destroy({ where: {}, truncate: true })
  })

  test('should correctly parse and import CSV data to database', async () => {
    // Parse the CSV file
    const products = parseCSV(testCsvPath)
    
    // Check if parsing was successful
    expect(products).toBeInstanceOf(Array)
    expect(products.length).toBeGreaterThan(0)
    
    // Transform CSV data to match model structure (similar to seeder)
    const productsToCreate = products.map(product => ({
      id: parseInt(product.id),
      name: product.name,
      price: parseFloat(product.price),
      description: `Category: ${product.category}`,
      stock: 10,
      dailyTarget: 20,
      isActive: true,
      image: product.image,
      category: product.category
    }))
    
    // Insert into database
    await Product.bulkCreate(productsToCreate)
    
    // Verify database insertion
    const count = await Product.count()
    expect(count).toBe(products.length)
    
    // Verify some specific data
    const firstProduct = await Product.findByPk(1)
    expect(firstProduct).toBeTruthy()
    expect(firstProduct.name).toBe('Test Bread 500g')
    expect(firstProduct.category).toBe('Brot')
    expect(firstProduct.price).toBe(2.5)
    
    // Verify image paths were imported correctly
    expect(firstProduct.image).toBe('/assets/images/products/test-bread.svg')
    
    // Check if all products were imported with the right ids
    for (let i = 0; i < products.length; i++) {
      const id = parseInt(products[i].id)
      const dbProduct = await Product.findByPk(id)
      expect(dbProduct).toBeTruthy()
      expect(dbProduct.name).toBe(products[i].name)
    }
  })
  
  test('should handle CSV data with different field counts', async () => {
    // Create a test CSV with inconsistent fields
    const inconsistentCsvPath = path.join(fixturesDir, 'inconsistent-fields.csv')
    fs.writeFileSync(
      inconsistentCsvPath,
      'id,name,category,image,price\n' +
      '1,Complete Product,Category,/image.jpg,2.99\n' +
      '2,Missing Fields,,,1.99\n'
    )
    
    // Parse the CSV
    const products = parseCSV(inconsistentCsvPath)
    
    // Transform and import
    const productsToCreate = products.map(product => ({
      id: parseInt(product.id),
      name: product.name,
      price: parseFloat(product.price || '0'),
      description: `Category: ${product.category || 'Unknown'}`,
      stock: 10,
      dailyTarget: 20,
      isActive: true,
      image: product.image || '',
      category: product.category || 'Unknown'
    }))
    
    await Product.bulkCreate(productsToCreate)
    
    // Verify both products were imported
    const count = await Product.count()
    expect(count).toBe(2)
    
    try {
      // Verify the product with missing fields
      const product2 = await Product.findByPk(2)
      expect(product2).toBeTruthy()
      expect(product2.name).toBe('Missing Fields')
      expect(product2.image).toBe('')
      expect(product2.category).toBe('Unknown')
      expect(product2.price).toBe(1.99)
    } catch (error) {
      console.error('Test error:', error)
      throw error
    }
    
    // Clean up
    try {
      fs.unlinkSync(inconsistentCsvPath)
    } catch (error) {
      console.error('Failed to delete test file:', error)
    }
  })
  
  test('should handle number parsing errors in CSV', async () => {
    // Create a test CSV with invalid numbers
    const invalidNumbersCsvPath = path.join(fixturesDir, 'invalid-numbers.csv')
    fs.writeFileSync(
      invalidNumbersCsvPath,
      'id,name,category,image,price\n' +
      '1,Valid Product,Category,/image.jpg,2.99\n' +
      'invalid,Invalid ID,Category,/image.jpg,not-a-price\n'
    )
    
    // Parse the CSV
    const products = parseCSV(invalidNumbersCsvPath)
    
    // Transform data, handling errors
    const productsToCreate = products.map(product => {
      const id = parseInt(product.id)
      const price = parseFloat(product.price)
      
      return {
        id: isNaN(id) ? null : id,  // Let DB assign ID if invalid
        name: product.name,
        price: isNaN(price) ? 0 : price,  // Default price if invalid
        description: `Category: ${product.category || 'Unknown'}`,
        stock: 10,
        dailyTarget: 20,
        isActive: true,
        image: product.image || '',
        category: product.category || 'Unknown'
      }
    })
    
    await Product.bulkCreate(productsToCreate)
    
    // Verify both products were imported
    const count = await Product.count()
    expect(count).toBe(2)
    
    // Product with invalid price should have price 0
    const products2 = await Product.findOne({ where: { name: 'Invalid ID' }})
    expect(products2).toBeTruthy()
    expect(products2.price).toBe(0)
    
    // Clean up
    try {
      fs.unlinkSync(invalidNumbersCsvPath)
    } catch (error) {
      console.error('Failed to delete test file:', error)
    }
  })
  
  test('should handle special characters in CSV', async () => {
    // Create a test CSV with special characters
    const specialCharsCsvPath = path.join(fixturesDir, 'special-chars.csv')
    fs.writeFileSync(
      specialCharsCsvPath,
      'id,name,category,image,price\n' +
      '1,"Product with ü, ä, ö special chars","Spécial Catégorie","/image-special.jpg",3.99\n'
    )
    
    // Parse the CSV
    const products = parseCSV(specialCharsCsvPath)
    
    // Transform and import
    const productsToCreate = products.map(product => ({
      id: parseInt(product.id),
      name: product.name,
      price: parseFloat(product.price),
      description: `Category: ${product.category}`,
      stock: 10,
      dailyTarget: 20,
      isActive: true,
      image: product.image,
      category: product.category
    }))
    
    await Product.bulkCreate(productsToCreate)
    
    // Verify the product was imported with special characters intact
    const specialProduct = await Product.findByPk(1)
    expect(specialProduct).toBeTruthy()
    expect(specialProduct.name).toBe('Product with ü, ä, ö special chars')
    expect(specialProduct.category).toBe('Spécial Catégorie')
    
    // Clean up
    try {
      fs.unlinkSync(specialCharsCsvPath)
    } catch (error) {
      console.error('Failed to delete test file:', error)
    }
  })
})
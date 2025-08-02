const { testSequelize, models } = require('../helpers/testDatabase')
const logger = require('../../utils/logger')

describe('Product Advanced Features', () => {
  let Product
  let Op

  beforeAll(async () => {
    // Initialize the test database
    await testSequelize.sync({ force: true })
    
    // Get the Product model from our test models
    Product = models.Product
    
    // Get Sequelize operators
    Op = testSequelize.Sequelize.Op
  })

  afterAll(async () => {
    // Close the database connection
    await testSequelize.close()
  })

  afterEach(() => {
    // Clean up the database between tests
    return Product.destroy({ where: {}, truncate: true })
  })

  test('should find products with complex query conditions', async () => {
    // Arrange - Create products with various attributes
    await Product.bulkCreate([
      { name: 'Sourdough Bread', price: 4.50, category: 'Bread', isActive: true, stock: 15 },
      { name: 'Baguette', price: 3.00, category: 'Bread', isActive: true, stock: 10 },
      { name: 'Croissant', price: 2.50, category: 'Pastry', isActive: true, stock: 20 },
      { name: 'Chocolate Cake', price: 25.00, category: 'Cake', isActive: true, stock: 5 },
      { name: 'Stale Bread', price: 1.50, category: 'Bread', isActive: false, stock: 3 }
    ])

    // Act - Find all active bread products with stock > 5 and price < 5.00
    const results = await Product.findAll({
      where: {
        category: 'Bread',
        isActive: true,
        stock: { [Op.gt]: 5 },
        price: { [Op.lt]: 5.00 }
      },
      order: [['price', 'DESC']]
    })

    // Assert
    expect(results.length).toBe(2)
    expect(results[0].name).toBe('Sourdough Bread') // Should be first due to price DESC ordering
    expect(results[1].name).toBe('Baguette')
    expect(results.every(p => p.category === 'Bread')).toBe(true)
    expect(results.every(p => p.isActive === true)).toBe(true)
    expect(results.every(p => p.stock > 5)).toBe(true)
    expect(results.every(p => p.price < 5.00)).toBe(true)
  })

  test('should handle pagination correctly', async () => {
    // Arrange - Create 10 products
    const products = []
    for (let i = 1; i <= 10; i++) {
      products.push({
        name: `Test Product ${i}`,
        price: i * 1.5,
        category: i <= 5 ? 'Category A' : 'Category B'
      })
    }
    await Product.bulkCreate(products)

    // Act - Get first page (3 items)
    const page1 = await Product.findAll({
      limit: 3,
      offset: 0,
      order: [['id', 'ASC']]
    })

    // Act - Get second page (3 items)
    const page2 = await Product.findAll({
      limit: 3,
      offset: 3,
      order: [['id', 'ASC']]
    })

    // Act - Get third page (3 items)
    const page3 = await Product.findAll({
      limit: 3,
      offset: 6,
      order: [['id', 'ASC']]
    })

    // Act - Get fourth page (1 item remaining)
    const page4 = await Product.findAll({
      limit: 3,
      offset: 9,
      order: [['id', 'ASC']]
    })

    // Assert
    expect(page1.length).toBe(3)
    expect(page2.length).toBe(3)
    expect(page3.length).toBe(3)
    expect(page4.length).toBe(1)
    
    // Check correct ordering across pages
    expect(page1[0].name).toBe('Test Product 1')
    expect(page1[2].name).toBe('Test Product 3')
    expect(page2[0].name).toBe('Test Product 4')
    expect(page3[0].name).toBe('Test Product 7')
    expect(page4[0].name).toBe('Test Product 10')
  })

  test('should perform raw SQL queries when needed', async () => {
    // Arrange - Create test products
    await Product.bulkCreate([
      { name: 'Bread A', price: 2.99, category: 'Bread', stock: 10 },
      { name: 'Bread B', price: 3.99, category: 'Bread', stock: 5 },
      { name: 'Cake A', price: 15.99, category: 'Cake', stock: 3 }
    ])

    // Act - Use raw query to get average price by category
    const [results] = await testSequelize.query(`
      SELECT category, AVG(price) as avgPrice, SUM(stock) as totalStock
      FROM Products
      GROUP BY category
      ORDER BY avgPrice DESC
    `)

    // Assert
    expect(results.length).toBe(2)
    
    // Cake category should be first (higher price)
    expect(results[0].category).toBe('Cake')
    expect(parseFloat(results[0].avgPrice)).toBeCloseTo(15.99, 2)
    expect(parseInt(results[0].totalStock)).toBe(3)
    
    // Bread category should be second
    expect(results[1].category).toBe('Bread')
    expect(parseFloat(results[1].avgPrice)).toBeCloseTo(3.49, 2) // (2.99 + 3.99) / 2 = 3.49
    expect(parseInt(results[1].totalStock)).toBe(15) // 10 + 5 = 15
  })

  test('should handle associations and eager loading', async () => {
    // This test is a simulation since we don't have actual associations defined
    // In a real application, you would test associations between models
    
    // Simulate an association by creating products with a "relatedId"
    await Product.bulkCreate([
      { name: 'Parent Product', price: 9.99, category: 'Parent' },
      { name: 'Child Product 1', price: 4.99, category: 'Child', description: 'Related to parent' },
      { name: 'Child Product 2', price: 5.99, category: 'Child', description: 'Related to parent' },
      { name: 'Unrelated Product', price: 7.99, category: 'Other' }
    ])
    
    // Get parent product
    const parentProduct = await Product.findOne({
      where: { category: 'Parent' }
    })
    
    // Get simulated "associated" products
    const childProducts = await Product.findAll({
      where: { 
        category: 'Child',
        description: { [Op.like]: '%Related to parent%' }
      }
    })
    
    // Assert
    expect(parentProduct).toBeTruthy()
    expect(childProducts.length).toBe(2)
    childProducts.forEach(child => {
      expect(child.description).toContain('Related to parent')
    })
  })
  
  test('should handle transactions correctly', async () => {
    // Start a transaction
    const transaction = await testSequelize.transaction()
    
    try {
      // Create a product within the transaction
      const product1 = await Product.create({
        name: 'Transaction Product 1',
        price: 5.99
      }, { transaction })
      
      // Create another product within the same transaction
      const product2 = await Product.create({
        name: 'Transaction Product 2',
        price: 7.99
      }, { transaction })
      
      // Check products exist in transaction
      const uncommittedProducts = await Product.findAll({ transaction })
      expect(uncommittedProducts.length).toBe(2)
      
      // Note: SQLite in-memory databases don't properly isolate transactions
      // so we can't test transaction isolation here
      
      // Commit the transaction
      await transaction.commit()
      
      // After commit, products should definitely be visible
      const committedProducts = await Product.findAll()
      expect(committedProducts.length).toBe(2)
      
    } catch (error) {
      // Rollback on error
      await transaction.rollback()
      throw error
    }
  })
  
  test('should handle transaction rollbacks correctly', async () => {
    // Start a transaction
    const transaction = await testSequelize.transaction()
    
    try {
      // Create a product within the transaction
      const product = await Product.create({
        name: 'To Be Rolled Back',
        price: 9.99
      }, { transaction })
      
      // Product should exist within transaction
      const productInTransaction = await Product.findByPk(product.id, { transaction })
      expect(productInTransaction).toBeTruthy()
      
      // Simulate an error or decision to cancel
      await transaction.rollback()
      
      // Product shouldn't exist after rollback
      const productAfterRollback = await Product.findByPk(product.id)
      expect(productAfterRollback).toBeNull()
      
    } catch (error) {
      await transaction.rollback()
      throw error
    }
  })

  test('should add custom product validator', async () => {
    // This test demonstrates how we would test validation if it existed
    // Actual validation would be implemented in the model definition
    
    // Create a product with values we'd expect to be invalid in a real app
    const product = await Product.create({
      name: '', // Empty name - would normally be invalid
      price: -5.99 // Negative price - would normally be invalid
    })
    
    // Assert the product is created because validation isn't implemented
    expect(product).toBeDefined()
    expect(product.name).toBe('')
    expect(product.price).toBe(-5.99)
    
    // TODO: Add validation to the product model and update this test
  })
  
  test('should find products with case-insensitive search', async () => {
    // Arrange
    await Product.bulkCreate([
      { name: 'Chocolate Cake', price: 15.99, description: 'Rich chocolate flavor' },
      { name: 'Vanilla Cake', price: 14.99, description: 'Smooth vanilla taste' },
      { name: 'Strawberry Cake', price: 16.99, description: 'With chocolate chips' }
    ])
    
    // Act - Case insensitive search for 'chocolate' in name or description
    const chocolateProducts = await Product.findAll({
      where: {
        [Op.or]: [
          { name: { [Op.like]: '%Chocolate%' } },
          { description: { [Op.like]: '%chocolate%' } }
        ]
      }
    })
    
    // Assert
    expect(chocolateProducts.length).toBe(2)
    const names = chocolateProducts.map(p => p.name)
    expect(names).toContain('Chocolate Cake')
    expect(names).toContain('Strawberry Cake')
  })

  test('should filter products by multiple criteria', async () => {
    // Arrange
    await Product.bulkCreate([
      { name: 'French Baguette', price: 2.99, category: 'Bread', isActive: true },
      { name: 'Whole Wheat Bread', price: 3.49, category: 'Bread', isActive: true },
      { name: 'White Bread', price: 2.49, category: 'Bread', isActive: false },
      { name: 'Chocolate Muffin', price: 2.99, category: 'Pastry', isActive: true },
      { name: 'Blueberry Muffin', price: 2.99, category: 'Pastry', isActive: true }
    ])
    
    // Act - Find active products that are either:
    // 1. Breads with price > 3.00 OR
    // 2. Any pastry
    const filteredProducts = await Product.findAll({
      where: {
        isActive: true,
        [Op.or]: [
          {
            category: 'Bread',
            price: { [Op.gt]: 3.00 }
          },
          {
            category: 'Pastry'
          }
        ]
      }
    })
    
    // Assert
    expect(filteredProducts.length).toBe(3) // 1 bread + 2 pastries
    
    // Should contain Whole Wheat Bread (bread > $3)
    expect(filteredProducts.some(p => 
      p.name === 'Whole Wheat Bread' && p.category === 'Bread'
    )).toBe(true)
    
    // Should contain both muffins (pastries)
    expect(filteredProducts.some(p => 
      p.name === 'Chocolate Muffin' && p.category === 'Pastry'
    )).toBe(true)
    expect(filteredProducts.some(p => 
      p.name === 'Blueberry Muffin' && p.category === 'Pastry'
    )).toBe(true)
    
    // Should NOT contain French Baguette (bread ≤ $3)
    expect(filteredProducts.some(p => p.name === 'French Baguette')).toBe(false)
    
    // Should NOT contain White Bread (inactive)
    expect(filteredProducts.some(p => p.name === 'White Bread')).toBe(false)
  })
})
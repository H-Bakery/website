const { testSequelize, models } = require('../helpers/testDatabase')
const logger = require('../../utils/logger')

describe('Product Model', () => {
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

  test('should create a product with required fields', async () => {
    // Arrange
    const productData = {
      name: 'Test Bread',
      price: 3.99
    }

    // Act
    const product = await Product.create(productData)

    // Assert
    expect(product).toBeDefined()
    expect(product.id).toBeDefined()
    expect(product.name).toBe(productData.name)
    expect(product.price).toBe(productData.price)
    expect(product.isActive).toBe(true) // Default value
    expect(product.stock).toBe(0) // Default value
    expect(product.dailyTarget).toBe(0) // Default value
  })

  test('should create a product with all fields', async () => {
    // Arrange
    const productData = {
      name: 'Complete Product',
      price: 4.99,
      stock: 10,
      dailyTarget: 20,
      description: 'A complete test product',
      isActive: true,
      image: '/path/to/image.jpg',
      category: 'Test Category'
    }

    // Act
    const product = await Product.create(productData)
    const foundProduct = await Product.findByPk(product.id)

    // Assert
    expect(foundProduct.name).toBe(productData.name)
    expect(foundProduct.price).toBe(productData.price)
    expect(foundProduct.stock).toBe(productData.stock)
    expect(foundProduct.dailyTarget).toBe(productData.dailyTarget)
    expect(foundProduct.description).toBe(productData.description)
    expect(foundProduct.isActive).toBe(productData.isActive)
    expect(foundProduct.image).toBe(productData.image)
    expect(foundProduct.category).toBe(productData.category)
  })

  test('should not create product without name', async () => {
    // Arrange
    const productData = {
      price: 3.99
    }

    // Act & Assert
    await expect(Product.create(productData)).rejects.toThrow()
  })

  test('should not create product without price', async () => {
    // Arrange
    const productData = {
      name: 'Test Product No Price'
    }

    // Act & Assert
    await expect(Product.create(productData)).rejects.toThrow()
  })

  test('should update product fields', async () => {
    // Arrange
    const product = await Product.create({
      name: 'Initial Product',
      price: 3.99,
      stock: 5
    })

    // Act
    const updatedValues = {
      name: 'Updated Product',
      price: 4.99,
      stock: 10,
      isActive: false
    }
    
    await product.update(updatedValues)
    const updatedProduct = await Product.findByPk(product.id)

    // Assert
    expect(updatedProduct.name).toBe(updatedValues.name)
    expect(updatedProduct.price).toBe(updatedValues.price)
    expect(updatedProduct.stock).toBe(updatedValues.stock)
    expect(updatedProduct.isActive).toBe(updatedValues.isActive)
  })

  test('should delete a product', async () => {
    // Arrange
    const product = await Product.create({
      name: 'Product To Delete',
      price: 3.99
    })

    // Act
    await product.destroy()
    const foundProduct = await Product.findByPk(product.id)

    // Assert
    expect(foundProduct).toBeNull()
  })

  test('should bulk create products', async () => {
    // Arrange
    const productsData = [
      { name: 'Bulk Product 1', price: 2.99 },
      { name: 'Bulk Product 2', price: 3.99 },
      { name: 'Bulk Product 3', price: 4.99 }
    ]

    // Act
    const createdProducts = await Product.bulkCreate(productsData)
    const count = await Product.count()

    // Assert
    expect(createdProducts.length).toBe(3)
    expect(count).toBe(3)
  })

  test('should find products by category', async () => {
    // Arrange
    await Product.bulkCreate([
      { name: 'Bread 1', price: 2.99, category: 'Bread' },
      { name: 'Bread 2', price: 3.99, category: 'Bread' },
      { name: 'Cake 1', price: 4.99, category: 'Cake' }
    ])

    // Act
    const breadProducts = await Product.findAll({
      where: { category: 'Bread' }
    })

    // Assert
    expect(breadProducts.length).toBe(2)
    expect(breadProducts[0].category).toBe('Bread')
    expect(breadProducts[1].category).toBe('Bread')
  })

  test('should accept negative price due to lack of validation', async () => {
    // Arrange
    const productWithNegativePrice = {
      name: 'Negative Price Product',
      price: -1.99
    }

    // Act
    const product = await Product.create(productWithNegativePrice)

    // Assert
    expect(product).toBeDefined()
    expect(product.price).toBe(-1.99)
    // Note: In a real-world app, we would add validation to prevent negative prices
  })

  test('should handle empty description properly', async () => {
    // Arrange
    const productWithEmptyDesc = {
      name: 'No Description',
      price: 5.99,
      description: ''
    }

    // Act
    const product = await Product.create(productWithEmptyDesc)

    // Assert
    expect(product.description).toBe('')
    expect(product.name).toBe('No Description')
  })

  test('should find products by price range', async () => {
    // Arrange
    await Product.bulkCreate([
      { name: 'Budget Item', price: 1.99, category: 'Budget' },
      { name: 'Mid-range Item', price: 5.99, category: 'Standard' },
      { name: 'Premium Item', price: 10.99, category: 'Premium' }
    ])

    // Act
    const midRangeProducts = await Product.findAll({
      where: {
        price: {
          [Op.between]: [2.00, 8.00]
        }
      }
    })

    // Assert
    expect(midRangeProducts.length).toBe(1)
    expect(midRangeProducts[0].name).toBe('Mid-range Item')
  })

  test('should find active products only', async () => {
    // Arrange
    await Product.bulkCreate([
      { name: 'Active Product 1', price: 2.99, isActive: true },
      { name: 'Active Product 2', price: 3.99, isActive: true },
      { name: 'Inactive Product', price: 4.99, isActive: false }
    ])

    // Act
    const activeProducts = await Product.findAll({
      where: { isActive: true }
    })

    // Assert
    expect(activeProducts.length).toBe(2)
    expect(activeProducts.every(p => p.isActive)).toBe(true)
  })

  test('should handle product with maximum field lengths', async () => {
    // Arrange
    const longDescription = 'A'.repeat(1000)  // Long text field test
    const longName = 'B'.repeat(255)  // Testing string field limits
    
    const productWithLongFields = {
      name: longName,
      price: 9.99,
      description: longDescription,
      category: 'Test Category',
      stock: 9999999,  // Large integer
      dailyTarget: 9999999  // Large integer
    }

    // Act
    const product = await Product.create(productWithLongFields)
    const foundProduct = await Product.findByPk(product.id)

    // Assert
    expect(foundProduct.name).toBe(longName)
    expect(foundProduct.description).toBe(longDescription)
    expect(foundProduct.stock).toBe(9999999)
  })

  test('should update multiple products with bulk update', async () => {
    // Arrange
    await Product.bulkCreate([
      { name: 'Old Name 1', price: 2.99, category: 'Old Category' },
      { name: 'Old Name 2', price: 3.99, category: 'Old Category' }
    ])

    // Act
    const [updatedCount] = await Product.update(
      { category: 'New Category' },
      { where: { category: 'Old Category' } }
    )
    
    const updatedProducts = await Product.findAll({
      where: { category: 'New Category' }
    })

    // Assert
    expect(updatedCount).toBe(2)
    expect(updatedProducts.length).toBe(2)
    expect(updatedProducts.every(p => p.category === 'New Category')).toBe(true)
  })

  test('should increment stock count', async () => {
    // Arrange
    const product = await Product.create({
      name: 'Stock Test',
      price: 5.99,
      stock: 10
    })

    // Act
    await product.increment('stock', { by: 5 })
    const updatedProduct = await Product.findByPk(product.id)

    // Assert
    expect(updatedProduct.stock).toBe(15)
  })

  test('should count products by category', async () => {
    // Arrange
    await Product.bulkCreate([
      { name: 'Bread 1', price: 2.99, category: 'Bread' },
      { name: 'Bread 2', price: 3.99, category: 'Bread' },
      { name: 'Cake 1', price: 4.99, category: 'Cake' },
      { name: 'Cake 2', price: 5.99, category: 'Cake' },
      { name: 'Pastry 1', price: 1.99, category: 'Pastry' }
    ])

    // Act
    const breadCount = await Product.count({ where: { category: 'Bread' } })
    const cakeCount = await Product.count({ where: { category: 'Cake' } })
    const pastryCount = await Product.count({ where: { category: 'Pastry' } })

    // Assert
    expect(breadCount).toBe(2)
    expect(cakeCount).toBe(2)
    expect(pastryCount).toBe(1)
  })
})
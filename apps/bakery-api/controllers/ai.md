# Bakery Backend Controllers Directory

This directory contains the controller logic for the bakery application, following the MVC (Model-View-Controller) architecture pattern. Controllers handle HTTP requests, interact with models, and send back appropriate responses.

## Key Controllers

- `productController.js` - Handles product-related operations (list, view, create, update, delete)
- `authController.js` - Manages user authentication (register, login)
- `cashController.js` - Manages cash entries and financial transactions
- `chatController.js` - Handles chat message operations
- `orderController.js` - Manages customer orders

## Product Controller

The `productController.js` contains:

- `getProducts` - Retrieves all active products with fields like id, name, price, stock, description, image, and category
- `getProduct` - Retrieves a specific product by ID with all its details

This controller was recently updated to include new fields (image, category) in the API response after the product model was expanded to support CSV data import.

## Controller Structure

Each controller typically follows this pattern:
- Import required models and utilities
- Export controller methods as functions
- Use async/await pattern for database operations
- Include proper error handling and logging
- Return appropriate HTTP status codes and response data

## Request Flow

1. Route receives HTTP request
2. Controller method is called
3. Controller performs business logic (often involving models)
4. Controller sends HTTP response with appropriate data

## Code Style

- No semicolons
- Async/await for asynchronous operations
- Consistent error handling with logger
- Clear separation of concerns
- RESTful API design principles

## Usage Example

```javascript
// Route definition
router.get('/products', productController.getProducts);

// Controller implementation
exports.getProducts = async (req, res) => {
  try {
    const products = await models.Product.findAll({
      where: { isActive: true },
      attributes: ['id', 'name', 'price', 'stock', 'description', 'image', 'category'],
    });
    res.json(products);
  } catch (error) {
    logger.error("Error retrieving products:", error);
    res.status(500).json({ error: "Database error" });
  }
};
```
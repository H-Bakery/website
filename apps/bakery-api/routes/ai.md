# Bakery Backend Routes Directory

This directory contains Express route definitions for the bakery application API. Routes connect HTTP requests to controller functions and organize the API endpoints.

## Key Route Files

- `productRoutes.js` - Product-related endpoints (listing, viewing, creating, updating products)
- `authRoutes.js` - Authentication endpoints (register, login)
- `cashRoutes.js` - Cash management endpoints
- `chatRoutes.js` - Chat message endpoints
- `orderRoutes.js` - Order management endpoints
- `bakingListRoutes.js` - Baking list management endpoints

## Routes Structure

Each route file follows a similar pattern:
1. Import Express and create a router
2. Import relevant controllers
3. Define endpoints with HTTP methods (GET, POST, PUT, DELETE)
4. Associate endpoints with controller methods
5. Export the router

## Product Routes

The `productRoutes.js` file defines these endpoints:
- `GET /products` - List all active products (handled by `productController.getProducts`)
- `GET /products/:id` - Get a specific product by ID (handled by `productController.getProduct`)

These endpoints return product data including the newly added fields (image, category) from the CSV import.

## Route Middleware

Some routes may include middleware functions for:
- Authentication verification
- Request validation
- Request logging

## API Structure

The routes follow RESTful API design principles:
- Use nouns for resources (products, orders)
- HTTP methods indicate actions (GET, POST, PUT, DELETE)
- Use plural resource names
- Nested resources use path parameters

## Usage Example

```javascript
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.get('/', productController.getProducts);
router.get('/:id', productController.getProduct);

module.exports = router;
```

These routes are registered in the main `index.js` file with a base path, such as `/products`.
# Bakery Backend Models Directory

This directory contains the Sequelize ORM models that define the database schema for the bakery application.

## Key Models

- `Product.js` - Product model representing bakery items
- `User.js` - User model for authentication and authorization
- `Cash.js` - Cash entries model for tracking financial transactions
- `Chat.js` - Chat messages model
- `Order.js` - Order model for tracking customer orders
- `OrderItem.js` - Order items model for individual items in an order

## Model Structure

The directory follows Sequelize's standard model definition pattern:

- Each model file exports a function that takes `sequelize` and `DataTypes` parameters
- Models define fields, validations, and associations
- The `index.js` file sets up associations between models

## Product Model

The `Product` model includes fields like:
- `id` - Primary key
- `name` - Product name
- `price` - Product price
- `stock` - Current inventory level
- `dailyTarget` - Daily production target
- `description` - Product description
- `isActive` - Whether the product is available
- `image` - Path to product image
- `category` - Product category

This model was recently updated to support CSV data import with new fields for images and categories.

## Database Relationships

- Users have many Cash entries
- Users have many Chat messages
- Orders have many OrderItems
- Products can be part of multiple OrderItems

## Code Style

- No semicolons
- Clear field definitions with proper types
- Default values provided where appropriate
- Associations defined in the `index.js` file

## Usage Example

```javascript
const product = await models.Product.findByPk(1);
const allActiveProducts = await models.Product.findAll({
  where: { isActive: true }
});
```
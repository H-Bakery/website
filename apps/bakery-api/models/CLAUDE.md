# CLAUDE.md - Backend Models

This directory contains the data models for the bakery management system, defining database schema, relationships, and business logic using Sequelize ORM.

## Model Overview

Models define the structure of data entities, their relationships, and validation rules. Each model represents a core business concept in the bakery management system.

## Core Models

### `User.js`
**Purpose**: User accounts and authentication

**Schema**:
- `id`: Primary key (auto-increment)
- `username`: Unique username for login
- `email`: User email address
- `password`: Hashed password (bcrypt)
- `role`: User role (admin, baker, staff)
- `firstName`: User's first name
- `lastName`: User's last name
- `isActive`: Account status flag
- `createdAt`: Account creation timestamp
- `updatedAt`: Last modification timestamp

**Relationships**:
- Has many: Orders, Cash entries, Chat messages, UnsoldProduct records

**Business Logic**:
- Password hashing before save
- Role-based permission validation
- Email format validation
- Username uniqueness enforcement

### `Product.js`
**Purpose**: Product catalog and inventory

**Schema**:
- `id`: Primary key (auto-increment)
- `name`: Product display name
- `category`: Primary product category
- `subcategory`: Secondary classification
- `price`: Base price in euros (decimal)
- `type`: Frontend rendering type
- `description`: Product description
- `available`: Availability status (boolean)
- `seasonal`: Seasonal availability flag
- `weight`: Standard weight/size
- `allergens`: Allergen information (JSON)
- `nutritionalInfo`: Nutritional data (JSON)
- `createdAt`: Creation timestamp
- `updatedAt`: Last modification timestamp

**Relationships**:
- Has many: OrderItems, UnsoldProduct records

**Business Logic**:
- Price validation (positive numbers)
- Category standardization
- Allergen information formatting
- Type classification validation

### `order.js`
**Purpose**: Customer orders and order management

**Schema**:
- `id`: Primary key (auto-increment)
- `customerName`: Customer name
- `customerEmail`: Customer contact email
- `customerPhone`: Customer phone number
- `orderDate`: Date order was placed
- `deliveryDate`: Requested delivery/pickup date
- `status`: Order status (pending, confirmed, completed, cancelled)
- `totalAmount`: Total order value (calculated)
- `notes`: Special instructions or notes
- `userId`: Reference to creating user
- `createdAt`: Order creation timestamp
- `updatedAt`: Last modification timestamp

**Relationships**:
- Belongs to: User
- Has many: OrderItems

**Business Logic**:
- Total amount calculation from line items
- Status transition validation
- Delivery date validation (future dates)
- Customer contact information validation

### `orderItem.js`
**Purpose**: Individual line items within orders

**Schema**:
- `id`: Primary key (auto-increment)
- `orderId`: Reference to parent order
- `productId`: Reference to ordered product
- `quantity`: Number of items ordered
- `unitPrice`: Price per unit at time of order
- `totalPrice`: Line total (quantity × unitPrice)
- `specialInstructions`: Item-specific notes
- `createdAt`: Creation timestamp
- `updatedAt`: Last modification timestamp

**Relationships**:
- Belongs to: Order, Product

**Business Logic**:
- Total price calculation
- Quantity validation (positive integers)
- Price consistency with product catalog
- Stock availability checking

### `Cash.js`
**Purpose**: Daily cash tracking and revenue management

**Schema**:
- `id`: Primary key (auto-increment)
- `date`: Date of cash entry (unique per day)
- `morningCash`: Starting cash amount
- `eveningCash`: Ending cash amount
- `totalSales`: Total sales for the day
- `expenses`: Daily expenses
- `difference`: Calculated variance
- `notes`: Comments or explanations
- `userId`: User who created the entry
- `createdAt`: Entry creation timestamp
- `updatedAt`: Last modification timestamp

**Relationships**:
- Belongs to: User

**Business Logic**:
- Daily uniqueness constraint
- Difference calculation (evening - morning - sales + expenses)
- Variance threshold alerts
- Date validation

### `Chat.js`
**Purpose**: Internal staff communication

**Schema**:
- `id`: Primary key (auto-increment)
- `message`: Message content
- `userId`: Sender user ID
- `channel`: Communication channel/room
- `isRead`: Read status (boolean)
- `priority`: Message priority (low, normal, high, urgent)
- `replyToId`: Reference to parent message (for threading)
- `createdAt`: Message timestamp
- `updatedAt`: Last modification timestamp

**Relationships**:
- Belongs to: User
- Self-referencing: Reply relationship

**Business Logic**:
- Message length validation
- Channel access control
- Read status tracking
- Message threading support

### `unsoldProduct.js`
**Purpose**: Daily waste and unsold item tracking

**Schema**:
- `id`: Primary key (auto-increment)
- `date`: Date of the record
- `productId`: Reference to unsold product
- `quantityUnsold`: Number of unsold items
- `reason`: Reason for not selling (expired, damaged, etc.)
- `estimatedValue`: Estimated loss value
- `notes`: Additional comments
- `userId`: User who recorded the entry
- `createdAt`: Record creation timestamp
- `updatedAt`: Last modification timestamp

**Relationships**:
- Belongs to: Product, User

**Business Logic**:
- Daily product uniqueness constraint
- Value calculation based on product price
- Reason categorization
- Waste percentage calculations

## Model Relationships

### Association Map
```
User (1) ↔ (N) Order
User (1) ↔ (N) Cash
User (1) ↔ (N) Chat
User (1) ↔ (N) UnsoldProduct

Order (1) ↔ (N) OrderItem
Product (1) ↔ (N) OrderItem
Product (1) ↔ (N) UnsoldProduct

Chat (N) ↔ (1) Chat (self-referencing for replies)
```

### Database Constraints
- Foreign key relationships enforced
- Unique constraints on business rules
- Index optimization for frequent queries
- Cascade delete rules for data integrity

## Validation Rules

### Common Validations
- Required field validation
- Data type enforcement
- Length constraints
- Format validation (email, phone, etc.)

### Business Rule Validation
- Price positivity
- Date logic (delivery after order)
- Status transition rules
- Quantity minimums

### Security Validations
- Input sanitization
- SQL injection prevention
- XSS protection
- Data length limits

## Database Configuration

### Sequelize Setup
```javascript
// Database connection and model synchronization
const sequelize = new Sequelize(config.database);
const models = require('./models');

// Model initialization and associations
Object.values(models).forEach(model => {
  if (model.associate) {
    model.associate(models);
  }
});
```

### Migration Strategy
- Model synchronization on startup
- Schema evolution through migrations
- Data seeding for initial setup
- Backup and recovery procedures

## Performance Optimization

### Indexing Strategy
- Primary keys automatically indexed
- Foreign keys indexed for joins
- Frequently queried fields indexed
- Composite indexes for complex queries

### Query Optimization
- Eager loading for related data
- Lazy loading for optional relationships
- Query result caching
- Connection pooling

## Testing Strategy

### Model Testing
- Unit tests for model validation
- Relationship testing
- Business logic verification
- Error handling validation

### Integration Testing
- Database interaction testing
- Transaction testing
- Constraint violation testing
- Performance testing

## Security Considerations

### Data Protection
- Sensitive field encryption
- Password hashing (bcrypt)
- Personal data anonymization
- Audit trail maintenance

### Access Control
- Model-level permissions
- Field-level access control
- Role-based data filtering
- Ownership validation

## Future Enhancements

### Planned Features
- Soft delete implementation
- Versioning for audit trails
- Full-text search capabilities
- Advanced reporting views

### Scalability Preparations
- Sharding considerations
- Read replica support
- Caching layer integration
- Performance monitoring hooks
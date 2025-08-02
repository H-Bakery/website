# CLAUDE.md - Backend Controllers

This directory contains the controller layer for the bakery backend API, implementing business logic and request handling.

## Controller Overview

Controllers handle incoming HTTP requests, process business logic, and return appropriate responses. Each controller focuses on a specific domain area of the bakery management system.

## Controllers

### `authController.js`
**Purpose**: User authentication and authorization

**Key Functions**:
- `register()`: Create new user accounts with role assignment
- `login()`: Authenticate users and issue JWT tokens
- Password hashing and validation
- Role-based access control setup

**Integration**: Works with User model and JWT middleware

### `bakingListController.js`
**Purpose**: Generate production lists from customer orders

**Key Functions**:
- `getBakingList()`: Aggregate orders into production requirements
- Product quantity calculations
- Production priority sorting
- Date-based filtering for daily/weekly lists

**Integration**: Reads from Order and OrderItem models

### `cashController.js`
**Purpose**: Daily cash and revenue management

**Key Functions**:
- `createCashEntry()`: Record daily cash totals
- `getCashEntries()`: Retrieve cash history with filtering
- `updateCashEntry()`: Modify existing cash records
- `deleteCashEntry()`: Remove cash entries
- `getMonthlySummary()`: Generate monthly revenue reports

**Integration**: Full CRUD operations on Cash model

### `chatController.js`
**Purpose**: Internal staff communication system

**Key Functions**:
- `sendMessage()`: Create new chat messages
- `getMessages()`: Retrieve message history
- `markAsRead()`: Message status management
- Channel-based message organization

**Integration**: Works with Chat model and User authentication

### `orderController.js`
**Purpose**: Customer order management and processing

**Key Functions**:
- `createOrder()`: Process new customer orders
- `getOrders()`: Retrieve orders with filtering and pagination
- `updateOrder()`: Modify existing orders
- `deleteOrder()`: Cancel orders
- `getOrderDetails()`: Detailed order information with items

**Integration**: Manages Order and OrderItem models with Product references

### `productController.js`
**Purpose**: Product catalog management and CSV import

**Key Functions**:
- `getProducts()`: Retrieve product catalog with filtering
- `createProduct()`: Add new products manually
- `updateProduct()`: Modify existing product information
- `deleteProduct()`: Remove products from catalog
- `importFromCSV()`: Bulk import products from CSV files
- Category and type-based filtering

**Integration**: Product model CRUD plus CSV parser utility

### `unsoldProductController.js`
**Purpose**: Track daily unsold items and waste management

**Key Functions**:
- `recordUnsoldProducts()`: Log daily unsold items
- `getUnsoldHistory()`: Retrieve unsold product records
- `getDailySummary()`: Daily waste summary
- `getWeeklySummary()`: Weekly waste analysis

**Integration**: UnsoldProduct model with Product references

## Common Patterns

### Error Handling
All controllers implement consistent error handling:
```javascript
try {
  // Business logic
  res.status(200).json({ success: true, data: result });
} catch (error) {
  logger.error('Operation failed:', error);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error' 
  });
}
```

### Request Validation
Controllers validate incoming data:
- Required field checking
- Data type validation
- Business rule enforcement
- Sanitization for security

### Response Format
Standardized response structure:
```javascript
{
  success: boolean,
  data?: any,
  message?: string,
  error?: string
}
```

### Authentication Integration
Protected endpoints verify JWT tokens:
```javascript
// Middleware applied in routes
router.post('/endpoint', authMiddleware, controller.method);
```

### Logging
All controllers use the logger utility:
- Request/response logging
- Error tracking
- Performance monitoring
- Audit trail creation

## Database Integration

### ORM Usage
Controllers use Sequelize ORM for database operations:
- Model-based queries
- Relationship handling
- Transaction support
- Validation enforcement

### Query Optimization
- Eager loading for related data
- Indexed field filtering
- Pagination for large datasets
- Caching strategies

## Testing Strategy

### Unit Testing
Each controller has comprehensive unit tests:
- Mock database interactions
- Test success and error scenarios
- Validate response formats
- Check business logic correctness

### Integration Testing
End-to-end testing with real database:
- Complete request/response cycle
- Database state verification
- Authentication flow testing
- Error handling validation

## Security Considerations

### Input Validation
- SQL injection prevention
- XSS protection
- Data sanitization
- Type checking

### Authorization
- Role-based access control
- Resource ownership verification
- Permission checking
- JWT token validation

### Data Protection
- Sensitive data filtering
- Password hashing
- Audit logging
- Rate limiting preparation

## Performance Optimization

### Efficient Queries
- Minimize database calls
- Use appropriate indexes
- Implement pagination
- Cache frequent queries

### Response Optimization
- Only return necessary data
- Compress large responses
- Use HTTP status codes effectively
- Implement conditional requests

## Future Enhancements

### Planned Features
- Enhanced filtering and sorting
- Bulk operations support
- Real-time notifications
- Advanced reporting capabilities
- Integration with external systems

### Scalability Considerations
- Caching layer implementation
- Database query optimization
- Load balancing preparation
- Microservice architecture readiness
# Frontend Context Tests

This directory contains tests for React Context providers used throughout the application.

## Test Files

### `CartContext.test.tsx`

**Purpose**: Tests the shopping cart context functionality

**Test Coverage**:

- Cart initialization and state management
- Product addition and quantity management
- Cart item removal and updates
- Total calculations (price and count)
- Edge cases and error scenarios

**Key Test Categories**:

1. **Basic Cart Operations**:

   - Empty cart initialization
   - Single product addition
   - Multiple product addition
   - Quantity incrementation

2. **Cart Management**:

   - Direct quantity updates
   - Product removal
   - Complete cart clearing
   - Zero quantity handling

3. **Calculations**:

   - Real-time total price calculation
   - Item count tracking
   - Multi-item total verification
   - Complex quantity scenarios

4. **Edge Cases**:
   - Negative quantity handling
   - Large quantities
   - Decimal price calculations

## Test Infrastructure

### Testing Framework

- **Jest**: Test runner and assertions
- **React Testing Library**: Component testing utilities
- **@testing-library/jest-dom**: Extended DOM matchers

### Mock Data

- Realistic product objects with all required Product type fields
- Consistent test data for reproducible results
- Type-safe mock products using TypeScript interfaces

### Test Components

- `TestComponent`: Main test harness for cart operations
- `TestNegativeQuantityComponent`: Edge case testing for negative values
- Custom test IDs for reliable element selection

## Cart Context API Tested

### Methods Tested

- `addToCart(product: Product)`: Add product to cart
- `removeFromCart(id: number)`: Remove product completely
- `updateQuantity(id: number, quantity: number)`: Set specific quantity
- `clearCart()`: Empty entire cart

### State Properties Tested

- `items: CartItem[]`: Array of cart items with quantities
- `totalPrice: number`: Calculated total price
- `totalCount: number`: Total item count
- `CartItem`: Product with added quantity field

## Test Scenarios Covered

### Happy Path

- ✅ Add single product
- ✅ Add multiple different products
- ✅ Increase quantity of existing product
- ✅ Update quantity to specific value
- ✅ Remove single product
- ✅ Clear entire cart

### Edge Cases

- ✅ Zero quantity removal behavior
- ✅ Negative quantity handling
- ✅ Large quantity calculations
- ✅ Empty cart operations
- ✅ Complex multi-product scenarios

### State Consistency

- ✅ Real-time total calculations
- ✅ Count accuracy across operations
- ✅ Item array integrity
- ✅ Price calculation precision

## Running Tests

```bash
# Run cart context tests
npm test -- src/context/__tests__/CartContext.test.tsx

# Run all context tests
npm test -- src/context/__tests__/

# Run with coverage
npm test -- --coverage src/context/__tests__/

# Watch mode for development
npm test -- --watch src/context/__tests__/CartContext.test.tsx
```

## Test Metrics

- **Total Tests**: 11 comprehensive test cases
- **Coverage**: 100% line coverage for CartContext
- **Scenarios**: Happy path, edge cases, error conditions
- **Performance**: All tests complete in <1 second

## Best Practices Demonstrated

### Component Testing

- Proper component mounting and unmounting
- Realistic user interactions with fireEvent
- Async state update handling
- Clean test isolation

### React Testing Library

- Semantic queries using test IDs
- User-centric testing approach
- Avoiding implementation details
- Proper cleanup between tests

### TypeScript Integration

- Type-safe mock data
- Proper interface usage
- Compile-time error prevention
- IDE support for test development

## Future Test Enhancements

### Planned Additions

- Cart persistence testing (localStorage)
- Error boundary testing
- Performance testing with large carts
- Integration tests with API calls

### Additional Contexts

- ThemeContext tests
- AuthContext tests (when implemented)
- Global state integration tests

## Dependencies

- **React**: Component library
- **React Testing Library**: Testing utilities
- **Jest**: Test framework
- **@testing-library/jest-dom**: DOM matchers
- **TypeScript**: Type safety

## Notes

- Tests use modern React patterns (hooks, context)
- All tests are isolated and independent
- Mock data matches production Product interface
- Tests cover both UI interaction and business logic
- Error scenarios are properly handled and tested

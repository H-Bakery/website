# Bakery Website Testing Documentation

## Testing Architecture

The bakery website uses a comprehensive testing strategy with different levels of tests:

1. **Unit Tests**: Testing individual components, hooks, and utility functions in isolation
2. **Integration Tests**: Testing interactions between components and services
3. **End-to-End Tests**: Testing complete user flows

## Test Setup and Tools

Our testing environment is built with the following tools:

- **Jest**: Main test runner
- **React Testing Library**: For testing React components
- **Jest-DOM**: For DOM-specific assertions
- **User Event**: For simulating user interactions

## Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode (good during development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file(s)
npm run test -- src/components/button/__tests__/Button.test.tsx

# Skip coverage reports for faster feedback during development
npm run test -- --no-coverage
```

## Test File Structure

We follow a consistent pattern for organizing test files:

- Component tests are kept in `__tests__` directories next to the components they test
- Context and hook tests are in `__tests__` directories within their respective folders
- Utility tests are kept in the same directory as the utility functions

```
src/
  components/
    Button/
      Index.tsx
      __tests__/
        Button.test.tsx
  context/
    ThemeContext.tsx
    __tests__/
      ThemeContext.test.tsx
```

## Writing Tests

### Component Testing

For React components, use React Testing Library's render function and queries:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import Button from '../Index'

describe('Button Component', () => {
  it('renders correctly', () => {
    render(<Button>Click Me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })
  
  it('handles click events', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Clickable</Button>)
    fireEvent.click(screen.getByRole('button', { name: /clickable/i }))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### Mocking APIs and External Services

For components that make API calls, use Jest's mocking capabilities:

```tsx
// Mock the fetch function
global.fetch = jest.fn()

// Setup mock response
beforeEach(() => {
  fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ id: 1, name: 'Test Product' })
  })
})

// Test component that uses fetch
it('loads and displays data', async () => {
  render(<ProductDetail productId={1} />)
  expect(screen.getByText(/loading/i)).toBeInTheDocument()
  
  // Wait for data to load
  expect(await screen.findByText('Test Product')).toBeInTheDocument()
  expect(fetch).toHaveBeenCalledWith('/api/products/1')
})
```

### Testing with Context

For components that rely on context providers, wrap them in the necessary providers:

```tsx
import { ThemeProvider } from '../ThemeContext'

it('uses theme from context', () => {
  render(
    <ThemeProvider>
      <ThemedComponent />
    </ThemeProvider>
  )
  // Test component with context
})
```

## Test Conventions

### Naming

- Test files: `ComponentName.test.tsx`
- Test descriptions:
  - Use descriptive language that explains what the component should do
  - Start with verbs like "renders", "updates", "calls", etc.

### Assertions

Use expressive assertions from jest-dom:

```tsx
expect(element).toBeInTheDocument()
expect(element).toHaveTextContent('Expected text')
expect(element).toBeDisabled()
```

## Local Storage & Cookies

We mock localStorage in `jest.setup.js`. Access it in tests via:

```tsx
// localStorage is automatically mocked
localStorage.setItem('key', 'value')
expect(localStorage.getItem).toHaveBeenCalledWith('key')
```

## Testing Best Practices

1. **Test behavior, not implementation**: Focus on what the component does, not how it's built
2. **Use accessible queries**: Prefer `getByRole`, `getByLabelText`, etc. over `getByTestId`
3. **Wait for async operations**: Use `waitFor` or `findBy` queries for asynchronous operations
4. **Setup proper data**: Each test should set up its own data and not rely on other tests
5. **Clean up after tests**: Ensure each test restores any global state it modifies

## Coverage Requirements

We aim for a minimum coverage of:
- 70% statement coverage
- 70% branch coverage
- 70% function coverage

## Debugging Tests

To debug tests:
1. Add `console.log` statements in your tests
2. Use `screen.debug()` to output the current DOM state
3. Run a specific test file with `npm run test -- path/to/test.tsx`
4. Add the `--verbose` flag to see more detailed output: `npm run test -- --verbose`
5. Set breakpoints in your IDE

## Common Issues and Solutions

1. **Problem**: Test fails with "unable to find element"
   **Solution**: Check if the element is actually rendered, and ensure you're using the right query

2. **Problem**: Act warnings
   **Solution**: Wrap updates in `act()` or use `waitFor` to wait for updates to complete

3. **Problem**: Tests interfering with each other
   **Solution**: Ensure proper cleanup between tests using `beforeEach`/`afterEach`

4. **Problem**: Locale differences causing test failures
   **Solution**: Use `toMatch()` with regex or `toContain()` instead of exact string matching

5. **Problem**: Missing DOM APIs in JSDOM
   **Solution**: Add missing globals in `jest.setup.js` (e.g., `TextEncoder`, `TextDecoder`)
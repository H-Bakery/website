# Testing Guide for Bakery Website

This guide provides instructions for writing tests for the Bakery Website application.

## Getting Started

### Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode (good for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run a specific test file
npm run test -- src/components/button/__tests__/Button.test.tsx

# Skip coverage reports for faster feedback
npm run test -- --no-coverage
```

### Test File Structure

Test files should be placed in a `__tests__` directory adjacent to the files they're testing:

```
src/
  components/
    Button/
      Index.tsx
      __tests__/
        Button.test.tsx
```

## Writing Tests

### Component Tests

A basic component test should:
1. Render the component with required props
2. Query for elements that should be in the DOM
3. Assert that the component behaves as expected

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Button from '../Index';

describe('Button Component', () => {
  it('renders correctly with default props', () => {
    render(<Button>Click Me</Button>);
    
    const button = screen.getByRole('button', { name: /click me/i });
    expect(button).toBeInTheDocument();
  });
  
  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Clickable</Button>);
    
    fireEvent.click(screen.getByRole('button', { name: /clickable/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Context Tests

When testing a component that uses context:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider } from '../../context/ThemeContext';
import ThemedButton from '../ThemedButton';

describe('ThemedButton with ThemeContext', () => {
  it('renders with theme from context', () => {
    render(
      <ThemeProvider>
        <ThemedButton>Theme Button</ThemedButton>
      </ThemeProvider>
    );
    
    expect(screen.getByRole('button')).toHaveClass('light-theme');
  });
});
```

### Mocking API Requests

For components that make API calls:

```tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProductList from '../ProductList';

// Mock fetch globally
global.fetch = jest.fn();

describe('ProductList', () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  it('fetches and displays products', async () => {
    // Setup mock response
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, name: 'Sourdough Bread', price: 4.99 },
        { id: 2, name: 'Croissant', price: 2.99 }
      ]
    });

    render(<ProductList />);
    
    // Check initial loading state
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    
    // Wait for products to display
    await waitFor(() => {
      expect(screen.getByText('Sourdough Bread')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Croissant')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/products');
  });
  
  it('handles API errors', async () => {
    // Mock API error
    fetch.mockRejectedValueOnce(new Error('API Error'));
    
    render(<ProductList />);
    
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```

### Testing Hooks

For custom React hooks:

```tsx
import { renderHook, act } from '@testing-library/react-hooks';
import useCounter from '../useCounter';

describe('useCounter Hook', () => {
  it('should increment counter', () => {
    const { result } = renderHook(() => useCounter(0));
    
    act(() => {
      result.current.increment();
    });
    
    expect(result.current.count).toBe(1);
  });
});
```

## Best Practices

### Queries Priority

When selecting elements, prefer queries in this order:

1. Queries accessible to everyone:
   - `getByRole` - best for interactive elements
   - `getByLabelText` - form fields
   - `getByPlaceholderText` - input placeholders
   - `getByText` - non-interactive elements

2. Semantic queries:
   - `getByAltText` - images
   - `getByTitle` - title attribute

3. Test IDs (last resort):
   - `getByTestId` - when no other options work

### Async Testing

For asynchronous operations, use `async/await` with React Testing Library's `findBy` queries or `waitFor`:

```tsx
// Using findBy (preferred when possible)
const element = await screen.findByText('Loaded Data');

// Using waitFor
await waitFor(() => {
  expect(screen.getByText('Loaded Data')).toBeInTheDocument();
});
```

### User Interactions

Use `fireEvent` or `userEvent` for simulating user interactions:

```tsx
// Basic events with fireEvent
fireEvent.click(button);

// More realistic user interactions with userEvent
userEvent.type(input, 'Hello, world!');
userEvent.selectOptions(select, 'Option 1');
userEvent.click(checkbox);
```

## Testing Specific Features

### Testing Admin Theme Toggle

```tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider } from '../context/ThemeContext';
import ThemeToggler from '../components/ThemeToggler';

describe('ThemeToggler in Admin Area', () => {
  // Mock Next.js usePathname to return an admin path
  jest.mock('next/navigation', () => ({
    ...jest.requireActual('next/navigation'),
    usePathname: () => '/admin/dashboard',
  }));

  it('toggles theme when clicked', () => {
    render(
      <ThemeProvider>
        <ThemeToggler />
      </ThemeProvider>
    );
    
    const toggleButton = screen.getByRole('button', { name: /toggle dark mode/i });
    
    // Initially light mode
    expect(toggleButton).toHaveAttribute('aria-pressed', 'false');
    
    // Click to toggle
    fireEvent.click(toggleButton);
    
    // Now dark mode
    expect(toggleButton).toHaveAttribute('aria-pressed', 'true');
  });
});
```

### Testing Form Validation

```tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import OrderForm from '../OrderForm';

describe('OrderForm', () => {
  it('validates required fields', async () => {
    render(<OrderForm />);
    
    // Try to submit empty form
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    
    // Check for validation messages
    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    });
    
    // Fill in fields
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } });
    
    // Submit again
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    
    // Should no longer show validation errors
    await waitFor(() => {
      expect(screen.queryByText(/name is required/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/email is required/i)).not.toBeInTheDocument();
    });
  });
});
```

## Troubleshooting

### Common Issues

1. **Test can't find elements** - Check that you're using the correct query and that the element is actually in the DOM
2. **Act warnings** - Wrap state updates in `act()` or use `waitFor`/`findBy` queries
3. **Mocks not working** - Ensure mocks are declared at the right scope and cleared between tests

### Debugging Tools

```tsx
// Print the current state of the DOM
screen.debug();

// Print a specific element
screen.debug(screen.getByRole('button'));

// Log all available roles
console.log(screen.getAllByRole('*').map(el => el.role));
```

## Code Coverage

We aim for at least 70% code coverage for:
- Statements
- Branches
- Functions
- Lines

Run the coverage report with:

```bash
npm run test:coverage
```

The report will highlight areas that need more testing.
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import CartProvider, { CartContext } from '../CartContext'
import { Product } from '../../types/product'

// Mock products for testing
const mockProducts: Product[] = [
  {
    id: 1,
    name: 'Sourdough Bread',
    price: 4.99,
    description: 'Tasty bread',
    image: 'bread.jpg',
    category: 'Bread',
    cost: 2.50,
    stock: 10,
    dailyTarget: 20,
    isActive: true,
  },
  {
    id: 2,
    name: 'Chocolate Croissant',
    price: 3.49,
    description: 'Flaky pastry',
    image: 'croissant.jpg',
    category: 'Pastries',
    cost: 1.75,
    stock: 15,
    dailyTarget: 30,
    isActive: true,
  },
]

// Test component that uses the cart context
const TestComponent = () => {
  const { items, totalPrice, totalCount, addToCart, removeFromCart, updateQuantity, clearCart } = React.useContext(CartContext)
  
  return (
    <div>
      <div data-testid="cart-count">{totalCount}</div>
      <div data-testid="cart-total">{totalPrice.toFixed(2)}</div>
      <div data-testid="cart-items">{items.map(item => `${item.name}:${item.quantity}`).join(',')}</div>
      <button onClick={() => addToCart(mockProducts[0])} data-testid="add-product-1">Add Bread</button>
      <button onClick={() => addToCart(mockProducts[1])} data-testid="add-product-2">Add Croissant</button>
      <button onClick={() => removeFromCart(1)} data-testid="remove-product-1">Remove Bread</button>
      <button onClick={() => updateQuantity(1, items.find(item => item.id === 1)?.quantity ? items.find(item => item.id === 1)!.quantity - 1 : 0)} data-testid="decrease-product-1">Decrease Bread</button>
      <button onClick={() => updateQuantity(1, 5)} data-testid="set-quantity-5">Set Bread to 5</button>
      <button onClick={() => clearCart()} data-testid="clear-cart">Clear Cart</button>
    </div>
  )
}

describe('CartContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('initializes with empty cart', () => {
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    )
    
    expect(screen.getByTestId('cart-count')).toHaveTextContent('0')
    expect(screen.getByTestId('cart-total')).toHaveTextContent('0.00')
    expect(screen.getByTestId('cart-items')).toHaveTextContent('')
  })

  it('adds a product to the cart', () => {
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    )
    
    fireEvent.click(screen.getByTestId('add-product-1'))
    
    expect(screen.getByTestId('cart-count')).toHaveTextContent('1')
    expect(screen.getByTestId('cart-total')).toHaveTextContent('4.99')
    expect(screen.getByTestId('cart-items')).toHaveTextContent('Sourdough Bread:1')
  })

  it('adds multiple different products to the cart', () => {
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    )
    
    fireEvent.click(screen.getByTestId('add-product-1'))
    fireEvent.click(screen.getByTestId('add-product-2'))
    
    expect(screen.getByTestId('cart-count')).toHaveTextContent('2')
    expect(screen.getByTestId('cart-total')).toHaveTextContent('8.48')
    expect(screen.getByTestId('cart-items')).toHaveTextContent('Sourdough Bread:1,Chocolate Croissant:1')
  })

  it('increases quantity when adding the same product', () => {
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    )
    
    fireEvent.click(screen.getByTestId('add-product-1'))
    fireEvent.click(screen.getByTestId('add-product-1'))
    
    expect(screen.getByTestId('cart-count')).toHaveTextContent('2')
    expect(screen.getByTestId('cart-total')).toHaveTextContent('9.98')
    expect(screen.getByTestId('cart-items')).toHaveTextContent('Sourdough Bread:2')
  })

  it('removes a product from the cart', () => {
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    )
    
    // Add product first
    fireEvent.click(screen.getByTestId('add-product-1'))
    expect(screen.getByTestId('cart-count')).toHaveTextContent('1')
    
    // Then remove it
    fireEvent.click(screen.getByTestId('remove-product-1'))
    
    expect(screen.getByTestId('cart-count')).toHaveTextContent('0')
    expect(screen.getByTestId('cart-total')).toHaveTextContent('0.00')
    expect(screen.getByTestId('cart-items')).toHaveTextContent('')
  })

  it('updates product quantity directly', () => {
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    )
    
    // Add product first
    fireEvent.click(screen.getByTestId('add-product-1'))
    expect(screen.getByTestId('cart-count')).toHaveTextContent('1')
    
    // Set quantity to 5
    fireEvent.click(screen.getByTestId('set-quantity-5'))
    
    expect(screen.getByTestId('cart-count')).toHaveTextContent('5')
    expect(screen.getByTestId('cart-total')).toHaveTextContent('24.95')
    expect(screen.getByTestId('cart-items')).toHaveTextContent('Sourdough Bread:5')
  })

  it('decreases the quantity of a product', () => {
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    )
    
    // Add two of the same product
    fireEvent.click(screen.getByTestId('add-product-1'))
    fireEvent.click(screen.getByTestId('add-product-1'))
    expect(screen.getByTestId('cart-count')).toHaveTextContent('2')
    
    // Decrease by one
    fireEvent.click(screen.getByTestId('decrease-product-1'))
    
    expect(screen.getByTestId('cart-count')).toHaveTextContent('1')
    expect(screen.getByTestId('cart-total')).toHaveTextContent('4.99')
    expect(screen.getByTestId('cart-items')).toHaveTextContent('Sourdough Bread:1')
  })

  it('removes a product when updating quantity to zero', () => {
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    )
    
    // Add one product
    fireEvent.click(screen.getByTestId('add-product-1'))
    expect(screen.getByTestId('cart-count')).toHaveTextContent('1')
    
    // Decrease to zero using updateQuantity
    fireEvent.click(screen.getByTestId('decrease-product-1'))
    
    expect(screen.getByTestId('cart-count')).toHaveTextContent('0')
    expect(screen.getByTestId('cart-total')).toHaveTextContent('0.00')
    expect(screen.getByTestId('cart-items')).toHaveTextContent('')
  })

  it('clears the entire cart', () => {
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    )
    
    // Add multiple products
    fireEvent.click(screen.getByTestId('add-product-1'))
    fireEvent.click(screen.getByTestId('add-product-2'))
    expect(screen.getByTestId('cart-count')).toHaveTextContent('2')
    
    // Clear cart
    fireEvent.click(screen.getByTestId('clear-cart'))
    
    expect(screen.getByTestId('cart-count')).toHaveTextContent('0')
    expect(screen.getByTestId('cart-total')).toHaveTextContent('0.00')
    expect(screen.getByTestId('cart-items')).toHaveTextContent('')
  })

  it('calculates totals correctly with multiple items', () => {
    render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    )
    
    // Add 3 bread and 2 croissants
    fireEvent.click(screen.getByTestId('add-product-1'))
    fireEvent.click(screen.getByTestId('add-product-1'))
    fireEvent.click(screen.getByTestId('add-product-1'))
    fireEvent.click(screen.getByTestId('add-product-2'))
    fireEvent.click(screen.getByTestId('add-product-2'))
    
    expect(screen.getByTestId('cart-count')).toHaveTextContent('5')
    expect(screen.getByTestId('cart-total')).toHaveTextContent('21.95') // 3 * 4.99 + 2 * 3.49
    expect(screen.getByTestId('cart-items')).toHaveTextContent('Sourdough Bread:3,Chocolate Croissant:2')
  })

  it('handles negative quantity updates by removing the item', () => {
    const { unmount } = render(
      <CartProvider>
        <TestComponent />
      </CartProvider>
    )
    
    // Add product first
    fireEvent.click(screen.getByTestId('add-product-1'))
    expect(screen.getByTestId('cart-count')).toHaveTextContent('1')
    
    // Update to negative quantity (should remove item)
    const breadItem = screen.getByTestId('cart-items')
    expect(breadItem).toHaveTextContent('Sourdough Bread:1')
    
    // Unmount first component
    unmount()
    
    // Render component that tests negative quantity
    render(
      <CartProvider>
        <TestNegativeQuantityComponent />
      </CartProvider>
    )
    
    expect(screen.getByTestId('cart-count')).toHaveTextContent('0')
    expect(screen.getByTestId('cart-total')).toHaveTextContent('0.00')
    expect(screen.getByTestId('cart-items')).toHaveTextContent('')
  })
})

// Additional test component for edge cases
const TestNegativeQuantityComponent = () => {
  const { items, totalPrice, totalCount, addToCart, updateQuantity } = React.useContext(CartContext)
  
  React.useEffect(() => {
    // Add a product and then set negative quantity
    addToCart(mockProducts[0])
    updateQuantity(1, -1)
  }, [addToCart, updateQuantity])
  
  return (
    <div>
      <div data-testid="cart-count">{totalCount}</div>
      <div data-testid="cart-total">{totalPrice.toFixed(2)}</div>
      <div data-testid="cart-items">{items.map(item => `${item.name}:${item.quantity}`).join(',')}</div>
    </div>
  )
}
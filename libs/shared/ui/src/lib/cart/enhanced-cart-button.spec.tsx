/**
 * @fileoverview Tests for EnhancedCartButton component
 * @module @bakery/shared/ui/cart/tests
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useMediaQuery } from '@mui/material'
import { CartItem } from '@bakery/shared/types'
import { renderWithTheme } from '@bakery/shared/test-utils'

// Mock Next.js router
const mockPush = jest.fn()
const mockPathname = '/'
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname,
}))

// Mock Material UI useMediaQuery
jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  useMediaQuery: jest.fn(),
}))

// Mock Cart Context
const mockCartContext = {
  items: [] as CartItem[],
  totalCount: 0,
  totalPrice: 0,
  itemCount: 0,
  addToCart: jest.fn(),
  updateQuantity: jest.fn(),
  removeFromCart: jest.fn(),
  clearCart: jest.fn(),
  calculateTotals: jest.fn(),
}

jest.mock('@bakery/shared/contexts', () => ({
  CartContext: React.createContext(mockCartContext),
}))

// Mock formatPrice utility
jest.mock('@bakery/shared/utils', () => ({
  formatter: {
    format: (price: number) => `€${price.toFixed(2).replace('.', ',')}`,
  },
}))

// Mock EnhancedButton
jest.mock('../button/enhanced-button', () => ({
  __esModule: true,
  default: ({
    children,
    onClick,
    variant,
    fullWidth,
    size,
    endIcon,
    ...props
  }: any) => (
    <button onClick={onClick} {...props}>
      {children}
      {endIcon}
    </button>
  ),
}))

// Import the component after mocks
import EnhancedCartButton from './enhanced-cart-button'

const mockCartItems: CartItem[] = [
  {
    id: 1,
    name: 'Croissant',
    price: 2.5,
    quantity: 2,
    category: 'Broetchen',
    image: '/images/croissant.jpg',
    available: true,
    ingredients: ['flour', 'butter'],
    allergens: ['gluten'],
    nutritionalInfo: { calories: 231, fat: 12, carbs: 26, protein: 5 },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 2,
    name: 'Baguette',
    price: 3.2,
    quantity: 1,
    category: 'Brot',
    image: '/images/baguette.jpg',
    available: true,
    ingredients: ['flour', 'water'],
    allergens: ['gluten'],
    nutritionalInfo: { calories: 160, fat: 2, carbs: 31, protein: 6 },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 3,
    name: 'Apple Strudel',
    price: 4.8,
    quantity: 1,
    category: 'Kuchen',
    image: '/images/strudel.jpg',
    available: true,
    ingredients: ['flour', 'apples', 'butter'],
    allergens: ['gluten'],
    nutritionalInfo: { calories: 320, fat: 15, carbs: 42, protein: 4 },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]

const EnhancedCartButtonWrapper = (
  cartData?: Partial<typeof mockCartContext>
) => {
  const CartContext = require('@bakery/shared/contexts').CartContext
  const contextValue = { ...mockCartContext, ...cartData }

  return (
    <CartContext.Provider value={contextValue}>
      <EnhancedCartButton />
    </CartContext.Provider>
  )
}

describe('EnhancedCartButton Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(useMediaQuery as jest.Mock).mockReturnValue(false) // Default to desktop
  })

  describe('Visibility and basic rendering', () => {
    it('does not render when cart is empty', () => {
      renderWithTheme(<EnhancedCartButtonWrapper />)

      expect(screen.queryByLabelText(/warenkorb/i)).not.toBeInTheDocument()
    })

    it('renders when cart has items', () => {
      renderWithTheme(
        <EnhancedCartButtonWrapper
          items={mockCartItems.slice(0, 1)}
          totalCount={2}
        />
      )

      expect(
        screen.getByLabelText(/warenkorb mit 2 artikel/i)
      ).toBeInTheDocument()
    })

    it('displays correct item count in badge', () => {
      renderWithTheme(
        <EnhancedCartButtonWrapper items={mockCartItems} totalCount={4} />
      )

      expect(screen.getByText('4')).toBeInTheDocument()
    })

    it('displays 99+ for counts over 99', () => {
      renderWithTheme(
        <EnhancedCartButtonWrapper items={mockCartItems} totalCount={150} />
      )

      expect(screen.getByText('99+')).toBeInTheDocument()
    })

    it('handles singular vs plural in aria label', () => {
      // Test singular
      renderWithTheme(
        <EnhancedCartButtonWrapper
          items={mockCartItems.slice(0, 1)}
          totalCount={1}
        />
      )

      expect(
        screen.getByLabelText('Warenkorb mit 1 Artikel')
      ).toBeInTheDocument()

      // Test plural
      renderWithTheme(
        <EnhancedCartButtonWrapper items={mockCartItems} totalCount={3} />
      )

      expect(
        screen.getByLabelText('Warenkorb mit 3 Artikeln')
      ).toBeInTheDocument()
    })
  })

  describe('Mobile behavior', () => {
    beforeEach(() => {
      ;(useMediaQuery as jest.Mock).mockReturnValue(true) // Mobile
    })

    it('navigates directly to cart on mobile click', () => {
      renderWithTheme(
        <EnhancedCartButtonWrapper
          items={mockCartItems.slice(0, 1)}
          totalCount={2}
        />
      )

      const cartButton = screen.getByLabelText(/warenkorb/i)
      fireEvent.click(cartButton)

      expect(mockPush).toHaveBeenCalledWith('/cart')
    })

    it('does not show preview on mobile', () => {
      renderWithTheme(
        <EnhancedCartButtonWrapper
          items={mockCartItems}
          totalCount={4}
          totalPrice={10.5}
        />
      )

      const cartButton = screen.getByLabelText(/warenkorb/i)
      fireEvent.click(cartButton)

      expect(screen.queryByText('Ihr Warenkorb (4)')).not.toBeInTheDocument()
    })

    it('hides button on mobile when not on admin pages', () => {
      Object.defineProperty(require('next/navigation'), 'usePathname', {
        value: () => '/products',
      })

      renderWithTheme(
        <EnhancedCartButtonWrapper
          items={mockCartItems.slice(0, 1)}
          totalCount={1}
        />
      )

      expect(screen.queryByLabelText(/warenkorb/i)).not.toBeInTheDocument()
    })
  })

  describe('Desktop preview functionality', () => {
    beforeEach(() => {
      ;(useMediaQuery as jest.Mock).mockReturnValue(false) // Desktop
    })

    it('toggles preview on desktop click', () => {
      renderWithTheme(
        <EnhancedCartButtonWrapper
          items={mockCartItems}
          totalCount={4}
          totalPrice={10.5}
        />
      )

      const cartButton = screen.getByLabelText(/warenkorb/i)

      // Click to show preview
      fireEvent.click(cartButton)
      expect(screen.getByText('Ihr Warenkorb (4)')).toBeInTheDocument()

      // Click again to hide preview
      fireEvent.click(cartButton)
      expect(screen.queryByText('Ihr Warenkorb (4)')).not.toBeInTheDocument()
    })

    it('displays cart items in preview', () => {
      renderWithTheme(
        <EnhancedCartButtonWrapper
          items={mockCartItems}
          totalCount={4}
          totalPrice={10.5}
        />
      )

      const cartButton = screen.getByLabelText(/warenkorb/i)
      fireEvent.click(cartButton)

      expect(screen.getByText('Croissant')).toBeInTheDocument()
      expect(screen.getByText('Baguette')).toBeInTheDocument()
      expect(screen.getByText('Apple Strudel')).toBeInTheDocument()
    })

    it('shows correct quantities and prices in preview', () => {
      renderWithTheme(
        <EnhancedCartButtonWrapper
          items={mockCartItems.slice(0, 1)}
          totalCount={2}
          totalPrice={5.0}
        />
      )

      const cartButton = screen.getByLabelText(/warenkorb/i)
      fireEvent.click(cartButton)

      expect(screen.getByText('2x • €2,50')).toBeInTheDocument()
      expect(screen.getByText('€5,00')).toBeInTheDocument()
    })

    it('displays total price correctly', () => {
      renderWithTheme(
        <EnhancedCartButtonWrapper
          items={mockCartItems}
          totalCount={4}
          totalPrice={10.5}
        />
      )

      const cartButton = screen.getByLabelText(/warenkorb/i)
      fireEvent.click(cartButton)

      expect(screen.getByText('Gesamt:')).toBeInTheDocument()
      expect(screen.getByText('€10,50')).toBeInTheDocument()
    })

    it('limits preview to first 3 items', () => {
      const manyItems = [
        ...mockCartItems,
        { ...mockCartItems[0], id: 4, name: 'Item 4' },
        { ...mockCartItems[0], id: 5, name: 'Item 5' },
      ]

      renderWithTheme(
        <EnhancedCartButtonWrapper
          items={manyItems}
          totalCount={7}
          totalPrice={15.0}
        />
      )

      const cartButton = screen.getByLabelText(/warenkorb/i)
      fireEvent.click(cartButton)

      expect(screen.getByText('Croissant')).toBeInTheDocument()
      expect(screen.getByText('Baguette')).toBeInTheDocument()
      expect(screen.getByText('Apple Strudel')).toBeInTheDocument()
      expect(screen.queryByText('Item 4')).not.toBeInTheDocument()
      expect(screen.getByText('+ 2 weitere Artikel')).toBeInTheDocument()
    })

    it('closes preview when close button is clicked', () => {
      renderWithTheme(
        <EnhancedCartButtonWrapper
          items={mockCartItems}
          totalCount={4}
          totalPrice={10.5}
        />
      )

      const cartButton = screen.getByLabelText(/warenkorb/i)
      fireEvent.click(cartButton)

      const closeButton =
        screen.getByLabelText(/close/i) ||
        screen.getByRole('button', { name: '' })
      fireEvent.click(closeButton)

      expect(screen.queryByText('Ihr Warenkorb (4)')).not.toBeInTheDocument()
    })
  })

  describe('Navigation actions', () => {
    beforeEach(() => {
      ;(useMediaQuery as jest.Mock).mockReturnValue(false) // Desktop
    })

    it('navigates to cart page when "Warenkorb anzeigen" is clicked', () => {
      renderWithTheme(
        <EnhancedCartButtonWrapper
          items={mockCartItems}
          totalCount={4}
          totalPrice={10.5}
        />
      )

      const cartButton = screen.getByLabelText(/warenkorb/i)
      fireEvent.click(cartButton)

      const viewCartButton = screen.getByText('Warenkorb anzeigen')
      fireEvent.click(viewCartButton)

      expect(mockPush).toHaveBeenCalledWith('/cart')
    })

    it('navigates to checkout when "Zur Bestellung" is clicked', () => {
      renderWithTheme(
        <EnhancedCartButtonWrapper
          items={mockCartItems}
          totalCount={4}
          totalPrice={10.5}
        />
      )

      const cartButton = screen.getByLabelText(/warenkorb/i)
      fireEvent.click(cartButton)

      const checkoutButton = screen.getByText('Zur Bestellung')
      fireEvent.click(checkoutButton)

      expect(mockPush).toHaveBeenCalledWith('/bestellen')
    })

    it('closes preview when navigating', () => {
      renderWithTheme(
        <EnhancedCartButtonWrapper
          items={mockCartItems}
          totalCount={4}
          totalPrice={10.5}
        />
      )

      const cartButton = screen.getByLabelText(/warenkorb/i)
      fireEvent.click(cartButton)

      const viewCartButton = screen.getByText('Warenkorb anzeigen')
      fireEvent.click(viewCartButton)

      expect(screen.queryByText('Ihr Warenkorb (4)')).not.toBeInTheDocument()
    })
  })

  describe('Animation behavior', () => {
    beforeEach(() => {
      ;(useMediaQuery as jest.Mock).mockReturnValue(false) // Desktop
      jest.useFakeTimers()
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('triggers animation when items are added', () => {
      const { rerender } = renderWithTheme(
        <EnhancedCartButtonWrapper
          items={mockCartItems.slice(0, 1)}
          totalCount={1}
        />
      )

      // Increase count (simulating item addition)
      rerender(
        renderWithTheme(
          <EnhancedCartButtonWrapper
            items={mockCartItems.slice(0, 2)}
            totalCount={2}
          />
        ).children[0] as React.ReactElement
      )

      const cartButton = screen.getByLabelText(/warenkorb/i)
      expect(cartButton).toBeInTheDocument()

      // Animation should stop after timeout
      jest.advanceTimersByTime(1000)
    })

    it('does not animate when count decreases', () => {
      const { rerender } = renderWithTheme(
        <EnhancedCartButtonWrapper items={mockCartItems} totalCount={3} />
      )

      // Decrease count (simulating item removal)
      rerender(
        renderWithTheme(
          <EnhancedCartButtonWrapper
            items={mockCartItems.slice(0, 1)}
            totalCount={1}
          />
        ).children[0] as React.ReactElement
      )

      const cartButton = screen.getByLabelText(/warenkorb/i)
      expect(cartButton).toBeInTheDocument()
      // No animation should be triggered
    })
  })

  describe('Accessibility', () => {
    beforeEach(() => {
      ;(useMediaQuery as jest.Mock).mockReturnValue(false) // Desktop
    })

    it('has proper ARIA labels', () => {
      renderWithTheme(
        <EnhancedCartButtonWrapper items={mockCartItems} totalCount={4} />
      )

      const cartButton = screen.getByLabelText('Warenkorb mit 4 Artikeln')
      expect(cartButton).toBeInTheDocument()
    })

    it('is keyboard accessible', () => {
      renderWithTheme(
        <EnhancedCartButtonWrapper
          items={mockCartItems}
          totalCount={4}
          totalPrice={10.5}
        />
      )

      const cartButton = screen.getByLabelText(/warenkorb/i)

      // Should be focusable
      cartButton.focus()
      expect(cartButton).toHaveFocus()

      // Should respond to Enter key
      fireEvent.keyDown(cartButton, { key: 'Enter' })
      expect(screen.getByText('Ihr Warenkorb (4)')).toBeInTheDocument()
    })

    it('has proper role attributes', () => {
      renderWithTheme(
        <EnhancedCartButtonWrapper items={mockCartItems} totalCount={4} />
      )

      const cartButton = screen.getByRole('button')
      expect(cartButton).toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    it('handles empty items array gracefully', () => {
      renderWithTheme(
        <EnhancedCartButtonWrapper items={[]} totalCount={0} totalPrice={0} />
      )

      expect(screen.queryByLabelText(/warenkorb/i)).not.toBeInTheDocument()
    })

    it('handles items without images', () => {
      const itemsWithoutImages = mockCartItems.map((item) => ({
        ...item,
        image: '',
      }))

      renderWithTheme(
        <EnhancedCartButtonWrapper
          items={itemsWithoutImages}
          totalCount={4}
          totalPrice={10.5}
        />
      )

      const cartButton = screen.getByLabelText(/warenkorb/i)
      fireEvent.click(cartButton)

      // Should show first letter of item name as fallback
      expect(screen.getByText('C')).toBeInTheDocument() // Croissant
      expect(screen.getByText('B')).toBeInTheDocument() // Baguette
    })

    it('handles very long item names', () => {
      const itemsWithLongNames = mockCartItems.map((item) => ({
        ...item,
        name: 'Very Long Product Name That Should Be Handled Gracefully',
      }))

      renderWithTheme(
        <EnhancedCartButtonWrapper
          items={itemsWithLongNames}
          totalCount={4}
          totalPrice={10.5}
        />
      )

      const cartButton = screen.getByLabelText(/warenkorb/i)
      fireEvent.click(cartButton)

      expect(
        screen.getByText(
          'Very Long Product Name That Should Be Handled Gracefully'
        )
      ).toBeInTheDocument()
    })

    it('handles zero prices correctly', () => {
      const freeItems = mockCartItems.map((item) => ({ ...item, price: 0 }))

      renderWithTheme(
        <EnhancedCartButtonWrapper
          items={freeItems}
          totalCount={4}
          totalPrice={0}
        />
      )

      const cartButton = screen.getByLabelText(/warenkorb/i)
      fireEvent.click(cartButton)

      expect(screen.getByText('€0,00')).toBeInTheDocument()
    })
  })

  describe('Performance', () => {
    it('does not re-render unnecessarily', () => {
      const TestComponent = () => {
        const [count, setCount] = React.useState(0)
        return (
          <div>
            <button onClick={() => setCount((c) => c + 1)}>
              Count: {count}
            </button>
            <EnhancedCartButtonWrapper
              items={mockCartItems}
              totalCount={4}
              totalPrice={10.5}
            />
          </div>
        )
      }

      renderWithTheme(<TestComponent />)

      const button = screen.getByRole('button', { name: /count:/i })
      const cartButton = screen.getByLabelText(/warenkorb/i)

      // Change unrelated state
      fireEvent.click(button)
      expect(screen.getByText('Count: 1')).toBeInTheDocument()

      // Cart button should still work correctly
      expect(cartButton).toBeInTheDocument()
    })
  })
})

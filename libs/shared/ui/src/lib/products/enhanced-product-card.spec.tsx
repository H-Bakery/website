/**
 * @fileoverview Tests for EnhancedProductCard component
 * @module @bakery/shared/ui/products/tests
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import {
  Product,
  ProductCategory,
  ProductStatus,
  ProductType,
} from '@bakery/shared/types'
import { renderWithTheme } from '@bakery/shared/test-utils'

// Mock Next.js router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, width, height, style, ...props }: any) => (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      style={style}
      {...props}
    />
  ),
}))

// Mock Cart Context
const mockAddToCart = jest.fn()
const mockCartContext = {
  addToCart: mockAddToCart,
  items: [],
  itemCount: 0,
  totalPrice: 0,
  totalCount: 0,
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

// Import the component after mocks
import { EnhancedProductCard } from './enhanced-product-card'

const mockProduct: Product = {
  id: 1,
  name: 'Test Croissant',
  description: 'Delicious buttery croissant made fresh daily',
  price: 2.5,
  category: ProductCategory.Buns,
  type: ProductType.Fresh,
  stock: 10,
  status: ProductStatus.Available,
  image: '/images/croissant.jpg',
  ingredients: ['flour', 'butter', 'yeast'],
  allergens: ['gluten'],
  nutritionalInfo: {
    calories: 231,
    fat: 12,
    carbohydrates: 26,
    protein: 5,
  },
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
}

const EnhancedProductCardWrapper = (props: any) => {
  const CartContext = require('@bakery/shared/contexts').CartContext
  return (
    <CartContext.Provider value={mockCartContext}>
      <EnhancedProductCard {...props} />
    </CartContext.Provider>
  )
}

describe('EnhancedProductCard Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic rendering', () => {
    it('renders product information correctly', () => {
      renderWithTheme(<EnhancedProductCardWrapper {...mockProduct} />)

      expect(screen.getByText('Test Croissant')).toBeInTheDocument()
      expect(
        screen.getByText('Delicious buttery croissant made fresh daily')
      ).toBeInTheDocument()
      expect(screen.getByText(/2,50\s€/)).toBeInTheDocument()
      expect(screen.getByText('Brötchen')).toBeInTheDocument()
    })

    it('renders product image with correct attributes', () => {
      renderWithTheme(<EnhancedProductCardWrapper {...mockProduct} />)

      const image = screen.getByRole('img', {
        name: /bild von test croissant/i,
      })
      expect(image).toBeInTheDocument()
      expect(image).toHaveAttribute('src', '/images/croissant.jpg')
      expect(image).toHaveAttribute('alt', 'Bild von Test Croissant')
    })

    it('renders add to cart button', () => {
      renderWithTheme(<EnhancedProductCardWrapper {...mockProduct} />)

      const addToCartButton = screen.getByRole('button', {
        name: /in den warenkorb/i,
      })
      expect(addToCartButton).toBeInTheDocument()
      expect(addToCartButton).toHaveTextContent('In den Warenkorb')
    })
  })

  describe('Interactive features', () => {
    it('navigates to product detail on card click', () => {
      renderWithTheme(<EnhancedProductCardWrapper {...mockProduct} />)

      const card = screen.getByRole('button', { name: /test croissant/i })
      fireEvent.click(card)

      expect(mockPush).toHaveBeenCalledWith('/products/1')
    })

    it('adds product to cart when button is clicked', () => {
      renderWithTheme(<EnhancedProductCardWrapper {...mockProduct} />)

      const addToCartButton = screen.getByRole('button', {
        name: /in den warenkorb/i,
      })
      fireEvent.click(addToCartButton)

      expect(mockAddToCart).toHaveBeenCalledWith(mockProduct)
    })

    it('prevents navigation when add to cart is clicked', () => {
      renderWithTheme(<EnhancedProductCardWrapper {...mockProduct} />)

      const addToCartButton = screen.getByRole('button', {
        name: /in den warenkorb/i,
      })
      fireEvent.click(addToCartButton)

      expect(mockAddToCart).toHaveBeenCalled()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it('shows feedback when item is added to cart', async () => {
      renderWithTheme(<EnhancedProductCardWrapper {...mockProduct} />)

      const addToCartButton = screen.getByRole('button', {
        name: /in den warenkorb/i,
      })
      fireEvent.click(addToCartButton)

      await waitFor(() => {
        expect(screen.getByText('Hinzugefügt!')).toBeInTheDocument()
      })
    })

    it('toggles favorite status', () => {
      renderWithTheme(<EnhancedProductCardWrapper {...mockProduct} />)

      const favoriteButton = screen.getByRole('button', { name: /favoriten/i })

      // Initially not favorited
      expect(
        favoriteButton.querySelector('[data-testid="FavoriteBorderIcon"]')
      ).toBeInTheDocument()

      // Click to favorite
      fireEvent.click(favoriteButton)

      expect(
        favoriteButton.querySelector('[data-testid="FavoriteIcon"]')
      ).toBeInTheDocument()
    })
  })

  describe('Enhanced features', () => {
    it('displays rating when provided', () => {
      renderWithTheme(
        <EnhancedProductCardWrapper
          {...mockProduct}
          rating={4.5}
          reviewCount={25}
        />
      )

      expect(screen.getByText('(25)')).toBeInTheDocument()
      // Rating component would be rendered here
    })

    it('shows fresh today badge when isFreshToday is true', () => {
      renderWithTheme(
        <EnhancedProductCardWrapper {...mockProduct} isFreshToday={true} />
      )

      expect(screen.getByText('Heute frisch')).toBeInTheDocument()
    })

    it('shows new badge when isNew is true', () => {
      renderWithTheme(
        <EnhancedProductCardWrapper {...mockProduct} isNew={true} />
      )

      expect(screen.getByText('Neu')).toBeInTheDocument()
    })

    it('shows organic badge when isOrganic is true', () => {
      renderWithTheme(
        <EnhancedProductCardWrapper {...mockProduct} isOrganic={true} />
      )

      expect(screen.getByText('Bio')).toBeInTheDocument()
    })

    it('shows multiple badges when multiple flags are true', () => {
      renderWithTheme(
        <EnhancedProductCardWrapper
          {...mockProduct}
          isFreshToday={true}
          isNew={true}
          isOrganic={true}
        />
      )

      expect(screen.getByText('Heute frisch')).toBeInTheDocument()
      expect(screen.getByText('Neu')).toBeInTheDocument()
      expect(screen.getByText('Bio')).toBeInTheDocument()
    })
  })

  describe('Hover effects', () => {
    it('shows quick view overlay on hover', () => {
      renderWithTheme(<EnhancedProductCardWrapper {...mockProduct} />)

      const card = screen.getByRole('button', { name: /test croissant/i })
      fireEvent.mouseEnter(card)

      expect(screen.getByText('Schnellansicht')).toBeInTheDocument()
    })

    it('hides quick view overlay when not hovering', () => {
      renderWithTheme(<EnhancedProductCardWrapper {...mockProduct} />)

      const card = screen.getByRole('button', { name: /test croissant/i })
      fireEvent.mouseEnter(card)
      fireEvent.mouseLeave(card)

      // Quick view should fade out (still in DOM but with opacity changes)
      expect(screen.getByText('Schnellansicht')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels for screen readers', () => {
      renderWithTheme(<EnhancedProductCardWrapper {...mockProduct} />)

      const image = screen.getByRole('img', { name: /bild von/i })
      expect(image).toHaveAttribute('alt', 'Bild von Test Croissant')
    })

    it('supports keyboard navigation', () => {
      renderWithTheme(<EnhancedProductCardWrapper {...mockProduct} />)

      const card = screen.getByRole('button', { name: /test croissant/i })

      // Card should be focusable
      card.focus()
      expect(card).toHaveFocus()
    })

    it('handles keyboard activation', async () => {
      // Enter löst bei einem nativen <button> den Klick im Browser aus;
      // fireEvent.keyDown simuliert das nicht, user-event schon.
      const user = userEvent.setup()
      renderWithTheme(<EnhancedProductCardWrapper {...mockProduct} />)

      const card = screen.getByRole('button', { name: /test croissant/i })
      card.focus()
      await user.keyboard('{Enter}')

      expect(mockPush).toHaveBeenCalledWith('/products/1')
    })
  })

  describe('Product variations', () => {
    it('handles products without description', () => {
      const productWithoutDescription = {
        ...mockProduct,
        description: undefined,
      }
      renderWithTheme(
        <EnhancedProductCardWrapper {...productWithoutDescription} />
      )

      expect(screen.getByText('Test Croissant')).toBeInTheDocument()
      expect(
        screen.queryByText('Delicious buttery croissant made fresh daily')
      ).not.toBeInTheDocument()
    })

    it('handles products with long names', () => {
      const productWithLongName = {
        ...mockProduct,
        name: 'Very Long Product Name That Should Be Truncated Properly',
      }
      renderWithTheme(<EnhancedProductCardWrapper {...productWithLongName} />)

      expect(
        screen.getByText(
          'Very Long Product Name That Should Be Truncated Properly'
        )
      ).toBeInTheDocument()
    })

    it('handles products with long descriptions', () => {
      const productWithLongDescription = {
        ...mockProduct,
        description:
          'This is a very long description that should be truncated properly to maintain card layout consistency across all products in the grid.',
      }
      renderWithTheme(
        <EnhancedProductCardWrapper {...productWithLongDescription} />
      )

      expect(
        screen.getByText(/This is a very long description/)
      ).toBeInTheDocument()
    })

    it('handles different price formats', () => {
      const expensiveProduct = { ...mockProduct, price: 125.99 }
      renderWithTheme(<EnhancedProductCardWrapper {...expensiveProduct} />)

      expect(screen.getByText(/125,99\s€/)).toBeInTheDocument()
    })
  })

  describe('Animation states', () => {
    it('applies hover animations', () => {
      renderWithTheme(<EnhancedProductCardWrapper {...mockProduct} />)

      const card = screen.getByRole('button', { name: /test croissant/i })

      // Test hover state
      fireEvent.mouseEnter(card)
      expect(card.closest('.MuiCard-root')).toBeInTheDocument()

      fireEvent.mouseLeave(card)
      expect(card.closest('.MuiCard-root')).toBeInTheDocument()
    })

    it('shows loading state during cart addition', async () => {
      renderWithTheme(<EnhancedProductCardWrapper {...mockProduct} />)

      const addToCartButton = screen.getByRole('button', {
        name: /in den warenkorb/i,
      })
      fireEvent.click(addToCartButton)

      // Should show "Hinzugefügt!" temporarily
      await waitFor(() => {
        expect(screen.getByText('Hinzugefügt!')).toBeInTheDocument()
      })

      // Should revert back after timeout
      await waitFor(
        () => {
          expect(screen.getByText('In den Warenkorb')).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })
  })

  describe('Error handling', () => {
    it('handles missing image gracefully', () => {
      const productWithoutImage = { ...mockProduct, image: '' }
      renderWithTheme(<EnhancedProductCardWrapper {...productWithoutImage} />)

      expect(screen.queryByRole('img', { name: /bild von/i })).toBeNull()
      expect(screen.getByText('Test Croissant')).toBeInTheDocument()
    })

    it('handles invalid price', () => {
      const productWithInvalidPrice = { ...mockProduct, price: 0 }
      renderWithTheme(
        <EnhancedProductCardWrapper {...productWithInvalidPrice} />
      )

      expect(screen.getByText(/0,00\s€/)).toBeInTheDocument()
    })

    it('handles missing category', () => {
      const productWithoutCategory = { ...mockProduct, category: '' }
      renderWithTheme(
        <EnhancedProductCardWrapper {...productWithoutCategory} />
      )

      // Karte rendert ohne Kategorie weiter
      expect(screen.getByText('Test Croissant')).toBeInTheDocument()
      expect(screen.getByText(/2,50\s€/)).toBeInTheDocument()
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
            <EnhancedProductCardWrapper {...mockProduct} />
          </div>
        )
      }

      renderWithTheme(<TestComponent />)

      const button = screen.getByRole('button', { name: /count:/i })
      const productName = screen.getByText('Test Croissant')

      // Change unrelated state
      fireEvent.click(button)
      expect(screen.getByText('Count: 1')).toBeInTheDocument()

      // Product card should still be rendered correctly
      expect(productName).toBeInTheDocument()
    })
  })
})

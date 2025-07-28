import React from 'react'
import { Product } from '../types/product'

export interface CartItem extends Product {
  quantity: number
}

interface CartContextProps {
  items: CartItem[]
  totalPrice: number
  totalCount: number
  addToCart: (product: Product) => void
  removeFromCart: (id: number) => void
  updateQuantity: (id: number, quantity: number) => void
  clearCart: () => void
}

export const CartContext = React.createContext({} as CartContextProps)

interface Props {
  children: React.ReactNode
}

const CartProvider: React.FC<Props> = ({ children }) => {
  const [items, setItems] = React.useState<CartItem[]>([])

  // Calculate totals from items
  const totalCount = React.useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0)
  }, [items])

  const totalPrice = React.useMemo(() => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  }, [items])

  const addToCart = React.useCallback((product: Product) => {
    setItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id)
      
      if (existingItem) {
        // If item already exists, increase quantity
        return prevItems.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      } else {
        // Add new item with quantity 1
        return [...prevItems, { ...product, quantity: 1 }]
      }
    })
  }, [])

  const removeFromCart = React.useCallback((id: number) => {
    setItems(prevItems => prevItems.filter(item => item.id !== id))
  }, [])

  const updateQuantity = React.useCallback((id: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id)
      return
    }
    
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, quantity } : item
      )
    )
  }, [removeFromCart])

  const clearCart = React.useCallback(() => {
    setItems([])
  }, [])

  const value = React.useMemo(() => ({
    items,
    totalPrice,
    totalCount,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
  }), [items, totalPrice, totalCount, addToCart, removeFromCart, updateQuantity, clearCart])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export default CartProvider

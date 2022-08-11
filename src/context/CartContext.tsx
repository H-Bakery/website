import React from 'react'
import { Product } from '../components/products/types'
import { PRODUCTS } from '../mocks/products'

export interface CartItem extends Product {
  count: number
}

interface CartContextProps {
  items: CartItem[],
  setItems: (items: CartItem[]) => void
  add: (id: number) => void
  remove: (id: number) => void
  changeCount: (id: number, diff: number) => void
}

export const CartContext = React.createContext({} as CartContextProps)

interface Props {
  children: React.ReactNode
}

const CartProvider: React.FC<Props> = ({ children }) => {
  const [items, setItems] = React.useState<CartItem[]>([])

  const alreadyExists = (id: number): boolean => {
    let item = items.find(product => product.id === id)
    if (item) return true
    return false
  }

  const getCartItem = (id: number): CartItem => {
    return items.find(product => product.id === id) as CartItem
  }

  const getProduct = (id: number): CartItem => {
    return PRODUCTS.find(product => product.id === id)
  }

  const add = (id: number) => {
    if (!alreadyExists(id)) {
      setItems([
        ...items,
        {
          ...getProduct(id),
          count: 1
        }
      ])
    }
  }

  const remove = (id: number) => {
    setItems(
      items.filter(item => item.id !== id)
    )
  }
  
  const changeCount = (id: number, diff: number) => {
    const cartItem = getCartItem(id)
    const nextCartItem = {
      ...cartItem,
      count: cartItem ? cartItem.count + diff : 1
    }
    const index = items.map(object => object.id).indexOf(id)
    const nextItems = items.splice(index, 1, nextCartItem)
    
    setItems(nextItems)
  }

  const value = {
    items,
    setItems,
    add,
    remove,
    changeCount
  }

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  )
}

export default CartProvider
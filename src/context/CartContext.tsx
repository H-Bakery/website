import React from "react";
import { Product } from "../components/products/types";
import { PRODUCTS } from "../mocks/products";

export interface CartItem extends Product {
  count: number;
}

interface CartContextProps {
  items: CartItem[];
  totalPrice: number;
  totalCount: number;
  setItems: (items: CartItem[]) => void;
  add: (id: number) => void;
  remove: (id: number) => void;
  changeCount: (id: number, diff: number) => void;
}

export const CartContext = React.createContext({} as CartContextProps);

interface Props {
  children: React.ReactNode;
}

const CartProvider: React.FC<Props> = ({ children }) => {
  const [items, setItems] = React.useState<CartItem[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [totalPrice, setTotalPrice] = React.useState(0);

  const alreadyExists = (id: number): boolean => {
    let item = items.find((product) => product.id === id);
    if (item) return true;
    return false;
  };

  const getCartItem = (id: number): CartItem => {
    return items.find((product) => product.id === id) as CartItem;
  };

  const getProduct = (id: number): CartItem => {
    return PRODUCTS.find((product) => product.id === id);
  };

  const add = (id: number) => {
    let product = getProduct(id)
    if (!alreadyExists(id)) {
      setItems([
        ...items,
        {
          ...product,
          count: 1,
        },
      ]);
    } else {
      changeCount(id, 1)
    }
    setTotalCount(totalCount + 1)
    setTotalPrice(totalPrice + product.price)
  };

  const remove = (id: number) => {
    setItems(items.filter((item) => item.id !== id));
  };

  const changeCount = (id: number, diff: number) => {
    let newArray:CartItem[] = [];
    let newTotalCount = 0;
    let newTotalPrice = 0;
    items.forEach((item) => {
      if (item.id === id) {
        item.count = item.count + diff;
      }
      if (item.count > 0) {
        newArray.push(item);
        newTotalPrice = newTotalPrice + (item.count * item.price)
      }
      newTotalCount = newTotalCount + item.count
    });
    setItems(newArray);
    setTotalCount(newTotalCount);
    setTotalPrice(newTotalPrice);
  };

  const value = {
    totalPrice,
    items,
    totalCount,
    setItems,
    add,
    remove,
    changeCount,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export default CartProvider;

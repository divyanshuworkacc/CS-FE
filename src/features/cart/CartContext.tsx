import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { addToCart, loadCart } from '../../lib/cart'
import type { CartItem, Product } from '../../types'

const CART_KEY = 'common-shopping-bag-v1'

interface CartState {
  items: CartItem[]
  count: number
  isOpen: boolean
  notice: string
  setIsOpen: (open: boolean) => void
  replace: (items: CartItem[]) => void
  add: (product: Product) => void
  setNotice: (notice: string) => void
}

const CartContext = createContext<CartState | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadCart(CART_KEY))
  const [isOpen, setIsOpen] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)) }
    catch { /* Shopping still works without storage. */ }
  }, [items])
  useEffect(() => {
    if (!notice) return
    const timeout = setTimeout(() => setNotice(''), 4000)
    return () => clearTimeout(timeout)
  }, [notice])

  return <CartContext.Provider value={{
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    isOpen,
    notice,
    setIsOpen,
    replace: setItems,
    add: product => {
      setItems(previous => addToCart(previous, product))
      setNotice(`${product.name} added to your bag`)
    },
    setNotice,
  }}>{children}</CartContext.Provider>
}

export function useCart() {
  const cart = useContext(CartContext)
  if (!cart) throw new Error('CartProvider is missing')
  return cart
}

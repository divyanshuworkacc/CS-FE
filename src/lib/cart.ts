import type { CartItem, Product } from '../types'

// The API requires remaining stock to be strictly greater than the order.
export const purchasableQuantity = (product: Product) => Math.max(0, product.quantity - 1)
export const cartTotal = (items: CartItem[]) => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
export function addToCart(items: CartItem[], product: Product): CartItem[] {
  const existing = items.find(item => item.product.id === product.id)
  if ((existing?.quantity || 0) >= purchasableQuantity(product)) return items
  return existing
    ? items.map(item => item.product.id === product.id ? { product, quantity: item.quantity + 1 } : item)
    : [...items, { product, quantity: 1 }]
}
export function loadCart(key: string): CartItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || '[]')
    if (!Array.isArray(value)) return []
    return value.filter((item): item is CartItem => item && Number.isInteger(item.quantity) && item.quantity > 0
      && item.product && Number.isInteger(item.product.id) && Number.isInteger(item.product.tenant_id)
      && typeof item.product.name === 'string' && typeof item.product.category === 'string'
      && Number.isFinite(item.product.price) && item.product.price >= 0
      && Number.isInteger(item.product.quantity) && item.product.quantity > item.quantity)
  } catch { return [] }
}

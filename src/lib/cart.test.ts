import { describe, expect, it } from 'vitest'
import { addToCart, cartTotal, purchasableQuantity } from './cart'
import type { Product } from '../types'

const product: Product = { id: 1, tenant_id: 1, name: 'Canvas tote', category: 'Accessories', price: 25, quantity: 3 }
describe('shopping bag', () => {
  it('respects the API rule reserving the last stock unit', () => {
    expect(purchasableQuantity(product)).toBe(2)
    expect(purchasableQuantity({ ...product, quantity: 1 })).toBe(0)
    const items = addToCart(addToCart([], product), product)
    expect(addToCart(items, product)).toEqual(items)
    expect(items[0].quantity).toBe(2)
  })
  it('never adds unavailable products', () => {
    expect(addToCart([], { ...product, quantity: 0 })).toEqual([])
  })
  it('combines repeat additions and totals quantities', () => {
    const items = addToCart(addToCart([], product), product)
    expect(items).toHaveLength(1)
    expect(cartTotal(items)).toBe(50)
  })
  it('does not merge different products or stores', () => {
    const items = addToCart(addToCart([], product), { ...product, id: 2, tenant_id: 2 })
    expect(items).toHaveLength(2)
  })
})

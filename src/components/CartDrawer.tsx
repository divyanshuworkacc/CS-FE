import { useState } from 'react'
import { ArrowRight, Minus, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { allPages, api, errorMessage, tenantPath } from '../lib/api'
import { cartTotal, purchasableQuantity } from '../lib/cart'
import { money } from '../lib/format'
import type { CartItem, Order, Product, Tenant } from '../types'
import { EmptyState, ErrorNotice, Modal } from './ui'
import { ProductArt } from './ProductCard'

export function CartDrawer({ tenant, items, replace, close, ordered }: {
  tenant: Tenant; items: CartItem[]; replace: (items: CartItem[]) => void; close: () => void; ordered: (order: Order) => void
}) {
  const auth = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  function quantity(id: number, delta: number) {
    replace(items.map(item => item.product.id === id ? { ...item, quantity: Math.min(purchasableQuantity(item.product), item.quantity + delta) } : item)
      .filter(item => item.quantity > 0))
  }
  async function checkout() {
    if (busy) return
    setBusy(true); setError('')
    try {
      // Recheck persisted cart entries against the server before placing an order.
      const latest = await allPages<Product>(tenantPath(tenant.name, 'products'))
      const refreshed = items.flatMap(item => {
        const product = latest.find(product => product.id === item.product.id)
        if (!product || !purchasableQuantity(product)) return []
        return [{ product, quantity: Math.min(item.quantity, purchasableQuantity(product)) }]
      })
      const changed = refreshed.length !== items.length || refreshed.some((item, index) =>
        item.quantity !== items[index].quantity || item.product.price !== items[index].product.price)
      replace(refreshed)
      if (changed) throw new Error('Availability or prices changed. Your bag has been updated; please review it before placing your order.')
      if (!refreshed.length) throw new Error('Your bag is empty.')
      const order = await api<Order>(tenantPath(tenant.name, 'orders'), {
        method: 'POST', body: JSON.stringify({ order_items: refreshed.map(item => ({ product_id: item.product.id, quantity: item.quantity })) }),
      }, true)
      replace([]); ordered(order)
    } catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
  }
  return <Modal title="Your shopping bag" close={() => { if (!busy) close() }} drawer>
    <p className="text-sm text-stone-500 mb-7">Good finds from <strong className="text-stone-800">{tenant.name}</strong></p>
    {error && <ErrorNotice>{error}</ErrorNotice>}
    {!items.length ? <EmptyState title="Room for something good" action={<button className="button-primary mt-5" onClick={close}>Explore the collection <ArrowRight size={17} /></button>}>Your bag is waiting for its first find.</EmptyState>
      : <><div className="cart-list">{items.map(item => <div className="cart-line" key={item.product.id}>
        <ProductArt product={item.product} small /><div className="flex-1 min-w-0"><h3 className="font-semibold">{item.product.name}</h3>
          <p className="text-sm text-stone-500 mt-1">{money(item.product.price)} each</p>
          <div className="quantity-control"><button disabled={busy} aria-label={`Decrease ${item.product.name} quantity`} onClick={() => quantity(item.product.id, -1)}><Minus size={13} /></button>
            <span>{item.quantity}</span><button disabled={busy || item.quantity >= purchasableQuantity(item.product)} aria-label={`Increase ${item.product.name} quantity`} onClick={() => quantity(item.product.id, 1)}><Plus size={13} /></button>
          </div></div><div className="flex flex-col items-end justify-between"><span className="font-semibold text-sm">{money(item.product.price * item.quantity)}</span>
          <button className="icon-button" disabled={busy} aria-label={`Remove ${item.product.name} from bag`} onClick={() => replace(items.filter(entry => entry.product.id !== item.product.id))}><Trash2 size={16} /></button>
        </div></div>)}</div>
        <div className="cart-summary"><div className="flex justify-between"><span>Order total</span><strong>{money(cartTotal(items))}</strong></div>
          <p className="text-xs text-stone-500 mt-3 mb-5">This places an order with the store. No online payment is collected.</p>
          {!auth.authenticated ? <button className="button-primary w-full justify-center" disabled={auth.checking} onClick={() => void auth.login()}>Sign in to order <ArrowRight size={17} /></button>
            : !auth.profile ? <p className="text-sm text-stone-600">Complete your account setup before placing an order.</p>
            : <button className="button-primary w-full justify-center" onClick={() => void checkout()} disabled={busy}>{busy ? 'Placing your order…' : 'Place order'}<ArrowRight size={17} /></button>}
          <div className="flex justify-center gap-2 items-center text-xs text-stone-500 mt-4"><ShieldCheck size={15} />Account protected by Keycloak</div>
        </div></>}
  </Modal>
}

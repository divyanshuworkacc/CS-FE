import { useState } from 'react'
import { ArrowRight, Minus, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { allPages, api, errorMessage, tenantPath } from '../lib/api'
import { cartTotal, purchasableQuantity } from '../lib/cart'
import { money } from '../lib/format'
import type { CartItem, MarketplaceOrderCreate, Order, Product, Tenant } from '../types'
import { EmptyState, ErrorNotice, Modal } from './ui'
import { ProductArt } from './ProductCard'

export function CartDrawer({ tenants, items, replace, close, ordered }: {
  tenants: Tenant[]; items: CartItem[]; replace: (items: CartItem[]) => void; close: () => void; ordered: (orders: Order[]) => void
}) {
  const auth = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [address, setAddress] = useState('')
  const tenantNames = new Map(tenants.map(tenant => [tenant.id, tenant.name]))
  const brandCount = new Set(items.map(item => item.product.tenant_id)).size
  function quantity(id: number, delta: number) {
    replace(items.map(item => item.product.id === id ? { ...item, quantity: Math.min(purchasableQuantity(item.product), item.quantity + delta) } : item)
      .filter(item => item.quantity > 0))
  }
  async function checkout() {
    if (busy) return
    setBusy(true); setError('')
    try {
      // Refresh each brand's catalog, then submit one marketplace checkout.
      const tenantIds = [...new Set(items.map(item => item.product.tenant_id))]
      const catalogs = await Promise.all(tenantIds.map(async tenantId => {
        const tenantName = tenantNames.get(tenantId)
        if (!tenantName) return []
        return allPages<Product>(tenantPath(tenantName, 'products'))
      }))
      const latest = new Map(catalogs.flat().map(product => [product.id, product]))
      const refreshed = items.flatMap(item => {
        const product = latest.get(item.product.id)
        if (!product || !purchasableQuantity(product)) return []
        return [{ product, quantity: Math.min(item.quantity, purchasableQuantity(product)) }]
      })
      const refreshedById = new Map(refreshed.map(item => [item.product.id, item]))
      const changed = refreshed.length !== items.length || items.some(item => {
        const latestItem = refreshedById.get(item.product.id)
        return !latestItem || latestItem.quantity !== item.quantity || latestItem.product.price !== item.product.price
      })
      replace(refreshed)
      if (changed) throw new Error('Availability or prices changed. Your bag has been updated; please review it before placing your order.')
      if (!refreshed.length) throw new Error('Your bag is empty.')
      const checkout: MarketplaceOrderCreate = {
        address: address.trim(),
        order_items: refreshed.map(item => ({ product_id: item.product.id, quantity: item.quantity })),
      }
      const orders = await api<Order[]>('/orders', {
        method: 'POST', body: JSON.stringify(checkout),
      }, true)
      replace([]); ordered(orders)
    } catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
  }
  return <Modal title="Your shopping bag" close={() => { if (!busy) close() }} drawer>
    <p className="text-sm text-stone-500 mb-7">Your picks from {brandCount} {brandCount === 1 ? 'brand' : 'brands'}</p>
    {error && <ErrorNotice>{error}</ErrorNotice>}
    {!items.length ? <EmptyState title="Room for something good" action={<button className="button-primary mt-5" onClick={close}>Explore the collection <ArrowRight size={17} /></button>}>Your bag is waiting for its first find.</EmptyState>
      : <><div className="cart-list">{items.map(item => <div className="cart-line" key={item.product.id}>
        <ProductArt product={item.product} small /><div className="flex-1 min-w-0"><h3 className="font-semibold">{item.product.name}</h3>
          <p className="text-sm text-stone-500 mt-1">{tenantNames.get(item.product.tenant_id) || `Brand #${item.product.tenant_id}`} · {money(item.product.price)} each</p>
          <div className="quantity-control"><button disabled={busy} aria-label={`Decrease ${item.product.name} quantity`} onClick={() => quantity(item.product.id, -1)}><Minus size={13} /></button>
            <span>{item.quantity}</span><button disabled={busy || item.quantity >= purchasableQuantity(item.product)} aria-label={`Increase ${item.product.name} quantity`} onClick={() => quantity(item.product.id, 1)}><Plus size={13} /></button>
          </div></div><div className="flex flex-col items-end justify-between"><span className="font-semibold text-sm">{money(item.product.price * item.quantity)}</span>
          <button className="icon-button" disabled={busy} aria-label={`Remove ${item.product.name} from bag`} onClick={() => replace(items.filter(entry => entry.product.id !== item.product.id))}><Trash2 size={16} /></button>
        </div></div>)}</div>
        <div className="cart-summary"><div className="flex justify-between"><span>Order total</span><strong>{money(cartTotal(items))}</strong></div>
          <p className="text-xs text-stone-500 mt-3 mb-5">One checkout places an order with each brand in your bag. No online payment is collected.</p>
          <label className="field mb-5">Delivery address<textarea aria-label="Delivery address" value={address} onChange={event => setAddress(event.target.value)} required maxLength={500} rows={3} /></label>
          {!auth.authenticated ? <button className="button-primary w-full justify-center" disabled={auth.checking} onClick={() => void auth.login()}>Sign in to order <ArrowRight size={17} /></button>
            : !auth.profile ? <p className="text-sm text-stone-600">Complete your account setup before placing an order.</p>
            : <button className="button-primary w-full justify-center" onClick={() => void checkout()} disabled={busy || !address.trim()}>{busy ? 'Placing your order…' : 'Place order'}<ArrowRight size={17} /></button>}
          <div className="flex justify-center gap-2 items-center text-xs text-stone-500 mt-4"><ShieldCheck size={15} />Account protected by Keycloak</div>
        </div></>}
  </Modal>
}

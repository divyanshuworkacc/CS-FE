import { useEffect, useState } from 'react'
import { ArrowUpRight, Check, Package } from 'lucide-react'
import { allPages, errorMessage } from '../lib/api'
import { money } from '../lib/format'
import type { Order, Product, Tenant } from '../types'
import { EmptyState, ErrorNotice, Loading, SectionHeading } from '../components/ui'

type OrderRow = Order & { brandName: string; productNames: Record<number, string> }

export function Orders({ revision, retry, shop }: { revision: number; retry: () => void; shop: () => void }) {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')

    async function load() {
      try {
        const [orderRows, brands] = await Promise.all([
          allPages<Order>('/orders', true, controller.signal),
          allPages<Tenant>('/tenants', false, controller.signal),
        ])
        const productsByBrand = await Promise.all(brands.map(async brand => {
          try {
            const products = await allPages<Product>(`/${encodeURIComponent(brand.name)}/products`, false, controller.signal)
            return [brand.id, products] as const
          } catch {
            return [brand.id, []] as const
          }
        }))
        const brandNames = new Map(brands.map(brand => [brand.id, brand.name]))
        const productNames = new Map<number, Record<number, string>>()
        for (const [brandId, products] of productsByBrand) {
          productNames.set(brandId, Object.fromEntries(products.map(product => [product.id, product.name])))
        }
        if (!controller.signal.aborted) {
          setOrders(orderRows.map(order => ({
            ...order,
            brandName: brandNames.get(order.tenant_id) || `Brand #${order.tenant_id}`,
            productNames: productNames.get(order.tenant_id) || {},
          })))
        }
      } catch (reason) {
        if (!controller.signal.aborted) setError(errorMessage(reason))
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [revision])

  return <section>
    <SectionHeading eyebrow="YOUR PURCHASES" title="Order history">
      <button className="button-secondary" onClick={shop}>Keep exploring <ArrowUpRight size={17} /></button>
    </SectionHeading>
    {error ? <ErrorNotice retry={retry}>{error}</ErrorNotice> : loading ? <Loading />
      : !orders.length ? <EmptyState title="No orders yet">Orders from every brand will appear here.</EmptyState>
        : <div className="orders-list">{orders.map(order => <article className="order-card" key={order.id}>
          <div className="order-top">
            <span className="order-icon"><Package size={22} /></span>
            <div className="flex-1"><h2>Order #{String(order.id).padStart(4, '0')}</h2><p>{order.total_quantity} {order.total_quantity === 1 ? 'item' : 'items'} · {order.brandName}</p></div>
            <span className="order-status"><Check size={14} /> Placed</span><strong>{money(order.amount)}</strong>
          </div>
          <div className="order-items"><p className="text-stone-500 break-words">Delivery address: {order.address}</p>{order.order_items.map(item => <div className="flex justify-between gap-4" key={item.id}>
            <span>{order.productNames[item.product_id] || `Product #${item.product_id}`}</span><span className="text-stone-500">Qty {item.quantity}</span>
          </div>)}</div>
        </article>)}</div>}
  </section>
}

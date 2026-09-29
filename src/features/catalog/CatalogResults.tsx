import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { ProductCard } from '../../components/ProductCard'
import type { CartItem, Product, Tenant } from '../../types'

export function CatalogResults({
  products,
  tenants,
  selectedBrandId,
  favourites,
  cartItems,
  authChecking,
  onFavouriteChange,
  emptyState,
  onAdd,
  onDecrease,
  showPagination,
  page,
  hasMore,
  loading,
  onPrevious,
  onNext,
}: {
  products: Product[]
  tenants: Tenant[]
  selectedBrandId: number | 'all'
  favourites: Product[]
  cartItems: CartItem[]
  authChecking: boolean
  onFavouriteChange: () => void
  emptyState?: ReactNode
  onAdd: (product: Product) => void
  onDecrease: (product: Product) => void
  showPagination: boolean
  page: number
  hasMore: boolean
  loading: boolean
  onPrevious: () => void
  onNext: () => void
}) {
  return <>
    {products.length ? <div className="product-grid">{products.map(product => <ProductCard key={product.id}
      product={product}
      tenantName={selectedBrandId === 'all' ? tenants.find(brand => brand.id === product.tenant_id)?.name : undefined}
      favourite={favourites.some(item => item.id === product.id)}
      authChecking={authChecking}
      onFavouriteChange={onFavouriteChange}
      inCart={cartItems.find(item => item.product.id === product.id)?.quantity || 0}
      onAdd={onAdd}
      onDecrease={onDecrease} />)}</div> : emptyState}
    {showPagination && (page > 0 || hasMore) && <nav className="pagination-controls" aria-label="Product pages">
      <button className="button-secondary" onClick={onPrevious} disabled={page === 0 || loading}>
        <ArrowLeft size={12} />Previous
      </button>
      <span aria-live="polite">Page {page + 1}</span>
      <button className="button-secondary" onClick={onNext} disabled={!hasMore || loading}>
        Next<ArrowRight size={12} />
      </button>
    </nav>}
  </>
}

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { ProductCard } from '../../components/ProductCard'
import { EmptyState, ErrorNotice, Loading, SectionHeading, SignInPrompt } from '../../components/ui'
import { useCart } from '../cart/CartContext'
import { useStore } from '../../app/store-context'
import { useCollection } from '../../hooks/useCollection'
import { api, errorMessage, tenantPath } from '../../lib/api'
import { purchasableQuantity } from '../../lib/cart'
import type { Product } from '../../types'

const PAGE_SIZE = 8
type CatalogMode = 'discover' | 'favourites'
type ProductSort = 'featured' | 'price-low' | 'price-high' | 'name'

export function CatalogPage({ mode }: { mode: CatalogMode }) {
  const auth = useAuth()
  const cart = useCart()
  const store = useStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [backendQuery, setBackendQuery] = useState('')
  const [category, setCategory] = useState('All finds')
  const [sort, setSort] = useState<ProductSort>('featured')
  const [productPage, setProductPage] = useState(0)
  const [favouriteBusy, setFavouriteBusy] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')

  const productFilters = {
    ...(mode === 'discover' && backendQuery ? { search: backendQuery } : {}),
    ...(mode === 'discover' && category !== 'All finds' ? { category } : {}),
    sort,
  }
  const filterQuery = new URLSearchParams(productFilters).toString()
  const productPath = mode !== 'discover' ? null
    : store.selectedBrandId === 'all' ? `/products?${filterQuery}`
      : store.selectedBrand ? tenantPath(store.selectedBrand.name, 'products', productFilters) : null
  const products = useCollection<Product>(productPath, false, store.revision,
    mode === 'discover' ? { skip: productPage * PAGE_SIZE, limit: PAGE_SIZE } : undefined)
  const favouritePath = auth.profile
    ? mode === 'favourites' ? `/favourites?${new URLSearchParams({ sort })}` : '/favourites'
    : null
  const favourites = useCollection<Product>(favouritePath, true, store.revision)

  useEffect(() => {
    setQuery('')
    setBackendQuery('')
    setCategory('All finds')
    setProductPage(0)
  }, [mode, store.selectedBrandId])
  useEffect(() => {
    const timeout = setTimeout(() => setBackendQuery(query.trim()), 300)
    return () => clearTimeout(timeout)
  }, [query])

  const source = mode === 'favourites'
    ? favourites.data.filter(product => store.selectedBrandId === 'all' || product.tenant_id === store.selectedBrandId)
    : products.data
  const categories = ['All finds', ...new Set(source.map(product => product.category).sort())]
  const visible = source.filter(product => (category === 'All finds' || product.category === category)
    && (mode !== 'favourites' || `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase().trim())))
  const loading = store.loadingTenants || products.loading || (mode === 'favourites' && favourites.loading)
  const error = store.tenantsError || products.error || (mode === 'favourites' ? favourites.error : '')

  async function toggleFavourite(product: Product) {
    if (!auth.authenticated) { await auth.login(); return }
    if (!auth.profile) { setActionError('Finish your account setup to save favourites.'); return }
    if (favouriteBusy !== null) return
    setFavouriteBusy(product.id)
    setActionError('')
    try {
      await api(`/favourites/${product.id}`, { method: 'POST' }, true)
      cart.setNotice(favourites.data.some(item => item.id === product.id)
        ? 'Removed from favourites' : 'Saved to your favourites')
      store.refresh()
    } catch (reason) {
      setActionError(errorMessage(reason))
    } finally {
      setFavouriteBusy(null)
    }
  }

  if (mode === 'favourites' && !auth.profile && !auth.needsProfile) {
    return <section className="collection"><SignInPrompt action={() => void (auth.authenticated ? auth.reloadProfile() : auth.login())} /></section>
  }
  if (mode === 'favourites' && auth.needsProfile) {
    return <section className="collection"><EmptyState title="Create your customer account">Finish the account setup above, then save products here.</EmptyState></section>
  }

  return <>
    {mode === 'discover' && <section className="mb-8">
      <p className="eyebrow">SHOP</p>
      <h1 className="text-3xl font-semibold">Products from every brand</h1>
      <p className="mt-2 text-stone-600">Browse one brand or discover products from every store.</p>
    </section>}
    {actionError && <div className="mb-5"><ErrorNotice>{actionError}</ErrorNotice></div>}
    <section id="collection" className="collection">
      <SectionHeading eyebrow={mode === 'favourites' ? 'THE ONES YOU LOVE' : 'A LITTLE SOMETHING FOR YOU'}
        title={mode === 'favourites' ? 'Good taste. Saved.' : 'Find your everyday favourites.'}>
        <span className="collection-count">{mode === 'discover'
          ? `Page ${productPage + 1} · ${source.length} shown`
          : `${source.length} ${source.length === 1 ? 'find' : 'finds'} to explore`}<ArrowDown size={14} /></span>
      </SectionHeading>
      <div className="collection-tools">
        <div className="search-field"><Search size={18} />
          <input aria-label="Search products" placeholder="Search for something good…" value={query}
            onChange={event => { setQuery(event.target.value); setProductPage(0) }} />
          {query && <button aria-label="Clear search" onClick={() => { setQuery(''); setProductPage(0) }}><X size={16} /></button>}
        </div>
        <label className="sort-field"><SlidersHorizontal size={16} /><span className="sr-only">Sort products</span>
          <select aria-label="Sort products" value={sort} onChange={event => {
            setSort(event.target.value as ProductSort)
            setProductPage(0)
          }}>
            <option value="featured">Featured finds</option>
            <option value="price-low">Price: low to high</option>
            <option value="price-high">Price: high to low</option>
            <option value="name">Name: A to Z</option>
          </select>
        </label>
      </div>
      <div className="category-tabs" aria-label="Product categories">
        {categories.map(item => <button key={item} className={category === item ? 'active' : ''}
          onClick={() => { setCategory(item); setProductPage(0) }} aria-pressed={category === item}>
          {item === 'All finds' && <Sparkles size={14} />}{item}
        </button>)}
      </div>
      {error ? <ErrorNotice retry={store.refresh}>{error}</ErrorNotice> : loading ? <Loading />
        : visible.length ? <div className="product-grid">{visible.map(product => <ProductCard key={product.id}
          product={product}
          tenantName={store.selectedBrandId === 'all' ? store.tenants.find(brand => brand.id === product.tenant_id)?.name : undefined}
          favourite={favourites.data.some(item => item.id === product.id)}
          inCart={cart.items.find(item => item.product.id === product.id)?.quantity || 0}
          favouriteBusy={favouriteBusy !== null || auth.checking}
          onFavourite={() => void toggleFavourite(product)}
          onAdd={() => { if (purchasableQuantity(product)) cart.add(product) }} />)}</div>
          : <EmptyState title={query || category !== 'All finds' ? 'No finds just yet'
            : mode === 'favourites' ? 'A place for your favourites' : 'Good things are on their way.'}
            action={query || category !== 'All finds' ? <button className="button-secondary mt-5"
              onClick={() => { setQuery(''); setCategory('All finds'); setProductPage(0) }}>Clear filters</button>
              : auth.profile && mode === 'discover' ? <button className="button-primary mt-5" onClick={() => navigate('/manage')}>
                Stock your store<ArrowRight size={17} />
              </button> : undefined}>
            {query || category !== 'All finds' ? 'Try a different search or explore another category.'
              : mode === 'favourites' ? 'Tap the heart on a product to keep it here. Your favourites are saved across brands.'
                : store.selectedBrandId === 'all' ? 'There are no products across the stores yet.'
                  : store.selectedBrand ? `${store.selectedBrand.name} is getting its collection ready. Check back soon to discover something new.`
                    : 'The first store is getting ready. An administrator can create it from Manage store.'}
          </EmptyState>}
      {mode === 'discover' && (productPage > 0 || products.hasMore) && <nav className="pagination-controls" aria-label="Product pages">
        <button className="button-secondary" onClick={() => setProductPage(page => Math.max(0, page - 1))}
          disabled={productPage === 0 || loading}><ArrowLeft size={16} />Previous</button>
        <span aria-live="polite">Page {productPage + 1}</span>
        <button className="button-secondary" onClick={() => setProductPage(page => page + 1)}
          disabled={!products.hasMore || loading}>Next<ArrowRight size={16} /></button>
      </nav>}
    </section>
  </>
}

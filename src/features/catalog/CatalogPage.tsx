import { useEffect, useState } from 'react'
import { ArrowDown, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { EmptyState, ErrorNotice, Loading, SectionHeading, SignInPrompt } from '../../components/ui'
import { useCart } from '../cart/CartContext'
import { useStore } from '../../app/store-context'
import { useCollection } from '../../hooks/useCollection'
import { errorMessage, fetchCategories, tenantPath } from '../../lib/api'
import { purchasableQuantity } from '../../lib/cart'
import type { Product } from '../../types'
import { CatalogResults } from './CatalogResults'
import { CatalogToolbar, type CatalogSort } from './CatalogToolbar'

const PAGE_SIZE = 8
type CatalogMode = 'discover' | 'favourites'

export function CatalogPage({ mode }: { mode: CatalogMode }) {
  const auth = useAuth()
  const cart = useCart()
  const store = useStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [backendQuery, setBackendQuery] = useState('')
  const [category, setCategory] = useState('All finds')
  const [sort, setSort] = useState<CatalogSort>('featured')
  const [productPage, setProductPage] = useState(0)
  const [favouritesRevision, setFavouritesRevision] = useState(0)
  const [categories, setCategories] = useState<string[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [categoriesError, setCategoriesError] = useState('')

  const productFilters = {
    ...(backendQuery ? { search: backendQuery } : {}),
    ...(category !== 'All finds' ? { category } : {}),
    sort,
  }
  const filterQuery = new URLSearchParams(productFilters).toString()
  const favouriteFilters = {
    ...productFilters,
    ...(store.selectedBrand ? { tenant_name: store.selectedBrand.name } : {}),
  }
  const productPath = mode === 'favourites'
    ? auth.profile ? `/favourites?${new URLSearchParams(favouriteFilters)}` : null
    : store.selectedBrandId === 'all' ? `/products?${filterQuery}`
      : store.selectedBrand ? tenantPath(store.selectedBrand.name, 'products', productFilters) : null
  const products = useCollection<Product>(productPath, mode === 'favourites',
    store.revision + (mode === 'favourites' ? favouritesRevision : 0),
    { skip: productPage * PAGE_SIZE, limit: PAGE_SIZE })
  const favouritePath = auth.profile && mode === 'discover' ? '/favourites' : null
  const favourites = useCollection<Product>(favouritePath, true,
    store.revision + (mode === 'discover' ? favouritesRevision : 0))

  useEffect(() => {
    const controller = new AbortController()
    setCategoriesError('')
    setCategoriesLoading(true)
    fetchCategories(store.selectedBrand?.name, controller.signal).then(setCategories)
      .catch(error => {
        if (!controller.signal.aborted) setCategoriesError(errorMessage(error))
      })
      .finally(() => { if (!controller.signal.aborted) setCategoriesLoading(false) })
    return () => controller.abort()
  }, [store.selectedBrand?.name, store.revision])

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

  const source = products.data
  const categoryOptions = ['All finds', ...categories]
  const visible = source
  const hasMore = products.hasMore
  const loading = store.loadingTenants || categoriesLoading || (products.loading && products.data.length === 0)
  const error = store.tenantsError || products.error || categoriesError || (mode === 'discover' ? favourites.error : '')

  if (mode === 'favourites' && !auth.profile) {
    return <section className="collection"><SignInPrompt action={() => void (auth.authenticated ? auth.reloadProfile() : auth.login())} /></section>
  }

  return <>
    {mode === 'discover' && <section className="mb-8">
      <p className="eyebrow">SHOP</p>
      <h1 className="text-3xl font-semibold">Products from every brand</h1>
      <p className="mt-2 text-stone-600">Browse one brand or discover products from every store.</p>
    </section>}
    <section id="collection" className="collection">
      <SectionHeading eyebrow={mode === 'favourites' ? 'THE ONES YOU LOVE' : 'A LITTLE SOMETHING FOR YOU'}
        title={mode === 'favourites' ? 'Good taste. Saved.' : 'Find your everyday favourites.'}>
        <span className="collection-count">{`Page ${productPage + 1} · ${visible.length} shown`}<ArrowDown size={14} /></span>
      </SectionHeading>
      <CatalogToolbar query={query} onQueryChange={value => { setQuery(value); setProductPage(0) }}
        sort={sort} onSortChange={value => { setSort(value); setProductPage(0) }}
        categories={categoryOptions} category={category} onCategoryChange={value => { setCategory(value); setProductPage(0) }} />
      {error ? <ErrorNotice retry={store.refresh}>{error}</ErrorNotice> : loading ? <Loading />
        : <CatalogResults products={visible} tenants={store.tenants}
          selectedBrandId={store.selectedBrandId} favourites={mode === 'favourites' ? products.data : favourites.data} cartItems={cart.items}
          authChecking={auth.checking} onFavouriteChange={() => setFavouritesRevision(value => value + 1)}
          emptyState={visible.length ? undefined : <EmptyState title={query || category !== 'All finds' ? 'No finds just yet'
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
          onAdd={product => { if (purchasableQuantity(product)) cart.add(product) }}
          onDecrease={product => cart.replace(cart.items.flatMap(item => item.product.id !== product.id
            ? [item]
            : item.quantity > 1 ? [{ ...item, quantity: item.quantity - 1 }] : []))}
          showPagination
          page={productPage} hasMore={hasMore} loading={loading}
          onPrevious={() => setProductPage(page => Math.max(0, page - 1))}
          onNext={() => setProductPage(page => page + 1)} />}
    </section>
  </>
}

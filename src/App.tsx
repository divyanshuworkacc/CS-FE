import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, Check, ChevronDown, LogOut, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, Store, X } from 'lucide-react'
import { useAuth } from './auth/AuthProvider'
import { useCollection } from './hooks/useCollection'
import { api, errorMessage, tenantPath } from './lib/api'
import { addToCart, loadCart, purchasableQuantity } from './lib/cart'
import type { CartItem, Product, Tenant, View } from './types'
import { ProductCard } from './components/ProductCard'
import { EmptyState, ErrorNotice, Loading, SectionHeading, SignInPrompt } from './components/ui'
import { ProfileSetup } from './components/ProfileSetup'
import { CartDrawer } from './components/CartDrawer'
import { Orders } from './pages/Orders'
import { Manage } from './pages/Manage'

const CART_KEY = 'common-shopping-bag-v1'

export default function App() {
  const auth = useAuth()
  const [view, setView] = useState<View>('shop')
  const [tenantId, setTenantId] = useState<number | null>(null)
  const [revision, setRevision] = useState(0)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All finds')
  const [sort, setSort] = useState('featured')
  const [cart, setCart] = useState<CartItem[]>(() => loadCart(CART_KEY))
  const [cartOpen, setCartOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [favouriteBusy, setFavouriteBusy] = useState<number | null>(null)
  const tenants = useCollection<Tenant>('/tenants', false, revision)
  const tenant = tenantId === null ? tenants.data[0] : tenants.data.find(item => item.id === tenantId)
  const products = useCollection<Product>(tenant ? tenantPath(tenant.name, 'products') : null, false, revision)
  const favourites = useCollection<Product>(auth.profile ? '/favourites' : null, true, revision)
  const manager = auth.profile?.role === 'Admin' || auth.profile?.role === 'Tenant'
  const items = cart.filter(item => item.product.tenant_id === tenant?.id)
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0)
  const refresh = () => setRevision(value => value + 1)
  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)) } catch { /* Shopping still works without storage. */ }
  }, [cart])
  useEffect(() => { if (notice) { const timeout = setTimeout(() => setNotice(''), 4000); return () => clearTimeout(timeout) } }, [notice])
  useEffect(() => { setCategory('All finds'); setQuery('') }, [tenant?.id, view])
  useEffect(() => { if (!manager && view === 'manage') setView('shop') }, [manager, view])

  const source = view === 'favourites' ? favourites.data.filter(product => product.tenant_id === tenant?.id) : products.data
  const categories = ['All finds', ...new Set(source.map(product => product.category).sort())]
  const visible = useMemo(() => {
    const list = source.filter(product => (category === 'All finds' || product.category === category)
      && `${product.name} ${product.category}`.toLowerCase().includes(query.toLowerCase().trim()))
    if (sort === 'price-low') list.sort((a, b) => a.price - b.price)
    if (sort === 'price-high') list.sort((a, b) => b.price - a.price)
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name))
    return list
  }, [source, category, query, sort])

  function changeTenant(id: number) { setTenantId(id); setCartOpen(false); setActionError('') }
  function replaceItems(next: CartItem[]) { setCart(previous => [...previous.filter(item => item.product.tenant_id !== tenant?.id), ...next]) }
  function add(product: Product) {
    setCart(previous => addToCart(previous, product)); setNotice(`${product.name} added to your bag`)
  }
  async function toggleFavourite(product: Product) {
    if (!auth.authenticated) { await auth.login(); return }
    if (!auth.profile) { setActionError('Finish your account setup to save favourites.'); return }
    if (favouriteBusy !== null) return
    setFavouriteBusy(product.id); setActionError('')
    try {
      await api(`/favourites/${product.id}`, { method: 'POST' }, true)
      setNotice(favourites.data.some(item => item.id === product.id) ? 'Removed from favourites' : 'Saved to your favourites')
      refresh()
    } catch (error) { setActionError(errorMessage(error)) }
    finally { setFavouriteBusy(null) }
  }
  const navigate = (next: View) => {
    if (next === 'manage' && auth.profile?.role === 'Tenant' && auth.profile.tenant_id !== null) {
      setTenantId(auth.profile.tenant_id)
    }
    setView(next)
    setActionError('')
  }
  const loading = products.loading || tenants.loading || (view === 'favourites' && favourites.loading)
  const collectionError = tenants.error || products.error || (view === 'favourites' ? favourites.error : '')

  return <div className="app-shell">
    <header className="header"><div className="header-inner"><button className="wordmark" onClick={() => navigate('shop')} aria-label="Common home">common<span>.</span></button>
      <nav className="desktop-nav" aria-label="Main navigation">{([['shop', 'Discover'], ['favourites', 'Favourites'], ['orders', 'My orders'], ...(manager ? [['manage', 'Manage store']] : [])] as [View, string][]).map(([key, label]) =>
        <button key={key} onClick={() => navigate(key)} className={view === key ? 'active' : ''}>{label}</button>)}</nav>
      <div className="header-actions">{auth.authenticated ? <><span className="account-name" title={auth.profile?.role}>Hi, {auth.profile?.name || auth.username}</span><button className="icon-button" onClick={() => void auth.logout()} aria-label="Sign out"><LogOut size={19} /></button></>
        : <button className="login-button" onClick={() => void auth.login()} disabled={auth.checking}>{auth.checking ? 'Connecting…' : 'Sign in'}<ArrowUpRight size={15} /></button>}
        <span className="header-divider" /><button className="bag-button" onClick={() => setCartOpen(true)} disabled={!tenant} aria-label={`Shopping bag, ${cartCount} items`}><ShoppingBag size={20} /><span className="hidden sm:inline">Bag</span><span className="bag-count">{cartCount}</span></button>
      </div></div>
      <nav className="mobile-nav" aria-label="Mobile navigation"><button className={view === 'shop' ? 'active' : ''} onClick={() => navigate('shop')}>Discover</button><button className={view === 'favourites' ? 'active' : ''} onClick={() => navigate('favourites')}>Favourites</button><button className={view === 'orders' ? 'active' : ''} onClick={() => navigate('orders')}>Orders</button>{manager && <button className={view === 'manage' ? 'active' : ''} onClick={() => navigate('manage')}>Manage</button>}</nav>
    </header>
    <main className="main-content">
      {auth.error && <div className="connection-notice"><ShieldCheck size={17} /><span>{auth.error}</span><button onClick={() => auth.authenticated ? void auth.reloadProfile() : window.location.reload()}>{auth.authenticated ? 'Retry' : 'Reload'} <ArrowRight size={13} /></button></div>}
      {auth.needsProfile && <ProfileSetup done={refresh} />}
      {view === 'shop' && <section className="mb-8">
        <p className="eyebrow">SHOP</p>
        <h1 className="text-3xl font-semibold">Products from every brand</h1>
        <p className="mt-2 text-stone-600">Choose a brand, then browse and shop its products.</p>
      </section>}
      <div className="store-context"><div className="flex items-center gap-2"><span className="status-dot" /><span>YOUR CORNER OF COMMON</span></div>
        <label className="store-switch"><Store size={16} /><span className="sr-only">Current store</span><select aria-label="Current store" value={tenant?.id ?? ''} onChange={event => changeTenant(Number(event.target.value))} disabled={!tenants.data.length || (view === 'manage' && auth.profile?.role === 'Tenant')}>
          {!tenants.data.length && <option value="">No stores yet</option>}{tenants.data.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select><ChevronDown size={14} /></label></div>
      {view === 'manage' && manager ? <Manage tenant={tenant} tenants={tenants.data} products={products.data} refresh={refresh} selectTenant={changeTenant} />
        : (view === 'orders' || view === 'favourites') && !auth.profile && !auth.needsProfile ? <SignInPrompt action={() => void (auth.authenticated ? auth.reloadProfile() : auth.login())} />
        : view === 'orders' && auth.needsProfile ? <EmptyState title="Create your customer account">Use the account setup above, then your purchases will appear here.</EmptyState>
        : view === 'orders' ? <Orders revision={revision} retry={refresh} shop={() => navigate('shop')} />
        : <section id="collection" className="collection"><SectionHeading eyebrow={view === 'favourites' ? 'THE ONES YOU LOVE' : 'A LITTLE SOMETHING FOR YOU'} title={view === 'favourites' ? 'Good taste. Saved.' : 'Find your everyday favourites.'}>
          <span className="collection-count">{source.length} {source.length === 1 ? 'find' : 'finds'} to explore <ArrowDown size={14} /></span>
        </SectionHeading>
          <div className="collection-tools"><div className="search-field"><Search size={18} /><input aria-label="Search products" placeholder="Search for something good…" value={query} onChange={event => setQuery(event.target.value)} />{query && <button aria-label="Clear search" onClick={() => setQuery('')}><X size={16} /></button>}</div>
            <label className="sort-field"><SlidersHorizontal size={16} /><span className="sr-only">Sort products</span><select aria-label="Sort products" value={sort} onChange={event => setSort(event.target.value)}><option value="featured">Featured finds</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option><option value="name">Name: A to Z</option></select><ChevronDown size={14} /></label></div>
          <div className="category-tabs" aria-label="Product categories">{categories.map(item => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)} aria-pressed={category === item}>{item === 'All finds' && <Sparkles size={14} />}{item}</button>)}</div>
          {collectionError ? <ErrorNotice retry={refresh}>{collectionError}</ErrorNotice> : loading ? <Loading />
            : visible.length ? <div className="product-grid">{visible.map(product => <ProductCard key={product.id} product={product} favourite={favourites.data.some(item => item.id === product.id)} inCart={cart.find(item => item.product.id === product.id)?.quantity || 0} favouriteBusy={favouriteBusy !== null || auth.checking}
              onFavourite={() => void toggleFavourite(product)} onAdd={() => { if (purchasableQuantity(product)) add(product) }} />)}</div>
            : <EmptyState title={query || category !== 'All finds' ? 'No finds just yet' : view === 'favourites' ? 'A place for your favourites' : 'Good things are on their way.'}
              action={query || category !== 'All finds' ? <button className="button-secondary mt-5" onClick={() => { setQuery(''); setCategory('All finds') }}>Clear filters</button> : manager && view === 'shop' ? <button className="button-primary mt-5" onClick={() => navigate('manage')}>Stock your store <ArrowRight size={17} /></button> : undefined}>
              {query || category !== 'All finds' ? 'Try a different search or explore another category.' : view === 'favourites' ? 'Tap the heart on a product to keep it here. Favourites are shown for the selected store.' : tenant ? `${tenant.name} is getting its collection ready. Check back soon to discover something new.` : 'The first store is getting ready. An administrator can create it from Manage store.'}
            </EmptyState>}
        </section>}
    </main>
    <footer className="footer"><button className="wordmark" onClick={() => navigate('shop')}>common<span>.</span></button><p>Good finds. Great everyday.</p><span>Made for the way you live.</span></footer>
    {notice && <div className="toast" role="status"><Check size={17} />{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={15} /></button></div>}
    {cartOpen && tenant && <CartDrawer tenant={tenant} items={items} replace={replaceItems} close={() => setCartOpen(false)} ordered={order => { setCartOpen(false); setView('orders'); setNotice(`Order #${order.id} placed. Thank you!`); refresh() }} />}
  </div>
}

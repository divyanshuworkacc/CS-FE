import { ArrowUpRight, ChevronDown, LogOut, ShoppingBag, Store } from 'lucide-react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { useCart } from '../features/cart/CartContext'
import { useStore } from '../app/store-context'

export function SiteHeader({ showBrandFilter }: { showBrandFilter: boolean }) {
  const auth = useAuth()
  const cart = useCart()
  const store = useStore()
  const location = useLocation()
  const isManage = location.pathname.replace(/\/+$/, '') === '/manage'
  const manager = auth.profile?.role === 'Admin' || auth.profile?.role === 'Tenant'
  const className = ({ isActive }: { isActive: boolean }) => isActive ? 'active' : ''

  return <header className="header">
    <div className="header-inner">
      <Link className="wordmark" to="/discover" aria-label="Common home">common<span>.</span></Link>
      <nav className="desktop-nav" aria-label="Main navigation">
        <NavLink to="/discover" className={className}>Discover</NavLink>
        <NavLink to="/favourites" className={className}>Favourites</NavLink>
        <NavLink to="/orders" className={className}>My orders</NavLink>
        {manager && <NavLink to="/manage" className={className}>Manage store</NavLink>}
      </nav>
      <div className="header-actions">
        {auth.authenticated
          ? <><span className="account-name" title={auth.profile?.role}>Hi, {auth.profile?.name || auth.username}</span>
            <button className="icon-button" onClick={() => void auth.logout()} aria-label="Sign out"><LogOut size={19} /></button></>
          : <button className="login-button" onClick={() => void auth.login()} disabled={auth.checking}>
            {auth.checking ? 'Connecting…' : 'Sign in'}<ArrowUpRight size={15} />
          </button>}
        <span className="header-divider" />
        <button className="bag-button" onClick={() => cart.setIsOpen(true)} aria-label={`Shopping bag, ${cart.count} items`}>
          <ShoppingBag size={20} /><span className="hidden sm:inline">Bag</span><span className="bag-count">{cart.count}</span>
        </button>
      </div>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <NavLink to="/discover" className={className}>Discover</NavLink>
      <NavLink to="/favourites" className={className}>Favourites</NavLink>
      <NavLink to="/orders" className={className}>Orders</NavLink>
      {manager && <NavLink to="/manage" className={className}>Manage</NavLink>}
    </nav>
    {showBrandFilter && <div className="brand-filter-bar">
      <div className="flex items-center gap-2"><span className="status-dot" /><span>FILTER PRODUCTS BY BRAND</span></div>
      <label className="store-switch"><Store size={16} /><span className="sr-only">Brand filter</span>
        <select aria-label="Filter products by brand" value={store.selectedBrandId}
          onChange={event => store.selectBrand(event.target.value === 'all' ? 'all' : Number(event.target.value))}
          disabled={!store.tenants.length || (manager && auth.profile?.role === 'Tenant' && isManage)}>
          {isManage
            ? <option value="all">Choose a brand</option>
            : <option value="all">All brands</option>}
          {store.tenants.map(brand => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
        </select><ChevronDown size={14} />
      </label>
    </div>}
  </header>
}

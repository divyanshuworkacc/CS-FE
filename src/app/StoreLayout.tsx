import { useEffect } from 'react'
import { ArrowRight, Check, ShieldCheck, X } from 'lucide-react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { CartDrawer } from '../components/CartDrawer'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { ProfileSetup } from '../components/ProfileSetup'
import { useCart } from '../features/cart/CartContext'
import { useStore } from './store-context'
import type { Order } from '../types'

export function StoreLayout() {
  const auth = useAuth()
  const cart = useCart()
  const store = useStore()
  const location = useLocation()
  const navigate = useNavigate()
  const routePath = location.pathname.replace(/\/+$/, '') || '/'
  const isManage = routePath === '/manage'
  const showBrandFilter = ['/', '/discover', '/favourites', '/manage'].includes(routePath)

  useEffect(() => {
    if (!isManage || store.loadingTenants) return
    if (auth.profile?.role === 'Tenant' && auth.profile.tenant_id !== null) {
      store.selectBrand(auth.profile.tenant_id)
    } else if (auth.profile?.role === 'Admin' && store.selectedBrandId === 'all' && store.tenants[0]) {
      store.selectBrand(store.tenants[0].id)
    }
  }, [auth.profile?.role, auth.profile?.tenant_id, isManage, store.loadingTenants, store.selectedBrandId, store.selectBrand, store.tenants])

  function ordered(orders: Order[]) {
    cart.setIsOpen(false)
    cart.replace([])
    navigate('/orders')
    cart.setNotice(orders.length === 1
      ? `Order #${orders[0].id} placed. Thank you!`
      : `Checkout complete: ${orders.length} brand orders placed. Thank you!`)
    store.refresh()
  }

  return <div className="app-shell">
    <SiteHeader showBrandFilter={showBrandFilter} />
    <main className="main-content">
      {auth.error && <div className="connection-notice"><ShieldCheck size={17} /><span>{auth.error}</span>
        <button onClick={() => auth.authenticated ? void auth.reloadProfile() : window.location.reload()}>
          {auth.authenticated ? 'Retry' : 'Reload'}<ArrowRight size={13} />
        </button>
      </div>}
      {auth.needsProfile && <ProfileSetup done={store.refresh} />}
      <Outlet />
    </main>
    <SiteFooter />
    {cart.notice && <div className="toast" role="status"><Check size={17} />{cart.notice}
      <button aria-label="Dismiss notification" onClick={() => cart.setNotice('')}><X size={15} /></button>
    </div>}
    {cart.isOpen && <CartDrawer tenants={store.tenants} items={cart.items} replace={cart.replace}
      close={() => cart.setIsOpen(false)} ordered={ordered} />}
  </div>
}

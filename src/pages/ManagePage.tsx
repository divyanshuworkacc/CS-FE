import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { Loading } from '../components/ui'
import { useCollection } from '../hooks/useCollection'
import { tenantPath } from '../lib/api'
import type { Product } from '../types'
import { useStore } from '../app/store-context'
import { Manage } from './Manage'

export function ManagePage() {
  const auth = useAuth()
  const store = useStore()
  const isManager = auth.profile?.role === 'Admin' || auth.profile?.role === 'Tenant'
  const productPath = store.selectedBrand ? tenantPath(store.selectedBrand.name, 'products') : null
  const products = useCollection<Product>(productPath, false, store.revision)

  if (auth.checking) return <Loading />
  if (!isManager) return <Navigate to="/discover" replace />

  return <Manage tenant={store.selectedBrand} tenants={store.tenants} products={products.data}
    refresh={store.refresh} selectTenant={id => store.selectBrand(id)} />
}

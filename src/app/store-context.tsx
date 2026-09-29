import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { useCollection } from '../hooks/useCollection'
import type { Tenant } from '../types'

interface StoreState {
  tenants: Tenant[]
  loadingTenants: boolean
  tenantsError: string
  selectedBrandId: number | 'all'
  selectedBrand: Tenant | undefined
  refresh: () => void
  selectBrand: Dispatch<SetStateAction<number | 'all'>>
  revision: number
}

const StoreContext = createContext<StoreState | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [revision, setRevision] = useState(0)
  const [selectedBrandId, selectBrand] = useState<number | 'all'>('all')
  const tenants = useCollection<Tenant>('/tenants', false, revision)
  const selectedBrand = selectedBrandId === 'all'
    ? undefined
    : tenants.data.find(brand => brand.id === selectedBrandId)

  return <StoreContext.Provider value={{
    tenants: tenants.data,
    loadingTenants: tenants.loading,
    tenantsError: tenants.error,
    selectedBrandId,
    selectedBrand,
    refresh: () => setRevision(value => value + 1),
    selectBrand,
    revision,
  }}>{children}</StoreContext.Provider>
}

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('StoreProvider is missing')
  return store
}

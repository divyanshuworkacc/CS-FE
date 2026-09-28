import { useEffect, useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, Store, Trash2, Users, Package } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { allPages, api, errorMessage, tenantPath } from '../lib/api'
import { money } from '../lib/format'
import type { Product, Tenant, User } from '../types'
import { EmptyState, ErrorNotice, Loading, Modal, SectionHeading } from '../components/ui'
import { ProductArt } from '../components/ProductCard'

type Tab = 'products' | 'brands' | 'managers'

function ProductForm({ tenant, product, done, close }: {
  tenant: Tenant; product: Product | null; done: () => void; close: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const payload = {
      name: String(form.get('name')).trim(),
      category: String(form.get('category')).trim(),
      price: Number(form.get('price')),
      quantity: Number(form.get('quantity')),
    }
    try {
      await api(tenantPath(tenant.name, 'products' + (product ? '/' + product.id : '')), {
        method: product ? 'PATCH' : 'POST', body: JSON.stringify(payload),
      }, true)
      done()
      close()
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return <Modal title={product ? 'Edit product' : 'Add product'} close={() => { if (!busy) close() }}>
    <form className="grid gap-4" onSubmit={submit}>
      <label className="field">Product name<input name="name" defaultValue={product?.name} required maxLength={120} autoFocus /></label>
      <label className="field">Category<input name="category" defaultValue={product?.category} required maxLength={120} /></label>
      <div className="grid grid-cols-2 gap-4">
        <label className="field">Price<input name="price" type="number" min="0" step="0.01" defaultValue={product?.price} required /></label>
        <label className="field">Available quantity<input name="quantity" type="number" min="0" step="1" defaultValue={product?.quantity ?? 10} required /></label>
      </div>
      <p className="text-xs text-stone-500">The order quantity must be less than the available stock.</p>
      {error && <ErrorNotice>{error}</ErrorNotice>}
      <button className="button-primary justify-center" disabled={busy}>{busy ? 'Saving…' : 'Save product'}<Check size={17} /></button>
    </form>
  </Modal>
}

function BrandManagerForm({ tenant, done }: { tenant: Tenant; done: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = event.currentTarget
    const values = new FormData(form)
    const payload = {
      name: String(values.get('name')).trim(),
      username: String(values.get('username')).trim(),
      password: String(values.get('password')),
    }
    try {
      await api(tenantPath(tenant.name, 'users'), { method: 'POST', body: JSON.stringify(payload) }, true)
      form.reset()
      done()
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return <form className="store-create" onSubmit={submit}>
    <label className="field flex-1">Manager name<input name="name" required maxLength={120} /></label>
    <label className="field flex-1">Username<input name="username" required maxLength={80} autoComplete="off" /></label>
    <label className="field flex-1">Initial password<input name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
    <button className="button-primary" disabled={busy}><Plus size={17} />{busy ? 'Creating…' : 'Create manager'}</button>
    {error && <div className="w-full"><ErrorNotice>{error}</ErrorNotice></div>}
  </form>
}

export function Manage({ tenant, tenants, products, refresh, selectTenant }: {
  tenant: Tenant | undefined; tenants: Tenant[]; products: Product[]; refresh: () => void; selectTenant: (id: number) => void
}) {
  const { profile } = useAuth()
  const admin = profile?.role === 'Admin'
  const [tab, setTab] = useState<Tab>('products')
  const [editing, setEditing] = useState<Product | null | undefined>(undefined)
  const [managers, setManagers] = useState<User[]>([])
  const [accessReady, setAccessReady] = useState(false)
  const [loadingManagers, setLoadingManagers] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const canEdit = Boolean(tenant && (admin || (profile?.role === 'Tenant' && profile.tenant_id === tenant.id)))

  useEffect(() => {
    const controller = new AbortController()
    setAccessReady(false)
    setError('')
    if (!tenant) return () => controller.abort()

    api<Tenant>(tenantPath(tenant.name, 'dashboard'), { signal: controller.signal }, true)
      .then(() => setAccessReady(true))
      .catch(reason => { if (!controller.signal.aborted) setError(errorMessage(reason)) })
    return () => controller.abort()
  }, [tenant?.id, tenant?.name])

  useEffect(() => {
    const controller = new AbortController()
    if (!admin || tab !== 'managers' || !tenant) {
      setManagers([])
      return () => controller.abort()
    }
    setLoadingManagers(true)
    allPages<User>(tenantPath(tenant.name, 'users'), true, controller.signal)
      .then(setManagers)
      .catch(reason => { if (!controller.signal.aborted) setError(errorMessage(reason)) })
      .finally(() => { if (!controller.signal.aborted) setLoadingManagers(false) })
    return () => controller.abort()
  }, [admin, tab, tenant?.id, tenant?.name, revision])

  async function request(path: string, method: string, body?: unknown) {
    setBusy(true)
    setError('')
    try {
      await api(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, true)
      setRevision(value => value + 1)
      refresh()
      return true
    } catch (reason) {
      setError(errorMessage(reason))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function addBrand(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const form = event.currentTarget
    const name = String(new FormData(form).get('name')).trim()
    try {
      const brand = await api<Tenant>('/tenants', { method: 'POST', body: JSON.stringify({ name }) }, true)
      form.reset()
      refresh()
      selectTenant(brand.id)
      setTab('managers')
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return <section>
    <SectionHeading eyebrow="MANAGE" title={admin ? 'Store and account management' : (tenant?.name || 'Brand') + ' products'}>
      {tab === 'products' && canEdit && tenant && <button className="button-primary" onClick={() => setEditing(null)}><Plus size={17} /> Add product</button>}
    </SectionHeading>

    <div className="management-tabs">
      <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}><Package size={16} />Products</button>
      {admin && <>
        <button className={tab === 'brands' ? 'active' : ''} onClick={() => setTab('brands')}><Store size={16} />Brands</button>
        <button className={tab === 'managers' ? 'active' : ''} onClick={() => setTab('managers')}><Users size={16} />Brand managers</button>
      </>}
    </div>

    {error && <ErrorNotice>{error}</ErrorNotice>}
    {!accessReady && tab === 'products' && tenant && !error && <Loading />}

    {tab === 'products' && accessReady && (!tenant ? <EmptyState title="No brand assigned">Ask an administrator to assign your manager account to a brand.</EmptyState>
      : !canEdit ? <EmptyState title="No management access">Choose a brand you manage.</EmptyState>
        : !products.length ? <EmptyState title="No products yet" action={<button className="button-primary mt-5" onClick={() => setEditing(null)}><Plus size={17} /> Add the first product</button>}>
          Add products to make them available to customers.
        </EmptyState>
          : <div className="table-scroll"><table><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Available</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{products.map(product => <tr key={product.id}>
              <td><div className="flex gap-3 items-center"><ProductArt product={product} small /><span className="font-medium">{product.name}</span></div></td>
              <td>{product.category}</td><td>{money(product.price)}</td><td>{product.quantity}</td>
              <td><div className="flex gap-2">
                <button className="icon-button" disabled={busy} aria-label={'Edit ' + product.name} onClick={() => setEditing(product)}><Pencil size={16} /></button>
                <button className="icon-button danger" disabled={busy} aria-label={'Remove ' + product.name} onClick={() => {
                  if (window.confirm('Remove “' + product.name + '”?')) void request(tenantPath(tenant.name, 'products/' + product.id), 'DELETE')
                }}><Trash2 size={16} /></button>
              </div></td>
            </tr>)}</tbody></table></div>)}

    {tab === 'brands' && admin && <>
      <form className="store-create" onSubmit={addBrand}>
        <label className="field flex-1">New brand name<input name="name" placeholder="e.g. north-star" required maxLength={80} pattern="[A-Za-z0-9_-]+" /></label>
        <button className="button-primary" disabled={busy}><Plus size={17} />Create brand</button>
      </form>
      <div className="store-grid">{tenants.map(brand => <article className="store-card" key={brand.id}>
        <Store size={26} strokeWidth={1.4} /><h3>{brand.name}</h3><p>Brand #{brand.id}</p>
        <div className="flex justify-between mt-6">
          <button className="text-link" onClick={() => { selectTenant(brand.id); setTab('products') }}>Manage products</button>
          <button className="text-link" onClick={() => { selectTenant(brand.id); setTab('managers') }}>Manage logins</button>
          <button className="icon-button danger" disabled={busy} aria-label={'Delete ' + brand.name} onClick={() => {
            if (window.confirm('Delete brand “' + brand.name + '”? Brands with order history cannot be deleted.')) void request('/tenants/' + encodeURIComponent(brand.name), 'DELETE')
          }}><Trash2 size={16} /></button>
        </div>
      </article>)}</div>
      {!tenants.length && <EmptyState title="No brands yet">Create a brand, then add a manager login for it.</EmptyState>}
    </>}

    {tab === 'managers' && admin && (!tenant ? <EmptyState title="Choose a brand">Select a brand before creating its manager login.</EmptyState> : <>
      <p className="mb-5 text-sm text-stone-600">Manager accounts for <strong>{tenant.name}</strong>. The username and initial password are also created in Keycloak.</p>
      <BrandManagerForm key={tenant.id} tenant={tenant} done={() => setRevision(value => value + 1)} />
      {loadingManagers ? <Loading /> : managers.length === 0 ? <p className="py-5 text-sm text-stone-500">No brand managers yet.</p>
        : <div className="table-scroll"><table><thead><tr><th>Name</th><th>Username</th><th>Update login</th><th>Brand access</th></tr></thead>
          <tbody>{managers.map(manager => <tr key={manager.id}>
            <td className="font-medium">{manager.name || manager.username}</td><td>@{manager.username}</td>
            <td><details><summary className="text-link cursor-pointer">Edit name / password</summary>
              <form className="grid gap-2 mt-3" onSubmit={async event => {
                event.preventDefault()
                const form = event.currentTarget
                const values = new FormData(form)
                const payload: { name?: string; password?: string } = {}
                const name = String(values.get('name')).trim()
                const password = String(values.get('password'))
                if (name) payload.name = name
                if (password) payload.password = password
                if (!Object.keys(payload).length) { setError('Enter a new name or password.'); return }
                if (password && password.length < 8) { setError('Password must be at least 8 characters.'); return }
                if (await request(tenantPath(tenant.name, 'users/' + encodeURIComponent(manager.username)), 'PATCH', payload)) form.reset()
              }}>
                <input className="role-select" name="name" placeholder="New display name" maxLength={120} />
                <input className="role-select" name="password" type="password" placeholder="New password (optional)" autoComplete="new-password" />
                <button className="button-secondary" disabled={busy}>Save</button>
              </form>
            </details></td>
            <td><button className="text-link" disabled={busy} onClick={() => {
              if (window.confirm('Remove ' + manager.username + ' from ' + tenant.name + '? They will keep their account as a customer.')) {
                void request(tenantPath(tenant.name, 'users/' + encodeURIComponent(manager.username)), 'DELETE')
              }
            }}>Revoke access</button></td>
          </tr>)}</tbody></table></div>}
    </>)}

    {editing !== undefined && tenant && <ProductForm key={editing?.id || 'new'} tenant={tenant} product={editing}
      close={() => setEditing(undefined)} done={refresh} />}
  </section>
}

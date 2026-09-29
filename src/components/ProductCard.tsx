import { useEffect, useState } from 'react'
import { Armchair, BookOpen, Coffee, Headphones, Heart, Minus, Package, Plus, Shirt, ShoppingBag, Sparkles, Watch } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { api, errorMessage } from '../lib/api'
import type { Product } from '../types'
import { money } from '../lib/format'
import { purchasableQuantity } from '../lib/cart'

export function ProductArt({ product, small = false }: { product: Product; small?: boolean }) {
  const text = `${product.category} ${product.name}`.toLowerCase()
  const Icon = /shirt|cloth|apparel|tee|hoodie|fashion/.test(text) ? Shirt
    : /headphone|audio|electronic/.test(text) ? Headphones : /book|stationery/.test(text) ? BookOpen
    : /coffee|cup|mug|kitchen/.test(text) ? Coffee : /chair|home|furniture/.test(text) ? Armchair
    : /bag|tote/.test(text) ? ShoppingBag : /watch|accessor/.test(text) ? Watch
    : /care|beauty/.test(text) ? Sparkles : Package
  return <div className={`product-art palette-${product.id % 5} ${small ? 'small' : ''}`} aria-hidden="true">
    <div className="art-halo" /><Icon className="product-symbol" strokeWidth={1.1} />
    {!small && <span className="art-caption">THE EVERYDAY COLLECTION</span>}
  </div>
}

function FavouriteButton({ product, saved, authChecking, onChange }: {
  product: Product; saved: boolean; authChecking: boolean; onChange: () => void
}) {
  const auth = useAuth()
  const [isSaved, setIsSaved] = useState(saved)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => setIsSaved(saved), [saved])

  async function toggle() {
    if (busy || authChecking) return
    if (!auth.authenticated) { await auth.login(); return }
    if (!auth.profile) { setError('Finish your account setup to save favourites.'); return }
    const previousSaved = isSaved
    setIsSaved(!previousSaved)
    setBusy(true)
    setError('')
    try {
      await api(`/favourites/${product.id}`, { method: 'POST' }, true)
      onChange()
    } catch (reason) {
      setIsSaved(previousSaved)
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  return <>
    <button className={`favourite-button ${isSaved ? 'saved' : ''}`} onClick={() => void toggle()}
      disabled={busy || authChecking} aria-label={`${isSaved ? 'Remove' : 'Save'} ${product.name} ${isSaved ? 'from' : 'to'} favourites`} aria-pressed={isSaved}>
      <Heart size={18} fill={isSaved ? 'currentColor' : 'none'} />
    </button>
    {error && <span className="favourite-error" role="alert">{error}</span>}
  </>
}

export function ProductCard({ product, tenantName, favourite, authChecking, onFavouriteChange, inCart, onAdd, onDecrease }: {
  product: Product; tenantName?: string; favourite: boolean; authChecking: boolean; onFavouriteChange: () => void;
  inCart: number; onAdd: (product: Product) => void; onDecrease: (product: Product) => void
}) {
  const maximum = purchasableQuantity(product)
  return <article className="product-card">
    <div className="relative"><ProductArt product={product} />
      <FavouriteButton product={product} saved={favourite} authChecking={authChecking} onChange={onFavouriteChange} />
      {maximum === 0 && <span className="stock-badge">Unavailable</span>}
    </div>
    <div className="product-info"><div><p className="product-category">{product.category}{tenantName && <span> · {tenantName}</span>}</p><h3>{product.name}</h3></div>
      <span className="product-price">{money(product.price)}</span>
    </div>
    <div className="product-bottom"><span>{maximum ? `${maximum} available to order` : 'Check back soon'}</span>
      {inCart ? <div className="product-quantity-control" aria-label={`${product.name} quantity in bag`}>
        <button aria-label={`Decrease ${product.name} quantity`} onClick={() => onDecrease(product)}><Minus size={14} /></button>
        <span aria-live="polite">{inCart}</span>
        <button aria-label={`Increase ${product.name} quantity`} disabled={inCart >= maximum || maximum === 0} onClick={() => onAdd(product)}>
          <Plus size={14} />
        </button>
      </div> : <button className="add-button" disabled={maximum === 0} onClick={() => onAdd(product)} aria-label={`Add ${product.name} to bag`}>
        Add to bag<Plus size={15} />
      </button>}
    </div>
  </article>
}

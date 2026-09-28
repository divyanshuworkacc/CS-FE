import { Armchair, BookOpen, Coffee, Headphones, Heart, Package, Plus, Shirt, ShoppingBag, Sparkles, Watch } from 'lucide-react'
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

export function ProductCard({ product, favourite, inCart, favouriteBusy, onFavourite, onAdd }: {
  product: Product; favourite: boolean; inCart: number; favouriteBusy: boolean;
  onFavourite: () => void; onAdd: () => void
}) {
  const maximum = purchasableQuantity(product)
  return <article className="product-card">
    <div className="relative"><ProductArt product={product} />
      <button className={`favourite-button ${favourite ? 'saved' : ''}`} onClick={onFavourite}
        disabled={favouriteBusy} aria-label={`${favourite ? 'Remove' : 'Save'} ${product.name} ${favourite ? 'from' : 'to'} favourites`} aria-pressed={favourite}>
        <Heart size={18} fill={favourite ? 'currentColor' : 'none'} />
      </button>
      {maximum === 0 && <span className="stock-badge">Unavailable</span>}
    </div>
    <div className="product-info"><div><p className="product-category">{product.category}</p><h3>{product.name}</h3></div>
      <span className="product-price">{money(product.price)}</span>
    </div>
    <div className="product-bottom"><span>{maximum ? `${maximum} available to order` : 'Check back soon'}</span>
      <button className="add-button" disabled={maximum === 0 || inCart >= maximum} onClick={onAdd} aria-label={`Add ${product.name} to bag`}>
        {inCart ? `In bag (${inCart})` : 'Add to bag'}<Plus size={15} />
      </button>
    </div>
  </article>
}

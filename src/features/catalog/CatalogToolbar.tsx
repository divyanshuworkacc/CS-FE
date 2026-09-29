import { Search, SlidersHorizontal, Sparkles, X } from 'lucide-react'

export type CatalogSort = 'featured' | 'price-low' | 'price-high' | 'name'

export function CatalogToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  categories,
  category,
  onCategoryChange,
}: {
  query: string
  onQueryChange: (query: string) => void
  sort: CatalogSort
  onSortChange: (sort: CatalogSort) => void
  categories: string[]
  category: string
  onCategoryChange: (category: string) => void
}) {
  return <>
    <div className="collection-tools">
      <div className="search-field"><Search size={18} />
        <input aria-label="Search products" placeholder="Search for something good…" value={query}
          onChange={event => onQueryChange(event.target.value)} />
        {query && <button aria-label="Clear search" onClick={() => onQueryChange('')}><X size={16} /></button>}
      </div>
      <label className="sort-field"><SlidersHorizontal size={16} /><span className="sr-only">Sort products</span>
        <select aria-label="Sort products" value={sort} onChange={event => onSortChange(event.target.value as CatalogSort)}>
          <option value="featured">Featured finds</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
          <option value="name">Name: A to Z</option>
        </select>
      </label>
    </div>
    <div className="category-tabs" aria-label="Product categories">
      {categories.map(item => <button key={item} className={category === item ? 'active' : ''}
        onClick={() => onCategoryChange(item)} aria-pressed={category === item}>
        {item === 'All finds' && <Sparkles size={14} />}{item}
      </button>)}
    </div>
  </>
}
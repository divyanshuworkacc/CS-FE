import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { StoreLayout } from './app/StoreLayout'
import { StoreProvider } from './app/store-context'
import { CartProvider } from './features/cart/CartContext'
import { DiscoverPage } from './pages/DiscoverPage'
import { FavouritesPage } from './pages/FavouritesPage'
import { ManagePage } from './pages/ManagePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { OrdersPage } from './pages/OrdersPage'

export default function App() {
  return <BrowserRouter>
    <StoreProvider>
      <CartProvider>
        <Routes>
          <Route element={<StoreLayout />}>
            <Route index element={<DiscoverPage />} />
            <Route path="discover" element={<DiscoverPage />} />
            <Route path="favourites" element={<FavouritesPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="manage" element={<ManagePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </CartProvider>
    </StoreProvider>
  </BrowserRouter>
}

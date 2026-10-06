export interface Tenant { id: number; name: string }
export interface Product {
  id: number; name: string; category: string; quantity: number; price: number; tenant_id: number
}
export interface User { id: number; name: string; username: string; tenant_id: number | null; role_id: number }
export interface Profile extends User { role: 'Admin' | 'Tenant' | 'User'; tenant_name: string | null }
export interface Order {
  id: number; total_quantity: number; amount: number; user_id: number; tenant_id: number; address: string;
  order_items: { id: number; quantity: number; product_id: number; order_id: number }[]
}
export interface MarketplaceOrderCreate {
  address: string
  order_items: { product_id: number; quantity: number }[]
}
export interface CartItem { product: Product; quantity: number }

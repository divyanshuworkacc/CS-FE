import { test, expect, type Page } from '@playwright/test'
import type { Product } from '../src/types'

// All test records and OIDC tokens are confined to Playwright's network mocks.
// No test writes to the user's backend or Keycloak server.
async function fixture(page: Page, role: 'User' | 'Admin' = 'User', newUser = false) {
  let nonce = ''
  let registered = !newUser
  let favourites: Product[] = []
  let authorization: URL | undefined
  const tenants = [{ id: 1, name: 'acme' }, { id: 2, name: 'studio' }]
  const products: Product[] = [
    { id: 1, name: 'Everyday canvas tote', category: 'Accessories', price: 24, quantity: 10, tenant_id: 1 },
    { id: 2, name: 'Sunday ceramic mug', category: 'Home', price: 18, quantity: 5, tenant_id: 1 },
    { id: 3, name: 'Soft cotton essential', category: 'Apparel', price: 42, quantity: 7, tenant_id: 1 },
    { id: 4, name: 'Studio headphones', category: 'Electronics', price: 95, quantity: 1, tenant_id: 1 },
  ]
  const orders: unknown[] = []
  const profile = { id: 1, name: 'Alex', username: 'alex', tenant_id: 1, role_id: role === 'Admin' ? 1 : 3, role, tenant_name: 'acme' }
  await page.route('http://localhost:8080/**', async route => {
    const url = new URL(route.request().url())
    const cors = { 'Access-Control-Allow-Origin': 'http://localhost:5173', 'Access-Control-Allow-Credentials': 'true' }
    if (url.pathname.endsWith('step1.html')) {
      await route.fulfill({ contentType: 'text/html', body: '<script>parent.postMessage("supported", "*")</script>' })
    } else if (url.pathname.endsWith('/auth')) {
      const redirect = url.searchParams.get('redirect_uri')!
      const state = url.searchParams.get('state')!
      if (url.searchParams.get('prompt') === 'none') {
        await route.fulfill({ status: 302, headers: { location: `${redirect}#error=login_required&state=${state}` } })
      } else {
        authorization = url
        nonce = url.searchParams.get('nonce')!
        await route.fulfill({ status: 302, headers: { location: `${redirect}#code=test-code&state=${state}&session_state=test-session` } })
      }
    } else if (url.pathname.endsWith('/token')) {
      const now = Math.floor(Date.now() / 1000)
      const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
      const token = `${encode({ alg: 'RS256' })}.${encode({ sub: 'test-subject', preferred_username: 'alex', nonce, exp: now + 300, iat: now, session_state: 'test-session' })}.test-signature`
      await route.fulfill({ json: { access_token: token, id_token: token, refresh_token: token, expires_in: 300, token_type: 'Bearer' }, headers: cors })
    } else if (url.pathname.endsWith('/logout')) {
      await route.fulfill({ status: 302, headers: { location: url.searchParams.get('post_logout_redirect_uri') || 'http://localhost:5173/' } })
    } else { await route.fulfill({ status: 404, headers: cors }) }
  })
  await page.route('**/api/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api', '')
    const method = request.method()
    const protectedRequest = !['/tenants', '/acme/products', '/studio/products'].includes(path) || method !== 'GET'
    if (protectedRequest && !request.headers().authorization?.startsWith('Bearer ')) {
      await route.fulfill({ status: 401, json: { detail: 'Not authenticated' } }); return
    }
    if (path === '/tenants') {
      if (method === 'POST') tenants.push({ id: 3, ...request.postDataJSON() })
      await route.fulfill({ json: tenants })
    } else if (path === '/users/me') {
      await route.fulfill(registered ? { json: profile } : { status: 404, json: { detail: 'Authenticated with Keycloak but no matching local account. Call POST /users to complete registration.' } })
    } else if (path === '/users' && method === 'POST') {
      registered = true; Object.assign(profile, request.postDataJSON()); await route.fulfill({ json: profile })
    } else if (path === '/acme/products') {
      if (method === 'POST') { const product = { id: 5, tenant_id: 1, ...request.postDataJSON() }; products.push(product); await route.fulfill({ json: product }) }
      else await route.fulfill({ json: products })
    } else if (path === '/studio/products') { await route.fulfill({ json: [] }) }
    else if (path === '/favourites') { await route.fulfill({ json: favourites }) }
    else if (path.startsWith('/favourites/') && method === 'POST') {
      const product = products.find(item => item.id === Number(path.split('/').pop()))!
      favourites = favourites.some(item => item.id === product.id) ? favourites.filter(item => item.id !== product.id) : [...favourites, product]
      await route.fulfill({ json: product })
    } else if (path === '/acme/orders') {
      if (method === 'POST') {
        const body = request.postDataJSON()
        const entries = body.order_items as { quantity: number; product_id: number }[]
        const order = { id: 1, user_id: 1, total_quantity: entries.reduce((sum, item) => sum + item.quantity, 0),
          amount: entries.reduce((sum, item) => sum + item.quantity * products.find(product => product.id === item.product_id)!.price, 0),
          order_items: entries.map((item, i) => ({ ...item, id: i + 1, order_id: 1 })) }
        orders.push(order); await route.fulfill({ json: order })
      } else await route.fulfill({ json: orders })
    } else if (path === '/roles') { await route.fulfill({ json: [{ id: 1, name: 'Admin' }, { id: 2, name: 'Tenant' }, { id: 3, name: 'User' }] }) }
    else if (path === '/acme/users') { await route.fulfill({ json: [profile] }) }
    else await route.fulfill({ status: 404, json: { detail: 'Not found' } })
  })
  return { products, authorization: () => authorization }
}

test('browses, filters, sorts, and preserves the bag across reloads', async ({ page }) => {
  await fixture(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
  await expect(page.locator('.product-card')).toHaveCount(4)
  await page.getByRole('button', { name: 'Home', exact: true }).click()
  await expect(page.locator('.product-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'All finds', exact: true }).click()
  await page.getByLabel('Search products').fill('canvas')
  await expect(page.locator('.product-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Add Everyday canvas tote to bag', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Shopping bag, 1 items' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Studio headphones to bag', exact: true })).toBeDisabled()
  await page.getByLabel('Sort products').selectOption('price-low')
  await expect(page.locator('.product-card h3').first()).toHaveText('Sunday ceramic mug')
  await page.getByRole('button', { name: 'Shopping bag, 1 items' }).click()
  await expect(page.getByRole('dialog')).toContainText('$24.00')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByLabel('Current store').selectOption('2')
  await expect(page.getByText('Good things are on their way.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Shopping bag, 0 items' })).toBeVisible()
})

test('uses PKCE login, saves favourites, places an order, and signs out', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('Hi, Alex')).toBeVisible()
  expect(state.authorization()?.searchParams.get('code_challenge_method')).toBe('S256')
  expect(state.authorization()?.searchParams.get('response_type')).toBe('code')
  expect(state.authorization()?.searchParams.get('client_id')).toBe('ecommerce-frontend')
  await page.getByRole('button', { name: 'Save Sunday ceramic mug to favourites' }).click()
  await expect(page.getByRole('button', { name: 'Remove Sunday ceramic mug from favourites' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Add Sunday ceramic mug to bag', exact: true }).click()
  await page.getByRole('button', { name: 'Shopping bag, 1 items' }).click()
  await page.getByRole('button', { name: 'Place order', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Order #0001' })).toBeVisible()
  await expect(page.locator('.order-card')).toContainText('$18.00')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
})

test('new Keycloak users finish local registration', async ({ page }) => {
  await fixture(page, 'User', true)
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('Welcome, alex.')).toBeVisible()
  await page.getByLabel('Your name').fill('New member')
  await page.getByLabel('Home store').selectOption('1')
  await page.getByRole('button', { name: 'Start exploring', exact: true }).click()
  await expect(page.getByText('Hi, New member')).toBeVisible()
  await expect(page.getByText('Welcome, alex.')).not.toBeVisible()
})

test('administrators can create products and stores', async ({ page }) => {
  await fixture(page, 'Admin')
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Manage store', exact: true }).click()
  await page.getByRole('button', { name: 'Add product', exact: true }).click()
  await page.getByLabel('Product name').fill('Field notebook')
  await page.getByLabel('Category', { exact: true }).fill('Stationery')
  await page.getByLabel('Price', { exact: true }).fill('12')
  await page.getByRole('button', { name: 'Save product', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Field notebook', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Stores', exact: true }).click()
  await page.getByLabel('New store name').fill('workshop')
  await page.getByRole('button', { name: 'Create store', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'workshop', exact: true })).toBeVisible()
})

test('mobile layout fits the viewport and the bag is keyboard accessible', async ({ page }) => {
  await fixture(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('.product-card')).toHaveCount(4)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'test-results/mobile-storefront.png', fullPage: true })
  await page.getByRole('button', { name: 'Add Sunday ceramic mug to bag', exact: true }).click()
  await page.getByRole('button', { name: 'Shopping bag, 1 items' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
})

test('desktop storefront renders and handles an API outage', async ({ page }) => {
  await fixture(page)
  await page.goto('/')
  await expect(page.locator('.product-card')).toHaveCount(4)
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
  await page.screenshot({ path: 'test-results/desktop-storefront.png', fullPage: true })
  await page.route('**/api/tenants?**', route => route.fulfill({ status: 500, body: 'Internal Server Error' }))
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('The server could not complete this request')
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
})

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
    { id: 6, name: 'Studio linen throw', category: 'Home', price: 56, quantity: 4, tenant_id: 2 },
  ]
  const orders: unknown[] = []
  const checkoutBodies: { address: string; order_items: { quantity: number; product_id: number }[] }[] = []
  const productRequests: string[] = []
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
    const protectedRequest = !['/tenants', '/products', '/acme/products', '/studio/products'].includes(path) || method !== 'GET'
    if (protectedRequest && !request.headers().authorization?.startsWith('Bearer ')) {
      await route.fulfill({ status: 401, json: { detail: 'Not authenticated' } }); return
    }
    if (path === '/tenants') {
      if (method === 'POST') {
        const brand = { id: Math.max(...tenants.map(tenant => tenant.id)) + 1, ...request.postDataJSON() }
        tenants.push(brand)
        await route.fulfill({ json: brand })
      } else await route.fulfill({ json: tenants })
    } else if (path === '/products') {
      const params = new URL(request.url()).searchParams
      productRequests.push(request.url())
      const search = params.get('search')?.toLowerCase()
      const category = params.get('category')
      const sort = params.get('sort') || 'featured'
      const skip = Number(params.get('skip') || 0)
      const limit = Number(params.get('limit') || 10)
      const matches = products.filter(product => (!search || product.name.toLowerCase().includes(search))
        && (!category || product.category === category))
      if (sort === 'price-low') matches.sort((a, b) => a.price - b.price || a.id - b.id)
      if (sort === 'price-high') matches.sort((a, b) => b.price - a.price || a.id - b.id)
      if (sort === 'name') matches.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()) || a.id - b.id)
      await route.fulfill({ json: matches.slice(skip, skip + limit) })
    } else if (path === '/users/me') {
      await route.fulfill(registered ? { json: profile } : { status: 404, json: { detail: 'Authenticated with Keycloak but no matching local account. Call POST /users to complete registration.' } })
    } else if (path === '/users' && method === 'POST') {
      registered = true; await route.fulfill({ json: profile })
    } else if (path === '/acme/dashboard') {
      await route.fulfill({ json: tenants[0] })
    } else if (path === '/acme/products') {
      if (method === 'POST') { const product = { id: 5, tenant_id: 1, ...request.postDataJSON() }; products.push(product); await route.fulfill({ json: product }) }
      else await route.fulfill({ json: products.filter(product => product.tenant_id === 1) })
    } else if (path === '/studio/products') { await route.fulfill({ json: products.filter(product => product.tenant_id === 2) }) }
    else if (path === '/favourites') { await route.fulfill({ json: favourites }) }
    else if (path.startsWith('/favourites/') && method === 'POST') {
      const product = products.find(item => item.id === Number(path.split('/').pop()))!
      favourites = favourites.some(item => item.id === product.id) ? favourites.filter(item => item.id !== product.id) : [...favourites, product]
      await route.fulfill({ json: product })
    } else if (path === '/orders') {
      if (method === 'POST') {
        const body = request.postDataJSON()
        checkoutBodies.push(body)
        const entries = body.order_items as { quantity: number; product_id: number }[]
        const grouped = new Map<number, typeof entries>()
        for (const item of entries) {
          const product = products.find(entry => entry.id === item.product_id)!
          grouped.set(product.tenant_id, [...(grouped.get(product.tenant_id) || []), item])
          product.quantity -= item.quantity
        }
        let nextOrderId = orders.length
        const created = [...grouped.entries()].map(([tenant_id, items]) => {
          const id = ++nextOrderId
          return { id, user_id: 1, tenant_id, address: body.address,
            total_quantity: items.reduce((sum, item) => sum + item.quantity, 0),
            amount: items.reduce((sum, item) => sum + item.quantity * products.find(product => product.id === item.product_id)!.price, 0),
            order_items: items.map((item, i) => ({ ...item, id: i + 1, order_id: id })) }
        })
        orders.push(...created); await route.fulfill({ json: created })
      } else await route.fulfill({ json: orders })
    } else if (path === '/roles') { await route.fulfill({ json: [{ id: 1, name: 'Admin' }, { id: 2, name: 'Tenant' }, { id: 3, name: 'User' }] }) }
    else if (path === '/acme/users') { await route.fulfill({ json: [profile] }) }
    else await route.fulfill({ status: 404, json: { detail: 'Not found' } })
  })
  return { products, authorization: () => authorization, productRequests, checkoutBodies }
}

test('browses, filters, sorts, and preserves the bag across reloads', async ({ page }) => {
  const state = await fixture(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
  await expect(page.locator('.product-card')).toHaveCount(5)
  await page.getByRole('button', { name: 'Home', exact: true }).click()
  await expect(page.locator('.product-card')).toHaveCount(2)
  await page.getByRole('button', { name: 'All finds', exact: true }).click()
  await page.getByLabel('Search products').fill('canvas')
  await expect(page.locator('.product-card')).toHaveCount(1)
  await page.getByRole('button', { name: 'Add Everyday canvas tote to bag', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Shopping bag, 1 items' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add Studio headphones to bag', exact: true })).toBeDisabled()
  await page.getByLabel('Sort products').selectOption('price-high')
  await expect(page.locator('.product-card h3').first()).toHaveText('Studio headphones')
  expect(state.productRequests[state.productRequests.length - 1]).toContain('sort=price-high')
  await page.getByLabel('Sort products').selectOption('price-low')
  await expect(page.locator('.product-card h3').first()).toHaveText('Sunday ceramic mug')
  expect(state.productRequests[state.productRequests.length - 1]).toContain('sort=price-low')
  await page.getByRole('button', { name: 'Shopping bag, 1 items' }).click()
  await expect(page.getByRole('dialog')).toContainText('₹24.00')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  await page.getByLabel('Filter products by brand').selectOption('2')
  await expect(page.locator('.product-card')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Shopping bag, 1 items' })).toBeVisible()
  await page.getByRole('button', { name: 'Add Studio linen throw to bag', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Shopping bag, 2 items' })).toBeVisible()
  await page.getByRole('button', { name: 'Shopping bag, 2 items' }).click()
  await expect(page.getByRole('dialog')).toContainText('acme')
  await expect(page.getByRole('dialog')).toContainText('studio')
})

test('discovers and searches products across all brands', async ({ page }) => {
  await fixture(page)
  await page.goto('/')
  await expect(page.locator('.product-card')).toHaveCount(5)
  await expect(page.locator('.product-category').filter({ hasText: 'studio' })).toHaveCount(1)
  await page.getByLabel('Search products').fill('linen')
  await expect(page.locator('.product-card')).toHaveCount(1)
  await expect(page.locator('.product-card')).toContainText('Studio linen throw')
})

test('navigation uses page URLs and supports browser history and deep links', async ({ page }) => {
  await fixture(page)
  await page.goto('/')
  await expect(page).toHaveURL(/\/$/)
  await page.getByRole('link', { name: 'Discover', exact: true }).click()
  await expect(page).toHaveURL(/\/discover$/)

  await page.getByRole('link', { name: 'Favourites', exact: true }).click()
  await expect(page).toHaveURL(/\/favourites$/)
  await page.getByRole('link', { name: 'My orders', exact: true }).click()
  await expect(page).toHaveURL(/\/orders$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/favourites$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/discover$/)

  await page.goto('/orders')
  await expect(page.getByRole('heading', { name: 'Make yourself at home' })).toBeVisible()
})

test('uses PKCE login and checks out items from multiple brands together', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Add Studio linen throw to bag', exact: true }).click()
  await page.getByRole('button', { name: 'Shopping bag, 2 items' }).click()
  await expect(page.getByRole('dialog')).toContainText('acme')
  await expect(page.getByRole('dialog')).toContainText('studio')
  const placeOrder = page.getByRole('button', { name: 'Place order', exact: true })
  await expect(placeOrder).toBeDisabled()
  await page.getByLabel('Delivery address').fill('12 Market Street, Springfield')
  await expect(placeOrder).toBeEnabled()
  await placeOrder.click()
  await expect(page.getByRole('heading', { name: 'Order #0001' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Order #0002' })).toBeVisible()
  await expect(page.locator('.order-card').nth(0)).toContainText('Delivery address: 12 Market Street, Springfield')
  await expect(page.locator('.order-card').nth(1)).toContainText('Delivery address: 12 Market Street, Springfield')
  expect(state.checkoutBodies[0].address).toBe('12 Market Street, Springfield')
  await expect(page.locator('.orders-list')).toContainText('₹18.00')
  await expect(page.locator('.orders-list')).toContainText('₹56.00')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
})

test('favourite buttons stay in sync with the backend on every page', async ({ page }) => {
  await fixture(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()

  const saveButton = page.getByRole('button', { name: 'Save Sunday ceramic mug to favourites' })
  await saveButton.scrollIntoViewIfNeeded()
  const scrollBeforeToggle = await page.evaluate(() => window.scrollY)
  await saveButton.click()
  const removeButton = page.getByRole('button', { name: 'Remove Sunday ceramic mug from favourites' })
  await expect(removeButton).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.product-card')).toHaveCount(5)
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeToggle)

  await page.getByRole('link', { name: 'Favourites', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Remove Sunday ceramic mug from favourites' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Remove Sunday ceramic mug from favourites' }).click()
  await expect(page.getByText('A place for your favourites')).toBeVisible()

  await page.getByRole('link', { name: 'Discover', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save Sunday ceramic mug to favourites' })).toHaveAttribute('aria-pressed', 'false')
})

test('new Keycloak users finish local registration', async ({ page }) => {
  await fixture(page, 'User', true)
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('Welcome, alex.')).toBeVisible()
  await page.getByRole('button', { name: 'Create customer account' }).click()
  await expect(page.getByText('Hi, Alex')).toBeVisible()
  await expect(page.getByText('Welcome, alex.')).not.toBeVisible()
})

test('administrators can create products and brands', async ({ page }) => {
  await fixture(page, 'Admin')
  await page.goto('/')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('link', { name: 'Manage store', exact: true }).click()
  await page.getByRole('button', { name: 'Add product', exact: true }).click()
  await page.getByLabel('Product name').fill('Field notebook')
  await page.getByLabel('Category', { exact: true }).fill('Stationery')
  await page.getByLabel('Price', { exact: true }).fill('12')
  await page.getByRole('button', { name: 'Save product', exact: true }).click()
  await expect(page.getByRole('cell', { name: 'Field notebook', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Brands', exact: true }).click()
  await page.getByLabel('New brand name').fill('workshop')
  await page.getByRole('button', { name: 'Create brand', exact: true }).click()
  await expect(page.locator('p').filter({ hasText: 'Manager accounts for workshop' })).toBeVisible()
})

test('mobile layout fits the viewport and the bag is keyboard accessible', async ({ page }) => {
  await fixture(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.locator('.product-card')).toHaveCount(5)
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
  await expect(page.locator('.product-card')).toHaveCount(5)
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled()
  await page.screenshot({ path: 'test-results/desktop-storefront.png', fullPage: true })
  await page.route('**/api/tenants?**', route => route.fulfill({ status: 500, body: 'Internal Server Error' }))
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('The server could not complete this request')
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible()
})

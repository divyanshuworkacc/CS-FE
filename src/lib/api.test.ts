import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('./keycloak', () => ({ accessToken: vi.fn(async () => 'test-token') }))
import { allPages, api, ApiError, fetchCategories, fetchPage, tenantPath } from './api'
import { accessToken } from './keycloak'

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })
describe('API client', () => {
  it('does not send credentials to public endpoints', async () => {
    const fetch = vi.fn(async () => new Response('[]'))
    vi.stubGlobal('fetch', fetch)
    await api('/tenants')
    expect(accessToken).not.toHaveBeenCalled()
    expect((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toBeInstanceOf(Headers)
  })
  it('gets a refreshed token before a protected request', async () => {
    const fetch = vi.fn(async (_url: string, options: RequestInit) => {
      expect(new Headers(options.headers).get('Authorization')).toBe('Bearer test-token')
      return new Response('{}')
    })
    vi.stubGlobal('fetch', fetch)
    await api('/users/me', {}, true)
    expect(accessToken).toHaveBeenCalledOnce()
  })
  it('preserves backend status and validation errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: [{ msg: 'Name is required' }] }), { status: 422 })))
    await expect(api('/users')).rejects.toMatchObject({ status: 422, message: 'Name is required' })
  })
  it('does not leak raw server errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Internal Server Error', { status: 500 })))
    await expect(api('/tenants')).rejects.toBeInstanceOf(ApiError)
  })
  it('fetches beyond the backend default page limit', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(Array.from({ length: 100 }, (_, id) => ({ id })))))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 100 }])))
    vi.stubGlobal('fetch', fetch)
    expect(await allPages('/tenants')).toHaveLength(101)
    expect(fetch.mock.calls[1][0]).toContain('skip=100&limit=100')
  })
  it('preserves search while fetching paginated results', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: 1 }])))
    vi.stubGlobal('fetch', fetch)
    await allPages('/Acme/products?search=blue+mug')
    expect(fetch.mock.calls[0][0]).toContain('/Acme/products?search=blue+mug&skip=0&limit=100')
  })
  it('fetches one requested page and preserves search parameters', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: 11 }])))
    vi.stubGlobal('fetch', fetch)
    await fetchPage('/Acme/products?search=blue+mug', 10, 11)
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0][0]).toContain('/Acme/products?search=blue+mug&skip=10&limit=11')
  })
  it('fetches all categories globally or for one tenant', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(['Accessories'])))
    vi.stubGlobal('fetch', fetch)
    await fetchCategories()
    await fetchCategories('Home & Co')
    expect(fetch.mock.calls[0][0]).toContain('/categories')
    expect(fetch.mock.calls[0][0]).not.toContain('tenant_name')
    expect(fetch.mock.calls[1][0]).toContain('/categories?tenant_name=Home+%26+Co')
  })
  it('encodes tenant names as one path segment', () => {
    expect(tenantPath('Home & Co', 'products')).toBe('/Home%20%26%20Co/products')
  })
  it('encodes product search as a query parameter', () => {
    expect(tenantPath('Home & Co', 'products', { search: 'blue mug' }))
      .toBe('/Home%20%26%20Co/products?search=blue+mug')
  })
})

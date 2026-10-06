import { accessToken } from './keycloak'

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export async function api<T>(path: string, options: RequestInit = {}, authenticated = false): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  if (authenticated) headers.set('Authorization', `Bearer ${await accessToken()}`)
  let response: Response
  try {
    response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}${path}`, {
      ...options, headers, signal: options.signal || AbortSignal.timeout(15000),
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new Error('Cannot reach the store. Check that the backend is running and try again.')
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body?.detail
    const message = typeof detail === 'string' ? detail : Array.isArray(detail)
      ? detail.map((entry: { msg: string }) => entry.msg).join('. ')
      : response.status >= 500 ? 'The server could not complete this request. Please try again.' : `Request failed (${response.status}).`
    throw new ApiError(response.status, message)
  }
  return body as T
}

export async function allPages<T>(path: string, authenticated = false, signal?: AbortSignal): Promise<T[]> {
  const records: T[] = []
  const separator = path.includes('?') ? '&' : '?'
  for (let skip = 0; ; skip += 100) {
    const page = await api<T[]>(`${path}${separator}skip=${skip}&limit=100`, { signal }, authenticated)
    records.push(...page)
    if (page.length < 100) return records
  }
}

export function fetchPage<T>(path: string, skip: number, limit: number, authenticated = false, signal?: AbortSignal): Promise<T[]> {
  const separator = path.includes('?') ? '&' : '?'
  return api<T[]>(`${path}${separator}skip=${skip}&limit=${limit}`, { signal }, authenticated)
}

export function fetchCategories(tenantName?: string, signal?: AbortSignal): Promise<string[]> {
  const params = new URLSearchParams(tenantName ? { tenant_name: tenantName } : {})
  const query = params.size ? `?${params}` : ''
  return api<string[]>(`/categories${query}`, { signal })
}

export const tenantPath = (name: string, resource: string, query?: Record<string, string>) => {
  const path = `/${encodeURIComponent(name)}/${resource}`
  const params = new URLSearchParams(query)
  return params.size ? `${path}?${params}` : path
}

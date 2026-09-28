import Keycloak from 'keycloak-js'

export const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'ecommerce',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'ecommerce-frontend',
})

let initialization: Promise<boolean> | undefined
export function initializeAuth() {
  // React StrictMode may mount twice; initialize the adapter only once.
  initialization ??= keycloak.init({
    onLoad: 'check-sso', pkceMethod: 'S256', checkLoginIframe: false,
    silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
    // Keep Keycloak's fallback enabled: browsers may block the hidden iframe
    // used by silent SSO, in which case it must use a regular check-sso redirect.
    silentCheckSsoFallback: true,
    // The adapter default is 10s; don't race it with an even shorter timeout.
    messageReceiveTimeout: 10000,
  })
  return initialization
}

export async function accessToken() {
  await initializeAuth()
  if (!keycloak.authenticated) throw new Error('Please sign in to continue.')
  try { await keycloak.updateToken(30) }
  catch {
    keycloak.clearToken()
    throw new Error('Your session has expired. Please sign in again.')
  }
  if (!keycloak.token) throw new Error('Please sign in again.')
  return keycloak.token
}

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, errorMessage } from '../lib/api'
import { initializeAuth, keycloak } from '../lib/keycloak'
import type { Profile } from '../types'

interface AuthState {
  authenticated: boolean; checking: boolean; profile: Profile | null;
  needsProfile: boolean; error: string; username: string;
  login: () => Promise<void>; logout: () => Promise<void>; reloadProfile: () => Promise<void>
}
const Context = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [needsProfile, setNeedsProfile] = useState(false)
  const [error, setError] = useState('')
  const reloadProfile = useCallback(async () => {
    setError('')
    try {
      setProfile(await api<Profile>('/users/me', {}, true))
      setNeedsProfile(false)
    } catch (error) {
      setProfile(null)
      if (error instanceof ApiError && error.status === 404 && error.message.includes('no matching local account')) {
        setNeedsProfile(true)
      } else { setNeedsProfile(false); setError(errorMessage(error)) }
    }
  }, [])
  useEffect(() => {
    let alive = true
    keycloak.onAuthLogout = () => {
      setAuthenticated(false); setProfile(null); setNeedsProfile(false)
    }
    keycloak.onTokenExpired = () => { void keycloak.updateToken(30).catch(() => keycloak.clearToken()) }
    initializeAuth().then(async signedIn => {
      if (!alive) return
      setAuthenticated(signedIn)
      if (signedIn) await reloadProfile()
    }).catch(() => {
      if (alive) setError('Could not check your Keycloak session. You can still browse; try Sign in again, and check that Keycloak is running at http://localhost:8080 if it still fails.')
    }).finally(() => { if (alive) setChecking(false) })
    return () => { alive = false }
  }, [reloadProfile])
  const login = async () => {
    try { await keycloak.login({ redirectUri: `${window.location.origin}/` }) }
    catch { setError('Could not open Keycloak. Check the login service and reload this page.') }
  }
  const logout = async () => {
    try { await keycloak.logout({ redirectUri: `${window.location.origin}/` }) }
    catch { setError('Could not sign out. Please try again.') }
  }
  return <Context.Provider value={{
    authenticated, checking, profile, needsProfile, error,
    username: keycloak.tokenParsed?.preferred_username || '', login, logout, reloadProfile
  }}>
    {children}
  </Context.Provider>
}
export function useAuth() {
  const auth = useContext(Context)
  if (!auth) throw new Error('AuthProvider is missing')
  return auth
}

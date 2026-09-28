import { useState } from 'react'
import { ArrowRight, Store } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { api, errorMessage } from '../lib/api'
import { ErrorNotice } from './ui'

export function ProfileSetup({ done }: { done: () => void }) {
  const auth = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function createProfile() {
    setBusy(true)
    setError('')
    try {
      // The backend reads the customer's name and username from the Keycloak token.
      await api('/users', { method: 'POST' }, true)
      await auth.reloadProfile()
      done()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return <section className="onboarding-panel">
    <span className="empty-icon"><Store size={26} /></span>
    <div className="flex-1">
      <p className="eyebrow">ONE LAST THING</p>
      <h2>Welcome, {auth.username}.</h2>
      <p className="text-stone-500 mt-2">Create your customer account to save favourites and place orders. You can shop at any brand.</p>
      <p className="text-stone-500 mt-2 text-sm">Your name comes from your first and last name in Keycloak.</p>
      {error && <div className="mt-4"><ErrorNotice>{error}</ErrorNotice></div>}
      <button className="button-primary mt-5" onClick={() => void createProfile()} disabled={busy}>
        {busy ? 'Creating your account…' : 'Create customer account'}<ArrowRight size={17} />
      </button>
    </div>
  </section>
}

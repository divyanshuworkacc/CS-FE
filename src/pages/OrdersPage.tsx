import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { EmptyState, SignInPrompt } from '../components/ui'
import { useStore } from '../app/store-context'
import { Orders } from './Orders'

export function OrdersPage() {
  const auth = useAuth()
  const store = useStore()
  const navigate = useNavigate()

  if (!auth.profile && !auth.needsProfile) {
    return <SignInPrompt action={() => void (auth.authenticated ? auth.reloadProfile() : auth.login())} />
  }
  if (auth.needsProfile) {
    return <EmptyState title="Create your customer account">Use the account setup above, then your purchases will appear here.</EmptyState>
  }

  return <Orders revision={store.revision} retry={store.refresh} shop={() => navigate('/discover')} />
}

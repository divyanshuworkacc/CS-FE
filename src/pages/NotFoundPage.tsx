import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui'

export function NotFoundPage() {
  return <EmptyState title="That page isn’t here">
    The address may have changed. <Link className="text-link" to="/discover">Go back to Discover</Link>.
  </EmptyState>
}

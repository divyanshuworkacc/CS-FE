import { useEffect, useState } from 'react'
import { allPages, errorMessage } from '../lib/api'

export function useCollection<T>(path: string | null, authenticated = false, revision = 0) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    setData([]); setError('')
    if (!path) { setLoading(false); return }
    setLoading(true)
    allPages<T>(path, authenticated, controller.signal).then(setData).catch(error => {
      if (!controller.signal.aborted) setError(errorMessage(error))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [path, authenticated, revision])
  return { data, loading, error }
}

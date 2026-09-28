import { useEffect, useState } from 'react'
import { allPages, errorMessage, fetchPage } from '../lib/api'

export function useCollection<T>(path: string | null, authenticated = false, revision = 0, page?: { skip: number; limit: number }) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    setData([]); setError(''); setHasMore(false)
    if (!path) { setLoading(false); return }
    setLoading(true)
    const request = page
      ? fetchPage<T>(path, page.skip, page.limit + 1, authenticated, controller.signal)
      : allPages<T>(path, authenticated, controller.signal)
    request.then(records => {
      setData(page ? records.slice(0, page.limit) : records)
      setHasMore(Boolean(page && records.length > page.limit))
    }).catch(error => {
      if (!controller.signal.aborted) setError(errorMessage(error))
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [path, authenticated, revision, page?.skip, page?.limit])
  return { data, loading, error, hasMore }
}

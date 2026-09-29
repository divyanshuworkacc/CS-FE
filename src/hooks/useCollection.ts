import { useEffect, useRef, useState } from 'react'
import { allPages, errorMessage, fetchPage } from '../lib/api'

export function useCollection<T>(path: string | null, authenticated = false, revision = 0, page?: { skip: number; limit: number }) {
  const requestKey = `${path}|${authenticated}|${page?.skip ?? ''}|${page?.limit ?? ''}`
  const previousRequestKey = useRef(requestKey)
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasMore, setHasMore] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    if (previousRequestKey.current !== requestKey) {
      setData([])
      setHasMore(false)
    }
    previousRequestKey.current = requestKey
    setError('')
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
  }, [path, authenticated, revision, page?.skip, page?.limit, requestKey])
  return { data, loading, error, hasMore }
}

import { useEffect, useReducer } from 'react'
import { syncStatus } from './sync'

/** Subscribe a component to live sync status (online/syncing/pending). */
export function useSyncStatus() {
  const [, force] = useReducer((x: number) => x + 1, 0)
  useEffect(() => syncStatus.subscribe(force), [])
  return syncStatus
}

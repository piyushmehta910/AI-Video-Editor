import * as React from 'react'
import { useRouterState } from '@tanstack/react-router'

export function useIsFromEditor(): boolean {
  const routerFrom = useRouterState({
    select: (s) => {
      const search = s.location.search as { from?: string } | undefined
      return search?.from === 'editor'
    },
  })

  const [fromSession, setFromSession] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return (
        window.location.search.includes('from=editor') ||
        sessionStorage.getItem('clipforge_origin') === 'editor'
      )
    } catch {
      return false
    }
  })

  React.useEffect(() => {
    try {
      const isEditor =
        window.location.search.includes('from=editor') ||
        sessionStorage.getItem('clipforge_origin') === 'editor'
      setFromSession(isEditor)
    } catch {
      // ignore
    }
  }, [routerFrom])

  return Boolean(routerFrom || fromSession)
}


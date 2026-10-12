import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Moves focus once the next render is on the page: onto something that render adds, or off a
 * control it removes. Returns the function that asks for it; each call runs once. `resolve` runs
 * after that render and returns the element to focus, if there is one. A request made while
 * `ready` is false waits until it is true.
 */
export function useFocusRequest<T>(
  resolve: (target: T) => HTMLElement | null | undefined,
  ready = true,
): (target: T) => void {
  // A new object per request, so asking for the same target twice moves focus twice.
  const [request, setRequest] = useState<{ target: T } | null>(null)
  const done = useRef<{ target: T } | null>(null)
  const resolveRef = useRef(resolve)
  useEffect(() => {
    resolveRef.current = resolve
  })

  useEffect(() => {
    if (!request || !ready || done.current === request) return
    done.current = request
    resolveRef.current(request.target)?.focus()
  }, [request, ready])

  return useCallback((target: T) => setRequest({ target }), [])
}
